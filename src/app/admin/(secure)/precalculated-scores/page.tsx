import { revalidatePath } from "next/cache";
import { redirectWithToast } from "@/lib/actions";
import {
  getApprovedResults,
  getJuries,
  getLiveScores,
  getPendingResults,
  getPrograms,
  getStudents,
  getTeams,
} from "@/lib/data";
import { approveResult, rejectResult } from "@/lib/result-service";
import { PrecalculatedScoresClient } from "@/components/precalculated-scores-client";

export const metadata = {
  title: "Pre-calculated Scores | Fest Command Center",
  description:
    "Preview and pre-calculate festival points, team standings, and medals with pending results before official admin approval.",
};

async function approveResultAction(formData: FormData) {
  "use server";
  try {
    const id = String(formData.get("id") ?? "");
    await approveResult(id);
    revalidatePath("/admin/precalculated-scores");
    revalidatePath("/admin/pending-results");
    redirectWithToast(
      "/admin/precalculated-scores",
      "Result approved successfully! Scores updated.",
      "success",
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_REDIRECT" || error?.message === "NEXT_REDIRECT") {
      throw error;
    }
    revalidatePath("/admin/precalculated-scores");
    redirectWithToast(
      "/admin/precalculated-scores",
      error?.message || "Failed to approve result",
      "error",
    );
  }
}

async function rejectResultAction(formData: FormData) {
  "use server";
  try {
    const id = String(formData.get("id") ?? "");
    await rejectResult(id);
    revalidatePath("/admin/precalculated-scores");
    revalidatePath("/admin/pending-results");
    redirectWithToast(
      "/admin/precalculated-scores",
      "Result rejected and returned to jury.",
      "success",
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_REDIRECT" || error?.message === "NEXT_REDIRECT") {
      throw error;
    }
    revalidatePath("/admin/precalculated-scores");
    redirectWithToast(
      "/admin/precalculated-scores",
      error?.message || "Failed to reject result",
      "error",
    );
  }
}

export default async function PrecalculatedScoresPage() {
  const [teams, liveScores, approvedResults, pendingResults, students, programs, juries] =
    await Promise.all([
      getTeams(),
      getLiveScores(),
      getApprovedResults(),
      getPendingResults(),
      getStudents(),
      getPrograms(),
      getJuries(),
    ]);

  return (
    <PrecalculatedScoresClient
      teams={teams}
      liveScores={liveScores}
      approvedResults={approvedResults}
      pendingResults={pendingResults}
      students={students}
      programs={programs}
      juries={juries}
      approveAction={approveResultAction}
      rejectAction={rejectResultAction}
    />
  );
}

