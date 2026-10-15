// StudyStand 3D scene: a procedural, foldable laptop stand rendered with Three.js.
// Scroll progress (0..1) drives the fold, height and camera angle through keyframes.
import * as THREE from './vendor/three.module.min.js';

const DEG = Math.PI / 180;

// Keyframes along the stage scroll. lift = arm angle (°), tilt = plate tilt (°).
const KEYS = [
  { p: 0.00, lift: 56, tilt: 16, yaw: -0.62, pitch: 0.12, zoom: 1.00 },
  { p: 0.13, lift: 56, tilt: 16, yaw: -0.32, pitch: 0.12, zoom: 1.00 },
  { p: 0.30, lift: 1.5, tilt: 0, yaw: 0.55, pitch: 0.46, zoom: 1.08 },
  { p: 0.41, lift: 1.5, tilt: 0, yaw: 0.85, pitch: 0.50, zoom: 1.08 },
  { p: 0.52, lift: 34, tilt: 9, yaw: 1.40, pitch: 0.04, zoom: 0.98 },
  { p: 0.62, lift: 68, tilt: 24, yaw: 1.46, pitch: 0.04, zoom: 0.98 },
  { p: 0.72, lift: 54, tilt: 16, yaw: -0.70, pitch: 0.18, zoom: 0.94 },
  { p: 1.00, lift: 54, tilt: 16, yaw: -0.95, pitch: 0.22, zoom: 0.94 },
];

export const FINISHES = {
  argent: { color: 0xc9cdd3, roughness: 0.28 },
  graphite: { color: 0x50565f, roughness: 0.34 },
  nuit: { color: 0x22355c, roughness: 0.36 },
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function sample(p) {
  if (p <= KEYS[0].p) return { ...KEYS[0] };
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (p <= b.p) {
      const t = smooth((p - a.p) / (b.p - a.p));
      const o = {};
      for (const k of ['lift', 'tilt', 'yaw', 'pitch', 'zoom']) o[k] = lerp(a[k], b[k], t);
      return o;
    }
  }
  return { ...KEYS[KEYS.length - 1] };
}

