# host-glb – realistic 3D host from a .glb file

`ai-3d-human.tsx` checks for `public/models/host.glb` (or `NEXT_PUBLIC_HOST_MODEL_URL`).
If it exists, this realistic host is used; otherwise the code-built host in `../host3d/` is shown.
If the file fails to load, it also falls back to the code-built host.

## Adding your host

1. Make a realistic avatar and export it as **GLB**, for example:
   - **Avaturn** (free, from a selfie or presets): export *GLB* with the *ARKit blendshapes* option on.
   - **Character Creator / Mixamo / VRoid / Blender** also work, as long as the model has a humanoid skeleton.
2. Compress it (13 MB → about 2 MB, same look):
   ```bash
   npx @gltf-transform/cli optimize my-avatar.glb public/models/host.glb --compress meshopt --texture-compress webp --texture-size 1024
   ```
3. Reload `/chatbot`. That's it.

## What it does automatically

| Feature | Uses |
|---|---|
| Lip-sync while speaking | Oculus visemes (`viseme_aa`…) → ARKit mouth shapes (`jawOpen`…) → jaw bone |
| Blinking, smiles, brow raise when listening, thinking look | ARKit shapes (`eyeBlinkLeft`, `mouthSmileLeft`, `browInnerUp`…) |
| Head and eyes follow the pointer, nods, breathing | Bones: Spine/Spine2/Neck/Head/LeftEye/RightEye |
| Arms lowered out of T-pose | LeftArm/LeftForeArm/RightArm/RightForeArm |
| Body animation | If the GLB contains clips named `idle`, `talk` and `wave`/`greet`, they are played |
| Scale and framing | Any model is scaled to 1.75 m and turned to face the camera |

## Speed
- three.js and the model only load after the page is interactive and the stage is on screen.
- Budget phones (≤4 cores or ≤4 GB RAM) render at a lower resolution and ~30 fps.
- Rendering pauses when the tab is hidden or the stage is scrolled away.
