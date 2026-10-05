export const MIN_GENEALOGY_SCALE = 0.5;
export const MAX_GENEALOGY_SCALE = 1.6;
export const GENEALOGY_SCALE_STEP = 0.1;

export function buildGenealogyOnDemand<T>(open: boolean, build: () => T): T | undefined {
  return open ? build() : undefined;
}

export function clampGenealogyScale(scale: number) {
  const bounded = Math.min(MAX_GENEALOGY_SCALE, Math.max(MIN_GENEALOGY_SCALE, scale));
  return Math.round(bounded * 100) / 100;
}

export function getGenealogyFitScale(
  treeWidth: number,
  treeHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  if (treeWidth <= 0 || treeHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return 1;
  return clampGenealogyScale(Math.min(viewportWidth / treeWidth, viewportHeight / treeHeight));
}

export function getGenealogyCanvasLayout(
  treeWidth: number,
  treeHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number
) {
  const scaledWidth = treeWidth * scale;
  const scaledHeight = treeHeight * scale;
  const width = Math.max(viewportWidth, scaledWidth);
  const height = Math.max(viewportHeight, scaledHeight);
  return {
    width,
    height,
    left: scaledWidth < viewportWidth ? (viewportWidth - scaledWidth) / 2 : 0,
    top: scaledHeight < viewportHeight ? (viewportHeight - scaledHeight) / 2 : 0,
  };
}
