import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import type { EraMapSnapshotV1 } from "../../../Simulation/EraMapSnapshot";
import { renderEraMapSnapshot } from "../../../Simulation/EraMapRenderer";

export default function EraAtlasMap({ snapshot, full = false }: { snapshot: EraMapSnapshotV1; full?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) renderEraMapSnapshot(context, snapshot, { cellSize: full ? 18 : 3, showCities: full });
  }, [full, snapshot]);

  return (
    <Box sx={{ width: "100%", maxHeight: full ? "70vh" : 105, overflow: "auto", bgcolor: "#e9e5d8", border: "1px solid var(--gg-border)" }}>
      <canvas
        ref={canvasRef}
        aria-label={full ? "时代确立时的历史地图" : "时代地图缩略图"}
        style={{ display: "block", width: "100%", maxHeight: full ? "70vh" : 105, height: "auto", objectFit: "contain", imageRendering: "pixelated" }}
      />
    </Box>
  );
}
