# Catálogo de Filmes nos Streamings — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** um site local, em HTML, CSS e JS puro, que mostra em grade os filmes disponíveis nos streamings do Brasil, com filtro por streaming e um botão "Carregar mais".

**Arquitetura:** a lógica fica em três módulos ES. O `api.js` cuida de rede e funções puras e não acessa o DOM. O `ui.js` cuida do DOM e não acessa a rede. O `app.js` guarda o estado e liga eventos, api e ui. As funções puras são testadas com `node --test`. A tela é verificada manualmente com o Live Server.

**Tech Stack:** HTML5, CSS3 (Grid e variáveis), JavaScript com módulos ES, API v3 da TMDB e Node 18+ (só para rodar os testes). Nenhuma dependência.

**Spec:** `docs/superpowers/specs/2026-10-18-catalogo-filmes-design.md`

## Restrições globais

- Região fixa `watch_region=BR`; idioma `language=pt-BR`; ordenação fixa `sort_by=popularity.desc`.
- Base da API: `https://api.themoviedb.org/3`. Autenticação: cabeçalho `Authorization: Bearer <token>`.
- Imagens: pôster `https://image.tmdb.org/t/p/w342<poster_path>`; logo `https://image.tmdb.org/t/p/w92<logo_path>`.
- Vários IDs de provedor são unidos com `|` (lógica OU).
- A TMDB limita a navegação a 500 páginas: `totalPaginas = min(total_pages, 500)`.
- Sem frameworks, sem build e sem pacotes npm. O `package.json` existe só com `"type": "module"` e o script de teste.
- `js/config.js` fica no `.gitignore` e nunca é commitado.
- `api.js` não importa `config.js` e não usa `document`. `ui.js` não usa `fetch`.
- Dados vindos da API são inseridos no DOM só com `textContent`, atributos (`src`, `alt`, `title`) ou `createElement`. Nunca com `innerHTML`.
- Textos da interface em português, exatamente como na spec (seção 6).
- Nomes de funções, variáveis e arquivos em português, como na spec.

## Pontos de atenção na revisão

1. **Filme sem pôster, sem data ou sem votos:** o card mostra um placeholder com o título, "—" no lugar do ano e "—" no lugar da nota, em vez de `undefined`, `NaN` ou imagem quebrada. Testado na Tarefa 3 (`formatarAno`, `formatarNota`) e verificado manualmente.
2. **Token colado com espaços, quebra de linha ou já com "Bearer ":** precisa funcionar do mesmo jeito. Testado na Tarefa 2 (`definirToken`).
3. **Cliques rápidos em logos diferentes:** a grade final corresponde ao último filtro clicado, não à resposta que chegou por último. Coberto pelo contador sequencial da Tarefa 4 e verificado manualmente com Network throttling.
4. **Filtro sem resultado (`total_pages: 0`):** mostra a mensagem de vazio e esconde "Carregar mais". Testado na Tarefa 2 (normalização) e verificado na Tarefa 5.
5. **Título com caracteres especiais (`&`, `<`, aspas):** aparece literalmente, sem quebrar o HTML. Garantido pelo uso de `textContent` (restrição global) e verificado na Tarefa 3.

---

### Tarefa 1: Base do projeto e URLs da TMDB (funções puras)

**Arquivos:**
- Criar: `package.json`, `.gitignore`, `js/config.example.js`, `js/api.js`
- Teste: `tests/api.test.js`

**Interfaces:**
- Consome: nada.
- Produz (em `js/api.js`):
  - `export const BASE_URL = "https://api.themoviedb.org/3"`
  - `montarUrlProvedores(): string`
  - `montarUrlFilmes(idsProvedores: number[], pagina: number): string`
  - `ordenarProvedores(lista: Provedor[]): Provedor[]`, em que `Provedor` é o objeto bruto da TMDB `{ provider_id, provider_name, logo_path, display_priorities }`
  - `idsParaBusca(selecionados: Set<number>, provedores: Provedor[]): number[]`, que devolve os IDs selecionados ou, se nenhum estiver selecionado, todos os `provider_id` de `provedores`

