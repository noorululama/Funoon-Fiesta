"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AnimatedHourglass } from "./animated-hourglass";
import { NotificationProvider } from "@/components/notification-provider";
import { CountUp, type FestStat } from "@/components/StatsTapeSection";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/results", label: "Result" },
  { href: "/participant", label: "Participants" },
  { href: "/chatbot", label: "Ai Assistant" },
  { href: "/festory", label: "Festory" },
];

/** Corner radius of the white stats notch (desktop). */
const R = 44;
/** Where the notch starts, as a share of the card width (it takes the rest). */
const NOTCH_LEFT = 42;

export function FestieHeroSection({ stats = [] }: { stats?: FestStat[] }) {
  const pathname = usePathname();

  return (
    <section className="relative overflow-hidden bg-white px-0 pb-10 pt-0 sm:px-2.5 sm:pt-2.5 lg:px-8 lg:pb-[5rem] lg:pt-4 xl:px-12 2xl:px-20">
      {/* Faint dot grid on the page behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-60 [mask-image:linear-gradient(to_top,black,transparent)]"
        style={{ backgroundImage: "radial-gradient(#E3E3E3 1.2px, transparent 1.2px)", backgroundSize: "34px 34px" }}
      />

      <div className="relative mx-auto w-full max-w-[1760px]">
        {/* ══════════ Gradient card ══════════ */}
        <div className="relative min-h-[640px] rounded-none bg-[linear-gradient(135deg,#F0A220_0%,#EC8230_30%,#E4602F_62%,#DB3C3F_100%)] sm:rounded-[36px] lg:min-h-[calc(100svh-7.5rem)] lg:rounded-[44px]">
          {/* Tonal logo pattern */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -right-[4%] -top-[14%] h-[95%] w-[50%] opacity-[0.08]">
              <Image src="/img/brand-logo-transparent.png" alt="" fill sizes="50vw" className="object-contain [filter:brightness(0)_invert(1)]" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(255,255,255,0.12),transparent_55%)]" />
          </div>

          {/* Wavy white bottom edge */}
          <div aria-hidden className="pointer-events-none absolute -inset-x-[2px] -bottom-[2px] z-10 lg:hidden">
            <svg viewBox="0 0 1440 121" preserveAspectRatio="none" className="block h-[64px] w-full sm:h-[92px] lg:h-[120px]">
              <path fill="#fff" d="M0,62 C100,58 180,50 265,50 C420,50 480,80 635,80 C800,80 880,30 1040,30 C1180,30 1330,38 1440,46 L1440,121 L0,121 Z" />
            </svg>
          </div>

          {/* ══════════ Top navigation (centred, white) ══════════ */}
          <nav aria-label="Main" className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7 lg:justify-center lg:pt-[clamp(2.6rem,5vw,3.9rem)]">
            <ul className="hidden items-center gap-[clamp(1.6rem,3.4vw,3rem)] lg:flex">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "relative font-hero-sans text-[clamp(15px,1.35vw,20px)] text-white/95 transition-colors hover:text-white",
                        "after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-[#FBFF00] after:transition-transform hover:after:scale-x-100",
                        active && "after:scale-x-100",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ══════════ Notification badge (top right) ══════════ */}
          <div className="absolute right-4 top-5 z-40 sm:right-8 sm:top-7 lg:right-[clamp(2rem,6vw,6.5rem)] lg:top-[clamp(2.3rem,4.6vw,3.6rem)]">
            <NotificationProvider variant="icon" />
          </div>

          {/* ══════════ Content ══════════ */}
          <div className="relative z-20 flex flex-col px-6 pb-8 pt-7 sm:px-12 sm:pt-32 md:pb-[300px] lg:max-w-[72%] lg:px-0 lg:pb-28 lg:pl-[clamp(3rem,7.4vw,8rem)] lg:pt-[clamp(8.5rem,16vh,12.5rem)]">
            {/* Partner branding strip */}
            <div className="flex items-center pr-12 sm:pr-0">
              <Image
                src="/img/hero/hero-partners-4.png"
                alt="Funoon Fiesta & Partner Logos"
                width={755}
                height={117}
                priority
                className="h-9 w-auto max-w-full object-contain sm:h-11 md:h-12 lg:h-[52px]"
              />
            </div>

            {/* Title: the Malayalam typography artwork */}
            <h1 className="mt-4 lg:mt-5">
              <span className="sr-only">Funoon Fiesta ‘26-27</span>
              <Image
                src="/img/hero/fest-typo.png"
                alt=""
                width={1400}
                height={796}
                priority
                sizes="(min-width: 1024px) 34vw, 80vw"
                className="h-auto w-[min(86%,26rem)] [filter:drop-shadow(0.28rem_0.28rem_0_#A92A2B)] sm:w-[min(70%,30rem)] lg:w-[clamp(20rem,30vw,31rem)]"
              />
            </h1>

            <p className="mt-6 max-w-[min(690px,100%)] font-hero-sans text-[15px] leading-[1.4] text-white/95 sm:text-[17px] lg:max-w-[min(690px,88%)] lg:text-[19px]">
              A complete digital platform for managing Islamic arts and cultural festivals — from registrations and
              participants to live results, certificates and announcements.
            </p>

            <div className="mt-8 flex items-center justify-between gap-3 md:block">
              <div className="flex flex-col items-start gap-y-4 md:flex-row md:flex-wrap md:items-center md:gap-x-12">
                <HeroCta href="/festory" label="Festory" pill />
                <HeroCta href="/scoreboard" label="Explore Now" />
              </div>
              {/* Small screens: hourglass sits to the right of the buttons so the hero fits one screen */}
              <AnimatedHourglass className="pointer-events-none h-auto w-[34%] max-w-[150px] shrink-0 animate-[hero-float_6s_ease-in-out_infinite] drop-shadow-[0_14px_18px_rgba(90,30,10,0.25)] md:hidden" />
            </div>
          </div>

          {/* ══════════ Hourglass illustration ══════════ */}
          <div className="pointer-events-none absolute -bottom-6 left-1/2 z-10 hidden w-[min(58vw,250px)] -translate-x-1/2 md:block md:left-auto md:right-6 md:w-[300px] md:translate-x-0 lg:bottom-[clamp(5rem,9vw,7.5rem)] lg:right-[clamp(1rem,4.5vw,4rem)] lg:left-auto lg:w-[32%] lg:max-w-[430px] lg:translate-x-0">
            <AnimatedHourglass className="h-auto w-full animate-[hero-float_6s_ease-in-out_infinite] drop-shadow-[0_18px_24px_rgba(90,30,10,0.25)]" />
          </div>

          {/* ══════════ Desktop: white notch carrying the festival numbers ══════════ */}
          <div
            aria-hidden={false}
            className="absolute -bottom-[4.75rem] right-0 z-20 hidden h-[10rem] items-center justify-around bg-white pb-2 lg:flex"
            style={{ width: `${100 - NOTCH_LEFT}%`, borderTopLeftRadius: R }}
          >
            <dl className="grid w-full max-w-[640px] grid-cols-3 gap-4 px-6 text-center xl:px-10">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col-reverse items-center">
                  <dt className="mt-1.5 font-hero-sans text-[11px] font-medium uppercase tracking-[0.42em] text-[#5B5B5B] xl:text-[13px]">
                    {s.label}
                  </dt>
                  <dd className="font-hero-stat text-[clamp(3rem,5.3vw,5.2rem)] font-bold leading-[0.9] text-[#E8742F]">
                    <CountUp to={s.value} />
                    {s.suffix}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {/* rounds the corner of the card's lower-left lobe where it meets the notch */}
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
        </div>
      </div>
    </section>
  );
}

function HeroCta({ href, label, pill = false }: { href: string; label: string; pill?: boolean }) {
  if (pill) {
    return (
      <Link
        href={href}
        className="group inline-flex h-12 items-center gap-3 whitespace-nowrap rounded-full bg-[#FBFF00] px-6 font-hero-sans text-[20px] font-semibold text-[#C72F36] shadow-[0_4px_0_#A9462A] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#A9462A] active:translate-y-0.5 active:shadow-[0_1px_0_#A9462A] sm:h-14 sm:gap-4 sm:px-8 sm:text-[26px]"
      >
        {label}
        <ArrowUpRight size={24} strokeWidth={2.6} />
      </Link>
    );
  }
  return (
    <Link href={href} className="group inline-flex items-center gap-3 whitespace-nowrap font-hero-sans text-[20px] font-medium text-white sm:gap-4 sm:text-[28px]">
      {label}
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#FBFF00] text-[#141414] shadow-[0_4px_0_#A9462A] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_0_#A9462A] group-active:translate-y-0.5 group-active:shadow-[0_1px_0_#A9462A] sm:h-12 sm:w-12">
        <ArrowUpRight size={24} strokeWidth={2.6} />
      </span>
    </Link>
  );
}
