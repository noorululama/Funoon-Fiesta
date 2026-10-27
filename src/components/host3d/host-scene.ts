import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createHostCharacter } from "./host-character";
import type { HostCharacter } from "./host-character";
import { HostAnimator } from "./host-animator";
import type { HostState } from "./host-animator";
import { buildStage } from "./host-stage";
import type { StageBuild } from "./host-stage";
import { clamp, lerp } from "./host-math";

/**
 * Framework-agnostic controller: owns the renderer, camera, lights, stage,
 * character and animator. The React component is a thin wrapper around this.
 */

export type HostViewMode = "portrait" | "full";

export interface HostSceneOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  compact?: boolean;
  viewMode?: HostViewMode;
  /** Start the render loop immediately (default true). Tests step manually. */
  autoStart?: boolean;
  reducedMotion?: boolean;
  /** Force the cheaper render path (no shadow map, lower pixel ratio). Auto-detected by default. */
  lowPower?: boolean;
}

/** Heuristic for budget phones: few cores or little RAM. */
function detectLowPower(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  return cores <= 4 || mem <= 4;
}

export interface HostSceneInputs {
  state: HostState;
  speaking: boolean;
  listening: boolean;
}

interface CameraRig {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

const CAMERAS: Record<"compact" | HostViewMode, CameraRig> = {
  compact: { pos: new THREE.Vector3(0, 1.645, 0.86), look: new THREE.Vector3(0, 1.64, 0), fov: 24 },
  portrait: { pos: new THREE.Vector3(0, 1.62, 1.08), look: new THREE.Vector3(0, 1.57, 0), fov: 34 },
  full: { pos: new THREE.Vector3(0, 1.0, 2.7), look: new THREE.Vector3(0, 0.93, 0), fov: 36 },
};

export class HostScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly host: HostCharacter;
  readonly animator: HostAnimator;
  private stage: StageBuild | null = null;

  private container: HTMLElement;
  private compact: boolean;
  private viewMode: HostViewMode;
  private reducedMotion: boolean;
  private lowPower: boolean;
  private inputs: HostSceneInputs = { state: "idle", speaking: false, listening: false };

  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget;
  private keyLight: THREE.DirectionalLight;

  private raf = 0;
  private running = false;
  private disposed = false;
  private visible = true;
  private lastTick = 0;
  private time = 0;
  private firstFrame = true;

  private pointer: { x: number; y: number } | null = null;
  private dragging = false;
  private dragX = 0;
  private orbit = 0;
  private orbitTarget = 0;
  private moved = 0;

  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camTargetPos = new THREE.Vector3();
  private camTargetLook = new THREE.Vector3();
  private cleanup: (() => void)[] = [];

  onReady?: () => void;

  constructor(opts: HostSceneOptions) {
    const { canvas, container } = opts;
    this.container = container;
    this.compact = !!opts.compact;
    this.viewMode = opts.viewMode ?? "portrait";
    this.lowPower = opts.lowPower ?? detectLowPower();
    const shadows = !this.compact && !this.lowPower;
    this.reducedMotion =
      opts.reducedMotion ??
      (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

    /* Renderer */
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    this.renderer.setPixelRatio(Math.min(dpr, this.compact ? 2 : this.lowPower ? 1.25 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    /* Soft image-based light so cloth and skin feel dimensional */
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.55;

    /* Lights: warm key, cool fill, gold rim, green fest accent */
    this.scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));
    this.keyLight = new THREE.DirectionalLight(0xfffaef, 2.3);
    this.keyLight.position.set(1.5, 2.9, 2.4);
    this.keyLight.castShadow = shadows;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 8;
    this.keyLight.shadow.camera.left = -1.4;
    this.keyLight.shadow.camera.right = 1.4;
    this.keyLight.shadow.camera.top = 2.2;
    this.keyLight.shadow.camera.bottom = -0.3;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.01;
    this.scene.add(this.keyLight);
    const fill = new THREE.DirectionalLight(0xdce7fa, 0.9);
    fill.position.set(-2, 1.8, 1.8);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd580, 2.2);
    rim.position.set(1.2, 2.2, -2);
    this.scene.add(rim);
    const green = new THREE.PointLight(0x70b040, 1.3, 5);
    green.position.set(-1.3, 1.6, -1.2);
    this.scene.add(green);

    /* Character + stage */
    this.host = createHostCharacter({
      detail: this.compact ? "head" : "full",
      quality: this.compact ? "low" : "high",
    });
    this.scene.add(this.host.root);
    this.animator = new HostAnimator(this.host);
    if (!this.compact) {
      this.stage = buildStage({ realShadows: shadows });
      this.scene.add(this.stage.group);
    }

    /* Camera */
    const rig = this.currentCameraRig();
    this.camera = new THREE.PerspectiveCamera(rig.fov, 1, 0.05, 40);
    this.camPos.copy(rig.pos);
    this.camLook.copy(rig.look);
    this.camera.position.copy(rig.pos);
    this.camera.lookAt(rig.look);
    this.resize();

    this.bindEvents(canvas);

    if (opts.autoStart !== false) this.start();
  }

