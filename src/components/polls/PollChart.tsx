"use client";

import { motion } from "framer-motion";
import { PollOption } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PollChartProps {
    options: PollOption[];
    totalVotes: number;
}

export function PollChart({ options, totalVotes }: PollChartProps) {
    // Sort options by votes if desired, but usually polls keep original order or user perception matters? 
    // Keeping original order for consistency unless requested otherwise.

    return (
        <div className="space-y-4 w-full">
            {options.map((option) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const isWinner = totalVotes > 0 && option.votes === Math.max(...options.map(o => o.votes));

                return (
                    <div key={option.id} className="w-full group">
                        <div className="flex justify-between items-end mb-1.5 px-1">
                            <span className={cn(
                                "text-sm font-medium transition-colors",
                                isWinner ? "text-orange-700 dark:text-orange-400 font-bold" : "text-zinc-600 dark:text-zinc-300"
                            )}>
                                {option.text}
                            </span>
                            <span className={cn(
                                "text-xs font-mono font-bold",
                                isWinner ? "text-orange-700 dark:text-orange-400" : "text-zinc-400"
                            )}>
                                {Math.round(percentage)}%
                            </span>
                        </div>

                        <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                                className={cn(
                                    "h-full rounded-full",
                                    isWinner ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-600"
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
