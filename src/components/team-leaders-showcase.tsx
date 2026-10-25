"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TeamLeadersShowcaseProps {
  teams: Team[];
}

const TEAM_IMAGES: Record<string, string> = {
  // Historical / Alternate Names
  "SAMARQAND": "/img/teams/SAMARKAND.png",
  "SAMARKAND": "/img/teams/SAMARKAND.png",
  "NAHAVAND": "/img/teams/NAHAVAND.png",
  "YAMAMA": "/img/teams/YAMAMAH.png",
  "YAMAMAH": "/img/teams/YAMAMAH.png",
  "QURTUBA": "/img/teams/QURTHUBA.png",
  "QURTHUBA": "/img/teams/QURTHUBA.png",
  "MUQADDAS": "/img/teams/MUQADDAS.png",
  "BUKHARA": "/img/teams/BUKHARA.png",
  // Current Database Team Names
  "BUSTAN": "/img/teams/BUKHARA.png",
  "DASTAN": "/img/teams/NAHAVAND.png",
  "DIWAN": "/img/teams/QURTHUBA.png",
  "GULISTAN": "/img/teams/SAMARKAND.png",
  "KHARISTAN": "/img/teams/MUQADDAS.png",
  "RAYHAN": "/img/teams/YAMAMAH.png",
};

const FALLBACK_TEAM_IMAGES = [
  "/img/teams/BUKHARA.png",
  "/img/teams/NAHAVAND.png",
  "/img/teams/QURTHUBA.png",
  "/img/teams/SAMARKAND.png",
  "/img/teams/MUQADDAS.png",
  "/img/teams/YAMAMAH.png",
];

export function TeamLeadersShowcase({ teams = [] }: TeamLeadersShowcaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const teamCount = teams.length;

  const handleNext = useCallback(() => {
    if (teamCount === 0) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % teamCount);
  }, [teamCount]);

  const handlePrev = useCallback(() => {
    if (teamCount === 0) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? teamCount - 1 : prev - 1));
  }, [teamCount]);

  // Auto-play
  useEffect(() => {
    if (teamCount <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [handleNext, teamCount]);

  if (!teams || teamCount === 0) {
    return null;
  }

  const getImage = (teamName: string, leaderPhoto?: string, idx: number = 0): string => {
    if (teamName) {
      const normalized = teamName.toUpperCase().trim();
      if (TEAM_IMAGES[normalized]) {
        return TEAM_IMAGES[normalized];
      }
    }
    if (leaderPhoto && leaderPhoto.trim().length > 0) {
      return leaderPhoto;
    }
    return FALLBACK_TEAM_IMAGES[idx % FALLBACK_TEAM_IMAGES.length] || "/img/teams/SAMARKAND.png";
  };

  const currentTeam = teams[currentIndex];
  const imageSrc = currentTeam
    ? getImage(currentTeam.name || "", currentTeam.leader_photo, currentIndex)
    : "";

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
      zIndex: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      zIndex: 1,
      transition: {
        duration: 0.5,
        type: "spring" as const,
        stiffness: 300,
        damping: 30,
      },
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
      zIndex: 0,
      transition: {
        duration: 0.5,
      },
    }),
  };

  return (
    <section className="py-12 sm:py-20 relative overflow-hidden bg-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm"
          >
            <Crown className="w-4 h-4 text-[#70B040]" />
            <span className="text-xs font-bold tracking-[0.2em] text-[#70B040] uppercase">
              Team Captains
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight"
          >
            Meet The <span className="text-[#70B040]">Leaders</span>
          </motion.h2>
        </div>

        {/* Carousel */}
        <div className="relative max-w-5xl mx-auto h-[400px] sm:h-[500px] flex items-center justify-center perspective-1000">
          {/* Navigation Buttons */}
          {teamCount > 1 && (
            <>
              <button
                onClick={handlePrev}
                aria-label="Previous Team"
                className="hidden sm:flex absolute left-4 z-20 p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-xl hover:bg-white text-gray-800 transition-all hover:scale-110 items-center justify-center border border-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={handleNext}
                aria-label="Next Team"
                className="hidden sm:flex absolute right-4 z-20 p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-xl hover:bg-white text-gray-800 transition-all hover:scale-110 items-center justify-center border border-gray-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(_, { offset, velocity }) => {
                const swipe = Math.abs(offset.x) * velocity.x;
                const swipeConfidenceThreshold = 10000;
                if (swipe < -swipeConfidenceThreshold) {
                  handleNext();
                } else if (swipe > swipeConfidenceThreshold) {
                  handlePrev();
                }
              }}
              className="absolute w-full max-w-sm sm:max-w-md md:max-w-lg aspect-3/4 sm:aspect-4/5 md:aspect-square flex items-center justify-center touch-pan-y cursor-grab active:cursor-grabbing"
            >
              <div className="relative w-full h-full drop-shadow-2xl hover:scale-[1.02] transition-transform duration-500">
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={currentTeam?.name || "Team Captain"}
                    fill
                    className="object-contain pointer-events-none"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-center p-6">
                    <Crown className="w-16 h-16 text-[#70B040] mb-3" />
                    <span className="text-2xl font-bold text-gray-900">{currentTeam?.name}</span>
                    <span className="text-base text-gray-600 mt-1">{currentTeam?.leader}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Dots */}
        {teamCount > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6 h-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {Array.from({ length: teamCount }).map((_, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <motion.div
                    layout
                    key={`dot-${idx}`}
                    onClick={() => {
                      if (isCurrent) return;
                      setDirection(idx > currentIndex ? 1 : -1);
                      setCurrentIndex(idx);
                    }}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      backgroundColor: isCurrent ? "#70B040" : "#D1D5DB",
                    }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{
                      duration: 0.3,
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                    className={cn(
                      "rounded-full cursor-pointer shrink-0 transition-colors",
                      isCurrent
                        ? "w-3 h-3 shadow-md z-10"
                        : "w-2 h-2 hover:bg-gray-400"
                    )}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
