import type { Team, Program, ResultRecord, Student, LiveScore } from "./types";

export interface TeamScoreBreakdownItem {
  resultId: string;
  programId: string;
  programName: string;
  section: string;
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
  currentPoints: number;
  currentRank: number;
  pendingAdditions: number;
  pendingDeductions: number;
  pendingNetPoints: number;
  projectedPoints: number;
  projectedRank: number;
  rankShift: number; // >0 means improved (e.g. #3 to #1 is +2), <0 means dropped (-1), 0 means no change
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
  currentPoints: number;
  currentRank: number;
  pendingPoints: number;
  projectedPoints: number;
  projectedRank: number;
  rankShift: number;
  pendingEntries: {
    resultId: string;
    programId: string;
    programName: string;
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
    currentLeader: { id: string; name: string; points: number } | null;
    projectedLeader: { id: string; name: string; points: number } | null;
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
  // Maps for fast lookups
  const liveScoreMap =
    liveScores instanceof Map
      ? liveScores
      : new Map(liveScores.map((ls) => [ls.team_id, ls.total_points]));

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const programMap = new Map(programs.map((p) => [p.id, p]));

  // Determine which pending results are included
  const activePendingResults = selectedPendingResultIds
    ? pendingResults.filter((r) => selectedPendingResultIds.includes(r.id))
    : pendingResults;

  const activePendingIdsSet = new Set(activePendingResults.map((r) => r.id));

  // 1. Calculate Current Medals & Penalties for each team from approved results
  const currentMedalsMap = new Map<
    string,
    { gold: number; silver: number; bronze: number; total: number }
  >();
  const currentPenaltiesMap = new Map<string, number>();

  teams.forEach((t) => {
    currentMedalsMap.set(t.id, { gold: 0, silver: 0, bronze: 0, total: 0 });
    currentPenaltiesMap.set(t.id, 0);
  });

  approvedResults.forEach((result) => {
    // Entries / Medals
    result.entries.forEach((entry) => {
      let teamId = entry.team_id;
      if (!teamId && entry.student_id) {
        teamId = studentMap.get(entry.student_id)?.team_id;
      }
      if (teamId && currentMedalsMap.has(teamId)) {
        const medal = currentMedalsMap.get(teamId)!;
        if (entry.position === 1) medal.gold++;
        if (entry.position === 2) medal.silver++;
        if (entry.position === 3) medal.bronze++;
        medal.total++;
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

  // 2. Calculate Pending Additions, Deductions, Medals from active pending results
  const pendingAdditionsMap = new Map<string, number>();
  const pendingDeductionsMap = new Map<string, number>();
  const pendingMedalsMap = new Map<
    string,
    { gold: number; silver: number; bronze: number; total: number }
  >();
  const pendingContributionsMap = new Map<string, TeamScoreBreakdownItem[]>();

  teams.forEach((t) => {
    pendingAdditionsMap.set(t.id, 0);
    pendingDeductionsMap.set(t.id, 0);
    pendingMedalsMap.set(t.id, { gold: 0, silver: 0, bronze: 0, total: 0 });
    pendingContributionsMap.set(t.id, []);
  });

  activePendingResults.forEach((result) => {
    const program = programMap.get(result.program_id);
    const programName = program?.name ?? "Unknown Program";
    const section = program?.section ?? "general";
    const category = program?.category ?? "none";

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

  // 3. Compute Current Ranks for teams
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

  // 4. Compute Projected Points and Ranks
  const precalculatedTeamsRaw = teams.map((team) => {
    const currentPoints =
      liveScoreMap.get(team.id) ?? team.total_points ?? 0;
    const pendingAdd = pendingAdditionsMap.get(team.id) || 0;
    const pendingDed = pendingDeductionsMap.get(team.id) || 0;
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

    const curPenalties = currentPenaltiesMap.get(team.id) || 0;
    const pendPenalties = pendingDeductionsMap.get(team.id) || 0;
    const projPenalties = curPenalties + pendPenalties;

    return {
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color || "#4F46E5",
      teamLeader: team.leader || "Leader",
      currentPoints,
      currentRank: currentRankMap.get(team.id) || 1,
      pendingAdditions: pendingAdd,
      pendingDeductions: pendingDed,
      pendingNetPoints: pendingNet,
      projectedPoints,
      projectedRank: 1, // calculated below
      rankShift: 0, // calculated below
      currentMedals: curMedals,
      pendingMedals: pendMedals,
      projectedMedals: projMedals,
      currentPenalties: curPenalties,
      pendingPenalties: pendPenalties,
      projectedPenalties: projPenalties,
      contributions: pendingContributionsMap.get(team.id) || [],
    };
  });

  // Sort by projected points descending
  precalculatedTeamsRaw.sort((a, b) => b.projectedPoints - a.projectedPoints);

  let projRank = 1;
  const precalculatedTeams: PrecalculatedTeam[] = precalculatedTeamsRaw.map(
    (item, index) => {
      if (index > 0) {
        if (item.projectedPoints < precalculatedTeamsRaw[index - 1].projectedPoints) {
          projRank = index + 1;
        }
      }
      const rankShift = item.currentRank - projRank; // positive = moved up, negative = dropped
      return {
        ...item,
        projectedRank: projRank,
        rankShift,
      };
    },
  );

  // 5. Pre-calculate Students standings
  // Student current ranks
  const studentsWithPoints = [...students].filter((s) => s.total_points > 0);
  studentsWithPoints.sort((a, b) => b.total_points - a.total_points);
  const studentCurrentRankMap = new Map<string, number>();
  let sCurRank = 1;
  studentsWithPoints.forEach((s, index) => {
    if (index > 0 && s.total_points < studentsWithPoints[index - 1].total_points) {
      sCurRank = index + 1;
    }
    studentCurrentRankMap.set(s.id, sCurRank);
  });

  // Calculate student pending additions
  const studentPendingMap = new Map<
    string,
    {
      points: number;
      entries: PrecalculatedStudent["pendingEntries"];
    }
  >();

  activePendingResults.forEach((result) => {
    const program = programMap.get(result.program_id);
    result.entries.forEach((entry) => {
      if (entry.student_id) {
        const existing = studentPendingMap.get(entry.student_id) || {
          points: 0,
          entries: [],
        };
        existing.points += entry.score;
        existing.entries.push({
          resultId: result.id,
          programId: result.program_id,
          programName: program?.name ?? "Program",
          position: entry.position,
          grade: entry.grade,
          score: entry.score,
        });
        studentPendingMap.set(entry.student_id, existing);
      }
    });
  });

  // Combine students who have current or pending points
  const candidateStudentIds = new Set<string>();
  students.forEach((s) => {
    if (s.total_points > 0 || studentPendingMap.has(s.id)) {
      candidateStudentIds.add(s.id);
    }
  });

  const precalculatedStudentsRaw: PrecalculatedStudent[] = [];
  candidateStudentIds.forEach((studentId) => {
    const student = studentMap.get(studentId);
    if (!student) return;
    const team = teamMap.get(student.team_id);
    const currentPoints = student.total_points || 0;
    const pendingInfo = studentPendingMap.get(studentId) || {
      points: 0,
      entries: [],
    };
    const projectedPoints = currentPoints + pendingInfo.points;

    precalculatedStudentsRaw.push({
      studentId: student.id,
      studentName: student.name,
      chestNo: student.chest_no,
      teamId: student.team_id,
      teamName: team?.name || "Unknown Team",
      teamColor: team?.color || "#4F46E5",
      currentPoints,
      currentRank: studentCurrentRankMap.get(student.id) || 999,
      pendingPoints: pendingInfo.points,
      projectedPoints,
      projectedRank: 1,
      rankShift: 0,
      pendingEntries: pendingInfo.entries,
    });
  });

  precalculatedStudentsRaw.sort((a, b) => b.projectedPoints - a.projectedPoints);

  let studentProjRank = 1;
  const precalculatedStudents: PrecalculatedStudent[] =
    precalculatedStudentsRaw.map((s, index) => {
      if (index > 0) {
        if (s.projectedPoints < precalculatedStudentsRaw[index - 1].projectedPoints) {
          studentProjRank = index + 1;
        }
      }
      const rankShift = s.currentRank === 999 ? 0 : s.currentRank - studentProjRank;
      return {
        ...s,
        projectedRank: studentProjRank,
        rankShift,
      };
    });

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
      currentLeader: currentLeaderTeam,
      projectedLeader: projectedLeaderTeam,
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
