import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { disposeObject } from "./host-geometry";
import { approach, clamp } from "./host-math";
import type { AnimInputs } from "./host-animator";

/**
 * "Funoon Festa AI": a friendly robot host in a cream thobe.
 *
 *  - cream helmet head with a black screen face (glowing eyes + smile) and headphone cups
 *  - embroidered taqiyah cap, gold-trimmed thobe, green sash with name badge, black hands
 *
 * Built only from three.js primitives and canvas textures. Same contract as the
 * human host: `root` is the scene-graph root, `RobotAnimator` drives it every frame.
 */

const CREAM = 0xf1e6d6;
const GOLD = "#d7b36a";
const CYAN = "#9fe0ff";

/* ── Canvas helpers ──────────────────────────────────────────────────── */

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A row of pointed arches with a lattice below: the gold embroidery band. */
function drawArchBand(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, color: string, cell = 34) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(x0, y0 + 2, w, h - 4);
  ctx.strokeRect(x0, y0 + 8, w, h - 16);
  for (let x = x0; x < x0 + w; x += cell) {
    const cx = x + cell / 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y0 + h - 10);
    ctx.lineTo(x + 4, y0 + h * 0.5);
    ctx.quadraticCurveTo(cx - 2, y0 + 12, cx, y0 + 12);
    ctx.quadraticCurveTo(cx + 2, y0 + 12, x + cell - 4, y0 + h * 0.5);
    ctx.lineTo(x + cell - 4, y0 + h - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, y0 + h * 0.62, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function makeTrimTexture(bg: string, fg: string, w = 256, h = 64) {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  drawArchBand(ctx, 0, 0, w, h, fg, 32);
  return toTexture(canvas);
}

function makeCapTexture() {
  const { canvas, ctx } = makeCanvas(1024, 256);
  ctx.fillStyle = "#f3e9db";
  ctx.fillRect(0, 0, 1024, 256);
  // rose-gold tinted embroidered band over the whole side of the cap
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(215,179,106,0.0)");
  g.addColorStop(1, "rgba(215,179,106,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  drawArchBand(ctx, 0, 40, 1024, 170, "#c9a064", 64);
  ctx.strokeStyle = "#c9a064";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(1024, 24);
  ctx.moveTo(0, 232);
  ctx.lineTo(1024, 232);
  ctx.stroke();
  return toTexture(canvas);
}

function makePlacketTexture() {
  const w = 128;
  const h = 360;
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  // keyhole placket: straight strip with a pointed bottom
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(w - 10, 0);
  ctx.lineTo(w - 10, h - 90);
  ctx.lineTo(w / 2, h - 4);
  ctx.lineTo(10, h - 90);
  ctx.closePath();
  ctx.fillStyle = "#f3e9db";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  // inner outline + diamond lattice
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "#c9a064";
  ctx.lineWidth = 3;
  for (let i = -h; i < h + w; i += 20) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i + w);
    ctx.moveTo(w, i);
    ctx.lineTo(0, i + w);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 0);
  ctx.lineTo(w / 2 - 6, h - 100);
  ctx.moveTo(w / 2 + 6, 0);
  ctx.lineTo(w / 2 + 6, h - 100);
  ctx.strokeStyle = "#e9dcc3";
  ctx.lineWidth = 8;
  ctx.stroke();
  return toTexture(canvas);
}

function makeSashTexture() {
  const w = 256;
  const h = 640;
  const { canvas, ctx } = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#08403b");
  g.addColorStop(0.5, "#0c4f49");
  g.addColorStop(1, "#08403b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // cloth weave
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // gold border
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, w - 44, h - 44);
  // mosque panel in the lower half
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = GOLD;
  ctx.lineWidth = 3;
  const baseY = h - 90;
  ctx.beginPath();
  ctx.moveTo(40, baseY);
  ctx.lineTo(w - 40, baseY);
  ctx.stroke();
  // central dome + minaret hints
  ctx.beginPath();
  ctx.arc(w / 2, baseY - 70, 52, Math.PI, 0);
  ctx.lineTo(w / 2 + 52, baseY);
  ctx.moveTo(w / 2 - 52, baseY - 70);
  ctx.lineTo(w / 2 - 52, baseY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2, baseY - 128);
  ctx.lineTo(w / 2, baseY - 150);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, baseY - 154, 4, 0, Math.PI * 2);
  ctx.fill();
  for (const dx of [-86, 86]) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + dx - 12, baseY);
    ctx.lineTo(w / 2 + dx - 12, baseY - 90);
    ctx.lineTo(w / 2 + dx, baseY - 112);
    ctx.lineTo(w / 2 + dx + 12, baseY - 90);
    ctx.lineTo(w / 2 + dx + 12, baseY);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 - 36 + i * 36, baseY);
    ctx.lineTo(w / 2 - 36 + i * 36, baseY - 36);
    ctx.quadraticCurveTo(w / 2 - 36 + i * 36 + 18, baseY - 60, w / 2 - 36 + i * 36 + 36, baseY - 36);
    ctx.stroke();
  }
  return toTexture(canvas);
}

