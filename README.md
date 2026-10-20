# Cineoteca

Um site que mostra os filmes disponíveis agora nos serviços de streaming do Brasil, com visual de sala de cinema: as cores do filme em destaque iluminam a página.

Feito com HTML, CSS e JavaScript puro, sem frameworks e sem instalar nada, usando a [API da TMDB](https://developer.themoviedb.org/docs/getting-started).

## O que dá para fazer

### Encontrar filmes
- **Ver primeiro os melhores.** O Catálogo mostra todos os filmes com nota 7,5 ou mais antes dos outros. Só quando eles acabam aparecem os de 7,0 a 7,5, depois os de 6,5 a 7,0, e assim por diante. Filmes com menos de 100 votos (como lançamentos muito recentes) ficam para o fim.
- **Filtrar por streaming.** Clique nos logos (Netflix, Prime Video...) para ver só os filmes deles. "Limpar filtro" desmarca todos.
- **Buscar pelo título.** Digite pelo menos 2 letras na caixa de busca. Cada resultado mostra os logos de onde assistir, ou "Fora do streaming". O "×" ou a tecla Esc voltam ao Catálogo.
- **Carregar mais.** Traz mais 20 filmes no fim da grade, sem repetir.
- **Voltar ao início.** Clique no logo da Cineoteca para voltar ao Catálogo, no topo.

### Marcar filmes
No computador, passe o mouse num pôster. No celular, segure o dedo no pôster por meio segundo.

| Botão | O que faz |
|---|---|
| **✓** (gostei) | Marca como "Já assisti" e reforça os gêneros do filme nas recomendações. |
| **✗** (não gostei) | O filme some do site. Dá para desfazer por 5 segundos (ou trazer de volta depois pela aba "Ocultos", veja abaixo). |
| **＋ Quero assistir** | Guarda o filme na aba "Quero assistir". |
| **👁 Já assisti** | Guarda o filme na aba "Já assisti". |

- Filme marcado **sai do Catálogo** e fica só na aba dele. No lugar entra um filme novo no fim da grade, então a quantidade na tela não diminui. O aviso que aparece tem um botão **Desfazer**.
- Na **busca** e nas **abas**, o filme marcado continua aparecendo, com o ✓ visível.
- As abas **"Quero assistir"** e **"Já assisti"** mostram seus filmes, do mais recente para o mais antigo, com os logos de onde assistir. Desmarcar um filme dentro da aba tira ele da lista na hora (com "Desfazer").
- A aba **"Ocultos"** não aparece na barra do topo. Para ver os filmes com ✗, abra o endereço do site com `?aba=ocultos` no fim (por exemplo, `http://localhost:3000/?aba=ocultos`). Clique no ✗ de um filme ali para trazê-lo de volta: como ✗ conta como "assisti e não gostei", ele vai para "Já assisti".
- As marcações ficam guardadas **no seu navegador**. Com a conta aberta (veja abaixo), elas também ficam **na conta** e aparecem em qualquer computador.

### Conta
- O botão **Entrar**, no canto do cabeçalho, cria a conta (nome, e-mail e senha) ou entra numa conta existente.
- Ao entrar, as marcações feitas antes no navegador **sobem para a conta**, juntando-se às que já estavam lá (em cada filme, vale a marcação mais recente).
- Ao sair, as marcações saem da tela (continuam na conta). Se alguma não conseguiu chegar à conta (sem internet, por exemplo), ela fica no navegador e sobe na próxima vez que você entrar.
- Ofertas: no cadastro há uma caixinha (desmarcada) para receber novidades e ofertas. Dá para mudar depois clicando no seu nome. A data do aceite fica guardada (LGPD). A [política de privacidade](privacidade.html) explica o que é guardado.

### Grupos
Com a conta aberta, aparece a aba **Grupos**.

- **Criar grupo:** dê um nome e clique em "Criar grupo". Quem cria já participa.
- **Convidar:** cada grupo tem um link próprio. "Convidar pelo WhatsApp" abre o WhatsApp com a mensagem pronta; "Copiar link" copia o link para mandar por onde quiser.
- **Quem abre o link** vê de que grupo é o convite e cria a conta (ou entra). Em seguida entra no grupo sozinho. Quem já está com a conta aberta entra direto.
- **Sair do grupo:** o último a sair apaga o grupo.
- **WhatsApp:** ao criar ou entrar num grupo, o site pergunta uma vez se a pessoa quer receber o desafio da semana pelo WhatsApp (os avisos começam em breve), com uma caixinha separada para ofertas. Dá para remover o número clicando no seu nome.
- Os participantes veem os nomes uns dos outros, mas não o e-mail nem o WhatsApp.

### Recomendações
O destaque no topo é um carrossel com 4 filmes que troca a cada 5 segundos (pausa com o mouse em cima). As cores do filme em destaque se espalham pelo fundo da página.

- Cada filme marcado dá pontos aos gêneros dele: **✓ +2**, só **"Já assisti" +1**, **✗ −2** ("Quero assistir" não conta). O carrossel mostra filmes dos 3 gêneros com mais pontos, com o título **"Recomendados para você"**.
- Sem nenhuma marcação ainda, ele mostra os **"Mais bem avaliados"** de qualquer gênero.
- Ele mostra só filmes que você ainda não marcou, com nota acima de 7,5. Se eles acabarem, completa com notas menores (7,0, 6,5... até 5,0).

### Página do filme
Clique num pôster ou no destaque. A página tem o trailer tocando sem som no topo (com botão "Ativar som"), sinopse, ano, duração, gêneros, classificação indicativa, nota, direção, elenco e onde assistir (assinatura, aluguel e compra). Feche com "← Voltar", com a tecla Esc ou com o botão voltar do navegador.

### Endereço da página
A aba e o filme abertos ficam no endereço, por exemplo `?aba=quero#/filme/603`. Assim o F5 reabre no mesmo lugar, e dá para mandar o link de um filme para alguém.

## Como rodar

### 1. Pegue seu token da TMDB (grátis)

1. Crie uma conta em [themoviedb.org](https://www.themoviedb.org/signup).
2. Vá em **Configurações → API** ([link direto](https://www.themoviedb.org/settings/api)) e peça uma chave de API (uso pessoal).
3. Copie o **Read Access Token (Token de Leitura da API)**. É o texto **longo**, que começa com `eyJ...`, e não a "Chave da API" curta.

### 2. Configure o token no projeto

1. Faça uma cópia de `js/config.example.js` com o nome `js/config.js`. Se o `js/config.js` já existir, só edite.
2. Cole o seu token entre as aspas:

   ```js
   export const TMDB_TOKEN = "eyJhbGciOi...seu-token...";
   ```

O arquivo `js/config.js` está no `.gitignore`, então o seu token **não** vai para o GitHub.

### 3. Configure o Supabase (para as contas)

Sem este passo o site funciona normalmente, só sem o botão "Entrar".

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. Em **Settings → API Keys**, copie a chave **Publishable** (`sb_publishable_...`). Em **Data API**, copie o **Project URL**. Cole os dois no `js/config.js` (veja o `js/config.example.js`). **Nunca** use a chave `secret`/`service_role` no site.
3. Em **SQL Editor → New query**, cole o arquivo `supabase/01-contas.sql` inteiro e clique em **Run**. Repita com o `supabase/02-grupos.sql` (sempre na ordem dos números, cada um uma vez só).
4. Para testar à vontade: em **Authentication → Sign In / Providers → Email**, desligue **Confirm email** (o e-mail grátis do Supabase só manda uns 2 por hora). Religue antes de abrir o site ao público.

### 4. Rode o site

O site precisa de um servidor local. **Abrir o `index.html` com duplo clique não funciona**, porque o navegador bloqueia os módulos JavaScript (`import`/`export`) quando o arquivo é aberto direto do disco.

**Opção A, VS Code (mais fácil):**
1. Instale a extensão **Live Server** (de Ritwick Dey).
2. Abra a pasta do projeto no VS Code.
3. Clique em **Go Live**, no canto inferior direito. O site abre no navegador.

**Opção B, terminal (precisa do Node instalado):**

```bash
npx serve
```

Depois abra o endereço que aparecer, normalmente http://localhost:3000.

O site precisa de internet: os filmes vêm da TMDB, os trailers do YouTube e as fontes do Google Fonts (sem elas, o site usa as fontes do sistema).

### 5. Rode os testes

Precisa do Node 18 ou mais recente; não há nada para instalar:

```bash
npm test
```

## Como o código está organizado

| Arquivo | O que faz |
|---|---|
| `index.html` | A estrutura da página (inclui o espaço da página do filme) |
| `css/style.css` | O visual "sala escura" (as cores e fontes ficam no topo do arquivo) |
| `img/cineoteca.svg` | O logo (também é o ícone da aba do navegador) |
| `js/api.js` | Conversa com a TMDB e escolhe que filmes buscar (faixas de nota, carrossel); não mexe na tela |
| `js/fila.js` | A reserva dos próximos filmes da grade (para o "Carregar mais" e para repor quem sai) |
| `js/assistidos.js` | Guarda no navegador o que você marcou e calcula os gêneros favoritos |
| `js/ui.js` | Desenha a página principal; não acessa a internet |
| `js/detalhe.js` | Desenha a página do filme (trailer, elenco, onde assistir) |
| `js/app.js` | O "maestro": guarda o estado e liga cliques → api → tela |
| `js/conta.js` | Conversa com o Supabase: criar conta, entrar, sair, perfil e marcações |
| `js/conta-tela.js` | O botão da conta e a janela de entrar / criar conta |
| `js/grupos.js` | Regras dos grupos sem tela: link e mensagem de convite, número de WhatsApp |
| `js/grupos-tela.js` | A aba "Grupos" e a janela que pede o WhatsApp |
| `js/nuvem.js` | Junta as marcações do navegador com as da conta e leva cada mudança para lá |
| `supabase/` | O SQL que cria as tabelas e as regras de segurança no Supabase |
| `privacidade.html` | A política de privacidade |
| `js/config.js` | O seu token (não vai para o git) |
| `tests/` | Testes automáticos (`npm test`) |
| `docs/` | O planejamento da primeira versão (design e plano de implementação) |

## Limitações conhecidas

- **O botão "Assistir" abre a página do filme na TMDB**, e não direto na Netflix ou no Prime Video: a TMDB não fornece o link direto. De lá, um clique leva ao streaming.
- **Alguns trailers não tocam dentro do site** (o dono do vídeo bloqueou). Nesse caso, a imagem do filme fica no lugar.
- **Sem conta, as marcações não passam de um navegador para outro** (ficam guardadas só no navegador onde foram feitas).

## Checklist de teste manual

### Catálogo e filtros
- [x] Ao abrir, aparecem os cards cinza "piscando" e depois a grade de filmes.
- [x] Os primeiros filmes do Catálogo têm todos nota 7,5 ou mais. Com um streaming pequeno marcado, clicando em "Carregar mais" até o fim, as notas descem por faixa, sem misturar.
- [x] Clicar em um logo destaca o logo e troca a grade.
- [x] Clicar em um segundo logo deixa os dois destacados e mostra filmes de ambos.
- [x] "Limpar filtro" desmarca tudo e volta à grade inicial.
- [x] "Carregar mais" acrescenta filmes no fim, sem duplicar a grade. Testar até a página 3.

### Busca
- [x] Digitar "matrix" na busca mostra os resultados com os logos de onde assistir; o "×" volta ao catálogo.

### Carrossel
- [x] O carrossel troca de filme a cada 5 segundos, pausa com o mouse em cima, e a cor do fundo muda junto.

### Marcar filmes
- [x] Os botões do pôster só aparecem com o mouse em cima. Na busca e nas abas, depois de marcado, só o ✓ fica visível.
- [x] Marcar um filme no Catálogo faz ele sair de lá na hora e um filme novo entra no fim da grade (continuam 20); "Desfazer" devolve como estava, e o filme que tinha entrado sai.
- [x] Dar ✗ num filme faz ele sumir; "Desfazer" traz de volta. Recarregando a página, ele continua oculto.
- [x] "Quero assistir" e "Já assisti" aparecem nas abas do topo, com o número certo.
- [ ] Na aba "Quero assistir", desmarcar "Quero assistir" num filme tira ele da lista na hora e o número da aba diminui; "Desfazer" traz de volta.
- [ ] Depois de dar ✗ num filme, a aba "Ocultos" **não** aparece na barra; abrindo `?aba=ocultos`, ela aparece com "Ocultos (1)", clicar no ✗ traz o filme de volta (vai para "Já assisti") e a aba some ao sair dela.
- [x] Depois de marcar todos os filmes da primeira página e recarregar, o Catálogo continua cheio (com os filmes das páginas seguintes) e o carrossel continua com 4 filmes.

### Página do filme
- [ ] Abrir um filme do Catálogo, marcar "Quero assistir" na página dele e desmarcar em seguida: ao voltar, o pôster está de novo no mesmo lugar da grade, e o filme que tinha entrado no fim saiu (continuam 20).
- [x] Clicar num pôster abre a página do filme com o trailer tocando sem som; "Ativar som" liga o áudio.
- [x] "← Voltar", a tecla Esc e o botão voltar do navegador fecham a página do filme no mesmo ponto da lista.

### Endereço e F5
- [x] Na aba "Quero assistir", apertar F5 reabre na mesma aba (também com a página de um filme aberta por cima).

### Celular e erros
- [x] No DevTools, no modo celular (Ctrl+Shift+M, largura 375px), o layout fica bom.
- [x] No celular (DevTools, Ctrl+Shift+M): toque rápido no pôster abre o filme; segurar o dedo mostra os 4 botões grandes; tocar fora fecha; rolar a tela não abre nada.
- [x] Com um token errado em `js/config.js`, aparece a mensagem de token inválido.
- [x] No DevTools (F12) → Network → **Offline**, clicar num logo mostra o erro e "Tentar de novo". Voltar a ficar online e clicar em "Tentar de novo" carrega os filmes.

## Créditos

- Dados de filmes: [TMDB](https://www.themoviedb.org/). Este produto usa a API da TMDB, mas não é endossado ou certificado pela TMDB.
- Dados de streaming fornecidos por [JustWatch](https://www.justwatch.com/).
- Trailers: YouTube, exibidos pelo player oficial.
- Fontes: [Big Shoulders Display](https://fonts.google.com/specimen/Big+Shoulders+Display) e [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans), do Google Fonts.
