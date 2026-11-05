export type AdvancedBrush = "energy-ribbon" | "lightning" | "cosmic-trail";
export type Brush = "neon" | "laser" | "particles" | AdvancedBrush;
export const isAdvancedBrush = (brush: Brush): brush is AdvancedBrush =>
  ["energy-ribbon", "lightning", "cosmic-trail"].includes(brush);
export type BrushSettings = {
  brush: Brush;
  color: string;
  width: number;
  glow: number;
};
export const DEFAULT_BRUSH: BrushSettings = {
  brush: "neon",
  color: "#62efef",
  width: 5,
  glow: 65,
};
export function normalizeBrush(settings: BrushSettings): BrushSettings {
  return {
    brush: [
      "neon",
      "laser",
      "particles",
      "energy-ribbon",
      "lightning",
      "cosmic-trail",
    ].includes(settings.brush)
      ? settings.brush
      : "neon",
    color: /^#[0-9a-f]{6}$/i.test(settings.color)
      ? settings.color
      : DEFAULT_BRUSH.color,
    width: Number.isFinite(settings.width)
      ? Math.min(24, Math.max(2, settings.width))
      : DEFAULT_BRUSH.width,
    glow: Number.isFinite(settings.glow)
      ? Math.min(100, Math.max(0, settings.glow))
      : DEFAULT_BRUSH.glow,
  };
}
export type Position = { x: number; y: number };
export function paintBrush(
  ctx: CanvasRenderingContext2D,
  from: Position,
  control: Position,
  to: Position,
  settings: BrushSettings,
  scale: number,
  dot = false,
) {
  if (isAdvancedBrush(settings.brush)) return;
  const width = settings.width * scale;
  const glow = settings.glow / 100;
  const path = () => {
    ctx.beginPath();
    if (dot) ctx.arc(to.x, to.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    else {
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
    }
    if (dot) ctx.fill();
    else ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = settings.color;
  ctx.fillStyle = settings.color;
  ctx.lineWidth = width;
  if (settings.brush === "particles") {
    // Spatial resampling: density depends on distance, not frame rate. Static
    // pigment, no particle array or animation loop. Maximum 48 stamps per segment.
    const length =
      Math.hypot(control.x - from.x, control.y - from.y) +
      Math.hypot(to.x - control.x, to.y - control.y);
    const count = dot
      ? 5
      : Math.min(
          48,
          Math.max(1, Math.ceil(length / Math.max(2 * scale, width * 0.45))),
        );
    ctx.shadowColor = settings.color;
    ctx.shadowBlur = glow * 8 * scale;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count,
        u = 1 - t;
      const x = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
      const angle = Math.random() * Math.PI * 2,
        radius = Math.sqrt(Math.random()) * width * 1.8;
      ctx.globalAlpha = 0.45 + Math.random() * 0.5;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        (0.3 + Math.random() * 0.7) * Math.max(scale, width * 0.22),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    ctx.shadowColor = settings.color;
    ctx.shadowBlur = glow * (settings.brush === "neon" ? 18 : 7) * scale;
    if (settings.brush === "neon") {
      // Broad coloured tube with a restrained luminous core.
      path();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = width * 0.28;
      path();
    } else {
      // Laser: precise white-hot filament and a narrow coloured envelope.
      ctx.lineWidth = width * 0.65;
      path();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = Math.max(0.7 * scale, width * 0.12);
      path();
    }
  }
  ctx.restore();
}
