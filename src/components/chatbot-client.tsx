"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Calendar,
  Search,
  TrendingUp,
  ArrowUp,
  RotateCcw,
  Copy,
  Check,
  Radio,
  MessageSquare,
  Square,
  Subtitles,
  Bot,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Ai3dHuman, type HumanState } from "@/components/ai-3d-human";

type AIMode = "chat" | "character";

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
    color: "from-amber-500/15 to-orange-500/10 text-amber-700",
  },
  {
    icon: Search,
    text: "Summarize the latest published results.",
    label: "Latest Results",
    color: "from-emerald-500/15 to-green-500/10 text-emerald-700",
  },
  {
    icon: Calendar,
    text: "What are the events and programs in Funoon Fiesta?",
    label: "Events & Programs",
    color: "from-blue-500/15 to-cyan-500/10 text-blue-700",
  },
  {
    icon: TrendingUp,
    text: "How does the grade and point scoring system work?",
    label: "Point Rules",
    color: "from-purple-500/15 to-indigo-500/10 text-purple-700",
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
  const [isLoading, setIsLoading] = useState(false);
  const [humanState, setHumanState] = useState<HumanState>("idle");
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

  // Text-to-speech with crystal-clear Malayalam male voice tuning
  const speakText = useCallback(
    (text: string, forceMalayalam = false, shouldCancel = true): boolean => {
      if (
        !voiceEnabled ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        return false;
      }

      if (shouldCancel) {
        window.speechSynthesis.cancel();
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

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

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Check if text contains Malayalam characters or character mode is active
      const hasMalayalamChar = /[\u0D00-\u0D7F]/.test(cleanText);
      const isMalayalamSpeech = forceMalayalam || activeTab === "character" || hasMalayalamChar;

      const currentVoices =
        window.speechSynthesis.getVoices().length > 0
          ? window.speechSynthesis.getVoices()
          : availableVoices;

      if (isMalayalamSpeech) {
        // 1. High priority: Native Malayalam Male Voice (e.g., Microsoft Midhun Online Natural in Edge/Windows)
        let selectedVoice = currentVoices.find((v) => {
          const isMl = v.lang.toLowerCase().startsWith("ml") || v.name.toLowerCase().includes("malayalam");
          const n = v.name.toLowerCase();
          return isMl && (n.includes("midhun") || n.includes("male") || n.includes("man"));
        });

        // 2. Secondary priority: Any native Malayalam voice (e.g., Google മലയാളം, Microsoft Sobhana)
        if (!selectedVoice) {
          selectedVoice = currentVoices.find((v) => {
            return v.lang.toLowerCase().startsWith("ml") || v.name.toLowerCase().includes("malayalam");
          });
        }

        // If a native Malayalam voice is installed, use it with ml-IN
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang || "ml-IN";
          utterance.rate = 0.90;
          utterance.pitch = 0.88;
        } else {
          // Fallback: If no Malayalam voice exists on this OS/device, use Indian voice with its own matching language
          // IMPORTANT: Do NOT set utterance.lang = "ml-IN" here, because Chromium aborts with language-unavailable error!
          const indianVoice = currentVoices.find((v) => {
            const isIndian = v.lang.includes("IN") || v.name.includes("India");
            const n = v.name.toLowerCase();
            return isIndian && (n.includes("rahul") || n.includes("madhur") || n.includes("hemant") || n.includes("prabhat") || n.includes("male"));
          }) || currentVoices.find((v) => v.lang.includes("IN") || v.name.includes("India") || v.lang.includes("en-US")) || currentVoices[0];

          if (indianVoice) {
            utterance.voice = indianVoice;
            utterance.lang = indianVoice.lang;
          }
          utterance.rate = 0.95;
          utterance.pitch = 0.92;
        }
      } else {
        // English voice selection with male preference
        utterance.rate = 0.96;
        utterance.pitch = 0.90;

        const enVoice = currentVoices.find((v) => {
          const isEn = v.lang.includes("en-IN") || v.name.includes("India") || v.lang.includes("en-US");
          const n = v.name.toLowerCase();
          return isEn && (n.includes("rahul") || n.includes("prabhat") || n.includes("david") || n.includes("male"));
        }) || currentVoices.find((v) => v.lang.includes("en-IN") || v.name.includes("India") || v.lang.includes("en-US")) || currentVoices[0];

        if (enVoice) {
          utterance.voice = enVoice;
          utterance.lang = enVoice.lang;
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
          setHumanState("idle");
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
      return true;
    },
    [voiceEnabled, activeTab, availableVoices]
  );

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setHumanState("idle");
  };

  // Web Speech API: Listening to User
  // In Character mode: Listens strictly in Malayalam (ml-IN)
  // In Chat mode: Listens in English/multilingual (en-US)
  const toggleListening = () => {
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

        // Fast silence detection: If user pauses for 1.2s after speaking, auto-send without waiting 3-4s!
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
        }, 1200);
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
        streamedText = String(data.response ?? "");
        setCharacterResponse(streamedText);
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("The host response stream is unavailable.");

        const decoder = new TextDecoder();
        let speechBuffer = "";
        const speakCompletedSentences = (flush = false) => {
          let match: RegExpMatchArray | null;
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
      setIsLoading(false);
    }
  };

  // Chat section query handler
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setVoiceInputNotice(null);
    stopSpeaking();
    const userMessage = text.trim();
    setInput("");

    setChatMessages((prev) => [...prev, { role: "user", content: userMessage, mode: "chat" }]);
    setIsLoading(true);
    setHumanState("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, mode: "chat" }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, mode: "chat" },
      ]);
      if (!speakText(data.response)) setHumanState("idle");
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered a temporary connection issue. Please try again.", mode: "chat" },
      ]);
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
    if (!isSpeaking && !isLoading) {
      const greeting = "അസ്സലാമു അലൈക്കും! ഞാൻ ഫുനൂൻ ഫിയസ്റ്റയുടെ 3D ലൈവ് എഐ അവതാരകനാണ്. മത്സര ഫലങ്ങൾ, ടീം സ്കോറുകൾ, പരിപാടികൾ എന്നിവയെക്കുറിച്ച് എന്നോട് സംസാരിക്കാം!";
      setCharacterResponse(greeting);
      if (!speakText(greeting, true)) setHumanState("idle");
    }
  };

  /** One composer for both modes: the active mode decides how the host answers. */
  const sendText = (text: string) => {
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
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#F6F5EF] font-sans text-[#20251D]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className={cn(
        "z-40 shrink-0 border-b border-black/5 bg-white/85 backdrop-blur-xl",
        activeTab === "character" && "absolute inset-x-0 top-0 border-transparent bg-white/75",
      )}>
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 py-3 pl-4 pr-16 sm:pl-5 md:pr-20 lg:pl-28">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#70B040] to-[#397D27] text-white shadow-md shadow-green-900/15">
              <Bot size={22} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-extrabold tracking-tight sm:text-base">Funoon AI Host</h1>
              <p className="flex items-center gap-1.5 text-[11px] text-[#6F766A]">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot, (isListening || isSpeaking || isLoading) && "animate-pulse")} />
                <span className="truncate" role="status" aria-live="polite">{hostStatus}</span>
              </p>
            </div>
          </div>

          {/* Mode switch */}
          <div role="tablist" aria-label="Answer style" className="hidden items-center rounded-xl border border-black/5 bg-[#F1F3EC] p-1 sm:flex">
            <ModeButton active={activeTab === "character"} onClick={() => switchMode("character")} icon={<Radio size={15} />} label="Talk to host" />
            <ModeButton active={activeTab === "chat"} onClick={() => switchMode("chat")} icon={<MessageSquare size={15} />} label="Text chat" />
          </div>

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
              <IconToggle active={false} onClick={handleResetChat} label="Start a new conversation">
                <RotateCcw size={16} />
              </IconToggle>
            )}
          </div>
        </div>

        {/* Mode switch – mobile */}
        <div className="px-4 pb-3 sm:hidden">
          <div role="tablist" aria-label="Answer style" className="flex items-center rounded-xl border border-black/5 bg-[#F1F3EC] p-1">
            <ModeButton active={activeTab === "character"} onClick={() => switchMode("character")} icon={<Radio size={15} />} label="Talk to host" stretch />
            <ModeButton active={activeTab === "chat"} onClick={() => switchMode("chat")} icon={<MessageSquare size={15} />} label="Text chat" stretch />
          </div>
        </div>
      </header>

      {/* ── Body: host stage + conversation ─────────────────────── */}
      <main className={cn(
        "relative grid min-h-0 w-full flex-1",
        activeTab === "character"
          ? "mx-0 max-w-none grid-cols-1 grid-rows-1 gap-0 p-0"
          : "mx-auto max-w-[1500px] grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:gap-4 sm:p-4 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-1 lg:gap-5 lg:p-5 lg:pl-28",
      )}>
        {/* Host stage */}
        <section
          aria-label="3D festival host"
          className={cn(
            "overflow-hidden bg-[radial-gradient(ellipse_at_50%_25%,#2c4a30_0%,#152018_55%,#0e1510_100%)]",
            activeTab === "character"
              ? "fixed inset-0 z-0 h-[100dvh] w-screen rounded-none"
              : "relative h-[24dvh] min-h-[170px] rounded-[26px] shadow-[0_24px_60px_-32px_rgba(20,40,22,0.7)] ring-1 ring-black/5 transition-[height] duration-500 lg:h-auto lg:min-h-0",
          )}
        >
          {/* subtle festival glow */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#D6B35A]/15 blur-3xl" />

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

          {/* Status pill */}
          <div className={cn(
            "pointer-events-none absolute left-3 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-md",
            activeTab === "character" ? "top-[calc(6.75rem+env(safe-area-inset-top))] sm:top-20" : "top-3",
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
                  "absolute inset-x-3 z-20 flex items-start gap-2 rounded-2xl border border-white/10 bg-black/50 p-2.5 pl-3.5 text-white backdrop-blur-md sm:inset-x-4",
                  activeTab === "character" ? "bottom-[calc(8.5rem+env(safe-area-inset-bottom))]" : "bottom-3 sm:bottom-4",
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
              className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-md hover:bg-black/50"
            >
              <Subtitles size={13} /> Show captions
            </button>
          )}

          {activeTab === "chat" && !isSpeaking && !isLoading && !isListening && (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 z-20 text-center text-[11px] text-white/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
              Tap the host to say hello · drag to turn
            </p>
          )}

          {activeTab === "character" && (
            <div className="absolute inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
              <div className="flex max-w-[min(92vw,34rem)] items-center gap-3 rounded-full border border-white/15 bg-black/40 py-2.5 pl-2.5 pr-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:gap-4 sm:py-3 sm:pl-3 sm:pr-6">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading}
                  aria-label={isListening ? "Stop listening and send" : isLoading ? "The host is preparing an answer" : "Start speaking"}
                  aria-pressed={isListening}
                  className={cn(
                    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-md transition active:scale-95 disabled:cursor-wait disabled:opacity-55 sm:h-16 sm:w-16",
                    isListening ? "bg-sky-500 text-white shadow-sky-500/25" : "bg-[#70B040] text-white shadow-[#70B040]/25 hover:bg-[#5F9630]",
                  )}
                >
                  {isListening && <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/40" />}
                  <Mic size={24} className="relative" />
                </button>
                <div className="min-w-0" aria-live="polite">
                  <p className="text-sm font-bold sm:text-base">
                    {isListening ? "Listening… speak now" : isLoading ? "Preparing your answer…" : "Tap the microphone to speak"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/70 sm:text-xs">
                    {isListening ? "Pause or tap the microphone to send" : "Ask in Malayalam; the host replies aloud"}
                  </p>
                  {isListening && input.trim() && (
                    <p className="mt-1 max-w-[60vw] truncate text-xs text-white/85">{input}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Conversation */}
        {activeTab === "chat" && (
        <section aria-label="Conversation" className="flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-[0_18px_50px_-36px_rgba(0,0,0,0.35)]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {!hasChatStarted ? (
              <div className="mx-auto flex min-h-full max-w-xl flex-col">
                <div className="my-auto py-1">
                <div className="mb-4 text-center sm:mb-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#70B040]/10 px-3 py-1 text-[11px] font-bold text-[#4E8732]">
                    <Sparkles size={12} /> Official festival assistant
                  </span>
                  <h2 className="mt-3 text-lg font-black tracking-tight sm:text-2xl">
                    {activeTab === "character" ? "Talk with the 3D host" : "Ask anything about Funoon Fiesta"}
                  </h2>
                  <p className="mt-1.5 hidden text-[13px] leading-relaxed text-[#6A7065] sm:block">
                    {activeTab === "character"
                      ? "Tap the microphone and ask in Malayalam. The host will answer aloud."
                      : "Get detailed written answers about scores, results and programs, in English or Malayalam."}
                  </p>
                </div>
                {activeTab === "character" ? (
                  <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-[#70B040]/15 bg-[#70B040]/[0.06] px-4 py-3 text-center">
                    <Mic size={18} className="shrink-0 text-[#4E8732]" aria-hidden="true" />
                    <p className="text-[13px] font-medium leading-relaxed text-[#53614C]">
                      Tap the microphone below and speak naturally. Pause when you finish to send your question.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {CHAT_SUGGESTIONS.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => sendText(item.text)}
                        disabled={isLoading || isListening}
                        className="group flex items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-[#FAFAF7] p-2.5 text-left sm:items-start sm:gap-3 sm:p-3 transition hover:border-[#70B040]/50 hover:bg-white hover:shadow-sm active:scale-[0.99] disabled:opacity-60"
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", item.color)}>
                          <item.icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-bold leading-tight sm:text-[13px]">{item.label}</span>
                          <span className="mt-0.5 hidden text-[12px] leading-snug text-[#767C71] sm:block">{item.text}</span>
                        </span>
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
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#70B040] to-[#397D27] text-white">
                        <Bot size={15} />
                      </span>
                    )}
                    <div className={cn("min-w-0 max-w-[86%] sm:max-w-[80%]", msg.role === "user" && "flex flex-col items-end")}>
                      <div
                        className={cn(
                          "text-[14px] leading-relaxed",
                          msg.role === "user"
                            ? "rounded-2xl rounded-br-md bg-[#2E4A26] px-4 py-2.5 text-white"
                            : "rounded-2xl rounded-tl-md bg-[#F3F5EF] px-4 py-3 text-[#1F241C]",
                        )}
                      >
                        {msg.role === "assistant" && msg.mode === "chat" ? (
                          <div className="break-words [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mb-1 [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_table]:my-2 [&_table]:w-full [&_table]:text-[13px] [&_td]:border-t [&_td]:border-black/5 [&_td]:py-1 [&_td]:pr-3 [&_th]:pr-3 [&_th]:text-left [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-[#4E8732] [&_a]:underline">
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
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#70B040] to-[#397D27] text-white">
                      <Bot size={15} />
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-[#F3F5EF] px-4 py-3">
                      <span className="flex gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#70B040]" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                      <span className="text-[12px] font-medium text-[#6A7065]">Checking festival records…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-black/5 bg-white p-3 sm:p-4">
            {voiceInputNotice && (
              <p role="status" className="mb-2 text-center text-xs font-medium text-amber-700">
                {voiceInputNotice}
              </p>
            )}
            {activeTab === "character" ? (
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
                  className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-black/10 bg-[#FAFAF7] p-1.5 transition focus-within:border-[#70B040] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#70B040]/10"
                >
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isLoading}
                    aria-label={isListening ? "Stop listening and send" : "Ask by voice"}
                    aria-pressed={isListening}
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-50",
                      isListening ? "bg-sky-500 text-white" : "text-[#5C6656] hover:bg-[#70B040]/10 hover:text-[#4E8732]",
                    )}
                  >
                    {isListening && <span className="absolute inset-0 animate-ping rounded-xl bg-sky-400/40" />}
                    <Mic size={19} className="relative" />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isListening}
                    placeholder={isListening ? "Listening… tap the mic again to send" : "Ask about scores, results, programs…"}
                    aria-label="Your question"
                    className="max-h-[140px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-[#20251D] outline-none placeholder:text-[#9EA398]"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || isListening || !input.trim()}
                    aria-label="Send"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#70B040] text-white shadow-sm transition hover:bg-[#5F9630] active:scale-95 disabled:bg-black/[0.06] disabled:text-black/30 disabled:shadow-none"
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                </form>
                <p className="mx-auto mt-2 hidden max-w-2xl text-center text-[11px] text-[#9AA094] sm:block">
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  stretch?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold transition",
        stretch && "flex-1",
        active ? "bg-white text-[#2E4A26] shadow-sm" : "text-[#6F766A] hover:text-[#2E4A26]",
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
}: {
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
        "flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95",
        active ? "border-[#D7E9CC] bg-[#F0F8EA] text-[#4E8732]" : "border-black/[0.07] bg-white text-[#6F766A] hover:bg-[#F6F7F3]",
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
        subtle ? "text-white/60 hover:bg-white/10 hover:text-white" : "bg-white/15 text-white hover:bg-white/25",
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
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8A9085] transition hover:bg-black/5 hover:text-[#2E4A26]"
    >
      {children}
    </button>
  );
}
