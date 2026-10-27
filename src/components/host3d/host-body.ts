import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { fbm3, smoothstep } from "./host-math";
import { loftGeometry, sampleLevels, tubeGeometry, type LoftLevel } from "./host-geometry";
import { makeClothBumpTexture } from "./host-textures";
import { SKIN_COLOR } from "./host-head";

/**
 * Body: a full-length white thobe (jubba) with a mandarin collar and button
 * placket, loose sleeves with gathered cuffs, a neck, articulated hands and
 * modest leather shoes. Everything is built from code – no external assets.
 *
 * World layout (metres, +Y up, character faces +Z, floor at y = 0):
 *   hips 0.95 → spine 1.07 → chest 1.27 → neck 1.43 → head pivot 1.50
 */

export const BODY = {
  hipsY: 0.95,
  spineY: 1.07,
  chestY: 1.27,
  neckY: 1.43,
  headPivotY: 1.5,
  shoulderX: 0.188,
  shoulderY: 1.395,
  upperLen: 0.275,
  foreLen: 0.245,
} as const;

/* ── Types ───────────────────────────────────────────────────────────── */

export interface FingerRig {
  joints: THREE.Group[];
  max: [number, number, number];
  bias: number;
}

export interface HandRig {
  root: THREE.Group;
  fingers: FingerRig[];
  thumb: FingerRig;
  thumbBase: THREE.Group;
}

export interface ArmRig {
  /** +1 = the character's left (screen-right), −1 = right. */
  side: 1 | -1;
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
  hand: HandRig;
}

export interface BodyBuild {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  headMount: THREE.Group;
  armL: ArmRig;
  armR: ArmRig;
  clothMaterial: THREE.MeshPhysicalMaterial;
}

/* ── Thobe profile ───────────────────────────────────────────────────── */

const THOBE_LEVELS: LoftLevel[] = [
  { y: 0.055, rx: 0.285, rz: 0.215, n: 2 },
  { y: 0.3, rx: 0.245, rz: 0.185, n: 2 },
  { y: 0.62, rx: 0.205, rz: 0.158, n: 2 },
  { y: 0.9, rx: 0.186, rz: 0.142, n: 2.05 },
  { y: 1.08, rx: 0.172, rz: 0.132, cz: 0.008, n: 2.1 },
  { y: 1.22, rx: 0.186, rz: 0.128, cz: 0.004, n: 2.15 },
  { y: 1.34, rx: 0.192, rz: 0.118, n: 2.2 },
  { y: 1.4, rx: 0.2, rz: 0.108, n: 2.2 },
  { y: 1.43, rx: 0.19, rz: 0.1, n: 2.15 },
  { y: 1.455, rx: 0.14, rz: 0.088, n: 2.05 },
  { y: 1.475, rx: 0.092, rz: 0.076, n: 2 },
  { y: 1.492, rx: 0.066, rz: 0.062, cz: -0.004, n: 2 },
];

const PROFILE = sampleLevels(THOBE_LEVELS, 600);

function profileAt(y: number): Required<LoftLevel> {
  const yy = Math.min(PROFILE[PROFILE.length - 1].y, Math.max(PROFILE[0].y, y));
  let lo = 0;
  let hi = PROFILE.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (PROFILE[mid].y < yy) lo = mid;
    else hi = mid;
  }
  const a = PROFILE[lo];
  const b = PROFILE[hi];
  const t = b.y === a.y ? 0 : (yy - a.y) / (b.y - a.y);
  const L = (k: keyof Required<LoftLevel>) => a[k] + (b[k] - a[k]) * t;
  return { y: yy, rx: L("rx"), rz: L("rz"), cx: L("cx"), cz: L("cz"), n: L("n") };
}

/** z of the thobe's front surface at (x, y). */
function surfaceZ(x: number, y: number) {
  const L = profileAt(y);
  const k = Math.min(0.999, Math.abs(x) / L.rx);
  return L.cz + L.rz * Math.pow(1 - Math.pow(k, L.n), 1 / L.n);
}

function levelsBetween(y0: number, y1: number, count: number): LoftLevel[] {
  const out: LoftLevel[] = [];
  for (let i = 0; i < count; i++) out.push(profileAt(y0 + ((y1 - y0) * i) / (count - 1)));
  return out;
}

