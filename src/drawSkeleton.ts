import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

export function drawSkeleton(
  canvas: HTMLCanvasElement,
  hands: NormalizedLandmark[][],
  visible: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!visible) return;
  const { width, height } = canvas;
  ctx.save();
  ctx.lineWidth = Math.max(2, width / 450);
  ctx.shadowBlur = 6;
  hands.forEach((hand, index) => {
    const color = index === 0 ? "#58f3dc" : "#b3a0ff";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    // One stroke and one fill per hand instead of a blur for each individual
    // connection and landmark. Geometry and all 21 landmarks are unchanged.
    ctx.beginPath();
    connections.forEach(([a, b]) => {
      ctx.moveTo(hand[a].x * width, hand[a].y * height);
      ctx.lineTo(hand[b].x * width, hand[b].y * height);
    });
    ctx.stroke();
    ctx.beginPath();
    hand.forEach((p) => {
      const x = p.x * width,
        y = p.y * height,
        radius = width / 240;
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    });
    ctx.fill();
  });
  ctx.restore();
}
