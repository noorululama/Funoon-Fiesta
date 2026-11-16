import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import {
    getPosterTemplateBucket,
    getPosterTemplateObjectPath,
    getSupabaseStorageAdmin,
} from "@/lib/supabase-storage";

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
const POSTER_TEMPLATE_MAX_FILE_SIZE = 8 * 1024 * 1024;
const POSTER_TEMPLATE_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function uploadPosterTemplateImage(
    file: File
): Promise<{ url: string; width: number; height: number }> {
    if (!POSTER_TEMPLATE_ALLOWED_TYPES.has(file.type)) {
        throw new Error("Choose a PNG, JPEG, or WebP image.");
    }
    if (file.size > POSTER_TEMPLATE_MAX_FILE_SIZE) {
        throw new Error("Image is too large. Maximum size is 8 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const image = sharp(buffer);
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || "")) {
        throw new Error("Choose a valid PNG, JPEG, or WebP image.");
    }
    const width = metadata.width || 1080;
    const height = metadata.height || 1350;

    const optimizedImage = await image
        .webp({ quality: 92 })
        .toBuffer();
    if (optimizedImage.byteLength > POSTER_TEMPLATE_MAX_FILE_SIZE) {
        throw new Error("Optimized image is too large for Supabase Storage. Choose a smaller image.");
    }

    const objectPath = `${randomUUID()}.webp`;
    const bucket = getPosterTemplateBucket();
    const supabase = getSupabaseStorageAdmin();
    const { error } = await supabase.storage.from(bucket).upload(objectPath, optimizedImage, {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
    });

    if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

    return {
        url: data.publicUrl,
        width,
        height,
    };
}

export async function deletePosterTemplateFile(fileUrl: string) {
    if (fileUrl.startsWith("/uploads/poster-templates/")) {
        const filename = path.basename(fileUrl);
        if (!filename || filename === "." || filename === path.sep) return;

        try {
            await unlink(path.join(POSTER_TEMPLATE_DIR, filename));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return;
    }

    const objectPath = getPosterTemplateObjectPath(fileUrl);
    if (!objectPath) return;

    const { error } = await getSupabaseStorageAdmin()
        .storage
        .from(getPosterTemplateBucket())
        .remove([objectPath]);

    if (error) {
        throw new Error(`Supabase Storage delete failed: ${error.message}`);
    }
}
