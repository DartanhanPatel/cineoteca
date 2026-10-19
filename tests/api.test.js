import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  montarUrlProvedores,
  montarUrlFilmes,
  ordenarProvedores,
  idsParaBusca,
  definirToken,
  buscarProvedores,
  buscarFilmes,
  ErroApi,
  montarUrlBusca,
  montarUrlOndeAssistir,
  extrairProvedoresBR,
  buscarPorTitulo,
  buscarOndeAssistir,
  montarUrlRecomendados,
  escolherCarrossel,
  buscarParaCarrossel,
  buscarAteEncher,
  FAIXAS_CATALOGO,
  INICIO_CATALOGO,
  paginaDoCatalogo,
  paginaDaBusca,
  buscarDetalhesFilme,
  montarUrlDetalhe,
  escolherTrailer,
  normalizarDetalhe,
} from "../js/api.js";

// Nos testes, trocamos o fetch de verdade por um falso, para não usar a internet.
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function respostaFalsa(status, corpo) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
}

test("montarUrlProvedores usa região BR e pt-BR", () => {
  const url = new URL(montarUrlProvedores());
  assert.equal(url.origin + url.pathname, "https://api.themoviedb.org/3/watch/providers/movie");
  assert.equal(url.searchParams.get("watch_region"), "BR");
  assert.equal(url.searchParams.get("language"), "pt-BR");
});

test("montarUrlFilmes com um provedor", () => {
  const url = new URL(montarUrlFilmes([8], 1));
  assert.equal(url.pathname, "/3/discover/movie");
  assert.equal(url.searchParams.get("with_watch_providers"), "8");
  assert.equal(url.searchParams.get("watch_region"), "BR");
  assert.equal(url.searchParams.get("language"), "pt-BR");
  assert.equal(url.searchParams.get("sort_by"), "popularity.desc");
  assert.equal(url.searchParams.get("page"), "1");
});

test("montarUrlFilmes une vários provedores com |", () => {
  const url = new URL(montarUrlFilmes([8, 119, 337], 3));
  assert.equal(url.searchParams.get("with_watch_providers"), "8|119|337");
  assert.equal(url.searchParams.get("page"), "3");
});

test("montarUrlFilmes sem faixa não filtra por nota", () => {
  const url = new URL(montarUrlFilmes([8], 1));
  assert.equal(url.searchParams.has("vote_average.gte"), false);
  assert.equal(url.searchParams.has("vote_count.gte"), false);
});

test("montarUrlFilmes com faixa de nota", () => {
  // As faixas seguem a nota que aparece na tela (com 1 casa decimal):
  // 7,46 aparece como "7,5", então entra na faixa "acima de 7,5".
  const acima = new URL(montarUrlFilmes([8], 1, { min: 7.5 }));
  assert.equal(acima.searchParams.get("vote_average.gte"), "7.45");
  assert.equal(acima.searchParams.has("vote_average.lte"), false);
  assert.equal(acima.searchParams.get("vote_count.gte"), "100");

  const meio = new URL(montarUrlFilmes([8], 1, { min: 7, max: 7.5 }));
  assert.equal(meio.searchParams.get("vote_average.gte"), "6.95");
  assert.equal(meio.searchParams.get("vote_average.lte"), "7.449"); // o que aparece como 7,5 fica na faixa de cima

  const abaixo = new URL(montarUrlFilmes([8], 1, { max: 5 }));
  assert.equal(abaixo.searchParams.has("vote_average.gte"), false);
  assert.equal(abaixo.searchParams.get("vote_average.lte"), "4.949");

  const poucos = new URL(montarUrlFilmes([8], 1, { poucosVotos: true }));
  assert.equal(poucos.searchParams.get("vote_count.lte"), "99");
  assert.equal(poucos.searchParams.has("vote_count.gte"), false);
  assert.equal(poucos.searchParams.has("vote_average.gte"), false);
});

test("as faixas do catálogo começam acima de 7,5 e terminam nos filmes com poucos votos", () => {
  assert.deepEqual(FAIXAS_CATALOGO[0], { min: 7.5 });
  assert.deepEqual(FAIXAS_CATALOGO.at(-1), { poucosVotos: true });
});

