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
  buscarRecomendados,
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

test("montarUrlRecomendados filtra por streaming, gênero, nota e votos", () => {
  const url = new URL(montarUrlRecomendados([8, 337], [28, 878]));
  assert.equal(url.pathname, "/3/discover/movie");
  assert.equal(url.searchParams.get("with_watch_providers"), "8|337");
  assert.equal(url.searchParams.get("watch_region"), "BR");
  assert.equal(url.searchParams.get("with_genres"), "28|878");
  assert.equal(url.searchParams.get("vote_average.gte"), "7.5");
  assert.equal(url.searchParams.get("vote_count.gte"), "200");
  assert.equal(url.searchParams.get("sort_by"), "popularity.desc");
});

test("montarUrlRecomendados sem gêneros não filtra por gênero", () => {
  const url = new URL(montarUrlRecomendados([8], []));
  assert.equal(url.searchParams.has("with_genres"), false);
});

test("buscarRecomendados devolve a lista de filmes", async () => {
  globalThis.fetch = respostaFalsa(200, { page: 1, total_pages: 1, results: [{ id: 3 }] });
  assert.deepEqual(await buscarRecomendados([8], [28]), [{ id: 3 }]);
});

test("buscarDetalhesFilme usa /movie/{id} em pt-BR", async () => {
  let urlPedida;
  globalThis.fetch = async (url) => {
    urlPedida = new URL(url);
    return { ok: true, status: 200, json: async () => ({ id: 7, title: "Sete" }) };
  };
  assert.deepEqual(await buscarDetalhesFilme(7), { id: 7, title: "Sete" });
  assert.equal(urlPedida.pathname, "/3/movie/7");
  assert.equal(urlPedida.searchParams.get("language"), "pt-BR");
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