function makeBadgeTexture() {
  const w = 512;
  const h = 256;
  const { canvas, ctx } = makeCanvas(w, h);
  roundRect(ctx, 6, 6, w - 12, h - 12, 18);
  ctx.fillStyle = "#16213a";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.lineWidth = 3;
  roundRect(ctx, 22, 22, w - 44, h - 44, 10);
  ctx.stroke();
  ctx.fillStyle = "#f4efe6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 66px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("FUNOON AI", w / 2, h * 0.52);
  return toTexture(canvas);
}

/* ── Screen face (glowing eyes and smile) ────────────────────────────── */

export interface ScreenParams {
  blink: number; // 1 open … 0 closed
  scale: number; // eye size
  lx: number; // eye look offset (px)
  ly: number;
  open: number; // 0…1 mouth open
  smile: number; // 0…1 smile curvature
  dots: number; // 0 or 1: thinking "…"
  time: number;
}

class ScreenFace {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private last = "";
  static readonly W = 512;
  static readonly H = 384;

  constructor() {
    const { canvas, ctx } = makeCanvas(ScreenFace.W, ScreenFace.H);
    this.canvas = canvas;
    this.ctx = ctx;
    this.texture = toTexture(canvas);
    this.draw({ blink: 1, scale: 1, lx: 0, ly: 0, open: 0, smile: 1, dots: 0, time: 0 });
  }

  draw(p: ScreenParams) {
    const key = [p.blink, p.scale, p.lx, p.ly, p.open, p.smile, p.dots, p.dots ? Math.floor(p.time * 3) % 4 : 0].map((v) => (typeof v === "number" ? v.toFixed(2) : v)).join("|");
    if (key === this.last) return;
    this.last = key;
    const { W, H } = ScreenFace;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // black glossy bezel
    roundRect(ctx, 0, 0, W, H, 96);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#080c14");
    bg.addColorStop(1, "#02040a");
    ctx.fillStyle = bg;
    ctx.fill();
    // faint top-left reflection
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 96);
    ctx.clip();
    const refl = ctx.createLinearGradient(0, 0, W * 0.7, H);
    refl.addColorStop(0, "rgba(160,200,255,0.10)");
    refl.addColorStop(0.45, "rgba(160,200,255,0)");
    ctx.fillStyle = refl;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // eyes
    const eyeY = H * 0.4 + p.ly;
    for (const ex of [W * 0.31, W * 0.69]) {
      const r = 38 * p.scale;
      const ry = Math.max(3, r * p.blink);
      ctx.save();
      ctx.shadowColor = "#6fd8ff";
      ctx.shadowBlur = 34;
      const g = ctx.createRadialGradient(ex + p.lx, eyeY, 2, ex + p.lx, eyeY, r);
      g.addColorStop(0, "#d9f1ff");
      g.addColorStop(0.75, "#b4e2ff");
      g.addColorStop(1, "#8fd0ff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ex + p.lx, eyeY, r, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // mouth
    const mx = W / 2;
    const my = H * 0.7;
    ctx.save();
    ctx.shadowColor = "#6fd8ff";
    ctx.shadowBlur = 26;
    ctx.strokeStyle = CYAN;
    ctx.fillStyle = CYAN;
    ctx.lineCap = "round";
    ctx.lineWidth = 10;
    if (p.dots) {
      const n = Math.floor(p.time * 3) % 4;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i < n ? 1 : 0.25;
        ctx.beginPath();
        ctx.arc(mx - 36 + i * 36, my, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.open > 0.06) {
      const hw = 82;
      const drop = 14 + p.open * 58;
      ctx.beginPath();
      ctx.moveTo(mx - hw, my - 6);
      ctx.quadraticCurveTo(mx, my - 6 + 20 * p.smile, mx + hw, my - 6);
      ctx.quadraticCurveTo(mx, my - 6 + 20 * p.smile + drop * 1.6, mx - hw, my - 6);
      ctx.closePath();
      ctx.globalAlpha = 0.92;
      ctx.fill();
    } else {
      const hw = 84;
      ctx.beginPath();
      ctx.moveTo(mx - hw, my - 4);
      ctx.quadraticCurveTo(mx, my - 4 + 46 * p.smile, mx + hw, my - 4);
      ctx.stroke();
    }
    ctx.restore();
    this.texture.needsUpdate = true;
  }
}

/* ── Hand ────────────────────────────────────────────────────────────── */

function buildHand(mat: THREE.Material) {
  const hand = new THREE.Group();
  hand.name = "Hand";
  // The hand hangs along -Y with the palm facing +Z.
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.086, 0.034, 4, 0.014), mat);
  palm.position.set(0, -0.052, 0);
  hand.add(palm);
  const fingerLen = [0.052, 0.062, 0.058, 0.046];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, fingerLen[i], 4, 8), mat);
    f.position.set(-0.027 + i * 0.018, -0.095 - fingerLen[i] / 2 - 0.004, 0);
    hand.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0135, 0.044, 4, 8), mat);
  thumb.position.set(0.05, -0.06, 0.004);
  thumb.rotation.z = 0.7;
  hand.add(thumb);
  hand.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return hand;
}

