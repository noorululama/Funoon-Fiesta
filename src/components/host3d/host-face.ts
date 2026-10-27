import * as THREE from "three";
import { FACE, HAIR_COLOR, SKIN_COLOR } from "./host-head";
import { gauss, lerp } from "./host-math";
import { tubeGeometry } from "./host-geometry";

/**
 * Eyes, eyebrows and mouth. Everything here is parametric so the animator can
 * drive blinking, gaze, expressions and speech visemes.
 */

/* ── Eyes ────────────────────────────────────────────────────────────── */

const EYE_R = 0.0142;
/** Open-eye margin angles (radians from the +Y / −Y pole of the eyeball). */
const UPPER_OPEN = 1.09;
const LOWER_OPEN = 0.98;

export interface EyeRig {
  root: THREE.Group;
  /** Rotates for gaze (yaw = rotation.y, pitch = rotation.x). */
  ball: THREE.Group;
  upperLid: THREE.Group;
  lowerLid: THREE.Group;
  /** How far the upper lid can travel to close the eye (radians). */
  closeAngle: number;
}

function cap(radius: number, angle: number, mat: THREE.Material) {
  const geo = new THREE.SphereGeometry(radius, 28, 10, 0, Math.PI * 2, 0, angle);
  geo.rotateX(Math.PI / 2); // pole → +Z (looking forward)
  return new THREE.Mesh(geo, mat);
}

function lidCap(radius: number, angle: number, mat: THREE.Material, lower = false) {
  const geo = new THREE.SphereGeometry(radius, 28, 10, 0, Math.PI * 2, 0, angle);
  if (lower) geo.rotateX(Math.PI); // pole → −Y
  return new THREE.Mesh(geo, mat);
}

function marginLash(
  radius: number,
  polar: number,
  half: number,
  thick: number,
  mat: THREE.Material
) {
  const pts: THREE.Vector3[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const psi = lerp(-half, half, i / steps);
    pts.push(
      new THREE.Vector3(
        radius * Math.sin(polar) * Math.sin(psi),
        radius * Math.cos(polar),
        radius * Math.sin(polar) * Math.cos(psi)
      )
    );
  }
  const geo = tubeGeometry(pts, {
    radial: 6,
    width: (u) => thick * (0.6 + 0.4 * Math.sin(Math.PI * u)) * 1.3,
    thickness: (u) => thick * (0.5 + 0.5 * Math.sin(Math.PI * u)),
    outward: (p) => p.clone().normalize(),
  });
  return new THREE.Mesh(geo, mat);
}

function buildEye(side: 1 | -1, surfaceZ: (x: number, y: number) => number, hi: boolean) {
  const root = new THREE.Group();
  root.name = side > 0 ? "EyeLeft" : "EyeRight";
  const ex = side * FACE.eyeX;
  root.position.set(ex, FACE.eyeY, surfaceZ(ex, FACE.eyeY) - 0.0092);

  const ball = new THREE.Group();
  root.add(ball);

  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf4efe8, roughness: 0.28 });
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(EYE_R, hi ? 32 : 20, hi ? 22 : 14), scleraMat));

  const layers: [number, number, number, number][] = [
    [0.54, 0x1a100a, 0.3, 1.0028],
    [0.485, 0x442916, 0.22, 1.0034],
    [0.32, 0x6b4426, 0.22, 1.004],
    [0.17, 0x040302, 0.12, 1.0046],
  ];
  for (const [ang, color, rough, k] of layers) {
    ball.add(cap(EYE_R * k, ang, new THREE.MeshStandardMaterial({ color, roughness: rough })));
  }
  // catch-light so the eyes feel alive
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.0016, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  glint.position.set(side * -0.0037, 0.0043, EYE_R * 1.0);
  glint.position.z = Math.sqrt(Math.max(0, EYE_R * EYE_R * 1.02 - glint.position.x ** 2 - glint.position.y ** 2));
  ball.add(glint);

  // Eyelids – shells slightly larger than the ball, hinged at its centre.
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xb98059, roughness: 0.6 });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x120b07, roughness: 0.6 });
  const tilt = side * 0.1; // outer corner sits a little higher

  const upperTilt = new THREE.Group();
  upperTilt.rotation.z = tilt;
  const upperLid = new THREE.Group();
  upperLid.rotation.x = 0;
  upperLid.add(lidCap(EYE_R * 1.085, UPPER_OPEN, lidMat));
  upperLid.add(marginLash(EYE_R * 1.085, UPPER_OPEN, 1.25, 0.00062, lashMat));
  upperTilt.add(upperLid);
  root.add(upperTilt);

  const lowerTilt = new THREE.Group();
  lowerTilt.rotation.z = tilt;
  const lowerLid = new THREE.Group();
  lowerLid.add(lidCap(EYE_R * 1.085, LOWER_OPEN, lidMat, true));
  lowerTilt.add(lowerLid);
  root.add(lowerTilt);

  const eye: EyeRig = {
    root,
    ball,
    upperLid,
    lowerLid,
    closeAngle: Math.PI - LOWER_OPEN - UPPER_OPEN + 0.04,
  };
  return eye;
}