test("paginaDoCatalogo: termina as páginas de uma faixa antes de descer a nota", async () => {
  // faixa 0 (≥7,5) tem 2 páginas; faixa 1 (7,0–7,5) está vazia; faixa 2 tem 1 página
  const paginasPorFaixa = { "7.45": 2, "6.95": 0, "6.45": 1 };
  globalThis.fetch = async (endereco) => {
    const url = new URL(endereco);
    const total = paginasPorFaixa[url.searchParams.get("vote_average.gte")] ?? 0;
    const pagina = Number(url.searchParams.get("page"));
    return { ok: true, status: 200, json: async () => ({ page: pagina, total_pages: total, results: [{ id: pagina }] }) };
  };
  const proxima = paginaDoCatalogo([8]);
  let cursor = INICIO_CATALOGO;
  const caminho = [];
  while (cursor && caminho.length < 20) {
    caminho.push(`${cursor.faixa}/${cursor.pagina}`);
    cursor = (await proxima(cursor)).proximo;
  }
  assert.deepEqual(caminho.slice(0, 4), ["0/1", "0/2", "1/1", "2/1"]);
  assert.equal(caminho.at(-1), `${FAIXAS_CATALOGO.length - 1}/1`); // última faixa; depois, fim
});

test("paginaDaBusca avança até a última página e então para", async () => {
  globalThis.fetch = async (endereco) => {
    const pagina = Number(new URL(endereco).searchParams.get("page"));
    return { ok: true, status: 200, json: async () => ({ page: pagina, total_pages: 2, results: [] }) };
  };
  const proxima = paginaDaBusca("matrix");
  assert.equal((await proxima(1)).proximo, 2);
  assert.equal((await proxima(2)).proximo, null);
});

test("ordenarProvedores ordena por display_priorities.BR e manda os sem prioridade para o fim", () => {
  const lista = [
    { provider_id: 1, display_priorities: { BR: 5 } },
    { provider_id: 2, display_priorities: {} },
    { provider_id: 3, display_priorities: { BR: 1 } },
  ];
  assert.deepEqual(ordenarProvedores(lista).map((p) => p.provider_id), [3, 1, 2]);
  assert.deepEqual(lista.map((p) => p.provider_id), [1, 2, 3]); // original intacta
});

test("idsParaBusca devolve os selecionados ou, sem seleção, todos", () => {
  const provedores = [{ provider_id: 8 }, { provider_id: 119 }];
  assert.deepEqual(idsParaBusca(new Set([119]), provedores), [119]);
  assert.deepEqual(idsParaBusca(new Set(), provedores), [8, 119]);
});

test("definirToken limpa espaços e o prefixo Bearer", async () => {
  let cabecalho;
  globalThis.fetch = async (_url, opts) => {
    cabecalho = opts.headers.Authorization;
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  };
  definirToken("  Bearer abc123\n");
  await buscarProvedores();
  assert.equal(cabecalho, "Bearer abc123");
});

test("buscarProvedores devolve a lista já ordenada", async () => {
  globalThis.fetch = respostaFalsa(200, {
    results: [
      { provider_id: 1, display_priorities: { BR: 9 } },
      { provider_id: 2, display_priorities: { BR: 1 } },
    ],
  });
  assert.deepEqual((await buscarProvedores()).map((p) => p.provider_id), [2, 1]);
});

test("buscarFilmes normaliza a resposta e limita a 500 páginas", async () => {
  globalThis.fetch = respostaFalsa(200, { page: 2, total_pages: 900, results: [{ id: 1 }] });
  assert.deepEqual(await buscarFilmes([8], 2), { filmes: [{ id: 1 }], pagina: 2, totalPaginas: 500 });
});

test("buscarFilmes com total_pages 0 devolve totalPaginas 0", async () => {
  globalThis.fetch = respostaFalsa(200, { page: 1, total_pages: 0, results: [] });
  assert.equal((await buscarFilmes([8], 1)).totalPaginas, 0);
});

test("HTTP 401 vira ErroApi tipo auth", async () => {
  globalThis.fetch = respostaFalsa(401, {});
  await assert.rejects(buscarProvedores(), (e) => e instanceof ErroApi && e.tipo === "auth");
});

test("HTTP 500 vira ErroApi tipo api", async () => {
  globalThis.fetch = respostaFalsa(500, {});
  await assert.rejects(buscarFilmes([8], 1), (e) => e instanceof ErroApi && e.tipo === "api");
});

test("falha de rede vira ErroApi tipo rede", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(buscarFilmes([8], 1), (e) => e instanceof ErroApi && e.tipo === "rede");
});

// ---------------------------------------------------------------
// Busca por título e "onde assistir"
// ---------------------------------------------------------------

test("montarUrlBusca usa /search/movie com o texto, pt-BR e sem filmes adultos", () => {
  const url = new URL(montarUrlBusca("Tom & Jerry", 2));
  assert.equal(url.pathname, "/3/search/movie");
  assert.equal(url.searchParams.get("query"), "Tom & Jerry");
  assert.equal(url.searchParams.get("language"), "pt-BR");
  assert.equal(url.searchParams.get("include_adult"), "false");
  assert.equal(url.searchParams.get("page"), "2");
});

