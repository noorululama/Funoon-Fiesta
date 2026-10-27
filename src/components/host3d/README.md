# host3d – procedural 3D host (no model files)

A Muslim man in a white thobe and imamah, built entirely in code with Three.js.
`ai-3d-human.tsx` is a thin React wrapper; everything else lives here.

| File | Responsibility |
|---|---|
| `host-scene.ts` | Renderer, lights, camera, input, render loop (framework-agnostic `HostScene`) |
| `host-character.ts` | Assembles head + face + imamah + body into one rig |
| `host-head.ts` | Sculpted head, morph targets (jaw/smile), beard shell, ears |
| `host-face.ts` | Eyes + eyelids, eyebrows, parametric mouth (lips/teeth/tongue) |
| `host-turban.ts` | Taqiyah cap, wound wraps, crown, hanging tail |
| `host-body.ts` | Thobe, collar, placket, sleeves/cuffs, hands, neck, shoes |
| `host-animator.ts` | Blink, gaze, breathing, visemes, two-bone arm IK, poses, salaam greeting |
| `host-stage.ts` | Pedestal with gold eight-pointed star, pattern backdrop, sparkles |
| `host-textures.ts` | Canvas-generated cloth / hair / geometric-pattern textures |
| `host-geometry.ts`, `host-math.ts` | Loft + tube builders, noise and easing helpers |

## Common tweaks
- **Skin / hair colour:** `SKIN_COLOR`, `HAIR_COLOR` in `host-head.ts`.
- **Camera framing:** `CAMERAS` in `host-scene.ts`.
- **Gestures:** `POSES` in `host-animator.ts` (wrist position, finger direction, palm direction).
- **Greeting length:** `GREET_DURATION` in `host-animator.ts`.
- **Performance:** budget phones (≤4 cores or ≤4 GB RAM) automatically skip the shadow map and use a lower
  pixel ratio. Force it with `new HostScene({ lowPower: true, … })`.

## Notes
- Hidden instances (CSS `hidden`) never build a scene; the wrapper waits until its container has a size.
- Each scene gets a fresh `<canvas>` so dev hot-reload / Strict Mode cannot reuse a lost WebGL context.
- All animation deltas are clamped to 0–50 ms; a negative or NaN delta once corrupted the mouth geometry.
