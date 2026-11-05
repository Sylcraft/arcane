import test from "node:test";
import assert from "node:assert/strict";
import {
  DetectionGate,
  inferenceSize,
  TrackingPerformance,
} from "../src/trackingPerformance.ts";
import { selectDelegate } from "../src/handLandmarker.ts";
import { drawSkeleton } from "../src/drawSkeleton.ts";

test("télémétrie : seules les opérations terminées sont comptées", () => {
  const meter = new TrackingPerformance();
  meter.reset(0);
  for (let i = 0; i < 4; i++) meter.detected(325, 2);
  for (let i = 0; i < 3; i++) meter.rendered(5);
  assert.deepEqual(meter.snapshot(1000), {
    detectionFps: 4,
    renderFps: 3,
    inferenceMs: 325,
    inferenceP95: 325,
    preparationMs: 2,
    renderMs: 5,
  });
  assert.equal(meter.snapshot(2000).detectionFps, 2);
  meter.reset(2000);
  assert.equal(meter.snapshot(3000).detectionFps, 0);
  assert.equal(meter.snapshot(3000).renderFps, 0);
});
test("30 détections réelles par seconde, sans calcul par inverse de latence", () => {
  const meter = new TrackingPerformance();
  meter.reset(500);
  for (let i = 0; i < 30; i++) {
    meter.detected(10, 1);
    meter.rendered(2);
  }
  assert.equal(meter.snapshot(1500).detectionFps, 30);
  assert.equal(meter.snapshot(1500).renderFps, 30);
  assert.equal(meter.snapshot(2500).detectionFps, 15);
});
test("moyenne et p95 restent distincts en présence de blocages", () => {
  const meter = new TrackingPerformance();
  meter.reset(0);
  for (let i = 0; i < 20; i++) meter.detected(i < 18 ? 10 : 100, 0);
  assert.equal(meter.snapshot(1000).inferenceMs, 19);
  assert.equal(meter.snapshot(1000).inferenceP95, 100);
});
test("entrée sans déformation ni agrandissement, détail complet par défaut", () => {
  assert.deepEqual(inferenceSize(1280, 720, 960), { width: 960, height: 540 });
  assert.deepEqual(inferenceSize(1280, 720, 640), { width: 640, height: 360 });
  assert.deepEqual(inferenceSize(640, 480, 1280), { width: 640, height: 480 });
  assert.deepEqual(inferenceSize(1280, 720, 1280), {
    width: 1280,
    height: 720,
  });
});
test("aucune détection répétée sur la même image caméra", () => {
  const gate = new DetectionGate();
  assert.equal(gate.accept(1, 0), true);
  assert.equal(gate.accept(1, 100), false);
  assert.equal(gate.accept(2, 101), true);
});
test("29.97/30 fps conservées, 60 fps bornée à 30, pas de rattrapage", () => {
  for (const fps of [29.97, 30, 60]) {
    const gate = new DetectionGate();
    let count = 0;
    for (let i = 0; i < 60; i++)
      if (gate.accept(i / fps, (i * 1000) / fps)) count++;
    assert.equal(count, fps === 60 ? 30 : 60);
    assert.equal(gate.accept(100, 100000), true);
    assert.equal(gate.accept(101, 100001), false);
    gate.reset();
    assert.equal(gate.accept(101, 100001), true);
  }
});
test("Auto tente le GPU en premier, sans seconde initialisation inutile", async () => {
  const calls = [];
  const result = await selectDelegate("auto", async (delegate) => {
    calls.push(delegate);
    return "detector";
  });
  assert.deepEqual(calls, ["GPU"]);
  assert.equal(result.delegate, "GPU");
  assert.equal(result.fallback, "");
});
test("échec GPU : repli CPU avec raison visible", async () => {
  const calls = [];
  const result = await selectDelegate("auto", async (delegate) => {
    calls.push(delegate);
    if (delegate === "GPU") throw new Error("WebGL unavailable");
    return "cpu";
  });
  assert.deepEqual(calls, ["GPU", "CPU"]);
  assert.equal(result.delegate, "CPU");
  assert.equal(result.fallback, "WebGL unavailable");
});
test("modes explicites CPU et GPU pour comparaison, sans repli caché", async () => {
  const calls = [];
  const result = await selectDelegate("CPU", async (delegate) => {
    calls.push(delegate);
    return "cpu";
  });
  assert.deepEqual(calls, ["CPU"]);
  assert.equal(result.delegate, "CPU");
  await assert.rejects(
    selectDelegate("GPU", async () => {
      throw new Error("GPU failure");
    }),
    /GPU failure/,
  );
});
test("squelette groupé : tous les points conservés avec 2 stroke et 2 fill", () => {
  const counts = { stroke: 0, fill: 0, arc: 0, lineTo: 0, clearRect: 0 };
  const ctx = Object.fromEntries(
    ["save", "restore", "beginPath", "moveTo", ...Object.keys(counts)].map(
      (name) => [
        name,
        () => {
          if (name in counts) counts[name]++;
        },
      ],
    ),
  );
  const canvas = { width: 1280, height: 720, getContext: () => ctx };
  const hand = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  drawSkeleton(canvas, [hand, hand], true);
  assert.deepEqual(counts, {
    stroke: 2,
    fill: 2,
    arc: 42,
    lineTo: 42,
    clearRect: 1,
  });
  drawSkeleton(canvas, [hand, hand], false);
  assert.equal(counts.arc, 42);
  assert.equal(counts.clearRect, 2);
});
