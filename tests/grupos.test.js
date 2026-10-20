import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarWhatsapp,
  formatarWhatsapp,
  lerConvite,
  enderecoSemConvite,
  linkDeConvite,
  mensagemDeConvite,
  linkDoWhatsapp,
  conferirNomeDoGrupo,
} from "../js/grupos.js";

test("normalizarWhatsapp aceita os jeitos comuns de escrever um celular", () => {
  assert.equal(normalizarWhatsapp("(11) 98765-4321"), "+5511987654321");
  assert.equal(normalizarWhatsapp("11987654321"), "+5511987654321");
  assert.equal(normalizarWhatsapp("+55 11 98765-4321"), "+5511987654321");
  assert.equal(normalizarWhatsapp("55 (21) 3456-7890"), "+552134567890"); // fixo com DDD
});

test("normalizarWhatsapp recusa números incompletos ou sem DDD", () => {
  assert.equal(normalizarWhatsapp("98765-4321"), null);
  assert.equal(normalizarWhatsapp("123"), null);
  assert.equal(normalizarWhatsapp(""), null);
  assert.equal(normalizarWhatsapp("abc"), null);
});

test("formatarWhatsapp mostra o número do jeito brasileiro", () => {
  assert.equal(formatarWhatsapp("+5511987654321"), "(11) 98765-4321");
  assert.equal(formatarWhatsapp("+552134567890"), "(21) 3456-7890");
});

test("lerConvite pega o código do endereço (?convite=...)", () => {
  assert.equal(lerConvite("?convite=ab12cd34"), "AB12CD34");
  assert.equal(lerConvite("?aba=quero&convite=AB12CD34"), "AB12CD34");
  assert.equal(lerConvite("?convite=<script>"), null);
  assert.equal(lerConvite(""), null);
});

test("enderecoSemConvite tira só o convite do endereço", () => {
  const endereco = { pathname: "/", search: "?convite=AB12CD34&aba=quero", hash: "#/filme/1" };
  assert.equal(enderecoSemConvite(endereco), "/?aba=quero#/filme/1");
  assert.equal(enderecoSemConvite({ pathname: "/", search: "?convite=X1Y2", hash: "" }), "/");
});

test("linkDeConvite aponta para o site com o código", () => {
  const local = { origin: "http://localhost:3000", pathname: "/" };
  assert.equal(linkDeConvite(local, "AB12CD34"), "http://localhost:3000/?convite=AB12CD34");
  const pasta = { origin: "https://site.com", pathname: "/cine/index.html" };
  assert.equal(linkDeConvite(pasta, "AB12CD34"), "https://site.com/cine/index.html?convite=AB12CD34");
});

test("mensagem e link do WhatsApp levam o nome do grupo e o link", () => {
  const texto = mensagemDeConvite("Família", "http://x/?convite=A1B2");
  assert.match(texto, /Família/);
  assert.match(texto, /http:\/\/x\/\?convite=A1B2/);
  assert.equal(linkDoWhatsapp("oi & tchau"), "https://wa.me/?text=oi%20%26%20tchau");
});

test("conferirNomeDoGrupo diz o que está errado (ou '' se está certo)", () => {
  assert.equal(conferirNomeDoGrupo("Família"), "");
  assert.notEqual(conferirNomeDoGrupo("   "), "");
  assert.notEqual(conferirNomeDoGrupo("x".repeat(41)), "");
});
