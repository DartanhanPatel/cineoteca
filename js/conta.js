// conta.js — conversa com o Supabase: criar conta, entrar, sair, o perfil,
// as marcações guardadas na conta e os grupos. Não mexe na tela.
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
  [/convite inválido/i, "Esse convite não vale mais. Peça um link novo a quem convidou."],
  [/whatsapp_check/i, "Esse número de WhatsApp não parece válido."],
  // Tabela ou função que não existe: falta rodar um arquivo da pasta supabase/.
  [/schema cache/i, "O banco de dados ainda não foi preparado para esta parte do site (falta rodar o SQL no Supabase)."],
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
        await supabase
          .from("perfis")
          .select("nome, email, aceita_ofertas, whatsapp, ofertas_whatsapp")
          .eq("id", usuario.id)
          .single()
      );
    },

    async definirOfertas(aceita) {
      conferir(await supabase.from("perfis").update({ aceita_ofertas: aceita }).eq("id", usuario.id));
    },

    // numero: "+55..." ou null (para remover o WhatsApp e os aceites dele).
    async definirWhatsapp(numero, ofertas = false) {
      conferir(
        await supabase
          .from("perfis")
          .update({ whatsapp: numero, ofertas_whatsapp: Boolean(numero) && ofertas })
          .eq("id", usuario.id)
      );
    },

    async buscarMarcacoes() {
      return conferir(await supabase.from("marcacoes").select("*"));
    },

    async salvarMarcacoes(linhas) {
      const comDono = linhas.map((linha) => ({ ...linha, user_id: usuario.id }));
      conferir(await supabase.from("marcacoes").upsert(comDono, { onConflict: "user_id,filme_id" }));
    },

    // [{ id, nome, codigo, membros: [{ id, nome }] }]
    async meusGrupos() {
      return conferir(await supabase.rpc("meus_grupos"));
    },

    // → { id, nome, codigo }
    async criarGrupo(nome) {
      return conferir(await supabase.rpc("criar_grupo", { nome_grupo: nome }));
    },

    // → { id, nome }
    async entrarNoGrupo(codigo) {
      return conferir(await supabase.rpc("entrar_no_grupo", { codigo_convite: codigo }));
    },

    async sairDoGrupo(idGrupo) {
      conferir(await supabase.rpc("sair_do_grupo", { id_grupo: idGrupo }));
    },

    // Funciona sem conta. → { nome, membros } ou null (convite inválido).
    async verConvite(codigo) {
      return conferir(await supabase.rpc("ver_convite", { codigo_convite: codigo }));
    },
  };
}
