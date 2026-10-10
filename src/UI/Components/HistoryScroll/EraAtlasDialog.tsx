import type Team from "../../../Components/Team";
import type { Ruler } from "../../../Politics/Dynasty";
import EraChronicle from "./EraChronicle";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, Typography, FormControlLabel, Checkbox } from "@mui/material";
import type { WorldEra } from "../../../Simulation/WorldEra";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import { analyzeEraSnapshot } from "../../../Simulation/EraAtlasLayout";
import EraAtlasMap from "./EraAtlasMap";
import { atlasArrowDirection, getEraNeighbors } from "./eraSelection";
import { revealAtlasAxisItem } from "./atlasViewport";
const types = { MULTIPOLAR: "群雄争衡", DUAL_RIVALRY: "双雄争霸", HEGEMONY: "霸权时代", DYNASTIC: "王朝时代", UNIFIED: "天下一统", FRAGMENTATION: "天下再裂" };
export function EraAtlasDialogContent({ eras, selectedEraId, onNavigate, onClose, worldMonth, factions, rulers, onViewAllHistory }: { onViewAllHistory?: (eraId: string) => void; worldMonth: number; factions?: Map<string, Team>; rulers?: Map<string, Ruler>; eras: WorldEra[]; selectedEraId: string; onNavigate: (id: string) => void; onClose?: () => void }) {
  const { ordered, previous, next } = useMemo(() => getEraNeighbors(eras, selectedEraId), [eras, selectedEraId]);
  const selected = ordered.find(e => e.id === selectedEraId);
  const rows = useMemo(() => selected?.mapSnapshot ? analyzeEraSnapshot(selected.mapSnapshot).territories : [], [selected?.mapSnapshot]);
  const [zoom, setZoom] = useState(1);
  const [mobilePanel, setMobilePanel] = useState<"chronicle" | "statistics">();
  const [showBorders, setShowBorders] = useState(true);
  const timeline = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setZoom(1);
    const axis = timeline.current, item = axis?.querySelector<HTMLElement>('[aria-current="true"]');
    if (axis && item) revealAtlasAxisItem(axis, item);
  }, [selectedEraId]);
  useEffect(() => {
    const box = timeline.current; if (!box) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const before = box.scrollLeft; box.scrollLeft += e.deltaY;
      if (box.scrollLeft !== before) e.preventDefault();
    };
    box.addEventListener("wheel", wheel, { passive: false });
    return () => box.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const direction = atlasArrowDirection(e.key, e.target as HTMLElement), neighbor = direction < 0 ? previous : direction > 0 ? next : undefined;
      if (neighbor && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onNavigate(neighbor.id); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [previous, next, onNavigate]);
  if (!selected) return <Typography>未选择时代。</Typography>;
  return <Box data-atlas-layout="chronicle-map-statistics-axis" sx={{ height: "100%", minHeight: 0, minWidth: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", gap: 1 }}>
    <Box component="header" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: .5, minWidth: 0 }}>
      <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
        <Typography component="h2" fontWeight={700} fontSize="1rem" sx={{ overflowWrap: "anywhere" }}>时代图鉴 · {selected.name}</Typography>
        <Typography fontSize="0.7rem" color="text.secondary">{types[selected.type]} · 时代范围：{formatWorldDate(selected.startMonth)}～{selected.endMonth === undefined ? "今" : formatWorldDate(selected.endMonth)}<br />
          时代确立记录：{formatWorldDate(selected.confirmedMonth)}{selected.mapSnapshot ? ` · 地图记录：${formatWorldDate(selected.mapSnapshot.capturedMonth)}` : ""}</Typography>
      </Box>
      <Button size="small" disabled={!previous} onClick={() => previous && onNavigate(previous.id)}>← 上一时代</Button>
      <Button size="small" disabled={!next} onClick={() => next && onNavigate(next.id)}>下一时代 →</Button>
      {selected.mapSnapshot ? <Button size="small" onClick={() => setZoom(z => z === 1 ? 1.5 : z === 1.5 ? 2 : 1)}>查看比例 {Math.round(zoom * 100)}%</Button> : null}
      <FormControlLabel sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '.75rem' } }} control={<Checkbox size="small" checked={showBorders} onChange={(_, value) => setShowBorders(value)} />} label="显示国界" />
      <Button size="small" sx={{ display: { xs: "inline-flex", lg: "none" } }} onClick={() => setMobilePanel(value => value === "chronicle" ? undefined : "chronicle")}>时代精选</Button>
      <Button size="small" sx={{ display: { xs: "inline-flex", md: "none" } }} onClick={() => setMobilePanel(value => value === "statistics" ? undefined : "statistics")}>诸国统计</Button>
      {onClose ? <Button size="small" onClick={onClose}>关闭</Button> : null}
    </Box>
    <Box data-atlas-body="chronicle-map-statistics" sx={{ display: "grid", minHeight: 0, minWidth: 0, gap: 1,
      gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 200px", lg: "280px minmax(0, 1fr) 210px", xl: "310px minmax(0, 1fr) 220px" },
      gridTemplateRows: { xs: mobilePanel ? "minmax(0, 1fr) minmax(0, 40%)" : "minmax(0, 1fr)", md: mobilePanel === "chronicle" ? "minmax(0, 1fr) minmax(0, 40%)" : "minmax(0, 1fr)", lg: "minmax(0, 1fr)" } }}>
      <Box component="aside" aria-label="时代精选记" sx={{ minHeight: 0, minWidth: 0, overflowY: "auto", pr: .5,
        display: { xs: mobilePanel === "chronicle" ? "block" : "none", lg: "block" },
        gridRow: { xs: 2, lg: 1 }, gridColumn: { xs: 1, md: "1 / -1", lg: 1 } }}>
        <EraChronicle key={selected.id} era={selected} worldMonth={worldMonth} factions={factions} rulers={rulers} onViewAllHistory={onViewAllHistory} />
      </Box>
      <Box sx={{ minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", gridRow: 1, gridColumn: { xs: 1, lg: 2 } }}>
        {selected.mapSnapshot ? <EraAtlasMap key={selected.id} snapshot={selected.mapSnapshot} full zoom={zoom} showBorders={showBorders} /> : <Typography>该时代没有保存历史地图</Typography>}
      </Box>
      <Box component="aside" aria-label="当时国家列表" sx={{ minHeight: 0, minWidth: 0, overflowY: "auto", display: { xs: mobilePanel === "statistics" ? "block" : "none", md: "block" }, gridRow: { xs: 2, md: 1 }, gridColumn: { xs: 1, md: 2, lg: 3 }, pr: .5 }}>
        <Typography fontSize="0.8rem" fontWeight={700}>诸国 · 占世界地图</Typography>
        <Typography fontSize="0.65rem" color="text.secondary" sx={{ mb: .75 }}>点击国号查看格数与城市数。<br />城市点；金色环为首都。<br />人口与君主：当前快照未记录。</Typography>
        {rows.map(row => <Box component="details" key={row.factionId} sx={{ borderBottom: "1px solid var(--gg-border)", py: .5 }}>
          <Box component="summary" sx={{ display: "flex", gap: .6, alignItems: "center", cursor: "pointer", fontSize: "0.8rem", listStyle: "none" }}>
            <Box component="span" sx={{ width: 10, height: 10, flexShrink: 0, bgcolor: `#${(row.color >>> 0).toString(16).slice(-6).padStart(6, "0")}` }} />
            <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{row.displayName}</Box>
            <Box component="span" sx={{ flexShrink: 0 }}>{(row.worldShare * 100).toFixed(1)}%</Box>
          </Box>
          <Typography fontSize="0.7rem" sx={{ mt: .35 }}>当时控制{row.controlledCells}格 · {row.cityCount}城</Typography>
        </Box>)}
      </Box>
    </Box>
    <Box ref={timeline} aria-label="横向时代时间轴" sx={{ position: "relative", display: "flex", overflowX: "auto", overflowY: "hidden", gap: .5, pb: .5, touchAction: "pan-x pan-y", minWidth: 0 }}>
      {ordered.map(era => <Button key={era.id} aria-current={era.id === selectedEraId ? "true" : undefined} variant={era.id === selectedEraId ? "contained" : "outlined"}
        title={`${era.name} · ${types[era.type]} · ${formatWorldDate(era.startMonth)}～${era.endMonth === undefined ? "今" : formatWorldDate(era.endMonth)}`} onClick={() => onNavigate(era.id)}
        sx={{ flex: "0 0 140px", minWidth: 0, height: 48, py: .35, px: .65, textAlign: "left", display: "block" }}>
        <Typography component="span" fontSize="0.75rem" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{era.name}</Typography>
        <Typography component="span" fontSize="0.62rem" sx={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatWorldDate(era.startMonth)}～{era.endMonth === undefined ? "今" : formatWorldDate(era.endMonth)}</Typography>
      </Button>)}
    </Box>
  </Box>;
}
export default memo(function EraAtlasDialog({ open, eras, selectedEraId, onNavigate, onClose, worldMonth, factions, rulers, onViewAllHistory }: { onViewAllHistory?: (eraId: string) => void; worldMonth: number; factions?: Map<string, Team>; rulers?: Map<string, Ruler>; open: boolean; eras: WorldEra[]; selectedEraId: string; onNavigate: (id: string) => void; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} maxWidth={false} aria-label="历史时代图鉴"
    PaperProps={{ sx: { width: "96vw", maxWidth: "96vw", height: "92dvh", maxHeight: "94dvh", m: 0, overflow: "hidden" } }}>
    <DialogContent sx={{ p: { xs: 1, sm: 1.5 }, overflow: "hidden", minHeight: 0 }}>
      {open ? <EraAtlasDialogContent eras={eras} selectedEraId={selectedEraId} onNavigate={onNavigate} onClose={onClose} worldMonth={worldMonth} factions={factions} rulers={rulers} onViewAllHistory={onViewAllHistory} /> : null}
    </DialogContent>
  </Dialog>;
});
