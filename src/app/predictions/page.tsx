"use client";

import { useEffect, useState } from "react";
import { PredictionEvent } from "@/lib/types";
import { PredictionCard } from "@/components/predictions/PredictionCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Trophy, Loader2, Zap, History, Calendar, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function PredictionsPage() {
    const [events, setEvents] = useState<PredictionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'live' | 'history'>('live');

    useEffect(() => {
        fetch("/api/predictions")
            .then(res => res.json())
            .then(data => {
                setEvents(data);
                setLoading(false);
            })
            .catch((e) => setLoading(false));
    }, []);

    const openEvents = events.filter(e => e.status === 'open');
    const pastEvents = events.filter(e => e.status !== 'open');
    const totalPoints = events.reduce((acc, e) => acc + e.points, 0);

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
                                Predict & Win
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base leading-relaxed">
                                Put your instincts to the test! Guess the winners and climb the global leaderboard.
                            </p>
                            <div className="pt-2">
                                <Link href="/predictions/leaderboard">
                                    <Button variant="outline" size="sm" className="rounded-full text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20">
                                        <Trophy className="w-4 h-4 mr-2" /> View Leaderboard
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Compact Stats Row */}
                        <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                            <div className="flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/10 px-4 py-3 rounded-2xl min-w-[100px]">
                                <Zap className="w-5 h-5 text-orange-600 mb-1" />
                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{openEvents.length}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Live</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl min-w-[100px]">
                                <History className="w-5 h-5 text-zinc-600 dark:text-zinc-400 mb-1" />
                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{pastEvents.length}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Past</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-900/10 px-4 py-3 rounded-2xl min-w-[100px]">
                                <Trophy className="w-5 h-5 text-amber-600 mb-1" />
                                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{totalPoints}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Pool</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop Tabs (Inline) */}
                <div className="hidden md:flex justify-center sticky top-4 z-40">
                    <div className="flex items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg p-1.5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        <button
                            onClick={() => setTab('live')}
                            className={cn(
                                "px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                                tab === 'live'
                                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            )}
                        >
                            <Zap className="w-4 h-4" /> Live Predictions
                        </button>
                        <button
                            onClick={() => setTab('history')}
                            className={cn(
                                "px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                                tab === 'history'
                                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            )}
                        >
                            <History className="w-4 h-4" /> Past Events
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="w-full">
                    <AnimatePresence mode="wait">
                        {tab === 'live' ? (
                            <motion.div
                                key="live"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="w-full"
                            >
                                {openEvents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full mb-4">
                                            <Calendar className="w-8 h-8 text-zinc-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No live predictions</h3>
                                        <p className="text-zinc-500 text-sm mt-1">Check back later for new events!</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {openEvents.map((evt, i) => (
                                            <motion.div
                                                key={evt.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                            >
                                                <PredictionCard event={evt} />
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="w-full"
                            >
                                {pastEvents.length === 0 ? (
                                    <div className="text-center py-20 text-zinc-500">No past events yet.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-90">
                                        {pastEvents.map((evt, i) => (
                                            <motion.div
                                                key={evt.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                            >
                                                <PredictionCard event={evt} />
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Floating Mobile Tabs (Bottom Pill) */}
            <div className="fixed bottom-24 inset-x-0 flex justify-center md:hidden z-40 pointer-events-none">
                <div className="flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 p-1 rounded-full shadow-lg pointer-events-auto scale-90 sm:scale-100">
                    <button
                        onClick={() => setTab('live')}
                        className={cn(
                            "px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                            tab === 'live'
                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        )}
                    >
                        <Zap className="w-4 h-4" /> Live
                    </button>
                    <button
                        onClick={() => setTab('history')}
                        className={cn(
                            "px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                            tab === 'history'
                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        )}
                    >
                        <History className="w-4 h-4" /> Past
                    </button>
                </div>
            </div>
        </div>
    );
}
