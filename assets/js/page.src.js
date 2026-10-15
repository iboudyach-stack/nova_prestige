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
