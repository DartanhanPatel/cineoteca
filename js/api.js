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