/* ── Robot build ─────────────────────────────────────────────────────── */

export interface ArmRigR {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  hand: THREE.Group;
}

export interface RobotHost {
  root: THREE.Group;
  body: THREE.Group;
  headPivot: THREE.Group;
  screen: ScreenFace;
  armR: ArmRigR; // character's right arm (viewer's left), the waving one
  armL: ArmRigR; // character's left arm (viewer's right), the presenting one
  sash: THREE.Group;
  dispose: () => void;
}

export function createRobotHost(): RobotHost {
  const root = new THREE.Group();
  root.name = "FunoonRobotHost";

  const cream = new THREE.MeshPhysicalMaterial({ color: CREAM, roughness: 0.82, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) });
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf6efe6, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0b0908, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.55, metalness: 0.1 });

  /* Body: a long cream thobe */
  const body = new THREE.Group();
  body.name = "Body";
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.3, 0.98, 56), cream);
  torso.scale.z = 0.62;
  torso.position.y = 0.49;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.235, 40, 24), cream);
  shoulders.scale.set(1, 0.4, 0.62);
  shoulders.position.y = 0.95;
  shoulders.castShadow = true;
  body.add(shoulders);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.12, 24), black);
  neck.position.y = 1.03;
  body.add(neck);

  const collarTex = makeTrimTexture("#f3e9db", "#c9a064", 256, 64);
  collarTex.repeat.set(3, 1);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.092, 0.05, 40, 1, true),
    new THREE.MeshStandardMaterial({ map: collarTex, roughness: 0.7, side: THREE.DoubleSide })
  );
  collar.position.y = 0.985;
  body.add(collar);

  const placket = new THREE.Mesh(
    new THREE.PlaneGeometry(0.115, 0.42),
    new THREE.MeshStandardMaterial({ map: makePlacketTexture(), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  placket.position.set(0, 0.77, 0.62 * (0.19 + 0.11 * (0.98 - 0.77) / 0.98) + 0.006);
  placket.rotation.x = -0.07;
  body.add(placket);

  /* Green sash over the character's left shoulder (viewer's right) */
  const sash = new THREE.Group();
  sash.name = "Sash";
  const sashTex = makeSashTexture();
  const sashMat = new THREE.MeshStandardMaterial({ map: sashTex, roughness: 0.85, side: THREE.DoubleSide });
  const sashMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.56, 0.012), sashMat);
  sashMesh.position.set(0, -0.28, 0);
  sashMesh.castShadow = true;
  sash.add(sashMesh);
  const tasselMat = new THREE.MeshStandardMaterial({ color: 0xd7b36a, roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.045, 8), tasselMat);
    t.position.set(-0.07 + i * 0.0233, -0.585, 0.004);
    t.rotation.x = Math.PI;
    sash.add(t);
  }
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.06),
    new THREE.MeshStandardMaterial({ map: makeBadgeTexture(), roughness: 0.4, metalness: 0.3 })
  );
  badge.position.set(-0.075, -0.1, 0.0125);
  sash.add(badge);
  // rests on the shoulder, falls diagonally across the chest
  sash.position.set(0.14, 1.0, 0.115);
  sash.rotation.set(-0.04, 0, 0.2);
  body.add(sash);

  /* Arms */
  const trimTex = makeTrimTexture("#f3e9db", "#c9a064", 256, 64);
  trimTex.repeat.set(2, 1);
  const cuffMat = new THREE.MeshStandardMaterial({ map: trimTex, roughness: 0.65 });
  const handMat = black;

  const buildArm = (side: 1 | -1): ArmRigR => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.255, 0.92, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 6, 20), cream);
    upper.position.y = -0.13;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.17, 6, 20), cream);
    fore.position.y = -0.1;
    fore.castShadow = true;
    elbow.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.06, 28, 1, true), cuffMat);
    cuff.position.y = -0.2;
    elbow.add(cuff);
    const hand = buildHand(handMat);
    hand.position.y = -0.225;
    elbow.add(hand);
    body.add(shoulder);
    return { shoulder, elbow, hand };
  };
  const armR = buildArm(-1);
  const armL = buildArm(1);

  /* Head */
  const headPivot = new THREE.Group();
  headPivot.name = "HeadPivot";
  headPivot.position.set(0, 1.07, 0);
  headPivot.scale.setScalar(1.1);
  body.add(headPivot);

  const HEAD = { w: 0.46, h: 0.38, d: 0.36 };
  const head = new THREE.Mesh(new RoundedBoxGeometry(HEAD.w, HEAD.h, HEAD.d, 8, 0.095), shell);
  head.position.y = HEAD.h / 2;
  head.castShadow = true;
  head.receiveShadow = true;
  headPivot.add(head);

  const screen = new ScreenFace();
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.385, 0.289),
    new THREE.MeshBasicMaterial({ map: screen.texture, transparent: true, toneMapped: false })
  );
  screenMesh.position.set(0, HEAD.h / 2 - 0.005, HEAD.d / 2 + 0.003);
  headPivot.add(screenMesh);

  for (const side of [1, -1] as const) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.07, 40), dark);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * (HEAD.w / 2 + 0.028), HEAD.h / 2 - 0.01, -0.005);
    cup.castShadow = true;
    headPivot.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.008, 12, 40), new THREE.MeshStandardMaterial({ color: 0x4a403a, roughness: 0.4, metalness: 0.4 }));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * (HEAD.w / 2 + 0.064), HEAD.h / 2 - 0.01, -0.005);
    headPivot.add(ring);
  }

  /* Embroidered taqiyah cap */
  const capProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.178, 0.0),
    new THREE.Vector2(0.186, 0.012),
    new THREE.Vector2(0.186, 0.075),
    new THREE.Vector2(0.172, 0.103),
    new THREE.Vector2(0.14, 0.118),
    new THREE.Vector2(0.08, 0.125),
    new THREE.Vector2(0.0, 0.127),
  ];
  const capGeo = new THREE.LatheGeometry(capProfile, 64);
  const capMat = new THREE.MeshStandardMaterial({ map: makeCapTexture(), roughness: 0.7, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.scale.set(1.17, 1, 0.88);
  cap.position.y = HEAD.h - 0.012;
  cap.castShadow = true;
  headPivot.add(cap);
  const capTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.186, 0.006, 8, 64),
    new THREE.MeshStandardMaterial({ color: 0xd7b36a, roughness: 0.35, metalness: 0.6 })
  );
  capTrim.rotation.x = Math.PI / 2;
  capTrim.scale.set(1.17, 0.88, 1);
  capTrim.position.y = HEAD.h - 0.004;
  headPivot.add(capTrim);

  return {
    root,
    body,
    headPivot,
    screen,
    armR,
    armL,
    sash,
    dispose: () => {
      screen.texture.dispose();
      disposeObject(root);
    },
  };
}

