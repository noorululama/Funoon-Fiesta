"use server";

import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { StudentModel, FestoryUserModel } from "@/lib/models";
import { createSessionToken, verifySessionToken } from "@/lib/auth";
import { FESTORY_COOKIE, SESSION_MAX_AGE } from "@/lib/config";
import { FestoryUser } from "@/lib/types";
import { redirect } from "next/navigation";

export interface LoginState {
    error?: string;
    success?: boolean;
}

import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "@/lib/config";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function loginWithGoogle(credential: string, phone?: string, teamId?: string, customName?: string): Promise<LoginState> {
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload?.email) {
            return { error: "Google verification failed" };
        }

        await connectDB();
        const { FestoryUserModel } = await import("@/lib/models");

        let festoryUser = await FestoryUserModel.findOne({ email: payload.email });

        // LOGIN MODE (No Phone provided)
        if (!phone) {
            if (!festoryUser) {
                return { error: "Account not found. Please Sign Up." };
            }
            // User exists, proceed to login (skip updates)
        }
        // SIGN UP / UPDATE MODE (Phone provided)
        else {
            // Check if duplicate phone (only if it's a different user)
            const existingPhone = await FestoryUserModel.findOne({ phoneNumber: phone });
            if (existingPhone && existingPhone.email !== payload.email) {
                return { error: "This phone number is already registered." };
            }

            if (!festoryUser) {
                // Create New User
                festoryUser = await FestoryUserModel.create({
                    id: crypto.randomUUID(),
                    name: customName || payload.name || payload.email.split("@")[0],
                    email: payload.email,
                    googleId: payload.sub,
                    phoneNumber: phone,
                    teamId: teamId || "General",
                    image: payload.picture,
                    isBanned: false,
                });
            } else {
                // Update Existing User
                if (!festoryUser.googleId) festoryUser.googleId = payload.sub;
                festoryUser.phoneNumber = phone;
                if (teamId) festoryUser.teamId = teamId;
                if (customName) festoryUser.name = customName;
                if (!festoryUser.image && payload.picture) festoryUser.image = payload.picture;

                await festoryUser.save();
            }
        }

        if (festoryUser.isBanned) {
            return { error: "Access Denied. You have been banned." };
        }

        const sessionPayload = {
            id: festoryUser.id,
            name: festoryUser.name,
            teamId: festoryUser.teamId,
            studentId: festoryUser.studentId || "", // Might be empty for Google users
            role: "festory_user",
            image: festoryUser.image,
        };

        const jwt = await createSessionToken(sessionPayload);
        const cookieStore = await cookies();
        cookieStore.set(FESTORY_COOKIE, jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: SESSION_MAX_AGE,
            path: "/",
        });

    } catch (error: any) {
        console.error("Google Login Error:", error);
        return { error: "Login failed. Please try again." };
    }

    redirect("/festory/feed");
}

export async function getFestorySession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(FESTORY_COOKIE)?.value;

    if (!token) return null;

    const payload = await verifySessionToken<{
        id: string;
        studentId: string;
        name: string;
        teamId: string;
        role: string;
        image?: string;
    }>(token);

    if (!payload || payload.role !== "festory_user") return null;

    if (!payload.image) {
        await connectDB();
        const { FestoryUserModel } = await import("@/lib/models");
        const user = await FestoryUserModel.findOne({ id: payload.id });
        if (user && user.image) {
            payload.image = user.image;
        }
    }

    return payload;
}

