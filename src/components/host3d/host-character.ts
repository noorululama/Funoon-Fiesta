import * as THREE from "three";
import { buildHead, MORPH_JAW, MORPH_SMILE } from "./host-head";
import type { HeadBuild } from "./host-head";
import { buildFace } from "./host-face";
import type { FaceRig } from "./host-face";
import { buildTurban } from "./host-turban";
import type { TurbanBuild } from "./host-turban";
import { buildBody } from "./host-body";
import type { BodyBuild } from "./host-body";
import { disposeObject } from "./host-geometry";

/**
 * The complete procedural host: a Muslim man in a white thobe and imamah.
 * Returns a scene-graph root plus handles to every joint the animator needs.
 */

export interface HostCharacter {
  root: THREE.Group;
  head: HeadBuild;
  face: FaceRig;
  turban: TurbanBuild;
  body: BodyBuild;
  /** Head pivot (rotates for yaw/pitch/roll). */
  headPivot: THREE.Group;
  setJaw: (v: number) => void;
  setSmile: (v: number) => void;
  dispose: () => void;
}

export interface HostCharacterOptions {
  /** "head" omits legs/arms/hands for tight crops like the 90px avatar. */
  detail?: "full" | "head";
  quality?: "high" | "low";
}

export function createHostCharacter(opts: HostCharacterOptions = {}): HostCharacter {
  const detail = opts.detail ?? "full";
  const quality = opts.quality ?? "high";

  const root = new THREE.Group();
  root.name = "IslamicHost";

  const body = buildBody({ detail, quality });
  root.add(body.root);

  const headPivot = new THREE.Group();
  headPivot.name = "HeadPivot";
  body.headMount.add(headPivot);

  const head = buildHead(quality);
  headPivot.add(head.group);
  const face = buildFace(head.surfaceZ, quality);
  head.group.add(face.group);
  const turban = buildTurban(quality);
  head.group.add(turban.group);
  // Slightly enlarged head: friendlier, more legible at small sizes.
  head.group.scale.setScalar(1.1);

  const setMorph = (index: number, v: number) => {
    for (const m of head.morphMeshes) {
      if (m.morphTargetInfluences) m.morphTargetInfluences[index] = v;
    }
  };

  return {
    root,
    head,
    face,
    turban,
    body,
    headPivot,
    setJaw: (v) => setMorph(MORPH_JAW, v),
    setSmile: (v) => setMorph(MORPH_SMILE, v),
    dispose: () => disposeObject(root),
  };
}
