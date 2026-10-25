import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PollModel } from "@/lib/models";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
    await connectDB();
    try {
        const polls = await PollModel.find().sort({ createdAt: -1 });
        return NextResponse.json(polls);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch polls" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    await connectDB();
    try {
        const body = await request.json();
        const { question, options } = body;

        const newPoll = await PollModel.create({
            id: uuidv4(),
            question,
            options: options.map((opt: string) => ({
                id: uuidv4(),
                text: opt,
                votes: 0,
            })),
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json(newPoll, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create poll" }, { status: 500 });
    }
}
