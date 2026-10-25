"use client";

import { useState, useEffect, useRef } from "react";
import { FestoryPost, FestoryComment } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Heart, MessageCircle, Share2, MoreVertical, Edit2, X, Loader2, Send, Play, Pause, Mic } from "lucide-react";
import { motion } from "framer-motion";
import { toggleFestoryLike, addFestoryComment, getFestoryComments, updateFestoryPost } from "@/app/festory/actions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FeedItemProps {
    post: FestoryPost;
    currentUserId: string;
    onDelete: (postId: string) => void;
}

const AudioPlayer = ({ src }: { src: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const togglePlay = () => {
        if (audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play().catch(console.error);
            } else {
                audioRef.current.pause();
            }
        }
    };

    // State Sync Handlers
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const handleTimeUpdate = () => {
        if (audioRef.current && !isDragging) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    // Initialize state if metadata is already loaded (e.g. from cache)
    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            if (audio.readyState >= 1) {
                const d = audio.duration;
                if (d !== Infinity && !isNaN(d)) setDuration(d);
            }
        }
    }, [src]);

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const d = audioRef.current.duration;
            if (d !== Infinity && !isNaN(d)) {
                setDuration(d);
            }
        }
    };

    // Robust Pointer Handlers
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!progressBarRef.current) return;
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        updateProgress(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !progressBarRef.current) return;
        updateProgress(e);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || !progressBarRef.current) return;
        setIsDragging(false);
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (e) { }

        const validDuration = (duration && isFinite(duration)) ? duration : 0;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newTime = percentage * validDuration;

        if (audioRef.current && validDuration > 0) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (e) { }
    };

    const updateProgress = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = progressBarRef.current!.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const validDuration = (duration && isFinite(duration)) ? duration : 0;
        setCurrentTime(percentage * validDuration);
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time) || !isFinite(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const progressPercent = (duration && duration > 0) ? (currentTime / duration) * 100 : 0;

    return (
        <div className="w-full bg-zinc-800/80 rounded-2xl p-3 mb-4 border border-white/5 flex items-center gap-4 select-none group">
            <button
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black shrink-0 hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
            >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 pt-1">
                <div
                    className="relative h-6 w-full flex items-center cursor-pointer touch-none"
                    ref={progressBarRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onPointerLeave={handlePointerCancel}
                >
                    <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full" />
                    <div
                        className="absolute left-0 h-1 bg-fuchsia-500 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                    />
                    <div
                        className={`absolute h-3.5 w-3.5 bg-fuchsia-500 rounded-full shadow-md border-2 border-zinc-900 transition-transform ${isDragging ? 'scale-125' : 'scale-100'}`}
                        style={{
                            left: `${progressPercent}%`,
                            transform: `translateX(-50%) scale(${isDragging ? 1.2 : 1})`
                        }}
                    />
                </div>

                <div className="flex justify-between text-[11px] text-white/50 font-medium px-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <div className="flex items-center gap-3">
                        <span>{duration ? formatTime(duration) : "--:--"}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Mic className="w-3 h-3 text-white/30" />
                        </div>
                    </div>
                </div>
            </div>

            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onPlay={onPlay}
                onPause={onPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => { setCurrentTime(0); }}
                onError={(e) => console.error("Audio playback error", e)}
            />
        </div>
    );
};



export function FeedItem({ post, currentUserId, onDelete }: FeedItemProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    // Like State
    const [liked, setLiked] = useState(post.likes.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(post.likes.length);
    const [isLiking, setIsLiking] = useState(false);

    // Comment State
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState<FestoryComment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [submittingComment, setSubmittingComment] = useState(false);
    const [commentCount, setCommentCount] = useState(post.commentsCount);
    const inputRef = useRef<HTMLInputElement>(null);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const isOwner = post.userId === currentUserId;

    useEffect(() => {
        setLikeCount(post.likes.length);
        setLiked(post.likes.includes(currentUserId));
        setCommentCount(post.commentsCount);
    }, [post, currentUserId]);

    const handleLike = async () => {
        if (isLiking) return;
        setIsLiking(true);

        // Optimistic update
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);

        try {
            await toggleFestoryLike(post.id);
        } catch (e) {
            // Revert
            setLiked(!newLiked);
            setLikeCount(prev => !newLiked ? prev + 1 : prev - 1);
        } finally {
            setIsLiking(false);
        }
    };

    const handleOpenComments = async (open: boolean) => {
        setCommentsOpen(open);
        if (open && comments.length === 0) {
            setLoadingComments(true);
            const data = await getFestoryComments(post.id);
            setComments(data);
            setLoadingComments(false);
        }
        // Auto-focus input when opening comments
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 300); // Slight delay for Sheet animation
        }
    };

    const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || submittingComment) return;

        setSubmittingComment(true);

        let finalContent = commentText;
        // Prepend @username if replying (Instagram style)
        if (replyingTo) {
            const prefix = `@${replyingTo.userName} `;
            if (!finalContent.startsWith(prefix)) {
                finalContent = prefix + finalContent;
            }
        }

        const res = await addFestoryComment(post.id, finalContent, replyingTo?.id);
        if (res.success && res.comment) {
            setComments([res.comment, ...comments]);
            setCommentText("");
            setReplyingTo(null);
            setCommentCount(prev => prev + 1);
        }
        setSubmittingComment(false);
    };

    const CommentItem = ({ comment, isReply = false }: { comment: FestoryComment, isReply?: boolean }) => {
        // Simple mention parsing
        const contentParts = comment.content.split(/(@\w+)/g);

        return (
            <div className={`flex gap-3 ${isReply ? "mt-2" : ""}`}>
                <Avatar className="w-8 h-8 border border-white/10 shrink-0 mt-1">
                    <AvatarImage src={comment.userImage} />
                    <AvatarFallback>{comment.userName.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="text-sm text-white leading-tight">
                        <span className="font-bold mr-2 text-white">{comment.userName}</span>
                        <span className="font-light text-white/90">
                            {contentParts.map((part, i) => (
                                part.startsWith('@') ? <span key={i} className="text-blue-400">{part}</span> : part
                            ))}
                        </span>
                    </div>

                    <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-[10px] text-white/40 font-medium">
                            {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                            onClick={() => {
                                setReplyingTo({ id: comment.id, userName: comment.userName });
                                inputRef.current?.focus();
                            }}
                            className="text-[10px] font-bold text-white/40 hover:text-white/60"
                        >
                            Reply
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const rootComments = comments.filter(c => !c.parentId);
    const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);



    const handleShare = () => {
        const url = `${window.location.origin}/festory?post=${post.id}`;
        if (navigator.share) {
            navigator.share({
                title: `Festory: ${post.userName}`,
                text: post.content.slice(0, 100),
                url: url,
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(url);
            alert("Link copied to clipboard!");
        }
    };

    const handleEditSave = async () => {
        if (!editContent.trim() || isSavingEdit) return;
        setIsSavingEdit(true);
        const res = await updateFestoryPost(post.id, editContent);
        if (res.success) {
            setIsEditing(false);
        } else {
            alert(res.error || "Failed to update");
        }
        setIsSavingEdit(false);
    };

    return (
        <motion.div
            layout
            id={`post-${post.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="bg-zinc-900 border border-white/5 rounded-3xl p-5 shadow-2xl relative"
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                    <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage src={post.userImage} alt={post.userName} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white text-xs font-bold">
                            {post.userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="text-sm font-bold text-white leading-tight">
                            {post.userName}
                        </h3>
                        <p suppressHydrationWarning className="text-[10px] text-white/40 font-medium">
                            {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Team {post.userTeamId}
                        </p>
                    </div>
                </div>

                {/* Menu */}
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="text-white/20 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="absolute right-0 top-8 w-32 bg-zinc-800 border border-white/10 rounded-2xl shadow-xl z-20 overflow-hidden py-1"
                            >
                                {isOwner ? (
                                    <>
                                        {post.type === 'text' && (new Date().getTime() - new Date(post.createdAt).getTime() < 60000) && (
                                            <button
                                                onClick={() => {
                                                    setMenuOpen(false);
                                                    setIsEditing(true);
                                                    setEditContent(post.content);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 flex items-center gap-2"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                Edit
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false);
                                                onDelete(post.id);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setMenuOpen(false)}
                                        className="w-full text-left px-3 py-2 text-sm text-white/50 hover:bg-white/5 flex items-center gap-2"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Close
                                    </button>
                                )}
                            </motion.div>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="mb-4">
                {isEditing ? (
                    <div className="space-y-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-zinc-800 border border-white/10 rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:bg-white/5 disabled:opacity-50"
                                disabled={isSavingEdit}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-fuchsia-600 text-white hover:bg-fuchsia-500 disabled:opacity-50 flex items-center gap-1"
                                disabled={isSavingEdit}
                            >
                                {isSavingEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words font-light">
                        {post.content}
                    </p>
                )}
            </div>

            {/* Media */}
            {post.type === 'image' && post.mediaUrl && (
                <div className="relative w-full rounded-2xl overflow-hidden mb-4 border border-white/10 bg-black/50">
                    <img src={post.mediaUrl} alt="Post content" className="w-full h-auto" loading="lazy" />
                </div>
            )}

            {post.type === 'audio' && post.mediaUrl && (
                <AudioPlayer src={post.mediaUrl} />
            )}
            {post.type === 'poll' && post.pollOptions && (
                <div className="space-y-2 mb-4">
                    {post.pollOptions.map((option) => {
                        const totalVotes = post.pollOptions!.reduce((acc, curr) => acc + curr.votes.length, 0);
                        const percentage = totalVotes > 0 ? (option.votes.length / totalVotes) * 100 : 0;
                        const isVoted = option.votes.includes(currentUserId);

                        return (
                            <div key={option.id} className="relative">
                                {/* Vote Bar Background */}
                                <div className="absolute inset-0 bg-white/5 rounded-xl overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        className={`h-full opacity-20 ${isVoted ? 'bg-fuchsia-500' : 'bg-white'}`}
                                    />
                                </div>

                                <button
                                    onClick={async () => {
                                        // Optimistic Update can be handled here if needed, but for simplicity relying on server response via key update or revalidation
                                        // Actually for best UX we should verify locally
                                        const { voteFestoryPoll } = await import("@/app/festory/actions");
                                        await voteFestoryPoll(post.id, option.id);
                                    }}
                                    className={`relative w-full text-left px-4 py-3 rounded-xl border transition-all flex justify-between items-center group ${isVoted
                                        ? "border-fuchsia-500/50 text-fuchsia-100"
                                        : "border-white/10 text-white hover:bg-white/5"
                                        }`}
                                >
                                    <span className="font-medium z-10 truncate pr-2">{option.text}</span>
                                    {totalVotes > 0 && (
                                        <span className="text-xs font-bold opacity-60 shrink-0 z-10">
                                            {Math.round(percentage)}%
                                        </span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                    <div className="text-xs text-white/40 font-medium px-1 pt-1">
                        {post.pollOptions.reduce((acc, curr) => acc + curr.votes.length, 0)} votes
                    </div>
                </div>
            )}

            {/* Footer / Interactions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex gap-6">
                    <button
                        onClick={handleLike}
                        className={`flex items-center gap-2 transition-colors group ${liked ? "text-pink-500" : "text-white/60 hover:text-pink-500"}`}
                    >
                        <Heart className={`w-5 h-5 group-hover:scale-110 transition-transform ${liked ? "fill-current" : ""}`} />
                        <span className="text-xs font-medium">{likeCount}</span>
                    </button>

                    <Sheet open={commentsOpen} onOpenChange={handleOpenComments}>
                        <SheetTrigger asChild>
                            <button className="flex items-center gap-2 text-white/60 hover:text-blue-400 transition-colors">
                                <MessageCircle className="w-5 h-5" />
                                <span className="text-xs font-medium">{commentCount}</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] bg-zinc-900 border-t border-white/10 p-0 rounded-t-3xl flex flex-col">
                            <SheetHeader className="p-4 border-b border-white/10 shrink-0">
                                <SheetTitle className="text-white text-center">Comments</SheetTitle>
                            </SheetHeader>

                            {/* Scrollable Comment List */}
                            <ScrollArea className="flex-1 p-4">
                                {loadingComments ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                                    </div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center text-white/30 py-10 text-sm">No comments yet.</div>
                                ) : (
                                    <div className="space-y-6 pb-4">
                                        {rootComments.map((comment) => {
                                            // Helper to get all descendants for this root comment
                                            const getDescendants = (parentId: string): FestoryComment[] => {
                                                const directChildren = comments.filter(c => c.parentId === parentId);
                                                let allChildren = [...directChildren];
                                                directChildren.forEach(child => {
                                                    allChildren = [...allChildren, ...getDescendants(child.id)];
                                                });
                                                // Sort by time
                                                return allChildren.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                            };

                                            const descendants = getDescendants(comment.id);

                                            return (
                                                <div key={comment.id}>
                                                    {/* Root Comment */}
                                                    <CommentItem comment={comment} />

                                                    {/* All Descendants (Indented) */}
                                                    {descendants.length > 0 && (
                                                        <div className="ml-11 border-l-2 border-white/5 pl-3 mt-3 space-y-3">
                                                            {descendants.map(reply => (
                                                                <div key={reply.id}>
                                                                    <CommentItem comment={reply} isReply />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>

                            {/* Input Area (Sticky Bottom) */}
                            <div className="p-4 bg-zinc-900 border-t border-white/10 shrink-0 pb-8">
                                {replyingTo && (
                                    <div className="flex justify-between items-center mb-2 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1 w-1 rounded-full bg-fuchsia-500" />
                                            <span className="text-xs text-white/60">Replying to <span className="text-white font-bold">{replyingTo.userName}</span></span>
                                        </div>
                                        <button
                                            onClick={() => setReplyingTo(null)}
                                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5 text-white/50" />
                                        </button>
                                    </div>
                                )}
                                <form onSubmit={handleSendComment} className="flex gap-2">
                                    <Input
                                        ref={inputRef}
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : "Add a comment..."}
                                        className="bg-zinc-800 border-white/10 text-white rounded-2xl h-11 focus-visible:ring-fuchsia-500/50"
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        disabled={submittingComment || !commentText.trim()}
                                        className="bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl h-11 w-11 shrink-0"
                                    >
                                        {submittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </Button>
                                </form>
                            </div>
                        </SheetContent>
                    </Sheet>

                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 text-white/60 hover:text-green-400 transition-colors"
                    >
                        <Share2 className="w-5 h-5" />
                        <span className="text-xs font-medium">Share</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
