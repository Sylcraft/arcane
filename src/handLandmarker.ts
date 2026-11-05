import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

// MediaPipe initializes a global WASM factory. Serialize initialization so a
// cancelled session followed by a restart cannot race that shared loader.
let initialization: Promise<void> = Promise.resolve();

export type Delegate = "GPU" | "CPU";
export type EnginePreference = "auto" | Delegate;
export type LoadedDetector = {
  detector: HandLandmarker;
  delegate: Delegate;
  fallback: string;
};

export async function selectDelegate<T>(
  preference: EnginePreference,
  create: (delegate: Delegate) => Promise<T>,
) {
  if (preference !== "auto")
    return {
      detector: await create(preference),
      delegate: preference,
      fallback: "",
    };
  try {
    return {
      detector: await create("GPU"),
      delegate: "GPU" as const,
      fallback: "",
    };
  } catch (cause) {
    const fallback =
      cause instanceof Error ? cause.message : "GPU indisponible";
    return {
      detector: await create("CPU"),
      delegate: "CPU" as const,
      fallback,
    };
  }
}

export function createHandLandmarker(
  preference: EnginePreference = "auto",
): Promise<LoadedDetector> {
  const result = initialization.then(async () => {
    const files = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm",
    );
    return selectDelegate(preference, (delegate) =>
      HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate,
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      }),
    );
  });
  initialization = result.then(
    () => {},
    () => {},
  );
  return result;
}
