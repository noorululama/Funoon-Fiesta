"use server";

import { connectDB } from "@/lib/db";
import {
    TeamModel,
    StudentModel,
    ProgramModel,
    JuryModel,
    AssignedProgramModel,
    ProgramRegistrationModel,
    RegistrationScheduleModel,
    PendingResultModel,
    ApprovedResultModel,
    LiveScoreModel,
    ReplacementRequestModel,
    NotificationModel,
    AdminSettingsModel,
    FestConfigModel,
} from "@/lib/models";
import { isAdminAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getDatabaseStats() {
    if (!(await isAdminAuthenticated())) {
        throw new Error("Unauthorized");
    }

    await connectDB();

    return {
        teams: await TeamModel.countDocuments(),
        students: await StudentModel.countDocuments(),
        programs: await ProgramModel.countDocuments(),
        juries: await JuryModel.countDocuments(),
        assignedPrograms: await AssignedProgramModel.countDocuments(),
        programRegistrations: await ProgramRegistrationModel.countDocuments(),
        registrationSchedules: await RegistrationScheduleModel.countDocuments(),
        pendingResults: await PendingResultModel.countDocuments(),
        approvedResults: await ApprovedResultModel.countDocuments(),
        liveScores: await LiveScoreModel.countDocuments(),
        replacementRequests: await ReplacementRequestModel.countDocuments(),
        notifications: await NotificationModel.countDocuments(),
    };
}

export async function restoreDatabase(data: any) {
    if (!(await isAdminAuthenticated())) {
        throw new Error("Unauthorized");
    }

    if (!data || typeof data !== "object") {
        throw new Error("Invalid backup file format");
    }

    await connectDB();

    // Helper to clean documents and insert safely
    const restoreCollection = async (model: any, rawItems: any): Promise<number> => {
        if (!Array.isArray(rawItems)) {
            return 0;
        }

        await model.deleteMany({});
        if (rawItems.length === 0) {
            return 0;
        }

        // Clean items: remove MongoDB internal _id if needed, or pass documents
        const cleanedItems = rawItems.map((item) => {
            if (!item || typeof item !== "object") return item;
            const { _id, __v, ...rest } = item;
            // Keep original _id only if valid 24-hex string, otherwise let MongoDB generate one
            if (_id && typeof _id === "string" && /^[0-9a-fA-F]{24}$/.test(_id)) {
                return { _id, ...rest };
            }
            return rest;
        });

        try {
            await model.insertMany(cleanedItems, { ordered: false });
        } catch (err: any) {
            // If duplicate key error on non-ordered insert, some documents still succeeded
            console.warn(`Partial insert for ${model.modelName}:`, err.message);
        }

        return await model.countDocuments();
    };

    try {
        const teams = data.teams || data.team;
        const students = data.students || data.student;
        const programs = data.programs || data.program;
        const juries = data.juries || data.jury;
        const assignedPrograms = data.assignedPrograms || data.assigned_programs || data.assignments;
        const programRegistrations =
            data.programRegistrations ||
            data.program_registrations ||
            data.programregistrations ||
            data.programRegistration ||
            data.programregitration ||
            data.registrations;
        const registrationSchedules = data.registrationSchedules || data.registration_schedules || data.schedules;
        const pendingResults = data.pendingResults || data.pending_results;
        const approvedResults = data.approvedResults || data.approved_results;
        const liveScores = data.liveScores || data.live_scores;
        const replacementRequests = data.replacementRequests || data.replacement_requests;
        const notifications = data.notifications;
        const adminSettings = data.adminSettings || data.admin_settings;
        const festConfig = data.festConfig || data.festConfigs || data.fest_config;

        const [
            teamCount,
            studentCount,
            programCount,
            regCount,
        ] = await Promise.all([
            restoreCollection(TeamModel, teams),
            restoreCollection(StudentModel, students),
            restoreCollection(ProgramModel, programs),
            restoreCollection(ProgramRegistrationModel, programRegistrations),
        ]);

        await Promise.all([
            restoreCollection(JuryModel, juries),
            restoreCollection(AssignedProgramModel, assignedPrograms),
            restoreCollection(RegistrationScheduleModel, registrationSchedules),
            restoreCollection(PendingResultModel, pendingResults),
            restoreCollection(ApprovedResultModel, approvedResults),
            restoreCollection(LiveScoreModel, liveScores),
            restoreCollection(ReplacementRequestModel, replacementRequests),
            restoreCollection(NotificationModel, notifications),
            restoreCollection(AdminSettingsModel, adminSettings),
            festConfig ? restoreCollection(FestConfigModel, Array.isArray(festConfig) ? festConfig : [festConfig]) : Promise.resolve(0),
        ]);

        revalidatePath("/");
        revalidatePath("/admin/settings");
        revalidatePath("/team/program-register");

        return {
            success: true,
            message: `Database restored successfully! (${teamCount} teams, ${studentCount} students, ${programCount} programs, ${regCount} program registrations)`,
        };
    } catch (error: any) {
        console.error("Restore failed:", error);
        return { success: false, message: error.message || "Restore failed" };
    }
}
