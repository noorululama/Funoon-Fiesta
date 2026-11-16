"use client";

import { useId } from "react";

/**
 * Hero hourglass drawn in SVG so the water can move:
 * waves scroll, a stream falls through the neck, the top empties while the
 * bottom fills, then the whole glass flips 180° and the cycle repeats.
 * Everything inside the flipping group is point-symmetric, so the flip is seamless.
 * Keyframes live in globals.css (.hg-*).
 */

const GLASS =
  "M135 108H265C282 190 250 240 208 272L208 288C250 320 282 370 265 452H135C118 370 150 320 192 288L192 272C150 240 118 190 135 108Z";
const GLASS_TOP =
  "M135 108H265C282 190 250 240 208 272L208 280H192L192 272C150 240 118 190 135 108Z";
const GLASS_BOTTOM =
  "M192 280H208L208 288C250 320 282 370 265 452H135C118 370 150 320 192 288Z";

// One wave band: 8 segments × 50 = 400 wide, wavelength 100 so a -100 shift loops seamlessly.
function wave(y: number, amp: number) {
  return `M0 ${y} q25 -${amp} 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V720 H0Z`;
}

function WaterBody({ y }: { y: number }) {
  return (
    <>
      <g className="hg-wave-a">
        <path d={wave(y, 15)} fill="#1B4B91" />
      </g>
      <g className="hg-wave-b">
        <path d={wave(y + 7, 13)} fill="#3A86C8" />
      </g>
      <g className="hg-wave-c">
        <path d={wave(y + 15, 11)} fill="#45B5EE" />
      </g>
    </>
  );
}

function Leaf({ x, y, r, s = 1, dark = false }: { x: number; y: number; r: number; s?: number; dark?: boolean }) {
  return (
    <path
      d="M0 0C10 -15 30 -15 40 -2C30 11 10 13 0 0Z"
      fill={dark ? "#2A8A55" : "#72B945"}
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
    />
  );
}

export function AnimatedHourglass({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const idGlass = `hg-glass-${uid}`;
  const idTop = `hg-clip-top-${uid}`;
  const idBot = `hg-clip-bot-${uid}`;
  const idCap = `hg-cap-${uid}`;

  return (
    <svg
      viewBox="40 50 320 460"
      className={className}
      role="img"
      aria-label="Hourglass with water falling from the top bulb to the bottom"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={idGlass}>
          <path d={GLASS} />
        </clipPath>
        <clipPath id={idTop}>
          <path d={GLASS_TOP} />
        </clipPath>
        <clipPath id={idBot}>
          <path d={GLASS_BOTTOM} />
        </clipPath>
        {/* Top cap; the bottom one is this same shape rotated 180° */}
        <g id={idCap}>
          <rect x="84" y="78" width="232" height="34" rx="17" fill="#B05324" stroke="#5A2410" strokeWidth="4" />
          <rect x="97" y="84" width="206" height="13" rx="6.5" fill="#8C3E1B" />
          <path d="M112 90H196" stroke="#F2A765" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M96 106H150" stroke="#E0773A" strokeWidth="2" strokeLinecap="round" />
          <rect x="96" y="108" width="28" height="11" rx="5.5" fill="#C2622B" stroke="#5A2410" strokeWidth="3" />
          <rect x="276" y="108" width="28" height="11" rx="5.5" fill="#C2622B" stroke="#5A2410" strokeWidth="3" />
        </g>
      </defs>

      {/* Whole illustration leans slightly, like the original artwork */}
      <g transform="translate(200 280) rotate(-5) translate(-200 -280)">
        {/* Vine (static, stays upright while the glass flips) */}
        <g>
          <path
            d="M82 150C60 190 100 215 78 260C58 300 98 330 80 380C70 410 90 430 96 446"
            fill="none"
            stroke="#2A8A55"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Leaf x={80} y={170} r={-150} s={0.95} />
          <Leaf x={84} y={196} r={-30} s={0.8} dark />
          <Leaf x={80} y={258} r={-160} s={1} dark />
          <Leaf x={80} y={282} r={-20} s={0.9} />
          <Leaf x={80} y={350} r={-155} s={0.95} />
          <Leaf x={82} y={378} r={-25} s={0.85} dark />
        </g>

        {/* Flipping group: rotates 180° about the centre (200,280) */}
        <g transform="translate(200 280)">
          <g className="hg-flip">
            <g transform="translate(-200 -280)">
              {/* Glass interior */}
              <path d={GLASS} fill="#FAE39A" />

              {/* Falling stream (behind the water so it vanishes into the surface) */}
              <g clipPath={`url(#${idGlass})`}>
                <g className="hg-stream">
                  <line x1="200" y1="262" x2="200" y2="470" stroke="#45B5EE" strokeWidth="4.6" strokeLinecap="round" strokeDasharray="15 4" className="hg-flow" />
                  <line x1="199" y1="262" x2="199" y2="470" stroke="#D3F1FF" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="6 13" className="hg-flow" />
                  <ellipse cx="200" cy="278" rx="6.5" ry="9" fill="#45B5EE" />
                  <circle cx="196.5" cy="292" r="2.3" fill="#45B5EE" className="hg-drop" style={{ animationDelay: "0s" }} />
                  <circle cx="203.5" cy="292" r="2" fill="#7CCBF5" className="hg-drop" style={{ animationDelay: "0.3s" }} />
                  <circle cx="199" cy="292" r="1.8" fill="#45B5EE" className="hg-drop" style={{ animationDelay: "0.6s" }} />
                </g>
              </g>

              {/* Water: top bulb drains, bottom bulb fills */}
              <g className="hg-water">
                <g clipPath={`url(#${idTop})`}>
                  <g className="hg-top">
                    <WaterBody y={150} />
                  </g>
                </g>
                <g clipPath={`url(#${idBot})`}>
                  <g className="hg-bottom">
                    <WaterBody y={359} />
                    {/* splash ring where the stream lands */}
                    <g transform="translate(200 364)">
                      <ellipse className="hg-ring" cx="0" cy="0" rx="16" ry="4" fill="none" stroke="#DDF4FF" strokeWidth="2" />
                    </g>
                  </g>
                </g>
              </g>

              {/* Glass outline + glints (point-symmetric) */}
              <path d={GLASS} fill="none" stroke="#3A8DD0" strokeWidth="4" strokeLinejoin="round" />
              <g fill="#fff" opacity="0.55">
                <ellipse cx="146" cy="160" rx="5" ry="26" transform="rotate(8 146 160)" />
                <ellipse cx="254" cy="160" rx="5" ry="26" transform="rotate(-8 254 160)" />
                <ellipse cx="146" cy="400" rx="5" ry="26" transform="rotate(-8 146 400)" />
                <ellipse cx="254" cy="400" rx="5" ry="26" transform="rotate(8 254 400)" />
              </g>

              {/* Pillars */}
              <g stroke="#5A2410" strokeWidth="3.5">
                <rect x="100" y="112" width="16" height="336" rx="7" fill="#B05324" />
                <rect x="284" y="112" width="16" height="336" rx="7" fill="#B05324" />
              </g>
              <path d="M105 130V430" stroke="#F2A765" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M295 130V430" stroke="#F2A765" strokeWidth="2.4" strokeLinecap="round" />

              {/* Caps */}
              <use href={`#${idCap}`} />
              <use href={`#${idCap}`} transform="rotate(180 200 280)" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
