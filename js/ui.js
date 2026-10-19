// ui.js — tudo que desenha na tela.
// Regra deste arquivo: nunca chama a internet (nada de `fetch` aqui).
// Regra de segurança: dados da TMDB entram na tela só com textContent ou
// atributos — nunca com innerHTML — para um título como "Tom & Jerry <O Filme>"
// aparecer literalmente, sem quebrar a página.

const URL_POSTER = "https://image.tmdb.org/t/p/w342";
const URL_LOGO = "https://image.tmdb.org/t/p/w92";
const URL_FUNDO = "https://image.tmdb.org/t/p/w1280";
// Versão pequena da imagem de fundo: vira o brilho desfocado da "sala".
const URL_AMBIENTE = "https://image.tmdb.org/t/p/w300";

// Carrossel do destaque: quantos filmes, nota mínima (exclusiva) e intervalo.
const MAX_CARROSSEL = 4;
const NOTA_CARROSSEL = 7.5;
const INTERVALO_CARROSSEL = 5000;
// A partir de quantas letras o título do destaque fica menor.
export const TITULO_LONGO = 18;
// Quantos logos de "onde assistir" cabem num pôster.
const MAX_LOGOS = 4;

// Atalho para pegar elementos da página pelo seletor.
const $ = (seletor) => document.querySelector(seletor);

// "2024-05-01" → "2024". Sem data → "—".
export function formatarAno(dataLancamento) {
  return dataLancamento ? dataLancamento.slice(0, 4) : "—";
}

// 7.834 → "7,8" (com vírgula, como se escreve no Brasil). Sem votos → "—".
export function formatarNota(nota) {
  return nota ? nota.toFixed(1).replace(".", ",") : "—";
}

// 136 → "2h 16min"; 120 → "2h"; 45 → "45min"; sem duração → "".
export function formatarDuracao(minutos) {
  if (!minutos) return "";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto}min`;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

// "#/filme/603" → { filme: 603 }. Qualquer outro endereço → null.
export function lerRota(hash) {
  const achado = /^#\/filme\/(\d+)$/.exec(hash ?? "");
  return achado ? { filme: Number(achado[1]) } : null;
}

// Endereço da página de detalhes de um filme.
export const linkDoFilme = (idFilme) => `#/filme/${idFilme}`;

// Linha de informações curtas (ano, nota...): cada item vira um <span>,
// e o espaçamento entre eles fica por conta do CSS.
export function criarLinhaInfo(classe, itens) {
  const linha = document.createElement("p");
  linha.className = classe;
  for (const { texto, classe: classeItem } of itens) {
    if (!texto) continue;
    const item = document.createElement("span");
    if (classeItem) item.className = classeItem;
    item.textContent = texto;
    linha.append(item);
  }
  return linha;
}

// ---------------------------------------------------------------
// Brilho da "sala escura"
// ---------------------------------------------------------------

// As cores do filme em destaque vazam para a página: uma cópia pequena e
// muito desfocada da imagem fica atrás de tudo. null apaga a luz.
export function definirAmbiente(caminhoImagem, alvo = $("#ambiente")) {
  if (!alvo) return;
  if (!caminhoImagem) {
    alvo.replaceChildren();
    return;
  }
  const atual = alvo.lastElementChild;
  if (atual?.dataset.caminho === caminhoImagem) return;

  const luz = document.createElement("img");
  luz.alt = "";
  luz.dataset.caminho = caminhoImagem;
  luz.src = URL_AMBIENTE + caminhoImagem;
  // A nova luz acende por cima da antiga; depois a antiga é retirada.
  luz.onload = () => {
    luz.classList.add("acesa");
    setTimeout(() => {
      for (const antiga of [...alvo.children]) if (antiga !== luz) antiga.remove();
    }, 1200);
  };
  alvo.append(luz);
}

