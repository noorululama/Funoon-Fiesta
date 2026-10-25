"use client";

import { useActionState, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { updateAdminCredentials } from "./actions";
import { getDatabaseStats, restoreDatabase } from "./backup-actions";
import { RulesConfigSection } from "./rules-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, Database, AlertTriangle, Loader2, KeyRound } from "lucide-react";
import { toast } from "react-toastify";

const initialState: { error?: string; success?: string } = {
    error: undefined,
    success: undefined,
};

function BackupRestoreSection() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(false);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await getDatabaseStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleExport = () => {
        window.location.href = "/api/admin/backup";
        toast.success("Backup download started");
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("WARNING: This will replace ALL current data with the backup data. This action cannot be undone. Are you sure?")) {
            e.target.value = "";
            return;
        }

        setRestoring(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const result = await restoreDatabase(json);
                if (result.success) {
                    toast.success(result.message);
                    fetchStats();
                } else {
                    toast.error(result.message);
                }
            } catch (error) {
                console.error("Import failed:", error);
                toast.error("Failed to parse backup file");
            } finally {
                setRestoring(false);
                if (e.target) e.target.value = "";
            }
        };
        reader.readAsText(file);
    };

    return (
        <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sky-400">
                    <Database className="h-5 w-5" />
                    Data Management & Backup
                </CardTitle>
                <CardDescription className="text-white/60">
                    Backup and restore your entire festival database.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {loading ? (
                        <div className="col-span-full flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                        </div>
                    ) : stats ? (
                        <>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <p className="text-xs text-white/50">Teams</p>
                                <p className="text-xl font-bold">{stats.teams}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <p className="text-xs text-white/50">Students</p>
                                <p className="text-xl font-bold">{stats.students}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <p className="text-xs text-white/50">Programs</p>
                                <p className="text-xl font-bold">{stats.programs}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <p className="text-xs text-fuchsia-300">Registrations</p>
                                <p className="text-xl font-bold text-fuchsia-400">{stats.programRegistrations ?? 0}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <p className="text-xs text-white/50">Results</p>
                                <p className="text-xl font-bold">{(stats.approvedResults ?? 0) + (stats.pendingResults ?? 0)}</p>
                            </div>
                        </>
                    ) : (
                        <div className="col-span-full text-center text-sm text-red-400">
                            Failed to load stats
                        </div>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-white/10">
                    <div className="flex-1 space-y-2">
                        <h4 className="text-sm font-medium text-white/80">Export Data</h4>
                        <p className="text-xs text-white/50">
                            Download a full backup of your database as a JSON file.
                        </p>
                        <Button onClick={handleExport} variant="outline" className="w-full gap-2 border-white/20 hover:bg-white/10 hover:text-white bg-transparent text-white">
                            <Download className="h-4 w-4" />
                            Export All Data
                        </Button>
                    </div>

                    <div className="flex-1 space-y-2">
                        <h4 className="text-sm font-medium text-white/80">Import Data</h4>
                        <p className="text-xs text-white/50">
                            Restore your database from a backup file.
                        </p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                disabled={restoring}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <Button
                                variant="destructive"
                                className="w-full gap-2"
                                disabled={restoring}
                            >
                                {restoring ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                {restoring ? "Restoring..." : "Import & Restore"}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-yellow-500">Warning</p>
                        <p className="text-xs text-yellow-200/80">
                            Restoring data will <strong>permanently delete</strong> all current data and replace it with the backup.
                            This action cannot be undone. Please ensure you have a current backup before restoring.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function SettingsContent() {
    const [state, action, isPending] = useActionState(updateAdminCredentials, initialState);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "rules";

    const handleTabChange = (tab: string) => {
        router.push(`/admin/settings?tab=${tab}`);
    };

    return (
        <div className="space-y-6">
            {/* Header with Dropdown Selector */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Admin Settings & Configuration</h1>
                    <p className="text-xs text-white/60 mt-1">Manage festival participation rules, scoring points, backup data, and security credentials.</p>
                </div>

                {/* Dropdown Selector for Admin Settings Sections */}
                {/* <div className="flex items-center gap-3">
                    <Label htmlFor="settings-dropdown" className="text-xs font-semibold uppercase tracking-wider text-white/70">
                        Settings Dropdown:
                    </Label>
                    <select
                        id="settings-dropdown"
                        value={activeTab}
                        onChange={(e) => handleTabChange(e.target.value)}
                        className="bg-transparent border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-fuchsia-500 cursor-pointer"
                    >
                        <option value="rules" className="bg-slate-900 text-white">🎯 Festival Rules & Points</option>
                        <option value="backup" className="bg-slate-900 text-white">💾 Data Management & Backup</option>
                        <option value="credentials" className="bg-slate-900 text-white">🔐 Admin Credentials</option>
                        <option value="all" className="bg-slate-900 text-white">⚙️ View All Sections</option>
                    </select>
                </div> */}
            </div>

            {/* SECTIONS BASED ON DROPDOWN SELECTION */}
            {(activeTab === "rules" || activeTab === "all") && <RulesConfigSection />}

            {(activeTab === "backup" || activeTab === "all") && <BackupRestoreSection />}

            {(activeTab === "credentials" || activeTab === "all") && (
                <Card className="bg-white/5 border border-white/10 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-400">
                            <KeyRound className="h-5 w-5" />
                            Admin Credentials
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            Update your admin username and password.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={action} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    name="currentPassword"
                                    type="password"
                                    placeholder="Enter current password"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="username">New Username</Label>
                                <Input
                                    id="username"
                                    name="username"
                                    placeholder="Enter new username"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">New Password</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="Enter new password"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                />
                            </div>

                            {state?.error && (
                                <p className="text-sm text-red-400">{state.error}</p>
                            )}
                            {state?.success && (
                                <p className="text-sm text-green-400">{state.success}</p>
                            )}

                            <Button type="submit" disabled={isPending} className="w-full md:w-auto">
                                {isPending ? "Updating..." : "Update Credentials"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )
            }
        </div >
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-white/50" /></div>}>
            <SettingsContent />
        </Suspense>
    );
}
