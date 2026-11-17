"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearGeminiKeyAction, fetchAiKeyStatus, saveGeminiKeyAction, testCurrentKeyAction } from "./ai-actions";

type Status = { source: "admin" | "env" | "none"; masked: string };

const SOURCE_LABEL: Record<Status["source"], string> = {
    admin: "Saved here (admin)",
    env: "Server environment (GEMINI_API_KEY)",
    none: "Not configured",
};

export function AiKeySection() {
    const [status, setStatus] = useState<Status | null>(null);
    const [value, setValue] = useState("");
    const [show, setShow] = useState(false);
    const [pending, start] = useTransition();

    const refresh = () => fetchAiKeyStatus().then(setStatus).catch(() => setStatus({ source: "none", masked: "" }));
    useEffect(() => {
        refresh();
    }, []);

    const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
        start(async () => {
            const res = await fn();
            (res.ok ? toast.success : toast.error)(res.message);
            if (res.ok) after?.();
            refresh();
        });

    return (
        <Card className="bg-white/5 border border-white/10 text-white">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                    <Bot className="h-5 w-5" />
                    AI Assistant – Gemini API key
                </CardTitle>
                <CardDescription className="text-white/60">
                    Change the key the Funoon AI Assistant uses. The new key is checked with Google before it is saved and takes effect immediately.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="text-white/60">Key in use</p>
                    <p className="mt-0.5 font-mono">{status ? status.masked || "—" : "Loading…"}</p>
                    {status && <p className="mt-1 text-xs text-white/50">Source: {SOURCE_LABEL[status.source]}</p>}
                </div>

                <form
                    className="space-y-3"
                    action={(fd) => run(() => saveGeminiKeyAction(fd), () => setValue(""))}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="geminiKey">New Gemini API key</Label>
                        <div className="relative">
                            <Input
                                id="geminiKey"
                                name="geminiKey"
                                type={show ? "text" : "password"}
                                autoComplete="off"
                                spellCheck={false}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="Paste the API key"
                                className="bg-white/5 border-white/10 pr-10 text-white placeholder:text-white/40"
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => !s)}
                                aria-label={show ? "Hide key" : "Show key"}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                            >
                                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={pending || !value.trim()}>
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Verify &amp; save
                        </Button>
                        <Button type="button" variant="outline" disabled={pending} onClick={() => run(testCurrentKeyAction)} className="border-white/20 bg-transparent text-white hover:bg-white/10">
                            Test current key
                        </Button>
                        {status?.source === "admin" && (
                            <Button type="button" variant="outline" disabled={pending} onClick={() => run(clearGeminiKeyAction)} className="border-red-400/40 bg-transparent text-red-300 hover:bg-red-500/10">
                                Remove saved key
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
