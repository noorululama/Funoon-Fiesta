"use client";

import { useState, useEffect } from "react";
import { Poll } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash, Plus, Loader2, Edit2, PlayCircle, StopCircle, Search, BarChart2, Activity, MessageSquare } from "lucide-react";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TeamData {
    id: string;
    name: string;
    color: string;
}

export default function AdminPollsPage() {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [teams, setTeams] = useState<TeamData[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");

    // Create State
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);
    const [creating, setCreating] = useState(false);

    // Edit State
    const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
    const [editQuestion, setEditQuestion] = useState("");
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchPolls();
        fetchTeams();
    }, []);

    const fetchPolls = async () => {
        try {
            const res = await fetch("/api/polls");
            if (res.ok) {
                setPolls(await res.json());
            }
        } catch (error) {
            toast.error("Failed to fetch polls");
        }
    };

    const fetchTeams = async () => {
        try {
            const res = await fetch("/api/teams");
            if (res.ok) {
                setTeams(await res.json());
            }
        } catch (error) {
            console.error("Failed to fetch teams for colors");
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question || options.some((o) => !o.trim())) {
            toast.warning("Please fill in question and all options");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch("/api/polls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, options }),
            });

            if (res.ok) {
                toast.success("Poll created!");
                setQuestion("");
                setOptions(["", ""]);
                fetchPolls();
            } else {
                throw new Error("Failed to create");
            }
        } catch (error) {
            toast.error("Error creating poll");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this poll?")) return;
        try {
            await fetch(`/api/polls/${id}`, { method: "DELETE" });
            setPolls(polls.filter((p) => p.id !== id));
            toast.success("Poll deleted");
        } catch (error) {
            toast.error("Failed to delete");
        }
    };

    const handleToggleStatus = async (poll: Poll) => {
        try {
            const res = await fetch(`/api/polls/${poll.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !poll.active }),
            });
            if (res.ok) {
                toast.success(`Poll ${poll.active ? 'Closed' : 'Opened'}`);
                fetchPolls();
            }
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleUpdate = async () => {
        if (!editingPoll) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/polls/${editingPoll.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: editQuestion }),
            });
            if (res.ok) {
                toast.success("Poll updated");
                setEditingPoll(null);
                fetchPolls();
            }
        } catch (error) {
            toast.error("Failed to update poll");
        } finally {
            setUpdating(false);
        }
    };

    const addOption = () => setOptions([...options, ""]);
    const updateOption = (idx: number, val: string) => {
        const newOpts = [...options];
        newOpts[idx] = val;
        setOptions(newOpts);
    };
    const removeOption = (idx: number) => {
        if (options.length <= 2) return;
        setOptions(options.filter((_, i) => i !== idx));
    };

    const getTeamColor = (optionText: string) => {
        const team = teams.find(t => t.name.toLowerCase() === optionText.toLowerCase());
        return team ? team.color : null;
    };

    // Filter Logic
    const filteredPolls = polls.filter(p => {
        const matchesSearch = p.question.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all'
            ? true
            : statusFilter === 'active' ? p.active
                : !p.active;
        return matchesSearch && matchesStatus;
    });

    // Stats Logic
    const stats = {
        total: polls.length,
        active: polls.filter(p => p.active).length,
        votes: polls.reduce((acc, p) => acc + p.options.reduce((a, b) => a + b.votes, 0), 0)
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Poll Management</h1>
                    <p className="text-zinc-400 mt-2 text-lg">Create engaging polls and track real-time results.</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-white/5 bg-white/5 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Total Polls</CardTitle>
                        <div className="p-2 bg-white/5 rounded-xl">
                            <BarChart2 className="h-5 w-5 text-zinc-300" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-white">{stats.total}</div>
                        <p className="text-xs text-zinc-500 mt-1">Lifetime created</p>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-white/5 bg-white/5 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-400">Active Polls</CardTitle>
                        <div className="p-2 bg-emerald-900/20 rounded-xl">
                            <Activity className="h-5 w-5 text-emerald-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-white">{stats.active}</div>
                        <p className="text-xs text-zinc-500 mt-1">Currently voting</p>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-white/5 bg-white/5 backdrop-blur-sm shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-orange-400">Total Votes</CardTitle>
                        <div className="p-2 bg-orange-900/20 rounded-xl">
                            <MessageSquare className="h-5 w-5 text-orange-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-white">{stats.votes.toLocaleString()}</div>
                        <p className="text-xs text-zinc-500 mt-1">Votes cast across all polls</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
                {/* Left Column: Create Form (Sticky) */}
                <div className="lg:col-span-1 lg:sticky lg:top-6">
                    <Card className="rounded-[2rem] border-white/10 bg-black/20 backdrop-blur-md shadow-lg overflow-hidden border-t-4 border-t-orange-500">
                        <CardHeader className="bg-white/5 pb-6 border-b border-white/5 rounded-2xl p-4">
                            <CardTitle className="flex items-center gap-2 text-xl text-white ">
                                <Plus className="w-5 h-5 text-orange-500" />
                                Create New Poll
                            </CardTitle>
                            <CardDescription className="text-zinc-400">Ask the community a question.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleCreate} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300 font-semibold">Question</Label>
                                    <Input
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        placeholder="e.g., Who is the best artist?"
                                        className="h-12 rounded-2xl border-white/10 bg-white/5 text-white focus:ring-orange-500/20 focus:border-orange-500/50 "
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-zinc-300 font-semibold">Options</Label>
                                        <Button type="button" variant="ghost" size="sm" onClick={addOption} className="h-7 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10">
                                            <Plus className="w-3 h-3 mr-1" /> Add Option
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {options.map((opt, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-3 text-xs font-bold text-zinc-500 pointer-events-none">
                                                        {idx + 1}.
                                                    </span>
                                                    <Input
                                                        value={opt}
                                                        onChange={(e) => updateOption(idx, e.target.value)}
                                                        placeholder={`Option ${idx + 1}`}
                                                        className="pl-8 rounded-2xl border-white/10 bg-white/5 text-white"
                                                    />
                                                </div>
                                                {options.length > 2 && (
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)} className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
                                                        <Trash className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white mt-2" disabled={creating}>
                                    {creating ? <Loader2 className="animate-spin mr-2" /> : "Publish Poll"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Poll List */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Filters */}
                    <div className="bg-black/20 backdrop-blur-md p-2 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center shadow-sm">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Search polls..."
                                className="pl-10 h-10 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 text-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex bg-white/5 rounded-xl p-1 w-full md:w-auto overflow-x-auto">
                            {(['all', 'active', 'closed'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setStatusFilter(tab)}
                                    className={cn(
                                        "px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize whitespace-nowrap",
                                        statusFilter === tab
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredPolls.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center bg-white/5 border-2 border-dashed border-white/10 rounded-3xl">
                                <div className="bg-white/5 p-4 rounded-full mb-4">
                                    <BarChart2 className="w-8 h-8 text-zinc-600" />
                                </div>
                                <h3 className="text-lg font-medium text-white">No polls found</h3>
                                <p className="text-zinc-500 text-sm mt-1">Try adjusting your filters.</p>
                            </div>
                        ) : (
                            filteredPolls.map((poll) => {
                                const totalVotes = poll.options.reduce((a, b) => a + b.votes, 0);
                                return (
                                    <Card key={poll.id} className="overflow-hidden bg-black/20 border-white/5 rounded-[1.5rem] group hover:border-white/10 transition-all">
                                        <CardContent className="p-0">
                                            <div className="p-5 md:p-6">
                                                <div className="flex justify-between items-start mb-4 gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={cn(
                                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase",
                                                                poll.active
                                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                                                            )}>
                                                                <span className={cn("w-1.5 h-1.5 rounded-full", poll.active ? "bg-emerald-500 animate-pulse" : "bg-zinc-500")} />
                                                                {poll.active ? "Live" : "Closed"}
                                                            </span>
                                                            <span className="px-2.5 py-1 rounded-full bg-white/5 text-xs font-medium text-zinc-400 border border-white/5">
                                                                {totalVotes} Votes
                                                            </span>
                                                        </div>
                                                        <h3 className="font-bold text-lg md:text-xl text-white leading-tight">
                                                            {poll.question}
                                                        </h3>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title={poll.active ? "Close Poll" : "Open Poll"}
                                                            onClick={() => handleToggleStatus(poll)}
                                                            className={cn("rounded-full", poll.active ? "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400" : "text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400")}
                                                        >
                                                            {poll.active ? <StopCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                                                        </Button>

                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="rounded-full text-blue-500 hover:bg-blue-500/10 hover:text-blue-400" onClick={() => {
                                                                    setEditingPoll(poll);
                                                                    setEditQuestion(poll.question);
                                                                }}>
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="sm:max-w-lg rounded-3xl bg-[#1e1e2e] border-white/10 text-white">
                                                                <DialogHeader>
                                                                    <DialogTitle>Edit Poll</DialogTitle>
                                                                </DialogHeader>
                                                                <div className="space-y-4 py-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-zinc-300">Question</Label>
                                                                        <Input
                                                                            value={editQuestion}
                                                                            onChange={(e) => setEditQuestion(e.target.value)}
                                                                            className="rounded-xl bg-black/20 border-white/10 focus:ring-orange-500/30"
                                                                        />
                                                                    </div>
                                                                    <p className="text-sm text-zinc-400 bg-black/20 p-3 rounded-xl border border-white/5">
                                                                        Note: Options cannot be edited to preserve vote integrity.
                                                                    </p>
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button onClick={handleUpdate} disabled={updating} className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white">
                                                                        Save Changes
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>

                                                        <Button variant="ghost" size="icon" className="rounded-full text-zinc-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => handleDelete(poll.id)}>
                                                            <Trash className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-2">
                                                    {poll.options.map((opt) => {
                                                        const percentage = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                                                        const isWinner = totalVotes > 0 && opt.votes === Math.max(...poll.options.map(o => o.votes));
                                                        const teamColor = getTeamColor(opt.text);

                                                        return (
                                                            <div key={opt.id} className="space-y-1.5 group/opt">
                                                                <div className="flex justify-between text-sm">
                                                                    <span className={cn("font-medium transition-colors", isWinner ? "text-orange-400 font-bold" : "text-zinc-300")}
                                                                        style={{ color: teamColor || undefined }}
                                                                    >
                                                                        {opt.text}
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-zinc-500 text-xs">{opt.votes} votes</span>
                                                                        <span className="font-mono text-xs font-bold text-zinc-300 w-10 text-right">{percentage.toFixed(0)}%</span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full transition-all duration-1000 ease-out rounded-full relative overflow-hidden",
                                                                            // Fallback classes if no color
                                                                            !teamColor && (isWinner ? "bg-orange-500" : "bg-zinc-600")
                                                                        )}
                                                                        style={{
                                                                            width: `${percentage}%`,
                                                                            backgroundColor: teamColor || undefined
                                                                        }}
                                                                    >
                                                                        {/* Shine effect */}
                                                                        <div className="absolute top-0 bottom-0 right-0 w-full bg-gradient-to-l from-white/20 to-transparent" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
