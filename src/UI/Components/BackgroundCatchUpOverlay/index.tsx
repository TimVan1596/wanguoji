import { Box, LinearProgress, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";

export default function BackgroundCatchUpOverlay() {
  const active = useSelector(
    (state: RootState) => state.root.backgroundCatchUpActive
  );
  const overlayVisible = useSelector(
    (state: RootState) => state.root.backgroundCatchUpOverlayVisible
  );
  const progress = useSelector(
    (state: RootState) => state.root.backgroundCatchUpProgress
  );
  const message = useSelector(
    (state: RootState) => state.root.backgroundCatchUpMessage
  );
  const truncated = useSelector(
    (state: RootState) => state.root.backgroundCatchUpTruncated
  );

  if (!active || !overlayVisible) {
    return null;
  }

  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <Box
      sx={{
        position: "absolute",
        left: 18,
        top: 18,
        width: 260,
        pointerEvents: "none",
        zIndex: 30,
        p: 1.25,
        border: "1px solid rgba(58, 70, 48, 0.28)",
        borderRadius: "var(--gg-radius)",
        background: "rgba(255, 250, 230, 0.94)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
      }}
    >
      <Typography fontWeight="bold" fontSize="0.95rem">
        世界正在追赶历史… {percent}%
      </Typography>
      {message && (
        <Typography sx={{ mt: 0.25 }} fontSize="0.78rem">
          {message}
        </Typography>
      )}
      {truncated && (
        <Typography sx={{ mt: 0.25 }} fontSize="0.74rem" color="warning.main">
          离开时间较长，本次最多补算约1000年历史。
        </Typography>
      )}
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ mt: 0.75, height: 6, borderRadius: 999 }}
      />
    </Box>
  );
}
