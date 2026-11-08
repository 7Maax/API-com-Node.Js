// Funções de apoio usadas pelas duas páginas: formatação, montagem de elementos e formulários.
// Textos vindos da API sempre entram com textContent (nunca innerHTML) para evitar XSS.

const IMAGEM_PADRAO = 'img/placeholder.svg';

// Sugestões do campo "Imagem" nos formulários (arquivos da pasta public/img/produtos).
const IMAGENS_LOCAIS = [
  'img/produtos/cadeira.svg',
  'img/produtos/caixa-de-som.svg',
  'img/produtos/controle.svg',
  'img/produtos/headset.svg',
  'img/produtos/microfone.svg',
  'img/produtos/monitor.svg',
  'img/produtos/mouse.svg',
  'img/produtos/notebook.svg',
  'img/produtos/roteador.svg',
  'img/produtos/smartphone.svg',
  'img/produtos/ssd.svg',
  'img/produtos/teclado.svg',
  'img/produtos/webcam.svg'
];

const CATEGORIAS_SUGERIDAS = [
  'Armazenamento',
  'Audio',
  'Games',
  'Informatica',
  'Monitores',
  'Moveis',
  'Perifericos',
  'Redes',
  'Smartphones'
];

const CAMPOS_PRODUTO = [
  'codigo',
  'nome',
  'preco',
  'quantidadeEstoque',
  'avaliacao',
  'categoria',
  'imagem',
  'descricao'
];

const formatoPreco = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ---------- Formatação ----------

function formatarPreco(valor) {
  return Number.isFinite(valor) ? formatoPreco.format(valor) : 'Preço não informado';
}

function formatarNota(valor) {
  return formatoNota.format(Number.isFinite(valor) ? valor : 0);
}

function formatarData(iso) {
  const data = new Date(iso);
  if (!iso || Number.isNaN(data.getTime())) {
    return 'Não informado';
  }
  return data.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
}

function formatarEstoque(quantidade) {
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return 'Sem estoque';
  }
  return quantidade === 1 ? '1 unidade' : `${quantidade} unidades`;
}

function linkDetalhes(produto) {
  return `detalhes.html?codigo=${encodeURIComponent(produto.codigo)}`;
}

// ---------- Elementos ----------

// criarElemento('p', { classe: 'x', texto: 'Olá', href: '...' }, [filhos])
function criarElemento(tag, propriedades = {}, filhos = []) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(propriedades)) {
    if (valor === undefined || valor === null) continue;
    if (nome === 'classe') elemento.className = valor;
    else if (nome === 'texto') elemento.textContent = valor;
    else elemento.setAttribute(nome, valor);
  }
  elemento.append(...filhos);
  return elemento;
}

// Usa a imagem do produto; se estiver vazia ou quebrada, mostra a imagem padrão.
function definirImagem(img, produto) {
  img.onerror = () => {
    img.onerror = null;
    img.src = IMAGEM_PADRAO;
  };
  img.src = produto.imagem || IMAGEM_PADRAO;
  img.alt = produto.nome || '';
}

function criarImagemProduto(produto, { adiar = true } = {}) {
  const img = criarElemento('img', {
    width: '400',
    height: '300',
    loading: adiar ? 'lazy' : 'eager'
  });
  definirImagem(img, produto);
  return img;
}

// Estrelas arredondadas para a meia estrela mais próxima (4,6 → 4 e meia).
function criarEstrelas(avaliacao) {
  const nota = Number.isFinite(avaliacao) ? avaliacao : 0;
  const meias = Math.round(nota * 2);
  const cheias = Math.floor(meias / 2);
  const temMeia = meias % 2 === 1;

  const estrelas = criarElemento('span', {
    classe: 'avaliacao',
    role: 'img',
    'aria-label': `Avaliação ${formatarNota(nota)} de 5`
  });
  for (let i = 0; i < 5; i++) {
    let icone = 'bi-star';
    if (i < cheias) icone = 'bi-star-fill';
    else if (i === cheias && temMeia) icone = 'bi-star-half';
    estrelas.append(criarElemento('i', { classe: `bi ${icone}`, 'aria-hidden': 'true' }));
  }
  estrelas.append(
    criarElemento('span', { classe: 'avaliacao__nota', 'aria-hidden': 'true', texto: formatarNota(nota) })
  );
  return estrelas;
}

