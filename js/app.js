// app.js — o "maestro": guarda o estado e liga cliques → api → ui.
import { TMDB_TOKEN } from "./config.js";
import { definirToken, buscarProvedores, buscarFilmes, idsParaBusca } from "./api.js";
import {
  renderizarProvedores,
  renderizarFilmes,
  atualizarBotaoMais,
  mostrarCarregando,
  mostrarVazio,
  mostrarErro,
} from "./ui.js";

// Valor que vem no config.example.js: significa "token ainda não configurado".
const TOKEN_MODELO = "cole-seu-token-aqui";

// Tudo que o app precisa lembrar fica aqui.
const estado = {
  provedores: [], // lista de streamings vinda da TMDB
  selecionados: new Set(), // IDs dos streamings marcados
  pagina: 1,
  totalPaginas: 1,
  carregando: false, // evita cliques duplos no "Carregar mais"
};

// Cada busca ganha um número. Se o usuário clicar em outro filtro antes
// da resposta chegar, a resposta antiga é ignorada (só vale a última).
let ultimaBusca = 0;

async function carregarFilmes({ acrescentar }) {
  const minhaBusca = ++ultimaBusca;
  estado.carregando = true;
  if (acrescentar) atualizarBotaoMais({ visivel: true, carregando: true });
  else mostrarCarregando();

  try {
    const ids = idsParaBusca(estado.selecionados, estado.provedores);
    const resposta = await buscarFilmes(ids, estado.pagina);
    if (minhaBusca !== ultimaBusca) return; // chegou atrasada: descarta

    estado.pagina = resposta.pagina;
    estado.totalPaginas = resposta.totalPaginas;
    if (resposta.filmes.length === 0 && !acrescentar) mostrarVazio();
    else renderizarFilmes(resposta.filmes, { acrescentar });
    atualizarBotaoMais({ visivel: estado.pagina < estado.totalPaginas, carregando: false });
  } catch (erro) {
    if (minhaBusca !== ultimaBusca) return;
    if (acrescentar) {
      // Falhou o "Carregar mais": mantém a grade, volta a página
      // e o botão vira "Tentar de novo" (clicar nele repete a mesma página).
      estado.pagina -= 1;
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
  estado.pagina = 1;
  renderizarProvedores(estado.provedores, estado.selecionados, aoClicarProvedor, aoLimpar);
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
  estado.pagina += 1;
  carregarFilmes({ acrescentar: true });
}

async function iniciar() {
  // Sem token configurado, nem tenta chamar a TMDB.
  if (!TMDB_TOKEN || TMDB_TOKEN.trim() === TOKEN_MODELO) {
    mostrarErro({ tipo: "auth" });
    return;
  }
  definirToken(TMDB_TOKEN);
  document.querySelector("#carregar-mais").onclick = aoCarregarMais;

  try {
    mostrarCarregando();
    estado.provedores = await buscarProvedores();
    aplicarFiltro();
  } catch (erro) {
    mostrarErro(erro, iniciar);
  }
}

iniciar();
