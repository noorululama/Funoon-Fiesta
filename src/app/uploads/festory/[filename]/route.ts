
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    // Security: Prevent directory traversal
    const safeFilename = path.basename(filename);

    // Construct path. Note: We use process.cwd() + public to match the upload logic
    const filePath = path.join(process.cwd(), "public", "uploads", "festory", safeFilename);

    if (!existsSync(filePath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filePath);

        const ext = path.extname(safeFilename).toLowerCase();
        let contentType = "application/octet-stream";

        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".webp") contentType = "image/webp";
        if (ext === ".mp3") contentType = "audio/mpeg";
        if (ext === ".wav") contentType = "audio/wav";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": fileBuffer.length.toString(),
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("Error serving file:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
