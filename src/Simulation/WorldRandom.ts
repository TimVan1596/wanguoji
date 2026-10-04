/** World-scoped deterministic random stream. Algorithm changes require a new algorithm id. */
export const WORLD_RNG_ALGORITHM = "mulberry32-v1" as const;
let generatedSeedSequence = 0;

export interface WorldRandomState {
  algorithm: typeof WORLD_RNG_ALGORITHM;
  seed: string;
  state: number;
  position: number;
}

function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function generateWorldSeed() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else {
    const fallback = `${Date.now().toString(36)}-${(++generatedSeedSequence).toString(36)}`;
    return fallback;
  }
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class WorldRandom {
  private seed = "uninitialized";
  private state = hashSeed(this.seed);
  private position = 0;

  initialize(seed: string) {
    const normalized = seed.trim();
    if (!normalized) throw new Error("World seed must not be empty");
    this.seed = normalized;
    this.state = hashSeed(normalized);
    this.position = 0;
  }

  restore(snapshot: WorldRandomState) {
    if (snapshot.algorithm !== WORLD_RNG_ALGORITHM || !snapshot.seed || !Number.isInteger(snapshot.state) || !Number.isSafeInteger(snapshot.position) || snapshot.position < 0) {
      throw new Error("Invalid WorldRandom state");
    }
    this.seed = snapshot.seed;
    this.state = snapshot.state >>> 0;
    this.position = snapshot.position;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    this.position += 1;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError("WorldRandom.int requires an integer range with max >= min");
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pickIndex(length: number) {
    if (!Number.isInteger(length) || length <= 0) throw new RangeError("WorldRandom.pickIndex requires a positive length");
    return this.int(0, length - 1);
  }

  exportState(): WorldRandomState {
    return { algorithm: WORLD_RNG_ALGORITHM, seed: this.seed, state: this.state >>> 0, position: this.position };
  }
}

const worldRandom = new WorldRandom();
export default worldRandom;
