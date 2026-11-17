"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Share, SquarePlus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isAppInstalled() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return isStandalone || isIosStandalone;
}

export function HomeInstallSection() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsInstalled(isAppInstalled());
    const userAgent = navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (outcome === "accepted") setIsInstalled(true);
    } catch {
      setShowInstructions(true);
    }
  };

  if (isInstalled) return null;

  return (
    <section aria-labelledby="home-install-title" className="bg-white py-4 sm:py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-5 md:px-8">
        <div className="rounded-3xl border border-[#EAD9C7] bg-gradient-to-r from-[#FFF8EF] via-white to-[#FFF1E6] p-3 shadow-sm sm:p-7">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:h-14 sm:w-14">
              <Image src="/img/brand-logo.png" alt="" width={42} height={42} className="h-8 w-8 object-contain sm:h-10 sm:w-10" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="home-install-title" className="truncate text-base font-bold tracking-tight text-[#241C17] sm:text-xl">
                <span className="sm:hidden">Install the app</span>
                <span className="hidden sm:inline">Install Funoon Fiesta</span>
              </h2>
              <p className="mt-1 hidden max-w-xl text-sm leading-relaxed text-[#74665C] sm:block">
                Add the app to your home screen for quick access to scores, results, and festival updates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#D9383F] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#BD2E37] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D9383F]/25 sm:min-h-11 sm:gap-2 sm:px-6 sm:py-2.5 sm:text-sm"
            >
              {installPrompt ? <Download size={15} /> : isIos ? <Share size={15} /> : <SquarePlus size={15} />}
              <span className="sm:hidden">Install</span>
              <span className="hidden sm:inline">{installPrompt ? "Install app" : "How to install"}</span>
            </button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-[#74665C] sm:hidden">
            Quick access to scores, results, and festival updates.
          </p>
          {showInstructions && (
            <div role="status" aria-live="polite" className="mt-3 rounded-2xl bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-[#55483F] sm:ml-[4.5rem] sm:px-4 sm:py-3 sm:text-sm">
              {isIos ? (
                <p><Share className="mr-1 inline-block h-4 w-4 align-text-bottom" /> In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
              ) : (
                <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
