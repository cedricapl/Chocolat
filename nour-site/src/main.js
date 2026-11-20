import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbB64 from '../assets/chocolat_bar.glb';

gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const canvas = $('#gl');
const lerp = THREE.MathUtils.lerp;

/* ------------------------------------------------------------------ */
/* Content                                                            */
/* ------------------------------------------------------------------ */
const FLAVOURS = [
  { name: 'Verdant', sub: 'Pistachio & Kunafa', c1: '#7d9a1c', c2: '#1d2a0b', glow: 'rgba(190,220,80,.55)' },
  { name: 'Ember', sub: 'Salted Caramel', c1: '#d0702a', c2: '#3a1608', glow: 'rgba(255,150,70,.55)' },
  { name: 'Petal', sub: 'Rose & Raspberry', c1: '#bf3f63', c2: '#3a0f1e', glow: 'rgba(255,120,160,.5)' },
  { name: 'Gilt', sub: 'Date & Tahini', c1: '#d6a23a', c2: '#3b2708', glow: 'rgba(255,215,110,.55)' },
  { name: 'Dune', sub: 'Saffron & Honey', c1: '#a8632f', c2: '#2c1409', glow: 'rgba(255,180,110,.5)' },
  { name: 'Nocturne', sub: 'Dark Cacao & Coffee', c1: '#2f4a8c', c2: '#080d24', glow: 'rgba(130,170,255,.5)' },
];

const track = $('#track');
FLAVOURS.forEach((f) => {
  const bars = [0, 1, 2, 3]
    .map((i) => `<rect x="${12 + i * 4}" y="${52 - i * 13}" width="${76 - i * 8}" height="10" rx="2" fill="url(#goldG)" stroke="rgba(255,236,180,.85)" stroke-width=".7"/>` +
      `<path d="M${12 + i * 4 + (76 - i * 8) / 3} ${52 - i * 13}v10M${12 + i * 4 + (2 * (76 - i * 8)) / 3} ${52 - i * 13}v10" stroke="rgba(80,45,5,.55)" stroke-width=".7"/>`)
    .join('');
  const el = document.createElement('article');
  el.className = 'card';
  el.style.cssText = `--c1:${f.c1};--c2:${f.c2};--glow:${f.glow}`;
  el.innerHTML = `<div class="crest">N</div><h3>${f.name}</h3><svg class="stack" viewBox="0 0 100 66" aria-hidden="true">${bars}</svg><small>${f.sub}</small>`;
  track.appendChild(el);
});
const cards = [...track.children];
const capName = $('#capName');
const capSub = $('#capSub');

/* Cacao pods and leaves, drawn once and tiled behind the green section. */
(function drawPattern() {
  const N = 760;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(205,235,195,.2)';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pod = (x, y, rot, s) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.beginPath(); g.moveTo(-60, 0);
    g.bezierCurveTo(-40, -34, 30, -34, 62, 0);
    g.bezierCurveTo(30, 34, -40, 34, -60, 0);
    g.stroke();
    [-14, 0, 14].forEach((o) => { g.beginPath(); g.moveTo(-54, o * .2); g.quadraticCurveTo(0, o * 2.1, 56, o * .2); g.stroke(); });
    g.beginPath(); g.moveTo(-60, 0); g.lineTo(-76, -4); g.stroke();
    g.restore();
  };
  const leaf = (x, y, rot, s) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.beginPath(); g.moveTo(-50, 0);
    g.quadraticCurveTo(0, -34, 54, 0);
    g.quadraticCurveTo(0, 34, -50, 0);
    g.stroke();
    g.beginPath(); g.moveTo(-50, 0); g.lineTo(54, 0); g.stroke();
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      const x0 = i * 12;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 14, -17 + Math.abs(i) * 3); g.moveTo(x0, 0); g.lineTo(x0 + 14, 17 - Math.abs(i) * 3); g.stroke();
    }
    g.restore();
  };
  for (let i = 0; i < 11; i++) {
    const x = rnd() * N, y = rnd() * N, r = rnd() * Math.PI * 2, s = 0.8 + rnd() * 0.7;
    const draw = rnd() > 0.45 ? pod : leaf;
    [-N, 0, N].forEach((dx) => [-N, 0, N].forEach((dy) => draw(x + dx, y + dy, r, s)));
  }
  $('#pattern').style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ------------------------------------------------------------------ */
