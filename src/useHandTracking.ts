import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { createHandLandmarker } from "./handLandmarker";
import type { EnginePreference } from "./handLandmarker";
import {
  DetectionGate,
  EMPTY_PERFORMANCE,
  inferenceSize,
  TrackingPerformance,
} from "./trackingPerformance";
import { drawSkeleton } from "./drawSkeleton";
import { AirCanvas } from "./airCanvas";
import type { TrackingMode } from "./airCanvas";
import { DEFAULT_BRUSH, normalizeBrush } from "./brushes";
import type { BrushSettings } from "./brushes";
import { updateInteractionCursor } from "./interactionCursor";
import type { PixiEffects } from "./PixiEffects";
import { HologramController } from "./hologramController";

import { MagicOrb } from "./magic";

export type Status = "idle" | "loading" | "running" | "error";
const emptyStats = () => ({
  ...EMPTY_PERFORMANCE,
  hands: 0,
  labels: [] as string[],
  fxParticles: 0,
  fxStrands: 0,
  hologramFps: 0,
  hologramMs: 0,
});
const INITIAL_BRUSH: BrushSettings = {
  ...DEFAULT_BRUSH,
  brush: "energy-ribbon",
};
const emptyEngine = {
  delegate: "—",
  fallback: "",
  width: 0,
  height: 0,
  sourceWidth: 0,
  sourceHeight: 0,
  cameraFps: 0,
};
function explain(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "Accès caméra refusé. Autorisez la webcam dans les paramètres du navigateur, puis réessayez.";
    if (error.name === "NotFoundError")
      return "Aucune webcam détectée. Branchez une caméra, puis réessayez.";
    if (error.name === "NotReadableError")
      return "Caméra indisponible. Fermez les applications qui l’utilisent, puis réessayez.";
  }
  return error instanceof Error
    ? error.message
    : "Impossible de démarrer le suivi.";
}
export function useHandTracking() {
  const magic = useRef(new MagicOrb());
  const magicCanvasRef = useRef<HTMLCanvasElement>(null);
  const resetMagic = () => {
    magic.current.reset();
    const canvas = magicCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };
  const hologram = useMemo(() => new HologramController(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<PixiEffects | null>(null);
  const effectsAlive = useRef(false);
  const effectsLoading = useRef(false);
  const [effectsStatus, setEffectsStatus] = useState("idle");
  const [effectsError, setEffectsError] = useState("");
  const cursorRef = useRef<SVGGElement>(null);
  const cursorViewport = useRef({ width: 1280, height: 720 });
  const airCanvas = useRef(new AirCanvas(INITIAL_BRUSH));
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    ...INITIAL_BRUSH,
  });
  const brushSettingsRef = useRef<BrushSettings>({ ...INITIAL_BRUSH });
  const changeBrush = (patch: Partial<BrushSettings>) => {
    const next = normalizeBrush({ ...brushSettingsRef.current, ...patch });
    airCanvas.current.setSettings(next);
    brushSettingsRef.current = next;
    setBrushSettings(next);
  };
  const [mode, setMode] = useState<TrackingMode>("tracking");
  const modeRef = useRef<TrackingMode>("tracking");
  const changeMode = (next: TrackingMode) => {
    resetMagic();
    airCanvas.current.interrupt();
    hologram.interrupt();
    hologram.resetRenderStats(performance.now());
    effectsRef.current?.pause();
    updateInteractionCursor(cursorRef.current, undefined, 0, 0);
    modeRef.current = next;
    setMode(next);
  };
  const clearDrawing = () => airCanvas.current.clear(drawingCanvasRef.current);
  const cleanupRef = useRef<() => void>(() => {});
  const session = useRef(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [stats, setStats] = useState(emptyStats);
  const [engine, setEngine] = useState(emptyEngine);
  const [enginePreference, setEnginePreference] =
    useState<EnginePreference>("auto");
  const [inputWidth, setInputWidth] = useState(1280);
  const skeletonRevision = useRef(0);
  const [skeleton, setSkeleton] = useState(true);
  const skeletonRef = useRef(true);
  const toggleSkeleton = () => {
    skeletonRef.current = !skeletonRef.current;
    setSkeleton(skeletonRef.current);
    skeletonRevision.current++;
  };
  const stop = useCallback(() => {
    session.current++;
    cleanupRef.current();
    cleanupRef.current = () => {};
    hologram.interrupt();
    setStatus("idle");
    setEngine(emptyEngine);
    setStats(emptyStats());
  }, [hologram]);
  useEffect(
    () => () => {
      session.current++;
      cleanupRef.current();
    },
    [],
  );
  useEffect(() => {
    const controller = airCanvas.current;
    effectsAlive.current = true;
    return () => {
      effectsAlive.current = false;
      controller.setEffects(undefined);
      effectsRef.current?.destroy();
      effectsRef.current = null;
    };
  }, []);
  const disableEffects = (message: string) => {
    airCanvas.current.setEffects(undefined);
    effectsRef.current?.destroy();
    effectsRef.current = null;
    setEffectsError(message);
    setEffectsStatus("error");
  };
  useEffect(() => {
    if (mode !== "air-canvas" || effectsRef.current || effectsLoading.current)
      return;
    const canvas = effectsCanvasRef.current;
    if (!canvas) return;
    effectsLoading.current = true;
    setEffectsStatus("loading");
    setEffectsError("");
    void import("./PixiEffects")
      .then((module) =>
        module.PixiEffects.create(canvas, (message) => {
          if (effectsAlive.current) disableEffects(message);
        }),
      )
      .then((engine) => {
        if (!effectsAlive.current || effectsCanvasRef.current !== canvas) {
          engine.destroy();
          return;
        }
        effectsRef.current = engine;
        airCanvas.current.setEffects(engine);
        setEffectsStatus("ready");
      })
      .catch((cause) => {
        if (effectsAlive.current) {
          setEffectsError(
            `PixiJS : ${explain(cause)}. Les pinceaux classiques restent disponibles.`,
          );
          setEffectsStatus("error");
        }
      })
      .finally(() => {
        effectsLoading.current = false;
      });
  }, [mode]);
  useEffect(() => {
    const svg = cursorRef.current?.ownerSVGElement;
    if (!svg) return;
    // Cache the viewport on resize, never force a layout read per detection.
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width > 0 && height > 0) cursorViewport.current = { width, height };
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(svg);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const start = async () => {
    stop();
    const id = session.current;
    setError("");
    setStatus("loading");
    let stream: MediaStream | undefined;
    let detector: HandLandmarker | undefined;
    let renderRaf = 0,
      detectionCallback = 0,
      timer = 0,
      statsTimer = 0;
    let videoCallback = false;
    let pending:
      { result: HandLandmarkerResult; timestamp: number } | undefined;
    let latest: HandLandmarkerResult | undefined;
    let drawnRevision = -1;
    let cursorExpiresAt = Infinity;
    let video: HTMLVideoElement | undefined;
    let input: HTMLCanvasElement | undefined;
    const performanceMeter = new TrackingPerformance();
    const gate = new DetectionGate();
    const suspend = () => {
      resetMagic();
      pending = undefined;
      latest = undefined;
      airCanvas.current.interrupt();
      hologram.interrupt();
      hologram.resetRenderStats(performance.now());
      effectsRef.current?.pause();
      updateInteractionCursor(cursorRef.current, undefined, 0, 0);
      cursorExpiresAt = Infinity;
      gate.reset();
      performanceMeter.reset(performance.now());
      setStats(emptyStats());
    };
    const current = () => session.current === id;
    const cleanup = () => {
      resetMagic();
      airCanvas.current.interrupt();
      hologram.interrupt();
      effectsRef.current?.pause();
      updateInteractionCursor(cursorRef.current, undefined, 0, 0);
      cancelAnimationFrame(renderRaf);
      if (videoCallback) video?.cancelVideoFrameCallback(detectionCallback);
      else cancelAnimationFrame(detectionCallback);
      clearInterval(statsTimer);
      document.removeEventListener("visibilitychange", suspend);
      clearTimeout(timer);
      detector?.close();
      detector = undefined;
      pending = undefined;
      latest = undefined;
      if (input) {
        input.width = 0;
        input.height = 0;
      }
      stream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
      }
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
    cleanupRef.current = cleanup;
    const fail = (cause: unknown) => {
      if (!current()) return;
      session.current++;
      cleanup();
      setError(explain(cause));
      setStatus("error");
      setStats(emptyStats());
    };
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "La webcam nécessite HTTPS ou localhost et un navigateur récent.",
        );
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      if (!current()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.getVideoTracks().forEach((t) => {
        t.onended = () =>
          fail(
            new Error(
              "La webcam a été déconnectée. Rebranchez-la et réessayez.",
            ),
          );
      });
      video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (!current()) return;
      timer = window.setTimeout(
        () =>
          fail(
            new Error(
              "Le modèle met trop de temps à charger. Vérifiez votre connexion et réessayez.",
            ),
          ),
        45000,
      );
      const loaded = await createHandLandmarker(enginePreference);
      if (!current()) {
        loaded.detector.close();
        return;
      }
      detector = loaded.detector;
      clearTimeout(timer);
      const source = video;
      let sourceWidth = source.videoWidth,
        sourceHeight = source.videoHeight;
      let size = inferenceSize(
        source.videoWidth,
        source.videoHeight,
        inputWidth,
      );
      input = document.createElement("canvas");
      input.width = size.width;
      input.height = size.height;
      const inputContext = input.getContext("2d", { alpha: false });
      if (!inputContext) throw new Error("Canvas vidéo indisponible.");
      const inferenceInput = input;
      let nativeSize =
        size.width === source.videoWidth && size.height === source.videoHeight;
      setEngine({
        delegate: loaded.delegate,
        fallback: loaded.fallback,
        width: size.width,
        height: size.height,
        sourceWidth: source.videoWidth,
        sourceHeight: source.videoHeight,
        cameraFps: stream.getVideoTracks()[0]?.getSettings().frameRate ?? 0,
      });
      performanceMeter.reset(performance.now());
      hologram.resetRenderStats(performance.now());
      document.addEventListener("visibilitychange", suspend);
      setStatus("running");
      statsTimer = window.setInterval(() => {
        if (!current() || document.hidden) return;
        const now = performance.now();
        setStats({
          ...performanceMeter.snapshot(now),
          ...hologram.takeRenderStats(now),
          hands: latest?.landmarks.length ?? 0,
          labels:
            latest?.handedness.map((hand) => hand[0]?.categoryName ?? "") ?? [],
          fxParticles: effectsRef.current?.metrics.particles ?? 0,
          fxStrands: effectsRef.current?.metrics.strands ?? 0,
        });
        performanceMeter.reset(now);
      }, 1000);

      const render = () => {
        if (!current()) return;
        renderRaf = requestAnimationFrame(render);
        if (document.hidden) return;
        if (performance.now() > cursorExpiresAt) {
          airCanvas.current.interrupt();
          hologram.interrupt();
          updateInteractionCursor(cursorRef.current, undefined, 0, 0);
          cursorExpiresAt = Infinity;
        }
        const sample = pending;
        const redrawSkeleton = drawnRevision !== skeletonRevision.current;
        const effects =
          modeRef.current === "air-canvas" ? effectsRef.current : null;
        if (
          !sample &&
          (!latest || !redrawSkeleton) &&
          !effects?.hasWork &&
          !(modeRef.current === "magic" && magic.current.hasWork)
        )
          return;
        pending = undefined;
        const started = performance.now();
        try {
          const result = sample?.result ?? latest!;
          const canvas = canvasRef.current!;
          if (
            canvas.width !== source.videoWidth ||
            canvas.height !== source.videoHeight
          ) {
            canvas.width = source.videoWidth;
            canvas.height = source.videoHeight;
          }
          if (sample || (latest && redrawSkeleton))
            drawSkeleton(canvas, result.landmarks, skeletonRef.current);
          drawnRevision = skeletonRevision.current;
          // A detection sample is consumed at most once. RAF never adds points
          // from repeated or predicted landmarks just to inflate drawing FPS.
          const drawing = drawingCanvasRef.current;
          if (drawing && sample) {
            airCanvas.current.resize(
              drawing,
              source.videoWidth,
              source.videoHeight,
            );
            if (modeRef.current !== "tracking") {
              const hands = result.landmarks.map((landmarks, index) => ({
                landmarks,
                geometry: result.worldLandmarks[index] ?? landmarks,
                label: result.handedness[index]?.[0]?.categoryName ?? "",
              }));
              hologram.setVideoSize(source.videoWidth, source.videoHeight);
              if (modeRef.current === "magic")
                magic.current.update(hands, sample.timestamp);
              const cursor =
                modeRef.current === "magic"
                  ? undefined
                  : modeRef.current === "hologram"
                    ? hologram.update(
                        hands,
                        sample.timestamp,
                        performance.now(),
                      )
                    : airCanvas.current.update(
                        drawing,
                        hands,
                        sample.timestamp,
                      );
              updateInteractionCursor(
                cursorRef.current,
                cursor,
                source.videoWidth,
                source.videoHeight,
                cursorViewport.current,
              );
              cursorExpiresAt = cursor ? performance.now() + 180 : Infinity;
            }
          }
          if (modeRef.current === "magic" && magicCanvasRef.current) {
            magic.current.render(
              magicCanvasRef.current,
              performance.now(),
              source.videoWidth,
              source.videoHeight,
            );
          }
          if (effects) {
            try {
              effects.resize(source.videoWidth, source.videoHeight);
              effects.render(performance.now());
            } catch (cause) {
              disableEffects(`Erreur du rendu GPU : ${explain(cause)}`);
            }
          }
          performanceMeter.rendered(performance.now() - started);
        } catch (cause) {
          fail(cause);
        }
      };
      const scheduleDetection = () => {
        if (!current()) return;
        if (typeof source.requestVideoFrameCallback === "function") {
          videoCallback = true;
          detectionCallback = source.requestVideoFrameCallback((_, metadata) =>
            detect(metadata.mediaTime),
          );
        } else {
          videoCallback = false;
          detectionCallback = requestAnimationFrame(() =>
            detect(source.currentTime),
          );
        }
      };
      const detect = (mediaTime: number) => {
        if (!current()) return;
        if (document.hidden || source.readyState < 2) {
          airCanvas.current.interrupt();
          hologram.interrupt();
          updateInteractionCursor(cursorRef.current, undefined, 0, 0);
          scheduleDetection();
          return;
        }
        const started = performance.now();
        if (!gate.accept(mediaTime, started)) {
          scheduleDetection();
          return;
        }
        try {
          if (
            source.videoWidth !== sourceWidth ||
            source.videoHeight !== sourceHeight
          ) {
            airCanvas.current.interrupt();
            pending = undefined;
            sourceWidth = source.videoWidth;
            sourceHeight = source.videoHeight;
            size = inferenceSize(sourceWidth, sourceHeight, inputWidth);
            inferenceInput.width = size.width;
            inferenceInput.height = size.height;
            nativeSize =
              size.width === sourceWidth && size.height === sourceHeight;
            setEngine((previous) => ({
              ...previous,
              width: size.width,
              height: size.height,
              sourceWidth,
              sourceHeight,
            }));
          }
          if (!nativeSize)
            inputContext.drawImage(source, 0, 0, size.width, size.height);
          const prepared = performance.now();
          const result = detector!.detectForVideo(
            nativeSize ? source : inferenceInput,
            prepared,
          );
          const finished = performance.now();
          performanceMeter.detected(finished - prepared, prepared - started);
          latest = result;
          pending = { result, timestamp: started };
          scheduleDetection();
        } catch (cause) {
          fail(
            new Error(
              `Erreur MediaPipe : ${explain(cause)}. Si le GPU est indisponible, essayez le moteur CPU.`,
            ),
          );
        }
      };
      renderRaf = requestAnimationFrame(render);
      scheduleDetection();
    } catch (cause) {
      fail(cause);
    }
  };
  return {
    videoRef,
    magicCanvasRef,
    canvasRef,
    drawingCanvasRef,
    effectsCanvasRef,
    effectsStatus,
    effectsError,
    cursorRef,
    mode,
    hologram,
    changeMode,
    clearDrawing,
    brushSettings,
    changeBrush,
    status,
    error,
    stats,
    engine,
    enginePreference,
    setEnginePreference,
    inputWidth,
    setInputWidth,
    start,
    stop,
    skeleton,
    toggleSkeleton,
  };
}
