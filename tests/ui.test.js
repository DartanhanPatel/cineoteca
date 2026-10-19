import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarAno, formatarNota, formatarDuracao, lerRota, escolherCarrossel, resumirLogos } from "../js/ui.js";

test("formatarAno", () => {
  assert.equal(formatarAno("2024-05-01"), "2024");
  assert.equal(formatarAno(""), "—");
  assert.equal(formatarAno(undefined), "—");
});

test("formatarNota", () => {
  assert.equal(formatarNota(7.834), "7,8");
  assert.equal(formatarNota(8), "8,0");
  assert.equal(formatarNota(0), "—");
  assert.equal(formatarNota(undefined), "—");
});

test("escolherCarrossel pega até 4 com nota acima de 7,5, imagem e não assistidos", () => {
  const filmes = [
    { id: 1, vote_average: 8.1, backdrop_path: "/a.jpg" },
    { id: 2, vote_average: 7.5, backdrop_path: "/b.jpg" }, // 7,5 não é "acima"
    { id: 3, vote_average: 8.0, backdrop_path: null }, // sem imagem
    { id: 4, vote_average: 9.0, backdrop_path: "/d.jpg" }, // já assistido
    { id: 5, vote_average: 7.6, backdrop_path: "/e.jpg" },
    { id: 6, vote_average: 7.9, backdrop_path: "/f.jpg" },
    { id: 7, vote_average: 8.4, backdrop_path: "/g.jpg" },
    { id: 8, vote_average: 8.8, backdrop_path: "/h.jpg" }, // 5º válido: fica de fora
  ];
  const assistido = (id) => id === 4;
  assert.deepEqual(escolherCarrossel(filmes, assistido).map((f) => f.id), [1, 5, 6, 7]);
  assert.deepEqual(escolherCarrossel([], assistido), []);
});

test("resumirLogos mostra até 4 e conta o resto", () => {
  const lista = [1, 2, 3, 4, 5, 6].map((id) => ({ provider_id: id }));
  const { visiveis, extras } = resumirLogos(lista);
  assert.deepEqual(visiveis.map((p) => p.provider_id), [1, 2, 3, 4]);
  assert.equal(extras, 2);
  assert.deepEqual(resumirLogos(lista.slice(0, 2)).extras, 0);
});

test("formatarDuracao", () => {
  assert.equal(formatarDuracao(136), "2h 16min");
  assert.equal(formatarDuracao(120), "2h");
  assert.equal(formatarDuracao(45), "45min");
  assert.equal(formatarDuracao(0), "");
  assert.equal(formatarDuracao(undefined), "");
});

test("lerRota reconhece #/filme/ID", () => {
  assert.deepEqual(lerRota("#/filme/603"), { filme: 603 });
  assert.equal(lerRota(""), null);
  assert.equal(lerRota("#/filme/abc"), null);
  assert.equal(lerRota("#/outra"), null);
});
