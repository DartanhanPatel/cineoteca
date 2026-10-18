// ui.js — tudo que desenha na tela.
// Regra deste arquivo: nunca chama a internet (nada de `fetch` aqui).
// Regra de segurança: dados da TMDB entram na tela só com textContent ou
// atributos — nunca com innerHTML — para um título como "Tom & Jerry <O Filme>"
// aparecer literalmente, sem quebrar a página.

const URL_POSTER = "https://image.tmdb.org/t/p/w342";
const URL_LOGO = "https://image.tmdb.org/t/p/w92";

// Atalho para pegar elementos da página pelo seletor.
const $ = (seletor) => document.querySelector(seletor);

// "2024-05-01" → "2024". Sem data → "—".
export function formatarAno(dataLancamento) {
  return dataLancamento ? dataLancamento.slice(0, 4) : "—";
}

// 7.834 → "7.8". Sem votos (0 ou ausente) → "—".
export function formatarNota(nota) {
  return nota ? nota.toFixed(1) : "—";
}

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
function criarCard(filme) {
  const card = document.createElement("article");
  card.className = "card";

  if (filme.poster_path) {
    const poster = document.createElement("img");
    poster.className = "poster";
    poster.src = URL_POSTER + filme.poster_path;
    poster.alt = filme.title;
    poster.loading = "lazy";
    card.append(poster);
  } else {
    const semPoster = document.createElement("div");
    semPoster.className = "poster sem-poster";
    semPoster.textContent = filme.title;
    card.append(semPoster);
  }

  const titulo = document.createElement("h2");
  titulo.className = "titulo";
  titulo.textContent = filme.title;

  const info = document.createElement("p");
  info.className = "info";
  info.textContent = `${formatarAno(filme.release_date)} · ★ ${formatarNota(filme.vote_average)}`;

  card.append(titulo, info);
  return card;
}

// Desenha os filmes na grade. Com acrescentar: true, mantém os que já estão lá.
export function renderizarFilmes(filmes, { acrescentar }) {
  const grade = $("#grade");
  if (!acrescentar) grade.replaceChildren();
  grade.append(...filmes.map(criarCard));

  const mensagem = $("#mensagem");
  mensagem.replaceChildren();
  mensagem.hidden = true;
}

// Mostra, esconde ou desativa o botão "Carregar mais".
export function atualizarBotaoMais({ visivel, carregando }) {
  const botao = $("#carregar-mais");
  botao.hidden = !visivel;
  botao.disabled = carregando;
  botao.textContent = carregando ? "Carregando..." : "Carregar mais";
}
