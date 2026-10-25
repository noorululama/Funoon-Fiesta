"use client";

import { useEffect, useRef, useState } from "react";
import { pusherClient } from "@/lib/pusher-client";
import { CHANNELS, EVENTS } from "@/lib/pusher";
import { Zap, Volume2, X } from "lucide-react";
import { triggerAudioBomb } from "@/app/festory/actions";
import { Button } from "@/components/ui/button";

const AUDIO_BOMBS = [
    { id: "airhorn", name: "Air Horn", color: "bg-red-500", icon: "📢" },
    { id: "drumroll", name: "Drum Roll", color: "bg-blue-500", icon: "🥁" },
    { id: "applause", name: "Applause", color: "bg-green-500", icon: "👏" },
    { id: "laugh", name: "Laugh", color: "bg-yellow-500", icon: "😂" },
];

export function GlobalAudio() {
    const [isPlaying, setIsPlaying] = useState<string | null>(null);
    const [showControls, setShowControls] = useState(false);

    // Audio context for synthesizer (pro move: no assets needed)
    const audioContextRef = useRef<AudioContext | null>(null);

    const getAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    };

    const playSynthesizedSound = (type: string) => {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;

        const createNoise = (duration: number) => {
            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            return buffer;
        };

        if (type === 'airhorn') {
            // Keep the "Good" Airhorn
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);

        } else if (type === 'applause') {
            // Crowd Cheering / Applause (Filtered Pink Noise)
            const duration = 2.0;
            const noise = ctx.createBufferSource();
            noise.buffer = createNoise(duration);
            const noiseGain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            filter.type = 'lowpass';
            filter.frequency.value = 1000;

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            noiseGain.gain.setValueAtTime(0, now);
            noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.1); // Attack
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration); // Decay

            noise.start(now);

            // Add some "claps" (rapid bursts)
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    const clap = ctx.createOscillator();
                    const clapGain = ctx.createGain();
                    clap.connect(clapGain);
                    clapGain.connect(ctx.destination);
                    clap.type = 'triangle'; // Snappy
                    clap.frequency.setValueAtTime(100 + Math.random() * 200, ctx.currentTime);
                    clapGain.gain.setValueAtTime(0.3, ctx.currentTime);
                    clapGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                    clap.start(ctx.currentTime);
                    clap.stop(ctx.currentTime + 0.1);
                }, Math.random() * 1500); // Random offset
            }

        } else if (type === 'laugh') {
            // "Ha Ha Ha" - Descending pitch sine waves
            const laughCount = 5;
            for (let i = 0; i < laughCount; i++) {
                const start = now + i * 0.15;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, start); // Start high
                osc.frequency.exponentialRampToValueAtTime(250, start + 0.1); // Drop pitch

                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.5, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);

                osc.start(start);
                osc.stop(start + 0.15);
            }

        } else if (type === 'drumroll') {
            // "Ba Dum Tss"
            // Kick
            const kick = ctx.createOscillator();
            const kickGain = ctx.createGain();
            kick.connect(kickGain);
            kickGain.connect(ctx.destination);
            kick.frequency.setValueAtTime(150, now);
            kick.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
            kickGain.gain.setValueAtTime(1, now);
            kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            kick.start(now);
            kick.stop(now + 0.5);

            // Tom (slightly later)
            const tomStart = now + 0.15;
            const tom = ctx.createOscillator();
            const tomGain = ctx.createGain();
            tom.connect(tomGain);
            tomGain.connect(ctx.destination);
            tom.frequency.setValueAtTime(200, tomStart);
            tom.frequency.exponentialRampToValueAtTime(50, tomStart + 0.3);
            tomGain.gain.setValueAtTime(0.8, tomStart);
            tomGain.gain.exponentialRampToValueAtTime(0.01, tomStart + 0.3);
            tom.start(tomStart);
            tom.stop(tomStart + 0.3);

            // Crash (Noise)
            const crashStart = now + 0.3;
            const noise = ctx.createBufferSource();
            noise.buffer = createNoise(1.0);
            const noiseGain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 2000; // Sizzle

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            noiseGain.gain.setValueAtTime(0.5, crashStart);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, crashStart + 1.0);

            noise.start(crashStart);
        }
    };

    useEffect(() => {
        const channel = pusherClient.subscribe(CHANNELS.FESTORY);

        const handleAudioBomb = (data: { sound: string, user: string }) => {
            setIsPlaying(`Bomb by ${data.user}`);
            playSynthesizedSound(data.sound);
            setTimeout(() => setIsPlaying(null), 2000);
        };

        const handleAnnouncement = (data: { audioUrl: string, user: string }) => {
            // Play announcement
            const audio = new Audio(data.audioUrl);
            audio.play().catch(e => console.log("Autoplay blocked", e));
            setIsPlaying(`Announcement by ${data.user}`);
            audio.onended = () => setIsPlaying(null);
        };

        channel.bind(EVENTS.FESTORY_AUDIO_BOMB, handleAudioBomb);
        channel.bind(EVENTS.FESTORY_ANNOUNCEMENT, handleAnnouncement);

        return () => {
            channel.unbind(EVENTS.FESTORY_AUDIO_BOMB, handleAudioBomb);
            channel.unbind(EVENTS.FESTORY_ANNOUNCEMENT, handleAnnouncement);
            pusherClient.unsubscribe(CHANNELS.FESTORY);
        };
    }, []);

    const handleTrigger = async (soundId: string) => {
        // Optimistic local play
        playSynthesizedSound(soundId);
        await triggerAudioBomb(soundId);
    };

    return (
        <div className="fixed bottom-6 right-4 z-50 flex flex-col-reverse items-end gap-2">
            <Button
                size="icon"
                variant="ghost"
                className="w-12 h-12 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-600/40"
                onClick={() => setShowControls(!showControls)}
            >
                {showControls ? <X className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
            </Button>

            {showControls && (
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 flex flex-col gap-2 animate-in slide-in-from-bottom-10 fade-in">
                    {AUDIO_BOMBS.map(bomb => (
                        <button
                            key={bomb.id}
                            onClick={() => handleTrigger(bomb.id)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg hover:scale-110 transition-transform ${bomb.color}`}
                            title={bomb.name}
                        >
                            {bomb.icon}
                        </button>
                    ))}
                </div>
            )}

            {isPlaying && (
                <div className="bg-fuchsia-600/90 text-white px-4 py-2 rounded-full shadow-lg animate-bounce flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    <span className="text-sm font-bold">{isPlaying}</span>
                </div>
            )}
        </div>
    );
}
