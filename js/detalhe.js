// detalhe.js — desenha a página de um filme (trailer, ficha, onde assistir
// e elenco). Como o ui.js: nunca chama a internet e só usa textContent.
import {
  formatarAno,
  formatarNota,
  formatarDuracao,
  criarLinhaInfo,
  criarBotoesAvaliacao,
  criarBotoesStatus,
  definirAmbiente,
  TITULO_LONGO,
} from "./ui.js";

const URL_FUNDO = "https://image.tmdb.org/t/p/w1280";
const URL_POSTER = "https://image.tmdb.org/t/p/w500";
const URL_FOTO = "https://image.tmdb.org/t/p/w185";
const URL_LOGO = "https://image.tmdb.org/t/p/w92";

const TITULO_SITE = document.title;
const $ = (seletor) => document.querySelector(seletor);

// Quem pediu menos movimento no sistema não recebe trailer automático.
const menosMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto) elemento.textContent = texto;
  return elemento;
}

// ---------------------------------------------------------------
// Abrir e fechar
// ---------------------------------------------------------------

// Elemento que tinha o foco antes de abrir (para devolver ao fechar).
let focoAnterior = null;
// Desliga o "ouvido" do trailer anterior (ao fechar ou trocar de filme).
let pararTrailer = () => {};

function abrirPainel(aoFechar) {
  pararTrailer();
  const painel = $("#detalhe");
  if (painel.hidden) focoAnterior = document.activeElement;
  painel.hidden = false;
  painel.scrollTop = 0;
  document.body.classList.add("com-detalhe");
  painel.onkeydown = (evento) => {
    if (evento.key === "Escape") aoFechar();
  };
  return painel;
}

function botaoVoltar(aoFechar) {
  const voltar = criar("button", "voltar", "← Voltar");
  voltar.onclick = aoFechar;
  return voltar;
}

export function fecharDetalhe() {
  const painel = $("#detalhe");
  if (painel.hidden) return;
  pararTrailer();
  painel.hidden = true;
  painel.replaceChildren(); // tirar o iframe da tela para o trailer
  document.body.classList.remove("com-detalhe");
  document.title = TITULO_SITE;
  focoAnterior?.focus?.();
}

export function mostrarDetalheCarregando(aoFechar) {
  const painel = abrirPainel(aoFechar);
  const palco = criar("div", "palco carregando");
  painel.replaceChildren(botaoVoltar(aoFechar), palco);
  painel.querySelector(".voltar").focus();
}

export function mostrarErroDetalhe(erro, aoFechar, aoTentarDeNovo) {
  const painel = abrirPainel(aoFechar);
  const caixa = criar("div", "detalhe-erro");
  const texto = criar(
    "p",
    "",
    erro.tipo === "auth"
      ? "Token inválido ou ausente. Configure seu token em js/config.js (veja o README)."
      : "Não foi possível abrir este filme. Verifique sua conexão."
  );
  caixa.append(texto);
  if (erro.tipo !== "auth") {
    const botao = criar("button", "botao-claro", "Tentar de novo");
    botao.onclick = aoTentarDeNovo;
    caixa.append(botao);
  }
  painel.replaceChildren(botaoVoltar(aoFechar), caixa);
  painel.querySelector(".voltar").focus();
}

// ---------------------------------------------------------------
// Palco: o trailer (ou a imagem de fundo) no topo
// ---------------------------------------------------------------

