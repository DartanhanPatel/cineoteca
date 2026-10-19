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

// O Catálogo mostra primeiro os filmes de nota mais alta: todos os acima
// de 7,5; só quando eles acabam, os de 7,0 a 7,5; e assim por diante.
// Dentro de cada faixa, os mais populares primeiro. Só entra numa faixa
// quem tem votos suficientes para a nota valer; os filmes com poucos
// votos (lançamentos recentes, por exemplo) ficam para o fim.
const VOTOS_CATALOGO = 100;
export const FAIXAS_CATALOGO = [
  { min: 7.5 },
  { min: 7.0, max: 7.5 },
  { min: 6.5, max: 7.0 },
  { min: 6.0, max: 6.5 },
  { min: 5.0, max: 6.0 },
  { max: 5.0 },
  { poucosVotos: true },
];
// Onde o Catálogo começa: primeira faixa, primeira página.
export const INICIO_CATALOGO = { faixa: 0, pagina: 1 };

// Endereço da busca de filmes. Os IDs são unidos com "|", que na TMDB
// significa "OU": filmes que estão em qualquer um desses streamings.
// Com `faixa`, só vêm os filmes daquela faixa de nota.
export function montarUrlFilmes(idsProvedores, pagina, faixa = null) {
  const url = new URL(`${BASE_URL}/discover/movie`);
  url.searchParams.set("watch_region", REGIAO);
  url.searchParams.set("with_watch_providers", idsProvedores.join("|"));
  url.searchParams.set("language", IDIOMA);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("page", String(pagina));
  if (faixa?.poucosVotos) {
    url.searchParams.set("vote_count.lte", String(VOTOS_CATALOGO - 1));
  } else if (faixa) {
    url.searchParams.set("vote_count.gte", String(VOTOS_CATALOGO));
    // As faixas seguem a nota como ela aparece na tela, com 1 casa decimal:
    // 7,46 aparece como "7,5", então conta como 7,5. O limite de cima não
    // entra na faixa (o que aparece como 7,5 é da faixa "acima de 7,5").
    if (faixa.min != null) url.searchParams.set("vote_average.gte", (faixa.min - 0.05).toFixed(2));
    if (faixa.max != null) url.searchParams.set("vote_average.lte", (faixa.max - 0.051).toFixed(3));
  }
  return url.toString();
}

// Carrossel de recomendados: começa com filmes acima de 7,5. Quando eles
// acabam (a pessoa já marcou todos), desce a nota aos poucos até 5,0.
// Os votos mínimos evitam filme com nota 10 dada por 3 pessoas.
const NOTAS_CARROSSEL = [7.5, 7.0, 6.5, 6.0, 5.5, 5.0];
const VOTOS_MINIMOS = 200;
const MAX_CARROSSEL = 4;
// Quantas páginas olhar em cada nota antes de descer para a próxima.
const PAGINAS_POR_NOTA = 3;

// Endereço dos recomendados: filmes bem avaliados nos streamings indicados.
// Com gêneros, eles são unidos com "|" ("OU"); sem gêneros, vale qualquer um.
export function montarUrlRecomendados(idsProvedores, generos, notaMinima, pagina) {
  const url = new URL(`${BASE_URL}/discover/movie`);
  url.searchParams.set("watch_region", REGIAO);
  url.searchParams.set("with_watch_providers", idsProvedores.join("|"));
  if (generos.length > 0) url.searchParams.set("with_genres", generos.join("|"));
  url.searchParams.set("vote_average.gte", String(notaMinima));
  url.searchParams.set("vote_count.gte", String(VOTOS_MINIMOS));
  url.searchParams.set("language", IDIOMA);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("page", String(pagina));
  return url.toString();
}

