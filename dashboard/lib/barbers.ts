export interface BarberService { name: string; price: number }
export interface BarberDraft   { name: string; services: BarberService[] }

/** Service catalogue — exact names the AI agent detects + real prices. */
export const SERVICE_CATALOGUE: BarberService[] = [
  { name: "Haircut",              price: 15 },
  { name: "Beard Trim & Shaping", price: 12 },
  { name: "Hot Towel Shave",      price: 18 },
  { name: "Full Grooming Package",price: 30 },
  { name: "Head Shave",           price: 15 },
  { name: "Hair Colour",          price: 20 },
  { name: "Eyebrow Grooming",     price:  8 },
  { name: "Scalp Massage",        price: 10 },
];

/** Shared barber name pool used by both the creation modal and demo-booking generator. */
export const BARBER_NAME_POOL = [
  "Nikos","Kostas","Giorgos","Dimitris","Stavros","Yannis","Petros",
  "Alexis","Makis","Stratos","Christos","Manolis","Panos","Thanos",
  "Vasilis","Lefteris","Stelios","Takis","Babis","Aris",
];

export const MIN_BARBERS = 1;
export const MAX_BARBERS = 8;

/** Random integer in [min, max] inclusive. */
export function rInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick one random item from an array. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Picks `n` distinct items from `arr` using a partial Fisher-Yates shuffle. */
export function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  const limit = Math.min(n, copy.length);
  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(Math.random() * (copy.length - i)) + i;
    [copy[i], copy[idx]] = [copy[idx], copy[i]];
    out.push(copy[i]);
  }
  return out;
}

/** Parse a comma-separated barber names string into a clean array. */
export function parseBarberNames(raw: string): string[] {
  return raw.split(",").map(b => b.trim()).filter(Boolean);
}
