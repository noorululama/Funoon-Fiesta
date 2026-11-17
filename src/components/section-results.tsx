"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Program, ResultRecord, Student, Team } from "@/lib/types";
import { ResultProgramCard } from "./result-program-card";
import { Filter } from "lucide-react";
import { calculatePrecalculatedStandings } from "@/lib/score-calculator";
import { TeamLeaderboard } from "./team-leaderboard";

interface SectionResultsProps {
    programs: Program[];
    results: ResultRecord[];
    programMap: Map<string, Program>;
    students: Student[];
    teams: Team[];
}

type FilterType = "stage" | "non-stage" | "general";

export function SectionResults({ programs, results, programMap, students, teams }: SectionResultsProps) {
    const [filter, setFilter] = useState<FilterType>("stage");

    // Switching tabs changes the list height; keep the page where the user was
    // instead of letting the browser jump back up.
    const savedScrollY = useRef<number | null>(null);
    const changeFilter = (next: FilterType) => {
        savedScrollY.current = window.scrollY;
        setFilter(next);
    };
    useLayoutEffect(() => {
        if (savedScrollY.current === null) return;
        const y = savedScrollY.current;
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
        savedScrollY.current = null;
    }, [filter]);

    const resultMap = useMemo(() => new Map(results.map((r) => [r.program_id, r])), [results]);

    const filteredPrograms = useMemo(() => {
        // Only show programs that have results
        const programsWithResults = programs.filter(p => resultMap.has(p.id));

        return programsWithResults.filter((program) => {
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
    }, [programs, resultMap, filter]);

    // Team points for the selected section, using the same rules as the admin
    // "Pre-calculated Scores" page (general programs never count as stage/non-stage).
    const teamStandings = useMemo(() => {
        const calc = calculatePrecalculatedStandings({
            teams,
            liveScores: new Map<string, number>(),
            approvedResults: results,
            pendingResults: [],
            students,
            programs,
        });

        return teams
            .map((team) => {
                const row = calc.teams.find((t) => t.teamId === team.id);
                const points = !row
                    ? 0
                    : filter === "stage"
                        ? row.projectedStagePoints
                        : filter === "non-stage"
                            ? row.projectedNonStagePoints
                            : row.projectedGeneralPoints;
                return { ...team, total_points: points };
            })
            .filter((t) => t.total_points > 0);
    }, [teams, results, students, programs, filter]);

    const getProgramStats = (programId: string) => {
        const program = programMap.get(programId);
        return {
            hasResults: true, // We only show programs with results here
            section: program?.section || "general",
            category: program?.category || "none",
        };
    };

    const filters: { id: FilterType; label: string }[] = [
        { id: "stage", label: "Stage Items" },
        { id: "non-stage", label: "Non-Stage" },
        { id: "general", label: "General" },
    ];

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    return (
        <div className="space-y-8 md:space-y-12">
            {/* Filter Scrollable Tabs */}
            <div className="py-2">
                <div className="mx-auto grid w-full max-w-xl grid-cols-3 gap-2 md:gap-4">
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => changeFilter(f.id)}
                            className={`
                              relative px-2 py-2 md:px-6 md:py-3 rounded-full md:rounded-2xl font-semibold transition-all duration-300 text-[13px] md:text-base whitespace-nowrap selection:bg-transparent
                              ${filter === f.id
                                    ? "bg-[linear-gradient(135deg,#EC8230,#DB3C3F)] text-white shadow-[0_3px_0_#A9362B]"
                                    : "bg-white text-gray-500 border border-gray-100 hover:text-[#C72F36] hover:bg-[#C72F36]/5"
                                }
                            `}
                        >
                            {f.label}
                            {filter === f.id && (
                                <motion.div
                                    layoutId="activeFilter"
                                    className="absolute inset-0 rounded-full md:rounded-2xl border-2 border-transparent"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Section Leaderboard */}
            <motion.div
                key={filter} // Re-animate on filter change
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/50 border border-gray-200/50 rounded-3xl p-4 md:p-8 min-h-[70vh]"
            >
                <div className="text-center mb-8">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-800">
                        {filter.charAt(0).toUpperCase() + filter.slice(1)} Leaderboard
                    </h3>
                    <p className="text-gray-500 text-sm md:text-base">Team standings in {filter.replace("-", " ")} items</p>
                </div>

                <TeamLeaderboard teams={teamStandings as Team[]} />
            </motion.div>


        </div>
    );
}
