import type * as THREE from "three";

/** Humanoid bones the host animates. Any of them may be missing. */
export interface HostBones {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  head?: THREE.Bone;
  jaw?: THREE.Bone;
  leftEye?: THREE.Bone;
  rightEye?: THREE.Bone;
  leftArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
  rightArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
}

/**
 * Accepted names per role, already normalised (lower-case, letters/digits
 * only, common prefixes like "mixamorig" removed). Covers Mixamo, Ready Player
 * Me, Avaturn, Character Creator (CC_Base_), VRoid (J_Bip_), Blender Rigify
 * (DEF-) and Unreal-style (upperarm_l) rigs.
 */
const ROLES: Record<keyof HostBones, string[]> = {
  hips: ["hips", "pelvis", "jbipchips", "hip"],
  spine: ["spine", "spine01", "jbipcspine", "waist"],
  chest: ["spine2", "spine02", "spine1", "chest", "upperchest", "jbipcupperchest", "jbipcchest", "spine03"],
  neck: ["neck", "neck01", "neck1", "jbipcneck", "necktwist01"],
  head: ["head", "jbipchead"],
  jaw: ["jaw", "jawroot", "lowerjaw", "mandible", "jbipcjaw"],
  leftEye: ["lefteye", "eyel", "leye", "jadjlfaceeye", "eyeleft"],
  rightEye: ["righteye", "eyer", "reye", "jadjrfaceeye", "eyeright"],
  leftArm: ["leftarm", "leftupperarm", "upperarml", "lupperarm", "jbiplupperarm", "arml", "upperarmleft"],
  leftForeArm: ["leftforearm", "leftlowerarm", "lowerarml", "forearml", "lforearm", "jbipllowerarm", "forearmleft"],
  leftHand: ["lefthand", "handl", "lhand", "jbiplhand", "handleft"],
  rightArm: ["rightarm", "rightupperarm", "upperarmr", "rupperarm", "jbipruperarm", "jbiprupperarm", "armr", "upperarmright"],
  rightForeArm: ["rightforearm", "rightlowerarm", "lowerarmr", "forearmr", "rforearm", "jbiprlowerarm", "forearmright"],
  rightHand: ["righthand", "handr", "rhand", "jbiprhand", "handright"],
};

/** Rig prefixes, stripped only when followed by a separator ("DEF-spine", "CC_Base_Head", "Armature|Neck"). */
const PREFIX_RE = /^(?:armature|cc_base|def|org|rig|bip0*1|skeleton)[\s:_\-.|]+/i;

function normalise(name: string) {
  let n = name.trim();
  // Mixamo: "mixamorig:LeftArm", "mixamorig1:LeftArm", sometimes without the colon.
  n = n.replace(/^mixamorig\d*[:_]?/i, "");
  for (let i = 0; i < 3 && PREFIX_RE.test(n); i++) n = n.replace(PREFIX_RE, "");
  n = n.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Blender duplicates: "Head.001" → "head" (but keep "spine01", "neck01").
  if (!/^(spine|neck)/.test(n)) n = n.replace(/0{1,2}[1-9]$/, "");
  return n;
}

export function findBones(root: THREE.Object3D): HostBones {
  const byName = new Map<string, THREE.Bone>();
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const key = normalise(obj.name);
      if (!byName.has(key)) byName.set(key, obj as THREE.Bone);
    }
  });
  const out: HostBones = {};
  for (const role of Object.keys(ROLES) as (keyof HostBones)[]) {
    for (const candidate of ROLES[role]) {
      const bone = byName.get(candidate);
      if (bone) {
        out[role] = bone;
        break;
      }
    }
  }
  // "spine1" is the chest on Mixamo-style rigs that have no spine2.
  if (out.chest === out.spine) out.chest = undefined;
  return out;
}
