import * as THREE from "three";
import { clamp, gauss, smoothstep } from "./host-math";
import { makeHairTexture } from "./host-textures";

/**
 * Head, ears and beard.
 *
 * Coordinates are "head-local": origin at the neck/skull pivot, +Y up,
 * +Z out of the face. All feature positions below are in metres.
 */

export const FACE = {
  centerY: 0.107,
  centerZ: 0.012,
  radii: { x: 0.078, y: 0.1175, z: 0.098 },
  eyeX: 0.0315,
  eyeY: 0.116,
  browY: 0.141,
  noseTipY: 0.071,
  mouthY: 0.0372,
  mouthHalfW: 0.0245,
  chinY: -0.0105,
  crownY: 0.2245,
} as const;

export const SKIN_COLOR = 0xc08560;
export const HAIR_COLOR = 0x54402f;

export interface HeadBuild {
  group: THREE.Group;
  head: THREE.Mesh;
  beard: THREE.Mesh;
  /** Meshes whose morphTargetInfluences are [jawOpen, smile]. */
  morphMeshes: THREE.Mesh[];
  /** z of the face surface at (x, y), head-local. */
  surfaceZ: (x: number, y: number) => number;
  skinMaterial: THREE.MeshPhysicalMaterial;
  hairMaterial: THREE.MeshPhysicalMaterial;
}

/* ── Base head shape ─────────────────────────────────────────────────── */

/** Map a unit-sphere direction to a sculpted head position (head-local). */
function shapeHead(dx: number, dy: number, dz: number, out: THREE.Vector3) {
  const { x: rx, y: ry, z: rz } = FACE.radii;

  // Squash and lengthen the lower face so the chin reads as a chin, not a point.
  let ey = dy;
  if (dy < -0.5) {
    const k = 1 - 0.28 * smoothstep(-0.5, -1.0, dy);
    ey = -0.5 + (dy + 0.5) * k;
  }

  let x = rx * dx;
  const y = FACE.centerY + ry * ey;
  let z = FACE.centerZ + rz * dz;

  // Jaw taper with a firm angle just under the cheeks.
  const taper = smoothstep(0.1, -0.95, dy);
  x *= 1 - 0.115 * Math.pow(taper, 1.3);
  x *= 1 + 0.05 * gauss((dy + 0.45) ** 2, 0.2); // jaw angle
  x *= 1 + 0.028 * gauss((dy + 0.02) ** 2, 0.26); // cheekbones

  // Chin projects a little, skull gets more volume at the back.
  if (dz > 0) z += 0.006 * gauss((dy + 0.82) ** 2, 0.16) * dz;
  if (dz < 0) z *= 1.05;

  // Broad, slightly flat forehead.
  if (dz > 0 && dy > 0.2) z -= 0.005 * smoothstep(0.2, 0.8, dy) * dz;

  out.set(x, y, z);
}