/* ── Eyebrows ────────────────────────────────────────────────────────── */

export interface BrowRig {
  root: THREE.Group;
  baseY: number;
}

function buildBrow(side: 1 | -1, surfaceZ: (x: number, y: number) => number, mat: THREE.Material) {
  const root = new THREE.Group();
  root.name = side > 0 ? "BrowLeft" : "BrowRight";
  const inner = { x: 0.0135, y: 0.1405 };
  const peak = { x: 0.0345, y: 0.1458 };
  const outer = { x: 0.0585, y: 0.1385 };
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(inner.x, inner.y, 0),
    new THREE.Vector3(lerp(inner.x, peak.x, 0.55), lerp(inner.y, peak.y, 0.7) + 0.0006, 0),
    new THREE.Vector3(peak.x, peak.y, 0),
    new THREE.Vector3(lerp(peak.x, outer.x, 0.55), lerp(peak.y, outer.y, 0.55), 0),
    new THREE.Vector3(outer.x, outer.y - 0.0008, 0),
  ]);
  const pts = curve.getPoints(18).map((p) => {
    p.z = surfaceZ(p.x, p.y) + 0.0014;
    p.x *= side;
    return p;
  });
  const geo = tubeGeometry(pts, {
    radial: 8,
    width: (u) => 0.0036 * (1 - 0.6 * u * u) + 0.0006,
    thickness: (u) => 0.0014 * (1 - 0.4 * u),
    outward: () => new THREE.Vector3(0, 0, 1),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  root.add(mesh);
  // pivot near the inner end so tilting looks right
  root.position.set(side * inner.x, inner.y, 0);
  mesh.position.set(-side * inner.x, -inner.y, 0);
  return { root, baseY: inner.y } as BrowRig;
}

/* ── Mouth ───────────────────────────────────────────────────────────── */

export interface MouthParams {
  /** 0–1 jaw opening. */
  open: number;
  /** 0–1 horizontal stretch (ee). */
  wide: number;
  /** 0–1 pucker (oo). */
  round: number;
  /** 0–1 corners lifted. */
  smile: number;
}

export interface MouthRig {
  root: THREE.Group;
  update: (p: MouthParams) => void;
}

const MOUTH_N = 25; // samples across the width
const LIP_ROWS = 6; // samples across lip thickness

function buildMouth(surfaceZ: (x: number, y: number) => number): MouthRig {
  const root = new THREE.Group();
  root.name = "Mouth";

  // Pre-sample the face surface around the mouth so we can follow it cheaply.
  const GX = 13;
  const GY = 15;
  const X0 = -0.05;
  const X1 = 0.05;
  const Y0 = -0.012;
  const Y1 = 0.08;
  const table = new Float32Array(GX * GY);
  for (let j = 0; j < GY; j++) {
    for (let i = 0; i < GX; i++) {
      table[j * GX + i] = surfaceZ(lerp(X0, X1, i / (GX - 1)), lerp(Y0, Y1, j / (GY - 1)));
    }
  }
  const zAt = (x: number, y: number) => {
    const fx = Math.min(GX - 1.001, Math.max(0, ((x - X0) / (X1 - X0)) * (GX - 1)));
    const fy = Math.min(GY - 1.001, Math.max(0, ((y - Y0) / (Y1 - Y0)) * (GY - 1)));
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const a = table[iy * GX + ix];
    const b = table[iy * GX + ix + 1];
    const c = table[(iy + 1) * GX + ix];
    const d = table[(iy + 1) * GX + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  };

  const lipMat = new THREE.MeshPhysicalMaterial({
    color: 0x8f5444,
    roughness: 0.42,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xd08a78),
    side: THREE.DoubleSide,
  });
  const cavityMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.35, side: THREE.DoubleSide });

  const gridGeo = (rows: number) => {
    const count = MOUTH_N * rows;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const idx: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let i = 0; i < MOUTH_N - 1; i++) {
        const a = r * MOUTH_N + i;
        idx.push(a, a + MOUTH_N, a + 1, a + 1, a + MOUTH_N, a + MOUTH_N + 1);
      }
    }
    geo.setIndex(idx);
    return geo;
  };

  const upperGeo = gridGeo(LIP_ROWS);
  const lowerGeo = gridGeo(LIP_ROWS);
  const cavityRows = 7;
  const cavityGeo = gridGeo(cavityRows);
  const upperTeethGeo = gridGeo(3);
  const lowerTeethGeo = gridGeo(3);

  // Cavity colours: dark throat with a pink tongue toward the bottom.
  const cc = new Float32Array(MOUTH_N * cavityRows * 3);
  for (let r = 0; r < cavityRows; r++) {
    const t = r / (cavityRows - 1);
    for (let i = 0; i < MOUTH_N; i++) {
      const s = (i / (MOUTH_N - 1)) * 2 - 1;
      const tongue = Math.max(0, (t - 0.5) / 0.5) * gauss(s * s, 0.55);
      const k = lerp(0, 1, tongue);
      const o = (r * MOUTH_N + i) * 3;
      cc[o] = lerp(0.1, 0.52, k);
      cc[o + 1] = lerp(0.025, 0.2, k);
      cc[o + 2] = lerp(0.03, 0.2, k);
    }
  }
  cavityGeo.setAttribute("color", new THREE.BufferAttribute(cc, 3));

  const upper = new THREE.Mesh(upperGeo, lipMat);
  const lower = new THREE.Mesh(lowerGeo, lipMat);
  const cavity = new THREE.Mesh(cavityGeo, cavityMat);
  const upperTeeth = new THREE.Mesh(upperTeethGeo, toothMat);
  const lowerTeeth = new THREE.Mesh(lowerTeethGeo, toothMat);
  for (const m of [upper, lower, cavity, upperTeeth, lowerTeeth]) {
    m.frustumCulled = false;
    root.add(m);
  }

  const cy = FACE.mouthY;
  const w0 = FACE.mouthHalfW;
  const yUin = new Float32Array(MOUTH_N);
  const yLin = new Float32Array(MOUTH_N);
  const xs = new Float32Array(MOUTH_N);
  const wgt = new Float32Array(MOUTH_N);

  let last = "";

  const update = (p: MouthParams) => {
    const key = `${p.open.toFixed(3)}|${p.wide.toFixed(3)}|${p.round.toFixed(3)}|${p.smile.toFixed(3)}`;
    if (key === last) return;
    last = key;

    const halfW = w0 * (1 + 0.17 * p.wide - 0.3 * p.round);
    const thick = 1 + 0.3 * p.round;

    for (let i = 0; i < MOUTH_N; i++) {
      const s = (i / (MOUTH_N - 1)) * 2 - 1;
      const w = Math.max(0, 1 - s * s);
      const wp = Math.pow(w, 0.7);
      const gap = p.open * 0.0185 * Math.pow(w, 0.55);
      const lift = (p.smile * 0.0046 + p.wide * 0.0014) * Math.pow(Math.abs(s), 2.1);
      xs[i] = s * halfW;
      wgt[i] = wp;
      yUin[i] = cy + 0.0004 + gap * 0.25 + lift;
      yLin[i] = cy - 0.0004 - gap * 0.75 + lift * 0.9;
    }

    const fillLip = (geo: THREE.BufferGeometry, upperLip: boolean) => {
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < MOUTH_N; i++) {
        const s = (i / (MOUTH_N - 1)) * 2 - 1;
        const wp = wgt[i];
        const th = (upperLip ? 0.0021 + 0.0042 * wp : 0.0024 + 0.006 * wp) * thick;
        const bow = upperLip
          ? 0.0013 * (-Math.exp(-((s / 0.11) ** 2)) + 0.8 * Math.exp(-(((Math.abs(s) - 0.3) / 0.13) ** 2)))
          : 0;
        const yIn = upperLip ? yUin[i] : yLin[i];
        const yOut = upperLip ? yIn + th + bow : yIn - th;
        for (let r = 0; r < LIP_ROWS; r++) {
          const v = r / (LIP_ROWS - 1);
          const y = lerp(yIn, yOut, v);
          const x = xs[i] * (1 + 0.035 * v);
          // rounded lip profile: rolls forward in the middle of its thickness
          const roll = Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.05)) ** 0.85;
          const z =
            zAt(x, y) +
            0.0006 +
            (0.0036 + 0.0018 * p.round) * roll * (0.35 + 0.65 * wp) -
            0.0005 * Math.abs(s);
          pos.setXYZ(r * MOUTH_N + i, x, y, z);
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
    fillLip(upperGeo, true);
    fillLip(lowerGeo, false);

    // Cavity sits between the inner lip edges, set back into the head.
    const cpos = cavityGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let r = 0; r < cavityRows; r++) {
      const t = r / (cavityRows - 1);
      for (let i = 0; i < MOUTH_N; i++) {
        const x = xs[i] * 0.985;
        const y = lerp(yUin[i], yLin[i], t);
        const z = zAt(x, cy) - 0.0038 - 0.0055 * Math.sin(Math.PI * t) * wgt[i];
        cpos.setXYZ(r * MOUTH_N + i, x, y, z);
      }
    }
    cpos.needsUpdate = true;

    const tooth = (geo: THREE.BufferGeometry, upperRow: boolean) => {
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let r = 0; r < 3; r++) {
        const t = r / 2;
        for (let i = 0; i < MOUTH_N; i++) {
          const x = xs[i] * 0.95;
          const h = (upperRow ? 0.0048 : 0.0032) * Math.pow(wgt[i], 0.5);
          const y = upperRow ? yUin[i] - 0.0003 - t * h : yLin[i] + 0.0003 + t * h;
          pos.setXYZ(r * MOUTH_N + i, x, y, zAt(x, cy) - 0.0028 - 0.0016 * Math.abs((i / (MOUTH_N - 1)) * 2 - 1));
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
    tooth(upperTeethGeo, true);
    tooth(lowerTeethGeo, false);
    // Hide inner parts entirely when the mouth is shut so nothing z-fights.
    const showInner = p.open > 0.02;
    cavity.visible = showInner;
    upperTeeth.visible = showInner;
    lowerTeeth.visible = showInner && p.open > 0.3;
  };

  update({ open: 0, wide: 0, round: 0, smile: 0.2 });
  return { root, update };
}

/* ── Public ──────────────────────────────────────────────────────────── */

export interface FaceRig {
  group: THREE.Group;
  eyeL: EyeRig;
  eyeR: EyeRig;
  browL: BrowRig;
  browR: BrowRig;
  mouth: MouthRig;
}

export function buildFace(surfaceZ: (x: number, y: number) => number, quality: "high" | "low" = "high"): FaceRig {
  const hi = quality === "high";
  const group = new THREE.Group();
  group.name = "Face";

  const eyeL = buildEye(1, surfaceZ, hi);
  const eyeR = buildEye(-1, surfaceZ, hi);
  group.add(eyeL.root, eyeR.root);

  const browMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(HAIR_COLOR).multiplyScalar(0.8), roughness: 0.9 });
  const browL = buildBrow(1, surfaceZ, browMat);
  const browR = buildBrow(-1, surfaceZ, browMat);
  group.add(browL.root, browR.root);

  const mouth = buildMouth(surfaceZ);
  group.add(mouth.root);

  // keep SKIN_COLOR import meaningful for tree-shaking-safe consumers
  void SKIN_COLOR;
  return { group, eyeL, eyeR, browL, browR, mouth };
}
