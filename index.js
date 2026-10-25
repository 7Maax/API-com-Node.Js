const http = require('http');
const fs = require('fs');
const path = require('path');

const caminhoBanco = path.join(__dirname, 'db.json');

function lerProdutos() {
  const dados = fs.readFileSync(caminhoBanco, 'utf-8');
  return JSON.parse(dados);
}

function salvarProdutos(dados) {
  fs.writeFileSync(caminhoBanco, JSON.stringify(dados, null, 2), 'utf-8');
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body ? JSON.parse(body) : {});
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost:3000');
  const partes = url.pathname.split('/').filter(Boolean);

  if (partes[0] !== 'produtos') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ erro: 'Rota nao encontrada' }));
  }

  const db = lerProdutos();
  const produtos = db.produtos;

  // GET todos ou filtro por categoria/codigo via query
  if (req.method === 'GET' && partes.length === 1) {
    const categoria = url.searchParams.get('categoria');
    const codigo = url.searchParams.get('codigo');

    let lista = produtos;
    if (categoria) {
      lista = lista.filter((p) => p.categoria.toLowerCase() === categoria.toLowerCase());
    }
    if (codigo) {
      lista = lista.filter((p) => String(p.codigo) === String(codigo));
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(lista, null, 2));
  }

  // GET por categoria na rota /produtos/categoria/:categoria
  if (req.method === 'GET' && partes.length === 3 && partes[1] === 'categoria') {
    const categoria = decodeURIComponent(partes[2]);
    const filtrados = produtos.filter(
      (p) => p.categoria.toLowerCase() === categoria.toLowerCase()
    );
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(filtrados, null, 2));
  }

  // GET por codigo do produto
  if (req.method === 'GET' && partes.length === 2) {
    const codigo = partes[1];
    const produto = produtos.find((p) => String(p.codigo) === String(codigo));

    if (!produto) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ erro: 'Produto nao encontrado' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(produto, null, 2));
  }

  // POST criar produto
  if (req.method === 'POST' && partes.length === 1) {
    const dados = await lerCorpo(req);
    const codigo = String(dados.codigo || dados.id);

    const novoProduto = {
      id: codigo,
      codigo: codigo,
      nome: dados.nome,
      preco: Number(dados.preco),
      descricao: dados.descricao,
      quantidadeEstoque: Number(dados.quantidadeEstoque),
      avaliacao: Number(dados.avaliacao),
      categoria: dados.categoria
    };

    const index = produtos.findIndex((p) => String(p.codigo) === codigo);
    if (index !== -1) {
      produtos[index] = novoProduto;
    } else {
      produtos.push(novoProduto);
    }

    salvarProdutos(db);

    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(novoProduto, null, 2));
  }

  // PUT ou PATCH atualizar produto
  if ((req.method === 'PUT' || req.method === 'PATCH') && partes.length === 2) {
    const codigo = partes[1];
    const index = produtos.findIndex((p) => String(p.codigo) === String(codigo));

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ erro: 'Produto nao encontrado' }));
    }

    const dados = await lerCorpo(req);
    const atual = produtos[index];

    produtos[index] = {
      id: atual.id,
      codigo: atual.codigo,
      nome: dados.nome !== undefined ? dados.nome : atual.nome,
      preco: dados.preco !== undefined ? Number(dados.preco) : atual.preco,
      descricao: dados.descricao !== undefined ? dados.descricao : atual.descricao,
      quantidadeEstoque:
        dados.quantidadeEstoque !== undefined
          ? Number(dados.quantidadeEstoque)
          : atual.quantidadeEstoque,
      avaliacao: dados.avaliacao !== undefined ? Number(dados.avaliacao) : atual.avaliacao,
      categoria: dados.categoria !== undefined ? dados.categoria : atual.categoria
    };

    salvarProdutos(db);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(produtos[index], null, 2));
  }

  // DELETE excluir produto
  if (req.method === 'DELETE' && partes.length === 2) {
    const codigo = partes[1];
    const index = produtos.findIndex((p) => String(p.codigo) === String(codigo));

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ erro: 'Produto nao encontrado' }));
    }

    const removido = produtos.splice(index, 1)[0];
    salvarProdutos(db);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(
      JSON.stringify(
        {
          mensagem: `Produto '${removido.nome}' (código ${removido.codigo}) excluído com sucesso.`,
          produtoExcluido: removido
        },
        null,
        2
      )
    );
  }
});

server.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