- [ ] **Passo 1: Criar os arquivos de base**

`package.json`:
```json
{ "name": "catalogo-filmes", "private": true, "type": "module",
  "scripts": { "test": "node --test tests/" } }
```
`.gitignore`: `js/config.js` e `node_modules/`.
`js/config.example.js`: `export const TMDB_TOKEN = "cole-seu-token-aqui";`

- [ ] **Passo 2: Escrever os testes que falham** em `tests/api.test.js`, com `node:test` e `node:assert/strict`

```js
test("montarUrlProvedores usa região BR e pt-BR", () => {
  const url = new URL(montarUrlProvedores());
  assert.equal(url.origin + url.pathname, "https://api.themoviedb.org/3/watch/providers/movie");
  assert.equal(url.searchParams.get("watch_region"), "BR");
  assert.equal(url.searchParams.get("language"), "pt-BR");
});

test("montarUrlFilmes com um provedor", () => {
  const url = new URL(montarUrlFilmes([8], 1));
  assert.equal(url.pathname, "/3/discover/movie");
  assert.equal(url.searchParams.get("with_watch_providers"), "8");
  assert.equal(url.searchParams.get("watch_region"), "BR");
  assert.equal(url.searchParams.get("language"), "pt-BR");
  assert.equal(url.searchParams.get("sort_by"), "popularity.desc");
  assert.equal(url.searchParams.get("page"), "1");
});

test("montarUrlFilmes une vários provedores com |", () => {
  const url = new URL(montarUrlFilmes([8, 119, 337], 3));
  assert.equal(url.searchParams.get("with_watch_providers"), "8|119|337");
  assert.equal(url.searchParams.get("page"), "3");
});

test("ordenarProvedores ordena por display_priorities.BR e manda os sem prioridade para o fim", () => {
  const lista = [
    { provider_id: 1, display_priorities: { BR: 5 } },
    { provider_id: 2, display_priorities: {} },
    { provider_id: 3, display_priorities: { BR: 1 } },
  ];
  assert.deepEqual(ordenarProvedores(lista).map(p => p.provider_id), [3, 1, 2]);
  assert.deepEqual(lista.map(p => p.provider_id), [1, 2, 3]); // original intacta
});

test("idsParaBusca devolve os selecionados ou, sem seleção, todos", () => {
  const provedores = [{ provider_id: 8 }, { provider_id: 119 }];
  assert.deepEqual(idsParaBusca(new Set([119]), provedores), [119]);
  assert.deepEqual(idsParaBusca(new Set(), provedores), [8, 119]);
});
```

- [ ] **Passo 3: Rodar e confirmar a falha**

Rode: `npm test`
Esperado: FAIL com erro de importação, porque `js/api.js` ainda não exporta essas funções.

- [ ] **Passo 4: Implementar as cinco exportações em `js/api.js`**

Monte as URLs com `new URL(...)` e `url.searchParams.set(...)`. Em `ordenarProvedores`, copie a lista (`[...lista]`) antes do `sort`; provedor sem prioridade conta como `Infinity`. Comente de forma didática, porque o código será mostrado em vídeo.

- [ ] **Passo 5: Rodar e confirmar que passa**

Rode: `npm test`
Esperado: os 5 testes em PASS.

- [ ] **Passo 6: Commit**

```bash
git add package.json .gitignore js/config.example.js js/api.js tests/api.test.js
git commit -m "feat: base do projeto e montagem das URLs da TMDB"
```

---

### Tarefa 2: Chamadas à TMDB com tratamento de erro

**Arquivos:**
- Modificar: `js/api.js`
- Teste: `tests/api.test.js`

