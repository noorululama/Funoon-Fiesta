"use client";

import { useEffect, useState } from "react";
import { Poll } from "@/lib/types";
import { PollCard } from "@/components/polls/PollCard";
import { motion } from "framer-motion";
import { Loader2, Activity, BarChart2, CheckCircle2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PollsPage() {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

    useEffect(() => {
        fetch("/api/polls")
            .then((res) => res.json())
            .then((data) => {
                setPolls(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Failed to load polls", error);
                setLoading(false);
            });
    }, []);

    const activePolls = polls.filter(p => p.active);
    const totalVotes = polls.reduce((acc, p) => acc + p.options.reduce((a, b) => a + b.votes, 0), 0);

    const filteredPolls = polls.filter(p => {
        if (filter === 'active') return p.active;
        if (filter === 'closed') return !p.active;
        return true;
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-44 md:pb-8">
            <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">

                {/* Compact Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 text-left md:max-w-xl">
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                Live Polls
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base leading-relaxed">
                                Join the conversation. Vote in real-time and shape the community decisions.
                            </p>
                        </div>

                        {/* Compact Stats Row */}
                        <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                            <div className="flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/10 px-4 py-3 rounded-2xl min-w-[100px]">
                                <BarChart2 className="w-5 h-5 text-orange-600 mb-1" />
                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{polls.length}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Total</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 rounded-2xl min-w-[100px]">
                                <Activity className="w-5 h-5 text-emerald-600 mb-1" />
                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{activePolls.length}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Active</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/10 px-4 py-3 rounded-2xl min-w-[100px]">
                                <CheckCircle2 className="w-5 h-5 text-blue-600 mb-1" />
                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{totalVotes}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Votes</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop Filters (Inline) */}
                <div className="hidden md:flex justify-center sticky top-4 z-40">
                    <div className="flex items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg p-1.5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        {(['all', 'active', 'closed'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize",
                                    filter === f
                                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Polls Grid */}
                <div className="space-y-4">
                    {filteredPolls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full mb-4">
                                <Filter className="w-6 h-6 text-zinc-400" />
                            </div>
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No polls found</h3>
                            <p className="text-zinc-500 text-sm mt-1">Try changing your filters</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredPolls.map((poll, index) => (
                                <motion.div
                                    key={poll.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <PollCard poll={poll} />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Bottom Filters (Mobile Only) */}
            <div className="fixed bottom-24 inset-x-0 flex justify-center md:hidden z-40 pointer-events-none">
                <div className="flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 p-1 rounded-full shadow-lg pointer-events-auto scale-90 sm:scale-100">
                    {(['all', 'active', 'closed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 capitalize min-w-[80px]",
                                filter === f
                                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md"
                                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
