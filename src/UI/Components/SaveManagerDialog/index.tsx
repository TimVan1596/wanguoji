import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import {
  IndexedDbWorldSaveRepository,
  SaveSlotMetadata,
  StoredWorldSaveRecord,
} from "../../../Persistence/WorldSaveRepository";
import { inspectStoredWorldSave } from "../../../Persistence/WorldSaveWorkflow";
import { renameManualSave } from "../../../Persistence/SaveSlotRules";
import { formatWorldDate } from "../../../Simulation/WorldTime";

export interface SaveManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onLoad: (record: StoredWorldSaveRecord) => void;
  onCreateManual?: (displayName: string) => Promise<void>;
  defaultName?: string;
  title?: string;
}

const sectionLabels = [
  { type: "MANUAL", label: "手动存档" },
  { type: "AUTOSAVE", label: "自动存档" },
  { type: "RECOVERY", label: "恢复档" },
] as const;

export default function SaveManagerDialog({
  open,
  onClose,
  onLoad,
  onCreateManual,
  defaultName = "万国纪",
  title = "存档管理",
}: SaveManagerDialogProps) {
  const repository = useMemo(() => new IndexedDbWorldSaveRepository(), []);
  const [slots, setSlots] = useState<SaveSlotMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [busySlot, setBusySlot] = useState<string>();
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      setSlots(await repository.listMetadata());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setMessage("");
      void refresh();
    }
  }, [open, defaultName]);

  const load = async (slotId: string) => {
    setBusySlot(slotId);
    setError("");
    try {
      const validation = inspectStoredWorldSave(await repository.get(slotId), slotId);
      if (!validation.valid || !validation.record) {
        setError(validation.errors.join("；") || "存档无效");
        return;
      }
      onLoad(validation.record);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusySlot(undefined);
    }
  };

  const remove = async (slot: SaveSlotMetadata) => {
    const warning = slot.slotType === "RECOVERY"
      ? "删除后将无法使用最近恢复点。确定删除恢复档吗？"
      : `确定删除“${slot.displayName ?? slot.slotId}”？此操作不可撤销。`;
    if (!window.confirm(warning)) return;
    setBusySlot(slot.slotId);
    try {
      await repository.delete(slot.slotId);
      setMessage("存档已删除");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusySlot(undefined);
    }
  };

  const rename = async (slot: SaveSlotMetadata) => {
    const nextName = window.prompt("重命名手动存档", slot.displayName ?? "手动存档");
    if (nextName === null) return;
    setBusySlot(slot.slotId);
    try {
      const checked = inspectStoredWorldSave(await repository.get(slot.slotId), slot.slotId);
      if (!checked.valid || !checked.record) throw new Error(checked.errors.join("；") || "存档无效");
      await repository.put(slot.slotId, renameManualSave(checked.record, nextName));
      setMessage("存档名称已更新");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusySlot(undefined);
    }
  };

  const createManual = async () => {
    if (!onCreateManual) return;
    try {
      setBusySlot("new-manual");
      setError("");
      await onCreateManual(name);
      setMessage("手动存档已保存");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusySlot(undefined);
    }
  };

  const grouped = sectionLabels.map((section) => ({
    ...section,
    entries: slots.filter((slot) => slot.slotType === section.type),
  }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {onCreateManual ? (
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="手动存档名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ maxLength: 64 }}
            />
            <Button variant="contained" disabled={!name.trim() || Boolean(busySlot)} onClick={() => void createManual()}>
              {busySlot === "new-manual" ? "保存中…" : "新建手动档"}
            </Button>
          </Box>
        ) : null}
        {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mb: 1 }}>{message}</Alert> : null}
        {loading ? <Typography color="text.secondary">正在读取存档目录…</Typography> : null}
        {!loading && slots.length === 0 ? <Typography color="text.secondary">尚无存档。</Typography> : null}
        {grouped.map((group, groupIndex) => group.entries.length ? (
          <Box key={group.type}>
            {groupIndex ? <Divider sx={{ my: 1 }} /> : null}
            <Typography variant="subtitle1" fontWeight="bold">{group.label}</Typography>
            <List dense disablePadding>
              {group.entries.map((slot) => (
                <ListItem
                  key={slot.slotId}
                  divider
                  secondaryAction={(
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Button size="small" disabled={Boolean(busySlot)} onClick={() => void load(slot.slotId)}>
                        {busySlot === slot.slotId ? "检查中…" : "读取"}
                      </Button>
                      {slot.slotType === "MANUAL" ? (
                        <Button size="small" disabled={Boolean(busySlot)} onClick={() => void rename(slot)}>重命名</Button>
                      ) : null}
                      <Button size="small" color="error" disabled={Boolean(busySlot)} onClick={() => void remove(slot)}>删除</Button>
                    </Box>
                  )}
                >
                  <ListItemText
                    primary={slot.displayName ?? (slot.slotType === "RECOVERY" ? "最近恢复点" : slot.slotId)}
                    secondary={`${slot.worldYearLabel ?? formatWorldDate(slot.worldMonth)}${slot.currentEraName ? ` · ${slot.currentEraName}` : ""} · ${slot.scenarioName ?? "世界"} · ${new Date(slot.savedAt).toLocaleString()} · ${slot.appVersion}`}
                    secondaryTypographyProps={{ sx: { pr: 20 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : null)}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void refresh()} disabled={loading || Boolean(busySlot)}>刷新</Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