**Interfaces:**
- Consome: `montarUrlProvedores`, `montarUrlFilmes` e `ordenarProvedores` (Tarefa 1).
- Produz (em `js/api.js`):
  - `definirToken(token: string): void`, que remove espaços nas pontas e um prefixo `"Bearer "` opcional
  - `class ErroApi extends Error`, com a propriedade `tipo: "auth" | "rede" | "api"`
  - `buscarProvedores(): Promise<Provedor[]>`, já ordenada com `ordenarProvedores` (a partir de `json.results`)
  - `buscarFilmes(idsProvedores: number[], pagina: number): Promise<{ filmes: Filme[], pagina: number, totalPaginas: number }>`, em que `Filme` é o objeto bruto da TMDB (`id`, `title`, `poster_path`, `release_date`, `vote_average`) e `totalPaginas = Math.min(total_pages, 500)`

- [ ] **Passo 1: Escrever os testes que falham**

Nos testes, substitua `globalThis.fetch` por uma função falsa e restaure no `afterEach`.

```js
test("definirToken limpa espaços e o prefixo Bearer", async () => {
  let cabecalho;
  globalThis.fetch = async (_url, opts) => { cabecalho = opts.headers.Authorization;
    return { ok: true, status: 200, json: async () => ({ results: [] }) }; };
  definirToken("  Bearer abc123\n");
  await buscarProvedores();
  assert.equal(cabecalho, "Bearer abc123");
});

test("buscarFilmes normaliza a resposta e limita a 500 páginas", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200,
    json: async () => ({ page: 2, total_pages: 900, results: [{ id: 1 }] }) });
  assert.deepEqual(await buscarFilmes([8], 2), { filmes: [{ id: 1 }], pagina: 2, totalPaginas: 500 });
});

test("buscarFilmes com total_pages 0 devolve totalPaginas 0", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200,
    json: async () => ({ page: 1, total_pages: 0, results: [] }) });
  assert.equal((await buscarFilmes([8], 1)).totalPaginas, 0);
});

test("HTTP 401 vira ErroApi tipo auth", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(buscarProvedores(), e => e instanceof ErroApi && e.tipo === "auth");
});

test("HTTP 500 vira ErroApi tipo api", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(buscarFilmes([8], 1), e => e instanceof ErroApi && e.tipo === "api");
});

test("falha de rede vira ErroApi tipo rede", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(buscarFilmes([8], 1), e => e instanceof ErroApi && e.tipo === "rede");
});
```

- [ ] **Passo 2: Rodar e confirmar a falha**

Rode: `npm test`
Esperado: os novos testes falham com erro de importação (`definirToken`, `buscarProvedores`, `buscarFilmes` e `ErroApi` não existem). Os 5 testes da Tarefa 1 continuam em PASS.

- [ ] **Passo 3: Implementar em `js/api.js`**

Crie uma função interna `requisitar(url)` para as duas buscas. Ela chama `fetch` com os cabeçalhos `Authorization` e `accept: application/json`. Se o `fetch` lançar erro, ela lança `ErroApi` com tipo `"rede"`. Se a resposta for 401, tipo `"auth"`. Se for qualquer outro status diferente de `ok`, tipo `"api"`, com o status na mensagem. Se der certo, devolve `json`. O token fica numa variável `let` do módulo.

- [ ] **Passo 4: Rodar e confirmar que passa**

Rode: `npm test`
Esperado: os 11 testes em PASS.

- [ ] **Passo 5: Commit**

```bash
git add js/api.js tests/api.test.js
git commit -m "feat: chamadas à TMDB com erros de auth, rede e api"
```

---

### Tarefa 3: Página, visual e desenho dos logos e da grade

**Arquivos:**
- Criar: `index.html`, `css/style.css`, `js/ui.js`
- Teste: `tests/ui.test.js` (só as funções de formatação)

**Interfaces:**
- Consome: nada de outras tarefas (o `ui.js` não importa o `api.js`).
- Produz (em `js/ui.js`):
  - `formatarAno(dataLancamento: string | undefined): string`, que devolve `"2024"` ou `"—"`
  - `formatarNota(nota: number | undefined): string`, que devolve `"7.8"` ou `"—"` quando `nota` está ausente ou é `0`
  - `renderizarProvedores(lista: Provedor[], selecionados: Set<number>, aoClicar: (id: number) => void, aoLimpar: () => void): void`
  - `renderizarFilmes(filmes: Filme[], { acrescentar }: { acrescentar: boolean }): void`
  - `atualizarBotaoMais({ visivel, carregando }: { visivel: boolean, carregando: boolean }): void`
  - IDs no `index.html` usados pelo `ui.js`: `#provedores`, `#limpar`, `#grade`, `#mensagem`, `#carregar-mais`

