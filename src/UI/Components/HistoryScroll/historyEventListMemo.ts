export interface HistoryEventListMemoInputs {
  events: unknown;
  hasMore: boolean;
  expandedId?: string;
  teamByName: unknown;
  rulerById: unknown;
  factionColorById: unknown;
  cityNames: unknown;
  onToggleExpanded: unknown;
  onLoadMore: unknown;
  sxHeight: string;
}

export function areHistoryEventListInputsEqual(
  previous: HistoryEventListMemoInputs,
  next: HistoryEventListMemoInputs
) {
  return previous.events === next.events && previous.hasMore === next.hasMore &&
    previous.expandedId === next.expandedId && previous.teamByName === next.teamByName &&
    previous.rulerById === next.rulerById && previous.factionColorById === next.factionColorById &&
    previous.cityNames === next.cityNames && previous.onToggleExpanded === next.onToggleExpanded &&
    previous.onLoadMore === next.onLoadMore && previous.sxHeight === next.sxHeight;
}
