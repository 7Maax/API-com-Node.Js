// Testes da API de produtos. Rodar com: npm test
// O servidor sobe numa porta aleatória e usa um db.json temporário: o banco real não é tocado.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'api-produtos-'));
const caminhoBanco = path.join(pastaTemporaria, 'db.json');
process.env.DB_PATH = caminhoBanco; // precisa vir antes do require do servidor

const { server } = require('../index.js');

const PRODUTOS_INICIAIS = [
  {
    id: '100',
    codigo: '100',
    nome: 'Produto antigo sem data',
    preco: 10,
    descricao: 'Cadastrado antes do campo criadoEm existir',
    quantidadeEstoque: 1,
    avaliacao: 3,
    categoria: 'Informatica'
  },
  {
    id: '200',
    codigo: '200',
    nome: 'Monitor',
    preco: 900,
    descricao: 'Monitor de teste',
    quantidadeEstoque: 5,
    avaliacao: 4.5,
    categoria: 'Monitores',
    imagem: 'img/produtos/monitor.svg',
    criadoEm: '2026-11-01T10:00:00.000Z'
  },
  {
    id: '300',
    codigo: '300',
    nome: 'Teclado',
    preco: 300,
    descricao: 'Teclado de teste',
    quantidadeEstoque: 7,
    avaliacao: 4,
    categoria: 'Perifericos',
    imagem: '',
    criadoEm: '2026-11-02T10:00:00.000Z'
  }
];

let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(pastaTemporaria, { recursive: true, force: true });
});

beforeEach(() => {
  fs.writeFileSync(caminhoBanco, JSON.stringify({ produtos: structuredClone(PRODUTOS_INICIAIS) }));
});

function lerBanco() {
  return JSON.parse(fs.readFileSync(caminhoBanco, 'utf-8')).produtos;
}

async function chamar(metodo, rota, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  }
  const resposta = await fetch(base + rota, opcoes);
  return { status: resposta.status, corpo: await resposta.json() };
}

const NOVO_PRODUTO = {
  codigo: '400',
  nome: 'Mouse sem fio',
  preco: '199.9',
  descricao: 'Mouse leve',
  quantidadeEstoque: '12',
  avaliacao: '4.6',
  categoria: 'Perifericos',
  imagem: 'img/produtos/mouse.svg'
};

// ---------- GET ----------

test('GET /produtos lista todos na ordem do banco', async () => {
  const { status, corpo } = await chamar('GET', '/produtos');
  assert.equal(status, 200);
  assert.deepEqual(corpo.map((p) => p.codigo), ['100', '200', '300']);
});

test('GET /produtos/:codigo devolve o produto ou 404', async () => {
  const encontrado = await chamar('GET', '/produtos/200');
  assert.equal(encontrado.status, 200);
  assert.equal(encontrado.corpo.nome, 'Monitor');

  const inexistente = await chamar('GET', '/produtos/999');
  assert.equal(inexistente.status, 404);
  assert.ok(inexistente.corpo.erro);
});

test('GET filtra por categoria (query e rota) e por código', async () => {
  const porQuery = await chamar('GET', '/produtos?categoria=monitores');
  assert.deepEqual(porQuery.corpo.map((p) => p.codigo), ['200']);

  const porRota = await chamar('GET', '/produtos/categoria/Perifericos');
  assert.deepEqual(porRota.corpo.map((p) => p.codigo), ['300']);

  const porCodigo = await chamar('GET', '/produtos?codigo=100');
  assert.deepEqual(porCodigo.corpo.map((p) => p.codigo), ['100']);
});

test('GET /produtos?limite=N devolve os N mais recentes, o mais novo primeiro', async () => {
  const dois = await chamar('GET', '/produtos?limite=2');
  assert.equal(dois.status, 200);
  assert.deepEqual(dois.corpo.map((p) => p.codigo), ['300', '200']);

  // produto sem criadoEm fica por último
  const todos = await chamar('GET', '/produtos?limite=12');
  assert.deepEqual(todos.corpo.map((p) => p.codigo), ['300', '200', '100']);
});

test('GET /produtos?limite inválido devolve 400', async () => {
  for (const valor of ['0', '-1', 'abc', '2.5']) {
    const { status } = await chamar('GET', `/produtos?limite=${valor}`);
    assert.equal(status, 400, `limite=${valor}`);
  }
});

// ---------- POST ----------

test('POST cria produto com imagem e criadoEm e ele vira o mais recente', async () => {
  const { status, corpo } = await chamar('POST', '/produtos', NOVO_PRODUTO);
  assert.equal(status, 201);
  assert.equal(corpo.codigo, '400');
  assert.equal(corpo.id, '400');
  assert.equal(corpo.preco, 199.9);
  assert.equal(corpo.quantidadeEstoque, 12);
  assert.equal(corpo.avaliacao, 4.6);
  assert.equal(corpo.imagem, 'img/produtos/mouse.svg');
  assert.ok(!Number.isNaN(Date.parse(corpo.criadoEm)));

  assert.equal(lerBanco().length, 4);
  const recentes = await chamar('GET', '/produtos?limite=1');
  assert.equal(recentes.corpo[0].codigo, '400');
});

