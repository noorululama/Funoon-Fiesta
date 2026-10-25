"use client";

import { useState, useRef } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioRecorderProps {
    onRecordingComplete: (blob: Blob) => void;
    onClear: () => void;
    disabled?: boolean;
}

export function AudioRecorder({ onRecordingComplete, onClear, disabled }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/mp3" }); // Most browsers default to webm/ogg but we label it generically found
                // Actually blob type depends on browser, usually audio/webm;codecs=opus.
                // We will just pass the blob.
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                onRecordingComplete(blob);
                chunksRef.current = [];
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

            // Timer
            let seconds = 0;
            timerRef.current = setInterval(() => {
                seconds++;
                setDuration(seconds);
                // Limit to 60s
                if (seconds >= 60) stopRecording();
            }, 1000);

        } catch (err) {
            console.error("Error accessing mic:", err);
            alert("Microphone access denied or error occurred.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const clearRecording = () => {
        setAudioUrl(null);
        setDuration(0);
        onClear();
    };

    const togglePlay = () => {
        if (!audioRef.current || !audioUrl) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-2">
            {!audioUrl ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={disabled}
                    className={`h-10 w-10 rounded-full transition-all ${isRecording
                            ? "bg-red-500/20 text-red-500 animate-pulse border border-red-500/50"
                            : "text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                >
                    {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
                </Button>
            ) : (
                <div className="flex items-center gap-2 bg-fuchsia-900/40 border border-fuchsia-500/30 rounded-full pl-2 pr-1 py-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={togglePlay}
                        className="h-8 w-8 text-fuchsia-200 hover:text-white"
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>

                    <span className="text-xs font-mono text-fuchsia-200 w-10">
                        {formatTime(duration)}
                    </span>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearRecording}
                        className="h-8 w-8 text-white/50 hover:text-red-400"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>

                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                    />
                </div>
            )}

            {isRecording && (
                <span className="text-xs text-red-400 font-mono animate-pulse">
                    {formatTime(duration)}
                </span>
            )}
        </div>
    );
}
