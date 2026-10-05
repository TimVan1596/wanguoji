import React from "react";
import { reportRendererCrash } from "../Runtime/RendererCrashDiagnostics";

interface State { report?: string }

export default class RendererCrashBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { report: `${error.name}: ${error.message}\n${error.stack ?? ""}` };
  }

  componentDidCatch(error: Error) {
    const report = reportRendererCrash(error, "react.error-boundary");
    this.setState({ report });
  }

  render() {
    if (!this.state.report) return this.props.children;
    return <main style={{ minHeight: "100vh", padding: 32, boxSizing: "border-box", color: "#f3f4f6", background: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <h1>万国纪遇到渲染错误</h1>
      <p>模拟已暂停。请复制以下诊断信息并回传。</p>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(this.state.report ?? "")}>复制错误堆栈</button>
      <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "70vh", padding: 16, background: "#030712" }}>{this.state.report}</pre>
    </main>;
  }
}
