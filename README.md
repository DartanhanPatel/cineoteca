# Cineoteca

Um site que mostra os filmes disponíveis agora nos serviços de streaming no Brasil, com visual de sala de cinema: as cores do filme em destaque iluminam a página.

## O que dá para fazer

- **Filtrar por streaming:** clique nos logos (Netflix, Prime Video...) para ver só os filmes deles.
- **Buscar pelo título:** digite na caixa de busca. Cada resultado mostra os logos de onde assistir, ou "Fora do streaming".
- **Ver recomendações:** o destaque no topo é um carrossel com 4 filmes acima de 7,5, que troca a cada 5 segundos. Ele aprende com o que você marca: cada filme dá pontos aos gêneros dele (✓ gostei +2, só "Já assisti" +1, ✗ não gostei −2), e o carrossel usa os 3 gêneros com mais pontos.
- **Avaliar filmes:** passe o mouse num pôster.
  - **✓ Gostei:** fica marcado no pôster e reforça os gêneros do filme nas recomendações.
  - **✗ Não gostei:** o filme some do site (dá para desfazer por 5 segundos).
  - **＋ Quero assistir** e **👁 Já assisti:** guardam o filme nas abas do topo.
  - Filme marcado sai do Catálogo e fica só na aba dele (dá para desfazer por 5 segundos). Na busca, ele continua aparecendo, com a marca.
- **Abrir a página do filme:** clique no pôster ou no destaque. Ela tem trailer, sinopse, elenco, classificação indicativa e onde assistir.

As marcações ficam guardadas no seu navegador. Elas continuam lá quando você fecha o site, mas não passam para outro computador.

Feito com HTML, CSS e JavaScript puro, sem frameworks e sem instalar nada, usando a [API da TMDB](https://developer.themoviedb.org/docs/getting-started). As fontes vêm do Google Fonts; sem internet, o site usa as fontes do sistema.

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
| `css/style.css` | O visual "sala escura" (as cores e fontes ficam no topo do arquivo) |
| `js/api.js` | Conversa com a TMDB; não mexe na tela |
| `js/ui.js` | Desenha a página principal; não acessa a internet |
| `js/detalhe.js` | Desenha a página do filme (trailer, elenco, onde assistir) |
| `js/assistidos.js` | Guarda no navegador o que você marcou (✓, ✗, Quero assistir, Já assisti) |
| `js/app.js` | O "maestro": guarda o estado e liga cliques → api → tela |
| `js/config.js` | O seu token (não vai para o git) |
| `tests/` | Testes automáticos (`npm test`) |

## Checklist de teste manual

- [x] Ao abrir, aparecem os cards cinza "piscando" e depois a grade de filmes.
- [x] Clicar em um logo destaca o logo e troca a grade.
- [x] Clicar em um segundo logo deixa os dois destacados e mostra filmes de ambos.
- [x] "Limpar" desmarca tudo e volta à grade inicial.
- [x] "Carregar mais" acrescenta filmes no fim, sem duplicar a grade. Testar até a página 3.
- [x] Com um token errado em `js/config.js`, aparece a mensagem de token inválido.
- [x] No DevTools (F12) → Network → **Offline**, clicar num logo mostra o erro e "Tentar de novo". Voltar a ficar online e clicar em "Tentar de novo" carrega os filmes.
- [x] No DevTools, no modo celular (Ctrl+Shift+M, largura 375px), o layout fica bom.
- [ ] Digitar "matrix" na busca mostra os resultados com os logos de onde assistir; o "×" volta ao catálogo.
- [ ] O carrossel troca de filme a cada 5 segundos, pausa com o mouse em cima, e a cor do fundo muda junto.
- [ ] Os botões do pôster só aparecem com o mouse em cima; depois de marcado, só o ✓ fica visível.
- [ ] Dar ✗ num filme faz ele sumir; "Desfazer" traz de volta. Recarregando a página, ele continua oculto.
- [ ] "Quero assistir" e "Já assisti" aparecem nas abas do topo, com o número certo.
- [ ] Marcar um filme no Catálogo faz ele sair de lá na hora; "Desfazer" devolve como estava.
- [ ] Clicar num pôster abre a página do filme com o trailer tocando sem som; "Ativar som" liga o áudio.
- [ ] "← Voltar", a tecla Esc e o botão voltar do navegador fecham a página do filme no mesmo ponto da lista.

## Créditos

- Dados de filmes: [TMDB](https://www.themoviedb.org/). Este produto usa a API da TMDB, mas não é endossado ou certificado pela TMDB.
- Dados de streaming fornecidos por [JustWatch](https://www.justwatch.com/).
