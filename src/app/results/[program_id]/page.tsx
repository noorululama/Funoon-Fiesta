import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy } from "lucide-react";
import {
  getApprovedResults,
  getJuries,
  getPrograms,
  getStudents,
  getTeams,
  getActivePosterTemplates,
} from "@/lib/data";
import { formatNumber, cn } from "@/lib/utils";
import { ResultPosterPreview } from "@/components/result-poster-preview";

interface ProgramDetailPageProps {
  params: Promise<{ program_id: string }>;
}

async function getProgramDetail(programId: string) {
  const [results, programs, students, teams, juries, templates] = await Promise.all([
    getApprovedResults(),
    getPrograms(),
    getStudents(),
    getTeams(),
    getJuries(),
    getActivePosterTemplates(),
  ]);

  const program = programs.find((p) => p.id === programId);
  const programResults = results.filter((r) => r.program_id === programId);

  const programMap = new Map(programs.map((p) => [p.id, p]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const juryMap = new Map(juries.map((j) => [j.id, j]));

  return {
    program,
    result: programResults[0], // Get the first (and should be only) result for this program
    programMap,
    studentMap,
    teamMap,
    juryMap,
    templates,
  };
}

export async function generateMetadata({ params }: ProgramDetailPageProps) {
  const { program_id } = await params;
  const programs = await getPrograms();
  const program = programs.find((p) => p.id === program_id);

  if (!program) {
    return {
      title: "Program Not Found",
      description: "The requested program result could not be found.",
    };
  }

  return {
    title: `${program.name} Results - Funoon Fiesta`,
    description: `View the winners and full results for ${program.name} (${program.category}) at Funoon Fiesta.`,
  };
}

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { program_id } = await params;
  const data = await getProgramDetail(program_id);

  if (!data.program) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
        <div className="text-center space-y-4 max-w-sm mx-auto">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h1 className="text-xl font-semibold text-gray-900">Program not found</h1>
            <p className="text-sm text-gray-500 mt-2">The program details you are looking for are unavailable or do not exist.</p>
            <Link href="/results" className="mt-4 inline-block">
              <Button variant="outline" size="sm" className="w-full">Back to Results</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data.result) {
    return (
      <main className="min-h-[80vh] container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Link href="/results" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Results
        </Link>
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
          <h1 className="text-xl font-bold text-gray-900">{data.program.name}</h1>
          <p className="mt-2 text-sm text-gray-500">No results have been published for this program yet.</p>
        </div>
      </main>
    );
  }

  const juryName = data.juryMap.get(data.result.jury_id)?.name ?? data.result.submitted_by;

  return (
    <main className="min-h-screen bg-gray-50/30 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 supports-[backdrop-filter]:bg-white/80 backdrop-blur-md">
        <div className="container mx-auto max-w-5xl px-4 py-3 sm:py-4">
          <Link
            href="/results"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Results
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 sm:p-2 rounded-lg bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{data.program.name}</h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                  <Badge className="text-xs font-medium bg-gray-50 text-gray-600 border-gray-200 rounded-md px-2 py-0 h-auto">
                    {data.program.category}
                  </Badge>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-xs text-gray-500">{data.program.section}</span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-xs text-gray-500">Jury: {juryName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 mt-6 space-y-10">
        {/* Podium Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              Winners Podium
            </h2>
            <span className="text-[10px] uppercase font-medium text-gray-400 sm:hidden">Swipe →</span>
          </div>

          {/* Mobile: Horizontal Scroll, Desktop: Grid */}
          <div className="flex overflow-x-auto pb-6 gap-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-3 sm:gap-4 snap-x snap-mandatory scrollbar-hide">
            {data.result.entries
              .sort((a, b) => a.position - b.position)
              .map((entry) => {
                const student = entry.student_id ? data.studentMap.get(entry.student_id) : undefined;
                const team = entry.team_id ? data.teamMap.get(entry.team_id) : (student ? data.teamMap.get(student.team_id) : undefined);

                const isFirst = entry.position === 1;

                return (
                  <div
                    key={`${data.result!.id}-${entry.position}`}
                    className={cn(
                      "min-w-[280px] sm:min-w-0 snap-center rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all relative overflow-hidden",
                      isFirst
                        ? "bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 shadow-sm ring-1 ring-yellow-100/50"
                        : "bg-white border border-gray-200 shadow-sm"
                    )}
                  >
                    {/* Position Badge */}
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border",
                        isFirst
                          ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                          : (entry.position === 2 ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-orange-50 text-orange-800 border-orange-100")
                      )}>
                        {entry.position === 1 ? "1st Place" : (entry.position === 2 ? "2nd Place" : "3rd Place")}
                      </span>
                      <div className="text-right">
                        <span className="block text-xl font-bold text-emerald-600 tabular-nums leading-none">
                          {formatNumber(entry.score)}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase">Score</span>
                      </div>
                    </div>

                    <div className="relative z-10">
                      <h3 className="font-bold text-gray-900 leading-snug text-lg mb-1.5 truncate">
                        {student?.name ?? team?.name ?? "—"}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {student && (
                          <div className="flex items-center gap-1">
                            <span className="opacity-70">Chest:</span>
                            <span className="font-medium text-gray-700">{student.chest_no}</span>
                          </div>
                        )}
                        {team && (
                          <div className="flex items-center gap-1">
                            <span className="opacity-70">Team:</span>
                            <span className="font-medium text-gray-700">{team.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Decorative background element for first place */}
                    {isFirst && (
                      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-yellow-100/50 rounded-full blur-2xl z-0" />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Penalties Section - Compact */}
          {(data.result.penalties?.length ?? 0) > 0 && (
            <div className="mt-6 rounded-lg border border-red-100 bg-red-50/50 p-4">
              <h4 className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Penalties Applied
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.result.penalties?.map((penalty, index) => {
                  const student = penalty.student_id ? data.studentMap.get(penalty.student_id) : undefined;
                  const team = penalty.team_id && (!student || student.team_id === penalty.team_id) ? data.teamMap.get(penalty.team_id) : (student ? data.teamMap.get(student.team_id) : data.teamMap.get(penalty.team_id ?? ""));
                  return (
                    <div key={index} className="flex items-center justify-between bg-white/60 rounded px-3 py-2 border border-red-100">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {student?.name ?? team?.name ?? "Unknown"}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {student ? `Chest #${student.chest_no}` : `Team: ${team?.name}`}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-red-600 ml-2 whitespace-nowrap">-{penalty.points} pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Poster Previews Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              Generated Posters
            </h2>
          </div>

          <Card className="border-gray-200 bg-white shadow-sm overflow-hidden rounded-xl">
            <ResultPosterPreview
              result={data.result}
              program={data.program}
              students={Array.from(data.studentMap.values())}
              teams={Array.from(data.teamMap.values())}
              templates={data.templates}
            />
          </Card>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">
              Result Published {new Date(data.result.submitted_at).toLocaleDateString()}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

