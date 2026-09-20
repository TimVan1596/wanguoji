import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useState } from "react";

export default function Rule() {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ p: 1 }}>
      <Button
        fullWidth
        variant="outlined"
        onClick={() => setOpen(true)}
      >
        ? 游戏说明
      </Button>
      <Dialog open={open} fullWidth onClose={() => setOpen(false)}>
        <DialogTitle>游戏说明</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            万国纪 · Wanguoji 是一个自主世界模拟游戏。进入游戏前先选择战国七雄，或者编辑自定义世界。
          </Typography>
          <Typography paragraph>
            战国七雄只提供名称、颜色、出生位置和都城展示，不包含固定国家加成。
          </Typography>
          <Typography paragraph>
            城市是长期存在的战略节点。★ 表示首都，● 表示普通城市；点击地图上的城市可以查看归属、城防和城市历史。
          </Typography>
          <Typography paragraph>
            首都陷落后，如果该势力仍拥有其他城市，会自动迁都。只有失去全部城市，势力才真正灭亡。
          </Typography>
          <Typography paragraph>
            你可以完全旁观，也可以用上帝控制台干预世界。暂停和倍速会影响纪年、人口增长、随机事件和单位行动节奏。
          </Typography>
          <Typography paragraph>
            世界从纪元 0 年开始持续发展，历史卷轴会记录世界诞生、随机事件、里程碑、势力灭亡和天下统一等事件。
          </Typography>
          <Typography>
            上帝控制台提供加入、投靠、回城、发兵、强化和援军按钮；高级命令里仍保留原文本弹幕入口。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
