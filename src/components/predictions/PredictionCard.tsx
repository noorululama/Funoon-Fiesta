"use client";

import { useState, useEffect } from "react";
import { PredictionEvent } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { Clock, Trophy, CheckCircle2, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PredictionCardProps {
    event: PredictionEvent;
}

export function PredictionCard({ event }: PredictionCardProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasPredicted, setHasPredicted] = useState(false);
    const [timeLeft, setTimeLeft] = useState("");

    const deadline = new Date(event.deadline);
    const isExpired = new Date() > deadline;

    useEffect(() => {
        // Check local storage for previous prediction
        const predictions = JSON.parse(localStorage.getItem("predictions") || "{}");
        if (predictions[event.id]) {
            setHasPredicted(true);
            setSelectedOption(predictions[event.id]);
        }

        // Timer
        const updateTimer = () => {
            const now = new Date();
            const diff = deadline.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("Closed");
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                // Format nicely: 2h 30m or Just 45m
                setTimeLeft(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
            }
        };

        updateTimer();
        const timer = setInterval(updateTimer, 60000);

        return () => clearInterval(timer);
    }, [event.id, event.deadline]);

    const handleSubmit = async () => {
        if (!selectedOption) return;

        // Simple User Auth Simulation (Matches original logic)
        let userProfile = JSON.parse(localStorage.getItem("userProfile") || "null");
        if (!userProfile) {
            const name = prompt("Enter your name to compete in the leaderboard:");
            if (!name) return;
            const id = crypto.randomUUID();
            userProfile = { id, name };
            localStorage.setItem("userProfile", JSON.stringify(userProfile));
        }

        setLoading(true);
        try {
            const res = await fetch("/api/predictions/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId: event.id,
                    userId: userProfile.id,
                    userName: userProfile.name,
                    selectedOptionId: selectedOption,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to submit");
            }

            toast.success("Prediction locked in!");
            setHasPredicted(true);
            const predictions = JSON.parse(localStorage.getItem("predictions") || "{}");
            predictions[event.id] = selectedOption;
            localStorage.setItem("predictions", JSON.stringify(predictions));

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="group w-full overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-all duration-300">
            {/* Header */}
            <div className="p-6 pb-4">
                <div className="flex justify-between items-start gap-4 mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        {event.programName}
                    </span>
                    <span className={cn(
                        "flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full",
                        isExpired
                            ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                    )}>
                        <Clock className="w-3.5 h-3.5" />
                        {timeLeft}
                    </span>
                </div>

                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                    {event.question}
                </h3>
            </div>

            <CardContent className="p-6 pt-0 space-y-6">
                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {event.options.map((option) => {
                        const isSelected = selectedOption === option.id;
                        const isDisabled = hasPredicted || isExpired;

                        return (
                            <button
                                key={option.id}
                                onClick={() => !isDisabled && setSelectedOption(option.id)}
                                disabled={isDisabled}
                                className={cn(
                                    "relative p-4 rounded-xl border-2 text-left transition-all duration-200 group/btn",
                                    isSelected
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-500/50"
                                        : "border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 hover:border-zinc-200 dark:hover:border-zinc-700",
                                    isDisabled && !isSelected && "opacity-50 cursor-not-allowed grayscale",
                                    isDisabled && isSelected && "opacity-100 cursor-default"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "font-semibold",
                                        isSelected ? "text-orange-700 dark:text-orange-400" : "text-zinc-700 dark:text-zinc-300"
                                    )}>
                                        {option.label}
                                    </span>
                                    {isSelected && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="bg-orange-500 rounded-full p-1"
                                        >
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </motion.div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-500">
                        <Trophy className="w-4 h-4" />
                        <span>Win {event.points} pts</span>
                    </div>

                    {!hasPredicted && !isExpired && (
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedOption || loading}
                            size="lg"
                            className={cn(
                                "rounded-full transition-all duration-300",
                                selectedOption
                                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:scale-105 shadow-md hover:shadow-lg"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                            )}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Locking...
                                </>
                            ) : (
                                "Lock Prediction"
                            )}
                        </Button>
                    )}

                    {hasPredicted && (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full">
                            <Lock className="w-4 h-4" />
                            <span>Prediction Locked</span>
                        </div>
                    )}

                    {isExpired && !hasPredicted && (
                        <div className="text-zinc-400 text-sm font-medium">
                            Prediction missed
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
