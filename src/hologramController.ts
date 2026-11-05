import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { PINCH_OPEN, PinchGesture, pinchRatio } from "./pinchGesture.ts";
import { StrokeFilter } from "./strokeFilter.ts";
import type { InteractionCursor } from "./interactionCursor";

type Hand = {
  landmarks: NormalizedLandmark[];
  geometry: Pick<Landmark, "x" | "y" | "z">[];
  label: string;
};
export type HitArea = { x: number; y: number; rx: number; ry: number };
type Point = { x: number; y: number };

// The video is contained, while the 3D canvas fills the stage. Account for the
// letterbox and mirror before testing proximity or applying rotation deltas.
export function handToViewport(
  point: Point,
  videoWidth: number,
  videoHeight: number,
  width: number,
  height: number,
): Point {
  const scale = Math.min(width / videoWidth, height / videoHeight);
  return {
    x:
      ((width - videoWidth * scale) / 2 + (1 - point.x) * videoWidth * scale) /
      width,
    y:
      ((height - videoHeight * scale) / 2 + point.y * videoHeight * scale) /
      height,
  };
}

export class HologramController {
  readonly rotation = {
    x: 0.13,
    y: -0.24,
    z: 0.03,
    w: Math.sqrt(1 - 0.13 ** 2 - 0.24 ** 2 - 0.03 ** 2),
  };
  grabbed = false;
  hovered = false;
  private pinch = new PinchGesture();
  private filter = new StrokeFilter();
  private owner: string | undefined;
  private last: (Point & { time: number }) | undefined;
  private lastRotationPoint: Point | undefined;
  private pinching = false;
  private armed = true;
  private width = 1280;
  private height = 720;
  private videoWidth = 1280;
  private videoHeight = 720;
  private hit: HitArea | undefined;
  private renderStart = 0;
  private renderCount = 0;
  private renderTime = 0;
  private receivedAt = -Infinity;

  setViewport(width: number, height: number, hit: HitArea) {
    if (width !== this.width || height !== this.height) this.interrupt();
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.hit = hit;
  }
  setVideoSize(width: number, height: number) {
    if (width !== this.videoWidth || height !== this.videoHeight)
      this.interrupt();
    this.videoWidth = Math.max(1, width);
    this.videoHeight = Math.max(1, height);
  }
  interrupt() {
    this.grabbed = false;
    this.hovered = false;
    this.owner = undefined;
    this.last = undefined;
    this.receivedAt = -Infinity;
    this.lastRotationPoint = undefined;
    this.pinch.reset();
    this.filter.reset();
    this.pinching = false;
    // After a lost hand/mode change, require an observed release before a new
    // grab. A returning closed hand must never restart manipulation by itself.
    this.armed = false;
  }
  expire(now: number) {
    if (this.last && now - this.receivedAt > 180) this.interrupt();
  }
  private turn(dx: number, dy: number) {
    // Camera-facing yaw/pitch, premultiplied into a normalized quaternion.
    // No Euler accumulation/gimbal lock, no inertia after release.
    const sy = Math.sin(dx * 2.7),
      cy = Math.cos(dx * 2.7);
    const sx = Math.sin(dy * 2.7),
      cx = Math.cos(dy * 2.7);
    const q = this.rotation;
    const x = cy * q.x + sy * q.z,
      y = cy * q.y + sy * q.w;
    const z = cy * q.z - sy * q.x,
      w = cy * q.w - sy * q.y;
    q.x = cx * x + sx * w;
    q.y = cx * y - sx * z;
    q.z = cx * z + sx * y;
    q.w = cx * w - sx * x;
    const length = Math.hypot(q.x, q.y, q.z, q.w);
    q.x /= length;
    q.y /= length;
    q.z /= length;
    q.w /= length;
  }
  update(
    hands: Hand[],
    time: number,
    receivedAt = time,
  ): InteractionCursor | undefined {
    const candidates = hands.filter(
      (h) => h.label && Number.isFinite(pinchRatio(h.geometry)),
    );
    const hand = this.owner
      ? candidates.find((h) => h.label === this.owner)
      : candidates[0];
    if (!hand || hands.filter((h) => h.label === hand.label).length !== 1) {
      this.hovered = false;
      this.lastRotationPoint = undefined;
      this.filter.reset();
      if (!this.last || time - this.last.time > 100) this.interrupt();
      return undefined;
    }
    const tip = hand.landmarks[8];
    if (
      !tip ||
      !Number.isFinite(tip.x) ||
      !Number.isFinite(tip.y) ||
      tip.x < 0 ||
      tip.x > 1 ||
      tip.y < 0 ||
      tip.y > 1
    ) {
      this.interrupt();
      return undefined;
    }
    if (
      this.last &&
      (time <= this.last.time ||
        time - this.last.time > 200 ||
        Math.hypot(tip.x - this.last.x, tip.y - this.last.y) > 0.18)
    ) {
      this.interrupt();
    }
    this.owner = hand.label;
    this.last = { x: tip.x, y: tip.y, time };
    this.receivedAt = receivedAt;
    const filtered = this.filter.update(tip, time);
    const point = handToViewport(
      filtered,
      this.videoWidth,
      this.videoHeight,
      this.width,
      this.height,
    );
    const hit = this.hit;
    const near =
      hit && hit.rx > 0 && hit.ry > 0
        ? ((point.x - hit.x) / hit.rx) ** 2 +
            ((point.y - hit.y) / hit.ry) ** 2 <=
          1
        : false;
    const ratio = pinchRatio(hand.geometry);
    const state = this.pinch.update(ratio, time);
    this.hovered = near;
    if (state === "hover") {
      this.grabbed = false;
      this.pinching = false;
      this.lastRotationPoint = undefined;
      if (ratio >= PINCH_OPEN) this.armed = true;
      return { ...filtered, state: "hover" };
    }
    if (state === "holding") {
      this.lastRotationPoint = point;
      return { ...filtered, state: this.grabbed ? "holding" : "hover" };
    }
    if (!this.pinching && this.armed && near) {
      this.grabbed = true;
      this.lastRotationPoint = point;
    }
    this.pinching = true;
    if (this.grabbed) {
      if (this.lastRotationPoint)
        this.turn(
          point.x - this.lastRotationPoint.x,
          point.y - this.lastRotationPoint.y,
        );
      this.lastRotationPoint = point;
    }
    return { ...filtered, state: this.grabbed ? "drawing" : "hover" };
  }
  resetRenderStats(now: number) {
    this.renderStart = now;
    this.renderCount = 0;
    this.renderTime = 0;
  }
  recordRender(now: number, duration: number) {
    if (!this.renderStart) this.renderStart = now;
    this.renderCount++;
    this.renderTime += duration;
  }
  takeRenderStats(now: number) {
    const result = {
      hologramFps:
        Math.round(
          (this.renderCount * 10000) / Math.max(1, now - this.renderStart),
        ) / 10,
      hologramMs: this.renderCount
        ? Math.round((this.renderTime / this.renderCount) * 10) / 10
        : 0,
    };
    this.resetRenderStats(now);
    return result;
  }
}
