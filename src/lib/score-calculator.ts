import type { Team, Program, ResultRecord, Student, LiveScore } from "./types";

export type ProgramType = "stage" | "non-stage" | "general";

/**
 * Classifies a program into stage, non-stage, or general.
 * GENERAL programs are strictly categorized as "general" and NEVER added to stage or non-stage.
 */
export function getProgramType(program?: Program): ProgramType {
  if (!program) return "general";
  if (program.section === "general") return "general";
  return program.stage === true ? "stage" : "non-stage";
}

export interface TeamScoreBreakdownItem {
  resultId: string;
  programId: string;
  programName: string;
  section: string;
  stageType: ProgramType;
  category: string;
  position?: 1 | 2 | 3;
  winnerName?: string;
  grade?: string;
  pointsAdded: number;
  penaltiesSubtracted: number;
  netImpact: number;
}

export interface PrecalculatedTeam {
  teamId: string;
  teamName: string;
  teamColor: string;
  teamLeader: string;

  // Total Team Score (Overall)
  currentPoints: number;
  currentRank: number;
  pendingAdditions: number;
  pendingDeductions: number;
  pendingNetPoints: number;
  projectedPoints: number;
  projectedRank: number;
  rankShift: number;

  // Stage Score (Single Stage items only)
  currentStagePoints: number;
  pendingStagePoints: number;
  projectedStagePoints: number;
  stageRank: number;

  // Non-Stage Score (Single Non-Stage items only)
  currentNonStagePoints: number;
  pendingNonStagePoints: number;
  projectedNonStagePoints: number;
  nonStageRank: number;

  // General Score (General programs only - not added in stage or non-stage)
  currentGeneralPoints: number;
  pendingGeneralPoints: number;
  projectedGeneralPoints: number;
  generalRank: number;

  // Medals & Penalties
  currentMedals: { gold: number; silver: number; bronze: number; total: number };
  pendingMedals: { gold: number; silver: number; bronze: number; total: number };
  projectedMedals: { gold: number; silver: number; bronze: number; total: number };
  currentPenalties: number;
  pendingPenalties: number;
  projectedPenalties: number;
  contributions: TeamScoreBreakdownItem[];
}

export interface PrecalculatedStudent {
  studentId: string;
  studentName: string;
  chestNo: string;
  teamId: string;
  teamName: string;
  teamColor: string;

  // Overall Individual Score (Stage + Non-Stage)
  currentPoints: number;
  currentRank: number;
  pendingPoints: number;
  projectedPoints: number;
  projectedRank: number;
  overallRank: number;
  rankShift: number;

  // Stage Points
  currentStagePoints: number;
  pendingStagePoints: number;
  projectedStagePoints: number;
  stageRank: number;
  currentStageRank: number;
  stageRankShift: number;

  // Non-Stage Points
  currentNonStagePoints: number;
  pendingNonStagePoints: number;
  projectedNonStagePoints: number;
  nonStageRank: number;
  currentNonStageRank: number;
  nonStageRankShift: number;

  pendingEntries: {
    resultId: string;
    programId: string;
    programName: string;
    programType: "stage" | "non-stage";
    position: 1 | 2 | 3;
    grade?: string;
    score: number;
  }[];
}

export interface PendingResultTeamImpact {
  teamId: string;
  teamName: string;
  teamColor: string;
  pointsGained: number;
  penalties: number;
  netPoints: number;
  positions: (1 | 2 | 3)[];
}

export interface PendingResultImpact {
  resultId: string;
  programId: string;
  programName: string;
  programSection: string;
  programStage: boolean;
  programType: ProgramType;
  programCategory: string;
  juryName: string;
  submittedAt: string;
  totalPointsAwarded: number;
  totalPenaltiesDeducted: number;
  teamsImpacted: PendingResultTeamImpact[];
  entries: {
    position: 1 | 2 | 3;
    name: string;
    teamName: string;
    grade?: string;
    score: number;
  }[];
  penalties: {
    targetName: string;
    type: "team" | "student";
    points: number;
    reason?: string;
  }[];
}

