import * as THREE from "three";
import { fbm3, lerp, smoothstep } from "./host-math";
import { tubeGeometry, disposeObject } from "./host-geometry";
import { makeClothBumpTexture } from "./host-textures";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Imamah (turban): a snug taqiyah cap, a series of tilted cloth wraps laid
 * over a domed volume (so the folds cross diagonally like a hand-wound
 * turban), a softly rounded crown, and the hanging tail ('adhabah).
 *
 * Head-local coordinates (same space as host-head.ts).
 */

/** The outer volume of the wound turban. */
const DOME = {
  cx: 0,
  cy: 0.18,
  cz: 0.006,
  rx: 0.1005,
  ry: 0.097,
  rz: 0.1165,
};

export interface TurbanBuild {
  group: THREE.Group;
  /** Tail pivot so the animator can swing it with head motion. */
  tail: THREE.Group;
  material: THREE.MeshPhysicalMaterial;
}

function domePoint(alpha: number, y0: number, tiltX: number, tiltZ: number, inset: number) {
  // Solve for the horizontal radius r where the tilted plane through
  // (0, y0, cz) meets the ellipsoid, along direction alpha.
  const sx = Math.sin(alpha);
  const cz = Math.cos(alpha);
  const f = (r: number) => {
    const x = r * sx;
    const z = r * cz;
    const y = y0 + tiltX * x + tiltZ * z;
    return (
      (x / (DOME.rx - inset)) ** 2 +
      ((y - DOME.cy) / (DOME.ry - inset)) ** 2 +
      (z / (DOME.rz - inset)) ** 2 -
      1
    );
  };
  let lo = 0;
  let hi = 0.2;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  const r = (lo + hi) / 2;
  const x = r * sx;
  const z = r * cz;
  return new THREE.Vector3(DOME.cx + x, y0 + tiltX * x + tiltZ * z, DOME.cz + z);
}

function buildCap(material: THREE.Material) {
  // Skull-cap: slightly larger than the head, rim sloping lower at the back.
  const cols = 56;
  const rows = 22;
  const rx = 0.0825;
  const ry = 0.123;
  const rz = 0.1045;
  const cy = 0.107;
  const cz = 0.012;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const ph = (c / cols) * Math.PI * 2;
      const back = smoothstep(0.1, -0.9, Math.cos(ph)); // 1 at the back
      const thetaMax = lerp(1.08, 1.5, back);
      const th = (r / rows) * thetaMax;
      const st = Math.sin(th);
      pos.push(rx * st * Math.sin(ph), cy + ry * Math.cos(th), cz + rz * st * Math.cos(ph));
    }
  }
  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      idx.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const uv = new Float32Array((rows + 1) * stride * 2);
  for (let i = 0; i < (rows + 1) * stride; i++) {
    uv[i * 2] = pos[i * 3] * 90;
    uv[i * 2 + 1] = pos[i * 3 + 1] * 90;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

interface Wrap {
  y0: number;
  tiltX: number;
  tiltZ: number;
  width: number;
  thick: number;
  seed: number;
}

function buildWraps(baseMaterial: THREE.MeshPhysicalMaterial, hi: boolean) {
  const material = baseMaterial.clone();
  material.vertexColors = true;
  // From the forehead band upward. tiltX leans the band toward the front /
  // back, tiltZ raises one side – alternating signs gives the crossing folds.
  const wraps: Wrap[] = [
    { y0: 0.188, tiltX: 0.1, tiltZ: -0.02, width: 0.0205, thick: 0.0125, seed: 1 },
    { y0: 0.197, tiltX: -0.34, tiltZ: -0.08, width: 0.0205, thick: 0.0125, seed: 2 },
    { y0: 0.208, tiltX: 0.36, tiltZ: -0.1, width: 0.0205, thick: 0.0125, seed: 3 },
    { y0: 0.218, tiltX: -0.3, tiltZ: -0.15, width: 0.0205, thick: 0.0125, seed: 4 },
    { y0: 0.229, tiltX: 0.4, tiltZ: -0.11, width: 0.02, thick: 0.0122, seed: 5 },
    { y0: 0.239, tiltX: -0.26, tiltZ: -0.17, width: 0.0195, thick: 0.012, seed: 6 },
    { y0: 0.249, tiltX: 0.3, tiltZ: -0.12, width: 0.019, thick: 0.0115, seed: 7 },
    { y0: 0.258, tiltX: -0.18, tiltZ: -0.14, width: 0.0175, thick: 0.011, seed: 8 },
  ];
  const geos: THREE.BufferGeometry[] = [];
  const steps = hi ? 104 : 64;
  const center = new THREE.Vector3(DOME.cx, DOME.cy, DOME.cz);
  for (const w of wraps) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const wob = fbm3(Math.sin(a) * 1.7 + w.seed * 3.1, Math.cos(a) * 1.7, w.seed);
      const p = domePoint(a, w.y0 + wob * 0.004, w.tiltX, w.tiltZ, 0.006 + wob * 0.004);
      pts.push(p);
    }
    const g = tubeGeometry(pts, {
      radial: hi ? 10 : 6,
      closed: true,
      center,
      outward: (p) => p.clone().sub(center),
      width: (u) => {
        const a = u * Math.PI * 2;
        return w.width * (1 + 0.16 * fbm3(Math.cos(a) * 2 + w.seed, Math.sin(a) * 2, w.seed * 1.9));
      },
      thickness: (u) => {
        const a = u * Math.PI * 2;
        return w.thick * (1 + 0.14 * fbm3(Math.sin(a) * 2.4, Math.cos(a) * 2.4 + w.seed, 4.2));
      },
      uvScale: [14, 2],
      edgeShade: 0.3,
    });
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildCrown(material: THREE.Material) {
  // Soft dome closing the top of the wraps.
  const cols = 64;
  const rows = 18;
  const yCut = 0.248;
  const thetaMax = Math.acos(THREE.MathUtils.clamp((yCut - DOME.cy) / DOME.ry, -1, 1));
  const pos: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const th = (r / rows) * thetaMax;
    const st = Math.sin(th);
    for (let c = 0; c <= cols; c++) {
      const ph = (c / cols) * Math.PI * 2;
      const x = (DOME.rx - 0.003) * st * Math.sin(ph);
      const z = (DOME.rz - 0.003) * st * Math.cos(ph);
      let y = DOME.cy + (DOME.ry - 0.002) * Math.cos(th);
      // gentle soft folds on top
      y += 0.0035 * fbm3(x * 38, z * 38, 9.1) * smoothstep(0.0, 0.5, th);
      pos.push(DOME.cx + x, y, DOME.cz + z);
    }
  }
  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      idx.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const uv = new Float32Array((rows + 1) * stride * 2);
  for (let i = 0; i < (rows + 1) * stride; i++) {
    uv[i * 2] = pos[i * 3] * 90;
    uv[i * 2 + 1] = pos[i * 3 + 2] * 90;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

function buildTail(material: THREE.Material) {
  // Pivot at the point where the tail leaves the back of the turban.
  const pivot = new THREE.Group();
  pivot.name = "TurbanTail";
  const top = new THREE.Vector3(0.006, 0.19, -0.1);
  pivot.position.copy(top);
  const pts: THREE.Vector3[] = [];
  const n = 22;
  const len = 0.285;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    pts.push(
      new THREE.Vector3(
        0.004 * Math.sin(s * 5.0) * s,
        -len * s,
        -0.018 - 0.026 * s - 0.01 * Math.sin(s * Math.PI * 1.2) * s
      )
    );
  }
  const geo = tubeGeometry(pts, {
    radial: 10,
    outward: () => new THREE.Vector3(0, 0, -1),
    width: (u) => 0.019 + 0.006 * u,
    thickness: (u) => 0.0026 - 0.0008 * u,
    uvScale: [8, 1],
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pivot.add(mesh);
  return pivot;
}

export function buildTurban(quality: "high" | "low" = "high"): TurbanBuild {
  const hi = quality === "high";
  const group = new THREE.Group();
  group.name = "Imamah";

  const bump = makeClothBumpTexture([1, 1]);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf8f6f0,
    roughness: 0.88,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffffff),
    bumpMap: bump,
    bumpScale: 0.6,
    side: THREE.DoubleSide,
  });

  group.add(buildCap(material));
  group.add(buildWraps(material, hi));
  group.add(buildCrown(material));
  const tail = buildTail(material);
  group.add(tail);

  return { group, tail, material };
}

export { disposeObject };
