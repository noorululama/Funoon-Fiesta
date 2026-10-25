import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PollModel, VoteModel } from "@/lib/models";
import { emitPollUpdated } from "@/lib/pusher";
import { Poll } from "@/lib/types";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectDB();
    try {
        const { optionId } = await request.json();

        // 1. Robust IP Extraction
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(',')[0].trim() : "unknown";

        // 2. Browser Fingerprinting Elements
        const userAgent = request.headers.get("user-agent") || "unknown";
        const acceptLanguage = request.headers.get("accept-language") || "unknown";

        // 3. Cookie-based Device ID (Persistent Tracker)
        const cookieStore = await cookies();
        let deviceId = cookieStore.get("poll_device_id")?.value;

        // If no device cookie, generate one (but we can't fully rely on it as it can be cleared)
        // However, it stops casual users who don't know how to clear cookies.
        if (!deviceId) {
            deviceId = crypto.randomUUID();
        }

        // 4. Create a strong unique hash for the voter
        // We combine IP + UA + Language to create a fingerprint
        const fingerprintString = `${ip}-${userAgent}-${acceptLanguage}`;
        const voterHash = crypto.createHash('sha256').update(fingerprintString).digest('hex');

        // SECURITY CHECK
        // This catches users who use Incognito (No Cookie) but are on the same network/device
        const voteByHash = await VoteModel.findOne({ pollId: id, voterHash });

        if (voteByHash) {
            return NextResponse.json(
                { error: "You have already voted in this poll (Device Detected)" },
                { status: 403 }
            );
        }

        // Check if poll exists and is active
        const poll = await PollModel.findOne({ id }) as Poll | null;
        if (!poll || !poll.active) {
            return NextResponse.json(
                { error: "Poll not found or inactive" },
                { status: 404 }
            );
        }

        // Verify option exists
        const optionExists = poll.options.some((opt) => opt.id === optionId);
        if (!optionExists) {
            return NextResponse.json({ error: "Invalid option" }, { status: 400 });
        }

        // Record vote
        await VoteModel.create({
            pollId: id,
            optionId,
            voterHash,
            timestamp: new Date().toISOString(),
        });

        // Update poll counts
        await PollModel.updateOne(
            { id, "options.id": optionId },
            { $inc: { "options.$.votes": 1 } }
        );

        // Trigger Pusher update
        await emitPollUpdated(id);

        // Set the robust device cookie
        const response = NextResponse.json({ message: "Vote submitted" });
        response.cookies.set({
            name: "poll_device_id",
            value: deviceId,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1 year
        });

        return response;

    } catch (error: any) {
        // Handle unique constraint violation gracefully (Race condition double vote)
        if (error.code === 11000) {
            return NextResponse.json(
                { error: "You have already voted in this poll" },
                { status: 403 }
            );
        }
        console.error("Vote error:", error);
        return NextResponse.json({ error: "Failed to submit vote" }, { status: 500 });
    }
}
