import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarUrlProvedores,
  montarUrlFilmes,
  ordenarProvedores,
  idsParaBusca,
} from "../js/api.js";

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
