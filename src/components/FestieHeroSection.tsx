"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NotificationProvider } from "@/components/notification-provider";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/results", label: "Result" },
  { href: "/participant", label: "Participants" },
  { href: "/chatbot", label: "Ai Assistant" },
  { href: "/festory", label: "Festory" },
];

/** Radius of the inverted corners where the white nav tab meets the card. */
const NOTCH_R = 40;

export function FestieHeroSection() {
  const pathname = usePathname();

  return (
    <section className="relative overflow-hidden bg-white px-3 pb-10 pt-3 sm:px-6 sm:pt-8 lg:px-[clamp(2.5rem,5.5vw,5rem)] lg:pb-14 lg:pt-12">
      {/* Faint dot grid on the page behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-60 [mask-image:linear-gradient(to_top,black,transparent)]"
        style={{ backgroundImage: "radial-gradient(#E3E3E3 1.2px, transparent 1.2px)", backgroundSize: "34px 34px" }}
      />

      <div className="relative mx-auto max-w-[1280px]">
        {/* ══════════ Gradient card ══════════ */}
        <div className="relative min-h-[620px] rounded-[28px] bg-[linear-gradient(135deg,#D9383F_0%,#DE4A3B_32%,#E56C31_68%,#F0952A_100%)] sm:rounded-[36px] lg:min-h-[min(830px,calc(100svh-6rem))] lg:rounded-[44px]">
          {/* Tonal logo pattern, top right */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -right-[4%] -top-[14%] h-[95%] w-[50%] opacity-[0.08]">
              <Image src="/img/brand-logo-transparent.png" alt="" fill sizes="50vw" className="object-contain [filter:brightness(0)_invert(1)]" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(255,255,255,0.08),transparent_55%)]" />
          </div>

          {/* ══════════ White nav tab cut into the card ══════════ */}
          <div className="absolute left-0 top-0 z-30 rounded-br-[32px] bg-white pb-3 pr-4 sm:rounded-br-[40px] sm:pb-4 sm:pr-8 lg:pr-12">
            <nav aria-label="Main" className="flex items-center gap-6 pl-1 pt-0.5 lg:gap-11">
              <Link href="/" aria-label="Funoon Fiesta home" className="relative block h-12 w-12 shrink-0 sm:h-14 sm:w-14 lg:ml-5 lg:mt-1">
                <Image src="/img/brand-logo-transparent.png" alt="Funoon Fiesta" fill priority sizes="56px" className="object-contain" />
              </Link>
              <ul className="hidden items-center gap-8 lg:flex xl:gap-11">
                {NAV_LINKS.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          "relative font-hero-sans text-[17px] text-[#1C1C1C] transition-colors hover:text-[#DA3E3E]",
                          "after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-[#DA3E3E] after:transition-transform hover:after:scale-x-100",
                          active && "text-[#DA3E3E] after:scale-x-100",
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {/* inverted corners so the card curves smoothly around the tab */}
            <span aria-hidden className="absolute left-0 top-full" style={invertedCorner()} />
            <span aria-hidden className="absolute left-full top-0" style={invertedCorner()} />
          </div>

          {/* ══════════ Notification badge (top right) ══════════ */}
          <div className="absolute -right-1 -top-2 z-40 h-[92px] w-[92px] sm:-right-6 sm:-top-8 sm:h-[150px] sm:w-[150px] lg:-right-9 lg:-top-11 lg:h-[200px] lg:w-[200px]">
            <NotificationProvider variant="badge" />
          </div>

          {/* ══════════ Content ══════════ */}
          <div className="relative z-20 flex flex-col px-6 pb-[min(80vw,350px)] pt-28 sm:px-12 sm:pt-36 md:pb-[300px] lg:max-w-[74%] lg:px-0 lg:pb-24 lg:pl-[clamp(3rem,6.6vw,5.75rem)] lg:pt-[clamp(10rem,18vh,15.5rem)]">
            {/* Partner branding banner strip */}
            <div className="flex items-center">
              <Image
                src="/img/hero/hero-partners.png"
                alt="Funoon Fiesta & Partner Logos"
                width={1024}
                height={117}
                priority
                className="h-9 w-auto max-w-full object-contain sm:h-11 md:h-12 lg:h-[52px]"
              />
            </div>

            {/* Title */}
            <h1 className="mt-3 font-hero-display text-[clamp(2.9rem,11.5vw,7.6rem)] font-bold uppercase leading-[0.92] tracking-[0.005em] text-[#FBFF00] [text-shadow:0.045em_0.045em_0_#A92A2B] lg:text-[clamp(4.5rem,8.3vw,7.6rem)]">
              Funoon
              <br />
              <span className="whitespace-nowrap">Fiesta ‘26-27</span>
            </h1>

            <p className="mt-5 max-w-[min(690px,100%)] lg:max-w-[min(690px,85%)] font-hero-sans text-[15px] leading-[1.35] text-white/95 sm:text-[17px] lg:text-[19px]">
              A complete digital platform for managing Islamic arts and cultural festivals — from registrations and
              participants to live results, certificates and announcements.
            </p>

            <div className="mt-7">
              <Link
                href="/scoreboard"
                className="inline-flex h-14 items-center rounded-full bg-[#FBFF00] px-7 font-hero-sans text-[20px] font-medium text-[#141414] shadow-[0_5px_0_#A9462A] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#A9462A] active:translate-y-0.5 active:shadow-[0_2px_0_#A9462A] sm:h-[60px] sm:text-[24px]"
              >
                Explore Now
              </Link>
            </div>
          </div>

          {/* ══════════ Hourglass illustration ══════════ */}
          <div className="pointer-events-none absolute -bottom-6 left-1/2 z-10 w-[min(58vw,250px)] -translate-x-1/2 md:left-auto md:right-6 md:w-[300px] md:translate-x-0 lg:-bottom-8 lg:-right-8 lg:w-[33%] lg:max-w-[440px]">
            <Image
              src="/img/hero/hourglass.png"
              alt="Hourglass with waves and hands reaching out"
              width={414}
              height={559}
              priority
              sizes="(min-width: 1024px) 440px, 300px"
              className="h-auto w-full animate-[hero-float_6s_ease-in-out_infinite] drop-shadow-[0_18px_24px_rgba(90,30,10,0.25)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** White square with a quarter-circle hole: makes the card corner look rounded next to the tab. */
function invertedCorner(): React.CSSProperties {
  return {
    width: NOTCH_R,
    height: NOTCH_R,
    background: `radial-gradient(circle at 100% 100%, transparent ${NOTCH_R - 0.5}px, #fff ${NOTCH_R}px)`,
  };
}
