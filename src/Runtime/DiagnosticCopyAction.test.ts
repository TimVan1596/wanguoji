import { describe, expect, it, vi } from "vitest";
import { createDiagnosticCopyAction } from "./DiagnosticCopyAction";
import { formatCoreDiagnostics, formatFullDiagnostics } from "./DiagnosticsReport";

describe("diagnostic clipboard actions", () => {
  it("collects and serializes only when each copy action is invoked", async () => {
    const read = vi.fn(() => 24192);
    const data = { runtime: { get worldMonth() { return read(); } } };
    const core = vi.fn(() => formatCoreDiagnostics(data));
    const full = vi.fn(() => formatFullDiagnostics([["Runtime", data]]));
    const write = vi.fn(async (_text: string) => undefined);
    const feedback = vi.fn();
    const copyCore = createDiagnosticCopyAction(core, write, feedback, "核心诊断");
    const copyFull = createDiagnosticCopyAction(full, write, feedback, "完整诊断");
    expect(core).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    await copyCore();
    expect(core).toHaveBeenCalledTimes(1);
    expect(full).not.toHaveBeenCalled();
    expect(write.mock.calls[0][0]).toContain("worldMonth: 24192");
    await copyFull();
    expect(full).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("catches report collection and clipboard failures without rejected promises", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const feedback = vi.fn();
    const write = vi.fn(async () => { throw new Error("clipboard denied"); });
    try {
      await expect(createDiagnosticCopyAction(() => { throw new Error("collection failed"); }, write, feedback, "核心")())
        .resolves.toBeUndefined();
      expect(write).not.toHaveBeenCalled();
      expect(feedback).toHaveBeenLastCalledWith("复制失败：collection failed");
      await createDiagnosticCopyAction(() => "report", write, feedback, "全部")();
      expect(feedback).toHaveBeenLastCalledWith("复制失败：clipboard denied");
    } finally { log.mockRestore(); }
  });
});
