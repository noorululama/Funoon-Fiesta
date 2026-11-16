import {
  TeamModel,
  ProgramModel,
  ApprovedResultModel,
  StudentModel,
} from "@/lib/models";
import { connectDB } from "@/lib/db";

// In-memory cache for ultra-fast spot replies (25-second freshness)
interface StudentRow {
  line: string;
  name: string;
  chest: string;
}

let cachedBase: string | null = null;
let cachedStudents: StudentRow[] = [];
let lastCacheTime = 0;
let inflight: Promise<void> | null = null;
const CACHE_TTL_MS = 25000;
const MAX_STUDENT_MATCHES = 25;

const FALLBACK =
  "Funoon Fiesta 2026 is an Islamic arts and cultural festival featuring multiple teams, student participants, and competitions across various categories.";

async function refreshCache() {
  await connectDB();

  // Fetch data in parallel (sensitive fields are excluded by projection)
  const [teams, programs, results, students] = await Promise.all([
    TeamModel.find({}, "id name total_points color leader").lean(),
    ProgramModel.find({}, "id name section category").lean(),
    ApprovedResultModel.find({}, "program_id entries").lean(),
    StudentModel.find({}, "id name chest_no team_id").lean(),
  ]);

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const programMap = new Map(programs.map((p) => [p.id, p.name]));
  const studentMap = new Map(students.map((s) => [s.id, s.name]));

  let context = "CURRENT FEST DATA:\n\n";

  context += "TEAMS & STANDINGS:\n";
  teams.forEach((team) => {
    context += `- Team: ${team.name} | Leader: ${team.leader} | Points: ${team.total_points}\n`;
  });
  context += "\n";

  context += "PUBLISHED RESULTS:\n";
  if (results.length === 0) {
    context += "No results published yet.\n";
  } else {
    results.forEach((result) => {
      const programName = programMap.get(result.program_id) || "Unknown Program";
      context += `Program: ${programName}\n`;
      const sortedEntries = result.entries.sort((a, b) => a.position - b.position);
      sortedEntries.forEach((entry) => {
        const studentName = entry.student_id ? studentMap.get(entry.student_id) : "N/A";
        const teamName = entry.team_id ? teamMap.get(entry.team_id) : "N/A";
        context += `  ${entry.position}. ${studentName} (${teamName}) [Grade: ${entry.grade}, Score: ${entry.score}]\n`;
      });
      context += "\n";
    });
  }

  context += "ALL PROGRAMS:\n";
  programs.forEach((p) => {
    context += `- ${p.name} (Section: ${p.section}, Category: ${p.category})\n`;
  });
  context += "\n";

  const perTeam = new Map<string, number>();
  students.forEach((s) => {
    const n = teamMap.get(s.team_id) || "Unknown Team";
    perTeam.set(n, (perTeam.get(n) ?? 0) + 1);
  });
  context += `PARTICIPANT COUNTS (total ${students.length}):\n`;
  perTeam.forEach((count, name) => {
    context += `- ${name}: ${count} participants\n`;
  });
  context += "\n";

  cachedBase = context;
  cachedStudents = students.map((s) => {
    const tName = teamMap.get(s.team_id) || "Unknown Team";
    return {
      line: `- ${s.name} (Chest: ${s.chest_no}, Team: ${tName})\n`,
      name: String(s.name ?? "").toLowerCase(),
      chest: String(s.chest_no ?? "").toLowerCase(),
    };
  });
  lastCacheTime = Date.now();
}

/**
 * Fest data for the AI prompt. With a `query`, only the students the question
 * could be about are included (matched by name or chest number): a much smaller
 * prompt means the model starts answering noticeably sooner.
 */
export async function getFestDataForAI(forceFresh = false, query?: string) {
  const stale = !cachedBase || forceFresh || Date.now() - lastCacheTime >= CACHE_TTL_MS;
  if (stale) {
    try {
      if (!inflight) inflight = refreshCache().finally(() => { inflight = null; });
      // Serve slightly old data immediately while a refresh runs; wait only when there is nothing cached.
      if (!cachedBase || forceFresh) await inflight;
    } catch (error) {
      console.error("ChatbotService error fetching fest data:", error);
      if (!cachedBase) return FALLBACK;
    }
  }

  const base = cachedBase ?? FALLBACK;
  let students: StudentRow[] = cachedStudents;

  if (query !== undefined) {
    const tokens = Array.from(
      new Set(
        query
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((t) => t.length >= 3 || /^\d+$/.test(t)),
      ),
    );
    students = tokens.length
      ? cachedStudents
          .filter((s) => tokens.some((t) => s.chest === t || s.name.includes(t)))
          .slice(0, MAX_STUDENT_MATCHES)
      : [];
    return `${base}STUDENT DIRECTORY (only students matching this question; if the person is not listed here, say you could not find them):\n${students.map((s) => s.line).join("")}`;
  }

  return `${base}STUDENT DIRECTORY:\n${students.map((s) => s.line).join("")}`;
}
