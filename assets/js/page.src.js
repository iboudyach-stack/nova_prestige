// StudyStand page script. Bundled to assets/js/page.js with `npm run build` (see README).
// Everything that animates hangs off ONE requestAnimationFrame loop:
//   smooth wheel scrolling (Lenis, desktop only), the custom cursor, the two
//   full-screen frame sequences, and the "Réglez la hauteur" 3D act.
// Also: confetti when the team list arrives, and the pre-order form.
import Lenis from 'lenis';
import confetti from 'canvas-confetti';
import { createStand } from './stand3d.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const narrowQuery = matchMedia('(max-width: 860px)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const span = (p, a, b) => smooth((p - a) / (b - a));
const root = document.documentElement;

/* ============================== the loop ============================== */
const ticks = [];
let lenis = null;
let last = 0;
// Easing is per second, not per frame, so motion settles on time at any frame rate
// (a slow laptop at 20 fps settles as fast as a fast one at 120).
const ease = (k60, dt) => 1 - Math.pow(1 - k60, dt * 60);
function loop(time) {
  const dt = Math.min(0.1, last ? (time - last) / 1000 : 1 / 60);
  last = time;
  lenis?.raf(time);
  for (const fn of ticks) fn(dt);
  requestAnimationFrame(loop);
}

/* ========================= smooth wheel scroll ==========================
   Desktop only. Lenis moves the real window scroll, so the scroll engine,
   the sticky stages and the sequences read it unchanged. Touch keeps the
   phone's own native scrolling. */
if (fine && !reduce) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id.length > 1 && document.querySelector(id);
    if (!el && id !== '#top') return;
    e.preventDefault();
    lenis.scrollTo(id === '#top' ? 0 : el, { duration: 1.4 });
  }));
}

// top bar stays out of the opening shot
const markScrolled = () => root.classList.toggle('is-scrolled', scrollY > 60);
addEventListener('scroll', markScrolled, { passive: true });
markScrolled();

/* ============================ custom cursor ============================ */
if (fine && !reduce) {
  const cur = document.createElement('div');
  cur.className = 'cursor';
  cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<span class="cursor__ring"><b>Glisser</b></span><span class="cursor__dot"></span>';
  document.body.append(cur);
  const dot = cur.lastElementChild, ring = cur.firstElementChild;
  root.classList.add('has-cursor');
  let x = -100, y = -100, rx = -100, ry = -100, moved = false;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; moved = true; }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const text = t.closest('input:not([type="range"]), textarea');
    const drag = t.id === 'gl' || t.closest('#hinge');
    const link = !drag && !text && t.closest('a, button, select, label, [role="tab"]');
    cur.classList.toggle('is-text', !!text);
    cur.classList.toggle('is-drag', !!drag);
    cur.classList.toggle('is-link', !!link);
  });
  document.addEventListener('pointerleave', () => cur.classList.add('is-out'));
  document.addEventListener('pointerenter', () => cur.classList.remove('is-out'));
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  ticks.push((dt) => {
    if (!moved && Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1) return;
    moved = false;
    const k = ease(0.2, dt);
    rx += (x - rx) * k; ry += (y - ry) * k;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
  });
}

/* ===================== full-screen frame sequences =====================
   Each canvas[data-seq] draws one still per scroll position, cover-fitted to
   the screen. Frames map across the act's whole time on screen, so the shot
   keeps moving while the stage slides in and out. Plain images on a canvas:
   no video decoder, so it behaves the same in every browser and on iPhone. */
const measurers = [];
function remeasure() { for (const m of measurers) m(); }

