// assistidos.js — o que você marcou em cada filme, guardado no navegador
// (localStorage): sobrevive a fechar a página. Com a conta aberta, o
// nuvem.js também leva cada mudança para o Supabase.
//
// Cada filme marcado tem duas informações independentes:
// - avaliacao: "gostei" (✓), "nao" (✗) ou null
// - status:    "quero" (Quero assistir), "assisti" (Já assisti) ou null
// E quando entrou em "Já assisti" (assistidoEm), para o ranking do mês.

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
  // O texto guardado da última vez que lemos ou salvamos. Se ele mudar, foi
  // outra aba do site que salvou: antes de alterar, lemos de novo, para não
  // apagar o que ela marcou.
  let textoConhecido = lerTexto(armazenamento);
  let lista = converter(textoConhecido);
  // Quem quer saber de cada mudança (o nuvem.js, com a conta aberta).
  let avisar = () => {};

  function atualizarDeOutraAba() {
    const texto = lerTexto(armazenamento);
    if (texto === textoConhecido) return; // ninguém mexeu (ou não deu para salvar)
    textoConhecido = texto;
    lista = converter(texto);
  }

  function salvar() {
    try {
      const texto = JSON.stringify(lista);
      armazenamento?.setItem(CHAVE, texto);
      textoConhecido = texto;
    } catch {
      // Sem onde salvar: segue só na memória.
    }
  }

  const achar = (idFilme) => lista.find((f) => f.id === idFilme);

  // Aplica a mudança no filme; se ficar sem nada marcado, sai da lista.
  function alterar(filme, mudanca) {
    atualizarDeOutraAba();
    const atual = achar(filme.id) ?? { id: filme.id, avaliacao: null, status: null };
    const agora = relogio();
    const mudou = mudanca(atual);
    const novo = {
      ...atual,
      ...mudou,
      generos: filme.genre_ids ?? atual.generos ?? [],
      filme: resumir(filme),
      quando: agora,
    };
    // A data de "assisti" só nasce quando o filme entra em "Já assisti" (dar
    // ✓ depois não muda) e some quando ele sai. O Desfazer traz a original.
    if (!("assistidoEm" in mudou)) {
      const jaEstava = atual.status === "assisti";
      novo.assistidoEm = novo.status !== "assisti" ? null : jaEstava ? (atual.assistidoEm ?? null) : agora;
    }
    lista = lista.filter((f) => f.id !== filme.id);
    if (novo.avaliacao || novo.status) lista.push(novo);
    salvar();
    avisar(novo);
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
    // tipo: "quero", "assisti" ou "ocultos" (os filmes com ✗).
    daLista(tipo) {
      return [...lista]
        .reverse()
        .filter((f) => pertenceA(f, tipo) && f.filme)
        .sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0))
        .map((f) => f.filme);
    },

    contagem() {
      return {
        quero: lista.filter((f) => pertenceA(f, "quero")).length,
        assisti: lista.filter((f) => pertenceA(f, "assisti")).length,
        ocultos: lista.filter((f) => pertenceA(f, "ocultos")).length,
      };
    },

    // O filme aparece nessa aba? (para tirá-lo da tela quando deixar de aparecer)
    estaNaAba: (idFilme, tipo) => {
      const marcado = achar(idFilme);
      return Boolean(marcado) && pertenceA(marcado, tipo);
    },

    // Tem alguma marcação? (✓, ✗, Quero assistir ou Já assisti)
    marcado,

    // O carrossel só sugere filmes que a pessoa ainda não marcou.
    foraDoCarrossel: marcado,

    // Foto das marcações de um filme, para o "Desfazer" poder voltar atrás.
    estado: (idFilme) => ({
      avaliacao: avaliacao(idFilme),
      status: status(idFilme),
      assistidoEm: achar(idFilme)?.assistidoEm ?? null,
    }),
    restaurar(filme, estadoAnterior) {
      alterar(filme, () => estadoAnterior);
    },

    // Marcações da versão anterior não guardavam título e pôster.
    semDados: () => lista.filter((f) => !f.filme).map((f) => f.id),
    guardarDados(filme) {
      atualizarDeOutraAba();
      const marcado = achar(filme.id);
      if (!marcado) return;
      marcado.filme = resumir(filme);
      salvar();
      avisar(marcado);
    },

    // aoMudar(item) é chamado depois de cada marcação (item sem avaliação
    // nem status = o filme foi desmarcado).
    aoAlterar(aoMudar) {
      avisar = aoMudar;
    },

    // Troca todas as marcações de uma vez (as da conta, ao entrar).
    substituir(novaLista) {
      lista = novaLista.filter((f) => valido(f) && (f.avaliacao || f.status));
      salvar();
    },

    // Apaga as marcações do navegador (ao sair da conta: elas ficam na nuvem).
    esquecer() {
      lista = [];
      salvar();
    },
  };
}

// Em qual aba o filme marcado aparece: os com ✗ só em "Ocultos"; os outros
// na aba do status deles ("Quero assistir" ou "Já assisti").
function pertenceA(filme, tipo) {
  if (tipo === "ocultos") return filme.avaliacao === "nao";
  return filme.status === tipo && filme.avaliacao !== "nao";
}

// O texto guardado no navegador, ou null se não houver (ou estiver bloqueado).
function lerTexto(armazenamento) {
  try {
    return armazenamento?.getItem(CHAVE) ?? null;
  } catch {
    return null;
  }
}

// Um item que dá para usar: um objeto com o ID do filme.
const valido = (f) => f !== null && typeof f === "object" && Number.isInteger(f.id);

function converter(texto) {
  try {
    const dados = JSON.parse(texto ?? "[]");
    if (!Array.isArray(dados)) return [];
    // Um item estragado é descartado sozinho, sem levar os outros junto.
    // Marcações das versões anteriores: sem avaliação = ✓ (só existia ele);
    // sem status = "Já assisti" (quem avaliou, assistiu).
    return dados.filter(valido).map((f) => {
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
