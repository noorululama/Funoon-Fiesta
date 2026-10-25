import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PollModel } from "@/lib/models";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectDB();
    try {
        const poll = await PollModel.findOne({ id });
        if (!poll) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }
        return NextResponse.json(poll);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectDB();
    try {
        const body = await request.json();
        // Prevent updating ID or createdAt
        delete body.id;
        delete body.createdAt;
        delete body.votes; // Prevent manual vote manipulation via this route usually

        const result = await PollModel.updateOne({ id }, { $set: body });

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        const updatedPoll = await PollModel.findOne({ id });
        return NextResponse.json(updatedPoll);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update poll" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectDB();
    try {
        const result = await PollModel.deleteOne({ id });
        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Poll deleted" });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete poll" }, { status: 500 });
    }
}