test("montarUrlOndeAssistir usa /movie/{id}/watch/providers", () => {
  const url = new URL(montarUrlOndeAssistir(550));
  assert.equal(url.pathname, "/3/movie/550/watch/providers");
});

test("extrairProvedoresBR junta todos os tipos, sem repetir, por prioridade", () => {
  const json = {
    results: {
      US: { flatrate: [{ provider_id: 99, display_priority: 0 }] },
      BR: {
        flatrate: [{ provider_id: 8, display_priority: 3 }],
        rent: [
          { provider_id: 2, display_priority: 1 },
          { provider_id: 8, display_priority: 3 },
        ],
        buy: [{ provider_id: 2, display_priority: 1 }],
        ads: [{ provider_id: 50, display_priority: 9 }],
      },
    },
  };
  assert.deepEqual(extrairProvedoresBR(json).map((p) => p.provider_id), [2, 8, 50]);
});

test("extrairProvedoresBR sem dados do Brasil devolve lista vazia", () => {
  assert.deepEqual(extrairProvedoresBR({ results: { US: {} } }), []);
  assert.deepEqual(extrairProvedoresBR({}), []);
});

test("buscarPorTitulo normaliza a resposta como buscarFilmes", async () => {
  globalThis.fetch = respostaFalsa(200, { page: 1, total_pages: 3, results: [{ id: 7 }] });
  assert.deepEqual(await buscarPorTitulo("matrix", 1), { filmes: [{ id: 7 }], pagina: 1, totalPaginas: 3 });
});

test("buscarOndeAssistir devolve os streamings do Brasil", async () => {
  globalThis.fetch = respostaFalsa(200, { results: { BR: { flatrate: [{ provider_id: 8 }] } } });
  assert.deepEqual((await buscarOndeAssistir(550)).map((p) => p.provider_id), [8]);
});

// ---------------------------------------------------------------
// Recomendados do carrossel
// ---------------------------------------------------------------

test("montarUrlRecomendados filtra por streaming, gênero, nota, votos e página", () => {
  const url = new URL(montarUrlRecomendados([8, 337], [28, 878], 6.5, 2));
  assert.equal(url.pathname, "/3/discover/movie");
  assert.equal(url.searchParams.get("with_watch_providers"), "8|337");
  assert.equal(url.searchParams.get("watch_region"), "BR");
  assert.equal(url.searchParams.get("with_genres"), "28|878");
  assert.equal(url.searchParams.get("vote_average.gte"), "6.5");
  assert.equal(url.searchParams.get("vote_count.gte"), "200");
  assert.equal(url.searchParams.get("sort_by"), "popularity.desc");
  assert.equal(url.searchParams.get("page"), "2");
});

test("montarUrlRecomendados sem gêneros não filtra por gênero", () => {
  const url = new URL(montarUrlRecomendados([8], [], 7.5, 1));
  assert.equal(url.searchParams.has("with_genres"), false);
});

test("escolherCarrossel pega até 4 acima da nota, com imagem e não marcados", () => {
  const filmes = [
    { id: 1, vote_average: 8.1, backdrop_path: "/a.jpg" },
    { id: 2, vote_average: 7.5, backdrop_path: "/b.jpg" }, // 7,5 não é "acima"
    { id: 3, vote_average: 8.0, backdrop_path: null }, // sem imagem
    { id: 4, vote_average: 9.0, backdrop_path: "/d.jpg" }, // já marcado
    { id: 5, vote_average: 7.6, backdrop_path: "/e.jpg" },
    { id: 6, vote_average: 7.9, backdrop_path: "/f.jpg" },
    { id: 7, vote_average: 8.4, backdrop_path: "/g.jpg" },
    { id: 8, vote_average: 8.8, backdrop_path: "/h.jpg" }, // 5º válido: fica de fora
  ];
  const marcado = (id) => id === 4;
  assert.deepEqual(escolherCarrossel(filmes, marcado, 7.5).map((f) => f.id), [1, 5, 6, 7]);
  assert.deepEqual(escolherCarrossel(filmes, marcado, 7.0).map((f) => f.id), [1, 2, 5, 6]);
  assert.deepEqual(escolherCarrossel([], marcado, 7.5), []);
});

