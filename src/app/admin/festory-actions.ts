"use server";

import { connectDB } from "@/lib/db";
import { FestoryPostModel, FestoryCommentModel, FestoryUserModel } from "@/lib/models";
import { revalidatePath } from "next/cache";

// --- Users Management ---

export async function getFestoryAdminUsers() {
    await connectDB();
    const users = await FestoryUserModel.find().sort({ createdAt: -1 });

    // Enrich with post counts
    const enrichedUsers = await Promise.all(users.map(async (user) => {
        const postCount = await FestoryPostModel.countDocuments({ userId: user.id });
        return {
            ...user.toObject(),
            _id: user._id.toString(),
            postCount
        };
    }));

    return enrichedUsers;
}

export async function toggleFestoryUserBan(userId: string) {
    await connectDB();
    const user = await FestoryUserModel.findOne({ id: userId });
    if (!user) return { error: "User not found" };

    user.isBanned = !user.isBanned;
    await user.save();
    revalidatePath("/admin/festory");
    return { success: true, isBanned: user.isBanned };
}

// --- Posts Management ---

export async function getFestoryAdminPosts() {
    await connectDB();
    const posts = await FestoryPostModel.find().sort({ createdAt: -1 });
    return posts.map(post => ({
        ...post.toObject(),
        _id: post._id.toString(),
    }));
}

export async function deleteFestoryPostAdmin(postId: string) {
    await connectDB();

    // Delete post
    await FestoryPostModel.deleteOne({ id: postId });

    // Delete associated comments
    await FestoryCommentModel.deleteMany({ postId: postId });

    revalidatePath("/admin/festory");
    return { success: true };
}
