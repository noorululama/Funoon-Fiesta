import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ReplacementRequestForm } from "@/components/replacement-request-form";
import { getCurrentTeam } from "@/lib/auth";
import { getApprovedResults } from "@/lib/data";
import {
  createReplacementRequest,
  getPortalStudents,
  getProgramRegistrations,
  getProgramsWithLimits,
  getReplacementRequests,
  isRegistrationOpen,
} from "@/lib/team-data";

function redirectWithMessage(message: string, type: "error" | "success" = "error") {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/team/replacement-request?${params.toString()}`);
}

async function submitReplacementRequestAction(formData: FormData) {
  "use server";
  const team = await getCurrentTeam();
  if (!team) redirect("/team/login");

  const isOpen = await isRegistrationOpen();
  if (isOpen) {
    redirectWithMessage("Registration window is still open. Please use the regular registration page.");
  }

  const programId = String(formData.get("programId") ?? "").trim();
  const oldStudentId = String(formData.get("oldStudentId") ?? "").trim();
  const newStudentId = String(formData.get("newStudentId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!programId || !oldStudentId || !newStudentId || !reason) {
    redirectWithMessage("All fields are required.");
  }

  if (oldStudentId === newStudentId) {
    redirectWithMessage("Old and new students must be different.");
  }

  const [programs, students, registrations, approvedResults] = await Promise.all([
    getProgramsWithLimits(),
    getPortalStudents(),
    getProgramRegistrations(),
    getApprovedResults(),
  ]);

  const program = programs.find((p) => p.id === programId);
  if (!program) {
    redirectWithMessage("Program not found.");
  }

  // Prevent replacement requests for approved/published programs
  const isProgramApproved = approvedResults.some((result) => result.program_id === programId);
  if (isProgramApproved) {
    redirectWithMessage("This program is already published. Replacement requests are not allowed for published programs.");
  }

  const oldStudent = students.find((s) => s.id === oldStudentId);
  const newStudent = students.find((s) => s.id === newStudentId);

  if (!oldStudent || oldStudent.teamId !== team.id) {
    redirectWithMessage("Old student not found or does not belong to your team.");
    return;
  }
  if (!newStudent || newStudent.teamId !== team.id) {
    redirectWithMessage("New student not found or does not belong to your team.");
    return;
  }

  const existingRegistration = registrations.find(
    (r) => r.programId === programId && r.studentId === oldStudentId && r.teamId === team.id,
  );
  if (!existingRegistration) {
    redirectWithMessage("The old student is not registered for this program.");
    return;
  }

  const newStudentAlreadyRegistered = registrations.some(
    (r) => r.programId === programId && r.studentId === newStudentId,
  );
  if (newStudentAlreadyRegistered) {
    redirectWithMessage("The new student is already registered for this program.");
    return;
  }

  // TypeScript type narrowing
  if (!oldStudent || !newStudent || !program) {
    redirectWithMessage("Invalid data.");
    return;
  }

  // Check for duplicate pending replacement requests
  const existingRequests = await getReplacementRequests(team.id);
  const duplicateRequest = existingRequests.some(
    (req) =>
      req.programId === programId &&
      req.oldStudentId === oldStudentId &&
      req.status === "pending",
  );
  if (duplicateRequest) {
    redirectWithMessage(
      `A pending replacement request already exists for "${oldStudent.name}" in program "${program.name}". Please wait for admin approval or contact support.`,
    );
    return;
  }

  try {
    await createReplacementRequest({
      programId: program.id,
      programName: program.name,
      oldStudentId: oldStudent.id,
      oldStudentName: oldStudent.name,
      oldStudentChest: oldStudent.chestNumber,
      newStudentId: newStudent.id,
      newStudentName: newStudent.name,
      newStudentChest: newStudent.chestNumber,
      teamId: team.id,
      teamName: team.teamName,
      reason,
    });

    revalidatePath("/team/replacement-request");
    redirectWithMessage("Replacement request submitted successfully. Waiting for admin approval.", "success");
  } catch (error: any) {
    if (error.message.includes("pending replacement request already exists")) {
      redirectWithMessage(error.message);
    }
    redirectWithMessage(`Failed to submit replacement request: ${error.message}`);
  }
}

export default async function ReplacementRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const team = await getCurrentTeam();
  if (!team) redirect("/team/login");

  const [programs, registrations, students, isOpen, approvedResults] = await Promise.all([
    getProgramsWithLimits(),
    getProgramRegistrations(),
    getPortalStudents(),
    isRegistrationOpen(),
    getApprovedResults(),
  ]);

  const approvedProgramIds = new Set(approvedResults.map((result) => result.program_id));

  const availablePrograms = programs.filter((program) => !approvedProgramIds.has(program.id));

  const teamRegistrations = registrations.filter((r) => r.teamId === team.id);
  const teamStudents = students.filter((s) => s.teamId === team.id);

  const eligiblePrograms = availablePrograms.filter((program) =>
    teamRegistrations.some((r) => r.programId === program.id)
  );

  const error = typeof params?.error === "string" ? params.error : undefined;
  const success = typeof params?.success === "string" ? params.success : undefined;

  // SERIALIZATION FIX: Ensure objects are plain for client component props
  const plainEligiblePrograms = JSON.parse(JSON.stringify(eligiblePrograms));
  const plainPrograms = JSON.parse(JSON.stringify(programs));

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-3xl font-bold">Replacement Request</h1>
        <p className="text-sm text-white/70">
          Submit a request to replace a registered participant after the registration window has closed.
        </p>
      </div>

      {(error || success) && (
        <Card
          className={`border ${error ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/10"
            } p-4`}
        >
          <p className="text-sm">{error ?? success}</p>
        </Card>
      )}

      {isOpen ? (
        <Card className="border-amber-500/40 bg-amber-500/10 p-6">
          <p className="text-sm text-white/90">
            The registration window is still open. Please use the{" "}
            <a href="/team/program-register" className="underline">
              Program Registration
            </a>{" "}
            page to make changes directly.
          </p>
        </Card>
      ) : eligiblePrograms.length === 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/10 p-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-amber-200">No Eligible Programs Found</p>
              <p className="text-sm text-white/90">
                You cannot strictly request replacements right now. This is likely because the programs you are registered for have already been marked as final/published by admins.
              </p>
            </div>

            {teamRegistrations.length > 0 && (
              <div className="rounded-lg bg-black/20 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Your Registrations Status</p>
                <div className="space-y-2 text-sm">
                  {teamRegistrations.map((reg) => {
                    const prog = programs.find(p => p.id === reg.programId);
                    const isPublished = approvedProgramIds.has(reg.programId);

                    return (
                      <div key={reg.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                        <span className="truncate pr-4 font-medium text-white/80">{reg.programName || "Unknown Program"}</span>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${!prog ? "bg-red-500/20 text-red-300" :
                          isPublished ? "bg-blue-500/20 text-blue-300" :
                            "bg-emerald-500/20 text-emerald-300"
                          }`}>
                          {!prog ? "Invalid ID" : isPublished ? "Published (Locked)" : "Eligible"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-4 text-xs text-white/40 font-mono pt-2">
              <p>Team: {team.id}</p>
              <p>Total Regs: {teamRegistrations.length}</p>
              <p>Unpublished: {availablePrograms.length}</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-white/10 bg-white/5 p-6">
          <CardTitle>Submit Replacement Request</CardTitle>
          <CardDescription className="mt-2">
            Select a program and the students you want to replace. Your request will be reviewed by an admin.
          </CardDescription>

          <ReplacementRequestForm
            programs={plainEligiblePrograms}
            allPrograms={plainPrograms}
            teamRegistrations={teamRegistrations}
            teamStudents={teamStudents}
            submitAction={submitReplacementRequestAction}
          />
        </Card>
      )}
    </div>
  );
}
