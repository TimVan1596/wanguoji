import type Team from "../Components/Team";
import type City from "../Components/City";
import type WorldMap from "../Components/Map";

/** Current political catchments, not birthplaces or persisted residency.
 * Four-neighbour shortest paths stay entirely on this faction's actual controlled land.
 * Equal paths resolve by immutable city ID, never Set order or RNG. */
export function buildPopularDistricts(team:Team,map:WorldMap|undefined,blockSize:number){
  const district=new Map<string,string>(),distance=new Map<string,number>();
  const cities=(team.cities??[]).filter(c=>!c.destroyed&&c.ownerFactionId===team.name)
    .sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const queue:Array<{x:number;y:number;city:City;depth:number}>=[];
  if(!map?.blocks?.length||!(blockSize>0))return {district,distance,seeds:0};
  for(const city of cities){
    const x=Math.round(city.block?.x/blockSize),y=Math.round(city.block?.y/blockSize),b=map.blocks[x]?.[y];
    if(!b||b!==city.block||b.team!==team)continue;
    const key=`${x},${y}`;if(district.has(key))continue;
    district.set(key,city.id);distance.set(key,0);queue.push({x,y,city,depth:0});
  }
  const seeds=queue.length;
  for(let cursor=0;cursor<queue.length;cursor++){
    const p=queue[cursor];
    for(const [x,y] of [[p.x,p.y-1],[p.x+1,p.y],[p.x,p.y+1],[p.x-1,p.y]]){
      const b=map.blocks[x]?.[y],key=`${x},${y}`;
      if(!b||b.team!==team||district.has(key))continue;
      district.set(key,p.city.id);distance.set(key,p.depth+1);queue.push({x,y,city:p.city,depth:p.depth+1});
    }
  }
  return {district,distance,seeds};
}

export function emptyPopularSpatialCounts(){return {invalidPosition:0,unowned:0,foreign:0,otherCity:0,otherDistrict:0,
  disconnected:0,outsideLegacy:0,recoveredDistrict:0,emptyLegacyArea:0,emptyDistrict:0,referenceMismatch:0,referenceWithOwnedPosition:0,arcadePosition:0,logicalPosition:0};}
