// conta.js — conversa com o Supabase: criar conta, entrar, sair, o perfil
// e as marcações guardadas na conta. Não mexe na tela.
//
// O Supabase guarda a sessão no navegador: quem entrou uma vez continua
// dentro ao voltar ao site.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

// Mensagens do Supabase (em inglês) → texto para a pessoa.
const ERROS = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/already registered|already been registered/i, "Esse e-mail já tem uma conta. Use \"Entrar\"."],
  [/email not confirmed/i, "Confirme seu e-mail primeiro (veja a caixa de entrada)."],
  [/password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/valid email|invalid format/i, "Esse e-mail não parece válido."],
  [/rate limit|too many/i, "Muitas tentativas seguidas. Espere alguns minutos e tente de novo."],
  [/fetch|network/i, "Sem conexão com o servidor. Confira sua internet."],
];

export function traduzirErro(erro) {
  const texto = erro?.message ?? String(erro);
  return ERROS.find(([padrao]) => padrao.test(texto))?.[1] ?? "Algo deu errado. Tente de novo.";
}

// Lança o erro do Supabase (se houver) e devolve os dados.
function conferir({ data, error }) {
  if (error) throw error;
  return data;
}

export function criarConta({ url, chave }) {
  const supabase = createClient(url, chave);
  let usuario = null;

  return {
    usuario: () => usuario,

    // aoMudar(usuario ou null): ao abrir o site e a cada entrar/sair.
    aoMudarSessao(aoMudar) {
      supabase.auth.onAuthStateChange((evento, sessao) => {
        const novo = sessao?.user ?? null;
        if (evento !== "INITIAL_SESSION" && novo?.id === usuario?.id) return; // só renovou a sessão
        usuario = novo;
        // Fora do aviso do Supabase: ele trava se pedirmos dados lá dentro.
        setTimeout(() => aoMudar(usuario), 0);
      });
    },

    // Devolve true se já entrou; false se falta confirmar o e-mail.
    async cadastrar({ nome, email, senha, aceitaOfertas }) {
      const dados = conferir(
        await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome, aceita_ofertas: aceitaOfertas } },
        })
      );
      // E-mail que já tem conta: por segurança, o Supabase "finge" que deu certo.
      if (dados.user && dados.user.identities?.length === 0) throw new Error("already registered");
      return Boolean(dados.session);
    },

    async entrar(email, senha) {
      conferir(await supabase.auth.signInWithPassword({ email, password: senha }));
    },

    async sair() {
      conferir(await supabase.auth.signOut());
    },

    async perfil() {
      return conferir(
        await supabase.from("perfis").select("nome, email, aceita_ofertas").eq("id", usuario.id).single()
      );
    },

    async definirOfertas(aceita) {
      conferir(await supabase.from("perfis").update({ aceita_ofertas: aceita }).eq("id", usuario.id));
    },

    async buscarMarcacoes() {
      return conferir(await supabase.from("marcacoes").select("*"));
    },

    async salvarMarcacoes(linhas) {
      const comDono = linhas.map((linha) => ({ ...linha, user_id: usuario.id }));
      conferir(await supabase.from("marcacoes").upsert(comDono, { onConflict: "user_id,filme_id" }));
    },
  };
}
