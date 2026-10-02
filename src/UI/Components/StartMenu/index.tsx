import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  createCustomFaction,
  createCustomScenario,
  GameScenario,
  gameScenarios,
  redistributeEvenly,
  redistributeRandomly,
  ScenarioFaction,
} from "../../../Scenarios";
import {
  MAX_INITIAL_POPULATION,
  MIN_INITIAL_POPULATION,
} from "../../../config/simulation";
import { APP_VERSION } from "../../../config/version";
import { IndexedDbWorldSaveRepository, SaveSlotMetadata, StoredWorldSaveRecord } from "../../../Persistence/WorldSaveRepository";
import { findLatestValidSave } from "../../../Persistence/SaveSlotRules";
import { setWorldSaveStorageDiagnostics } from "../../../Persistence/WorldSaveDiagnostics";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import SaveManagerDialog from "../SaveManagerDialog";

interface StartMenuProps {
  onStartNewWorld: (scenario: GameScenario) => void;
  onContinue: (record: StoredWorldSaveRecord) => void;
}

type ScenarioId = "warring-states" | "custom";

export default function StartMenu({ onStartNewWorld, onContinue }: StartMenuProps) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("warring-states");
  const [customFactions, setCustomFactions] = useState<ScenarioFaction[]>(() =>
    Array.from({ length: 4 }, (_, index) => createCustomFaction(index))
  );
  const [saveSlots, setSaveSlots] = useState<SaveSlotMetadata[]>([]);
  const [storedError, setStoredError] = useState("");
  const [storageStatus, setStorageStatus] = useState("正在检查本地存档…");
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveManagerOpen, setSaveManagerOpen] = useState(false);
  const repository = useMemo(() => new IndexedDbWorldSaveRepository(), []);

  const refreshStoredSave = async () => {
    setLoadingSave(true);
    try {
      const metadata = await repository.listMetadata();
      setSaveSlots(metadata);
      setStoredError("");
      setStorageStatus(metadata.length ? "" : "没有本地存档");
      setWorldSaveStorageDiagnostics({ status: metadata.length ? "present" : "absent", lastAction: "读取存档目录" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStoredError(message);
      setStorageStatus("本地存档读取失败");
      setWorldSaveStorageDiagnostics({ status: "error", lastAction: "读取存档", error: message });
    } finally {
      setLoadingSave(false);
    }
  };

  useEffect(() => {
    void refreshStoredSave();
  }, [repository]);

  const continueLatest = async () => {
    setLoadingSave(true);
    try {
      const result = await findLatestValidSave(repository);
      if (result.invalidSlots.length) {
        console.warn("[Wanguoji] Invalid save slots skipped during Continue", result.invalidSlots);
      }
      if (!result.record) {
        const details = result.invalidSlots.map((slot) => `${slot.slotId}: ${slot.errors.join("，")}`).join("；");
        setStoredError(details || "没有可读取的存档");
        setWorldSaveStorageDiagnostics({ status: result.invalidSlots.length ? "invalid" : "absent", lastAction: "继续游戏检查", error: details });
        return;
      }
      onContinue(result.record);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStoredError(message);
      setStorageStatus("读取存档失败");
      setWorldSaveStorageDiagnostics({ status: "error", lastAction: "继续游戏检查", error: message });
    } finally {
      setLoadingSave(false);
    }
  };

  const selectedScenario = useMemo(() => {
    if (scenarioId === "custom") {
      return createCustomScenario(customFactions);
    }
    return gameScenarios[0];
  }, [customFactions, scenarioId]);

  const handleFactionChange = (
    id: string,
    patch: Partial<ScenarioFaction>
  ) => {
    setCustomFactions((factions) =>
      factions.map((faction) =>
        faction.id === id ? { ...faction, ...patch } : faction
      )
    );
  };

  const handleAddFaction = () => {
    setCustomFactions((factions) => {
      if (factions.length >= 8) {
        return factions;
      }
      return [...factions, createCustomFaction(factions.length)];
    });
  };

  const handleRemoveFaction = (id: string) => {
    setCustomFactions((factions) => {
      if (factions.length <= 2) {
        return factions;
      }
      return factions.filter((faction) => faction.id !== id);
    });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#eef4e8",
        color: "#111",
        p: 2,
      }}
    >
      <Box
        sx={{
          width: "min(58rem, 100%)",
          maxHeight: "calc(100vh - 2rem)",
          overflowY: "auto",
          border: "1px solid #00000033",
          p: 3,
          background: "#fffffff0",
        }}
      >
        <Typography variant="h3" fontWeight="bold" align="center">
          万国纪 · Wanguoji {APP_VERSION}
        </Typography>
        <Typography variant="h5" fontWeight="bold" align="center" gutterBottom>
          世界演化模拟器
        </Typography>

        {saveSlots.length ? (
          <Box sx={{ my: 2, p: 2, border: "1px solid #00000033", borderRadius: 1 }}>
            <Button fullWidth variant="contained" disabled={loadingSave} onClick={() => void continueLatest()}>
              {loadingSave ? "正在检查存档…" : "继续游戏"}
            </Button>
            <Typography sx={{ mt: 1 }} align="center">
              {formatWorldDate(saveSlots[0].worldMonth)} · {saveSlots[0].scenarioName ?? "世界"}
            </Typography>
            <Typography align="center" color="text.secondary">
              最近存档：{new Date(saveSlots[0].savedAt).toLocaleString()}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ my: 2 }}>
            <Typography align="center" color={storedError ? "error" : "text.secondary"}>
              {storageStatus}
            </Typography>
            {storedError ? <Typography align="center" color="error">{storedError}</Typography> : null}
            <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
              <Button size="small" disabled={loadingSave} onClick={() => void refreshStoredSave()}>重新检查</Button>
            </Box>
          </Box>
        )}
        <Button fullWidth variant="outlined" onClick={() => setSaveManagerOpen(true)}>读取游戏</Button>

        <Typography sx={{ mt: 2 }} variant="h6" fontWeight="bold">
          选择世界
        </Typography>
        <RadioGroup
          value={scenarioId}
          onChange={(event) => setScenarioId(event.target.value as ScenarioId)}
        >
          <FormControlLabel
            value="warring-states"
            control={<Radio />}
            label="战国七雄"
          />
          <Typography sx={{ ml: 4, mb: 1 }} color="text.secondary">
            七雄并立，逐鹿天下。约公元前300年的中国战国格局。
          </Typography>
          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="自定义世界"
          />
          <Typography sx={{ ml: 4 }} color="text.secondary">
            创建属于自己的势力与初始格局。
          </Typography>
        </RadioGroup>

        {scenarioId === "custom" ? (
          <CustomWorldEditor
            factions={customFactions}
            onChange={handleFactionChange}
            onAdd={handleAddFaction}
            onRemove={handleRemoveFaction}
            onEven={() => setCustomFactions(redistributeEvenly(customFactions))}
            onRandom={() =>
              setCustomFactions(redistributeRandomly(customFactions))
            }
          />
        ) : (
          <Box sx={{ mt: 2, borderTop: "1px solid #0000001f", pt: 2 }}>
            <Typography fontWeight="bold">{selectedScenario.name}</Typography>
            <Typography>{selectedScenario.subtitle}</Typography>
            <Typography sx={{ mt: 1 }}>{selectedScenario.description}</Typography>
            <Typography sx={{ mt: 1 }} fontSize="0.95rem">
              势力：
              {selectedScenario.factions
                .map((faction) =>
                  faction.capital
                    ? `${faction.name}(${faction.capital})`
                    : faction.name
                )
                .join("、")}
            </Typography>
          </Box>
        )}

        <Button
          sx={{ mt: 2 }}
          fullWidth
          variant="contained"
          onClick={() => onStartNewWorld(selectedScenario)}
        >
          开始世界
        </Button>
      </Box>
      <SaveManagerDialog
        open={saveManagerOpen}
        onClose={() => { setSaveManagerOpen(false); void refreshStoredSave(); }}
        onLoad={onContinue}
      />
    </Box>
  );
}

