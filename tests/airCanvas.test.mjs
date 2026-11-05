import test from "node:test";
import assert from "node:assert/strict";
import { AirCanvas } from "../src/airCanvas.ts";
import { PinchGesture, pinchRatio } from "../src/pinchGesture.ts";
import { updateInteractionCursor } from "../src/interactionCursor.ts";
import { StrokeFilter } from "../src/strokeFilter.ts";
import { DEFAULT_BRUSH, normalizeBrush, paintBrush } from "../src/brushes.ts";

function gesture(ratio = 0.08) {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  points[4] = { x: 0, y: 1, z: 0 };
  for (const [base, x] of [
    [5, -0.5],
    [9, -0.15],
    [13, 0.2],
    [17, 0.5],
  ]) {
    for (let i = 0; i < 4; i++) {
      points[base + i] = {
        x,
        y: base === 5 ? i + 1 : [1, 2, 1.1, 0.8][i],
        z: 0,
      };
    }
  }
  points[4] = { ...points[8], x: points[8].x + ratio };
  return points;
}
function hand(x = 0.3, label = "Right", y = 0.3) {
  const landmarks = gesture();
  landmarks[8] = { x, y, z: 0 };
  return { landmarks, geometry: gesture(), label };
}
function setup() {
  const calls = [];
  const strokes = [];
  const ctx = Object.fromEntries(
    [
      "save",
      "restore",
      "beginPath",
      "moveTo",
      "quadraticCurveTo",
      "stroke",
      "arc",
      "fill",
      "clearRect",
    ].map((name) => [name, (...args) => calls.push([name, ...args])]),
  );
  ctx.stroke = () => {
    calls.push(["stroke"]);
    strokes.push({
      color: ctx.strokeStyle,
      width: ctx.lineWidth,
      glow: ctx.shadowBlur,
    });
  };
  ctx.fill = () => {
    calls.push(["fill"]);
    strokes.push({
      color: ctx.fillStyle,
      width: ctx.lineWidth,
      glow: ctx.shadowBlur,
    });
  };
  const canvas = { width: 1280, height: 720, getContext: () => ctx };
  return {
    painter: new AirCanvas(),
    canvas,
    calls,
    strokes,
    ctx,
    count: (name) => calls.filter((c) => c[0] === name).length,
  };
}

test("deux positions proches créent un segment et un premier point", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.update(s.canvas, [hand(0.32)], 33);
  assert.equal(s.count("quadraticCurveTo"), 2);
  assert.equal(s.count("arc"), 2);
});
for (const interruption of [
  "absence",
  "geste",
  "identité",
  "ambiguïté",
  "pause",
  "saut",
  "sortie",
  "interruption",
]) {
  test(`aucun pont artificiel après ${interruption}`, () => {
    const s = setup();
    s.painter.update(s.canvas, [hand()], 0);
    if (interruption === "absence") s.painter.update(s.canvas, [], 33);
    if (interruption === "geste")
      s.painter.update(s.canvas, [{ ...hand(), geometry: [] }], 33);
    if (interruption === "identité")
      s.painter.update(s.canvas, [hand(0.31, "Left")], 33);
    if (interruption === "ambiguïté")
      s.painter.update(s.canvas, [hand(), hand()], 33);
    if (interruption === "sortie") s.painter.update(s.canvas, [hand(-0.1)], 33);
    if (interruption === "interruption") s.painter.interrupt();
    s.painter.update(
      s.canvas,
      [hand(interruption === "saut" ? 0.8 : 0.32)],
      interruption === "pause" ? 500 : 66,
    );
    assert.equal(s.count("quadraticCurveTo"), 0);
    assert.equal(s.count("clearRect"), 0, "les anciens traits sont conservés");
  });
}
test("réordonner deux mains ne change pas la main qui dessine", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand(), hand(0.7, "Left")], 0);
  s.painter.update(s.canvas, [hand(0.7, "Left"), hand(0.32)], 33);
  assert.equal(s.count("quadraticCurveTo"), 2);
  assert.ok(
    s.calls.find((c) => c[0] === "quadraticCurveTo")[1] < 0.4 * s.canvas.width,
  );
});
test("effacer supprime les pixels et rompt le segment courant", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.clear(s.canvas);
  s.painter.update(s.canvas, [hand(0.32)], 33);
  assert.equal(s.count("clearRect"), 1);
  assert.equal(s.count("quadraticCurveTo"), 0);
});

