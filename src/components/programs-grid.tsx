"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, Trophy, Medal } from "lucide-react";
import type { Program, ResultRecord, Student, Team } from "@/lib/types";
import { ResultProgramCard } from "./result-program-card";

interface ProgramsGridProps {
  programs: Program[];
  results: ResultRecord[];
  programMap: Map<string, Program>;
  students: Student[];
  teams: Team[];
}

const fadeIn = (direction: string, delay: number) => ({
  hidden: {
    opacity: 0,
    x: direction === "left" ? -50 : direction === "right" ? 50 : 0,
    y: direction === "down" ? 50 : direction === "up" ? -50 : 0,
  },
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.5,
      delay,
    },
  },
});

export function ProgramsGrid({ programs, results, programMap, students, teams }: ProgramsGridProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "stage" | "non-stage" | "general">("all");

  // Create Maps for efficient lookup
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const resultMap = useMemo(() => new Map(results.map((r) => [r.program_id, r])), [results]);

  // Get unique programs that have results, sorted by latest result date
  const programsWithResults = useMemo(() => {
    const programIds = new Set(results.map((r) => r.program_id));
    const programsWithResultsList = programs.filter((p) => programIds.has(p.id));

    // Sort programs by their latest result's submitted_at date (newest first)
    return programsWithResultsList.sort((a, b) => {
      const aResults = results.filter((r) => r.program_id === a.id);
      const bResults = results.filter((r) => r.program_id === b.id);

      if (aResults.length === 0 && bResults.length === 0) return 0;
      if (aResults.length === 0) return 1;
      if (bResults.length === 0) return -1;

      // Get the most recent result for each program
      const aLatest = Math.max(...aResults.map((r) => new Date(r.submitted_at).getTime()));
      const bLatest = Math.max(...bResults.map((r) => new Date(r.submitted_at).getTime()));

      return bLatest - aLatest; // Descending order (newest first)
    });
  }, [programs, results]);

  const filteredPrograms = useMemo(() => {
    let filtered = programsWithResults;

    // Apply Category Filter
    if (filter !== "all") {
      filtered = filtered.filter((program) => {
        switch (filter) {
          case "stage":
            return program.stage === true;
          case "non-stage":
            return program.stage === false;
          case "general":
            return program.section === "general";
          default:
            return true;
        }
      });
    }

    // Apply Search
    if (search.trim()) {
      const normalized = search.toLowerCase();
      filtered = filtered.filter((program) =>
        program.name.toLowerCase().includes(normalized)
      );
    }

    return filtered.map((program, index) => ({
      id: program.id,
      program,
      index,
    }));
  }, [search, programsWithResults, filter]);

  // Get result count and medal info for each program
  const getProgramStats = (programId: string) => {
    const programResults = results.filter((r) => r.program_id === programId);
    const hasResults = programResults.length > 0;
    const program = programMap.get(programId);

    return {
      hasResults,
      section: program?.section || "general",
      category: program?.category || "none",
    };
  };

  const filters = [
    { id: "all", label: "All Items" },
    { id: "stage", label: "Stage" },
    { id: "non-stage", label: "Non-Stage" },
    { id: "general", label: "General" },
  ] as const;

  return (
    <div className="relative overflow-x-hidden min-h-screen bg-[#fffcf5]">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <motion.h1
            variants={fadeIn("left", 0.3)}
            initial="hidden"
            animate="show"
            className="font-bold text-center text-4xl md:text-5xl mb-4 text-[#8B4513]"
          >
            Explore Programs Results
          </motion.h1>
          <motion.p
            variants={fadeIn("down", 0.4)}
            initial="hidden"
            animate="show"
            className="text-center text-gray-700 mb-10 text-lg"
          >
            Discover all approved results and winning moments
          </motion.p>

          <motion.div
            variants={fadeIn("down", 0.5)}
            initial="hidden"
            animate="show"
            className="mb-12 space-y-6"
          >
            {/* Filter Buttons */}
            <div className="flex items-center justify-start md:justify-center gap-2 md:gap-4 py-2 overflow-x-auto no-scrollbar w-full whitespace-nowrap mb-6">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`
                    relative px-4 py-2 md:px-6 md:py-3 rounded-full md:rounded-2xl font-semibold transition-all duration-300 flex-shrink-0 text-sm md:text-base selection:bg-transparent
                    ${filter === f.id
                      ? "text-[#8B4513] bg-[#8B4513]/10"
                      : "bg-white text-gray-500 border border-gray-200 hover:text-[#8B4513] hover:bg-[#8B4513]/5"
                    }
                  `}
                >
                  {f.label}
                  {filter === f.id && (
                    <motion.div
                      layoutId="activeProgramFilter"
                      className="absolute inset-0 rounded-full md:rounded-2xl border-2 border-[#8B4513]/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Programs..."
                className="w-full bg-white border-2 border-gray-300 text-gray-900 h-14 pl-12 pr-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#8B4513] focus:border-[#8B4513] transition duration-300 ease-in-out placeholder:text-gray-400 shadow-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </motion.div>

          {filteredPrograms.length > 0 && (
            <motion.div
              variants={fadeIn("up", 0.6)}
              initial="hidden"
              animate="show"
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {filteredPrograms.map(({ id, program, index }) => {
                const stats = getProgramStats(program.id);
                const result = resultMap.get(program.id);
                return (
                  <ResultProgramCard
                    key={id}
                    program={program}
                    result={result}
                    stats={stats}
                    index={index}
                  />
                );
              })}
            </motion.div>
          )}

          {filteredPrograms.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="flex flex-col items-center gap-4">
                <Search className="w-16 h-16 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-700">
                  No programs found
                </h3>
                <p className="text-gray-600 max-w-md">
                  {search
                    ? `No programs match "${search}". Try a different search term.`
                    : "No approved results available yet. Check back soon!"}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-4 px-6 py-2 rounded-xl bg-[#8B4513]/10 text-[#8B4513] hover:bg-[#8B4513]/20 transition-colors"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

    </div>
  );
}

