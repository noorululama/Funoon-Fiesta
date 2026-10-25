"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { AdminSettingsModel } from "@/lib/models";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { sendCredentialUpdateEmail } from "@/lib/email-service";

export async function updateAdminCredentials(
    prevState: { error?: string; success?: string },
    formData: FormData,
) {
    try {
        const username = String(formData.get("username") ?? "").trim();
        const password = String(formData.get("password") ?? "").trim();
        const currentPassword = String(formData.get("currentPassword") ?? "").trim();

        if (!username || !password || !currentPassword) {
            return { error: "All fields are required." };
        }

        await connectDB();
        const currentSettings = await AdminSettingsModel.findOne();

        // Verify current password
        // If no settings exist (should be seeded), returning error is safest
        if (!currentSettings) {
            return { error: "Admin settings not found. Contact support." };
        }

        const isMatch = await verifyPassword(currentPassword, currentSettings.password);
        if (!isMatch) {
            return { error: "Incorrect current password." };
        }

        if (password.length < 6) {
            return { error: "Password must be at least 6 characters long." };
        }

        // Hash the new password before saving
        const hashedPassword = await hashPassword(password);

        // Update the settings
        await AdminSettingsModel.findOneAndUpdate(
            {},
            { username, password: hashedPassword },
            { upsert: true, new: true }
        );

        // Send email notification with plain password for user reference
        await sendCredentialUpdateEmail({ username, password });

        revalidatePath("/admin/settings");
        return { success: "Credentials updated successfully." };
    } catch (error) {
        console.error("Failed to update credentials:", error);
        return { error: "Failed to update credentials. Please try again." };
    }
}
