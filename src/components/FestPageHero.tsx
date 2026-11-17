"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NotificationProvider } from "@/components/notification-provider";
import { CountUp, type FestStat } from "@/components/StatsTapeSection";
import { cn } from "@/lib/utils";

/**
 * Page header in the same fest theme as the home hero: orange-to-red card,
 * centred white navigation, yellow title with a dark-red edge, and an optional
 * white stats notch. Used on Scoreboard, Results and Participants.
 */

const NAV_LINKS = [
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/results", label: "Result" },
  { href: "/participant", label: "Participants" },
  { href: "/chatbot", label: "Ai Assistant" },
  { href: "/festory", label: "Festory" },
];

/** Corner radius of the white stats notch (desktop). */
const R = 36;
/** Where the notch starts, as a share of the card width. */
const NOTCH_LEFT = 52;

interface FestPageHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  stats?: FestStat[];
  /** Extra content under the subtitle (search box, buttons). */
  children?: ReactNode;
}

export function FestPageHero({ eyebrow, title, subtitle, stats = [], children }: FestPageHeroProps) {
  const pathname = usePathname();
  const hasStats = stats.length > 0;

  return (
    <section
      className={cn(
        "relative bg-white px-2 pt-2 sm:px-2.5 sm:pt-2.5 lg:px-8 lg:pt-4 xl:px-12 2xl:px-20",
        hasStats ? "pb-3 lg:pb-[3.75rem]" : "pb-3 lg:pb-6",
      )}
    >
      <div className="relative mx-auto w-full max-w-[1760px]">
        <div className="relative rounded-[28px] bg-[linear-gradient(135deg,#F0A220_0%,#EC8230_30%,#E4602F_62%,#DB3C3F_100%)] shadow-[0_30px_60px_-34px_rgba(190,50,40,0.6)] sm:rounded-[36px] lg:min-h-[22rem] lg:rounded-[44px]">
          {/* Tonal logo pattern + soft light */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -right-[4%] -top-[30%] h-[150%] w-[44%] opacity-[0.08]">
              <Image src="/img/brand-logo-transparent.png" alt="" fill sizes="44vw" className="object-contain [filter:brightness(0)_invert(1)]" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(255,255,255,0.14),transparent_55%)]" />
          </div>

          {/* Navigation: centred white links on desktop, logo chip on phones */}
          <nav aria-label="Main" className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7 lg:justify-center lg:pt-[clamp(2.2rem,3.6vw,3rem)]">
            <Link href="/" aria-label="Funoon Fiesta home" className="relative block h-11 w-11 shrink-0 rounded-full bg-white p-1.5 shadow-md sm:h-12 sm:w-12 lg:hidden">
              <Image src="/img/brand-logo-transparent.png" alt="Funoon Fiesta" fill priority sizes="48px" className="object-contain p-1.5" />
            </Link>
            <ul className="hidden items-center gap-[clamp(1.6rem,3.4vw,3rem)] lg:flex">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative font-hero-sans text-[clamp(15px,1.35vw,20px)] text-white/95 transition-colors hover:text-white",
                        "after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-[#FBFF00] after:transition-transform hover:after:scale-x-100",
                        active && "font-semibold after:scale-x-100",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Notification bell */}
          <div className="absolute right-4 top-5 z-40 sm:right-8 sm:top-7 lg:right-[clamp(2rem,6vw,6.5rem)] lg:top-[clamp(1.9rem,3.2vw,2.6rem)]">
            <NotificationProvider variant="icon" />
          </div>

          {/* Title block */}
          <div className="relative z-20 flex flex-col px-6 pb-8 pt-28 sm:px-12 sm:pt-32 lg:max-w-[64%] lg:px-0 lg:pb-[5.5rem] lg:pl-[clamp(3rem,7.4vw,8rem)] lg:pt-[clamp(7.5rem,12vh,9.5rem)]">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/45 bg-white/20 px-3.5 py-1.5 font-hero-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md sm:text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FBFF00]" />
              {eyebrow}
            </span>
            <h1 className="mt-4 font-hero-stat text-[clamp(2.4rem,6.4vw,5rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-[#FBFF00] [text-shadow:0.2rem_0.2rem_0_#A92A2B] sm:[text-shadow:0.26rem_0.26rem_0_#A92A2B]">
              {title}
            </h1>
            <p className="mt-4 max-w-[34rem] font-hero-sans text-[15px] leading-[1.45] text-white/95 sm:text-[17px] lg:text-[18px]">
              {subtitle}
            </p>
            {children && <div className="mt-6">{children}</div>}

            {/* Phones and tablets: stats as chips under the text */}
            {hasStats && (
              <dl className="mt-7 grid grid-cols-3 gap-2 lg:hidden">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-white px-2 py-3 text-center shadow-[0_4px_0_#A9462A]">
                    <dd className="font-hero-stat text-[1.7rem] font-bold leading-none text-[#E8742F] sm:text-[2.1rem]">
                      <CountUp to={s.value} />
                      {s.suffix}
                    </dd>
                    <dt className="mt-1.5 font-hero-sans text-[9.5px] font-medium uppercase tracking-[0.2em] text-[#5B5B5B]">{s.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Desktop: white stats notch at the bottom-right, like the home hero */}
          {hasStats && (
            <>
              <div
                className="absolute -bottom-[3.5rem] right-0 z-20 hidden h-[7.5rem] items-center justify-around bg-white pb-2 lg:flex"
                style={{ width: `${100 - NOTCH_LEFT}%`, borderTopLeftRadius: R }}
              >
                <dl className="grid w-full max-w-[560px] grid-cols-3 gap-4 px-6 text-center xl:px-10">
                  {stats.map((s) => (
                    <div key={s.label} className="flex flex-col-reverse items-center">
                      <dt className="mt-1 font-hero-sans text-[10.5px] font-medium uppercase tracking-[0.36em] text-[#5B5B5B] xl:text-[12px]">{s.label}</dt>
                      <dd className="font-hero-stat text-[clamp(2.2rem,3.6vw,3.6rem)] font-bold leading-[0.9] text-[#E8742F]">
                        <CountUp to={s.value} />
                        {s.suffix}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <span
                aria-hidden
                className="absolute bottom-0 z-20 hidden lg:block"
                style={{
                  left: `calc(${NOTCH_LEFT}% - ${R}px)`,
                  width: R,
                  height: R,
                  background: `radial-gradient(circle at 0 0, transparent ${R - 0.5}px, #fff ${R}px)`,
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
