/** Local population identity hash. Kept pure so historical presentation can
 * verify label provenance without loading Game/Phaser or looking up live users. */
export function getLocalUserId(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return 1000000000 + (hash % 1000000000);
}
