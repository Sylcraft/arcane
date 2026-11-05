import type { Position } from "./brushes";

const alpha = (cutoff: number, dt: number) =>
  1 - Math.exp(-2 * Math.PI * cutoff * dt);

// Adaptive low-pass: steady hands get stronger smoothing, fast movements get
// a higher cutoff. Time-based coefficients keep the response similar at 15/30/60fps.
export class StrokeFilter {
  private last: (Position & { time: number }) | undefined;
  private filtered: Position = { x: 0, y: 0 };
  private velocity = 0;
  reset() {
    this.last = undefined;
    this.velocity = 0;
  }
  update(point: Position, time: number): Position {
    if (!this.last) {
      this.last = { ...point, time };
      this.filtered = { ...point };
      return this.filtered;
    }
    const dt = Math.max(0.001, Math.min(0.2, (time - this.last.time) / 1000));
    const speed = Math.hypot(point.x - this.last.x, point.y - this.last.y) / dt;
    this.velocity += alpha(1.5, dt) * (speed - this.velocity);
    const weight = alpha(Math.min(24, 2.2 + 8 * this.velocity), dt);
    this.filtered = {
      x: this.filtered.x + weight * (point.x - this.filtered.x),
      y: this.filtered.y + weight * (point.y - this.filtered.y),
    };
    this.last = { ...point, time };
    return this.filtered;
  }
}
