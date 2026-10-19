// app.js — o "maestro": guarda o estado e liga cliques → api → ui.
import {
  definirToken,
  buscarProvedores,
  paginaDoCatalogo,
  paginaDaBusca,
  INICIO_CATALOGO,
  buscarOndeAssistir,
  buscarParaCarrossel,
  buscarDetalhesFilme,
  buscarDetalheCompleto,
  idsParaBusca,
} from "./api.js";
import { renderizarDetalhe, mostrarDetalheCarregando, mostrarErroDetalhe, fecharDetalhe } from "./detalhe.js";
import { criarAssistidos, generosFavoritos } from "./assistidos.js";
import { criarFila } from "./fila.js";
import {
  renderizarProvedores,
  renderizarFilmes,
  removerCard,
  renderizarCarrossel,
  configurarAvaliacoes,
  preencherOndeAssistir,
  preencherOndeAssistirDestaque,
  ligarBusca,
  definirTextoBusca,
  ligarAbas,
  ligarMarca,
  marcarAba,
  atualizarContadores,
  lerRota,
  definirFiltroAtivo,
  mostrarFiltro,
  atualizarBotaoMais,
  mostrarCarregando,
  mostrarVazio,
  mostrarErro,
} from "./ui.js";

// Valor que vem no config.example.js: significa "token ainda não configurado".
const TOKEN_MODELO = "cole-seu-token-aqui";

// A busca só começa com pelo menos 2 letras, meio segundo depois
// que a pessoa para de digitar (assim não busca a cada letra).
const MIN_LETRAS = 2;
const ESPERA_DIGITACAO = 500;

// Tudo que o app precisa lembrar fica aqui.
const estado = {
  provedores: [], // lista de streamings vinda da TMDB
  selecionados: new Set(), // IDs dos streamings marcados
  aba: "catalogo", // "catalogo", "quero" ou "assisti"
  termo: "", // texto buscado; vazio = catálogo normal
  carregando: false, // evita cliques duplos no "Carregar mais"
};

// Cada busca ganha um número. Se o usuário clicar em outro filtro antes
// da resposta chegar, a resposta antiga é ignorada (só vale a última).
let ultimaBusca = 0;

// Marcações de cada filme: ✓/✗ e Quero assistir/Já assisti (no navegador).
const assistidos = criarAssistidos();

// "Onde assistir" já consultado, por ID do filme (evita perguntar duas vezes).
const ondeAssistirCache = new Map();

// Devolve a lista de streamings do filme, ou null se a consulta falhar.
function consultarOndeAssistir(idFilme) {
  if (!ondeAssistirCache.has(idFilme)) {
    const promessa = buscarOndeAssistir(idFilme).catch(() => {
      ondeAssistirCache.delete(idFilme); // falhou: tenta de novo na próxima vez
      return null;
    });
    ondeAssistirCache.set(idFilme, promessa);
  }
  return ondeAssistirCache.get(idFilme);
}

// O carrossel tem seu próprio número de busca (independente da grade).
let ultimoCarrossel = 0;
// IDs dos filmes que estão no carrossel agora.
let idsNoCarrossel = new Set();

// Monta o carrossel: 4 filmes dos gêneros que a pessoa mais gosta
// (✓ +2, só "Já assisti" +1, ✗ −2), acima de 7,5 (ou com notas menores,
// se os melhores já foram marcados). Filmes já marcados não entram. Sem
// gêneros favoritos (ou se eles não renderem nada), mostra os mais bem
// avaliados de qualquer gênero.
async function carregarCarrossel() {
  const meuCarrossel = ++ultimoCarrossel;
  const ids = idsParaBusca(estado.selecionados, estado.provedores);
  const generos = generosFavoritos(assistidos.lista());
  const foraDoCarrossel = (id) => assistidos.foraDoCarrossel(id);

  try {
    let rotulo = "Recomendados para você";
    let filmes = generos.length > 0 ? await buscarParaCarrossel(ids, generos, foraDoCarrossel) : [];
    if (filmes.length === 0) {
      rotulo = "Mais bem avaliados";
      filmes = await buscarParaCarrossel(ids, [], foraDoCarrossel);
    }
    if (meuCarrossel !== ultimoCarrossel) return; // chegou atrasado: descarta

    idsNoCarrossel = new Set(filmes.map((f) => f.id));
    renderizarCarrossel(filmes, rotulo);
    for (const filme of filmes) {
      consultarOndeAssistir(filme.id).then((lista) => preencherOndeAssistirDestaque(filme.id, lista));
    }
  } catch {
    // O carrossel é um extra: se falhar, só some (a grade mostra o erro).
    if (meuCarrossel === ultimoCarrossel) {
      idsNoCarrossel = new Set();
      renderizarCarrossel([]);
    }
  }
}