/** Facial relief added on top of the base shape (only on the front half). */
function addFacialRelief(p: THREE.Vector3, frontness: number) {
  if (frontness <= 0) return;
  const x = p.x;
  const ax = Math.abs(x);
  const y = p.y;
  let dz = 0;

  // Brow ridge, strongest toward the centre.
  dz += 0.0058 * gauss((y - FACE.browY) ** 2, 0.0078) * smoothstep(0.066, 0.012, ax);
  // Glabella (between the brows)
  dz += 0.0022 * gauss(x * x + (y - 0.131) ** 2, 0.011);

  // Eye sockets – the eyeball will sit in this hollow.
  const sx = ax - FACE.eyeX;
  dz -= 0.0085 * gauss((sx / 0.0185) ** 2 + ((y - FACE.eyeY) / 0.0125) ** 2, 1);
  // Soft under-eye hollow leading into the cheek.
  dz -= 0.0022 * gauss((sx / 0.022) ** 2 + ((y - 0.099) / 0.009) ** 2, 1);

  // Nose: bridge widens and rises toward the tip; rounded tip and wings.
  const ns = smoothstep(0.132, 0.076, y); // 0 at the nasion, 1 near the tip
  const nHalf = 0.0042 + 0.0058 * ns;
  const nAmp = 0.0028 + 0.0112 * Math.pow(ns, 1.3);
  dz += nAmp * Math.exp(-(x * x) / (2 * nHalf * nHalf)) * smoothstep(0.138, 0.12, y) * smoothstep(0.056, 0.07, y);
  dz += 0.0098 * gauss(x * x + (y - FACE.noseTipY) ** 2, 0.0086);
  dz += 0.0058 * gauss((ax - 0.0134) ** 2 + (y - 0.0668) ** 2, 0.0062);
  // Groove under the nose, then philtrum.
  dz -= 0.0032 * gauss(x * x + (y - 0.0585) ** 2, 0.0075);

  // Muzzle / mouth area projects slightly; chin pad.
  dz += 0.0075 * gauss((x / 0.034) ** 2 + ((y - 0.034) / 0.026) ** 2, 1);
  dz += 0.0035 * gauss((x / 0.026) ** 2 + ((y - 0.002) / 0.016) ** 2, 1);
  // Lower-lip dimple
  dz -= 0.0016 * gauss(x * x + (y - 0.017) ** 2, 0.0065);
  // Cheek volume.
  dz += 0.0042 * gauss((ax - 0.052) ** 2 + (y - 0.066) ** 2, 0.017);

  p.z += dz * frontness;
}

