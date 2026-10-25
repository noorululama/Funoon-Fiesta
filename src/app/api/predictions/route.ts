import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PredictionEventModel } from "@/lib/models";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
    await connectDB();
    try {
        const events = await PredictionEventModel.find().sort({ createdAt: -1 });
        return NextResponse.json(events);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch prediction events" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    await connectDB();
    try {
        const body = await request.json();
        const { programId, programName, question, options, deadline, points } = body;

        const newEvent = await PredictionEventModel.create({
            id: uuidv4(),
            programId,
            programName,
            question,
            options, // Assuming options are formatted correctly from client
            deadline,
            points: points || 10,
            createdAt: new Date().toISOString(),
        });

        // Suggestion: Emit event if needed "emitPredictionEventCreated"

        return NextResponse.json(newEvent, { status: 201 });
    } catch (error) {
        console.error("Create prediction event error:", error);
        return NextResponse.json({ error: "Failed to create prediction event" }, { status: 500 });
    }
}