// Escolhe os filmes do carrossel: nota acima de 7,5, com imagem de fundo
// e que a pessoa ainda não assistiu. Mantém a ordem (os mais populares).
export function escolherCarrossel(filmes, estaAssistido, max = MAX_CARROSSEL) {
  return filmes
    .filter((f) => f.vote_average > NOTA_CARROSSEL && f.backdrop_path && !estaAssistido(f.id))
    .slice(0, max);
}

// Separa os logos que aparecem dos que viram "+N".
export function resumirLogos(provedores, max = MAX_LOGOS) {
  return { visiveis: provedores.slice(0, max), extras: Math.max(provedores.length - max, 0) };
}

// ---------------------------------------------------------------
// Busca
// ---------------------------------------------------------------

// Liga a caixa de busca. `aoDigitar` recebe o texto atual a cada mudança
// (o app.js decide quando buscar). O "×" e a tecla Esc limpam a busca.
export function ligarBusca(aoDigitar) {
  const campo = $("#busca");
  const limpar = $("#limpar-busca");
  const avisar = () => {
    limpar.hidden = campo.value === "";
    aoDigitar(campo.value);
  };
  const apagar = () => {
    campo.value = "";
    avisar();
    campo.focus();
  };
  campo.oninput = avisar;
  campo.onkeydown = (evento) => {
    if (evento.key === "Escape") apagar();
  };
  limpar.onclick = apagar;
}

// Coloca o texto no campo de busca sem disparar uma busca (usado para
// limpar o campo ao trocar de aba).
export function definirTextoBusca(texto) {
  $("#busca").value = texto;
  $("#limpar-busca").hidden = texto === "";
}

// ---------------------------------------------------------------
// Abas: Catálogo | Quero assistir | Já assisti
// ---------------------------------------------------------------

export function ligarAbas(aoTrocar) {
  for (const aba of document.querySelectorAll(".aba")) {
    aba.onclick = () => aoTrocar(aba.dataset.aba);
  }
}

export function marcarAba(nome) {
  for (const aba of document.querySelectorAll(".aba")) {
    aba.setAttribute("aria-selected", String(aba.dataset.aba === nome));
  }
}

export function atualizarContadores({ quero, assisti }) {
  $('.aba[data-aba="quero"] .contador').textContent = quero;
  $('.aba[data-aba="assisti"] .contador').textContent = assisti;
}

// Durante a busca, os logos de filtro ficam apagados e sem clique.
export function definirFiltroAtivo(ativo) {
  const barra = $(".barra");
  barra.inert = !ativo;
  barra.classList.toggle("desativada", !ativo);
}

// Nas abas "Quero assistir" e "Já assisti" os logos de filtro somem.
export function mostrarFiltro(visivel) {
  $(".barra").hidden = !visivel;
}

// Faixa com os logos de onde assistir.
// provedores: lista (pode ser vazia) ou null quando a consulta falhou.
function preencherFaixa(faixa, provedores) {
  if (provedores === null) {
    faixa.replaceChildren("?");
    faixa.title = "Não foi possível consultar onde assistir.";
    return;
  }
  if (provedores.length === 0) {
    faixa.replaceChildren("Fora do streaming");
    faixa.title = "";
    return;
  }
  const { visiveis, extras } = resumirLogos(provedores);
  const logos = visiveis.map((provedor) => {
    const logo = document.createElement("img");
    logo.className = "logo-mini";
    logo.src = URL_LOGO + provedor.logo_path;
    logo.alt = provedor.provider_name;
    logo.title = provedor.provider_name;
    return logo;
  });
  if (extras > 0) {
    const mais = document.createElement("span");
    mais.className = "logo-mais";
    mais.textContent = `+${extras}`;
    mais.title = provedores.slice(MAX_LOGOS).map((p) => p.provider_name).join(", ");
    logos.push(mais);
  }
  faixa.replaceChildren(...logos);
  faixa.title = "";
}

// Põe os logos de onde assistir nos cards desse filme (resultados da busca).
export function preencherOndeAssistir(idFilme, provedores) {
  for (const faixa of document.querySelectorAll(`.card[data-filme-id="${idFilme}"] .onde-assistir`)) {
    preencherFaixa(faixa, provedores);
  }
}

