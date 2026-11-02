import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { findBones, type HostBones } from "./glb-bones";
import { MorphRig } from "./glb-morphs";
import { LipSync } from "./glb-lipsync";

/**
 * Realistic 3D host loaded from a .glb file (Avaturn, Ready Player Me style,
 * Character Creator, Mixamo, VRoid… anything with a humanoid skeleton).
 *
 * Same public API as the procedural `HostScene`, so `ai-3d-human.tsx` can use
 * either one. Works with or without facial blendshapes / animation clips:
 *  - ARKit blendshapes (jawOpen, eyeBlinkLeft…) or Oculus visemes (viseme_aa…)
 *    drive lip-sync, blinking and expressions; otherwise a jaw bone is used.
 *  - An "idle" clip in the file is played if present; otherwise the arms are
 *    lowered out of the T/A-pose and breathing / head motion is procedural.
 */

export type GlbViewMode = "portrait" | "full";
export type GlbHostState = "idle" | "listening" | "thinking" | "speaking";

export interface GlbHostSceneOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  url: string;
  compact?: boolean;
  viewMode?: GlbViewMode;
  lowPower?: boolean;
  reducedMotion?: boolean;
}

export interface GlbHostInputs {
  state: GlbHostState;
  speaking: boolean;
  listening: boolean;
}

/** Height every model is scaled to, so camera framing is model-independent. */
const TARGET_HEIGHT = 1.75;
const DRACO_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

