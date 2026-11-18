"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  Trophy,
  CalendarDays,
  Medal,
  BookOpenCheck,
  ArrowUpRight,
  ArrowUp,
  RotateCcw,
  Copy,
  Check,
  Radio,
  MessageSquare,
  Square,
  Subtitles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Ai3dHuman, type HumanState } from "@/components/ai-3d-human";
import { VoiceRecorder, canRecordAudio, hasSpeechRecognition, isIOSDevice } from "@/lib/voice-recorder";

// 44-byte silent clip used to unlock audio playback on phones after the first tap.
// Never leave the host "thinking" forever: give up on a request that gets no response in 25s.
function fetchChat(init: RequestInit, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  const abort = () => controller.abort();
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener("abort", abort, { once: true });
  return fetch("/api/chat", { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  });
}

// ~0.1s of silence. iOS rejects a zero-length clip, so the player never got unlocked.
const SILENT_WAV = (() => {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (o: number, t: string) => [...t].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, "data"); view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
})();

/** Split text into short spoken chunks so the first sound starts quickly and long answers never cut off. */
function splitForSpeech(text: string, max = 220): string[] {
  const parts = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (cur && `${cur} ${p}`.length > max) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur} ${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length <= max * 1.6 ? [c] : c.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [c]));
}

type AIMode = "chat" | "character";

// 3D AI host visible on the chatbot page.
const SHOW_3D_CHATBOT = true;

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Which mode produced it: spoken host replies are plain text, chat replies are markdown. */
  mode: AIMode;
  /** Failed turns are excluded from AI context and can be retried from the last user question. */
  failed?: boolean;
}

function toRequestHistory(messages: Message[]) {
  const completedTurns: { role: "user" | "assistant"; content: string }[] = [];
  let pendingUser: Message | null = null;

  for (const message of messages) {
    if (message.failed) {
      pendingUser = null;
      continue;
    }
    if (message.role === "user") {
      pendingUser = message;
    } else if (pendingUser) {
      completedTurns.push(
        { role: "user", content: pendingUser.content },
        { role: "assistant", content: message.content },
      );
      pendingUser = null;
    }
  }

  return completedTurns.slice(-12);
}

const CHAT_SUGGESTIONS = [
  {
    icon: Trophy,
    text: "Who is currently leading the team scoreboard?",
    label: "Live Scoreboard",
    tile: "from-[#FFC24B] to-[#F2782A] shadow-[#F2782A]/35",
  },
  {
    icon: Medal,
    text: "Summarize the latest published results.",
    label: "Latest Results",
    tile: "from-[#FF7A6B] to-[#D9383F] shadow-[#D9383F]/35",
  },
  {
    icon: CalendarDays,
    text: "What are the events and programs in Funoon Fiesta?",
    label: "Events & Programs",
    tile: "from-[#6FA8FF] to-[#3D5FE0] shadow-[#3D5FE0]/35",
  },
  {
    icon: BookOpenCheck,
    text: "How does the grade and point scoring system work?",
    label: "Point Rules",
    tile: "from-[#B184FF] to-[#6C3FD8] shadow-[#6C3FD8]/35",
  },
];

// Instant spot reflexes: Spoken in 0ms while AI fetches answer in parallel
const SPOT_REFLEXES = [
  "തീർച്ചയായും, പറയാം.",
  "ശരി, പരിശോധിക്കാം.",
  "തീർച്ചയായും.",
];

// Instant intent matching for 0ms spot answers on common questions
const INSTANT_INTENTS: { regex: RegExp; reply: string }[] = [
  {
    regex: /^(?:ഹലോ|ഹായ്|നമസ്കാരം|അസ്സലാമു അലൈക്കും|hello|hi|hey)(?:$|[\s,.!?।])/i,
    reply: "വ അലൈക്കുമുസ്സലാം! ഞാൻ ഫുനൂൻ ഫിയസ്റ്റ 2026-ന്റെ 3D അവതാരകനാണ്. മത്സര ഫലങ്ങൾ, ടീം സ്കോറുകൾ എന്നിവയെക്കുറിച്ച് എന്നോട് ചോദിക്കാം!",
  },
  {
    regex: /(നിങ്ങൾ ആരാണ്|ആരാണ് നിങ്ങൾ|who are you|താങ്കൾ ആരാണ്|പേരെന്താണ്)/i,
    reply: "ഞാൻ ഫുനൂൻ ഫിയസ്റ്റ 2026-ന്റെ ഔദ്യോഗിക 3D ലൈവ് എഐ അവതാരകനാണ്. ഫെസ്റ്റിവലിന്റെ എല്ലാ വിവരങ്ങളും ഞാൻ നിങ്ങൾക്ക് പറഞ്ഞുതരാം.",
  },
  {
    regex: /(തീം|theme|പ്രമേയം|ശതകം സാക്ഷി)/i,
    reply: "ഫുനൂൻ ഫിയസ്റ്റ 2026-ന്റെ മുഖ്യ പ്രമേയം 'ശതകം സാക്ഷി' എന്നതാണ്.",
  },
];

