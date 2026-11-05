import type { AdvancedBrush, BrushSettings, Position } from "./brushes";

export const MAX_STRANDS = 18;
export const MAX_POINTS = 112;
export const MAX_PARTICLES = 1000;
export const STRIP_POINTS = 168;
export type EffectSegment = {
  from: Position;
  control: Position;
  to: Position;
  settings: BrushSettings;
  dot: boolean;
};
export type EffectSink = {
  emit: (segment: EffectSegment) => void;
  endStroke: () => void;
  clear: () => void;
};
export type Strand = {
  id: number;
  brush: AdvancedBrush;
  settings: BrushSettings;
  points: Position[];
  speed: number;
  lastEmission: number;
};
export type Spark = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  alpha: number;
  color: number;
  cosmic: boolean;
  spin: number;
};
const pixel = (p: Position) => ({ x: p.x * 1280, y: p.y * 720 });

// Pure, bounded simulation. No Pixi/DOM dependency: interaction and lifetime
// rules can be tested without a WebGL context or a physical webcam.
export class EffectSimulation implements EffectSink {
  readonly strands: Strand[] = [];
  readonly retired: Strand[] = [];
  readonly sparks: Spark[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 1,
    alpha: 0,
    color: 0xffffff,
    cosmic: false,
    spin: 0,
  }));
  time = 0;
  private current: Strand | undefined;
  private id = 0;
  private slot = 0;
  private lastEmission = 0;
  private random: () => number;
  constructor(random: () => number = Math.random) {
    this.random = random;
  }
  get particleCount() {
    return this.sparks.reduce(
      (count, spark) => count + Number(spark.active),
      0,
    );
  }
  get active() {
    return (
      this.strands.length > 0 ||
      this.retired.length > 0 ||
      this.sparks.some((p) => p.active)
    );
  }
  endStroke() {
    this.current = undefined;
  }
  clear() {
    this.strands.length = 0;
    this.retired.length = 0;
    this.current = undefined;
    this.sparks.forEach((p) => {
      p.active = false;
    });
  }
  private spawn(
    point: Position,
    tangent: Position,
    settings: BrushSettings,
    cosmic: boolean,
    speed: number,
  ) {
    const spark = this.sparks[this.slot++ % MAX_PARTICLES];
    const angle = this.random() * Math.PI * 2;
    const spread = (cosmic ? 20 : 70) + this.random() * (cosmic ? 85 : 150);
    Object.assign(spark, {
      active: true,
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * spread + tangent.x * speed * 0.12,
      vy: Math.sin(angle) * spread + tangent.y * speed * 0.12,
      age: 0,
      life: cosmic ? 1.4 + this.random() * 2.2 : 0.2 + this.random() * 0.55,
      size:
        (cosmic ? 4 : 2) + this.random() * settings.width * (cosmic ? 2 : 0.5),
      alpha:
        (0.25 + (settings.glow / 100) * 0.75) * (0.5 + this.random() * 0.5),
      color:
        this.random() > 0.87
          ? 0xffffff
          : Number.parseInt(settings.color.slice(1), 16),
      cosmic,
      spin: (this.random() - 0.5) * 2,
    });
  }
  emit(segment: EffectSegment) {
    const { settings } = segment;
    if (
      !["energy-ribbon", "lightning", "cosmic-trail"].includes(settings.brush)
    )
      return;
    if (
      this.current &&
      (settings.brush !== this.current.settings.brush ||
        settings.color !== this.current.settings.color ||
        settings.width !== this.current.settings.width ||
        settings.glow !== this.current.settings.glow)
    )
      this.current = undefined;
    const from = pixel(segment.from),
      control = pixel(segment.control),
      to = pixel(segment.to);
    const dx = to.x - from.x,
      dy = to.y - from.y,
      length = Math.hypot(dx, dy);
    const tangent =
      length > 0.001 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
    const speed = Math.min(
      1600,
      length / Math.max(1 / 60, Math.min(0.1, this.time - this.lastEmission)),
    );
    this.lastEmission = this.time;
    const count = segment.dot
      ? 1
      : Math.min(
          20,
          Math.max(
            1,
            Math.ceil(
              (Math.hypot(control.x - from.x, control.y - from.y) +
                Math.hypot(to.x - control.x, to.y - control.y)) /
                9,
            ),
          ),
        );
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count,
        u = 1 - t;
      const point = {
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      };
      if (settings.brush !== "cosmic-trail") {
        if (
          !this.current ||
          this.current.points.length >= MAX_POINTS ||
          this.current.settings.brush !== settings.brush ||
          this.current.settings.color !== settings.color ||
          this.current.settings.width !== settings.width ||
          this.current.settings.glow !== settings.glow
        ) {
          const bridge = this.current?.points.at(-1);
          if (this.strands.length >= MAX_STRANDS)
            this.retired.push(this.strands.shift()!);
          this.current = {
            id: this.id++,
            brush: settings.brush as AdvancedBrush,
            settings: { ...settings },
            points: bridge ? [{ ...bridge }] : segment.dot ? [] : [{ ...from }],
            speed,
            lastEmission: this.time,
          };
          this.strands.push(this.current);
        }
        this.current.points.push(point);
        this.current.speed = this.current.speed * 0.6 + speed * 0.4;
        this.current.lastEmission = this.time;
      }
      const particles =
        settings.brush === "cosmic-trail"
          ? segment.dot
            ? 12
            : 3
          : settings.brush === "lightning" && i % 4 === 0
            ? 1
            : 0;
      for (let n = 0; n < particles; n++)
        this.spawn(
          point,
          tangent,
          settings,
          settings.brush === "cosmic-trail",
          speed,
        );
    }
  }
  advance(seconds: number) {
    const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const dt = Math.min(0.05, elapsed);
    this.time += elapsed;
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const strand = this.strands[i];
      if (
        this.time - strand.lastEmission >
        (strand.brush === "lightning" ? 2.4 : 6)
      ) {
        this.retired.push(strand);
        this.strands.splice(i, 1);
        if (this.current === strand) this.current = undefined;
      }
    }
    for (const spark of this.sparks) {
      if (!spark.active) continue;
      spark.age += elapsed;
      if (spark.age >= spark.life) {
        spark.active = false;
        continue;
      }
      const vx = spark.vx,
        drag = Math.exp(-dt * (spark.cosmic ? 0.45 : 1.5));
      spark.vx = (spark.vx - spark.vy * spark.spin * dt) * drag;
      spark.vy =
        (spark.vy + vx * spark.spin * dt + (spark.cosmic ? -3 : 150) * dt) *
        drag;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
    }
  }
}