/** Per-vertex colour multiplier (r,g,b) – bakes soft shading into the skin. */
function skinShade(p: THREE.Vector3, frontness: number, out: number[]) {
  let r = 1;
  let g = 1;
  let b = 1;
  const ax = Math.abs(p.x);
  const y = p.y;
  const dark = (amt: number) => {
    r *= 1 - amt * 0.55;
    g *= 1 - amt * 0.78;
    b *= 1 - amt * 0.82;
  };
  const warm = (amt: number) => {
    g *= 1 - amt * 0.1;
    b *= 1 - amt * 0.13;
  };
  if (frontness > 0) {
    // eye sockets + lid shadow
    dark(0.34 * gauss(((ax - FACE.eyeX) / 0.02) ** 2 + ((y - 0.118) / 0.016) ** 2, 1) * frontness);
    // nostrils
    dark(0.75 * gauss((ax - 0.0092) ** 2 + (y - 0.0632) ** 2, 0.0036) * frontness);
    // under nose
    dark(0.22 * gauss(p.x * p.x + (y - 0.058) ** 2, 0.008) * frontness);
    // blush on the cheeks
    warm(0.85 * gauss((ax - 0.05) ** 2 + (y - 0.07) ** 2, 0.02) * frontness);
    // nasolabial fold
    dark(0.1 * gauss((ax - 0.028) ** 2 + (y - 0.05) ** 2, 0.008) * frontness);
    // around the lips is a touch more pigmented
    warm(0.5 * gauss((p.x / 0.03) ** 2 + ((y - 0.037) / 0.02) ** 2, 1) * frontness);
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

/* ── Morph targets (jaw open, smile) ─────────────────────────────────── */

export const MORPH_JAW = 0;
export const MORPH_SMILE = 1;

function jawDelta(p: THREE.Vector3, out: THREE.Vector3) {
  // Rotation of the mandible around a hinge near the ears.
  const below = smoothstep(0.034, -0.008, p.y);
  const side = 0.6 + 0.4 * (1 - clamp(Math.abs(p.x) / 0.08, 0, 1));
  const back = smoothstep(-0.05, 0.02, p.z);
  const w = below * side * back;
  out.set(0, -0.0185 * w, -0.0045 * w);
}

function smileDelta(p: THREE.Vector3, out: THREE.Vector3) {
  const sgn = p.x >= 0 ? 1 : -1;
  const ax = Math.abs(p.x);
  const g = gauss((ax - 0.04) ** 2 + (p.y - 0.056) ** 2, 0.016) * smoothstep(-0.01, 0.04, p.z);
  out.set(sgn * 0.0032 * g, 0.0052 * g, 0.0016 * g);
}

/* ── Head mesh ───────────────────────────────────────────────────────── */

function buildHeadGeometry(cols: number, rows: number) {
  // Pre-welded UV-sphere: one shared seam column and a single vertex per pole,
  // so smooth normals come for free without an expensive vertex merge.
  const count = 2 + (rows - 1) * cols;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const shade: number[] = [0, 0, 0];
  const vi = (i: number, j: number) => (i === 0 ? 0 : i === rows ? count - 1 : 1 + (i - 1) * cols + (j % cols));

  const put = (index: number, dx: number, dy: number, dz: number) => {
    shapeHead(dx, dy, dz, p);
    const frontness = smoothstep(0.12, 0.55, dz);
    addFacialRelief(p, frontness);
    skinShade(p, frontness, shade);
    pos.set([p.x, p.y, p.z], index * 3);
    col.set(shade, index * 3);
  };
  put(0, 0, 1, 0);
  put(count - 1, 0, -1, 0);
  for (let i = 1; i < rows; i++) {
    const th = (Math.PI * i) / rows;
    const st = Math.sin(th);
    const ct = Math.cos(th);
    for (let j = 0; j < cols; j++) {
      // j = 0 sits at the back of the head so the seam is out of sight.
      const ph = (Math.PI * 2 * j) / cols + Math.PI;
      put(vi(i, j), st * Math.sin(ph), ct, st * Math.cos(ph));
    }
  }

  const idx: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = vi(i, j);
      const b = vi(i, j + 1);
      const c = vi(i + 1, j);
      const d = vi(i + 1, j + 1);
      if (i !== 0) idx.push(a, c, b);
      if (i !== rows - 1) idx.push(b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Cylindrical projection around the head so hair strands run vertically. */
function addHairUVs(geo: THREE.BufferGeometry, scale: number) {
  const pos = geo.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const angle = Math.atan2(pos.getX(i), pos.getZ(i) + 0.02);
    uv[i * 2] = angle * 0.085 * scale;
    uv[i * 2 + 1] = pos.getY(i) * scale;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function attachMorphs(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const jaw = new Float32Array(pos.count * 3);
  const smile = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    jawDelta(p, d);
    jaw.set([d.x, d.y, d.z], i * 3);
    smileDelta(p, d);
    smile.set([d.x, d.y, d.z], i * 3);
  }
  geo.morphAttributes.position = [
    new THREE.BufferAttribute(jaw, 3),
    new THREE.BufferAttribute(smile, 3),
  ];
  geo.morphTargetsRelative = true;
}

/* ── Beard ───────────────────────────────────────────────────────────── */

function beardMask(p: THREE.Vector3): number {
  const ax = Math.abs(p.x);
  // Cheek line: rises from the moustache to the sideburn in a gentle arc.
  const topEdge = 0.0605 + 0.05 * Math.pow(smoothstep(0.016, 0.071, ax), 0.8);
  const mTop = smoothstep(topEdge + 0.006, topEdge - 0.005, p.y);
  // Back edge slopes: sideburn stops at the ear, jaw line wraps under to the neck.
  const zBack = -0.012 - 0.03 * smoothstep(0.05, -0.012, p.y);
  const mBack = smoothstep(zBack - 0.016, zBack + 0.014, p.z);
  // Tight hole for the lips (lips themselves are drawn on top).
  const dm = (p.x / 0.0272) ** 2 + ((p.y - 0.0352) / 0.0088) ** 2;
  const mMouth = smoothstep(1.0, 1.4, dm);
  return mTop * mBack * mMouth;
}

function buildBeardGeometry(head: THREE.BufferGeometry) {
  const hp = head.getAttribute("position") as THREE.BufferAttribute;
  const hn = head.getAttribute("normal") as THREE.BufferAttribute;
  const hidx = head.getIndex();
  if (!hidx) throw new Error("head geometry must be indexed");

  const count = hp.count;
  const masks = new Float32Array(count);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(hp, i);
    masks[i] = beardMask(p);
  }

  // Keep only triangles that sit (mostly) inside the mask.
  const remap = new Int32Array(count).fill(-1);
  const verts: number[] = [];
  const src: number[] = [];
  const idx: number[] = [];
  const take = (i: number) => {
    if (remap[i] === -1) {
      remap[i] = src.length;
      src.push(i);
    }
    return remap[i];
  };
  for (let t = 0; t < hidx.count; t += 3) {
    const a = hidx.getX(t);
    const b = hidx.getX(t + 1);
    const c = hidx.getX(t + 2);
    if (masks[a] < 0.003 && masks[b] < 0.003 && masks[c] < 0.003) continue;
    idx.push(take(a), take(b), take(c));
  }

  const n = new THREE.Vector3();
  for (const i of src) {
    p.fromBufferAttribute(hp, i);
    n.fromBufferAttribute(hn, i);
    const m = masks[i];
    const ax = Math.abs(p.x);
    const chinF = smoothstep(0.03, -0.006, p.y);
    const frontF = smoothstep(-0.02, 0.05, p.z);
    let T = 0.0042 + 0.0105 * chinF * (0.3 + 0.7 * frontF);
    // Moustache: a little fuller above the lip
    T += 0.0048 * smoothstep(0.038, 0.012, ax) * smoothstep(0.04, 0.048, p.y);
    // Sideburns blend into the cheek
    T += 0.0018 * smoothstep(0.07, 0.1, p.y) * smoothstep(0.05, 0.075, ax);
    T = Math.max(0.0012, T) * (0.35 + 0.65 * Math.pow(m, 0.6));

    // Length: beard hangs below the chin, strongest at the centre.
    const hang = 0.027 * smoothstep(0.004, -0.014, p.y) * gauss(ax * ax, 0.043) * frontF;
    verts.push(
      p.x + n.x * T,
      p.y + n.y * T - hang * m,
      p.z + n.z * T + hang * 0.32 * m
    );
  }

  const maskAttr = src.map((i) => masks[i]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("aMask", new THREE.Float32BufferAttribute(maskAttr, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  addHairUVs(geo, 11);
  attachMorphs(geo);
  return geo;
}

/* ── Ears ────────────────────────────────────────────────────────────── */

function buildEar(side: 1 | -1, skin: THREE.Material, inner: THREE.Material) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), skin);
  outer.scale.set(0.0105, 0.029, 0.0185);
  g.add(outer);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), inner);
  bowl.scale.set(0.0045, 0.0165, 0.0095);
  bowl.position.set(side * 0.0046, -0.001, 0.002);
  g.add(bowl);
  g.position.set(side * 0.0775, 0.1, -0.006);
  g.rotation.set(0, side * 0.32, side * -0.1);
  return g;
}

/* ── Face-surface sampler ────────────────────────────────────────────── */

/**
 * Rasterises the front half of the head into a height-field so features
 * (eyes, brows, lips) can be placed on the skin with a cheap lookup. This is
 * orders of magnitude faster than raycasting a 20k-triangle mesh per point.
 */
function buildSurfaceSampler(geo: THREE.BufferGeometry) {
  const X0 = -0.095;
  const X1 = 0.095;
  const Y0 = -0.03;
  const Y1 = 0.25;
  const STEP = 0.0007;
  const NX = Math.ceil((X1 - X0) / STEP) + 1;
  const NY = Math.ceil((Y1 - Y0) / STEP) + 1;
  const grid = new Float32Array(NX * NY).fill(-1e9);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const index = geo.getIndex();
  if (!index) throw new Error("head geometry must be indexed");

  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
    const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
    if (az < 0 && bz < 0 && cz < 0) continue;
    const minX = Math.max(0, Math.floor((Math.min(ax, bx, cx) - X0) / STEP));
    const maxX = Math.min(NX - 1, Math.ceil((Math.max(ax, bx, cx) - X0) / STEP));
    const minY = Math.max(0, Math.floor((Math.min(ay, by, cy) - Y0) / STEP));
    const maxY = Math.min(NY - 1, Math.ceil((Math.max(ay, by, cy) - Y0) / STEP));
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue;
    for (let iy = minY; iy <= maxY; iy++) {
      const py = Y0 + iy * STEP;
      for (let ix = minX; ix <= maxX; ix++) {
        const px = X0 + ix * STEP;
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
        const z = l1 * az + l2 * bz + l3 * cz;
        const k = iy * NX + ix;
        if (z > grid[k]) grid[k] = z;
      }
    }
  }

  // Fill any pinholes from their neighbours.
  for (let pass = 0; pass < 3; pass++) {
    for (let iy = 1; iy < NY - 1; iy++) {
      for (let ix = 1; ix < NX - 1; ix++) {
        const k = iy * NX + ix;
        if (grid[k] > -1e8) continue;
        const n = [grid[k - 1], grid[k + 1], grid[k - NX], grid[k + NX]].filter((v) => v > -1e8);
        if (n.length) grid[k] = n.reduce((p, q) => p + q, 0) / n.length;
      }
    }
  }

  return (x: number, y: number) => {
    const fx = Math.min(NX - 1.001, Math.max(0, (x - X0) / STEP));
    const fy = Math.min(NY - 1.001, Math.max(0, (y - Y0) / STEP));
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const g = (i: number, j: number) => {
      const v = grid[j * NX + i];
      return v > -1e8 ? v : 0;
    };
    const lo = g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx;
    const hi = g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx;
    return lo * (1 - ty) + hi * ty;
  };
}

