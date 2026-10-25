"use client";

import { useState, useEffect } from "react";
import { Poll } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { PollChart } from "./PollChart";
import { pusherClient } from "@/lib/pusher-client";
import { CHANNELS, EVENTS } from "@/lib/pusher";
import { toast } from "react-toastify";
import { Loader2, ChevronDown, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PollCardProps {
    poll: Poll;
}

export function PollCard({ poll: initialPoll }: PollCardProps) {
    const [poll, setPoll] = useState<Poll>(initialPoll);
    const [isVoted, setIsVoted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        // Check local storage
        const votedPolls = JSON.parse(localStorage.getItem("votedPolls") || "[]");
        if (votedPolls.includes(poll.id)) {
            setIsVoted(true);
            setExpanded(true); // Auto-expand if voted to show results
        }

        // Subscribe to Pusher
        const channel = pusherClient.subscribe(CHANNELS.POLLS);

        // Bind to poll-updated
        channel.bind(EVENTS.POLL_UPDATED, (data: { pollId: string }) => {
            if (data.pollId === poll.id) {
                fetchPollData();
            }
        });

        return () => {
            channel.unbind_all();
            channel.unsubscribe();
        };
    }, [poll.id]);

    const fetchPollData = async () => {
        try {
            const res = await fetch(`/api/polls/${poll.id}`);
            if (res.ok) {
                const updatedPoll = await res.json();
                setPoll(updatedPoll);
            }
        } catch (error) {
            console.error("Failed to update poll", error);
        }
    };

    const handleVote = async (optionId: string) => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await fetch(`/api/polls/${poll.id}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ optionId }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to vote");
            }

            // Success
            setIsVoted(true);
            const votedPolls = JSON.parse(localStorage.getItem("votedPolls") || "[]");
            localStorage.setItem("votedPolls", JSON.stringify([...votedPolls, poll.id]));
            toast.success("Vote submitted!");
            await fetchPollData(); // Wait for data update
            setExpanded(true); // Ensure expanded to show chart
        } catch (error: any) {
            toast.error(error.message);
            if (error.message.includes("already voted")) {
                setIsVoted(true);
                setExpanded(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const totalVotes = poll.options.reduce((acc, curr) => acc + curr.votes, 0);

    return (
        <Card
            className="group w-full mx-auto hover:shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            {/* Header / Trigger */}
            <div
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "p-6 cursor-pointer relative transition-all duration-300",
                    expanded ? "bg-zinc-50 dark:bg-zinc-800/50" : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                )}
            >
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full",
                                poll.active
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", poll.active ? "bg-emerald-500 animate-pulse" : "bg-zinc-400")} />
                                {poll.active ? "Live" : "Closed"}
                            </span>
                            <span className="text-zinc-400 text-xs font-medium">{totalVotes} votes</span>
                        </div>

                        <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                            {poll.question}
                        </h3>
                    </div>

                    <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300",
                        expanded
                            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white rotate-180"
                            : "bg-transparent text-zinc-400 border-zinc-200 dark:border-zinc-700 group-hover:border-zinc-300 dark:group-hover:border-zinc-600"
                    )}>
                        <ChevronDown className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Expandable Content */}
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} // Smooth cubic-bezier
                        className="overflow-hidden"
                    >
                        <CardContent className="p-6 pt-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
                            {isVoted ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="pt-2"
                                >
                                    <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400 font-medium text-sm bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl w-fit">
                                        <CheckCheck className="w-4 h-4" />
                                        <span>You voted in this poll</span>
                                    </div>
                                    <PollChart options={poll.options} totalVotes={totalVotes} />
                                </motion.div>
                            ) : (
                                <div className="grid gap-3 pt-2">
                                    {poll.options.map((option) => (
                                        <button
                                            key={option.id}
                                            className="group/btn relative w-full overflow-hidden rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 transition-all duration-200 hover:border-orange-500/50 dark:hover:border-orange-500/50 hover:shadow-md active:scale-[0.99] text-left"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleVote(option.id);
                                            }}
                                            disabled={loading}
                                        >
                                            <div className="flex items-center justify-between relative z-10">
                                                <span className="font-semibold text-zinc-700 dark:text-zinc-200 text-base md:text-lg group-hover/btn:text-orange-700 dark:group-hover/btn:text-orange-400 transition-colors">
                                                    {option.text}
                                                </span>
                                            </div>

                                            {/* Hover effect background */}
                                            <div className="absolute inset-0 bg-orange-50 dark:bg-orange-900/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />

                                            {loading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-[2px] z-20">
                                                    <Loader2 className="w-5 h-5 animate-spin text-zinc-900 dark:text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
