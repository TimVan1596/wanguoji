export interface HistoryEventListMemoInputs {
  eras?: unknown; onOpenEraMap?: unknown;
  unseenCount?: number; onScrollPosition?: unknown; onBackToLatest?: unknown;
  events: unknown;
  hasMore: boolean;
  expandedId?: string;
  teamByName: unknown;
  rulerById: unknown;
  dynastyByFactionId?: unknown;
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
  return previous.eras === next.eras && previous.onOpenEraMap === next.onOpenEraMap && previous.unseenCount === next.unseenCount && previous.onScrollPosition === next.onScrollPosition &&
    previous.onBackToLatest === next.onBackToLatest && previous.events === next.events && previous.hasMore === next.hasMore &&
    previous.expandedId === next.expandedId && previous.teamByName === next.teamByName &&
    previous.rulerById === next.rulerById && previous.dynastyByFactionId === next.dynastyByFactionId && previous.factionColorById === next.factionColorById &&
    previous.cityNames === next.cityNames && previous.onToggleExpanded === next.onToggleExpanded &&
    previous.onLoadMore === next.onLoadMore && previous.sxHeight === next.sxHeight;
}