/** Soft vertical folds that grow toward the hem. */
function clothFold(theta: number, _v: number, y: number) {
  const hem = smoothstep(0.8, 0.06, y);
  const amp = 0.0125 * hem * hem + 0.0012;
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const wave =
    Math.sin(theta * 11 + 2.4 * fbm3(cs * 1.3, sn * 1.3, y * 2.5)) * 0.65 +
    fbm3(cs * 3.1, sn * 3.1, y * 5.5) * 0.9;
  return amp * wave;
}

/* ── Hands ───────────────────────────────────────────────────────────── */

function capsule(radius: number, length: number, mat: THREE.Material) {
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.0001, length), 3, 8);
  geo.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function buildFinger(
  lengths: [number, number, number],
  radii: [number, number, number],
  mat: THREE.Material,
  bias: number
): { root: THREE.Group; rig: FingerRig } {
  const root = new THREE.Group();
  const joints: THREE.Group[] = [];
  let parent: THREE.Group = root;
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Group();
    if (i > 0) j.position.y = -lengths[i - 1];
    j.add(capsule(radii[i], lengths[i] - radii[i] * 0.6, mat));
    parent.add(j);
    joints.push(j);
    parent = j;
  }
  return { root, rig: { joints, max: [1.4, 1.75, 1.2], bias } };
}

/** Canonical RIGHT hand: fingers along −Y, palm faces +Z, thumb on −X. */
function buildHand(mirror: boolean, mat: THREE.Material): HandRig {
  const root = new THREE.Group();
  root.name = mirror ? "HandLeft" : "HandRight";
  const inner = new THREE.Group();
  if (mirror) inner.scale.x = -1;
  root.add(inner);

  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.094, 0.03, 3, 0.012), mat);
  palm.position.set(0, -0.049, 0);
  palm.castShadow = true;
  inner.add(palm);

  const specs: { x: number; len: [number, number, number]; r: [number, number, number]; bias: number }[] = [
    { x: -0.0295, len: [0.041, 0.025, 0.02], r: [0.0092, 0.0084, 0.0075], bias: 0 },
    { x: -0.0098, len: [0.045, 0.028, 0.021], r: [0.0094, 0.0086, 0.0077], bias: 0.05 },
    { x: 0.0098, len: [0.041, 0.026, 0.02], r: [0.009, 0.0082, 0.0074], bias: 0.1 },
    { x: 0.0292, len: [0.032, 0.02, 0.017], r: [0.0082, 0.0074, 0.0067], bias: 0.16 },
  ];
  const fingers: FingerRig[] = [];
  for (const sp of specs) {
    const f = buildFinger(sp.len, sp.r, mat, sp.bias);
    f.root.position.set(sp.x, -0.091, 0.001);
    inner.add(f.root);
    fingers.push(f.rig);
  }

  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.04, -0.03, 0.005);
  inner.add(thumbBase);
  const t = buildFinger([0.036, 0.029, 0.023], [0.0112, 0.0098, 0.0088], mat, 0);
  thumbBase.add(t.root);
  t.rig.max = [0.9, 1.1, 0.9];

  return { root, fingers, thumb: t.rig, thumbBase };
}

/* ── Public builder ──────────────────────────────────────────────────── */

export interface BodyOptions {
  /** "head" skips everything below the shoulders that a tight crop never shows. */
  detail: "full" | "head";
  quality: "high" | "low";
}