// Responde como a TMDB "descobrir", filtrando a lista falsa pela nota e página pedidas.
function tmdbFalsa(todos, porPagina = 2) {
  const pedidos = [];
  globalThis.fetch = async (endereco) => {
    const url = new URL(endereco);
    const nota = Number(url.searchParams.get("vote_average.gte"));
    const pagina = Number(url.searchParams.get("page"));
    pedidos.push(`${nota}/${pagina}`);
    const validos = todos.filter((f) => f.vote_average >= nota);
    const results = validos.slice((pagina - 1) * porPagina, pagina * porPagina);
    return {
      ok: true,
      status: 200,
      json: async () => ({ page: pagina, total_pages: Math.ceil(validos.length / porPagina), results }),
    };
  };
  return pedidos;
}

test("buscarParaCarrossel: com filmes bons suficientes, fica na nota 7,5", async () => {
  const todos = [8.5, 8.4, 8.3, 8.2, 8.1].map((nota, i) => ({ id: i + 1, vote_average: nota, backdrop_path: "/x.jpg" }));
  const pedidos = tmdbFalsa(todos);
  const filmes = await buscarParaCarrossel([8], [], () => false);
  assert.deepEqual(filmes.map((f) => f.id), [1, 2, 3, 4]);
  assert.deepEqual(pedidos, ["7.5/1", "7.5/2"]);
});

test("buscarParaCarrossel: esgotados os acima de 7,5, completa com notas menores", async () => {
  const todos = [
    { id: 1, vote_average: 8.0, backdrop_path: "/x.jpg" },
    { id: 2, vote_average: 7.8, backdrop_path: "/x.jpg" }, // já marcado
    { id: 3, vote_average: 7.2, backdrop_path: "/x.jpg" },
    { id: 4, vote_average: 6.0, backdrop_path: "/x.jpg" },
    { id: 5, vote_average: 5.6, backdrop_path: "/x.jpg" },
  ];
  tmdbFalsa(todos);
  const filmes = await buscarParaCarrossel([8], [], (id) => id === 2);
  // primeiro os de nota mais alta, depois os que entraram com notas menores
  assert.deepEqual(filmes.map((f) => f.id), [1, 3, 4, 5]);
});

test("buscarParaCarrossel: se não houver nada nem com 5,0, devolve o que achou", async () => {
  tmdbFalsa([{ id: 1, vote_average: 9.0, backdrop_path: "/x.jpg" }]);
  assert.deepEqual((await buscarParaCarrossel([8], [], () => false)).map((f) => f.id), [1]);
});

// ---------------------------------------------------------------
// Grade que nunca fica vazia
// ---------------------------------------------------------------

test("buscarAteEncher pula páginas só de filmes já marcados", async () => {
  const paginas = {
    1: [{ id: 1 }, { id: 2 }], // tudo marcado
    2: [{ id: 3 }, { id: 4 }], // tudo marcado
    3: [{ id: 5 }, { id: 6 }],
    4: [{ id: 7 }, { id: 8 }],
  };
  const pedidas = [];
  const buscarPagina = async (n) => {
    pedidas.push(n);
    return { filmes: paginas[n], proximo: n < 4 ? n + 1 : null };
  };
  const marcados = new Set([1, 2, 3, 4]);
  const r = await buscarAteEncher(buscarPagina, (f) => !marcados.has(f.id), { inicio: 1, minimo: 3 });
  assert.deepEqual(r.filmes.map((f) => f.id), [5, 6, 7, 8]);
  assert.equal(r.proximo, null); // acabou
  assert.deepEqual(pedidas, [1, 2, 3, 4]);
});

test("buscarAteEncher para no limite de páginas e devolve onde continuar", async () => {
  const buscarPagina = async (n) => ({ filmes: [{ id: n }], proximo: n + 1 });
  const r = await buscarAteEncher(buscarPagina, () => false, { inicio: 1, minimo: 20, maxPaginas: 3 });
  assert.deepEqual(r, { filmes: [], proximo: 4 });

  const r2 = await buscarAteEncher(buscarPagina, () => true, { inicio: 7, minimo: 2 });
  assert.deepEqual(r2, { filmes: [{ id: 7 }, { id: 8 }], proximo: 9 });
});

test("buscarAteEncher com resposta vazia (sem resultados) não fica em loop", async () => {
  const vazia = async () => ({ filmes: [], proximo: null });
  assert.deepEqual(await buscarAteEncher(vazia, () => true, { inicio: 1 }), { filmes: [], proximo: null });
});

// ---------------------------------------------------------------
// Página de detalhes do filme
// ---------------------------------------------------------------

