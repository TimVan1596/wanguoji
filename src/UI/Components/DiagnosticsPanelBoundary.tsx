import React from "react";

/** Only wraps diagnostic UI. Gameplay remains outside this boundary. */
export default class DiagnosticsPanelBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("WorldDiagnosticsPanel failed; world continues", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <aside style={{ position: "fixed", zIndex: 5000, right: 350, bottom: 8, padding: 12, background: "#14181c", color: "white" }}>
      <p>诊断面板异常，世界仍在运行</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>重置诊断面板</button>
    </aside>;
  }
}