export function buildBody({ detail, quality }: BodyOptions): BodyBuild {
  const full = detail === "full";
  const root = new THREE.Group();
  root.name = "Body";

  const bump = makeClothBumpTexture([1, 1]);
  const clothMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xfbf9f4,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.8,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffffff),
    bumpMap: bump,
    bumpScale: 0.5,
    side: THREE.DoubleSide,
  });
  const skin = new THREE.MeshPhysicalMaterial({
    color: SKIN_COLOR,
    roughness: 0.6,
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffc9a0),
  });
  const pearl = new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: 0.28, metalness: 0.1 });
  const stitch = new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.9 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 0.55 });
  const sole = new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 0.8 });

  /* Pivots */
  const hips = new THREE.Group();
  hips.position.set(0, BODY.hipsY, 0);
  root.add(hips);
  const spine = new THREE.Group();
  spine.position.set(0, BODY.spineY - BODY.hipsY, 0);
  hips.add(spine);
  const chest = new THREE.Group();
  chest.position.set(0, BODY.chestY - BODY.spineY, 0);
  spine.add(chest);
  const neck = new THREE.Group();
  neck.position.set(0, BODY.neckY - BODY.chestY, 0);
  chest.add(neck);
  const headMount = new THREE.Group();
  headMount.position.set(0, BODY.headPivotY - BODY.neckY, -0.01);
  neck.add(headMount);

  const segs = quality === "high" ? 64 : 36;
  const shadowed = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /* Upper-body robe (follows spine lean/breathing) */
  const torsoGeo = loftGeometry(levelsBetween(1.06, 1.494, 34), {
    cols: segs,
    displace: clothFold,
    uvScale: [14, 10],
  });
  torsoGeo.translate(0, -BODY.spineY, 0);
  spine.add(shadowed(new THREE.Mesh(torsoGeo, clothMaterial)));

  /* Mandarin collar */
  const collarGeo = loftGeometry(
    [
      { y: 1.448, rx: 0.0675, rz: 0.0645, cz: -0.004, n: 2 },
      { y: 1.478, rx: 0.0622, rz: 0.0592, cz: -0.004, n: 2 },
      { y: 1.506, rx: 0.0592, rz: 0.0562, cz: -0.004, n: 2 },
    ],
    { rows: 8, cols: segs, uvScale: [6, 1] }
  );
  collarGeo.translate(0, -BODY.spineY, 0);
  spine.add(shadowed(new THREE.Mesh(collarGeo, clothMaterial)));
  const collarRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.0575, 0.0032, 8, segs),
    clothMaterial
  );
  collarRim.rotation.x = Math.PI / 2;
  collarRim.position.set(0, 1.506 - BODY.spineY, -0.004);
  spine.add(collarRim);

  /* Button placket with stitched edges, three pearl buttons */
  const frontPts = (x: number, y0: number, y1: number, n: number, lift: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const y = y0 + ((y1 - y0) * i) / (n - 1);
      pts.push(new THREE.Vector3(x, y - BODY.spineY, surfaceZ(x, y) + lift));
    }
    return pts;
  };
  const front = new THREE.Vector3(0, 0, 1);
  spine.add(
    shadowed(
      new THREE.Mesh(
        tubeGeometry(frontPts(0, 1.452, 1.1, 26, 0.0032), {
          radial: 8,
          outward: () => front,
          width: () => 0.0175,
          thickness: () => 0.0016,
        }),
        clothMaterial
      )
    )
  );
  for (const sx of [-0.0185, 0.0185]) {
    spine.add(
      new THREE.Mesh(
        tubeGeometry(frontPts(sx, 1.452, 1.1, 26, 0.0045), {
          radial: 6,
          outward: () => front,
          width: () => 0.0006,
          thickness: () => 0.0006,
        }),
        stitch
      )
    );
  }
  for (const by of [1.415, 1.365, 1.315]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 14, 10), pearl);
    b.position.set(0, by - BODY.spineY, surfaceZ(0, by) + 0.0055);
    b.scale.z = 0.6;
    spine.add(b);
  }

  /* Chest pocket outline on the wearer's left */
  {
    const px0 = 0.06;
    const px1 = 0.132;
    const py0 = 1.205;
    const py1 = 1.272;
    const pts: THREE.Vector3[] = [];
    const per = 10;
    const edge = (xa: number, ya: number, xb: number, yb: number) => {
      for (let i = 0; i < per; i++) {
        const t = i / per;
        const x = xa + (xb - xa) * t;
        const y = ya + (yb - ya) * t;
        pts.push(new THREE.Vector3(x, y - BODY.spineY, surfaceZ(x, y) + 0.004));
      }
    };
    edge(px0, py1, px1, py1);
    edge(px1, py1, px1, py0);
    edge(px1, py0, px0, py0);
    edge(px0, py0, px0, py1);
    spine.add(
      new THREE.Mesh(
        tubeGeometry(pts, {
          radial: 6,
          closed: true,
          outward: () => front,
          width: () => 0.0009,
          thickness: () => 0.0009,
        }),
        stitch
      )
    );
  }

  /* Neck (follows part of the head turn) */
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.057, 0.16, 24), skin);
  neckMesh.position.set(0, 1.455 - BODY.neckY, -0.008);
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  /* Lower robe (static): hangs to just above the floor */
  const skirtGeo = loftGeometry(levelsBetween(0.055, 1.14, 56), {
    cols: segs,
    displace: clothFold,
    uvScale: [14, 18],
  });
  root.add(shadowed(new THREE.Mesh(skirtGeo, clothMaterial)));

  /* Arms */
  const makeArm = (side: 1 | -1): ArmRig => {
    const shoulder = new THREE.Group();
    shoulder.name = side > 0 ? "ShoulderLeft" : "ShoulderRight";
    shoulder.position.set(side * BODY.shoulderX, BODY.shoulderY - BODY.chestY, 0);
    chest.add(shoulder);

    const upperGeo = loftGeometry(
      [
        { y: -BODY.upperLen, rx: 0.0492, rz: 0.0492 },
        { y: -0.2, rx: 0.0528, rz: 0.0528 },
        { y: -0.1, rx: 0.0572, rz: 0.0572 },
        { y: -0.03, rx: 0.0592, rz: 0.0592 },
        { y: 0.004, rx: 0.0512, rz: 0.0512 },
      ],
      { rows: 14, cols: 28, uvScale: [6, 4] }
    );
    shoulder.add(shadowed(new THREE.Mesh(upperGeo, clothMaterial)));
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.0598, 28, 18), clothMaterial);
    shoulderCap.position.y = 0;
    shoulder.add(shadowed(shoulderCap));

    const elbow = new THREE.Group();
    elbow.position.y = -BODY.upperLen;
    shoulder.add(elbow);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.0502, 20, 14), clothMaterial);
    elbow.add(shadowed(elbowBall));

    const foreGeo = loftGeometry(
      [
        { y: -0.213, rx: 0.0462, rz: 0.0462 },
        { y: -0.12, rx: 0.0492, rz: 0.0492 },
        { y: -0.03, rx: 0.0514, rz: 0.0514 },
        { y: 0.01, rx: 0.0502, rz: 0.0502 },
      ],
      { rows: 12, cols: 28, uvScale: [6, 3] }
    );
    elbow.add(shadowed(new THREE.Mesh(foreGeo, clothMaterial)));
    // gathered cuff
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.0442, 0.0442, 0.036, 28, 1, true), clothMaterial);
    cuff.position.y = -0.229;
    elbow.add(shadowed(cuff));
    for (const cy of [-0.211, -0.247]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0446, 0.0033, 8, 28), clothMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = cy;
      elbow.add(shadowed(rim));
    }
    const wristSkin = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.0272, 0.06, 18), skin);
    wristSkin.position.y = -0.235;
    wristSkin.castShadow = true;
    elbow.add(wristSkin);

    const wrist = new THREE.Group();
    wrist.position.y = -BODY.foreLen;
    elbow.add(wrist);

    const hand = buildHand(side > 0, skin);
    wrist.add(hand.root);
    return { side, shoulder, elbow, wrist, hand };
  };

  const armL = makeArm(1);
  const armR = makeArm(-1);

  /* Shoes (poke out under the hem) */
  if (full) {
    for (const sx of [-1, 1]) {
      const shoe = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), leather);
      upper.scale.set(0.048, 0.034, 0.125);
      upper.position.set(0, 0.04, 0);
      const soleMesh = new THREE.Mesh(new RoundedBoxGeometry(0.098, 0.016, 0.262, 3, 0.007), sole);
      soleMesh.position.set(0, 0.008, 0.01);
      const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.07, 14), skin);
      ankle.position.set(0, 0.085, -0.075);
      for (const m of [upper, soleMesh, ankle]) m.castShadow = true;
      shoe.add(upper, soleMesh, ankle);
      shoe.position.set(sx * 0.085, 0, 0.115);
      root.add(shoe);
    }
  }

  return { root, hips, spine, chest, neck, headMount, armL, armR, clothMaterial };
}