test("montarUrlDetalhe pede vídeos, elenco, onde assistir e classificação de uma vez", () => {
  const url = new URL(montarUrlDetalhe(603));
  assert.equal(url.pathname, "/3/movie/603");
  assert.equal(url.searchParams.get("language"), "pt-BR");
  assert.equal(url.searchParams.get("append_to_response"), "videos,credits,watch/providers,release_dates");
  assert.equal(url.searchParams.get("include_video_language"), "pt,en,null");
});

test("escolherTrailer prefere trailer do YouTube em português e oficial", () => {
  const videos = [
    { site: "YouTube", type: "Featurette", iso_639_1: "pt", official: true, key: "bastidores" },
    { site: "Vimeo", type: "Trailer", iso_639_1: "pt", official: true, key: "vimeo" },
    { site: "YouTube", type: "Teaser", iso_639_1: "pt", official: true, key: "teaser-pt" },
    { site: "YouTube", type: "Trailer", iso_639_1: "en", official: true, key: "trailer-en" },
    { site: "YouTube", type: "Trailer", iso_639_1: "pt", official: false, key: "trailer-pt-fa" },
    { site: "YouTube", type: "Trailer", iso_639_1: "pt", official: true, key: "trailer-pt" },
  ];
  assert.equal(escolherTrailer(videos), "trailer-pt");
  assert.equal(escolherTrailer(videos.slice(0, 4)), "trailer-en"); // trailer em inglês vence teaser em pt
  assert.equal(escolherTrailer(videos.slice(0, 3)), "teaser-pt");
  assert.equal(escolherTrailer(videos.slice(0, 2)), null); // bastidores e Vimeo não servem
  assert.equal(escolherTrailer(undefined), null);
});

test("normalizarDetalhe junta o que a página precisa", () => {
  const json = {
    id: 603,
    title: "Matrix",
    tagline: "Bem-vindo ao mundo real.",
    overview: "Neo descobre...",
    release_date: "1999-03-30",
    runtime: 136,
    genres: [{ id: 28, name: "Ação" }, { id: 878, name: "Ficção científica" }],
    vote_average: 8.2,
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    videos: { results: [{ site: "YouTube", type: "Trailer", iso_639_1: "en", official: true, key: "abc" }] },
    credits: {
      cast: Array.from({ length: 15 }, (_, i) => ({ name: `Ator ${i}`, character: `Papel ${i}`, profile_path: i ? `/${i}.jpg` : null })),
      crew: [{ job: "Director", name: "Lana" }, { job: "Writer", name: "X" }, { job: "Director", name: "Lilly" }],
    },
    "watch/providers": {
      results: {
        BR: {
          link: "https://tmdb/watch",
          flatrate: [{ provider_id: 8, display_priority: 2 }],
          ads: [{ provider_id: 50, display_priority: 5 }],
          rent: [{ provider_id: 2, display_priority: 1 }],
          buy: [{ provider_id: 2, display_priority: 1 }, { provider_id: 10, display_priority: 3 }],
        },
      },
    },
    release_dates: { results: [{ iso_3166_1: "BR", release_dates: [{ certification: "" }, { certification: "12" }] }] },
  };
  const d = normalizarDetalhe(json);
  assert.equal(d.title, "Matrix");
  assert.equal(d.duracao, 136);
  assert.deepEqual(d.generos, ["Ação", "Ficção científica"]);
  assert.deepEqual(d.genre_ids, [28, 878]);
  assert.equal(d.trailer, "abc");
  assert.equal(d.classificacao, "12");
  assert.equal(d.elenco.length, 12);
  assert.deepEqual(d.elenco[1], { nome: "Ator 1", personagem: "Papel 1", foto: "/1.jpg" });
  assert.deepEqual(d.direcao, ["Lana", "Lilly"]);
  assert.equal(d.ondeAssistir.link, "https://tmdb/watch");
  assert.deepEqual(d.ondeAssistir.assinatura.map((p) => p.provider_id), [8, 50]);
  assert.deepEqual(d.ondeAssistir.aluguel.map((p) => p.provider_id), [2]);
  assert.deepEqual(d.ondeAssistir.compra.map((p) => p.provider_id), [2, 10]);
});

test("normalizarDetalhe aguenta filme sem vídeos, elenco ou dados do Brasil", () => {
  const d = normalizarDetalhe({ id: 1, title: "X" });
  assert.equal(d.trailer, null);
  assert.deepEqual(d.elenco, []);
  assert.deepEqual(d.direcao, []);
  assert.equal(d.classificacao, null);
  assert.deepEqual(d.ondeAssistir, { link: null, assinatura: [], aluguel: [], compra: [] });
});