test("le filtre réduit les tremblements sans dériver à main immobile", () => {
  const filter = new StrokeFilter();
  let rawError = 0,
    filteredError = 0;
  for (let i = 0; i < 120; i++) {
    const x = 0.5 + (i % 2 ? 0.002 : -0.002);
    const point = filter.update({ x, y: 0.5 }, (i * 1000) / 30);
    if (i > 10) {
      rawError += Math.abs(x - 0.5);
      filteredError += Math.abs(point.x - 0.5);
    }
  }
  assert.ok(filteredError < rawError * 0.4);
});
test("réponse temporelle proche à 15, 30 et 60 fps, sans retard excessif", () => {
  const positions = [15, 30, 60].map((fps) => {
    const filter = new StrokeFilter();
    let point;
    for (let i = 0; i <= fps; i++)
      point = filter.update(
        { x: 0.2 + (0.4 * i) / fps, y: 0.5 },
        (i * 1000) / fps,
      );
    assert.ok(0.6 - point.x < 0.025, `retard trop élevé à ${fps} fps`);
    return point.x;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.015);
});
test("un nouveau trait réinitialise le filtre sans traîner l’ancienne position", () => {
  const filter = new StrokeFilter();
  filter.update({ x: 0.1, y: 0.2 }, 0);
  filter.reset();
  assert.deepEqual(filter.update({ x: 0.9, y: 0.8 }, 50), { x: 0.9, y: 0.8 });
});
test("lever le crayon termine le dernier demi-segment une seule fois", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.update(s.canvas, [hand(0.34)], 33);
  const before = s.count("quadraticCurveTo");
  s.painter.interrupt();
  assert.equal(s.count("quadraticCurveTo"), before + 2);
  const after = s.count("quadraticCurveTo");
  s.painter.interrupt();
  assert.equal(s.count("quadraticCurveTo"), after);
});
test("changer les réglages conserve les pixels et applique les nouveaux au trait suivant", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.update(s.canvas, [hand(0.34)], 33);
  s.painter.setSettings({
    brush: "laser",
    color: "#ff6ec7",
    width: 20,
    glow: 100,
  });
  assert.equal(s.count("clearRect"), 0);
  const before = s.count("quadraticCurveTo");
  s.painter.update(s.canvas, [hand(0.35)], 66);
  assert.equal(
    s.count("quadraticCurveTo"),
    before,
    "pas de raccord entre réglages",
  );
  assert.ok(
    s.strokes.some(
      (p) => p.color === "#ff6ec7" && p.width === 13 && p.glow === 7,
    ),
  );
  assert.ok(s.strokes.some((p) => p.color === DEFAULT_BRUSH.color));
});
test("Neon et Laser ont des profils lumineux distincts, 0 % éteint les halos", () => {
  const a = { x: 0, y: 0 },
    b = { x: 20, y: 20 };
  const neon = setup(),
    laser = setup(),
    off = setup();
  paintBrush(neon.ctx, a, a, b, { ...DEFAULT_BRUSH, glow: 100 }, 1);
  paintBrush(
    laser.ctx,
    a,
    a,
    b,
    { ...DEFAULT_BRUSH, brush: "laser", glow: 100 },
    1,
  );
  paintBrush(off.ctx, a, a, b, { ...DEFAULT_BRUSH, glow: 0 }, 1);
  assert.ok(neon.strokes[0].width > laser.strokes[0].width);
  assert.ok(neon.strokes[0].glow > laser.strokes[0].glow);
  assert.ok(off.strokes.every((p) => p.glow === 0));
});
test("Particles reste borné à 48 dépôts par segment, même très long", () => {
  const s = setup();
  paintBrush(
    s.ctx,
    { x: 0, y: 0 },
    { x: 1000, y: 1000 },
    { x: 2000, y: 2000 },
    { ...DEFAULT_BRUSH, brush: "particles" },
    1,
  );
  assert.equal(s.count("arc"), 48);
  assert.equal(s.count("quadraticCurveTo"), 0);
});
test("une main immobile n’accumule pas de particules à chaque frame", () => {
  const s = setup();
  s.painter.setSettings({ ...DEFAULT_BRUSH, brush: "particles" });
  for (let i = 0; i < 30; i++) s.painter.update(s.canvas, [hand()], i * 33);
  assert.equal(s.count("arc"), 5);
});
test("les paramètres invalides sont bornés avant le rendu", () => {
  assert.deepEqual(
    normalizeBrush({
      brush: "unknown",
      color: "invalid",
      width: -4,
      glow: 300,
    }),
    { ...DEFAULT_BRUSH, width: 2, glow: 100 },
  );
  assert.equal(
    normalizeBrush({ ...DEFAULT_BRUSH, width: NaN }).width,
    DEFAULT_BRUSH.width,
  );
});

