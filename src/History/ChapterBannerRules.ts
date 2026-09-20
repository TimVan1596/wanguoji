import type { WorldEvent } from "./WorldHistory";

export interface ChapterBannerItem {
  id: string;
  text: string;
  priority: number;
}

const MAX_BANNER_TEXT_LENGTH = 28;

export function createChapterBannerForEvent(
  event: WorldEvent
): ChapterBannerItem | undefined {
  if (event.type === "world-unification") {
    return {
      id: event.id,
      text: trimBannerText(event.title),
      priority: 100,
    };
  }
  if (event.type === "empire-split" || event.type === "world-fractured") {
    return {
      id: event.id,
      text: trimBannerText(event.type === "empire-split" ? event.title : "天下再裂"),
      priority: 95,
    };
  }
  if (event.type === "world-era-started") {
    const eraName = String(event.metadata?.eraName ?? "");
    if (!eraName) {
      return undefined;
    }
    return {
      id: event.id,
      text:
        event.metadata?.eraType === "DYNASTIC"
          ? `${eraName}时代确立`
          : `${eraName}格局确立`,
      priority: 90,
    };
  }
  if (event.type === "emperor-proclaimed") {
    const displayName = String(event.metadata?.displayName ?? "");
    const rulerName = String(event.metadata?.rulerName ?? "");
    if (!displayName || !rulerName) {
      return {
        id: event.id,
        text: trimBannerText(event.title),
        priority: 85,
      };
    }
    return {
      id: event.id,
      text: `${displayName}王${rulerName}称帝，${displayName}朝建立`,
      priority: 85,
    };
  }
  return undefined;
}

export function enqueueChapterBanner(
  current: ChapterBannerItem | undefined,
  pending: ChapterBannerItem[],
  next: ChapterBannerItem,
  maxPending = 5
) {
  if (current?.id === next.id || pending.some((item) => item.id === next.id)) {
    return pending;
  }
  return [...pending, next]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxPending);
}

function trimBannerText(text: string) {
  return text.replace(/[。！？]$/u, "").slice(0, MAX_BANNER_TEXT_LENGTH);
}
