"use client";

import { useEffect, useState, use } from "react";
import { Poll } from "@/lib/types";
import { PollCard } from "@/components/polls/PollCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SinglePollPage({ params }: { params: Promise<{ id: string }> }) {
    const paramsUnwrapped = use(params);
    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/polls/${paramsUnwrapped.id}`)
            .then((res) => {
                if (!res.ok) throw new Error("Poll not found");
                return res.json();
            })
            .then((data) => {
                setPoll(data);
                setLoading(false);
            })
            .catch((error) => {
                setLoading(false);
            });
    }, [paramsUnwrapped.id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    if (!poll) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <h2 className="text-xl font-bold">Poll not found</h2>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 flex flex-col items-center">
            <div className="w-full max-w-md mb-4">
                <Link href="/polls" className="inline-flex items-center text-sm hover:underline text-muted-foreground">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to List
                </Link>
            </div>
            <PollCard poll={poll} />
        </div>
    );
}
