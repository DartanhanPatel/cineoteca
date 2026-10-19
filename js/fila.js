// fila.js — a fila de reserva da grade: os próximos filmes, já buscados na
// TMDB e na ordem certa, prontos para entrar na tela. Serve para o
// "Carregar mais" e para repor, um a um, os filmes que saem do Catálogo
// quando são marcados (assim a grade fica sempre com a mesma quantidade).
// Como o api.js, não mexe na tela.
import { buscarAteEncher } from "./api.js";

// Quantas vezes seguidas tentar encher a reserva num mesmo pedido (cada
// vez pode pedir várias páginas). Evita pedir páginas sem fim quando quase
// tudo já foi marcado.
const MAX_TENTATIVAS = 3;

// buscarPagina(cursor) → { filmes, proximo } (veja api.js)
// entra(filme) → o filme pode aparecer? (por exemplo, "ainda não marcado")
// inicio → cursor da primeira página
export function criarFila({ buscarPagina, entra, inicio }) {
  let proximo = inicio; // onde a próxima busca na TMDB continua (null = acabou)
  const reserva = []; // filmes já buscados, esperando a vez
  const entregues = new Set(); // IDs que já foram para a tela
  let cancelada = false;
  // Os pedidos são atendidos um de cada vez (na ordem em que chegaram),
  // para dois pedidos ao mesmo tempo não entregarem o mesmo filme.
  let ocupada = Promise.resolve();

  const serve = (filme) => entra(filme) && !entregues.has(filme.id);
  const naReserva = (filme) => reserva.some((f) => f.id === filme.id);
  const disponiveis = () => reserva.filter(serve).length;

  async function abastecer(quantidade) {
    for (let i = 0; i < MAX_TENTATIVAS && disponiveis() < quantidade && proximo !== null; i++) {
      const resposta = await buscarAteEncher(buscarPagina, (f) => serve(f) && !naReserva(f), {
        inicio: proximo,
        minimo: quantidade - disponiveis(),
      });
      if (cancelada) return;
      for (const filme of resposta.filmes) if (!naReserva(filme)) reserva.push(filme);
      proximo = resposta.proximo;
    }
  }

  // Entrega até `quantidade` filmes novos (menos, se eles acabarem).
  function puxar(quantidade) {
    const tarefa = ocupada.then(async () => {
      await abastecer(quantidade);
      if (cancelada) return [];
      const prontos = [];
      while (prontos.length < quantidade && reserva.length > 0) {
        const filme = reserva.shift();
        if (!serve(filme)) continue; // foi marcado enquanto esperava: descarta
        entregues.add(filme.id);
        prontos.push(filme);
      }
      return prontos;
    });
    ocupada = tarefa.catch(() => {}); // um erro não trava os próximos pedidos
    return tarefa;
  }

  return {
    puxar,
    // Devolve um filme para a frente da fila (o "Desfazer" usa isso).
    devolver(filme) {
      entregues.delete(filme.id);
      reserva.unshift(filme);
    },
    temMais: () => proximo !== null || reserva.some(serve),
    // A lista mudou (outro filtro, busca ou aba): esta fila para de entregar.
    cancelar() {
      cancelada = true;
    },
  };
}
