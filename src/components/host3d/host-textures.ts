import * as THREE from "three";
import { makeRng } from "./host-math";

/**
 * Procedural canvas textures. They are created lazily inside the browser
 * (never at import time) so the module is safe to import during SSR.
 */

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

function finish(
  canvas: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: [number, number] } = {}
) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.anisotropy = 4;
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Tileable plain-weave cotton bump map (grey-scale). */
export function makeClothBumpTexture(repeat: [number, number] = [10, 10]) {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const rng = makeRng(11);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  const cell = 4;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const over = ((x / cell + y / cell) & 1) === 0;
      const base = over ? 150 : 108;
      const jitter = (rng() - 0.5) * 22;
      const v = Math.max(0, Math.min(255, base + jitter));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      if (over) ctx.fillRect(x, y + 0.5, cell, cell - 1);
      else ctx.fillRect(x + 0.5, y, cell - 1, cell);
    }
  }
  return finish(canvas, { repeat });
}

/** Soft vertical hair-strand map used for both colour variation and bump. */
export function makeHairTexture(repeat: [number, number] = [5, 4]) {
  const w = 256;
  const h = 256;
  const { canvas, ctx } = makeCanvas(w, h);
  const rng = makeRng(23);
  ctx.fillStyle = "#b4b4b4";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) {
    const x = rng() * w;
    const len = 30 + rng() * 120;
    const y = rng() * h;
    const light = 110 + rng() * 145;
    ctx.strokeStyle = `rgba(${light},${light},${light},${0.25 + rng() * 0.45})`;
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, y + len * 0.5, x + (rng() - 0.5) * 9, y + len);
    ctx.stroke();
    // wrap vertically so the texture tiles
    if (y + len > h) {
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, y - h + len * 0.5, x + (rng() - 0.5) * 9, y - h + len);
      ctx.stroke();
    }
  }
  return finish(canvas, { repeat, srgb: true });
}

/**
 * Eight-pointed star ("khatam") lattice, the classic motif of Islamic
 * geometric ornament. Drawn as thin luminous lines on a transparent field so
 * it can sit very quietly behind the character.
 */
export function makeIslamicPatternTexture(color = "#70B040", accent = "#D6B35A") {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);
  const cells = 4;
  const s = size / cells;

  const square = (cx: number, cy: number, r: number, rot: number) => {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };

  const star = (cx: number, cy: number, r: number) => {
    square(cx, cy, r, Math.PI / 4);
    square(cx, cy, r, 0);
    // small inner octagon
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const px = cx + Math.cos(a) * r * 0.54;
      const py = cy + Math.sin(a) * r * 0.54;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };

  ctx.lineJoin = "round";
  for (let gy = -1; gy <= cells; gy++) {
    for (let gx = -1; gx <= cells; gx++) {
      const cx = gx * s + s / 2;
      const cy = gy * s + s / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      star(cx, cy, s * 0.46);
      // connecting lozenge between neighbouring stars
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.1;
      square(cx + s / 2, cy + s / 2, s * 0.17, Math.PI / 4);
    }
  }
  const tex = finish(canvas, { srgb: true, repeat: [3, 3] });
  return tex;
}
