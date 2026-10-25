"use client";

import { useState, useRef, useEffect } from "react";
import { FestoryPost } from "@/lib/types";
import { pusherClient } from "@/lib/pusher-client";
import { CHANNELS, EVENTS } from "@/lib/pusher";
import { AnimatePresence } from "framer-motion";
import { deleteFestoryPost } from "@/app/festory/actions";
import { FeedItem } from "@/components/festory/feed-item";

interface FeedListProps {
    initialPosts: FestoryPost[];
    currentUserId: string;
    initialScrollToPostId?: string;
}

export function FeedList({ initialPosts, currentUserId, initialScrollToPostId }: FeedListProps) {
    const [posts, setPosts] = useState<FestoryPost[]>(initialPosts);
    const bottomRef = useRef<HTMLDivElement>(null);
    const hasScrolledRef = useRef(false);

    useEffect(() => {
        if (initialScrollToPostId && !hasScrolledRef.current && posts.length > 0) {
            // Tiny timeout to ensure DOM is ready
            setTimeout(() => {
                const element = document.getElementById(`post-${initialScrollToPostId}`);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });

                    // Add a highlight class temporarily
                    element.classList.add("ring-2", "ring-fuchsia-500", "ring-offset-2", "ring-offset-black");
                    setTimeout(() => {
                        element.classList.remove("ring-2", "ring-fuchsia-500", "ring-offset-2", "ring-offset-black");
                    }, 2500);

                    hasScrolledRef.current = true;
                }
            }, 500);
        }
    }, [initialScrollToPostId, posts]);

    useEffect(() => {
        // Subscribe to Pusher
        const channel = pusherClient.subscribe(CHANNELS.FESTORY);

        const handleNewPost = (data: { post: FestoryPost }) => {
            setPosts((prev) => [data.post, ...prev]);
        };

        const handlePostDeleted = (data: { postId: string }) => {
            setPosts((prev) => prev.filter(p => p.id !== data.postId));
        };

        const handlePostUpdated = (data: { post: FestoryPost }) => {
            setPosts((prev) => prev.map(p => p.id === data.post.id ? data.post : p));
        };

        channel.bind(EVENTS.FESTORY_POST_CREATED, handleNewPost);
        channel.bind(EVENTS.FESTORY_POST_DELETED, handlePostDeleted);
        channel.bind(EVENTS.FESTORY_POST_UPDATED, handlePostUpdated);

        return () => {
            channel.unbind(EVENTS.FESTORY_POST_CREATED, handleNewPost);
            channel.unbind(EVENTS.FESTORY_POST_DELETED, handlePostDeleted);
            channel.unbind(EVENTS.FESTORY_POST_UPDATED, handlePostUpdated);
            pusherClient.unsubscribe(CHANNELS.FESTORY);
        };
    }, []);

    const handleDelete = async (postId: string) => {
        if (confirm("Delete this post?")) {
            setPosts(prev => prev.filter(p => p.id !== postId));
            await deleteFestoryPost(postId);
        }
    };

    return (
        <div className="pb-24 space-y-6">
            <AnimatePresence initial={false}>
                {posts.map((post) => (
                    <FeedItem
                        key={post.id}
                        post={post}
                        currentUserId={currentUserId}
                        onDelete={handleDelete}
                    />
                ))}
            </AnimatePresence>

            {posts.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <p>No posts yet. Be the first!</p>
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    );
}
