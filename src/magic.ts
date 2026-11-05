import type { Landmark } from "@mediapipe/tasks-vision";

type Point = Pick<Landmark, "x" | "y" | "z">;
type MagicHand = { landmarks: Point[]; geometry: Point[]; label: string };
const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Use joint angles and relative distances, independent of hand scale/orientation.
export function isOpenPalm(points: Point[], holding = false): boolean {
  if (
    points.length !== 21 ||
    points.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))
  )
    return false;
  const scale = distance(points[0], points[9]);
  if (scale < 1e-6) return false;
  return (
    [5, 9, 13, 17].every((base) => {
      const a = points[base],
        b = points[base + 1],
        c = points[base + 3];
      const ux = a.x - b.x,
        uy = a.y - b.y,
        uz = a.z - b.z;
      const vx = c.x - b.x,
        vy = c.y - b.y,
        vz = c.z - b.z;
      const length = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
      return (
        length > 1e-9 &&
        (ux * vx + uy * vy + uz * vz) / length < (holding ? -0.45 : -0.65) &&
        distance(points[0], c) > distance(points[0], b) + scale * 0.15
      );
    }) && distance(points[4], points[5]) > scale * (holding ? 0.3 : 0.4)
  );
}

export class MagicOrb {
  x = 0.5;
  y = 0.5;
  radius = 0.06;
  opacity = 0;
  private target: { x: number; y: number; radius: number } | undefined;
  private selected: string | undefined;
  private lastSample = -Infinity;
  private lastFrame: number | undefined;
  get hasWork() {
    return !!this.target || this.opacity > 0;
  }

  reset() {
    this.target = undefined;
    this.selected = undefined;
    this.opacity = 0;
    this.lastSample = -Infinity;
    this.lastFrame = undefined;
  }

  update(hands: MagicHand[], now: number) {
    const hand =
      this.selected === undefined
        ? hands.find((h) => isOpenPalm(h.geometry))
        : hands.find((h) => h.label === this.selected);
    if (
      !hand ||
      !hand.label ||
      hands.filter((candidate) => candidate.label === hand.label).length !==
        1 ||
      !isOpenPalm(hand.geometry, !!this.target) ||
      hand.landmarks.length !== 21 ||
      hand.landmarks.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))
    ) {
      this.target = undefined;
      // Retain identity while fading; never jump between two visible hands.
      return;
    }
    this.selected = hand.label;
    const palm = [0, 5, 9, 13, 17].map((i) => hand.landmarks[i]);
    const x = palm.reduce((sum, p) => sum + p.x, 0) / palm.length;
    const y = palm.reduce((sum, p) => sum + p.y, 0) / palm.length;
    const radius = Math.min(
      0.1,
      Math.max(0.025, distance(hand.landmarks[0], hand.landmarks[9]) * 0.48),
    );
    if (this.opacity === 0) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      // A stopped renderer has no useful previous frame for a new appearance.
      this.lastFrame = undefined;
    }
    this.target = { x, y, radius };
    this.lastSample = now;
  }

  advance(now: number) {
    const dt =
      this.lastFrame === undefined
        ? 1 / 60
        : Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (now - this.lastSample > 180) this.target = undefined;
    const follow = 1 - Math.exp(-dt * 24);
    if (this.target) {
      this.x += (this.target.x - this.x) * follow;
      this.y += (this.target.y - this.y) * follow;
      this.radius += (this.target.radius - this.radius) * follow;
    }
    const desired = this.target ? 1 : 0;
    this.opacity +=
      (desired - this.opacity) * (1 - Math.exp(-dt * (this.target ? 10 : 6)));
    if (!this.target && this.opacity < 0.005) {
      this.opacity = 0;
      this.selected = undefined;
    }
  }

  render(
    canvas: HTMLCanvasElement,
    now: number,
    width: number,
    height: number,
  ) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.advance(now);
    ctx.clearRect(0, 0, width, height);
    if (!this.opacity) return;
    const t = now / 1000,
      r = this.radius * height * (1 + Math.sin(t * 3) * 0.045);
    ctx.save();
    ctx.translate(this.x * width, this.y * height);
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    halo.addColorStop(0, "#efffff");
    halo.addColorStop(0.16, "#b5ffff");
    halo.addColorStop(0.32, "#37cfffbb");
    halo.addColorStop(0.6, "#6055ff35");
    halo.addColorStop(1, "#5060ff00");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(t * (i % 2 ? -0.7 : 0.5) + i * 1.1);
      ctx.strokeStyle = i === 1 ? "#b6a3ff99" : "#99f6ffbb";
      ctx.lineWidth = Math.max(1, height / 720);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.25, r * (0.35 + i * 0.15), 0, 0, Math.PI * 1.7);
      ctx.stroke();
      ctx.restore();
    }
    // Fixed particle budget; analytic orbits avoid allocations and particle churn.
    for (let i = 0; i < 48; i++) {
      const phase = i * 2.39996 + t * (0.3 + (i % 5) * 0.12);
      const spread = r * (1.1 + (i % 7) / 5);
      const x = Math.cos(phase) * spread,
        y = Math.sin(phase * 1.3 + i) * spread;
      ctx.globalAlpha =
        this.opacity * (0.35 + 0.65 * Math.pow(Math.sin(t * 2 + i), 2));
      ctx.fillStyle = i % 3 ? "#9df5ff" : "#c5a5ff";
      ctx.beginPath();
      ctx.arc(x, y, ((1 + (i % 3)) * height) / 720, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