  /* ── public API ─────────────────────────────────────────────────── */

  setInputs(next: Partial<HostSceneInputs>) {
    this.inputs = { ...this.inputs, ...next };
  }

  setViewMode(mode: HostViewMode) {
    this.viewMode = mode;
  }

  /** Salaam gesture (hand on heart + bow). */
  greet() {
    this.animator.greet();
  }

  nod() {
    this.animator.nod();
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTick = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      // One clock only: mixing the rAF timestamp with performance.now() can
      // yield a hugely negative first delta, which poisons the animation maths.
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

  /** Advance the simulation and draw one frame (used by the loop and tests). */
  frame(dt: number) {
    if (this.disposed) return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    // Skip all work when hidden: the chat page mounts several instances.
    if (!this.visible || w === 0 || h === 0 || (typeof document !== "undefined" && document.hidden)) return;
    this.step(dt);
    this.draw();
    if (this.firstFrame) {
      this.firstFrame = false;
      this.onReady?.();
    }
  }

  step(dt: number) {
    this.time += dt;
    const { state, speaking, listening } = this.inputs;
    const motion = this.reducedMotion ? 0.35 : 1;

    this.orbit = lerp(this.orbit, this.orbitTarget, 1 - Math.exp(-9 * dt));
    this.host.root.rotation.y = this.orbit;

    this.animator.update(dt, this.time, {
      state,
      speaking,
      listening,
      pointer: this.pointer,
      reducedMotion: this.reducedMotion,
    });
    this.stage?.update(this.time, dt, speaking || state === "speaking", listening || state === "listening", this.reducedMotion ? 0 : 1);
    void motion;

    /* Camera easing toward the active framing */
    const rig = this.currentCameraRig();
    const aspect = this.camera.aspect;
    const comp = aspect < 1 ? Math.min(1.3, 1 / aspect) : 1;
    this.camTargetPos.copy(rig.pos);
    if (!this.compact) this.camTargetPos.z = rig.pos.z * comp;
    this.camTargetLook.copy(rig.look);
    const k = 1 - Math.exp(-4.5 * dt);
    this.camPos.lerp(this.camTargetPos, k);
    this.camLook.lerp(this.camTargetLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - rig.fov) > 0.05) {
      this.camera.fov = lerp(this.camera.fov, rig.fov, k);
      this.camera.updateProjectionMatrix();
    }
  }

  draw() {
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
    this.host.dispose();
    this.stage?.dispose();
    this.envTarget.dispose();
    this.pmrem.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /* ── internals ──────────────────────────────────────────────────── */

  private currentCameraRig(): CameraRig {
    return CAMERAS[this.compact ? "compact" : this.viewMode];
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

    // Pause when scrolled out of view.
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

  /** True when the last pointer interaction was a drag, not a tap. */
  get wasDrag() {
    return this.moved > 6;
  }
}
