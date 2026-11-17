"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Download, WifiOff, Zap, BellRing, Share, SquarePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if running on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = ("standalone" in window.navigator) && (window.navigator as any).standalone;

    if (isIOS && !isInStandaloneMode) {
      // Show iOS install instructions after a delay
      setTimeout(() => {
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }, 3000);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaDeferred = e;
      window.dispatchEvent(new Event("pwa-prompt-ready"));
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user has dismissed before
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if app was just installed
    window.addEventListener("appinstalled", () => {
      (window as any).__pwaDeferred = null;
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // iOS has no install prompt: show the steps inside the card instead of a browser alert.
      setShowIosSteps(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "true");
    window.dispatchEvent(new Event("pwa-popup-dismissed"));
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  const perks = [
    { icon: WifiOff, label: "Works offline" },
    { icon: Zap, label: "Opens faster" },
    { icon: BellRing, label: "Live alerts" },
  ];
  const iosSteps = [
    { icon: Share, text: "Tap the Share button in Safari" },
    { icon: SquarePlus, text: "Choose “Add to Home Screen”" },
    { icon: Download, text: "Tap “Add” to finish" },
  ];

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          role="dialog"
          aria-label="Install Funoon Fiesta"
          initial={{ y: 80, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed inset-x-3 bottom-24 z-50 md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]"
        >
          <div className="relative overflow-hidden rounded-[28px] border-2 border-white/70 bg-[linear-gradient(135deg,#F0A220_0%,#EC8230_30%,#E4602F_62%,#DB3C3F_100%)] p-4 text-white shadow-[0_6px_0_#A9362B,0_24px_44px_-18px_rgba(120,25,25,0.6)] sm:p-5">
            {/* tonal logo watermark */}
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 opacity-[0.1]">
              <Image src="/img/brand-logo-transparent.png" alt="" fill sizes="144px" className="object-contain [filter:brightness(0)_invert(1)]" />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.18),transparent_55%)]" />

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex items-center gap-3 pr-9">
              <div className="relative h-14 w-14 shrink-0 rounded-2xl bg-white p-2 shadow-[0_4px_0_rgba(150,40,30,0.35)]">
                <Image src="/img/brand-logo.png" alt="Funoon Fiesta" fill sizes="56px" className="object-contain p-2" />
              </div>
              <div className="min-w-0">
                <p className="font-hero-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">Get the app</p>
                <h3 className="font-hero-stat text-xl font-extrabold uppercase leading-tight tracking-tight text-[#FBFF00] [text-shadow:0_2px_0_#A92A2B]">
                  Install Funoon Fiesta
                </h3>
              </div>
            </div>

            {!showIosSteps ? (
              <>
                <p className="relative mt-3 text-[13px] leading-relaxed text-white/95">
                  Add it to your home screen for scores, results and announcements in one tap.
                </p>
                <ul className="relative mt-3 flex flex-wrap gap-2">
                  {perks.map(({ icon: Icon, label }) => (
                    <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <Icon className="h-3.5 w-3.5 text-[#FBFF00]" />
                      {label}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <ol className="relative mt-3 space-y-2">
                {iosSteps.map(({ icon: Icon, text }, i) => (
                  <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2 text-[13px] font-medium">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FBFF00] text-[12px] font-extrabold text-[#C72F36]">{i + 1}</span>
                    <span className="flex-1">{text}</span>
                    <Icon className="h-4 w-4 text-[#FBFF00]" />
                  </li>
                ))}
              </ol>
            )}

            <div className="relative mt-4 flex items-center gap-3">
              {!showIosSteps ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FBFF00] px-6 font-hero-sans text-[16px] font-bold text-[#C72F36] shadow-[0_4px_0_#A9462A] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#A9462A] active:translate-y-0.5 active:shadow-[0_1px_0_#A9462A]"
                >
                  <Download className="h-4 w-4" />
                  Install app
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[#FBFF00] px-6 font-hero-sans text-[16px] font-bold text-[#C72F36] shadow-[0_4px_0_#A9462A] transition active:translate-y-0.5 active:shadow-[0_1px_0_#A9462A]"
                >
                  Got it
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2 text-[13px] font-semibold text-white/90 underline-offset-4 hover:underline"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
