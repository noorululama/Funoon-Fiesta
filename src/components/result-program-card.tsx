"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy, Medal } from "lucide-react";
import type { Program, ResultRecord } from "@/lib/types";

interface ResultProgramCardProps {
    program: Program;
    result?: ResultRecord;
    stats: {
        hasResults: boolean;
        section: string;
        category: string;
    };
    index?: number;
}

export function ResultProgramCard({ program, result, stats, index = 0 }: ResultProgramCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: "easeOut",
            }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
        >
            <Link href={`/results/${program.id}`}>
                <div className="group cursor-pointer p-6 rounded-2xl border border-gray-200 bg-white shadow-md hover:shadow-xl transition-all duration-300 hover:border-[#8B4513] relative overflow-hidden">
                    {/* Background gradient effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#8B4513]/0 to-[#0d7377]/0 group-hover:from-[#8B4513]/5 group-hover:to-[#0d7377]/5 transition-all duration-300" />

                    <div className="relative z-10">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[#8B4513]/10">
                                    <Trophy className="w-5 h-5 text-[#8B4513]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#8B4513] transition-colors">
                                        {program.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                                            {stats.section}
                                        </span>
                                        {stats.category !== "none" && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                                Cat {stats.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Medal className="w-6 h-6 text-yellow-500/70 group-hover:text-yellow-600 transition-colors" />
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <span className="text-sm text-gray-600">View Results</span>
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-[#8B4513]/10 transition-colors">
                                <svg
                                    className="w-4 h-4 text-gray-600 group-hover:text-[#8B4513] transition-colors"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
