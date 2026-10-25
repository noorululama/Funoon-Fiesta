
import {
    PredictionEventModel,
    PredictionModel,
    UserScoreModel
} from "./models";
import { Prediction, PredictionEvent, ResultEntry } from "./types";
import { emitLeaderboardUpdated, emitPredictionClosed } from "./pusher";
import { revalidatePath } from "next/cache";

export async function evaluatePredictionsForProgram(programId: string, results: ResultEntry[]) {
    // Find the winner (Position 1)
    const winnerEntry = results.find((r) => r.position === 1);
    if (!winnerEntry) return; // No winner, can't evaluate

    const winnerId = winnerEntry.student_id || winnerEntry.team_id;
    if (!winnerId) return;

    // Find associated prediction event
    const event = await PredictionEventModel.findOne({
        programId,
        status: { $ne: "evaluated" }
    }) as PredictionEvent | null;

    if (!event) return;

    // Find the matching option
    // The option.id is expected to match the winnerId (studentId or teamId)
    const winningOption = event.options.find((opt) => opt.id === winnerId);

    // If exact ID match fails, we might need other logic, but for now assuming direct ID mapping 
    // as per standard implementation where options are populated from participants.
    if (!winningOption) {
        console.log(`Prediction evaluation skipped: No matching option found for winner ${winnerId} in event ${event.id}`);
        return;
    }

    // Update Event
    // We use updateOne to avoid potential version errors if fetched elsewhere, or just save document
    await PredictionEventModel.updateOne(
        { id: event.id },
        {
            $set: {
                status: "evaluated",
                correctOptionId: winningOption.id
            }
        }
    );

    // Find correct predictions
    const correctPredictions = await PredictionModel.find({
        eventId: event.id,
        selectedOptionId: winningOption.id
    }) as Prediction[];

    const points = event.points || 10;

    // Update Scores
    if (correctPredictions.length > 0) {
        const updates = correctPredictions.map(pred => ({
            updateOne: {
                filter: { userId: pred.userId },
                update: {
                    $set: { userName: pred.userName },
                    $inc: { score: points }
                },
                upsert: true
            }
        }));

        await UserScoreModel.bulkWrite(updates);
    }

    // Emit Events
    await emitPredictionClosed(event.id);
    await emitLeaderboardUpdated();

    revalidatePath("/predictions");
    revalidatePath("/predictions/leaderboard");

    console.log(`Auto-evaluated prediction event ${event.id}. Winner: ${winningOption.label}, Correct Guesses: ${correctPredictions.length}`);
}
