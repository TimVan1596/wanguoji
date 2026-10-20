/** Frozen display labels are not entity references, even when a label equals another faction's ID. */
const labelKeys=new Set(["attackerNameAtEvent","defenderNameAtEvent","authorizingRulerTitle","commanderOffice"]);
export function metadataFactionReferences(metadata:Record<string,unknown>={}){
  return Object.entries(metadata).flatMap(([key,value])=>!labelKeys.has(key)&&typeof value==="string"?[value]:[]);
}
