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
  const raw = last ? (time - last) / 1000 : 1 / 60; // real elapsed seconds (auto-scroll needs this)
  const dt = Math.min(0.1, raw);                      // capped, for easing
  last = time;
  lenis?.raf(time);
  for (const fn of ticks) fn(dt, raw);
  requestAnimationFrame(loop);
}
// coming back to a hidden tab must not count the time away as one giant frame
document.addEventListener('visibilitychange', () => { last = 0; });

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

/* ============================== auto-scroll ==============================
   Hidden behind the NP mark in the top bar. The visitor sets a time and the
   whole page plays through by itself in exactly that time: constant speed with
   a short ease in and out. Driven by real elapsed time, so it finishes on
   schedule even on a slow machine. Any manual scroll, key or touch pauses it. */
const AUTO_KEY = 'studystand-auto-seconds-v3';
const MIN_SECS = 30, MAX_SECS = 600;
const autoEl = (id) => document.getElementById(id);
const toggle = autoEl('auto-toggle'), panel = autoEl('auto-panel'), barEl = autoEl('bar');
const timeOut = autoEl('auto-time'), goBtn = autoEl('auto-go'), stopBtn = autoEl('auto-stop');
const trackBar = autoEl('auto-bar'), leftEl = autoEl('auto-left'), statusEl = autoEl('auto-status');
const stepBtns = [...panel.querySelectorAll('[data-step]')];
const presetBtns = [...panel.querySelectorAll('[data-secs]')];

let autoSecs = 150;
try { const v = parseInt(localStorage.getItem(AUTO_KEY), 10); if (v >= MIN_SECS && v <= MAX_SECS) autoSecs = v; } catch { /* storage unavailable */ }
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const maxY = () => Math.max(0, root.scrollHeight - innerHeight);

const CUE_KEY = 'studystand-auto-cues-v1';
const cueBox = autoEl('auto-cues'), cueHint = autoEl('auto-cue');
let cuesOn = true;
try { if (localStorage.getItem(CUE_KEY) === '0') cuesOn = false; } catch { /* storage unavailable */ }
let stops = [];        // page positions (px) where the run waits so the section can be explained
let atCue = false;     // the current pause is a section stop, not a manual one
let hintTimer = 0;
let autoState = 'idle'; // idle | run | pause
let stopY = Infinity, legDur = 0, legT = 0, doneT = 0, startY = 0, shownSec = -1, finished = false;

