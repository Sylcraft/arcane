export type PerformanceStats = {
  detectionFps: number;
  renderFps: number;
  inferenceMs: number;
  inferenceP95: number;
  renderMs: number;
  preparationMs: number;
};
export const EMPTY_PERFORMANCE: PerformanceStats = {
  detectionFps: 0,
  renderFps: 0,
  inferenceMs: 0,
  inferenceP95: 0,
  renderMs: 0,
  preparationMs: 0,
};
const average = (values: number[]) =>
  values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
const round = (value: number) => Math.round(value * 10) / 10;

// Only completed operations are counted. No counter for RAF callbacks, no
// extrapolated landmarks, and no FPS inferred from 1000 / inference time.
export class TrackingPerformance {
  private start = 0;
  private detections = 0;
  private renders = 0;
  private inference: number[] = [];
  private rendering: number[] = [];
  private preparation: number[] = [];
  reset(now: number) {
    this.start = now;
    this.detections = 0;
    this.renders = 0;
    this.inference = [];
    this.rendering = [];
    this.preparation = [];
  }
  detected(inferenceMs: number, preparationMs: number) {
    this.detections++;
    if (this.inference.length < 120) {
      this.inference.push(inferenceMs);
      this.preparation.push(preparationMs);
    }
  }
  rendered(duration: number) {
    this.renders++;
    if (this.rendering.length < 120) this.rendering.push(duration);
  }
  snapshot(now: number): PerformanceStats {
    const seconds = Math.max(0.001, (now - this.start) / 1000);
    const sorted = [...this.inference].sort((a, b) => a - b);
    return {
      detectionFps: round(this.detections / seconds),
      renderFps: round(this.renders / seconds),
      inferenceMs: round(average(this.inference)),
      inferenceP95: round(
        sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
      ),
      renderMs: round(average(this.rendering)),
      preparationMs: round(average(this.preparation)),
    };
  }
}

export function inferenceSize(width: number, height: number, maxWidth: number) {
  const scale = Math.min(1, maxWidth / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Target at most 30 genuinely new camera frames per second. A tolerance avoids
// accidentally halving 29.97/30fps streams because of timestamp rounding.
export class DetectionGate {
  private lastMediaTime = -1;
  private lastStart = -Infinity;
  reset() {
    this.lastMediaTime = -1;
    this.lastStart = -Infinity;
  }
  accept(mediaTime: number, now: number) {
    if (
      mediaTime === this.lastMediaTime ||
      now - this.lastStart < 1000 / 30 - 2
    )
      return false;
    this.lastMediaTime = mediaTime;
    this.lastStart = now;
    return true;
  }
}
