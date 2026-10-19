// assistidos.js — o que você marcou em cada filme, guardado no navegador
// (localStorage): sobrevive a fechar a página, mas não passa para outro
// navegador ou computador.
//
// Cada filme marcado tem duas informações independentes:
// - avaliacao: "gostei" (✓), "nao" (✗) ou null
// - status:    "quero" (Quero assistir), "assisti" (Já assisti) ou null

const CHAVE = "catalogo-filmes:assistidos";

// Quantos gêneros favoritos o carrossel usa.
const MAX_GENEROS = 3;

// Pontos que cada marcação dá aos gêneros do filme, para as recomendações.
const PONTOS_GOSTEI = 2; // ✓ (gostei e já assisti)
const PONTOS_SO_ASSISTI = 1; // "Já assisti" sem ✓ nem ✗: o gênero interessa
const PONTOS_NAO_GOSTEI = -2; // ✗
// "Quero assistir" não soma nem tira: a pessoa ainda não viu o filme.

function pontosDe(filme) {
  if (filme.avaliacao === "gostei") return PONTOS_GOSTEI;
  if (filme.avaliacao === "nao") return PONTOS_NAO_GOSTEI;
  if (filme.status === "assisti") return PONTOS_SO_ASSISTI;
  return 0;
}

// Só o necessário para desenhar o card nas abas "Quero assistir" e
// "Já assisti" sem precisar perguntar de novo à TMDB.
function resumir(filme) {
  return {
    id: filme.id,
    title: filme.title,
    poster_path: filme.poster_path,
    backdrop_path: filme.backdrop_path,
    release_date: filme.release_date,
    vote_average: filme.vote_average,
    genre_ids: filme.genre_ids ?? filme.genres?.map((g) => g.id) ?? [],
  };
}

// `armazenamento` é o localStorage do navegador (nos testes, um falso).
// Se ele não existir ou estiver bloqueado (aba anônima, por exemplo),
// a lista funciona normalmente até fechar a página, só não fica salva.
// `relogio` diz "quando" cada marcação aconteceu (nos testes, um falso).
export function criarAssistidos(armazenamento = globalThis.localStorage, relogio = Date.now) {
  let lista = ler(armazenamento);

  function salvar() {
    try {
      armazenamento?.setItem(CHAVE, JSON.stringify(lista));
    } catch {
      // Sem onde salvar: segue só na memória.
    }
  }

  const achar = (idFilme) => lista.find((f) => f.id === idFilme);

  // Aplica a mudança no filme; se ficar sem nada marcado, sai da lista.
  function alterar(filme, mudanca) {
    const atual = achar(filme.id) ?? { id: filme.id, avaliacao: null, status: null };
    const novo = {
      ...atual,
      ...mudanca(atual),
      generos: filme.genre_ids ?? atual.generos ?? [],
      filme: resumir(filme),
      quando: relogio(),
    };
    lista = lista.filter((f) => f.id !== filme.id);
    if (novo.avaliacao || novo.status) lista.push(novo);
    salvar();
  }

  const avaliacao = (idFilme) => achar(idFilme)?.avaliacao ?? null;
  const status = (idFilme) => achar(idFilme)?.status ?? null;
  const marcado = (idFilme) => avaliacao(idFilme) !== null || status(idFilme) !== null;

  return {
    avaliacao,
    status,
    lista: () => lista,

    // ✓ ou ✗. Repetir desmarca; a outra troca. Dar uma opinião
    // marca o filme como "Já assisti". Devolve a avaliação que ficou.
    avaliar(filme, tipo) {
      alterar(filme, (atual) => {
        const nova = atual.avaliacao === tipo ? null : tipo;
        return { avaliacao: nova, status: nova ? "assisti" : atual.status };
      });
      return avaliacao(filme.id);
    },

    // "quero" ou "assisti". Repetir desmarca; o outro troca.
    marcarStatus(filme, tipo) {
      alterar(filme, (atual) => ({ status: atual.status === tipo ? null : tipo }));
      return status(filme.id);
    },

    // Filmes de uma aba, do mais recente para o mais antigo (sem os com ✗).
    // A lista guarda os mais novos no fim; invertida, o empate de horário
    // também fica com o marcado por último.
    daLista(tipo) {
      return [...lista]
        .reverse()
        .filter((f) => f.status === tipo && f.avaliacao !== "nao" && f.filme)
        .sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0))
        .map((f) => f.filme);
    },

    contagem() {
      const visiveis = lista.filter((f) => f.avaliacao !== "nao");
      return {
        quero: visiveis.filter((f) => f.status === "quero").length,
        assisti: visiveis.filter((f) => f.status === "assisti").length,
      };
    },

    // Tem alguma marcação? (✓, ✗, Quero assistir ou Já assisti)
    marcado,

    // O carrossel só sugere filmes que a pessoa ainda não marcou.
    foraDoCarrossel: marcado,

    // Foto das marcações de um filme, para o "Desfazer" poder voltar atrás.
    estado: (idFilme) => ({ avaliacao: avaliacao(idFilme), status: status(idFilme) }),
    restaurar(filme, estadoAnterior) {
      alterar(filme, () => estadoAnterior);
    },

    // Marcações da versão anterior não guardavam título e pôster.
    semDados: () => lista.filter((f) => !f.filme && f.avaliacao !== "nao").map((f) => f.id),
    guardarDados(filme) {
      const marcado = achar(filme.id);
      if (!marcado) return;
      marcado.filme = resumir(filme);
      salvar();
    },
  };
}

function ler(armazenamento) {
  try {
    const dados = JSON.parse(armazenamento?.getItem(CHAVE) ?? "[]");
    if (!Array.isArray(dados)) return [];
    // Marcações das versões anteriores: sem avaliação = ✓ (só existia ele);
    // sem status = "Já assisti" (quem avaliou, assistiu).
    return dados.map((f) => {
      const avaliacao = "avaliacao" in f ? f.avaliacao : "gostei";
      const status = "status" in f ? f.status : avaliacao ? "assisti" : null;
      return { ...f, avaliacao, status };
    });
  } catch {
    return [];
  }
}

// Soma os pontos de cada filme marcado (✓ +2, só "Já assisti" +1, ✗ −2)
// nos gêneros dele e devolve os gêneros com mais pontos (só os positivos).
// Empate: vence o que apareceu primeiro.
export function generosFavoritos(lista, max = MAX_GENEROS) {
  const pontos = new Map();
  for (const filme of lista) {
    for (const genero of filme.generos ?? []) {
      pontos.set(genero, (pontos.get(genero) ?? 0) + pontosDe(filme));
    }
  }
  return [...pontos.entries()]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([genero]) => genero);
}
