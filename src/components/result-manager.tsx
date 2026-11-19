"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { CheckCircle2, Eye, Pencil, Search, Trash2, Calendar, User, Award, Table, FileText, Calculator, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { useDebounce } from "@/hooks/use-debounce";
import type { Program, ResultRecord, Jury, Student, Team } from "@/lib/types";

interface ResultManagerProps {
  results: ResultRecord[];
  programs: Program[];
  juries: Jury[];
  students: Student[];
  teams: Team[];
  deleteAction: (formData: FormData) => Promise<void>;
  approveAction?: (formData: FormData) => Promise<void>;
  rejectAction?: (formData: FormData) => Promise<void>;
  isPending?: boolean;
}

type SortOption = "latest" | "program" | "jury" | "score";
type ProgramTypeFilter = "all" | "stage" | "non-stage" | "general";

const pageSizeOptions = [
  { label: "8 / page", value: "8" },
  { label: "15 / page", value: "15" },
  { label: "25 / page", value: "25" },
];

export const ResultManager = React.memo(function ResultManager({
  results,
  programs,
  juries,
  students,
  teams,
  deleteAction,
  approveAction,
  rejectAction,
  isPending = false,
}: ResultManagerProps) {
  const programMap = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const juryMap = useMemo(() => new Map(juries.map((j) => [j.id, j])), [juries]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const programOptions = useMemo(
    () => [{ value: "", label: "All Programs" }, ...programs.map((p) => ({ value: p.id, label: p.name }))],
    [programs],
  );
  const juryOptions = useMemo(
    () => [{ value: "", label: "All Juries" }, ...juries.map((j) => ({ value: j.id, label: j.name }))],
    [juries],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [programFilter, setProgramFilter] = useState("");
  const [juryFilter, setJuryFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("latest");
  const [programTypeFilter, setProgramTypeFilter] = useState<ProgramTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(Number(pageSizeOptions[0].value));
  const [viewResult, setViewResult] = useState<ResultRecord | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, programFilter, juryFilter, sort, programTypeFilter]);

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      const program = programMap.get(result.program_id);
      const jury = juryMap.get(result.jury_id);
      const query = debouncedSearchQuery.trim().toLowerCase();

      const matchesSearch =
        program?.name.toLowerCase().includes(query) ||
        jury?.name.toLowerCase().includes(query) ||
        result.id.toLowerCase().includes(query);
      const matchesProgram = programFilter ? result.program_id === programFilter : true;
      const matchesJury = juryFilter ? result.jury_id === juryFilter : true;
      const matchesProgramType = programTypeFilter === "all"
        || (programTypeFilter === "general" && program?.section === "general")
        || (programTypeFilter === "stage" && program?.section !== "general" && program?.stage === true)
        || (programTypeFilter === "non-stage" && program?.section !== "general" && program?.stage === false);

      return matchesSearch && matchesProgram && matchesJury && matchesProgramType;
    });
  }, [results, debouncedSearchQuery, programFilter, juryFilter, programTypeFilter, programMap, juryMap]);

  const sortedResults = useMemo(() => {
    const list = [...filteredResults];
    if (sort === "program") {
      list.sort((a, b) => {
        const aName = programMap.get(a.program_id)?.name ?? "";
        const bName = programMap.get(b.program_id)?.name ?? "";
        return aName.localeCompare(bName);
      });
    } else if (sort === "jury") {
      list.sort((a, b) => {
        const aName = juryMap.get(a.jury_id)?.name ?? "";
        const bName = juryMap.get(b.jury_id)?.name ?? "";
        return aName.localeCompare(bName);
      });
    } else if (sort === "score") {
      list.sort((a, b) => {
        const aScore = getTotalScore(a);
        const bScore = getTotalScore(b);
        return bScore - aScore;
      });
    } else {
      list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }
    return list;
  }, [filteredResults, sort, programMap, juryMap]);

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / pageSize)) || 1;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const visibleResults = sortedResults.slice(startIndex, startIndex + pageSize);
  const showingFrom = sortedResults.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + pageSize, sortedResults.length);

  const getWinnerName = (entry: { student_id?: string; team_id?: string }) => {
    if (entry.student_id) {
      const student = studentMap.get(entry.student_id);
      return student?.name ?? "—";
    }
    if (entry.team_id) {
      const team = teamMap.get(entry.team_id);
      return team?.name ?? "—";
    }
    return "—";
  };

  function getPenaltyTotal(result: ResultRecord) {
    return result.penalties?.reduce((sum, penalty) => sum + penalty.points, 0) ?? 0;
  }

  function getTotalScore(result: ResultRecord) {
    const penaltyTotal = getPenaltyTotal(result);
    const entryTotal = result.entries.reduce((sum, entry) => sum + entry.score, 0);
    return entryTotal - penaltyTotal;
  }

  const getPositionName = useCallback((result: ResultRecord, position: number) => {
    const entry = result.entries.find((e) => e.position === position);
    if (!entry) return "—";
    return getWinnerName(entry);
  }, [getWinnerName]);

  const getTeamImpactSummary = useCallback((result: ResultRecord) => {
    const map = new Map<string, { name: string; color: string; points: number; penalty: number; positions: number[] }>();

    result.entries.forEach((entry) => {
      let teamId = entry.team_id;
      if (!teamId && entry.student_id) {
        teamId = studentMap.get(entry.student_id)?.team_id;
      }
      if (teamId) {
        const team = teamMap.get(teamId);
        const current = map.get(teamId) || {
          name: team?.name || "Team",
          color: team?.color || "#4F46E5",
          points: 0,
          penalty: 0,
          positions: [],
        };
        current.points += entry.score;
        if (!current.positions.includes(entry.position)) {
          current.positions.push(entry.position);
        }
        map.set(teamId, current);
      }
    });

    result.penalties?.forEach((pen) => {
      let teamId = pen.team_id;
      if (!teamId && pen.student_id) {
        teamId = studentMap.get(pen.student_id)?.team_id;
      }
      if (teamId) {
        const team = teamMap.get(teamId);
        const current = map.get(teamId) || {
          name: team?.name || "Team",
          color: team?.color || "#4F46E5",
          points: 0,
          penalty: 0,
          positions: [],
        };
        current.penalty += pen.points;
        map.set(teamId, current);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.points - a.points);
  }, [studentMap, teamMap]);

  const handleExport = useCallback((type: "csv" | "pdf") => {
    const data = sortedResults.map((result) => {
      const programName = programMap.get(result.program_id)?.name ?? "Unknown Program";
      const first = getPositionName(result, 1);
      const second = getPositionName(result, 2);
      const third = getPositionName(result, 3);
      return [programName, first, second, third];
    });

    if (type === "pdf") {
      import("jspdf").then((jsPDFModule) => {
        import("jspdf-autotable").then((autoTableModule) => {
          const jsPDF = jsPDFModule.default;
          const autoTable = autoTableModule.default;
          const doc = new jsPDF();

          doc.setFontSize(18);
          doc.text("Approved Results", 14, 22);

          autoTable(doc, {
            head: [["Program Name", "First Place", "Second Place", "Third Place"]],
            body: data,
            startY: 30,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [8, 47, 73] }, // Slate 900
          });

          doc.save("approved-results.pdf");
        });
      });
    } else {
      const headers = ["Program Name", "First Place", "Second Place", "Third Place"];
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers, ...data].map((e) => e.map(item => `"${item}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${isPending ? "pending" : "approved"}-results.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [sortedResults, programMap, getPositionName, isPending]);

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_20px_60px_rgba(8,47,73,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">Results roster</p>
          <h2 className="text-2xl font-semibold text-white">
            Manage {isPending ? "Pending" : "Approved"} Results
          </h2>
          <p className="text-sm text-white/60">
            Search, filter, and manage result entries.
          </p>
        </div>
        {!isPending && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport("csv")}
              className="gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
            >
              <Table className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport("pdf")}
              className="gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
            >
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        )}
        {isPending && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport("csv")}
              className="gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
            >
              <Table className="h-4 w-4" /> CSV
            </Button>
            <Link href="/admin/precalculated-scores">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-fuchsia-600/20 text-fuchsia-200 hover:bg-fuchsia-600/30 border-fuchsia-500/30"
              >
                <Calculator className="h-4 w-4 text-fuchsia-400" />
                Pre-calculate Scores ({results.length})
              </Button>
            </Link>
          </div>
        )}
      </div>

      {isPending && results.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/20 bg-linear-to-r from-fuchsia-950/30 via-slate-900/40 to-indigo-950/30 p-4 text-xs text-white/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 shrink-0">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Pre-calculate Standings Before Approving</p>
              <p className="text-white/60">
                Preview how these {results.length} pending submissions will impact team points, medals, and standings before publishing them to the public scoreboard.
              </p>
            </div>
          </div>
          <Link href="/admin/precalculated-scores">
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 gap-1.5 bg-fuchsia-500/20 text-fuchsia-200 hover:bg-fuchsia-500/30 border-fuchsia-500/30 text-xs"
            >
              Open Simulator
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative z-20 md:col-span-2 flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition-all duration-200 hover:border-white/20 focus-within:border-fuchsia-400/50 focus-within:ring-2 focus-within:ring-fuchsia-400/30 focus-within:bg-white/10">
          <Search className="mr-2 h-4 w-4 text-white/50 shrink-0" />
          <Input
            type="text"
            placeholder="Search by program, jury, or ID..."
            className="border-none bg-transparent px-0 placeholder:text-white/40"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <SearchSelect
          name="program_filter"
          options={programOptions}
          value={programFilter}
          onValueChange={setProgramFilter}
          placeholder="Filter by program"
        />
        <SearchSelect
          name="jury_filter"
          options={juryOptions}
          value={juryFilter}
          onValueChange={setJuryFilter}
          placeholder="Filter by jury"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-white/50">Quick sort</span>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Latest First", value: "latest" },
            { label: "Program A-Z", value: "program" },
            { label: "Jury A-Z", value: "jury" },
            { label: "Highest Score", value: "score" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value as SortOption)}
              className={`rounded-full px-4 py-1 text-xs font-semibold transition ${sort === option.value
                ? "bg-emerald-500/20 text-emerald-300"
                : "border border-white/10 text-white/60 hover:text-white"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm text-white/60">
          <SearchSelect
            name="page_size"
            className="w-32"
            options={pageSizeOptions}
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
            placeholder="Page size"
          />
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {sortedResults.length} results
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-white/50">Program type</span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All", value: "all" },
              { label: "Stage", value: "stage" },
              { label: "Non-stage", value: "non-stage" },
              { label: "General", value: "general" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setProgramTypeFilter(option.value as ProgramTypeFilter)}
                aria-pressed={programTypeFilter === option.value}
                className={`rounded-full px-4 py-1 text-xs font-semibold transition ${programTypeFilter === option.value
                  ? "bg-fuchsia-500/20 text-fuchsia-200"
                  : "border border-white/10 text-white/60 hover:text-white"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
      </div>

      <div className="space-y-3">
        <div className="hidden items-center gap-4 text-xs uppercase tracking-widest text-white/50 lg:flex">
          <span className="flex-1">Program & Jury</span>
          <span>Winners</span>
          <span>Score</span>
          <span>Date</span>
          <span>Actions</span>
        </div>

        {visibleResults.map((result) => {
          const program = programMap.get(result.program_id);
          const jury = juryMap.get(result.jury_id);
          const totalScore = getTotalScore(result);

          return (
            <div
              key={result.id}
              className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/70 via-slate-900/40 to-slate-800/40 px-4 py-4 shadow-[0_15px_60px_rgba(15,23,42,0.45)] transition hover:border-fuchsia-400/40"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="w-full xl:flex-1">
                  <p className="text-sm text-white/40">#{result.id.slice(0, 8)}</p>
                  <p className="text-lg font-semibold text-white">{program?.name ?? "Unknown Program"}</p>
                  <p className="text-xs text-white/60 flex items-center gap-1 mt-1">
                    <User className="h-3 w-3" />
                    {jury?.name ?? "Unknown Jury"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:gap-3 xl:max-w-md">
                  {result.entries.map((entry) => (
                    <div
                      key={entry.position}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center"
                    >
                      <p className="text-xs text-white/50">
                        {entry.position === 1 ? "1st" : entry.position === 2 ? "2nd" : "3rd"}
                      </p>
                      <p className="text-sm font-semibold text-white">{getWinnerName(entry)}</p>
                      <p className="text-xs text-emerald-300">{entry.score} pts</p>
                    </div>
                  ))}
                  {(result.penalties?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center">
                      <p className="text-xs text-red-200/90">Penalty</p>
                      <p className="text-sm font-semibold text-white">
                        -
                        {getPenaltyTotal(result)}
                        {" pts"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-center w-full sm:w-auto">
                  <p className="text-lg font-bold text-emerald-300">{totalScore}</p>
                  <p className="text-xs text-white/50">Total</p>
                </div>
                <div className="text-sm text-white/70 w-full sm:w-auto">
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(result.submitted_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {new Date(result.submitted_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:ml-auto xl:w-auto xl:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => setViewResult(result)}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Link href={`/admin/${isPending ? "pending" : "approved"}-results/${result.id}/edit`}>
                    <Button type="button" variant="ghost" size="sm" className="gap-2 border border-white/15 bg-white/5">
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  {isPending && approveAction && (
                    <form action={approveAction}>
                      <input type="hidden" name="id" value={result.id} />
                      <Button type="submit" variant="secondary" size="sm" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                    </form>
                  )}
                  {isPending && rejectAction && (
                    <form action={rejectAction}>
                      <input type="hidden" name="id" value={result.id} />
                      <Button type="submit" variant="danger" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Reject
                      </Button>
                    </form>
                  )}
                  {!isPending && (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={result.id} />
                      <Button type="submit" variant="danger" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
              </div>

              {isPending && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center gap-1">
                        <Calculator className="h-3 w-3 text-fuchsia-400" />
                        Pre-calculated Impact:
                      </span>
                      {getTeamImpactSummary(result).map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 border border-white/10 text-xs"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="text-white font-medium">{t.name}:</span>
                          <span className="font-bold text-emerald-400">+{t.points} pts</span>
                          {t.penalty > 0 && (
                            <span className="text-rose-400 font-semibold">(-{t.penalty} pen)</span>
                          )}
                          <span className="text-white/40 text-[10px]">
                            ({t.positions.map((p) => (p === 1 ? "1st" : p === 2 ? "2nd" : "3rd")).join(", ")})
                          </span>
                        </span>
                      ))}
                    </div>
                    <Link
                      href="/admin/precalculated-scores"
                      className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200 flex items-center gap-1 sm:ml-auto self-end sm:self-auto"
                    >
                      Simulate Standings <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
              )}
                </div>
              );
        })}
            </div>

      {
            sortedResults.length === 0 && (
              <div className="py-12 text-center">
                <Award className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No results found matching your filters.</p>
              </div>
            )
          }

          {
            totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-white/60">
                  Showing {showingFrom} to {showingTo} of {sortedResults.length} results
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-sm transition ${page === pageNum
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "border border-white/10 text-white/60 hover:text-white hover:border-white/20"
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )
          }

          {/* View Modal */ }
          {
            viewResult && (
              <Modal
                open={!!viewResult}
                title={`Result Details - ${programMap.get(viewResult.program_id)?.name ?? "Unknown"}`}
                onClose={() => setViewResult(null)}
              >
                <div className="space-y-4">
                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-sm text-white/60">Program</p>
                    <p className="font-semibold text-white">
                      {programMap.get(viewResult.program_id)?.name ?? "Unknown"}
                    </p>
                    <p className="text-sm text-white/60">Jury</p>
                    <p className="font-semibold text-white">
                      {juryMap.get(viewResult.jury_id)?.name ?? "Unknown"}
                    </p>
                    <p className="text-sm text-white/60">Submitted</p>
                    <p className="font-semibold text-white">
                      {new Date(viewResult.submitted_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-white/60">Total Score</p>
                    <p className="text-2xl font-bold text-emerald-300">{getTotalScore(viewResult)}</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white">Winners</p>
                    {viewResult.entries.map((entry) => {
                      const winnerName = getWinnerName(entry);
                      const student = entry.student_id ? studentMap.get(entry.student_id) : undefined;
                      const team = entry.team_id ? teamMap.get(entry.team_id) : undefined;
                      return (
                        <div
                          key={entry.position}
                          className="rounded-xl border border-white/10 bg-white/5 p-4"
                        >
                          <p className="text-sm uppercase text-white/50">
                            {entry.position === 1 ? "1st Place" : entry.position === 2 ? "2nd Place" : "3rd Place"}
                          </p>
                          <p className="text-lg font-semibold text-white mt-1">{winnerName}</p>
                          {student && (
                            <p className="text-xs text-white/60 mt-1">Chest #{student.chest_no}</p>
                          )}
                          {entry.grade && entry.grade !== "none" && (
                            <p className="text-xs text-white/60 mt-1">Grade: {entry.grade}</p>
                          )}
                          <p className="text-sm text-emerald-300 mt-2">Score: {entry.score}</p>
                        </div>
                      );
                    })}
                    {(viewResult.penalties?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-2">
                        <p className="text-sm font-semibold text-red-200">Minus points</p>
                        {viewResult.penalties?.map((penalty, index) => {
                          const student = penalty.student_id ? studentMap.get(penalty.student_id) : undefined;
                          const team = penalty.team_id ? teamMap.get(penalty.team_id) : undefined;
                          return (
                            <div key={`${penalty.team_id ?? penalty.student_id ?? index}`} className="text-sm text-white/80">
                              <p className="font-semibold">
                                {student?.name ?? team?.name ?? "Unknown"} · -{penalty.points} pts
                              </p>
                              {student && (
                                <p className="text-xs text-white/50">
                                  Chest #{student.chest_no} · Team {teamMap.get(student.team_id)?.name ?? "Unknown"}
                                </p>
                              )}
                              {!student && team && (
                                <p className="text-xs text-white/50">Team ID: {team.id}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Modal>
            )
          }
    </div>
      );
});

