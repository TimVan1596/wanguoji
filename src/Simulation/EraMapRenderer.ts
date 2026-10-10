import { analyzeEraSnapshot, layoutEraCountryLabels } from "./EraAtlasLayout";
import { type EraMapSnapshotV1 } from "./EraMapSnapshot";

const NEUTRAL_COLOR = "#e9e5d8";

export function renderEraMapSnapshot(
  context: CanvasRenderingContext2D,
  snapshot: EraMapSnapshotV1,
  options: { cellSize?: number; showCities?: boolean; showLabels?: boolean } = {}
) {
  const cellSize = Math.max(1, Math.floor(options.cellSize ?? 4));
  const width = snapshot.widthCells;
  const height = snapshot.heightCells;
  context.canvas.width = Math.max(1, width * cellSize);
  context.canvas.height = Math.max(1, height * cellSize);
  context.imageSmoothingEnabled = false;
  context.fillStyle = NEUTRAL_COLOR;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);

  const colors = [NEUTRAL_COLOR, ...snapshot.factionPalette.map(({ color }) => toCssColor(color))];
  const owners = analyzeEraSnapshot(snapshot).owners;
  owners.forEach((paletteIndex, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    context.fillStyle = colors[paletteIndex] ?? NEUTRAL_COLOR;
    context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  });

  if (options.showLabels) {
    const labels = layoutEraCountryLabels(snapshot, cellSize, Boolean(options.showCities), (text, size) => {
      context.font = `bold ${size}px sans-serif`; return context.measureText(text).width;
    });
    context.textAlign = "center"; context.textBaseline = "middle";
    for (const label of labels) {
      context.font = `bold ${label.fontSize}px sans-serif`; context.lineWidth = 3;
      context.strokeStyle = "rgba(255,255,255,.95)"; context.fillStyle = "#17212a";
      context.strokeText(label.text, label.x, label.y); context.fillText(label.text, label.x, label.y);
    }
    context.textAlign = "start"; context.textBaseline = "alphabetic";
  }
  snapshot.cities.forEach((city) => {
    const x = (city.gridX + 0.5) * cellSize;
    const y = (city.gridY + 0.5) * cellSize;
    if (options.showCities) {
      context.beginPath();
      context.fillStyle = "#19212a";
      context.arc(x, y, Math.max(2, cellSize * 0.22), 0, Math.PI * 2);
      context.fill();
      if (city.isCapital) {
        context.beginPath();
        context.strokeStyle = "#f4c542";
        context.lineWidth = Math.max(1, cellSize * 0.12);
        context.arc(x, y, Math.max(3, cellSize * 0.4), 0, Math.PI * 2);
        context.stroke();
      }
      context.font = `${Math.max(9, Math.floor(cellSize * 0.62))}px sans-serif`;
      context.lineWidth = 3;
      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.strokeText(city.name, x + cellSize * 0.42, y - cellSize * 0.3);
      context.fillStyle = "#18212b";
      context.fillText(city.name, x + cellSize * 0.42, y - cellSize * 0.3);
    } else if (city.isCapital) {
      context.beginPath();
      context.fillStyle = "#f4c542";
      context.strokeStyle = "#20252a";
      context.lineWidth = Math.max(1, cellSize * 0.12);
      context.arc(x, y, Math.max(2, cellSize * 0.38), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  });
}

function toCssColor(color: number) {
  return `#${(color >>> 0).toString(16).slice(-6).padStart(6, "0")}`;
}
