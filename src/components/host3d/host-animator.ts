import * as THREE from "three";
import type { HostCharacter } from "./host-character";
import type { ArmRig, FingerRig, HandRig } from "./host-body";
import { BODY } from "./host-body";
import { approach, clamp, lerp, makeRng, smoothstep } from "./host-math";

/**
 * Procedural animation for the host: no clips, everything is computed.
 *
 *  - Arms use analytic two-bone IK, so a gesture is just "where is the wrist,
 *    which way do the fingers point, which way does the palm face".
 *  - Speech uses a viseme sequencer (open / wide / round / closed).
 *  - The greeting (salaam) places the right hand over the heart and bows.
 */

export type HostState = "idle" | "listening" | "thinking" | "speaking";

export interface AnimInputs {
  state: HostState;
  speaking: boolean;
  listening: boolean;
  /** Normalised pointer (-1…1) while hovering, otherwise null. */
  pointer: { x: number; y: number } | null;
  reducedMotion: boolean;
}

/* ── Arm poses ───────────────────────────────────────────────────────── */

interface ArmPose {
  /** Wrist position, world-aligned (x lateral, y height, z forward). */
  wrist: THREE.Vector3;
  /** Which way the elbow should point. */
  pole: THREE.Vector3;
  /** Direction the fingers point. */
  finger: THREE.Vector3;
  /** Direction the palm faces. */
  palm: THREE.Vector3;
  curl: number;
  thumb: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Poses are authored for the RIGHT arm (x < 0) and mirrored for the left. */
const POSES = {
  rest: {
    wrist: V(-0.228, 0.9, 0.045),
    pole: V(-0.3, -0.2, -1),
    finger: V(0.05, -1, 0.12),
    palm: V(1, 0.02, 0.12),
    curl: 0.3,
    thumb: 0.15,
  },
  folded: {
    wrist: V(-0.07, 1.02, 0.2),
    pole: V(-0.6, -1, -0.25),
    finger: V(0.78, -0.15, 0.6),
    palm: V(0.05, -1, 0.1),
    curl: 0.14,
    thumb: 0.1,
  },
  foldedUnder: {
    wrist: V(-0.045, 1.0, 0.195),
    pole: V(-0.6, -1, -0.25),
    finger: V(0.78, -0.1, 0.6),
    palm: V(0, 1, 0.1),
    curl: 0.14,
    thumb: 0.1,
  },
  heart: {
    wrist: V(-0.045, 1.255, 0.152),
    pole: V(-0.6, -1, -0.5),
    finger: V(1, 0.28, -0.05),
    palm: V(0, 0.05, -1),
    curl: 0.04,
    thumb: 0.05,
  },
  think: {
    wrist: V(-0.06, 1.31, 0.245),
    pole: V(-0.8, -1, -0.2),
    finger: V(0.3, 0.92, 0.22),
    palm: V(0.7, -0.15, -0.68),
    curl: 0.55,
    thumb: 0.35,
  },
  palmUp: {
    wrist: V(-0.17, 1.06, 0.3),
    pole: V(-0.7, -1, -0.25),
    finger: V(0.12, 0.02, 1),
    palm: V(0.05, 1, 0),
    curl: 0.12,
    thumb: 0.05,
  },
  palmUpWide: {
    wrist: V(-0.28, 1.1, 0.26),
    pole: V(-0.7, -1, -0.2),
    finger: V(-0.25, 0.05, 1),
    palm: V(0.1, 1, 0),
    curl: 0.1,
    thumb: 0.02,
  },
  palmSide: {
    wrist: V(-0.2, 1.14, 0.25),
    pole: V(-0.6, -1, -0.3),
    finger: V(0.2, 0.25, 1),
    palm: V(1, -0.1, 0),
    curl: 0.2,
    thumb: 0.1,
  },
  emphasis: {
    wrist: V(-0.16, 1.2, 0.24),
    pole: V(-0.7, -1, -0.3),
    finger: V(0.1, 0.65, 0.75),
    palm: V(0.5, 0.05, -0.8),
    curl: 0.22,
    thumb: 0.08,
  },
} satisfies Record<string, ArmPose>;

type PoseName = keyof typeof POSES;

const mirrorX = (v: THREE.Vector3, side: 1 | -1) =>
  new THREE.Vector3(v.x * -side, v.y, v.z);

class ArmState {
  wrist = new THREE.Vector3();
  pole = new THREE.Vector3();
  finger = new THREE.Vector3();
  palm = new THREE.Vector3();
  curl = 0.3;
  thumb = 0.15;
  constructor(public side: 1 | -1) {
    this.set(POSES.rest);
  }
  set(p: ArmPose) {
    this.wrist.copy(mirrorX(p.wrist, this.side));
    this.pole.copy(mirrorX(p.pole, this.side));
    this.finger.copy(mirrorX(p.finger, this.side));
    this.palm.copy(mirrorX(p.palm, this.side));
    this.curl = p.curl;
    this.thumb = p.thumb;
  }
  approachPose(p: ArmPose, rate: number, dt: number) {
    const k = 1 - Math.exp(-rate * dt);
    this.wrist.lerp(mirrorX(p.wrist, this.side), k);
    this.pole.lerp(mirrorX(p.pole, this.side), k);
    this.finger.lerp(mirrorX(p.finger, this.side), k).normalize();
    this.palm.lerp(mirrorX(p.palm, this.side), k).normalize();
    this.curl += (p.curl - this.curl) * k;
    this.thumb += (p.thumb - this.thumb) * k;
  }
}

/* ── IK ──────────────────────────────────────────────────────────────── */

const DOWN = new THREE.Vector3(0, -1, 0);
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tC = new THREE.Vector3();
const tElbow = new THREE.Vector3();
const tDir = new THREE.Vector3();
const qU = new THREE.Quaternion();
const qF = new THREE.Quaternion();
const qH = new THREE.Quaternion();
const qT = new THREE.Quaternion();
const mBasis = new THREE.Matrix4();

function solveArm(arm: ArmRig, s: ArmState) {
  const L1 = BODY.upperLen;
  const L2 = BODY.foreLen;
  const S = arm.shoulder.position;
  // world-aligned target → chest-local
  tA.copy(s.wrist);
  tA.y -= BODY.chestY;
  tA.sub(S);
  let d = tA.length();
  if (d < 1e-5) return;
  tDir.copy(tA).divideScalar(d);
  d = clamp(d, Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.004);

  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const A = Math.acos(clamp(cosA, -1, 1));

  tB.copy(s.pole).addScaledVector(tDir, -s.pole.dot(tDir));
  if (tB.lengthSq() < 1e-6) tB.set(0, -1, 0);
  tB.normalize();

  tElbow.copy(tDir).multiplyScalar(Math.cos(A) * L1).addScaledVector(tB, Math.sin(A) * L1);
  tC.copy(tElbow).normalize(); // upper-arm direction
  qU.setFromUnitVectors(DOWN, tC);
  arm.shoulder.quaternion.copy(qU);

  // forearm direction expressed in the upper-arm frame
  tB.copy(tDir).multiplyScalar(d).sub(tElbow).normalize();
  qT.copy(qU).invert();
  tB.applyQuaternion(qT);
  qF.setFromUnitVectors(DOWN, tB);
  arm.elbow.quaternion.copy(qF);

  // hand orientation from finger + palm directions
  const yAxis = tA.copy(s.finger).negate().normalize();
  const zAxis = tB.copy(s.palm);
  zAxis.addScaledVector(yAxis, -zAxis.dot(yAxis)).normalize();
  const xAxis = tC.crossVectors(yAxis, zAxis).normalize();
  mBasis.makeBasis(xAxis, yAxis, zAxis);
  qH.setFromRotationMatrix(mBasis);
  qT.copy(qU).multiply(qF).invert();
  arm.wrist.quaternion.copy(qT.multiply(qH));
}

function poseFinger(f: FingerRig, curl: number, spread: number, spreadAxis = 0) {
  const c = clamp(curl + f.bias * curl, 0, 1);
  f.joints[0].rotation.set(-c * f.max[0], 0, spread * spreadAxis);
  f.joints[1].rotation.set(-c * f.max[1], 0, 0);
  f.joints[2].rotation.set(-c * f.max[2], 0, 0);
}

function poseHand(hand: HandRig, curl: number, thumb: number) {
  const spreadAxes = [-1, -0.35, 0.35, 1];
  hand.fingers.forEach((f, i) => poseFinger(f, curl, 0.05, spreadAxes[i]));
  // Thumb swings from out-to-the-side toward the palm as `thumb` rises.
  hand.thumbBase.rotation.set(-0.35 - 0.3 * thumb, 0.2, -0.65 + 0.45 * thumb);
  poseFinger(hand.thumb, thumb * 0.8, 0);
}

/* ── Visemes ─────────────────────────────────────────────────────────── */

interface Viseme {
  open: number;
  wide: number;
  round: number;
}

const VISEMES: Viseme[] = [
  { open: 0.85, wide: 0.1, round: 0 }, // aa
  { open: 0.5, wide: 0.7, round: 0 }, // ee
  { open: 0.28, wide: 0.9, round: 0 }, // ii
  { open: 0.6, wide: 0, round: 0.75 }, // oh
  { open: 0.22, wide: 0, round: 1 }, // oo
  { open: 0.45, wide: 0.25, round: 0.1 }, // eh
  { open: 0.05, wide: 0, round: 0 }, // closed (m, b, p)
  { open: 0.35, wide: 0.15, round: 0 }, // consonant
];

/* ── Animator ────────────────────────────────────────────────────────── */

const GREET_DURATION = 3.1;

export class HostAnimator {
  private rng = makeRng(7);

