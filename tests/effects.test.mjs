import test from "node:test";
import assert from "node:assert/strict";
import {
  EffectSimulation,
  MAX_PARTICLES,
  MAX_POINTS,
  MAX_STRANDS,
  STRIP_POINTS,
  writeEffectGeometry,
} from "../src/effectSimulation.ts";
import { DEFAULT_BRUSH, normalizeBrush } from "../src/brushes.ts";

const segment = (brush = "energy-ribbon", x = 0.3) => ({
  from: { x, y: 0.3 },
  control: { x: x + 0.03, y: 0.4 },
  to: { x: x + 0.06, y: 0.35 },
  settings: { ...DEFAULT_BRUSH, brush, width: 9 },
  dot: false,
});
const buffers = () => [
  new Float32Array(STRIP_POINTS * 4),
  new Float32Array(STRIP_POINTS * 4),
];

test("les trois nouveaux pinceaux sont normalisés sans perdre les classiques", () => {
  for (const brush of [
    "energy-ribbon",
    "lightning",
    "cosmic-trail",
    "neon",
    "laser",
    "particles",
  ])
    assert.equal(normalizeBrush({ ...DEFAULT_BRUSH, brush }).brush, brush);
});
test("fermer un trait crée deux géométries distinctes, sans raccord", () => {
  const model = new EffectSimulation();
  model.emit(segment());
  model.endStroke();
  model.emit(segment("energy-ribbon", 0.7));
  assert.equal(model.strands.length, 2);
  assert.ok(model.strands[0].points.every((p) => p.x < 600));
  assert.ok(model.strands[1].points.every((p) => p.x > 800));
});
test("les anciens styles restent capturés lors d’un changement de paramètres", () => {
  const model = new EffectSimulation();
  const old = segment();
  model.emit(old);
  old.settings.color = "#ff0000";
  model.emit({ ...segment(), settings: { ...old.settings, width: 20 } });
  assert.equal(model.strands.length, 2);
  assert.equal(model.strands[0].settings.color, DEFAULT_BRUSH.color);
  assert.equal(model.strands[0].settings.width, 9);
});
test("rubans et éclairs restent animés puis sont transmis à la texture persistante", () => {
  for (const [brush, lifetime] of [
    ["energy-ribbon", 6],
    ["lightning", 2.4],
  ]) {
    const model = new EffectSimulation();
    model.emit(segment(brush));
    model.endStroke();
    model.advance(lifetime - 0.1);
    assert.equal(model.strands.length, 1);
    model.advance(0.2);
    assert.equal(model.strands.length, 0);
    assert.equal(model.retired.length, 1);
    assert.ok(model.retired[0].points.length > 1);
  }
});
test("Cosmic Trail se déplace et expire réellement, sans résidu persistant", () => {
  const model = new EffectSimulation(() => 0.5);
  model.emit(segment("cosmic-trail"));
  const spark = model.sparks.find((p) => p.active);
  const x = spark.x;
  model.advance(1 / 30);
  assert.notEqual(spark.x, x);
  assert.ok(spark.age > 0);
  model.advance(4);
  assert.equal(model.particleCount, 0);
  assert.equal(model.strands.length, 0);
  assert.equal(model.retired.length, 0);
});
test("Lightning émet des étincelles, le ruban n’émet pas de poussière cosmique", () => {
  const lightning = new EffectSimulation();
  lightning.emit(segment("lightning"));
  assert.ok(lightning.particleCount > 0);
  assert.ok(lightning.sparks.filter((p) => p.active).every((p) => !p.cosmic));
  const ribbon = new EffectSimulation();
  ribbon.emit(segment());
  assert.equal(ribbon.particleCount, 0);
});
test("budgets de particules, traits et points bornés lors d’un dessin prolongé", () => {
  const model = new EffectSimulation(() => 0.5);
  for (let i = 0; i < 1000; i++) {
    if (i % 2 === 0) model.endStroke();
    model.emit(
      segment(
        i % 3 === 0 ? "cosmic-trail" : "lightning",
        0.2 + (i % 10) * 0.03,
      ),
    );
    model.advance(1 / 60);
    assert.ok(model.strands.length <= MAX_STRANDS);
    assert.ok(model.strands.every((s) => s.points.length <= MAX_POINTS));
    model.retired.length = 0; // renderer bakes these at the end of this frame
  }
  assert.equal(model.sparks.length, MAX_PARTICLES);
  assert.ok(model.particleCount <= MAX_PARTICLES);
});
test("buffers finis, ruban ondulant et éclair ramifié changent avec le temps", () => {
  for (const brush of ["energy-ribbon", "lightning"]) {
    const model = new EffectSimulation();
    model.emit(segment(brush));
    const [tube, core] = buffers();
    writeEffectGeometry(model.strands[0], 0, tube, core);
    const before = tube.slice();
    writeEffectGeometry(model.strands[0], 0.2, tube, core);
    assert.ok(tube.every(Number.isFinite));
    assert.ok(core.every(Number.isFinite));
    assert.ok(tube.some((n, i) => n !== before[i]));
    if (brush === "lightning") {
      const at = model.strands[0].points.length * 4;
      assert.ok(
        tube.slice(at).some((n, i) => Math.abs(n - core[at + i]) > 0.1),
        "ramifications avec épaisseur réelle",
      );
    }
  }
});
test("un point isolé produit une surface visible, pas des triangles de surface nulle", () => {
  const model = new EffectSimulation();
  model.emit({ ...segment(), dot: true });
  const [tube, core] = buffers();
  writeEffectGeometry(model.strands[0], 0, tube, core);
  const area =
    (tube[2] - tube[0]) * (tube[5] - tube[1]) -
    (tube[3] - tube[1]) * (tube[4] - tube[0]);
  assert.ok(Math.abs(area) > 0);
});

test("la largeur d’un ruban horizontal reste perpendiculaire à son trajet", () => {
  const model = new EffectSimulation();
  model.emit({
    ...segment(),
    control: { x: 0.33, y: 0.3 },
    to: { x: 0.36, y: 0.3 },
  });
  const [tube, core] = buffers();
  writeEffectGeometry(model.strands[0], 0, tube, core);
  assert.equal(tube[0], tube[2]);
  assert.notEqual(tube[1], tube[3]);
});
test("effacer purge les effets actifs et la file de fixation", () => {
  const model = new EffectSimulation();
  model.emit(segment());
  model.advance(7);
  model.emit(segment("cosmic-trail"));
  model.clear();
  assert.equal(model.active, false);
  assert.equal(model.retired.length, 0);
  assert.equal(model.particleCount, 0);
  model.emit(segment("lightning"));
  assert.equal(model.strands.length, 1);
});
