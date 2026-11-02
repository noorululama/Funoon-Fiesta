import type * as THREE from "three";

/**
 * Facial blendshape driver. Finds morph targets by name on every mesh of the
 * model (head, teeth, eyelashes… often each carry the same shape keys) and maps
 * a small set of semantic controls onto whatever naming the file uses:
 * ARKit (Avaturn / Ready Player Me / Character Creator), Oculus visemes, VRM.
 */

type Slot = { influences: number[]; index: number };

/** Semantic control → candidate shape names (normalised: lower-case, no separators). */
const ALIASES: Record<string, string[][]> = {
  // Each inner array is applied together (e.g. left + right).
  blink: [["eyeblinkleft", "eyeblinkright"], ["eyesclosed"], ["blink"], ["fclalleyeclose"], ["eyeblink"]],
  smile: [["mouthsmileleft", "mouthsmileright"], ["mouthsmile"], ["smile"], ["fclmouthjoy"], ["happy"]],
  browUp: [["browinnerup", "browouterupleft", "browouterupright"], ["browsup"], ["fclbrwsurprised"]],
  browDown: [["browdownleft", "browdownright"], ["browsdown"], ["fclbrwangry"]],
  squint: [["eyesquintleft", "eyesquintright", "cheeksquintleft", "cheeksquintright"]],
  lookUp: [["eyelookupleft", "eyelookupright"]],
  // mouth shapes used by the lip-sync
  jawOpen: [["jawopen"], ["mouthopen"], ["fclmtha"], ["visemeaa"], ["aa"]],
  funnel: [["mouthfunnel"], ["visemeo"], ["fclmtho"], ["oh"]],
  pucker: [["mouthpucker"], ["visemeu"], ["fclmthu"], ["ou"]],
  stretch: [["mouthstretchleft", "mouthstretchright"], ["visemee"], ["fclmthe"], ["ee"]],
  close: [["mouthclose"], ["mouthpressleft", "mouthpressright"], ["visemepp"]],
  rollLower: [["mouthrolllower"], ["mouthlowerdownleft", "mouthlowerdownright"], ["visemeff"]],
};

const VISEMES = ["sil", "pp", "ff", "th", "dd", "kk", "ch", "ss", "nn", "rr", "aa", "e", "i", "o", "u"] as const;
export type Viseme = (typeof VISEMES)[number];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export class MorphRig {
  private byName = new Map<string, Slot[]>();
  private controls = new Map<string, Slot[][]>();
  private visemeSlots = new Map<Viseme, Slot[]>();
  private target = new Map<Slot[], number>();
  private current = new Map<Slot[], number>();
  private frame = new Map<Slot[], number>();

  constructor(root: THREE.Object3D) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
        const key = norm(name);
        const list = this.byName.get(key) ?? [];
        list.push({ influences: mesh.morphTargetInfluences, index });
        this.byName.set(key, list);
      }
    });
    for (const [control, options] of Object.entries(ALIASES)) {
      for (const group of options) {
        const found = group.map((n) => this.byName.get(n)).filter((s): s is Slot[] => !!s);
        if (found.length) {
          this.controls.set(control, found);
          break;
        }
      }
    }
    for (const v of VISEMES) {
      const slots = this.byName.get(`viseme${v}`);
      if (slots) this.visemeSlots.set(v, slots);
    }
  }

  get hasShapes() {
    return this.byName.size > 0;
  }

  /** True when the file ships Oculus / Ready Player Me style visemes. */
  get hasVisemes() {
    return this.visemeSlots.has("aa") && this.visemeSlots.has("o");
  }

  has(control: string) {
    return this.controls.has(control);
  }

  beginFrame() {
    this.frame.clear();
  }

  /** Accumulate a semantic control for this frame (values are summed and clamped). */
  add(control: string, value: number) {
    if (value <= 0) return;
    const groups = this.controls.get(control);
    if (!groups) return;
    for (const slots of groups) this.frame.set(slots, (this.frame.get(slots) ?? 0) + value);
  }

  addViseme(v: Viseme, value: number) {
    if (value <= 0) return;
    const slots = this.visemeSlots.get(v);
    if (slots) this.frame.set(slots, (this.frame.get(slots) ?? 0) + value);
  }

  /** Smoothly move every touched shape toward this frame's value. */
  endFrame(dt: number) {
    for (const slots of this.current.keys()) if (!this.frame.has(slots)) this.target.set(slots, 0);
    for (const [slots, v] of this.frame) this.target.set(slots, Math.min(1, v));
    const k = 1 - Math.exp(-22 * dt);
    for (const [slots, goal] of this.target) {
      const cur = this.current.get(slots) ?? 0;
      const next = dt === 0 ? goal : cur + (goal - cur) * k;
      this.current.set(slots, next);
      for (const s of slots) s.influences[s.index] = next;
    }
  }
}