// ---------------------------------------------------------------
// Destaque grande no topo
// ---------------------------------------------------------------

// Um slide do carrossel: imagem de fundo, título, ano/nota, sinopse,
// botão "Mais informações" e logos. Clicar em qualquer lugar do slide
// também abre a página do filme.
function criarSlide(filme, rotulo) {
  const slide = document.createElement("article");
  slide.className = "slide";
  slide.dataset.filmeId = filme.id;
  slide.onclick = (evento) => {
    if (!evento.target.closest("a, button")) location.hash = linkDoFilme(filme.id);
  };

  const fundo = document.createElement("img");
  fundo.className = "destaque-fundo";
  fundo.src = URL_FUNDO + filme.backdrop_path;
  fundo.alt = "";

  const etiqueta = document.createElement("p");
  etiqueta.className = "destaque-rotulo";
  etiqueta.textContent = rotulo;

  const titulo = document.createElement("h2");
  titulo.className = "destaque-titulo";
  titulo.textContent = filme.title;
  // Título comprido ganha letra menor, para caber em até 2 linhas.
  titulo.classList.toggle("longo", filme.title.length > TITULO_LONGO);

  const info = criarLinhaInfo("destaque-info", [
    { texto: formatarAno(filme.release_date) },
    { texto: `★ ${formatarNota(filme.vote_average)}`, classe: "nota" },
  ]);

  const sinopse = document.createElement("p");
  sinopse.className = "destaque-sinopse";
  sinopse.textContent = filme.overview || "Sinopse indisponível.";

  const mais = document.createElement("a");
  mais.className = "botao-claro";
  mais.href = linkDoFilme(filme.id);
  mais.textContent = "Mais informações";
  mais.setAttribute("aria-label", `Mais informações sobre ${filme.title}`);

  const faixa = document.createElement("div");
  faixa.className = "onde-assistir";
  faixa.textContent = "…";
  const acoes = document.createElement("div");
  acoes.className = "destaque-acoes";
  acoes.append(mais, faixa);

  const texto = document.createElement("div");
  texto.className = "destaque-texto";
  texto.append(etiqueta, titulo, info, sinopse, acoes);

  slide.append(fundo, texto);
  return slide;
}

// O carrossel troca sozinho; este é o relógio dele.
let relogioCarrossel;

// Desenha o carrossel no destaque. Lista vazia: esconde o destaque.
export function renderizarCarrossel(filmes, rotulo) {
  const destaque = $("#destaque");
  clearInterval(relogioCarrossel);
  destaque.onmouseenter = destaque.onmouseleave = null;

  if (filmes.length === 0) {
    destaque.hidden = true;
    destaque.replaceChildren();
    definirAmbiente(null);
    return;
  }

  const slides = filmes.map((filme) => criarSlide(filme, rotulo));
  const bolinhas = filmes.map((filme, i) => {
    const bolinha = document.createElement("button");
    bolinha.className = "bolinha";
    // A barra dentro da bolinha enche em 5 segundos: mostra quando o
    // próximo filme vai entrar.
    const progresso = document.createElement("span");
    progresso.className = "progresso";
    progresso.style.animationDuration = `${INTERVALO_CARROSSEL}ms`;
    bolinha.append(progresso);
    bolinha.setAttribute("aria-label", `Filme ${i + 1} de ${filmes.length}: ${filme.title}`);
    bolinha.onclick = () => {
      mostrar(i);
      reiniciar(); // depois de um clique, conta 5 segundos de novo
    };
    return bolinha;
  });

  let atual = 0;
  function mostrar(indice) {
    atual = indice;
    slides.forEach((slide, i) => {
      slide.classList.toggle("ativo", i === indice);
      slide.inert = i !== indice; // só o slide visível recebe foco
    });
    bolinhas.forEach((bolinha, i) => {
      bolinha.setAttribute("aria-current", String(i === indice));
      // Recomeça a animação da barra (trocar o elemento reinicia o CSS).
      const progresso = bolinha.firstElementChild;
      progresso.replaceWith(progresso.cloneNode());
    });
    definirAmbiente(filmes[indice].backdrop_path);
  }
  function reiniciar() {
    clearInterval(relogioCarrossel);
    if (filmes.length > 1) {
      relogioCarrossel = setInterval(() => mostrar((atual + 1) % filmes.length), INTERVALO_CARROSSEL);
    }
  }

  const navegacao = document.createElement("div");
  navegacao.className = "bolinhas";
  navegacao.hidden = filmes.length < 2;
  navegacao.append(...bolinhas);

  destaque.replaceChildren(...slides, navegacao);
  destaque.hidden = false;
  mostrar(0);
  reiniciar();

  // Pausa enquanto o mouse está em cima (a barra de progresso também).
  destaque.onmouseenter = () => {
    clearInterval(relogioCarrossel);
    destaque.classList.add("pausado");
  };
  destaque.onmouseleave = () => {
    destaque.classList.remove("pausado");
    mostrar(atual); // a barra recomeça junto com a contagem
    reiniciar();
  };
}

