import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import {
  HologramController,
  handToViewport,
} from "../src/hologramController.ts";

function hand(x = 0.5, y = 0.5, ratio = 0.08, label = "Right") {
  const geometry = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  geometry[5] = { x: -0.5, y: 1, z: 0 };
  geometry[17] = { x: 0.5, y: 1, z: 0 };
  geometry[9] = { x: 0, y: 1, z: 0 };
  geometry[8] = { x: 0, y: 2, z: 0 };
  geometry[4] = { x: ratio, y: 2, z: 0 };
  const landmarks = geometry.map((p) => ({ ...p }));
  landmarks[8] = { x, y, z: 0 };
  return { geometry, landmarks, label };
}
function setup() {
  const c = new HologramController();
  c.setViewport(1280, 720, { x: 0.5, y: 0.5, rx: 0.22, ry: 0.3 });
  c.update([hand(0.5, 0.5, 0.8)], 0);
  return c;
}
test("le curseur miroir respecte les bandes de la vidéo contenue", () => {
  assert.deepEqual(handToViewport({ x: 0.5, y: 0.5 }, 1280, 720, 400, 400), {
    x: 0.5,
    y: 0.5,
  });
  assert.deepEqual(handToViewport({ x: 0, y: 0 }, 1280, 720, 400, 400), {
    x: 1,
    y: 0.21875,
  });
  assert.deepEqual(handToViewport({ x: 1, y: 1 }, 1280, 720, 400, 400), {
    x: 0,
    y: 0.78125,
  });
  assert.deepEqual(handToViewport({ x: 0, y: 0 }, 640, 480, 800, 450), {
    x: 0.875,
    y: 0,
  });
});
test("viser sans pincer ne modifie pas l’orientation", () => {
  const c = setup(),
    original = { ...c.rotation };
  for (let i = 1; i < 10; i++)
    assert.equal(
      c.update([hand(0.5 + i * 0.005, 0.5, 0.8)], i * 33).state,
      "hover",
    );
  assert.equal(c.hovered, true);
  assert.equal(c.grabbed, false);
  assert.deepEqual(c.rotation, original);
});
test("saisir n’introduit aucun saut puis déplacer la main fait tourner l’objet", () => {
  const c = setup(),
    original = { ...c.rotation };
  assert.equal(c.update([hand()], 33).state, "drawing");
  assert.equal(c.grabbed, true);
  assert.deepEqual(c.rotation, original);
  c.update([hand(0.47, 0.53)], 66);
  assert.notDeepEqual(c.rotation, original);
});
test("un pincement extérieur ne saisit pas, même en entrant ensuite dans la cible", () => {
  const c = new HologramController();
  c.setViewport(1280, 720, { x: 0.5, y: 0.5, rx: 0.2, ry: 0.3 });
  c.update([hand(0.1, 0.5, 0.8)], 0);
  c.update([hand(0.1)], 33);
  for (let i = 1; i <= 4; i++) c.update([hand(0.1 + i * 0.1)], 33 + i * 33);
  assert.equal(c.grabbed, false);
  c.update([hand(0.5, 0.5, 0.8)], 200);
  c.update([hand()], 233);
  assert.equal(c.grabbed, true);
});
test("le relâchement arrête la rotation immédiatement, sans inertie", () => {
  const c = setup();
  c.update([hand()], 33);
  c.update([hand(0.47)], 66);
  c.update([hand(0.45, 0.5, 0.8)], 99);
  const stopped = { ...c.rotation };
  for (let i = 0; i < 8; i++)
    c.update([hand(0.45 - i * 0.015, 0.5, 0.8)], 132 + i * 33);
  assert.equal(c.grabbed, false);
  assert.deepEqual(c.rotation, stopped);
});
test("la zone d’hystérésis ne fait pas clignoter la saisie", () => {
  const c = setup();
  c.update([hand()], 33);
  for (let i = 0; i < 5; i++) {
    c.update([hand(0.5, 0.5, i % 2 ? 0.38 : 0.29)], 66 + i * 33);
    assert.equal(c.grabbed, true);
  }
});
test("un relâchement incertain suspend la rotation sans perdre la capture", () => {
  const c = setup();
  c.update([hand()], 33);
  const original = { ...c.rotation };
  assert.equal(c.update([hand(0.48, 0.5, 0.48)], 66).state, "holding");
  assert.equal(c.grabbed, true);
  assert.deepEqual(c.rotation, original);
  assert.equal(c.update([hand(0.47, 0.5, 0.35)], 99).state, "drawing");
});
test("une perte courte fige la capture et reprend sans intégrer le déplacement manquant", () => {
  const c = setup();
  c.update([hand()], 33);
  const original = { ...c.rotation };
  assert.equal(c.update([], 66), undefined);
  c.update([hand(0.55)], 99);
  assert.equal(c.grabbed, true);
  assert.deepEqual(c.rotation, original);
  c.update([hand(0.56)], 132);
  assert.notDeepEqual(c.rotation, original);
});
test("perte prolongée et retour pincé : ouvrir avant de saisir de nouveau", () => {
  const c = setup();
  c.update([hand()], 33);
  c.update([], 200);
  assert.equal(c.grabbed, false);
  c.update([hand(0.5, 0.5, 0.24)], 233);
  c.update([hand(0.5, 0.5, 0.24)], 266);
  assert.equal(
    c.grabbed,
    false,
    "une fermeture marginale ne réarme pas la saisie",
  );
  c.update([hand(0.5, 0.5, 0.8)], 299);
  c.update([hand()], 332);
  assert.equal(c.grabbed, true);
});
test("saut de position, expiration et changement de viewport relâchent sans modifier l’orientation", () => {
  const c = setup();
  c.update([hand()], 33);
  const original = { ...c.rotation };
  c.update([hand(0.85)], 66);
  assert.equal(c.grabbed, false);
  assert.deepEqual(c.rotation, original);
  c.update([hand(0.5, 0.5, 0.8)], 99);
  c.update([hand()], 132);
  c.expire(313);
  assert.equal(c.grabbed, false);
  c.update([hand(0.5, 0.5, 0.8)], 330);
  c.update([hand()], 363);
  c.setViewport(800, 500, { x: 0.5, y: 0.5, rx: 0.2, ry: 0.3 });
  assert.equal(c.grabbed, false);
});
test("une seconde main ne prend pas la capture et l’ordre des mains est sans effet", () => {
  const c = setup();
  c.update([hand()], 33);
  const cursor = c.update([hand(0.7, 0.5, 0.08, "Left"), hand(0.52)], 66);
  assert.ok(cursor.x < 0.6);
  assert.equal(c.grabbed, true);
  const original = { ...c.rotation };
  c.update([hand(0.7, 0.5, 0.08, "Left")], 99);
  assert.deepEqual(c.rotation, original);
});
test("les quaternions correspondent à une rotation caméra Three.js et restent normalisés", () => {
  const c = setup();
  const first = c.update([hand()], 33),
    original = new Quaternion(
      ...[c.rotation.x, c.rotation.y, c.rotation.z, c.rotation.w],
    );
  const next = c.update([hand(0.48, 0.53)], 66);
  const dx = first.x - next.x,
    dy = next.y - first.y;
  const expected = new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), dy * 5.4)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), dx * 5.4))
    .multiply(original);
  const actual = new Quaternion(
    c.rotation.x,
    c.rotation.y,
    c.rotation.z,
    c.rotation.w,
  );
  assert.ok(actual.angleTo(expected) < 1e-7);
  for (let i = 0; i < 1000; i++)
    c.update(
      [hand(0.5 + Math.sin(i * 0.1) * 0.06, 0.5 + Math.cos(i * 0.1) * 0.06)],
      99 + i * 33,
    );
  assert.ok(
    Math.abs(
      Math.hypot(c.rotation.x, c.rotation.y, c.rotation.z, c.rotation.w) - 1,
    ) < 1e-12,
  );
});
test("la télémétrie 3D compte uniquement les rendus soumis, séparément de la détection", () => {
  const c = setup();
  c.resetRenderStats(100);
  for (let i = 0; i < 60; i++) c.recordRender(101 + i * 16, 2);
  assert.deepEqual(c.takeRenderStats(1100), { hologramFps: 60, hologramMs: 2 });
  assert.deepEqual(c.takeRenderStats(2100), { hologramFps: 0, hologramMs: 0 });
});

test("l’expiration se mesure depuis la réception du résultat, pas avant l’inférence", () => {
  const c = setup();
  c.update([hand()], 33, 400);
  c.expire(450);
  assert.equal(c.grabbed, true);
  c.expire(581);
  assert.equal(c.grabbed, false);
});
