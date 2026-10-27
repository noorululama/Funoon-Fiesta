"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, Sparkles, RefreshCw } from "lucide-react";
import { HostScene } from "@/components/host3d/host-scene";

export type HumanState = "idle" | "listening" | "thinking" | "speaking";
export type CameraViewMode = "portrait" | "full";

export interface Ai3dHumanProps {
  state?: HumanState;
  className?: string;
  stageClassName?: string;
  isSpeakingAudio?: boolean;
  isListeningMic?: boolean;
  onAvatarClick?: () => void;
  showBadge?: boolean;
  compact?: boolean;
  fullScreen?: boolean;
  defaultViewMode?: CameraViewMode;
  allowViewToggle?: boolean;
}

/**
 * The 3D live host: a Muslim man in a white thobe and imamah, built entirely
 * in code with Three.js (see `components/host3d/`). There are no model files
 * to download – the character is generated, rigged and animated at runtime.
 *
 * Only the first full-size host in a session greets with a salaam on load.
 */
let hasAutoGreeted = false;

export function Ai3dHuman({
  state = "idle",
  className,
  stageClassName,
  isSpeakingAudio = false,
  isListeningMic = false,
  onAvatarClick,
  showBadge = true,
  compact = false,
  fullScreen = false,
  defaultViewMode = "portrait",
  allowViewToggle = false,
}: Ai3dHumanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HostScene | null>(null);
  const latest = useRef({ state, speaking: false, listening: false });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CameraViewMode>(defaultViewMode);

  const speaking = isSpeakingAudio || state === "speaking";
  const listening = isListeningMic || state === "listening";

  /* Push prop changes into the running scene. */
  useEffect(() => {
    latest.current = { state, speaking, listening };
    sceneRef.current?.setInputs({ state, speaking, listening });
  }, [state, speaking, listening]);

  useEffect(() => {
    sceneRef.current?.setViewMode(viewMode);
  }, [viewMode]);

  /* Create the scene lazily, once the container is actually visible. Several
     instances are mounted at once (mobile bar, desktop panel…) and the ones
     hidden by CSS should not each build a WebGL scene. */
  useEffect(() => {
    const container = containerRef.current;
    const mount = mountRef.current;
    if (!container || !mount) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scene: HostScene | null = null;
    // A brand-new <canvas> per scene: once a WebGL context has been released
    // (React Strict Mode, Fast Refresh, route changes) the same element would
    // hand back the lost context and render nothing.
    let canvas: HTMLCanvasElement | null = null;

    const init = () => {
      if (cancelled || scene || container.clientWidth === 0) return;
      try {
        canvas = document.createElement("canvas");
        canvas.className = "w-full h-full block";
        mount.appendChild(canvas);
        scene = new HostScene({
          canvas,
          container,
          compact,
          viewMode,
        });
      } catch (err) {
        console.error("3D host failed to start:", err);
        canvas?.remove();
        canvas = null;
        setLoadError("3D view isn't supported on this device.");
        setIsLoading(false);
        return;
      }
      sceneRef.current = scene;
      scene.setInputs(latest.current);
      scene.onReady = () => {
        if (!cancelled) setIsLoading(false);
      };
      if (!compact && !hasAutoGreeted) {
        hasAutoGreeted = true;
        setTimeout(() => {
          if (!cancelled) scene?.greet();
        }, 900);
      }
    };

    // Let the loader paint first; the build is synchronous.
    timer = setTimeout(init, 30);
    const ro = new ResizeObserver(() => {
      if (!scene && !cancelled) {
        clearTimeout(timer);
        timer = setTimeout(init, 30);
      }
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ro.disconnect();
      scene?.dispose();
      scene = null;
      sceneRef.current = null;
      canvas?.remove();
      canvas = null;
    };
    // The scene is rebuilt only when the layout variant changes; view mode and
    // live inputs are pushed in by the effects above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const toggleViewMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setViewMode((prev) => (prev === "portrait" ? "full" : "portrait"));
  }, []);

  const handleContainerClick = useCallback(() => {
    const scene = sceneRef.current;
    if (scene?.wasDrag) return; // a drag-to-rotate is not a tap
    if (scene) {
      if (latest.current.speaking) scene.nod();
      else scene.greet();
    }
    onAvatarClick?.();
  }, [onAvatarClick]);

  /* ══════════════════════════════════════════
     Status badge configuration
  ══════════════════════════════════════════ */
  const badgeConfig = {
    idle: {
      label: "3D Host Online",
      color: "bg-emerald-500",
      text: "text-emerald-700",
      border: "border-emerald-200/80",
      glow: "shadow-emerald-500/10",
    },
    listening: {
      label: "Listening to You...",
      color: "bg-blue-500",
      text: "text-blue-700",
      border: "border-blue-200/80",
      glow: "shadow-blue-500/20",
    },
    thinking: {
      label: "Consulting Fest Brain...",
      color: "bg-amber-500",
      text: "text-amber-700",
      border: "border-amber-200/80",
      glow: "shadow-amber-500/20",
    },
    speaking: {
      label: "Speaking Answer...",
      color: "bg-emerald-600",
      text: "text-emerald-800",
      border: "border-emerald-300",
      glow: "shadow-emerald-500/30",
    },
  }[state];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center select-none group w-full",
        compact && "h-full",
        fullScreen && "w-full h-full",
        className
      )}
      onClick={handleContainerClick}
    >
      {/* 3D Viewport Stage */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-300 touch-pan-y",
          compact
            ? "w-full h-full rounded-full bg-white/80"
            : fullScreen
            ? "w-full h-full rounded-none bg-transparent border-none shadow-none"
            : "w-full max-w-[320px] sm:max-w-[360px] md:max-w-[390px] h-[300px] sm:h-[350px] md:h-[400px] rounded-[32px] bg-gradient-to-b from-white/90 via-white/50 to-emerald-950/10 backdrop-blur-md border border-white/70 shadow-xl shadow-black/5 [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]",
          stageClassName
        )}
      >
        {/* Loading Scanner */}
        {isLoading && !loadError && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center bg-[#151a16]/80 backdrop-blur-md z-30 text-white",
              compact ? "rounded-full" : "rounded-[32px]"
            )}
          >
            <div className="relative flex items-center justify-center mb-3">
              <div
                className={cn(
                  "border-2 border-[#70B040]/30 border-t-[#8CCB55] rounded-full animate-spin",
                  compact ? "w-5 h-5" : "w-14 h-14"
                )}
              />
              {!compact && (
                <Sparkles
                  size={18}
                  className="absolute text-[#D6B35A] animate-pulse"
                />
              )}
            </div>
            {!compact && (
              <>
                <p className="text-xs font-bold tracking-wider uppercase text-emerald-300">
                  Preparing 3D Host
                </p>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Dressing the host in thobe &amp; imamah...
                </p>
              </>
            )}
          </div>
        )}

        {/* Load Error State Fallback */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20 p-4 text-center">
            <p className="text-xs font-semibold text-rose-600 mb-2">
              {loadError}
            </p>
            {!compact && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-medium hover:bg-neutral-200 transition"
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* WebGL canvas is mounted here imperatively (see effect above) */}
        <div ref={mountRef} className="absolute inset-0 z-10" />

        {/* Floating View Mode Switcher Toggle */}
        {!compact && allowViewToggle && !isLoading && !loadError && (
          <button
            onClick={toggleViewMode}
            className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 hover:bg-white backdrop-blur-md border border-white/80 text-[11px] font-semibold text-neutral-700 shadow-sm hover:shadow transition-all duration-200 cursor-pointer active:scale-95"
            title={
              viewMode === "portrait"
                ? "Switch to Full Stage View"
                : "Switch to Face Portrait View"
            }
          >
            {viewMode === "portrait" ? (
              <>
                <Maximize2 size={12} className="text-[#5F9630]" />
                <span className="hidden sm:inline">Full Stage</span>
              </>
            ) : (
              <>
                <Minimize2 size={12} className="text-[#5F9630]" />
                <span className="hidden sm:inline">Portrait</span>
              </>
            )}
          </button>
        )}

        {/* Audio Reactive Waveform Pill (Speaking / Listening) */}
        {!compact && (speaking || listening) && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#182019]/90 backdrop-blur-md border border-white/20 shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-0.5">
              {[4, 7, 3, 8, 5, 9, 4].map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-0.5 rounded-full transition-all duration-100",
                    listening ? "bg-blue-400" : "bg-[#8CCB55]"
                  )}
                  style={{
                    height: `${h * 2.2}px`,
                    animation: `pulse 0.6s ease-in-out infinite alternate`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold tracking-wider text-white uppercase ml-1">
              {listening ? "Listening" : "Speaking"}
            </span>
          </div>
        )}
      </div>

      {/* Floating Status Badge Pill */}
      {showBadge && !compact && (
        <div
          className={cn(
            "relative -mt-4 z-30 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border shadow-md transition-all duration-300",
            badgeConfig.border,
            badgeConfig.glow
          )}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                badgeConfig.color
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                badgeConfig.color
              )}
            />
          </span>
          <span
            className={cn(
              "text-xs font-bold tracking-tight",
              badgeConfig.text
            )}
          >
            {badgeConfig.label}
          </span>
        </div>
      )}
    </div>
  );
}