  // smoothed state
  private headYaw = 0;
  private headPitch = 0;
  private headRoll = 0;
  private eyeYaw = 0;
  private eyePitch = 0;
  private lean = 0;
  private smile = 0.25;
  private brow = 0;
  private browAsym = 0;

  // blink
  private nextBlink = 1.5;
  private blinkT = -1;
  private blinkDouble = false;

  // gaze saccades
  private nextSaccade = 1;
  private saccade = { x: 0, y: 0 };

  // speech
  private visemeT = 0;
  private visemeDur = 0.1;
  private viseme: Viseme = VISEMES[6];
  private wordCount = 0;
  private mouth = { open: 0, wide: 0, round: 0 };
  private energy = 0;

  // gestures
  private armR = new ArmState(-1);
  private armL = new ArmState(1);
  private gestureR: PoseName = "folded";
  private gestureL: PoseName = "foldedUnder";
  private gestureTimeR = 0;
  private gestureTimeL = 0;

  // greeting
  private greetT = -1;

  // click nod
  private nodT = -1;

  constructor(private host: HostCharacter) {
    // Start already in the resting "hands folded" stance.
    this.armR.set(POSES.folded);
    this.armL.set(POSES.foldedUnder);
    this.applyArms(0.016, "idle", 1, false);
  }

