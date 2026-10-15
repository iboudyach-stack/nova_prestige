// StudyStand 3D: procedural foldable stand with a laptop on it, for the "Réglez la hauteur" act.
// The page drives it every frame with set({...}); it reports the screen top and the eye point
// in screen pixels so the page can draw the sightline.
import * as THREE from './vendor/three.module.min.js';

const DEG = Math.PI / 180;

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

// Rounded slab in the XZ plane, thickness along +Y from 0 to th.
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

function environment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(16, 9, 16), new THREE.MeshBasicMaterial({ color: 0x141a26, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); env.add(m);
  };
  panel(9, 2.4, 0xffffff, 3.2, [0, 4.4, 0], [Math.PI / 2, 0, 0]);
  panel(2.6, 5, 0xfff4e6, 2.6, [7.9, 0.6, 1.5], [0, -Math.PI / 2, 0]);
  panel(2.4, 5, 0xd8e4ff, 1.2, [-7.9, 0.6, -1.5], [0, Math.PI / 2, 0]);
  panel(12, 2.2, 0xe8eeff, 1.4, [0, 3.2, -7.9], [0, 0, 0]);
  panel(6, 1.2, 0xf5821f, 0.9, [0, 0.6, 7.9], [0, Math.PI, 0]);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 320);
  grd.addColorStop(0, '#0d1a33');
  grd.addColorStop(0.65, '#1c2c4f');
  grd.addColorStop(1, '#f5821f');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 5; i++) g.fillRect(40, 60 + i * 34, 200 - i * 22, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.8)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStand(canvas, { narrowQuery } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  const alu = new THREE.MeshPhysicalMaterial({ color: 0xc9cdd3, metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f37, metalness: 0.85, roughness: 0.35 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.92 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf5821f, metalness: 0.4, roughness: 0.3, emissive: 0xf5821f, emissiveIntensity: 0.35 });
  const grey = new THREE.MeshPhysicalMaterial({ color: 0x5b6069, metalness: 1, roughness: 0.38, clearcoat: 0.2 });
  const keys = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.7 });
  const display = new THREE.MeshBasicMaterial({ map: screenTexture() });

  const pivot = new THREE.Group();
  pivot.position.y = 0.7;
  scene.add(pivot);
  const model = new THREE.Group();
  model.position.y = -0.7;
  pivot.add(model);

  // base
  const BASE_TH = 0.07;
  model.add(new THREE.Mesh(slab(2.6, 2.0, 0.22, BASE_TH, [{ w: 1.3, d: 0.3, r: 0.15, x: 0, y: -0.48 }]), alu));
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.012;
  model.add(shadow);

  const PIVOT_Z = -0.84, ARM_X = 1.02, ARM_L = 1.15;
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), dark);
    br.position.set(s * ARM_X, BASE_TH + 0.03, PIVOT_Z);
    model.add(br);
  }
  const liftGroup = new THREE.Group();
  liftGroup.position.set(0, BASE_TH + 0.03, PIVOT_Z);
  model.add(liftGroup);
  const hingeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 28); hingeGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.CylinderGeometry(0.066, 0.066, 0.035, 28); ringGeo.rotateZ(Math.PI / 2);
  const armGeo = new THREE.BoxGeometry(0.1, 0.055, ARM_L); armGeo.translate(0, 0, ARM_L / 2);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, alu); arm.position.x = s * ARM_X; liftGroup.add(arm);
    const h = new THREE.Mesh(hingeGeo, dark); h.position.x = s * ARM_X; liftGroup.add(h);
    const ring = new THREE.Mesh(ringGeo, accent); ring.position.x = s * (ARM_X + 0.11); liftGroup.add(ring);
  }
  const plateGroup = new THREE.Group();
  plateGroup.position.set(0, 0.07, ARM_L);
  liftGroup.add(plateGroup);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(hingeGeo, dark); h.position.set(s * ARM_X, -0.035, 0); plateGroup.add(h);
    const ring = new THREE.Mesh(ringGeo, accent); ring.position.set(s * (ARM_X + 0.11), -0.035, 0); plateGroup.add(ring);
  }
  const plate = new THREE.Group();
  plate.position.z = -0.3;
  plateGroup.add(plate);
  const PLATE_TH = 0.06;
  plate.add(new THREE.Mesh(slab(2.7, 2.2, 0.24, PLATE_TH, [{ w: 1.05, d: 0.72, r: 0.34, x: 0, y: 0.12 }]), alu));
  for (const s of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), alu);
    lip.position.set(s * 0.95, PLATE_TH + 0.07, 1.07); plate.add(lip);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 1.55), rubber);
    strip.position.set(s * 1.12, PLATE_TH + 0.007, 0.05); plate.add(strip);
  }

  // laptop, resting on the plate behind the front lips
  const laptop = new THREE.Group();
  laptop.position.set(0, PLATE_TH + 0.014, 0.18);
  plate.add(laptop);
  const LAP_D = 1.6;
  laptop.add(new THREE.Mesh(slab(2.3, LAP_D, 0.08, 0.06), grey));
  const kb = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.004, 0.72), keys);
  kb.position.set(0, 0.062, -0.18); laptop.add(kb);
  const lid = new THREE.Group();
  lid.position.set(0, 0.06, -LAP_D / 2);
  laptop.add(lid);
  const LID_H = 1.5;
  const lidShell = new THREE.Mesh(new THREE.BoxGeometry(2.3, LID_H, 0.04), grey);
  lidShell.position.set(0, LID_H / 2, -0.02); lid.add(lidShell);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.1, LID_H - 0.18), display);
  panel.position.set(0, LID_H / 2 + 0.02, 0.002); lid.add(panel);
  lid.rotation.x = -105 * DEG + Math.PI / 2; // screen leans back 15° from vertical
  const screenTop = new THREE.Object3D();
  screenTop.position.set(0, LID_H, 0);
  lid.add(screenTop);

  // lights
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0a1220, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.PointLight(0xf5821f, 12, 14, 2); rim.position.set(-3, 1.6, -2.4); scene.add(rim);

  // eye point: in front of the laptop (+z), at the height the screen top reaches at the target lift
  const TARGET_LIFT = 50, TILT = 12;
  let EYE_Z = 2.6;
  // screen-top height in the model's own frame at the target lift: that is where the eyes are
  const eyeLocalY = (() => {
    liftGroup.rotation.x = -TARGET_LIFT * DEG;
    plateGroup.rotation.x = (TARGET_LIFT + TILT) * DEG;
    scene.updateMatrixWorld(true);
    return model.worldToLocal(screenTop.getWorldPosition(new THREE.Vector3())).y;
  })();

  const state = { fold: 1, lift: 40, tilt: TILT, yaw: 0.8, pitch: 0.08, laptop: 0 };
  let W = 1, H = 1, narrow = false;
  const v = new THREE.Vector3();

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Math.min(W, H) < 700 ? 1.25 : 1.5));
    renderer.setSize(W, H, false);
    narrow = narrowQuery ? narrowQuery.matches : W <= 860;
    const aspect = W / H;
    camera.aspect = aspect;
    const t = Math.tan(14 * DEG);
    let D;
    if (narrow) {
      EYE_Z = 2.4;
      D = Math.max(12, 5.2 / (2 * t * aspect));
      camera.setViewOffset(W, H, 0, H * 0.16, W, H);
    } else {
      EYE_Z = 2.6;
      D = 13;
      camera.setViewOffset(W, H, -W * 0.09, 0, W, H);
    }
    camera.position.set(0, 2.6, D);
    camera.lookAt(0, 1.35, 0);
    camera.updateProjectionMatrix();
    api.dirty = true;
  }

  function toScreen(world) {
    v.copy(world).project(camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  }

  function render() {
    const s = state;
    const lift = s.lift;
    liftGroup.rotation.x = -lift * DEG;
    plateGroup.rotation.x = (lift + s.tilt) * DEG;
    laptop.visible = s.laptop > 0.01;
    laptop.position.y = PLATE_TH + 0.014 + (1 - s.laptop) * 1.2;
    laptop.scale.setScalar(0.85 + 0.15 * s.laptop);
    pivot.rotation.set(s.pitch, s.yaw, 0);
    shadow.material.opacity = 0.9 - Math.min(1, lift / 70) * 0.25;
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);

    const top = screenTop.getWorldPosition(new THREE.Vector3());
    const topLocalY = model.worldToLocal(top.clone()).y;
    const eyeW = model.localToWorld(new THREE.Vector3(0, eyeLocalY, EYE_Z));
    return {
      screenTop: toScreen(top),
      eye: toScreen(eyeW),
      offset: topLocalY - eyeLocalY, // model units; 0 = screen top at eye level
      narrow,
    };
  }

  // api.dirty asks the page to render even if the pose has not changed (resize, first show)
  const api = { state, render, resize, TARGET_LIFT, dirty: true };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return api;
}
