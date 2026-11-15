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
  ArrowRight,
  Theater,
  Palette,
  Flag,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Team, Program, ResultRecord, Student, LiveScore, Jury } from "@/lib/types";
import {
  calculatePrecalculatedStandings,
  type PrecalculatedScoresData,
  type ProgramType,
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
}: PrecalculatedScoresClientProps) {
  // Selected pending results to include in simulation (Default: all selected)
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(
    () => new Set(pendingResults.map((r) => r.id)),
  );

  // Active main tab: "teams" | "programs" | "students"
  const [activeTab, setActiveTab] = useState<"teams" | "programs" | "students">("teams");

  // Team sort filter: "overall" | "stage" | "non-stage" | "general"
  const [teamSort, setTeamSort] = useState<"overall" | "stage" | "non-stage" | "general">("overall");

  // Student sort filter: "overall" | "stage" | "non-stage"
  const [studentSort, setStudentSort] = useState<"overall" | "stage" | "non-stage">("overall");

  // Search & section filter
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

  // Filtered & Sorted Teams
  const filteredTeams = useMemo(() => {
  let list = [...precalculation.teams];

  // Apply search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    list = list.filter(
      (t) =>
        t.teamName.toLowerCase().includes(query) ||
        t.teamLeader.toLowerCase().includes(query),
    );
  }

  // Apply team sorting
  if (teamSort === "stage") {
    list.sort((a, b) => b.projectedStagePoints - a.projectedStagePoints);
  } else if (teamSort === "non-stage") {
    list.sort((a, b) => b.projectedNonStagePoints - a.projectedNonStagePoints);
  } else if (teamSort === "general") {
    list.sort((a, b) => b.projectedGeneralPoints - a.projectedGeneralPoints);
  } else {
    list.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }

  return list;
}, [precalculation.teams, searchQuery, teamSort]);

// Filtered & Sorted Students
const filteredStudents = useMemo(() => {
  let list = [...precalculation.students];

  // Apply search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    list = list.filter(
      (s) =>
        s.studentName.toLowerCase().includes(query) ||
        s.chestNo.toLowerCase().includes(query) ||
        s.teamName.toLowerCase().includes(query),
    );
  }

  // Apply student sorting
  if (studentSort === "stage") {
    // Prioritize students with stage points
    list = list.filter((s) => s.projectedStagePoints > 0 || s.pendingStagePoints > 0);
    list.sort((a, b) => b.projectedStagePoints - a.projectedStagePoints);
  } else if (studentSort === "non-stage") {
    // Prioritize students with non-stage points
    list = list.filter((s) => s.projectedNonStagePoints > 0 || s.pendingNonStagePoints > 0);
    list.sort((a, b) => b.projectedNonStagePoints - a.projectedNonStagePoints);
  } else {
    list.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }

  return list;
  }, [precalculation.students, searchQuery, studentSort]);

