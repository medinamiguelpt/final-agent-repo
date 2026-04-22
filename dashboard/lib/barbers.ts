export interface BarberService {
  name: string;
  price: number;
}
export interface BarberDraft {
  name: string;
  services: BarberService[];
}

/** Service catalogue — must match the agent prompt exactly. */
export const SERVICE_CATALOGUE: BarberService[] = [
  { name: "Haircut", price: 15 },
  { name: "Beard Trim", price: 10 },
  { name: "Full Shave", price: 12 },
  { name: "Haircut + Beard Combo", price: 22 },
  { name: "Kids Cut", price: 10 },
  { name: "Hair Styling", price: 20 },
  { name: "Eyebrow Grooming", price: 5 },
];

/** Shared barber name pool used by both the creation modal and demo-booking generator. */
export const BARBER_NAME_POOL = [
  "Nikos",
  "Kostas",
  "Giorgos",
  "Dimitris",
  "Stavros",
  "Yannis",
  "Petros",
  "Alexis",
  "Makis",
  "Stratos",
  "Christos",
  "Manolis",
  "Panos",
  "Thanos",
  "Vasilis",
  "Lefteris",
  "Stelios",
  "Takis",
  "Babis",
  "Aris",
];

export const MIN_BARBERS = 1;
export const MAX_BARBERS = 8;

/** Random integer in [min, max] inclusive. */
export function rInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick one random item from a non-empty array. Throws if empty. */
export function pick<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pick(): array is empty");
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** Picks `n` distinct items from `arr` using a partial Fisher-Yates shuffle. */
export function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy: T[] = [...arr];
  const out: T[] = [];
  const limit = Math.min(n, copy.length);
  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(Math.random() * (copy.length - i)) + i;
    // swap — safe because both i and idx are valid indices into copy
    const a = copy[i] as T;
    const b = copy[idx] as T;
    copy[i] = b;
    copy[idx] = a;
    out.push(copy[i] as T);
  }
  return out;
}

/** Parse a comma-separated barber names string into a clean array. */
export function parseBarberNames(raw: string): string[] {
  return raw
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}
