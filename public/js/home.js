// Página principal: carrossel de destaques, últimos 12 produtos e cadastro de novo produto.

const QUANTIDADE_RECENTES = 12;
const QUANTIDADE_DESTAQUES = 3;

const secaoDestaque = document.getElementById('secao-destaque');
const carrossel = document.getElementById('carrossel-destaque');
const destaqueIndicadores = document.getElementById('destaque-indicadores');
const destaqueItens = document.getElementById('destaque-itens');
const estadoProdutos = document.getElementById('estado-produtos');
const gradeProdutos = document.getElementById('grade-produtos');
const formNovo = document.getElementById('form-novo-produto');
const modalNovoElemento = document.getElementById('modal-novo-produto');
const modalNovo = bootstrap.Modal.getOrCreateInstance(modalNovoElemento);
const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Carregar e desenhar ----------

async function carregarProdutos() {
  estadoProdutos.replaceChildren(criarCarregando('Carregando produtos'));
  try {
    const produtos = await listarRecentes(QUANTIDADE_RECENTES);
    estadoProdutos.replaceChildren();
    renderizarGrade(produtos);
    renderizarDestaques(produtos);
    if (produtos.length === 0) {
      mostrarVazio();
    }
  } catch (erro) {
    gradeProdutos.replaceChildren();
    secaoDestaque.hidden = true;
    mostrarErro(erro.message);
  }
}

function renderizarGrade(produtos) {
  gradeProdutos.replaceChildren(...produtos.map(criarCard));
}

function criarCard(produto) {
  return criarElemento('div', { classe: 'col' }, [
    criarElemento('article', { classe: 'produto-card' }, [
      criarElemento('div', { classe: 'produto-card__imagem' }, [criarImagemProduto(produto)]),
      criarElemento('div', { classe: 'produto-card__corpo' }, [
        criarElemento('p', { classe: 'produto-card__categoria', texto: produto.categoria }),
        criarElemento('h3', { classe: 'produto-card__nome', texto: produto.nome }),
        criarElemento('p', { classe: 'produto-card__preco', texto: formatarPreco(produto.preco) }),
        criarElemento('a', {
          classe: 'btn btn-outline-primary w-100 stretched-link',
          href: linkDetalhes(produto),
          'aria-label': `Ver detalhes de ${produto.nome}`,
          texto: 'Ver detalhes'
        })
      ])
    ])
  ]);
}

function renderizarDestaques(produtos) {
  // sort é estável: em caso de empate na avaliação, vale a ordem de mais recente
  const destaques = [...produtos]
    .sort((a, b) => (b.avaliacao || 0) - (a.avaliacao || 0))
    .slice(0, QUANTIDADE_DESTAQUES);

  secaoDestaque.hidden = destaques.length === 0;
  bootstrap.Carousel.getInstance(carrossel)?.dispose();

  destaqueIndicadores.replaceChildren(
    ...destaques.map((produto, indice) =>
      criarElemento('button', {
        type: 'button',
        classe: indice === 0 ? 'active' : '',
        'data-bs-target': '#carrossel-destaque',
        'data-bs-slide-to': String(indice),
        'aria-label': `Destaque ${indice + 1}: ${produto.nome}`,
        'aria-current': indice === 0 ? 'true' : null
      })
    )
  );
  destaqueItens.replaceChildren(...destaques.map((produto, indice) => criarSlide(produto, indice === 0)));

  const variosSlides = destaques.length > 1;
  destaqueIndicadores.hidden = !variosSlides;
  carrossel
    .querySelectorAll('.carousel-control-prev, .carousel-control-next')
    .forEach((botao) => (botao.hidden = !variosSlides));

  if (destaques.length > 0) {
    new bootstrap.Carousel(carrossel, {
      interval: movimentoReduzido ? false : 6000,
      ride: movimentoReduzido ? false : 'carousel',
      pause: 'hover'
    });
  }
}

function criarSlide(produto, ativo) {
  return criarElemento('div', { classe: ativo ? 'carousel-item active' : 'carousel-item' }, [
    criarElemento('div', { classe: 'destaque-slide' }, [
      criarElemento('div', { classe: 'destaque-slide__imagem' }, [
        criarImagemProduto(produto, { adiar: false })
      ]),
      criarElemento('div', { classe: 'destaque-slide__info' }, [
        criarElemento('p', { classe: 'destaque-slide__categoria', texto: produto.categoria }),
        criarElemento('h3', { classe: 'destaque-slide__nome', texto: produto.nome }),
        criarEstrelas(produto.avaliacao),
        criarElemento('div', {}, [
          criarElemento('p', { classe: 'preco-pad', texto: formatarPreco(produto.preco) })
        ]),
        criarElemento('a', {
          classe: 'btn btn-light',
          href: linkDetalhes(produto),
          'aria-label': `Ver detalhes de ${produto.nome}`,
          texto: 'Ver detalhes'
        })
      ])
    ])
  ]);
}

function mostrarVazio() {
  estadoProdutos.replaceChildren(
    criarElemento('div', { classe: 'estado' }, [
      criarElemento('p', { texto: 'Nenhum produto cadastrado ainda.' }),
      criarElemento('button', {
        type: 'button',
        classe: 'btn btn-primary',
        'data-bs-toggle': 'modal',
        'data-bs-target': '#modal-novo-produto',
        texto: 'Cadastrar o primeiro produto'
      })
    ])
  );
}

function mostrarErro(mensagem) {
  const botaoTentar = criarElemento('button', {
    type: 'button',
    classe: 'btn btn-outline-primary btn-sm',
    texto: 'Tentar novamente'
  });
  botaoTentar.addEventListener('click', carregarProdutos);

  estadoProdutos.replaceChildren(
    criarElemento('div', { classe: 'alert alert-warning', role: 'alert' }, [
      criarElemento('p', { classe: 'fw-semibold mb-1', texto: 'Não foi possível carregar os produtos.' }),
      criarElemento('p', { classe: 'mb-2', texto: mensagem }),
      botaoTentar
    ])
  );
}

// ---------- Cadastro (modal "Novo produto") ----------

aoEnviarProduto(formNovo, 'Cadastrando…', async (dados) => {
  const produto = await criarProduto(dados);
  modalNovo.hide();
  mostrarNotificacao(`Produto cadastrado: ${produto.nome}`);
  await carregarProdutos();
});

modalNovoElemento.addEventListener('hidden.bs.modal', () => limparFormulario(formNovo));
ligarPrevia(formNovo);
preencherSugestoes();

// Vindo do link "Novo produto" da página de detalhes (index.html#novo): abre o modal.
if (window.location.hash === '#novo') {
  modalNovo.show();
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Vindo da exclusão na página de detalhes (index.html?excluido=Nome): avisa e limpa a URL.
const parametros = new URLSearchParams(window.location.search);
if (parametros.has('excluido')) {
  mostrarNotificacao(`Produto excluído: ${parametros.get('excluido')}`);
  history.replaceState(null, '', window.location.pathname);
}

carregarProdutos();
