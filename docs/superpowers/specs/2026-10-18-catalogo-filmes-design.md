# Catálogo de Filmes nos Streamings — Design

**Data:** 2026-10-18
**Status:** aprovado

## 1. Objetivo

Um site que mostra os filmes disponíveis agora nos serviços de streaming no Brasil, com filtro por serviço. Ele é construído como projeto de um curso no YouTube sobre Claude Code. Por isso o código precisa ser didático, dividido em partes que caibam em episódios, e o resultado precisa ser bonito na tela.

### Critério de sucesso

1. Ao abrir o app, aparece uma grade de pôsteres de filmes disponíveis em algum streaming no Brasil.
2. Clicar no logo de um ou mais streamings atualiza a grade para mostrar só os filmes desses serviços.
3. "Carregar mais" traz os próximos filmes, sem apagar os que já estão na tela.
4. Uma pessoa iniciante consegue acompanhar o código arquivo por arquivo.

### Fora do escopo da v1

Busca por título, filtro por gênero, ordenação escolhida pelo usuário, página de detalhes, filtro por tipo de acesso (assinatura/aluguel/compra), escolha de país, rolagem infinita e publicação na internet. Essas podem virar versões futuras.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Região | Brasil (`watch_region=BR`), fixa |
| Provedores | Todos os que a TMDB retornar para o Brasil: assinatura, grátis, com anúncios, aluguel e compra |
| Idioma | Interface em português; dados da TMDB com `language=pt-BR` |
| Stack | HTML, CSS e JavaScript puro, com módulos ES. Sem framework, sem build e sem dependências |
| Execução | Só local, com um servidor estático (extensão Live Server do VS Code ou `npx serve`). Abrir via `file://` não funciona por causa dos módulos ES |
| Autenticação | Read Access Token da TMDB no cabeçalho `Authorization: Bearer <token>` |
| Segredo | O token fica em `js/config.js`, listado no `.gitignore`. O repositório traz `js/config.example.js` como modelo |
| Vários streamings marcados | Lógica OU: mostra filmes que estão em qualquer um deles |
| Ordenação | Fixa por popularidade (`sort_by=popularity.desc`) |
| Paginação | Botão "Carregar mais", com 20 filmes por página |

## 3. Estrutura de arquivos

```
catalogo-filmes/
├── index.html              # estrutura: cabeçalho, barra de streamings, grade, botão, rodapé
├── css/style.css           # tema escuro, barra de logos, grade responsiva, skeleton
├── js/
│   ├── config.example.js   # export const TMDB_TOKEN = "cole-seu-token-aqui";
│   ├── config.js           # token real (ignorado pelo git)
│   ├── api.js              # chamadas à TMDB + funções puras de URL e ordenação
│   ├── ui.js               # tudo que desenha ou altera a tela
│   └── app.js              # estado e eventos; liga cliques → api → ui
├── tests/
│   └── api.test.js         # testes das funções puras com node --test
├── .gitignore
└── README.md               # como obter o token, configurar, rodar e testar
```

### Responsabilidades e fronteiras

- **`api.js`** não acessa o DOM e não importa `config.js`. Ele exporta:
  - `definirToken(token)`: guarda o token usado nas chamadas
  - `montarUrlProvedores()` → string (pura)
  - `montarUrlFilmes(idsProvedores, pagina)` → string (pura)
  - `ordenarProvedores(lista)` → nova lista ordenada pela prioridade de exibição no Brasil (pura)
  - `buscarProvedores()` → `Promise<Provedor[]>`, já ordenada
  - `buscarFilmes(idsProvedores, pagina)` → `Promise<{ filmes, pagina, totalPaginas }>`
  - Em erro, lança um `ErroApi` com `tipo` igual a `"auth"` (HTTP 401), `"rede"` (falha no fetch) ou `"api"` (outros status).
- **`ui.js`** não faz chamadas de rede. Ele exporta funções como `renderizarProvedores(lista, selecionados, aoClicar)`, `renderizarFilmes(filmes, { acrescentar })`, `mostrarCarregando()`, `mostrarVazio()`, `mostrarErro(erro, aoTentarDeNovo)` e `atualizarBotaoMais({ visivel, carregando })`.
- **`app.js`** é o único arquivo que importa os outros dois. Ele guarda o estado e reage aos eventos.

## 4. API da TMDB

Base: `https://api.themoviedb.org/3`

### 4.1 Provedores (uma vez, ao abrir)

```
GET /watch/providers/movie?watch_region=BR&language=pt-BR
```

Campos usados: `provider_id`, `provider_name`, `logo_path` e `display_priorities.BR`. Os provedores são ordenados por `display_priorities.BR` em ordem crescente; quem não tiver prioridade para o Brasil vai para o fim.

### 4.2 Filmes