// Manda um comando para o player do YouTube (mudo, com som...).
function comandoYouTube(iframe, func) {
  iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

function criarPalco(filme) {
  const palco = criar("div", "palco");
  const fundo = criar("img", "palco-fundo");
  fundo.alt = "";
  if (filme.backdrop_path) fundo.src = URL_FUNDO + filme.backdrop_path;
  palco.append(fundo);
  if (!filme.trailer) return palco;

  const controles = criar("div", "palco-controles");
  palco.append(controles);

  // Com menos movimento: nada toca sozinho, só um botão para ver o trailer.
  if (menosMovimento()) {
    const ver = criar("button", "botao-vidro", "▶ Ver trailer");
    ver.onclick = () => {
      ver.remove();
      tocarTrailer(palco, controles, filme.trailer, { comSom: true });
    };
    controles.append(ver);
  } else {
    tocarTrailer(palco, controles, filme.trailer, { comSom: false });
  }
  return palco;
}

// O trailer começa mudo e escondido; só aparece quando o YouTube avisa que
// está tocando. Se o vídeo não puder ser exibido aqui, a imagem continua.
function tocarTrailer(palco, controles, chave, { comSom }) {
  const parametros = new URLSearchParams({
    autoplay: "1",
    mute: comSom ? "0" : "1",
    controls: comSom ? "1" : "0",
    loop: "1",
    playlist: chave, // necessário para o loop funcionar
    playsinline: "1",
    rel: "0",
    iv_load_policy: "3",
    enablejsapi: "1",
    origin: location.origin,
  });
  const iframe = criar("iframe", "palco-trailer");
  iframe.src = `https://www.youtube-nocookie.com/embed/${chave}?${parametros}`;
  iframe.title = "Trailer";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.tabIndex = comSom ? 0 : -1;
  if (comSom) iframe.classList.add("com-controles");

  const som = criar("button", "botao-vidro", "Ativar som");
  som.hidden = true;
  let mudo = !comSom;
  som.onclick = () => {
    mudo = !mudo;
    comandoYouTube(iframe, mudo ? "mute" : "unMute");
    som.textContent = mudo ? "Ativar som" : "Desativar som";
    som.setAttribute("aria-pressed", String(!mudo));
  };
  if (!comSom) controles.append(som);

  // Conversa com o player: pedimos para ele mandar notícias.
  const ouvir = (evento) => {
    if (evento.source !== iframe.contentWindow) return;
    let dados;
    try {
      dados = JSON.parse(evento.data);
    } catch {
      return;
    }
    const tocando = dados.event === "onStateChange" ? dados.info === 1 : dados.info?.playerState === 1;
    if (tocando) {
      iframe.classList.add("tocando");
      som.hidden = false;
    }
    if (dados.event === "onError") {
      iframe.remove();
      som.remove();
    }
  };
  window.addEventListener("message", ouvir);
  pararTrailer = () => window.removeEventListener("message", ouvir);
  iframe.onload = () => {
    iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
  };

  palco.insertBefore(iframe, controles);
}

// ---------------------------------------------------------------
// Ficha: pôster, título, informações, sinopse e ações
// ---------------------------------------------------------------

// Cores da classificação indicativa brasileira (ClassInd).
const CLASSIFICACAO = {
  L: { texto: "Livre", classe: "ci-l" },
  10: { texto: "10", classe: "ci-10" },
  12: { texto: "12", classe: "ci-12" },
  14: { texto: "14", classe: "ci-14" },
  16: { texto: "16", classe: "ci-16" },
  18: { texto: "18", classe: "ci-18" },
};

function criarBotaoAssistir(onde) {
  const principal = onde.assinatura[0];
  if (!onde.link || (!principal && onde.aluguel.length === 0 && onde.compra.length === 0)) {
    const indisponivel = criar("span", "assistir indisponivel", "Fora do streaming no Brasil");
    return indisponivel;
  }
  const assistir = criar("a", "assistir");
  assistir.href = onde.link;
  assistir.target = "_blank";
  assistir.rel = "noopener";
  assistir.textContent = principal ? `▶ Assistir na ${principal.provider_name}` : "Alugar ou comprar";
  return assistir;
}

function criarFicha(filme) {
  const ficha = criar("div", "ficha");

  if (filme.poster_path) {
    const poster = criar("img", "ficha-poster");
    poster.src = URL_POSTER + filme.poster_path;
    poster.alt = `Pôster de ${filme.title}`;
    ficha.append(poster);
  }

  const texto = criar("div", "ficha-texto");
  const titulo = criar("h1", "ficha-titulo", filme.title);
  titulo.id = "detalhe-titulo";
  titulo.classList.toggle("longo", filme.title.length > TITULO_LONGO);
  texto.append(titulo);
  if (filme.tagline) texto.append(criar("p", "ficha-tagline", filme.tagline));

  const ci = CLASSIFICACAO[filme.classificacao];
  const meta = criarLinhaInfo("ficha-meta", [
    { texto: formatarAno(filme.release_date) },
    { texto: formatarDuracao(filme.duracao) },
    { texto: filme.generos.join(", ") },
    { texto: `★ ${formatarNota(filme.vote_average)}`, classe: "nota" },
  ]);
  if (ci) {
    const selo = criar("span", `classificacao ${ci.classe}`, ci.texto);
    selo.title = ci.texto === "Livre" ? "Classificação livre" : `Não recomendado para menores de ${ci.texto} anos`;
    meta.prepend(selo);
  }
  texto.append(meta);

  texto.append(criar("p", "ficha-sinopse", filme.overview || "Sinopse indisponível em português."));

  const acoes = criar("div", "ficha-acoes");
  const opiniao = criar("div", "ficha-opiniao");
  opiniao.append(...criarBotoesAvaliacao(filme));
  acoes.append(criarBotaoAssistir(filme.ondeAssistir), criarBotoesStatus(filme, "ficha-status"), opiniao);
  texto.append(acoes);

  if (filme.direcao.length > 0) {
    const nomes = filme.direcao.length > 1
      ? `${filme.direcao.slice(0, -1).join(", ")} e ${filme.direcao.at(-1)}`
      : filme.direcao[0];
    texto.append(criar("p", "ficha-direcao", `Direção de ${nomes}`));
  }

  ficha.append(texto);
  return ficha;
}

// ---------------------------------------------------------------
// Onde assistir e elenco
// ---------------------------------------------------------------

function criarOndeAssistir(onde) {
  const grupos = [
    ["Na assinatura", onde.assinatura],
    ["Para alugar", onde.aluguel],
    ["Para comprar", onde.compra],
  ].filter(([, lista]) => lista.length > 0);
  if (grupos.length === 0) return null;

  const secao = criar("section", "secao onde");
  secao.append(criar("h2", "secao-titulo", "Onde assistir"));
  const linhas = criar("div", "onde-grupos");
  for (const [nome, lista] of grupos) {
    const grupo = criar("div", "onde-grupo");
    grupo.append(criar("h3", "", nome));
    const logos = criar("div", "onde-logos");
    for (const provedor of lista) {
      const link = criar("a", "onde-logo");
      link.href = onde.link;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = provedor.provider_name;
      const logo = criar("img");
      logo.src = URL_LOGO + provedor.logo_path;
      logo.alt = provedor.provider_name;
      link.append(logo);
      logos.append(link);
    }
    grupo.append(logos);
    linhas.append(grupo);
  }
  secao.append(linhas);
  secao.append(criar("p", "onde-fonte", "Os links abrem a página do filme na TMDB, com dados da JustWatch."));
  return secao;
}

function criarElenco(elenco) {
  if (elenco.length === 0) return null;
  const secao = criar("section", "secao elenco");
  secao.append(criar("h2", "secao-titulo", "Elenco"));
  const lista = criar("ul", "elenco-lista");
  for (const pessoa of elenco) {
    const item = criar("li", "pessoa");
    if (pessoa.foto) {
      const foto = criar("img", "pessoa-foto");
      foto.src = URL_FOTO + pessoa.foto;
      foto.alt = "";
      foto.loading = "lazy";
      item.append(foto);
    } else {
      // Sem foto: as iniciais do nome.
      const iniciais = pessoa.nome.split(" ").map((p) => p[0]).slice(0, 2).join("");
      item.append(criar("span", "pessoa-foto sem-foto", iniciais));
    }
    item.append(criar("strong", "pessoa-nome", pessoa.nome));
    if (pessoa.personagem) item.append(criar("span", "pessoa-papel", pessoa.personagem));
    lista.append(item);
  }
  secao.append(lista);
  return secao;
}

// ---------------------------------------------------------------
// Página inteira
// ---------------------------------------------------------------

export function renderizarDetalhe(filme, aoFechar) {
  const painel = abrirPainel(aoFechar);
  const ambiente = criar("div", "ambiente");
  ambiente.setAttribute("aria-hidden", "true");

  const conteudo = criar("div", "detalhe-conteudo");
  conteudo.append(
    ...[criarFicha(filme), criarOndeAssistir(filme.ondeAssistir), criarElenco(filme.elenco)].filter(Boolean)
  );

  painel.replaceChildren(ambiente, botaoVoltar(aoFechar), criarPalco(filme), conteudo);
  definirAmbiente(filme.backdrop_path || filme.poster_path, ambiente);
  document.title = `${filme.title} | ${TITULO_SITE}`;
  painel.querySelector(".voltar").focus();
}
