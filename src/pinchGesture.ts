import type { Landmark } from "@mediapipe/tasks-vision";
type Point = Pick<Landmark, "x" | "y" | "z">;
const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const PINCH_CLOSE = 0.28;
export const PINCH_OPEN = 0.45;
export type PinchState = "hover" | "drawing" | "holding";

// Ratios in world space remain independent of camera distance and hand rotation.
// Other fingers are deliberately unconstrained. Reject degenerate hand scales.
export function pinchRatio(hand: Point[]): number {
  if (
    hand.length !== 21 ||
    [0, 4, 5, 8, 9, 17].some(
      (i) =>
        !hand[i] || ![hand[i].x, hand[i].y, hand[i].z].every(Number.isFinite),
    )
  )
    return Infinity;
  const scale = Math.max(
    distance(hand[5], hand[17]),
    distance(hand[0], hand[9]) * 0.85,
  );
  return scale > 1e-6 ? distance(hand[4], hand[8]) / scale : Infinity;
}

export class PinchGesture {
  private active = false;
  private closingSince: number | undefined;
  private openingSince: number | undefined;
  reset() {
    this.active = false;
    this.closingSince = undefined;
    this.openingSince = undefined;
  }
  update(ratio: number, time: number): PinchState {
    if (!Number.isFinite(ratio) || ratio < 0) {
      this.reset();
      return "hover";
    }
    if (!this.active) {
      if (ratio <= PINCH_CLOSE) {
        this.closingSince ??= time;
        // A clear contact responds immediately. A marginal pinch must persist
        // for 20 ms (usually one additional detection), never a frame queue.
        if (ratio <= 0.14 || time - this.closingSince >= 20) this.active = true;
      } else this.closingSince = undefined;
      return this.active ? "drawing" : "hover";
    }
    if (ratio >= PINCH_OPEN) {
      this.openingSince ??= time;
      if (ratio >= 0.65 || time - this.openingSince >= 40) {
        this.reset();
        return "hover";
      }
      // No ink during an uncertain release: retain the segment briefly, but
      // never extend it using an open hand or a predicted fingertip position.
      return "holding";
    }
    this.openingSince = undefined;
    return "drawing";
  }
}
