"use client";

import { useState, useEffect } from "react";
import { PredictionEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash, Plus, CheckCircle, Loader2, Edit2, PlayCircle, StopCircle, Search, Activity, Clock, Trophy, Filter } from "lucide-react";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ProgramSimple {
    _id: string; // Mongoose ID usually
    id: string;
    name: string;
    category: string;
}

export default function AdminPredictionsPage() {
    const [events, setEvents] = useState<PredictionEvent[]>([]);
    const [programs, setPrograms] = useState<ProgramSimple[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "evaluated">("all");

    // Create State
    const [newParams, setNewParams] = useState({
        programId: "",
        programName: "",
        question: "Who will win?",
        options: [{ id: "opt1", label: "" }, { id: "opt2", label: "" }],
        deadline: "",
        points: 10
    });

    // Edit State
    const [editingEvent, setEditingEvent] = useState<PredictionEvent | null>(null);
    const [editParams, setEditParams] = useState({
        question: "",
        deadline: "",
        points: 10
    });
    const [updating, setUpdating] = useState(false);

    const [loading, setLoading] = useState(false);
    const [evaluating, setEvaluating] = useState<string | null>(null);

    useEffect(() => {
        fetchEvents();
        fetchPrograms();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await fetch("/api/predictions");
            if (res.ok) setEvents(await res.json());
        } catch (e) { toast.error("Failed to load events"); }
    };

    const fetchPrograms = async () => {
        try {
            const res = await fetch("/api/programs");
            if (res.ok) setPrograms(await res.json());
        } catch (e) { console.error("Failed to fetch programs"); }
    };

    const createEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formattedOptions = newParams.options.map((o) => ({
                id: crypto.randomUUID(),
                label: o.label
            }));

            const res = await fetch("/api/predictions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...newParams,
                    options: formattedOptions
                })
            });

            if (res.ok) {
                toast.success("Event created");
                fetchEvents();
                setNewParams(prev => ({
                    ...prev,
                    programId: "",
                    programName: "",
                    options: [{ id: "opt1", label: "" }, { id: "opt2", label: "" }],
                    deadline: ""
                }));
            }
        } catch (e) { toast.error("Create failed"); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this prediction event?")) return;
        try {
            await fetch(`/api/predictions/${id}`, { method: "DELETE" });
            setEvents(events.filter(e => e.id !== id));
            toast.success("Event deleted");
        } catch (e) { toast.error("Delete failed"); }
    };

    const handleToggleStatus = async (evt: PredictionEvent) => {
        if (evt.status === 'evaluated') {
            toast.warning("Cannot reopen evaluated event");
            return;
        }

        const newStatus = evt.status === 'open' ? 'closed' : 'open';
        try {
            const res = await fetch(`/api/predictions/${evt.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                toast.success(`Event ${newStatus}`);
                fetchEvents();
            }
        } catch (e) { toast.error("Update failed"); }
    };

    const handleUpdate = async () => {
        if (!editingEvent) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/predictions/${editingEvent.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editParams),
            });
            if (res.ok) {
                toast.success("Event updated");
                setEditingEvent(null);
                fetchEvents();
            }
        } catch (e) { toast.error("Update failed"); }
        finally { setUpdating(false); }
    };

    const evaluateEvent = async (eventId: string, winnerId: string) => {
        try {
            const res = await fetch("/api/predictions/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId, correctOptionId: winnerId })
            });
            if (res.ok) {
                toast.success("Event evaluated & points distributed!");
                setEvaluating(null);
                fetchEvents();
            }
        } catch (e) { toast.error("Evaluation failed"); }
    };

    const addOption = () => setNewParams({
        ...newParams,
        options: [...newParams.options, { id: "temp", label: "" }]
    });

    const handleProgramSelect = (val: string) => {
        const prog = programs.find(p => p.id === val);
        if (prog) {
            setNewParams({
                ...newParams,
                programId: prog.id,
                programName: prog.name
            });
        }
    };

    // Filter Logic
    const filteredEvents = events.filter(e => {
        const matchesSearch = e.programName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.question.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Stats Logic
    const stats = {
        total: events.length,
        open: events.filter(e => e.status === 'open').length,
        evaluated: events.filter(e => e.status === 'evaluated').length
    };

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Prediction Management</h1>
                    <p className="text-muted-foreground mt-1">Manage, track, and evaluate prediction events.</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">All time created</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                        <Clock className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{stats.open}</div>
                        <p className="text-xs text-muted-foreground">Open for voting</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <Trophy className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{stats.evaluated}</div>
                        <p className="text-xs text-muted-foreground">Successfully evaluated</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">

                {/* Left Column: Create Form (Sticky) */}
                <div className="lg:col-span-1 lg:sticky lg:top-6">
                    <Card className="border-l-4 border-l-primary shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Create Event
                            </CardTitle>
                            <CardDescription>Launch a new prediction for a program.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createEvent} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Program</Label>
                                    <Select
                                        value={newParams.programId}
                                        onChange={(e) => handleProgramSelect(e.target.value)}
                                    >
                                        <option value="" disabled className="text-muted-foreground">Select Program...</option>
                                        {programs.map(p => (
                                            <option key={p.id} value={p.id} className="text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                                {p.name}
                                            </option>
                                        ))}
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Prediction Question</Label>
                                    <Input
                                        value={newParams.question}
                                        onChange={e => setNewParams({ ...newParams, question: e.target.value })}
                                        placeholder="e.g. Who will win first prize?"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Points</Label>
                                        <Input
                                            type="number"
                                            value={newParams.points}
                                            onChange={e => setNewParams({ ...newParams, points: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deadline</Label>
                                        <Input
                                            type="datetime-local"
                                            value={newParams.deadline}
                                            onChange={e => setNewParams({ ...newParams, deadline: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center">
                                        <Label>Options</Label>
                                        <Button type="button" variant="ghost" size="sm" onClick={addOption} className="h-6 text-xs">
                                            <Plus className="w-3 h-3 mr-1" /> Add
                                        </Button>
                                    </div>
                                    {newParams.options.map((opt, i) => (
                                        <Input
                                            key={i}
                                            placeholder={`Option ${i + 1}`}
                                            value={opt.label}
                                            onChange={e => {
                                                const newOpts = [...newParams.options];
                                                newOpts[i].label = e.target.value;
                                                setNewParams({ ...newParams, options: newOpts });
                                            }}
                                            required
                                        />
                                    ))}
                                </div>

                                <Button type="submit" className="w-full mt-4" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Publish Event"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Event List */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Filters */}
                    <Card className="bg-muted/30 border-none shadow-none">
                        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search events..."
                                    className="pl-9 bg-background"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex bg-background rounded-md border p-1 w-full md:w-auto overflow-x-auto">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'open', label: 'Open' },
                                    { id: 'closed', label: 'Closed' },
                                    { id: 'evaluated', label: 'Done' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setStatusFilter(tab.id as any)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap ${statusFilter === tab.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted"
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Events Grid */}
                    <div className="space-y-4">
                        {filteredEvents.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                <Filter className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>No events found matching your criteria.</p>
                            </div>
                        ) : (
                            filteredEvents.map((evt) => (
                                <Card key={evt.id} className="overflow-hidden hover:shadow-md transition-all duration-300 border-l-4" style={{
                                    borderLeftColor: evt.status === 'open' ? '#10b981' : evt.status === 'evaluated' ? '#f59e0b' : '#6b7280'
                                }}>
                                    <CardContent className="p-0">
                                        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 justify-between">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge className="capitalize" tone={
                                                        evt.status === 'open' ? 'emerald' :
                                                            evt.status === 'evaluated' ? 'amber' : 'pink'
                                                    }>
                                                        {evt.status}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                        {evt.points} Pts
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(evt.deadline).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h3 className="font-bold text-lg leading-tight">{evt.programName}</h3>
                                                    <p className="text-muted-foreground mt-1">{evt.question}</p>
                                                </div>

                                                {evt.status === 'evaluated' && evt.correctOptionId && (
                                                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium border border-amber-100 dark:border-amber-900/20">
                                                        <Trophy className="w-3.5 h-3.5" />
                                                        Winner: {evt.options.find(o => o.id === evt.correctOptionId)?.label}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-row md:flex-col gap-2 justify-start md:justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-2 md:mt-0">
                                                {evt.status !== 'evaluated' && (
                                                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(evt)} className="justify-start">
                                                        {evt.status === 'open' ?
                                                            <><StopCircle className="w-4 h-4 mr-2 text-red-500" /> Close</> :
                                                            <><PlayCircle className="w-4 h-4 mr-2 text-emerald-500" /> Open</>
                                                        }
                                                    </Button>
                                                )}

                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => {
                                                            setEditingEvent(evt);
                                                            setEditParams({
                                                                question: evt.question,
                                                                deadline: evt.deadline,
                                                                points: evt.points
                                                            });
                                                        }}>
                                                            <Edit2 className="w-4 h-4 mr-2" /> Edit
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader><DialogTitle>Edit Prediction</DialogTitle></DialogHeader>
                                                        <div className="space-y-4 py-4">
                                                            <div className="space-y-2">
                                                                <Label>Question</Label>
                                                                <Input
                                                                    value={editParams.question}
                                                                    onChange={(e) => setEditParams({ ...editParams, question: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Points</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={editParams.points}
                                                                        onChange={(e) => setEditParams({ ...editParams, points: parseInt(e.target.value) })}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Deadline</Label>
                                                                    <Input
                                                                        type="datetime-local"
                                                                        value={editParams.deadline}
                                                                        onChange={(e) => setEditParams({ ...editParams, deadline: e.target.value })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button onClick={handleUpdate} disabled={updating}>Save Changes</Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>

                                                <Button variant="ghost" size="sm" className="justify-start hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" onClick={() => handleDelete(evt.id)}>
                                                    <Trash className="w-4 h-4 mr-2" /> Delete
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Action Bar */}
                                        {evt.status !== 'evaluated' && (
                                            <div className="bg-muted/10 p-2 border-t">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" className="w-full text-white dark:bg-emerald-600/90 dark:hover:bg-emerald-600 border-0" variant="default">
                                                            <CheckCircle className="w-4 h-4 mr-2" /> Evaluate Outcome
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Evaluate Result: {evt.programName}</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="grid gap-2 py-4">
                                                            {evt.options.map((opt) => (
                                                                <Button
                                                                    key={opt.id}
                                                                    variant="outline"
                                                                    className="group justify-between h-auto py-3 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                                                    onClick={() => evaluateEvent(evt.id, opt.id)}
                                                                >
                                                                    <span className="font-medium">{opt.label}</span>
                                                                    <CheckCircle className="w-4 h-4 opacity-0 group-hover:opacity-50" />
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
