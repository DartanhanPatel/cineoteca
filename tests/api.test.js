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
