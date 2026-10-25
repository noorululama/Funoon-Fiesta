import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { UserScoreModel } from "@/lib/models";

export async function GET() {
    await connectDB();
    try {
        const leaderboard = await UserScoreModel.find()
            .sort({ score: -1 })
            .limit(50); // Top 50

        // Add rank
        const ranked = leaderboard.map((user, index) => ({
            ...user.toObject(),
            rank: index + 1,
        }));

        return NextResponse.json(ranked);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }
}
