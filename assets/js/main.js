// StudyStand site: intro film, 3D scroll story, section animations and pre-order form.
import { createStand } from './stand.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const narrowQuery = matchMedia('(max-width: 860px), (max-aspect-ratio: 9/10)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

/* ================= 3D stage ================= */
let stand = null;
try {
  stand = createStand($('#gl'), { reduce, narrowQuery });
} catch (err) {
  console.warn('WebGL indisponible', err);
  $('#gl').hidden = true;
  $('.stage-fallback').hidden = false;
}

const panels = $$('.panel');
const railItems = $$('#rail li');
const hotspots = $$('.hotspot');
const gaugeFill = $('#gauge-fill');
const gaugeVal = $('#gauge-val');
const stageWord = $('#stage-word');
const scrollHint = $('#scroll-hint');
// [fade-in start, fade-in end, fade-out start, fade-out end] in stage progress
const WINDOWS = [[-1, 0, 0.12, 0.18], [0.18, 0.24, 0.38, 0.44], [0.44, 0.5, 0.63, 0.69], [0.69, 0.75, 2, 3]];
const ARC = 157.08;

function updateStage(p, info) {
  let best = 0, bestO = -1;
  panels.forEach((el, i) => {
    const [a, b, c, d] = WINDOWS[i];
    const o = clamp((p - a) / (b - a)) * (1 - clamp((p - c) / (d - c)));
    el.style.opacity = o.toFixed(3);
    el.style.visibility = o < 0.02 ? 'hidden' : 'visible';
    const shift = (1 - o) * 26 * (p > (b + c) / 2 ? -1 : 1);
    el.style.translate = `0 ${shift.toFixed(1)}px`;
    if (o > bestO) { bestO = o; best = i; }
  });
  railItems.forEach((li, i) => li.classList.toggle('is-on', i === best));

  if (info) {
    const lift = info.lift;
    const frac = clamp((lift - 1.5) / (68 - 1.5));
    gaugeFill.style.strokeDashoffset = (ARC * (1 - frac)).toFixed(1);
    gaugeVal.textContent = Math.round(lift);
    const hv = clamp((p - 0.72) / 0.05) * info.intro;
    info.hotspots.forEach((pt, i) => {
      const el = hotspots[i];
      if (!el) return;
      el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
      el.style.opacity = (pt.front ? hv : 0).toFixed(3);
      el.classList.toggle('is-left', pt.x > window.innerWidth * (info.narrow ? 0.5 : 0.68));
    });
  }
  if (stageWord) stageWord.style.transform = `translateX(${(-p * 38).toFixed(2)}%)`;
  if (scrollHint) scrollHint.style.opacity = p > 0.03 ? '0' : '1';
}

ScrollTrigger.create({
  trigger: '#stage',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => {
    if (stand) stand.setProgress(self.progress);
    else updateStage(self.progress);
  },
});
if (stand) stand.onFrame = updateStage;
else updateStage(0);

// finish swatches (stage) keep the form's finish select in sync
const finishSelect = $('#f-finish');
function setFinish(name) {
  $$('.swatch').forEach((b) => {
    const on = b.dataset.finish === name;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', String(on));
  });
  if (finishSelect) finishSelect.value = name;
  stand?.setFinish(name);
}
$$('.swatch').forEach((b) => b.addEventListener('click', () => setFinish(b.dataset.finish)));
finishSelect?.addEventListener('change', () => setFinish(finishSelect.value));

