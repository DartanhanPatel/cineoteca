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

// Critérios do carrossel de recomendados: nota acima de 7,5 e votos
// suficientes para a nota valer (evita filme com 10 dado por 3 pessoas).
const NOTA_MINIMA = 7.5;
const VOTOS_MINIMOS = 200;

// Endereço dos recomendados: filmes bem avaliados nos streamings indicados.
// Com gêneros, eles são unidos com "|" ("OU"); sem gêneros, vale qualquer um.
export function montarUrlRecomendados(idsProvedores, generos) {
  const url = new URL(`${BASE_URL}/discover/movie`);
  url.searchParams.set("watch_region", REGIAO);
  url.searchParams.set("with_watch_providers", idsProvedores.join("|"));
  if (generos.length > 0) url.searchParams.set("with_genres", generos.join("|"));
  url.searchParams.set("vote_average.gte", String(NOTA_MINIMA));
  url.searchParams.set("vote_count.gte", String(VOTOS_MINIMOS));
  url.searchParams.set("language", IDIOMA);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("page", "1");
  return url.toString();
}

// Endereço da busca por título. Esta rota da TMDB não filtra por streaming:
// por isso, depois, perguntamos filme a filme onde ele está.
export function montarUrlBusca(texto, pagina) {
  const url = new URL(`${BASE_URL}/search/movie`);
  url.searchParams.set("query", texto);
  url.searchParams.set("language", IDIOMA);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("page", String(pagina));
  return url.toString();
}

// Endereço de "onde assistir" de um filme (vem com todos os países).
export function montarUrlOndeAssistir(idFilme) {
  return `${BASE_URL}/movie/${idFilme}/watch/providers`;
}

// Da resposta de "onde assistir", pega só o Brasil e junta assinatura,
// grátis, com anúncios, aluguel e compra numa lista só, sem repetir
// streaming, do mais popular para o menos popular.
export function extrairProvedoresBR(json) {
  return juntarTipos(json.results?.[REGIAO] ?? {}, ["flatrate", "free", "ads", "rent", "buy"]);
}

// Junta as listas de alguns tipos (assinatura, aluguel...) numa só,
// sem repetir streaming, do mais popular para o menos popular.
function juntarTipos(brasil, tipos) {
  const porId = new Map();
  for (const tipo of tipos) {
    for (const provedor of brasil[tipo] ?? []) {
      if (!porId.has(provedor.provider_id)) porId.set(provedor.provider_id, provedor);
    }
  }
  return [...porId.values()].sort((a, b) => (a.display_priority ?? Infinity) - (b.display_priority ?? Infinity));
}

// ---------------------------------------------------------------
// Página de detalhes do filme
// ---------------------------------------------------------------

// Quantas pessoas do elenco aparecem na página do filme.
const MAX_ELENCO = 12;

// Um só pedido traz tudo: dados, vídeos, elenco, onde assistir e a
// classificação indicativa. Vídeos em português, inglês ou sem idioma.
export function montarUrlDetalhe(idFilme) {
  const url = new URL(`${BASE_URL}/movie/${idFilme}`);
  url.searchParams.set("language", IDIOMA);
  url.searchParams.set("append_to_response", "videos,credits,watch/providers,release_dates");
  url.searchParams.set("include_video_language", "pt,en,null");
  return url.toString();
}

// Escolhe o melhor vídeo para o topo da página: só YouTube; trailer
// vale mais que teaser; depois português e, por último, o oficial.
// Devolve a chave do vídeo no YouTube ou null.
export function escolherTrailer(videos) {
  const pontos = (v) =>
    (v.type === "Trailer" ? 100 : 0) + (v.iso_639_1 === "pt" ? 10 : 0) + (v.official ? 1 : 0);
  const candidatos = (videos ?? []).filter(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );
  candidatos.sort((a, b) => pontos(b) - pontos(a));
  return candidatos[0]?.key ?? null;
}

// Transforma a resposta da TMDB no formato que a página usa.
export function normalizarDetalhe(json) {
  const brasil = json["watch/providers"]?.results?.[REGIAO] ?? {};
  const datasBR = json.release_dates?.results?.find((r) => r.iso_3166_1 === REGIAO);
  return {
    id: json.id,
    title: json.title,
    tagline: json.tagline || "",
    overview: json.overview || "",
    release_date: json.release_date,
    duracao: json.runtime ?? 0,
    generos: (json.genres ?? []).map((g) => g.name),
    genre_ids: (json.genres ?? []).map((g) => g.id),
    vote_average: json.vote_average,
    poster_path: json.poster_path,
    backdrop_path: json.backdrop_path,
    trailer: escolherTrailer(json.videos?.results),
    classificacao: datasBR?.release_dates?.map((d) => d.certification).find(Boolean) ?? null,
    elenco: (json.credits?.cast ?? []).slice(0, MAX_ELENCO).map((pessoa) => ({
      nome: pessoa.name,
      personagem: pessoa.character,
      foto: pessoa.profile_path,
    })),
    direcao: (json.credits?.crew ?? []).filter((p) => p.job === "Director").map((p) => p.name),
    ondeAssistir: {
      link: brasil.link ?? null,
      assinatura: juntarTipos(brasil, ["flatrate", "free", "ads"]),
      aluguel: juntarTipos(brasil, ["rent"]),
      compra: juntarTipos(brasil, ["buy"]),
    },
  };
}

// Tudo sobre um filme, já no formato da página de detalhes.
export async function buscarDetalheCompleto(idFilme) {
  return normalizarDetalhe(await requisitar(montarUrlDetalhe(idFilme)));
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

// Deixa as listas de filmes da TMDB sempre no mesmo formato.
function normalizarPagina(json) {
  return {
    filmes: json.results ?? [],
    pagina: json.page,
    totalPaginas: Math.min(json.total_pages ?? 0, LIMITE_PAGINAS),
  };
}

// Uma página de filmes dos streamings indicados.
export async function buscarFilmes(idsProvedores, pagina) {
  return normalizarPagina(await requisitar(montarUrlFilmes(idsProvedores, pagina)));
}

// Uma página de filmes cujo título combina com o texto digitado.
export async function buscarPorTitulo(texto, pagina) {
  return normalizarPagina(await requisitar(montarUrlBusca(texto, pagina)));
}

// Em quais streamings do Brasil o filme está ([] se em nenhum).
export async function buscarOndeAssistir(idFilme) {
  return extrairProvedoresBR(await requisitar(montarUrlOndeAssistir(idFilme)));
}

// Filmes bem avaliados dos gêneros indicados (para o carrossel).
export async function buscarRecomendados(idsProvedores, generos) {
  const json = await requisitar(montarUrlRecomendados(idsProvedores, generos));
  return json.results ?? [];
}

// Dados de um filme pelo ID (para completar listas guardadas sem pôster).
export async function buscarDetalhesFilme(idFilme) {
  const url = new URL(`${BASE_URL}/movie/${idFilme}`);
  url.searchParams.set("language", IDIOMA);
  return requisitar(url.toString());
}
