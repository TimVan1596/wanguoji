import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import type { EraMapSnapshotV1 } from "../../../Simulation/EraMapSnapshot";
import { renderEraMapSnapshot } from "../../../Simulation/EraMapRenderer";
import { fitAtlasViewport } from "./atlasViewport";

export default function EraAtlasMap({ snapshot, full = false, zoom = 1 }: { snapshot: EraMapSnapshotV1; full?: boolean; zoom?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const measure = () => setSize(previous => {
      const next = { width: box.clientWidth, height: box.clientHeight };
      return previous.width === next.width && previous.height === next.height ? previous : next;
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) renderEraMapSnapshot(context, snapshot, { cellSize: full ? 18 : 3, showCities: full, showLabels: true });
  }, [full, snapshot]);
  const fitted = fitAtlasViewport(snapshot.widthCells, snapshot.heightCells, size.width, size.height, zoom);
  return (
    <Box ref={viewportRef} data-atlas-viewport={full ? "full" : "thumbnail"} sx={{ width: "100%", height: full ? "100%" : 105, minWidth: 0, minHeight: 0,
      overflow: fitted.scrollable ? "auto" : "hidden", bgcolor: "#e9e5d8" }}>
      <Box sx={{ width: Math.max(size.width, fitted.width), height: Math.max(size.height, fitted.height), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <canvas ref={canvasRef} aria-label={full ? "时代确立时的历史地图" : "时代地图缩略图"}
          style={{ display: "block", flexShrink: 0, width: fitted.width, height: fitted.height, imageRendering: "pixelated" }} />
      </Box>
    </Box>
  );
}
