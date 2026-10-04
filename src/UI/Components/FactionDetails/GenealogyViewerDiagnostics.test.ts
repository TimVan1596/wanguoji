import { describe, expect, it } from "vitest";
import {
  getGenealogyViewerDiagnostics,
  recordGenealogyViewerClose,
  recordGenealogyViewerOpen,
  subscribeGenealogyViewerDiagnostics,
} from "./GenealogyViewerDiagnostics";

describe("genealogy viewer runtime diagnostics", () => {
  it("tracks open state, close source, and the actual MUI reason without persistence", () => {
    const observed: ReturnType<typeof getGenealogyViewerDiagnostics>[] = [];
    const unsubscribe = subscribeGenealogyViewerDiagnostics((value) => observed.push(value));
    recordGenealogyViewerOpen();
    recordGenealogyViewerClose("BACKDROP", "backdropClick");
    unsubscribe();

    expect(observed).toEqual([
      { open: true, lastMuiReason: undefined },
      { open: false, lastCloseSource: "BACKDROP", lastMuiReason: "backdropClick" },
    ]);
    expect(getGenealogyViewerDiagnostics().open).toBe(false);
  });

  it("records host-unmount and faction-change sources distinctly", () => {
    recordGenealogyViewerClose("HOST_UNMOUNT");
    expect(getGenealogyViewerDiagnostics().lastCloseSource).toBe("HOST_UNMOUNT");
    recordGenealogyViewerClose("FACTION_CHANGED");
    expect(getGenealogyViewerDiagnostics().lastCloseSource).toBe("FACTION_CHANGED");
  });
});