// Durante a busca o carrossel some (e respostas pendentes são ignoradas).
function esconderCarrossel() {
  ultimoCarrossel++;
  idsNoCarrossel = new Set();
  renderizarCarrossel([]);
}

// Quantos filmes cada carga põe na grade.
const FILMES_POR_CARGA = 20;

// Fila de reserva da grade atual (próximos filmes, na ordem certa).
// Uma nova lista (outro filtro, busca ou aba) ganha uma fila nova.
let fila = null;
// Filme que saiu do Catálogo → filme que entrou no lugar dele.
const substitutos = new Map();

function trocarFila(novaFila) {
  fila?.cancelar();
  fila = novaFila;
  substitutos.clear();
}

// A grade é o Catálogo (e não a busca nem uma aba de lista)?
const noCatalogo = () => estado.aba === "catalogo" && estado.termo === "";

async function carregarFilmes({ acrescentar }) {
  const minhaBusca = ++ultimaBusca;
  const emBusca = estado.termo !== "";
  estado.carregando = true;
  if (acrescentar) atualizarBotaoMais({ visivel: true, carregando: true });
  else mostrarCarregando();

  if (!acrescentar) {
    // Lista nova. Que páginas pedir: a busca por título (por relevância) ou
    // o catálogo dos streamings (das notas mais altas para as mais baixas).
    // No Catálogo só entram filmes ainda não marcados (os marcados ficam
    // nas abas). Na busca, todos aparecem, menos os com ✗.
    trocarFila(
      emBusca
        ? criarFila({
            buscarPagina: paginaDaBusca(estado.termo),
            entra: (filme) => assistidos.avaliacao(filme.id) !== "nao",
            inicio: 1,
          })
        : criarFila({
            buscarPagina: paginaDoCatalogo(idsParaBusca(estado.selecionados, estado.provedores)),
            entra: (filme) => !assistidos.marcado(filme.id),
            inicio: INICIO_CATALOGO,
          })
    );
  }

  try {
    // A fila pula páginas que só têm filmes já marcados: a grade nunca fica
    // vazia enquanto houver filmes novos para mostrar.
    const filmes = await fila.puxar(FILMES_POR_CARGA);
    if (minhaBusca !== ultimaBusca) return; // chegou atrasada: descarta

    if (filmes.length === 0 && !acrescentar) {
      mostrarVazio(emBusca ? `Nenhum filme encontrado para "${estado.termo}".` : undefined);
    } else {
      renderizarFilmes(filmes, { acrescentar, comOndeAssistir: emBusca });
    }
    atualizarBotaoMais({ visivel: fila.temMais(), carregando: false });

    if (emBusca) {
      // Os pôsteres já estão na tela; os logos chegam um a um.
      for (const filme of filmes) {
        consultarOndeAssistir(filme.id).then((lista) => preencherOndeAssistir(filme.id, lista));
      }
    }
  } catch (erro) {
    if (minhaBusca !== ultimaBusca) return;
    if (acrescentar) {
      // Falhou o "Carregar mais": mantém a grade e o botão vira "Tentar de
      // novo" (a página só avança quando a carga dá certo).
      atualizarBotaoMais({ visivel: erro.tipo !== "auth", carregando: false, erro: true });
      if (erro.tipo === "auth") mostrarErro(erro);
    } else {
      mostrarErro(erro, () => carregarFilmes({ acrescentar: false }));
    }
  } finally {
    if (minhaBusca === ultimaBusca) estado.carregando = false;
  }
}

// Redesenha os logos (para atualizar quem está marcado) e busca do zero.
function aplicarFiltro() {
  renderizarProvedores(estado.provedores, estado.selecionados, aoClicarProvedor, aoLimpar);
  carregarCarrossel();
  carregarFilmes({ acrescentar: false });
}

function aoClicarProvedor(id) {
  if (estado.selecionados.has(id)) estado.selecionados.delete(id);
  else estado.selecionados.add(id);
  aplicarFiltro();
}

function aoLimpar() {
  estado.selecionados.clear();
  aplicarFiltro();
}

