"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAssignmentUpdates } from "@/hooks/use-realtime";
import { useDebounce } from "@/hooks/use-debounce";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  Award,
  Trash2,
  Mic2,
  Palette,
  Music,
  Video,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { AssignedProgram, Jury, Program } from "@/lib/types";

interface AssignmentManagerProps {
  assignments: AssignedProgram[];
  programs: Program[];
  juries: Jury[];
  deleteAction: (formData: FormData) => Promise<void>;
}

type StatusFilter = "all" | "pending" | "submitted" | "completed";
type ViewMode = "by-jury" | "all";

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  submitted: {
    label: "Submitted",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: FileCheck,
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: CheckCircle2,
  },
};

// Helper utility to pick an icon based on program name
function getProgramIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("paint") || lower.includes("draw") || lower.includes("art")) return Palette;
  if (lower.includes("song") || lower.includes("music") || lower.includes("vocals")) return Music;
  if (lower.includes("film") || lower.includes("video")) return Video;
  if (lower.includes("quiz") || lower.includes("write")) return LayoutGrid;
  return Award;
}

export const AssignmentManager = React.memo(function AssignmentManager({
  assignments,
  programs,
  juries,
  deleteAction,
}: AssignmentManagerProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("by-jury");
  const [expandedJuries, setExpandedJuries] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    programId: string;
    juryId: string;
    programName: string;
    juryName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscribe to real-time assignment updates
  useAssignmentUpdates(() => {
    router.refresh();
  });

  // Create maps
  const programMap = useMemo(() => {
    const map = new Map<string, Program>();
    programs.forEach((p) => {
      if (p?.id && p?.name) map.set(p.id, p);
    });
    return map;
  }, [programs]);

  const juryMap = useMemo(() => {
    const map = new Map<string, Jury>();
    juries.forEach((j) => {
      if (j?.id && j?.name) map.set(j.id, j);
    });
    return map;
  }, [juries]);

  // Group assignments by jury
  const assignmentsByJury = useMemo(() => {
    const grouped = new Map<string, AssignedProgram[]>();
    assignments.forEach((assignment) => {
      const existing = grouped.get(assignment.jury_id) || [];
      grouped.set(assignment.jury_id, [...existing, assignment]);
    });
    return grouped;
  }, [assignments]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const program = programMap.get(assignment.program_id);
      const jury = juryMap.get(assignment.jury_id);
      const matchesSearch =
        program?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        jury?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assignments, debouncedSearchQuery, statusFilter, programMap, juryMap]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = assignments.length;
    const pending = assignments.filter((a) => a.status === "pending").length;
    const submitted = assignments.filter((a) => a.status === "submitted").length;
    const completed = assignments.filter((a) => a.status === "completed").length;
    return { total, pending, submitted, completed };
  }, [assignments]);

  const toggleJuryExpansion = useCallback((juryId: string) => {
    setExpandedJuries((prev) => {
      const next = new Set(prev);
      if (next.has(juryId)) {
        next.delete(juryId);
      } else {
        next.add(juryId);
      }
      return next;
    });
  }, []);

  const expandAll = () => {
    setExpandedJuries(new Set(Array.from(assignmentsByJury.keys())));
  };

  const collapseAll = () => {
    setExpandedJuries(new Set());
  };

  return (
    <div className="space-y-8">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Assignments", value: stats.total, color: "text-white", sub: "All active" },
          { label: "Pending", value: stats.pending, color: "text-amber-400", sub: "To evaluate" },
          { label: "Submitted", value: stats.submitted, color: "text-blue-400", sub: "Waiting check" },
          { label: "Completed", value: stats.completed, color: "text-emerald-400", sub: "Done" },
        ].map((stat, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">{stat.label}</p>
            <p className={cn("mt-1 text-3xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-white/30">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Controls & Filters */}
      <div className="sticky top-4 z-30 space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search programs or juries..."
              className="pl-10 border-white/10 bg-white/5 focus-visible:ring-fuchsia-400/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchSelect
              name="status_filter"
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              className="w-[180px]"
              options={[
                { value: "all", label: "All Status" },
                { value: "pending", label: "Pending" },
                { value: "submitted", label: "Submitted" },
                { value: "completed", label: "Completed" },
              ]}
              placeholder="Filter Status"
            />
            <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode("by-jury")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-2xl transition-all",
                  viewMode === "by-jury" ? "bg-fuchsia-500 text-white shadow" : "text-white/60 hover:text-white"
                )}
              >
                By Jury
              </button>
              <button
                onClick={() => setViewMode("all")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-2xl transition-all",
                  viewMode === "all" ? "bg-fuchsia-500 text-white shadow" : "text-white/60 hover:text-white"
                )}
              >
                All List
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "by-jury" ? (
          <motion.div
            key="by-jury"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-white">Jury Assignments</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs text-white/60">
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs text-white/60">
                  Collapse All
                </Button>
              </div>
            </div>

            {Array.from(assignmentsByJury.entries()).map(([juryId, juryAssignments]) => {
              const jury = juryMap.get(juryId);
              const isExpanded = expandedJuries.has(juryId);

              // Apply filters to ONLY list the relevant assignments inside, 
              // BUT we might want to show the jury card even if some assignments don't match, 
              // showing only matching ones inside.
              const matchingAssignments = juryAssignments.filter((assignment) => {
                const program = programMap.get(assignment.program_id);
                const matchesSearch =
                  program?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                  jury?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
                const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
                return matchesSearch && matchesStatus;
              });

              if (matchingAssignments.length === 0 && (searchQuery || statusFilter !== "all")) {
                return null;
              }

              const progress = Math.round(
                (juryAssignments.filter((a) => a.status === "completed").length /
                  juryAssignments.length) * 100
              ) || 0;

              return (
                <div key={juryId} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 transition-all hover:border-white/20">
                  <div
                    onClick={() => toggleJuryExpansion(juryId)}
                    className="flex cursor-pointer items-center justify-between p-5 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                        {/* Avatar Fallback */}
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-600 to-purple-700 text-lg font-bold text-white">
                          {(jury?.name?.[0] || "J").toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">{jury?.name || "Unknown Jury"}</h4>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <span>{juryAssignments.length} Assigned</span>
                          <span>•</span>
                          <span className={`${progress === 100 ? "text-emerald-400" : "text-fuchsia-400"}`}>
                            {progress}% Done
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Mini Progress Bar */}
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
                        <div
                          className="h-full bg-gradient-to-r from-fuchsia-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-white/40" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-white/40" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden bg-black/20"
                      >
                        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                          {matchingAssignments.map((assignment) => {
                            const program = programMap.get(assignment.program_id);
                            const statusInfo = statusConfig[assignment.status];
                            const StatusIcon = statusInfo.icon;
                            const ProgramIcon = getProgramIcon(program?.name || "");

                            return (
                              <div
                                key={assignment.program_id}
                                className="group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:border-white/10 hover:bg-white/[0.08]"
                              >
                                <div>
                                  <div className="mb-3 flex items-start justify-between">
                                    <div className="rounded-2xl bg-white/10 p-2 text-fuchsia-300">
                                      <ProgramIcon className="h-5 w-5" />
                                    </div>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                                        statusInfo.color
                                      )}
                                    >
                                      <StatusIcon className="h-3 w-3" />
                                      {statusInfo.label}
                                    </div>
                                  </div>
                                  <h5 className="font-semibold text-white line-clamp-1" title={program?.name}>
                                    {program?.name || "Unknown Program"}
                                  </h5>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/50">
                                    <span className="rounded bg-white/5 px-1.5 py-0.5">
                                      {program?.section === "single" ? "Solo" : "Group"}
                                    </span>
                                    <span className="rounded bg-white/5 px-1.5 py-0.5">
                                      Cat {program?.category}
                                    </span>
                                    {program?.stage && (
                                      <span className="rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-fuchsia-300">
                                        On Stage
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-4 flex items-center justify-end border-t border-white/5 pt-3 opacity-100 transition-opacity group-hover:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget({
                                        programId: assignment.program_id,
                                        juryId: assignment.jury_id,
                                        programName: program?.name || "Unknown",
                                        juryName: jury?.name || "Unknown",
                                      });
                                    }}
                                    className="h-8 w-8 rounded-full p-0 text-white/40 hover:bg-red-500/20 hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
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
            })}
          </motion.div>
        ) : (
          <motion.div
            key="all-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredAssignments.map((assignment) => {
              const program = programMap.get(assignment.program_id);
              const jury = juryMap.get(assignment.jury_id);
              const statusInfo = statusConfig[assignment.status];
              const ProgramIcon = getProgramIcon(program?.name || "");

              return (
                <div
                  key={`${assignment.program_id}-${assignment.jury_id}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/10 p-2">
                      <ProgramIcon className="h-5 w-5 text-white/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-semibold text-white truncate">{program?.name}</h5>
                      <p className="text-xs text-white/50">Assigned to <span className="text-white/80">{jury?.name}</span></p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className={cn("text-xs px-2 py-1 rounded border", statusInfo.color)}>
                      {statusInfo.label}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget({
                        programId: assignment.program_id,
                        juryId: assignment.jury_id,
                        programName: program?.name || "Unknown",
                        juryName: jury?.name || "Unknown",
                      })}
                      className="h-7 w-7 p-0 text-white/30 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Unassign Program"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                setIsDeleting(true);

                // Set a timeout fallback to reset state if redirect doesn't happen quickly
                const timeoutId = setTimeout(() => {
                  setIsDeleting(false);
                  setDeleteTarget(null);
                }, 2000);

                try {
                  const formData = new FormData();
                  formData.append("program_id", deleteTarget.programId);
                  formData.append("jury_id", deleteTarget.juryId);
                  await deleteAction(formData);
                  clearTimeout(timeoutId);
                  // If we reach here, redirect didn't happen, reset state
                  setIsDeleting(false);
                  setDeleteTarget(null);
                } catch (error: any) {
                  clearTimeout(timeoutId);
                  // Handle redirect - Next.js redirects throw a special error
                  if (error?.digest === "NEXT_REDIRECT" || error?.message === "NEXT_REDIRECT") {
                    // Redirect is happening, reset state immediately
                    setIsDeleting(false);
                    setDeleteTarget(null);
                  } else {
                    // Other errors - reset state
                    setIsDeleting(false);
                  }
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Assignment"}
            </Button>
          </>
        }
      >
        <p className="text-white/80">
          Are you sure you want to remove <strong>{deleteTarget?.programName}</strong> from <strong>{deleteTarget?.juryName}</strong>?
        </p>
      </Modal>
    </div>
  );
});
