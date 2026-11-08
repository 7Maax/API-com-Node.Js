const http = require('http');
const fs = require('fs');
const path = require('path');

// PORT e DB_PATH podem ser trocados por variável de ambiente (os testes usam um banco temporário).
const PORTA = Number(process.env.PORT) || 3000;
const caminhoBanco = process.env.DB_PATH || path.join(__dirname, 'db.json');
const pastaPublica = path.join(__dirname, 'public');

const TIPOS_DE_ARQUIVO = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Código vai na URL (/produtos/:codigo), por isso só letras, números, - e _.
const FORMATO_CODIGO = /^[A-Za-z0-9_-]{1,30}$/;

function lerProdutos() {
  const dados = fs.readFileSync(caminhoBanco, 'utf-8');
  return JSON.parse(dados);
}

function salvarProdutos(dados) {
  fs.writeFileSync(caminhoBanco, JSON.stringify(dados, null, 2), 'utf-8');
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        const erro = new Error('O corpo da requisição não é um JSON válido.');
        erro.status = 400; // vira resposta 400 em vez de derrubar o servidor (ver createServer)
        reject(erro);
      }
    });
    req.on('error', reject);
  });
}

function responderJson(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados, null, 2));
}

function decodificar(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return null;
  }
}

// Junta os dados recebidos com os valores atuais (PUT/PATCH) ou com os padrões (POST).
// Campo não enviado mantém o valor da base.
function montarProduto(dados, base) {
  const texto = (campo) => (dados[campo] !== undefined ? String(dados[campo]).trim() : base[campo]);
  const numero = (campo) => (dados[campo] !== undefined ? Number(dados[campo]) : base[campo]);

  return {
    id: base.id,
    codigo: base.codigo,
    nome: texto('nome'),
    preco: numero('preco'),
    descricao: texto('descricao'),
    quantidadeEstoque: numero('quantidadeEstoque'),
    avaliacao: numero('avaliacao'),
    categoria: texto('categoria'),
    imagem: dados.imagem !== undefined ? String(dados.imagem).trim() : base.imagem || '',
    criadoEm: base.criadoEm
  };
}

function validarProduto(produto) {
  if (!produto.nome) {
    return 'O campo nome é obrigatório.';
  }
  if (!Number.isFinite(produto.preco) || produto.preco < 0) {
    return 'O campo preco deve ser um número maior ou igual a zero.';
  }
  if (!Number.isFinite(produto.quantidadeEstoque) || produto.quantidadeEstoque < 0) {
    return 'O campo quantidadeEstoque deve ser um número maior ou igual a zero.';
  }
  if (!Number.isFinite(produto.avaliacao) || produto.avaliacao < 0 || produto.avaliacao > 5) {
    return 'O campo avaliacao deve ser um número de 0 a 5.';
  }
  return null;
}

// Mais recente primeiro. Produtos sem criadoEm (cadastrados antes do campo existir)
// ficam por último, na ordem inversa do banco.
function ordenarPorRecentes(lista) {
  return lista
    .map((produto, posicao) => ({ produto, posicao }))
    .sort((a, b) => {
      const dataA = a.produto.criadoEm || '';
      const dataB = b.produto.criadoEm || '';
      if (dataA !== dataB) {
        return dataA < dataB ? 1 : -1;
      }
      return b.posicao - a.posicao;
    })
    .map((item) => item.produto);
}

function servirArquivo(req, res, pathname) {
  if (req.method !== 'GET') {
    return responderJson(res, 404, { erro: 'Rota não encontrada' });
  }

  let relativo = decodificar(pathname);
  if (relativo === null || relativo.includes('\0')) {
    return responderJson(res, 404, { erro: 'Arquivo não encontrado' });
  }
  if (relativo.endsWith('/')) {
    relativo += 'index.html';
  }

  // path.join resolve "..": se o caminho final sair de public/, não entrega (protege o db.json).
  const caminho = path.join(pastaPublica, relativo);
  if (!caminho.startsWith(pastaPublica + path.sep)) {
    return responderJson(res, 404, { erro: 'Arquivo não encontrado' });
  }

  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) {
      return responderJson(res, 404, { erro: 'Arquivo não encontrado' });
    }
    const tipo = TIPOS_DE_ARQUIVO[path.extname(caminho).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': tipo });
    res.end(conteudo);
  });
}

