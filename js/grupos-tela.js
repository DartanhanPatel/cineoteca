// grupos-tela.js — a aba "Grupos" (criar, convidar, sair) e a janela que
// pede o WhatsApp. Quem fala com o Supabase é o conta.js.
import { traduzirErro } from "./conta.js";
import {
  MAX_NOME_GRUPO,
  conferirNomeDoGrupo,
  linkDeConvite,
  mensagemDeConvite,
  linkDoWhatsapp,
  normalizarWhatsapp,
} from "./grupos.js";

const $ = (seletor, dentro = document) => dentro.querySelector(seletor);

// Cria um elemento: el("p", { className: "x" }, "texto", outroElemento).
function el(tag, propriedades = {}, ...filhos) {
  const elemento = Object.assign(document.createElement(tag), propriedades);
  elemento.append(...filhos);
  return elemento;
}

// Quanto tempo o "Link copiado!" fica no botão.
const TEMPO_COPIADO = 2000;

// Para não perguntar o WhatsApp de novo a quem disse "Agora não".
const CHAVE_PERGUNTOU = "catalogo-filmes:whatsapp-perguntado:";

// conta: o objeto do conta.js. abrirConta(): abre a janela de entrar.
// disputa: o objeto do disputa-tela.js (ranking e desafio de cada grupo).
export function criarTelaGrupos(conta, { abrirConta, disputa }) {
  const area = $("#grupos");
  const janelaWhatsapp = $("#janela-whatsapp");
  const formWhatsapp = $("#form-whatsapp");
  let aberta = false;
  let pedido = 0; // descarta respostas de aberturas antigas

  // Mostra a área dos grupos no lugar da grade de filmes.
  function mostrarArea(visivel) {
    aberta = visivel;
    area.hidden = !visivel;
    $("#grade").hidden = visivel;
    if (visivel) {
      $("#mensagem").hidden = true;
      $("#carregar-mais").hidden = true;
    }
  }

  async function abrir() {
    const meuPedido = ++pedido;
    mostrarArea(true);
    if (!conta.usuario()) {
      const entrar = el("button", { className: "botao-principal", textContent: "Entrar ou criar conta" });
      entrar.onclick = abrirConta;
      area.replaceChildren(
        el("div", { className: "grupos-vazio" },
          el("p", {}, "Entre na sua conta para criar grupos e disputar com os amigos."),
          entrar
        )
      );
      return;
    }
    area.replaceChildren(el("p", { className: "grupos-carregando" }, "Carregando seus grupos…"));
    try {
      const grupos = await conta.meusGrupos();
      if (meuPedido !== pedido || !aberta) return;
      desenhar(grupos);
    } catch (e) {
      if (meuPedido !== pedido || !aberta) return;
      const tentar = el("button", { textContent: "Tentar de novo" });
      tentar.onclick = abrir;
      area.replaceChildren(el("div", { className: "grupos-vazio" }, el("p", {}, traduzirErro(e)), tentar));
    }
  }

  function desenhar(grupos) {
    area.replaceChildren(
      el("div", { className: "grupos-topo" }, el("h2", { className: "grupos-titulo" }, "Meus grupos"), formNovoGrupo()),
      grupos.length === 0
        ? el("p", { className: "grupos-vazio" }, "Você ainda não tem grupos. Crie um e convide seus amigos para a disputa!")
        : el("div", { className: "grupos-lista" }, ...grupos.map(cartaoDoGrupo))
    );
  }

  function formNovoGrupo() {
    const campo = el("input", {
      name: "nome",
      placeholder: "Nome do novo grupo",
      maxLength: MAX_NOME_GRUPO,
      autocomplete: "off",
    });
    campo.setAttribute("aria-label", "Nome do novo grupo");
    const botao = el("button", { className: "botao-principal", type: "submit", textContent: "Criar grupo" });
    const erro = el("p", { className: "form-erro", hidden: true });
    erro.setAttribute("role", "alert");
    const form = el("form", { className: "grupos-novo", noValidate: true }, campo, botao, erro);

    form.onsubmit = async (evento) => {
      evento.preventDefault();
      const problema = conferirNomeDoGrupo(campo.value);
      erro.textContent = problema;
      erro.hidden = !problema;
      if (problema) return;
      botao.disabled = true;
      try {
        await conta.criarGrupo(campo.value.trim());
        await abrir();
        perguntarWhatsapp();
      } catch (e) {
        erro.textContent = traduzirErro(e);
        erro.hidden = false;
        botao.disabled = false;
      }
    };
    return form;
  }

  function cartaoDoGrupo(grupo) {
    const meuId = conta.usuario()?.id;
    const membros = grupo.membros ?? [];
    const link = linkDeConvite(location, grupo.codigo);

    const whatsapp = el("a", {
      className: "botao-whatsapp",
      href: linkDoWhatsapp(mensagemDeConvite(grupo.nome, link)),
      target: "_blank",
      rel: "noopener",
      textContent: "Convidar pelo WhatsApp",
    });

    const copiar = el("button", { className: "botao-secundario", textContent: "Copiar link" });
    copiar.onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
        copiar.textContent = "Link copiado!";
        setTimeout(() => (copiar.textContent = "Copiar link"), TEMPO_COPIADO);
      } catch {
        prompt("Copie o link do convite:", link); // navegador sem acesso à área de transferência
      }
    };

    const sair = el("button", { className: "grupo-sair", textContent: "Sair do grupo" });
    sair.onclick = async () => {
      const ultimo = membros.length <= 1 ? " Você é o último: o grupo será apagado." : "";
      if (!confirm(`Sair do grupo "${grupo.nome}"?${ultimo}`)) return;
      try {
        await conta.sairDoGrupo(grupo.id);
        abrir();
      } catch (e) {
        alert(traduzirErro(e));
      }
    };

    const quantos = membros.length === 1 ? "1 participante" : `${membros.length} participantes`;
    return el("article", { className: "grupo" },
      el("header", { className: "grupo-cabecalho" },
        el("h3", { className: "grupo-nome" }, grupo.nome),
        el("span", { className: "grupo-qtd" }, quantos)
      ),
      el("ul", { className: "grupo-membros" },
        ...membros.map((m) => {
          const nome = m.nome || "Sem nome";
          return el("li", {},
            el("span", { className: "grupo-inicial" }, nome[0].toUpperCase()),
            m.id === meuId ? `${nome} (você)` : nome
          );
        })
      ),
      disputa.secao(grupo),
      el("div", { className: "grupo-acoes" }, whatsapp, copiar, sair)
    );
  }

  // ---------- WhatsApp ----------

  const chavePerguntou = () => CHAVE_PERGUNTOU + conta.usuario()?.id;

  function jaPerguntou() {
    try {
      return Boolean(localStorage.getItem(chavePerguntou()));
    } catch {
      return false;
    }
  }

  function lembrarQuePerguntou() {
    try {
      localStorage.setItem(chavePerguntou(), "1");
    } catch {
      // Sem onde guardar: pode perguntar de novo outro dia.
    }
  }

  // Pede o WhatsApp (uma vez só), a quem ainda não deu o número.
  async function perguntarWhatsapp() {
    if (!conta.usuario() || jaPerguntou() || janelaWhatsapp.open) return;
    try {
      if ((await conta.perfil()).whatsapp) return;
    } catch {
      return; // sem internet: pergunta outra hora
    }
    formWhatsapp.reset();
    mostrarErroWhatsapp("");
    janelaWhatsapp.showModal();
  }

  function mostrarErroWhatsapp(texto) {
    const erro = $(".form-erro", formWhatsapp);
    erro.textContent = texto;
    erro.hidden = !texto;
  }

  formWhatsapp.onsubmit = async (evento) => {
    evento.preventDefault();
    const numero = normalizarWhatsapp(formWhatsapp.numero.value);
    if (!numero) return mostrarErroWhatsapp("Digite o número com DDD, por exemplo (11) 98765-4321.");
    const enviar = $('button[type="submit"]', formWhatsapp);
    enviar.disabled = true;
    try {
      await conta.definirWhatsapp(numero, formWhatsapp.ofertas.checked);
      janelaWhatsapp.close();
    } catch (e) {
      mostrarErroWhatsapp(traduzirErro(e));
    } finally {
      enviar.disabled = false;
    }
  };
  // Fechou de qualquer jeito ("Agora não", ×, Esc ou depois de salvar).
  janelaWhatsapp.addEventListener("close", lembrarQuePerguntou);
  for (const fechar of janelaWhatsapp.querySelectorAll("[data-fechar]")) fechar.onclick = () => janelaWhatsapp.close();
  janelaWhatsapp.addEventListener("click", (e) => {
    if (e.target === janelaWhatsapp) janelaWhatsapp.close();
  });

  return {
    abrir,
    fechar: () => mostrarArea(false),
    perguntarWhatsapp,
  };
}