function CustomWorldEditor({
  factions,
  onChange,
  onAdd,
  onRemove,
  onEven,
  onRandom,
}: {
  factions: ScenarioFaction[];
  onChange: (id: string, patch: Partial<ScenarioFaction>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onEven: () => void;
  onRandom: () => void;
}) {
  return (
    <Box sx={{ mt: 2, borderTop: "1px solid #0000001f", pt: 2 }}>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Button variant="outlined" onClick={onAdd} disabled={factions.length >= 8}>
          添加势力
        </Button>
        <Button
          variant="outlined"
          onClick={onEven}
          disabled={factions.length < 2}
        >
          均匀排布
        </Button>
        <Button
          variant="outlined"
          onClick={onRandom}
          disabled={factions.length < 2}
        >
          随机排布
        </Button>
        <Typography sx={{ alignSelf: "center" }} color="text.secondary">
          势力数量 {factions.length} / 8
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 1 }}>
        {factions.map((faction, index) => (
          <Box
            key={faction.id}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "1.1fr 0.8fr 0.8fr 0.8fr 0.8fr auto",
              },
              gap: 1,
              alignItems: "center",
              border: "1px solid #00000022",
              p: 1,
            }}
          >
            <TextField
              size="small"
              label={`势力${index + 1}`}
              value={faction.name}
              onChange={(event) =>
                onChange(faction.id, { name: event.target.value })
              }
            />
            <TextField
              size="small"
              label="颜色"
              type="color"
              value={numberToColor(faction.color)}
              onChange={(event) =>
                onChange(faction.id, { color: colorToNumber(event.target.value) })
              }
            />
            <TextField
              size="small"
              label="人口"
              type="number"
              value={faction.initialPopulation}
              inputProps={{
                min: MIN_INITIAL_POPULATION + 1,
                max: MAX_INITIAL_POPULATION,
              }}
              onChange={(event) =>
                onChange(faction.id, {
                  initialPopulation: clamp(
                    Number(event.target.value),
                    MIN_INITIAL_POPULATION + 1,
                    MAX_INITIAL_POPULATION
                  ),
                })
              }
            />
            <TextField
              size="small"
              label="X"
              type="number"
              value={roundRatio(faction.spawnX)}
              inputProps={{ min: 0, max: 1, step: 0.01 }}
              onChange={(event) =>
                onChange(faction.id, {
                  spawnX: clamp(Number(event.target.value), 0, 1),
                })
              }
            />
            <TextField
              size="small"
              label="Y"
              type="number"
              value={roundRatio(faction.spawnY)}
              inputProps={{ min: 0, max: 1, step: 0.01 }}
              onChange={(event) =>
                onChange(faction.id, {
                  spawnY: clamp(Number(event.target.value), 0, 1),
                })
              }
            />
            <Button
              variant="text"
              color="inherit"
              disabled={factions.length <= 2}
              onClick={() => onRemove(faction.id)}
            >
              删除
            </Button>
          </Box>
        ))}
      </Box>
      <Typography sx={{ mt: 1 }} color="text.secondary" fontSize="0.9rem">
        出生位置使用 0～1 的比例坐标，X 从左到右，Y 从上到下。
      </Typography>
    </Box>
  );
}

function numberToColor(color: number) {
  return `#${color.toString(16).padStart(6, "0").slice(-6)}`;
}

function colorToNumber(color: string) {
  return Number.parseInt(color.replace("#", ""), 16);
}

function roundRatio(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