  /** Salaam: right hand over the heart, a gentle bow, a warm smile. */
  greet() {
    this.greetT = 0;
  }

  nod() {
    this.nodT = 0;
  }

  get isGreeting() {
    return this.greetT >= 0;
  }

  private pickGesture(): PoseName {
    const options: PoseName[] = ["palmUp", "palmUpWide", "palmSide", "emphasis", "palmUp", "palmSide"];
    return options[Math.floor(this.rng() * options.length)];
  }

  private applyArms(dt: number, state: HostState, motion: number, speaking: boolean) {
    const { armL, armR } = this.host.body;

    // choose target poses
    let poseR: PoseName = "folded";
    let poseL: PoseName = "foldedUnder";

    if (state === "thinking") {
      poseR = "think";
      poseL = "foldedUnder";
    } else if (speaking) {
      this.gestureTimeR -= dt;
      this.gestureTimeL -= dt;
      if (this.gestureTimeR <= 0) {
        this.gestureR = this.rng() < 0.28 ? "folded" : this.pickGesture();
        this.gestureTimeR = 0.8 + this.rng() * 1.3;
      }
      if (this.gestureTimeL <= 0) {
        this.gestureL = this.rng() < 0.62 ? "foldedUnder" : this.pickGesture();
        this.gestureTimeL = 1.0 + this.rng() * 1.6;
      }
      poseR = this.gestureR;
      poseL = this.gestureL;
    } else {
      this.gestureTimeR = 0;
      this.gestureTimeL = 0;
    }

    // greeting overrides the right arm with the hand on the heart
    let greetEnv = 0;
    if (this.greetT >= 0) {
      greetEnv = smoothstep(0, 0.6, this.greetT) * smoothstep(GREET_DURATION, GREET_DURATION - 0.7, this.greetT);
      poseR = "heart";
    }

    const rate = this.greetT >= 0 ? 7 : 5;
    const targetR: ArmPose = POSES[poseR];
    const targetL: ArmPose = POSES[poseL];
    this.armR.approachPose(targetR, rate, dt);
    this.armL.approachPose(speaking ? targetL : POSES.foldedUnder, 5, dt);

    // slight life in the resting hands
    const hover = Math.sin(this.time * 1.6) * 0.0035 * motion;
    this.armR.wrist.y += hover;
    this.armL.wrist.y -= hover * 0.8;

    solveArm(armR, this.armR);
    solveArm(armL, this.armL);
    poseHand(armR.hand, this.armR.curl, this.armR.thumb);
    poseHand(armL.hand, this.armL.curl, this.armL.thumb);
    return greetEnv;
  }