export default function ChatbotClient() {
  const [activeTab, setActiveTab] = useState<AIMode>("character");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoadingState] = useState(false);
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = useState(false);
  const setIsLoading = (value: boolean) => {
    isLoadingRef.current = value;
    setIsLoadingState(value);
  };
  const [humanState, setHumanState] = useState<HumanState>("idle");
  const isLoadingRef = useRef(false);
  const activeChatRequestRef = useRef<AbortController | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceInputNotice, setVoiceInputNotice] = useState<string | null>(null);
  const [voicePlaybackNotice, setVoicePlaybackNotice] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Character specific response display
  const [characterResponse, setCharacterResponse] = useState<string | null>(null);
  const [characterUserQuery, setCharacterUserQuery] = useState<string | null>(null);
  const [showSubtitle, setShowSubtitle] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentTranscriptRef = useRef<string>("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasChatStarted = chatMessages.length > 0;
  const hostStatus = isListening
    ? "Listening to you"
    : isSpeaking
    ? "Speaking"
    : isLoading
    ? activeTab === "character" ? "Thinking through your question" : "Checking festival information"
    : "Ready to help";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      activeChatRequestRef.current?.abort();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  /* ── Consistent male host voice ──────────────────────────────────
     All spoken audio comes from the named male neural voices on the server.
     Browser voices are deliberately not used because browsers don't expose
     reliable voice gender metadata. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const recLangRef = useRef<string | null>(null);
  const speechEpochRef = useRef(0);
  const ttsQueueRef = useRef<{ text: string; epoch: number }[]>([]);
  const ttsPlayingRef = useRef(false);

  const getAudio = useCallback(() => {
    if (typeof Audio === "undefined") return null;
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  // Phones only allow audio that started from a tap: warm the player up on the first tap.
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    const a = getAudio();
    if (!a) return;
    a.src = SILENT_WAV;
    a.play()
      .then(() => {
        audioUnlockedRef.current = true;
        a.pause();
      })
      .catch(() => {});
  }, [getAudio]);

  const cancelAllSpeech = useCallback(() => {
    speechEpochRef.current += 1;
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
    }
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
    currentAudioUrlRef.current = null;
  }, []);

  const reportVoiceIssue = useCallback((error?: unknown) => {
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    setIsSpeaking(false);
    setHumanState(isLoadingRef.current ? "thinking" : "idle");
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    setVoicePlaybackNotice(
      code === "voice_not_configured"
        ? "To hear the consistent male voice, add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to .env.local. Your text replies and captions remain available."
        : "The male voice is temporarily unavailable. Your complete reply is still available as text; try Read aloud again in a moment.",
    );
  }, []);

  const playNext = useCallback(
    async function run(): Promise<void> {
      const item = ttsQueueRef.current.shift();
      if (!item) {
        ttsPlayingRef.current = false;
        setIsSpeaking(false);
        setHumanState(isLoadingRef.current ? "thinking" : "idle");
        return;
      }
      ttsPlayingRef.current = true;

      let url: string;
      let isFallbackVoice = false;
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text }),
        });
        if (!response.ok) {
          const details = await response.json().catch(() => null);
          throw Object.assign(new Error(details?.error ?? "Male voice unavailable"), { code: details?.code });
        }
        isFallbackVoice = response.headers.get("X-Voice") === "fallback";
        url = URL.createObjectURL(await response.blob());
      } catch (error) {
        if (item.epoch === speechEpochRef.current) reportVoiceIssue(error);
        return;
      }
      if (item.epoch !== speechEpochRef.current) {
        URL.revokeObjectURL(url);
        return;
      }

      const audio = getAudio();
      if (!audio) {
        URL.revokeObjectURL(url);
        reportVoiceIssue();
        return;
      }
      currentAudioUrlRef.current = url;
      const done = () => {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        currentAudioUrlRef.current = null;
        if (item.epoch === speechEpochRef.current) void run();
      };
      audio.onended = done;
      audio.onerror = () => {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        currentAudioUrlRef.current = null;
        if (item.epoch === speechEpochRef.current) reportVoiceIssue();
      };
      audio.src = url;
      // The built-in fallback voice is female: lower its pitch so the host sounds male.
      // (Azure's male neural voice needs no adjustment.)
      const pitchable = audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
      pitchable.preservesPitch = !isFallbackVoice;
      pitchable.webkitPreservesPitch = !isFallbackVoice;
      audio.defaultPlaybackRate = isFallbackVoice ? 0.84 : 1;
      audio.playbackRate = audio.defaultPlaybackRate;
      try {
        await audio.play();
        setVoicePlaybackNotice(null);
        setIsSpeaking(true);
        setHumanState("speaking");
      } catch {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        currentAudioUrlRef.current = null;
        if (item.epoch === speechEpochRef.current) reportVoiceIssue();
      }
    },
    [getAudio, reportVoiceIssue],
  );

  const enqueueServerSpeech = useCallback(
    (text: string) => {
      ttsQueueRef.current.push({ text, epoch: speechEpochRef.current });
      if (!ttsPlayingRef.current) void playNext();
    },
    [playNext],
  );

  // Text-to-speech: male voice, sentence by sentence
  const speakText = useCallback(
    (text: string, shouldCancel = true): boolean => {
      if (!voiceEnabled || typeof window === "undefined") return false;

      // Clean formatting, symbols, and punctuation for natural, clear spoken Malayalam
      const cleanText = text
        .replace(/[*_#`~>]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/\|.*?\|/g, " ")
        .replace(/[•●▪-]\s+/g, "")
        // Say "3D" like the English "three D", not as the Malayalam number "moonnu di".
        .replace(/3\s?[Dd](?![A-Za-z0-9])/g, " ത്രീ ഡി ")
        .replace(/&/g, " കൂടാതെ ")
        .replace(/%/g, " ശതമാനം ")
        .replace(/\//g, " അല്ലെങ്കിൽ ")
        .replace(/:\s*/g, ", ")
        .replace(/\n+/g, ". ")
        .trim();
      if (!cleanText) return false;

      if (shouldCancel) cancelAllSpeech();

      const chunks = splitForSpeech(cleanText);
      if (typeof Audio === "undefined") {
        setVoicePlaybackNotice("Audio playback is unavailable in this browser. The reply is still shown as text.");
        return false;
      }
      setVoicePlaybackNotice(null);
      chunks.forEach((chunk) => enqueueServerSpeech(chunk));
      return true;
    },
    [voiceEnabled, activeTab, cancelAllSpeech, enqueueServerSpeech],
  );

  const stopSpeaking = () => {
    cancelAllSpeech();
    setIsSpeaking(false);
    setHumanState("idle");
  };

  // ───────── Live voice (hands-free) ─────────
  // One tap = one question: the mic listens until you pause, sends it, then closes.
  // Tap again to send right away, or to interrupt the host.
  const [liveMode, setLiveMode] = useState(false);
  const liveModeRef = useRef(false);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const startingRef = useRef(false);
  const failCountRef = useRef(0);
  const activeTabRef = useRef(activeTab);
  isListeningRef.current = isListening;
  isSpeakingRef.current = isSpeaking;
  activeTabRef.current = activeTab;
  const LIVE_SILENCE_MS = 1500;

  const detachRecognition = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
  };

  const endLive = (notice?: string | null) => {
    liveModeRef.current = false;
    setLiveMode(false);
    startingRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    detachRecognition();
    currentTranscriptRef.current = "";
    setIsListening(false);
    setHumanState((current) => (current === "listening" ? "idle" : current));
    if (activeTabRef.current === "character") setInput("");
    if (notice !== undefined) setVoiceInputNotice(notice);
  };

  const sendSpoken = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const text = currentTranscriptRef.current.trim();
    currentTranscriptRef.current = "";
    // One question per tap: close the mic now and do not reopen it after the answer.
    liveModeRef.current = false;
    setLiveMode(false);
    detachRecognition();
    setIsListening(false);
    if (!text) {
      setHumanState("idle");
      return;
    }
    if (activeTabRef.current === "character") {
      handleSendCharacterQuery(text);
    } else {
      handleSendMessage(text);
    }
  };

  const startRecognition = () => {
    if (typeof window === "undefined" || startingRef.current || recognitionRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      endLive("Voice input isn't available here. On iPhone, open this page in Safari (not Chrome or an in-app browser), or use Text chat.");
      return;
    }

    try {
      startingRef.current = true;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      // Character mode listens in Malayalam; Chat mode in English
      recognition.lang = recLangRef.current ?? (activeTabRef.current === "character" ? "ml-IN" : "en-US");
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        startingRef.current = false;
        failCountRef.current = 0;
        setIsListening(true);
        setHumanState("listening");
      };

      recognition.onresult = (event: any) => {
        // Everything heard in this session, so a pause inside a long question never loses words.
        let text = "";
        for (let i = 0; i < event.results.length; i++) text += `${event.results[i][0].transcript} `;
        text = text.trim();
        if (!text) return;
        currentTranscriptRef.current = text;
        setInput(text);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(sendSpoken, LIVE_SILENCE_MS);
      };

      recognition.onerror = (event: any) => {
        startingRef.current = false;
        const err = event.error;
        if (err === "language-not-supported" && recognition.lang !== "en-IN") {
          // iPhones often cannot recognise Malayalam: carry on in Indian English.
          recLangRef.current = "en-IN";
          langRetryRef.current = true; // onend restarts in English instead of closing
          setVoiceInputNotice("Malayalam voice input isn't available on this phone, so I'm listening in English instead.");
          return;
        }
        if (err === "not-allowed" || err === "service-not-allowed") {
          endLive("Allow microphone access, then tap the microphone again. On iPhone also turn on Siri & Dictation in Settings.");
          return;
        }
        if (err === "no-speech" || err === "aborted") return; // onend closes the session
        failCountRef.current += 1;
        if (failCountRef.current >= 4) endLive("Voice input isn't available right now. Try again.");
      };

      recognition.onend = () => {
        // Browsers close the mic after a while or a long silence: send what we have, or just reopen it.
        startingRef.current = false;
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setIsListening(false);
        if (!liveModeRef.current) {
          setHumanState((current) => (current === "listening" ? "idle" : current));
          return;
        }
        if (langRetryRef.current) {
          langRetryRef.current = false;
          startRecognition();
          return;
        }
        if (currentTranscriptRef.current.trim()) sendSpoken();
        else endLive("I didn't hear anything. Tap the microphone and ask again, a little closer to the phone.");
      };

      recognition.start();
    } catch (e) {
      console.error("Speech recognition error:", e);
      startingRef.current = false;
      recognitionRef.current = null;
      failCountRef.current += 1;
      if (failCountRef.current >= 4) endLive("Couldn't start the microphone. Check its permission and try again.");
    }
  };

  // Keep-alive: while live voice is on and nobody is talking or thinking, make sure the mic is open.
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => {
      if (!liveModeRef.current) return;
      const hostBusy =
        isLoadingRef.current ||
        isSpeakingRef.current ||
        ttsPlayingRef.current ||
        ttsQueueRef.current.length > 0;
      if (!hostBusy && !isListeningRef.current && !startingRef.current && !recognitionRef.current) {
        startRecognition();
      }
    }, 600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode]);

  // Changing between Talk-to-host and Text chat ends the live session.
  useEffect(() => {
    if (liveModeRef.current) endLive(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(
    () => () => {
      liveModeRef.current = false;
    },
    [],
  );

  // ───────── iPhone / no-Web-Speech voice input ─────────
  // iOS Safari's speech recognition fails in the home-screen app, in Chrome/in-app
  // browsers, with Siri & Dictation off, and for Malayalam. There we record the
  // question ourselves and transcribe it on the server (/api/transcribe).
  const langRetryRef = useRef(false);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const recorderModeRef = useRef<boolean | null>(null);
  const transcribingRef = useRef(false);
  const useRecorderInput = () => {
    if (recorderModeRef.current === null) {
      recorderModeRef.current = canRecordAudio() && (isIOSDevice() || !hasSpeechRecognition());
    }
    return recorderModeRef.current;
  };

  const finishRecording = async () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder || transcribingRef.current) return;
    transcribingRef.current = true;
    setIsListening(false);
    const wav = await recorder.stop();
    if (!wav) {
      transcribingRef.current = false;
      setHumanState((current) => (current === "listening" ? "idle" : current));
      setVoiceInputNotice("I didn't hear anything. Tap the microphone and ask again, a little closer to the phone.");
      return;
    }
    setHumanState("thinking");
    setVoiceInputNotice("Got it, understanding your question…");
    let text = "";
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/wav", "X-Voice-Lang": activeTabRef.current === "character" ? "ml" : "en" },
        body: wav,
      });
      const data = await res.json().catch(() => ({}));
      text = typeof data?.text === "string" ? data.text.trim() : "";
      if (!res.ok && !text) throw new Error(data?.error || "transcribe failed");
    } catch (e) {
      console.error("Transcription error:", e);
      transcribingRef.current = false;
      setHumanState("idle");
      setVoiceInputNotice("Voice input isn't available right now. Please try again or use Text chat.");
      return;
    }
    transcribingRef.current = false;
    if (!text) {
      setHumanState("idle");
      setVoiceInputNotice("Sorry, I couldn't catch that. Tap the microphone and try again.");
      return;
    }
    setVoiceInputNotice(null);
    if (activeTabRef.current === "character") handleSendCharacterQuery(text);
    else handleSendMessage(text);
  };
  const finishRecordingRef = useRef(finishRecording);
  finishRecordingRef.current = finishRecording;

  const startRecording = async () => {
    if (!voiceRecorderRef.current) voiceRecorderRef.current = new VoiceRecorder();
    setVoiceInputNotice(null);
    stopSpeaking();
    if (activeTab === "character") setInput("");
    try {
      await voiceRecorderRef.current.start({ onAutoStop: () => finishRecordingRef.current() });
      setIsListening(true);
      setHumanState("listening");
    } catch (e: any) {
      console.error("Microphone error:", e);
      setIsListening(false);
      setHumanState("idle");
      setVoiceInputNotice(
        e?.name === "NotAllowedError" || e?.name === "SecurityError"
          ? "Microphone is blocked. On iPhone: Settings → Safari → Microphone → Allow (or tap “aA” in the address bar → Website Settings → Microphone → Allow), then tap the microphone again."
          : "Couldn't open the microphone. Close other apps using it and try again.",
      );
    }
  };

  useEffect(() => () => voiceRecorderRef.current?.cancel(), []);
  useEffect(() => {
    // Switching tabs cancels a recording in progress.
    if (voiceRecorderRef.current?.isActive) {
      voiceRecorderRef.current.cancel();
      setIsListening(false);
      setHumanState((current) => (current === "listening" ? "idle" : current));
    }
  }, [activeTab]);

  const toggleListening = () => {
    unlockAudio();

    if (useRecorderInput()) {
      if (voiceRecorderRef.current?.isActive) {
        // Tapped while listening: send now.
        void finishRecording();
        return;
      }
      if (transcribingRef.current) return;
      if (isSpeakingRef.current || ttsPlayingRef.current) {
        // Tapped while the host is talking: interrupt and listen.
        stopSpeaking();
      } else if (isLoading) {
        return;
      }
      void startRecording();
      return;
    }

    if (liveModeRef.current) {
      if (isListeningRef.current) {
        // Tapped while listening: send what was said, or end the session if nothing was said.
        if (currentTranscriptRef.current.trim()) sendSpoken();
        else endLive(null);
        return;
      }
      // Tapped while the host is thinking or talking: interrupt and listen again.
      if (isSpeakingRef.current || ttsPlayingRef.current) stopSpeaking();
      else if (isLoadingRef.current) endLive(null);
      return;
    }

    if (isLoading) return;
    if (typeof window === "undefined") return;
    if (!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) {
      setVoiceInputNotice("Voice input isn't available here. On iPhone, open this page in Safari (not Chrome or an in-app browser), or use Text chat.");
      return;
    }

    setVoiceInputNotice(null);
    stopSpeaking();
    currentTranscriptRef.current = "";
    failCountRef.current = 0;
    if (activeTab === "character") setInput("");
    liveModeRef.current = true;
    setLiveMode(true);
    startRecognition();
  };

  // Character query handler (pure voice/spoken dialogue mode with SPOT REPLY)
  const handleSendCharacterQuery = async (queryText: string, historyOverride?: Message[]) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoadingRef.current) return;
    if (trimmed.length > 1200) {
      setVoiceInputNotice("Please keep your question under 1,200 characters.");
      return;
    }
    const previousMessages = historyOverride ?? chatMessages;

    setInput("");
    setVoiceInputNotice(null);
    stopSpeaking();
    setCharacterUserQuery(trimmed);
    const currentUserMessage: Message = { role: "user", content: trimmed, mode: "character" };
    if (historyOverride) setChatMessages([...previousMessages, currentUserMessage]);
    else setChatMessages((prev) => [...prev, currentUserMessage]);
    const reply = (content: string, failed = false) =>
      setChatMessages((prev) => [...prev, { role: "assistant", content, mode: "character", failed }]);

    // 1. Instant Intent Check: 0ms Spot Reply for greetings and common queries
    for (const item of INSTANT_INTENTS) {
      if (item.regex.test(trimmed)) {
        setCharacterResponse(item.reply);
        reply(item.reply);
        setShowSubtitle(true);
        if (!speakText(item.reply)) setHumanState("idle");
        return;
      }
    }

    setIsLoading(true);
    const requestController = new AbortController();
    activeChatRequestRef.current = requestController;
    setHumanState("thinking");
    setCharacterResponse(null);
    setShowSubtitle(true);
    let streamedText = "";
    let queuedSpeech = false;
    let gotAnswer = false;
    // If the answer is not here after ~0.9s, say a short acknowledgement so the host never feels frozen.
    const fillerTimer = setTimeout(() => {
      if (!gotAnswer) speakText(SPOT_REFLEXES[Math.floor(Math.random() * SPOT_REFLEXES.length)], false);
    }, 1100);

    try {
      const response = await fetchChat({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, mode: "character", history: toRequestHistory(previousMessages) }),
      }, requestController.signal);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "The host could not answer right now.");
      }

      if ((response.headers.get("content-type") ?? "").includes("application/json")) {
        const data = await response.json();
        gotAnswer = true;
        streamedText = String(data.response ?? "");
        setCharacterResponse(streamedText);
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("The host response stream is unavailable.");

        const decoder = new TextDecoder();
        let speechBuffer = "";
        const speakCompletedSentences = (flush = false) => {
          let match: RegExpMatchArray | null;
          // Start talking sooner: the very first spoken chunk may end at a comma.
          if (!queuedSpeech && !flush) {
            const early = speechBuffer.match(/^([\s\S]{18,}?[,،])\s+/);
            if (early && !/[.!?।]\s/.test(early[1])) {
              speechBuffer = speechBuffer.slice(early[0].length);
              if (speakText(early[1].trim(), false)) queuedSpeech = true;
            }
          }
          while ((match = speechBuffer.match(/^([\s\S]*?[.!?।])\s+/))) {
            const sentence = match[1].trim();
            speechBuffer = speechBuffer.slice(match[0].length);
            if (sentence && speakText(sentence, false)) queuedSpeech = true;
          }
          if (flush && speechBuffer.trim()) {
            if (speakText(speechBuffer.trim(), false)) queuedSpeech = true;
            speechBuffer = "";
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const part = decoder.decode(value, { stream: true });
          if (!part) continue;
          gotAnswer = true;
          streamedText += part;
          speechBuffer += part;
          setCharacterResponse(streamedText);
          speakCompletedSentences();
        }

        const lastPart = decoder.decode();
        if (lastPart) {
          streamedText += lastPart;
          speechBuffer += lastPart;
        }
        speakCompletedSentences(true);
      }

      if (!streamedText.trim()) throw new Error("The host returned an empty answer.");
      setCharacterResponse(streamedText);
      reply(streamedText);
      if (!queuedSpeech && !speakText(streamedText, false)) setHumanState("idle");
    } catch (err) {
      if (requestController.signal.aborted) return;
      console.error("Error in handleSendCharacterQuery:", err);
      const errMsg = streamedText.trim()
        ? "ക്ഷമിക്കണം, മറുപടി പൂർത്തിയാകുന്നതിന് മുമ്പ് ബന്ധം നഷ്ടപ്പെട്ടു. വീണ്ടും ചോദിക്കൂ."
        : "ക്ഷമിക്കണം, താൽക്കാലികമായി കണക്ട് ചെയ്യാൻ സാധിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.";
      const finalText = streamedText.trim() ? `${streamedText.trim()} ${errMsg}` : errMsg;
      setCharacterResponse(finalText);
      reply(finalText, true);
      setShowSubtitle(true);
      if (!speakText(errMsg, false)) setHumanState("idle");
    } finally {
      clearTimeout(fillerTimer);
      if (activeChatRequestRef.current === requestController) {
        activeChatRequestRef.current = null;
        setIsLoading(false);
      }
    }
  };

  // Chat section query handler (streams the answer, speaks sentence by sentence)
  const handleSendMessage = async (text: string, historyOverride?: Message[]) => {
    if (!text.trim() || isLoadingRef.current) return;
    if (text.trim().length > 1200) {
      setVoiceInputNotice("Please keep your question under 1,200 characters.");
      return;
    }
    const previousMessages = historyOverride ?? chatMessages;

    setVoiceInputNotice(null);
    stopSpeaking();
    const userMessage = text.trim();
    setInput("");

    const currentUserMessage: Message = { role: "user", content: userMessage, mode: "chat" };
    if (historyOverride) setChatMessages([...previousMessages, currentUserMessage]);
    else setChatMessages((prev) => [...prev, currentUserMessage]);
    setIsLoading(true);
    setIsAwaitingFirstToken(true);
    const requestController = new AbortController();
    activeChatRequestRef.current = requestController;
    setHumanState("thinking");

    let answer = "";
    let shown = false;
    let queuedSpeech = false;
    let speechBuffer = "";
    // Text chat is silent: answers are only read aloud when the user taps "Read aloud" on a message.
    const speakReady = (flush = false) => {
      void flush;
      speechBuffer = "";
    };
    const showAnswer = () => {
      // React runs state updaters later, so read `shown`/`answer` now. Otherwise the first update
      // overwrote the user's own message with the answer.
      const content = answer;
      const first = !shown;
      shown = true;
      setChatMessages((prev) => {
        if (first) return [...prev, { role: "assistant", content, mode: "chat" }];
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content };
        return copy;
      });
    };

    try {
      const response = await fetchChat({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, mode: "chat", history: toRequestHistory(previousMessages) }),
      }, requestController.signal);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "The assistant could not answer right now.");
      }

      if ((response.headers.get("content-type") ?? "").includes("application/json")) {
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setIsAwaitingFirstToken(false);
        answer = String(data.response ?? "");
        showAnswer();
        speechBuffer = answer;
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("The response stream is unavailable.");
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const part = decoder.decode(value, { stream: true });
          if (!part) continue;
          setIsAwaitingFirstToken(false);
          answer += part;
          speechBuffer += part;
          showAnswer();
          speakReady();
        }
        const tail = decoder.decode();
        if (tail) {
          answer += tail;
          speechBuffer += tail;
          showAnswer();
        }
      }

      if (!answer.trim()) throw new Error("Empty answer");
      speakReady(true);
      if (!queuedSpeech) setHumanState("idle");
    } catch (err) {
      if (requestController.signal.aborted) return;
      setIsAwaitingFirstToken(false);
      const failure = err instanceof Error && err.message && err.message !== "Failed to fetch"
        ? `I couldn't complete that reply. ${err.message}`
        : "I couldn't complete that reply because of a connection issue. Please try again.";
      if (shown) {
        setChatMessages((prev) => prev.map((message, index) =>
          index === prev.length - 1
            ? { ...message, content: answer.trim() ? message.content : failure, failed: true }
            : message,
        ));
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: failure, mode: "chat", failed: true }]);
      }
      setHumanState("idle");
    } finally {
      if (activeChatRequestRef.current === requestController) {
        activeChatRequestRef.current = null;
        setIsAwaitingFirstToken(false);
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrent();
    }
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRetryMessage = (failedIndex: number) => {
    const failedMessage = chatMessages[failedIndex];
    const userMessage = chatMessages[failedIndex - 1];
    if (isLoadingRef.current || !failedMessage?.failed || userMessage?.role !== "user") return;

    const history = chatMessages.slice(0, failedIndex - 1);
    setChatMessages(history);
    if (userMessage.mode === "character") handleSendCharacterQuery(userMessage.content, history);
    else handleSendMessage(userMessage.content, history);
  };

  const handleResetChat = () => {
    activeChatRequestRef.current?.abort();
    activeChatRequestRef.current = null;
    setIsAwaitingFirstToken(false);
    setIsLoading(false);
    stopSpeaking();
    setChatMessages([]);
    setCharacterResponse(null);
    setCharacterUserQuery(null);
    setHumanState("idle");
    setInput("");
  };

  // Malayalam greeting when 3D avatar is clicked
  const handleAvatarClick = () => {
    unlockAudio();
    if (!isSpeaking && !isLoading) {
      const greeting = "അസ്സലാമു അലൈക്കും! ഞാൻ ഫുനൂൻ ഫിയസ്റ്റയുടെ 3D ലൈവ് എഐ അവതാരകനാണ്. മത്സര ഫലങ്ങൾ, ടീം സ്കോറുകൾ, പരിപാടികൾ എന്നിവയെക്കുറിച്ച് എന്നോട് സംസാരിക്കാം!";
      setCharacterResponse(greeting);
      if (!speakText(greeting)) setHumanState("idle");
    }
  };

  /** One composer for both modes: the active mode decides how the host answers. */
  const sendText = (text: string) => {
    unlockAudio();
    if (activeTab === "character") handleSendCharacterQuery(text);
    else handleSendMessage(text);
  };

  const sendCurrent = () => {
    const question = input.trim();
    if (!question || isLoadingRef.current) return;
    if (question.length > 1200) {
      setVoiceInputNotice("Please keep your question under 1,200 characters.");
      return;
    }
    sendText(question);
  };

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendCurrent();
  };

  const switchMode = (mode: AIMode) => {
    stopSpeaking();
    if (mode === "character") setVoiceEnabled(true);
    setActiveTab(mode);
  };

  // Plain booleans (not narrowed by the JSX branches below) for checks inside mode-specific markup.
  const isCharacterMode: boolean = activeTab === "character";
  const isChatMode: boolean = activeTab === "chat";

  const lastAssistant = [...chatMessages].reverse().find((m) => m.role === "assistant");
  const caption = activeTab === "character" ? characterResponse : lastAssistant?.content ?? null;

  const statusDot = isListening
    ? "bg-sky-500"
    : isSpeaking
      ? "bg-emerald-500"
      : isLoading
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-white font-sans text-[#1E1B18]">
      {/* soft brand glow + dot grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ backgroundImage: "radial-gradient(#E9E2DA 1.1px, transparent 1.1px)", backgroundSize: "30px 30px" }} />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 z-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,149,42,0.18),transparent)]" />
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className={cn(
        "relative z-40 shrink-0 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl",
        activeTab === "character" && "absolute inset-x-2.5 top-2.5 border-transparent bg-transparent backdrop-blur-none lg:inset-x-8 lg:top-4 xl:inset-x-12 2xl:inset-x-20",
      )}>
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 py-3 pl-4 pr-16 sm:pl-5 md:pr-20 lg:pl-28">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BrandMark className="h-11 w-11" />
            <div className="min-w-0">
              <h1 className={cn("truncate text-[15px] font-extrabold tracking-tight sm:text-base", isCharacterMode && "text-white")}>Funoon AI Assistant</h1>
              <p className={cn("flex items-center gap-1.5 text-[11px]", isCharacterMode ? "text-white/90" : "text-[#7A716A]")}>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot, (isListening || isSpeaking || isLoading) && "animate-pulse")} />
                <span className="truncate" role="status" aria-live="polite">{hostStatus}</span>
              </p>
            </div>
          </div>

          {/* Mode switch */}
          {SHOW_3D_CHATBOT && (
            <div role="tablist" aria-label="Answer style" className={cn("hidden items-center rounded-full border p-1 sm:flex", isCharacterMode ? "border-white/30 bg-white/15 backdrop-blur-md" : "border-[#F0952A]/20 bg-[#FFF1E6]")}>
              <ModeButton active={activeTab === "character"} onClick={() => switchMode("character")} icon={<Radio size={15} />} label="Talk to host" dark={isCharacterMode} />
              <ModeButton active={activeTab === "chat"} onClick={() => switchMode("chat")} icon={<MessageSquare size={15} />} label="Text chat" dark={isCharacterMode} />
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            {activeTab === "chat" && (
              <IconToggle
                active={voiceEnabled}
                onClick={() => {
                  if (voiceEnabled) stopSpeaking();
                  setVoiceEnabled(!voiceEnabled);
                }}
                label={voiceEnabled ? "Mute host voice" : "Turn on host voice"}
              >
                {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </IconToggle>
            )}
            {hasChatStarted && (
              <IconToggle dark={isCharacterMode} active={false} onClick={handleResetChat} label="Start a new conversation">
                <RotateCcw size={16} />
              </IconToggle>
            )}
          </div>
        </div>

        {/* Mode switch – mobile */}
        {SHOW_3D_CHATBOT && (
          <div className="px-4 pb-3 sm:hidden">
            <div role="tablist" aria-label="Answer style" className={cn("flex items-center rounded-full border p-1", isCharacterMode ? "border-white/30 bg-white/15 backdrop-blur-md" : "border-[#F0952A]/20 bg-[#FFF1E6]")}>
              <ModeButton active={activeTab === "character"} onClick={() => switchMode("character")} icon={<Radio size={15} />} label="Talk to host" stretch dark={isCharacterMode} />
              <ModeButton active={activeTab === "chat"} onClick={() => switchMode("chat")} icon={<MessageSquare size={15} />} label="Text chat" stretch dark={isCharacterMode} />
            </div>
          </div>
        )}
      </header>

      {/* ── Body: host stage + conversation ─────────────────────── */}
      <main className={cn(
        "relative grid min-h-0 w-full flex-1",
        activeTab === "character"
          ? "mx-0 max-w-none grid-cols-1 grid-rows-1 gap-0 p-0"
          : "mx-auto max-w-[1000px] grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 p-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:gap-4 sm:p-4 lg:grid-cols-1 lg:grid-rows-1 lg:gap-5 lg:p-5 lg:pl-28",
      )}>
        {/* Host stage */}
        {activeTab === "character" && SHOW_3D_CHATBOT && (
        <section
          aria-label="3D festival host"
          className={cn(
            "overflow-hidden bg-[linear-gradient(135deg,#F0A220_0%,#EC8230_30%,#E4602F_62%,#DB3C3F_100%)]",
            activeTab === "character"
              ? "fixed inset-x-2.5 bottom-2.5 top-2.5 z-0 rounded-[28px] shadow-[0_30px_60px_-30px_rgba(150,35,35,0.55)] sm:rounded-[36px] lg:inset-x-8 lg:bottom-4 lg:top-4 lg:rounded-[44px] xl:inset-x-12 2xl:inset-x-20"
              : "relative h-[24dvh] min-h-[170px] rounded-[26px] shadow-[0_24px_60px_-32px_rgba(20,40,22,0.7)] ring-1 ring-black/5 transition-[height] duration-500 lg:h-auto lg:min-h-0",
          )}
        >
          {/* subtle festival glow */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#8f1f24]/35 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[46%] aspect-square h-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/25 bg-white/10 lg:left-[68%] lg:top-1/2 lg:h-[82%]" />
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/25 blur-3xl" />

          {/* Fest hero copy (large screens) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-[44%] flex-col justify-center pb-44 pl-[clamp(3rem,6vw,7rem)] pt-28 lg:flex">
            <h2 className="mt-0">
              <span className="sr-only">Funoon AI Assistant</span>
              <Image
                src="/img/hero/fest-typo.png"
                alt=""
                width={1400}
                height={796}
                priority
                className="h-auto w-[clamp(15rem,24vw,23rem)] [filter:drop-shadow(0.24rem_0.24rem_0_#A92A2B)]"
              />
            </h2>
            <p className="mt-5 max-w-[26rem] font-hero-sans text-[17px] leading-[1.45] text-white/95">
              Ask the host about live scores, results and programmes, in Malayalam or English, by voice.
            </p>
            <div className="pointer-events-auto mt-6 flex max-w-[34rem] flex-wrap gap-2.5 [@media(max-height:780px)]:hidden">
              {CHAT_SUGGESTIONS.slice(0, 3).map((item) => (
                <button
                  key={item.label}
                  onClick={() => sendText(item.text)}
                  disabled={isLoading || isListening}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 bg-white/15 px-4 py-2 font-hero-sans text-[13.5px] font-medium text-white backdrop-blur-md transition hover:bg-white hover:text-[#C72F36] disabled:pointer-events-none disabled:opacity-60"
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="absolute inset-0 z-10 lg:left-[36%]">
            <Ai3dHuman
              state={humanState}
              isSpeakingAudio={isSpeaking}
              isListeningMic={isListening}
              onAvatarClick={handleAvatarClick}
              className="absolute inset-0 z-10"
              showBadge={false}
              allowViewToggle
              defaultViewMode="portrait"
              fullScreen
            />
          </div>

          {/* Status pill */}
          <div className={cn(
            "pointer-events-none absolute left-3 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-md",
            activeTab === "character" ? "hidden" : "top-3",
          )}>
            {isListening || isSpeaking ? (
              <span className="flex h-3 items-end gap-[2px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn("w-[3px] origin-bottom rounded-full", isListening ? "bg-sky-300" : "bg-[#9ACB71]")}
                    style={{ height: "100%", animation: `host-eq 0.9s ${i * 0.12}s ease-in-out infinite` }}
                  />
                ))}
              </span>
            ) : (
              <span className={cn("h-2 w-2 rounded-full", statusDot, isLoading && "animate-pulse")} />
            )}
            {hostStatus}
          </div>

          {/* Live caption while the host speaks */}
          <AnimatePresence>
            {caption && showSubtitle && (isSpeaking || (activeTab === "character" && isLoading)) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className={cn(
                  "absolute inset-x-3 z-20 flex items-start gap-2 rounded-2xl border-2 border-white bg-white/95 p-2.5 pl-3.5 text-[#1E1B18] shadow-[0_5px_0_rgba(150,40,30,0.3)] sm:inset-x-4 lg:left-[46%] lg:right-10",
                  activeTab === "character" ? "bottom-[calc(12rem+env(safe-area-inset-bottom))] lg:bottom-9" : "bottom-3 sm:bottom-4",
                )}
              >
                <p aria-live="polite" className="line-clamp-2 flex-1 text-[13px] font-medium leading-relaxed sm:line-clamp-3 sm:text-sm">
                  {stripMarkdown(caption)}
                </p>
                <CaptionButton onClick={stopSpeaking} label="Stop speaking">
                  <Square size={12} fill="currentColor" />
                </CaptionButton>
                <CaptionButton onClick={() => setShowSubtitle(false)} label="Hide captions" subtle>
                  <Subtitles size={14} />
                </CaptionButton>
              </motion.div>
            )}
          </AnimatePresence>

          {isSpeaking && !showSubtitle && (
            <button
              onClick={() => setShowSubtitle(true)}
              className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border-2 border-white bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#C72F36] shadow-[0_3px_0_rgba(150,40,30,0.3)] hover:bg-white"
            >
              <Subtitles size={13} /> Show captions
            </button>
          )}

          {isChatMode && !isSpeaking && !isLoading && !isListening && (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 z-20 text-center text-[11px] text-white/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
              Tap the host to say hello · drag to turn
            </p>
          )}

          {activeTab === "character" && (
            <div className="absolute inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:inset-x-auto lg:bottom-9 lg:left-[clamp(3rem,6vw,7rem)] lg:justify-start lg:px-0">
              <div className="flex max-w-[min(88vw,26rem)] items-center gap-2.5 rounded-full border border-white/40 bg-[#7E1D22]/45 py-1.5 pl-1.5 pr-4 text-white shadow-[0_10px_24px_-14px_rgba(60,10,10,0.7)] backdrop-blur-md sm:gap-3 sm:pr-5">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading && !liveMode}
                  aria-label={isListening ? "Stop listening and send" : isLoading ? "The host is preparing an answer" : "Start speaking"}
                  aria-pressed={isListening || liveMode}
                  className={cn(
                    "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:translate-y-0.5 disabled:cursor-wait disabled:opacity-55 sm:h-12 sm:w-12",
                    isListening ? "bg-[#DB3C3F] text-white shadow-[0_4px_0_#8F1F24]" : "bg-[#FBFF00] text-[#141414] shadow-[0_4px_0_#A9462A] hover:brightness-95",
                  )}
                >
                  {isListening && <span className="absolute inset-0 animate-ping rounded-full bg-[#DB3C3F]/40" />}
                  <Mic size={20} className="relative" />
                </button>
                <div className="min-w-0" aria-live="polite">
                  <p className="text-[13px] font-bold sm:text-sm">
                    {isListening ? "Listening… speak now" : liveMode ? (isLoading ? "Preparing your answer…" : "Host is speaking…") : "Tap to speak"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-white/85 sm:text-[11px]">
                    {isListening ? "I answer when you pause · tap to send" : liveMode ? "Tap to interrupt" : "Ask your question in Malayalam"}
                  </p>
                  {isListening && input.trim() && (
                    <p className="mt-1 max-w-[60vw] truncate text-xs text-white/90">{input}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Conversation */}
        {activeTab === "chat" && (
        <section aria-label="Conversation" className="relative z-10 flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/95 shadow-[0_30px_70px_-40px_rgba(120,50,20,0.35)] backdrop-blur">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {!hasChatStarted ? (
              <div className="mx-auto flex min-h-full max-w-xl flex-col">
                <div className="my-auto py-4">
                  <div className="mb-6 rounded-3xl border border-black/[0.06] bg-[#F7F7F8] px-5 py-7 text-center sm:mb-7 sm:px-8 sm:py-9">
                    <h2 className="text-2xl font-semibold tracking-tight text-[#202124] sm:text-3xl">
                      How can I help?
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#66666B] sm:text-base">
                      Ask about Funoon Fiesta scores, results, programmes, or rules.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {CHAT_SUGGESTIONS.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => sendText(item.text)}
                        disabled={isLoading || isListening}
                        className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-[20px] border border-black/[0.06] bg-white p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#F0952A]/40 hover:shadow-[0_14px_30px_-18px_rgba(217,56,63,0.45)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 sm:flex-row sm:items-start sm:gap-3 sm:p-4"
                      >
                        <PremiumIcon icon={item.icon} tile={item.tile} />
                        <span className="min-w-0 flex-1 sm:pr-5">
                          <span className="block text-[13.5px] font-bold leading-tight text-[#1E1B18] sm:text-[14px]">{item.label}</span>
                          <span className="mt-1 hidden text-[12.5px] leading-snug text-[#857B73] sm:block">{item.text}</span>
                        </span>
                        <ArrowUpRight
                          size={16}
                          className="absolute right-3 top-3 text-[#C9BFB6] transition duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#E0522F]"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-5">
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.role === "assistant" && (
                      <BrandMark className="mt-0.5 h-8 w-8" small />
                    )}
                    <div className={cn("min-w-0 max-w-[86%] sm:max-w-[80%]", msg.role === "user" && "flex flex-col items-end")}>
                      <div
                        className={cn(
                          "text-[14px] leading-relaxed",
                          msg.role === "user"
                            ? "rounded-[20px] rounded-br-md bg-[linear-gradient(135deg,#D9383F,#EC7A2E)] px-4 py-2.5 text-white shadow-[0_10px_24px_-14px_rgba(217,56,63,0.7)]"
                            : "rounded-[20px] rounded-tl-md border border-black/[0.05] bg-[#FAF7F3] px-4 py-3 text-[#26211D]",
                        )}
                      >
                        {msg.role === "assistant" && msg.mode === "chat" ? (
                          <div className="break-words [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mb-1 [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_table]:my-2 [&_table]:w-full [&_table]:text-[13px] [&_td]:border-t [&_td]:border-black/5 [&_td]:py-1 [&_td]:pr-3 [&_th]:pr-3 [&_th]:text-left [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-[#D9383F] [&_strong]:text-[#1E1B18] [&_a]:underline">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-line break-words">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "assistant" && (
                        <div className="mt-0.5 flex items-center gap-0.5">
                          <MessageAction onClick={() => speakText(msg.content)} label="Read aloud">
                            <Volume2 size={13} />
                          </MessageAction>
                          <MessageAction onClick={() => handleCopyMessage(msg.content, index)} label={copiedIndex === index ? "Copied" : "Copy"}>
                            {copiedIndex === index ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </MessageAction>
                          {msg.mode === "character" && (
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-[#9AA094]">Spoken</span>
                          )}
                        </div>
                      )}
                      {msg.failed && index === chatMessages.length - 1 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-[#8A7468]">The assistant couldn't finish this reply.</span>
                          <button
                            type="button"
                            onClick={() => handleRetryMessage(index)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E6] px-2.5 py-1 text-[11px] font-semibold text-[#B4481B] transition hover:bg-[#FFE4CF] disabled:opacity-50"
                          >
                            <RotateCcw size={12} /> Retry answer
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isLoading && isAwaitingFirstToken && (
                  <div className="flex items-center gap-2.5" aria-label="The host is preparing an answer">
                    <BrandMark className="h-8 w-8" small />
                    <div className="flex items-center gap-2 rounded-[20px] rounded-tl-md border border-black/[0.05] bg-[#FAF7F3] px-4 py-3">
                      <span className="flex gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#E8742F]" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                      <span className="text-[12px] font-medium text-[#857B73]">Checking festival records…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 bg-gradient-to-t from-white via-white to-white/0 p-3 pt-2 sm:p-5 sm:pt-3">
            {voiceInputNotice && (
              <p role="status" className="mx-auto mb-2 w-fit rounded-full bg-[#FFF4E8] px-3 py-1 text-center text-xs font-medium text-[#B4481B]">
                {voiceInputNotice}
              </p>
            )}
            {voicePlaybackNotice && (
              <p role="status" className="mx-auto mb-2 max-w-2xl rounded-xl bg-[#FFF4E8] px-3 py-2 text-center text-xs font-medium text-[#8F471E]">
                {voicePlaybackNotice}
              </p>
            )}
            {isCharacterMode ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading && !liveMode}
                  aria-label={isListening ? "Stop listening and send" : isLoading ? "The host is preparing an answer" : "Start speaking"}
                  aria-pressed={isListening || liveMode}
                  className={cn(
                    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-md transition active:scale-95 disabled:cursor-wait disabled:opacity-55",
                    isListening ? "bg-sky-500 text-white shadow-sky-500/25" : "bg-[#70B040] text-white shadow-[#70B040]/25 hover:bg-[#5F9630]",
                  )}
                >
                  {isListening && <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/40" />}
                  <Mic size={23} className="relative" />
                </button>
                <div className="text-center" aria-live="polite">
                  <p className="text-[13px] font-bold text-[#35412F]">
                    {isListening ? "Listening… speak now" : liveMode ? (isLoading ? "Preparing your answer…" : "Host is speaking…") : "Tap to speak"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#838A7C]">
                    {isListening ? "I answer when you pause · tap to send" : liveMode ? "Tap to interrupt" : "Ask your question in Malayalam"}
                  </p>
                </div>
                {isListening && input.trim() && (
                  <p className="max-w-xl text-center text-xs text-[#687260]">{input}</p>
                )}
              </div>
            ) : (
              <>
                <form
                  onSubmit={handleComposerSubmit}
                  className="mx-auto flex max-w-2xl items-end gap-2 rounded-[22px] border border-black/[0.08] bg-white p-2 shadow-[0_12px_32px_-18px_rgba(120,50,20,0.35)] transition focus-within:border-[#F0952A]/60 focus-within:ring-4 focus-within:ring-[#F0952A]/12"
                >
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isLoading}
                    aria-label={isListening ? "Stop listening and send" : "Ask by voice"}
                    aria-pressed={isListening || liveMode}
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50",
                      isListening ? "bg-[#D9383F] text-white" : "bg-[#FFF1E6] text-[#D9531F] hover:bg-[#FFE4CF]",
                    )}
                  >
                    {isListening && <span className="absolute inset-0 animate-ping rounded-full bg-[#D9383F]/35" />}
                    <Mic size={18} strokeWidth={2.2} className="relative" />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    maxLength={1200}
                    disabled={isListening}
                    placeholder={isListening ? "Listening… tap the mic to send" : "Ask about scores, results, programs, or rules…"}
                    aria-label="Your question"
                    className="max-h-[140px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[16px] leading-6 text-[#1E1B18] outline-none placeholder:text-[#B3A99F]"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || isListening || !input.trim()}
                    aria-label="Send"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FBFF00] text-[#141414] shadow-[0_3px_0_#A9462A] transition hover:brightness-95 active:translate-y-0.5 disabled:bg-none disabled:bg-[#F1ECE7] disabled:text-[#C2B8AE] disabled:shadow-none"
                  >
                    <ArrowUp size={18} strokeWidth={2.6} />
                  </button>
                </form>
                <p className="mx-auto mt-2.5 hidden max-w-2xl text-center text-[11px] text-[#ADA399] sm:block">
                  Detailed written answers · Enter to send, Shift + Enter for a new line
                </p>
              </>
            )}
          </div>
        </section>
        )}
      </main>
    </div>
  );
}

/* ── Small presentational helpers ───────────────────────────────── */

function stripMarkdown(text: string) {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  stretch,
  dark,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  stretch?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition",
        stretch && "flex-1",
        active
          ? "bg-white text-[#C72F36] shadow-[0_2px_0_rgba(150,40,30,0.3)]"
          : dark ? "text-white/90 hover:text-white" : "text-[#8A7F76] hover:text-[#C2521F]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  children,
  dark,
}: {
  dark?: boolean;
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-95",
        dark ? "border-white/35 bg-white/20 text-white backdrop-blur-md hover:bg-white/30" : active ? "border-[#F0952A]/30 bg-[#FFF1E6] text-[#D9531F]" : "border-black/[0.07] bg-white text-[#7A716A] hover:bg-[#FBF6F1] hover:text-[#1E1B18]",
      )}
    >
      {children}
    </button>
  );
}

function CaptionButton({
  onClick,
  children,
  label,
  subtle,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-95",
        subtle ? "text-[#8A7F76] hover:bg-black/5 hover:text-[#1E1B18]" : "bg-[#FBFF00] text-[#141414] shadow-[0_2px_0_#A9462A] hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}

function MessageAction({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A1968C] transition hover:bg-[#FFF1E6] hover:text-[#D9531F]"
    >
      {children}
    </button>
  );
}

/** Funoon Fiesta mark on a white disc with a brand-gradient ring. */
function BrandMark({ className, small, glow }: { className?: string; small?: boolean; glow?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#D9383F,#F0952A,#8CC63F)] p-[2px]",
        glow && "shadow-[0_14px_30px_-12px_rgba(217,56,63,0.55)]",
        className,
      )}
    >
      <span className="flex h-full w-full items-center justify-center rounded-full bg-white">
        <Image
          src="/img/brand-logo-transparent.png"
          alt=""
          width={64}
          height={64}
          className={cn("h-auto object-contain", small ? "w-[72%]" : "w-[70%]")}
        />
      </span>
    </span>
  );
}

/** Glossy app-style icon tile: gradient fill, inner highlight and a coloured soft shadow. */
function PremiumIcon({ icon: Icon, tile }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; tile: string }) {
  return (
    <span
      className={cn(
        "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 transition duration-200 group-hover:scale-105 sm:h-12 sm:w-12",
        tile,
      )}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
      <Icon size={21} strokeWidth={2.1} className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
    </span>
  );
}
