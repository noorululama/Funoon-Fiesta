"use client";

import { useState, useEffect } from "react";
import { UserScore } from "@/lib/types";
import { pusherClient } from "@/lib/pusher-client";
import { CHANNELS, EVENTS } from "@/lib/pusher";
import { Crown, Medal, TrendingUp, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function LeaderboardTable() {
    const [scores, setScores] = useState<UserScore[]>([]);

    useEffect(() => {
        fetchLeaderboard();

        const channel = pusherClient.subscribe(CHANNELS.PREDICTIONS);
        channel.bind(EVENTS.LEADERBOARD_UPDATED, () => {
            fetchLeaderboard();
        });

        return () => {
            channel.unbind_all();
            channel.unsubscribe();
        };
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch("/api/predictions/leaderboard");
            if (res.ok) {
                setScores(await res.json());
            }
        } catch (error) {
            console.error("Failed to fetch leaderboard", error);
        }
    };

    const topThree = scores.slice(0, 3);
    const rest = scores.slice(3);

    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

    return (
        <div className="space-y-12">
            {/* Podium Section */}
            {topThree.length > 0 && (
                <div className="flex flex-wrap justify-center items-end gap-4 md:gap-8 min-h-[260px] pb-4">
                    {/* Rank 2 */}
                    {topThree[1] && (
                        <motion.div
                            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="flex flex-col items-center order-1 md:order-none"
                        >
                            <div className="relative">
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-gray-300 to-gray-100 flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-xl z-10 relative">
                                    <span className="text-2xl font-bold text-gray-600">{getInitials(topThree[1].userName)}</span>
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-zinc-900">
                                    #2
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <p className="font-bold text-lg truncate max-w-[120px]">{topThree[1].userName}</p>
                                <p className="font-mono font-bold text-gray-500">{topThree[1].score} pts</p>
                            </div>
                            <div className="h-24 w-full bg-gradient-to-t from-gray-200/50 to-transparent mt-2 rounded-t-lg mx-auto w-20 md:w-24" />
                        </motion.div>
                    )}

                    {/* Rank 1 */}
                    {topThree[0] && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 100 }}
                            className="flex flex-col items-center order-first md:order-none z-20 -mt-8 md:mt-0"
                        >
                            <div className="relative">
                                <Crown className="absolute -top-10 left-1/2 -translate-x-1/2 w-10 h-10 text-yellow-500 drop-shadow-lg animate-bounce" />
                                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-yellow-400 to-[#FFD700] flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-2xl shadow-yellow-500/20 z-10 relative ring-4 ring-yellow-500/20">
                                    <span className="text-3xl font-bold text-yellow-900">{getInitials(topThree[0].userName)}</span>
                                </div>
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-white font-bold px-4 py-1 rounded-full border-2 border-white dark:border-zinc-900 shadow-lg">
                                    #1
                                </div>
                            </div>
                            <div className="mt-6 text-center">
                                <p className="font-bold text-xl truncate max-w-[150px]">{topThree[0].userName}</p>
                                <p className="font-mono font-bold text-yellow-600 dark:text-yellow-400 text-lg">{topThree[0].score} pts</p>
                            </div>
                            <div className="h-32 w-full bg-gradient-to-t from-yellow-100/50 to-transparent mt-2 rounded-t-lg mx-auto w-28 md:w-32" />
                        </motion.div>
                    )}

                    {/* Rank 3 */}
                    {topThree[2] && (
                        <motion.div
                            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="flex flex-col items-center order-2 md:order-none"
                        >
                            <div className="relative">
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-orange-400 to-amber-600 flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-xl z-10 relative">
                                    <span className="text-2xl font-bold text-white">{getInitials(topThree[2].userName)}</span>
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-zinc-900">
                                    #3
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <p className="font-bold text-lg truncate max-w-[120px]">{topThree[2].userName}</p>
                                <p className="font-mono font-bold text-amber-700 dark:text-amber-500">{topThree[2].score} pts</p>
                            </div>
                            <div className="h-16 w-full bg-gradient-to-t from-orange-100/50 to-transparent mt-2 rounded-t-lg mx-auto w-20 md:w-24" />
                        </motion.div>
                    )}
                </div>
            )}

            {/* List Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-xl border border-zinc-100 dark:border-zinc-800">
                {scores.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground flex flex-col items-center">
                        <User className="w-12 h-12 mb-3 opacity-20" />
                        <p>No participants yet.</p>
                        <p className="text-sm">Be the first to predict & win!</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Rank</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Predictor</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {rest.map((user, idx) => (
                                <motion.tr
                                    key={user.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }}
                                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-muted-foreground">
                                        #{idx + 4}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold mr-3 text-zinc-500">
                                                {getInitials(user.userName)}
                                            </div>
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">{user.userName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-[#8B4513]">
                                        {user.score}
                                    </td>
                                </motion.tr>
                            ))}
                            {topThree.length > 0 && rest.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-muted-foreground">
                                        Only top 3 champions so far! Join them!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