// Põe os logos de onde assistir no slide desse filme (se ainda estiver lá).
export function preencherOndeAssistirDestaque(idFilme, provedores) {
  const faixa = $(`#destaque .slide[data-filme-id="${idFilme}"] .onde-assistir`);
  if (faixa) preencherFaixa(faixa, provedores);
}

// ---------------------------------------------------------------
// Botões ✓ "Gostei" e ✗ "Não gostei"
// ---------------------------------------------------------------

// O app.js informa como saber as marcações de um filme e o que fazer no
// clique; assim o ui.js não precisa saber onde a lista fica guardada.
let avaliacoes = {
  avaliacaoDe: () => null,
  statusDe: () => null,
  aoAvaliar: () => null,
  aoMarcarStatus: () => null,
};

export function configurarAvaliacoes(config) {
  avaliacoes = config;
}

// Na ordem da tela: ✗ à esquerda, ✓ à direita (o Tab segue essa ordem).
const BOTOES_AVALIACAO = [
  { tipo: "nao", simbolo: "✗", rotulo: "Não gostei" },
  { tipo: "gostei", simbolo: "✓", rotulo: "Já assisti e gostei" },
];

const BOTOES_STATUS = [
  { tipo: "quero", simbolo: "＋", rotulo: "Quero assistir" },
  { tipo: "assisti", simbolo: "👁", rotulo: "Já assisti" },
];

// Atualiza os botões desse filme em todo lugar (cards da grade e página
// do filme) para mostrar as marcações atuais.
function atualizarMarcas(idFilme) {
  const avaliacao = avaliacoes.avaliacaoDe(idFilme);
  const status = avaliacoes.statusDe(idFilme);
  for (const botao of document.querySelectorAll(`.avaliar[data-filme-id="${idFilme}"]`)) {
    botao.setAttribute("aria-pressed", String(botao.dataset.tipo === avaliacao));
  }
  for (const botao of document.querySelectorAll(`.status[data-filme-id="${idFilme}"]`)) {
    botao.setAttribute("aria-pressed", String(botao.dataset.tipo === status));
  }
}

// ✗ "Não gostei": o card some na hora, com um aviso para desfazer.
// O card só fica escondido (não é apagado), então desfazer o devolve
// exatamente para o mesmo lugar da grade.
function ocultarFilme(filme) {
  const cards = document.querySelectorAll(`.card[data-filme-id="${filme.id}"]`);
  for (const card of cards) {
    card.classList.add("saindo");
    setTimeout(() => {
      if (card.classList.contains("saindo")) card.hidden = true;
    }, 250);
  }
  mostrarAviso(`"${filme.title}" não vai mais aparecer.`, "Desfazer", () => {
    avaliacoes.aoAvaliar(filme, "nao"); // repetir o ✗ desmarca
    for (const card of cards) {
      card.classList.remove("saindo");
      card.hidden = false;
    }
    atualizarMarcas(filme.id);
  });
}

