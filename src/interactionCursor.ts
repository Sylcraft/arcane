import type { Position } from "./brushes";
import type { PinchState } from "./pinchGesture";
export type InteractionCursor = Position & { state: PinchState };

// The SVG uses the same contain/viewBox mapping as the video and Canvas layers.
// Only coordinates are mirrored; the state label stays readable.
export function updateInteractionCursor(
  element: SVGGElement | null,
  cursor: InteractionCursor | undefined,
  width: number,
  height: number,
  viewport?: { width: number; height: number },
) {
  if (!element) return;
  if (!cursor) {
    element.style.visibility = "hidden";
    return;
  }
  const svg = element.ownerSVGElement;
  const viewBox = `0 0 ${width} ${height}`;
  if (svg?.getAttribute("viewBox") !== viewBox)
    svg?.setAttribute("viewBox", viewBox);
  element.setAttribute(
    "transform",
    `translate(${(1 - cursor.x) * width} ${cursor.y * height}) scale(${viewport && viewport.width > 0 && viewport.height > 0 ? 1 / Math.min(viewport.width / width, viewport.height / height) : width / 1280})`,
  );
  element.setAttribute("data-state", cursor.state);
  element.setAttribute("data-edge", cursor.x < 0.25 ? "right" : "left");
  element.style.visibility = "visible";
}
