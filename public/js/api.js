// Integração com a API de produtos.
// Todo fetch do front-end fica neste arquivo; as páginas só chamam as funções abaixo.

// Servido pelo Node (npm start): usa o mesmo endereço da página.
// Aberto direto do disco (file://): aponta para a API em localhost:3000.
const API_URL =
  window.location.protocol === 'file:'
    ? 'http://localhost:3000/produtos'
    : `${window.location.origin}/produtos`;

async function requisitar(url, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw new Error('Não foi possível conectar à API. Confira se o servidor está rodando com npm start.');
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = new Error(dados?.erro || `A API respondeu com o erro ${resposta.status}.`);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

// GET /produtos?limite=12: os mais recentes primeiro
function listarRecentes(limite) {
  return requisitar(`${API_URL}?limite=${limite}`);
}

// GET /produtos/:codigo
function buscarProduto(codigo) {
  return requisitar(`${API_URL}/${encodeURIComponent(codigo)}`);
}

// POST /produtos
function criarProduto(produto) {
  return requisitar(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(produto)
  });
}

// PUT /produtos/:codigo
function atualizarProduto(codigo, produto) {
  return requisitar(`${API_URL}/${encodeURIComponent(codigo)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(produto)
  });
}

// DELETE /produtos/:codigo
function excluirProduto(codigo) {
  return requisitar(`${API_URL}/${encodeURIComponent(codigo)}`, {
    method: 'DELETE'
  });
}
