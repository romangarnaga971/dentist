import * as THREE from 'three';
import { watchQuality } from './quality.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const toGeometry = ({ positions, normals, indices }) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  return g;
};

function buildImplant() {
  const titanium = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 1, roughness: 0.28 });
  const group = new THREE.Group();

  // Screw body, narrowing downward
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.12, 1.3, 48), titanium);
  body.position.y = -0.8;
  group.add(body);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), titanium);
  tip.position.y = -1.45;
  group.add(tip);

  // A real helix for the thread, so turning the screw reads as turning
  const pts = [];
  const turns = 8;
  for (let i = 0; i <= turns * 40; i++) {
    const t = i / (turns * 40);
    const a = t * turns * Math.PI * 2;
    const r = 0.25 - t * 0.12 + 0.015;
    pts.push(new THREE.Vector3(Math.cos(a) * r, -0.17 - t * 1.26, Math.sin(a) * r));
  }
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 500, 0.035, 8), titanium));

  // Connector the crown sits on
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.1, 48), titanium);
  collar.position.y = -0.1;
  group.add(collar);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.36, 6), titanium);
  post.position.y = 0.12;
  group.add(post);
  return group;
}

function buildBubbles(count) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.32, envMapIntensity: 2.2, depthWrite: false,
  });
  const geometry = new THREE.SphereGeometry(1, 32, 24);
  const bubbles = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geometry, material);
    const a = (i / count) * Math.PI * 2 + Math.random();
    const r = 1.7 + Math.random() * 1.6;
    m.userData = {
      x: Math.cos(a) * r * 1.3,
      y: Math.sin(a) * r * 0.8,
      z: (Math.random() - 0.7) * 2,
      phase: Math.random() * 6,
    };
    m.scale.setScalar(0.05 + Math.random() * Math.random() * 0.26);
    bubbles.push(m);
  }
  return bubbles;
}

