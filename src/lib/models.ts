import { Schema, model, models, type Model } from "mongoose";
import type {
  AssignedProgram,
  AdminSettings,
  Jury,
  LiveScore,
  Notification,
  Program,
  ProgramRegistration,
  RegistrationSchedule,
  ReplacementRequest,
  ResultRecord,
  Student,
  Team,
  Poll,
  PredictionEvent,
  Prediction,
  Vote,
  UserScore,
  FestoryPost,
  FestoryUser,
  FestoryComment,
  FestConfig,
  PosterTemplate,
} from "./types";

// Force new schema in dev
if (process.env.NODE_ENV !== "production") {
  delete models.Team;
  delete models.Student;
  delete models.Program;
  delete models.Jury;
  delete models.AssignedProgram;
  delete models.PendingResult;
  delete models.ApprovedResult;
  delete models.LiveScore;
  delete models.ProgramRegistration;
  delete models.RegistrationSchedule;
  delete models.ReplacementRequest;
  delete models.Notification;
  delete models.AdminSettings;
  delete models.Poll;
  delete models.Vote;
  delete models.PredictionEvent;
  delete models.Prediction;
  delete models.UserScore;
  delete models.FestoryPost;
  delete models.FestoryComment;
  delete models.FestoryUser;
  delete models.FestConfig;
  delete models.PosterTemplate;
}

const TeamSchema = new Schema<Team>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    leader: { type: String, required: true },
    leader_photo: { type: String, required: true },
    color: { type: String, required: true },
    description: { type: String, required: true },
    contact: { type: String, required: true },
    total_points: { type: Number, default: 0 },
    portal_password: { type: String, default: "" },
  },
  { timestamps: true },
);

const StudentSchema = new Schema<Student>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    team_id: { type: String, required: true },
    chest_no: { type: String, required: true },
    roll_no: { type: String },
    avatar: { type: String },
    total_points: { type: Number, default: 0 },
    phone_number: { type: String },
  },
  { timestamps: true },
);
// Unique index for chest numbers and roll numbers to prevent duplicates globally
StudentSchema.index({ chest_no: 1 }, { unique: true });
StudentSchema.index({ roll_no: 1 }, { unique: true, sparse: true });

const ProgramSchema = new Schema<Program>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    section: { type: String, enum: ["single", "general"], required: true },
    stage: { type: Boolean, default: true },
    category: { type: String, enum: ["A", "B", "C", "none"], default: "none" },
    candidateLimit: { type: Number, default: 1 },
  },
  { timestamps: true },
);

const JurySchema = new Schema<Jury>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    avatar: { type: String },
  },
  { timestamps: true },
);

const AssignedProgramSchema = new Schema<AssignedProgram>(
  {
    program_id: { type: String, required: true },
    jury_id: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "submitted", "completed"],
      default: "pending",
    },
  },
  { timestamps: true },
);
AssignedProgramSchema.index({ program_id: 1, jury_id: 1 }, { unique: true });

