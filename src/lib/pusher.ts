import Pusher from "pusher";

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || "mt1",
  useTLS: true,
});

// Channel names
export const CHANNELS = {
  RESULTS: "results",
  ASSIGNMENTS: "assignments",
  REGISTRATIONS: "registrations",
  STUDENTS: "students",
  SCOREBOARD: "scoreboard",
  POLLS: "polls",
  PREDICTIONS: "predictions",
  FESTORY: "festory",
} as const;

// Event names
export const EVENTS = {
  RESULT_APPROVED: "result-approved",
  RESULT_REJECTED: "result-rejected",
  RESULT_SUBMITTED: "result-submitted",
  RESULT_UPDATED: "result-updated",
  ASSIGNMENT_CREATED: "assignment-created",
  ASSIGNMENT_DELETED: "assignment-deleted",
  REGISTRATION_CREATED: "registration-created",
  REGISTRATION_DELETED: "registration-deleted",
  STUDENT_CREATED: "student-created",
  STUDENT_UPDATED: "student-updated",
  STUDENT_DELETED: "student-deleted",
  SCOREBOARD_UPDATED: "scoreboard-updated",
  POLL_UPDATED: "poll-updated",
  PREDICTION_OPENED: "prediction-opened",
  PREDICTION_CLOSED: "prediction-closed",
  LEADERBOARD_UPDATED: "leaderboard-updated",
  FESTORY_POST_CREATED: "festory-post-created",
  FESTORY_AUDIO_BOMB: "festory-audio-bomb",
  FESTORY_ANNOUNCEMENT: "festory-announcement",
  FESTORY_POST_DELETED: "festory-post-deleted",
  FESTORY_POST_UPDATED: "festory-post-updated",
} as const;

export async function emitFestoryPostUpdated(post: any) {
  await pusherServer.trigger(CHANNELS.FESTORY, EVENTS.FESTORY_POST_UPDATED, {
    post,
    timestamp: new Date().toISOString(),
  });
}

export async function emitFestoryPostCreated(post: any) {
  await pusherServer.trigger(CHANNELS.FESTORY, EVENTS.FESTORY_POST_CREATED, {
    post,
    timestamp: new Date().toISOString(),
  });
}

export async function emitFestoryAudioBomb(sound: string, user: string) {
  await pusherServer.trigger(CHANNELS.FESTORY, EVENTS.FESTORY_AUDIO_BOMB, {
    sound,
    user,
    timestamp: new Date().toISOString(),
  });
}

export async function emitFestoryAnnouncement(audioUrl: string, user: string) {
  await pusherServer.trigger(CHANNELS.FESTORY, EVENTS.FESTORY_ANNOUNCEMENT, {
    audioUrl,
    user,
    timestamp: new Date().toISOString(),
  });
}

export async function emitFestoryPostDeleted(postId: string) {
  await pusherServer.trigger(CHANNELS.FESTORY, EVENTS.FESTORY_POST_DELETED, {
    postId,
    timestamp: new Date().toISOString(),
  });
}

// Helper functions to emit events
export async function emitResultApproved(resultId: string, programId: string) {
  await pusherServer.trigger(CHANNELS.RESULTS, EVENTS.RESULT_APPROVED, {
    resultId,
    programId,
    timestamp: new Date().toISOString(),
  });

  // Also update scoreboard
  await pusherServer.trigger(CHANNELS.SCOREBOARD, EVENTS.SCOREBOARD_UPDATED, {
    timestamp: new Date().toISOString(),
  });
}

export async function emitResultRejected(resultId: string, programId: string) {
  await pusherServer.trigger(CHANNELS.RESULTS, EVENTS.RESULT_REJECTED, {
    resultId,
    programId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitResultSubmitted(resultId: string, programId: string, juryId: string) {
  await pusherServer.trigger(CHANNELS.RESULTS, EVENTS.RESULT_SUBMITTED, {
    resultId,
    programId,
    juryId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitResultUpdated(resultId: string, programId: string) {
  await pusherServer.trigger(CHANNELS.RESULTS, EVENTS.RESULT_UPDATED, {
    resultId,
    programId,
    timestamp: new Date().toISOString(),
  });

  await pusherServer.trigger(CHANNELS.SCOREBOARD, EVENTS.SCOREBOARD_UPDATED, {
    timestamp: new Date().toISOString(),
  });
}

export async function emitAssignmentCreated(programId: string, juryId: string) {
  await pusherServer.trigger(CHANNELS.ASSIGNMENTS, EVENTS.ASSIGNMENT_CREATED, {
    programId,
    juryId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitAssignmentDeleted(programId: string, juryId: string) {
  await pusherServer.trigger(CHANNELS.ASSIGNMENTS, EVENTS.ASSIGNMENT_DELETED, {
    programId,
    juryId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitRegistrationCreated(registrationId: string, programId: string, teamId: string) {
  await pusherServer.trigger(CHANNELS.REGISTRATIONS, EVENTS.REGISTRATION_CREATED, {
    registrationId,
    programId,
    teamId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitRegistrationDeleted(registrationId: string, programId: string, teamId: string) {
  await pusherServer.trigger(CHANNELS.REGISTRATIONS, EVENTS.REGISTRATION_DELETED, {
    registrationId,
    programId,
    teamId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitStudentCreated(studentId: string, teamId: string) {
  await pusherServer.trigger(CHANNELS.STUDENTS, EVENTS.STUDENT_CREATED, {
    studentId,
    teamId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitStudentUpdated(studentId: string, teamId: string) {
  await pusherServer.trigger(CHANNELS.STUDENTS, EVENTS.STUDENT_UPDATED, {
    studentId,
    teamId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitStudentDeleted(studentId: string, teamId: string) {
  await pusherServer.trigger(CHANNELS.STUDENTS, EVENTS.STUDENT_DELETED, {
    studentId,
    teamId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitNotificationCreated(notification: {
  id: string;
  type: string;
  title: string;
  message: string;
  programId: string;
  programName: string;
  resultId: string;
  createdAt: string;
}) {
  await pusherServer.trigger(CHANNELS.RESULTS, "notification-created", {
    notification,
    timestamp: new Date().toISOString(),
  });
}

export async function emitPollUpdated(pollId: string) {
  await pusherServer.trigger(CHANNELS.POLLS, EVENTS.POLL_UPDATED, {
    pollId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitPredictionOpened(predictionId: string) {
  await pusherServer.trigger(CHANNELS.PREDICTIONS, EVENTS.PREDICTION_OPENED, {
    predictionId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitPredictionClosed(predictionId: string) {
  await pusherServer.trigger(CHANNELS.PREDICTIONS, EVENTS.PREDICTION_CLOSED, {
    predictionId,
    timestamp: new Date().toISOString(),
  });
}

export async function emitLeaderboardUpdated() {
  await pusherServer.trigger(CHANNELS.PREDICTIONS, EVENTS.LEADERBOARD_UPDATED, {
    timestamp: new Date().toISOString(),
  });
}