function sequence(canvas) {
  const act = canvas.closest('[data-sc-act]');
  const base = canvas.dataset.seq;
  const count = parseInt(canvas.dataset.seqCount, 10);
  const ctx = canvas.getContext('2d');
  let set = '', frames = [], queue = [], inflight = 0;
  let cur = 0, drawn = -1, near = false, dirty = true;
  let y0 = 0, y1 = 1;

  const url = (i) => `${base}/${set}/${String(i + 1).padStart(3, '0')}.webp`;
  function pump() {
    while (inflight < 6 && queue.length) {
      const i = queue.shift();
      if (frames[i]) continue;
      const img = new Image();
      const mine = set;
      inflight++;
      img.src = url(i);
      frames[i] = img;
      // decode off the draw path, so the first draw of a frame never hitches
      img.decode().then(() => { if (mine === set) { img.ok = true; dirty = true; } })
        .catch(() => {})
        .finally(() => { inflight--; pump(); });
    }
  }
  function choose() {
    const next = narrowQuery.matches ? 'm' : 'd';
    if (next === set) return;
    set = next; frames = new Array(count); queue = []; drawn = -1; dirty = true;
    // coarse to fine, so a fast scroll always has a nearby frame to show
    const seen = new Set();
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); queue.push(i); }
    if (!seen.has(count - 1)) queue.splice(1, 0, count - 1);
  }
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    drawn = -1; dirty = true;
  }
  function measure() {
    const top = act.getBoundingClientRect().top + scrollY;
    const max = root.scrollHeight - innerHeight;
    y0 = Math.max(0, top - innerHeight);
    y1 = Math.min(max, top + act.offsetHeight);
  }
  function nearest(i) {
    for (let d = 0; d < count; d++) {
      const a = frames[i - d], b = frames[i + d];
      if (a && a.ok) return a;
      if (b && b.ok) return b;
    }
    return null;
  }

  choose();
  pump();
  narrowQuery.addEventListener?.('change', () => { choose(); pump(); });
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver((es) => { near = es[0].isIntersecting; }, { rootMargin: '150% 0px' }).observe(act);
  measurers.push(measure);
  size();
  measure();

  const k60 = lenis ? 0.32 : 0.24;
  ticks.push((dt) => {
    if (!near) return;
    const target = clamp((scrollY - y0) / Math.max(1, y1 - y0)) * (count - 1);
    cur += (target - cur) * (reduce ? 1 : ease(k60, dt));
    if (Math.abs(target - cur) < 0.01) cur = target;
    const idx = Math.round(cur);
    if (idx === drawn && !dirty) return;
    const img = nearest(idx);
    if (!img) return;
    dirty = false;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    drawn = frames[idx] && frames[idx].ok ? idx : -1;
  });
}
document.querySelectorAll('canvas[data-seq]').forEach(sequence);
// page height changes as fonts and images settle: keep the scroll maps true
new ResizeObserver(remeasure).observe(document.body);
addEventListener('load', remeasure);

/* ============================== the peak ============================== */
const act = document.getElementById('hauteur');
const canvas = document.getElementById('gl');
const sight = document.getElementById('sight');
const sightLabel = document.getElementById('sight-label');
const line = document.getElementById('sight-line');
const level = document.getElementById('sight-level');
const eye = document.getElementById('sight-eye');
const topDot = document.getElementById('sight-top');
const slider = document.getElementById('hinge');
const status = document.getElementById('hauteur-status');
const hint = document.getElementById('hauteur-hint');

let stand = null;
try {
  stand = createStand(canvas, { narrowQuery });
} catch (err) {
  console.warn('WebGL indisponible', err);
  act.classList.add('no-gl');
  canvas.hidden = true;
}

if (stand) {
  const T = stand.TARGET_LIFT;
  let touched = false;
  const shown = { lift: 40, yaw: 0.55, pitch: 0.32, laptop: 0 };
  let mx = 0, pmx = 0;
  let visible = false;
  let lastLevel = null;
  let lastP = -1;

  const setFill = () => {
    const f = (slider.value - slider.min) / (slider.max - slider.min);
    slider.style.setProperty('--fill', `${(f * 100).toFixed(1)}%`);
  };
  slider.addEventListener('input', () => { touched = true; setFill(); stand.dirty = true; });
  setFill();

  if (fine && !reduce) {
    addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) stand.dirty = true; }, { rootMargin: '120px' }).observe(act);

  ticks.push((dt) => {
    if (!visible) return;
    const p = parseFloat(act.style.getPropertyValue('--sc-p')) || 0;

    // target pose from scroll
    let lift, yaw, pitch, laptop;
    const sideYaw = narrowQuery.matches ? 0.95 : 1.2;
    if (p < 0.28) {
      const t = span(p, 0.02, 0.26);
      lift = lerp(40, 1.5, t); yaw = lerp(0.55, 1.0, t); pitch = lerp(0.32, 0.42, t); laptop = 0;
    } else if (p < 0.5) {
      const t = span(p, 0.3, 0.46);
      lift = lerp(1.5, 12, t); yaw = lerp(1.0, sideYaw, t); pitch = lerp(0.42, 0.05, t);
      laptop = span(p, 0.3, 0.44);
    } else {
      yaw = sideYaw; pitch = 0.05; laptop = 1;
      if (!touched) {
        lift = lerp(12, T, span(p, 0.56, 0.86));
        if (p !== lastP) { slider.value = lift.toFixed(1); setFill(); }
      } else {
        lift = parseFloat(slider.value);
      }
    }
    lastP = p;

    pmx += (mx - pmx) * ease(0.06, dt);
    if (Math.abs(mx - pmx) < 1e-3) pmx = mx;
    const k = reduce ? 1 : ease(0.16, dt);
    const settle = (a, b) => (Math.abs(b - a) < 1e-3 ? b : a + (b - a) * k);
    const next = {
      lift: settle(shown.lift, lift),
      yaw: settle(shown.yaw, yaw + pmx * 0.14),
      pitch: settle(shown.pitch, pitch),
      laptop: reduce ? laptop : settle(shown.laptop, laptop),
    };
    // nothing moved: skip the WebGL render entirely
    const moving = next.lift !== shown.lift || next.yaw !== shown.yaw
      || next.pitch !== shown.pitch || next.laptop !== shown.laptop;
    if (!moving && !stand.dirty) return;
    Object.assign(shown, next);
    stand.dirty = false;

    Object.assign(stand.state, shown);
    const r = stand.render();

    // sightline overlay
    const on = p > 0.46 && shown.laptop > 0.9;
    sight.classList.toggle('is-on', on);
    sightLabel.classList.toggle('is-on', on);
    if (on) {
      line.setAttribute('x1', r.eye.x); line.setAttribute('y1', r.eye.y);
      line.setAttribute('x2', r.screenTop.x); line.setAttribute('y2', r.screenTop.y);
      const dir = r.screenTop.x < r.eye.x ? -1 : 1;
      level.setAttribute('x1', r.eye.x); level.setAttribute('y1', r.eye.y);
      level.setAttribute('x2', r.eye.x + dir * Math.abs(r.screenTop.x - r.eye.x) * 1.25); level.setAttribute('y2', r.eye.y);
      eye.setAttribute('cx', r.eye.x); eye.setAttribute('cy', r.eye.y);
      topDot.setAttribute('cx', r.screenTop.x); topDot.setAttribute('cy', r.screenTop.y);
      const lw = sightLabel.offsetWidth;
      const lx = clamp(r.eye.x - lw / 2, 12, canvas.clientWidth - lw - 12);
      sightLabel.style.transform = `translate(${lx.toFixed(1)}px, ${(r.eye.y + 16).toFixed(1)}px)`;
    }

    const isLevel = on && Math.abs(r.offset) < 0.04;
    sight.classList.toggle('is-level', isLevel);
    act.classList.toggle('is-level', isLevel);
    const state = !on ? null : isLevel ? 'level' : r.offset < 0 ? 'low' : 'high';
    if (state !== lastLevel && state) {
      lastLevel = state;
      if (state === 'level') { status.textContent = 'Écran à hauteur des yeux.'; hint.textContent = 'Votre confort, notre priorité.'; }
      else if (state === 'low') { status.textContent = "L'écran est trop bas."; hint.textContent = "Montez l'écran jusqu'à la ligne de vos yeux."; }
      else { status.textContent = "L'écran est trop haut."; hint.textContent = "Redescendez jusqu'à la ligne de vos yeux."; }
    }
  });
}