function aoCarregarMais() {
  if (estado.carregando) return;
  carregarFilmes({ acrescentar: true });
}

// Depois de qualquer marcação: atualiza os números das abas e, se o
// filme marcado estava no carrossel, refaz o carrossel sem ele.
function depoisDeMarcar(filme) {
  atualizarContadores(assistidos.contagem());
  if (assistidos.marcado(filme.id) && idsNoCarrossel.has(filme.id)) carregarCarrossel();
}

// ✓ ou ✗ num card ou na página do filme.
function aoAvaliar(filme, tipo) {
  const avaliacao = assistidos.avaliar(filme, tipo);
  depoisDeMarcar(filme);
  return avaliacao;
}

// "Quero assistir" ou "Já assisti" num card ou na página do filme.
function aoMarcarStatus(filme, tipo) {
  const status = assistidos.marcarStatus(filme, tipo);
  depoisDeMarcar(filme);
  return status;
}

// "Desfazer": volta as marcações do filme para como estavam. Se outro
// filme tinha entrado no lugar dele, esse substituto devolve a vaga (volta
// para a frente da fila), e a grade continua com a mesma quantidade.
function aoRestaurar(filme, estadoAnterior) {
  assistidos.restaurar(filme, estadoAnterior);
  depoisDeMarcar(filme);
  const substituto = substitutos.get(filme.id);
  if (substituto && fila) {
    substitutos.delete(filme.id);
    removerCard(substituto.id);
    fila.devolver(substituto);
  }
}

// Um filme saiu do Catálogo (foi marcado): entra o próximo da fila no
// fim da grade, para a quantidade de filmes na tela não diminuir.
async function aoSairDaGrade(filme) {
  if (!noCatalogo() || !fila) return;
  const minhaFila = fila;
  try {
    const [novo] = await minhaFila.puxar(1);
    if (!novo || minhaFila !== fila) return; // acabaram os filmes ou a lista mudou
    renderizarFilmes([novo], { acrescentar: true });
    substitutos.set(filme.id, novo);
  } catch {
    // Sem internet: a grade só fica com um filme a menos.
  }
  if (fila === minhaFila && !estado.carregando) {
    atualizarBotaoMais({ visivel: fila.temMais(), carregando: false });
  }
}

const LISTA_VAZIA = {
  quero: 'Nenhum filme em "Quero assistir" ainda. Passe o mouse num pôster e clique em "＋ Quero assistir".',
  assisti: 'Nenhum filme em "Já assisti" ainda. Passe o mouse num pôster e clique em "👁 Já assisti" (ou dê ✓).',
};

// Mostra a aba "Quero assistir" ou "Já assisti": os filmes guardados no
// navegador, com os logos de onde assistir.
async function abrirLista(tipo) {
  const minhaBusca = ++ultimaBusca; // descarta respostas pendentes do catálogo
  trocarFila(null);
  esconderCarrossel();
  mostrarFiltro(false);
  atualizarBotaoMais({ visivel: false, carregando: false });

  // Marcações de versões antigas não têm título e pôster: busca na TMDB.
  const faltando = assistidos.semDados();
  if (faltando.length > 0) {
    mostrarCarregando();
    const detalhes = await Promise.allSettled(faltando.map((id) => buscarDetalhesFilme(id)));
    for (const resultado of detalhes) {
      if (resultado.status === "fulfilled") assistidos.guardarDados(resultado.value);
    }
    if (minhaBusca !== ultimaBusca) return; // trocou de aba enquanto isso
  }

  const filmes = assistidos.daLista(tipo);
  if (filmes.length === 0) {
    mostrarVazio(LISTA_VAZIA[tipo]);
    return;
  }
  renderizarFilmes(filmes, { acrescentar: false, comOndeAssistir: true });
  for (const filme of filmes) {
    consultarOndeAssistir(filme.id).then((lista) => preencherOndeAssistir(filme.id, lista));
  }
}

// Troca de aba. A busca é limpa (ela pertence ao catálogo).
function aoTrocarAba(aba) {
  if (aba === estado.aba && aba === "catalogo" && estado.termo === "") return;
  estado.aba = aba;
  marcarAba(aba);
  clearTimeout(temporizador);
  estado.termo = "";
  definirTextoBusca("");

  if (aba === "catalogo") {
    mostrarFiltro(true);
    definirFiltroAtivo(true);
    aplicarFiltro();
  } else {
    abrirLista(aba);
  }
}

