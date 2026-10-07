import { canonicalBlockHitPoints } from "../Components/BlockHitPoints";

export interface BlockSaveProjectionInput {
  hp: number;
  isHome: boolean;
  isCityCenter: boolean;
  team?: { name: string };
  city?: { id: string; defense: number };
}

export function createBlockSaveProjection(
  block: BlockSaveProjectionInput,
  gridX: number,
  gridY: number,
  activeCityIds?: ReadonlySet<string>
) {
  if (block.city && activeCityIds && !activeCityIds.has(block.city.id))
    throw new Error(`Cannot export block reference to non-active city ${block.city.id} at ${gridX},${gridY}`);
  return {
    gridX,
    gridY,
    ownerFactionId: block.team?.name,
    isHome: block.isHome,
    // V1 canonical meaning: city cells project City.defense; non-city home cells preserve Block.hp.
    homeHitPoints: canonicalBlockHitPoints(block.hp, block.city?.defense),
    cityId: block.city?.id,
    isCityCenter: block.isCityCenter,
  };
}
