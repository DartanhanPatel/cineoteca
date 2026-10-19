import { test } from "node:test";
import assert from "node:assert/strict";
import { criarAssistidos, generosFavoritos } from "../js/assistidos.js";

// Imita o localStorage do navegador.
function armazenamentoFalso(inicial) {
  const dados = new Map(inicial ? [["catalogo-filmes:assistidos", inicial]] : []);
  return {
    getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => dados.set(chave, String(valor)),
  };
}

const filme = (id, genre_ids = [28]) => ({ id, title: `Filme ${id}`, poster_path: `/${id}.jpg`, genre_ids });

test("avaliar marca gostei e, clicando de novo, desmarca", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assert.equal(assistidos.avaliacao(10), null);
  assert.equal(assistidos.avaliar(filme(10), "gostei"), "gostei");
  assert.equal(assistidos.avaliacao(10), "gostei");
  assert.equal(assistidos.avaliar(filme(10), "gostei"), null);
  assert.equal(assistidos.avaliacao(10), null);
});

test("gostei e não gostei se excluem", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assistidos.avaliar(filme(10), "gostei");
  assert.equal(assistidos.avaliar(filme(10), "nao"), "nao");
  assert.equal(assistidos.avaliacao(10), "nao");
  assert.equal(assistidos.lista().length, 1);
});

test("dar ✓ ou ✗ marca 'Já assisti' automaticamente", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assistidos.marcarStatus(filme(1), "quero");
  assistidos.avaliar(filme(1), "gostei");
  assert.equal(assistidos.status(1), "assisti");
  // tirar o ✓ não "desassiste" o filme
  assistidos.avaliar(filme(1), "gostei");
  assert.equal(assistidos.status(1), "assisti");
});

test("'Quero assistir' e 'Já assisti' se excluem e desmarcam clicando de novo", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assert.equal(assistidos.marcarStatus(filme(1), "quero"), "quero");
  assert.equal(assistidos.marcarStatus(filme(1), "assisti"), "assisti");
  assert.equal(assistidos.marcarStatus(filme(1), "assisti"), null);
  assert.equal(assistidos.lista().length, 0); // nada marcado: sai da lista
});

test("daLista devolve os filmes do status, mais recentes primeiro, sem os com ✗", () => {
  let agora = 0;
  const assistidos = criarAssistidos(armazenamentoFalso(), () => ++agora);
  assistidos.marcarStatus(filme(1), "quero");
  assistidos.marcarStatus(filme(2), "quero");
  assistidos.marcarStatus(filme(3), "assisti");
  assistidos.avaliar(filme(4), "nao"); // já assisti, mas com ✗: oculto
  assert.deepEqual(assistidos.daLista("quero").map((f) => f.id), [2, 1]);
  assert.deepEqual(assistidos.daLista("assisti").map((f) => f.id), [3]);
  assert.equal(assistidos.daLista("quero")[0].title, "Filme 2"); // guarda os dados do filme
  assert.deepEqual(assistidos.contagem(), { quero: 2, assisti: 1 });
});

test("daLista: marcados no mesmo instante, o último vem primeiro", () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 5);
  assistidos.marcarStatus(filme(1), "quero");
  assistidos.marcarStatus(filme(2), "quero");
  assert.deepEqual(assistidos.daLista("quero").map((f) => f.id), [2, 1]);
});

test("foraDoCarrossel: filmes avaliados, já assistidos ou na lista", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assistidos.marcarStatus(filme(1), "quero");
  assistidos.marcarStatus(filme(2), "assisti");
  assistidos.avaliar(filme(3), "gostei");
  assert.equal(assistidos.foraDoCarrossel(1), true);
  assert.equal(assistidos.foraDoCarrossel(2), true);
  assert.equal(assistidos.foraDoCarrossel(3), true);
  assert.equal(assistidos.foraDoCarrossel(4), false);
});

test("a lista sobrevive a recarregar a página", () => {
  const armazenamento = armazenamentoFalso();
  criarAssistidos(armazenamento).avaliar(filme(10, [28, 12]), "nao");
  const depois = criarAssistidos(armazenamento);
  assert.equal(depois.avaliacao(10), "nao");
  assert.equal(depois.status(10), "assisti");
  assert.deepEqual(depois.lista()[0].generos, [28, 12]);
});

