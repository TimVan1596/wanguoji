import React from "react";
import { Box, Button, Typography } from "@mui/material";

/** Session-only presentation. Parent collectors remain mounted in both modes. */
export default class DiagnosticsOverlayFrame extends React.Component<{
  running: boolean;
  version: string;
  children: () => React.ReactNode;
}, { compact: boolean; collapseRevision: number }> {
  state = { compact: true, collapseRevision: 0 };
  expand = () => this.setState({ compact: false });
  minimize = () => this.setState({ compact: true });
  collapseAll = () => this.setState(({ collapseRevision }) => ({ collapseRevision: collapseRevision + 1 }));
  render() {
    const { running, version } = this.props;
    const common = { position: "fixed", zIndex: 5000, right: { xs: 8, md: 350 }, bottom: 8,
      bgcolor: "rgba(20,24,28,.95)", color: "#fff", border: "1px solid #90caf9" };
    if (this.state.compact) return (
      <Box sx={{ ...common, width: 230, maxWidth: "calc(100vw - 16px)", display: "flex", alignItems: "center", gap: 0.5, px: 0.75, py: 0.25 }}>
        <Typography component="span" sx={{ fontSize: 10, whiteSpace: "nowrap" }}>世界诊断 · {running ? "RUNNING" : "PAUSED"} · {version}</Typography>
        <Button size="small" sx={{ minWidth: 30, p: 0.25, fontSize: 10, color: "#90caf9" }} onClick={this.expand}>展开</Button>
      </Box>
    );
    return (
      <Box sx={{ ...common, width: 360, maxWidth: "calc(100vw - 16px)", maxHeight: "48vh", overflowY: "auto", p: 1, fontSize: 11 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ color: "#90caf9", flex: 1 }}>世界诊断</Typography>
          <Button size="small" sx={{ color: "#90caf9" }} onClick={this.collapseAll}>全部收起</Button>
          <Button size="small" sx={{ color: "#90caf9" }} onClick={this.minimize}>最小化</Button>
        </Box>
        {/* Native details have no open default; remount only the UI subtree to collapse all. */}
        <Box key={this.state.collapseRevision}>{this.props.children()}</Box>
      </Box>
    );
  }
}