async function tratarRequisicao(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const partes = url.pathname.split('/').filter(Boolean);

  // Tudo que não começa com /produtos é arquivo do front-end (pasta public/).
  if (partes[0] !== 'produtos') {
    return servirArquivo(req, res, url.pathname);
  }

  const db = lerProdutos();
  const produtos = db.produtos;
  const codigoDaUrl = partes[1] !== undefined ? decodificar(partes[1]) : undefined;

  // GET todos, com filtros opcionais: ?categoria=, ?codigo= e ?limite= (os N mais recentes)
  if (req.method === 'GET' && partes.length === 1) {
    const categoria = url.searchParams.get('categoria');
    const codigo = url.searchParams.get('codigo');
    const limite = url.searchParams.get('limite');

    let lista = produtos;
    if (categoria) {
      lista = lista.filter((p) => String(p.categoria || '').toLowerCase() === categoria.toLowerCase());
    }
    if (codigo) {
      lista = lista.filter((p) => String(p.codigo) === String(codigo));
    }
    if (limite !== null) {
      const quantidade = Number(limite);
      if (!Number.isInteger(quantidade) || quantidade < 1) {
        return responderJson(res, 400, {
          erro: 'O parâmetro limite deve ser um número inteiro maior que zero.'
        });
      }
      lista = ordenarPorRecentes(lista).slice(0, quantidade);
    }

    return responderJson(res, 200, lista);
  }

  // GET por categoria na rota /produtos/categoria/:categoria
  if (req.method === 'GET' && partes.length === 3 && partes[1] === 'categoria') {
    const categoria = decodificar(partes[2]) || '';
    const filtrados = produtos.filter(
      (p) => String(p.categoria || '').toLowerCase() === categoria.toLowerCase()
    );
    return responderJson(res, 200, filtrados);
  }

  // GET por codigo do produto
  if (req.method === 'GET' && partes.length === 2) {
    const produto = produtos.find((p) => String(p.codigo) === codigoDaUrl);

    if (!produto) {
      return responderJson(res, 404, { erro: 'Produto não encontrado' });
    }

    return responderJson(res, 200, produto);
  }

  // POST criar produto
  if (req.method === 'POST' && partes.length === 1) {
    const dados = await lerCorpo(req);
    const codigo = String(dados.codigo ?? dados.id ?? '').trim();

    if (!FORMATO_CODIGO.test(codigo)) {
      return responderJson(res, 400, {
        erro: 'Informe um código com até 30 letras, números, - ou _.'
      });
    }

    if (produtos.some((p) => String(p.codigo) === codigo)) {
      return responderJson(res, 409, { erro: `Já existe um produto com o código ${codigo}.` });
    }

    const novoProduto = montarProduto(dados, {
      id: codigo,
      codigo: codigo,
      nome: '',
      preco: NaN, // obrigatório: sem preço, a validação recusa
      descricao: '',
      quantidadeEstoque: 0,
      avaliacao: 0,
      categoria: '',
      imagem: '',
      criadoEm: new Date().toISOString()
    });

    const erro = validarProduto(novoProduto);
    if (erro) {
      return responderJson(res, 400, { erro });
    }

    produtos.push(novoProduto);
    salvarProdutos(db);

    return responderJson(res, 201, novoProduto);
  }

  // PUT ou PATCH atualizar produto (campos não enviados mantêm o valor atual)
  if ((req.method === 'PUT' || req.method === 'PATCH') && partes.length === 2) {
    const index = produtos.findIndex((p) => String(p.codigo) === codigoDaUrl);

    if (index === -1) {
      return responderJson(res, 404, { erro: 'Produto não encontrado' });
    }

    const dados = await lerCorpo(req);
    const atualizado = montarProduto(dados, produtos[index]);

    const erro = validarProduto(atualizado);
    if (erro) {
      return responderJson(res, 400, { erro });
    }

    produtos[index] = atualizado;
    salvarProdutos(db);

    return responderJson(res, 200, atualizado);
  }

  // DELETE excluir produto
  if (req.method === 'DELETE' && partes.length === 2) {
    const index = produtos.findIndex((p) => String(p.codigo) === codigoDaUrl);

    if (index === -1) {
      return responderJson(res, 404, { erro: 'Produto não encontrado' });
    }

    const removido = produtos.splice(index, 1)[0];
    salvarProdutos(db);

    return responderJson(res, 200, {
      mensagem: `Produto '${removido.nome}' (código ${removido.codigo}) excluído com sucesso.`,
      produtoExcluido: removido
    });
  }

  return responderJson(res, 404, { erro: 'Rota não encontrada' });
}

const server = http.createServer(async (req, res) => {
  try {
    await tratarRequisicao(req, res);
  } catch (erro) {
    if (res.headersSent) {
      return res.end();
    }
    if (erro.status === 400) {
      return responderJson(res, 400, { erro: erro.message });
    }
    console.error(erro);
    return responderJson(res, 500, { erro: 'Erro interno do servidor.' });
  }
});

// Só sobe o servidor quando executado direto (npm start). Nos testes, o arquivo é importado.
if (require.main === module) {
  server.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}`);
  });
}

module.exports = { server };
