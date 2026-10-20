import { test } from "node:test";
import assert from "node:assert/strict";
import { mesclar, paraLinha, deLinha, criarSincronia } from "../js/nuvem.js";
import { criarAssistidos } from "../js/assistidos.js";

const item = (id, quando, extra = {}) => ({
  id,
  avaliacao: null,
  status: "quero",
  generos: [28],
  filme: { id, title: `Filme ${id}` },
  quando,
  ...extra,
});

test("mesclar junta o que só existe de um lado", () => {
  const { lista, enviar } = mesclar([item(1, 10)], [item(2, 20)]);
  assert.deepEqual(lista.map((f) => f.id).sort(), [1, 2]);
  assert.deepEqual(enviar.map((f) => f.id), [1]); // o 1 ainda não está na conta
});

test("mesclar fica com a marcação mais recente de cada filme", () => {
  const local = [item(1, 50, { status: "assisti" }), item(2, 10)];
  const remoto = [item(1, 20), item(2, 40, { status: "assisti" })];
  const { lista, enviar } = mesclar(local, remoto);
  const porId = Object.fromEntries(lista.map((f) => [f.id, f.status]));
  assert.deepEqual(porId, { 1: "assisti", 2: "assisti" });
  assert.deepEqual(enviar.map((f) => f.id), [1]); // só o local mais novo sobe
});

test("mesclar respeita um filme desmarcado em outro computador", () => {
  const desmarcado = item(1, 30, { status: null });
  const { lista, enviar } = mesclar([item(1, 10)], [desmarcado]);
  assert.deepEqual(lista, []);
  assert.deepEqual(enviar, []);
});

test("paraLinha e deLinha fazem a viagem de ida e volta", () => {
  const original = item(7, 1_700_000_000_000, { status: "assisti", avaliacao: "gostei", assistidoEm: 1_699_000_000_000 });
  const linha = paraLinha(original);
  assert.equal(linha.filme_id, 7);
  assert.equal(linha.atualizado_em, 1_700_000_000_000);
  assert.equal(linha.assistido_em, new Date(1_699_000_000_000).toISOString());
  assert.deepEqual(deLinha(linha), original);
});

test("paraLinha só tem data de assistido quando o filme está em 'Já assisti'", () => {
  assert.equal(paraLinha(item(1, 5, { assistidoEm: 3 })).assistido_em, null);
  // Marcações antigas, sem a data: usa a hora da última mudança.
  assert.equal(paraLinha(item(1, 5000, { status: "assisti" })).assistido_em, new Date(5000).toISOString());
});

// Imita o localStorage e a conta no Supabase.
function armazenamentoFalso() {
  const dados = new Map();
  return { getItem: (c) => dados.get(c) ?? null, setItem: (c, v) => dados.set(c, String(v)) };
}
function contaFalsa(linhas = []) {
  const nuvem = new Map(linhas.map((l) => [l.filme_id, l]));
  return {
    nuvem,
    falhar: false,
    async buscarMarcacoes() {
      return [...nuvem.values()];
    },
    async salvarMarcacoes(novas) {
      if (this.falhar) throw new Error("sem internet");
      for (const l of novas) nuvem.set(l.filme_id, l);
    },
  };
}
const filme = (id) => ({ id, title: `Filme ${id}`, genre_ids: [28] });

test("ao entrar, as marcações do navegador sobem e as da conta descem", async () => {
  let hora = 100;
  const assistidos = criarAssistidos(armazenamentoFalso(), () => hora++);
  assistidos.marcarStatus(filme(1), "quero"); // marcado antes de entrar
  const conta = contaFalsa([paraLinha(item(2, 50, { status: "assisti" }))]);
  const sincronia = criarSincronia({ conta, assistidos });

  await sincronia.aoEntrar();
  assert.equal(assistidos.status(2), "assisti");
  assert.equal(conta.nuvem.get(1).status, "quero");
});

test("cada marcação feita com a conta aberta vai para a nuvem (inclusive desmarcar)", async () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 1000);
  const conta = contaFalsa();
  const sincronia = criarSincronia({ conta, assistidos });
  await sincronia.aoEntrar();

  assistidos.marcarStatus(filme(3), "assisti");
  await sincronia.pronto();
  assert.equal(conta.nuvem.get(3).status, "assisti");

  assistidos.marcarStatus(filme(3), "assisti"); // desmarca
  await sincronia.pronto();
  assert.equal(conta.nuvem.get(3).status, null);
});

test("sem internet, a marcação espera e sobe na próxima vez", async () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 1000);
  const conta = contaFalsa();
  const sincronia = criarSincronia({ conta, assistidos });
  await sincronia.aoEntrar();

  conta.falhar = true;
  assistidos.marcarStatus(filme(4), "quero");
  await sincronia.pronto();
  assert.equal(conta.nuvem.has(4), false);

  conta.falhar = false;
  assistidos.marcarStatus(filme(5), "quero");
  await sincronia.pronto();
  assert.equal(conta.nuvem.has(4), true);
  assert.equal(conta.nuvem.has(5), true);
});

test("ao sair, as marcações saem do navegador e nada mais vai para a conta", async () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 1000);
  const conta = contaFalsa();
  const sincronia = criarSincronia({ conta, assistidos });
  await sincronia.aoEntrar();
  assistidos.marcarStatus(filme(6), "quero");
  await sincronia.pronto();

  sincronia.aoSair();
  assert.deepEqual(assistidos.lista(), []);
  assistidos.marcarStatus(filme(7), "quero");
  await sincronia.pronto();
  assert.equal(conta.nuvem.has(7), false);
});

test("se a conta não respondeu ao entrar, sair não apaga as marcações do navegador", async () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 1000);
  assistidos.marcarStatus(filme(8), "quero");
  const conta = contaFalsa();
  conta.buscarMarcacoes = async () => {
    throw new Error("tabela não existe");
  };
  const sincronia = criarSincronia({ conta, assistidos });
  await assert.rejects(sincronia.aoEntrar());

  assistidos.marcarStatus(filme(9), "quero");
  sincronia.aoSair();
  assert.deepEqual(assistidos.lista().map((f) => f.id).sort(), [8, 9]);
});

test("se ainda há marcações sem subir, sair não apaga as do navegador", async () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 1000);
  const conta = contaFalsa();
  const sincronia = criarSincronia({ conta, assistidos });
  await sincronia.aoEntrar();
  conta.falhar = true;
  assistidos.marcarStatus(filme(10), "quero");
  await sincronia.pronto();

  sincronia.aoSair();
  assert.equal(assistidos.status(10), "quero");
});

test("avisa quando não consegue salvar na conta", async () => {
  const assistidos = criarAssistidos(armazenamentoFalso(), () => 1000);
  const conta = contaFalsa();
  const falhas = [];
  const sincronia = criarSincronia({ conta, assistidos, aoFalhar: () => falhas.push(1) });
  await sincronia.aoEntrar();
  conta.falhar = true;
  assistidos.marcarStatus(filme(11), "quero");
  await sincronia.pronto();
  assert.equal(falhas.length, 1);
});
