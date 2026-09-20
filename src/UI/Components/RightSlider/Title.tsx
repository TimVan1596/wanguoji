import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useSelector } from "react-redux";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import { RootState } from "../../../store";

export default function Title() {
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Typography
        sx={{
          p: 1,
        }}
        fontWeight="bold"
        variant="h4"
        align="center"
      >
        积分榜
      </Typography>
      <Typography
        sx={{
          p: 1,
        }}
        fontWeight="bold"
        variant="h4"
        align="center"
      >
        纪元{formatWorldDate(worldMonth)}
      </Typography>
    </Box>
  );
}
