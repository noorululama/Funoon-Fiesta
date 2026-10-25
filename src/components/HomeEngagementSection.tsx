"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart2, Trophy, ArrowRight, Zap, Target } from "lucide-react";

export function HomeEngagementSection() {
    return (
        <section className="relative py-16 md:py-24 overflow-hidden bg-zinc-950">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#70B040]/20 blur-[120px] rounded-full opacity-60" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-[#F09030]/15 blur-[100px] rounded-full opacity-40" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <div className="container mx-auto px-4 relative z-10 max-w-7xl">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                    {/* Text Content */}
                    <div className="flex-1 text-center lg:text-left space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-block py-1 px-3.5 rounded-full bg-[#70B040]/20 text-[#70B040] border border-[#70B040]/30 text-sm font-bold tracking-wider mb-4">
                                LIVE INTERACTION
                            </span>
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-4">
                                VOICE YOUR <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FDE047] via-[#F09030] to-[#70B040]">OPINION</span>
                            </h2>
                            <p className="text-lg text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                                Join the excitement! Cast your votes in live polls and predict the winners to climb the global leaderboard. The stage is yours.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                        >
                            {/* Stat Badges (Mock Visuals) */}
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-zinc-300 font-mono text-sm">Active Polls Live</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
                                <Zap className="w-4 h-4 text-[#FDE047]" />
                                <span className="text-zinc-300 font-mono text-sm">High Engagement</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 w-full grid md:grid-cols-2 gap-6">
                        {/* Polls Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="group relative bg-zinc-900 border border-zinc-800 hover:border-[#70B040]/50 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-[#70B040]/10 hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#70B040]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />

                            <div className="relative z-10 flex flex-col h-full items-start">
                                <div className="p-3 bg-zinc-800 rounded-2xl mb-4 group-hover:bg-[#70B040] transition-colors duration-300">
                                    <BarChart2 className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Live Polls</h3>
                                <p className="text-zinc-400 text-sm mb-6 flex-1">
                                    Vote on trending topics and see what the community thinks in real-time.
                                </p>
                                <Link href="/polls" className="w-full">
                                    <Button className="w-full bg-white text-black hover:bg-zinc-200 font-bold rounded-xl group-hover:scale-[1.02] transition-transform">
                                        Go to Polls <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>

                        {/* Predictions Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="group relative bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />

                            <div className="relative z-10 flex flex-col h-full items-start">
                                <div className="p-3 bg-zinc-800 rounded-2xl mb-4 group-hover:bg-amber-600 transition-colors duration-300">
                                    <Target className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Predict & Win</h3>
                                <p className="text-zinc-400 text-sm mb-6 flex-1">
                                    Guess the winners of upcoming events. Top the leaderboard and earn bragging rights.
                                </p>
                                <Link href="/predictions" className="w-full">
                                    <Button className="w-full bg-gradient-to-r from-[#70B040] to-[#F09030] text-white border-0 hover:opacity-90 font-bold rounded-xl group-hover:scale-[1.02] transition-transform">
                                        Predict Now <Trophy className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