test("pincement normalisé : invariance à la rotation, distance et posture des autres doigts", () => {
  const points = gesture(0.2);
  assert.ok(Math.abs(pinchRatio(points) - 0.2) < 1e-10);
  const transformed = points.map((p) => ({
    x: -p.y * 0.5 + 10,
    y: p.x * 0.5 + 5,
    z: p.z * 0.5,
  }));
  assert.ok(Math.abs(pinchRatio(transformed) - 0.2) < 1e-10);
  for (const i of [6, 7, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20])
    points[i] = { x: 50, y: 80, z: -10 };
  assert.ok(Math.abs(pinchRatio(points) - 0.2) < 1e-10);
  assert.equal(pinchRatio([]), Infinity);
  assert.equal(
    pinchRatio(Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))),
    Infinity,
  );
  const invalid = gesture();
  invalid[4].x = NaN;
  assert.equal(pinchRatio(invalid), Infinity);
});
test("contact franc immédiat, pincement marginal confirmé en 20 ms", () => {
  const pinch = new PinchGesture();
  assert.equal(pinch.update(0.1, 0), "drawing");
  pinch.reset();
  assert.equal(pinch.update(0.24, 0), "hover");
  assert.equal(pinch.update(0.24, 15), "hover");
  assert.equal(pinch.update(0.24, 25), "drawing");
  pinch.reset();
  assert.equal(pinch.update(0.24, 0), "hover");
  assert.equal(pinch.update(0.4, 15), "hover");
  assert.equal(
    pinch.update(0.24, 25),
    "hover",
    "une impulsion isolée ne dessine pas",
  );
});
test("hystérésis : oscillations autour du seuil de fermeture sans coupure du trait", () => {
  const pinch = new PinchGesture();
  pinch.update(0.1, 0);
  for (const [index, ratio] of [0.27, 0.3, 0.4, 0.29, 0.35].entries())
    assert.equal(pinch.update(ratio, 33 * (index + 1)), "drawing");
});
test("relâchement marginal : gel immédiat de l’encre, confirmation 40 ms, ouverture franche immédiate", () => {
  const pinch = new PinchGesture();
  pinch.update(0.1, 0);
  assert.equal(pinch.update(0.48, 33), "holding");
  assert.equal(pinch.update(0.48, 66), "holding");
  assert.equal(pinch.update(0.48, 80), "hover");
  assert.equal(pinch.update(0.35, 100), "hover");
  assert.equal(pinch.update(0.1, 120), "drawing");
  assert.equal(pinch.update(0.7, 130), "hover");
  assert.equal(pinch.update(Infinity, 150), "hover");
});
test("déplacer le doigt sans pincer suit le curseur sans aucun dépôt d’encre", () => {
  const s = setup();
  let cursor;
  for (let i = 0; i < 5; i++)
    cursor = s.painter.update(
      s.canvas,
      [{ ...hand(0.3 + i * 0.02), geometry: gesture(0.9) }],
      i * 33,
    );
  assert.equal(cursor.state, "hover");
  assert.ok(cursor.x > 0.3);
  assert.equal(s.count("arc"), 0);
  assert.equal(s.count("quadraticCurveTo"), 0);
});
test("une oscillation courte au relâchement ne coupe pas le segment et ne dessine pas pendant le doute", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.update(s.canvas, [hand(0.32)], 33);
  const before = s.count("quadraticCurveTo");
  const hold = s.painter.update(
    s.canvas,
    [{ ...hand(0.33), geometry: gesture(0.48) }],
    66,
  );
  assert.equal(hold.state, "holding");
  assert.equal(s.count("quadraticCurveTo"), before);
  assert.equal(
    s.painter.update(s.canvas, [{ ...hand(0.34), geometry: gesture(0.35) }], 99)
      .state,
    "drawing",
  );
  assert.equal(s.count("quadraticCurveTo"), before + 2);
  assert.equal(
    s.count("arc"),
    2,
    "pas de nouveau point de départ après un seul échantillon bruité",
  );
});
test("ouverture puis déplacement et nouveau pincement : deux traits indépendants", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.update(s.canvas, [hand(0.32)], 33);
  assert.equal(
    s.painter.update(s.canvas, [{ ...hand(0.34), geometry: gesture(0.9) }], 66)
      .state,
    "hover",
  );
  const before = s.count("quadraticCurveTo");
  s.painter.update(s.canvas, [{ ...hand(0.36), geometry: gesture(0.9) }], 99);
  s.painter.update(s.canvas, [hand(0.38)], 132);
  assert.equal(s.count("quadraticCurveTo"), before);
  assert.equal(s.count("arc"), 4);
});
test("perte courte : garder le pincement, masquer le curseur et rompre la géométrie", () => {
  const s = setup();
  s.painter.update(s.canvas, [hand()], 0);
  assert.equal(s.painter.update(s.canvas, [], 33), undefined);
  const cursor = s.painter.update(
    s.canvas,
    [{ ...hand(0.32), geometry: gesture(0.35) }],
    66,
  );
  assert.equal(cursor.state, "drawing");
  assert.equal(s.count("quadraticCurveTo"), 0);
  s.painter.update(s.canvas, [], 200);
  assert.equal(
    s.painter.update(
      s.canvas,
      [{ ...hand(0.34), geometry: gesture(0.35) }],
      230,
    ).state,
    "hover",
  );
});
test("une main qui navigue reste sélectionnée si une deuxième main pince", () => {
  const s = setup();
  s.painter.update(s.canvas, [{ ...hand(), geometry: gesture(0.9) }], 0);
  const cursor = s.painter.update(
    s.canvas,
    [hand(0.7, "Left"), { ...hand(0.32), geometry: gesture(0.9) }],
    33,
  );
  assert.equal(cursor.state, "hover");
  assert.ok(cursor.x < 0.4);
  assert.equal(s.count("arc"), 0);
});
test("curseur SVG : coordonnées miroir, ratio contenu, état et masquage sans React", () => {
  const attributes = new Map(),
    svgAttributes = new Map();
  const element = {
    style: {},
    setAttribute: (key, value) => attributes.set(key, value),
    ownerSVGElement: {
      getAttribute: (key) => svgAttributes.get(key),
      setAttribute: (key, value) => svgAttributes.set(key, value),
    },
  };
  updateInteractionCursor(
    element,
    { x: 0.25, y: 0.5, state: "hover" },
    1280,
    720,
  );
  assert.equal(svgAttributes.get("viewBox"), "0 0 1280 720");
  assert.equal(attributes.get("transform"), "translate(960 360) scale(1)");
  assert.equal(attributes.get("data-state"), "hover");
  updateInteractionCursor(
    element,
    { x: 0.1, y: 0.2, state: "drawing" },
    640,
    480,
  );
  assert.equal(attributes.get("transform"), "translate(576 96) scale(0.5)");
  assert.equal(attributes.get("data-edge"), "right");
  assert.equal(attributes.get("data-state"), "drawing");
  assert.equal(element.style.visibility, "visible");
  updateInteractionCursor(element, undefined, 0, 0);
  assert.equal(element.style.visibility, "hidden");
  updateInteractionCursor(
    element,
    { x: 0.5, y: 0.5, state: "holding" },
    1280,
    720,
    { width: 320, height: 400 },
  );
  assert.equal(
    attributes.get("transform"),
    "translate(640 360) scale(4)",
    "le curseur conserve sa taille en pixels malgré le letterboxing",
  );
  assert.equal(attributes.get("data-state"), "holding");
});

test("le pincement alimente Pixi avec des segments normalisés sans dessiner le pinceau classique", () => {
  const s = setup(),
    emitted = [];
  let clears = 0,
    ended = 0;
  s.painter.setEffects({
    emit: (p) => emitted.push(p),
    endStroke: () => ended++,
    clear: () => clears++,
  });
  s.painter.setSettings({ ...DEFAULT_BRUSH, brush: "energy-ribbon" });
  s.painter.update(s.canvas, [hand()], 0);
  s.painter.update(s.canvas, [hand(0.34)], 33);
  assert.equal(emitted.length, 2);
  assert.equal(emitted[0].dot, true);
  assert.ok(
    emitted.every(
      (p) => p.to.x >= 0 && p.to.x <= 1 && p.settings.brush === "energy-ribbon",
    ),
  );
  assert.equal(s.count("arc"), 0);
  assert.equal(s.count("quadraticCurveTo"), 0);
  s.painter.interrupt();
  assert.ok(ended > 0);
  const before = emitted.length;
  s.painter.update(s.canvas, [hand(0.6)], 66);
  assert.equal(emitted[before].dot, true);
  s.painter.clear(s.canvas);
  assert.equal(clears, 1);
});
