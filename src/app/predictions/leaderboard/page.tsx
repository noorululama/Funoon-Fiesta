"use client";

import { LeaderboardTable } from "@/components/predictions/LeaderboardTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";

export default function LeaderboardPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="mb-6">
                <Link href="/predictions">
                    <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-[#8B4513] text-muted-foreground transition-colors group">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Predictions
                    </Button>
                </Link>
            </div>

            <div className="text-center mb-12 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[#8B4513]/20 blur-[50px] -z-10 rounded-full" />
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-[#8B4513]/20 to-[#6B3410]/5 mb-6 shadow-xl shadow-[#8B4513]/10 border border-[#8B4513]/20">
                    <Trophy className="w-12 h-12 text-[#8B4513] drop-shadow-sm" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-[#8B4513] to-[#5a2a0a] bg-clip-text text-transparent">
                    Champion's Board
                </h1>
                <p className="text-muted-foreground mt-3 text-lg">Top predictors of the season. Are you on the list?</p>
            </div>

            <LeaderboardTable />
        </div>
    );
}