  private time = 0;

  update(dt: number, t: number, inputs: AnimInputs) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    this.time = t;
    const host = this.host;
    const motion = inputs.reducedMotion ? 0.35 : 1;
    const state = inputs.state;
    const speaking = inputs.speaking || state === "speaking";
    const listening = inputs.listening || state === "listening";
    const thinking = state === "thinking" && !speaking;

    /* Greeting envelope */
    let greetEnv = 0;
    if (this.greetT >= 0) {
      this.greetT += dt;
      greetEnv = smoothstep(0, 0.6, this.greetT) * smoothstep(GREET_DURATION, GREET_DURATION - 0.7, this.greetT);
      if (this.greetT > GREET_DURATION) this.greetT = -1;
    }

    /* Head & gaze targets */
    let tgtYaw = 0;
    let tgtPitch = 0;
    let tgtRoll = 0;
    const p = inputs.pointer;
    if (p) {
      tgtYaw = p.x * 0.4;
      tgtPitch = -p.y * 0.24;
    } else {
      tgtYaw = Math.sin(t * 0.6) * 0.05 * motion;
      tgtPitch = Math.cos(t * 0.8) * 0.03 * motion;
    }

    if (listening) {
      tgtPitch += 0.05;
      tgtRoll += 0.075;
    } else if (thinking) {
      tgtPitch -= 0.1;
      tgtYaw -= 0.18;
      tgtRoll -= 0.06;
    } else if (speaking) {
      tgtPitch += Math.sin(t * 5.6) * 0.03 * motion * (0.4 + this.energy);
      tgtRoll += Math.sin(t * 2.3) * 0.025 * motion;
      tgtYaw += Math.sin(t * 1.1) * 0.05 * motion;
    }

    if (this.nodT >= 0) {
      this.nodT += dt;
      tgtPitch += Math.sin(this.nodT * 9) * 0.12 * (1 - smoothstep(0, 0.8, this.nodT));
      if (this.nodT > 0.8) this.nodT = -1;
    }
    // salaam bow
    tgtPitch += 0.2 * greetEnv;
    tgtYaw *= 1 - 0.7 * greetEnv;

    this.headYaw = approach(this.headYaw, tgtYaw, 6, dt);
    this.headPitch = approach(this.headPitch, tgtPitch, 6, dt);
    this.headRoll = approach(this.headRoll, tgtRoll, 5, dt);

    host.headPivot.rotation.set(this.headPitch * 0.7, this.headYaw * 0.7, this.headRoll * 0.7);
    host.body.neck.rotation.set(this.headPitch * 0.3, this.headYaw * 0.3, this.headRoll * 0.3);

    /* Breathing, lean & sway */
    const breath = Math.sin(t * 1.7);
    const leanTarget = (listening ? 0.05 : speaking ? 0.025 : 0) + 0.06 * greetEnv;
    this.lean = approach(this.lean, leanTarget, 3, dt);
    host.body.spine.rotation.set(
      this.lean + breath * 0.007 * motion,
      Math.sin(t * 0.27) * 0.025 * motion,
      Math.sin(t * 0.33) * 0.012 * motion
    );
    host.body.chest.rotation.x = breath * 0.006 * motion;

    /* Eyes */
    let gx = 0;
    let gy = 0;
    if (p) {
      gx = p.x * 0.3;
      gy = -p.y * 0.2;
    }
    this.nextSaccade -= dt;
    if (this.nextSaccade <= 0) {
      this.saccade.x = (this.rng() - 0.5) * 0.09 * motion;
      this.saccade.y = (this.rng() - 0.5) * 0.05 * motion;
      this.nextSaccade = 0.7 + this.rng() * 2.2;
    }
    gx += this.saccade.x - this.headYaw * 0.35;
    gy += this.saccade.y - this.headPitch * 0.3;
    if (thinking) {
      gx += 0.2;
      gy -= 0.2;
    }
    gy += 0.1 * greetEnv; // eyes lowered with the bow
    this.eyeYaw = approach(this.eyeYaw, clamp(gx, -0.38, 0.38), 14, dt);
    this.eyePitch = approach(this.eyePitch, clamp(gy, -0.3, 0.3), 14, dt);
    for (const eye of [host.face.eyeL, host.face.eyeR]) {
      eye.ball.rotation.set(this.eyePitch, this.eyeYaw, 0);
    }