export interface PrecalculatedScoresData {
  teams: PrecalculatedTeam[];
  students: PrecalculatedStudent[];
  pendingResultsImpacts: PendingResultImpact[];
  summary: {
    totalPendingResults: number;
    selectedPendingResultsCount: number;
    totalPointsInPlay: number;
    totalPenaltiesInPlay: number;
    stagePointsInPlay: number;
    nonStagePointsInPlay: number;
    generalPointsInPlay: number;
    currentLeader: { id: string; name: string; points: number } | null;
    projectedLeader: { id: string; name: string; points: number } | null;
    stageLeader: { id: string; name: string; points: number } | null;
    nonStageLeader: { id: string; name: string; points: number } | null;
    generalLeader: { id: string; name: string; points: number } | null;
    topStudentOverall: { id: string; name: string; chestNo: string; points: number } | null;
    topStudentStage: { id: string; name: string; chestNo: string; points: number } | null;
    topStudentNonStage: { id: string; name: string; chestNo: string; points: number } | null;
    hasLeaderChanged: boolean;
    biggestGainer: { id: string; name: string; gain: number } | null;
  };
}

export interface CalculateScoresParams {
  teams: Team[];
  liveScores: LiveScore[] | Map<string, number>;
  approvedResults: ResultRecord[];
  pendingResults: ResultRecord[];
  students: Student[];
  programs: Program[];
  selectedPendingResultIds?: string[];
}

/**
 * Calculates pre-calculated / projected scores for teams and students
 * given the approved results and a subset (or all) of pending results.
 * Distinguishes Stage, Non-Stage, and General scores.
 */