test("marcações antigas (só ✓) contam como gostei e já assisti", () => {
  const antigo = JSON.stringify([{ id: 7, generos: [18] }, { id: 8, generos: [], avaliacao: "nao" }]);
  const assistidos = criarAssistidos(armazenamentoFalso(antigo));
  assert.equal(assistidos.avaliacao(7), "gostei");
  assert.equal(assistidos.status(7), "assisti");
  assert.equal(assistidos.status(8), "assisti");
  assert.deepEqual(assistidos.semDados(), [7]); // a 8 tem ✗: não precisa de dados
});

test("guardarDados completa marcações antigas sem título/pôster", () => {
  const antigo = JSON.stringify([{ id: 7, generos: [18] }]);
  const assistidos = criarAssistidos(armazenamentoFalso(antigo));
  assistidos.guardarDados({ id: 7, title: "Sete", poster_path: "/7.jpg", genres: [{ id: 18 }] });
  assert.deepEqual(assistidos.semDados(), []);
  assert.equal(assistidos.daLista("assisti")[0].title, "Sete");
  assert.deepEqual(assistidos.daLista("assisti")[0].genre_ids, [18]);
});

test("armazenamento quebrado ou bloqueado não derruba o site", () => {
  const quebrado = {
    getItem: () => "isto não é JSON",
    setItem: () => {
      throw new Error("bloqueado");
    },
  };
  const assistidos = criarAssistidos(quebrado);
  assert.deepEqual(assistidos.lista(), []);
  assert.equal(assistidos.avaliar(filme(1), "gostei"), "gostei");
  assert.equal(assistidos.avaliacao(1), "gostei"); // funciona até fechar a página
  assert.deepEqual(criarAssistidos(undefined).lista(), []);
});

test("generosFavoritos: ✓ +2, só 'Já assisti' +1, ✗ −2, 'Quero assistir' 0; só positivos, até 3", () => {
  const lista = [
    { id: 1, generos: [28, 12], avaliacao: "gostei", status: "assisti" },
    { id: 2, generos: [878], avaliacao: null, status: "assisti" },
    { id: 3, generos: [878, 35], avaliacao: null, status: "assisti" },
    { id: 4, generos: [12, 27], avaliacao: "nao", status: "assisti" },
    { id: 5, generos: [99, 35], avaliacao: null, status: "quero" },
    { id: 6, generos: [18], avaliacao: "gostei", status: "assisti" },
  ];
  // ação 2, ficção 1+1=2, drama 2, comédia 1, aventura 2−2=0, terror −2, documentário 0
  assert.deepEqual(generosFavoritos(lista), [28, 878, 18]);
  assert.deepEqual(generosFavoritos([{ id: 1, generos: [27], avaliacao: "nao", status: "assisti" }]), []);
  assert.deepEqual(generosFavoritos([{ id: 1, generos: [27], avaliacao: null, status: "quero" }]), []);
  assert.deepEqual(generosFavoritos([]), []);
});

test("marcado: qualquer marcação (✓, ✗, Quero assistir, Já assisti)", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assistidos.marcarStatus(filme(1), "quero");
  assistidos.marcarStatus(filme(2), "assisti");
  assistidos.avaliar(filme(3), "gostei");
  assistidos.avaliar(filme(4), "nao");
  for (const id of [1, 2, 3, 4]) assert.equal(assistidos.marcado(id), true, `filme ${id}`);
  assert.equal(assistidos.marcado(5), false);
});

test("restaurar volta o filme exatamente como estava (para o Desfazer)", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assistidos.marcarStatus(filme(1), "quero");
  const antes = assistidos.estado(1);
  assistidos.avaliar(filme(1), "gostei"); // vira gostei + já assisti
  assistidos.restaurar(filme(1), antes);
  assert.deepEqual(assistidos.estado(1), { avaliacao: null, status: "quero" });

  const vazio = assistidos.estado(2);
  assistidos.avaliar(filme(2), "nao");
  assistidos.restaurar(filme(2), vazio);
  assert.equal(assistidos.marcado(2), false);
  assert.equal(assistidos.lista().some((f) => f.id === 2), false); // sem marca: sai da lista
});

test("foraDoCarrossel também vale para 'Quero assistir'", () => {
  const assistidos = criarAssistidos(armazenamentoFalso());
  assistidos.marcarStatus(filme(1), "quero");
  assert.equal(assistidos.foraDoCarrossel(1), true);
});
