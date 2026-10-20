// app.js — o "maestro": guarda o estado e liga cliques → api → ui.
import {
  definirToken,
  buscarProvedores,
  paginaDoCatalogo,
  paginaDaBusca,
  buscarAteEncher,
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
import { criarSincronia } from "./nuvem.js";
import { lerConvite, enderecoSemConvite } from "./grupos.js";
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
  lerAba,
  enderecoComAba,
  definirFiltroAtivo,
  mostrarFiltro,
  atualizarBotaoMais,
  mostrarCarregando,
  mostrarVazio,
  mostrarErro,
  mostrarDicaDoCelular,
  mostrarMensagemRapida,
  mostrarAbaGrupos,
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

// Marcações de cada filme: ✓/✗ e Quero assistir/Já assisti (no navegador
// e, com a conta aberta, também no Supabase).
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

// Depois de marcado ou desmarcado, o filme ainda pertence à grade atual?
// - Catálogo: só filmes sem nenhuma marcação.
// - Busca: todos, menos os com ✗.
// - Abas: só os filmes daquela aba (desmarcou, sai da lista na hora).
function continuaNaGrade(idFilme) {
  if (estado.aba !== "catalogo") return assistidos.estaNaAba(idFilme, estado.aba);
  if (estado.termo) return assistidos.avaliacao(idFilme) !== "nao";
  return !assistidos.marcado(idFilme);
}

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
  aoVoltarAGrade(filme);
}

// O filme voltou para a grade (pelo "Desfazer" ou desmarcado na página do
// filme): o substituto dele devolve a vaga.
function aoVoltarAGrade(filme) {
  // Numa aba que tinha ficado vazia (a mensagem apagou os cards), desenha
  // a lista de novo, já com o filme de volta.
  if (estado.aba !== "catalogo" && listaFicouVazia) {
    listaFicouVazia = false;
    abrirLista(estado.aba);
    return;
  }
  const substituto = substitutos.get(filme.id);
  if (substituto && fila) {
    substitutos.delete(filme.id);
    removerCard(substituto.id);
    fila.devolver(substituto);
  }
}

// Um filme saiu do Catálogo (foi marcado): entra o próximo da fila no
// fim da grade, para a quantidade de filmes na tela não diminuir.
// true quando o último filme de uma aba saiu e a mensagem de vazia apareceu.
let listaFicouVazia = false;

async function aoSairDaGrade(filme) {
  // Numa aba, se saiu o último filme, mostra a mensagem de lista vazia
  // (depois da animação de saída do card).
  if (estado.aba !== "catalogo" && assistidos.daLista(estado.aba).length === 0) {
    const aba = estado.aba;
    setTimeout(() => {
      if (estado.aba !== aba || assistidos.daLista(aba).length > 0) return;
      listaFicouVazia = true;
      mostrarVazio(LISTA_VAZIA[aba]);
    }, 300);
    return;
  }
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
  ocultos: "Nenhum filme oculto. Os filmes que você marca com ✗ ficam aqui; clique no ✗ de novo para trazer um de volta.",
};

