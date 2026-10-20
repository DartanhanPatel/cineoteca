// publicar.mjs — monta a pasta "publicar/" só com o que o site precisa
// (sem testes, documentos e arquivos do git), pronta para arrastar no
// Cloudflare Pages. Rode com: npm run publicar
//
// A pasta leva o js/config.js (o site precisa dele), por isso ela fica
// fora do git (.gitignore).
import { rmSync, mkdirSync, cpSync, existsSync } from "node:fs";

const DESTINO = "publicar";
const ARQUIVOS = ["index.html", "privacidade.html", "css", "img", "js"];

if (!existsSync("js/config.js")) {
  console.error("Falta o js/config.js (veja o README). Sem ele o site publicado não funciona.");
  process.exit(1);
}

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO);
for (const item of ARQUIVOS) {
  cpSync(item, `${DESTINO}/${item}`, { recursive: true });
}
// O modelo de configuração não serve para nada no site publicado.
rmSync(`${DESTINO}/js/config.example.js`, { force: true });

console.log(`Pronto! Arraste a pasta "${DESTINO}" no Cloudflare Pages.`);
