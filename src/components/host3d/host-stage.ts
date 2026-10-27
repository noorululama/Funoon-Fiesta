import * as THREE from "three";
import { makeIslamicPatternTexture } from "./host-textures";
import { makeRng } from "./host-math";
import { disposeObject } from "./host-geometry";

/**
 * The little stage the host stands on: a dark pedestal with a green ring and
 * a gold eight-pointed star inlay, a faint Islamic geometric pattern behind,
 * and a few drifting gold sparkles. All in the fest's green/gold palette.
 */

export interface StageBuild {
  group: THREE.Group;
  update: (t: number, dt: number, speaking: boolean, listening: boolean, motion: number) => void;
  dispose: () => void;
}

function starShape(outer: number, inner: number, points = 8) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points;
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Cheap radial-gradient "contact shadow" for devices that skip the shadow map. */
function buildBlobShadow() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.55, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.0042, 0.02);
  return mesh;
}

export function buildStage(opts: { realShadows?: boolean } = {}): StageBuild {
  const realShadows = opts.realShadows ?? true;
  const group = new THREE.Group();
  group.name = "Stage";

  /* Pedestal */
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.94, 0.04, 72),
    new THREE.MeshStandardMaterial({ color: 0x1a211b, roughness: 0.3, metalness: 0.8 })
  );
  podium.position.y = -0.02;
  podium.receiveShadow = true;
  group.add(podium);

  /* Contact shadow: real when the shadow map is on, otherwise a soft blob. */
  if (realShadows) {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), new THREE.ShadowMaterial({ opacity: 0.34 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    shadow.receiveShadow = true;
    group.add(shadow);
  } else {
    group.add(buildBlobShadow());
  }

  /* Eight-pointed star inlay (Rub el Hizb): gold outline, dark fill */
  const starGroup = new THREE.Group();
  starGroup.rotation.x = -Math.PI / 2;
  starGroup.position.y = 0.0035;
  const R = 0.78;
  const inner = (r: number) => r * 0.7654; // concave-vertex radius of two overlapped squares
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xd6b35a, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x131a14, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  starGroup.add(new THREE.Mesh(new THREE.ShapeGeometry(starShape(R, inner(R))), goldMat));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(starShape(R - 0.034, inner(R - 0.034))), fillMat);
  fill.position.z = 0.0004;
  starGroup.add(fill);
  group.add(starGroup);

  /* Rings */
  const ring = (radius: number, width: number, color: number, opacity: number) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(radius - width, radius, 96),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.0045;
    return m;
  };
  const outerRing = ring(0.855, 0.012, 0x70b040, 0.7);
  const pulseRing = ring(0.62, 0.01, 0x8ccb55, 0.4);
  group.add(outerRing, pulseRing);

  /* Pattern backdrop (very quiet) */
  const patternTex = makeIslamicPatternTexture();
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.4),
    new THREE.MeshBasicMaterial({ map: patternTex, transparent: true, opacity: 0.24, depthWrite: false })
  );
  backdrop.position.set(0, 1.1, -1.25);
  backdrop.renderOrder = -1;
  group.add(backdrop);

  /* Sparkles */
  const rng = makeRng(99);
  const count = 26;
  const base = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 0.4 + rng() * 0.8;
    const a = rng() * Math.PI * 2;
    base[i * 3] = Math.cos(a) * r;
    base[i * 3 + 1] = 0.1 + rng() * 1.9;
    base[i * 3 + 2] = Math.sin(a) * r;
    speed[i] = 0.06 + rng() * 0.1;
    phase[i] = rng() * Math.PI * 2;
  }
  positions.set(base);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: 0xffd97d, size: 0.022, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true })
  );
  sparks.frustumCulled = false;
  group.add(sparks);

  const update = (t: number, dt: number, speaking: boolean, listening: boolean, motion: number) => {
    starGroup.rotation.z = motion * t * 0.06;
    outerRing.rotation.z = -t * 0.12 * motion;
    const pulse = speaking ? 1 + Math.sin(t * 9) * 0.07 : listening ? 1 + Math.sin(t * 4.5) * 0.045 : 1 + Math.sin(t * 1.5) * 0.02;
    pulseRing.scale.set(pulse, pulse, 1);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = speaking ? 0.7 + Math.sin(t * 11) * 0.2 : listening ? 0.65 : 0.32;

    if (motion > 0.5) {
      for (let i = 0; i < count; i++) {
        let y = base[i * 3 + 1] + ((t * speed[i]) % 2.1);
        if (y > 2.2) y -= 2.15;
        positions[i * 3] = base[i * 3] + Math.sin(t * 1.1 + phase[i]) * 0.04;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 1.1 + phase[i]) * 0.04;
      }
      (sparkGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
    void dt;
  };

  return { group, update, dispose: () => disposeObject(group) };
}
