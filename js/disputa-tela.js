// disputa-tela.js — dentro de cada grupo: o desafio da semana, o ranking
// do mês e a janela em que o campeão escolhe os filmes. Os pontos vêm
// prontos do Supabase (conta.disputaDoGrupo).
import { traduzirErro } from "./conta.js";
import {
  FILMES_POR_DESAFIO,
  sortearFilmes,
  nomeDoMes,
  textoDaSemana,
  situacaoDoDesafio,
  textoDosPontos,
  medalha,
} from "./disputa.js";

const $ = (seletor, dentro = document) => dentro.querySelector(seletor);
const URL_POSTER = "https://image.tmdb.org/t/p/w185";
const URL_POSTER_MINI = "https://image.tmdb.org/t/p/w92";

// A busca da janela de escolha espera a pessoa parar de digitar.
const ESPERA_DIGITACAO = 400;
const MIN_LETRAS = 2;

function el(tag, propriedades = {}, ...filhos) {
  const elemento = Object.assign(document.createElement(tag), propriedades);
  elemento.append(...filhos);
  return elemento;
}

const ano = (filme) => filme.release_date?.slice(0, 4) || "";

// conta: o objeto do conta.js.
// buscarCandidatos(vistos): filmes bem avaliados do catálogo, para o sorteio.
// buscarPorTitulo(texto): filmes cujo título combina (janela do campeão).
export function criarDisputa({ conta, buscarCandidatos, buscarPorTitulo }) {
  // A seção da disputa de um grupo (carrega sozinha).
  function secao(grupo) {
    const caixa = el("div", { className: "disputa" }, el("p", { className: "disputa-nota" }, "Carregando a disputa…"));
    carregar(grupo, caixa);
    return caixa;
  }

  async function carregar(grupo, caixa) {
    let disputa;
    try {
      disputa = await conta.disputaDoGrupo(grupo.id);
    } catch (e) {
      const tentar = el("button", { className: "botao-secundario", textContent: "Tentar de novo" });
      tentar.onclick = () => carregar(grupo, caixa);
      caixa.replaceChildren(el("p", { className: "disputa-nota" }, traduzirErro(e)), tentar);
      return;
    }

    // Ninguém abriu o grupo nesta semana ainda: quem abre faz o sorteio.
    let erroSorteio = null;
    if (situacaoDoDesafio(disputa) === "sortear") {
      try {
        const filmes = sortearFilmes(await buscarCandidatos(new Set(disputa.vistos)), new Set(disputa.vistos));
        if (filmes.length < FILMES_POR_DESAFIO) throw new Error("poucos filmes");
        await conta.definirDesafio(grupo.id, filmes);
        disputa = await conta.disputaDoGrupo(grupo.id); // com "quem viu"
      } catch {
        erroSorteio = "Não deu para sortear os filmes desta semana agora.";
      }
    }
    caixa.replaceChildren(...desenhar(grupo, disputa, erroSorteio, () => carregar(grupo, caixa)));
  }

  function desenhar(grupo, disputa, erroSorteio, recarregar) {
    const nomes = new Map(disputa.ranking.map((r) => [r.id, r.nome || "Sem nome"]));
    const mesPassado = nomeDoMes(disputa.mes_passado);
    const partes = [];

    if (disputa.campeao) {
      partes.push(
        el("p", { className: "disputa-campeao" }, `🏆 Campeão de ${mesPassado}: `, el("strong", {}, disputa.campeao.nome))
      );
    }

    // ---------- Desafio da semana ----------
    partes.push(
      el("h4", { className: "disputa-titulo" }, "Desafio da semana ", el("span", {}, textoDaSemana(disputa.semana)))
    );
    const situacao = situacaoDoDesafio(disputa);
    const campeaoDaSemana = nomes.get(disputa.escolhe) ?? "O campeão";

    if (situacao === "pronto") {
      const { filmes, escolhido_por: escolhidoPor, quem_viu: quemViu } = disputa.desafio;
      partes.push(
        el("p", { className: "disputa-nota" },
          escolhidoPor
            ? `Escolhidos por 🏆 ${nomes.get(escolhidoPor) ?? "o campeão"}. Cada filme visto nesta semana vale 3 pontos; quem não vir até domingo perde 1 (e o campeão ganha 2).`
            : "Sorteados pelo site. Cada filme visto nesta semana vale 3 pontos."
        ),
        el("div", { className: "desafio-filmes" },
          ...filmes.map((f) => cartaoDoFilme(f, quemViu?.[f.id] ?? [], disputa.eu, disputa.ranking.length))
        )
      );
    } else if (situacao === "escolher") {
      const escolher = el("button", { className: "botao-principal", textContent: "🏆 Escolher os filmes" });
      escolher.onclick = async () => {
        if (await escolherFilmes(grupo, new Set(disputa.vistos))) recarregar();
      };
      partes.push(
        el("p", { className: "disputa-nota" },
          `Você é o campeão de ${mesPassado}! Escolha os 3 filmes do desafio até terça. Quem não assistir até domingo perde 1 ponto, e você ganha 2.`
        ),
        escolher
      );
    } else if (situacao === "aguardando") {
      partes.push(
        el("p", { className: "disputa-nota" },
          `⏳ ${campeaoDaSemana} (campeão de ${mesPassado}) está escolhendo os filmes. Se não escolher até terça, o site sorteia.`
        )
      );
    } else {
      const tentar = el("button", { className: "botao-secundario", textContent: "Tentar de novo" });
      tentar.onclick = recarregar;
      partes.push(el("p", { className: "disputa-nota" }, erroSorteio ?? ""), tentar);
    }

    // ---------- Ranking do mês ----------
    partes.push(el("h4", { className: "disputa-titulo" }, `Ranking de ${nomeDoMes(disputa.mes)}`));
    partes.push(
      el("ol", { className: "ranking" },
        ...disputa.ranking.map((r, posicao) =>
          el("li", { className: r.id === disputa.eu ? "ranking-eu" : "" },
            el("span", { className: "ranking-posicao" }, medalha(posicao, r.pontos)),
            el("span", { className: "ranking-quem" },
              el("strong", {}, r.id === disputa.eu ? `${r.nome || "Sem nome"} (você)` : r.nome || "Sem nome"),
              el("small", {}, textoDosPontos(r))
            ),
            el("span", { className: "ranking-pontos" }, `${r.pontos} pts`)
          )
        )
      )
    );
    return partes;
  }

  // Um filme do desafio: pôster (abre a página do filme) e quem já viu.
  function cartaoDoFilme(filme, viram, eu, total) {
    const visto = viram.includes(eu);
    const poster = el("img", { src: URL_POSTER + filme.poster_path, alt: "", loading: "lazy" });
    return el("a", { className: `desafio-filme${visto ? " visto" : ""}`, href: `#/filme/${filme.id}` },
      poster,
      el("span", { className: "desafio-filme-titulo" }, filme.title),
      el("span", { className: "desafio-filme-quem" }, visto ? "✓ Você viu" : `${viram.length} de ${total} viram`)
    );
  }

  // ---------- Janela do campeão ----------

  const janela = $("#janela-escolha");
  const busca = $(".escolha-busca", janela);
  const resultados = $(".escolha-resultados", janela);
  const escolhidos = $(".escolha-escolhidos", janela);
  const confirmar = $(".escolha-confirmar", janela);
  const erro = $(".form-erro", janela);
  let escolha = []; // filmes escolhidos até agora
  let vistosDoGrupo = new Set();
  let grupoAtual = null;
  let terminar = () => {}; // resolve a promessa de escolherFilmes
  let temporizador;
  let ultimaBusca = 0;

  function mostrarErro(texto) {
    erro.textContent = texto;
    erro.hidden = !texto;
  }

  function desenharEscolha() {
    escolhidos.replaceChildren(
      ...Array.from({ length: FILMES_POR_DESAFIO }, (_, i) => {
        const filme = escolha[i];
        if (!filme) return el("div", { className: "escolha-vaga" }, `Filme ${i + 1}`);
        const tirar = el("button", { className: "escolha-tirar", textContent: "×" });
        tirar.setAttribute("aria-label", `Tirar ${filme.title}`);
        tirar.onclick = () => {
          escolha = escolha.filter((f) => f.id !== filme.id);
          desenharEscolha();
        };
        return el("div", { className: "escolha-vaga cheia" },
          el("img", { src: URL_POSTER_MINI + filme.poster_path, alt: "" }),
          el("span", {}, filme.title),
          tirar
        );
      })
    );
    confirmar.disabled = escolha.length !== FILMES_POR_DESAFIO;
  }

  async function buscar(texto) {
    const minhaBusca = ++ultimaBusca;
    if (texto.length < MIN_LETRAS) return resultados.replaceChildren();
    resultados.replaceChildren(el("p", { className: "disputa-nota" }, "Buscando…"));
    try {
      const filmes = (await buscarPorTitulo(texto)).filter((f) => f.poster_path);
      if (minhaBusca !== ultimaBusca) return;
      if (filmes.length === 0) {
        return resultados.replaceChildren(el("p", { className: "disputa-nota" }, "Nenhum filme encontrado."));
      }
      resultados.replaceChildren(
        ...filmes.map((filme) => {
          const botao = el("button", { className: "escolha-resultado", type: "button" },
            el("img", { src: URL_POSTER_MINI + filme.poster_path, alt: "", loading: "lazy" }),
            el("span", {}, el("strong", {}, filme.title), el("small", {}, ano(filme))),
            vistosDoGrupo.has(filme.id) ? el("em", {}, "alguém do grupo já viu") : ""
          );
          botao.onclick = () => {
            if (escolha.some((f) => f.id === filme.id) || escolha.length >= FILMES_POR_DESAFIO) return;
            escolha.push(filme);
            desenharEscolha();
          };
          return botao;
        })
      );
    } catch {
      if (minhaBusca === ultimaBusca) {
        resultados.replaceChildren(el("p", { className: "disputa-nota" }, "Não deu para buscar. Confira sua internet."));
      }
    }
  }

  // Abre a janela. Resolve true se os filmes foram gravados.
  function escolherFilmes(grupo, vistos) {
    grupoAtual = grupo;
    vistosDoGrupo = vistos;
    escolha = [];
    busca.value = "";
    resultados.replaceChildren();
    mostrarErro("");
    desenharEscolha();
    janela.showModal();
    return new Promise((resolver) => (terminar = resolver));
  }

  busca.addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => buscar(busca.value.trim()), ESPERA_DIGITACAO);
  });
  confirmar.onclick = async () => {
    confirmar.disabled = true;
    mostrarErro("");
    try {
      await conta.definirDesafio(grupoAtual.id, escolha);
      const fechar = terminar;
      terminar = () => {};
      janela.close();
      fechar(true);
    } catch (e) {
      mostrarErro(traduzirErro(e));
      confirmar.disabled = false;
    }
  };
  janela.addEventListener("close", () => {
    terminar(false);
    terminar = () => {};
  });
  for (const fechar of janela.querySelectorAll("[data-fechar]")) fechar.onclick = () => janela.close();

  return { secao };
}