/* ============================== confetti ==============================
   Fires once when the team list arrives, and again (smaller) on a pre-order.
   canvas-confetti skips itself under reduced motion. */
const COLORS = ['#F5821F', '#FFFFFF', '#C9CDD3', '#23375E', '#FF9B42'];
function celebrate(scale = 1) {
  const base = {
    particleCount: Math.round(70 * scale), spread: 70, startVelocity: 58, ticks: 240,
    gravity: 0.95, scalar: 1.05, colors: COLORS, zIndex: 90, disableForReducedMotion: true,
  };
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.92 } });
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.92 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: Math.round(40 * scale), angle: 75, spread: 90, origin: { x: 0.15, y: 0.95 } });
    confetti({ ...base, particleCount: Math.round(40 * scale), angle: 105, spread: 90, origin: { x: 0.85, y: 0.95 } });
  }, 260);
}
const team = document.querySelector('.foot__team');
if (team) {
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    celebrate(1);
  }, { threshold: 0.4 });
  io.observe(team);
}

/* ============================== pre-order ============================== */
const form = document.getElementById('order');
const qty = document.getElementById('o-qty');
const total = document.getElementById('o-total');
const err = document.getElementById('o-err');
const done = document.getElementById('o-done');
const PRICE = 100;
const q = () => clamp(parseInt(qty.value, 10) || 1, 1, 10);
qty.addEventListener('input', () => { total.textContent = `${q() * PRICE} DH`; });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.elements.name.value.trim();
  const contact = form.elements.contact.value.trim();
  const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const phone = /^[+\d][\d\s.-]{7,}$/.test(contact);
  if (name.length < 2) { err.textContent = 'Indiquez votre nom.'; form.elements.name.focus(); return; }
  if (!mail && !phone) { err.textContent = 'Entrez un e-mail valide ou un numéro de téléphone.'; form.elements.contact.focus(); return; }
  err.textContent = '';
  const n = q();
  let count = 1;
  try {
    const list = JSON.parse(localStorage.getItem('studystand-precommandes') || '[]');
    list.push({ name, contact, qty: n, at: new Date().toISOString() });
    localStorage.setItem('studystand-precommandes', JSON.stringify(list));
    count = list.length;
  } catch { /* storage unavailable: the confirmation still shows */ }
  done.hidden = false;
  done.textContent = `Merci ${name.split(' ')[0]}. ${n} StudyStand réservé${n > 1 ? 's' : ''}, ${n * PRICE} DH. Précommandes sur cet appareil : ${count}.`;
  form.reset();
  total.textContent = `${PRICE} DH`;
  celebrate(0.6);
});

requestAnimationFrame(loop);
