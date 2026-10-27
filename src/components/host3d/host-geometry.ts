import * as THREE from "three";
import { catmull } from "./host-math";

/**
 * Geometry builders for the procedural host.
 *
 * Both builders emit a regular grid of `rows × (cols + 1)` vertices, where the
 * last column duplicates the first (so UVs can wrap). `weldSeamNormals`
 * then averages the normals across that duplicated seam so there is no
 * visible lighting crack.
 */

export interface LoftLevel {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
  /** Super-ellipse exponent: 2 = ellipse, >2 = squarer. */
  n?: number;
}

/** Catmull-Rom resample of a list of cross-section levels into `rows` rows. */
export function sampleLevels(levels: LoftLevel[], rows: number): Required<LoftLevel>[] {
  const out: Required<LoftLevel>[] = [];
  const last = levels.length - 1;
  const get = (i: number) => levels[Math.max(0, Math.min(last, i))];
  for (let r = 0; r < rows; r++) {
    const f = (r / (rows - 1)) * last;
    const i = Math.min(last - 1, Math.floor(f));
    const t = f - i;
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c = (k: keyof LoftLevel, def: number) =>
      catmull(p0[k] ?? def, p1[k] ?? def, p2[k] ?? def, p3[k] ?? def, t);
    out.push({
      y: c("y", 0),
      rx: Math.max(0.001, c("rx", 0)),
      rz: Math.max(0.001, c("rz", 0)),
      cx: c("cx", 0),
      cz: c("cz", 0),
      n: c("n", 2),
    });
  }
  return out;
}

export interface LoftOptions {
  rows?: number;
  cols?: number;
  /** Radial offset (metres) applied along the outward direction. */
  displace?: (theta: number, v: number, y: number) => number;
  /** UV tiling around / along. */
  uvScale?: [number, number];
}

/**
 * Loft a surface through elliptical cross-sections stacked in Y.
 * θ = 0 faces +Z (front of the character).
 */
export function loftGeometry(levels: LoftLevel[], opts: LoftOptions = {}) {
  const rows = opts.rows ?? 48;
  const cols = opts.cols ?? 64;
  const [su, sv] = opts.uvScale ?? [1, 1];
  const rings = sampleLevels(levels, rows);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  for (let r = 0; r < rows; r++) {
    const L = rings[r];
    const v = r / (rows - 1);
    for (let c = 0; c <= cols; c++) {
      const th = (c / cols) * Math.PI * 2;
      const s = Math.sin(th);
      const co = Math.cos(th);
      // super-ellipse radial scale
      const e = 2 / L.n;
      const sx = Math.sign(s) * Math.pow(Math.abs(s), e);
      const sz = Math.sign(co) * Math.pow(Math.abs(co), e);
      let x = L.cx + L.rx * sx;
      let z = L.cz + L.rz * sz;
      if (opts.displace) {
        const d = opts.displace(th, v, L.y);
        const len = Math.hypot(L.rx === 0 ? 1 : sx * L.rx, sz * L.rz) || 1;
        x += ((sx * L.rx) / len) * d;
        z += ((sz * L.rz) / len) * d;
      }
      pos.push(x, L.y, z);
      uv.push((c / cols) * su, v * sv);
    }
  }
  const stride = cols + 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  weldSeamNormals(geo, cols, rows, false);
  return geo;
}

/** Average normals between column 0 and column `cols` (and optionally first/last row). */
export function weldSeamNormals(
  geo: THREE.BufferGeometry,
  cols: number,
  rows: number,
  closedRows: boolean
) {
  const n = geo.getAttribute("normal") as THREE.BufferAttribute;
  const stride = cols + 1;
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const a = r * stride;
    const b = a + cols;
    v.fromBufferAttribute(n, a);
    w.fromBufferAttribute(n, b);
    v.add(w).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  if (closedRows) {
    for (let c = 0; c < stride; c++) {
      const a = c;
      const b = (rows - 1) * stride + c;
      v.fromBufferAttribute(n, a);
      w.fromBufferAttribute(n, b);
      v.add(w).normalize();
      n.setXYZ(a, v.x, v.y, v.z);
      n.setXYZ(b, v.x, v.y, v.z);
    }
  }
  n.needsUpdate = true;
}

export interface TubeOptions {
  radial?: number;
  closed?: boolean;
  /** Half-width of the cross-section along the "wide" axis, by u in [0,1]. */
  width: (u: number) => number;
  /** Half-thickness along the outward axis, by u in [0,1]. */
  thickness: (u: number) => number;
  /** Outward direction for each point. Default: horizontal away from `center`. */
  outward?: (p: THREE.Vector3, i: number) => THREE.Vector3;
  center?: THREE.Vector3;
  uvScale?: [number, number];
  /** 0–1: darken the flat edges of the cross-section (cheap baked AO). */
  edgeShade?: number;
}

/**
 * Sweep a flattened elliptical cross-section along a polyline. This is what
 * gives imamah wraps and the tail their fabric-band look: wide in one
 * direction, thin in the other.
 */
export function tubeGeometry(points: THREE.Vector3[], opts: TubeOptions) {
  const radial = opts.radial ?? 10;
  const closed = !!opts.closed;
  const count = points.length;
  const center = opts.center ?? new THREE.Vector3();
  const [su, sv] = opts.uvScale ?? [1, 1];
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const col: number[] = [];
  const edgeShade = opts.edgeShade ?? 0;

  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const O = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const p = points[i];
    const prev = points[closed ? (i - 1 + count) % count : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % count : Math.min(count - 1, i + 1)];
    T.subVectors(next, prev).normalize();
    if (opts.outward) O.copy(opts.outward(p, i));
    else O.set(p.x - center.x, 0, p.z - center.z);
    if (O.lengthSq() < 1e-10) O.set(0, 0, 1);
    O.normalize();
    // N = outward direction orthogonal to the tangent
    N.copy(O).addScaledVector(T, -O.dot(T)).normalize();
    B.crossVectors(T, N).normalize();
    const u = i / (count - 1);
    const a = opts.width(u);
    const b = opts.thickness(u);
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const cn = Math.cos(phi) * b;
      const cb = Math.sin(phi) * a;
      pos.push(
        p.x + N.x * cn + B.x * cb,
        p.y + N.y * cn + B.y * cb,
        p.z + N.z * cn + B.z * cb
      );
      uv.push(u * su, (j / radial) * sv);
      if (edgeShade > 0) {
        const s = 1 - edgeShade * Math.pow(Math.abs(Math.sin(phi)), 3);
        col.push(s, s, s);
      }
    }
  }

  const stride = radial + 1;
  const segs = closed ? count : count - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % count;
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const d = i2 * stride + j;
      const e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (edgeShade > 0) geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  weldSeamNormals(geo, radial, count, closed);
  return geo;
}

/** Dispose a geometry/material/texture tree, including shared resources once. */
export function disposeObject(root: THREE.Object3D) {
  const seen = new Set<unknown>();
  const disposeOnce = (res: { dispose: () => void } | null | undefined) => {
    if (!res || seen.has(res)) return;
    seen.add(res);
    res.dispose();
  };
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh && !(obj as THREE.Line).isLine && !(obj as THREE.Points).isPoints) return;
    disposeOnce(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
        if (value && (value as THREE.Texture).isTexture) disposeOnce(value as THREE.Texture);
      }
      disposeOnce(mat);
    }
  });
}