/* ── Public builder ──────────────────────────────────────────────────── */

export function buildHead(quality: "high" | "low"): HeadBuild {
  const group = new THREE.Group();
  group.name = "HeadGroup";

  const skinMaterial = new THREE.MeshPhysicalMaterial({
    color: SKIN_COLOR,
    roughness: 0.6,
    metalness: 0,
    vertexColors: true,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffc9a0),
  });

  const geo = quality === "high" ? buildHeadGeometry(104, 78) : buildHeadGeometry(56, 42);
  attachMorphs(geo);
  const head = new THREE.Mesh(geo, skinMaterial);
  head.name = "Head";
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const hairTex = makeHairTexture([5, 4]);
  const hairMaterial = new THREE.MeshPhysicalMaterial({
    color: HAIR_COLOR,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0x9a7556),
    map: hairTex,
    bumpMap: hairTex,
    bumpScale: 1.6,
  });
  hairMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aMask;\nvarying float vMask;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMask = aMask;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vMask;")
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n  float hairNoise = texture2D(map, vMapUv * 2.7).r;\n  if (vMask + (hairNoise - 0.5) * 0.85 < 0.42) discard;"
      );
  };
  const beardGeo = buildBeardGeometry(geo);
  const beard = new THREE.Mesh(beardGeo, hairMaterial);
  beard.name = "Beard";
  beard.castShadow = true;
  beard.receiveShadow = true;
  group.add(beard);

  const earSkin = skinMaterial.clone();
  earSkin.vertexColors = false;
  earSkin.color.set(0xb77c56);
  const earInner = new THREE.MeshStandardMaterial({ color: 0xa5683f, roughness: 0.75 });
  group.add(buildEar(1, earSkin, earInner));
  group.add(buildEar(-1, earSkin, earInner));

  const surfaceZ = buildSurfaceSampler(geo);

  return { group, head, beard, morphMeshes: [head, beard], surfaceZ, skinMaterial, hairMaterial };
}
