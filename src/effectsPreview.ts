// Development-only entry, opened by tests/effects-preview.html, never imported
// by the application. Exercises the real renderer without webcam permission.
import { PixiEffects } from "./PixiEffects";
import type { AdvancedBrush, BrushSettings } from "./brushes";
const canvas = document.querySelector<HTMLCanvasElement>("#effects")!;
const status = document.querySelector<HTMLElement>("#status")!;
let engine: PixiEffects | undefined,
  raf = 0;
let settings: BrushSettings = {
  brush: "energy-ribbon",
  color: "#62efef",
  width: 10,
  glow: 85,
};
let emitting = true;
document.querySelectorAll<HTMLButtonElement>("[data-brush]").forEach((button) =>
  button.addEventListener("click", () => {
    engine?.endStroke();
    settings = {
      ...settings,
      brush: button.dataset.brush as AdvancedBrush,
      color:
        button.dataset.brush === "lightning"
          ? "#ae8bff"
          : button.dataset.brush === "cosmic-trail"
            ? "#ff6ec7"
            : "#62efef",
    };
    document
      .querySelectorAll("[data-brush]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
  }),
);
document
  .querySelector("#clear")!
  .addEventListener("click", () => engine?.clear());
document.querySelector("#pause")!.addEventListener("click", (event) => {
  emitting = !emitting;
  engine?.endStroke();
  (event.currentTarget as HTMLButtonElement).textContent = emitting
    ? "Suspendre l’émission"
    : "Reprendre l’émission";
});
void PixiEffects.create(canvas, (message) => {
  status.textContent = message;
})
  .then((ready) => {
    engine = ready;
    engine.resize(1280, 720);
    let lastSample = 0,
      lastReport = performance.now(),
      frames = 0;
    let previous: { x: number; y: number } | undefined;
    const started = performance.now();
    const frame = (now: number) => {
      const t = (now - started) / 1000;
      if (emitting && now - lastSample >= 32) {
        const next = {
          x: 0.5 + Math.cos(t * 1.6) * Math.sin(t * 0.45 + 0.8) * 0.32,
          y: 0.5 + Math.sin(t * 2.1) * 0.29,
        };
        engine!.emit({
          from: previous ?? next,
          control: previous ?? next,
          to: next,
          settings,
          dot: !previous,
        });
        previous = next;
        lastSample = now;
      } else if (!emitting) previous = undefined;
      if (engine!.render(now)) frames++;
      if (now - lastReport >= 500) {
        const metrics = engine!.metrics;
        status.textContent = `WebGL actif · Rendu ${Math.round((frames * 1000) / (now - lastReport))} fps · ${metrics.strands} rubans/arcs · ${metrics.particles} particules`;
        frames = 0;
        lastReport = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  })
  .catch((cause) => {
    status.textContent = `Erreur GPU : ${String(cause)}`;
  });
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(raf);
  engine?.destroy();
});
