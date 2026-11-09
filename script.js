/* =====================================================
   CONCÓRDIA'S DO SIDI – Script Principal
   ===================================================== */

// ---- Botão flutuante "Fazer pedido" ----
// Só aparece onde ajuda: some no topo (já tem o botão), no próprio pedido,
// no contato e no rodapé, para não cobrir botões e textos.
(function () {
  const botao = document.getElementById('pedido-float');
  if (!botao) return;
  if (!('IntersectionObserver' in window)) { botao.classList.add('visivel'); return; }
  const vistos = new Set();
  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(e => (e.isIntersecting ? vistos.add(e.target) : vistos.delete(e.target)));
    botao.classList.toggle('visivel', vistos.size === 0);
  });
  ['.hero', '#pedido', '#contato', '.footer'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) obs.observe(el);
  });
})();

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ---- Mobile nav toggle ----
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-controls', 'nav-links');

  function abrirMenu(abrir) {
    navLinks.classList.toggle('open', abrir);
    navToggle.classList.toggle('active', abrir);
    navToggle.setAttribute('aria-expanded', String(abrir));
    // trava o scroll do fundo: sem isso a pagina rolava atras do menu
    document.body.classList.toggle('menu-aberto', abrir);
  }

  navToggle.addEventListener('click', () => {
    abrirMenu(!navLinks.classList.contains('open'));
  });

  // Fechar ao clicar num link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href') || '';
      abrirMenu(false);

      // Fechar o menu remove o overflow:hidden do body, mas o navegador
      // tenta rolar ate a secao antes disso valer -- e a pagina fica parada.
      // Por isso rolamos por conta propria no quadro seguinte.
      // (scrollIntoView respeita o scroll-margin-top da navbar.)
      if (href.startsWith('#') && href.length > 1) {
        const alvo = document.querySelector(href);
        if (alvo) {
          e.preventDefault();
          requestAnimationFrame(() => {
            alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', href);
          });
        }
      }
    });
  });

  // Fechar com Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) abrirMenu(false);
  });

  // Se voltar pro desktop com o menu aberto, limpa o estado
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && navLinks.classList.contains('open')) abrirMenu(false);
  });
}

// ---- Tabs do cardápio ----
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById('tab-' + target).classList.add('active');
  });
});

// ---- Scroll reveal ----
const revealEls = document.querySelectorAll(
  '.badge-item, .sobre-img-wrap, .sobre-text, .menu-card, .avaliacoes-card, .contato-info, .contato-map, .footer-inner > *'
);

// Se o usuario pediu menos animacao no sistema, mostra tudo direto.
const menosAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

revealEls.forEach(el => el.classList.add('reveal'));

// IMPORTANTE: alguns elementos ja vem com class="reveal" escrita no HTML
// (o cabecalho da galeria). Eles nao estavam na lista acima, entao ficavam
// com opacity:0 e NUNCA eram revelados. Buscar por '.reveal' pega os dois casos.
const todosReveal = Array.from(document.querySelectorAll('.reveal'));

if (menosAnimacao || !('IntersectionObserver' in window)) {
  todosReveal.forEach(el => el.classList.add('visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), Math.min(i, 6) * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  todosReveal.forEach(el => observer.observe(el));

  // Rede de seguranca: se a animacao nao disparar por qualquer motivo,
  // o conteudo ficaria invisivel para sempre. Depois de 4s, mostra tudo.
  setTimeout(() => todosReveal.forEach(el => el.classList.add('visible')), 4000);
}

// ---- Smooth active nav link ----
const sections = document.querySelectorAll('section[id]');
// O botão vermelho "Fazer Pedido" fica de fora: âmbar sobre vermelho não se lê.
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]:not(.btn-reserva)');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navAnchors.forEach(a => {
    a.style.color = '';
    if (a.getAttribute('href') === '#' + current) a.style.color = 'var(--brand-amber)';
  });
});

// ---- Player de Música Flutuante ----
const audio    = document.getElementById('bg-audio');
const musicBtn = document.getElementById('music-btn');

// Sem essa protecao, se o botao nao existir o erro derruba
// todo o script que vem depois (galeria, carrossel).
if (audio && musicBtn) {
  const musicIcon = musicBtn.querySelector('.music-icon use');
  const musicLabel = musicBtn.querySelector('.music-label');
  let playing = false;

  musicBtn.addEventListener('click', () => {
    if (playing) {
      audio.pause();
      if (musicIcon) musicIcon.setAttribute('href', '#i-music');
      if (musicLabel) musicLabel.textContent = 'Música ambiente';
      musicBtn.classList.remove('playing');
      playing = false;
    } else {
      // play() devolve Promise e o celular pode bloquear o autoplay
      Promise.resolve(audio.play()).then(() => {
        if (musicIcon) musicIcon.setAttribute('href', '#i-pause');
        if (musicLabel) musicLabel.textContent = 'Pausar';
        musicBtn.classList.add('playing');
        playing = true;
      }).catch(() => {
        if (musicLabel) musicLabel.textContent = 'Indisponível';
      });
    }
  });
}

// ---- Carrossel Galeria ----
(function () {
  const slides = document.querySelectorAll('.galeria-slide');
  const dots   = document.querySelectorAll('.galeria-dot');
  const btnPrev = document.getElementById('galeria-prev');
  const btnNext = document.getElementById('galeria-next');
  let current = 0;
  let autoTimer;

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function startAuto() {
    autoTimer = setInterval(() => goTo(current + 1), 5000);
  }

  function resetAuto() {
    clearInterval(autoTimer);
    startAuto();
  }

  if (btnPrev && btnNext) {
    btnPrev.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
    btnNext.addEventListener('click', () => { goTo(current + 1); resetAuto(); });
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goTo(i); resetAuto(); });
  });

  // Touch / swipe suporte mobile
  let touchStartX = 0;
  const carousel = document.getElementById('galeria-carousel');
  if (carousel) {
    carousel.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) { goTo(dx < 0 ? current + 1 : current - 1); resetAuto(); }
    });
  }

  startAuto();
})();
