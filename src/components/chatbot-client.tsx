"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Calendar,
  Search,
  TrendingUp,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Radio,
  MessageSquare,
  Send,
  Square,
  X,
  Subtitles,
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

export default function ChatbotClient() {
  const [activeTab, setActiveTab] = useState<AIMode>("character");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [humanState, setHumanState] = useState<HumanState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [chatMessages, isLoading, activeTab]);

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
    (text: string, forceMalayalam = false) => {
      if (
        !voiceEnabled ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        return;
      }

      window.speechSynthesis.cancel();

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

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Check if text contains Malayalam characters or character mode is active
      const hasMalayalamChar = /[\u0D00-\u0D7F]/.test(cleanText);
      const isMalayalamSpeech = forceMalayalam || activeTab === "character" || hasMalayalamChar;

      const currentVoices =
        window.speechSynthesis.getVoices().length > 0
          ? window.speechSynthesis.getVoices()
          : availableVoices;

      if (isMalayalamSpeech) {
        utterance.lang = "ml-IN";
        // Measured rate (0.88) provides crisp syllable articulation for easy comprehension
        utterance.rate = 0.88;
        // Resonant lower pitch (0.86) produces a warm, deep, authoritative clear male presenter voice
        utterance.pitch = 0.86;

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

        // 3. Fallback: Indian Male Voices (e.g., Microsoft Rahul, Microsoft Madhur, Microsoft Hemant, Microsoft Prabhat)
        if (!selectedVoice) {
          selectedVoice = currentVoices.find((v) => {
            const isIndian = v.lang.includes("IN") || v.name.includes("India");
            const n = v.name.toLowerCase();
            return isIndian && (n.includes("rahul") || n.includes("madhur") || n.includes("hemant") || n.includes("prabhat") || n.includes("male"));
          });
        }

        // 4. Any Indian voice fallback
        if (!selectedVoice) {
          selectedVoice = currentVoices.find((v) => v.lang.includes("IN") || v.name.includes("India"));
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      } else {
        // English voice selection with male preference
        utterance.lang = "en-IN";
        utterance.rate = 0.96;
        utterance.pitch = 0.90;

        const enVoice = currentVoices.find((v) => {
          const isEn = v.lang.includes("en-IN") || v.name.includes("India") || v.lang.includes("en-US");
          const n = v.name.toLowerCase();
          return isEn && (n.includes("rahul") || n.includes("prabhat") || n.includes("david") || n.includes("male"));
        }) || currentVoices.find((v) => v.lang.includes("en-IN") || v.name.includes("India") || v.lang.includes("en-US"));

        if (enVoice) utterance.voice = enVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setHumanState("speaking");
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setHumanState("idle");
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setHumanState("idle");
      };

      window.speechSynthesis.speak(utterance);
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
      alert("Voice input is not supported in this browser. Please use text chat.");
      return;
    }

    // Stop active speech before listening
    stopSpeaking();
    currentTranscriptRef.current = "";

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

        if (activeTab === "chat") {
          setInput(transcript);
        }

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

      recognition.onerror = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsListening(false);
        setHumanState("idle");
      };

      recognition.onend = () => {
        setIsListening(false);
        if (humanState === "listening") {
          setHumanState("idle");
        }
      };

      recognition.start();
    } catch (e) {
      console.error("Speech recognition error:", e);
      setIsListening(false);
      setHumanState("idle");
    }
  };

  // Character query handler (pure voice/spoken dialogue mode)
  const handleSendCharacterQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    stopSpeaking();
    setCharacterUserQuery(queryText.trim());
    setIsLoading(true);
    setHumanState("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: queryText.trim(), mode: "character" }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setCharacterResponse(data.response);
      setShowSubtitle(true);
      speakText(data.response, true);
    } catch {
      const errMsg = "ക്ഷമിക്കണം, താൽക്കാലികമായി കണക്ട് ചെയ്യാൻ സാധിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.";
      setCharacterResponse(errMsg);
      setShowSubtitle(true);
      setHumanState("idle");
    } finally {
      setIsLoading(false);
    }
  };

  // Chat section query handler
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    stopSpeaking();
    const userMessage = text.trim();
    setInput("");

    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
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
        { role: "assistant", content: data.response },
      ]);
      speakText(data.response);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered a temporary connection issue. Please try again." },
      ]);
      setHumanState("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
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
    setHumanState("idle");
    setInput("");
  };

  // Malayalam greeting when 3D avatar is clicked
  const handleAvatarClick = () => {
    if (!isSpeaking && !isLoading) {
      const greeting = "അസ്സലാമു അലൈക്കും! ഞാൻ ഫുനൂൻ ഫിയസ്റ്റയുടെ 3D ലൈവ് എഐ അവതാരകനാണ്. മത്സര ഫലങ്ങൾ, ടീം സ്കോറുകൾ, പരിപാടികൾ എന്നിവയെക്കുറിച്ച് എന്നോട് സംസാരിക്കാം!";
      setCharacterResponse(greeting);
      speakText(greeting, true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F7F2] text-[#20251D] overflow-hidden font-sans relative">
      {/* Background Ambient Spotlights */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[520px] rounded-full bg-[#70B040]/10 blur-[140px] z-0" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[550px] h-[450px] rounded-full bg-[#D6B35A]/10 blur-[130px] z-0" />

      {/* =========================================================
          TOP HEADER WITH MODE SWITCHER TABS
      ========================================================= */}
      <header className="relative z-30 w-full bg-white/95 backdrop-blur-md border-b border-[#E5E2D6] py-2.5 px-3 md:px-8 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Mode Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#70B040] to-[#8CCB55] text-white shadow-md shadow-emerald-600/20">
              {activeTab === "chat" ? (
                <MessageSquare size={19} />
              ) : (
                <Radio
                  size={19}
                  className={isSpeaking ? "animate-pulse text-amber-200" : ""}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-xs sm:text-sm md:text-base tracking-tight text-[#20251D]">
                  {activeTab === "character" ? "3D AI Character Host" : "Funoon AI Chat"}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                    activeTab === "character"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  )}
                >
                  {activeTab === "character" ? "Malayalam Male Voice" : "Multilingual"}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#6D7168] flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isListening
                      ? "bg-blue-500 animate-ping"
                      : isSpeaking
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-emerald-500"
                  )}
                />
                {isListening
                  ? activeTab === "character"
                    ? "Listening... Speak in Malayalam"
                    : "Listening to your voice..."
                  : isSpeaking
                  ? activeTab === "character"
                    ? "Speaking in Malayalam (Lip Sync Active)"
                    : "Speaking response..."
                  : isLoading
                  ? "Consulting festival database..."
                  : activeTab === "character"
                  ? "Ready • Listens & Speaks in Malayalam"
                  : "Ready • Ask questions about the fest"}
              </p>
            </div>
          </div>

          {/* Central Segmented Mode Switcher */}
          <div className="flex items-center bg-[#ECE9DD] p-1 rounded-2xl border border-[#DCD7C5] shadow-inner">
            <button
              onClick={() => {
                stopSpeaking();
                setActiveTab("character");
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer",
                activeTab === "character"
                  ? "bg-white text-[#20251D] shadow-sm"
                  : "text-[#656A60] hover:text-[#20251D]"
              )}
            >
              <Radio size={15} />
              <span className="hidden xs:inline">AI Character (3D)</span>
              <span className="xs:hidden">Character</span>
            </button>

            <button
              onClick={() => {
                stopSpeaking();
                setActiveTab("chat");
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer",
                activeTab === "chat"
                  ? "bg-white text-[#20251D] shadow-sm"
                  : "text-[#656A60] hover:text-[#20251D]"
              )}
            >
              <MessageSquare size={15} />
              <span className="hidden xs:inline">Chat with AI</span>
              <span className="xs:hidden">Chat</span>
            </button>
          </div>

          {/* Controls: Voice Toggle & Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {activeTab === "character" && (
              <button
                onClick={() => setShowSubtitle((prev) => !prev)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95",
                  showSubtitle
                    ? "bg-white text-[#20251D] border-emerald-200 shadow-2xs hover:bg-gray-50"
                    : "bg-gray-100 text-gray-500 border-gray-200 hover:text-gray-700"
                )}
                title={showSubtitle ? "Hide Text Subtitles" : "Show Text Subtitles"}
              >
                <Subtitles size={13} className={showSubtitle ? "text-[#5F9630]" : ""} />
                <span className="hidden sm:inline">
                  {showSubtitle ? "Text On" : "Text Off"}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                if (voiceEnabled) stopSpeaking();
                setVoiceEnabled(!voiceEnabled);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95",
                voiceEnabled
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-xs"
                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
              )}
              title={voiceEnabled ? "Mute Voice" : "Unmute Voice"}
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span className="hidden sm:inline">
                {voiceEnabled ? "Voice On" : "Voice Off"}
              </span>
            </button>

            {activeTab === "chat" && hasChatStarted && (
              <button
                onClick={handleResetChat}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold text-[#5A6054] bg-[#F1EFE6] hover:bg-[#E7E4D8] border border-[#DDD9C9] transition-all cursor-pointer active:scale-95"
                title="Restart chat"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">New</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN INTERFACE
      ========================================================= */}
      <main className="flex-1 flex flex-col relative w-full h-full overflow-hidden z-10">
        {/* =========================================================
            OPTION 1: 3D AI CHARACTER (FULL SCREEN STAGE)
        ========================================================= */}
        {activeTab === "character" && (
          <div className="relative flex-1 w-full h-full overflow-hidden">
            {/* Full Screen 3D Model Stage Canvas */}
            <div className="absolute inset-0 w-full h-full z-0">
              <Ai3dHuman
                state={humanState}
                isSpeakingAudio={isSpeaking}
                isListeningMic={isListening}
                onAvatarClick={handleAvatarClick}
                showBadge={false}
                allowViewToggle={true}
                defaultViewMode="full"
                fullScreen={true}
              />
            </div>

            {/* Floating Top Info Overlay (Sleek Glass Banner) */}
            <div className="pointer-events-none absolute top-4 left-4 sm:left-6 z-20 flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#3F751E] text-xs font-bold border border-emerald-200/90 shadow-sm mb-1">
                <Radio size={12} className="text-[#5F9630] animate-pulse" />
                <span>3D Live Host • Clear Male Malayalam Voice</span>
              </div>
              <h1 className="text-sm sm:text-base md:text-lg font-black text-[#20251D] tracking-tight bg-white/70 backdrop-blur-xs px-2.5 py-0.5 rounded-lg border border-white/60">
                Live Festival Presenter
              </h1>
            </div>

            {/* Floating Live Spoken Dialogue Box */}
            <AnimatePresence>
              {characterResponse && showSubtitle && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  className="absolute z-20 md:top-20 md:right-6 md:w-[380px] lg:w-[420px] md:bottom-28 md:inset-x-auto inset-x-3 bottom-36 max-h-[140px] md:max-h-[calc(100vh-190px)] flex flex-col bg-white/95 backdrop-blur-md border border-emerald-300/80 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left pointer-events-auto"
                >
                  {/* Card Header: Live Indicator, Title, & Close Button */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100/90 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-bold text-[#20251D]">Live Host Speech</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-[#3F751E] font-bold border border-emerald-200">
                        Malayalam
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSubtitle(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                      title="Hide speech text (keep character clear)"
                      aria-label="Hide speech text"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Query reference */}
                  {characterUserQuery && (
                    <div className="mb-1.5 shrink-0">
                      <p className="text-[11px] font-medium text-[#7A8074] truncate">
                        You asked: <span className="font-bold text-[#20251D]">&ldquo;{characterUserQuery}&rdquo;</span>
                      </p>
                    </div>
                  )}

                  {/* Scrollable spoken content - never stretches parent to hide character */}
                  <div className="flex-1 overflow-y-auto pr-1 text-xs sm:text-sm text-[#20251D] leading-relaxed font-semibold">
                    <p className="whitespace-pre-line">{characterResponse}</p>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-gray-100 shrink-0">
                    {isSpeaking ? (
                      <button
                        onClick={stopSpeaking}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition cursor-pointer active:scale-95"
                      >
                        <Square size={11} />
                        <span>Stop Speaking</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => speakText(characterResponse, true)}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-[#5F9630] hover:bg-emerald-100 text-xs font-bold transition cursor-pointer active:scale-95"
                      >
                        <Volume2 size={12} />
                        <span>Listen Again in Malayalam</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowSubtitle(false)}
                      className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition cursor-pointer"
                    >
                      Hide Text
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Button to restore dialogue if user closed it */}
            {!showSubtitle && characterResponse && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setShowSubtitle(true)}
                className="absolute z-20 top-20 right-4 sm:right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-emerald-300 text-xs font-bold text-[#20251D] shadow-lg hover:bg-white hover:border-[#70B040] transition cursor-pointer active:scale-95"
              >
                <Subtitles size={13} className="text-[#5F9630]" />
                <span>Show Speech Text</span>
              </motion.button>
            )}

            {/* Floating Bottom Voice Controls & Topic Chips */}
            <div className="absolute bottom-4 inset-x-4 mx-auto max-w-xl z-20 flex flex-col items-center gap-2.5 pointer-events-auto">
              {/* Primary Voice Action Button */}
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className={cn(
                  "flex items-center justify-center gap-3 px-8 py-3.5 rounded-full font-black text-sm sm:text-base shadow-xl transition-all active:scale-95 cursor-pointer backdrop-blur-sm",
                  isLoading
                    ? "bg-amber-600/95 text-white shadow-amber-600/30 cursor-wait ring-4 ring-amber-400/30"
                    : isListening
                    ? "bg-blue-600 hover:bg-blue-700 text-white animate-pulse shadow-blue-500/40 ring-4 ring-blue-400/30"
                    : "bg-[#70B040] hover:bg-[#5F9630] text-white shadow-emerald-700/30 hover:shadow-2xl"
                )}
              >
                {isLoading ? (
                  <>
                    <Sparkles size={20} className="animate-spin text-amber-200" />
                    <span>Host is Thinking...</span>
                  </>
                ) : isListening ? (
                  <>
                    <MicOff size={20} className="animate-pulse" />
                    <span>Listening... Tap to Send</span>
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    <span>Speak with 3D Host</span>
                  </>
                )}
              </button>

              <p className="text-[10px] sm:text-[11px] text-[#4F544A] text-center bg-white/75 backdrop-blur-xs px-3 py-0.5 rounded-full border border-white/60 shadow-2xs">
                Tap avatar to greet • Drag anywhere to rotate 3D view
              </p>
            </div>
          </div>
        )}

        {/* =========================================================
            OPTION 2: CHAT WITH AI (FULL CHAT SECTION)
        ========================================================= */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Welcome State for Chat */}
            {!hasChatStarted && (
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-6 max-w-3xl mx-auto w-full flex flex-col items-center justify-start">
                {/* Chat Intro Title */}
                <div className="text-center max-w-xl mb-6 pt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#70B040]/10 text-[#5F9630] text-xs font-bold mb-2">
                    <Sparkles size={13} />
                    <span>Official Festival AI Assistant</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#20251D]">
                    Chat with Funoon Fiesta AI
                  </h1>
                  <p className="mt-1.5 text-xs sm:text-sm text-[#656A60] leading-relaxed">
                    Ask any question about scoreboard points, published results, or participants. Supports both English and Malayalam.
                  </p>
                </div>

                {/* Suggestions Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mb-6">
                  {CHAT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.text)}
                      className="group flex items-center justify-between p-3.5 bg-white/95 border border-[#E5E2D6] hover:border-[#70B040] rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer active:scale-98"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br",
                            item.color
                          )}
                        >
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-[#20251D] tracking-tight">
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-[#787D73] truncate">
                            {item.text}
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-[#B5B9AF] group-hover:text-[#70B040] group-hover:translate-x-1 transition shrink-0"
                      />
                    </button>
                  ))}
                </div>

                {/* Initial Input Bar in Welcome State */}
                <div className="w-full relative shadow-lg shadow-black/5 rounded-3xl bg-white p-2.5 flex flex-col border border-[#E0DCCF] transition focus-within:border-[#70B040] focus-within:ring-3 focus-within:ring-[#70B040]/15">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your question in English or Malayalam..."
                    className="w-full bg-transparent text-[#20251D] placeholder:text-[#A2A79C] px-3 py-2 focus:outline-none resize-none text-sm md:text-base leading-relaxed"
                    rows={2}
                  />

                  <div className="flex items-center justify-between px-3 pb-1 pt-1 mt-auto border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleListening}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer",
                          isListening
                            ? "bg-blue-600 text-white animate-pulse"
                            : "bg-gray-100 text-gray-700 hover:bg-[#70B040]/15 hover:text-[#5F9630]"
                        )}
                        title="Voice Input"
                      >
                        <Mic size={15} />
                        <span>{isListening ? "Listening..." : "Voice Input"}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleSendMessage(input)}
                      disabled={!input.trim() || isLoading}
                      className={cn(
                        "flex items-center justify-center gap-2 h-9 px-4 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer",
                        input.trim() && !isLoading
                          ? "bg-[#70B040] hover:bg-[#5F9630] text-white shadow-md shadow-emerald-600/20"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      <span>Ask AI</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Chat Conversation History */}
            {hasChatStarted && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto scroll-smooth px-4 md:px-8 py-5">
                  <div className="max-w-3xl mx-auto space-y-4">
                    {chatMessages.map((msg, index) => (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={index}
                        className={cn(
                          "flex gap-3 w-full",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 shadow-xs mt-1 text-[#5F9630]">
                            <Sparkles size={16} />
                          </div>
                        )}

                        <div
                          className={cn(
                            "group relative max-w-[85%] md:max-w-[78%]",
                            msg.role === "user" ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "px-4 py-3.5 text-sm leading-relaxed",
                              msg.role === "user"
                                ? "bg-gradient-to-tr from-[#70B040] to-[#5F9630] text-white rounded-2xl rounded-tr-xs shadow-md shadow-emerald-900/10 font-medium"
                                : "bg-white border border-[#E5E2D6] text-[#242424] rounded-2xl rounded-tl-xs shadow-xs"
                            )}
                          >
                            <div
                              className={cn(
                                "prose prose-sm max-w-none break-words",
                                msg.role === "user"
                                  ? "prose-invert"
                                  : "prose-headings:font-bold prose-headings:text-[#20251D] prose-strong:text-[#20251D] prose-p:my-1"
                              )}
                            >
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>

                          {/* Action Buttons for Assistant Message */}
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-3 mt-1.5 px-2">
                              <button
                                onClick={() => speakText(msg.content)}
                                className="text-[11px] text-[#7A8074] hover:text-[#70B040] flex items-center gap-1 cursor-pointer font-medium"
                                title="Listen to response"
                              >
                                <Volume2 size={13} />
                                <span>Listen</span>
                              </button>

                              <button
                                onClick={() =>
                                  handleCopyMessage(msg.content, index)
                                }
                                className="text-[11px] text-[#7A8074] hover:text-[#20251D] flex items-center gap-1 cursor-pointer font-medium"
                                title="Copy text"
                              >
                                {copiedIndex === index ? (
                                  <>
                                    <Check
                                      size={13}
                                      className="text-emerald-600"
                                    />
                                    <span className="text-emerald-600 font-semibold">
                                      Copied
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {/* Thinking status */}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3 items-center"
                      >
                        <div className="w-8 h-8 rounded-full bg-white border border-[#DDD9C9] flex items-center justify-center shrink-0 shadow-xs text-[#F09030]">
                          <Sparkles size={16} className="animate-spin" />
                        </div>
                        <div className="px-4 py-3 bg-white border border-[#E5E2D6] rounded-2xl rounded-tl-xs shadow-xs flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#70B040] rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-2 h-2 bg-[#D6B35A] rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-2 h-2 bg-[#F09030] rounded-full animate-bounce" />
                          <span className="text-xs font-semibold text-[#6D7168] ml-1">
                            AI is searching festival records...
                          </span>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                </div>

                {/* Bottom Input Bar for Active Chat */}
                <div className="w-full bg-white/95 backdrop-blur-md border-t border-[#E5E2D6] p-3 md:p-4 z-20">
                  <div className="max-w-3xl mx-auto">
                    <div className="relative flex items-end gap-2 bg-white rounded-2xl border border-[#DDD9C9] shadow-xs p-1.5 md:p-2 focus-within:border-[#70B040] focus-within:ring-2 focus-within:ring-[#70B040]/15 transition">
                      <button
                        onClick={toggleListening}
                        className={cn(
                          "p-2.5 rounded-xl transition cursor-pointer shrink-0",
                          isListening
                            ? "bg-blue-600 text-white animate-pulse"
                            : "text-gray-500 hover:text-[#70B040] hover:bg-gray-100"
                        )}
                        title={
                          isListening
                            ? "Stop Listening"
                            : "Speak with Microphone"
                        }
                      >
                        <Mic size={18} />
                      </button>

                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          isListening
                            ? "Listening to your voice..."
                            : "Type a question in English or Malayalam..."
                        }
                        className="bg-transparent text-[#20251D] placeholder:text-[#9EA398] w-full pl-1 md:pl-2 py-2 focus:outline-none resize-none text-sm md:text-base leading-relaxed"
                        rows={1}
                        style={{ minHeight: "28px" }}
                      />

                      <button
                        onClick={() => handleSendMessage(input)}
                        disabled={isLoading || !input.trim()}
                        className={cn(
                          "flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition duration-200 active:scale-95 cursor-pointer",
                          input.trim() && !isLoading
                            ? "bg-[#70B040] text-white shadow-md shadow-emerald-600/20 hover:bg-[#5F9630]"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        )}
                        title="Send message"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}