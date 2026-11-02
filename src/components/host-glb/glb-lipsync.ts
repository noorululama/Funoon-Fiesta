import type { MorphRig, Viseme } from "./glb-morphs";

/**
 * Procedural lip-sync. The browser's speech synthesis gives us no audio stream
 * to analyse, so while the host is speaking we generate a natural syllable
 * rhythm (≈5–7 per second, with short pauses between phrases) and pick a mouth
 * shape per syllable. Uses Oculus visemes when present, otherwise ARKit mouth
 * shapes, otherwise a jaw bone.
 */

const SYLLABLES: { v: Viseme; w: number }[] = [
  { v: "aa", w: 5 },
  { v: "e", w: 3 },
  { v: "i", w: 2 },
  { v: "o", w: 3 },
  { v: "u", w: 1.5 },
  { v: "pp", w: 1.5 },
  { v: "ff", w: 1 },
  { v: "dd", w: 1.5 },
  { v: "kk", w: 1 },
  { v: "nn", w: 1.2 },
  { v: "ss", w: 1 },
  { v: "rr", w: 0.8 },
];
const TOTAL = SYLLABLES.reduce((s, x) => s + x.w, 0);

function pickSyllable(prev: Viseme): Viseme {
  for (let tries = 0; tries < 3; tries++) {
    let r = Math.random() * TOTAL;
    for (const s of SYLLABLES) {
      r -= s.w;
      if (r <= 0) {
        if (s.v !== prev) return s.v;
        break;
      }
    }
  }
  return "aa";
}

/** How each viseme maps onto ARKit-style controls when the file has no visemes. */
const ARKIT_SHAPES: Record<Viseme, Partial<Record<"jawOpen" | "funnel" | "pucker" | "stretch" | "close" | "rollLower" | "smile", number>>> = {
  sil: {},
  aa: { jawOpen: 0.55 },
  e: { jawOpen: 0.3, stretch: 0.45 },
  i: { jawOpen: 0.18, stretch: 0.3, smile: 0.25 },
  o: { jawOpen: 0.38, funnel: 0.6 },
  u: { jawOpen: 0.12, pucker: 0.75 },
  pp: { close: 0.7 },
  ff: { jawOpen: 0.08, rollLower: 0.5 },
  th: { jawOpen: 0.18 },
  dd: { jawOpen: 0.22, stretch: 0.15 },
  kk: { jawOpen: 0.28 },
  ch: { jawOpen: 0.15, funnel: 0.3 },
  ss: { jawOpen: 0.08, stretch: 0.35 },
  nn: { jawOpen: 0.15 },
  rr: { jawOpen: 0.2, funnel: 0.25 },
};

export class LipSync {
  private active = false;
  private mode: "visemes" | "arkit" | "jaw" | "none" = "none";
  private phase = 0;
  private rate = 6;
  private viseme: Viseme = "sil";
  private next: Viseme = "aa";
  private pause = 0;
  private untilPause = 1.5;
  private env = 0;
  private gain = 0.85;

  /** Current mouth openness 0–1, also used for head emphasis. */
  amplitude = 0;

  configure(morphs: MorphRig, hasJawBone: boolean) {
    if (morphs.hasVisemes) this.mode = "visemes";
    else if (morphs.has("jawOpen")) this.mode = "arkit";
    else if (hasJawBone) this.mode = "jaw";
    else this.mode = "none";
  }

  setActive(on: boolean) {
    this.active = on;
    if (on) {
      this.phase = 0;
      this.pause = 0;
      this.untilPause = 1.2 + Math.random() * 1.8;
    }
  }

  update(dt: number, morphs: MorphRig, rotateJaw?: (angle: number) => void) {
    // Syllable clock
    if (this.active) {
      if (this.pause > 0) {
        this.pause -= dt;
      } else {
        this.phase += dt * this.rate;
        this.untilPause -= dt;
        if (this.phase >= 1) {
          this.phase -= 1;
          this.viseme = this.next;
          this.next = pickSyllable(this.viseme);
          this.rate = 5 + Math.random() * 2.4;
          this.gain = 0.65 + Math.random() * 0.35; // stressed vs. unstressed syllable
          if (this.untilPause <= 0) {
            this.pause = 0.12 + Math.random() * 0.25;
            this.untilPause = 1.1 + Math.random() * 2.2;
            this.viseme = "sil";
          }
        }
      }
    }
    const open = this.active && this.pause <= 0 && this.viseme !== "sil" ? Math.pow(Math.sin(this.phase * Math.PI), 0.8) : 0;
    this.env += ((this.active ? 1 : 0) - this.env) * (1 - Math.exp(-10 * dt));
    const strength = open * this.env * this.gain;
    this.amplitude = strength;

    switch (this.mode) {
      case "visemes":
        morphs.addViseme(this.viseme, strength * 0.95);
        // Small blend toward the upcoming shape keeps transitions fluid.
        morphs.addViseme(this.next, strength * 0.15);
        break;
      case "arkit": {
        const shapes = ARKIT_SHAPES[this.viseme];
        for (const [control, w] of Object.entries(shapes)) morphs.add(control, (w ?? 0) * strength * 1.15);
        break;
      }
      case "jaw":
        rotateJaw?.(strength * 0.22);
        break;
      default:
        break;
    }
  }
}
