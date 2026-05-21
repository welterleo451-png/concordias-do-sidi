/* =====================================================
   CONCÓRDIA'S DO SIDI – Script Principal
   ===================================================== */

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ---- Mobile nav toggle ----
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('active');
});

// Fechar menu ao clicar num link
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

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
  '.badge-item, .sobre-img-wrap, .sobre-text, .menu-card, .depo-card, .contato-info, .contato-map, .footer-inner > *'
);

revealEls.forEach(el => el.classList.add('reveal'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach(el => observer.observe(el));

// ---- Smooth active nav link ----
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

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
const musicIcon = musicBtn.querySelector('.music-icon');
const musicLabel = musicBtn.querySelector('.music-label');

let playing = false;

musicBtn.addEventListener('click', () => {
  if (playing) {
    audio.pause();
    musicIcon.textContent = '🎵';
    musicLabel.textContent = 'Música';
    musicBtn.classList.remove('playing');
  } else {
    audio.play();
    musicIcon.textContent = '⏸️';
    musicLabel.textContent = 'Pausar';
    musicBtn.classList.add('playing');
  }
  playing = !playing;
});

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
