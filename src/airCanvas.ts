import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  DEFAULT_BRUSH,
  isAdvancedBrush,
  normalizeBrush,
  paintBrush,
} from "./brushes.ts";
import type { BrushSettings, Position } from "./brushes";
import { StrokeFilter } from "./strokeFilter.ts";
import { PINCH_CLOSE, PinchGesture, pinchRatio } from "./pinchGesture.ts";
import type { InteractionCursor } from "./interactionCursor";
import type { EffectSink } from "./effectSimulation";

export type TrackingMode = "tracking" | "air-canvas" | "hologram" | "magic";
type DrawingHand = {
  landmarks: NormalizedLandmark[];
  geometry: Pick<Landmark, "x" | "y" | "z">[];
  label: string;
};
type Sample = Position & { rawX: number; rawY: number; time: number };

export class AirCanvas {
  private previous: Sample | undefined;
  private anchor: Position | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private filter = new StrokeFilter();
  private pinch = new PinchGesture();
  private selected: string | undefined;
  private lastInput: { x: number; y: number; time: number } | undefined;
  private settings = { ...DEFAULT_BRUSH };
  private effects: EffectSink | undefined;

  constructor(settings: BrushSettings = DEFAULT_BRUSH) {
    this.settings = normalizeBrush(settings);
  }
  setEffects(effects: EffectSink | undefined) {
    this.endStroke();
    this.effects = effects;
  }

  setSettings(settings: BrushSettings) {
    this.endStroke();
    this.settings = normalizeBrush(settings);
  }

  private paint(
    canvas: HTMLCanvasElement,
    from: Position,
    control: Position,
    to: Position,
    dot = false,
  ) {
    if (isAdvancedBrush(this.settings.brush)) {
      this.effects?.emit({
        from,
        control,
        to,
        settings: { ...this.settings },
        dot,
      });
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = (p: Position) => ({
      x: p.x * canvas.width,
      y: p.y * canvas.height,
    });
    paintBrush(
      ctx,
      pixels(from),
      pixels(control),
      pixels(to),
      this.settings,
      canvas.width / 1280,
      dot,
    );
  }

  private endStroke() {
    if (
      this.canvas &&
      this.anchor &&
      this.previous &&
      Math.hypot(
        this.previous.x - this.anchor.x,
        this.previous.y - this.anchor.y,
      ) > 0.0001
    ) {
      this.paint(this.canvas, this.anchor, this.previous, this.previous);
    }
    this.previous = undefined;
    this.anchor = undefined;
    this.canvas = undefined;
    this.effects?.endStroke();
  }

  interrupt() {
    this.endStroke();
    this.filter.reset();
    this.pinch.reset();
    this.selected = undefined;
    this.lastInput = undefined;
  }

  clear(canvas: HTMLCanvasElement | null) {
    this.endStroke();
    this.effects?.clear();
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  resize(canvas: HTMLCanvasElement, width: number, height: number) {
    if (canvas.width === width && canvas.height === height) return;
    this.interrupt();
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(snapshot, 0, 0, width, height);
  }

  // An isolated missing observation keeps hand ownership/pinch for 100 ms,
  // without drawing across the missing data. Longer losses reset everything.
  private missing(time: number) {
    this.endStroke();
    this.filter.reset();
    if (!this.lastInput || time - this.lastInput.time > 100) this.interrupt();
    return undefined;
  }

  update(
    canvas: HTMLCanvasElement,
    hands: DrawingHand[],
    time: number,
  ): InteractionCursor | undefined {
    const candidates = hands.filter(
      (h) => h.label && Number.isFinite(pinchRatio(h.geometry)),
    );
    const hand = this.selected
      ? candidates.find((h) => h.label === this.selected)
      : (candidates.find((h) => pinchRatio(h.geometry) <= PINCH_CLOSE) ??
        candidates[0]);
    if (!hand || hands.filter((h) => h.label === hand.label).length !== 1)
      return this.missing(time);
    const tip = hand.landmarks[8];
    if (
      !tip ||
      !Number.isFinite(tip.x) ||
      !Number.isFinite(tip.y) ||
      tip.x < 0 ||
      tip.x > 1 ||
      tip.y < 0 ||
      tip.y > 1
    )
      return this.missing(time);

    const lastInput = this.lastInput;
    if (
      lastInput &&
      (time <= lastInput.time ||
        time - lastInput.time > 200 ||
        Math.hypot(tip.x - lastInput.x, tip.y - lastInput.y) > 0.18)
    )
      this.interrupt();
    this.selected = hand.label;
    const filtered = this.filter.update(tip, time);
    this.lastInput = { x: tip.x, y: tip.y, time };
    const state = this.pinch.update(pinchRatio(hand.geometry), time);
    const cursor = { ...filtered, state };
    if (state === "hover") {
      this.endStroke();
      return cursor;
    }
    if (state === "holding") return cursor;

    const last = this.previous;
    const continuous =
      last &&
      time - last.time <= 200 &&
      Math.hypot(tip.x - last.rawX, tip.y - last.rawY) <= 0.18;
    if (!continuous) this.endStroke();
    const next = { ...filtered, rawX: tip.x, rawY: tip.y, time };
    if (continuous) {
      const midpoint = { x: (last.x + next.x) / 2, y: (last.y + next.y) / 2 };
      if (
        this.anchor &&
        Math.hypot(
          (midpoint.x - this.anchor.x) * canvas.width,
          (midpoint.y - this.anchor.y) * canvas.height,
        ) >=
          (0.45 * canvas.width) / 1280
      ) {
        this.paint(canvas, this.anchor, last, midpoint);
        this.anchor = midpoint;
      }
    } else {
      this.paint(canvas, next, next, next, true);
      this.anchor = next;
    }
    this.canvas = canvas;
    this.previous = next;
    return cursor;
  }
}
