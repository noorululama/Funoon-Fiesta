"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/* ──────────────────────────── settings ──────────────────────────── */
const FIRST_DELAY_MS = 2_000; // first walk 2s after the site opens
const GAP_MS = 20_000; // pause between walks (after one finishes)
const WAVE_MS = 2_800; // how long it stands and waves
const TURN_MS = 170; // turn-to-face speed
const STEP_S = 0.8; // one full walk cycle (2 steps)
const BASE_SPEED = 82; // px/s, matched to the stride so feet don't slide
const BASE_W = 130; // robot size on desktop (px)
const BASE_H = 158;

const HELLO = ["Hi there! 👋", "Salaam! 👋", "Hello, friend! 👋", "Hey! Need help? 👋"];
const WALK_LINES = ["Ask me anything!", "Tap me to chat 🤖", "Looking for results?", "Beep boop… 🎶"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Pose = "side" | "front";
type Phase = "idle" | "in" | "wave" | "out";

/* ──────────────────────────── artwork ──────────────────────────── */
function Leg({ fill, stroke, accent, cls }: { fill: string; stroke: string; accent: string; cls: string }) {
  return (
    <g className={`ff-thigh ${cls}`}>
      <rect x={-8} y={-2} width={16} height={28} rx={8} fill={fill} stroke={stroke} />
      <g transform="translate(0 25)">
        <g className={`ff-shin ${cls}`}>
          <rect x={-7.5} y={0} width={15} height={22} rx={7.5} fill={fill} stroke={stroke} />
          <circle r={8} fill={fill} stroke={stroke} />
          <g transform="translate(0 22)">
            <g className={`ff-foot ${cls}`}>
              <rect x={-11} y={-2} width={30} height={12} rx={6} fill="#ffffff" stroke={stroke} />
              <rect x={-8} y={7.2} width={24} height={2.8} rx={1.3} fill={accent} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

function SideBot() {
  return (
    <svg viewBox="0 0 140 170" className="ff-svg" aria-hidden="true">
      <ellipse className="ff-shadow" cx="70" cy="163" rx="32" ry="5" fill="rgba(0,0,0,.16)" />
      <g className="ff-bob">
        {/* far side (behind) */}
        <g transform="translate(64 104)">
          <Leg fill="#e6e6e1" stroke="#d2d2cc" accent="#5a9132" cls="far" />
        </g>
        <g transform="translate(58 100)">
          <g className="ff-arm far">
            <rect x={-4} y={0} width={8} height={20} rx={4} fill="#e6e6e1" />
            <circle cy={21} r={4.6} fill="#e6e6e1" />
          </g>
        </g>

        {/* hip */}
        <rect x="48" y="93" width="38" height="17" rx="8.5" fill="#f3f3ef" stroke="#dcdcd6" />

        {/* head */}
        <g className="ff-head">
          <line x1="62" y1="14" x2="56" y2="3" stroke="#cfcfc9" strokeWidth="3" strokeLinecap="round" />
          <circle cx="55" cy="3" r="4.5" fill="#f0b020" className="ff-antenna" />
          <rect x="22" y="12" width="90" height="84" rx="28" fill="#ffffff" stroke="#e1e1dc" strokeWidth="2" />
          <path d="M34 30 q8 -12 26 -13" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".9" />
          {/* ear */}
          <circle cx="44" cy="54" r="11" fill="#f0b020" />
          <circle cx="44" cy="54" r="5" fill="#ffd767" />
          {/* face screen on the front side */}
          <rect x="64" y="24" width="44" height="60" rx="15" fill="#111418" />
          <g className="ff-glow">
            <rect x="69" y="41" width="8" height="17" rx="4" fill="#5fb845" opacity=".75" className="ff-eye" />
            <rect x="84" y="39" width="15" height="19" rx="5.5" fill="#7ee05a" className="ff-eye" />
            <path d="M84 70 q7 5 14 -1" stroke="#7ee05a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </g>
          <circle cx="102" cy="67" r="3" fill="#f0b020" opacity=".75" />
        </g>

        {/* near side (front) */}
        <g transform="translate(72 104)">
          <Leg fill="#fbfbf9" stroke="#d6d6d0" accent="#70b040" cls="near" />
        </g>
        <g transform="translate(78 100)">
          <g className="ff-arm near">
            <rect x={-4.5} y={0} width={9} height={21} rx={4.5} fill="#ffffff" stroke="#d6d6d0" />
            <circle cy={22} r={5} fill="#ffffff" stroke="#d6d6d0" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function FrontBot({ happy }: { happy: boolean }) {
  return (
    <svg viewBox="0 0 140 170" className="ff-svg" aria-hidden="true">
      <ellipse className="ff-shadow" cx="70" cy="163" rx="36" ry="5" fill="rgba(0,0,0,.16)" />
      <g className="ff-breathe">
        {/* legs + feet */}
        <rect x="50" y="104" width="15" height="48" rx="7.5" fill="#f6f6f3" stroke="#d6d6d0" />
        <rect x="75" y="104" width="15" height="48" rx="7.5" fill="#f6f6f3" stroke="#d6d6d0" />
        <rect x="43" y="148" width="27" height="12" rx="6" fill="#fff" stroke="#d6d6d0" />
        <rect x="70" y="148" width="27" height="12" rx="6" fill="#fff" stroke="#d6d6d0" />
        <rect x="46" y="156.5" width="21" height="2.6" rx="1.3" fill="#70b040" />
        <rect x="73" y="156.5" width="21" height="2.6" rx="1.3" fill="#70b040" />
        {/* hip */}
        <rect x="45" y="93" width="50" height="17" rx="8.5" fill="#f3f3ef" stroke="#dcdcd6" />
        {/* resting arm */}
        <g transform="translate(42 100)">
          <g className="ff-rest-arm">
            <rect x={-4.5} y={0} width={9} height={21} rx={4.5} fill="#fff" stroke="#d6d6d0" />
            <circle cy={22} r={5} fill="#fff" stroke="#d6d6d0" />
          </g>
        </g>
        {/* waving arm (behind head) */}
        <g transform="translate(99 99)">
          <g className="ff-wave">
            <rect x={-5} y={-48} width={10} height={48} rx={5} fill="#fff" stroke="#d6d6d0" />
            <circle cy={-50} r={8} fill="#fff" stroke="#d6d6d0" />
          </g>
        </g>
        {/* head */}
        <line x1="70" y1="13" x2="70" y2="3" stroke="#cfcfc9" strokeWidth="3" strokeLinecap="round" />
        <circle cx="70" cy="3" r="4.5" fill="#f0b020" className="ff-antenna" />
        <rect x="24" y="12" width="92" height="84" rx="28" fill="#ffffff" stroke="#e1e1dc" strokeWidth="2" />
        <path d="M36 30 q8 -12 26 -13" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".9" />
        <circle cx="22" cy="54" r="8" fill="#f0b020" />
        <circle cx="118" cy="54" r="8" fill="#f0b020" />
        <rect x="36" y="24" width="68" height="60" rx="16" fill="#111418" />
        <g className="ff-glow">
          {happy ? (
            <>
              <path d="M47 54 q8 -13 16 0" stroke="#7ee05a" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M77 54 q8 -13 16 0" stroke="#7ee05a" strokeWidth="5" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <rect x="47" y="39" width="16" height="19" rx="5.5" fill="#7ee05a" className="ff-eye" />
              <rect x="77" y="39" width="16" height="19" rx="5.5" fill="#7ee05a" className="ff-eye" />
            </>
          )}
          <path d="M62 67 q8 8 16 0" stroke="#7ee05a" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </g>
        <circle cx="44" cy="68" r="3.4" fill="#f0b020" opacity=".75" />
        <circle cx="96" cy="68" r="3.4" fill="#f0b020" opacity=".75" />
      </g>
    </svg>
  );
}

/* ──────────────────────────── behaviour ──────────────────────────── */
export function WalkingRobot() {
  const pathname = usePathname();
  const router = useRouter();
  const hidden = pathname.startsWith("/chatbot");

  const [active, setActive] = useState(false);
  const [pose, setPose] = useState<Pose>("side");
  const [dir, setDir] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const [turning, setTurning] = useState(false);
  const [happy, setHappy] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const posRef = useRef<HTMLDivElement>(null);
  const phase = useRef<Phase>("idle");
  const paused = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<number | null>(null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const turnTo = useCallback((p: Pose) => {
    setTurning(true);
    later(() => {
      setPose(p);
      setTurning(false);
    }, TURN_MS);
  }, []);

  const startTrip = useCallback(() => {
    if (document.hidden) {
      later(startTrip, 3000);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = vw < 640 ? 0.78 : 1;
    const w = BASE_W * s;
    const h = BASE_H * s;
    const d: 1 | -1 = Math.random() > 0.5 ? 1 : -1;

    // random lane anywhere on screen, with a gentle diagonal drift
    const minY = Math.min(90, vh * 0.15);
    const maxY = Math.max(minY, vh - h - 10);
    const y0 = rand(minY, maxY);
    const y1 = Math.min(maxY, Math.max(minY, y0 + rand(-0.25, 0.25) * vh));
    const x0 = d === 1 ? -w - 30 : vw + 30;
    const x1 = d === 1 ? vw + 30 : -w - 30;
    const total = Math.hypot(x1 - x0, y1 - y0);
    // stop somewhere visible to say hi
    const stopX = rand(0.25, 0.7) * (vw - w);
    const stopDist = (Math.abs(stopX - x0) / Math.abs(x1 - x0)) * total;
    const speed = BASE_SPEED * s;

    setScale(s);
    setDir(d);
    setPose("side");
    setHappy(false);
    setBubble(Math.random() < 0.5 ? pick(WALK_LINES) : null);
    setWalking(true);
    setActive(true);
    phase.current = "in";
    paused.current = false;

    let dist = 0;
    let last = performance.now();
    const place = () => {
      const t = dist / total;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (posRef.current) posRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const moving = (phase.current === "in" || phase.current === "out") && !paused.current;
      if (moving) {
        dist += speed * dt;
        if (phase.current === "in" && dist >= stopDist) {
          dist = stopDist;
          phase.current = "wave";
          setWalking(false);
          turnTo("front");
          setBubble(pick(HELLO));
          later(() => {
            phase.current = "out";
            if (paused.current) return; // stays facing the visitor while hovered
            turnTo("side");
            setBubble(null);
            later(() => setWalking(true), TURN_MS);
          }, WAVE_MS);
        }
        if (phase.current === "out" && dist >= total) {
          phase.current = "idle";
          setActive(false);
          setWalking(false);
          raf.current = null;
          later(startTrip, GAP_MS);
          return;
        }
      }
      place();
      raf.current = requestAnimationFrame(frame);
    };
    // position before first paint
    requestAnimationFrame(() => {
      place();
      raf.current = requestAnimationFrame(frame);
    });
  }, [turnTo]);

  useEffect(() => {
    if (hidden) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    later(startTrip, FIRST_DELAY_MS);
    return () => {
      clearAll();
      phase.current = "idle";
      setActive(false);
    };
  }, [hidden, startTrip]);

  const onEnter = () => {
    paused.current = true;
    if (phase.current === "in" || phase.current === "out") {
      setWalking(false);
      turnTo("front");
      setBubble(pick(HELLO));
    }
  };
  const onLeave = () => {
    paused.current = false;
    if (happy) return;
    if (phase.current === "in" || phase.current === "out") {
      turnTo("side");
      setBubble(null);
      later(() => setWalking(true), TURN_MS);
    }
  };
  const onClick = () => {
    paused.current = true;
    setWalking(false);
    setHappy(true);
    if (pose !== "front") turnTo("front");
    setBubble("Let's chat! 🎉");
    later(() => router.push("/chatbot"), 650);
  };

  if (hidden || !active) return null;

  const flip = pose === "side" ? dir : 1;

  return (
    <div ref={posRef} className="ff-bot" style={{ width: BASE_W * scale, height: BASE_H * scale }}>
      <button
        type="button"
        className="ff-bot-btn"
        aria-label="Open the Funoon Fiesta chatbot"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={onClick}
      >
        {bubble && (
          <span key={bubble} className="ff-bubble">
            {bubble}
          </span>
        )}
        <div
          className={`ff-figure${walking ? " is-walking" : ""}${happy ? " is-happy" : ""}${pose === "front" && !happy ? " is-waving" : ""}`}
          style={{ transform: `scaleX(${turning ? flip * 0.06 : flip})` }}
        >
          {pose === "side" ? <SideBot /> : <FrontBot happy={happy || pose === "front"} />}
        </div>
      </button>

      <style jsx global>{`
        .ff-bot {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 60;
          pointer-events: none;
          will-change: transform;
        }
        .ff-bot-btn {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          padding: 0;
          border: 0;
          background: none;
          cursor: pointer;
          pointer-events: auto;
          -webkit-tap-highlight-color: transparent;
        }
        .ff-bot-btn:focus-visible { outline: 3px solid #70b040; outline-offset: 4px; border-radius: 24px; }
        .ff-figure {
          width: 100%;
          height: 100%;
          transition: transform ${TURN_MS}ms ease-in-out;
          transform-origin: 50% 50%;
        }
        .ff-svg {
          display: block;
          width: 100%;
          height: 100%;
          overflow: visible;
          filter: drop-shadow(0 8px 14px rgba(40, 60, 20, 0.16));
        }
        .ff-bot-btn:hover .ff-svg { filter: drop-shadow(0 0 12px rgba(112, 176, 64, 0.55)) drop-shadow(0 8px 14px rgba(40, 60, 20, 0.16)); }

        /* every jointed part rotates around its own joint */
        .ff-thigh, .ff-shin, .ff-foot, .ff-arm, .ff-wave, .ff-rest-arm, .ff-head {
          transform-box: view-box;
          transform-origin: 0 0;
        }
        .ff-head { transform-origin: 68px 100px; }
        .ff-bob, .ff-breathe { transform-box: view-box; }

        /* ── walk cycle ── */
        .is-walking .ff-thigh { animation: ff-thigh ${STEP_S}s linear infinite; }
        .is-walking .ff-shin { animation: ff-shin ${STEP_S}s linear infinite; }
        .is-walking .ff-foot { animation: ff-foot ${STEP_S}s linear infinite; }
        .is-walking .ff-arm { animation: ff-arm ${STEP_S}s ease-in-out infinite; }
        .is-walking .ff-bob { animation: ff-bob ${STEP_S}s linear infinite; }
        .is-walking .ff-head { animation: ff-head ${STEP_S}s ease-in-out infinite; }
        .is-walking .ff-shadow { animation: ff-shadow ${STEP_S / 2}s ease-in-out infinite; }
        .is-walking .far { animation-delay: -${STEP_S / 2}s !important; }

        /* negative = leg forward */
        @keyframes ff-thigh {
          0% { transform: rotate(-24deg); }
          50% { transform: rotate(20deg); }
          65% { transform: rotate(8deg); }
          85% { transform: rotate(-22deg); }
          100% { transform: rotate(-24deg); }
        }
        @keyframes ff-shin {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(8deg); }
          40% { transform: rotate(2deg); }
          55% { transform: rotate(30deg); }
          70% { transform: rotate(55deg); }
          85% { transform: rotate(15deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes ff-foot {
          0% { transform: rotate(14deg); }
          25% { transform: rotate(-3deg); }
          50% { transform: rotate(-16deg); }
          70% { transform: rotate(-55deg); }
          85% { transform: rotate(2deg); }
          100% { transform: rotate(14deg); }
        }
        @keyframes ff-arm {
          0%, 100% { transform: rotate(22deg); }
          50% { transform: rotate(-22deg); }
        }
        @keyframes ff-bob {
          0%, 50%, 100% { transform: translateY(3px); }
          25%, 75% { transform: translateY(-2px); }
        }
        @keyframes ff-head {
          0%, 50%, 100% { transform: rotate(1.5deg); }
          25%, 75% { transform: rotate(-1deg); }
        }
        @keyframes ff-shadow {
          0%, 100% { transform: scaleX(1); opacity: 1; }
          50% { transform: scaleX(0.9); opacity: 0.8; }
        }
        .ff-shadow { transform-box: fill-box; transform-origin: center; }

        /* ── standing / waving ── */
        .ff-breathe { animation: ff-breathe 1.6s ease-in-out infinite; }
        @keyframes ff-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .ff-wave { transform: rotate(30deg); }
        .is-waving .ff-wave, .is-happy .ff-wave { animation: ff-wave 0.42s ease-in-out infinite alternate; }
        @keyframes ff-wave {
          from { transform: rotate(18deg); }
          to { transform: rotate(48deg); }
        }
        .ff-rest-arm { transform: rotate(10deg); }
        .is-happy { animation: ff-jump 0.5s ease-out; }
        @keyframes ff-jump {
          0% { translate: 0 0; }
          40% { translate: 0 -22px; }
          70% { translate: 0 2px; }
          100% { translate: 0 0; }
        }

        /* ── face details ── */
        .ff-glow { filter: drop-shadow(0 0 3px rgba(126, 224, 90, 0.9)); }
        .ff-eye { transform-box: fill-box; transform-origin: center; animation: ff-blink 3.4s infinite; }
        @keyframes ff-blink {
          0%, 93%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        .ff-antenna { animation: ff-ant 0.9s ease-in-out infinite alternate; }
        @keyframes ff-ant { from { opacity: 0.55; } to { opacity: 1; } }

        /* ── speech bubble ── */
        .ff-bubble {
          position: absolute;
          bottom: calc(100% - 6px);
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: #ffffff;
          color: #1f2937;
          font: 700 13px/1.2 var(--font-geist-sans), system-ui, sans-serif;
          padding: 8px 13px;
          border-radius: 16px;
          border: 2px solid #70b040;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
          animation: ff-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ff-bubble::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -7px;
          border: 7px solid transparent;
          border-top-color: #70b040;
        }
        @keyframes ff-pop {
          from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.6); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @media (max-width: 640px) {
          .ff-bubble { font-size: 11.5px; padding: 6px 10px; }
        }
      `}</style>
    </div>
  );
}
