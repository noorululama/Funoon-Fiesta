"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
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

// 44-byte silent clip used to unlock audio playback on phones after the first tap.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

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
  const [activeTab, setActiveTab] = useState<AIMode>(SHOW_3D_CHATBOT ? "character" : "chat");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoadingState] = useState(false);
  const setIsLoading = (value: boolean) => {
    isLoadingRef.current = value;
    setIsLoadingState(value);
  };
  const [humanState, setHumanState] = useState<HumanState>("idle");
  const isLoadingRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceInputNotice, setVoiceInputNotice] = useState<string | null>(null);
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
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Pre-load and monitor available browser speech synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setAvailableVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  /* ── Male host voice ─────────────────────────────────────────────
     Primary: a server-side neural MALE voice (/api/tts), so every device
     (iPhone, Android, Windows, Mac) hears the same host.
     Fallback: the best male voice the browser itself offers. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const speechEpochRef = useRef(0);
  const ttsQueueRef = useRef<{ text: string; isMl: boolean; epoch: number; promise: Promise<string> }[]>([]);
  const ttsPlayingRef = useRef(false);
  const ttsDownUntilRef = useRef(0);
  const fallbackSpeakRef = useRef<(text: string, isMl: boolean) => void>(() => {});

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
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
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

      const useBrowserVoice = () => {
        // Server voice unavailable: pause it for a minute and let the browser voice finish the queue.
        ttsDownUntilRef.current = Date.now() + 60_000;
        const rest = ttsQueueRef.current.splice(0);
        ttsPlayingRef.current = false;
        [item, ...rest].forEach((q) => fallbackSpeakRef.current(q.text, q.isMl));
      };

      let url: string;
      try {
        url = await item.promise;
      } catch {
        if (item.epoch === speechEpochRef.current) useBrowserVoice();
        return;
      }
      if (item.epoch !== speechEpochRef.current) {
        URL.revokeObjectURL(url);
        return;
      }

      const audio = getAudio();
      if (!audio) {
        URL.revokeObjectURL(url);
        useBrowserVoice();
        return;
      }
      const done = () => {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        if (item.epoch === speechEpochRef.current) void run();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.src = url;
      try {
        await audio.play();
        setIsSpeaking(true);
        setHumanState("speaking");
      } catch {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        if (item.epoch === speechEpochRef.current) useBrowserVoice();
      }
    },
    [getAudio],
  );

  const enqueueServerSpeech = useCallback(
    (text: string, isMl: boolean) => {
      // Requests start immediately, so the next sentence is already downloaded when the current one ends.
      const promise = fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("tts failed");
          return r.blob();
        })
        .then((b) => URL.createObjectURL(b));
      promise.catch(() => {});
      ttsQueueRef.current.push({ text, isMl, epoch: speechEpochRef.current, promise });
      if (!ttsPlayingRef.current) void playNext();
    },
    [playNext],
  );

  // Browser voice (fallback), always preferring a male voice.
  const speakWithBrowserVoice = useCallback(
    (cleanText: string, isMalayalamSpeech: boolean) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const currentVoices =
        window.speechSynthesis.getVoices().length > 0 ? window.speechSynthesis.getVoices() : availableVoices;
      const MALE = ["midhun", "prabhat", "rishi", "ravi", "hemant", "rahul", "madhur", "david", "mark", "james", "guy", "alex", "daniel", "male", " man"];
      const isMale = (v: SpeechSynthesisVoice) => {
        const n = v.name.toLowerCase();
        return MALE.some((m) => n.includes(m));
      };

      if (isMalayalamSpeech) {
        const ml = currentVoices.filter((v) => v.lang.toLowerCase().startsWith("ml") || v.name.toLowerCase().includes("malayalam"));
        const selectedVoice = ml.find(isMale) ?? ml[0];
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang || "ml-IN";
          utterance.rate = 1.0;
          utterance.pitch = 0.8;
        } else {
          // No Malayalam voice on this device: use a male Indian voice (never force ml-IN, Chromium would abort).
          const indian = currentVoices.filter((v) => v.lang.includes("IN") || v.name.includes("India"));
          const voice = indian.find(isMale) ?? currentVoices.find(isMale) ?? indian[0] ?? currentVoices[0];
          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
          }
          utterance.rate = 1.02;
          utterance.pitch = 0.75;
        }
      } else {
        utterance.rate = 1.05;
        utterance.pitch = 0.8;
        const en = currentVoices.filter((v) => v.lang.includes("en-IN") || v.name.includes("India") || v.lang.includes("en-US") || v.lang.includes("en-GB"));
        const voice = en.find(isMale) ?? currentVoices.find(isMale) ?? en[0] ?? currentVoices[0];
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "en-IN";
        }
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setHumanState("speaking");
      };
      utterance.onend = () => {
        if (typeof window !== "undefined" && !window.speechSynthesis.speaking) {
          setIsSpeaking(false);
          setHumanState(isLoadingRef.current ? "thinking" : "idle");
        }
      };
      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis utterance error:", e);
        if (typeof window !== "undefined" && !window.speechSynthesis.speaking) {
          setIsSpeaking(false);
          setHumanState("idle");
        }
      };
      window.speechSynthesis.speak(utterance);
    },
    [availableVoices],
  );
  fallbackSpeakRef.current = speakWithBrowserVoice;

  // Text-to-speech: male voice, sentence by sentence
  const speakText = useCallback(
    (text: string, forceMalayalam = false, shouldCancel = true): boolean => {
      if (!voiceEnabled || typeof window === "undefined") return false;

      // Clean formatting, symbols, and punctuation for natural, clear spoken Malayalam
      const cleanText = text
        .replace(/[*_#`~>]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/\|.*?\|/g, " ")
        .replace(/[•●▪-]\s+/g, "")
        .replace(/&/g, " കൂടാതെ ")
        .replace(/%/g, " ശതമാനം ")
        .replace(/\//g, " അല്ലെങ്കിൽ ")
        .replace(/:\s*/g, ", ")
        .replace(/\n+/g, ". ")
        .trim();
      if (!cleanText) return false;

      const isMl = forceMalayalam || activeTab === "character" || /[ഀ-ൿ]/.test(cleanText);
      if (shouldCancel) cancelAllSpeech();

      const chunks = splitForSpeech(cleanText);
      if (typeof Audio !== "undefined" && Date.now() > ttsDownUntilRef.current) {
        chunks.forEach((c) => enqueueServerSpeech(c, isMl));
        return true;
      }
      if (!("speechSynthesis" in window)) return false;
      chunks.forEach((c) => speakWithBrowserVoice(c, isMl));
      return true;
    },
    [voiceEnabled, activeTab, cancelAllSpeech, enqueueServerSpeech, speakWithBrowserVoice],
  );

  const stopSpeaking = () => {
    cancelAllSpeech();
    setIsSpeaking(false);
    setHumanState("idle");
  };

  // Web Speech API: Listening to User
  // In Character mode: Listens strictly in Malayalam (ml-IN)
  // In Chat mode: Listens in English/multilingual (en-US)
  const toggleListening = () => {
    unlockAudio();
    if (isLoading) return;

    if (isListening) {
      // User tapped "Tap to Send" early: send immediately without waiting for browser silence!
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      const textToSend = currentTranscriptRef.current.trim();
      currentTranscriptRef.current = "";
      if (textToSend) {
        if (activeTab === "character") {
          handleSendCharacterQuery(textToSend);
        } else {
          handleSendMessage(textToSend);
        }
      } else {
        setHumanState("idle");
      }
      return;
    }

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceInputNotice("Speech recognition isn't supported in this browser. Try another browser with microphone support.");
      return;
    }

    setVoiceInputNotice(null);

    // Stop active speech before listening
    stopSpeaking();
    currentTranscriptRef.current = "";
    if (activeTab === "character") setInput("");

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // Character mode listens in Malayalam; Chat mode listens in en-US
      recognition.lang = activeTab === "character" ? "ml-IN" : "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setHumanState("listening");
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        currentTranscriptRef.current = transcript;

        setInput(transcript);

        // If browser marks as isFinal, send immediately
        if (event.results[current].isFinal) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          setIsListening(false);
          const textToSend = transcript.trim();
          currentTranscriptRef.current = "";
          if (textToSend) {
            if (activeTab === "character") {
              handleSendCharacterQuery(textToSend);
            } else {
              handleSendMessage(textToSend);
            }
          } else {
            setHumanState("idle");
          }
          return;
        }

        // Fast silence detection: If user pauses for 0.8s after speaking, auto-send without waiting 3-4s!
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const textToSend = currentTranscriptRef.current.trim();
          if (textToSend) {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch {}
            }
            setIsListening(false);
            currentTranscriptRef.current = "";
            if (activeTab === "character") {
              handleSendCharacterQuery(textToSend);
            } else {
              handleSendMessage(textToSend);
            }
          }
        }, 800);
      };

      recognition.onerror = (event: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsListening(false);
        setHumanState("idle");
        setVoiceInputNotice(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Allow microphone access in your browser settings, then tap the microphone to try again."
            : event.error === "no-speech"
            ? "I didn't hear speech. Tap the microphone and try again."
            : "Voice input isn't available right now. Try again."
        );
      };

      recognition.onend = () => {
        setIsListening(false);
        setHumanState((current) => current === "listening" ? "idle" : current);
      };

      recognition.start();
    } catch (e) {
      console.error("Speech recognition error:", e);
      setIsListening(false);
      setHumanState("idle");
      setVoiceInputNotice("Couldn't start the microphone. Check its permission and try again.");
    }
  };

  // Character query handler (pure voice/spoken dialogue mode with SPOT REPLY)
  const handleSendCharacterQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setVoiceInputNotice(null);
    stopSpeaking();
    setCharacterUserQuery(trimmed);
    setChatMessages((prev) => [...prev, { role: "user", content: trimmed, mode: "character" }]);
    const reply = (content: string) =>
      setChatMessages((prev) => [...prev, { role: "assistant", content, mode: "character" }]);

    // 1. Instant Intent Check: 0ms Spot Reply for greetings and common queries
    for (const item of INSTANT_INTENTS) {
      if (item.regex.test(trimmed)) {
        setCharacterResponse(item.reply);
        reply(item.reply);
        setShowSubtitle(true);
        if (!speakText(item.reply, true, true)) setHumanState("idle");
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setHumanState("thinking");
    setCharacterResponse(null);
    setShowSubtitle(true);
    let streamedText = "";
    let queuedSpeech = false;
    let gotAnswer = false;
    // If the answer is not here after ~0.9s, say a short acknowledgement so the host never feels frozen.
    const fillerTimer = setTimeout(() => {
      if (!gotAnswer) speakText(SPOT_REFLEXES[Math.floor(Math.random() * SPOT_REFLEXES.length)], true, false);
    }, 1100);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, mode: "character" }),
      });

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
              if (speakText(early[1].trim(), true, false)) queuedSpeech = true;
            }
          }
          while ((match = speechBuffer.match(/^([\s\S]*?[.!?।])\s+/))) {
            const sentence = match[1].trim();
            speechBuffer = speechBuffer.slice(match[0].length);
            if (sentence && speakText(sentence, true, false)) queuedSpeech = true;
          }
          if (flush && speechBuffer.trim()) {
            if (speakText(speechBuffer.trim(), true, false)) queuedSpeech = true;
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
      if (!queuedSpeech && !speakText(streamedText, true, false)) setHumanState("idle");
    } catch (err) {
      console.error("Error in handleSendCharacterQuery:", err);
      const errMsg = streamedText.trim()
        ? "ക്ഷമിക്കണം, മറുപടി പൂർത്തിയാകുന്നതിന് മുമ്പ് ബന്ധം നഷ്ടപ്പെട്ടു. വീണ്ടും ചോദിക്കൂ."
        : "ക്ഷമിക്കണം, താൽക്കാലികമായി കണക്ട് ചെയ്യാൻ സാധിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.";
      const finalText = streamedText.trim() ? `${streamedText.trim()} ${errMsg}` : errMsg;
      setCharacterResponse(finalText);
      reply(finalText);
      setShowSubtitle(true);
      if (!speakText(errMsg, true, false)) setHumanState("idle");
    } finally {
      clearTimeout(fillerTimer);
      setIsLoading(false);
    }
  };

  // Chat section query handler (streams the answer, speaks sentence by sentence)
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setVoiceInputNotice(null);
    stopSpeaking();
    const userMessage = text.trim();
    setInput("");

    setChatMessages((prev) => [...prev, { role: "user", content: userMessage, mode: "chat" }]);
    setIsLoading(true);
    setHumanState("thinking");

    let answer = "";
    let shown = false;
    let queuedSpeech = false;
    let speechBuffer = "";
    const speakReady = (flush = false) => {
      let match: RegExpMatchArray | null;
      while ((match = speechBuffer.match(/^([\s\S]*?(?:[.!?।]\s|\n))/))) {
        const sentence = match[1].trim();
        speechBuffer = speechBuffer.slice(match[0].length);
        if (sentence && speakText(sentence, false, false)) queuedSpeech = true;
      }
      if (flush && speechBuffer.trim()) {
        if (speakText(speechBuffer.trim(), false, false)) queuedSpeech = true;
        speechBuffer = "";
      }
    };
    const showAnswer = () => {
      setChatMessages((prev) => {
        if (!shown) return [...prev, { role: "assistant", content: answer, mode: "chat" }];
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: answer };
        return copy;
      });
      shown = true;
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, mode: "chat" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "The assistant could not answer right now.");
      }

      if ((response.headers.get("content-type") ?? "").includes("application/json")) {
        const data = await response.json();
        if (data.error) throw new Error(data.error);
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
          answer += part;
          speechBuffer += part;
          showAnswer();
          setIsLoading(false); // first words are on screen: hide the typing dots
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
    } catch {
      const failure = "Sorry, I encountered a temporary connection issue. Please try again.";
      if (shown) {
        answer = `${answer.trim()}\n\n${failure}`;
        showAnswer();
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: failure, mode: "chat" }]);
      }
      setHumanState("idle");
    } finally {
      setIsLoading(false);
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

  const handleResetChat = () => {
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
      if (!speakText(greeting, true)) setHumanState("idle");
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
    if (!question || isLoading) return;
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
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/45 bg-white/20 px-3.5 py-1.5 font-hero-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
              <Sparkles size={13} className="text-[#FBFF00]" />
              Official festival assistant
            </span>
            <h2 className="mt-5">
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
              <div className="flex max-w-[min(88vw,26rem)] items-center gap-2.5 rounded-full border border-white/45 bg-white/15 py-1.5 pl-1.5 pr-4 text-white shadow-[0_10px_24px_-14px_rgba(120,25,25,0.55)] backdrop-blur-md sm:gap-3 sm:pr-5">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading}
                  aria-label={isListening ? "Stop listening and send" : isLoading ? "The host is preparing an answer" : "Start speaking"}
                  aria-pressed={isListening}
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
                    {isListening ? "Listening… speak now" : isLoading ? "Preparing your answer…" : "Tap the microphone to speak"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-white/85 sm:text-[11px]">
                    {isListening ? "Pause or tap the microphone to send" : "Ask in Malayalam; the host replies aloud"}
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
                <div className="my-auto py-1">
                <div className="relative mb-5 overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#F0A220_0%,#EC8230_30%,#E4602F_62%,#DB3C3F_100%)] px-5 py-7 text-center text-white shadow-[0_18px_36px_-22px_rgba(190,50,40,0.7)] sm:mb-7 sm:px-8 sm:py-9">
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
                  <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
                  <div className="relative flex flex-col items-center">
                    <BrandMark className="h-14 w-14 sm:h-16 sm:w-16" glow />
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-white/20 px-3 py-1 font-hero-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                      <Sparkles size={12} className="text-[#FBFF00]" />
                      Official festival assistant
                    </span>
                    <h2 className="mt-3">
                      <span className="sr-only">Ask anything about Funoon Fiesta</span>
                      <Image
                        src="/img/hero/fest-typo.png"
                        alt=""
                        width={1400}
                        height={796}
                        className="h-auto w-[min(72%,15rem)] [filter:drop-shadow(0.2rem_0.2rem_0_#A92A2B)]"
                      />
                    </h2>
                    <p className="mt-3 max-w-md font-hero-sans text-[14px] leading-relaxed text-white/95 sm:text-[15px]">
                      {isCharacterMode
                        ? "Tap the microphone and ask in Malayalam. The host will answer aloud."
                        : "Scores, results, programs and rules, answered instantly in English or Malayalam."}
                    </p>
                  </div>
                </div>
                {isCharacterMode ? (
                  <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-[#70B040]/15 bg-[#70B040]/[0.06] px-4 py-3 text-center">
                    <Mic size={18} className="shrink-0 text-[#4E8732]" aria-hidden="true" />
                    <p className="text-[13px] font-medium leading-relaxed text-[#53614C]">
                      Tap the microphone below and speak naturally. Pause when you finish to send your question.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {CHAT_SUGGESTIONS.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => sendText(item.text)}
                        disabled={isLoading || isListening}
                        className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-[20px] border border-black/[0.06] bg-white p-3 text-left sm:flex-row sm:gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#F0952A]/40 hover:shadow-[0_14px_30px_-18px_rgba(217,56,63,0.45)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 sm:items-start sm:p-4"
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
                )}
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
                          <MessageAction onClick={() => speakText(msg.content, msg.mode === "character")} label="Read aloud">
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
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
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
            {isCharacterMode ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading}
                  aria-label={isListening ? "Stop listening and send" : isLoading ? "The host is preparing an answer" : "Start speaking"}
                  aria-pressed={isListening}
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
                    {isListening ? "Listening… speak now" : isLoading ? "Preparing your answer…" : "Tap the microphone to speak"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#838A7C]">
                    {isListening ? "Pause or tap the microphone to send" : "Ask in Malayalam; the host replies aloud"}
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
                    aria-pressed={isListening}
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
                    disabled={isListening}
                    placeholder={isListening ? "Listening… tap the mic to send" : "Ask about scores, results…"}
                    aria-label="Your question"
                    className="max-h-[140px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-[#1E1B18] outline-none placeholder:text-[#B3A99F]"
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