    /* Blinking */
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) {
      this.blinkT = 0;
      this.blinkDouble = this.rng() < 0.15;
      this.nextBlink = 2.2 + this.rng() * 3.6;
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const dur = 0.17;
      const x = this.blinkT / dur;
      blink = x < 0.4 ? x / 0.4 : Math.max(0, 1 - (x - 0.4) / 0.6);
      if (this.blinkT > dur) {
        this.blinkT = -1;
        if (this.blinkDouble) {
          this.blinkDouble = false;
          this.nextBlink = 0.12;
        }
      }
    }
    // lids follow the eyes a little, and relax slightly when happy
    const lidFollow = clamp(this.eyePitch * 0.8, -0.2, 0.25);
    const squint = this.smile * 0.1;
    for (const eye of [host.face.eyeL, host.face.eyeR]) {
      eye.upperLid.rotation.x = eye.closeAngle * 0.92 * blink + lidFollow + squint;
      eye.lowerLid.rotation.x = -0.16 * blink - squint * 0.6;
    }

    /* Brows */
    const browTarget = listening ? 0.0035 : thinking ? 0.002 : speaking ? 0.0012 + 0.0016 * this.energy : 0;
    this.brow = approach(this.brow, browTarget + 0.002 * greetEnv, 8, dt);
    this.browAsym = approach(this.browAsym, thinking ? 0.0032 : 0, 6, dt);
    host.face.browL.root.position.y = host.face.browL.baseY + this.brow + this.browAsym;
    host.face.browR.root.position.y = host.face.browR.baseY + this.brow;
    host.face.browL.root.rotation.z = (this.brow + this.browAsym) * 14;
    host.face.browR.root.rotation.z = -this.brow * 14;

    /* Speech visemes → mouth */
    let tOpen = 0;
    let tWide = 0;
    let tRound = 0;
    if (speaking) {
      this.visemeT += dt;
      this.energy = approach(this.energy, 0.55 + 0.45 * Math.sin(t * 1.9) * Math.sin(t * 0.7 + 1), 3, dt);
      if (this.visemeT >= this.visemeDur) {
        this.visemeT = 0;
        this.wordCount++;
        // short pause roughly every 4–7 syllables
        if (this.wordCount % (4 + Math.floor(this.rng() * 4)) === 0) {
          this.viseme = VISEMES[6];
          this.visemeDur = 0.12 + this.rng() * 0.16;
        } else {
          this.viseme = VISEMES[Math.floor(this.rng() * VISEMES.length)];
          this.visemeDur = 0.07 + this.rng() * 0.09;
        }
      }
      const amp = 0.55 + 0.45 * this.energy;
      tOpen = this.viseme.open * amp;
      tWide = this.viseme.wide * amp;
      tRound = this.viseme.round * amp;
    } else {
      this.energy = approach(this.energy, 0, 4, dt);
      if (thinking) tRound = 0.18;
      if (listening) tOpen = 0.04;
    }
    const mr = speaking ? 22 : 12;
    this.mouth.open = approach(this.mouth.open, tOpen, mr, dt);
    this.mouth.wide = approach(this.mouth.wide, tWide, mr, dt);
    this.mouth.round = approach(this.mouth.round, tRound, mr, dt);

    const smileTarget =
      0.22 + (listening ? 0.12 : 0) + (speaking ? 0.1 + 0.06 * Math.sin(t * 2.1) : 0) + (thinking ? -0.1 : 0) + 0.45 * greetEnv;
    this.smile = approach(this.smile, clamp(smileTarget, 0, 1), 5, dt);

    host.face.mouth.update({
      open: this.mouth.open,
      wide: this.mouth.wide,
      round: this.mouth.round,
      smile: this.smile,
    });
    host.setJaw(this.mouth.open);
    host.setSmile(clamp(this.smile + this.mouth.wide * 0.3, 0, 1));

    /* Arms */
    if (host.body.armL.shoulder.parent) {
      this.applyArms(dt, state, motion, speaking);
    }

    /* Turban tail follows the head */
    const tail = host.turban.tail;
    tail.rotation.x = lerp(tail.rotation.x, 0.06 + this.headPitch * 0.6 + Math.sin(t * 1.3) * 0.015 * motion, 0.1);
    tail.rotation.z = lerp(tail.rotation.z, -this.headRoll * 0.5 + Math.sin(t * 0.9 + 1) * 0.02 * motion + this.headYaw * 0.1, 0.1);
  }
}