// Position along a leg of length T: ramp up, constant speed, ramp down. Ends at exactly 1.
function profile(t, T) {
  if (t <= 0) return 0;
  if (t >= T) return 1;
  const r = Math.min(1.2, T * 0.1), v = 1 / (T - r);
  if (t < r) return 0.5 * (v / r) * t * t;
  if (t > T - r) { const u = T - t; return 1 - 0.5 * (v / r) * u * u; }
  return (v * r) / 2 + v * (t - r);
}
function setScroll(y) {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo({ top: y, left: 0, behavior: 'instant' }); // the engine CSS sets smooth: never animate per frame
}
function renderAuto() {
  const remaining = autoSecs - doneT - (autoState === 'run' ? legT : 0);
  timeOut.textContent = mmss(autoState === 'idle' ? autoSecs : remaining);
  goBtn.textContent = autoState === 'run' ? 'Pause' : autoState === 'pause' ? 'Reprendre' : 'Lancer';
  stopBtn.hidden = autoState === 'idle';
  for (const b of [...stepBtns, ...presetBtns]) b.disabled = autoState !== 'idle';
  for (const b of presetBtns) b.classList.toggle('is-on', Number(b.dataset.secs) === autoSecs);
  leftEl.textContent = autoState === 'run' ? `Reste ${mmss(remaining)}`
    : autoState === 'pause' ? `En pause, reste ${mmss(remaining)}`
    : finished ? 'Terminé. Relancez quand vous voulez.' : 'Le site se déroule en entier sur cette durée.';
}
function showHint(on) {
  clearTimeout(hintTimer);
  cueHint.classList.remove('is-quiet');
  cueHint.hidden = !on;
  if (on) hintTimer = setTimeout(() => cueHint.classList.add('is-quiet'), 4000);
}
function announce(msg) { statusEl.textContent = msg; }
function setOpen(open) {
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  barEl.classList.toggle('is-open', open);
  if (open) goBtn.focus({ preventScroll: true });
}
function nextStop() {
  if (!cuesOn) return Infinity;
  const m = maxY();
  for (const y of stops) if (y > scrollY + 2 && y < m - 8) return y;
  return Infinity;
}
function beginLeg(d) {
  const m = maxY();
  if (scrollY > m - 8) { setScroll(0); startY = 0; } else startY = scrollY;
  legDur = Math.max(1, d); legT = 0; autoState = 'run'; finished = false; shownSec = -1;
  atCue = false; showHint(false); stopY = nextStop();
}
function startAuto() { doneT = 0; beginLeg(autoSecs); renderAuto(); announce('Défilement lancé'); setOpen(false); }
function pauseAuto(cue) {
  if (autoState !== 'run') return;
  doneT += legT; autoState = 'pause'; atCue = !!cue; renderAuto();
  showHint(!!cue); announce(cue ? 'Section affichée, Espace pour continuer' : 'En pause');
}
function resumeAuto() { beginLeg(autoSecs - doneT); renderAuto(); announce('Reprise'); setOpen(false); }
function stopAuto(done) {
  showHint(false); atCue = false;
  autoState = 'idle'; doneT = 0; legT = 0; finished = !!done;
  trackBar.style.transform = 'scaleX(0)';
  renderAuto(); announce(done ? 'Terminé' : 'Arrêté');
}
ticks.push((dt, raw) => {
  if (autoState !== 'run') return;
  legT = Math.min(legDur, legT + Math.min(raw, 5)); // slow frames still count in full, so it ends on time
  let y = startY + (maxY() - startY) * profile(legT, legDur);
  const hit = y >= stopY && legT < legDur;
  if (hit) y = stopY;
  setScroll(y);
  trackBar.style.transform = `scaleX(${clamp((doneT + legT) / autoSecs).toFixed(4)})`;
  const sec = Math.ceil(autoSecs - doneT - legT);
  if (sec !== shownSec) { shownSec = sec; renderAuto(); }
  if (legT >= legDur) stopAuto(true);
  else if (hit) pauseAuto(true);
});

toggle.addEventListener('click', () => setOpen(panel.hidden));
goBtn.addEventListener('click', () => (autoState === 'run' ? pauseAuto() : autoState === 'pause' ? resumeAuto() : startAuto()));
stopBtn.addEventListener('click', () => stopAuto(false));
const setSecs = (v) => {
  autoSecs = clamp(Math.round(v / 15) * 15, MIN_SECS, MAX_SECS);
  try { localStorage.setItem(AUTO_KEY, String(autoSecs)); } catch { /* ignore */ }
  renderAuto();
};
for (const b of stepBtns) b.addEventListener('click', () => setSecs(autoSecs + Number(b.dataset.step)));
for (const b of presetBtns) b.addEventListener('click', () => setSecs(Number(b.dataset.secs)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); } });
document.addEventListener('pointerdown', (e) => {
  if (!panel.hidden && !e.target.closest('#auto-panel, #auto-toggle')) setOpen(false);
});
// the visitor takes over: manual scroll, keys, touch, the 3D stand, or the form
const inUi = (e) => e.target.closest && e.target.closest('#auto-panel, #auto-toggle');
const takeOver = (e) => { if (autoState === 'run' && !inUi(e)) pauseAuto(); };
addEventListener('wheel', takeOver, { passive: true });
addEventListener('touchstart', takeOver, { passive: true });
addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) takeOver(e); });
// Space: stop the run, press again to continue with the time that is left
addEventListener('keydown', (e) => {
  if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (autoState === 'idle') return;
  if (e.target.closest && e.target.closest('input, select, textarea, button, a, [contenteditable]')) return;
  e.preventDefault();
  if (autoState === 'run') pauseAuto(); else resumeAuto();
});
cueHint.addEventListener('click', () => { if (autoState === 'pause') resumeAuto(); });
function renderCues() {
  cueBox.setAttribute('aria-checked', String(cuesOn));
  if (autoState === 'run') stopY = nextStop();
}
cueBox.addEventListener('click', () => {
  cuesOn = !cuesOn;
  try { localStorage.setItem(CUE_KEY, cuesOn ? '1' : '0'); } catch { /* ignore */ }
  renderCues();
});
renderCues();
addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#gl, #hinge')) takeOver(e); });
addEventListener('focusin', (e) => { if (e.target.closest && e.target.closest('#order input, #order select')) takeOver(e); });
renderAuto();

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
// Holds change the page height, so measure them first, then let the scroll engine
// re-measure its sections, then the frame sequences.
function remeasure() {
  measureHolds();
  window.ScrollCraft?.instances?.[0]?.layout?.();
  for (const m of measurers) m();
  computeStops();
}
// Each section with data-stop waits where its message is fully on screen (fraction of its own travel)
function computeStops() {
  const vh = innerHeight;
  stops = [...document.querySelectorAll('[data-stop]')].map((sec) => {
    const f = clamp(parseFloat(sec.dataset.stop) || 1);
    const H = holds.find((h) => h.sec === sec);
    if (H && H.on) return H.start + f * H.len;
    const top = sec.getBoundingClientRect().top + scrollY;
    return top + f * Math.max(0, sec.offsetHeight - vh);
  }).sort((a, b) => a - b);
}

