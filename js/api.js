// api.js — tudo que conversa com a TMDB.
// Regra deste arquivo: nunca mexe na tela (nada de `document` aqui).

export const BASE_URL = "https://api.themoviedb.org/3";

// Configurações fixas do catálogo (veja a spec, seção 2).
const REGIAO = "BR";
const IDIOMA = "pt-BR";

// Endereço da lista de streamings disponíveis no Brasil.
export function montarUrlProvedores() {
  const url = new URL(`${BASE_URL}/watch/providers/movie`);
  url.searchParams.set("watch_region", REGIAO);
  url.searchParams.set("language", IDIOMA);
  return url.toString();
}

// Endereço da busca de filmes. Os IDs são unidos com "|", que na TMDB
// significa "OU": filmes que estão em qualquer um desses streamings.
export function montarUrlFilmes(idsProvedores, pagina) {
  const url = new URL(`${BASE_URL}/discover/movie`);
  url.searchParams.set("watch_region", REGIAO);
  url.searchParams.set("with_watch_providers", idsProvedores.join("|"));
  url.searchParams.set("language", IDIOMA);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("page", String(pagina));
  return url.toString();
}

// Ordena os streamings pela prioridade de exibição no Brasil
// (os mais populares primeiro). Quem não tem prioridade vai para o fim.
// Copiamos a lista com [...lista] para não alterar a original.
export function ordenarProvedores(lista) {
  const prioridade = (p) => p.display_priorities?.[REGIAO] ?? Infinity;
  return [...lista].sort((a, b) => prioridade(a) - prioridade(b));
}

// Quais IDs mandar na busca: os marcados pelo usuário ou,
// se nenhum estiver marcado, todos os streamings.
export function idsParaBusca(selecionados, provedores) {
  if (selecionados.size > 0) return [...selecionados];
  return provedores.map((p) => p.provider_id);
}

// ---------------------------------------------------------------
// Chamadas de verdade à TMDB
// ---------------------------------------------------------------

// A TMDB não deixa navegar além da página 500.
const LIMITE_PAGINAS = 500;

// O token é entregue pelo app.js (este arquivo não lê o config.js,
// assim os testes rodam sem precisar de token).
let token = "";

// Aceita o token mesmo se ele vier com espaços ou já com "Bearer " na frente.
export function definirToken(novoToken) {
  token = String(novoToken ?? "").trim().replace(/^Bearer\s+/i, "");
}

// Erro com um "tipo", para a tela saber qual mensagem mostrar:
// "auth" = token inválido, "rede" = sem internet, "api" = outro problema na TMDB.
export class ErroApi extends Error {
  constructor(tipo, mensagem) {
    super(mensagem);
    this.name = "ErroApi";
    this.tipo = tipo;
  }
}

// Faz a requisição e transforma qualquer falha em um ErroApi.
async function requisitar(url) {
  let resposta;
  try {
    resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    });
  } catch {
    throw new ErroApi("rede", "Falha de conexão com a TMDB.");
  }
  if (resposta.status === 401) throw new ErroApi("auth", "Token inválido ou ausente.");
  if (!resposta.ok) throw new ErroApi("api", `A TMDB respondeu com status ${resposta.status}.`);
  return resposta.json();
}

// Lista de streamings do Brasil, já na ordem de exibição.
export async function buscarProvedores() {
  const json = await requisitar(montarUrlProvedores());
  return ordenarProvedores(json.results ?? []);
}

// Uma página de filmes dos streamings indicados.
export async function buscarFilmes(idsProvedores, pagina) {
  const json = await requisitar(montarUrlFilmes(idsProvedores, pagina));
  return {
    filmes: json.results ?? [],
    pagina: json.page,
    totalPaginas: Math.min(json.total_pages ?? 0, LIMITE_PAGINAS),
  };
}
