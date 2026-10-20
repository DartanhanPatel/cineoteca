// nuvem.js — leva as marcações do navegador para a conta (Supabase) e traz
// as da conta para o navegador. Não fala com o Supabase direto (isso é o
// conta.js) nem mexe na tela.
//
// Cada filme é uma linha da tabela "marcacoes". Desmarcar não apaga a
// linha: ela fica sem avaliação nem status, para outro computador saber
// que o filme foi desmarcado (e não que "ainda não chegou").

// Marcação do navegador → linha da tabela.
export function paraLinha(item) {
  const assistido = item.status === "assisti";
  return {
    filme_id: item.id,
    avaliacao: item.avaliacao ?? null,
    status: item.status ?? null,
    generos: item.generos ?? [],
    filme: item.filme ?? null,
    atualizado_em: item.quando ?? 0,
    // Marcações antigas não têm a data: vale a hora da última mudança.
    assistido_em: assistido ? new Date(item.assistidoEm ?? item.quando ?? 0).toISOString() : null,
  };
}

// Linha da tabela → marcação do navegador.
export function deLinha(linha) {
  return {
    id: linha.filme_id,
    avaliacao: linha.avaliacao,
    status: linha.status,
    generos: linha.generos ?? [],
    filme: linha.filme,
    quando: Number(linha.atualizado_em),
    assistidoEm: linha.assistido_em ? Date.parse(linha.assistido_em) : null,
  };
}

const temMarca = (f) => Boolean(f.avaliacao || f.status);

// Junta as marcações dos dois lados: em cada filme vale a mais recente.
// Devolve a lista final (só filmes marcados) e as do navegador que a conta
// ainda não tem.
export function mesclar(local, remoto) {
  const final = new Map(remoto.map((f) => [f.id, f]));
  const enviar = [];
  for (const f of local) {
    const daConta = final.get(f.id);
    if (!daConta || (f.quando ?? 0) > (daConta.quando ?? 0)) {
      final.set(f.id, f);
      enviar.push(f);
    }
  }
  return { lista: [...final.values()].filter(temMarca), enviar };
}

// Liga as marcações (assistidos.js) à conta (conta.js).
// Sem internet, as mudanças ficam esperando e sobem junto com a próxima.
// aoFalhar() é chamado quando uma marcação não conseguiu subir.
export function criarSincronia({ conta, assistidos, aoFalhar = () => {} }) {
  let ligada = false;
  const pendentes = new Map(); // ID do filme → marcação que ainda não subiu
  let envio = Promise.resolve();

  function enviarPendentes() {
    envio = envio.then(async () => {
      if (!ligada || pendentes.size === 0) return;
      const lote = [...pendentes.values()];
      try {
        await conta.salvarMarcacoes(lote.map(paraLinha));
        // Só tira da espera o que não mudou de novo enquanto subia.
        for (const f of lote) if (pendentes.get(f.id) === f) pendentes.delete(f.id);
      } catch {
        // Fica para a próxima marcação (ou quando a internet voltar).
        aoFalhar();
      }
    });
    return envio;
  }

  assistidos.aoAlterar((item) => {
    if (!ligada) return;
    pendentes.set(item.id, item);
    enviarPendentes();
  });

  return {
    // A conta abriu: junta os dois lados e sobe o que faltava na conta.
    async aoEntrar() {
      const remoto = (await conta.buscarMarcacoes()).map(deLinha);
      const { lista, enviar } = mesclar(assistidos.lista(), remoto);
      assistidos.substituir(lista);
      ligada = true;
      for (const f of enviar) pendentes.set(f.id, f);
      await enviarPendentes();
    },

    // A conta fechou: as marcações ficam só na conta. Mas se alguma não
    // chegou lá (a conta não respondeu ou faltou internet), elas ficam no
    // navegador, para não se perderem: sobem na próxima vez que entrar.
    aoSair() {
      const tudoNaConta = ligada && pendentes.size === 0;
      ligada = false;
      pendentes.clear();
      if (tudoNaConta) assistidos.esquecer();
    },

    // Tenta de novo o que ficou esperando (a internet voltou).
    tentarDeNovo: enviarPendentes,

    // Para os testes: espera os envios em andamento terminarem.
    pronto: () => envio,
  };
}
