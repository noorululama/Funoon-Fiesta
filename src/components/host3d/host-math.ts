/**
 * Small, dependency-free math helpers shared by the 3D host modules.
 */

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hermite smoothstep. Works for reversed edges too (e0 > e1). */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * Math.max(0, dt));

/** Move `current` toward `target` with exponential smoothing. */
export const approach = (
  current: number,
  target: number,
  rate: number,
  dt: number
) => current + (target - current) * damp(rate, dt);

/** Gaussian bump, 1 at the centre. */
export const gauss = (d2: number, sigma: number) =>
  Math.exp(-d2 / (2 * sigma * sigma));

/** Catmull-Rom interpolation of four scalar control values. */
export function catmull(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/* ── Deterministic pseudo-random + value noise ─────────────────────────── */

/** Mulberry32 – tiny seeded PRNG so the character is identical every load. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(ix: number, iy: number, iz: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}

/** Smooth 3D value noise in [0, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), ux);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), ux);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), ux);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), ux);
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}

/** Two-octave fractal noise in roughly [-0.5, 0.5]. */
export function fbm3(x: number, y: number, z: number): number {
  return (
    (noise3(x, y, z) - 0.5) * 0.65 +
    (noise3(x * 2.17 + 7.1, y * 2.17 + 3.3, z * 2.17 + 1.7) - 0.5) * 0.35
  );
}