function sequence(canvas) {
  const act = canvas.closest('[data-sc-act]');
  const base = canvas.dataset.seq;
  let count = parseInt(canvas.dataset.seqCount, 10); // set per frame set in choose()
  const speed = parseFloat(canvas.dataset.seqSpeed) || 1; // 2 = footage ends halfway through the act
  const ctx = canvas.getContext('2d');
  const canBitmap = typeof createImageBitmap === 'function';
  const R = 10; // frames either side of the current one kept decoded
  let set = '', frames = [], bitmaps = [], pending = new Set(), queue = [], inflight = 0;
  let cur = 0, drawnKey = '', winAt = -1, near = false, dirty = true;
  let y0 = 0, y1 = 1;

  const url = (i) => `${base}/${set}/${String(i + 1).padStart(3, '0')}.webp`;
  // Every frame is fetched once (small compressed files, kept by the browser).
  // They are NOT all decoded: decoded they would be ~400 MB, and the browser
  // would throw them away and re-decode mid-scroll, which shows up as stutter.
  function pump() {
    while (inflight < 8 && queue.length) {
      const i = queue.shift();
      if (frames[i]) continue;
      const img = new Image();
      const mine = set;
      inflight++;
      img.onload = () => { inflight--; if (mine === set) { img.ok = true; dirty = true; winAt = -1; } pump(); };
      img.onerror = () => { inflight--; pump(); };
      img.src = url(i);
      frames[i] = img;
    }
  }
  function dropBitmaps() { for (const b of bitmaps) b?.close?.(); bitmaps = []; pending = new Set(); }
  function choose() {
    const next = narrowQuery.matches ? 'm' : 'd';
    if (next === set) return;
    dropBitmaps();
    count = parseInt((next === 'm' && canvas.dataset.seqCountM) || canvas.dataset.seqCount, 10);
    set = next; frames = new Array(count); queue = []; drawnKey = ''; winAt = -1; dirty = true;
    // coarse to fine, so a fast scroll always has a nearby frame to show
    const seen = new Set();
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); queue.push(i); }
    if (!seen.has(count - 1)) queue.splice(1, 0, count - 1);
  }
  // Keep a window of decoded bitmaps around the current frame; release the rest.
  function windowAround(idx) {
    if (!canBitmap) return;
    const lo = Math.max(0, idx - R), hi = Math.min(count - 1, idx + R);
    const mine = set;
    for (let i = lo; i <= hi; i++) {
      const img = frames[i];
      if (!img || !img.ok || bitmaps[i] || pending.has(i)) continue;
      pending.add(i);
      createImageBitmap(img).then((bm) => {
        pending.delete(i);
        if (mine !== set || Math.abs(i - Math.round(cur)) > R + 4) { bm.close(); return; }
        bitmaps[i] = bm; dirty = true;
      }).catch(() => pending.delete(i));
    }
    for (let i = 0; i < bitmaps.length; i++) {
      if (bitmaps[i] && (i < lo - 4 || i > hi + 4)) { bitmaps[i].close(); bitmaps[i] = undefined; }
    }
  }
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    drawnKey = ''; dirty = true;
  }
  function measure() {
    const top = act.getBoundingClientRect().top + scrollY;
    const max = root.scrollHeight - innerHeight;
    y0 = Math.max(0, top - innerHeight);
    y1 = Math.min(max, top + act.offsetHeight);
  }
  const exact = (i) => bitmaps[i] || (frames[i] && frames[i].ok ? frames[i] : null);
  function nearest(i) {
    for (let d = 0; d < count; d++) {
      const a = exact(i - d) , b = exact(i + d);
      if (a) return a;
      if (b) return b;
    }
    return null;
  }
  function paint(src, alpha) {
    const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / w0, ch / h0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, (cw - w0 * s) / 2, (ch - h0 * s) / 2, w0 * s, h0 * s);
    ctx.globalAlpha = 1;
  }

  choose();
  pump();
  narrowQuery.addEventListener?.('change', () => { choose(); pump(); });
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver((es) => { near = es[0].isIntersecting; if (near) winAt = -1; }, { rootMargin: '150% 0px' }).observe(act);
  measurers.push(measure);
  size();
  measure();

  ticks.push((dt) => {
    if (!near) return;
    const target = clamp(((scrollY - y0) / Math.max(1, y1 - y0)) * speed) * (count - 1);
    // Lenis (desktop) already smooths the scroll itself, so follow it directly.
    // Native touch scrolling gets a light ease so the frames do not step.
    if (lenis || reduce) cur = target;
    else { cur += (target - cur) * ease(0.5, dt); if (Math.abs(target - cur) < 0.005) cur = target; }

    const idx = Math.round(cur);
    if (idx !== winAt) { winAt = idx; windowAround(idx); }

    // The footage is cut at 16 fps. Blending the two neighbouring frames by the
    // fractional position turns that into continuous motion at any refresh rate.
    const a = Math.min(count - 1, Math.floor(cur));
    let f = cur - a;
    if (a >= count - 1 || f < 0.04) f = 0;
    const baseIdx = f > 0.96 ? a + 1 : a;
    const over = f >= 0.04 && f <= 0.96 ? a + 1 : -1;
    const q = over < 0 ? 0 : Math.round(f * 12) / 12;
    const key = `${baseIdx}|${over}|${q}`;
    if (key === drawnKey && !dirty) return;

    const A = nearest(baseIdx);
    if (!A) return;
    dirty = false;
    paint(A, 1);
    if (over >= 0) { const B = exact(over); if (B && B !== A) paint(B, q); }
    drawnKey = exact(baseIdx) && (over < 0 || exact(over)) ? key : ''; // retry if a frame was a stand-in
  });
}
document.querySelectorAll('canvas[data-seq]').forEach(sequence);
// page height changes as fonts and images settle: keep the scroll maps true
new ResizeObserver(remeasure).observe(document.body);
addEventListener('load', remeasure);