/* ── Animator ────────────────────────────────────────────────────────── */

const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;

export class RobotAnimator {
  private blinkT = 2.5;
  private blink = 1;
  private blinkPhase = 0;
  private open = 0;
  private smile = 1;
  private eyeScale = 1;
  private lookX = 0;
  private lookY = 0;
  private headYaw = 0;
  private headPitch = 0;
  private greetT = 0;
  private nodT = 0;
  private waveAmt = 1; // how raised the waving arm is
  private presentAmt = 1;
  private readonly GREET = 2.8;

  constructor(private robot: RobotHost) {}

  greet() {
    this.greetT = this.GREET;
    this.nodT = 0.7;
  }

  nod() {
    this.nodT = 0.7;
  }

  update(dt: number, t: number, inputs: AnimInputs) {
    const r = this.robot;
    const { state, speaking, listening, pointer, reducedMotion } = inputs;
    const calm = reducedMotion ? 0.4 : 1;
    this.greetT = Math.max(0, this.greetT - dt);
    this.nodT = Math.max(0, this.nodT - dt);
    const thinking = state === "thinking";
    const talking = speaking || state === "speaking";
    const greeting = this.greetT > 0;

    /* Breathing + gentle float */
    r.body.scale.y = 1 + 0.004 * Math.sin(t * 1.6) * calm;
    r.sash.rotation.z = 0.2 + 0.012 * Math.sin(t * 1.3) * calm;

    /* Head: follows the pointer, bobs while talking, nods on request */
    const px = pointer ? pointer.x : 0;
    const py = pointer ? pointer.y : 0;
    const targetYaw = px * 0.35 * calm + Math.sin(t * 0.6) * 0.05 * calm + (listening ? 0.06 : 0);
    let targetPitch = -py * 0.2 * calm + (talking ? 0.035 * Math.sin(t * 5.2) : 0) + (thinking ? -0.08 : 0);
    if (this.nodT > 0) targetPitch += 0.22 * Math.sin((1 - this.nodT / 0.7) * Math.PI);
    if (greeting) targetPitch += 0.08;
    this.headYaw = approach(this.headYaw, targetYaw, 7, dt);
    this.headPitch = approach(this.headPitch, targetPitch, 9, dt);
    r.headPivot.rotation.set(this.headPitch, this.headYaw, (listening ? 0.07 : 0) + Math.sin(t * 0.8) * 0.012 * calm);

    /* Screen face */
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = 1;
    }
    if (this.blinkPhase > 0) {
      this.blinkPhase += dt * 9;
      this.blink = Math.abs(Math.cos(Math.min(this.blinkPhase, Math.PI) * 1));
      if (this.blinkPhase >= Math.PI) {
        this.blinkPhase = 0;
        this.blink = 1;
        this.blinkT = 2 + Math.random() * 3.2;
      }
    }
    const targetScale = listening ? 1.14 : thinking ? 0.9 : 1;
    this.eyeScale = approach(this.eyeScale, targetScale, 8, dt);
    this.lookX = approach(this.lookX, thinking ? 16 : px * 8, 6, dt);
    this.lookY = approach(this.lookY, thinking ? -12 : -py * 5, 6, dt);