// Logo: volta para a tela principal (aba Catálogo, sem busca, no topo).
// Os streamings marcados no filtro continuam marcados.
function irParaInicio() {
  aoTrocarAba("catalogo");
  const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: suave ? "smooth" : "auto" });
}

// Chamado a cada letra digitada; só busca depois da pausa.
let temporizador;
function aoDigitar(texto) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    const termo = texto.trim();
    const novoTermo = termo.length >= MIN_LETRAS ? termo : "";
    if (novoTermo === estado.termo) return; // nada mudou

    // Buscar numa aba de lista leva de volta ao catálogo.
    if (novoTermo && estado.aba !== "catalogo") {
      estado.aba = "catalogo";
      marcarAba("catalogo");
      mostrarFiltro(true);
    }
    estado.termo = novoTermo;
    if (novoTermo) {
      // Entrando (ou continuando) na busca: some o destaque, apaga o filtro.
      esconderCarrossel();
      definirFiltroAtivo(false);
      carregarFilmes({ acrescentar: false });
    } else {
      // Saindo da busca: volta o catálogo com os logos que estavam marcados.
      definirFiltroAtivo(true);
      aplicarFiltro();
    }
  }, ESPERA_DIGITACAO);
}

// ---------------------------------------------------------------
// Página do filme (endereço #/filme/ID)
// ---------------------------------------------------------------

let ultimoDetalhe = 0;
// true quando a página do filme foi aberta por um clique aqui dentro
// (aí "Voltar" é só voltar no histórico do navegador).
let navegouDentro = false;

async function abrirDetalhe(idFilme) {
  const meuDetalhe = ++ultimoDetalhe;
  mostrarDetalheCarregando(fecharPaginaFilme);
  try {
    const filme = await buscarDetalheCompleto(idFilme);
    if (meuDetalhe !== ultimoDetalhe) return; // abriu outro filme enquanto isso
    renderizarDetalhe(filme, fecharPaginaFilme);
  } catch (erro) {
    if (meuDetalhe !== ultimoDetalhe) return;
    mostrarErroDetalhe(erro, fecharPaginaFilme, () => abrirDetalhe(idFilme));
  }
}

function fecharPaginaFilme() {
  if (navegouDentro) {
    history.back(); // o "hashchange" fecha a página
  } else {
    // Chegou direto pelo link do filme: limpa o endereço sem recarregar.
    history.replaceState(null, "", location.pathname + location.search);
    seguirRota();
  }
}

// Abre ou fecha a página do filme conforme o endereço.
function seguirRota() {
  const rota = lerRota(location.hash);
  if (rota) {
    abrirDetalhe(rota.filme);
  } else {
    ultimoDetalhe++;
    fecharDetalhe();
  }
}

// Lê o token do js/config.js. Se o arquivo não existir (quem acabou de
// clonar o projeto), devolve "" em vez de quebrar a página inteira.
async function lerToken() {
  try {
    const config = await import("./config.js");
    return config.TMDB_TOKEN ?? "";
  } catch {
    return "";
  }
}

async function iniciar() {
  const TMDB_TOKEN = await lerToken();
  // Sem token configurado, nem tenta chamar a TMDB.
  if (!TMDB_TOKEN || TMDB_TOKEN.trim() === TOKEN_MODELO) {
    mostrarErro({ tipo: "auth" });
    return;
  }
  definirToken(TMDB_TOKEN);
  document.querySelector("#carregar-mais").onclick = aoCarregarMais;
  configurarAvaliacoes({
    avaliacaoDe: (id) => assistidos.avaliacao(id),
    statusDe: (id) => assistidos.status(id),
    aoAvaliar,
    aoMarcarStatus,
    estadoDe: (id) => assistidos.estado(id),
    restaurar: aoRestaurar,
    // Marcados saem da grade só no Catálogo (não na busca nem nas listas).
    saiDaGrade: noCatalogo,
    aoSairDaGrade,
  });
  atualizarContadores(assistidos.contagem());

  try {
    mostrarCarregando();
    estado.provedores = await buscarProvedores();
    ligarBusca(aoDigitar);
    ligarAbas(aoTrocarAba);
    ligarMarca(irParaInicio);
    aplicarFiltro();
    window.addEventListener("hashchange", () => {
      navegouDentro = true;
      seguirRota();
    });
    seguirRota(); // quem abriu o site já num link de filme
  } catch (erro) {
    mostrarErro(erro, iniciar);
  }
}

iniciar();
