// Página de detalhes: mostra todos os campos do produto, edita (modal) e exclui (com confirmação).
// O produto vem da URL: detalhes.html?codigo=1595154

const codigoProduto = new URLSearchParams(window.location.search).get('codigo');

const carregando = document.getElementById('detalhe-carregando');
const aviso = document.getElementById('detalhe-aviso');
const conteudo = document.getElementById('detalhe-conteudo');
const campos = {
  imagem: document.getElementById('detalhe-imagem'),
  categoria: document.getElementById('detalhe-categoria'),
  nome: document.getElementById('detalhe-nome'),
  avaliacao: document.getElementById('detalhe-avaliacao'),
  preco: document.getElementById('detalhe-preco'),
  descricao: document.getElementById('detalhe-descricao'),
  codigo: document.getElementById('detalhe-codigo'),
  id: document.getElementById('detalhe-id'),
  fichaCategoria: document.getElementById('detalhe-ficha-categoria'),
  estoque: document.getElementById('detalhe-estoque'),
  fichaAvaliacao: document.getElementById('detalhe-ficha-avaliacao'),
  caminhoImagem: document.getElementById('detalhe-caminho-imagem'),
  criadoEm: document.getElementById('detalhe-criado')
};

const formEditar = document.getElementById('form-editar-produto');
const modalEditarElemento = document.getElementById('modal-editar-produto');
const modalEditar = bootstrap.Modal.getOrCreateInstance(modalEditarElemento);
const modalExcluirElemento = document.getElementById('modal-excluir-produto');
const botaoConfirmarExclusao = document.getElementById('confirmar-exclusao');

let produtoAtual = null;

// ---------- Carregar e desenhar ----------

async function carregarProduto() {
  if (!codigoProduto) {
    mostrarNaoEncontrado();
    return;
  }
  try {
    const produto = await buscarProduto(codigoProduto);
    renderizarProduto(produto);
  } catch (erro) {
    if (erro.status === 404) mostrarNaoEncontrado();
    else mostrarErro(erro.message);
  }
}

function renderizarProduto(produto) {
  produtoAtual = produto;
  document.title = `${produto.nome} | Vitrine Tech`;

  definirImagem(campos.imagem, produto);
  campos.categoria.textContent = produto.categoria || 'Sem categoria';
  campos.nome.textContent = produto.nome;
  campos.avaliacao.replaceChildren(criarEstrelas(produto.avaliacao));
  campos.preco.textContent = formatarPreco(produto.preco);
  campos.descricao.textContent = produto.descricao || 'Sem descrição cadastrada.';
  campos.codigo.textContent = produto.codigo;
  campos.id.textContent = produto.id;
  campos.fichaCategoria.textContent = produto.categoria || 'Sem categoria';
  campos.estoque.textContent = formatarEstoque(produto.quantidadeEstoque);
  campos.fichaAvaliacao.textContent = `${formatarNota(produto.avaliacao)} de 5`;
  campos.caminhoImagem.textContent = produto.imagem || 'Sem imagem';
  campos.criadoEm.textContent = formatarData(produto.criadoEm);

  carregando.hidden = true;
  aviso.hidden = true;
  conteudo.hidden = false;
}

function mostrarNaoEncontrado() {
  document.title = 'Produto não encontrado | Vitrine Tech';
  const mensagem = codigoProduto
    ? `Não existe produto com o código ${codigoProduto}. Ele pode ter sido excluído.`
    : 'Nenhum código de produto foi informado no endereço da página.';

  aviso.replaceChildren(
    criarElemento('div', { classe: 'estado' }, [
      criarElemento('h1', { classe: 'h3', texto: 'Produto não encontrado' }),
      criarElemento('p', { texto: mensagem }),
      criarElemento('a', { classe: 'btn btn-primary', href: 'index.html', texto: 'Ver os últimos produtos' })
    ])
  );
  carregando.hidden = true;
  conteudo.hidden = true;
  aviso.hidden = false;
}

function mostrarErro(mensagem) {
  const botaoTentar = criarElemento('button', {
    type: 'button',
    classe: 'btn btn-outline-primary btn-sm',
    texto: 'Tentar novamente'
  });
  botaoTentar.addEventListener('click', () => {
    aviso.hidden = true;
    carregando.hidden = false;
    carregarProduto();
  });

  aviso.replaceChildren(
    criarElemento('div', { classe: 'alert alert-warning mt-4', role: 'alert' }, [
      criarElemento('p', { classe: 'fw-semibold mb-1', texto: 'Não foi possível carregar o produto.' }),
      criarElemento('p', { classe: 'mb-2', texto: mensagem }),
      botaoTentar
    ])
  );
  carregando.hidden = true;
  conteudo.hidden = true;
  aviso.hidden = false;
}

// ---------- Edição (modal "Editar produto") ----------

modalEditarElemento.addEventListener('show.bs.modal', () => {
  limparFormulario(formEditar);
  preencherFormularioProduto(formEditar, produtoAtual);
});

aoEnviarProduto(formEditar, 'Salvando…', async (dados) => {
  const atualizado = await atualizarProduto(produtoAtual.codigo, dados);
  renderizarProduto(atualizado);
  modalEditar.hide();
  mostrarNotificacao('Alterações salvas');
});

ligarPrevia(formEditar);
preencherSugestoes();

// ---------- Exclusão (modal de confirmação) ----------

modalExcluirElemento.addEventListener('show.bs.modal', () => {
  esconderAviso(modalExcluirElemento);
  document.getElementById('excluir-nome').textContent = produtoAtual.nome;
});

botaoConfirmarExclusao.addEventListener('click', async () => {
  bloquearBotao(botaoConfirmarExclusao, 'Excluindo…');
  try {
    await excluirProduto(produtoAtual.codigo);
    // volta para a Home, que mostra o aviso "Produto excluído"
    window.location.href = `index.html?excluido=${encodeURIComponent(produtoAtual.nome)}`;
  } catch (erro) {
    mostrarAviso(modalExcluirElemento, erro.message);
    liberarBotao(botaoConfirmarExclusao);
  }
});

carregarProduto();
