// grupos.js — as regras dos grupos que não dependem da tela nem do
// Supabase: convite (link e mensagem) e o número de WhatsApp.

export const MAX_NOME_GRUPO = 40;

// Celular ou fixo brasileiro com DDD → "+55DDNÚMERO". Inválido → null.
export function normalizarWhatsapp(texto) {
  let digitos = String(texto ?? "").replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  return `+55${digitos}`;
}

// "+5511987654321" → "(11) 98765-4321".
export function formatarWhatsapp(numero) {
  const digitos = numero.replace(/^\+55/, "");
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  const corte = resto.length - 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// "?convite=ab12cd34" → "AB12CD34". Sem convite (ou estranho) → null.
export function lerConvite(busca) {
  const codigo = new URLSearchParams(busca ?? "").get("convite");
  return codigo && /^[A-Za-z0-9]{4,16}$/.test(codigo) ? codigo.toUpperCase() : null;
}

// O endereço atual sem o ?convite= (o resto fica como está).
export function enderecoSemConvite({ pathname, search, hash }) {
  const parametros = new URLSearchParams(search);
  parametros.delete("convite");
  const texto = parametros.toString();
  return pathname + (texto ? `?${texto}` : "") + hash;
}

export function linkDeConvite({ origin, pathname }, codigo) {
  return `${origin}${pathname}?convite=${codigo}`;
}

export function mensagemDeConvite(nomeDoGrupo, link) {
  return `Bora ver quem assiste mais filmes? 🎬🏆 Entra no meu grupo "${nomeDoGrupo}" na Cineoteca: ${link}`;
}

export function linkDoWhatsapp(texto) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

// O que está errado no nome do grupo ("" se está certo).
export function conferirNomeDoGrupo(nome) {
  const limpo = nome.trim();
  if (!limpo) return "Dê um nome ao grupo.";
  if (limpo.length > MAX_NOME_GRUPO) return `O nome pode ter até ${MAX_NOME_GRUPO} letras.`;
  return "";
}