- [ ] **Passo 1: Escrever os testes que falham** em `tests/ui.test.js`

```js
test("formatarAno", () => {
  assert.equal(formatarAno("2024-05-01"), "2024");
  assert.equal(formatarAno(""), "—");
  assert.equal(formatarAno(undefined), "—");
});

test("formatarNota", () => {
  assert.equal(formatarNota(7.834), "7.8");
  assert.equal(formatarNota(8), "8.0");
  assert.equal(formatarNota(0), "—");
  assert.equal(formatarNota(undefined), "—");
});
```

As funções de formatação não usam `document`. Assim o Node consegue importar o `ui.js`, desde que o módulo não acesse o DOM no carregamento (só dentro das funções).

- [ ] **Passo 2: Rodar e confirmar a falha**

Rode: `npm test`
Esperado: o `ui.test.js` falha com erro de importação.

- [ ] **Passo 3: Criar `index.html`**

Estrutura: `<header>` com `<h1>Catálogo de Streaming</h1>` e `<p>Filmes disponíveis no Brasil</p>`; `<nav>` com `<div id="provedores">` e `<button id="limpar" hidden>Limpar</button>`; `<main>` com `<div id="mensagem">`, `<section id="grade">` e `<button id="carregar-mais" hidden>Carregar mais</button>`; `<footer>` com os dois textos exatos da spec (seção 6) e o logo da TMDB. Baixe um dos logos oficiais em `https://www.themoviedb.org/about/logos-attribution`, salve como `img/tmdb.svg` e inclua esse arquivo no commit. Use `<html lang="pt-BR">`, a meta viewport e `<script type="module" src="js/app.js">`.

- [ ] **Passo 4: Criar `css/style.css`**

Tema escuro com variáveis em `:root` (`--fundo`, `--superficie`, `--texto`, `--texto-suave`, `--destaque`). A barra `#provedores` usa `display: flex; overflow-x: auto; gap`. Cada logo é um botão redondo de 48px; sem `[aria-pressed="true"]`, fica com `filter: grayscale(1)` e `opacity: .5`; com ele, fica colorido e com borda `--destaque`. A grade usa `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`. O pôster usa `aspect-ratio: 2 / 3; object-fit: cover`. A classe `.sem-poster` centraliza o título num fundo neutro. Adicione também agora a classe `.skeleton`, com animação de pulsar; ela será usada na Tarefa 5.

- [ ] **Passo 5: Implementar `js/ui.js`**

O `renderizarProvedores` cria um `<button>` por provedor com `aria-pressed`, `title` igual a `provider_name` e um `<img>` do logo com `alt` igual ao nome. O clique chama `aoClicar(provider_id)`. O botão `#limpar` aparece quando `selecionados.size > 0` e o clique nele chama `aoLimpar`. Para evitar listeners duplicados, use `onclick`, e não `addEventListener`, nos elementos fixos.

O `renderizarFilmes` cria os cards com `createElement` e `textContent`. O pôster usa `<img loading="lazy" alt=título>`; filme sem `poster_path` ganha uma `<div class="sem-poster">` com o título. Abaixo vêm o título, o ano e `★ ` + nota. Com `acrescentar: false`, limpe `#grade` antes. A função também esvazia e esconde `#mensagem`.

- [ ] **Passo 6: Rodar e confirmar que passa**

Rode: `npm test`
Esperado: todos os testes em PASS (11 do `api` + 2 do `ui`).

- [ ] **Passo 7: Verificação visual temporária**

