"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send, Image as ImageIcon, Mic, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFestoryPost } from "@/app/festory/actions";
import Image from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AudioRecorder } from "@/components/festory/audio-recorder";

const initialState: { success?: boolean; error?: string } = {};

interface CreatePostProps {
    userImage?: string;
    userName?: string;
}

export function CreatePost({ userImage, userName }: CreatePostProps) {
    const [state, formAction] = useActionState(createFestoryPost, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [content, setContent] = useState("");
    const [recorderResetKey, setRecorderResetKey] = useState(0);

    const [isPollMode, setIsPollMode] = useState(false);
    const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

    useEffect(() => {
        if (state?.success) {
            formRef.current?.reset();
            setSelectedImage(null);
            setAudioBlob(null);
            setContent("");
            setIsPollMode(false);
            setPollOptions(["", ""]);
            setRecorderResetKey(prev => prev + 1);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [state]);

    // Sync Audio Blob to File Input
    useEffect(() => {
        if (audioBlob && fileInputRef.current) {
            const file = new File([audioBlob], "audio-note.mp3", { type: "audio/mp3" });
            const container = new DataTransfer();
            container.items.add(file);
            fileInputRef.current.files = container.files;
        }
    }, [audioBlob]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 3 * 1024 * 1024) {
                alert("File too large (max 3MB)");
                return;
            }
            const url = URL.createObjectURL(file);
            setSelectedImage(url);
            setAudioBlob(null);
            setIsPollMode(false);
        }
    };

    const handleAudioComplete = (blob: Blob) => {
        setAudioBlob(blob);
        setSelectedImage(null);
        setIsPollMode(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleAudioClear = () => {
        setAudioBlob(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const addPollOption = () => {
        if (pollOptions.length < 12) {
            setPollOptions([...pollOptions, ""]);
        }
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== index));
        }
    };

    const updatePollOption = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const togglePollMode = () => {
        if (!isPollMode) {
            setSelectedImage(null);
            setAudioBlob(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
        setIsPollMode(!isPollMode);
    };

    return (
        <div className="bg-zinc-900 rounded-3xl p-5 border border-white/5 shadow-xl mb-6">
            <form ref={formRef} action={formAction}>
                <div className="flex gap-4 mb-4">
                    <Avatar className="h-10 w-10 border border-white/10 shrink-0">
                        <AvatarImage src={userImage} className="object-cover" />
                        <AvatarFallback className="text-xs">{userName?.slice(0, 2).toUpperCase() || "ME"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                        <input
                            type="text"
                            name="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={isPollMode ? "Ask a question..." : selectedImage ? "Add a caption..." : audioBlob ? "Describe this audio..." : "Drop your vibe here..."}
                            className="w-full bg-transparent border-none text-white placeholder:text-white/30 text-base focus:ring-0 focus:outline-none py-2"
                            autoComplete="off"
                            required={!selectedImage && !audioBlob}
                        />

                        {isPollMode && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                {pollOptions.map((option, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => updatePollOption(idx, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (idx === pollOptions.length - 1) {
                                                        addPollOption();
                                                    }
                                                }
                                            }}
                                            placeholder={`Option ${idx + 1}`}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                                            required={isPollMode}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removePollOption(idx)}
                                                className="p-2 text-white/40 hover:text-red-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 12 && (
                                    <button
                                        type="button"
                                        onClick={addPollOption}
                                        className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-medium px-1"
                                    >
                                        + Add Option
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Previews */}
                {selectedImage && (
                    <div className="mb-4 relative w-full h-48 rounded-2xl overflow-hidden border border-white/10 bg-black/50">
                        <Image src={selectedImage} alt="Preview" fill className="object-cover" />
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedImage(null);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 hover:bg-red-500/80 transition-colors"
                        >
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>
                )}


                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            name="file"
                            accept={audioBlob ? "audio/*" : "image/*"}
                            className="hidden"
                            onChange={handleImageSelect}
                        />

                        {!audioBlob && !isPollMode && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-9 w-9 rounded-full transition-colors ${selectedImage ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'}`}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!audioBlob}
                            >
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                        )}

                        {!selectedImage && !isPollMode && (
                            <div className="scale-90 origin-left">
                                <AudioRecorder
                                    key={recorderResetKey}
                                    onRecordingComplete={handleAudioComplete}
                                    onClear={handleAudioClear}
                                    disabled={!!selectedImage}
                                />
                            </div>
                        )}

                        {!selectedImage && !audioBlob && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm" // Use small button or icon
                                className={`h-9 w-9 rounded-full transition-colors ${isPollMode ? 'text-green-400 bg-green-500/10' : 'text-green-500/50 hover:bg-green-500/10'}`}
                                onClick={togglePollMode}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M22 6h-6l-3-3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" /></svg> {/* Simple Poll Icon */}
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <SubmitButton isValid={
                            (content.trim().length > 0 && !isPollMode) ||
                            (!!selectedImage) ||
                            (!!audioBlob) ||
                            (isPollMode && content.trim().length > 0 && pollOptions.every(o => o.trim().length > 0))
                        } />
                    </div>
                </div>

                <input type="hidden" name="type" value={isPollMode ? "poll" : selectedImage ? "image" : audioBlob ? "audio" : "text"} />
                {isPollMode && (
                    <input type="hidden" name="pollOptions" value={JSON.stringify(pollOptions.map(t => ({ id: crypto.randomUUID(), text: t, votes: [] })))} />
                )}
            </form>
            {state?.error && (
                <p className="text-red-400 text-xs mt-3">{state.error}</p>
            )}
        </div>
    );
}

function SubmitButton({ isValid }: { isValid: boolean }) {
    const { pending } = useFormStatus();
    const disabled = pending || !isValid;

    return (
        <Button
            type="submit"
            disabled={disabled}
            size="icon"
            className={`h-9 w-9 rounded-full transition-colors bg-transparent ${disabled
                ? "text-white/20"
                : "text-fuchsia-500 hover:text-fuchsia-400"
                }`}
        >
            {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
                <Send className="h-5 w-5" />
            )}
        </Button>
    );
}