export async function getFestoryPosts() {
    await connectDB();
    const { FestoryPostModel, FestoryUserModel } = await import("@/lib/models");

    const posts = await FestoryPostModel.find().sort({ createdAt: -1 }).limit(50).lean();
    const userIds = Array.from(new Set(posts.map(p => p.userId)));
    const users = await FestoryUserModel.find({ id: { $in: userIds } }).lean();
    const userMap = new Map(users.map(u => [u.id, u]));

    return posts.map(post => {
        const user = userMap.get(post.userId);
        return {
            id: post.id,
            userId: post.userId,
            userName: user ? user.name : post.userName,
            userImage: user ? user.image : undefined,
            userTeamId: user ? user.teamId : post.userTeamId,
            type: post.type as "text" | "image" | "audio",
            content: post.content,
            mediaUrl: post.mediaUrl,
            likes: Array.isArray(post.likes) ? post.likes : [], // Ensure array
            pollOptions: Array.isArray(post.pollOptions) ? post.pollOptions.map((opt: any) => ({
                id: opt.id,
                text: opt.text,
                votes: Array.isArray(opt.votes) ? opt.votes : []
            })) : undefined,
            commentsCount: post.commentsCount || 0,
            createdAt: new Date(post.createdAt).toISOString()
        };
    });
}

export async function createFestoryPost(prevState: any, formData: FormData) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        const content = formData.get("content") as string;
        const type = formData.get("type") as "text" | "image" | "audio" | "poll";
        const file = formData.get("file") as File | null;
        const pollOptions = formData.get("pollOptions") as string | null;

        // Validation
        if (!content && type === "text") return { error: "Content is required" };
        if (type !== "text" && type !== "poll" && !file) return { error: "File is required for image/audio posts" };
        if (type !== "text" && type !== "poll" && file && file.size > 3 * 1024 * 1024) return { error: "File size too large (max 3MB)" };
        if (type === "poll" && !pollOptions) return { error: "Poll options are required" };

        await connectDB();
        const { FestoryUserModel, FestoryPostModel } = await import("@/lib/models");
        const { emitFestoryPostCreated } = await import("@/lib/pusher");
        const { uploadFile } = await import("@/lib/upload");

        // Safety check for user ban
        const user = await FestoryUserModel.findOne({ id: session.id });
        if (!user || user.isBanned) return { error: "You are banned from posting." };

        let mediaUrl = "";
        if (file && type !== "text" && type !== "poll") {
            try {
                mediaUrl = await uploadFile(file, type);
            } catch (err) {
                console.error("Upload failed", err);
                return { error: "Failed to upload media" };
            }
        }

        const newPost = await FestoryPostModel.create({
            id: crypto.randomUUID(),
            userId: session.id,
            userName: session.name,
            userTeamId: session.teamId,
            type: type || "text",
            content: content || "",
            mediaUrl: mediaUrl,
            likes: [],
            pollOptions: type === "poll" ? JSON.parse(pollOptions!) : undefined,
            commentsCount: 0,
        });

        // Convert to plain object for Pusher
        const plainPost = {
            id: newPost.id,
            userId: newPost.userId,
            userName: newPost.userName,
            userImage: session.image,
            userTeamId: newPost.userTeamId,
            type: newPost.type,
            content: newPost.content,
            mediaUrl: newPost.mediaUrl,
            likes: [],
            pollOptions: newPost.pollOptions,
            commentsCount: 0,
            createdAt: new Date().toISOString(),
        };

        await emitFestoryPostCreated(plainPost);

        return { success: true };
    } catch (error: any) {
        console.error("Post Error:", error);

        return { error: "Failed to create post" };
    }
}

export async function voteFestoryPoll(postId: string, optionId: string) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        await connectDB();
        const { FestoryPostModel } = await import("@/lib/models");
        const { emitFestoryPostUpdated } = await import("@/lib/pusher");

        const post = await FestoryPostModel.findOne({ id: postId });
        if (!post) return { error: "Post not found" };
        if (post.type !== "poll" || !post.pollOptions) return { error: "Not a poll" };

        const option = post.pollOptions.find((o: any) => o.id === optionId);
        if (!option) return { error: "Option not found" };

        // Single Choice Logic: Remove user from all other options first
        post.pollOptions.forEach((o: any) => {
            if (o.id !== optionId) {
                const idx = o.votes.indexOf(session.id);
                if (idx > -1) o.votes.splice(idx, 1);
            }
        });

        const voterIndex = option.votes.indexOf(session.id);
        if (voterIndex > -1) {
            // Unvote if already voted for this option
            option.votes.splice(voterIndex, 1);
        } else {
            // Vote
            option.votes.push(session.id);
        }

        // We need to mark the array as modified because we mutated a subdocument array property
        post.markModified('pollOptions');
        await post.save();

        const plainPost = {
            id: post.id,
            userId: post.userId,
            userName: post.userName,
            userTeamId: post.userTeamId,
            type: post.type,
            content: post.content,
            mediaUrl: post.mediaUrl,
            likes: post.likes || [],
            pollOptions: post.pollOptions,
            commentsCount: post.commentsCount || 0,
            createdAt: new Date(post.createdAt).toISOString()
        };

        await emitFestoryPostUpdated(plainPost);

        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Failed to vote" };
    }
}

