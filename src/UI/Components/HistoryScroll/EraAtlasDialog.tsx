import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";
import type { WorldEra } from "../../../Simulation/WorldEra";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import { analyzeEraSnapshot } from "../../../Simulation/EraAtlasLayout";
import EraAtlasMap from "./EraAtlasMap";
import { atlasArrowDirection, getEraNeighbors } from "./eraSelection";
const types = { MULTIPOLAR: "群雄争衡", DUAL_RIVALRY: "双雄争霸", HEGEMONY: "霸权时代", DYNASTIC: "王朝时代", UNIFIED: "天下一统", FRAGMENTATION: "天下再裂" };
export function EraAtlasDialogContent({ eras, selectedEraId, onNavigate }: { eras: WorldEra[]; selectedEraId: string; onNavigate: (id: string) => void }) {
  const { ordered, previous, next } = useMemo(() => getEraNeighbors(eras, selectedEraId), [eras, selectedEraId]);
  const selected = ordered.find(e => e.id === selectedEraId);
  const rows = useMemo(() => selected?.mapSnapshot ? analyzeEraSnapshot(selected.mapSnapshot).territories : [], [selected?.mapSnapshot]);
  const [zoom, setZoom] = useState(1); const timeline = useRef<HTMLDivElement>(null);
  useEffect(() => { setZoom(1); timeline.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }, [selectedEraId]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const direction = atlasArrowDirection(e.key, e.target as HTMLElement), neighbor = direction < 0 ? previous : direction > 0 ? next : undefined;
      if (neighbor && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onNavigate(neighbor.id); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [previous, next, onNavigate]);
  if (!selected) return <Typography>未选择时代。</Typography>;
  return <>
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
      <Button disabled={!previous} onClick={() => previous && onNavigate(previous.id)}>← 上一时代</Button>
      <Button disabled={!next} onClick={() => next && onNavigate(next.id)}>下一时代 →</Button>
      <Typography fontSize="0.85rem">{selected.name} · {types[selected.type]}</Typography>
      {selected.mapSnapshot ? <Button onClick={() => setZoom(z => z === 1 ? 1.5 : z === 1.5 ? 2 : 1)}>查看比例 {Math.round(zoom * 100)}%</Button> : null}
    </Box>
    <Typography fontSize="0.8rem" sx={{ mb: 1 }}>时代范围：{formatWorldDate(selected.startMonth)}～{selected.endMonth === undefined ? "今" : formatWorldDate(selected.endMonth)}<br />
      时代确立记录：{formatWorldDate(selected.confirmedMonth)}{selected.mapSnapshot ? ` · 地图快照：${formatWorldDate(selected.mapSnapshot.capturedMonth)}` : ""}</Typography>
    {selected.mapSnapshot ? <>
      <EraAtlasMap snapshot={selected.mapSnapshot} full zoom={zoom} />
      <Typography fontSize="0.75rem" sx={{ my: 1 }}>城市点；金色环为首都。人口与君主：当前快照未记录。</Typography>
      <Box sx={{ display: "grid", gap: .4, maxHeight: "22vh", overflow: "auto" }} aria-label="当时国家列表">
        {rows.map(row => <Box key={row.factionId} sx={{ display: "flex", gap: .7, alignItems: "center", flexWrap: "wrap" }}>
          <Box component="span" sx={{ width: 12, height: 12, flexShrink: 0, bgcolor: `#${row.color.toString(16).padStart(6, "0")}` }} />
          <Typography fontSize="0.8rem" sx={{ overflowWrap: "anywhere" }}>{row.displayName}：占世界地图{(row.worldShare * 100).toFixed(1)}% · 当时控制{row.controlledCells}格 · {row.cityCount}城</Typography>
        </Box>)}
      </Box>
    </> : <Typography sx={{ py: 4 }}>该时代没有保存历史地图</Typography>}
    <Box ref={timeline} aria-label="横向时代时间轴" sx={{ display: "flex", overflowX: "auto", gap: .7, mt: 1.5, pb: 1, touchAction: "pan-x pan-y" }}
      onWheel={e => { const box = timeline.current; if (box && !e.ctrlKey && box.scrollWidth > box.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) box.scrollLeft += e.deltaY; }}>
      {ordered.map(era => <Button key={era.id} aria-current={era.id === selectedEraId ? "true" : undefined} variant={era.id === selectedEraId ? "contained" : "outlined"}
        onClick={() => onNavigate(era.id)} sx={{ flex: "0 0 180px", textAlign: "left", display: "block", overflowWrap: "anywhere" }}>
        {era.name}<br /><Typography component="span" fontSize="0.7rem">{formatWorldDate(era.startMonth)}～{era.endMonth === undefined ? "今" : formatWorldDate(era.endMonth)}<br />{types[era.type]}</Typography>
      </Button>)}
    </Box>
  </>;
}
export default memo(function EraAtlasDialog({ open, eras, selectedEraId, onNavigate, onClose }: { open: boolean; eras: WorldEra[]; selectedEraId: string; onNavigate: (id: string) => void; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>历史时代地图<Button onClick={onClose}>关闭</Button></DialogTitle>
    <DialogContent>{open ? <EraAtlasDialogContent eras={eras} selectedEraId={selectedEraId} onNavigate={onNavigate} /> : null}</DialogContent>
  </Dialog>;
});
