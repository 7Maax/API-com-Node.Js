# Vitrine Tech: API de produtos em Node.js + front-end

Catálogo de produtos de informática com duas páginas (Home e Detalhes) que consomem a API de produtos
**somente com `fetch`**. Front-end em HTML, CSS, Bootstrap 5 e JavaScript puro; API em Node.js puro
(módulo `http`, sem dependências).

Aluno: Gabriel Max Ferreira Rodrigues, Análise e Desenvolvimento de Sistemas, PUC Minas São Gabriel.

## Como rodar

Requisito: Node.js 18 ou superior. Não é preciso `npm install` (o projeto não tem dependências).

```bash
npm start
```

Abra **http://localhost:3000**. O mesmo servidor entrega a API (`/produtos`) e as páginas (pasta `public/`).
As páginas também funcionam abertas direto do disco (`public/index.html`), desde que o `npm start` esteja rodando.

Testes automatizados da API (usam um banco temporário, o `db.json` não é alterado):

```bash
npm test
```

## Onde está cada critério

| Critério | Onde ver | Código |
|---|---|---|
| Página Principal integrada com API via Fetch | Home: carrossel "Destaque" + grade com os **12 últimos** produtos (imagem, nome e preço) e botão "Ver detalhes" em cada um. Botão "Novo produto" abre um modal que cadastra via `POST` e atualiza a grade sem recarregar | `public/index.html`, `public/js/home.js` |
| Página de Detalhes integrada com API via Fetch | `detalhes.html?codigo=...` mostra todos os campos salvos do produto (`GET /produtos/:codigo`) | `public/detalhes.html`, `public/js/detalhes.js` |
| Modal de Edição de Item | Botão "Editar produto" abre o modal já preenchido e salva com `PUT` | `public/detalhes.html`, `public/js/detalhes.js` |
| Botão de Exclusão | Botão "Excluir produto" pede confirmação num modal antes do `DELETE` e volta para a Home | `public/detalhes.html`, `public/js/detalhes.js` |

Todas as chamadas `fetch` ficam em [`public/js/api.js`](public/js/api.js).

O banco vem com 13 produtos. O mais antigo (Teclado Logitech G915, código `309120`) não aparece na Home,
o que mostra o limite de 12. Ele continua acessível em `detalhes.html?codigo=309120`.

## Rotas da API

| Método | Rota | Resposta |
|---|---|---|
| GET | `/produtos` | Todos os produtos (filtros opcionais: `?categoria=`, `?codigo=`) |
| GET | `/produtos?limite=12` | Os 12 mais recentes, do mais novo ao mais antigo |
| GET | `/produtos/:codigo` | Um produto, ou 404 |
| GET | `/produtos/categoria/:categoria` | Produtos da categoria |
| POST | `/produtos` | 201 com o produto criado; 400 se faltar código, nome ou preço; 409 se o código já existir |
| PUT / PATCH | `/produtos/:codigo` | 200 com o produto atualizado (campos não enviados ficam como estão); 400; 404 |
| DELETE | `/produtos/:codigo` | 200 com a mensagem de exclusão; 404 |

Produto:

```json
{
  "id": "1595154",
  "codigo": "1595154",
  "nome": "Notebook Gamer Acer Nitro V15",
  "preco": 4899.9,
  "descricao": "Notebook Gamer Intel Core i7, 16GB RAM DDR5, SSD 512GB NVMe e GPU RTX 4050",
  "quantidadeEstoque": 15,
  "avaliacao": 4.9,
  "categoria": "Informatica",
  "imagem": "img/produtos/notebook.svg",
  "criadoEm": "2026-10-25T20:00:00.000Z"
}
```

### Mudanças em relação à entrega anterior (CRUD no Postman)

- Novos campos `imagem` (caminho de uma imagem em `public/img/produtos/` ou URL) e `criadoEm` (data do cadastro).
- Novo parâmetro `?limite=N` para listar os N mais recentes.
- `POST` com código repetido agora devolve **409** em vez de sobrescrever o produto existente.
- Dados inválidos e JSON malformado devolvem **400** em vez de derrubar o servidor.

## Estrutura

```
index.js              API + entrega dos arquivos de public/
db.json               banco (13 produtos)
public/
  index.html          Home
  detalhes.html       Detalhes
  css/style.css       estilos próprios por cima do Bootstrap
  js/api.js           todas as chamadas fetch
  js/util.js          formatação, montagem de elementos e formulários
  js/home.js          lógica da Home
  js/detalhes.js      lógica da página de detalhes
  img/                logo e ilustrações dos produtos (SVG próprios)
test/                 testes da API e dos arquivos estáticos (node:test)
```
