// Testes da entrega dos arquivos do front-end (pasta public/). Rodar com: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'api-produtos-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'db.json');
fs.writeFileSync(process.env.DB_PATH, JSON.stringify({ produtos: [] }));

const { server } = require('../index.js');

let porta;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  porta = server.address().port;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(pastaTemporaria, { recursive: true, force: true });
});

// http.get envia o caminho exatamente como escrito (o fetch normalizaria o "..").
function requisicaoCrua(caminho, metodo = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: metodo }, (res) => {
      let corpo = '';
      res.on('data', (parte) => (corpo += parte));
      res.on('end', () => resolve({ status: res.statusCode, tipo: res.headers['content-type'], corpo }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET / entrega a Home', async () => {
  const { status, tipo, corpo } = await requisicaoCrua('/');
  assert.equal(status, 200);
  assert.match(tipo, /text\/html/);
  assert.match(corpo, /<!doctype html>/i);
  assert.match(corpo, /js\/home\.js/);
});

test('arquivos do front-end saem com o Content-Type certo', async () => {
  const casos = [
    ['/detalhes.html', /text\/html/],
    ['/css/style.css', /text\/css/],
    ['/js/api.js', /text\/javascript/],
    ['/img/placeholder.svg', /image\/svg\+xml/],
    ['/img/produtos/notebook.svg', /image\/svg\+xml/]
  ];
  for (const [caminho, tipoEsperado] of casos) {
    const { status, tipo } = await requisicaoCrua(caminho);
    assert.equal(status, 200, caminho);
    assert.match(tipo, tipoEsperado, caminho);
  }
});

test('arquivo inexistente devolve 404', async () => {
  const { status } = await requisicaoCrua('/nao-existe.html');
  assert.equal(status, 404);
});

test('não entrega arquivos fora de public/ (db.json, index.js)', async () => {
  const tentativas = [
    '/../db.json',
    '/%2e%2e/db.json',
    '/..%2fdb.json',
    '/%2e%2e%2fdb.json',
    '/css/..%2f..%2fdb.json',
    '/%2e%2e%2findex.js',
    '/img/%00.svg'
  ];
  for (const caminho of tentativas) {
    const { status, corpo } = await requisicaoCrua(caminho);
    assert.equal(status, 404, caminho);
    assert.doesNotMatch(corpo, /"produtos"|require\(/, caminho);
  }
});

test('POST fora de /produtos devolve 404', async () => {
  const { status } = await requisicaoCrua('/index.html', 'POST');
  assert.equal(status, 404);
});