const noise = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

// Fixed-size vertex buffers, reused by both GPU strips. Transparent texture
// edges create the halo without a full-screen blur/filter pass.
export function writeEffectGeometry(
  strand: Strand,
  time: number,
  tube: Float32Array,
  core: Float32Array,
  centers: Float32Array = new Float32Array(MAX_POINTS * 2),
) {
  const points =
    strand.points.length === 1
      ? [
          { x: strand.points[0].x - 1, y: strand.points[0].y },
          { x: strand.points[0].x + 1, y: strand.points[0].y },
        ]
      : strand.points;
  let index = 0;
  const put = (x: number, y: number, nx: number, ny: number, width: number) => {
    if (index >= STRIP_POINTS) return;
    const at = index++ * 4;
    const dx = nx * width,
      dy = ny * width,
      factor = strand.brush === "lightning" ? 0.09 : 0.17;
    tube[at] = x + dx;
    tube[at + 1] = y + dy;
    tube[at + 2] = x - dx;
    tube[at + 3] = y - dy;
    core[at] = x + dx * factor;
    core[at + 1] = y + dy * factor;
    core[at + 2] = x - dx * factor;
    core[at + 3] = y - dy * factor;
  };
  const width = strand.settings.width;
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      before = points[Math.max(0, i - 1)],
      after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x,
      dy = after.y - before.y,
      length = Math.hypot(dx, dy);
    const nx = length > 0.001 ? -dy / length : 1,
      ny = length > 0.001 ? dx / length : 0;
    const envelope = Math.sin((Math.PI * i) / Math.max(1, points.length - 1));
    const lightning = strand.brush === "lightning";
    const wave = lightning
      ? noise(strand.id * 71 + i * 3.1 + Math.floor(time * 18) * 13) *
        (3 + width + strand.speed * 0.006) *
        envelope
      : Math.sin(i * 0.5 - time * 4 + strand.id) * width * 0.65 * envelope;
    const x = p.x + nx * wave,
      y = p.y + ny * wave;
    centers[i * 2] = x;
    centers[i * 2 + 1] = y;
    put(
      x,
      y,
      nx,
      ny,
      lightning
        ? width * 1.1
        : width *
            (1.6 + Math.min(strand.speed / 900, 1)) *
            (0.25 + 0.75 * Math.max(0, envelope)) *
            (0.85 + Math.sin(time * 3 - i * 0.4) * 0.15),
    );
  }
  if (strand.brush === "lightning" && points.length >= 4) {
    for (let branch = 0; branch < 3; branch++) {
      put(
        centers[(points.length - 1) * 2],
        centers[(points.length - 1) * 2 + 1],
        1,
        0,
        0,
      );
      const rootIndex =
        Math.min(
          points.length - 1,
          Math.floor(points.length * (0.2 + branch * 0.22)),
        ) * 2;
      const rootX = centers[rootIndex],
        rootY = centers[rootIndex + 1];
      put(rootX, rootY, 1, 0, 0);
      const angle = noise(strand.id + branch * 31) * Math.PI;
      const length = width * 7 + 25 + Math.min(strand.speed * 0.03, 45);
      const nx = -Math.sin(angle),
        ny = Math.cos(angle);
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const jitter =
          noise(i * 5 + branch * 71 + Math.floor(time * 22)) *
          width *
          1.5 *
          Math.sin(t * Math.PI);
        put(
          rootX + Math.cos(angle) * length * t + nx * jitter,
          rootY + Math.sin(angle) * length * t + ny * jitter,
          nx,
          ny,
          width * 0.5 * (1 - t),
        );
      }
      const end = (index - 1) * 4;
      put(tube[end], tube[end + 1], 1, 0, 0);
    }
  }
  const last = Math.max(0, index - 1) * 4;
  const x = (tube[last] + tube[last + 2]) / 2 || points[0]?.x || 0;
  const y = (tube[last + 1] + tube[last + 3]) / 2 || points[0]?.y || 0;
  while (index < STRIP_POINTS) put(x, y, 1, 0, 0);
}
