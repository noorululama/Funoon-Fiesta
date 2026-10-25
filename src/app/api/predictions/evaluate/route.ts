import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PredictionModel, PredictionEventModel, UserScoreModel } from "@/lib/models";
import { emitLeaderboardUpdated, emitPredictionClosed } from "@/lib/pusher";
import { Prediction } from "@/lib/types";

export async function POST(request: Request) {
    await connectDB();
    try {
        const { eventId, correctOptionId } = await request.json();

        const event = await PredictionEventModel.findOne({ id: eventId });
        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        if (event.status === "evaluated") {
            return NextResponse.json({ error: "Event already evaluated" }, { status: 400 });
        }

        // Update event
        event.status = "evaluated";
        event.correctOptionId = correctOptionId;
        await event.save();

        // Find correct predictions
        const correctPredictions = await PredictionModel.find({
            eventId,
            selectedOptionId: correctOptionId
        }) as Prediction[];

        const points = event.points || 10;

        // Bulk update scores
        for (const pred of correctPredictions) {
            await UserScoreModel.updateOne(
                { userId: pred.userId },
                {
                    $set: { userName: pred.userName }, // Ensure name is up to date
                    $inc: { score: points }
                },
                { upsert: true }
            );
        }

        await emitPredictionClosed(eventId);
        await emitLeaderboardUpdated();

        return NextResponse.json({
            message: "Evaluated successfully",
            correctCount: correctPredictions.length
        });
    } catch (error) {
        console.error("Evaluation error:", error);
        return NextResponse.json({ error: "Failed to evaluate" }, { status: 500 });
    }
}
