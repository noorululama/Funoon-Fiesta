"use client";

import { useEffect, useState, useRef } from "react";
import { Music2, Smartphone } from "lucide-react";
import { loginWithGoogle, LoginState } from "@/app/festory/actions";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import Script from "next/script";

export function FestoryLoginForm() {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [name, setName] = useState("");
    const [teamName, setTeamName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");

    // Refs to hold current values for the callback without re-initializing the button
    const formStateRef = useRef({ name, teamName, phone, mode });

    // Update refs whenever state changes
    useEffect(() => {
        formStateRef.current = { name, teamName, phone, mode };
    }, [name, teamName, phone, mode]);

    const handleGoogleCallback = async (response: any) => {
        const { name, teamName, phone, mode } = formStateRef.current;

        if (mode === "signup") {
            if (!name || !teamName || !phone) {
                setError("Please fill in all fields (Name, Team, Phone).");
                return;
            }
        }

        try {
            // If login mode, pass undefined for fields (except credential)
            const res = await loginWithGoogle(
                response.credential,
                mode === "signup" ? phone : undefined,
                mode === "signup" ? teamName : undefined,
                mode === "signup" ? name : undefined
            );

            if (res.error) {
                setError(res.error);
            }
        } catch (e) {
            setError("Login failed.");
        }
    };

    useEffect(() => {
        // Initialize Google Button ONLY ONCE
        const initializeGoogle = () => {
            // @ts-ignore
            if (window.google) {
                // @ts-ignore
                window.google.accounts.id.initialize({
                    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
                    callback: handleGoogleCallback
                });
                // @ts-ignore
                window.google.accounts.id.renderButton(
                    document.getElementById("googleBtn"),
                    { theme: "filled_black", size: "large", width: "100%", shape: "pill" }
                );
            }
        };

        // Check if script is already loaded
        if (typeof window !== 'undefined' && (window as any).google) {
            initializeGoogle();
        }

        // We can expose this function globally for the Script onLoad if needed, 
        // but the Script onLoad below handles the initial load case.
        (window as any).onGoogleLibraryLoad = initializeGoogle;

    }, []); // Empty dependency array = Runs once on mount

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="lazyOnload"
                onLoad={() => {
                    if ((window as any).onGoogleLibraryLoad) {
                        (window as any).onGoogleLibraryLoad();
                    }
                }}
            />

            {/* w-full fixed to prevent potential layout shift from scrollbars */}
            <div className="fixed inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-purple-900/40 via-black to-black z-0 pointer-events-none" />

            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-30">
                <div className="absolute -top-[20%] -left-[20%] w-[50%] h-[50%] bg-fuchsia-600/20 blur-[120px] rounded-full animate-blob" />
                <div className="absolute bottom-[0%] -right-[10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full animate-blob animation-delay-2000" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-purple-600 mb-6 shadow-2xl shadow-purple-500/30"
                    >
                        <Music2 className="w-8 h-8 text-white" />
                    </motion.div>
                    <motion.h1
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-4xl md:text-5xl font-black tracking-tight mb-2"
                    >
                        FESTORY
                    </motion.h1>
                    <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-white/60 text-lg"
                    >
                        The Social Pulse of Funoon Fiesta
                    </motion.p>
                </div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl"
                >
                    {/* Toggle Switch */}
                    <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/5">
                        <button
                            onClick={() => setMode("login")}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === "login" ? "bg-zinc-800 text-white shadow-lg shadow-black/20" : "text-white/50 hover:text-white/70"}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setMode("signup")}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === "signup" ? "bg-zinc-800 text-white shadow-lg shadow-black/20" : "text-white/50 hover:text-white/70"}`}
                        >
                            Create Account
                        </button>
                    </div>

                    <div className="space-y-4">
                        <AnimatePresence mode="wait">
                            {mode === "signup" && (
                                <motion.div
                                    key="signup-fields"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    {/* Name Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1.5 ml-1">
                                            Full Name
                                        </label>
                                        <Input
                                            name="name"
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your full name"
                                            className="h-12 bg-white/5 border-white/10 text-base md:text-sm text-white placeholder:text-white/20 focus:bg-white/10 transition-all rounded-2xl"
                                        />
                                    </div>

                                    {/* Team Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1.5 ml-1">
                                            Team Name
                                        </label>
                                        <Input
                                            name="team"
                                            type="text"
                                            required
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            placeholder="Enter team name"
                                            className="h-12 bg-white/5 border-white/10 text-base md:text-sm text-white placeholder:text-white/20 focus:bg-white/10 transition-all rounded-2xl"
                                        />
                                    </div>

                                    {/* Phone Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1.5 ml-1">
                                            Phone Number
                                        </label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                            <Input
                                                name="phone"
                                                type="tel"
                                                required
                                                value={phone}
                                                onChange={(e) => {
                                                    setPhone(e.target.value);
                                                    setError("");
                                                }}
                                                placeholder="Enter phone number"
                                                className="pl-10 h-12 bg-white/5 border-white/10 text-base md:text-sm text-white placeholder:text-white/20 focus:bg-white/10 transition-all rounded-2xl"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="pt-2 min-h-[50px]">
                            <div className="text-center text-xs text-white/40 mb-3 font-medium">
                                {mode === "login" ? "Continue securely with" : "Register instantly with"}
                            </div>
                            <div id="googleBtn" className="w-full"></div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
