import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TeamLoginForm } from "@/components/team-login-form";
import { authenticateTeam, getCurrentTeam, createSessionToken } from "@/lib/auth";
import { TEAM_COOKIE, SESSION_MAX_AGE } from "@/lib/config";

export const dynamic = "force-dynamic";

async function teamLoginAction(_state: { error?: string }, formData: FormData) {
  "use server";
  const teamName = String(formData.get("teamName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!teamName || !password) {
    return { error: "Team name and password are required." };
  }
  const team = await authenticateTeam(teamName, password);
  if (!team) {
    return { error: "Invalid team credentials." };
  }

  const token = await createSessionToken({ role: "team", id: team.id });

  const store = await cookies();
  store.set(TEAM_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  redirect("/team/dashboard");
}

export default async function TeamLoginPage() {
  const currentTeam = await getCurrentTeam();
  if (currentTeam) {
    redirect("/team/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <TeamLoginForm action={teamLoginAction} />
    </div>
  );
}