const ProgramRegistrationSchema = new Schema<ProgramRegistration>(
  {
    id: { type: String, required: true, unique: true },
    programId: { type: String, required: true },
    programName: { type: String, required: true },
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    studentChest: { type: String, required: true },
    teamId: { type: String, required: true },
    teamName: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { timestamps: true },
);
// Unique index to prevent duplicate program registrations (same student in same program)
ProgramRegistrationSchema.index({ programId: 1, studentId: 1 }, { unique: true });

const RegistrationScheduleSchema = new Schema<RegistrationSchedule & { key: string }>(
  {
    key: { type: String, required: true, unique: true },
    startDateTime: { type: String, required: true },
    endDateTime: { type: String, required: true },
  },
  { timestamps: true },
);

const resultEntrySchema = new Schema(
  {
    position: { type: Number, required: true },
    student_id: { type: String },
    team_id: { type: String },
    grade: { type: String, enum: ["A", "B", "C", "none"], default: "none" },
    score: { type: Number, required: true },
  },
  { _id: false },
);

const penaltyEntrySchema = new Schema(
  {
    student_id: { type: String },
    team_id: { type: String },
    points: { type: Number, required: true },
    reason: { type: String },
  },
  { _id: false },
);

const ResultSchema = new Schema<ResultRecord>(
  {
    id: { type: String, required: true, unique: true },
    program_id: { type: String, required: true },
    jury_id: { type: String, required: true },
    submitted_by: { type: String, required: true },
    submitted_at: { type: String, required: true },
    entries: { type: [resultEntrySchema], required: true },
    status: { type: String, enum: ["pending", "approved"], default: "pending" },
    notes: String,
    penalties: { type: [penaltyEntrySchema], default: [] },
  },
  { timestamps: true },
);
// Unique index to ensure only one result (pending or approved) exists per program
// This prevents duplicate result submissions for the same program
ResultSchema.index({ program_id: 1 }, { unique: true });

const LiveScoreSchema = new Schema<LiveScore>(
  {
    team_id: { type: String, required: true, unique: true },
    total_points: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const TeamModel =
  (models.Team as Model<Team>) ?? model<Team>("Team", TeamSchema);
export const StudentModel =
  (models.Student as Model<Student>) ?? model<Student>("Student", StudentSchema);
export const ProgramModel =
  (models.Program as Model<Program>) ?? model<Program>("Program", ProgramSchema);
export const JuryModel =
  (models.Jury as Model<Jury>) ?? model<Jury>("Jury", JurySchema);
export const AssignedProgramModel =
  (models.AssignedProgram as Model<AssignedProgram>) ??
  model<AssignedProgram>("AssignedProgram", AssignedProgramSchema);
export const PendingResultModel =
  (models.PendingResult as Model<ResultRecord>) ??
  model<ResultRecord>("PendingResult", ResultSchema, "results_pending");
export const ApprovedResultModel =
  (models.ApprovedResult as Model<ResultRecord>) ??
  model<ResultRecord>("ApprovedResult", ResultSchema, "results_approved");
export const LiveScoreModel =
  (models.LiveScore as Model<LiveScore>) ?? model<LiveScore>("LiveScore", LiveScoreSchema);
export const ProgramRegistrationModel =
  (models.ProgramRegistration as Model<ProgramRegistration>) ??
  model<ProgramRegistration>("ProgramRegistration", ProgramRegistrationSchema);
export const RegistrationScheduleModel =
  (models.RegistrationSchedule as Model<RegistrationSchedule & { key: string }>) ??
  model<RegistrationSchedule & { key: string }>(
    "RegistrationSchedule",
    RegistrationScheduleSchema,
  );

const ReplacementRequestSchema = new Schema<ReplacementRequest>(
  {
    id: { type: String, required: true, unique: true },
    programId: { type: String, required: true },
    programName: { type: String, required: true },
    oldStudentId: { type: String, required: true },
    oldStudentName: { type: String, required: true },
    oldStudentChest: { type: String, required: true },
    newStudentId: { type: String, required: true },
    newStudentName: { type: String, required: true },
    newStudentChest: { type: String, required: true },
    teamId: { type: String, required: true },
    teamName: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    submittedAt: { type: String, required: true },
    reviewedAt: { type: String },
    reviewedBy: { type: String },
  },
  { timestamps: true },
);
// Unique index to prevent duplicate pending replacement requests
// Only enforces uniqueness for pending requests (allows multiple approved/rejected)
ReplacementRequestSchema.index(
  { programId: 1, oldStudentId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);

export const ReplacementRequestModel =
  (models.ReplacementRequest as Model<ReplacementRequest>) ??
  model<ReplacementRequest>("ReplacementRequest", ReplacementRequestSchema);

const NotificationSchema = new Schema<Notification>(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, enum: ["result_published"], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    programId: { type: String, required: true },
    programName: { type: String, required: true },
    resultId: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { timestamps: true },
);

// Index for efficient querying of unread notifications
NotificationSchema.index({ read: 1, createdAt: -1 });

export const NotificationModel =
  (models.Notification as Model<Notification>) ??
  model<Notification>("Notification", NotificationSchema);

const AdminSettingsSchema = new Schema<AdminSettings>(
  {
    username: { type: String, required: true, default: "admin" },
    password: { type: String, required: true, default: "admin123" },
  },
  { timestamps: true },
);

export const AdminSettingsModel =
  (models.AdminSettings as Model<AdminSettings>) ??
  model<AdminSettings>("AdminSettings", AdminSettingsSchema);

const PollSchema = new Schema<Poll>(
  {
    id: { type: String, required: true, unique: true },
    question: { type: String, required: true },
    options: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        votes: { type: Number, default: 0 },
      },
    ],
    active: { type: Boolean, default: true },
    createdAt: { type: String, required: true },
  },
  { timestamps: true },
);

const VoteSchema = new Schema<Vote>(
  {
    pollId: { type: String, required: true },
    optionId: { type: String, required: true },
    voterHash: { type: String, required: true }, // unique index pair with pollId
    timestamp: { type: String, required: true },
  },
  { timestamps: true },
);
VoteSchema.index({ pollId: 1, voterHash: 1 }, { unique: true });

const PredictionEventSchema = new Schema<PredictionEvent>(
  {
    id: { type: String, required: true, unique: true },
    programId: { type: String, required: true },
    programName: { type: String, required: true },
    question: { type: String, required: true },
    options: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        image: String,
      },
    ],
    deadline: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "closed", "evaluated"],
      default: "open",
    },
    correctOptionId: String,
    points: { type: Number, default: 10 },
    createdAt: { type: String, required: true },
  },
  { timestamps: true },
);

