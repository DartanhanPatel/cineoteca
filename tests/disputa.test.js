import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sortearFilmes,
  nomeDoMes,
  textoDaSemana,
  situacaoDoDesafio,
  textoDosPontos,
  medalha,
} from "../js/disputa.js";

const filme = (id) => ({ id, title: `F${id}`, poster_path: `/${id}.jpg` });

test("sortearFilmes escolhe 3 filmes diferentes que ninguém viu", () => {
  const candidatos = [1, 2, 3, 4, 5, 6].map(filme);
  let i = 0;
  const sorteio = sortearFilmes(candidatos, new Set([2, 4]), () => [0.9, 0.1, 0.5, 0.3][i++ % 4]);
  assert.equal(sorteio.length, 3);
  assert.equal(new Set(sorteio.map((f) => f.id)).size, 3);
  assert.ok(sorteio.every((f) => ![2, 4].includes(f.id)));
});

test("sortearFilmes ignora filmes sem pôster e repetidos", () => {
  const candidatos = [filme(1), { id: 2, title: "Sem pôster" }, filme(1), filme(3), filme(4)];
  const sorteio = sortearFilmes(candidatos, new Set(), Math.random);
  assert.deepEqual(sorteio.map((f) => f.id).sort(), [1, 3, 4]);
});

test("sortearFilmes devolve menos de 3 se não houver filmes suficientes", () => {
  assert.equal(sortearFilmes([filme(1), filme(2)], new Set(), Math.random).length, 2);
});

test("nomeDoMes e textoDaSemana", () => {
  assert.equal(nomeDoMes("2026-10-01"), "outubro");
  assert.equal(nomeDoMes("2026-01-01"), "janeiro");
  assert.equal(textoDaSemana("2026-10-12"), "12 a 18 de out.");
  assert.equal(textoDaSemana("2026-09-28"), "28 de set. a 4 de out.");
});

const base = { eu: "a", hoje: "2026-10-05", semana: "2026-10-05", escolhe: null, prazo_campeao: null, desafio: null };

test("situacaoDoDesafio", () => {
  assert.equal(situacaoDoDesafio({ ...base, desafio: { filmes: [] } }), "pronto");
  assert.equal(situacaoDoDesafio(base), "sortear");
  const comCampeao = { ...base, escolhe: "b", prazo_campeao: "2026-10-06" };
  assert.equal(situacaoDoDesafio(comCampeao), "aguardando");
  assert.equal(situacaoDoDesafio({ ...comCampeao, eu: "b" }), "escolher");
  // passou da terça: sorteia
  assert.equal(situacaoDoDesafio({ ...comCampeao, hoje: "2026-10-07" }), "sortear");
});

test("textoDosPontos resume de onde vieram os pontos", () => {
  assert.equal(textoDosPontos({ assistidos: 1, desafios: 0, faltas: 0, bonus_campeao: 0 }), "1 filme");
  assert.equal(
    textoDosPontos({ assistidos: 5, desafios: 2, faltas: 1, bonus_campeao: 2 }),
    "5 filmes · 2 do desafio · 1 falta · 2 bônus de campeão"
  );
  assert.equal(textoDosPontos({ assistidos: 0, desafios: 0, faltas: 0, bonus_campeao: 0 }), "nenhum filme ainda");
});

test("medalha dos 3 primeiros (só para quem tem pontos)", () => {
  assert.equal(medalha(0, 5), "🥇");
  assert.equal(medalha(2, 1), "🥉");
  assert.equal(medalha(3, 9), "4º");
  assert.equal(medalha(0, 0), "1º");
});