```
GET /discover/movie?watch_region=BR&with_watch_providers=<ids separados por |>
    &language=pt-BR&sort_by=popularity.desc&page=<n>
```

Campos usados por filme: `id`, `title`, `poster_path`, `release_date` (o ano) e `vote_average` (formatado com uma casa decimal). Campos da resposta: `page` e `total_pages`.

**Nenhum streaming marcado** (estado inicial): envia todos os IDs de provedores separados por `|`. Na implementação, verificar se a TMDB devolve o mesmo resultado só com `watch_region=BR`. Se devolver, usar a forma mais curta.

**Limite:** a TMDB aceita no máximo `page=500`. O total efetivo de páginas é `min(total_pages, 500)`.

### 4.3 Imagens

- Pôster: `https://image.tmdb.org/t/p/w342<poster_path>`
- Logo: `https://image.tmdb.org/t/p/w92<logo_path>`
- Filme sem `poster_path`: card com fundo neutro e o título centralizado.

## 5. Estado e fluxo

```js
const estado = {
  provedores: [],          // da chamada 4.1
  selecionados: new Set(), // provider_id marcados
  pagina: 1,
  totalPaginas: 1,
  carregando: false,
};
```

1. **Ao abrir:** busca os provedores, desenha a barra de logos e busca a página 1 sem filtro.
2. **Ao clicar em um logo:** marca ou desmarca o ID, volta para `pagina = 1`, busca e **substitui** a grade.
3. **Ao clicar em "Limpar":** esvazia `selecionados` e segue como no passo 2.
4. **Ao clicar em "Carregar mais":** se `carregando` for verdadeiro, ignora o clique. Senão, faz `pagina + 1`, busca e **acrescenta** os filmes à grade.
5. **Botão "Carregar mais":** visível somente enquanto `pagina < totalPaginas`.
6. **Corrida entre requisições:** se o filtro mudar enquanto uma busca está em andamento, a resposta antiga é descartada. Cada busca recebe um número sequencial, e só a resposta da busca mais recente é desenhada.

## 6. Interface

- **Tema escuro.** Cores definidas como variáveis CSS em `:root`.
- **Cabeçalho:** título "Catálogo de Streaming" e o subtítulo "Filmes disponíveis no Brasil".
- **Barra de logos:** ícones redondos de 48px com rolagem horizontal. Desmarcado: escala de cinza e opacidade reduzida. Marcado: colorido e com borda de destaque. Cada logo é um `<button>` com `aria-pressed` e `title` com o nome do serviço. O botão "Limpar" só aparece quando há seleção.
- **Grade:** `display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`. O card mostra pôster (proporção 2:3), título, ano e nota (★ 7.8). As imagens usam `loading="lazy"`.
- **Rodapé (obrigatório pelos termos da TMDB):** "Dados de streaming fornecidos por JustWatch." e "Este produto usa a API da TMDB, mas não é endossado ou certificado pela TMDB.", com o logo da TMDB.

### Estados

| Situação | Exibição |
|---|---|
| Carregando a página 1 | 12 cards skeleton animados |
| Carregando mais | O botão mostra "Carregando..." e fica desativado |
| Resultado vazio | "Nenhum filme encontrado para esses streamings." |
| Erro `rede` ou `api` | Mensagem e o botão "Tentar de novo", que repete a última ação |
| Erro `auth` | "Token inválido ou ausente. Configure seu token em js/config.js (veja o README)." |
| Falha ao carregar provedores | Mesmo tratamento de erro; "Tentar de novo" reinicia o app |

## 7. Testes

- **Automatizados:** `node --test tests/` (Node 18 ou mais recente; nada a instalar). Cobrem:
  - `montarUrlFilmes`: um ID, vários IDs com `|`, número da página, parâmetros fixos (`watch_region`, `language`, `sort_by`).
  - `montarUrlProvedores`: parâmetros corretos.
  - `ordenarProvedores`: ordem por `display_priorities.BR`, provedores sem prioridade no fim, lista original intacta.
  - O `api.js` não importa `config.js`, para que os testes rodem sem o token. Quem importa é o `app.js`, que entrega o token chamando `definirToken(TMDB_TOKEN)`, exportada pelo `api.js`, antes da primeira busca.
- **Manuais** (checklist no README): carregamento inicial; marcar um logo; marcar dois; limpar; ir até a página 3; token errado mostra a mensagem de token; modo offline do DevTools mostra erro e "Tentar de novo" funciona; layout no celular (DevTools, 375px).

## 8. Divisão sugerida em episódios

1. Conta na TMDB, token, estrutura de pastas, `index.html` e `config.js`.
2. `api.js`: primeira chamada e `console.log` dos provedores; testes das funções puras.
3. `ui.js` e `style.css`: barra de logos e grade de filmes.
4. `app.js`: estado, filtro por clique e "Carregar mais".
5. Estados de carregando, vazio e erro; rodapé de créditos; checklist final.