test('POST com código repetido devolve 409 e não sobrescreve', async () => {
  const { status, corpo } = await chamar('POST', '/produtos', { ...NOVO_PRODUTO, codigo: '200' });
  assert.equal(status, 409);
  assert.ok(corpo.erro);
  assert.equal(lerBanco().find((p) => p.codigo === '200').nome, 'Monitor');
});

test('POST sem campos obrigatórios ou com valores inválidos devolve 400', async () => {
  const casos = [
    { ...NOVO_PRODUTO, codigo: undefined },
    { ...NOVO_PRODUTO, codigo: 'com espaço' },
    { ...NOVO_PRODUTO, codigo: '../db' },
    { ...NOVO_PRODUTO, nome: '   ' },
    { ...NOVO_PRODUTO, preco: undefined },
    { ...NOVO_PRODUTO, preco: 'abc' },
    { ...NOVO_PRODUTO, preco: -1 },
    { ...NOVO_PRODUTO, avaliacao: 6 },
    { ...NOVO_PRODUTO, quantidadeEstoque: -3 }
  ];
  for (const caso of casos) {
    const { status } = await chamar('POST', '/produtos', caso);
    assert.equal(status, 400, JSON.stringify(caso));
  }
  assert.equal(lerBanco().length, 3);
});

test('JSON inválido devolve 400 e o servidor continua respondendo', async () => {
  const { status, corpo } = await chamar('POST', '/produtos', '{ "nome": ');
  assert.equal(status, 400);
  assert.ok(corpo.erro);

  const depois = await chamar('GET', '/produtos');
  assert.equal(depois.status, 200);
});

// ---------- PUT / PATCH ----------

test('PUT altera os campos enviados, inclusive a imagem, e mantém código e criadoEm', async () => {
  const { status, corpo } = await chamar('PUT', '/produtos/200', {
    nome: 'Monitor 27',
    preco: 1099.9,
    imagem: 'img/produtos/monitor-novo.svg',
    codigo: 'tentando-trocar'
  });
  assert.equal(status, 200);
  assert.equal(corpo.nome, 'Monitor 27');
  assert.equal(corpo.preco, 1099.9);
  assert.equal(corpo.imagem, 'img/produtos/monitor-novo.svg');
  assert.equal(corpo.codigo, '200');
  assert.equal(corpo.criadoEm, '2026-11-01T10:00:00.000Z');
  assert.equal(corpo.descricao, 'Monitor de teste');

  assert.equal(lerBanco().find((p) => p.codigo === '200').nome, 'Monitor 27');
});

test('PATCH altera só os campos enviados', async () => {
  const { status, corpo } = await chamar('PATCH', '/produtos/300', { quantidadeEstoque: 2 });
  assert.equal(status, 200);
  assert.equal(corpo.quantidadeEstoque, 2);
  assert.equal(corpo.nome, 'Teclado');
  assert.equal(corpo.preco, 300);
});

test('PUT com valor inválido devolve 400 e não altera o banco', async () => {
  const { status } = await chamar('PUT', '/produtos/200', { preco: 'caro' });
  assert.equal(status, 400);
  assert.equal(lerBanco().find((p) => p.codigo === '200').preco, 900);
});

test('PUT em produto inexistente devolve 404', async () => {
  const { status } = await chamar('PUT', '/produtos/999', { nome: 'X' });
  assert.equal(status, 404);
});

// ---------- DELETE ----------

test('DELETE remove o produto e devolve a mensagem', async () => {
  const { status, corpo } = await chamar('DELETE', '/produtos/300');
  assert.equal(status, 200);
  assert.equal(corpo.produtoExcluido.codigo, '300');
  assert.match(corpo.mensagem, /excluído com sucesso/);
  assert.deepEqual(lerBanco().map((p) => p.codigo), ['100', '200']);
});

test('DELETE em produto inexistente devolve 404', async () => {
  const { status } = await chamar('DELETE', '/produtos/999');
  assert.equal(status, 404);
  assert.equal(lerBanco().length, 3);
});

// ---------- Outros ----------

test('rota desconhecida dentro de /produtos devolve 404', async () => {
  const { status } = await chamar('POST', '/produtos/200');
  assert.equal(status, 404);
});

test('OPTIONS (preflight do CORS) devolve 204 com os cabeçalhos', async () => {
  const resposta = await fetch(`${base}/produtos`, { method: 'OPTIONS' });
  assert.equal(resposta.status, 204);
  assert.equal(resposta.headers.get('access-control-allow-origin'), '*');
});
