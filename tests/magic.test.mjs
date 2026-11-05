import test from "node:test";
import assert from "node:assert/strict";
import { isOpenPalm, MagicOrb } from "../src/magic.ts";
function hand(x = 0.5) {
  const geometry = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [j, base] of [5, 9, 13, 17].entries()) {
    for (let k = 0; k < 4; k++)
      geometry[base + k] = { x: (j - 1.5) * 0.3, y: 1 + k * 0.4, z: 0 };
  }
  geometry[4] = { x: -1, y: 0.7, z: 0 };
  return {
    geometry,
    landmarks: geometry.map((p) => ({
      x: x + p.x * 0.1,
      y: 0.7 - p.y * 0.1,
      z: 0,
    })),
    label: "Right",
  };
}
test("open palm recognition rejects fists, malformed and degenerate geometry", () => {
  assert.equal(isOpenPalm(hand().geometry), true);
  const fist = hand().geometry;
  for (const base of [5, 9, 13, 17]) fist[base + 3] = { x: 0, y: 0.5, z: 0 };
  assert.equal(isOpenPalm(fist), false);
  assert.equal(isOpenPalm([]), false);
  assert.equal(
    isOpenPalm(Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))),
    false,
  );
  const invalid = hand().geometry;
  invalid[8].x = NaN;
  assert.equal(isOpenPalm(invalid), false);
});
test("orb follows palm smoothly and fades on loss or stalled tracking", () => {
  const orb = new MagicOrb();
  orb.update([hand()], 0);
  orb.advance(0);
  assert.ok(orb.opacity > 0);
  const x = orb.x;
  orb.update([hand(0.8)], 33);
  orb.advance(33);
  assert.ok(orb.x > x && orb.x < 0.8);
  const opacity = orb.opacity;
  orb.update([], 66);
  orb.advance(66);
  assert.ok(orb.opacity > 0 && orb.opacity < opacity);
  orb.advance(2000);
  assert.equal(orb.hasWork, false);
  orb.update([hand()], 2100);
  orb.advance(2100);
  orb.advance(2300);
  orb.advance(5000);
  assert.equal(orb.hasWork, false);
  orb.reset();
  assert.equal(orb.opacity, 0);
});
test("hand identity survives reordered detections", () => {
  const orb = new MagicOrb();
  const right = hand(0.3),
    left = { ...hand(0.8), label: "Left" };
  orb.update([right, left], 0);
  orb.advance(0);
  orb.update([left, right], 33);
  orb.advance(33);
  assert.ok(orb.x < 0.4);
});
