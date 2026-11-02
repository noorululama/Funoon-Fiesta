"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface FestStat {
  value: number;
  suffix?: string;
  label: string;
}

const DEFAULT_STATS: FestStat[] = [
  { value: 950, suffix: "+", label: "Participants" },
  { value: 6, label: "Team" },
  { value: 200, suffix: "+", label: "Programmes" },
];

const TAPE_TEXT = "FUNOON FIESTA ‘26-27";

/**
 * Festival numbers + two crossing "caution tape" marquees (home page, under the hero).
 */
export function StatsTapeSection({ stats = DEFAULT_STATS }: { stats?: FestStat[] }) {
  return (
    <section className="relative overflow-hidden bg-white pb-16 pt-10 sm:pb-20 sm:pt-14">
      {/* dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(#E4E4E4 1.3px, transparent 1.3px)", backgroundSize: "48px 48px" }}
      />

      {/* ══════════ Stats ══════════ */}
      <dl className="relative mx-auto grid max-w-5xl grid-cols-3 gap-2 px-4 text-center sm:gap-8">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse items-center">
            <dt className="mt-1 font-hero-sans text-[10px] font-medium uppercase tracking-[0.35em] text-[#5B5B5B] sm:mt-2 sm:text-sm sm:tracking-[0.45em]">
              {s.label}
            </dt>
            <dd className="font-hero-stat text-[clamp(2.4rem,9.5vw,7.25rem)] font-bold leading-[0.9] text-[#E8742F]">
              <CountUp to={s.value} />
              {s.suffix}
            </dd>
          </div>
        ))}
      </dl>

      {/* ══════════ Crossing tapes ══════════ */}
      <div aria-hidden className="relative mt-14 h-[150px] sm:mt-20 sm:h-[190px]">
        <Tape className="top-[46%] rotate-[-3deg] bg-[#FBFF00]" direction="right" />
        <Tape
          className="top-[30%] rotate-[3.5deg] bg-[linear-gradient(90deg,#DD3F3E_0%,#E8742F_45%,#F3951E_75%,#F9B10C_100%)] shadow-[0_14px_22px_-10px_rgba(120,40,10,0.45)]"
          direction="left"
        />
      </div>
      <p className="sr-only">{TAPE_TEXT}</p>
    </section>
  );
}

function Tape({ className, direction }: { className: string; direction: "left" | "right" }) {
  // Two identical halves → seamless loop when the track moves by 50%.
  const half = Array.from({ length: 8 }, (_, i) => (
    <span key={i} className="px-3 sm:px-4">
      {TAPE_TEXT}
    </span>
  ));
  return (
    <div className={cn("absolute -left-[5%] w-[110%] overflow-hidden py-2 sm:py-3", className)}>
      <div
        className={cn(
          "flex w-max whitespace-nowrap font-hero-tape text-[17px] font-extrabold uppercase tracking-[0.01em] text-[#141414] sm:text-[24px] motion-reduce:animate-none",
          direction === "left" ? "animate-[tape-left_38s_linear_infinite]" : "animate-[tape-right_38s_linear_infinite]",
        )}
      >
        <div className="flex">{half}</div>
        <div className="flex">{half}</div>
      </div>
    </div>
  );
}

/** Counts up from 0 the first time the number scrolls into view (writes to the DOM, no re-renders). */
function CountUp({ to, duration = 1400 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.textContent = "0";
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = String(to);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {to}
    </span>
  );
}
