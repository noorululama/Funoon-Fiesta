"use client";

import { useState, useEffect } from "react";
import { generateResultPoster } from "./result-poster-canvas";
import { ResultPosterDownloadButton } from "./result-poster-download-button";
import { ResultPosterShareButton } from "./result-poster-share-button";
import type { ResultRecord, Program, Student, Team, PosterTemplate } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface ResultPosterPreviewProps {
  result: ResultRecord;
  program: Program;
  studentMap: Map<string, Student>;
  teamMap: Map<string, Team>;
  templates?: PosterTemplate[];
}

export interface ResultPosterPreviewWrapperProps {
  result: ResultRecord;
  program: Program;
  students: Student[];
  teams: Team[];
  templates?: PosterTemplate[];
}

function ResultPosterPreviewInner({
  result,
  program,
  studentMap,
  teamMap,
  templates = [],
}: ResultPosterPreviewProps) {
  const [posterUrls, setPosterUrls] = useState<Map<string, string>>(new Map());
  const [loadedTemplates, setLoadedTemplates] = useState<PosterTemplate[]>(templates);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadAndGenerate = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let activeTemplates = templates;

        // If templates were not passed from server, fetch from API
        if (!activeTemplates || activeTemplates.length === 0) {
          try {
            const res = await fetch("/api/poster-templates");
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                activeTemplates = data;
              }
            }
          } catch (e) {
            console.warn("Could not fetch active poster templates from API, falling back:", e);
          }
        }

        if (isMounted) {
          setLoadedTemplates(activeTemplates);
        }

        // Prepare prize data from result entries
        const prizes = result.entries
          .sort((a, b) => a.position - b.position)
          .map((entry) => {
            const student = entry.student_id
              ? studentMap.get(entry.student_id)
              : undefined;
            const team = entry.team_id
              ? teamMap.get(entry.team_id)
              : student
                ? teamMap.get(student.team_id)
                : undefined;

            return {
              position: entry.position,
              studentName: student?.name,
              teamName: team?.name,
              chestNumber: student?.chest_no,
            };
          });

        const posterData = {
          programName: program.name,
          section: program.section,
          category: program.category !== "none" ? program.category : undefined,
          prizes: prizes.filter((p) => p.position <= 3) as Array<{
            position: 1 | 2 | 3;
            studentName?: string;
            teamName?: string;
            chestNumber?: string;
          }>,
        };

        const urlMap = new Map<string, string>();

        if (activeTemplates && activeTemplates.length > 0) {
          for (const tmpl of activeTemplates) {
            try {
              const imgData = await generateResultPoster(posterData, tmpl);
              urlMap.set(tmpl.id, imgData);
            } catch (err) {
              console.error(`Error generating poster for ${tmpl.name}:`, err);
            }
          }
        } else {
          // Fallback legacy styles 1, 2, 3
          for (const s of [1, 2, 3] as const) {
            try {
              const imgData = await generateResultPoster(posterData, s);
              urlMap.set(`legacy-${s}`, imgData);
            } catch (err) {
              console.error(`Error generating legacy poster ${s}:`, err);
            }
          }
        }

        if (isMounted) {
          setPosterUrls(urlMap);
        }
      } catch (err) {
        console.error("Error generating poster previews:", err);
        if (isMounted) {
          setError("Failed to generate poster previews");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAndGenerate();

    return () => {
      isMounted = false;
    };
  }, [result, program, studentMap, teamMap, templates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <p className="text-sm text-gray-500">Generating poster previews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (posterUrls.size === 0) {
    return null;
  }

  // Determine items to display
  const displayItems =
    loadedTemplates && loadedTemplates.length > 0
      ? loadedTemplates.map((t) => ({
          key: t.id,
          name: t.name,
          template: t,
          url: posterUrls.get(t.id),
        }))
      : [
          { key: "legacy-1", name: "Style 1", template: undefined, url: posterUrls.get("legacy-1") },
          { key: "legacy-2", name: "Style 2", template: undefined, url: posterUrls.get("legacy-2") },
          { key: "legacy-3", name: "Style 3", template: undefined, url: posterUrls.get("legacy-3") },
        ];

  const gridColsClass =
    displayItems.length === 1
      ? "grid-cols-1 max-w-md mx-auto"
      : displayItems.length === 2
        ? "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Poster Previews</h3>
        <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
          {displayItems.filter((i) => i.url).length} Design{displayItems.length === 1 ? "" : "s"} Available
        </span>
      </div>

      <div className={`grid ${gridColsClass} gap-6`}>
        {displayItems.map((item) => {
          if (!item.url) return null;

          return (
            <div
              key={item.key}
              className="flex flex-col items-center space-y-4 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 transition-all hover:shadow-md"
            >
              <div className="w-full flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-gray-700">{item.name}</span>
              </div>

              <div className="relative border-2 border-gray-200/80 rounded-xl overflow-hidden shadow-lg w-full bg-slate-900">
                <img
                  src={item.url}
                  alt={`${program.name} Result Poster - ${item.name}`}
                  className="w-full h-auto block"
                  style={{ display: "block" }}
                />
              </div>

              <div className="flex items-center gap-2 w-full pt-1">
                <div className="flex-1">
                  <ResultPosterDownloadButton
                    result={result}
                    program={program}
                    studentMap={studentMap}
                    teamMap={teamMap}
                    template={item.template}
                    variant="default"
                    size="default"
                    className="w-full"
                  />
                </div>
                <ResultPosterShareButton
                  result={result}
                  program={program}
                  studentMap={studentMap}
                  teamMap={teamMap}
                  template={item.template}
                  variant="default"
                  size="icon"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResultPosterPreview({
  result,
  program,
  students,
  teams,
  templates,
}: ResultPosterPreviewWrapperProps) {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return (
    <ResultPosterPreviewInner
      result={result}
      program={program}
      studentMap={studentMap}
      teamMap={teamMap}
      templates={templates}
    />
  );
}
