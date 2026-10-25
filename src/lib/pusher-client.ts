"use client";

import Pusher from "pusher-js";

// Client-side Pusher instance (singleton)
export const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || "", {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1",
  forceTLS: true,
});

export function getPusherClient(): Pusher {
  return pusherClient;
}

// Channel names (same as server)
export const CHANNELS = {
  RESULTS: "results",
  ASSIGNMENTS: "assignments",
  REGISTRATIONS: "registrations",
  STUDENTS: "students",
  SCOREBOARD: "scoreboard",
} as const;

// Event names (same as server)
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
} as const;