function detectLowPower(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
/** Cheap smooth 1D noise in [-1, 1]. */
const noise = (t: number, seed: number) =>
  Math.sin(t * 1.13 + seed) * 0.5 + Math.sin(t * 2.31 + seed * 1.7) * 0.3 + Math.sin(t * 0.47 + seed * 3.1) * 0.2;

export class GlbHostScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  onReady?: () => void;
  onError?: (err: unknown) => void;
  onProgress?: (fraction: number) => void;

  private container: HTMLElement;
  private compact: boolean;
  private viewMode: GlbViewMode;
  private lowPower: boolean;
  private reducedMotion: boolean;
  private inputs: GlbHostInputs = { state: "idle", speaking: false, listening: false };

  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget;
  private root = new THREE.Group(); // orbit pivot
  private model: THREE.Object3D | null = null;
  private bones: HostBones | null = null;
  private rest = new Map<THREE.Bone, THREE.Quaternion>();
  private morphs: MorphRig | null = null;
  private lips = new LipSync();
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private talkAction: THREE.AnimationAction | null = null;
  private greetAction: THREE.AnimationAction | null = null;
  private shadow: THREE.Mesh | null = null;

  private headPos = new THREE.Vector3(0, 1.6, 0);
  private raf = 0;
  private running = false;
  private disposed = false;
  private visible = true;
  private ready = false;
  private lastTick = 0;
  private time = 0;
  private frameBudget = 0;

  // gaze / gesture state
  private pointer: { x: number; y: number } | null = null;
  private look = { yaw: 0, pitch: 0 };
  private saccade = { yaw: 0, pitch: 0, next: 1 };
  private blink = { t: 0, next: 2.5, double: false };
  private nodT = -1;
  private greetT = -1;
  private expr = { smile: 0.1, brow: 0, frown: 0, squint: 0 };

  // orbit / drag
  private dragging = false;
  private dragX = 0;
  private orbit = 0;
  private orbitTarget = 0;
  private moved = 0;

  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private cleanup: (() => void)[] = [];

  // scratch
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private q3 = new THREE.Quaternion();
  private e1 = new THREE.Euler();

  constructor(opts: GlbHostSceneOptions) {
    this.container = opts.container;
    this.compact = !!opts.compact;
    this.viewMode = opts.viewMode ?? "portrait";
    this.lowPower = opts.lowPower ?? detectLowPower();
    this.reducedMotion =
      opts.reducedMotion ??
      (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      alpha: true,
      antialias: !this.lowPower,
      powerPreference: "high-performance",
    });
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    this.renderer.setPixelRatio(Math.min(dpr, this.lowPower ? 1.25 : 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    /* Studio lighting: soft image-based light + warm key, cool fill, gold rim */
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.75;
    this.scene.add(new THREE.HemisphereLight(0xfff6ec, 0x2a3326, 0.55));
    const key = new THREE.DirectionalLight(0xfff1e2, 2.2);
    key.position.set(1.4, 2.8, 2.6);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
    fill.position.set(-2.2, 1.8, 1.8);
    const rim = new THREE.DirectionalLight(0xffd58c, 2.0);
    rim.position.set(-1.2, 2.4, -2.4);
    const rim2 = new THREE.DirectionalLight(0xb8e08c, 1.0);
    rim2.position.set(1.6, 1.8, -2.0);
    this.scene.add(key, fill, rim, rim2, this.root);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    this.resize();
    this.applyCamera(1, true);
    this.bindEvents(opts.canvas);
    void this.load(opts.url);
  }

  /* ── public API (mirrors HostScene) ─────────────────────────────── */

  setInputs(next: Partial<GlbHostInputs>) {
    const wasSpeaking = this.inputs.speaking || this.inputs.state === "speaking";
    this.inputs = { ...this.inputs, ...next };
    const speaking = this.inputs.speaking || this.inputs.state === "speaking";
    if (speaking !== wasSpeaking) {
      this.lips.setActive(speaking);
      this.crossfadeTalk(speaking);
    }
  }

  setViewMode(mode: GlbViewMode) {
    this.viewMode = mode;
  }

  /** Friendly greeting: plays a wave/greet clip if the file has one, otherwise a smile and nod. */
  greet() {
    if (this.greetAction && this.mixer) {
      this.greetAction.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.3).play();
      this.greetAction.clampWhenFinished = false;
    }
    this.greetT = 0;
    this.nodT = 0;
  }

  nod() {
    this.nodT = 0;
  }

  get wasDrag() {
    return this.moved > 6;
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTick = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  frame(rawDt: number) {
    if (this.disposed || !this.ready) return;
    const dt = clamp(Number.isFinite(rawDt) ? rawDt : 0, 0, 0.05);
    if (!this.visible || this.container.clientWidth === 0 || (typeof document !== "undefined" && document.hidden)) return;
    // Budget phones: cap to ~30 fps.
    if (this.lowPower) {
      this.frameBudget += dt;
      if (this.frameBudget < 1 / 31) return;
      this.step(this.frameBudget);
      this.frameBudget = 0;
    } else {
      this.step(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.mixer?.stopAllAction();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const m of mats) {
        for (const value of Object.values(m)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        m.dispose();
      }
    });
    this.envTarget.dispose();
    this.pmrem.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /* ── loading ────────────────────────────────────────────────────── */

  private async load(url: string) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
    try {
      const gltf = await loader.loadAsync(url, (e) => {
        if (e.lengthComputable && e.total > 0) this.onProgress?.(e.loaded / e.total);
      });
      if (this.disposed) return;
      this.setupModel(gltf.scene, gltf.animations);
      this.ready = true;
      this.resize();
      this.applyCamera(1, true);
      this.start();
      // Draw the first frame immediately so there is no blank flash.
      this.step(0);
      this.renderer.render(this.scene, this.camera);
      this.onReady?.();
    } catch (err) {
      if (!this.disposed) this.onError?.(err);
    } finally {
      draco.dispose();
    }
  }

  private setupModel(model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.model = model;
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Skinned meshes are often culled wrongly once bones move.
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.anisotropy = this.lowPower ? 2 : 4;
        // Hair cards: render as cut-out with MSAA-smoothed edges (alpha-to-coverage)
        // instead of blended, which avoids the dark sorting halo without jaggies.
        if (/hair/i.test(`${m.name} ${mesh.name}`) && (std.transparent || std.alphaTest > 0)) {
          std.transparent = false;
          std.depthWrite = true;
          std.alphaTest = this.lowPower ? 0.5 : 0.25;
          std.alphaToCoverage = !this.lowPower;
          std.side = THREE.DoubleSide;
          std.needsUpdate = true;
        }
      }
    });
    this.root.add(model);

    /* Normalise scale: feet on the floor, centred, 1.75 m tall. */
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0) model.scale.multiplyScalar(TARGET_HEIGHT / size.y);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    model.updateMatrixWorld(true);

    this.bones = findBones(model);
    const b = this.bones;

    /* Face the camera (+Z). The character's left arm should be on +X. */
    if (b.leftArm && b.rightArm) {
      const l = b.leftArm.getWorldPosition(new THREE.Vector3());
      const r = b.rightArm.getWorldPosition(new THREE.Vector3());
      if (l.x < r.x) {
        model.rotation.y += Math.PI;
        model.updateMatrixWorld(true);
      }
    }

    /* Animation clips */
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(model);
      const pick = (re: RegExp) => clips.find((c) => re.test(c.name));
      const idle = pick(/idle|breath|stand/i) ?? (clips.length === 1 ? clips[0] : undefined);
      const talk = pick(/talk|speak|conversation/i);
      const greet = pick(/wave|greet|hello|salam|salaam/i);
      if (idle) {
        this.idleAction = this.mixer.clipAction(idle);
        this.idleAction.play();
      }
      if (talk) this.talkAction = this.mixer.clipAction(talk);
      if (greet) this.greetAction = this.mixer.clipAction(greet);
    }

    /* No idle clip → bring the arms down out of T/A-pose. */
    if (!this.idleAction) this.relaxArms();

    /* Remember the rest pose of every bone we animate procedurally. */
    for (const bone of [b.spine, b.chest, b.neck, b.head, b.leftEye, b.rightEye, b.jaw]) {
      if (bone) this.rest.set(bone, bone.quaternion.clone());
    }

    this.morphs = new MorphRig(model);
    this.lips.configure(this.morphs, !!b.jaw);

    /* Where is the face? Used for camera framing. */
    model.updateMatrixWorld(true);
    if (b.head) {
      b.head.getWorldPosition(this.headPos);
      // Head bones sit at the base of the skull; the eyes are a bit higher.
      this.headPos.y += 0.06;
    } else {
      this.headPos.set(0, TARGET_HEIGHT * 0.93, 0);
    }

    /* Soft contact shadow */
    const tex = makeShadowTexture();
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.002;
    this.root.add(this.shadow);
  }

  /** Rotate upper arms down to the sides and bend the elbows slightly. */
  private relaxArms() {
    const b = this.bones;
    if (!b) return;
    const sides: [THREE.Bone | undefined, THREE.Bone | undefined, THREE.Bone | undefined, number][] = [
      [b.leftArm, b.leftForeArm, b.leftHand, 1],
      [b.rightArm, b.rightForeArm, b.rightHand, -1],
    ];
    for (const [arm, fore, hand, sign] of sides) {
      if (!arm || !fore) continue;
      const a = arm.getWorldPosition(new THREE.Vector3());
      const f = fore.getWorldPosition(new THREE.Vector3());
      const dir = f.clone().sub(a).normalize();
      if (dir.y < -0.75) continue; // already relaxed
      aimBone(arm, fore, new THREE.Vector3(sign * 0.2, -1, 0.04).normalize());
      if (hand) aimBone(fore, hand, new THREE.Vector3(sign * 0.08, -1, 0.42).normalize());
    }
  }

  /* ── per-frame animation ────────────────────────────────────────── */

  private step(dt: number) {
    this.time += dt;
    const t = this.time;
    const b = this.bones!;
    const { state } = this.inputs;
    const speaking = this.inputs.speaking || state === "speaking";
    const listening = this.inputs.listening || state === "listening";
    const thinking = state === "thinking";
    const motion = this.reducedMotion ? 0.35 : 1;

    this.orbit = damp(this.orbit, this.orbitTarget, 9, dt);
    this.root.rotation.y = this.orbit;

    /* 1. reset procedural bones to rest, then let clips write over them */
    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    this.mixer?.update(dt);
    this.model!.updateMatrixWorld(true);

    /* 2. gaze target: pointer if hovering, else camera with small saccades */
    this.saccade.next -= dt;
    if (this.saccade.next <= 0) {
      this.saccade.yaw = (Math.random() - 0.5) * 0.12;
      this.saccade.pitch = (Math.random() - 0.5) * 0.06;
      this.saccade.next = 0.6 + Math.random() * 2.2;
    }
    let yaw = this.saccade.yaw * 0.4;
    let pitch = this.saccade.pitch * 0.4;
    if (this.pointer) {
      yaw = this.pointer.x * 0.32;
      pitch = -this.pointer.y * 0.16;
    }
    if (thinking) {
      yaw = 0.18 + noise(t * 0.6, 3) * 0.05;
      pitch = -0.12;
    }
    // Head turns opposite the orbit a little so he keeps looking at the viewer.
    yaw -= this.orbit * 0.55;
    this.look.yaw = damp(this.look.yaw, yaw, 5, dt);
    this.look.pitch = damp(this.look.pitch, pitch, 5, dt);

    /* 3. body: breathing + gentle sway (only when no idle clip drives it) */
    const breathe = Math.sin(t * Math.PI * 2 * 0.24);
    if (!this.idleAction) {
      this.rotateBone(b.spine, 0.012 * breathe * motion, noise(t * 0.35, 1) * 0.025 * motion, noise(t * 0.3, 7) * 0.012 * motion);
      this.rotateBone(b.chest, -0.016 * breathe * motion, 0, 0);
    }

    /* 4. head + neck: look, listen tilt, speaking emphasis, nods */
    const amp = this.lips.amplitude;
    let nodPitch = 0;
    if (this.nodT >= 0) {
      this.nodT += dt;
      const p = this.nodT / 0.9;
      nodPitch = p < 1 ? Math.sin(p * Math.PI * 2) * 0.09 * (1 - p) : 0;
      if (p >= 1) this.nodT = -1;
    }
    const talkMove = speaking ? noise(t * 2.2, 5) * 0.035 + amp * 0.02 : 0;
    const tilt = listening ? 0.08 : thinking ? -0.05 : noise(t * 0.4, 9) * 0.02;
    const idleDrift = noise(t * 0.25, 2) * 0.03 * motion;
    this.rotateBone(b.neck, (this.look.pitch + nodPitch) * 0.4 + talkMove * 0.5, (this.look.yaw + idleDrift) * 0.4, tilt * 0.4);
    this.rotateBone(b.head, (this.look.pitch + nodPitch) * 0.6 + talkMove, (this.look.yaw + idleDrift) * 0.6, tilt * 0.6);

    /* 5. eyes: follow gaze target */
    const eyeYaw = clamp(this.saccade.yaw + (this.pointer ? this.pointer.x * 0.15 : 0), -0.3, 0.3);
    const eyePitch = clamp(this.saccade.pitch + (thinking ? -0.15 : 0), -0.2, 0.2);
    this.rotateBone(b.leftEye, eyePitch, eyeYaw, 0);
    this.rotateBone(b.rightEye, eyePitch, eyeYaw, 0);

    /* 6. face: blink, expressions, lip-sync */
    const m = this.morphs!;
    this.blink.next -= dt;
    if (this.blink.next <= 0 && this.blink.t === 0) this.blink.t = 0.0001;
    let blinkV = 0;
    if (this.blink.t > 0) {
      this.blink.t += dt;
      const d = 0.16;
      blinkV = this.blink.t < d ? Math.sin((this.blink.t / d) * Math.PI) : 0;
      if (this.blink.t >= d) {
        this.blink.t = 0;
        const again = !this.blink.double && Math.random() < 0.18;
        this.blink.double = again;
        this.blink.next = again ? 0.12 : 1.8 + Math.random() * 3.8;
      }
    }

    let greetSmile = 0;
    if (this.greetT >= 0) {
      this.greetT += dt;
      greetSmile = this.greetT < 2.4 ? Math.sin(Math.min(1, this.greetT / 2.4) * Math.PI) : 0;
      if (this.greetT >= 2.4) this.greetT = -1;
    }
    this.expr.smile = damp(this.expr.smile, (thinking ? 0.02 : listening ? 0.22 : 0.12) + greetSmile * 0.5, 4, dt);
    this.expr.brow = damp(this.expr.brow, listening ? 0.35 : speaking ? amp * 0.25 : greetSmile * 0.3, 5, dt);
    this.expr.frown = damp(this.expr.frown, thinking ? 0.25 : 0, 4, dt);
    this.expr.squint = damp(this.expr.squint, greetSmile * 0.35 + this.expr.smile * 0.25, 4, dt);

    m.beginFrame();
    m.add("blink", blinkV);
    m.add("smile", this.expr.smile);
    m.add("browUp", this.expr.brow);
    m.add("browDown", this.expr.frown);
    m.add("squint", this.expr.squint);
    m.add("lookUp", thinking ? 0.35 : 0);
    this.lips.update(dt, m, b.jaw ? (angle) => this.rotateBone(b.jaw, angle, 0, 0) : undefined);
    m.endFrame(dt);

    /* 7. contact shadow + camera */
    if (this.shadow) this.shadow.visible = this.viewMode === "full" && !this.compact;
    this.applyCamera(dt, false);
  }

  /**
   * Rotate a bone by pitch/yaw/roll expressed in the character's own space
   * (X = his left→right axis, Y = up, Z = towards the viewer), regardless of how
   * the rig's local bone axes are oriented.
   */
  private rotateBone(bone: THREE.Bone | undefined, pitch: number, yaw: number, roll: number) {
    if (!bone || !bone.parent || (pitch === 0 && yaw === 0 && roll === 0)) return;
    const offset = this.q1.setFromEuler(this.e1.set(pitch, yaw, roll, "YXZ"));
    const rootQ = this.model!.getWorldQuaternion(this.q2);
    // offset in world space = R * O * R^-1
    const worldOffset = this.q3.copy(rootQ).multiply(offset).multiply(rootQ.invert());
    const parentQ = bone.parent.getWorldQuaternion(this.q2);
    // local = P^-1 * W * P * local
    const local = parentQ.clone().invert().multiply(worldOffset).multiply(parentQ).multiply(bone.quaternion);
    bone.quaternion.copy(local);
    bone.updateMatrixWorld(true);
  }

  private crossfadeTalk(speaking: boolean) {
    if (!this.talkAction || !this.mixer) return;
    if (speaking) {
      this.talkAction.reset().fadeIn(0.35).play();
      this.idleAction?.fadeOut(0.35);
    } else {
      this.talkAction.fadeOut(0.5);
      this.idleAction?.reset().fadeIn(0.5).play();
    }
  }

  private applyCamera(dt: number, snap: boolean) {
    const head = this.headPos;
    const aspect = this.camera.aspect || 1;
    const narrow = aspect < 0.85;
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    let fov: number;
    if (this.compact) {
      pos = new THREE.Vector3(0, head.y, head.z + 0.75);
      look = new THREE.Vector3(0, head.y - 0.02, head.z);
      fov = 24;
    } else if (this.viewMode === "full") {
      const dist = 3.3 * (narrow ? Math.min(1.45, 0.9 / aspect) : 1);
      pos = new THREE.Vector3(0, 1.05, dist);
      look = new THREE.Vector3(0, 0.92, 0);
      fov = 32;
    } else {
      // Head and shoulders; on tall phone screens keep the face in the upper half.
      const dist = 1.15 * (narrow ? Math.min(1.35, 0.85 / aspect) : 1);
      pos = new THREE.Vector3(0, head.y - 0.02, head.z + dist);
      look = new THREE.Vector3(0, head.y - (narrow ? 0.2 : 0.14), head.z);
      fov = 30;
    }
    const k = snap ? 1 : 1 - Math.exp(-4.5 * dt);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }
  }

  private bindEvents(canvas: HTMLCanvasElement) {
    const el = this.container;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      this.pointer = {
        x: clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
        y: clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1),
      };
      if (this.dragging) {
        const dx = e.clientX - this.dragX;
        this.moved += Math.abs(dx);
        this.orbitTarget = clamp(this.orbitTarget + dx * 0.006, -Math.PI * 0.3, Math.PI * 0.3);
        this.dragX = e.clientX;
      }
    };
    const onDown = (e: PointerEvent) => {
      this.dragging = true;
      this.dragX = e.clientX;
      this.moved = 0;
    };
    const onUp = () => {
      this.dragging = false;
      this.orbitTarget = 0;
    };
    const onLeave = () => {
      this.pointer = null;
      this.dragging = false;
      this.orbitTarget = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    this.cleanup.push(() => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
    });

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(el);
    this.cleanup.push(() => ro.disconnect());

    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) this.visible = entry.isIntersecting;
      });
      io.observe(el);
      this.cleanup.push(() => io.disconnect());
    }

    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", onLost);
    this.cleanup.push(() => canvas.removeEventListener("webglcontextlost", onLost));
  }
}

/** Rotate `bone` (in world space) so the segment bone→child points along `dir`. */
function aimBone(bone: THREE.Bone, child: THREE.Object3D, dir: THREE.Vector3) {
  if (!bone.parent) return;
  const a = bone.getWorldPosition(new THREE.Vector3());
  const c = child.getWorldPosition(new THREE.Vector3());
  const cur = c.sub(a).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(cur, dir);
  const boneWorld = bone.getWorldQuaternion(new THREE.Quaternion());
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentWorld.invert().multiply(delta.multiply(boneWorld)));
  bone.updateMatrixWorld(true);
}

function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.65)");
  g.addColorStop(0.45, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