// Filtered Pending Results
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
            Preview total team scores, Stage, Non-Stage, and General totals, and individual student scores (Overall, Stage, Non-Stage) before official approval.
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
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-1 text-[11px] text-white/40">From approved results only</p>
        </div>

        {/* Projected Overall Leader */}
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
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-white/50">
            <span className="text-cyan-300">Stage: +{precalculation.summary.stagePointsInPlay}</span>
            <span>•</span>
            <span className="text-purple-300">Non-Stage: +{precalculation.summary.nonStagePointsInPlay}</span>
            <span>•</span>
            <span className="text-amber-300">General: +{precalculation.summary.generalPointsInPlay}</span>
          </div>
        </div>

        {/* Section Leaders */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wider text-white/50">Projected Section Leaders</p>
                <div className="mt-1 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-cyan-300 flex items-center gap-1 text-[11px]">
                      <Theater className="h-3 w-3" /> Stage:
                    </span>
                    <span className="font-semibold text-white truncate max-w-[120px]">
                      {precalculation.summary.stageLeader?.name ?? "—"} ({precalculation.summary.stageLeader?.points ?? 0})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-purple-300 flex items-center gap-1 text-[11px]">
                      <Palette className="h-3 w-3" /> Non-Stage:
                    </span>
                    <span className="font-semibold text-white truncate max-w-[120px]">
                      {precalculation.summary.nonStageLeader?.name ?? "—"} ({precalculation.summary.nonStageLeader?.points ?? 0})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-300 flex items-center gap-1 text-[11px]">
                      <Flag className="h-3 w-3" /> General:
                    </span>
                    <span className="font-semibold text-white truncate max-w-[120px]">
                      {precalculation.summary.generalLeader?.name ?? "—"} ({precalculation.summary.generalLeader?.points ?? 0})
                    </span>
                  </div>
                </div>
              </div>
        </div>
        </div>

        {/* Simulator Control Bar */}
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
                Simulating <strong className="text-white">{selectedResultIds.size}</strong> of {pendingResults.length} pending results
              </span>
            </div>

            {/* Main Tab Selector */}
            <div className="flex items-center gap-1 rounded-2xl bg-white/5 p-1 border border-white/10 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("teams")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === "teams"
                    ? "bg-fuchsia-600 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              Team Scores ({precalculation.teams.length})
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
            Individual Scores ({precalculation.students.length})
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
      </div>
    </div>

        {/* Search & Sub-sort Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
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

          {/* Team Sort Pills */}
          {activeTab === "teams" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-white/50 mr-1">Sort Teams by:</span>
              {(
                [
                  { id: "overall", label: "Overall Total" },
                  { id: "stage", label: "Stage Total" },
                  { id: "non-stage", label: "Non-Stage Total" },
                  { id: "general", label: "General Total" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTeamSort(opt.id)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition ${teamSort === opt.id
                      ? "bg-fuchsia-600 text-white shadow-sm"
                      : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Student Sort Pills (User requested: stage, Non Stage, over all) */}
          {activeTab === "students" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-white/50 mr-1">Sort Students by:</span>
              {(
                [
                  { id: "overall", label: "Overall Individual" },
                  { id: "stage", label: "Stage Items" },
                  { id: "non-stage", label: "Non-Stage Items" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStudentSort(opt.id)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition ${studentSort === opt.id
                      ? "bg-fuchsia-600 text-white shadow-sm"
                      : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Program Section Filter */}
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
      /* ================== TAB 1: TEAM SCORES (TOTAL, STAGE, NON-STAGE, GENERAL) ================== */
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/5">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                Pre-calculated Team Scores & Section Standings
              </h3>
              <p className="text-xs text-white/60">
                Showing Total Team Score alongside Stage, Non-Stage, and General totals (General events are separated and not added into stage or non-stage).
              </p>
            </div>
            <span className="text-xs text-white/50 bg-black/20 px-3 py-1 rounded-full border border-white/5">
              Sorted by {teamSort === "overall" ? "Overall Total" : teamSort === "stage" ? "Stage Total" : teamSort === "non-stage" ? "Non-Stage Total" : "General Total"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50 bg-white/2">
                  <th className="py-3.5 px-4 font-semibold text-center w-16">Rank</th>
                  <th className="py-3.5 px-4 font-semibold">Team</th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    <span className="text-cyan-300">Stage Total</span>
                    <span className="block text-[9px] text-white/40 normal-case">Single Stage</span>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    <span className="text-purple-300">Non-Stage Total</span>
                    <span className="block text-[9px] text-white/40 normal-case">Single Non-Stage</span>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    <span className="text-amber-300">General Total</span>
                    <span className="block text-[9px] text-white/40 normal-case">Group Events</span>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center hidden md:table-cell">Penalties</th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    <span className="text-emerald-400 font-bold">Total Team Score</span>
                    <span className="block text-[9px] text-white/40 normal-case">Overall Standings</span>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center hidden lg:table-cell">Medals</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                  {
                    filteredTeams.map((team, index) => {
                      const isExpanded = expandedTeamId === team.teamId;

                      // Display rank based on the active sort
                      const displayRank =
                        teamSort === "stage"
                          ? team.stageRank
                          : teamSort === "non-stage"
                            ? team.nonStageRank
                            : teamSort === "general"
                              ? team.generalRank
                              : team.projectedRank;

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
                                className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs ${displayRank === 1
                                      ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
                                    : displayRank === 2
                                ? "bg-slate-300 text-black"
                                : displayRank === 3
                                ? "bg-amber-700 text-white"
                                : "bg-white/10 text-white/80"
                                }`}
                              >
                                {displayRank}
                              </span>

                              {teamSort === "overall" && (
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
                              )}
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

                              {/* Stage Total */}
                              <td className="py-4 px-4 text-center">
                                <span className="text-sm font-semibold text-cyan-300">
                                  {team.projectedStagePoints}
                                </span>
                                {team.pendingStagePoints > 0 && (
                                  <span className="block text-[10px] text-emerald-400 font-medium">
                                    (+{team.pendingStagePoints} pend)
                                  </span>
                                )}
                                <span className="block text-[9px] text-white/30">
                                  cur: {team.currentStagePoints}
                                </span>
                              </td>

                              {/* Non-Stage Total */}
                              <td className="py-4 px-4 text-center">
                                    <span className="text-sm font-semibold text-purple-300">
                                      {team.projectedNonStagePoints}
                                    </span>
                                    {team.pendingNonStagePoints > 0 && (
                                      <span className="block text-[10px] text-emerald-400 font-medium">
                                        (+{team.pendingNonStagePoints} pend)
                                      </span>
                            )}
                                      <span className="block text-[9px] text-white/30">
                                        cur: {team.currentNonStagePoints}
                                      </span>
                                    </td>

                                    {/* General Total */}
                                    <td className="py-4 px-4 text-center">
                                      <span className="text-sm font-semibold text-amber-300">
                                        {team.projectedGeneralPoints}
                                      </span>
                                      {team.pendingGeneralPoints > 0 && (
                                        <span className="block text-[10px] text-emerald-400 font-medium">
                                          (+{team.pendingGeneralPoints} pend)
                                        </span>
                            )}
                                          <span className="block text-[9px] text-white/30">
                                            cur: {team.currentGeneralPoints}
                                          </span>
                                        </td>

                          {/* Penalties */}
                                      <td className="py-4 px-4 text-center hidden md:table-cell">
                                        {team.projectedPenalties > 0 ? (
                                          <span className="text-rose-400 font-semibold text-xs">
                                            -{team.projectedPenalties} pts
                                          </span>
                                        ) : (
                                          <span className="text-white/30 text-xs">—</span>
                                        )}
                                      </td>

                                          {/* Total Team Score */}
                                          <td className="py-4 px-4 text-center bg-white/2">
                                            <span className="text-base font-black text-emerald-400">
                                              {team.projectedPoints}
                                            </span>
                                              {team.pendingNetPoints !== 0 && (
                                                <span
                                                  className={`block text-[10px] font-bold ${team.pendingNetPoints > 0 ? "text-emerald-300" : "text-rose-300"
                                                    }`}
                                                >
                                                  {team.pendingNetPoints > 0 ? `+${team.pendingNetPoints}` : team.pendingNetPoints} net
                                                </span>
                                              )}
                                              <span className="block text-[9px] text-white/30">
                                                Approved: {team.currentPoints} pts
                                              </span>
                                          </td>

                                          {/* Medals */}
                                              <td className="py-4 px-4 text-center hidden lg:table-cell">
                                                <div className="flex items-center justify-center gap-1 text-xs">
                                                  <span className="inline-flex items-center gap-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 px-1.5 py-0.5 rounded">
                                                    🥇 {team.projectedMedals.gold}
                                                  </span>
                                                  <span className="inline-flex items-center gap-0.5 bg-slate-300/10 text-slate-200 border border-slate-300/20 px-1.5 py-0.5 rounded">
                                                    🥈 {team.projectedMedals.silver}
                                                  </span>
                                                  <span className="inline-flex items-center gap-0.5 bg-amber-700/10 text-amber-500 border border-amber-700/20 px-1.5 py-0.5 rounded">
                                                    🥉 {team.projectedMedals.bronze}
                                                  </span>
                                                </div>
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
                                                  <td colSpan={9} className="p-4 md:p-6">
                                                    <div className="space-y-3">
                                                      <div className="flex items-center justify-between">
                                                        <h4 className="text-xs uppercase font-bold tracking-wider text-white/70">
                                                          Contributing Programs for {team.teamName}
                                                        </h4>
                                                        <span className="text-xs text-white/40">
                                                          {team.contributions.length} program(s) in active simulation
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
                                                                <div className="flex items-center gap-1.5 text-white/60 text-[11px]">
                                                                  <span
                                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${item.stageType === "stage"
                                                                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                                                        : item.stageType === "non-stage"
                                                                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                                                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                                      }`}
                                                                  >
                                                                    {item.stageType === "stage"
                                                                      ? "Stage"
                                                                      : item.stageType === "non-stage"
                                                                        ? "Non-Stage"
                                                                        : "General"}
                                                                  </span>
                                                                  {item.position && (
                                                                    <span>
                                                                      • {item.position === 1 ? "1st 🥇" : item.position === 2 ? "2nd 🥈" : "3rd 🥉"}
                                                                    </span>
                                                                  )}
                                                                  {item.grade && item.grade !== "none" && (
                                            <span>• Gr {item.grade}</span>
                                                                  )}
                                                                </div>
                                                                {item.winnerName && (
                                                                  <p className="text-white/70 text-[11px] truncate">
                                                                    Participant: {item.winnerName}
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
                              ) : activeTab === "students" ? (
                              /* ================== TAB 2: TOP STUDENTS (OVERALL, STAGE, NON-STAGE) ================== */
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-xl">
                                  <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/5">
                                    <div>
                                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                        <Users className="h-4 w-4 text-cyan-400" />
                                        Pre-calculated Individual Student Standings
                                      </h3>
                                      <p className="text-xs text-white/60">
                                        Total individual score breakdown into Stage and Non-Stage points (General programs are not included in individual student scores).
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-white/50 mr-1">Sort:</span>
                                      <span className="text-xs text-fuchsia-300 font-bold bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-1 rounded-full uppercase">
                                        {studentSort === "overall"
                                          ? "Overall Total"
                                          : studentSort === "stage"
                                            ? "Stage Items"
                                            : "Non-Stage Items"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50 bg-white/2">
                                          <th className="py-3 px-4 font-semibold text-center w-16">
                                            {studentSort === "stage"
                                              ? "Stage Rank"
                                              : studentSort === "non-stage"
                                                ? "Non-Stage Rank"
                                                : "Overall Rank"}
                                          </th>
                                          <th className="py-3 px-4 font-semibold">Student Name</th>
                                          <th className="py-3 px-4 font-semibold">Chest No</th>
                                          <th className="py-3 px-4 font-semibold">Team</th>
                                          <th className="py-3 px-4 font-semibold text-center">
                                            <span className="text-cyan-300">Stage Points</span>
                                            <span className="block text-[9px] text-white/40 normal-case">Single Stage</span>
                                          </th>
                                          <th className="py-3 px-4 font-semibold text-center">
                                            <span className="text-purple-300">Non-Stage Points</span>
                                            <span className="block text-[9px] text-white/40 normal-case">Single Off-Stage</span>
                                          </th>
                                          <th className="py-3 px-4 font-semibold text-center bg-white/2">
                                            <span className="text-emerald-400 font-bold">Total Individual Score</span>
                                            <span className="block text-[9px] text-white/40 normal-case">Stage + Non-Stage</span>
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5 text-sm">
                                        {filteredStudents.length === 0 ? (
                                          <tr>
                                            <td colSpan={7} className="py-8 text-center text-white/50 text-xs">
                                              No students found matching your filters.
                                            </td>
                                          </tr>
                                        ) : (
                                          filteredStudents.slice(0, 100).map((student) => {
                                            const activeRank =
                                              studentSort === "stage"
                                                ? student.stageRank
                                                : studentSort === "non-stage"
                                                  ? student.nonStageRank
                                                  : student.overallRank;

                                            const activeShift =
                                              studentSort === "stage"
                                                ? student.stageRankShift
                                                : studentSort === "non-stage"
                                                  ? student.nonStageRankShift
                                                  : student.rankShift;

                                            return (
                                              <tr key={student.studentId} className="hover:bg-white/5 transition">
                                                <td className="py-3.5 px-4 text-center">
                                                  <div className="flex flex-col items-center justify-center">
                                                    <span
                                                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-bold text-xs ${activeRank === 1
                                                          ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                                                          : activeRank === 2
                                                            ? "bg-slate-300 text-black"
                                                            : activeRank === 3
                                                              ? "bg-amber-700 text-white"
                                                              : "bg-white/10 text-white/80"
                                                        }`}
                                                    >
                                                      {activeRank}
                                                    </span>
                                                    {activeShift !== 0 && (
                                                      <span
                                                        className={`text-[9px] font-bold mt-0.5 ${activeShift > 0 ? "text-emerald-400" : "text-rose-400"
                                                          }`}
                                                      >
                                                        {activeShift > 0 ? `+${activeShift}` : activeShift}
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>

                                                <td className="py-3.5 px-4 font-semibold text-white">
                                                  {student.studentName}
                                                </td>

                                                <td className="py-3.5 px-4 text-white/70 font-mono text-xs">
                                                  #{student.chestNo}
                                                </td>

                                                <td className="py-3.5 px-4">
                                                  <span className="inline-flex items-center gap-1.5 text-xs text-white/80">
                                                    <span
                                                      className="h-2.5 w-2.5 rounded-full shrink-0"
                                                      style={{ backgroundColor: student.teamColor }}
                                                    />
                                                    {student.teamName}
                                                  </span>
                                                </td>

                                                {/* Stage Points */}
                                                <td className="py-3.5 px-4 text-center">
                                                  <span className="text-cyan-300 font-semibold">
                                                    {student.projectedStagePoints}
                                                  </span>
                                                  {student.pendingStagePoints > 0 && (
                                                    <span className="text-emerald-400 text-[10px] ml-1 font-bold">
                                                      (+{student.pendingStagePoints})
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Non-Stage Points */}
                                                <td className="py-3.5 px-4 text-center">
                                                  <span className="text-purple-300 font-semibold">
                                                    {student.projectedNonStagePoints}
                                                  </span>
                                                  {student.pendingNonStagePoints > 0 && (
                                                    <span className="text-emerald-400 text-[10px] ml-1 font-bold">
                                                      (+{student.pendingNonStagePoints})
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Total Individual Score */}
                                                <td className="py-3.5 px-4 text-center bg-white/2 font-bold text-emerald-400">
                                                  <span className="text-base">{student.projectedPoints} pts</span>
                                                  {student.pendingPoints > 0 && (
                                                    <span className="block text-[10px] text-emerald-300 font-medium">
                                                      (+{student.pendingPoints} pending)
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                              ) : (
                              /* ================== TAB 3: PENDING PROGRAMS IMPACT ================== */
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
                        id={`chk - ${ result.resultId }`}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={`chk - ${ result.resultId }`}
                            className="text-base md:text-lg font-bold text-white hover:text-emerald-300 cursor-pointer"
                          >
                            {result.programName}
                          </label>
                          <span
                            className={`px - 2 py - 0.5 rounded - full text - [10px] font - bold uppercase tracking - wider ${
                                    result.programType === "stage"
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                      : result.programType === "non-stage"
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  }`}
                          >
                            {result.programType === "stage"
                              ? "Single • Stage"
                              : result.programType === "non-stage"
                              ? "Single • Non-Stage"
                              : "General Group"}
                          </span>
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
                      <Link href={`/ admin / pending - results / ${ result.resultId } / edit`}>
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
      )}
          </div>
          );
}
