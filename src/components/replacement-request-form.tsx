"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import type { Program, ProgramRegistration, PortalStudent } from "@/lib/types";

interface ReplacementRequestFormProps {
  programs: Program[];
  allPrograms: Program[];
  teamRegistrations: ProgramRegistration[];
  teamStudents: PortalStudent[];
  submitAction: (formData: FormData) => Promise<void>;
}

export function ReplacementRequestForm({
  programs,
  allPrograms,
  teamRegistrations,
  teamStudents,
  submitAction,
}: ReplacementRequestFormProps) {
  const [programId, setProgramId] = useState("");
  const [oldStudentId, setOldStudentId] = useState("");
  const [newStudentId, setNewStudentId] = useState("");

  const programOptions = useMemo(() => programs
    .filter((program) => teamRegistrations.some((r) => r.programId === program.id))
    .map((program) => ({
      value: program.id,
      label: program.name,
      meta: `${program.section} · ${program.category !== "none" ? `Cat ${program.category}` : "General"}`,
    })), [programs, teamRegistrations]);

  const filteredCurrentStudentOptions = useMemo(() => programId
    ? teamRegistrations
      .filter((r) => r.programId === programId)
      .map((registration) => {
        const student = teamStudents.find((s) => s.id === registration.studentId);
        if (!student) return null;
        return {
          value: student.id,
          label: `${student.name} (Chest: ${student.chestNumber})`,
          meta: registration.programName,
        };
      })
      .filter((option): option is { value: string; label: string; meta: string } => option !== null)
    : [], [programId, teamRegistrations, teamStudents]);

  // Validation Logic for Replacement Candidate
  const replacementStudentOptions = useMemo(() => {
    if (!programId) return [];

    const selectedProgram = allPrograms.find(p => p.id === programId);
    if (!selectedProgram) return [];

    return teamStudents.map((student) => {
      // 1. Check if already registered for THIS program
      const isAlreadyInProgram = teamRegistrations.some(
        r => r.programId === programId && r.studentId === student.id
      );

      if (isAlreadyInProgram) {
        return null; // Cannot replace if already in the program (e.g., in a group event, replacing another member with an existing member makes no sense usually, or at least redundant)
      }

      // 2. Check Participation Limits
      let isEligible = true;
      let ineligibilityReason = "";

      // Logic derived from validateParticipationLimit in team-data.ts
      if (selectedProgram.section === "single") {
        // Check limits for Single (Individual) events
        // Filter registrations for this student that are ALSO single and share the same stage type (on-stage vs off-stage)
        const sameTypeCount = teamRegistrations.filter(r => {
          if (r.studentId !== student.id) return false;
          // Must look up program details for this registration
          const regProgram = allPrograms.find(p => p.id === r.programId);
          if (!regProgram) return false;

          return regProgram.section === "single" && regProgram.stage === selectedProgram.stage;
        }).length;

        const maxLimit = selectedProgram.stage ? 3 : 4;
        if (sameTypeCount >= maxLimit) {
          isEligible = false;
          ineligibilityReason = `Max ${maxLimit} ${selectedProgram.stage ? "On-Stage" : "Off-Stage"} items reached`;
        }
      } else if (selectedProgram.section === "general") {
        // Check limits for General events
        const generalCount = teamRegistrations.filter(r => {
          if (r.studentId !== student.id) return false;
          const regProgram = allPrograms.find(p => p.id === r.programId);
          return regProgram && regProgram.section === "general";
        }).length;

        if (generalCount >= 3) {
          isEligible = false;
          ineligibilityReason = "Max 3 General items reached";
        }
      }

      // If they are the student being replaced, exclude them (redundant check if oldStudentId is selected, but good for general list)
      if (student.id === oldStudentId) return null;

      if (!isEligible) {
        // Alternative: we could hide them, but showing them as disabled is better feedback 
        // (if standard dropdown). Since SearchSelect might not robustly support disabled items visually, we filter them for now to be "safe" as per user request.
        // However, user said "they can't replace", filtering is safest.
        return null;
      }

      return {
        value: student.id,
        label: `${student.name} (Chest: ${student.chestNumber})`,
        meta: `Team: ${student.teamName}`,
      };
    }).filter((option): option is { value: string; label: string; meta: string } => option !== null);
  }, [programId, teamStudents, teamRegistrations, allPrograms, oldStudentId]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    submitAction(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-white/90">Program</label>
        <SearchSelect
          name="programId"
          options={programOptions}
          placeholder="Search and select a program"
          value={programId}
          onValueChange={(value) => {
            setProgramId(value);
            setOldStudentId(""); // Reset old student when program changes
            setNewStudentId(""); // Reset new student
          }}
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-white/90">
          Current Registered Student
        </label>
        <SearchSelect
          name="oldStudentId"
          options={filteredCurrentStudentOptions}
          placeholder={
            programId
              ? "Search and select current registered student"
              : "Please select a program first"
          }
          value={oldStudentId}
          onValueChange={(val) => {
            setOldStudentId(val);
            setNewStudentId(""); // Reset new student if old student changes (optional but clean)
          }}
          disabled={!programId}
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-white/90">
          Replacement Student
        </label>
        <SearchSelect
          name="newStudentId"
          options={replacementStudentOptions}
          placeholder={
            !programId
              ? "Select a program first"
              : replacementStudentOptions.length === 0
                ? "No eligible candidates found"
                : "Search and select replacement student"
          }
          value={newStudentId}
          onValueChange={setNewStudentId}
          disabled={!programId || !oldStudentId}
          required
        />
        {programId && replacementStudentOptions.length === 0 && (
          <p className="mt-1 text-xs text-amber-200">
            Note: No other students in your team are eligible for this program (checks for quota limits and existing registrations).
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-white/90">Reason</label>
        <Textarea
          name="reason"
          placeholder="Please provide a reason for this replacement request..."
          required
          rows={4}
          className="min-h-[100px]"
        />
      </div>

      <Button type="submit" className="w-full">
        Submit Request
      </Button>
    </form>
  );
}
