"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";

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
 * Realistic host model. Drop a humanoid .glb at `public/models/host.glb`
 * (or set NEXT_PUBLIC_HOST_MODEL_URL) and it is used automatically. Until then
 * — or if it fails to load — the code-built host in `components/host3d/` is shown.
 */
export const HOST_MODEL_URL = process.env.NEXT_PUBLIC_HOST_MODEL_URL || "/models/host.glb";

/** What both scene implementations expose to this wrapper. */
interface HostSceneLike {
  setInputs(next: { state: HumanState; speaking: boolean; listening: boolean }): void;
  setViewMode(mode: CameraViewMode): void;
  greet(): void;
  nod(): void;
  dispose(): void;
  onReady?: () => void;
  readonly wasDrag: boolean;
}

let modelCheck: Promise<boolean> | null = null;
/** One HEAD request per page load to see whether the realistic model exists. */
function hasRealisticModel(): Promise<boolean> {
  if (!modelCheck) {
    modelCheck = fetch(HOST_MODEL_URL, { method: "HEAD" })
      .then((res) => res.ok && !(res.headers.get("content-type") ?? "").includes("text/html"))
      .catch(() => false);
  }
  return modelCheck;
}

/** Only the first full-size host in a session greets on load. */
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
  const sceneRef = useRef<HostSceneLike | null>(null);
  const speaking = isSpeakingAudio || state === "speaking";
  const listening = isListeningMic || state === "listening";
  const latest = useRef({ state, speaking, listening });

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CameraViewMode>(defaultViewMode);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    latest.current = { state, speaking, listening };
    sceneRef.current?.setInputs(latest.current);
  }, [state, speaking, listening]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    sceneRef.current?.setViewMode(viewMode);
  }, [viewMode]);

  /* Build the scene lazily: three.js is loaded in its own chunk, only once the
     container is on screen and has a size, after the page has painted. */
  useEffect(() => {
    const container = containerRef.current;
    const mount = mountRef.current;
    if (!container || !mount) return;

    let cancelled = false;
    let started = false;
    let scene: HostSceneLike | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const freshCanvas = () => {
      canvas?.remove();
      // A new <canvas> per scene: a released WebGL context cannot be reused.
      canvas = document.createElement("canvas");
      canvas.className = "w-full h-full block";
      mount.appendChild(canvas);
      return canvas;
    };

    const attach = (s: HostSceneLike) => {
      scene = s;
      sceneRef.current = s;
      s.setInputs(latest.current);
      s.setViewMode(viewModeRef.current);
    };

    const ready = () => {
      if (cancelled) return;
      setIsLoading(false);
      setProgress(null);
      if (!compact && !hasAutoGreeted) {
        hasAutoGreeted = true;
        setTimeout(() => !cancelled && scene?.greet(), 700);
      }
    };

    const startProcedural = async () => {
      const { HostScene } = await import("@/components/host3d/host-scene");
      if (cancelled) return;
      const s = new HostScene({ canvas: freshCanvas(), container, compact, viewMode: viewModeRef.current });
      attach(s);
      s.onReady = ready;
    };

    const init = async () => {
      if (started || cancelled || container.clientWidth === 0) return;
      started = true;
      try {
        if (await hasRealisticModel()) {
          const { GlbHostScene } = await import("@/components/host-glb/glb-host-scene");
          if (cancelled) return;
          const s = new GlbHostScene({
            canvas: freshCanvas(),
            container,
            url: HOST_MODEL_URL,
            compact,
            viewMode: viewModeRef.current,
          });
          attach(s);
          s.onProgress = (f) => !cancelled && setProgress(Math.round(f * 100));
          s.onReady = ready;
          s.onError = (err) => {
            console.warn("Realistic host failed to load, using the built-in host instead:", err);
            if (cancelled) return;
            s.dispose();
            setProgress(null);
            void startProcedural().catch(fail);
          };
        } else {
          await startProcedural();
        }
      } catch (err) {
        fail(err);
      }
    };

    const fail = (err: unknown) => {
      console.error("3D host failed to start:", err);
      if (cancelled) return;
      canvas?.remove();
      canvas = null;
      setLoadError("3D view isn't supported on this device.");
      setIsLoading(false);
    };

    // Wait until visible and the browser is idle, so the chat UI is interactive first.
    const schedule = () => {
      const run = () => void init();
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 600 });
      else setTimeout(run, 60);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting && e.boundingClientRect.width > 0)) {
        io.disconnect();
        schedule();
      }
    });
    io.observe(container);

    return () => {
      cancelled = true;
      io.disconnect();
      scene?.dispose();
      scene = null;
      sceneRef.current = null;
      canvas?.remove();
      canvas = null;
    };
    // Rebuilt only when the layout variant changes; live inputs are pushed above.
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

  const badge = {
    idle: { label: "Host online", dot: "bg-emerald-500", text: "text-emerald-700" },
    listening: { label: "Listening…", dot: "bg-sky-500", text: "text-sky-700" },
    thinking: { label: "Thinking…", dot: "bg-amber-500", text: "text-amber-700" },
    speaking: { label: "Speaking…", dot: "bg-emerald-600", text: "text-emerald-800" },
  }[state];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center select-none w-full",
        (compact || fullScreen) && "h-full",
        className,
      )}
      onClick={handleContainerClick}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing touch-pan-y",
          compact
            ? "w-full h-full rounded-full bg-white/80"
            : fullScreen
              ? "w-full h-full"
              : "w-full max-w-[390px] h-[300px] sm:h-[350px] md:h-[400px] rounded-[28px] bg-gradient-to-b from-white/90 to-emerald-950/10 border border-white/70 shadow-xl shadow-black/5",
          stageClassName,
        )}
      >
        {/* Loader: a soft silhouette pulse rather than a heavy overlay */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 text-white">
            {!compact && (
              <div className="relative h-40 w-28 opacity-70">
                <div className="absolute left-1/2 top-0 h-16 w-14 -translate-x-1/2 rounded-full bg-white/10 animate-pulse" />
                <div className="absolute bottom-0 left-1/2 h-24 w-28 -translate-x-1/2 rounded-t-[48px] bg-white/10 animate-pulse" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full border-2 border-white/20 border-t-[#9ACB71] animate-spin", compact ? "h-4 w-4" : "h-4 w-4")} />
              {!compact && (
                <span className="text-[11px] font-semibold tracking-wide text-white/75">
                  {progress !== null ? `Loading host · ${progress}%` : "Preparing host…"}
                </span>
              )}
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-xs font-semibold text-white/80">{loadError}</p>
            {!compact && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </div>
        )}

        {/* WebGL canvas is mounted here imperatively */}
        <div ref={mountRef} className={cn("absolute inset-0 z-10 transition-opacity duration-500", isLoading ? "opacity-0" : "opacity-100")} />

        {!compact && allowViewToggle && !isLoading && !loadError && (
          <button
            onClick={toggleViewMode}
            className={cn(
              "absolute right-3 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-md transition hover:bg-black/45 active:scale-95",
              fullScreen ? "top-[calc(6.75rem+env(safe-area-inset-top))] sm:top-20" : "top-3",
            )}
            title={viewMode === "portrait" ? "Show full body" : "Show face"}
            aria-label={viewMode === "portrait" ? "Show full body" : "Show face"}
          >
            {viewMode === "portrait" ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            <span className="hidden sm:inline">{viewMode === "portrait" ? "Full body" : "Portrait"}</span>
          </button>
        )}
      </div>

      {showBadge && !compact && (
        <div className="relative z-30 -mt-4 flex items-center gap-2 rounded-full border border-black/5 bg-white/95 px-4 py-1.5 shadow-md">
          <span className={cn("h-2 w-2 rounded-full", badge.dot, state !== "idle" && "animate-pulse")} />
          <span className={cn("text-xs font-bold", badge.text)}>{badge.label}</span>
        </div>
      )}
    </div>
  );
}
