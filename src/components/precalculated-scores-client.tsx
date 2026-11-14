"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Calculator,
  Trophy,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  Award,
  Layers,
  Filter,
  RefreshCw,
  Eye,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Team, Program, ResultRecord, Student, LiveScore, Jury } from "@/lib/types";
import {
  calculatePrecalculatedStandings,
  type PrecalculatedScoresData,
} from "@/lib/score-calculator";

interface PrecalculatedScoresClientProps {
  teams: Team[];
  liveScores: LiveScore[];
  approvedResults: ResultRecord[];
  pendingResults: ResultRecord[];
  students: Student[];
  programs: Program[];
  juries: Jury[];
  approveAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
  approveMultipleAction?: (formData: FormData) => Promise<void>;
}

export function PrecalculatedScoresClient({
  teams,
  liveScores,
  approvedResults,
  pendingResults,
  students,
  programs,
  juries,
  approveAction,
  rejectAction,
  approveMultipleAction,
}: PrecalculatedScoresClientProps) {
  const [isPendingTransition, startTransition] = useTransition();

  // Selected pending results to include in simulation (Default: all selected)
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(
    () => new Set(pendingResults.map((r) => r.id)),
  );

  // Active view tab: "teams" | "programs" | "students"
  const [activeTab, setActiveTab] = useState<"teams" | "programs" | "students">("teams");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<"all" | "single" | "general">("all");

  // Expanded team breakdown rows
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Compute precalculated standings dynamically whenever selectedResultIds change
  const precalculation: PrecalculatedScoresData = useMemo(() => {
    return calculatePrecalculatedStandings({
      teams,
      liveScores,
      approvedResults,
      pendingResults,
      students,
      programs,
      selectedPendingResultIds: Array.from(selectedResultIds),
    });
  }, [teams, liveScores, approvedResults, pendingResults, students, programs, selectedResultIds]);

  const programMap = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const juryMap = useMemo(() => new Map(juries.map((j) => [j.id, j])), [juries]);

  // Simulation toggles
  const handleToggleResult = (resultId: string) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedResultIds(new Set(pendingResults.map((r) => r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedResultIds(new Set());
  };

  // Filtered lists
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return precalculation.teams;
    const query = searchQuery.toLowerCase();
    return precalculation.teams.filter(
      (t) =>
        t.teamName.toLowerCase().includes(query) ||
        t.teamLeader.toLowerCase().includes(query),
    );
  }, [precalculation.teams, searchQuery]);

  const filteredStudents = useMemo(() => {
    let list = precalculation.students;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName.toLowerCase().includes(query) ||
          s.chestNo.toLowerCase().includes(query) ||
          s.teamName.toLowerCase().includes(query),
      );
    }
    return list;
  }, [precalculation.students, searchQuery]);

  const filteredPendingResults = useMemo(() => {
    let list = precalculation.pendingResultsImpacts;
    if (sectionFilter !== "all") {
      list = list.filter((r) => r.programSection === sectionFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.programName.toLowerCase().includes(query) ||
          r.juryName.toLowerCase().includes(query) ||
          r.teamsImpacted.some((t) => t.teamName.toLowerCase().includes(query)),
      );
    }
    return list;
  }, [precalculation.pendingResultsImpacts, sectionFilter, searchQuery]);

  const allSelected =
    pendingResults.length > 0 && selectedResultIds.size === pendingResults.length;
  const noneSelected = selectedResultIds.size === 0;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-indigo-950/80 via-slate-900/90 to-fuchsia-950/70 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.6)]">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone="cyan" className="gap-1.5 py-1">
                <Calculator className="h-3.5 w-3.5" />
                Admin Pre-calculation Simulator
              </Badge>
              <span className="text-xs text-white/50 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                🔒 Private preview • Not visible to public
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Pre-calculated Standings & Score Preview
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-2xl">
              Simulate and preview projected scores, medals, and rank changes across all teams before officially approving results to the public scoreboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/admin/pending-results">
              <Button
                variant="ghost"
                size="sm"
                className="border border-white/15 bg-white/5 text-white hover:bg-white/10 gap-2"
              >
                Review Pending ({pendingResults.length})
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Executive Summary KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Current Leader */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-white/50">Current Public Leader</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg md:text-xl font-bold text-white truncate">
                {precalculation.summary.currentLeader?.name || "None"}
              </span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {precalculation.summary.currentLeader?.points ?? 0} pts
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">From approved results</p>
          </div>

          {/* Projected Leader */}
          <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-4 backdrop-blur-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-fuchsia-300">Projected Leader</p>
              {precalculation.summary.hasLeaderChanged && (
                <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Lead Change!
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg md:text-xl font-bold text-fuchsia-100 truncate">
                {precalculation.summary.projectedLeader?.name || "None"}
              </span>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                {precalculation.summary.projectedLeader?.points ?? 0} pts
              </span>
            </div>
            <p className="mt-1 text-[11px] text-fuchsia-200/60">
              {precalculation.summary.hasLeaderChanged
                ? "Dethrones current leader"
                : "Retains top spot"}
            </p>
          </div>

          {/* Pending Points In Play */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-white/50">Pending Points in Play</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg md:text-xl font-bold text-emerald-400">
                +{precalculation.summary.totalPointsInPlay} pts
              </span>
              <span className="text-xs text-white/60">
                {precalculation.summary.selectedPendingResultsCount} programs
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              {precalculation.summary.totalPenaltiesInPlay > 0
                ? `Includes -${precalculation.summary.totalPenaltiesInPlay} pts penalties`
                : "No penalties in selection"}
            </p>
          </div>

          {/* Biggest Gainer */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-white/50">Biggest Gainer Team</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg md:text-xl font-bold text-cyan-300 truncate">
                {precalculation.summary.biggestGainer?.name || "None"}
              </span>
              {precalculation.summary.biggestGainer && (
                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                  +{precalculation.summary.biggestGainer.gain} pts
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-white/40">Highest points from pending</p>
          </div>
        </div>
      </div>

      {/* Simulator Control & Filter Bar */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-white/50 mr-1">
              Simulation:
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSelectAll}
              disabled={allSelected}
              className={`text-xs h-8 ${allSelected ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-white/5 text-white/70 hover:text-white"}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              Include All ({pendingResults.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDeselectAll}
              disabled={noneSelected}
              className="text-xs h-8 border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            >
              Clear Selection
            </Button>
            <span className="text-xs text-white/40 ml-2">
              Showing impact of <strong className="text-white">{selectedResultIds.size}</strong> of {pendingResults.length} pending results
            </span>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 border border-white/10 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("teams")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === "teams"
                  ? "bg-fuchsia-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
                }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              Team Standings ({precalculation.teams.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("programs")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === "programs"
                  ? "bg-fuchsia-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
                }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Pending Programs ({pendingResults.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("students")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === "students"
                  ? "bg-fuchsia-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
                }`}
            >
              <Users className="h-3.5 w-3.5" />
              Top Students
            </button>
          </div>
        </div>

        {/* Search & Section Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder={
                activeTab === "teams"
                  ? "Search by team name or leader..."
                  : activeTab === "students"
                    ? "Search by student name, chest no, or team..."
                    : "Search pending program or jury..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm h-9"
            />
          </div>

          {activeTab === "programs" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Section:</span>
              <div className="flex rounded-lg bg-white/5 p-1 border border-white/10">
                {(["all", "single", "general"] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSectionFilter(sec)}
                    className={`px-3 py-1 text-xs rounded font-medium capitalize transition ${sectionFilter === sec
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:text-white"
                      }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {pendingResults.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center">
          <Award className="mx-auto h-12 w-12 text-white/20 mb-3" />
          <h3 className="text-lg font-semibold text-white">No Pending Results</h3>
          <p className="mt-1 text-sm text-white/60 max-w-md mx-auto">
            All submitted results have already been approved and are reflected on the public scoreboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/scoreboard" target="_blank">
              <Button variant="secondary" size="sm" className="gap-2">
                <Trophy className="h-4 w-4" />
                View Public Scoreboard
              </Button>
            </Link>
          </div>
        </div>
      ) : activeTab === "teams" ? (
        /* ================== TAB 1: TEAM STANDINGS ================== */
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/5">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Projected Team Standings
                </h3>
                <p className="text-xs text-white/60">
                  Side-by-side comparison of Current Approved Points vs Pre-calculated Total Points
                </p>
              </div>
              <span className="text-xs text-white/50 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                {precalculation.teams.length} Teams Ranked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50 bg-white/2">
                    <th className="py-3.5 px-4 font-semibold text-center w-16">Rank</th>
                    <th className="py-3.5 px-4 font-semibold">Team</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Current Pts</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Pending Net</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Projected Total</th>
                    <th className="py-3.5 px-4 font-semibold text-center hidden md:table-cell">Medals (Proj)</th>
                    <th className="py-3.5 px-4 font-semibold text-center hidden lg:table-cell">Penalties</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredTeams.map((team) => {
                    const isExpanded = expandedTeamId === team.teamId;
                    const hasPending = team.pendingNetPoints !== 0 || team.pendingAdditions > 0;

                    return (
                      <React.Fragment key={team.teamId}>
                        <tr
                          className={`transition hover:bg-white/5 ${isExpanded ? "bg-white/5" : ""
                            }`}
                        >
                          {/* Rank with Movement Indicator */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs ${team.projectedRank === 1
                                    ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
                                    : team.projectedRank === 2
                                      ? "bg-slate-300 text-black"
                                      : team.projectedRank === 3
                                        ? "bg-amber-700 text-white"
                                        : "bg-white/10 text-white/80"
                                  }`}
                              >
                                {team.projectedRank}
                              </span>

                              {/* Shift arrow */}
                              <div className="mt-1 flex items-center text-[10px] font-bold">
                                {team.rankShift > 0 ? (
                                  <span className="flex items-center text-emerald-400" title={`Jumped ${team.rankShift} rank(s)`}>
                                    <TrendingUp className="h-3 w-3 mr-0.5" />
                                    +{team.rankShift}
                                  </span>
                                ) : team.rankShift < 0 ? (
                                  <span className="flex items-center text-rose-400" title={`Dropped ${Math.abs(team.rankShift)} rank(s)`}>
                                    <TrendingDown className="h-3 w-3 mr-0.5" />
                                    {team.rankShift}
                                  </span>
                                ) : (
                                  <span className="flex items-center text-white/30" title="Rank unchanged">
                                    <Minus className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Team Name */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="h-3.5 w-3.5 rounded-full ring-2 ring-white/20 shrink-0"
                                style={{ backgroundColor: team.teamColor }}
                              />
                              <div>
                                <p className="font-semibold text-white leading-tight">
                                  {team.teamName}
                                </p>
                                <p className="text-xs text-white/40 mt-0.5">
                                  Leader: {team.teamLeader}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Current Points */}
                          <td className="py-4 px-4 text-center text-white/70">
                            <span className="font-medium">{team.currentPoints}</span>
                            <span className="block text-[10px] text-white/40">
                              Rank #{team.currentRank}
                            </span>
                          </td>

                          {/* Pending Net */}
                          <td className="py-4 px-4 text-center">
                            {team.pendingNetPoints > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/20">
                                +{team.pendingNetPoints}
                              </span>
                            ) : team.pendingNetPoints < 0 ? (
                              <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300 border border-rose-500/20">
                                {team.pendingNetPoints}
                              </span>
                            ) : (
                              <span className="text-xs text-white/30">0</span>
                            )}
                            {team.pendingDeductions > 0 && (
                              <span className="block text-[10px] text-rose-300/80">
                                (-{team.pendingDeductions} pen)
                              </span>
                            )}
                          </td>

                          {/* Projected Total */}
                          <td className="py-4 px-4 text-center">
                            <span className="text-base font-bold text-emerald-400">
                              {team.projectedPoints}
                            </span>
                            <span className="block text-[10px] text-white/40">
                              Projected Pts
                            </span>
                          </td>

                          {/* Medals */}
                          <td className="py-4 px-4 text-center hidden md:table-cell">
                            <div className="flex items-center justify-center gap-1.5 text-xs">
                              <span className="inline-flex items-center gap-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 px-1.5 py-0.5 rounded">
                                🥇 {team.projectedMedals.gold}
                                {team.pendingMedals.gold > 0 && (
                                  <span className="text-[10px] text-emerald-400 font-bold">
                                    (+{team.pendingMedals.gold})
                                  </span>
                                )}
                              </span>
                              <span className="inline-flex items-center gap-0.5 bg-slate-300/10 text-slate-200 border border-slate-300/20 px-1.5 py-0.5 rounded">
                                🥈 {team.projectedMedals.silver}
                                {team.pendingMedals.silver > 0 && (
                                  <span className="text-[10px] text-emerald-400 font-bold">
                                    (+{team.pendingMedals.silver})
                                  </span>
                                )}
                              </span>
                              <span className="inline-flex items-center gap-0.5 bg-amber-700/10 text-amber-500 border border-amber-700/20 px-1.5 py-0.5 rounded">
                                🥉 {team.projectedMedals.bronze}
                                {team.pendingMedals.bronze > 0 && (
                                  <span className="text-[10px] text-emerald-400 font-bold">
                                    (+{team.pendingMedals.bronze})
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Penalties */}
                          <td className="py-4 px-4 text-center text-xs text-white/60 hidden lg:table-cell">
                            {team.projectedPenalties > 0 ? (
                              <span className="text-rose-400 font-semibold">
                                -{team.projectedPenalties} pts
                              </span>
                            ) : (
                              <span className="text-white/30">—</span>
                            )}
                          </td>

                          {/* Details Toggle Button */}
                          <td className="py-4 px-4 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedTeamId(isExpanded ? null : team.teamId)
                              }
                              className="text-xs text-white/70 hover:text-white border border-white/10 hover:bg-white/10 h-8 gap-1.5"
                            >
                              <span>{isExpanded ? "Hide" : "Breakdown"}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Breakdown Row */}
                        {isExpanded && (
                          <tr className="bg-slate-950/60 border-y border-white/10">
                            <td colSpan={8} className="p-4 md:p-6">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs uppercase font-bold tracking-wider text-white/70">
                                    Pending Programs Contributing to {team.teamName}
                                  </h4>
                                  <span className="text-xs text-white/40">
                                    {team.contributions.length} contributing program(s)
                                  </span>
                                </div>

                                {team.contributions.length === 0 ? (
                                  <p className="text-xs text-white/40 italic py-2">
                                    No pending results currently award points to this team in the active simulation.
                                  </p>
                                ) : (
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {team.contributions.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs space-y-1"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="font-semibold text-white truncate">
                                            {item.programName}
                                          </span>
                                          <span className="font-bold text-emerald-400 shrink-0">
                                            +{item.pointsAdded} pts
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-white/50 text-[11px]">
                                          <span className="capitalize">{item.section}</span>
                                          {item.position && (
                                            <span>
                                              • {item.position === 1 ? "1st Place 🥇" : item.position === 2 ? "2nd Place 🥈" : "3rd Place 🥉"}
                                            </span>
                                          )}
                                          {item.grade && item.grade !== "none" && (
                                            <span>• Grade {item.grade}</span>
                                          )}
                                        </div>
                                        {item.winnerName && (
                                          <p className="text-white/70 text-[11px] truncate">
                                            Winner: {item.winnerName}
                                          </p>
                                        )}
                                        {item.penaltiesSubtracted > 0 && (
                                          <p className="text-rose-400 font-semibold text-[11px]">
                                            Penalty: -{item.penaltiesSubtracted} pts
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "programs" ? (
        /* ================== TAB 2: PENDING PROGRAMS IMPACT ================== */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-base font-semibold text-white">
                Pending Programs Impact Analysis
              </h3>
              <p className="text-xs text-white/60">
                Check or uncheck programs to simulate their impact on the projected standings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleSelectAll}
                className="text-xs h-7 bg-white/10 text-white"
              >
                Select All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleDeselectAll}
                className="text-xs h-7 text-white/60"
              >
                Deselect All
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredPendingResults.map((result) => {
              const isSelected = selectedResultIds.has(result.resultId);

              return (
                <div
                  key={result.resultId}
                  className={`rounded-2xl border transition-all duration-200 p-4 md:p-5 ${isSelected
                      ? "border-emerald-500/40 bg-slate-900/80 shadow-[0_10px_30px_rgba(16,185,129,0.1)]"
                      : "border-white/10 bg-slate-900/40 opacity-70"
                    }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Program Information */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleResult(result.resultId)}
                        className="mt-1 h-5 w-5 rounded border-white/20 bg-white/10 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                        id={`chk-${result.resultId}`}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={`chk-${result.resultId}`}
                            className="text-base md:text-lg font-bold text-white hover:text-emerald-300 cursor-pointer"
                          >
                            {result.programName}
                          </label>
                          <Badge tone="cyan" className="text-[10px] py-0.5">
                            {result.programSection}
                          </Badge>
                          {result.programCategory !== "none" && (
                            <span className="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                              Cat {result.programCategory}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                          Submitted by <strong className="text-white/80">{result.juryName}</strong> •{" "}
                          {new Date(result.submittedAt).toLocaleDateString()} {new Date(result.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {/* Impact Pills on Teams */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-white/40 font-medium">Team Impact:</span>
                      {result.teamsImpacted.map((teamImpact) => (
                        <div
                          key={teamImpact.teamId}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: teamImpact.teamColor }}
                          />
                          <span className="font-semibold text-white">
                            {teamImpact.teamName}
                          </span>
                          <span className="font-bold text-emerald-400">
                            +{teamImpact.netPoints} pts
                          </span>
                          {teamImpact.positions.length > 0 && (
                            <span className="text-white/40 text-[10px]">
                              ({teamImpact.positions.map((p) => (p === 1 ? "1st" : p === 2 ? "2nd" : "3rd")).join(", ")})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Quick Approve / Reject Actions */}
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
                      <Link href={`/admin/pending-results/${result.resultId}/edit`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </Link>

                      <form action={approveAction}>
                        <input type="hidden" name="id" value={result.resultId} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/30 gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </form>

                      <form action={rejectAction}>
                        <input type="hidden" name="id" value={result.resultId} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="danger"
                          className="h-8 text-xs gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </form>
                    </div>
                  </div>

                  {/* Winners Details List */}
                  <div className="mt-4 pt-3 border-t border-white/5 grid gap-2 sm:grid-cols-3">
                    {result.entries.map((entry) => (
                      <div
                        key={entry.position}
                        className="rounded-lg border border-white/5 bg-white/2 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-white/50">
                          <span>
                            {entry.position === 1 ? "1st Place 🥇" : entry.position === 2 ? "2nd Place 🥈" : "3rd Place 🥉"}
                          </span>
                          <span className="font-bold text-emerald-400">
                            {entry.score} pts
                          </span>
                        </div>
                        <p className="font-semibold text-white mt-1 truncate">
                          {entry.name}
                        </p>
                        <p className="text-[11px] text-white/50 truncate">
                          Team: {entry.teamName}
                          {entry.grade && entry.grade !== "none" ? ` • Grade ${entry.grade}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>

                  {result.penalties.length > 0 && (
                    <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>
                        Penalties applied:{" "}
                        {result.penalties.map((p) => `${p.targetName} (-${p.points} pts)`).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================== TAB 3: TOP STUDENTS ================== */
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/5">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  Pre-calculated Individual Student Standings
                </h3>
                <p className="text-xs text-white/60">
                  Individual championship standings with simulated points from pending single programs
                </p>
              </div>
              <span className="text-xs text-white/50 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                {filteredStudents.length} Students with Points
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50 bg-white/2">
                    <th className="py-3 px-4 font-semibold text-center w-16">Rank</th>
                    <th className="py-3 px-4 font-semibold">Student Name</th>
                    <th className="py-3 px-4 font-semibold">Chest No</th>
                    <th className="py-3 px-4 font-semibold">Team</th>
                    <th className="py-3 px-4 font-semibold text-center">Current</th>
                    <th className="py-3 px-4 font-semibold text-center">Pending</th>
                    <th className="py-3 px-4 font-semibold text-center">Projected Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredStudents.slice(0, 50).map((student) => (
                    <tr key={student.studentId} className="hover:bg-white/5 transition">
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-bold text-xs ${student.projectedRank === 1
                              ? "bg-amber-400 text-black"
                              : student.projectedRank === 2
                                ? "bg-slate-300 text-black"
                                : student.projectedRank === 3
                                  ? "bg-amber-700 text-white"
                                  : "bg-white/10 text-white/80"
                            }`}
                        >
                          {student.projectedRank}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {student.studentName}
                      </td>
                      <td className="py-3 px-4 text-white/70 font-mono text-xs">
                        #{student.chestNo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-white/80">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: student.teamColor }}
                          />
                          {student.teamName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-white/60">
                        {student.currentPoints} pts
                      </td>
                      <td className="py-3 px-4 text-center">
                        {student.pendingPoints > 0 ? (
                          <span className="text-emerald-400 font-bold">
                            +{student.pendingPoints} pts
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-400">
                        {student.projectedPoints} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