function criarCarregando(texto) {
  return criarElemento('div', { classe: 'estado' }, [
    criarElemento('div', { classe: 'spinner-border text-success', role: 'status' }, [
      criarElemento('span', { classe: 'visually-hidden', texto })
    ])
  ]);
}

function mostrarNotificacao(mensagem) {
  const toast = document.getElementById('notificacao');
  toast.querySelector('.toast-body').textContent = mensagem;
  bootstrap.Toast.getOrCreateInstance(toast).show();
}

// ---------- Formulários de produto (cadastro e edição) ----------

function preencherSugestoes() {
  const imagens = document.getElementById('sugestoes-imagem');
  const categorias = document.getElementById('sugestoes-categoria');
  imagens?.replaceChildren(...IMAGENS_LOCAIS.map((valor) => criarElemento('option', { value: valor })));
  categorias?.replaceChildren(...CATEGORIAS_SUGERIDAS.map((valor) => criarElemento('option', { value: valor })));
}

function lerFormularioProduto(form) {
  const dados = new FormData(form);
  const texto = (campo) => String(dados.get(campo) ?? '').trim();
  return {
    codigo: texto('codigo'),
    nome: texto('nome'),
    preco: Number(texto('preco')),
    quantidadeEstoque: Number(texto('quantidadeEstoque') || 0),
    avaliacao: Number(texto('avaliacao') || 0),
    categoria: texto('categoria'),
    imagem: texto('imagem'),
    descricao: texto('descricao')
  };
}

function preencherFormularioProduto(form, produto) {
  for (const campo of CAMPOS_PRODUTO) {
    const entrada = form.elements.namedItem(campo);
    if (entrada) entrada.value = produto[campo] ?? '';
  }
  atualizarPrevia(form);
}

function atualizarPrevia(form) {
  const img = form.querySelector('[data-previa]');
  if (!img) return;
  const caminho = form.elements.namedItem('imagem').value.trim();
  definirImagem(img, { imagem: caminho, nome: 'Prévia da imagem' });
}

function ligarPrevia(form) {
  form.elements.namedItem('imagem').addEventListener('input', () => atualizarPrevia(form));
}

function mostrarAviso(raiz, mensagem) {
  const aviso = raiz.querySelector('[data-aviso]');
  aviso.textContent = mensagem;
  aviso.classList.remove('d-none');
}

function esconderAviso(raiz) {
  const aviso = raiz.querySelector('[data-aviso]');
  aviso.textContent = '';
  aviso.classList.add('d-none');
}

function limparFormulario(form) {
  form.reset();
  form.classList.remove('was-validated');
  esconderAviso(form);
  atualizarPrevia(form);
}

function bloquearBotao(botao, textoCarregando) {
  botao.dataset.conteudoOriginal = botao.innerHTML; // conteúdo fixo do próprio HTML
  botao.disabled = true;
  botao.replaceChildren(
    criarElemento('span', { classe: 'spinner-border spinner-border-sm me-2', 'aria-hidden': 'true' }),
    textoCarregando
  );
}

function liberarBotao(botao) {
  botao.disabled = false;
  botao.innerHTML = botao.dataset.conteudoOriginal;
}

// Valida com o HTML (required, min, max...) e só chama a API se estiver tudo certo.
function aoEnviarProduto(form, textoCarregando, acao) {
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    esconderAviso(form);

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      form.querySelector(':invalid')?.focus();
      return;
    }

    const botao = form.querySelector('[type="submit"]');
    bloquearBotao(botao, textoCarregando);
    try {
      await acao(lerFormularioProduto(form));
    } catch (erro) {
      mostrarAviso(form, erro.message);
    } finally {
      liberarBotao(botao);
    }
  });
}