    const openTarget = talking ? clamp(0.25 + 0.65 * Math.abs(Math.sin(t * 9.3)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 3.1))), 0, 1) : 0;
    this.open = approach(this.open, openTarget, talking ? 22 : 12, dt);
    const smileTarget = talking ? 0.6 : listening ? 0.85 : 1;
    this.smile = approach(this.smile, smileTarget, 6, dt);

    r.screen.draw({
      blink: this.blink,
      scale: this.eyeScale,
      lx: this.lookX,
      ly: this.lookY,
      open: this.open,
      smile: this.smile,
      dots: thinking ? 1 : 0,
      time: t,
    });

    /* Right arm (viewer's left): the friendly wave */
    const waveTarget = greeting ? 1 : listening || thinking ? 0 : talking ? 0.35 : 1;
    this.waveAmt = approach(this.waveAmt, waveTarget, 4, dt);
    const waveSpeed = greeting ? 7 : 3.4;
    const waveSwing = (greeting ? 0.42 : 0.2) * calm * this.waveAmt;
    const rs = r.armR.shoulder;
    const re = r.armR.elbow;
    rs.rotation.set(lerpN(0, -0.05, this.waveAmt), 0, lerpN(-0.08, -0.78, this.waveAmt));
    re.rotation.set(0, 0, lerpN(-0.05, -2.16, this.waveAmt) + Math.sin(t * waveSpeed) * waveSwing);
    r.armR.hand.rotation.z = Math.sin(t * waveSpeed + 0.6) * 0.1 * this.waveAmt;

    /* Left arm (viewer's right): open-palm "welcome" gesture */
    const presentTarget = listening ? 0.25 : thinking ? 0.1 : 1;
    this.presentAmt = approach(this.presentAmt, presentTarget, 4, dt);
    const ls = r.armL.shoulder;
    const le = r.armL.elbow;
    const gest = talking ? Math.sin(t * 2.4) * 0.12 : Math.sin(t * 1.1) * 0.03;
    ls.rotation.set(lerpN(0, -0.25, this.presentAmt), 0, lerpN(0.08, 0.38, this.presentAmt));
    le.rotation.set(0, 0, lerpN(0, 1.2, this.presentAmt) + gest);
    r.armL.hand.rotation.set(0, 0, lerpN(0, 0.1, this.presentAmt));
  }
}
