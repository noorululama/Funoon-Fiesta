import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "festory");

export async function uploadFile(file: File, type: "image" | "audio"): Promise<string> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = type === "image" ? "webp" : file.name.split(".").pop() || "mp3";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    if (type === "image") {
        // Compress image to WebP with high quality but low size
        await sharp(buffer)
            .resize(1080, 1080, { fit: "inside", withoutEnlargement: true }) // Max 1080p
            .webp({ quality: 80 }) // 80% quality is usually indistinguishable but lighter
            .toFile(filepath);
    } else {
        // Save audio directly (compression on client or handled by browser recording usually sufficient for voice notes < 1MB)
        // For production, using ffmpeg server-side would be better, but node-fs is simpler for MVP
        await writeFile(filepath, buffer);
    }

    return `/uploads/festory/${filename}`;
}

export async function deleteFile(fileUrl: string) {
    try {
        const filename = fileUrl.split("/").pop();
        if (!filename) return;
        const filepath = path.join(UPLOAD_DIR, filename);
        await unlink(filepath);
    } catch (error) {
        console.error("Failed to delete file:", error);
    }
}

const POSTER_TEMPLATE_DIR = path.join(process.cwd(), "public", "uploads", "poster-templates");

export async function uploadPosterTemplateImage(
    file: File
): Promise<{ url: string; width: number; height: number }> {
    await mkdir(POSTER_TEMPLATE_DIR, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}.webp`;
    const filepath = path.join(POSTER_TEMPLATE_DIR, filename);

    // Read natural metadata
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1080;
    const height = metadata.height || 1350;

    // Convert to webp with high quality for clear poster rendering
    await image
        .webp({ quality: 92 })
        .toFile(filepath);

    return {
        url: `/uploads/poster-templates/${filename}`,
        width,
        height,
    };
}

export async function deletePosterTemplateFile(fileUrl: string) {
    try {
        if (!fileUrl.startsWith("/uploads/poster-templates/")) return;
        const filename = fileUrl.split("/").pop();
        if (!filename) return;
        const filepath = path.join(POSTER_TEMPLATE_DIR, filename);
        await unlink(filepath);
    } catch (error) {
        console.error("Failed to delete poster template file:", error);
    }
}