export async function triggerAudioBomb(soundId: string) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        await connectDB();
        const { FestoryUserModel } = await import("@/lib/models");

        const user = await FestoryUserModel.findOne({ id: session.id });
        if (!user || user.isBanned) return { error: "Banned" };

        const { emitFestoryAudioBomb } = await import("@/lib/pusher");
        await emitFestoryAudioBomb(soundId, session.name);

        return { success: true };
    } catch (e) {
        return { error: "Failed" };
    }
}

export async function deleteFestoryPost(postId: string) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        await connectDB();
        const { FestoryPostModel } = await import("@/lib/models");

        const post = await FestoryPostModel.findOne({ id: postId });
        if (!post) return { error: "Not found" };

        if (post.userId !== session.id) {
            return { error: "Forbidden" };
        }

        if (post.mediaUrl) {
            const { deleteFile } = await import("@/lib/upload");
            await deleteFile(post.mediaUrl);
        }

        await FestoryPostModel.deleteOne({ id: postId });

        const { emitFestoryPostDeleted } = await import("@/lib/pusher");
        await emitFestoryPostDeleted(postId);

        return { success: true };
    } catch (e) {
        return { error: "Failed to delete" };
    }
}

export async function updateFestoryProfile(formData: FormData) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        const name = formData.get("name") as string;
        const file = formData.get("file") as File | null;

        await connectDB();
        const { FestoryUserModel } = await import("@/lib/models");
        const user = await FestoryUserModel.findOne({ id: session.id });

        if (!user) return { error: "User not found" };

        if (name && name.trim().length > 0) {
            user.name = name.trim();
        }

        if (file && file.size > 0) {
            if (file.size > 3 * 1024 * 1024) {
                return { error: "Image too large (Max 3MB)" };
            }
            if (user.image && user.image.startsWith("/uploads/festory/")) {
                const { deleteFile } = await import("@/lib/upload");
                await deleteFile(user.image);
            }

            const { uploadFile } = await import("@/lib/upload");
            const imageUrl = await uploadFile(file, "image");
            user.image = imageUrl;
        }

        await user.save();

        // Update Session Cookie
        const sessionPayload = {
            id: user.id,
            name: user.name,
            teamId: user.teamId,
            studentId: user.studentId || "",
            role: "festory_user",
            image: user.image,
        };

        const jwt = await createSessionToken(sessionPayload);
        const cookieStore = await cookies();
        cookieStore.set(FESTORY_COOKIE, jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: SESSION_MAX_AGE,
            path: "/",
        });





        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Failed to update profile" };
    }
}

export async function logoutFestory() {
    const cookieStore = await cookies();
    cookieStore.delete(FESTORY_COOKIE);
    redirect("/festory");
}

export async function toggleFestoryLike(postId: string) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        await connectDB();
        const { FestoryPostModel } = await import("@/lib/models");
        const { emitFestoryPostUpdated } = await import("@/lib/pusher");

        const post = await FestoryPostModel.findOne({ id: postId });
        if (!post) return { error: "Post not found" };

        if (!Array.isArray(post.likes)) post.likes = [];

        const index = post.likes.indexOf(session.id);
        if (index > -1) {
            post.likes.splice(index, 1);
        } else {
            post.likes.push(session.id);
        }

        await post.save();

        const plainPost = {
            id: post.id,
            userId: post.userId,
            userName: post.userName,
            userTeamId: post.userTeamId,
            type: post.type,
            content: post.content,
            mediaUrl: post.mediaUrl,
            likes: post.likes,
            commentsCount: post.commentsCount || 0,
            createdAt: new Date(post.createdAt).toISOString()
        };

        await emitFestoryPostUpdated(plainPost);

        return { success: true, likes: post.likes };
    } catch (e) {
        console.error(e);
        return { error: "Failed to like" };
    }
}

