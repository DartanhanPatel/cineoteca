// disputa.js — regras da tela da disputa que não dependem da tela nem do
// Supabase. Os pontos em si são calculados no Supabase (03-disputa.sql).

export const FILMES_POR_DESAFIO = 3;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const abreviar = (mes) => `${MESES[mes].slice(0, 3)}.`;

// "2026-10-05" → { ano, mes (0 a 11), dia }, sem passar por fuso horário.
function lerData(texto) {
  const [ano, mes, dia] = texto.split("-").map(Number);
  return { ano, mes: mes - 1, dia };
}

// Escolhe ao acaso 3 filmes com pôster que ninguém do grupo viu.
// aleatorio() devolve um número entre 0 e 1 (Math.random; nos testes, falso).
export function sortearFilmes(candidatos, vistos, aleatorio = Math.random) {
  const ids = new Set();
  const livres = candidatos.filter((f) => {
    if (!f.poster_path || vistos.has(f.id) || ids.has(f.id)) return false;
    ids.add(f.id);
    return true;
  });
  const escolhidos = [];
  while (escolhidos.length < FILMES_POR_DESAFIO && livres.length > 0) {
    const [filme] = livres.splice(Math.floor(aleatorio() * livres.length), 1);
    escolhidos.push(filme);
  }
  return escolhidos;
}

export function nomeDoMes(data) {
  return MESES[lerData(data).mes];
}

// "2026-10-12" (segunda) → "12 a 18 de out.".
export function textoDaSemana(segunda) {
  const { ano, mes, dia } = lerData(segunda);
  const domingo = new Date(Date.UTC(ano, mes, dia + 6));
  const mesFim = domingo.getUTCMonth();
  const fim = `${domingo.getUTCDate()} de ${abreviar(mesFim)}`;
  return mesFim === mes ? `${dia} a ${fim}` : `${dia} de ${abreviar(mes)} a ${fim}`;
}

// O que mostrar no desafio da semana:
// "pronto" (já tem filmes), "escolher" (sou o campeão e posso escolher),
// "aguardando" (o campeão ainda pode escolher) ou "sortear".
export function situacaoDoDesafio(disputa) {
  if (disputa.desafio) return "pronto";
  if (disputa.escolhe && disputa.hoje <= disputa.prazo_campeao) {
    return disputa.escolhe === disputa.eu ? "escolher" : "aguardando";
  }
  return "sortear";
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// De onde vieram os pontos de alguém no ranking.
export function textoDosPontos({ assistidos, desafios, faltas, bonus_campeao }) {
  const partes = [];
  if (assistidos) partes.push(plural(assistidos, "filme", "filmes"));
  if (desafios) partes.push(`${desafios} do desafio`);
  if (faltas) partes.push(plural(faltas, "falta", "faltas"));
  if (bonus_campeao) partes.push(`${bonus_campeao} bônus de campeão`);
  return partes.join(" · ") || "nenhum filme ainda";
}

// Posição no ranking (0 = 1º): medalha para os 3 primeiros que pontuaram.
export function medalha(posicao, pontos) {
  if (pontos > 0 && posicao < 3) return ["🥇", "🥈", "🥉"][posicao];
  return `${posicao + 1}º`;
}