/* ============================== text holds ==============================
   Text sections stay put while the page keeps scrolling, so they can be read.
   Each [data-hold="N"] pins its content in the middle of the screen for N
   screen-heights and publishes --hp (0 to 1) across that time, which drives the
   reveals inside it. Content taller than the screen does not hold. */
const holds = [...document.querySelectorAll('[data-hold]')].map((sec) => ({
  sec, track: sec.querySelector('.hold__track'), inner: sec.querySelector('.hold__in'),
  dwell: parseFloat(sec.dataset.hold) || 1, on: false, start: 0, len: 1, hp: -1,
}));
function measureHolds() {
  const vh = innerHeight;
  for (const H of holds) {
    const h = H.inner.offsetHeight;
    H.on = !reduce && h <= vh * 0.96;
    H.inner.classList.toggle('is-held', H.on);
    if (!H.on) { H.track.style.minHeight = ''; H.inner.style.top = ''; continue; }
    const stick = (vh - h) / 2;
    H.len = H.dwell * vh;
    H.track.style.minHeight = `${Math.round(h + H.len)}px`;
    H.inner.style.top = `${Math.round(stick)}px`;
    H.start = H.track.getBoundingClientRect().top + scrollY - stick;
  }
}
ticks.push(() => {
  for (const H of holds) {
    const hp = H.on ? clamp((scrollY - H.start) / H.len) : 1;
    if (Math.abs(hp - H.hp) > 0.002) { H.hp = hp; H.sec.style.setProperty('--hp', hp.toFixed(3)); }
  }
});
remeasure();

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