// Mostra a aba "Quero assistir", "Já assisti" ou "Ocultos": os filmes
// guardados no navegador, com os logos de onde assistir.
async function abrirLista(tipo) {
  const minhaBusca = ++ultimaBusca; // descarta respostas pendentes do catálogo
  listaFicouVazia = false;
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

// Guarda a aba no endereço sem recarregar a página (o F5 reabre nela).
function lembrarAba(aba) {
  history.replaceState(history.state, "", enderecoComAba(location, aba));
}

// Troca de aba. A busca é limpa (ela pertence ao catálogo).
function aoTrocarAba(aba) {
  if (aba === estado.aba && aba === "catalogo" && estado.termo === "") return;
  if (aba !== "grupos") telaGrupos?.fechar();
  estado.aba = aba;
  marcarAba(aba);
  lembrarAba(aba);
  atualizarContadores(assistidos.contagem()); // "Ocultos" só aparece enquanto está aberta
  clearTimeout(temporizador);
  estado.termo = "";
  definirTextoBusca("");

  if (aba === "catalogo") {
    mostrarFiltro(true);
    definirFiltroAtivo(true);
    aplicarFiltro();
  } else if (aba === "grupos") {
    abrirGrupos();
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
      telaGrupos?.fechar();
      estado.aba = "catalogo";
      marcarAba("catalogo");
      lembrarAba("catalogo");
      atualizarContadores(assistidos.contagem());
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
let detalheAberto = false;
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
    if (detalheAberto && estado.aba === "grupos") atualizarGrupos();
  }
  detalheAberto = Boolean(rota);
}

// Lê o js/config.js. Se o arquivo não existir (quem acabou de clonar o
// projeto), devolve {} em vez de quebrar a página inteira.
async function lerConfig() {
  try {
    return await import("./config.js");
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------
// Conta (Supabase)
// ---------------------------------------------------------------

// A aba "Grupos" (criada quando a conta liga; null sem Supabase).
let telaGrupos = null;
// Espera as marcações terminarem de subir para a conta.
let esperarNuvem = () => Promise.resolve();

// Filmes bem avaliados dos streamings que ninguém do grupo viu (sorteio).
const CANDIDATOS_DO_SORTEIO = 40;
async function buscarCandidatosDoSorteio(vistos) {
  const ids = idsParaBusca(new Set(), estado.provedores);
  const { filmes } = await buscarAteEncher(paginaDoCatalogo(ids), (f) => !vistos.has(f.id), {
    inicio: INICIO_CATALOGO,
    minimo: CANDIDATOS_DO_SORTEIO,
  });
  return filmes;
}

// Voltou da página de um filme para os grupos: o filme pode ter sido
// marcado, então os pontos são recarregados (depois de a marcação subir).
async function atualizarGrupos() {
  await esperarNuvem();
  if (estado.aba === "grupos") telaGrupos?.abrir();
}

// Mostra a aba "Grupos" no lugar da grade de filmes.
function abrirGrupos() {
  ++ultimaBusca; // descarta respostas pendentes do catálogo
  trocarFila(null);
  esconderCarrossel();
  mostrarFiltro(false);
  atualizarBotaoMais({ visivel: false, carregando: false });
  if (telaGrupos) telaGrupos.abrir();
  else mostrarVazio("Carregando seus grupos…"); // a conta ainda está ligando
}

// Convite (?convite=CÓDIGO): sai do endereço e fica guardado até a pessoa
// entrar na conta (também se ela recarregar a página antes).
const CHAVE_CONVITE = "catalogo-filmes:convite";
let convitePendente = null;

function lerConvitePendente() {
  const codigo = lerConvite(location.search);
  if (codigo) {
    history.replaceState(history.state, "", enderecoSemConvite(location));
    try {
      sessionStorage.setItem(CHAVE_CONVITE, codigo);
    } catch {
      // Sem onde guardar: vale só até fechar a página.
    }
    return codigo;
  }
  try {
    return sessionStorage.getItem(CHAVE_CONVITE);
  } catch {
    return null;
  }
}

function esquecerConvite() {
  convitePendente = null;
  try {
    sessionStorage.removeItem(CHAVE_CONVITE);
  } catch {
    // nada guardado
  }
}

// Redesenha o que depende das marcações (elas mudaram ao entrar ou sair).
function redesenharMarcacoes() {
  atualizarContadores(assistidos.contagem());
  if (estado.aba === "grupos") return; // os grupos não mostram filmes
  if (estado.aba !== "catalogo") abrirLista(estado.aba);
  else if (estado.termo) carregarFilmes({ acrescentar: false });
  else aplicarFiltro();
}

// A conta não respondeu: as marcações seguem só neste navegador.
function avisarSemConta() {
  mostrarMensagemRapida("Não deu para salvar na sua conta agora. Suas marcações seguem guardadas neste navegador.");
}

// Liga o botão "Entrar" e a sincronização das marcações. Sem o Supabase
// configurado (ou fora do ar), o site segue só com o navegador.
async function ligarConta({ SUPABASE_URL, SUPABASE_KEY }) {
  // Sem conta, a aba "Grupos" (aberta por um F5) não tem o que mostrar.
  const semConta = () => {
    if (estado.aba === "grupos") aoTrocarAba("catalogo");
  };
  if (!SUPABASE_URL || !SUPABASE_KEY) return semConta();
  let conta, tela, traduzirErro;
  try {
    const [modConta, { configurarTelaConta }, { criarTelaGrupos }, { criarDisputa }] = await Promise.all([
      import("./conta.js"),
      import("./conta-tela.js"),
      import("./grupos-tela.js"),
      import("./disputa-tela.js"),
    ]);
    traduzirErro = modConta.traduzirErro;
    conta = modConta.criarConta({ url: SUPABASE_URL, chave: SUPABASE_KEY });
    tela = configurarTelaConta(conta);
    const disputa = criarDisputa({
      conta,
      buscarCandidatos: buscarCandidatosDoSorteio,
      buscarPorTitulo: async (texto) => (await paginaDaBusca(texto)(1)).filmes,
    });
    telaGrupos = criarTelaGrupos(conta, { abrirConta: () => tela.abrir(), disputa });
  } catch {
    return semConta(); // a biblioteca do Supabase não carregou
  }

  // Com a conta aberta: entra no grupo do convite e mostra os grupos.
  async function aceitarConvite(codigo) {
    esquecerConvite();
    try {
      const grupo = await conta.entrarNoGrupo(codigo);
      mostrarMensagemRapida(`Você entrou no grupo "${grupo.nome}"! 🎉`);
      aoTrocarAba("grupos");
      telaGrupos.perguntarWhatsapp();
    } catch (e) {
      mostrarMensagemRapida(traduzirErro(e));
    }
  }

  // Sem conta: abre "Criar conta" contando de que grupo é o convite.
  async function mostrarConvite(codigo) {
    let grupo;
    try {
      grupo = await conta.verConvite(codigo);
    } catch {
      grupo = undefined; // sem internet: convida sem dizer o nome
    }
    if (grupo === null) {
      esquecerConvite();
      mostrarMensagemRapida("Esse convite não vale mais. Peça um link novo a quem convidou.");
      return;
    }
    const pessoas = grupo?.membros === 1 ? "1 participante" : `${grupo?.membros} participantes`;
    const sobre = grupo ? `para o grupo "${grupo.nome}" (${pessoas})` : "para um grupo";
    tela.abrir({ convite: `🎬 Você foi convidado ${sobre}. Crie sua conta ou entre para participar da disputa.` });
  }
  const sincronia = criarSincronia({ conta, assistidos, aoFalhar: () => avisarSemConta() });
  esperarNuvem = sincronia.pronto;
  window.addEventListener("online", () => sincronia.tentarDeNovo());

  let dentro = false;
  conta.aoMudarSessao(async (usuario) => {
    tela.atualizar(usuario);
    mostrarAbaGrupos(Boolean(usuario));
    const antes = JSON.stringify(assistidos.lista());
    if (usuario) {
      dentro = true;
      try {
        await sincronia.aoEntrar();
      } catch {
        // As marcações do navegador continuam valendo (e não se perdem ao sair).
        avisarSemConta();
      }
    } else if (dentro) {
      // Só ao sair de verdade (quem nunca entrou guarda as do navegador).
      dentro = false;
      sincronia.aoSair();
    }
    if (JSON.stringify(assistidos.lista()) !== antes) redesenharMarcacoes();
    if (estado.aba === "grupos") abrirGrupos(); // os grupos (ou o "Entre na sua conta")

    if (convitePendente) {
      if (usuario) await aceitarConvite(convitePendente);
      else mostrarConvite(convitePendente);
    }
  });
}

async function iniciar() {
  convitePendente = lerConvitePendente();
  const config = await lerConfig();
  const TMDB_TOKEN = config.TMDB_TOKEN ?? "";
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
    continuaNaGrade,
    abaAtual: () => (estado.termo ? "busca" : estado.aba),
    aoSairDaGrade,
    aoVoltarAGrade,
  });
  atualizarContadores(assistidos.contagem());

  try {
    mostrarCarregando();
    estado.provedores = await buscarProvedores();
    ligarBusca(aoDigitar);
    ligarAbas(aoTrocarAba);
    ligarMarca(irParaInicio);
    // Abre na aba que estava no endereço (depois de um F5, por exemplo).
    const abaSalva = lerAba(location.search);
    if (abaSalva === "catalogo") aplicarFiltro();
    else aoTrocarAba(abaSalva);
    window.addEventListener("hashchange", () => {
      navegouDentro = true;
      seguirRota();
    });
    seguirRota(); // quem abriu o site já num link de filme
    mostrarDicaDoCelular();
    ligarConta(config);
  } catch (erro) {
    mostrarErro(erro, iniciar);
  }
}

iniciar();
