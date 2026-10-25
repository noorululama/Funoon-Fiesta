import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PredictionEventModel } from "@/lib/models";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectDB();
    try {
        const event = await PredictionEventModel.findOne({ id });
        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }
        return NextResponse.json(event);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
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
        delete body.id;
        delete body.createdAt;

        const result = await PredictionEventModel.updateOne({ id }, { $set: body });

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const updatedEvent = await PredictionEventModel.findOne({ id });
        return NextResponse.json(updatedEvent);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    await connectDB();
    try {
        const result = await PredictionEventModel.deleteOne({ id });
        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Event deleted" });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
    }
}
