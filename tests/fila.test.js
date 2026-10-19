import { test } from "node:test";
import assert from "node:assert/strict";
import { criarFila } from "../js/fila.js";

// Uma "TMDB" falsa: páginas de 2 filmes, IDs 1, 2, 3... até `total`.
// O cursor é o número da página; conta quantas páginas foram pedidas.
function fonte(total, porPagina = 2) {
  const pedidas = [];
  const buscarPagina = async (pagina) => {
    pedidas.push(pagina);
    const inicio = (pagina - 1) * porPagina;
    const filmes = [];
    for (let id = inicio + 1; id <= Math.min(inicio + porPagina, total); id++) filmes.push({ id });
    return { filmes, proximo: inicio + porPagina < total ? pagina + 1 : null };
  };
  return { buscarPagina, pedidas };
}
const ids = (filmes) => filmes.map((f) => f.id);

test("puxar entrega os próximos filmes, na ordem, sem repetir", async () => {
  const { buscarPagina, pedidas } = fonte(10);
  const fila = criarFila({ buscarPagina, entra: () => true, inicio: 1 });
  assert.deepEqual(ids(await fila.puxar(3)), [1, 2, 3]);
  assert.deepEqual(ids(await fila.puxar(1)), [4]); // o 4 já estava na reserva
  assert.deepEqual(pedidas, [1, 2]);
  assert.deepEqual(ids(await fila.puxar(2)), [5, 6]);
});

test("puxar pula filmes que não entram (já marcados)", async () => {
  const { buscarPagina } = fonte(10);
  const marcados = new Set([1, 2, 3, 5]);
  const fila = criarFila({ buscarPagina, entra: (f) => !marcados.has(f.id), inicio: 1 });
  assert.deepEqual(ids(await fila.puxar(2)), [4, 6]);
});

test("um filme marcado enquanto estava na reserva não é entregue", async () => {
  const { buscarPagina } = fonte(10);
  const marcados = new Set();
  const fila = criarFila({ buscarPagina, entra: (f) => !marcados.has(f.id), inicio: 1 });
  await fila.puxar(1); // a página 1 trouxe 1 e 2; o 2 ficou na reserva
  marcados.add(2);
  assert.deepEqual(ids(await fila.puxar(1)), [3]);
});

test("vários puxar(1) ao mesmo tempo entregam filmes diferentes", async () => {
  const { buscarPagina } = fonte(10);
  const fila = criarFila({ buscarPagina, entra: () => true, inicio: 1 });
  const resultados = await Promise.all([fila.puxar(1), fila.puxar(1), fila.puxar(1)]);
  assert.deepEqual(resultados.map(ids), [[1], [2], [3]]);
});

test("devolver põe o filme de volta na frente da fila", async () => {
  const { buscarPagina } = fonte(10);
  const fila = criarFila({ buscarPagina, entra: () => true, inicio: 1 });
  const [primeiro] = await fila.puxar(1);
  fila.devolver(primeiro);
  assert.deepEqual(ids(await fila.puxar(2)), [1, 2]);
});

test("temMais fica falso quando os filmes acabam", async () => {
  const { buscarPagina } = fonte(3);
  const fila = criarFila({ buscarPagina, entra: () => true, inicio: 1 });
  assert.equal(fila.temMais(), true);
  assert.deepEqual(ids(await fila.puxar(5)), [1, 2, 3]);
  assert.equal(fila.temMais(), false);
  assert.deepEqual(await fila.puxar(1), []);
});

test("uma fila cancelada (a lista mudou) não entrega mais nada", async () => {
  const { buscarPagina } = fonte(10);
  const fila = criarFila({ buscarPagina, entra: () => true, inicio: 1 });
  const pedido = fila.puxar(2);
  fila.cancelar();
  assert.deepEqual(await pedido, []);
});

test("se a TMDB falhar, o erro chega a quem pediu e a fila continua usável", async () => {
  let falhar = true;
  const { buscarPagina: real } = fonte(10);
  const buscarPagina = async (pagina) => {
    if (falhar) throw new Error("sem internet");
    return real(pagina);
  };
  const fila = criarFila({ buscarPagina, entra: () => true, inicio: 1 });
  await assert.rejects(fila.puxar(2), /sem internet/);
  falhar = false;
  assert.deepEqual(ids(await fila.puxar(2)), [1, 2]);
});