/* ================= Hero entrance ================= */
function heroIn() {
  stand?.playIntro();
  if (reduce) return;
  gsap.timeline({ delay: 0.15 })
    .fromTo('.hero-line > span', { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 })
    .fromTo(['.panel--hero .eyebrow', '.hero-lead', '.hero-ctas > *', '.hero-chips li'],
      { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, 0.35)
    .fromTo('.nav', { yPercent: -100 }, { yPercent: 0, duration: 0.8, ease: 'power3.out', clearProps: 'transform' }, 0.2);
}

/* ================= Intro film ================= */
const intro = $('#intro');
const iv = $('#intro-video');
const ibg = $('#intro-bg');
const ibar = $('#intro-bar');
const iplay = $('#intro-play');
let introOpen = true;
let introTimer = 0;

function closeIntro() {
  if (!introOpen) return;
  introOpen = false;
  clearTimeout(introTimer);
  root.classList.remove('is-intro');
  const done = () => { intro.hidden = true; iv.pause(); ibg.pause(); };
  if (reduce) { done(); heroIn(); return; }
  gsap.timeline({ onComplete: done })
    .to(iv, { scale: 1.12, filter: 'blur(6px)', duration: 0.9, ease: 'power2.in' }, 0)
    .to(intro, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut' }, 0.15);
  heroIn();
}

function playFilm() {
  iv.muted = true;
  const p = iv.play();
  if (p && p.then) {
    p.then(() => { iplay.hidden = true; ibg.play().catch(() => {}); })
      .catch(() => { iplay.hidden = false; });
  }
}

function openIntro() {
  introOpen = true;
  stand?.holdIntro();
  root.classList.add('is-intro');
  intro.hidden = false;
  gsap.set(intro, { autoAlpha: 1 });
  gsap.set(iv, { scale: 1, filter: 'blur(0px)' });
  iv.currentTime = 0;
  ibg.currentTime = 0;
  ibar.style.transform = 'scaleX(0)';
  playFilm();
  // safety net: never trap the visitor if the video stalls
  introTimer = setTimeout(() => { if (introOpen && iv.paused && iplay.hidden) closeIntro(); }, 6000);
}

iv.addEventListener('timeupdate', () => {
  if (iv.duration) ibar.style.transform = `scaleX(${(iv.currentTime / iv.duration).toFixed(4)})`;
  if (Math.abs(ibg.currentTime - iv.currentTime) > 0.3) ibg.currentTime = iv.currentTime;
});
iv.addEventListener('ended', closeIntro);
iv.addEventListener('error', closeIntro);
iv.querySelector('source:last-of-type')?.addEventListener('error', closeIntro);
$('#intro-skip').addEventListener('click', closeIntro);
iplay.addEventListener('click', playFilm);
document.addEventListener('keydown', (e) => { if (introOpen && e.key === 'Escape') closeIntro(); });
$$('[data-replay]').forEach((b) => b.addEventListener('click', () => { window.scrollTo({ top: 0 }); openIntro(); }));

if (new URLSearchParams(location.search).has('nointro')) {
  introOpen = true;
  intro.hidden = true;
  closeIntro();
} else {
  stand?.holdIntro();
  root.classList.add('is-intro');
  playFilm();
  introTimer = setTimeout(() => { if (introOpen && iv.paused && iplay.hidden) closeIntro(); }, 6000);
}

/* ================= Nav ================= */
const nav = $('#nav');
const burger = $('#nav-burger');
const menu = $('#nav-menu');
let lastY = 0;
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  menu.hidden = !open;
  root.style.overflow = open ? 'hidden' : '';
  if (open && !reduce) gsap.from('#nav-menu > *', { y: 24, opacity: 0, stagger: 0.04, duration: 0.5, ease: 'power3.out' });
}
burger.addEventListener('click', () => setMenu(menu.hidden));
$$('#nav-menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('is-solid', y > 40);
  const hide = y > lastY && y > 500 && menu.hidden;
  nav.classList.toggle('is-hidden', hide);
  lastY = y;
}, { passive: true });

/* ================= Scroll progress ================= */
gsap.to('.scroll-progress span', {
  scaleX: 1, ease: 'none',
  scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
});

