import { NextResponse } from "next/server";
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
    FestConfigModel,
} from "@/lib/models";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
    if (!(await isAdminAuthenticated())) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    await connectDB();

    const data = {
        teams: await TeamModel.find({}, { portal_password: 0 }).lean(),
        students: await StudentModel.find({}).lean(),
        programs: await ProgramModel.find({}).lean(),
        juries: await JuryModel.find({}, { password: 0 }).lean(),
        assignedPrograms: await AssignedProgramModel.find({}).lean(),
        programRegistrations: await ProgramRegistrationModel.find({}).lean(),
        registrationSchedules: await RegistrationScheduleModel.find({}).lean(),
        pendingResults: await PendingResultModel.find({}).lean(),
        approvedResults: await ApprovedResultModel.find({}).lean(),
        liveScores: await LiveScoreModel.find({}).lean(),
        replacementRequests: await ReplacementRequestModel.find({}).lean(),
        notifications: await NotificationModel.find({}).lean(),
        festConfig: await FestConfigModel.findOne({ id: "global" }).lean(),
        // Security: Do NOT export admin settings (contains hashed credentials)
        timestamp: new Date().toISOString(),
        version: "1.2",
    };

    const json = JSON.stringify(data, null, 2);
    const filename = `funoon-fiesta-backup-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(json, {
        headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
