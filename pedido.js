/* =====================================================
   CONCÓRDIA'S DO SIDI – Pedido online
   O cliente monta o pedido no site e ele vai pronto para o
   WhatsApp, onde a pizzaria confirma. Não há backend nem
   pagamento online: o WhatsApp continua sendo o balcão.
   ===================================================== */
(function () {
  'use strict';

  const raiz = document.getElementById('pedido');
  if (!raiz) return;

  const WHATSAPP = '5555991222706';
  const TAXA_ENTREGA = 10;
  const PRECO_BORDA = 6;
  const CHAVE = 'concordia-pedido-v1';

  // Se mudar algum preço, atualize aqui E na aba "Preços" do cardápio (index.html).
  // A GG vem primeiro e já selecionada porque é a mais pedida.
  const TAMANHOS = {
    GG:    { nome: 'Pizza GG',     medida: '40 cm',    desc: 'até 4 sabores',      preco: 105, refri: '2L',    destaque: 'Mais pedida', pizzas: [{ rotulo: 'GG', max: 4 }] },
    G:     { nome: 'Pizza G',      medida: '35 cm',    desc: 'até 4 sabores',      preco: 95,  refri: '2L',    pizzas: [{ rotulo: 'G', max: 4 }] },
    M:     { nome: 'Pizza M',      medida: '30 cm',    desc: 'até 3 sabores',      preco: 80,  refri: '600ml', pizzas: [{ rotulo: 'M', max: 3 }] },
    COMBO: { nome: 'Combo GG + M', medida: '2 pizzas', desc: 'GG até 4 · M até 3', preco: 160, refri: '2L',    pizzas: [{ rotulo: 'GG', max: 4 }, { rotulo: 'M', max: 3 }] }
  };
  const ORDEM = ['GG', 'G', 'M', 'COMBO'];
  const BORDAS = [
    { valor: '',         nome: 'Sem borda', extra: 0 },
    { valor: 'Catupiry', nome: 'Catupiry',  extra: PRECO_BORDA },
    { valor: 'Cheddar',  nome: 'Cheddar',   extra: PRECO_BORDA }
  ];

  // ---------- utilitários ----------
  const $ = sel => document.querySelector(sel);
  const moeda = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalizar = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- sabores: lidos do próprio cardápio ----------
  // Assim, se alguém editar o cardápio no HTML, o pedido acompanha sozinho.
  function lerSabores(id, grupo) {
    const box = document.getElementById(id);
    if (!box) return [];
    return Array.from(box.querySelectorAll('.pizza-item')).map(item => {
      const nomeEl = item.querySelector('.pi-name');
      const nome = Array.from(nomeEl.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent).join('').trim();
      const descEl = item.querySelector('.pi-desc');
      // data-mais-pedida no cartão do cardápio = aparece em "Mais pedidas" aqui.
      return { nome, grupo, top: item.hasAttribute('data-mais-pedida'), desc: descEl ? descEl.textContent.trim() : '' };
    }).filter(s => s.nome);
  }
  const SABORES = lerSabores('tab-salgadas', 'Salgadas').concat(lerSabores('tab-doces', 'Doces'));

  // ---------- filés: lidos do próprio cardápio, inclusive o preço ----------
  function lerFiles() {
    const mapa = {};
    document.querySelectorAll('#tab-files .file-card').forEach(card => {
      const nome = card.querySelector('h3').textContent.trim();
      const descEl = card.querySelector('p');
      const preco = parseFloat(card.querySelector('.file-preco').textContent.replace(/[^\d,]/g, '').replace(',', '.'));
      if (nome && preco > 0) mapa[nome] = { nome, desc: descEl ? descEl.textContent.trim() : '', preco };
    });
    return mapa;
  }
  const FILES = lerFiles();
  const ehFile = item => item.tipo === 'file';

  // ---------- estado ----------
  const estado = {
    tamanho: 'GG',
    montagem: [],   // uma entrada por pizza do tamanho: { sabores: [], borda: '' }
    ativa: 0,       // no combo: qual das duas pizzas está sendo montada
    filtro: 'Salgadas',
    busca: '',
    carrinho: [],   // [{ tamanho, pizzas: [{ rotulo, sabores, borda }] }]
    form: { nome: '', receber: 'entrega', endereco: '', bairro: '', referencia: '', pagamento: '', troco: '', obs: '' }
  };

  // Guarda o pedido no aparelho: se a pessoa recarregar a página, não perde nada.
  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (!salvo) return;
      if (Array.isArray(salvo.carrinho)) {
        estado.carrinho = salvo.carrinho.filter(i => i && ((ehFile(i) && FILES[i.nome]) || (TAMANHOS[i.tamanho] && Array.isArray(i.pizzas))));
      }
      if (salvo.form && typeof salvo.form === 'object') {
        Object.keys(estado.form).forEach(k => { if (typeof salvo.form[k] === 'string') estado.form[k] = salvo.form[k]; });
      }
    } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ carrinho: estado.carrinho, form: estado.form })); } catch (e) { /* ok */ }
  }

  // Preço sempre recalculado da tabela, nunca do que ficou salvo.
  const precoItem = item => ehFile(item) ? FILES[item.nome].preco : TAMANHOS[item.tamanho].preco + item.pizzas.filter(p => p.borda).length * PRECO_BORDA;
  const precoMontagem = () => TAMANHOS[estado.tamanho].preco + estado.montagem.filter(m => m.borda).length * PRECO_BORDA;
  const pizzaAtiva = () => TAMANHOS[estado.tamanho].pizzas[estado.ativa];
  const montagemAtiva = () => estado.montagem[estado.ativa];

  function totais() {
    const pizzas = estado.carrinho.reduce((s, i) => s + precoItem(i), 0);
    const entrega = estado.carrinho.length && estado.form.receber === 'entrega' ? TAXA_ENTREGA : 0;
    return { pizzas, entrega, total: pizzas + entrega };
  }

  // Trocar de tamanho aproveita os sabores já escolhidos (cortando o excesso).
  function escolherTamanho(t, zerar) {
    const anterior = zerar ? [] : estado.montagem;
    estado.tamanho = t;
    estado.montagem = TAMANHOS[t].pizzas.map((p, i) => {
      const velho = anterior[i] || { sabores: [], borda: '' };
      return { sabores: velho.sabores.slice(0, p.max), borda: velho.borda };
    });
    estado.ativa = 0;
    avisar('');
    renderTamanhos();
    renderMontagem();
  }

  // ---------- render: montador ----------
  function renderTamanhos() {
    $('#pm-tamanhos').innerHTML = ORDEM.map(k => {
      const t = TAMANHOS[k];
      return `<label class="tamanho${t.destaque ? ' tamanho--destaque' : ''}">
        <input type="radio" name="pm-tamanho" value="${k}"${k === estado.tamanho ? ' checked' : ''} />
        <span class="tamanho-box">
          ${t.destaque ? `<span class="tamanho-badge">${t.destaque}</span>` : ''}
          <span class="tamanho-nome">${t.nome.replace(' + ', ' + ')}</span>
          <span class="tamanho-desc">${t.medida} · ${t.desc}</span>
          <span class="tamanho-preco">${moeda(t.preco)}</span>
          <span class="tamanho-refri">+ refri ${t.refri}</span>
        </span>
      </label>`;
    }).join('');
  }

  function renderSubtabs() {
    const box = $('#pm-subtabs');
    const pizzas = TAMANHOS[estado.tamanho].pizzas;
    if (pizzas.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = pizzas.map((p, i) => {
      const n = estado.montagem[i].sabores.length;
      return `<button type="button" class="pm-subtab${i === estado.ativa ? ' ativa' : ''}" data-ativa="${i}" aria-pressed="${i === estado.ativa}">
        Pizza ${p.rotulo}<small>${n} de ${p.max} sabores</small></button>`;
    }).join('');
  }

  function renderEscolhidos() {
    const m = montagemAtiva();
    const p = pizzaAtiva();
    $('#pm-contador').textContent = `${m.sabores.length} de ${p.max}`;
    $('#pm-escolhidos').innerHTML = m.sabores.length
      ? m.sabores.map(s => `<button type="button" class="pm-escolhido" data-remover="${esc(s)}" aria-label="Remover ${esc(s)}">${esc(s)}<span aria-hidden="true">×</span></button>`).join('')
      : `<span class="pm-vazio">Toque nos sabores abaixo para escolher até ${p.max}.</span>`;
  }

  function renderChips(focarSabor) {
    const m = montagemAtiva();
    const cheio = m.sabores.length >= pizzaAtiva().max;
    const termo = normalizar(estado.busca.trim());
    let lista;
    if (termo) {
      // Busca no nome e nos ingredientes; quem bate no nome aparece primeiro.
      const noNome = s => normalizar(s.nome).includes(termo);
      lista = SABORES.filter(s => noNome(s) || normalizar(s.desc).includes(termo))
        .sort((a, b) => noNome(b) - noNome(a));
    } else {
      lista = SABORES.filter(s => s.grupo === estado.filtro);
    }
    $('#pm-filtros').classList.toggle('buscando', !!termo);
    document.querySelectorAll('.pm-filtro').forEach(b => {
      const ativo = !termo && b.dataset.filtro === estado.filtro;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-pressed', String(ativo));
    });

    const chip = s => {
      const on = m.sabores.includes(s.nome);
      const off = !on && cheio;
      return `<button type="button" class="pm-chip${s.top ? ' pm-chip--top' : ''}" data-sabor="${esc(s.nome)}" aria-pressed="${on}"${off ? ' aria-disabled="true"' : ''} title="${esc(s.desc)}">${esc(s.nome)}</button>`;
    };
    const grupo = (titulo, itens) => itens.length
      ? `<p class="pm-grupo-titulo">${titulo}</p><div class="pm-grupo">${itens.map(chip).join('')}</div>`
      : '';

    const box = $('#pm-chips');
    if (!lista.length) {
      box.innerHTML = `<p class="pm-sem-resultado">Nenhum sabor encontrado para “${esc(estado.busca.trim())}”.</p>`;
    } else if (termo) {
      // Na busca, lista direta: o que importa é achar o sabor.
      box.innerHTML = `<div class="pm-grupo">${lista.map(chip).join('')}</div>`;
    } else {
      // Sem busca: os mais pedidos primeiro, para decidir rápido.
      const top = lista.filter(s => s.top);
      const resto = lista.filter(s => !s.top);
      box.innerHTML = top.length
        ? grupo('<svg class="ico" aria-hidden="true"><use href="#i-flame"/></svg> Mais pedidas', top) + grupo('Todos os outros sabores', resto)
        : `<div class="pm-grupo">${lista.map(chip).join('')}</div>`;
    }

    // Mantém o foco no mesmo sabor para quem navega pelo teclado.
    if (focarSabor) {
      const alvo = Array.from(box.querySelectorAll('.pm-chip')).find(b => b.dataset.sabor === focarSabor);
      if (alvo) alvo.focus({ preventScroll: true });
    }
  }

  function renderBordas() {
    const m = montagemAtiva();
    const pizzas = TAMANHOS[estado.tamanho].pizzas;
    $('#pm-borda-de').textContent = pizzas.length > 1 ? `· pizza ${pizzaAtiva().rotulo}` : '';
    $('#pm-bordas').innerHTML = BORDAS.map(b => `<label class="pm-borda">
        <input type="radio" name="pm-borda" value="${b.valor}"${m.borda === b.valor ? ' checked' : ''} />
        <span>${b.nome}<small>${b.extra ? '+ ' + moeda(b.extra) : 'tradicional'}</small></span>
      </label>`).join('');
  }

  function renderPrecoMontagem() {
    $('#pm-preco').textContent = moeda(precoMontagem());
  }

  function renderMontagem(focarSabor) {
    renderSubtabs();
    renderEscolhidos();
    renderChips(focarSabor);
    renderBordas();
    renderPrecoMontagem();
  }

  let avisoTimer;
  function avisar(msg) {
    const el = $('#pm-aviso');
    el.textContent = msg;
    clearTimeout(avisoTimer);
    if (msg) avisoTimer = setTimeout(() => { el.textContent = ''; }, 5000);
  }

  // ---------- render: carrinho e checkout ----------
  function renderCarrinho() {
    const n = estado.carrinho.length;
    const qtd = $('#carrinho-qtd');
    qtd.hidden = !n;
    qtd.textContent = n ? `${n} ${n === 1 ? 'item' : 'itens'}` : '';
    $('#pedido-checkout').hidden = !n;

    $('#carrinho').innerHTML = n
      ? estado.carrinho.map((item, i) => {
          if (ehFile(item)) {
            return `<div class="carrinho-item">
              <div class="carrinho-item-topo"><strong>${esc(item.nome)}</strong><b>${moeda(precoItem(item))}</b></div>
              <p>${esc(FILES[item.nome].desc)}</p>
              <button type="button" class="carrinho-remover" data-remover-item="${i}">Remover</button>
            </div>`;
          }
          const t = TAMANHOS[item.tamanho];
          const multi = item.pizzas.length > 1;
          const linhas = item.pizzas.map(p =>
            `<p>${multi ? `<strong>${p.rotulo}:</strong> ` : ''}${esc(p.sabores.join(', '))}${p.borda ? ` · borda ${esc(p.borda)}` : ''}</p>`
          ).join('');
          return `<div class="carrinho-item">
            <div class="carrinho-item-topo"><strong>${t.nome} <small>${t.medida}</small></strong><b>${moeda(precoItem(item))}</b></div>
            ${linhas}
            <p>Acompanha refri ${t.refri} · sabor a confirmar com a pizzaria</p>
            <button type="button" class="carrinho-remover" data-remover-item="${i}">Remover</button>
          </div>`;
        }).join('')
      : `<div class="carrinho-vazio"><span class="icone" aria-hidden="true"><svg class="ico"><use href="#i-pizza"/></svg></span>Seu pedido está vazio.<br>Monte sua pizza e toque em <strong>Adicionar ao pedido</strong>.</div>`;

    renderTotais();
  }

  function renderTotais() {
    const t = totais();
    $('#tot-pizzas').textContent = moeda(t.pizzas);
    $('#tot-entrega-linha').hidden = !t.entrega;
    $('#tot-entrega').textContent = moeda(t.entrega);
    $('#tot-total').textContent = moeda(t.total);
  }

  function aplicarFormNaTela() {
    const form = $('#pedido-form');
    Object.keys(estado.form).forEach(k => {
      const campos = form.querySelectorAll(`[name="${k}"]`);
      campos.forEach(c => {
        if (c.type === 'radio') c.checked = c.value === estado.form[k];
        else c.value = estado.form[k];
      });
    });
    atualizarCamposCondicionais();
  }

  function atualizarCamposCondicionais() {
    $('#pf-endereco').hidden = estado.form.receber !== 'entrega';
    $('#pf-troco-box').hidden = estado.form.pagamento !== 'Dinheiro';
  }

  // ---------- validação ----------
  function limparErro(el) {
    const grupo = el.closest('.pf-grupo');
    if (!grupo) return;
    grupo.querySelectorAll('.pf-erro').forEach(e => e.remove());
    grupo.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
  }
  function marcarErro(id, msg) {
    const el = document.getElementById(id);
    const grupo = el.closest('.pf-grupo');
    if (el.matches('input, textarea')) el.setAttribute('aria-invalid', 'true');
    grupo.insertAdjacentHTML('beforeend', `<small class="pf-erro" role="alert">${msg}</small>`);
  }
  function validar() {
    document.querySelectorAll('#pedido-form .pf-erro').forEach(e => e.remove());
    document.querySelectorAll('#pedido-form [aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    const f = estado.form;
    const erros = [];
    if (!f.nome.trim()) erros.push(['pf-nome', 'Informe seu nome.']);
    if (f.receber === 'entrega') {
      if (!f.endereco.trim()) erros.push(['pf-rua', 'Informe a rua e o número.']);
      if (!f.bairro.trim()) erros.push(['pf-bairro', 'Informe o bairro.']);
    }
    if (!f.pagamento) erros.push(['pf-pagamento', 'Escolha a forma de pagamento.']);
    erros.forEach(([id, msg]) => marcarErro(id, msg));
    if (erros.length) {
      const el = document.getElementById(erros[0][0]);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focavel = el.matches('input, textarea') ? el : el.querySelector('input');
      if (focavel) focavel.focus({ preventScroll: true });
    }
    return !erros.length;
  }

  // ---------- mensagem do WhatsApp ----------
  function montarMensagem() {
    const f = estado.form;
    const t = totais();
    const L = ['🍕 *PEDIDO PELO SITE*', ''];

    estado.carrinho.forEach((item, i) => {
      if (ehFile(item)) {
        L.push(`*${i + 1}. ${item.nome}* — ${moeda(precoItem(item))}`);
        L.push('');
        return;
      }
      const tam = TAMANHOS[item.tamanho];
      const multi = item.pizzas.length > 1;
      L.push(`*${i + 1}. ${tam.nome}* (${tam.medida}) — ${moeda(precoItem(item))}`);
      item.pizzas.forEach(p => {
        L.push(`• ${multi ? p.rotulo : 'Sabores'}: ${p.sabores.join(', ')}`);
        if (p.borda) L.push(`• Borda ${p.borda}${multi ? ` (na ${p.rotulo})` : ''}`);
      });
      L.push(`• Acompanha refri ${tam.refri} (sabor a confirmar)`);
      L.push('');
    });

    if (f.receber === 'entrega') {
      L.push(`🛵 *Tele-entrega* (taxa ${moeda(TAXA_ENTREGA)})`);
      L.push(`• ${f.endereco.trim()} – ${f.bairro.trim()}`);
      if (f.referencia.trim()) L.push(`• Referência: ${f.referencia.trim()}`);
    } else {
      L.push('🏠 *Retirada no local*');
    }
    L.push('');

    let pagamento = f.pagamento;
    const troco = f.troco.replace(/r\$\s*/i, '').trim();
    if (f.pagamento === 'Dinheiro' && troco) pagamento += ` (troco para R$ ${troco})`;
    L.push(`💳 *Pagamento:* ${pagamento}`);
    L.push(`👤 *Nome:* ${f.nome.trim()}`);
    if (f.obs.trim()) L.push(`📝 *Obs.:* ${f.obs.trim()}`);
    L.push('');
    L.push(`*Total estimado: ${moeda(t.total)}*`);
    if (t.entrega) L.push('_A taxa de entrega pode variar conforme a distância._');
    L.push('');
    // Os sabores de refri mudam: a pergunta já vai pronta para a pizzaria responder.
    if (estado.carrinho.some(i => !ehFile(i))) L.push('🥤 Quais sabores de refri vocês têm disponíveis hoje?');
    L.push('Aguardo a confirmação! 😊');
    return L.join('\n');
  }

  // ---------- horário de funcionamento ----------
  // Quarta a domingo, 19h às 23h, no horário de Brasília.
  const DIAS_ABERTOS = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const ABRE = 19 * 60;
  const FECHA = 23 * 60;
  const NOME_DIA = { Wed: 'quarta', Thu: 'quinta', Fri: 'sexta', Sat: 'sábado', Sun: 'domingo' };

  function agoraBrasilia() {
    try {
      const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      const pega = tipo => (partes.find(p => p.type === tipo) || {}).value;
      return { dia: pega('weekday'), minutos: parseInt(pega('hour'), 10) * 60 + parseInt(pega('minute'), 10) };
    } catch (e) { return null; }
  }
  function proximaAbertura(dia, minutos) {
    if (DIAS_ABERTOS.includes(dia) && minutos < ABRE) return 'abre hoje às 19h';
    const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hoje = semana.indexOf(dia);
    for (let d = 1; d <= 7; d++) {
      const proximo = semana[(hoje + d) % 7];
      if (DIAS_ABERTOS.includes(proximo)) return d === 1 ? 'abre amanhã às 19h' : `abre ${NOME_DIA[proximo]} às 19h`;
    }
    return '';
  }
  function renderStatus() {
    const agora = agoraBrasilia();
    if (!agora) return;
    const aberto = DIAS_ABERTOS.includes(agora.dia) && agora.minutos >= ABRE && agora.minutos < FECHA;
    const proxima = aberto ? '' : proximaAbertura(agora.dia, agora.minutos);

    const pedido = $('#pedido-status');
    pedido.hidden = false;
    pedido.className = 'pedido-status ' + (aberto ? 'pedido-status--aberto' : 'pedido-status--fechado');
    pedido.textContent = aberto
      ? 'Aberto agora · pedidos até as 23h'
      : `Fechado agora · ${proxima}. Funcionamos de quarta a domingo, das 19h às 23h. Você já pode montar o pedido: confirmamos assim que abrirmos.`;

    const topo = document.getElementById('hero-status');
    if (topo) {
      topo.hidden = false;
      topo.className = 'hero-status' + (aberto ? '' : ' hero-status--fechado');
      topo.textContent = aberto ? 'Aberto agora · pedidos até as 23h' : `Fechado agora · ${proxima}`;
    }
  }

  // ---------- aviso flutuante ----------
  const toast = document.createElement('div');
  toast.className = 'pedido-toast';
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  let toastTimer;
  function mostrarToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // ---------- filés no pedido ----------
  function renderFiles() {
    $('#pm-files-lista').innerHTML = Object.values(FILES).map(f => `<div class="pm-file">
        <div class="pm-file-txt">
          <strong>${esc(f.nome)}</strong>
          <p>${esc(f.desc)}</p>
          <b>${moeda(f.preco)}</b>
        </div>
        <button type="button" class="pm-file-add" data-add-file="${esc(f.nome)}">Adicionar</button>
      </div>`).join('');
  }
  function escolherTipo(tipo) {
    document.querySelectorAll('.pm-tipo-btn').forEach(b => {
      const on = b.dataset.tipo === tipo;
      b.classList.toggle('ativo', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#pm-pizza').hidden = tipo !== 'pizza';
    $('#pm-files').hidden = tipo !== 'file';
  }
  // No celular o resumo fica embaixo: leva a pessoa até ele.
  function irParaResumo() {
    if (window.matchMedia('(max-width: 1000px)').matches) {
      $('#pedido-resumo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function adicionarFile(nome) {
    if (!FILES[nome]) return;
    estado.carrinho.push({ tipo: 'file', nome });
    salvar();
    renderCarrinho();
    $('#pedido-enviado').hidden = true;
    mostrarToast(`${nome} adicionado ao pedido ✓`);
  }
  $('#pm-tipo').addEventListener('click', e => {
    const b = e.target.closest('[data-tipo]');
    if (b) escolherTipo(b.dataset.tipo);
  });
  $('#pm-files-lista').addEventListener('click', e => {
    const b = e.target.closest('[data-add-file]');
    if (!b) return;
    adicionarFile(b.dataset.addFile);
    irParaResumo();
  });
  document.querySelectorAll('[data-pedir-file]').forEach(b => b.addEventListener('click', () => {
    adicionarFile(b.dataset.pedirFile);
    escolherTipo('file');
    if (window.matchMedia('(max-width: 1000px)').matches) irParaResumo();
    else raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $('#pedido-outra').addEventListener('click', () => {
    $('.pedido-builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- eventos: montador ----------
  $('#pm-tamanhos').addEventListener('change', e => {
    if (e.target.name === 'pm-tamanho') escolherTamanho(e.target.value);
  });

  $('#pm-subtabs').addEventListener('click', e => {
    const b = e.target.closest('[data-ativa]');
    if (!b) return;
    estado.ativa = Number(b.dataset.ativa);
    avisar('');
    renderMontagem();
  });

  $('#pm-escolhidos').addEventListener('click', e => {
    const b = e.target.closest('[data-remover]');
    if (!b) return;
    const m = montagemAtiva();
    m.sabores = m.sabores.filter(s => s !== b.dataset.remover);
    avisar('');
    renderMontagem();
  });

  $('#pm-chips').addEventListener('click', e => {
    const b = e.target.closest('.pm-chip');
    if (!b) return;
    const nome = b.dataset.sabor;
    const m = montagemAtiva();
    const p = pizzaAtiva();
    const i = m.sabores.indexOf(nome);
    if (i >= 0) {
      m.sabores.splice(i, 1);
    } else if (m.sabores.length >= p.max) {
      avisar(`A pizza ${p.rotulo} leva no máximo ${p.max} sabores. Toque num sabor escolhido para trocar.`);
      return;
    } else {
      m.sabores.push(nome);
    }
    avisar('');
    renderMontagem(nome);
  });

  $('#pm-busca').addEventListener('input', e => {
    estado.busca = e.target.value;
    renderChips();
  });

  $('#pm-filtros').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    estado.busca = '';
    $('#pm-busca').value = '';
    renderChips();
  });

  $('#pm-bordas').addEventListener('change', e => {
    if (e.target.name !== 'pm-borda') return;
    montagemAtiva().borda = e.target.value;
    renderPrecoMontagem();
  });

  $('#pm-adicionar').addEventListener('click', () => {
    const pizzas = TAMANHOS[estado.tamanho].pizzas;
    const faltando = estado.montagem.findIndex(m => m.sabores.length === 0);
    if (faltando >= 0) {
      estado.ativa = faltando;
      renderMontagem();
      avisar(pizzas.length > 1
        ? `Escolha pelo menos 1 sabor para a pizza ${pizzas[faltando].rotulo}.`
        : 'Escolha pelo menos 1 sabor.');
      $('#pm-escolhidos').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    estado.carrinho.push({
      tamanho: estado.tamanho,
      pizzas: estado.montagem.map((m, i) => ({ rotulo: pizzas[i].rotulo, sabores: m.sabores.slice(), borda: m.borda }))
    });
    salvar();
    escolherTamanho(estado.tamanho, true);
    renderCarrinho();
    $('#pedido-enviado').hidden = true;
    mostrarToast('Pizza adicionada ao pedido ✓');
    irParaResumo();
  });

  // Botões "Pedir a GG" etc. na aba Preços do cardápio.
  document.querySelectorAll('[data-pedir]').forEach(b => b.addEventListener('click', () => {
    if (!TAMANHOS[b.dataset.pedir]) return;
    escolherTipo('pizza');
    escolherTamanho(b.dataset.pedir);
    raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  // ---------- eventos: carrinho e checkout ----------
  $('#carrinho').addEventListener('click', e => {
    const b = e.target.closest('[data-remover-item]');
    if (!b) return;
    estado.carrinho.splice(Number(b.dataset.removerItem), 1);
    salvar();
    renderCarrinho();
  });

  const form = $('#pedido-form');
  function aoMudarCampo(e) {
    const el = e.target;
    if (!el.name || !(el.name in estado.form)) return;
    if (el.type === 'radio' && !el.checked) return;
    estado.form[el.name] = el.value;
    limparErro(el);
    if (el.name === 'receber' || el.name === 'pagamento') {
      atualizarCamposCondicionais();
      renderTotais();
    }
    salvar();
  }
  form.addEventListener('input', aoMudarCampo);
  form.addEventListener('change', aoMudarCampo);
  // Enter num campo não recarrega a página: vira "enviar".
  form.addEventListener('submit', e => { e.preventDefault(); enviar(); });

  function enviar() {
    if (!estado.carrinho.length || !validar()) return;
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(montarMensagem())}`;
    const aviso = $('#pedido-enviado');
    $('#pedido-reabrir').href = url;
    aviso.hidden = false;
    // Nova aba no computador; no celular abre o app. Se o navegador
    // bloquear a janela, vai direto nesta mesma aba.
    const janela = window.open(url, '_blank');
    if (janela) janela.opener = null;
    else window.location.href = url;
  }
  $('#pedido-enviar').addEventListener('click', enviar);

  $('#pedido-limpar').addEventListener('click', () => {
    if (!window.confirm('Apagar todas as pizzas deste pedido?')) return;
    estado.carrinho = [];
    salvar();
    $('#pedido-enviado').hidden = true;
    renderCarrinho();
    raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- início ----------
  carregar();
  escolherTamanho('GG', true);
  renderFiles();
  aplicarFormNaTela();
  renderCarrinho();
  renderStatus();
  if (!SABORES.length) avisar('Não foi possível carregar os sabores. Faça seu pedido pelo WhatsApp.');
})();