function roundedRect(path, w, d, r, cx = 0, cy = 0) {
  const x = cx - w / 2, y = cy - d / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + d - r);
  path.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  path.lineTo(x + r, y + d);
  path.quadraticCurveTo(x, y + d, x, y + d - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// A flat rounded slab lying in the XZ plane, thickness along +Y from 0 to th.
function slab(w, d, r, th, holes = []) {
  const shape = roundedRect(new THREE.Shape(), w, d, r);
  for (const h of holes) shape.holes.push(roundedRect(new THREE.Path(), h.w, h.d, h.r, h.x, h.y));
  const bevel = Math.min(0.014, th * 0.3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: th - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 28,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return g;
}

function buildEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(16, 9, 16), new THREE.MeshBasicMaterial({ color: 0x0c1830, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); env.add(m);
  };
  panel(9, 2.4, 0xffffff, 3.4, [0, 4.4, 0], [Math.PI / 2, 0, 0]);
  panel(2.4, 5, 0xffffff, 2.4, [7.9, 0.6, 1.5], [0, -Math.PI / 2, 0]);
  panel(2.4, 5, 0xd8e4ff, 1.3, [-7.9, 0.6, -1.5], [0, Math.PI / 2, 0]);
  panel(7, 1.4, 0xf5821f, 1.1, [0, 0.8, -7.9], [0, 0, 0]);
  panel(12, 1.2, 0xffffff, 0.7, [0, -1.6, 7.9], [0, Math.PI, 0]);
  panel(12, 2.2, 0xe8eeff, 1.5, [0, 3.2, -7.9], [0, 0, 0]);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStand(canvas, { reduce = false, narrowQuery } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // ---- materials ----
  const metal = new THREE.MeshPhysicalMaterial({ color: FINISHES.argent.color, metalness: 1, roughness: FINISHES.argent.roughness, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2f37, metalness: 0.85, roughness: 0.35 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: 0, roughness: 0.92 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf5821f, metalness: 0.4, roughness: 0.3, emissive: 0xf5821f, emissiveIntensity: 0.35 });

  // ---- model ----
  const pivot = new THREE.Group();
  pivot.position.y = 0.55;
  scene.add(pivot);
  const model = new THREE.Group();
  model.position.y = -0.55;
  pivot.add(model);

  const BASE_TH = 0.07;
  const base = new THREE.Mesh(slab(2.6, 2.0, 0.22, BASE_TH, [{ w: 1.3, d: 0.3, r: 0.15, x: 0, y: -0.48 }]), metal);
  model.add(base);
  for (const [x, z] of [[-1.05, -0.8], [1.05, -0.8], [-1.05, 0.8], [1.05, 0.8]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), rubber);
    foot.position.set(x, -0.005, z);
    model.add(foot);
  }

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.012;
  model.add(shadow);

  const PIVOT_Z = -0.84, ARM_X = 1.02, ARM_L = 1.15;
  // brackets on the base where the arms hinge
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), darkMetal);
    br.position.set(s * ARM_X, BASE_TH + 0.03, PIVOT_Z);
    model.add(br);
  }

  const liftGroup = new THREE.Group();
  liftGroup.position.set(0, BASE_TH + 0.03, PIVOT_Z);
  model.add(liftGroup);
  const hingeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 28);
  hingeGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.CylinderGeometry(0.066, 0.066, 0.035, 28);
  ringGeo.rotateZ(Math.PI / 2);
  const armGeo = new THREE.BoxGeometry(0.1, 0.055, ARM_L);
  armGeo.translate(0, 0, ARM_L / 2);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, metal);
    arm.position.x = s * ARM_X;
    liftGroup.add(arm);
    const h = new THREE.Mesh(hingeGeo, darkMetal);
    h.position.x = s * ARM_X;
    liftGroup.add(h);
    const ring = new THREE.Mesh(ringGeo, accent);
    ring.position.x = s * (ARM_X + 0.11);
    liftGroup.add(ring);
  }

  const plateGroup = new THREE.Group();
  plateGroup.position.set(0, 0.07, ARM_L);
  liftGroup.add(plateGroup);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(hingeGeo, darkMetal);
    h.position.set(s * ARM_X, -0.035, 0);
    plateGroup.add(h);
    const ring = new THREE.Mesh(ringGeo, accent);
    ring.position.set(s * (ARM_X + 0.11), -0.035, 0);
    plateGroup.add(ring);
  }
  const plate = new THREE.Group();
  plate.position.z = -0.3;
  plateGroup.add(plate);
  const PLATE_TH = 0.06;
  plate.add(new THREE.Mesh(slab(2.7, 2.2, 0.24, PLATE_TH, [{ w: 1.05, d: 0.72, r: 0.34, x: 0, y: 0.12 }]), metal));
  for (const s of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), metal);
    lip.position.set(s * 0.95, PLATE_TH + 0.07, 1.07);
    plate.add(lip);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 1.55), rubber);
    strip.position.set(s * 1.12, PLATE_TH + 0.007, 0.05);
    plate.add(strip);
  }

  // hotspot anchors (local positions on the moving parts)
  const anchors = [
    [plate, new THREE.Vector3(0, PLATE_TH + 0.02, -0.55)],
    [plateGroup, new THREE.Vector3(ARM_X + 0.12, -0.035, 0)],
    [model, new THREE.Vector3(1.05, BASE_TH, 0.85)],
    [plate, new THREE.Vector3(-1.12, PLATE_TH + 0.02, 0.6)],
  ].map(([parent, pos]) => { const o = new THREE.Object3D(); o.position.copy(pos); parent.add(o); return o; });

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0a1830, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(3, 6, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xf5821f, 16, 14, 2);
  rim.position.set(-3, 1.6, -2.4);
  scene.add(rim);
  const fill = new THREE.PointLight(0x7fb0ff, 12, 14, 2);
  fill.position.set(3.4, 1.2, -3);
  scene.add(fill);

  // ---- state ----
  let target = 0, cur = 0;
  let introStart = -1, introT = reduce ? 1 : 0;
  let mx = 0, my = 0, px = 0, py = 0;
  let dragYaw = 0, dragging = false, lastX = 0;
  let visible = true, raf = 0, lastT = performance.now(), time = 0;
  let narrow = false;
  let onFrame = null;
  const v = new THREE.Vector3();
  let W = 1, H = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    const small = Math.min(W, H) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setSize(W, H, false);
    narrow = narrowQuery ? narrowQuery.matches : W / H < 0.9 || W <= 860;
    const aspect = W / H;
    camera.aspect = aspect;
    const t = Math.tan((camera.fov / 2) * DEG);
    let D;
    if (narrow) {
      D = Math.max(9, 4.8 / (2 * t * aspect));
      camera.setViewOffset(W, H, 0, H * 0.21, W, H);
    } else {
      D = 9.4;
      camera.setViewOffset(W, H, -W * 0.19, H * 0.02, W, H);
    }
    camera.position.set(0, 1.8, D);
    camera.lookAt(0, 0.55, 0);
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!visible) return;
    time += dt;

    cur += (target - cur) * Math.min(1, dt * (reduce ? 20 : 5.5));
    const k = sample(cur);

    if (introStart >= 0 && introT < 1) introT = clamp((now - introStart) / 2400);
    const it = easeOut(introT);

    let lift = lerp(1.5, k.lift, it);
    let tilt = lerp(0, k.tilt, it);
    let yaw = k.yaw - (1 - it) * 2.4;
    let pitch = k.pitch + (1 - it) * 0.3;
    const zoom = k.zoom * lerp(0.7, 1, it);

    if (!reduce) {
      const idle = 1 - smooth(clamp((cur - 0.08) / 0.1));
      yaw += Math.sin(time * 0.45) * 0.1 * idle;
      px += (mx - px) * Math.min(1, dt * 3);
      py += (my - py) * Math.min(1, dt * 3);
      yaw += px * 0.22;
      pitch += py * 0.08;
    }
    if (!dragging) dragYaw *= Math.pow(0.12, dt);
    yaw += dragYaw;

    liftGroup.rotation.x = -lift * DEG;
    plateGroup.rotation.x = (lift + tilt) * DEG;
    pivot.rotation.set(pitch, yaw, 0);
    pivot.scale.setScalar(zoom);
    shadow.material.opacity = 0.85 - clamp(lift / 70) * 0.25;

    renderer.render(scene, camera);

    if (onFrame) {
      const pts = anchors.map((a) => {
        a.getWorldPosition(v);
        v.project(camera);
        return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, front: v.z < 1 };
      });
      onFrame(cur, { lift, tilt, hotspots: pts, intro: it, narrow });
    }
  }

  // ---- input ----
  const onPointerMove = (e) => {
    if (e.pointerType === 'mouse') {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (dragging) {
      dragYaw += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    }
  };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointercancel', () => { dragging = false; });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { rootMargin: '100px' });
  io.observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { target = clamp(p); },
    playIntro() { if (reduce) { introT = 1; return; } introT = 0; introStart = performance.now(); },
    holdIntro() { if (!reduce) { introT = 0; introStart = -1; } },
    setFinish(name) {
      const f = FINISHES[name];
      if (!f) return;
      metal.color.setHex(f.color);
      metal.roughness = f.roughness;
    },
    set onFrame(fn) { onFrame = fn; },
    resize,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
  };
}
