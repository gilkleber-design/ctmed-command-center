/* Sprint ISR — CT-MED Academy */
(function () {
  'use strict';

  /* ================= CONFIGURAÇÃO =================
     checkoutUrl : link da página de pagamento. Enquanto estiver vazio, os botões
                   levam ao fim da página e o último avisa que a inscrição não abriu.
     certificado : resposta para "Vou receber certificado?". Vazio = pergunta oculta.
     duracao     : duração da live (ex.: '2 horas'). Vazio = não aparece. */
  var CONFIG = {
    checkoutUrl: '',
    certificado: '',
    duracao: ''
  };

  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- botões de inscrição ---------- */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3400);
  }
  $$('.js-checkout').forEach(function (a) {
    if (CONFIG.checkoutUrl) { a.href = CONFIG.checkoutUrl; return; }
    if (a.id === 'cta-final') {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Inscrições ainda não disponíveis.');
      });
    }
  });

  /* ---------- perguntas frequentes ---------- */
  if (CONFIG.certificado) {
    var cert = $('#faq-certificado');
    $('.faq__a p', cert).textContent = CONFIG.certificado;
    cert.hidden = false;
  }
  if (CONFIG.duracao) {
    $$('.js-horario').forEach(function (el) { el.textContent = 'Brasília, duração de ' + CONFIG.duracao; });
  }

  /* ---------- microcaso: cada frente escolhida abre a sua discussão ---------- */
  (function () {
    var box = $('#caso-opcoes'), wrap = $('#caso-retorno'), painel = $('#caso-painel'), deNovo = $('#caso-de-novo');
    if (!box || !wrap || !painel) return;
    var btns = $$('button', box), textos = $$('.caso__fb', painel), fechar = 0;
    function escolher(btn) {
      var alvo = btn.getAttribute('data-fb');
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      textos.forEach(function (t) { t.hidden = t.getAttribute('data-fb') !== alvo; });
      clearTimeout(fechar);
      if (painel.hidden) {
        painel.hidden = false;
        void wrap.offsetHeight;                      // garante a transição de abertura
      }
      wrap.classList.add('is-open');
    }
    function reiniciar() {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      wrap.classList.remove('is-open');
      clearTimeout(fechar);
      fechar = setTimeout(function () { painel.hidden = true; textos.forEach(function (t) { t.hidden = true; }); }, REDUCED ? 0 : 360);
      btns[0].focus({ preventScroll: true });
    }
    btns.forEach(function (btn) { btn.addEventListener('click', function () { escolher(btn); }); });
    if (deNovo) deNovo.addEventListener('click', reiniciar);
  })();

  $$('.faq__item button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.closest('.faq__item').classList.toggle('is-open', open);
    });
  });

  /* ---------- depoimentos em vídeo ----------
     Os dados vêm do <script id="depoimentos-dados"> no HTML. Só a capa é carregada;
     o vídeo é baixado quando a pessoa aperta o play, e nunca toca sozinho. */
  (function () {
    var sec = $('#depoimentos'), trilho = $('#depo-trilho'), pontos = $('#depo-pontos'), dados = $('#depoimentos-dados');
    if (!sec || !trilho || !dados) return;
    var lista;
    try { lista = JSON.parse(dados.textContent || '[]'); } catch (e) { lista = []; }
    lista = (lista || []).filter(function (d) { return d && d.video && d.capa && d.nome; });
    if (!lista.length) return;

    function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
    function montar(d) {
      var v = doc.createElement('video');
      v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.poster = d.capa; v.src = d.video;
      if (d.legendas) {
        var t = doc.createElement('track');
        t.kind = 'captions'; t.srclang = 'pt-BR'; t.label = 'Português'; t.src = d.legendas; t.default = true;
        v.appendChild(t);
      }
      return v;
    }
    function soltar(v) { if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } }

    /* o vídeo abre numa janela, inteiro (9:16); o cartão continua mostrando só a capa */
    var cine = $('#cine'), palco = $('#cine-palco'), fecharCine = $('#cine-fechar');
    var temJanela = !!(cine && palco && cine.showModal);
    if (temJanela) {
      cine.addEventListener('close', function () { soltar($('video', palco)); });
      cine.addEventListener('click', function (e) { if (e.target === cine) cine.close(); });
      fecharCine.addEventListener('click', function () { cine.close(); });
    }
    function parar(card) { soltar($('video', card)); card.classList.remove('is-playing'); }
    function tocar(card, d) {
      var v = montar(d);
      if (temJanela) {
        soltar($('video', palco));
        cine.setAttribute('aria-label', 'Depoimento de ' + d.nome);
        v.addEventListener('ended', function () { if (cine.open) cine.close(); });
        palco.appendChild(v);
        if (!cine.open) cine.showModal();
      } else {                                        // navegador sem <dialog>: toca dentro do cartão, sem corte
        $$('.depo__card.is-playing', trilho).forEach(parar);
        v.addEventListener('ended', function () { parar(card); });
        card.appendChild(v); card.classList.add('is-playing');
      }
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      v.focus({ preventScroll: true });
    }

    lista.forEach(function (d) {
      var card = el('li', 'depo__card');
      var img = el('img', 'depo__capa'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = d.capa;
      card.appendChild(img);
      if (d.duracao) card.appendChild(el('span', 'depo__tempo', d.duracao));
      var btn = el('button', 'depo__play'); btn.type = 'button'; btn.setAttribute('aria-label', 'Assistir ao depoimento de ' + d.nome);
      btn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-tri"/></svg>';
      btn.addEventListener('click', function () { tocar(card, d); });
      card.appendChild(btn);
      var txt = el('div', 'depo__txt');
      if (d.frase || d.destaque) {
        var q = el('p', 'depo__frase');
        q.appendChild(doc.createTextNode('\u201C' + (d.frase || '') + (d.frase && d.destaque ? ' ' : '')));
        if (d.destaque) q.appendChild(el('b', '', d.destaque));
        q.appendChild(doc.createTextNode('\u201D'));
        txt.appendChild(q);
      }
      txt.appendChild(el('p', 'depo__nome', d.nome));
      if (d.papel) txt.appendChild(el('p', 'depo__papel', d.papel));
      card.appendChild(txt);
      trilho.appendChild(card);
    });
    sec.hidden = false;

    /* carrossel: setas no desktop, arrastar no celular, pontos indicam a posição */
    var ant = $('.depo__seta--ant', sec), prox = $('.depo__seta--prox', sec), box = $('.depo', sec), raf = 0;
    function passo() { var c = trilho.children[0]; return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(trilho).columnGap || 0) : 1; }
    function sync() {
      raf = 0;
      var max = trilho.scrollWidth - trilho.clientWidth, n = max > 4 ? Math.round(max / passo()) + 1 : 1;
      box.classList.toggle('depo--estatico', n <= 1);
      if (pontos.children.length !== n) { pontos.innerHTML = ''; for (var i = 0; i < n; i++) pontos.appendChild(doc.createElement('i')); }
      var at = Math.min(n - 1, Math.round(trilho.scrollLeft / passo()));
      for (var k = 0; k < n; k++) pontos.children[k].classList.toggle('is-on', k === at);
      ant.disabled = trilho.scrollLeft < 4; prox.disabled = trilho.scrollLeft > max - 4;
    }
    function ask() { if (!raf) raf = requestAnimationFrame(sync); }
    ant.addEventListener('click', function () { trilho.scrollBy({ left: -passo(), behavior: REDUCED ? 'auto' : 'smooth' }); });
    prox.addEventListener('click', function () { trilho.scrollBy({ left: passo(), behavior: REDUCED ? 'auto' : 'smooth' }); });
    trilho.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    sync();
  })();

  /* ---------- barras fixas (topo no desktop, rodapé no celular) ---------- */
  var topbar = $('#topbar'), dock = $('#dock');
  var heroCta = $('#cta-hero'), finalCta = $('#cta-final');
  if ('IntersectionObserver' in window) {
    topbar.hidden = false; dock.hidden = false;
    var past = false, atEnd = false;
    var syncBars = function () {
      topbar.classList.toggle('is-on', past);
      dock.classList.toggle('is-on', past && !atEnd);
    };
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      past = !e.isIntersecting && e.boundingClientRect.top < 0; syncBars();
    }).observe(heroCta);
    new IntersectionObserver(function (es) {
      atEnd = es[es.length - 1].isIntersecting; syncBars();
    }).observe(finalCta);
  }

  /* ---------- "Como vai funcionar": os passos entram em sequência ---------- */
  var steps = $('#steps');
  if (steps) {
    if ('IntersectionObserver' in window && !REDUCED) {
      var so = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { steps.classList.add('is-in'); so.disconnect(); }
      }, { threshold: 0.45 });
      so.observe(steps);
    } else steps.classList.add('is-in');
  }

  /* ---------- profundidade: os professores acompanham o cursor ---------- */
  (function () {
    var hero = $('.hero');
    if (REDUCED || !hero || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var people = [[$('.hero .person--gil'), 9, 5], [$('.hero .person--diego'), 17, 9]];
    var tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    function frame() {
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      people.forEach(function (p) {
        p[0].style.setProperty('--px', (-x * p[1]).toFixed(2) + 'px');
        p[0].style.setProperty('--py', (-y * p[2]).toFixed(2) + 'px');
      });
      raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) ? requestAnimationFrame(frame) : 0;
    }
    function aim(nx, ny) { tx = nx; ty = ny; if (!raf) raf = requestAnimationFrame(frame); }
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      aim((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
    });
    hero.addEventListener('pointerleave', function () { aim(0, 0); });
  })();

  /* =====================================================================
     MONITOR MULTIPARAMÉTRICO
     A foto do monitor teve os traçados e os números removidos; tudo o que
     aparece na tela é desenhado aqui, na perspectiva da foto.
     ===================================================================== */
  var PHOTO_W = 1487, PHOTO_H = 1058;
  var BOX = { x: 0.32, y: 0.02, w: 0.68, h: 0.88 };            // área do canvas dentro da foto
  var Q_WAVES = [[507, 211], [1186, 89], [1186, 858], [507, 848]];  // tela dos traçados (px da foto)
  var Q_PANEL = [[1193, 112], [1478, 58], [1478, 917], [1193, 905]]; // painel numérico

  var BLUR = { part: 0.36, down: 5 };                          // faixa esquerda desfocada (profundidade de campo)

  var CRASH = { hr: 142, spo2: 81, etco2: 18, rr: 34, sys: 82, dia: 46 };
  var STABLE = { hr: 92, spo2: 98, etco2: 36, rr: 14, sys: 118, dia: 72 };

  var RED = '#ff2d2d', GREEN = '#3fe283', CYAN = '#3ad2ff', YELLOW = '#ffc61a', WHITE = '#e9eef5', ART = '#ff564a';
  var FONT = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';

  function homography(q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
    var dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dx2 * dy1;
    var g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
    var d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    return function (u, v) { var w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
  }
  var H_WAVES = homography(Q_WAVES), H_PANEL = homography(Q_PANEL);

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function frac(x) { return x - Math.floor(x); }
  function bump(x, mu, sigma) { var d = (x - mu) / sigma; return Math.exp(-d * d); }
  function wrapped(fn, p) { return fn(p) + fn(p + 1) + fn(p - 1); }

  /* formas de onda, em função da fase (0..1) do batimento ou da respiração */
  function ecgAt(p) {
    return 0.11 * bump(p, 0.13, 0.04) - 0.09 * bump(p, 0.232, 0.014) + bump(p, 0.255, 0.018)
         - 0.2 * bump(p, 0.28, 0.016) + 0.24 * bump(p, 0.47, 0.078);
  }
  function plethShape(p) { return bump(p, 0.2, 0.1) + 0.45 * bump(p, 0.5, 0.15); }
  function artShape(p) { return bump(p, 0.16, 0.078) + 0.55 * bump(p, 0.42, 0.14) + 0.18 * bump(p, 0.72, 0.2); }
  function capno(p, quality) {
    if (p < 0.38) return 0;
    var x = (p - 0.38) / 0.62, fall = 1 - smooth((x - 0.9) / 0.1);
    var square = smooth(x / 0.14) * (0.9 + 0.1 * x) * fall;   // platô: via aérea e ventilação adequadas
    var shark = smooth(x / 0.8) * 0.8 * fall;                 // subida lenta: paciente descompensado
    return lerp(shark, square, quality);
  }

  /* faixas dos traçados na tela (v = 0 no topo, 1 na base) */
  var ROWS = [
    { key: 'ecg', base: 0.186, amp: 0.142 },
    { key: 'pleth', base: 0.388, amp: 0.108 },
    { key: 'co2', base: 0.588, amp: 0.15 },
    { key: 'resp', base: 0.712, amp: 0.085 },
    { key: 'art', base: 0.968, amp: 0.2 }
  ];

  /* blocos do painel (V = 0 no topo, 1 na base) */
  var BANDS = [
    { key: 'hr', v0: 0.004, v1: 0.054, text: 'TAQUICARDIA' },
    { key: 'spo2', v0: 0.326, v1: 0.384, text: 'HIPOXEMIA' },
    { key: 'etco2', v0: 0.516, v1: 0.570, text: 'BAIXO' },
    { key: 'rr', v0: 0.686, v1: 0.738, text: 'TAQUIPNEIA' },
    { key: 'pa', v0: 0.944, v1: 0.998, text: 'HIPOTENSÃO' }
  ];
  var TILES = [
    { key: 'hr', v0: 0.064, v1: 0.174, label: 'FC', hi: 120, lo: 50 },
    { key: 'spo2', v0: 0.186, v1: 0.318, label: 'SpO', sub: '2', hi: 100, lo: 90 },
    { key: 'etco2', v0: 0.402, v1: 0.508, label: 'ETCO', sub: '2', hi: 45, lo: 30 },
    { key: 'rr', v0: 0.586, v1: 0.676, label: 'FR', hi: 24, lo: 8 },
    { key: 'pa', v0: 0.754, v1: 0.934, label: 'PA', unit: '(mmHg)', hi: 160, lo: 90 }
  ];

  function Scope(scene) {
    this.scene = scene;
    this.rescue = scene.getAttribute('data-scope') === 'resgate';
    this.cv = $('.scene__waves', scene); this.ctx = this.cv.getContext('2d');
    this.cvB = $('.scene__blur', scene); this.ctxB = this.cvB.getContext('2d');
    this.cvP = $('.scene__panel', scene); this.ctxP = this.cvP.getContext('2d');
    this.N = 600; this.T = 4.6; this.gap = 16;
    this.buf = {};
    for (var i = 0; i < ROWS.length; i++) { this.buf[ROWS[i].key] = new Float32Array(this.N); this.buf[ROWS[i].key].fill(NaN); }
    this.cursor = 0; this.beat = 0; this.resp = 0;
    this.v = copy(CRASH); this.j = { hr: 0, spo2: 0, etco2: 0, rr: 0, sys: 0, dia: 0 };
    this.shown = null; this.flags = null;
    this.clock = 0; this.jitterAt = 4; this.blink = true; this.blinkAt = 0;
    this.p = 0; this.armed = false; this.wait = 0;
    this.visible = false; this.dirty = true; this.w = 0; this.h = 0;
    this.pts = null;
    this.compute();
    this.fill(false);               // a página já abre com a tela cheia; o cursor segue varrendo
  }
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

  Scope.prototype.resize = function () {
    var r = this.scene.getBoundingClientRect();
    if (!r.width) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(r.width * BOX.w * dpr), h = Math.round(r.height * BOX.h * dpr);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    [this.cv, this.cvP].forEach(function (c) { c.width = w; c.height = h; });
    this.cvB.width = Math.max(1, Math.round(w * BLUR.part / BLUR.down)); this.cvB.height = Math.max(1, Math.round(h / BLUR.down));
    /* posição de cada amostra na tela, já em perspectiva */
    var N = this.N, pts = {}, self = this;
    ROWS.forEach(function (row) {
      var a = new Float32Array(N * 4);
      for (var i = 0; i < N; i++) {
        var u = 0.012 + (i / (N - 1)) * 0.976;
        var b = self.toCanvas(H_WAVES(u, row.base)), t = self.toCanvas(H_WAVES(u, row.base - row.amp));
        a[i * 4] = b[0]; a[i * 4 + 1] = b[1]; a[i * 4 + 2] = t[0] - b[0]; a[i * 4 + 3] = t[1] - b[1];
      }
      pts[row.key] = a;
    });
    this.pts = pts; this.dirty = true;
  };
  Scope.prototype.toCanvas = function (p) {
    return [(p[0] / PHOTO_W - BOX.x) / BOX.w * this.w, (p[1] / PHOTO_H - BOX.y) / BOX.h * this.h];
  };

  /* sinais vitais: valores exibidos e alarmes */
  Scope.prototype.compute = function () {
    var v = this.v, j = this.j;
    var s = {
      hr: Math.round(v.hr + j.hr), spo2: Math.min(100, Math.round(v.spo2 + j.spo2)), etco2: Math.round(v.etco2 + j.etco2),
      rr: Math.round(v.rr + j.rr), sys: Math.round(v.sys + j.sys), dia: Math.round(v.dia + j.dia)
    };
    s.map = Math.round((s.sys + 2 * s.dia) / 3);
    var f = { hr: v.hr > 120, spo2: v.spo2 < 90, etco2: v.etco2 < 30, rr: v.rr > 24, pa: (v.sys + 2 * v.dia) / 3 < 65 };
    f.any = f.hr || f.spo2 || f.etco2 || f.rr || f.pa;
    var o = this.shown, of = this.flags;
    if (!o || o.hr !== s.hr || o.spo2 !== s.spo2 || o.etco2 !== s.etco2 || o.rr !== s.rr || o.sys !== s.sys || o.dia !== s.dia ||
        of.hr !== f.hr || of.spo2 !== f.spo2 || of.etco2 !== f.etco2 || of.rr !== f.rr || of.pa !== f.pa) this.dirty = true;
    if (!of || of.any !== f.any) this.scene.setAttribute('data-state', f.any ? 'alarme' : 'estavel');
    this.shown = s; this.flags = f;
  };

  Scope.prototype.setProgress = function (p) {
    var w = function (a, b) { return smooth((p - a) / (b - a)); };
    this.v.spo2 = lerp(CRASH.spo2, STABLE.spo2, w(0.06, 0.52));
    this.v.etco2 = lerp(CRASH.etco2, STABLE.etco2, w(0.16, 0.5));
    this.v.rr = lerp(CRASH.rr, STABLE.rr, w(0.16, 0.5));
    this.v.hr = lerp(CRASH.hr, STABLE.hr, w(0.24, 0.84));
    this.v.sys = lerp(CRASH.sys, STABLE.sys, w(0.34, 1));
    this.v.dia = lerp(CRASH.dia, STABLE.dia, w(0.34, 1));
  };

  Scope.prototype.update = function (dt) {
    this.clock += dt;
    if (this.rescue) {
      if (this.armed && this.p < 1) {
        if (this.wait > 0) this.wait -= dt;
        else { this.p = Math.min(1, this.p + dt / 8.5); this.setProgress(this.p); }
      }
    }
    if (this.clock >= this.jitterAt) {
      this.jitterAt = this.clock + 1.3 + Math.random() * 0.9;
      var settled = !this.rescue || this.p === 0 || this.p === 1, r = function (n) { return Math.round((Math.random() * 2 - 1) * n); };
      this.j = settled ? { hr: r(2), spo2: r(1), etco2: r(1), rr: (this.rescue && this.p === 1) ? 0 : r(1), sys: r(2), dia: r(1) }
                       : { hr: 0, spo2: 0, etco2: 0, rr: 0, sys: 0, dia: 0 };
    }
    this.compute();
    if (this.flags.any && this.clock >= this.blinkAt) { this.blinkAt = this.clock + 0.52; this.blink = !this.blink; this.dirty = true; }
    this.advance(dt);
  };

  /* gera as novas amostras varridas pelo cursor */
  Scope.prototype.advance = function (dt) {
    var N = this.N, target = this.cursor + dt / this.T * N, v = this.v, ds = this.T / N;
    var perf = clamp01((v.spo2 - 80) / 16);            // 0 = mal perfundido, 1 = estável
    var quality = clamp01((v.etco2 - 19) / 14);
    while (Math.floor(target) > Math.floor(this.cursor)) {
      this.cursor = Math.floor(this.cursor) + 1;
      var i = this.cursor % N;
      var b0 = this.beat; this.beat += ds * v.hr / 60; this.resp += ds * v.rr / 60;
      var rp = frac(this.resp), swing = Math.sin(rp * 6.2832);
      /* ECG: pega o pico dentro do intervalo da amostra para o R não "falhar" */
      var e = 0, best = -1;
      for (var k = 0; k < 4; k++) { var val = ecgAt(frac(b0 + (this.beat - b0) * (k + 1) / 4)); if (Math.abs(val) > best) { best = Math.abs(val); e = val; } }
      this.buf.ecg[i] = e * 0.86 + (1 - perf) * (0.03 * swing + (Math.random() - 0.5) * 0.035);
      this.buf.pleth[i] = wrapped(plethShape, frac(this.beat - 0.24)) / 1.03 * lerp(0.6, 0.95, perf) * (1 + 0.24 * (1 - perf) * swing);
      this.buf.co2[i] = capno(rp, quality) * Math.min(1, v.etco2 / 42);
      this.buf.resp[i] = (0.5 - 0.5 * Math.cos(rp * 6.2832)) * lerp(0.62, 1, quality) + (1 - quality) * (Math.random() - 0.5) * 0.05;
      var press = v.dia + (v.sys - v.dia) * wrapped(artShape, frac(this.beat - 0.1)) / 1.06 + (1 - perf) * 5 * swing;
      this.buf.art[i] = clamp01((press - 20) / 125);
    }
    this.cursor = target;
    if (this.cursor > N * 1000) this.cursor -= N * 1000;
  };

  Scope.prototype.fill = function (frozen) {      // preenche a tela inteira de uma vez
    this.cursor = 0; this.advance(this.T); this.cursor = frozen ? -1000 : 0;
  };

  Scope.prototype.drawWaves = function () {
    var c = this.ctx, w = this.w, h = this.h, N = this.N, f = this.flags;
    if (!this.pts) return;
    c.clearRect(0, 0, w, h);
    var colors = { ecg: f.hr ? RED : GREEN, pleth: f.spo2 ? RED : CYAN, co2: YELLOW, resp: WHITE, art: f.pa ? RED : ART };
    var cur = Math.floor(this.cursor) % N, gap = this.cursor < 0 ? 0 : this.gap, lw = Math.max(1.5, w * 0.0058);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (var r = 0; r < ROWS.length; r++) {
      var key = ROWS[r].key, buf = this.buf[key], p = this.pts[key], pen = false;
      c.beginPath();
      for (var i = 0; i < N; i++) {
        var d = (i - cur + N) % N, y = buf[i];
        if (y !== y || (gap && d > 0 && d <= gap)) { pen = false; continue; }
        var X = p[i * 4] + p[i * 4 + 2] * y, Y = p[i * 4 + 1] + p[i * 4 + 3] * y;
        if (pen) c.lineTo(X, Y); else { c.moveTo(X, Y); pen = true; }
      }
      c.strokeStyle = colors[key];
      c.globalAlpha = 0.2; c.lineWidth = lw * 3.6; c.stroke();
      c.globalAlpha = 1; c.lineWidth = lw; c.stroke();
    }
    var bw = this.cvB.width, bh = this.cvB.height;
    this.ctxB.clearRect(0, 0, bw, bh);
    this.ctxB.drawImage(this.cv, 0, 0, w * BLUR.part, h, 0, 0, bw, bh);
  };

  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* posiciona o contexto sobre um retângulo do painel (afim: a perspectiva dentro de um bloco é desprezível) */
  Scope.prototype.place = function (c, u0, v0, u1, v1) {
    var A = this.toCanvas(H_PANEL(u0, v0)), B = this.toCanvas(H_PANEL(u1, v0)), D = this.toCanvas(H_PANEL(u0, v1));
    var w = Math.hypot(B[0] - A[0], B[1] - A[1]), h = Math.hypot(D[0] - A[0], D[1] - A[1]);
    c.setTransform((B[0] - A[0]) / w, (B[1] - A[1]) / w, (D[0] - A[0]) / h, (D[1] - A[1]) / h, A[0], A[1]);
    return [w, h];
  };

  Scope.prototype.drawPanel = function () {
    var c = this.ctxP, s = this.shown, f = this.flags, self = this, glow = this.w * 0.011;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.w, this.h);
    c.textBaseline = 'alphabetic';
    var normal = { hr: GREEN, spo2: CYAN, etco2: YELLOW, rr: WHITE, pa: ART };
    var tint = function (k) { return f[k] ? (k === 'etco2' ? YELLOW : RED) : normal[k]; };

    BANDS.forEach(function (b) {
      var on = f[b.key], ok = b.key === 'hr' && self.rescue && !f.any;
      var d = self.place(c, 0.012, b.v0, 0.988, b.v1), w = d[0], h = d[1], col = ok ? GREEN : tint(b.key);
      rrect(c, 0, 0, w, h, h * 0.16);
      if (on || ok) {
        c.shadowColor = col; c.shadowBlur = glow * 1.2;
        c.globalAlpha = ok ? 0.2 : (self.blink ? 0.34 : 0.13); c.fillStyle = col; c.fill();
        c.globalAlpha = ok ? 0.9 : (self.blink ? 1 : 0.6); c.lineWidth = Math.max(1, h * 0.06); c.strokeStyle = col; c.stroke();
        c.shadowBlur = glow * 0.5; c.globalAlpha = ok || self.blink ? 1 : 0.62; c.fillStyle = ok ? '#bfffd9' : (b.key === 'etco2' ? '#ffe9a6' : '#ff5b5b');
        c.font = '600 ' + (h * 0.7) + 'px ' + FONT; c.textAlign = 'left';
        c.fillText(ok ? 'ESTÁVEL' : '!!!  ' + b.text, w * 0.045, h * 0.76);
      } else {
        c.shadowBlur = 0; c.globalAlpha = 0.5; c.lineWidth = Math.max(1, h * 0.04); c.strokeStyle = 'rgba(120,150,195,.3)'; c.stroke();
      }
      c.globalAlpha = 1; c.shadowBlur = 0;
    });

    TILES.forEach(function (t) {
      var d = self.place(c, 0.012, t.v0, 0.988, t.v1), w = d[0], h = d[1], col = tint(t.key), pa = t.key === 'pa';
      var unitH = pa ? h * 0.62 : h;                       // PA tem duas linhas
      c.fillStyle = col; c.shadowColor = col;
      /* rótulo */
      var ls = unitH * 0.3; c.shadowBlur = glow * 0.5; c.textAlign = 'left'; c.font = '600 ' + ls + 'px ' + FONT;
      c.fillText(t.label, w * 0.035, unitH * 0.36);
      var lw = c.measureText(t.label).width;
      if (t.sub) { c.font = '600 ' + ls * 0.66 + 'px ' + FONT; c.fillText(t.sub, w * 0.035 + lw + ls * 0.04, unitH * 0.36 + ls * 0.2); }
      if (t.unit) { c.font = '600 ' + ls * 0.6 + 'px ' + FONT; c.globalAlpha = 0.85; c.fillText(t.unit, w * 0.035 + lw + ls * 0.3, unitH * 0.36); c.globalAlpha = 1; }
      /* valor */
      c.textAlign = 'center'; c.shadowBlur = glow;
      if (pa) {
        c.font = '600 ' + h * 0.47 + 'px ' + FONT; c.fillText(s.sys + '/' + s.dia, w * 0.47, h * 0.64);
        c.font = '600 ' + h * 0.27 + 'px ' + FONT; c.fillText('(' + s.map + ')', w * 0.5, h * 0.93);
      } else {
        c.font = '600 ' + h * 0.96 + 'px ' + FONT; c.fillText(String(s[t.key]), w * 0.54, h * 0.85);
      }
      /* limites de alarme */
      c.textAlign = 'right'; c.shadowBlur = glow * 0.4; c.globalAlpha = 0.9; c.font = '600 ' + unitH * 0.3 + 'px ' + FONT;
      c.fillText(String(t.hi), w * 0.975, unitH * (pa ? 0.62 : 0.4)); c.fillText(String(t.lo), w * 0.975, unitH * (pa ? 0.98 : 0.78));
      c.globalAlpha = 1; c.shadowBlur = 0;
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.dirty = false;
  };

  Scope.prototype.render = function () {
    if (!this.w) this.resize();
    if (!this.w) return;
    this.drawWaves();
    if (this.dirty) this.drawPanel();
  };

  Scope.prototype.reset = function () {
    this.p = 0; this.armed = false; this.wait = 0; this.v = copy(CRASH); this.compute();
  };

  /* ---------- orquestra ---------- */
  var scopes = $$('.scene[data-scope]').map(function (el) { return new Scope(el); });
  var running = false, last = 0, FRAME = 1000 / 31;

  function loop(now) {
    if (now - last < FRAME) { requestAnimationFrame(loop); return; }   // ~30 quadros/s bastam para a varredura
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    var live = false;
    scopes.forEach(function (s) { if (s.visible) { live = true; s.update(dt); s.render(); } });
    if (live) requestAnimationFrame(loop); else running = false;
  }
  function wake() { if (!running && !REDUCED) { running = true; last = performance.now(); requestAnimationFrame(loop); } }

  function still(s) {                 // quadro único para quem pediu menos movimento
    if (s.rescue) { s.v = copy(STABLE); s.p = 1; }
    s.blink = true; s.compute(); s.fill(true); s.dirty = true; s.render();
  }

  scopes.forEach(function (s) {
    s.resize();
    if ('ResizeObserver' in window) new ResizeObserver(function () { s.resize(); if (REDUCED) { s.dirty = true; s.render(); } }).observe(s.scene);
    else window.addEventListener('resize', function () { s.resize(); if (REDUCED) { s.dirty = true; s.render(); } });
    if (REDUCED) { still(s); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        var e = es[es.length - 1];
        s.visible = e.isIntersecting;
        if (s.rescue) {
          if (!e.isIntersecting) s.reset();
          else if (e.intersectionRatio >= 0.5 && !s.armed) { s.armed = true; s.wait = 1.5; }
        }
        if (s.visible) wake();
      }, { threshold: [0, 0.5] }).observe(s.scene);
    } else { s.visible = true; s.armed = true; wake(); }
  });

  /* os números usam a Barlow Condensed: redesenha quando a fonte chegar */
  if (doc.fonts && doc.fonts.load) {
    doc.fonts.load('600 40px "Barlow Condensed"').then(function () {
      scopes.forEach(function (s) { s.dirty = true; if (REDUCED) s.render(); });
    });
  }
})();
