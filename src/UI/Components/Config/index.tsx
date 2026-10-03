import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";

import { FC, useEffect, useState } from "react";
import {
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { ConfigState } from "../../../store/configSlice";
import { DesktopSuspendPolicy, DESKTOP_SUSPEND_POLICY_LABELS, readDesktopSuspendPolicy, writeDesktopSuspendPolicy } from "../../../Runtime/DesktopSuspendPolicy";

interface ConfigProps {
  open: boolean;
  onClose: () => void;
}

const Config: FC<ConfigProps> = ({ open, onClose }) => {
  const [suspendPolicy, setSuspendPolicy] = useState<DesktopSuspendPolicy>(readDesktopSuspendPolicy);
  const config = useSelector((state: RootState) => state.config);
  const localConfigString =
    localStorage.getItem(`${config.liveId}_${config.theme}`) ?? "{}";
  const localConfig: Partial<ConfigState> = JSON.parse(localConfigString);

  useEffect(() => {
    if (open) setSuspendPolicy(readDesktopSuspendPolicy());
  }, [open]);

  const save = () => {
    localStorage.setItem(
      `${config.liveId}_${config.theme}`,
      JSON.stringify(localConfig)
    );
  };
  const setGameName = (name: string) => {
    localConfig.gameName = name;
    save();
  };
  const resetConfig = () => {
    localStorage.removeItem(`${config.liveId}_${config.theme}`);
  };
  const resetAllConfig = () => {
    localStorage.removeItem(`${config.liveId}_${config.theme}`);
  };

  return (
    <Dialog
      sx={{
        zoom: 1.5,
      }}
      open={open}
      fullWidth
      onClose={onClose}
    >
      <DialogTitle>设置</DialogTitle>
      <DialogContent>
        <DialogContentText
          sx={{
            mb: 2,
          }}
        >
          修改后自动保存；显示设置可能需刷新，桌面休眠策略对下次唤醒生效。
        </DialogContentText>
        <Box
          sx={{
            "& > :not(style)": { m: 1 },
          }}
        >
          <TextField
            onChange={(e) => setGameName(e.target.value)}
            fullWidth
            label="游戏名称"
            defaultValue={localConfig.gameName ?? config.gameName}
          />
          {window.gridGodDesktop?.isDesktop && <FormControl sx={{ mt: 2, width: "100%" }}>
            <FormLabel>系统休眠期间</FormLabel>
            <RadioGroup
              value={suspendPolicy}
              onChange={(event) => {
                const policy = event.target.value === "CATCH_UP" ? "CATCH_UP" : "PAUSE";
                setSuspendPolicy(policy);
                writeDesktopSuspendPolicy(policy);
              }}
            >
              <FormControlLabel value="PAUSE" control={<Radio />} label={DESKTOP_SUSPEND_POLICY_LABELS.PAUSE} />
              <FormControlLabel value="CATCH_UP" control={<Radio />} label={DESKTOP_SUSPEND_POLICY_LABELS.CATCH_UP} />
            </RadioGroup>
          </FormControl>}
          <TextField
            disabled
            fullWidth
            label="世界时间"
            defaultValue="由世界纪年自动推进"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={resetAllConfig}>
          清除本地配置
        </Button>
        <Button onClick={resetConfig}>重置</Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default Config;