// Aviso no rodapé da tela que some sozinho depois de 5 segundos.
const DURACAO_AVISO = 5000;
let relogioAviso;

function mostrarAviso(texto, rotuloAcao, aoAgir) {
  const aviso = $("#aviso");
  const mensagem = document.createElement("span");
  mensagem.textContent = texto;
  const botao = document.createElement("button");
  botao.textContent = rotuloAcao;
  botao.onclick = () => {
    esconder();
    aoAgir();
  };
  function esconder() {
    clearTimeout(relogioAviso);
    aviso.hidden = true;
    aviso.replaceChildren();
  }
  clearTimeout(relogioAviso);
  aviso.replaceChildren(mensagem, botao);
  aviso.hidden = false;
  relogioAviso = setTimeout(esconder, DURACAO_AVISO);
}

export function criarBotoesAvaliacao(filme) {
  return BOTOES_AVALIACAO.map(({ tipo, simbolo, rotulo }) => {
    const botao = document.createElement("button");
    botao.className = `avaliar ${tipo}`;
    botao.dataset.tipo = tipo;
    botao.dataset.filmeId = filme.id;
    botao.textContent = simbolo;
    botao.title = rotulo;
    botao.setAttribute("aria-label", `${rotulo}: ${filme.title}`);
    botao.setAttribute("aria-pressed", String(avaliacoes.avaliacaoDe(filme.id) === tipo));
    botao.onclick = () => {
      const avaliacao = avaliacoes.aoAvaliar(filme, tipo);
      atualizarMarcas(filme.id);
      if (avaliacao === "nao") ocultarFilme(filme);
    };
    return botao;
  });
}

// Grupo com "＋ Quero assistir" e "👁 Já assisti". No card ele é uma
// camada do tamanho do pôster, com os botões alinhados embaixo.
export function criarBotoesStatus(filme, classe = "status-faixa") {
  const faixa = document.createElement("div");
  faixa.className = classe;
  faixa.append(
    ...BOTOES_STATUS.map(({ tipo, simbolo, rotulo }) => {
      const botao = document.createElement("button");
      botao.className = `status ${tipo}`;
      botao.dataset.tipo = tipo;
      botao.dataset.filmeId = filme.id;
      botao.textContent = `${simbolo} ${rotulo}`;
      botao.setAttribute("aria-label", `${rotulo}: ${filme.title}`);
      botao.setAttribute("aria-pressed", String(avaliacoes.statusDe(filme.id) === tipo));
      botao.onclick = () => {
        avaliacoes.aoMarcarStatus(filme, tipo);
        atualizarMarcas(filme.id);
      };
      return botao;
    })
  );
  return faixa;
}

// ---------------------------------------------------------------
// Logos de filtro e grade
// ---------------------------------------------------------------

// Desenha a barra de logos dos streamings.
export function renderizarProvedores(lista, selecionados, aoClicar, aoLimpar) {
  const barra = $("#provedores");
  barra.replaceChildren(
    ...lista.map((provedor) => {
      const botao = document.createElement("button");
      botao.className = "provedor";
      botao.title = provedor.provider_name;
      botao.setAttribute("aria-pressed", String(selecionados.has(provedor.provider_id)));
      botao.onclick = () => aoClicar(provedor.provider_id);

      const logo = document.createElement("img");
      logo.src = URL_LOGO + provedor.logo_path;
      logo.alt = provedor.provider_name;
      botao.append(logo);
      return botao;
    })
  );

  const limpar = $("#limpar");
  limpar.hidden = selecionados.size === 0;
  limpar.onclick = aoLimpar;
}

