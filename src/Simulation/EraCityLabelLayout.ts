export interface AtlasTextBox { left: number; top: number; right: number; bottom: number }
const overlaps = (a: AtlasTextBox, b: AtlasTextBox) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** Canvas pixels; padding includes the text outline. Points and capital rings never move. */
export function placeEraCityLabel(x: number, y: number, textWidth: number, textHeight: number,
  canvasWidth: number, canvasHeight: number, markerRadius: number, occupied: readonly AtlasTextBox[] = []): AtlasTextBox | undefined {
  const padding = 2, gap = markerRadius + padding + 1;
  if (textWidth + padding * 2 > canvasWidth || textHeight + padding * 2 > canvasHeight) return undefined;
  const anchors = [[x + gap, y - textHeight - gap], [x + gap, y + gap],
    [x - gap - textWidth, y - textHeight - gap], [x - gap - textWidth, y + gap],
    [x - textWidth / 2, y + gap], [x - textWidth / 2, y - gap - textHeight]];
  for (const [anchorX, anchorY] of anchors) {
    const left = Math.max(padding, Math.min(canvasWidth - textWidth - padding, anchorX));
    const top = Math.max(padding, Math.min(canvasHeight - textHeight - padding, anchorY));
    const box = { left, top, right: left + textWidth, bottom: top + textHeight };
    const outlined = { left: box.left - padding, top: box.top - padding, right: box.right + padding, bottom: box.bottom + padding };
    if (!occupied.some(other => overlaps(outlined, other))) return box;
  }
  return undefined;
}