export function calculatePrecalculatedStandings({
  teams,
  liveScores,
  approvedResults,
  pendingResults,
  students,
  programs,
  selectedPendingResultIds,
}: CalculateScoresParams): PrecalculatedScoresData {
  const liveScoreMap =
    liveScores instanceof Map
      ? liveScores
      : new Map(liveScores.map((ls) => [ls.team_id, ls.total_points]));

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const programMap = new Map(programs.map((p) => [p.id, p]));

  // Active pending results for simulation
  const activePendingResults = selectedPendingResultIds
    ? pendingResults.filter((r) => selectedPendingResultIds.includes(r.id))
    : pendingResults;

  // 1. Calculate Approved Base Scores (Stage, Non-Stage, General, Medals, Penalties)
  const currentStageMap = new Map<string, number>();
  const currentNonStageMap = new Map<string, number>();
  const currentGeneralMap = new Map<string, number>();
  const currentPenaltiesMap = new Map<string, number>();
  const currentMedalsMap = new Map<
    string,
    { gold: number; silver: number; bronze: number; total: number }
  >();

  // Student approved points
  const studentCurrentStageMap = new Map<string, number>();
  const studentCurrentNonStageMap = new Map<string, number>();

  teams.forEach((t) => {
    currentStageMap.set(t.id, 0);
    currentNonStageMap.set(t.id, 0);
    currentGeneralMap.set(t.id, 0);
    currentPenaltiesMap.set(t.id, 0);
    currentMedalsMap.set(t.id, { gold: 0, silver: 0, bronze: 0, total: 0 });
  });

  students.forEach((s) => {
    studentCurrentStageMap.set(s.id, 0);
    studentCurrentNonStageMap.set(s.id, 0);
  });

  approvedResults.forEach((result) => {
    const program = programMap.get(result.program_id);
    const pType = getProgramType(program);

    // Entries / Medals
    result.entries.forEach((entry) => {
      let teamId = entry.team_id;
      if (!teamId && entry.student_id) {
        teamId = studentMap.get(entry.student_id)?.team_id;
      }

        if (teamId) {
          // Track Stage, Non-Stage, General for Teams
          if (pType === "stage") {
            currentStageMap.set(teamId, (currentStageMap.get(teamId) || 0) + entry.score);
          } else if (pType === "non-stage") {
            currentNonStageMap.set(teamId, (currentNonStageMap.get(teamId) || 0) + entry.score);
          } else if (pType === "general") {
            currentGeneralMap.set(teamId, (currentGeneralMap.get(teamId) || 0) + entry.score);
          }

          // Medals
          if (currentMedalsMap.has(teamId)) {
            const medal = currentMedalsMap.get(teamId)!;
            if (entry.position === 1) medal.gold++;
            if (entry.position === 2) medal.silver++;
            if (entry.position === 3) medal.bronze++;
            medal.total++;
          }
        }

        // Track Stage and Non-Stage for individual students
        if (entry.student_id) {
          if (pType === "stage") {
            studentCurrentStageMap.set(
              entry.student_id,
              (studentCurrentStageMap.get(entry.student_id) || 0) + entry.score,
            );
          } else if (pType === "non-stage") {
            studentCurrentNonStageMap.set(
              entry.student_id,
              (studentCurrentNonStageMap.get(entry.student_id) || 0) + entry.score,
            );
          }
        }
      });

    // Penalties
    result.penalties?.forEach((penalty) => {
      let teamId = penalty.team_id;
      if (!teamId && penalty.student_id) {
        teamId = studentMap.get(penalty.student_id)?.team_id;
      }
      if (teamId && currentPenaltiesMap.has(teamId)) {
        currentPenaltiesMap.set(
          teamId,
          (currentPenaltiesMap.get(teamId) || 0) + penalty.points,
        );
      }
    });
  });

  // 2. Calculate Pending Additions (Stage, Non-Stage, General) from active pending results
  const pendingStageMap = new Map<string, number>();
  const pendingNonStageMap = new Map<string, number>();
  const pendingGeneralMap = new Map<string, number>();
  const pendingAdditionsMap = new Map<string, number>();
  const pendingDeductionsMap = new Map<string, number>();
  const pendingMedalsMap = new Map<
    string,
    { gold: number; silver: number; bronze: number; total: number }
  >();
  const pendingContributionsMap = new Map<string, TeamScoreBreakdownItem[]>();

  // Student pending points
  const studentPendingStageMap = new Map<string, number>();
  const studentPendingNonStageMap = new Map<string, number>();
  const studentPendingEntriesMap = new Map<
    string,
    PrecalculatedStudent["pendingEntries"]
  >();

  teams.forEach((t) => {
    pendingStageMap.set(t.id, 0);
    pendingNonStageMap.set(t.id, 0);
    pendingGeneralMap.set(t.id, 0);
    pendingAdditionsMap.set(t.id, 0);
    pendingDeductionsMap.set(t.id, 0);
    pendingMedalsMap.set(t.id, { gold: 0, silver: 0, bronze: 0, total: 0 });
    pendingContributionsMap.set(t.id, []);
  });

  students.forEach((s) => {
    studentPendingStageMap.set(s.id, 0);
    studentPendingNonStageMap.set(s.id, 0);
    studentPendingEntriesMap.set(s.id, []);
  });

  let stagePointsInPlay = 0;
  let nonStagePointsInPlay = 0;
  let generalPointsInPlay = 0;

  activePendingResults.forEach((result) => {
    const program = programMap.get(result.program_id);
    const programName = program?.name ?? "Unknown Program";
    const section = program?.section ?? "general";
    const category = program?.category ?? "none";
    const pType = getProgramType(program);

    // Track per-team impact within this single result
    const resultTeamImpacts = new Map<
      string,
      {
        pointsAdded: number;
        penaltiesSubtracted: number;
        position?: 1 | 2 | 3;
        winnerName?: string;
        grade?: string;
      }
    >();

    // Entries
    result.entries.forEach((entry) => {
      let teamId = entry.team_id;
      let winnerName: string | undefined;

      if (entry.student_id) {
        const student = studentMap.get(entry.student_id);
        if (student) {
          teamId = student.team_id;
          winnerName = student.name;
        }
      } else if (teamId) {
        winnerName = teamMap.get(teamId)?.name;
      }

      if (teamId && pendingAdditionsMap.has(teamId)) {
        // Points in play total & per type
        if (pType === "stage") {
          stagePointsInPlay += entry.score;
          pendingStageMap.set(teamId, (pendingStageMap.get(teamId) || 0) + entry.score);
        } else if (pType === "non-stage") {
          nonStagePointsInPlay += entry.score;
          pendingNonStageMap.set(teamId, (pendingNonStageMap.get(teamId) || 0) + entry.score);
        } else if (pType === "general") {
          generalPointsInPlay += entry.score;
          pendingGeneralMap.set(teamId, (pendingGeneralMap.get(teamId) || 0) + entry.score);
        }

        pendingAdditionsMap.set(
          teamId,
          (pendingAdditionsMap.get(teamId) || 0) + entry.score,
        );

        // Medals
        const medal = pendingMedalsMap.get(teamId)!;
        if (entry.position === 1) medal.gold++;
        if (entry.position === 2) medal.silver++;
        if (entry.position === 3) medal.bronze++;
        medal.total++;

        // Single result tracking
        const currentImpact = resultTeamImpacts.get(teamId) || {
          pointsAdded: 0,
          penaltiesSubtracted: 0,
        };
        resultTeamImpacts.set(teamId, {
          ...currentImpact,
          pointsAdded: currentImpact.pointsAdded + entry.score,
          position: entry.position,
          winnerName: winnerName || currentImpact.winnerName,
          grade: entry.grade,
        });
      }

      // Student pending calculations (Single Stage or Non-Stage only)
      if (entry.student_id) {
        if (pType === "stage") {
          studentPendingStageMap.set(
            entry.student_id,
            (studentPendingStageMap.get(entry.student_id) || 0) + entry.score,
          );
        } else if (pType === "non-stage") {
          studentPendingNonStageMap.set(
            entry.student_id,
            (studentPendingNonStageMap.get(entry.student_id) || 0) + entry.score,
          );
        }

        const entriesList = studentPendingEntriesMap.get(entry.student_id) || [];
        entriesList.push({
          resultId: result.id,
          programId: result.program_id,
          programName,
          programType: pType === "stage" ? "stage" : "non-stage",
          position: entry.position,
          grade: entry.grade,
          score: entry.score,
        });
        studentPendingEntriesMap.set(entry.student_id, entriesList);
      }
    });

    // Penalties
    result.penalties?.forEach((penalty) => {
      let teamId = penalty.team_id;
      let targetName: string | undefined;

      if (penalty.student_id) {
        const student = studentMap.get(penalty.student_id);
        if (student) {
          teamId = student.team_id;
          targetName = student.name;
        }
      } else if (teamId) {
        targetName = teamMap.get(teamId)?.name;
      }

      if (teamId && pendingDeductionsMap.has(teamId)) {
        pendingDeductionsMap.set(
          teamId,
          (pendingDeductionsMap.get(teamId) || 0) + penalty.points,
        );

        const currentImpact = resultTeamImpacts.get(teamId) || {
          pointsAdded: 0,
          penaltiesSubtracted: 0,
        };
        resultTeamImpacts.set(teamId, {
          ...currentImpact,
          penaltiesSubtracted:
            currentImpact.penaltiesSubtracted + penalty.points,
          winnerName: currentImpact.winnerName || targetName,
        });
      }
    });

    // Save contributions
    resultTeamImpacts.forEach((impact, teamId) => {
      if (pendingContributionsMap.has(teamId)) {
        pendingContributionsMap.get(teamId)!.push({
          resultId: result.id,
          programId: result.program_id,
          programName,
          section,
          stageType: pType,
          category,
          position: impact.position,
          winnerName: impact.winnerName,
          grade: impact.grade,
          pointsAdded: impact.pointsAdded,
          penaltiesSubtracted: impact.penaltiesSubtracted,
          netImpact: impact.pointsAdded - impact.penaltiesSubtracted,
        });
      }
    });
  });

  // 3. Compute Current Ranks for teams (Overall, Stage, Non-Stage, General)
  const currentRanked = [...teams].sort((a, b) => {
    const scoreA = liveScoreMap.get(a.id) ?? a.total_points ?? 0;
    const scoreB = liveScoreMap.get(b.id) ?? b.total_points ?? 0;
    return scoreB - scoreA;
  });

  const currentRankMap = new Map<string, number>();
  let currentRank = 1;
  currentRanked.forEach((t, index) => {
    const score = liveScoreMap.get(t.id) ?? t.total_points ?? 0;
    if (index > 0) {
      const prevScore =
        liveScoreMap.get(currentRanked[index - 1].id) ??
        currentRanked[index - 1].total_points ??
        0;
      if (score < prevScore) {
        currentRank = index + 1;
      }
    }
    currentRankMap.set(t.id, currentRank);
  });

  // 4. Build Team Objects
  const precalculatedTeamsRaw = teams.map((team) => {
    const curStage = currentStageMap.get(team.id) || 0;
    const pendStage = pendingStageMap.get(team.id) || 0;
    const projStage = curStage + pendStage;

    const curNonStage = currentNonStageMap.get(team.id) || 0;
    const pendNonStage = pendingNonStageMap.get(team.id) || 0;
    const projNonStage = curNonStage + pendNonStage;

    const curGeneral = currentGeneralMap.get(team.id) || 0;
    const pendGeneral = pendingGeneralMap.get(team.id) || 0;
    const projGeneral = curGeneral + pendGeneral;

    const curPenalties = currentPenaltiesMap.get(team.id) || 0;
    const pendPenalties = pendingDeductionsMap.get(team.id) || 0;
    const projPenalties = curPenalties + pendPenalties;

    const curApprovedSum = curStage + curNonStage + curGeneral - curPenalties;
    const liveScore = liveScoreMap.get(team.id) ?? team.total_points ?? 0;
    const currentPoints = Math.max(liveScore, curApprovedSum);

    const pendingAdd = pendStage + pendNonStage + pendGeneral;
    const pendingDed = pendPenalties;
    const pendingNet = pendingAdd - pendingDed;
    const projectedPoints = currentPoints + pendingNet;

    const curMedals = currentMedalsMap.get(team.id) || {
      gold: 0,
      silver: 0,
      bronze: 0,
      total: 0,
    };
    const pendMedals = pendingMedalsMap.get(team.id) || {
      gold: 0,
      silver: 0,
      bronze: 0,
      total: 0,
    };
    const projMedals = {
      gold: curMedals.gold + pendMedals.gold,
      silver: curMedals.silver + pendMedals.silver,
      bronze: curMedals.bronze + pendMedals.bronze,
      total: curMedals.total + pendMedals.total,
    };

    return {
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color || "#4F46E5",
      teamLeader: team.leader || "Leader",

      // Overall
      currentPoints,
      currentRank: currentRankMap.get(team.id) || 1,
      pendingAdditions: pendingAdd,
      pendingDeductions: pendingDed,
      pendingNetPoints: pendingNet,
      projectedPoints,
      projectedRank: 1,
      rankShift: 0,

      // Stage
      currentStagePoints: curStage,
      pendingStagePoints: pendStage,
      projectedStagePoints: projStage,
      stageRank: 1,

      // Non-Stage
      currentNonStagePoints: curNonStage,
      pendingNonStagePoints: pendNonStage,
      projectedNonStagePoints: projNonStage,
      nonStageRank: 1,

      // General
      currentGeneralPoints: curGeneral,
      pendingGeneralPoints: pendGeneral,
      projectedGeneralPoints: projGeneral,
      generalRank: 1,

      currentMedals: curMedals,
      pendingMedals: pendMedals,
      projectedMedals: projMedals,
      currentPenalties: curPenalties,
      pendingPenalties: pendPenalties,
      projectedPenalties: projPenalties,
      contributions: pendingContributionsMap.get(team.id) || [],
    };
  });

  // Calculate Ranks for Teams across sections
  // Overall Rank
  precalculatedTeamsRaw.sort((a, b) => b.projectedPoints - a.projectedPoints);
  let projRank = 1;
  precalculatedTeamsRaw.forEach((item, index) => {
    if (index > 0 && item.projectedPoints < precalculatedTeamsRaw[index - 1].projectedPoints) {
      projRank = index + 1;
    }
    item.projectedRank = projRank;
    item.rankShift = item.currentRank - projRank;
  });

  // Stage Rank
  const sortedByStage = [...precalculatedTeamsRaw].sort(
      (a, b) => b.projectedStagePoints - a.projectedStagePoints,
    );
      let stageR = 1;
      sortedByStage.forEach((item, index) => {
        if (index > 0 && item.projectedStagePoints < sortedByStage[index - 1].projectedStagePoints) {
          stageR = index + 1;
        }
        item.stageRank = stageR;
      });

      // Non-Stage Rank
      const sortedByNonStage = [...precalculatedTeamsRaw].sort(
        (a, b) => b.projectedNonStagePoints - a.projectedNonStagePoints,
      );
      let nonStageR = 1;
      sortedByNonStage.forEach((item, index) => {
        if (index > 0 && item.projectedNonStagePoints < sortedByNonStage[index - 1].projectedNonStagePoints) {
          nonStageR = index + 1;
        }
          item.nonStageRank = nonStageR;
        });

            // General Rank
            const sortedByGeneral = [...precalculatedTeamsRaw].sort(
              (a, b) => b.projectedGeneralPoints - a.projectedGeneralPoints,
            );
            let generalR = 1;
            sortedByGeneral.forEach((item, index) => {
              if (index > 0 && item.projectedGeneralPoints < sortedByGeneral[index - 1].projectedGeneralPoints) {
                generalR = index + 1;
              }
              item.generalRank = generalR;
            });

              // Return teams sorted by projected overall points
              const precalculatedTeams = precalculatedTeamsRaw.sort(
                (a, b) => b.projectedPoints - a.projectedPoints,
              );

                // 5. Pre-calculate Students standings (Overall, Stage, Non-Stage)
                // Compute student approved ranks
                const rawStudentList = students.map((s) => {
                  const curStage = studentCurrentStageMap.get(s.id) || 0;
                  const curNonStage = studentCurrentNonStageMap.get(s.id) || 0;
                  const curApprovedSum = curStage + curNonStage;
                  const currentPoints = Math.max(s.total_points || 0, curApprovedSum);

                  const pendStage = studentPendingStageMap.get(s.id) || 0;
                  const pendNonStage = studentPendingNonStageMap.get(s.id) || 0;
                  const pendTotal = pendStage + pendNonStage;

                  const projStage = curStage + pendStage;
                  const projNonStage = curNonStage + pendNonStage;
                  const projTotal = currentPoints + pendTotal;

                  const team = teamMap.get(s.team_id);

                  return {
                    studentId: s.id,
                    studentName: s.name,
                    chestNo: s.chest_no,
                    teamId: s.team_id,
                    teamName: team?.name || "Unknown Team",
                    teamColor: team?.color || "#4F46E5",

                    // Overall
                    currentPoints,
                    currentRank: 999,
                    pendingPoints: pendTotal,
                    projectedPoints: projTotal,
                    projectedRank: 1,
                    overallRank: 1,
                    rankShift: 0,

                // Stage
                currentStagePoints: curStage,
                currentStageRank: 999,
                pendingStagePoints: pendStage,
                projectedStagePoints: projStage,
                stageRank: 1,
                stageRankShift: 0,

                // Non-Stage
                currentNonStagePoints: curNonStage,
                currentNonStageRank: 999,
                pendingNonStagePoints: pendNonStage,
                projectedNonStagePoints: projNonStage,
                nonStageRank: 1,
                nonStageRankShift: 0,

                pendingEntries: studentPendingEntriesMap.get(s.id) || [],
              };
            });

            // Filter students who have current or pending points
            const activeStudents = rawStudentList.filter(
              (s) => s.currentPoints > 0 || s.pendingPoints > 0,
            );

            // Current ranks for students
            const curOverallSorted = [...activeStudents].sort((a, b) => b.currentPoints - a.currentPoints);
            let curOR = 1;
            curOverallSorted.forEach((s, idx) => {
              if (idx > 0 && s.currentPoints < curOverallSorted[idx - 1].currentPoints) {
                curOR = idx + 1;
              }
              s.currentRank = curOR;
            });

            const curStageSorted = [...activeStudents].sort(
              (a, b) => b.currentStagePoints - a.currentStagePoints,
            );
            let curSR = 1;
            curStageSorted.forEach((s, idx) => {
              if (idx > 0 && s.currentStagePoints < curStageSorted[idx - 1].currentStagePoints) {
                curSR = idx + 1;
              }
              s.currentStageRank = curSR;
            });

            const curNonStageSorted = [...activeStudents].sort(
              (a, b) => b.currentNonStagePoints - a.currentNonStagePoints,
            );
            let curNSR = 1;
            curNonStageSorted.forEach((s, idx) => {
              if (idx > 0 && s.currentNonStagePoints < curNonStageSorted[idx - 1].currentNonStagePoints) {
                curNSR = idx + 1;
              }
              s.currentNonStageRank = curNSR;
            });

            // Projected Overall Ranks
            activeStudents.sort((a, b) => b.projectedPoints - a.projectedPoints);
            let projOR = 1;
            activeStudents.forEach((s, idx) => {
              if (idx > 0 && s.projectedPoints < activeStudents[idx - 1].projectedPoints) {
                projOR = idx + 1;
              }
              s.projectedRank = projOR;
              s.overallRank = projOR;
              s.rankShift = s.currentRank === 999 ? 0 : s.currentRank - projOR;
            });

            // Projected Stage Ranks
            const projStageSorted = [...activeStudents].sort(
              (a, b) => b.projectedStagePoints - a.projectedStagePoints,
            );
            let projSR = 1;
            projStageSorted.forEach((s, idx) => {
              if (idx > 0 && s.projectedStagePoints < projStageSorted[idx - 1].projectedStagePoints) {
                projSR = idx + 1;
              }
              s.stageRank = projSR;
              s.stageRankShift = s.currentStageRank === 999 ? 0 : s.currentStageRank - projSR;
            });

            // Projected Non-Stage Ranks
            const projNonStageSorted = [...activeStudents].sort(
              (a, b) => b.projectedNonStagePoints - a.projectedNonStagePoints,
            );
            let projNSR = 1;
            projNonStageSorted.forEach((s, idx) => {
              if (idx > 0 && s.projectedNonStagePoints < projNonStageSorted[idx - 1].projectedNonStagePoints) {
                projNSR = idx + 1;
              }
              s.nonStageRank = projNSR;
              s.nonStageRankShift = s.currentNonStageRank === 999 ? 0 : s.currentNonStageRank - projNSR;
            });

            const precalculatedStudents = activeStudents;

            // 6. Impact breakdown for each pending result
            const pendingResultsImpacts: PendingResultImpact[] = pendingResults.map(
              (result) => {
                return getPendingResultImpact(result, teams, students, programs);
              },
            );

            // 7. Overall Summary
            const currentLeaderTeam =
              currentRanked.length > 0
                ? {
          id: currentRanked[0].id,
              name: currentRanked[0].name,
                points:
            liveScoreMap.get(currentRanked[0].id) ??
              currentRanked[0].total_points ??
              0,
        }
      : null;

          const projectedLeaderTeam =
            precalculatedTeams.length > 0
              ? {
          id: precalculatedTeams[0].teamId,
            name: precalculatedTeams[0].teamName,
              points: precalculatedTeams[0].projectedPoints,
        }
      : null;

        // Section Leaders
        const stageLeaderTeam =
          sortedByStage.length > 0
            ? {
              id: sortedByStage[0].teamId,
              name: sortedByStage[0].teamName,
              points: sortedByStage[0].projectedStagePoints,
            }
            : null;

        const nonStageLeaderTeam =
          sortedByNonStage.length > 0
            ? {
              id: sortedByNonStage[0].teamId,
              name: sortedByNonStage[0].teamName,
              points: sortedByNonStage[0].projectedNonStagePoints,
            }
            : null;

        const generalLeaderTeam =
          sortedByGeneral.length > 0
            ? {
              id: sortedByGeneral[0].teamId,
              name: sortedByGeneral[0].teamName,
              points: sortedByGeneral[0].projectedGeneralPoints,
            }
            : null;

        // Top Students
        const topStudentOverall =
          precalculatedStudents.length > 0
            ? {
              id: precalculatedStudents[0].studentId,
              name: precalculatedStudents[0].studentName,
              chestNo: precalculatedStudents[0].chestNo,
              points: precalculatedStudents[0].projectedPoints,
            }
            : null;

        const topStageStudentObj = [...precalculatedStudents].sort(
          (a, b) => b.projectedStagePoints - a.projectedStagePoints,
        )[0];
        const topStudentStage =
          topStageStudentObj && topStageStudentObj.projectedStagePoints > 0
            ? {
              id: topStageStudentObj.studentId,
              name: topStageStudentObj.studentName,
              chestNo: topStageStudentObj.chestNo,
              points: topStageStudentObj.projectedStagePoints,
            }
            : null;

        const topNonStageStudentObj = [...precalculatedStudents].sort(
          (a, b) => b.projectedNonStagePoints - a.projectedNonStagePoints,
        )[0];
        const topStudentNonStage =
          topNonStageStudentObj && topNonStageStudentObj.projectedNonStagePoints > 0
            ? {
              id: topNonStageStudentObj.studentId,
              name: topNonStageStudentObj.studentName,
              chestNo: topNonStageStudentObj.chestNo,
              points: topNonStageStudentObj.projectedNonStagePoints,
            }
            : null;

        const totalPointsInPlay = activePendingResults.reduce((sum, r) => {
          return sum + r.entries.reduce((eSum, e) => eSum + e.score, 0);
        }, 0);

        const totalPenaltiesInPlay = activePendingResults.reduce((sum, r) => {
          return sum + (r.penalties?.reduce((pSum, p) => pSum + p.points, 0) ?? 0);
        }, 0);

        let biggestGainer: { id: string; name: string; gain: number } | null = null;
        precalculatedTeams.forEach((t) => {
          if (!biggestGainer || t.pendingNetPoints > biggestGainer.gain) {
            if (t.pendingNetPoints > 0) {
              biggestGainer = {
                id: t.teamId,
                name: t.teamName,
                gain: t.pendingNetPoints,
              };
            }
          }
        });

        return {
          teams: precalculatedTeams,
          students: precalculatedStudents,
          pendingResultsImpacts,
          summary: {
            totalPendingResults: pendingResults.length,
            selectedPendingResultsCount: activePendingResults.length,
            totalPointsInPlay,
            totalPenaltiesInPlay,
            stagePointsInPlay,
            nonStagePointsInPlay,
            generalPointsInPlay,
            currentLeader: currentLeaderTeam,
            projectedLeader: projectedLeaderTeam,
            stageLeader: stageLeaderTeam,
            nonStageLeader: nonStageLeaderTeam,
            generalLeader: generalLeaderTeam,
            topStudentOverall,
            topStudentStage,
            topStudentNonStage,
            hasLeaderChanged:
              !!currentLeaderTeam &&
              !!projectedLeaderTeam &&
              currentLeaderTeam.id !== projectedLeaderTeam.id,
            biggestGainer,
          },
        };
      }