// Cria o card de um filme.
// Com comOndeAssistir: true, o card ganha uma faixa de logos (que começa
// com "…" e é preenchida depois por preencherOndeAssistir).
function criarCard(filme, comOndeAssistir) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.filmeId = filme.id;

  // Pôster e título levam para a página do filme.
  const link = document.createElement("a");
  link.className = "card-link";
  link.href = linkDoFilme(filme.id);

  if (filme.poster_path) {
    const poster = document.createElement("img");
    poster.className = "poster";
    poster.src = URL_POSTER + filme.poster_path;
    poster.alt = "";
    poster.loading = "lazy";
    link.append(poster);
  } else {
    const semPoster = document.createElement("div");
    semPoster.className = "poster sem-poster";
    semPoster.textContent = filme.title;
    link.append(semPoster);
  }

  const titulo = document.createElement("h2");
  titulo.className = "titulo";
  titulo.textContent = filme.title;
  link.append(titulo);

  const info = criarLinhaInfo("info", [
    { texto: formatarAno(filme.release_date) },
    { texto: `★ ${formatarNota(filme.vote_average)}`, classe: "nota" },
  ]);

  // Os botões ficam fora do link (botão dentro de link não é permitido).
  card.append(link, criarBotoesStatus(filme), ...criarBotoesAvaliacao(filme), info);

  if (comOndeAssistir) {
    const faixa = document.createElement("div");
    faixa.className = "onde-assistir";
    faixa.textContent = "…";
    card.append(faixa);
  }
  return card;
}

// Desenha os filmes na grade. Com acrescentar: true, mantém os que já estão lá.
export function renderizarFilmes(filmes, { acrescentar, comOndeAssistir = false }) {
  const grade = $("#grade");
  if (!acrescentar) grade.replaceChildren();
  grade.append(...filmes.map((filme) => criarCard(filme, comOndeAssistir)));

  const mensagem = $("#mensagem");
  mensagem.replaceChildren();
  mensagem.hidden = true;
}

// Mostra, esconde ou desativa o botão "Carregar mais".
// Com erro: true, o botão vira "Tentar de novo" (a grade continua na tela).
export function atualizarBotaoMais({ visivel, carregando, erro = false }) {
  const botao = $("#carregar-mais");
  botao.hidden = !visivel;
  botao.disabled = carregando;
  if (carregando) botao.textContent = "Carregando...";
  else botao.textContent = erro ? "Tentar de novo" : "Carregar mais";
}

// ---------------------------------------------------------------
// Estados da tela: carregando, vazio e erro
// ---------------------------------------------------------------

// Mostra uma mensagem no lugar da grade (e esconde o "Carregar mais").
function mostrarMensagem(...conteudo) {
  $("#grade").replaceChildren();
  const mensagem = $("#mensagem");
  mensagem.replaceChildren(...conteudo);
  mensagem.hidden = false;
  $("#carregar-mais").hidden = true;
}

// 12 cards cinza "piscando" enquanto a primeira página chega.
export function mostrarCarregando() {
  $("#mensagem").hidden = true;
  $("#grade").replaceChildren(
    ...Array.from({ length: 12 }, () => {
      const esqueleto = document.createElement("div");
      esqueleto.className = "skeleton";
      return esqueleto;
    })
  );
}

export function mostrarVazio(texto = "Nenhum filme encontrado para esses streamings.") {
  mostrarMensagem(texto);
}

// Erro de token: só a mensagem (tentar de novo não resolve).
// Outros erros: mensagem + botão "Tentar de novo".
export function mostrarErro(erro, aoTentarDeNovo) {
  if (erro.tipo === "auth") {
    mostrarMensagem("Token inválido ou ausente. Configure seu token em js/config.js (veja o README).");
    return;
  }
  const texto = document.createElement("p");
  texto.textContent = "Não foi possível carregar os filmes. Verifique sua conexão.";
  const botao = document.createElement("button");
  botao.textContent = "Tentar de novo";
  botao.onclick = aoTentarDeNovo;
  mostrarMensagem(texto, botao);
}
