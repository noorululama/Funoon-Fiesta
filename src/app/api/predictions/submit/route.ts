import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PredictionModel, PredictionEventModel } from "@/lib/models";
import { emitPredictionOpened } from "@/lib/pusher"; // Maybe prediction-submitted? Or just nothing until evaluation.
import { v4 as uuidv4 } from "uuid";
import { PredictionEvent } from "@/lib/types";

export async function POST(request: Request) {
    await connectDB();
    try {
        const { eventId, userId, userName, selectedOptionId } = await request.json();

        if (!userId || !eventId || !selectedOptionId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check event status and deadline
        const event = await PredictionEventModel.findOne({ id: eventId }) as PredictionEvent | null;
        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        if (event.status !== "open") {
            return NextResponse.json({ error: "Prediction is closed" }, { status: 400 });
        }

        const now = new Date();
        const deadline = new Date(event.deadline);
        if (now > deadline) {
            return NextResponse.json({ error: "Deadline has passed" }, { status: 400 });
        }

        // Check existing prediction
        const existing = await PredictionModel.findOne({ eventId, userId });
        if (existing) {
            // Optional: Allow update? Requirements said "submit predictions", usually implies once.
            // Let's allow update if open? Or block. Block is safer for "one shot".
            return NextResponse.json({ error: "You have already submitted a prediction" }, { status: 403 });
        }

        await PredictionModel.create({
            id: uuidv4(),
            eventId,
            userId,
            userName,
            selectedOptionId,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json({ message: "Prediction submitted" });
    } catch (error) {
        console.error("Prediction submit error:", error);
        return NextResponse.json({ error: "Failed to submit prediction" }, { status: 500 });
    }
}
