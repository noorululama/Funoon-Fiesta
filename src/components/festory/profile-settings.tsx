"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Camera, Loader2, Save, LogOut } from "lucide-react";
import { updateFestoryProfile, logoutFestory } from "@/app/festory/actions";

interface ProfileSettingsProps {
    currentName: string;
    currentImage?: string;
    initial: string;
}

export function ProfileSettings({ currentName, currentImage, initial }: ProfileSettingsProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(currentName);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentImage || null);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg("");

        const formData = new FormData();
        formData.append("name", name);
        if (file) formData.append("file", file);

        try {
            const res = await updateFestoryProfile(formData);
            if (res.error) {
                setMsg(res.error);
            } else {
                setMsg("Profile updated! Refreshing...");
                setOpen(false);
                window.location.reload(); // Simple reload to reflect session changes
            }
        } catch (err) {
            setMsg("Failed to update.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/20 flex items-center justify-center font-bold text-xs overflow-hidden relative group">
                    {preview || currentImage ? (
                        <img src={preview || currentImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <span>{initial}</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <User className="w-4 h-4 text-white" />
                    </div>
                </button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10 text-white sm:rounded-2xl w-[90%] max-w-sm rounded-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-6 pt-4">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-24 h-24 rounded-full bg-zinc-800 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                            {preview ? (
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-8 h-8 text-white/20" />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-black/50 p-1 flex justify-center">
                                <Camera className="w-4 h-4 text-white/50" />
                            </div>
                        </div>
                        <p className="text-[10px] text-white/40 max-w-[200px] text-center">
                            Note: Profile picture can only be changed <strong>2 times</strong> max.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 ml-1">Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500/50 transition-colors"
                            placeholder="Enter your name"
                            required
                        />
                    </div>

                    {msg && <p className="text-sm text-center text-red-400">{msg}</p>}

                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-white text-black hover:bg-white/90 rounded-xl"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                        </Button>
                    </div>
                </form>

                <div className="border-t border-white/10 pt-4 mt-2">
                    <Button
                        variant="destructive"
                        className="w-full rounded-xl flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                        onClick={() => logoutFestory()}
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
