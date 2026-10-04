export type GenealogyDialogCloseReason =
  | "explicit"
  | "escapeKeyDown"
  | "backdropClick"
  | "contentClick"
  | "emptyCanvasClick"
  | "nodeClick"
  | "toolbarClick";

/** Close only through an explicit action, Escape, or a genuine backdrop target. */
export function shouldCloseGenealogyDialog(
  reason: GenealogyDialogCloseReason,
  backdropTargetMatches = false
) {
  if (reason === "explicit" || reason === "escapeKeyDown") return true;
  return reason === "backdropClick" && backdropTargetMatches;
}
