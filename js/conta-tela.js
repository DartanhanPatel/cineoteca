// conta-tela.js — o botão da conta no cabeçalho e a janela de entrar,
// criar conta e "Sua conta". Quem fala com o Supabase é o conta.js.
import { traduzirErro } from "./conta.js";
import { formatarWhatsapp } from "./grupos.js";

const $ = (seletor, dentro = document) => dentro.querySelector(seletor);

const MIN_SENHA = 6;

// Primeiro nome (ou o começo do e-mail, se não houver nome).
function primeiroNome(usuario) {
  const nome = usuario.user_metadata?.nome?.trim() || usuario.email.split("@")[0];
  return nome.split(/\s+/)[0];
}

// conta: o objeto do conta.js.
export function configurarTelaConta(conta) {
  const botao = $("#botao-conta");
  const janela = $("#janela-conta");
  const form = $("#form-conta", janela);
  const erro = $(".form-erro", form);
  const enviar = $('button[type="submit"]', form);
  const caixaOfertas = $("#ofertas-conta", janela);
  const linhaWhatsapp = $(".conta-whatsapp", janela);
  const avisoConvite = $(".janela-convite", janela);
  let modo = "entrar"; // "entrar" ou "cadastrar"

  // Mostra uma das partes da janela: "fora", "confirmar" ou "dentro".
  function mostrarParte(nome) {
    for (const parte of janela.querySelectorAll("[data-parte]")) parte.hidden = parte.dataset.parte !== nome;
  }

  function trocarModo(novo) {
    modo = novo;
    for (const aba of janela.querySelectorAll("[data-modo]")) {
      aba.setAttribute("aria-selected", String(aba.dataset.modo === modo));
    }
    for (const campo of form.querySelectorAll("[data-so]")) campo.hidden = campo.dataset.so !== modo;
    form.senha.autocomplete = modo === "entrar" ? "current-password" : "new-password";
    enviar.textContent = modo === "entrar" ? "Entrar" : "Criar conta";
    mostrarErro("");
  }

  function mostrarErro(texto) {
    erro.textContent = texto;
    erro.hidden = !texto;
  }

  // O que falta preencher (ou "" se está tudo certo).
  function conferirCampos() {
    if (modo === "cadastrar" && !form.nome.value.trim()) return "Digite seu nome.";
    if (!form.email.value.trim()) return "Digite seu e-mail.";
    if (form.senha.value.length < MIN_SENHA) return `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`;
    return "";
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    const problema = conferirCampos();
    if (problema) return mostrarErro(problema);

    const email = form.email.value.trim();
    enviar.disabled = true;
    mostrarErro("");
    try {
      if (modo === "entrar") {
        await conta.entrar(email, form.senha.value);
        janela.close();
      } else {
        const entrou = await conta.cadastrar({
          nome: form.nome.value.trim(),
          email,
          senha: form.senha.value,
          aceitaOfertas: form.ofertas.checked,
        });
        if (entrou) {
          janela.close();
        } else {
          $("[data-campo='email-confirmar']", janela).textContent = email;
          mostrarParte("confirmar");
        }
      }
      form.reset();
    } catch (e) {
      mostrarErro(traduzirErro(e));
    } finally {
      enviar.disabled = false;
    }
  }

  // Abre a janela: com a conta aberta, mostra "Sua conta".
  // convite: texto sobre o grupo, para quem chegou por um link de convite.
  async function abrir({ convite = "" } = {}) {
    const usuario = conta.usuario();
    if (usuario) {
      $("[data-campo='nome']", janela).textContent = primeiroNome(usuario);
      $("[data-campo='email']", janela).textContent = usuario.email;
      caixaOfertas.disabled = true;
      linhaWhatsapp.hidden = true;
      mostrarParte("dentro");
      if (!janela.open) janela.showModal();
      try {
        const perfil = await conta.perfil();
        caixaOfertas.checked = perfil.aceita_ofertas;
        caixaOfertas.disabled = false;
        if (perfil.whatsapp) {
          $("[data-campo='whatsapp']", janela).textContent = formatarWhatsapp(perfil.whatsapp);
          linhaWhatsapp.hidden = false;
        }
      } catch {
        // Sem o perfil (sem internet): a caixa fica desligada.
      }
    } else {
      avisoConvite.textContent = convite;
      avisoConvite.hidden = !convite;
      trocarModo(convite ? "cadastrar" : modo);
      mostrarParte("fora");
      if (!janela.open) janela.showModal();
    }
  }

  // Tira o WhatsApp da conta (e os aceites dele).
  async function aoRemoverWhatsapp() {
    if (!confirm("Remover seu WhatsApp? Você deixa de receber os avisos e ofertas por lá.")) return;
    try {
      await conta.definirWhatsapp(null);
      linhaWhatsapp.hidden = true;
    } catch (e) {
      alert(traduzirErro(e));
    }
  }

  async function aoMudarOfertas() {
    const aceita = caixaOfertas.checked;
    caixaOfertas.disabled = true;
    try {
      await conta.definirOfertas(aceita);
    } catch {
      caixaOfertas.checked = !aceita; // não salvou: volta como estava
    } finally {
      caixaOfertas.disabled = false;
    }
  }

  async function aoSair() {
    try {
      await conta.sair();
      janela.close();
    } catch (e) {
      alert(traduzirErro(e));
    }
  }

  botao.hidden = false;
  botao.onclick = () => abrir();
  $("#remover-whatsapp", janela).onclick = aoRemoverWhatsapp;
  form.addEventListener("submit", aoEnviar);
  for (const aba of janela.querySelectorAll("[data-modo]")) aba.onclick = () => trocarModo(aba.dataset.modo);
  for (const fechar of janela.querySelectorAll("[data-fechar]")) fechar.onclick = () => janela.close();
  // Clicar no fundo escuro, fora da janela, fecha.
  janela.addEventListener("click", (e) => {
    if (e.target === janela) janela.close();
  });
  caixaOfertas.onchange = aoMudarOfertas;
  $("#sair-conta", janela).onclick = aoSair;

  return {
    abrir,

    // Atualiza o botão do cabeçalho (usuario = null: ninguém dentro).
    atualizar(usuario) {
      botao.replaceChildren();
      if (usuario) {
        const nome = primeiroNome(usuario);
        const inicial = document.createElement("span");
        inicial.className = "botao-conta-inicial";
        inicial.textContent = nome[0].toUpperCase();
        const texto = document.createElement("span");
        texto.className = "botao-conta-nome";
        texto.textContent = nome;
        botao.append(inicial, texto);
        botao.setAttribute("aria-label", `Sua conta (${nome})`);
      } else {
        botao.textContent = "Entrar";
        botao.removeAttribute("aria-label");
      }
    },
  };
}