// Escolhe filmes para o carrossel: acima da nota, com imagem de fundo e
// que a pessoa ainda não marcou. Mantém a ordem (os mais populares).
export function escolherCarrossel(filmes, estaMarcado, notaMinima, max = MAX_CARROSSEL) {
  return filmes
    .filter((f) => f.vote_average > notaMinima && f.backdrop_path && !estaMarcado(f.id))
    .slice(0, max);
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

// Uma página de filmes dos streamings indicados (de uma faixa de nota).
export async function buscarFilmes(idsProvedores, pagina, faixa = null) {
  return normalizarPagina(await requisitar(montarUrlFilmes(idsProvedores, pagina, faixa)));
}

// Para a grade, cada carga diz onde a próxima continua (o "cursor"), ou
// null quando não há mais filmes.

// Catálogo: o cursor é { faixa, pagina }. Termina as páginas de uma faixa
// de nota antes de passar para a faixa de baixo.
export function paginaDoCatalogo(idsProvedores) {
  return async ({ faixa, pagina }) => {
    const resposta = await buscarFilmes(idsProvedores, pagina, FAIXAS_CATALOGO[faixa]);
    let proximo = null;
    if (resposta.pagina < resposta.totalPaginas) proximo = { faixa, pagina: resposta.pagina + 1 };
    else if (faixa + 1 < FAIXAS_CATALOGO.length) proximo = { faixa: faixa + 1, pagina: 1 };
    return { filmes: resposta.filmes, proximo };
  };
}

// Busca por título: o cursor é só o número da página.
export function paginaDaBusca(texto) {
  return async (pagina) => {
    const resposta = await buscarPorTitulo(texto, pagina);
    return {
      filmes: resposta.filmes,
      proximo: resposta.pagina < resposta.totalPaginas ? resposta.pagina + 1 : null,
    };
  };
}

// Uma página de filmes cujo título combina com o texto digitado.
export async function buscarPorTitulo(texto, pagina) {
  return normalizarPagina(await requisitar(montarUrlBusca(texto, pagina)));
}

// Em quais streamings do Brasil o filme está ([] se em nenhum).
export async function buscarOndeAssistir(idFilme) {
  return extrairProvedoresBR(await requisitar(montarUrlOndeAssistir(idFilme)));
}

// Os 4 filmes do carrossel. Tenta primeiro acima de 7,5; se não completar
// 4 (porque a pessoa já marcou os outros), desce a nota: 7,0, 6,5... até
// 5,0. Os de nota mais alta ficam primeiro. Pode devolver menos de 4.
export async function buscarParaCarrossel(idsProvedores, generos, estaMarcado) {
  const escolhidos = [];
  const jaEscolhido = (id) => estaMarcado(id) || escolhidos.some((f) => f.id === id);

  for (const nota of NOTAS_CARROSSEL) {
    for (let pagina = 1; pagina <= PAGINAS_POR_NOTA; pagina++) {
      const resposta = normalizarPagina(
        await requisitar(montarUrlRecomendados(idsProvedores, generos, nota, pagina))
      );
      escolhidos.push(
        ...escolherCarrossel(resposta.filmes, jaEscolhido, nota, MAX_CARROSSEL - escolhidos.length)
      );
      if (escolhidos.length >= MAX_CARROSSEL) return escolhidos;
      if (pagina >= resposta.totalPaginas) break; // acabaram as páginas desta nota
    }
  }
  return escolhidos;
}

// ---------------------------------------------------------------
// Grade que nunca fica vazia
// ---------------------------------------------------------------

// Quantos filmes novos cada carga da grade tenta juntar, e o máximo de
// páginas da TMDB que ela pode pedir de uma vez para isso.
const MINIMO_POR_CARGA = 20;
const MAX_PAGINAS_POR_CARGA = 10;

// Pede páginas seguidas até juntar `minimo` filmes que passem no `filtrar`
// (por exemplo, "ainda não marcado"). Assim, uma página só de filmes já
// marcados é pulada em vez de deixar a tela vazia.
// `buscarPagina(cursor)` devolve { filmes, proximo } (veja acima).
// Devolve os filmes juntados e onde a próxima carga continua (ou null).
export async function buscarAteEncher(
  buscarPagina,
  filtrar,
  { inicio, minimo = MINIMO_POR_CARGA, maxPaginas = MAX_PAGINAS_POR_CARGA }
) {
  const filmes = [];
  let cursor = inicio;
  for (let pedidas = 0; pedidas < maxPaginas && cursor !== null; pedidas++) {
    const resposta = await buscarPagina(cursor);
    filmes.push(...resposta.filmes.filter(filtrar));
    cursor = resposta.proximo;
    if (filmes.length >= minimo) break;
  }
  return { filmes, proximo: cursor };
}

// Dados de um filme pelo ID (para completar listas guardadas sem pôster).
export async function buscarDetalhesFilme(idFilme) {
  const url = new URL(`${BASE_URL}/movie/${idFilme}`);
  url.searchParams.set("language", IDIOMA);
  return requisitar(url.toString());
}
