"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, ChevronRight, TrendingUp, ChevronDown, MinusCircle } from "lucide-react";
import type { Team, Program, ResultRecord, ResultEntry, Student } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScoreboardTableProps {
  teams: Team[];
  programs: Program[];
  results: ResultRecord[];
  students: Student[];
  liveScores: Map<string, number>;
}

interface TeamCardProps {
  team: Team;
  totalPoints: number;
  medals: { gold: number; silver: number; bronze: number; total: number };
  penaltyPoints: number;
  isActive: boolean;
  onClick: () => void;
  rank: number;
}

function TeamCard({ team, totalPoints, medals, penaltyPoints, isActive, onClick, rank }: TeamCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer transition-all duration-200 relative overflow-hidden",
        isActive ? "ring-2 ring-orange-900/10 shadow-md transform scale-[1.01]" : "hover:shadow-md hover:border-orange-100"
      )}
    >
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Medal className="w-16 h-16" />
      </div>

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
              rank === 1 ? "bg-yellow-100 text-yellow-700" :
                rank === 2 ? "bg-gray-100 text-gray-700" :
                  rank === 3 ? "bg-orange-100 text-orange-800" : "bg-slate-50 text-slate-500"
            )}>
              {rank}
            </div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{team.name}</h3>
          </div>
          <div className="text-right">
            <span className="block text-2xl font-bold text-emerald-600 leading-none">{totalPoints}</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Points</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex gap-2.5">
            {medals.gold > 0 && (
              <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded text-xs text-yellow-700 border border-yellow-100">
                <span>🥇</span>
                <span className="font-bold">{medals.gold}</span>
              </div>
            )}
            {medals.silver > 0 && (
              <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded text-xs text-gray-600 border border-gray-100">
                <span>🥈</span>
                <span className="font-bold">{medals.silver}</span>
              </div>
            )}
            {medals.bronze > 0 && (
              <div className="flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded text-xs text-orange-700 border border-orange-100">
                <span>🥉</span>
                <span className="font-bold">{medals.bronze}</span>
              </div>
            )}
            {medals.total === 0 && <span className="text-xs text-gray-400 italic">No medals yet</span>}
          </div>

          {penaltyPoints > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              <MinusCircle className="w-3 h-3" />
              <span>{penaltyPoints}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface MobileScoreCardProps {
  program: Program;
  teamNames: string[];
  teams: Team[];
  results: ResultRecord[];
  students: Student[];
  isExpanded: boolean;
  onToggle: () => void;
}

function MobileScoreCard({
  program,
  teamNames,
  teams,
  results,
  students,
  isExpanded,
  onToggle,
}: MobileScoreCardProps) {
  const teamNameMap = new Map(teams.map((t) => [t.name, t]));
  const studentMap = new Map(students.map((s) => [s.id, s]));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          isExpanded ? "bg-orange-50/50" : "hover:bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isExpanded ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
          )}>
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">{program.name}</h4>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isExpanded && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 bg-gray-50/30">
              {teamNames.map((teamName) => {
                const team = teamNameMap.get(teamName);
                if (!team) return null;

                const teamResults = results.filter((r) => {
                  return r.entries.some(
                    (e) =>
                      e.team_id === team.id ||
                      (e.student_id && studentMap.get(e.student_id)?.team_id === team.id),
                  );
                });

                if (teamResults.length === 0) return null;

                return (
                  <div key={teamName} className="px-4 py-3 flex items-center justify-between border-b last:border-0 border-gray-100">
                    <span className="text-sm font-medium text-gray-700">{teamName}</span>
                    <div className="flex flex-col items-end gap-1">
                      {teamResults.flatMap((result, resultIdx) => {
                        return result.entries
                          .filter(e => e.team_id === team.id || (e.student_id && studentMap.get(e.student_id)?.team_id === team.id))
                          .map((entry, entryIdx) => (
                            <div key={`${resultIdx}-${entryIdx}`} className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900 font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 shadow-sm">{entry.score}</span>
                              <span className="text-base">
                                {entry.position === 1 && "🥇"}
                                {entry.position === 2 && "🥈"}
                                {entry.position === 3 && "🥉"}
                              </span>
                            </div>
                          ));
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ScoreboardTable({
  teams,
  programs,
  results,
  students,
  liveScores,
}: ScoreboardTableProps) {
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("Single Programs"); // Default open one
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);

  const teamNames = teams.map((t) => t.name);
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Organize programs by section
  const singlePrograms = programs.filter((p) => p.section === "single");
  const generalPrograms = programs.filter((p) => p.section === "general");

  const getTotalPointsForTeam = (teamId: string): number => {
    return liveScores.get(teamId) ?? 0;
  };

  const getTotalPenaltyPoints = (teamId: string): number => {
    let total = 0;
    results.forEach((result) => {
      if (result.penalties) {
        result.penalties.forEach((penalty) => {
          if (penalty.team_id === teamId) {
            total += penalty.points;
          } else if (penalty.student_id) {
            const student = studentMap.get(penalty.student_id);
            if (student?.team_id === teamId) {
              total += penalty.points;
            }
          }
        });
      }
    });
    return total;
  };

  const getMedalCount = (teamId: string) => {
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    results.forEach((result) => {
      result.entries.forEach((entry) => {
        if (entry.team_id === teamId) {
          if (entry.position === 1) gold++;
          if (entry.position === 2) silver++;
          if (entry.position === 3) bronze++;
        } else if (entry.student_id) {
          const student = studentMap.get(entry.student_id);
          if (student?.team_id === teamId) {
            if (entry.position === 1) gold++;
            if (entry.position === 2) silver++;
            if (entry.position === 3) bronze++;
          }
        }
      });
    });

    return { gold, silver, bronze, total: gold + silver + bronze };
  };

  const rankedTeams = useMemo(() => {
    const sorted = [...teams].sort((a, b) => getTotalPointsForTeam(b.id) - getTotalPointsForTeam(a.id));
    let currentRank = 1;
    return sorted.map((team, index) => {
      if (index > 0 && getTotalPointsForTeam(team.id) < getTotalPointsForTeam(sorted[index - 1].id)) {
        currentRank++;
      }
      return { ...team, rank: currentRank };
    });
  }, [teams, liveScores]); // Recalculate if scores change

  const renderMobileView = () => (
    <div className="space-y-8 pb-10">
      {/* Teams Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider pl-1">Live Standings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rankedTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              totalPoints={getTotalPointsForTeam(team.id)}
              medals={getMedalCount(team.id)}
              penaltyPoints={getTotalPenaltyPoints(team.id)}
              isActive={activeTeam === team.id}
              onClick={() => setActiveTeam(activeTeam === team.id ? null : team.id)}
              rank={team.rank}
            />
          ))}
        </div>
      </div>

      {/* Programs List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider pl-1">Program Results</h2>
        <div className="space-y-3">
          {[
            { title: "Single Programs", programs: singlePrograms },
            { title: "General Programs", programs: generalPrograms },
          ].map(({ title, programs: sectionPrograms }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedSection(expandedSection === title ? null : title)}
                className="w-full flex justify-between items-center p-4 bg-white hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-[#8B4513] rounded-full"></div>
                  <span className="font-bold text-gray-800">{title}</span>
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sectionPrograms.length}</span>
                </div>
                <ChevronRight
                  className={cn(
                    "w-5 h-5 text-gray-400 transition-transform duration-300",
                    expandedSection === title ? "rotate-90" : ""
                  )}
                />
              </button>
              <AnimatePresence>
                {expandedSection === title && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden bg-gray-50/50"
                  >
                    <div className="p-3 space-y-3">
                      {sectionPrograms.map((program) => {
                        const programResults = results.filter((r) => r.program_id === program.id);
                        if (programResults.length === 0) return null; // Or show empty state? usually only show with results
                        return (
                          <MobileScoreCard
                            key={program.id}
                            program={program}
                            teamNames={teamNames}
                            teams={teams}
                            results={programResults}
                            students={students}
                            isExpanded={expandedProgram === program.id}
                            onToggle={() => setExpandedProgram(expandedProgram === program.id ? null : program.id)}
                          />
                        );
                      })}
                      {sectionPrograms.every(p => results.filter(r => r.program_id === p.id).length === 0) && (
                        <div className="text-center py-6 text-gray-400 text-sm">
                          No results published in this section yet.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDesktopView = () => {
    const allPrograms = [...singlePrograms, ...generalPrograms];

    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#8B4513] text-white">
              <tr>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider whitespace-nowrap sticky top-0 bg-[#8B4513] z-10 w-1/4">Program</th>
                {teamNames.map((team) => (
                  <th key={team} className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider sticky top-0 bg-[#8B4513] z-10">
                    {team}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allPrograms.map((program, idx) => {
                const programResults = results.filter((r) => r.program_id === program.id);
                return (
                  <tr
                    key={program.id}
                    className={cn(
                      "hover:bg-orange-50/30 transition-colors",
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-orange-50 text-[#8B4513]">
                          <Trophy className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-gray-900">{program.name}</span>
                      </div>
                    </td>
                    {teams.map((team) => {
                      // Get ALL entries for this team in this program
                      const teamEntries: Array<{ entry: ResultEntry; result: ResultRecord }> = [];
                      programResults.forEach((result) => {
                        result.entries.forEach((entry) => {
                          const isTeamEntry = entry.team_id === team.id ||
                            (entry.student_id && studentMap.get(entry.student_id)?.team_id === team.id);
                          if (isTeamEntry) {
                            teamEntries.push({ entry, result });
                          }
                        });
                      });

                      return (
                        <td key={team.id} className="px-4 py-4 text-center align-middle">
                          {teamEntries.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              {teamEntries.map(({ entry }, idx) => (
                                <div key={idx} className="flex items-center justify-center gap-1.5 bg-white border border-gray-100 rounded-md px-1.5 py-0.5 shadow-sm">
                                  <span className="font-bold text-gray-900">
                                    {entry.score}
                                  </span>
                                  {entry.position <= 3 && (
                                    <span className="text-base" role="img" aria-label="medal">
                                      {entry.position === 1 ? "🥇" : entry.position === 2 ? "🥈" : "🥉"}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs font-light">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Total Row */}
              <tr className="bg-[#8B4513]/5 border-t-2 border-[#8B4513]/10 font-bold text-base">
                <td className="px-6 py-5 text-[#8B4513] uppercase tracking-wider">Total Score</td>
                {teams.map((team) => (
                  <td key={team.id} className="px-4 py-5 text-center text-[#8B4513]">
                    {getTotalPointsForTeam(team.id)}
                  </td>
                ))}
              </tr>

              {/* Minus Points Row */}
              <tr className="bg-red-50/50 border-t border-red-100 text-sm">
                <td className="px-6 py-4 text-red-700 font-medium flex items-center gap-2">
                  <MinusCircle className="w-4 h-4" /> Penalties
                </td>
                {teams.map((team) => {
                  const penaltyTotal = getTotalPenaltyPoints(team.id);
                  return (
                    <td key={team.id} className="px-4 py-4 text-center font-medium text-red-600">
                      {penaltyTotal > 0 ? `-${penaltyTotal}` : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const NoDataMessage = () => (
    <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mx-4">
      <div className="bg-white p-4 rounded-full shadow-sm mb-4">
        <Trophy className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900">Live Scoreboard</h3>
      <p className="text-gray-500 mt-1">Waiting for the first results to be published...</p>
    </div>
  );

  const hasData = results.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 md:px-8 max-w-7xl">
      <div className="mb-10 text-center space-y-2">
        <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">
          LIVE <span className="text-[#8B4513]">SCOREBOARD</span>
        </h1>
        <p className="text-gray-500 text-sm md:text-base max-w-lg mx-auto">
          Real-time standings and detailed point breakdown for all houses.
        </p>
      </div>

      {!hasData ? (
        <NoDataMessage />
      ) : (
        <>
          <div className="md:hidden">{renderMobileView()}</div>
          <div className="hidden md:block">{renderDesktopView()}</div>
        </>
      )}
    </div>
  );
}


