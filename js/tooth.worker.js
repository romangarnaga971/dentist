import { surfaceArrays } from './mesh.js';

// Builds the tooth's three layers off the main thread, so the page never freezes.

// Shapes
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

const sphere = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;

function roundedBox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r;
  const qy = Math.abs(y - cy) - hy + r;
  const qz = Math.abs(z - cz) - hz + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qy, qz), 0) - r;
}

// Capsule whose radius changes from end to end
function taper(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const px = x - ax;
  const py = y - ay;
  const pz = z - az;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const t = Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
  return Math.hypot(px - dx * t, py - dy * t, pz - dz * t) - (ra + (rb - ra) * t);
}

// A molar: square-ish crown with four cusps on two splayed roots
function tooth(x, y, z) {
  let d = roundedBox(x, y, z, 0, 0.32, 0, 0.78, 0.46, 0.66, 0.34);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      d = smin(d, sphere(x, y, z, sx * 0.38, 0.72, sz * 0.31, 0.3), 0.2);
    }
  }
  d = smin(d, taper(x, y, z, -0.38, 0.05, 0, -0.56, -1.55, 0.04, 0.4, 0.09), 0.3);
  d = smin(d, taper(x, y, z, 0.38, 0.05, 0, 0.56, -1.5, -0.04, 0.4, 0.09), 0.3);
  return d;
}

const dentin = (x, y, z) => tooth(x, y, z) + 0.13;

// The soft centre with a canal running down each root
function pulp(x, y, z) {
  let d = roundedBox(x, y, z, 0, 0.3, 0, 0.36, 0.16, 0.26, 0.14);
  d = smin(d, taper(x, y, z, -0.28, 0.25, 0, -0.5, -1.25, 0.03, 0.12, 0.022), 0.1);
  d = smin(d, taper(x, y, z, 0.28, 0.25, 0, 0.5, -1.2, -0.03, 0.12, 0.022), 0.1);
  return d;
}

const MIN = [-1.25, -2, -1.05];
const MAX = [1.25, 1.2, 1.05];

self.onmessage = ({ data: { step } }) => {
  const result = {
    tooth: surfaceArrays(tooth, MIN, MAX, step),
    dentin: surfaceArrays(dentin, MIN, MAX, step),
    pulp: surfaceArrays(pulp, MIN, MAX, step * 0.8),
  };
  const buffers = Object.values(result).flatMap((g) => [g.positions.buffer, g.normals.buffer, g.indices.buffer]);
  self.postMessage(result, buffers);
};