/**
 * Helper to calculate the impact of a single pending result on teams and students
 */
export function getPendingResultImpact(
        result: ResultRecord,
        teams: Team[],
        students: Student[],
        programs: Program[],
      ): PendingResultImpact {
        const teamMap = new Map(teams.map((t) => [t.id, t]));
        const studentMap = new Map(students.map((s) => [s.id, s]));
        const program = programs.find((p) => p.id === result.program_id);
        const pType = getProgramType(program);

        const teamImpactMap = new Map<
          string,
          {
            pointsGained: number;
            penalties: number;
            positions: (1 | 2 | 3)[];
          }
        >();

        // Process winners / entries
        const entriesList: PendingResultImpact["entries"] = [];
        result.entries.forEach((entry) => {
          let teamId = entry.team_id;
          let name = "—";

          if (entry.student_id) {
            const student = studentMap.get(entry.student_id);
            if (student) {
              teamId = student.team_id;
              name = `${student.name} (${student.chest_no})`;
            }
          } else if (teamId) {
            name = teamMap.get(teamId)?.name ?? "Team";
          }

          const team = teamId ? teamMap.get(teamId) : undefined;
          const teamName = team?.name ?? "Unknown Team";

          entriesList.push({
            position: entry.position,
            name,
            teamName,
            grade: entry.grade,
            score: entry.score,
          });

          if (teamId) {
            const existing = teamImpactMap.get(teamId) || {
              pointsGained: 0,
              penalties: 0,
              positions: [],
            };
            existing.pointsGained += entry.score;
            if (!existing.positions.includes(entry.position)) {
              existing.positions.push(entry.position);
            }
            teamImpactMap.set(teamId, existing);
          }
        });

        // Process penalties
        const penaltiesList: PendingResultImpact["penalties"] = [];
        result.penalties?.forEach((pen) => {
          let teamId = pen.team_id;
          let targetName = "Unknown";
          const type: "team" | "student" = pen.student_id ? "student" : "team";

          if (pen.student_id) {
            const student = studentMap.get(pen.student_id);
            if (student) {
              teamId = student.team_id;
              targetName = `${student.name} (${student.chest_no})`;
            }
          } else if (pen.team_id) {
            targetName = teamMap.get(pen.team_id)?.name ?? "Team";
          }

          penaltiesList.push({
            targetName,
            type,
            points: pen.points,
            reason: pen.reason,
          });

          if (teamId) {
            const existing = teamImpactMap.get(teamId) || {
              pointsGained: 0,
              penalties: 0,
              positions: [],
            };
            existing.penalties += pen.points;
            teamImpactMap.set(teamId, existing);
          }
        });

        // Format team impacts
        const teamsImpacted: PendingResultTeamImpact[] = [];
        teamImpactMap.forEach((impact, teamId) => {
          const team = teamMap.get(teamId);
          teamsImpacted.push({
            teamId,
            teamName: team?.name ?? "Unknown",
            teamColor: team?.color ?? "#4F46E5",
            pointsGained: impact.pointsGained,
            penalties: impact.penalties,
            netPoints: impact.pointsGained - impact.penalties,
            positions: impact.positions.sort((a, b) => a - b),
          });
        });

        // Sort teams by net points descending
        teamsImpacted.sort((a, b) => b.netPoints - a.netPoints);

        const totalPointsAwarded = result.entries.reduce((sum, e) => sum + e.score, 0);
        const totalPenaltiesDeducted =
          result.penalties?.reduce((sum, p) => sum + p.points, 0) ?? 0;

        return {
          resultId: result.id,
          programId: result.program_id,
          programName: program?.name ?? "Unknown Program",
          programSection: program?.section ?? "general",
          programStage: program?.stage ?? false,
          programType: pType,
          programCategory: program?.category ?? "none",
          juryName: result.submitted_by || "Unknown Jury",
          submittedAt: result.submitted_at,
          totalPointsAwarded,
          totalPenaltiesDeducted,
          teamsImpacted,
          entries: entriesList,
          penalties: penaltiesList,
        };
      }
