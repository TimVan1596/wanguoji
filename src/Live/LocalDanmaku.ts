import Game from "../Game/Game";
import WorldHistory from "../History/WorldHistory";
import {
  USER_PLAYER_LOYALTY,
} from "../config/simulation";
import { store } from "../store";
import Danmu from "./Danmu";
import { IParseDanmuData } from "./type";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";

const LOCAL_FACE = resolvePublicAssetUrl("img/no-face.svg");
const COLOR_ALIASES: Record<string, string> = {
  红色: "红",
  蓝色: "蓝",
  黄色: "黄",
  绿色: "绿",
  紫色: "紫",
};

export function getLocalUserId(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return 1000000000 + (hash % 1000000000);
}

function normalizeLocalText(text: string) {
  const safeText = text.trim();
  const joinText = safeText.startsWith("加入") ? safeText.slice(2).trim() : safeText;
  return COLOR_ALIASES[joinText] ?? joinText;
}

export function createLocalDanmu(
  name: string,
  text: string,
  loyalty = USER_PLAYER_LOYALTY
): IParseDanmuData {
  const safeName = name.trim() || "本地玩家";
  return {
    id: getLocalUserId(safeName),
    name: safeName,
    text: normalizeLocalText(text),
    loyalty,
    face: LOCAL_FACE,
    card: {
      level: 0,
      liveId: 0,
    },
  };
}

export function sendLocalDanmu(name: string, text: string) {
  const danmu = createLocalDanmu(name, text);
  if (!danmu.text || !Game.Core) {
    return false;
  }
  const joinedTeam = Danmu.Apply(danmu);
  if (joinedTeam) {
    WorldHistory.addPlayerIntervention(
      store.getState().root.worldMonth,
      danmu.name,
      joinedTeam.name
    );
  }
  return true;
}