const PredictionSchema = new Schema<Prediction>(
  {
    id: { type: String, required: true, unique: true },
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    selectedOptionId: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { timestamps: true },
);
PredictionSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const UserScoreSchema = new Schema<UserScore>(
  {
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    score: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PollModel =
  (models.Poll as Model<Poll>) ?? model<Poll>("Poll", PollSchema);

export const VoteModel =
  (models.Vote as Model<Vote>) ?? model<Vote>("Vote", VoteSchema);

export const PredictionEventModel =
  (models.PredictionEvent as Model<PredictionEvent>) ??
  model<PredictionEvent>("PredictionEvent", PredictionEventSchema);

export const PredictionModel =
  (models.Prediction as Model<Prediction>) ??
  model<Prediction>("Prediction", PredictionSchema);

export const UserScoreModel =
  (models.UserScore as Model<UserScore>) ??
  model<UserScore>("UserScore", UserScoreSchema);



const FestoryPostSchema = new Schema<FestoryPost>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userTeamId: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "audio", "poll"], required: true },
    content: { type: String, default: "" },
    mediaUrl: { type: String },
    likes: { type: [String], default: [] },
    pollOptions: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        votes: { type: [String], default: [] },
      },
    ],
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const FestoryCommentSchema = new Schema<FestoryComment>(
  {
    id: { type: String, required: true, unique: true },
    postId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userImage: { type: String },
    content: { type: String, required: true },
    parentId: { type: String },
  },
  { timestamps: true },
);

const FestoryUserSchema = new Schema<FestoryUser>(
  {
    id: { type: String, required: true, unique: true },
    studentId: { type: String }, // Removed required & unique
    googleId: { type: String },
    email: { type: String },
    name: { type: String, required: true },
    teamId: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    isBanned: { type: Boolean, default: false },
    image: { type: String },
    profileImageUpdateCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const FestoryPostModel =
  (models.FestoryPost as Model<FestoryPost>) ??
  model<FestoryPost>("FestoryPost", FestoryPostSchema);

export const FestoryCommentModel =
  (models.FestoryComment as Model<FestoryComment>) ??
  model<FestoryComment>("FestoryComment", FestoryCommentSchema);

export const FestoryUserModel =
  (models.FestoryUser as Model<FestoryUser>) ??
  model<FestoryUser>("FestoryUser", FestoryUserSchema);

const FestConfigSchema = new Schema<FestConfig>(
  {
    id: { type: String, required: true, unique: true, default: "global" },
    limits: {
      maxSingleOnStage: { type: Number, default: 3 },
      maxSingleOffStage: { type: Number, default: 4 },
      maxGeneral: { type: Number, default: 3 },
    },
    scoring: {
      enableCategories: { type: Boolean, default: true },
      categoryScores: {
        A: {
          1: { type: Number, default: 10 },
          2: { type: Number, default: 7 },
          3: { type: Number, default: 5 },
        },
        B: {
          1: { type: Number, default: 7 },
          2: { type: Number, default: 5 },
          3: { type: Number, default: 3 },
        },
        C: {
          1: { type: Number, default: 5 },
          2: { type: Number, default: 3 },
          3: { type: Number, default: 1 },
        },
      },
      gradeBonus: {
        A: { type: Number, default: 5 },
        B: { type: Number, default: 3 },
        C: { type: Number, default: 1 },
      },
      generalScores: {
        1: { type: Number, default: 20 },
        2: { type: Number, default: 15 },
        3: { type: Number, default: 10 },
      },
      flatSingleScores: {
        1: { type: Number, default: 10 },
        2: { type: Number, default: 7 },
        3: { type: Number, default: 5 },
      },
    },
  },
  { timestamps: true },
);

export const FestConfigModel =
  (models.FestConfig as Model<FestConfig>) ??
  model<FestConfig>("FestConfig", FestConfigSchema);

const TextOverlaySchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    fontSize: { type: Number, required: true },
    fontFamily: { type: String, default: "Arial, sans-serif" },
    fontWeight: { type: String, default: "normal" },
    color: { type: String, default: "#000000" },
    align: { type: String, enum: ["left", "center", "right"], default: "left" },
    maxWidth: { type: Number, default: 940 },
  },
  { _id: false },
);

const PositionSlotSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    showChestNo: { type: Boolean, default: false },
  },
  { _id: false },
);

const PosterTemplateSchema = new Schema<PosterTemplate>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    backgroundImageUrl: { type: String, required: true },
    width: { type: Number, default: 1080 },
    height: { type: Number, default: 1350 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    programName: { type: TextOverlaySchema, required: true },
    section: { type: TextOverlaySchema, required: true },
    prizesLayout: { type: String, enum: ["stacked", "slots"], default: "stacked" },
    stackedSettings: {
      startX: { type: Number, default: 180 },
      startY: { type: Number, default: 608 },
      spacingY: { type: Number, default: 120 },
      nameFontSize: { type: Number, default: 48 },
      nameColor: { type: String, default: "#000000" },
      nameFontFamily: { type: String, default: "Arial, sans-serif" },
      teamFontSize: { type: Number, default: 32 },
      teamColor: { type: String, default: "#000000" },
      teamFontFamily: { type: String, default: "Arial, sans-serif" },
      teamOffsetY: { type: Number, default: 50 },
      showChestNo: { type: Boolean, default: false },
      chestNoColor: { type: String, default: "#666666" },
      align: { type: String, enum: ["left", "center", "right"], default: "left" },
      maxWidth: { type: Number, default: 720 },
    },
    slotsSettings: {
      slot1: { type: PositionSlotSchema, default: { x: 180, y: 608 } },
      slot2: { type: PositionSlotSchema, default: { x: 180, y: 728 } },
      slot3: { type: PositionSlotSchema, default: { x: 180, y: 848 } },
      nameFontSize: { type: Number, default: 48 },
      nameColor: { type: String, default: "#000000" },
      nameFontFamily: { type: String, default: "Arial, sans-serif" },
      teamFontSize: { type: Number, default: 32 },
      teamColor: { type: String, default: "#000000" },
      teamFontFamily: { type: String, default: "Arial, sans-serif" },
      teamOffsetY: { type: Number, default: 50 },
      showChestNo: { type: Boolean, default: false },
      align: { type: String, enum: ["left", "center", "right"], default: "left" },
    },
    footer: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: "Official Results" },
      x: { type: Number, default: 540 },
      y: { type: Number, default: 1290 },
      fontSize: { type: Number, default: 24 },
      fontFamily: { type: String, default: "Arial, sans-serif" },
      fontWeight: { type: String, default: "normal" },
      color: { type: String, default: "rgba(255, 255, 255, 0.5)" },
      align: { type: String, enum: ["left", "center", "right"], default: "center" },
      maxWidth: { type: Number, default: 940 },
    },
  },
  { timestamps: true },
);

export const PosterTemplateModel =
  (models.PosterTemplate as Model<PosterTemplate>) ??
  model<PosterTemplate>("PosterTemplate", PosterTemplateSchema);