Crie um `js/app.js` provisório que chama `renderizarProvedores` e `renderizarFilmes` com 3 objetos fixos: um normal, um sem `poster_path`/`release_date`/`vote_average` e um com o título `Tom & Jerry <O Filme>`. Abra com o Live Server. Esperado: os três cards aparecem; o segundo mostra o placeholder, "—" e "★ —"; o terceiro mostra o título literal. A tela se adapta de 375px a 1440px no DevTools. Esse `app.js` provisório **não** é commitado; a Tarefa 4 o substitui.

- [ ] **Passo 8: Commit**

```bash
git add index.html css/style.css js/ui.js tests/ui.test.js img/tmdb.svg
git commit -m "feat: página, tema escuro e desenho de logos e grade"
```

---

### Tarefa 4: Estado, filtro por clique e "Carregar mais"

**Arquivos:**
- Criar: `js/app.js`

**Interfaces:**
- Consome: `definirToken`, `buscarProvedores`, `buscarFilmes` e `idsParaBusca` (Tarefas 1 e 2); `renderizarProvedores`, `renderizarFilmes` e `atualizarBotaoMais` (Tarefa 3); `TMDB_TOKEN` de `./config.js`.
- Produz: o objeto `estado` interno (formato da spec, seção 5) e as funções internas `carregarFilmes({ acrescentar: boolean }): Promise<void>` e `iniciar(): Promise<void>`. A Tarefa 5 acrescenta o tratamento de erro nelas.

- [ ] **Passo 1: Implementar `js/app.js`**

- `estado` = `{ provedores: [], selecionados: new Set(), pagina: 1, totalPaginas: 1, carregando: false }`, mais o `let ultimaBusca = 0` do módulo.
- `carregarFilmes({ acrescentar })`: incrementa `ultimaBusca` e guarda o número numa constante local. Marca `carregando` e atualiza o botão. Chama `buscarFilmes(idsParaBusca(estado.selecionados, estado.provedores), estado.pagina)`. Se, ao receber a resposta, o número local for diferente de `ultimaBusca`, descarta a resposta (`return`). Senão, atualiza `pagina` e `totalPaginas`, chama `renderizarFilmes` e, no `finally`, desmarca `carregando` e chama `atualizarBotaoMais({ visivel: estado.pagina < estado.totalPaginas, carregando: false })`. O `finally` também só roda se a busca ainda for a mais recente.
- `aoClicarProvedor(id)`: alterna o ID no `Set`, faz `pagina = 1`, chama `renderizarProvedores` de novo (para atualizar `aria-pressed`) e depois `carregarFilmes({ acrescentar: false })`.
- `aoLimpar()`: `selecionados.clear()`, e o resto igual a `aoClicarProvedor`.
- `aoCarregarMais()`: se `estado.carregando`, retorna. Senão faz `pagina += 1` e chama `carregarFilmes({ acrescentar: true })`. Ligue com `document.querySelector("#carregar-mais").onclick`.
- `iniciar()`: `definirToken(TMDB_TOKEN)`, `estado.provedores = await buscarProvedores()`, `renderizarProvedores(...)`, `carregarFilmes({ acrescentar: false })`. Chame `iniciar()` no fim do módulo.

- [ ] **Passo 2: Testar a pendência da spec (seção 4.2)**

Com um token real em `js/config.js`, rode no console do navegador duas buscas, uma com `with_watch_providers` contendo todos os IDs e outra só com `watch_region=BR`, e compare `total_results`. Se forem iguais, mude o `montarUrlFilmes` para omitir `with_watch_providers` quando a lista estiver vazia, faça o `idsParaBusca` devolver `[]` sem seleção e ajuste os dois testes da Tarefa 1 que cobrem esse caso. Se forem diferentes, não mude nada. Registre o resultado na mensagem do commit.

- [ ] **Passo 3: Verificação manual (Live Server, com token real)**

Esperado: ao abrir, a barra mostra os logos, com Netflix e Prime Video entre os primeiros, e a grade mostra 20 filmes. Clicar na Netflix destaca o logo e troca a grade. Clicar num segundo logo destaca os dois. "Limpar" some e volta a grade inicial. "Carregar mais" três vezes resulta em 80 cards, sem duplicar a grade. Com DevTools > Network > "Slow 3G", clicar rápido em três logos diferentes deixa na tela a grade do último estado.

