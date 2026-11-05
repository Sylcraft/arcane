import type { CSSProperties } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Brush, BrushSettings } from "./brushes";

const brushes: { id: Brush; name: string; detail: string }[] = [
  { id: "energy-ribbon", name: "Energy Ribbon", detail: "Ruban vivant · GPU" },
  { id: "lightning", name: "Lightning", detail: "Arcs et étincelles · GPU" },
  {
    id: "cosmic-trail",
    name: "Cosmic Trail",
    detail: "Poussière en mouvement · GPU",
  },
  { id: "neon", name: "Neon", detail: "Tube lumineux" },
  { id: "laser", name: "Laser", detail: "Filament précis" },
  { id: "particles", name: "Particles", detail: "Poussière stellaire" },
];
const colors = [
  ["Cyan", "#62efef"],
  ["Rose", "#ff6ec7"],
  ["Violet", "#ae8bff"],
  ["Ambre", "#ffbe55"],
  ["Menthe", "#6affb0"],
  ["Blanc", "#ffffff"],
];

export function BrushPanel({
  settings,
  onChange,
}: {
  settings: BrushSettings;
  onChange: (patch: Partial<BrushSettings>) => void;
}) {
  const style = {
    "--ink": settings.color,
    "--preview-width": `${settings.width / 3 + 1}px`,
    "--preview-glow": `${settings.glow / 5}px`,
  } as CSSProperties;
  return (
    <section
      className="brush-panel"
      style={style}
      aria-labelledby="brush-title"
    >
      <div className="brush-heading">
        <div>
          <SlidersHorizontal size={16} />
          <h2 id="brush-title">Atelier de lumière</h2>
        </div>
        <span>LIVE CONTROLS</span>
      </div>
      <div className="brush-layout">
        <div className="brush-choices" role="group" aria-label="Pinceau">
          {brushes.map((brush) => (
            <button
              key={brush.id}
              aria-pressed={settings.brush === brush.id}
              onClick={() => onChange({ brush: brush.id })}
            >
              <span
                className={`brush-preview preview-${brush.id}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <strong>{brush.name}</strong>
              <small>{brush.detail}</small>
            </button>
          ))}
        </div>
        <div className="ink-controls">
          <div className="ink-label">
            <span>COULEUR</span>
            <output>{settings.color.toUpperCase()}</output>
          </div>
          <div
            className="color-palette"
            role="group"
            aria-label="Palette de couleurs"
          >
            {colors.map(([name, color]) => (
              <button
                key={color}
                aria-label={name}
                title={name}
                aria-pressed={settings.color.toLowerCase() === color}
                onClick={() => onChange({ color })}
                style={{ background: color }}
              />
            ))}
            <label className="custom-color" title="Couleur personnalisée">
              <span>+</span>
              <input
                type="color"
                aria-label="Couleur personnalisée"
                value={settings.color}
                onChange={(e) => onChange({ color: e.target.value })}
              />
            </label>
          </div>
          <label className="brush-slider">
            <span>
              Épaisseur <output>{settings.width} px</output>
            </span>
            <input
              type="range"
              min="2"
              max="24"
              step="1"
              value={settings.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
            />
          </label>
          <label className="brush-slider">
            <span>
              Intensité lumineuse <output>{settings.glow} %</output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.glow}
              onChange={(e) => onChange({ glow: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
      <p>
        Les trois premiers pinceaux sont animés avec PixiJS ; Neon, Laser et
        Particles restent disponibles en classiques. Les réglages s’appliquent
        aux nouveaux traits. Cosmic Trail se dissipe ; rubans et éclairs se
        figent après leur animation.
      </p>
    </section>
  );
}
