import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { JuryLoginForm } from "@/components/forms/jury-login-form";
import { JURY_COOKIE, SESSION_MAX_AGE } from "@/lib/config";
import { authenticateJury, createSessionToken } from "@/lib/auth";

async function juryLoginAction(
  _state: { error?: string },
  formData: FormData,
) {
  "use server";
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  const jury = await authenticateJury(identifier, password);
  if (!jury) {
    return { error: "Invalid jury credentials." };
  }

  const token = await createSessionToken({ role: "jury", id: jury.id });

  const store = await cookies();
  store.set(JURY_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  redirect("/jury/programs");
}

export default function JuryLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-10 px-5 py-16 md:px-8">
      <div className="space-y-4 text-center">
        <Badge tone="cyan" className="mx-auto">
          Jury Portal
        </Badge>
        <h1 className="text-4xl font-bold text-white">Hi Jury, welcome back!</h1>
        <p className="text-white/70">
          Access your assigned programs, record podium placements, and send them for
          admin approval.
        </p>
      </div>
      <JuryLoginForm action={juryLoginAction} />
    </main>
  );
}

