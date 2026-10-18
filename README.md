# Catálogo de Streaming

Um site simples que mostra os filmes disponíveis agora nos serviços de streaming no Brasil. Clique nos logos dos streamings para filtrar.

Feito com HTML, CSS e JavaScript puro, sem frameworks e sem instalar nada, usando a [API da TMDB](https://developer.themoviedb.org/docs/getting-started).

## 1. Pegue seu token da TMDB (grátis)

1. Crie uma conta em [themoviedb.org](https://www.themoviedb.org/signup).
2. Vá em **Configurações → API** ([link direto](https://www.themoviedb.org/settings/api)) e peça uma chave de API (uso pessoal).
3. Copie o **Read Access Token (Token de Leitura da API)**. É o texto **longo**, que começa com `eyJ...`, e não a "Chave da API" curta.

## 2. Configure o token no projeto

1. Faça uma cópia de `js/config.example.js` com o nome `js/config.js`. Se o `js/config.js` já existir, só edite.
2. Cole o seu token entre as aspas:

   ```js
   export const TMDB_TOKEN = "eyJhbGciOi...seu-token...";
   ```

O arquivo `js/config.js` está no `.gitignore`, então o seu token **não** vai para o GitHub.

## 3. Rode o site

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

## 4. Rode os testes

Precisa do Node 18 ou mais recente; não há nada para instalar:

```bash
npm test
```

## Como o código está organizado

| Arquivo | O que faz |
|---|---|
| `index.html` | A estrutura da página |
| `css/style.css` | O visual (tema escuro, grade de pôsteres) |
| `js/api.js` | Conversa com a TMDB; não mexe na tela |
| `js/ui.js` | Desenha na tela; não acessa a internet |
| `js/app.js` | O "maestro": guarda o estado e liga cliques → api → ui |
| `js/config.js` | O seu token (não vai para o git) |
| `tests/` | Testes automáticos (`npm test`) |

## Checklist de teste manual

- [ ] Ao abrir, aparecem os cards cinza "piscando" e depois a grade de filmes.
- [ ] Clicar em um logo destaca o logo e troca a grade.
- [ ] Clicar em um segundo logo deixa os dois destacados e mostra filmes de ambos.
- [ ] "Limpar" desmarca tudo e volta à grade inicial.
- [ ] "Carregar mais" acrescenta filmes no fim, sem duplicar a grade. Testar até a página 3.
- [ ] Com um token errado em `js/config.js`, aparece a mensagem de token inválido.
- [ ] No DevTools (F12) → Network → **Offline**, clicar num logo mostra o erro e "Tentar de novo". Voltar a ficar online e clicar em "Tentar de novo" carrega os filmes.
- [ ] No DevTools, no modo celular (Ctrl+Shift+M, largura 375px), o layout fica bom.

## Créditos

- Dados de filmes: [TMDB](https://www.themoviedb.org/). Este produto usa a API da TMDB, mas não é endossado ou certificado pela TMDB.
- Dados de streaming fornecidos por [JustWatch](https://www.justwatch.com/).
