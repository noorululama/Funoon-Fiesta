"use client";

import Link from "next/link";
import Image from "next/image";
import { FestieHeroSection } from "@/components/FestieHeroSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveScorePulse } from "@/components/live-score-pulse";
import { TeamLeadersShowcase } from "@/components/team-leaders-showcase";
import { HomeEngagementSection } from "@/components/HomeEngagementSection";
import { AboutSection } from "@/components/AboutSection";

import { useScoreboardUpdates } from "@/hooks/use-realtime";
import { useRouter } from "next/navigation";
import type { Team } from "@/lib/types";

interface HomeRealtimeProps {
  teams: Team[];
  liveScores: Map<string, number>;
}

export function HomeRealtime({ teams: initialTeams, liveScores: initialLiveScores }: HomeRealtimeProps) {
  const router = useRouter();

  useScoreboardUpdates(() => {
    router.refresh();
  });

  return (
    <main className="space-y-16">
      {/* Festie Hero Section */}
      <FestieHeroSection />

      {/* Live Score Pulse Section */}
      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-5 md:px-8">
          <LiveScorePulse teams={initialTeams} liveScores={initialLiveScores} />
        </div>
      </section>

      {/* Engagement Section */}
      <HomeEngagementSection />

      {/* Team Leaders Section */}
      <section className="bg-white py-12 sm:py-16 md:py-20 relative overflow-hidden">
        {/* Decorative Sun - Top Left */}
        <div className="absolute top-10 left-0 -translate-x-1/2 -translate-y-1/4 w-32 h-32 md:w-64 md:h-64 opacity-20 animate-[sun-rotate_60s_linear_infinite] pointer-events-none z-20">
          <Image
            src="/img/assets/sun.webp"
            alt="Decorative Sun"
            fill
            className="object-contain"
          />
        </div>

        {/* Decorative Srang - Bottom Right */}
        <div className="absolute bottom-0 right-0 w-40 h-40 md:w-96 md:h-96 opacity-90 translate-y-1/6 translate-x-1/6 pointer-events-none z-20">
          <Image
            src="/img/assets/srang.png"
            alt="Decorative Srang"
            fill
            className="object-contain"
          />
        </div>

        <div className="container mx-auto max-w-7xl px-4 sm:px-5 md:px-8 relative z-10">
          <TeamLeadersShowcase teams={initialTeams} />
        </div>
      </section>

      {/* About Funoon Fiesta Section */}
      <AboutSection />

      {/* Control Room Section */}
      <section className="bg-gradient-to-br from-[#70B040]/5 via-amber-500/5 to-emerald-500/5 py-12 sm:py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-5 md:px-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 sm:p-8 md:p-12 mb-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 sm:gap-8">
              <div className="flex-1">
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 mb-3 sm:mb-4 text-xs sm:text-sm font-semibold">
                  Need help?
                </Badge>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 tracking-tight">
                  Funoon Fiesta Control Room
                </h2>
                <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-2xl">
                  Contact us for support, inquiries, or assistance with the platform.
                  Our team is here to help ensure a smooth and enjoyable festival experience.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <Link href="/jury/login" className="w-full sm:w-auto">
                  <Button variant="ghost" className="text-gray-700 hover:bg-gray-100 border border-gray-300 w-full sm:w-auto text-sm sm:text-base font-semibold rounded-full px-6 py-2.5">
                    Jury Login
                  </Button>
                </Link>
                <Link href="/team/login" className="w-full sm:w-auto">
                  <Button className="bg-gradient-to-r from-[#70B040] to-[#F09030] hover:from-[#5C9E27] hover:to-[#E07A20] text-white w-full sm:w-auto text-sm sm:text-base font-semibold shadow-lg shadow-emerald-500/20 rounded-full px-6 py-2.5">
                    Team Portal
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
