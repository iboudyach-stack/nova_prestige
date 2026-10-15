// StudyStand page script. Bundled to assets/js/page.js (see README).
// 1) The "Réglez la hauteur" act: fold, unfold, then the visitor raises the screen to eye level.
// 2) The pre-order form at the end of the page.
import { createStand } from './stand3d.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const narrowQuery = matchMedia('(max-width: 860px)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const span = (p, a, b) => smooth((p - a) / (b - a));

/* ===================== full-screen frame sequences =====================
   Each canvas[data-seq] draws one still per scroll position, cover-fitted to
   the screen. Frames map across the act's whole time on screen, so the shot
   keeps moving while the stage slides in and out. Plain images on a canvas:
   no video decoder, so it behaves the same in every browser and on iPhone. */
const smallQuery = matchMedia('(max-width: 860px)');

function sequence(canvas) {
  const act = canvas.closest('[data-sc-act]');
  const base = canvas.dataset.seq;
  const count = parseInt(canvas.dataset.seqCount, 10);
  const ctx = canvas.getContext('2d');
  let set = '', frames = [], queue = [], inflight = 0;
  let cur = 0, drawn = -1, near = false, dirty = true;

  const url = (i) => `${base}/${set}/${String(i + 1).padStart(3, '0')}.webp`;
  function pump() {
    while (inflight < 6 && queue.length) {
      const i = queue.shift();
      if (frames[i]) continue;
      const img = new Image();
      img.decoding = 'async';
      inflight++;
      img.onload = () => { img.ok = true; inflight--; dirty = true; pump(); };
      img.onerror = () => { inflight--; pump(); };
      img.src = url(i);
      frames[i] = img;
    }
  }
  function choose() {
    const next = smallQuery.matches ? 'm' : 'd';
    if (next === set) return;
    set = next; frames = new Array(count); queue = []; drawn = -1;
    // coarse to fine, so a fast scroll always has a nearby frame to show
    const seen = new Set();
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); queue.push(i); }
    if (!seen.has(count - 1)) queue.splice(1, 0, count - 1);
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    drawn = -1;
  }
  function nearest(i) {
    for (let d = 0; d < count; d++) {
      const a = frames[i - d], b = frames[i + d];
      if (a && a.ok) return a;
      if (b && b.ok) return b;
    }
    return null;
  }
  function progress() {
    const r = act.getBoundingClientRect();
    const top = r.top + scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y0 = Math.max(0, top - innerHeight);
    const y1 = Math.min(max, top + r.height);
    return clamp((scrollY - y0) / Math.max(1, y1 - y0));
  }

  choose();
  pump();
  smallQuery.addEventListener?.('change', () => { choose(); pump(); });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((es) => { near = es[0].isIntersecting; }, { rootMargin: '150% 0px' }).observe(act);
  resize();

  const tick = () => {
    requestAnimationFrame(tick);
    if (!near) return;
    const target = progress() * (count - 1);
    cur = reduce ? target : cur + (target - cur) * 0.22;
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
  };
  requestAnimationFrame(tick);
}
document.querySelectorAll('canvas[data-seq]').forEach(sequence);

// top bar stays out of the opening shot
const markScrolled = () => document.documentElement.classList.toggle('is-scrolled', scrollY > 60);
addEventListener('scroll', markScrolled, { passive: true });
markScrolled();

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
  let shown = { lift: 40, yaw: 0.55, pitch: 0.32, laptop: 0 };
  let mx = 0, pmx = 0;
  let visible = false;
  let lastLevel = null;

  const setFill = () => {
    const f = (slider.value - slider.min) / (slider.max - slider.min);
    slider.style.setProperty('--fill', `${(f * 100).toFixed(1)}%`);
  };
  slider.addEventListener('input', () => { touched = true; setFill(); });
  setFill();

  if (fine && !reduce) {
    window.addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(act);

  const frame = () => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const p = parseFloat(act.style.getPropertyValue('--sc-p')) || 0;

    // target pose from scroll
    let lift, yaw, pitch, laptop;
    if (p < 0.28) {
      const t = span(p, 0.02, 0.26);
      lift = lerp(40, 1.5, t); yaw = lerp(0.55, 1.0, t); pitch = lerp(0.32, 0.42, t); laptop = 0;
    } else if (p < 0.5) {
      const t = span(p, 0.3, 0.46);
      const sideYaw = narrowQuery.matches ? 0.95 : 1.2;
      lift = lerp(1.5, 12, t); yaw = lerp(1.0, sideYaw, t); pitch = lerp(0.42, 0.05, t);
      laptop = span(p, 0.3, 0.44);
    } else {
      yaw = narrowQuery.matches ? 0.95 : 1.2; pitch = 0.05; laptop = 1;
      if (!touched) {
        lift = lerp(12, T, span(p, 0.56, 0.86));
        slider.value = lift.toFixed(1);
        setFill();
      } else {
        lift = parseFloat(slider.value);
      }
    }

    pmx += (mx - pmx) * 0.06;
    const k = reduce ? 1 : 0.16;
    shown.lift += (lift - shown.lift) * k;
    shown.yaw += (yaw + pmx * 0.14 - shown.yaw) * k;
    shown.pitch += (pitch - shown.pitch) * k;
    shown.laptop += (laptop - shown.laptop) * (reduce ? 1 : 0.2);

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
  };
  requestAnimationFrame(frame);
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
});