/* ================= Section reveals ================= */
if (!reduce) {
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  $$('[data-stagger]').forEach((group) => {
    gsap.from(group.children, { y: 36, opacity: 0, duration: 0.85, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: group, start: 'top 86%', once: true } });
  });

  // statement: words light up as you read
  const st = $('#statement');
  const nodes = Array.from(st.childNodes);
  st.textContent = '';
  nodes.forEach((n) => {
    if (n.nodeType === 3) {
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { st.append(part); return; }
        const s = document.createElement('span'); s.className = 'w'; s.textContent = part; st.append(s);
      });
    } else {
      n.classList.add('w');
      st.append(n);
    }
  });
  gsap.fromTo('#statement .w', { opacity: 0.16 }, {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: st, start: 'top 80%', end: 'bottom 50%', scrub: 0.5 },
  });

  // posture illustration: screen rises, head straightens
  gsap.timeline({ scrollTrigger: { trigger: '#posture', start: 'top 75%', end: 'bottom 55%', scrub: 0.6 } })
    .to('#p-stand', { opacity: 1, duration: 0.3 }, 0)
    .to('#p-laptop', { y: -66, duration: 1, ease: 'power2.inOut' }, 0)
    .fromTo('#p-head', { rotation: 26, svgOrigin: '112 160' }, { rotation: -2, svgOrigin: '112 160', duration: 1, ease: 'power2.inOut' }, 0)
    .to('#p-pain', { opacity: 0, scale: 0.4, svgOrigin: '114 146', duration: 0.7 }, 0.2)
    .to('#sight-bad', { opacity: 0, duration: 0.4 }, 0.3)
    .to('#sight-good', { opacity: 1, duration: 0.4 }, 0.6)
    .to('#lbl-bad', { opacity: 0, duration: 0.3 }, 0.4)
    .to('#lbl-good', { opacity: 1, duration: 0.3 }, 0.6);

  // film stills drift at different speeds
  $$('.shot').forEach((shot) => {
    const sp = parseFloat(shot.dataset.speed || 0);
    if (narrowQuery.matches) return;
    gsap.fromTo(shot, { yPercent: sp }, { yPercent: -sp, ease: 'none', scrollTrigger: { trigger: '#shots', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo(shot.querySelector('img'), { scale: 1.18 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: shot, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // money bar grows
  gsap.from('#bar > div', { scaleX: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#bar', start: 'top 85%', once: true } });

  // roadmap line fills as you scroll
  const roadFill = $('#road-fill');
  const roadItems = $$('#road li');
  ScrollTrigger.create({
    trigger: '#road', start: 'top 75%', end: 'bottom 55%', scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      roadFill.style.transform = narrowQuery.matches ? `scaleY(${p})` : `scaleX(${p})`;
      roadItems.forEach((li, i) => li.classList.toggle('is-on', p >= i / (roadItems.length - 1) - 0.02));
    },
  });
  roadFill.style.transform = narrowQuery.matches ? 'scaleY(0)' : 'scaleX(0)';
} else {
  $$('#road li').forEach((li) => li.classList.add('is-on'));
  gsap.set(['#p-stand', '#sight-good', '#lbl-good'], { opacity: 1 });
  gsap.set(['#sight-bad', '#lbl-bad', '#p-pain'], { opacity: 0 });
  gsap.set('#p-laptop', { y: -66 });
}

/* ================= Counters ================= */
$$('[data-count]').forEach((el) => {
  const end = Number(el.dataset.count);
  if (reduce) return;
  ScrollTrigger.create({
    trigger: el, start: 'top 90%', once: true,
    onEnter: () => {
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
    },
  });
});

/* ================= Tabs ================= */
const tabs = $$('.tab');
function selectTab(i, focus) {
  tabs.forEach((t, j) => {
    const on = i === j;
    t.classList.toggle('is-on', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tabs[i].focus();
  if (!reduce) gsap.from(`#tp-${i} > *`, { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07 });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(i));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') selectTab((i + 1) % tabs.length, true);
    if (e.key === 'ArrowLeft') selectTab((i - 1 + tabs.length) % tabs.length, true);
  });
});

/* ================= Pre-order form ================= */
const form = $('#order-form');
const qty = $('#f-qty');
const total = $('#total');
const PRICE = 100;
const updateTotal = () => {
  const q = clamp(parseInt(qty.value, 10) || 1, 1, 10);
  total.textContent = q * PRICE;
};
$$('.qty-b').forEach((b) => b.addEventListener('click', () => {
  qty.value = clamp((parseInt(qty.value, 10) || 1) + Number(b.dataset.q), 1, 10);
  updateTotal();
}));
qty.addEventListener('input', updateTotal);

function fieldError(id, msg) {
  const input = $('#f-' + id);
  input.closest('.field').classList.toggle('has-err', !!msg);
  $('#e-' + id).textContent = msg || '';
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (msg) input.setAttribute('aria-describedby', 'e-' + id); else input.removeAttribute('aria-describedby');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#f-name').value.trim();
  const contact = $('#f-contact').value.trim();
  let ok = true;
  if (name.length < 2) { fieldError('name', 'Indiquez votre nom pour réserver.'); ok = false; } else fieldError('name');
  const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const isPhone = /^[+\d][\d\s.-]{7,}$/.test(contact);
  if (!isMail && !isPhone) { fieldError('contact', 'Entrez un e-mail valide ou un numéro de téléphone.'); ok = false; } else fieldError('contact');
  if (!ok) { form.querySelector('.has-err input')?.focus(); return; }

  const q = clamp(parseInt(qty.value, 10) || 1, 1, 10);
  const ref = 'SS-' + Math.floor(1000 + Math.random() * 9000);
  const list = store.get('studystand-preorders', []);
  list.push({ ref, name, contact, profile: $('#f-profile').value, finish: finishSelect.value, qty: q, at: new Date().toISOString() });
  store.set('studystand-preorders', list);

  const finishName = finishSelect.options[finishSelect.selectedIndex].text;
  $('#done-text').textContent = `Merci ${name.split(' ')[0]} ! ${q} StudyStand ${finishName} réservé${q > 1 ? 's' : ''}, soit ${q * PRICE} DH. Nous vous recontacterons pour la livraison.`;
  $('#done-ref').textContent = ref;
  $('#done-count').textContent = `${list.length} précommande${list.length > 1 ? 's' : ''} enregistrée${list.length > 1 ? 's' : ''} sur cet appareil.`;
  $('#form-body').hidden = true;
  $('#form-done').hidden = false;
  if (!reduce) gsap.from('#form-done > *', { y: 20, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' });
});
$('#order-again').addEventListener('click', () => {
  form.reset();
  setFinish('argent');
  updateTotal();
  $('#form-done').hidden = true;
  $('#form-body').hidden = false;
  $('#f-name').focus();
});

/* ================= Pointer niceties ================= */
if (finePointer && !reduce) {
  // custom cursor
  const cursor = $('.cursor');
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  const label = ring.querySelector('em');
  let cx = innerWidth / 2, cy = innerHeight / 2, rx = cx, ry = cy;
  window.addEventListener('pointermove', (e) => { cx = e.clientX; cy = e.clientY; }, { passive: true });
  gsap.ticker.add(() => {
    rx += (cx - rx) * 0.18; ry += (cy - ry) * 0.18;
    dot.style.transform = `translate(${cx}px, ${cy}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
  });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const link = t.closest('a, button, select, input, label');
    const onGl = t.id === 'gl' && !introOpen;
    cursor.classList.toggle('is-link', !!link);
    cursor.classList.toggle('is-drag', onGl);
    label.textContent = onGl ? 'Glisser' : '';
  });
  document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));

  // magnetic buttons
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.3}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  // tilt cards with spotlight
  $$('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ================= Misc ================= */
$('#year').textContent = new Date().getFullYear();
window.addEventListener('load', () => ScrollTrigger.refresh());
narrowQuery.addEventListener?.('change', () => { stand?.resize(); ScrollTrigger.refresh(); });
