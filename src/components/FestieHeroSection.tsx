"use client";

import Link from "next/link";
import Image from "next/image";

export function FestieHeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#F8F9F5] text-[#242424]">
      {/* =====================================================
          BACKGROUND
      ====================================================== */}
      <div className="pointer-events-none absolute inset-0">
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(#242424 1px, transparent 1px),
              linear-gradient(90deg, #242424 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Soft logo-inspired ambient gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full bg-[#6EAC3A]/8 blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] rounded-full bg-[#EE992B]/8 blur-[130px]" />
      </div>

      {/* =====================================================
          NAVIGATION
      ====================================================== */}
      <header className="relative z-30 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative h-11 w-11 sm:h-12 sm:w-12">
            <Image
              src="/img/brand-logo-transparent.png"
              alt="Funoon Fiesta"
              fill
              priority
              className="object-contain"
            />
          </div>

          <div>
            <div className="text-[18px] font-black tracking-[-0.03em] sm:text-xl">
              FUNOON
              <span className="text-[#EE992B]"> FIESTA</span>
            </div>
            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.25em] text-[#7A8077]">
              Islamic Arts & Culture
            </div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center justify-center gap-8 lg:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2">
          <Link
            href="/scoreboard"
            className="text-[13px] font-semibold text-[#525850] transition hover:text-[#6EAC3A]"
          >
            Scoreboard
          </Link>
          <Link
            href="/results"
            className="text-[13px] font-semibold text-[#525850] transition hover:text-[#6EAC3A]"
          >
            Results
          </Link>
          <Link
            href="/participant"
            className="text-[13px] font-semibold text-[#525850] transition hover:text-[#6EAC3A]"
          >
            Participants
          </Link>
          <Link
            href="/chatbot"
            className="text-[13px] font-semibold text-[#525850] transition hover:text-[#6EAC3A]"
          >
            AI Assistant
          </Link>
          <Link
            href="/festory"
            className="text-[13px] font-semibold text-[#525850] transition hover:text-[#6EAC3A]"
          >
            Festory
          </Link>
        </nav>
      </header>

      {/* =====================================================
          HERO (CENTERED LAYOUT)
      ====================================================== */}
      <main className="relative z-10 mx-auto max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 lg:px-14 lg:pt-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {/* Official Tag */}
          <div className="mb-6 inline-flex items-center gap-4">
            <span className="text-[11px] font-extrabold tracking-[0.3em] text-[#6EAC3A]">
              2026
            </span>
            <span className="h-px w-10 bg-[#BFC6BA]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#737A72]">
              Official Festival Platform
            </span>
          </div>

          {/* Centered Brand Logo */}
          <div className="relative mb-6 h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 transition-transform duration-300 hover:scale-105 drop-shadow-xl">
            <Image
              src="/img/brand-logo-transparent.png"
              alt="Funoon Fiesta Logo"
              fill
              priority
              className="object-contain"
            />
          </div>

          {/* Main Headline */}
         <h1 className="font-fest-display select-none text-center font-black leading-[0.82] tracking-[-0.055em]">

  <span
    className="
      block
      bg-gradient-to-b
      from-[#3A3A3A]
      via-[#242424]
      to-[#111111]
      bg-clip-text
      text-[clamp(3.8rem,9vw,8rem)]
      text-transparent
      drop-shadow-[0_3px_0_#6EAC3A]
    "
  >
    FUNOON
  </span>

  <span
    className="
      block
      bg-gradient-to-b
      from-[#8CCB55]
      via-[#6EAC3A]
      to-[#4E8D29]
      bg-clip-text
      text-[clamp(4rem,10vw,9rem)]
      text-transparent
      drop-shadow-[0_3px_0_#DD4B36]
    "
  >
    FIESTA
  </span>

  <div className="mt-5 flex items-center justify-center gap-4">
    <span className="h-px w-12 bg-[#6EAC3A]" />

    <span className="text-sm font-black tracking-[0.45em] text-[#DD4B36]">
      2026
    </span>

    <span className="h-px w-12 bg-[#6EAC3A]" />
  </div>

</h1>
          {/* Description */}
          <p className="mt-7 max-w-2xl text-[15px] sm:text-base md:text-lg leading-relaxed text-[#626960] text-center mx-auto">
            A complete digital platform for managing Islamic arts and cultural festivals —
            from registrations and participants to live results, certificates and announcements.
          </p>

          {/* Actions */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link
              href="/scoreboard"
              className="
                group
                inline-flex
                h-14
                items-center
                justify-center
                gap-5
                rounded-full
                bg-[#242424]
                px-8
                text-sm
                font-bold
                text-white
                transition-all
                hover:bg-[#6EAC3A]
                shadow-md
                hover:shadow-xl
                w-full
                sm:w-auto
              "
            >
              <span>Start Your Fest</span>
              <span
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-full
                  bg-white/10
                  transition
                  group-hover:bg-white/20
                "
              >
                →
              </span>
            </Link>

            <Link
              href="/festory"
              className="
                inline-flex
                h-14
                items-center
                justify-center
                rounded-full
                border
                border-[#D5DBD1]
                bg-white
                px-8
                text-sm
                font-bold
                text-[#242424]
                transition
                hover:border-[#6EAC3A]
                hover:text-[#6EAC3A]
                shadow-sm
                w-full
                sm:w-auto
              "
            >
              Explore Funoon
            </Link>
          </div>
        </div>
      </main>
    </section>
  );
}