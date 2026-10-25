import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ProgramModel } from "@/lib/models";

export async function GET() {
    await connectDB();
    try {
        // Fetch only necessary fields for dropdown
        const programs = await ProgramModel.find({}, { id: 1, name: 1, category: 1 }).sort({ name: 1 });
        return NextResponse.json(programs);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch programs" }, { status: 500 });
    }
}