export async function addFestoryComment(postId: string, content: string, parentId?: string) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };
        if (!content.trim()) return { error: "Empty comment" };

        await connectDB();
        const { FestoryPostModel, FestoryCommentModel, FestoryUserModel } = await import("@/lib/models");
        const { emitFestoryPostUpdated } = await import("@/lib/pusher");

        const user = await FestoryUserModel.findOne({ id: session.id });
        if (!user || user.isBanned) return { error: "Banned" };


        const post = await FestoryPostModel.findOne({ id: postId });
        if (!post) return { error: "Post not found" };

        const comment = await FestoryCommentModel.create({
            id: crypto.randomUUID(),
            postId,
            userId: session.id,
            userName: session.name,
            userImage: user.image,
            content: content.trim(),
            parentId: parentId || undefined,
        });

        post.commentsCount = (post.commentsCount || 0) + 1;
        await post.save();

        const plainPost = {
            id: post.id,
            userId: post.userId,
            userName: post.userName,
            userImage: post.userImage, // Assuming this is handled if needed or uses fallback
            userTeamId: post.userTeamId,
            type: post.type,
            content: post.content,
            mediaUrl: post.mediaUrl,
            likes: Array.isArray(post.likes) ? post.likes : [],
            commentsCount: post.commentsCount,
            createdAt: new Date(post.createdAt).toISOString()
        };
        await emitFestoryPostUpdated(plainPost);

        return {
            success: true, comment: {
                id: comment.id,
                postId: comment.postId,
                userId: comment.userId,
                userName: comment.userName,
                userImage: comment.userImage,
                content: comment.content,
                parentId: comment.parentId,
                createdAt: new Date(comment.createdAt).toISOString()
            }
        };
    } catch (e) {
        console.error(e);
        return { error: "Failed to comment" };
    }
}

export async function getFestoryComments(postId: string) {
    try {
        await connectDB();
        const { FestoryCommentModel } = await import("@/lib/models");
        const comments = await FestoryCommentModel.find({ postId }).sort({ createdAt: -1 }).lean();

        return comments.map(c => ({
            id: c.id,
            postId: c.postId,
            userId: c.userId,
            userName: c.userName,
            userImage: c.userImage,
            content: c.content,
            parentId: c.parentId,
            createdAt: new Date(c.createdAt).toISOString()
        }));
    } catch (e) {
        return [];
    }
}
export async function updateFestoryPost(postId: string, newContent: string) {
    try {
        const session = await getFestorySession();
        if (!session) return { error: "Unauthorized" };

        await connectDB();
        const { FestoryPostModel } = await import("@/lib/models");
        const { emitFestoryPostUpdated } = await import("@/lib/pusher");

        const post = await FestoryPostModel.findOne({ id: postId });
        if (!post) return { error: "Post not found" };

        if (post.userId !== session.id) return { error: "Forbidden" };

        if (post.type !== "text") return { error: "Only text posts can be edited" };

        if (new Date().getTime() - new Date(post.createdAt).getTime() > 60000) {
            return { error: "Edit time limit exceeded (1 minute)" };
        }

        post.content = newContent;
        await post.save();

        const plainPost = {
            id: post.id,
            userId: post.userId,
            userName: post.userName,
            userImage: session.image,
            userTeamId: post.userTeamId,
            type: post.type,
            content: post.content,
            mediaUrl: post.mediaUrl,
            likes: post.likes || [],
            commentsCount: post.commentsCount || 0,
            createdAt: new Date(post.createdAt).toISOString()
        };

        await emitFestoryPostUpdated(plainPost);

        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Failed to update post" };
    }
}