/* Three.js scene                                                      */
/* ------------------------------------------------------------------ */
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  console.warn('WebGL unavailable', e);
}

const S = {}; // animated state, driven by the scroll timeline

if (renderer) {
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
camera.position.set(0, 1.2, 9.5);
camera.lookAt(0, 0, 0);

if (renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
}
const key = new THREE.DirectionalLight(0xffe0b0, 1.3);
key.position.set(3, 5, 5);
scene.add(key);
const rim = new THREE.PointLight(0x6fe0e0, 60, 20);
rim.position.set(-4, 2.5, -2);
scene.add(rim);

/* --- liquid: displaced cylinder (stream) + displaced plane (pool) ---- */
const uni = { uTime: { value: 0 }, uCut: { value: 1.3 }, uPool: { value: 1 }, uFade: { value: 1 } };

const GLSL_STREAM = /* glsl */ `
const float SH = 14.0;
vec3 streamP(float th, float y) {
  float s = clamp((y + 0.5 * SH) / SH, 0.0, 1.0);
  float sb = clamp((y + 0.5 * SH) / 7.5, 0.0, 1.0);
  float t = uTime * 0.55;
  float base = 0.74 + 0.95 * pow(s, 4.0) + 1.1 * pow(1.0 - sb, 6.0);
  // flattened cross-section that twists down the stream, like a folding ribbon
  float phi = y * 0.55 - t * 0.35 + 0.6 * sin(y * 0.9 - t * 0.5);
  float ca = cos(th - phi), sa = sin(th - phi);
  float ell = 1.0 / sqrt((ca * ca) / (1.25 * 1.25) + (sa * sa) / (0.84 * 0.84));
  float w = 1.0 + 0.15 * sin(y * 2.0 - t * 1.7)
              + 0.07 * sin(y * 5.0 - t * 2.6 + th * 2.0)
              + 0.025 * sin(y * 11.0 - t * 3.4 + th * 5.0)
              + 0.05 * sin(th * 3.0 + y * 1.4 - t * 0.9);
  float k = 1.0 - smoothstep(uCut - 0.12, uCut, s);
  float r = base * ell * w * k;
  vec3 p = vec3(r * cos(th), y, r * sin(th));
  p.x += 0.26 * sin(y * 0.7 - t * 1.1) * (1.0 - s);
  p.z += 0.16 * sin(y * 0.9 - t * 0.8 + 1.3) * (1.0 - s);
  return p;
}`;
const GLSL_POOL = /* glsl */ `
float poolH(vec2 q) {
  float t = uTime * 0.55;
  float d = length(q);
  float a = atan(q.y, q.x);
  float heap = 0.7 * exp(-d * d * 0.55);
  float ring = 0.11 * exp(-pow((d - 1.55) * 1.8, 2.0));
  float rip = 0.05 * sin(d * 6.0 - t * 2.2) * exp(-d * 0.55);
  float coil = 0.15 * sin(a * 3.0 + d * 5.5 - t * 0.9) * smoothstep(0.4, 1.5, d) * exp(-d * 0.4);
  float fine = 0.02 * sin(a * 9.0 + d * 13.0 - t * 1.6) * smoothstep(0.6, 1.8, d) * exp(-d * 0.5);
  return (heap + ring + rip + coil + fine) * uPool;
}`;

function liquidMaterial(kind, color) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.025,
    sheen: 0, envMapIntensity: 1.25, side: THREE.DoubleSide,
    transparent: kind === 'pool',
  });
  m.customProgramCacheKey = () => kind;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    const decl = '#include <common>\nuniform float uTime; uniform float uCut; uniform float uPool; varying vec2 vQ; varying vec3 vP;\n';
    if (kind === 'stream') {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', decl + GLSL_STREAM)
        .replace('#include <beginnormal_vertex>', `
          float th = atan(position.z, position.x); float yy = position.y; float e = 0.01;
          vec3 ta = streamP(th + e, yy) - streamP(th - e, yy);
          vec3 tb = streamP(th, yy + e * 4.0) - streamP(th, yy - e * 4.0);
          vec3 objectNormal = normalize(cross(tb, ta) + 1e-6 * vec3(cos(th), 0.0, sin(th)));`)
        .replace('#include <begin_vertex>', 'vec3 transformed = streamP(th, yy); vQ = vec2(0.0); vP = transformed;');
    } else {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', decl + GLSL_POOL)
        .replace('#include <beginnormal_vertex>', `
          vec2 q0 = position.xy; float e = 0.02;
          float hx = poolH(q0 + vec2(e, 0.0)) - poolH(q0 - vec2(e, 0.0));
          float hy = poolH(q0 + vec2(0.0, e)) - poolH(q0 - vec2(0.0, e));
          vec3 objectNormal = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));`)
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(q0, poolH(q0)); vQ = q0; vP = vec3(q0.x, transformed.z * 2.0, q0.y);');
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFade; uniform float uTime; varying vec2 vQ; varying vec3 vP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float nv = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
        float fres = pow(1.0 - nv, 2.2);
        float marb = sin(vP.y * 2.6 + sin(vP.x * 2.2 + vP.z * 2.0) * 1.7 - uTime * 0.25) * 0.5 + 0.5;
        float marb2 = sin(vP.y * 7.0 + vP.x * 3.0 - uTime * 0.35) * 0.5 + 0.5;
        diffuseColor.rgb *= mix(0.78, 1.14, marb) * mix(0.96, 1.04, marb2);
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.92, diffuseColor.rgb * 1.12 + vec3(0.015, 0.01, 0.0), fres);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * (0.03 + 0.14 * fres);`)
      .replace('#include <dithering_fragment>', kind === 'pool'
        ? '#include <dithering_fragment>\nfloat edgeF = 1.0 - smoothstep(1.8, 3.1, length(vQ)); gl_FragColor.rgb *= mix(0.35, 1.0, edgeF); gl_FragColor.a *= uFade * (1.0 - smoothstep(2.2, 3.2, length(vQ)));'
        : '#include <dithering_fragment>');
  };
  return m;
}

const liquid = new THREE.Group();
const streamMat = liquidMaterial('stream', 0xb2b32a);
const poolMat = liquidMaterial('pool', 0xb2b32a);
const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 14, 96, 460, true), streamMat);
stream.position.y = 4.7;
stream.frustumCulled = false;
const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7, 180, 180), poolMat);
pool.rotation.x = -Math.PI / 2;
pool.position.y = -2.3;
pool.frustumCulled = false;
liquid.add(stream, pool);
scene.add(liquid);

/* --- chocolate bar ---------------------------------------------------- */
function rr(w, d, r) {
  const x = -w / 2, y = -d / 2, s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  return s;
}
function slab(w, d, h, r, bev) {
  const g = new THREE.ExtrudeGeometry(rr(w - 2 * bev, d - 2 * bev, r), {
    depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 6, curveSegments: 8,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bev, 0);
  return g;
}
const plateGeo = slab(3.3, 4.5, 0.16, 0.2, 0.05);
const tileGeo = slab(0.9, 0.97, 0.26, 0.09, 0.075);
const fillGeo = slab(3.0, 4.2, 0.14, 0.16, 0.035);

const matTop = new THREE.MeshPhysicalMaterial({ color: 0x6e3410, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
const matBot = new THREE.MeshPhysicalMaterial({ color: 0x4a2209, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
const matFill = new THREE.MeshPhysicalMaterial({ color: 0xaab52a, roughness: 0.35, clearcoat: 0.6, emissive: 0x4a5a08, emissiveIntensity: 0.35, envMapIntensity: 1 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xe8bb4e, metalness: 1, roughness: 0.28, envMapIntensity: 1.6 });

const flakeGeo = new THREE.BoxGeometry(1, 0.12, 0.8);
function makeShell(mat, withFlakes) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(plateGeo, mat));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      const t = new THREE.Mesh(tileGeo, mat);
      t.position.set((i - 1) * 1.0, 0.14, (j - 1.5) * 1.06);
      g.add(t);
    }
  }
  const f = new THREE.Mesh(fillGeo, matFill);
  f.position.y = -0.14;
  g.add(f);
  if (withFlakes) {
    const im = new THREE.InstancedMesh(flakeGeo, matGold, 130);
    const d = new THREE.Object3D();
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 130; i++) {
      d.position.set((rnd() - 0.5) * 3.0, 0.42, (rnd() - 0.5) * 4.2);
      d.rotation.set(rnd() * 0.6, rnd() * 6, rnd() * 0.6);
      d.scale.setScalar(0.035 + rnd() * 0.07);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    }
    g.add(im);
  }
  return g;
}
let shellTop = makeShell(matTop, true);
let shellBot = makeShell(matBot, false);
let botFlip = Math.PI;
shellBot.rotation.z = Math.PI; // flipped: tiles face down, filling faces up
const bar = new THREE.Group();
bar.add(shellTop, shellBot);
const barSpin = new THREE.Group(); barSpin.add(bar);
const barTilt = new THREE.Group(); barTilt.add(barSpin);
const barRoot = new THREE.Group(); barRoot.add(barTilt);
scene.add(barRoot);

/* floating gold flakes that orbit the bar while it hangs in the hero */
const FL = 90;
const floaters = new THREE.InstancedMesh(flakeGeo, matGold, FL);
const fData = [];
{
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < FL; i++) {
    fData.push({ a: rnd() * 6.28, r: 1.9 + rnd() * 2.2, y: (rnd() - 0.5) * 4, s: 0.03 + rnd() * 0.07, v: 0.1 + rnd() * 0.25, p: rnd() * 6 });
  }
}
barRoot.add(floaters);
const dummy = new THREE.Object3D();

/* --- real chocolate bar model (glb), cut in two with clipping planes -- */
let glbReady = false;
const clipTop = new THREE.Plane(), clipBot = new THREE.Plane();
const CUT = -0.03; // cut height: through the base plate, under the tile relief
const clipLocalTop = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CUT);
const clipLocalBot = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT);
const FLIP_MODEL = false;

function loadBar() {
  const bin = Uint8Array.from(atob(glbB64), (c) => c.charCodeAt(0));
  new GLTFLoader().parse(bin.buffer, '', (gltf) => {
    try {
      const root = gltf.scene.children[0];
      root.quaternion.identity(); root.scale.set(1, 1, 1); // drop the exporter's random tilt
      gltf.scene.updateMatrixWorld(true);
      let mesh;
      gltf.scene.traverse((o) => { if (o.isMesh) mesh = o; });
      const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      // model axes -> ours: z long, x wide, y up
      // true principal axes of the mesh (the file is tilted ~5 degrees); relief side up
      geo.translate(-0.0, 0, 0);
      geo.applyMatrix4(new THREE.Matrix4().set(
        0.01392, 0.9943, 0.10574, 0,
        -0.0766, 0.1065, -0.99136, 0,
        -0.99696, 0.0057, 0.07765, 0,
        0, 0, 0, 1));
      if (FLIP_MODEL) geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI));
      geo.computeBoundingBox();
      const bb = geo.boundingBox, ctr = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
      const k = 4.5 / size.z;
      geo.translate(-ctr.x, -ctr.y, -ctr.z);
      geo.scale(k, k, k);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const W = size.x * k, L = size.z * k;

      matTop.side = matBot.side = THREE.DoubleSide;
      matTop.clippingPlanes = [clipTop];
      matBot.clippingPlanes = [clipBot];
      matTop.needsUpdate = matBot.needsUpdate = true;

      const top = new THREE.Group(), bot = new THREE.Group();
      top.add(new THREE.Mesh(geo, matTop));
      bot.add(new THREE.Mesh(geo, matBot));
      // one-sided pistachio caps on the cut faces: invisible while closed, revealed when it snaps
      const capShape = rr(W * 0.9, L * 0.92, 0.22);
      const capDown = new THREE.ShapeGeometry(capShape, 12); capDown.rotateX(Math.PI / 2);
      const capUp = new THREE.ShapeGeometry(capShape, 12); capUp.rotateX(-Math.PI / 2);
      const ft = new THREE.Mesh(capDown, matFill);
      const fb = new THREE.Mesh(capUp, matFill);
      ft.position.y = CUT; fb.position.y = CUT;
      top.add(ft); bot.add(fb);

      // gold flakes resting on the real surface
      const probe = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      probe.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      const im = new THREE.InstancedMesh(flakeGeo, matGold, 160);
      const d = new THREE.Object3D();
      let seed = 11, n = 0;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 600 && n < 160; i++) {
        rc.set(new THREE.Vector3((rnd() - 0.5) * W * 0.92, 6, (rnd() - 0.5) * L * 0.95), new THREE.Vector3(0, -1, 0));
        const h = rc.intersectObject(probe)[0];
        if (!h) continue;
        d.position.copy(h.point); d.position.y += 0.01;
        d.rotation.set(rnd() * 0.5, rnd() * 6, rnd() * 0.5);
        d.scale.setScalar(0.035 + rnd() * 0.07);
        d.updateMatrix();
        im.setMatrixAt(n++, d.matrix);
      }
      im.count = n;
      top.add(im);

      bar.clear();
      bar.add(top, bot);
      shellTop = top; shellBot = bot; botFlip = 0;
      glbReady = true;
    } catch (e) { console.warn('glb bar failed, keeping procedural bar', e); }
  }, (e) => console.warn('glb parse error', e));
}
if (renderer) loadBar();

/* ------------------------------------------------------------------ */
/* Layout per viewport                                                 */
/* ------------------------------------------------------------------ */
function layout() {
  const a = innerWidth / innerHeight;
  const port = a < 0.85;
  const halfH = 9.5 * Math.tan(THREE.MathUtils.degToRad(17.5));
  const halfW = halfH * a;
  return port
    ? { liqX: halfW * 0.78, liqY: -1.0, liqS: 0.42, heroX: 0, heroY: -0.9, heroS: 0.52, leftX: -halfW * 0.95, leftY: 2.2, leftS: 0.6, snapX: 0, snapY: 1.35, snapS: 0.5, snapRot: -0.5, halfW }
    : { liqX: halfW * 0.4, liqY: 0, liqS: 1, heroX: halfW * 0.4, heroY: 0, heroS: 0.82, leftX: -halfW * 0.93, leftY: -0.1, leftS: 1.2, snapX: halfW * 0.42, snapY: 0, snapS: 0.88, snapRot: -0.7, halfW };
}

/* ------------------------------------------------------------------ */
/* Scroll timeline                                                     */
/* ------------------------------------------------------------------ */
const lenis = reduce ? null : new Lenis({ lerp: 0.09, smoothWheel: true });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

const COLD = new THREE.Color(0x6e8a10), WARM = new THREE.Color(0x944a0b);
const TOP_A = new THREE.Color(0x6e3410), TOP_B = new THREE.Color(0xc8420f);
const BOT_A = new THREE.Color(0x4a2209), BOT_B = new THREE.Color(0xd98a1c);
const BG_A = new THREE.Color(0x0e3b44), BG_B = new THREE.Color(0x1c5a39);
const heroEl = $('#hero'), cardsEl = $('#cards'), snapEl = $('#snap'), patEl = $('#pattern');

let tl = null;
let cardsMetrics = { vw: 1, trackW: 1 };

function build() {
  if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); }
  const L = layout();
  const vw = stage.clientWidth;
  const trackW = track.scrollWidth;
  cardsMetrics = { vw, trackW };
  const startX = innerWidth / innerHeight < 0.85 ? vw * 0.18 : vw * 0.3;
  const endX = -(trackW - vw * 0.7);

  Object.assign(S, {
    hue: 0, cut: 1.3, pool: 1, fade: 1, heroO: 1, heroY: 0, bg: 0,
    barX: L.heroX, barY: L.heroY + 4, barS: 0.001, rotZ: -0.4, tilt: 1.0, spin: 3, split: 0, colorMix: 0, flakes: 0,
    cardsO: 0, cx: startX, snapO: 0,
  });

  tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#scroll', start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 0.7 },
  });
  tl.set(S, { hue: 0 }, 0);
  tl.to(S, { heroY: -70, duration: 34 }, 0);
  // pistachio -> caramel
  tl.to(S, { hue: 1, duration: 14, ease: 'power1.inOut' }, 22);
  // stream drains, text leaves, bar drops in
  tl.to(S, { heroO: 0, duration: 7, ease: 'power1.in' }, 32);
  tl.fromTo(S, { cut: 0.5, immediateRender: false }, { cut: -0.1, duration: 11, ease: 'power2.in', immediateRender: false }, 34);
  tl.to(S, { pool: 0, fade: 0, duration: 6, ease: 'power2.in' }, 44);
  tl.to(S, { barY: L.heroY, barS: L.heroS, spin: 0, duration: 9, ease: 'power3.out' }, 42);
  tl.to(S, { flakes: 1, duration: 4 }, 47);
  tl.to(S, { tilt: 0.85, rotZ: -0.25, duration: 8 }, 51);
  // bar slides to the left edge, room turns green
  tl.to(S, { barX: L.leftX, barY: L.leftY, barS: L.leftS, rotZ: -0.15, tilt: 0.95, spin: 0.5, duration: 9, ease: 'power2.inOut' }, 56);
  tl.to(S, { colorMix: 1, bg: 1, flakes: 0, duration: 9, ease: 'power1.inOut' }, 56);
  // six boxes
  tl.to(S, { cardsO: 1, duration: 4 }, 61);
  tl.to(S, { cx: endX, duration: 22, ease: 'power1.inOut' }, 62);
  tl.to(S, { cardsO: 0, duration: 4, ease: 'power1.in' }, 82);
  // bar returns to centre-right and snaps open
  tl.to(S, { barX: L.snapX, barY: L.snapY, barS: L.snapS, rotZ: L.snapRot, tilt: 0.78, spin: 1.2, duration: 8, ease: 'power2.inOut' }, 84);
  tl.to(S, { snapO: 1, duration: 4 }, 88);
  tl.to(S, { split: 1, spin: 2.2, tilt: 0.7, duration: 10, ease: 'power2.inOut' }, 90);
  tl.set(S, {}, 100);
  ScrollTrigger.refresh();
}

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */
const tmp = new THREE.Color();
let time = 0, lastBg = -1, lastCap = -1;

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (renderer) renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function updateCards() {
  const { vw } = cardsMetrics;
  track.style.transform = `translate3d(${S.cx}px,0,0)`;
  let best = 0, bestD = 1e9;
  const mid = vw * 0.55;
  cards.forEach((c, i) => {
    const cx = S.cx + c.offsetLeft + c.offsetWidth / 2;
    const dx = (cx - vw / 2) / vw;
    const ad = Math.abs(dx);
    c.style.transform = `translate3d(0,${(ad * 40).toFixed(1)}px,${(-ad * 220).toFixed(0)}px) rotateY(${(-dx * 38).toFixed(2)}deg) rotateZ(${(dx * 4).toFixed(2)}deg) scale(${(1 - ad * 0.1).toFixed(3)})`;
    const d = Math.abs(cx - mid);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best !== lastCap) {
    lastCap = best;
    capName.textContent = FLAVOURS[best].sub;
    capSub.textContent = `${FLAVOURS[best].name}, hand-poured, 70 g`;
  }
}

function frame(dt) {
  time += dt;
  uni.uTime.value = time;
  uni.uCut.value = S.cut;
  uni.uPool.value = S.pool;
  uni.uFade.value = S.fade;
  tmp.copy(COLD).lerp(WARM, S.hue);
  streamMat.color.copy(tmp);
  poolMat.color.copy(tmp);
  streamMat.emissive.copy(tmp).multiplyScalar(0.0);
  poolMat.emissive.copy(tmp).multiplyScalar(0.0);

  liquid.position.set(layout.cache.liqX, layout.cache.liqY, 0);
  liquid.scale.setScalar(layout.cache.liqS);
  liquid.visible = S.cut > -0.05 || S.fade > 0.01;

  barRoot.visible = S.barS > 0.01;
  barRoot.position.set(S.barX, S.barY, 0);
  barRoot.scale.setScalar(S.barS);
  barRoot.rotation.z = S.rotZ;
  barTilt.rotation.x = S.tilt;
  barSpin.rotation.y = S.spin + time * 0.18;
  matTop.color.copy(TOP_A).lerp(TOP_B, S.colorMix);
  matBot.color.copy(BOT_A).lerp(BOT_B, S.colorMix);

  const sp = S.split;
  shellTop.position.set(sp * 0.7, sp * 1.25, 0);
  shellTop.rotation.set(sp * -0.35, 0, sp * 0.2);
  shellBot.position.set(-sp * 0.7, -sp * 1.25, 0);
  shellBot.rotation.set(sp * 0.3, 0, botFlip - sp * 0.2);
  // shells touch when closed: top plate rests on the filling band
  if (sp < 0.001) { shellTop.position.y = 0.002; shellBot.position.y = -0.002; }

  if (glbReady) {
    barRoot.updateMatrixWorld(true);
    clipTop.copy(clipLocalTop).applyMatrix4(shellTop.matrixWorld);
    clipBot.copy(clipLocalBot).applyMatrix4(shellBot.matrixWorld);
  }

  floaters.visible = S.flakes > 0.01;
  if (floaters.visible) {
    for (let i = 0; i < FL; i++) {
      const f = fData[i];
      const a = f.a + time * f.v;
      dummy.position.set(Math.cos(a) * f.r, f.y + Math.sin(time * 0.7 + f.p) * 0.25, Math.sin(a) * f.r * 0.6);
      dummy.rotation.set(time * f.v * 3 + f.p, a * 2, f.p);
      dummy.scale.setScalar(f.s * S.flakes);
      dummy.updateMatrix();
      floaters.setMatrixAt(i, dummy.matrix);
    }
    floaters.instanceMatrix.needsUpdate = true;
  }

  // DOM layers
  heroEl.style.opacity = S.heroO.toFixed(3);
  heroEl.style.transform = `translate3d(0,${S.heroY.toFixed(1)}px,0)`;
  heroEl.style.visibility = S.heroO < 0.01 ? 'hidden' : 'visible';
  cardsEl.style.opacity = S.cardsO.toFixed(3);
  cardsEl.style.visibility = S.cardsO < 0.01 ? 'hidden' : 'visible';
  if (S.cardsO > 0.01) updateCards();
  snapEl.style.opacity = S.snapO.toFixed(3);
  snapEl.style.visibility = S.snapO < 0.01 ? 'hidden' : 'visible';
  snapEl.style.transform = innerWidth > 700 ? `translate3d(0,calc(-50% + ${((1 - S.snapO) * 30).toFixed(1)}px),0)` : `translate3d(0,${((1 - S.snapO) * 30).toFixed(1)}px,0)`;
  if (S.bg !== lastBg) {
    lastBg = S.bg;
    tmp.copy(BG_A).lerp(BG_B, S.bg);
    stage.style.setProperty('--bg', '#' + tmp.getHexString());
    patEl.style.opacity = (S.bg * 0.9).toFixed(3);
  }
  if (renderer) renderer.render(scene, camera);
}

layout.cache = layout();
function init() {
  resize();
  build();
  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    frame(Math.min((now - last) / 1000, 0.05));
    last = now;
  });
}

let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { layout.cache = layout(); resize(); build(); }, 150);
});

/* nav + buttons */
function goTo(p) {
  const st = tl && tl.scrollTrigger;
  let y;
  if (p === 'end') y = document.documentElement.scrollHeight;
  else y = st.start + (st.end - st.start) * (parseFloat(p) / 100);
  if (lenis) lenis.scrollTo(y, { duration: 2 });
  else scrollTo({ top: y });
}
document.querySelectorAll('[data-p]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(a.dataset.p); }));
$('#again').addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 2.4 }) : scrollTo({ top: 0 })));

(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(init);