export function createTooth(canvas, { isSmall }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 5);
  const rim = new THREE.DirectionalLight(0x7ea6ff, 2);
  rim.position.set(-4, -1, -3);
  scene.add(key, rim);

  // Two cuts: one slices the tooth open to show its layers, one removes the root
  const sectionLocal = new THREE.Plane(new THREE.Vector3(0, 0, -1), 2);
  const rootLocal = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3);
  const section = new THREE.Plane();
  const rootCut = new THREE.Plane();
  const cuts = [section, rootCut];

  const enamel = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, clippingPlanes: cuts,
  });
  // Flat inner faces read as a solid cut surface
  const flat = (color) => new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, clippingPlanes: cuts });

  const body = new THREE.Group();
  const inner = new THREE.Group();
  body.add(inner);

  // The shape is computed in a background thread and arrives when it's ready
  const worker = new Worker(new URL('./tooth.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    worker.terminate();
    const toothGeometry = toGeometry(data.tooth);

    // White enamel fading to warmer ivory down the root
    const pos = toothGeometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const crown = new THREE.Color(0xffffff);
    const root = new THREE.Color(0xeee0c8);
    const mix = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.smoothstep(pos.getY(i), -0.35, 0.1);
      mix.copy(root).lerp(crown, t);
      colors.set([mix.r, mix.g, mix.b], i * 3);
    }
    toothGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    body.add(new THREE.Mesh(toothGeometry, enamel));
    body.add(new THREE.Mesh(toothGeometry, flat(0xf7fafc)));

    const dentinGeometry = toGeometry(data.dentin);
    inner.add(new THREE.Mesh(dentinGeometry, new THREE.MeshStandardMaterial({ color: 0xf0dfbe, roughness: 0.7, clippingPlanes: cuts })));
    inner.add(new THREE.Mesh(dentinGeometry, flat(0xeed9ae)));
    const pulpGeometry = toGeometry(data.pulp);
    inner.add(new THREE.Mesh(pulpGeometry, new THREE.MeshStandardMaterial({ color: 0xe0626a, roughness: 0.5, clippingPlanes: cuts })));
    inner.add(new THREE.Mesh(pulpGeometry, flat(0xc94a55)));

    // A quick grow-in instead of popping up
    body.scale.setScalar(0.92);
    if (window.gsap) window.gsap.to(body.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'expo.out' });
    else body.scale.setScalar(1);
  };
  worker.postMessage({ step: isSmall ? 0.04 : 0.032 });

  const implant = buildImplant();
  implant.visible = false;

  const model = new THREE.Group();
  model.add(body, implant);
  scene.add(model);

  const bubbles = buildBubbles(isSmall ? 8 : 16);
  const bubbleGroup = new THREE.Group();
  bubbles.forEach((b) => bubbleGroup.add(b));
  scene.add(bubbleGroup);

  const state = {
    x: 0, y: 0, rotX: 0, rotY: 0, rotZ: 0, camZ: 9,
    section: 0, rootCut: 0, lift: 0, implant: 0, turn: 0, bubbles: 1, floatAmount: 1,
  };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  watchQuality(renderer, resize);

  const anchors = {
    enamel: new THREE.Vector3(0.68, 0.72, 0),
    dentin: new THREE.Vector3(0.5, 0.05, 0),
    pulp: new THREE.Vector3(0.14, 0.32, 0),
  };
  const columnX = isSmall ? 0.86 : 1.2;
  const v = new THREE.Vector3();
  const end = new THREE.Vector3();
  let labels = [];

  function frame(time) {
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;

    const drift = Math.sin(time * 0.8) * 0.05 * state.floatAmount;
    model.position.set(state.x, state.y + drift, 0);
    model.rotation.set(
      state.rotX + pointer.sy * 0.14,
      state.rotY + pointer.sx * 0.35,
      state.rotZ,
    );

    body.position.y = state.lift;
    model.updateMatrixWorld(true);

    // Planes are given in the tooth's own space and follow it around
    sectionLocal.constant = 2 - state.section * 2;
    rootLocal.constant = 3 - state.rootCut * 3.22;
    section.copy(sectionLocal).applyMatrix4(body.matrixWorld);
    rootCut.copy(rootLocal).applyMatrix4(body.matrixWorld);
    // Inside layers only matter while something is open, and only for the section view
    inner.visible = state.section > 0.001;

    implant.visible = state.implant > 0.001;
    implant.position.y = (1 - state.implant) * -3.2;
    implant.rotation.y = state.turn;

    bubbleGroup.visible = state.bubbles > 0.01;
    for (const b of bubbles) {
      const u = b.userData;
      const out = 1 + (1 - state.bubbles) * 1.6;
      b.position.set(
        u.x * out + Math.sin(time * 0.4 + u.phase) * 0.12 + pointer.sx * 0.5 * (u.z + 2),
        u.y * out + Math.cos(time * 0.5 + u.phase) * 0.14,
        u.z,
      );
    }

    camera.position.z = state.camZ;
    renderer.render(scene, camera);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const toX = (p) => (p.x * 0.5 + 0.5) * w;
    const toY = (p) => (-p.y * 0.5 + 0.5) * h;
    const seen = THREE.MathUtils.smoothstep(state.section, 0.85, 1);
    const open = seen * (1 - state.rootCut * 4);
    for (const { el, name } of labels) {
      v.copy(anchors[name]);
      end.set(columnX, v.y, 0);
      body.localToWorld(v);
      body.localToWorld(end);
      v.project(camera);
      end.project(camera);
      // Keep room for the word itself on narrower windows
      const lineEnd = Math.min(toX(end), w - 90);
      el.style.setProperty('--len', `${Math.max(10, lineEnd - toX(v))}px`);
      el.style.transform = `translate(${toX(v)}px, ${toY(v)}px) translateY(-50%)`;
      el.style.opacity = Math.max(0, open);
    }
  }

  return {
    state,
    frame,
    setLabels(els) {
      labels = els.map((el) => ({ el, name: el.dataset.anchor }));
    },
  };
}