- [ ] **Passo 4: Rodar a suíte**

Rode: `npm test`
Esperado: tudo em PASS.

- [ ] **Passo 5: Commit**

```bash
git add js/app.js js/api.js tests/api.test.js
git commit -m "feat: filtro por streaming e carregar mais"
```

---

### Tarefa 5: Estados de carregando, vazio e erro, mais o README

**Arquivos:**
- Modificar: `js/ui.js`, `js/app.js`
- Criar: `README.md`

**Interfaces:**
- Consome: `ErroApi` e seu `tipo` (Tarefa 2); `carregarFilmes` e `iniciar` (Tarefa 4).
- Produz (em `js/ui.js`):
  - `mostrarCarregando(): void`, que substitui a grade por 12 `.skeleton`
  - `mostrarVazio(): void`, que limpa a grade e mostra "Nenhum filme encontrado para esses streamings." em `#mensagem`
  - `mostrarErro(erro: { tipo: string, message: string }, aoTentarDeNovo: () => void): void`

- [ ] **Passo 1: Implementar os estados em `js/ui.js`**

Textos exatos: para `tipo === "auth"`, "Token inválido ou ausente. Configure seu token em js/config.js (veja o README)." Para os demais tipos, "Não foi possível carregar os filmes. Verifique sua conexão." seguido de um botão "Tentar de novo" que chama `aoTentarDeNovo`. No caso `auth` não há botão, porque tentar de novo não resolve. A função também esconde `#carregar-mais`.

- [ ] **Passo 2: Ligar os estados em `js/app.js`**

- Em `carregarFilmes`: se `acrescentar` for falso, chame `mostrarCarregando()` antes da busca. Se a resposta trouxer `filmes.length === 0` e `acrescentar` for falso, chame `mostrarVazio()` em vez de `renderizarFilmes`. No `catch`, se a busca ainda for a mais recente, chame `mostrarErro(erro, () => carregarFilmes({ acrescentar }))`. Quando `acrescentar` for verdadeiro, desfaça antes o `pagina += 1` para que a nova tentativa peça a mesma página.
- Em `iniciar`: envolva o código em `try/catch`; no erro, chame `mostrarErro(erro, iniciar)`.
- Se `TMDB_TOKEN` estiver vazio ou for igual a `"cole-seu-token-aqui"`, chame `mostrarErro({ tipo: "auth" })` direto, sem fazer nenhuma requisição.

- [ ] **Passo 3: Escrever `README.md`** (para iniciantes, em português)

Seções: o que é o app; como criar a conta na TMDB e copiar o **Read Access Token** (Configurações > API); como copiar `js/config.example.js` para `js/config.js` e colar o token; como rodar com a extensão Live Server do VS Code ("Go Live") ou com `npx serve`, explicando que o duplo clique no `index.html` não funciona; como rodar os testes com `npm test`; o checklist manual da spec (seção 7); os créditos da TMDB e da JustWatch.

- [ ] **Passo 4: Verificação manual**

Esperado:
- Recarregar a página mostra o skeleton e depois os filmes.
- Com o token trocado por `"errado"`, aparece a mensagem de token, sem botão.
- Com o `config.js` tendo o valor do modelo, aparece a mesma mensagem e nenhuma requisição na aba Network.
- Com DevTools > Network > Offline, clicar num logo mostra o erro e "Tentar de novo". Voltar a ficar online e clicar em "Tentar de novo" carrega os filmes.
- Um filtro com poucos filmes chega ao fim e o "Carregar mais" some.
- Para ver o estado vazio, troque temporariamente no `app.js` os IDs da busca por `[999999]`, confirme que a mensagem de vazio aparece e o "Carregar mais" some, e desfaça a troca antes do commit.
- A tela fica boa em 375px.

- [ ] **Passo 5: Rodar a suíte e fazer o commit**

Rode: `npm test`. Esperado: tudo em PASS.

```bash
git add js/ui.js js/app.js README.md
git commit -m "feat: estados de carregando, vazio e erro; README"
```
