import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarAno, formatarNota, formatarDuracao, lerRota, lerAba, enderecoComAba, resumirLogos } from "../js/ui.js";

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

test("lerAba lê a aba do endereço (?aba=...)", () => {
  assert.equal(lerAba("?aba=quero"), "quero");
  assert.equal(lerAba("?aba=assisti"), "assisti");
  assert.equal(lerAba("?aba=ocultos"), "ocultos");
  assert.equal(lerAba("?aba=grupos"), "grupos");
  assert.equal(lerAba("?aba=qualquer"), "catalogo");
  assert.equal(lerAba(""), "catalogo");
});

test("enderecoComAba guarda a aba sem mexer no resto do endereço", () => {
  const endereco = { pathname: "/", search: "", hash: "" };
  assert.equal(enderecoComAba(endereco, "quero"), "/?aba=quero");
  assert.equal(enderecoComAba(endereco, "catalogo"), "/");
  const comFilme = { pathname: "/index.html", search: "?aba=quero", hash: "#/filme/603" };
  assert.equal(enderecoComAba(comFilme, "assisti"), "/index.html?aba=assisti#/filme/603");
  assert.equal(enderecoComAba(comFilme, "catalogo"), "/index.html#/filme/603");
});
