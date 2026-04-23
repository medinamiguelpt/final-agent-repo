/**
 * Pricing — single source of truth for subscription tiers, yearly packages,
 * and seasonal holiday promotions.
 *
 * Tier prices are set to preserve ≥80% operating margin **per tier** at the
 * modelled production cost base (fixed OpEx ~€30.70 / customer / mo + variable
 * voice-minute cost). Any price change here should re-validate that margin.
 *
 * Yearly billing applies a flat discount (YEARLY_DISCOUNT). Holiday promos
 * stack on top of the already-discounted price with `stacking: "multiply"`
 * or replace the base discount with `stacking: "replace"`.
 *
 * Keep `CLAUDE.md` "Pricing tiers" and the agent prompt (if it ever mentions
 * subscription pricing) in sync when this file changes.
 */

export type BillingCycle = "monthly" | "yearly";

export interface TierPricing {
  /** Machine id — never shown */
  id: "light" | "standard" | "heavy";
  /** Display label */
  name: string;
  /** Color used for borders / CTA */
  color: string;
  /** Monthly list price in EUR */
  monthly: number;
  /** Included voice minutes per month */
  minutesPerMonth: number;
  /** Per-minute rate charged after the included bucket is consumed */
  overageRatePerMinute: number;
  /** Short value-prop bullets (besides the minutes line) */
  features: string[];
  /** Marketing badge, optional */
  badge?: "Most popular" | "Best value";
}

/** 20% off the monthly list price when paid annually — industry standard. */
export const YEARLY_DISCOUNT = 0.2;

/*
 * Location policy: we do NOT charge per location. A subscription covers
 * UNLIMITED locations/shops for the same customer; included minutes are a
 * single shared pool across every shop they run. Adding a second (or tenth)
 * shop does not increase the bill unless it pushes total minutes past the
 * included bucket, at which point standard overage applies. Every tier's
 * feature list must say "Unlimited locations" — never "1 location",
 * "up to 3 locations", "per location", etc.
 */

/*
 * Agent-only product (no dashboard). Bookings sync to the customer's calendar
 * (cal.com on launch, Google Calendar fast-follow) and a weekly performance
 * email replaces the live dashboard surface. Every tier can buy extra minutes
 * at its overage rate WITHOUT upgrading — but the ladder is tuned so any
 * shop that's consistently in overage is better off upgrading.
 *
 * CRITICAL INVARIANT — "upgrade beats extra credits":
 *   (Standard − Light)  / (200 − 100)  < Light overage   (€0.50 < €0.60 ✓)
 *   (Heavy    − Standard) / (1000 − 200) < Standard overage (€0.4375 < €0.50 ✓)
 * If this rule breaks, you've priced a tier that nobody should upgrade into.
 *
 * Tier profiles (name matches usage volume so owners self-select):
 *   Light    —  quieter shop, ~3 calls/day    (100 min/mo · €0.60 overage)
 *   Standard —  busy shop, ~7 calls/day       (200 min/mo · €0.50 overage)
 *   Heavy    —  multi-shop / high volume      (1,000 min/mo · €0.40 overage)
 *
 * Gross margin at modelled ~€0.10/min blended voice cost (ConvAI + TTS + ASR):
 *   Light €99     → cost 100 × €0.10 = €10   → 90% margin
 *   Standard €149 → cost 200 × €0.10 = €20   → 87% margin
 *   Heavy €499    → cost 1,000 × €0.10 = €100 → 80% margin
 *
 * Incremental upgrade cost per marginal minute (always beats own overage):
 *   Light → Standard: +€50/mo buys +100 min → €0.50/min   (vs €0.60 overage)
 *   Standard → Heavy: +€350/mo buys +800 min → €0.4375/min (vs €0.50 overage)
 *
 * Per-included-minute (list):
 *   Light €0.990/min · Standard €0.745/min · Heavy €0.499/min
 *                    (−25% vs Light)       (−33% vs Standard)
 *
 * Breakeven — when the upgrade becomes cheaper than staying put + overage:
 *   Light vs Standard: Standard wins past ~183 min/mo (~6 min/day)
 *   Standard vs Heavy: Heavy wins past ~900 min/mo   (~30 min/day)
 * Both breakevens fall BEFORE the next tier's included bucket, so the
 * self-select story is clean:
 *   <183 min → Light · 183–900 min → Standard · >900 min → Heavy
 */
export const SUBSCRIPTION_TIERS: TierPricing[] = [
  {
    id: "light",
    name: "Light",
    color: "#3D7A50",
    monthly: 99,
    minutesPerMonth: 100,
    overageRatePerMinute: 0.6,
    features: [
      "100 min/month",
      "Extra minutes at €0.60/min (no upgrade required)",
      "Unlimited locations",
      "Bookings sync to your calendar",
      "Weekly performance email",
      "Email support",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    color: "#1B5EBE",
    monthly: 149,
    minutesPerMonth: 200,
    overageRatePerMinute: 0.5,
    features: [
      "200 min/month",
      "Extra minutes at €0.50/min (no upgrade required)",
      "Unlimited locations",
      "Bookings sync to your calendar",
      "Weekly performance email",
      "Priority support",
    ],
    badge: "Most popular",
  },
  {
    id: "heavy",
    name: "Heavy",
    color: "#6747C7",
    monthly: 499,
    minutesPerMonth: 1000,
    overageRatePerMinute: 0.4,
    features: [
      "1,000 min/month",
      "Extra minutes at €0.40/min (no upgrade required)",
      "Unlimited locations",
      "Bookings sync to your calendar",
      "Weekly performance email",
      "Dedicated success manager",
    ],
    badge: "Best value",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Holiday / seasonal promotions
//
// `starts` / `ends` are ISO dates (inclusive of `starts`, exclusive of `ends`).
// The active promo is the first one whose window contains "today". Add new
// sales by appending to this array — no UI changes required.
// ─────────────────────────────────────────────────────────────────────────────

export interface HolidayPromo {
  id: string;
  name: string;
  /** Short marketing tagline */
  tagline: string;
  /** Percent off as a decimal (0.25 = 25% off) */
  discount: number;
  /** ISO "YYYY-MM-DD" — sale starts 00:00 Europe/Athens this day */
  starts: string;
  /** ISO "YYYY-MM-DD" — sale ends 00:00 Europe/Athens this day */
  ends: string;
  /** Coupon code customers enter at checkout */
  code: string;
  /** "monthly" | "yearly" | "both" — which billing cycles the sale applies to */
  appliesTo: BillingCycle | "both";
  /** Banner accent */
  color: string;
  /** Emoji for banner flourish */
  emoji: string;
}

export const HOLIDAY_PROMOS: HolidayPromo[] = [
  {
    id: "spring-2026",
    name: "Spring Refresh",
    tagline: "Fresh season, fresh bookings — 15% off every plan.",
    discount: 0.15,
    starts: "2026-04-01",
    ends: "2026-05-01",
    code: "SPRING15",
    appliesTo: "both",
    color: "#2DA865",
    emoji: "🌱",
  },
  {
    id: "easter-2026",
    name: "Easter Special",
    tagline: "Καλό Πάσχα! 20% off yearly plans.",
    discount: 0.2,
    starts: "2026-04-05",
    ends: "2026-04-20",
    code: "PASCHA20",
    appliesTo: "yearly",
    color: "#D97706",
    emoji: "🐇",
  },
  {
    id: "summer-2026",
    name: "Summer Sale",
    tagline: "Busy season, smart prices — 15% off first 3 months.",
    discount: 0.15,
    starts: "2026-07-15",
    ends: "2026-08-16",
    code: "SUMMER15",
    appliesTo: "monthly",
    color: "#F59E0B",
    emoji: "☀️",
  },
  {
    id: "bf-2026",
    name: "Black Friday",
    tagline: "Our biggest sale of the year — 30% off annual plans.",
    discount: 0.3,
    starts: "2026-11-24",
    ends: "2026-12-02",
    code: "BF30",
    appliesTo: "yearly",
    color: "#111111",
    emoji: "🛍️",
  },
  {
    id: "xmas-2026",
    name: "Christmas",
    tagline: "Καλά Χριστούγεννα! 25% off every yearly plan.",
    discount: 0.25,
    starts: "2026-12-01",
    ends: "2027-01-07",
    code: "XMAS25",
    appliesTo: "yearly",
    color: "#C1272D",
    emoji: "🎄",
  },
  {
    id: "ny-2027",
    name: "New Year",
    tagline: "New year, new bookings — 20% off your first 3 months.",
    discount: 0.2,
    starts: "2027-01-01",
    ends: "2027-01-16",
    code: "NY20",
    appliesTo: "monthly",
    color: "#1B5EBE",
    emoji: "🎆",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Round up to the nearest €1, then subtract 1 — e.g. 2198.40 → 2199. */
function prettyEuro(value: number): number {
  return Math.ceil(value) - (Math.ceil(value) % 1 === 0 ? 1 : 0);
}

/** Monthly-equivalent price when billed yearly (before any promo). */
export function yearlyMonthlyEquivalent(tier: TierPricing): number {
  return Math.round(tier.monthly * (1 - YEARLY_DISCOUNT));
}

/** Annual total before any holiday promo. */
export function yearlyTotal(tier: TierPricing): number {
  return prettyEuro(tier.monthly * 12 * (1 - YEARLY_DISCOUNT));
}

/** Annual savings vs paying monthly. */
export function yearlySavings(tier: TierPricing): number {
  return tier.monthly * 12 - yearlyTotal(tier);
}

/** Pick the first active promo for a given date, scoped to a billing cycle. */
export function activeHolidayPromo(cycle: BillingCycle, now: Date = new Date()): HolidayPromo | null {
  const today = now.toISOString().slice(0, 10);
  for (const promo of HOLIDAY_PROMOS) {
    if (today < promo.starts || today >= promo.ends) continue;
    if (promo.appliesTo !== "both" && promo.appliesTo !== cycle) continue;
    return promo;
  }
  return null;
}

/**
 * Final price shown to the customer for a tier + cycle, after stacking the
 * yearly discount and any active holiday promo.
 *
 * Returns both the effective price and the pre-promo baseline so the UI can
 * strike the original through.
 */
export interface DisplayPrice {
  /** Price shown big — already includes yearly + holiday discounts */
  effective: number;
  /** Undiscounted monthly × cycle length */
  baseline: number;
  /** Pre-holiday, post-yearly price (used to compute the extra savings) */
  preHolidayBaseline: number;
  /** "month" or "year" */
  per: "month" | "year";
  /** Active promo, if any */
  promo: HolidayPromo | null;
}

export function displayPrice(tier: TierPricing, cycle: BillingCycle, now: Date = new Date()): DisplayPrice {
  const promo = activeHolidayPromo(cycle, now);
  if (cycle === "monthly") {
    const base = tier.monthly;
    const effective = promo ? prettyEuro(base * (1 - promo.discount)) : base;
    return { effective, baseline: base, preHolidayBaseline: base, per: "month", promo };
  }
  // yearly
  const preHoliday = yearlyTotal(tier);
  const effective = promo ? prettyEuro(preHoliday * (1 - promo.discount)) : preHoliday;
  return { effective, baseline: tier.monthly * 12, preHolidayBaseline: preHoliday, per: "year", promo };
}

/** Format an integer EUR amount — "€229", "€2,199". */
export function formatEuro(n: number): string {
  return `€${n.toLocaleString("en-US")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-currency + VAT quote
// ─────────────────────────────────────────────────────────────────────────────

import {
  CURRENCIES,
  applyDiscountLocal,
  formatMoney,
  yearlyLocal,
  yearlyMonthlyEquivalentLocal,
  yearlySavingsLocal,
  type Currency,
  type CurrencyCode,
} from "./currencies";
import { COUNTRIES, computeVat, type Country, type CountryCode, type VatComputation } from "./vat";

export interface Quote {
  tier: TierPricing;
  currency: Currency;
  country: Country;
  cycle: BillingCycle;
  promo: HolidayPromo | null;

  /** Net list amount before any discount (local currency). */
  netBaseline: number;
  /** Net after yearly discount, before holiday promo. */
  netPreHoliday: number;
  /** Net after all discounts — this is what VAT is applied to. */
  netEffective: number;

  /** VAT / GST breakdown applied to `netEffective`. */
  vat: VatComputation;

  /** Annual savings in local currency when billed yearly. */
  annualSavings: number;
  /** Monthly-equivalent when billed yearly. */
  monthlyEquivalent: number;

  /** "month" or "year" for display. */
  per: "month" | "year";

  /** Formatted strings ready for display. */
  formatted: {
    netBaseline: string;
    netPreHoliday: string;
    netEffective: string;
    vatAmount: string;
    gross: string;
    annualSavings: string;
    monthlyEquivalent: string;
  };
}

export interface QuoteInput {
  tier: TierPricing;
  cycle: BillingCycle;
  currencyCode: CurrencyCode;
  countryCode: CountryCode;
  isBusiness: boolean;
  hasValidVatId: boolean;
  now?: Date;
}

/**
 * One-stop pricing + tax quote. Combines tier × cycle × currency × country
 * into a single, display-ready object.
 */
export function quote(input: QuoteInput): Quote {
  const { tier, cycle, currencyCode, countryCode, isBusiness, hasValidVatId, now } = input;
  const currency = CURRENCIES[currencyCode];
  const country = COUNTRIES[countryCode];
  const promo = activeHolidayPromo(cycle, now ?? new Date());

  // Baseline + yearly discount in local currency
  const netBaseline = cycle === "monthly" ? currency.tierMonthly[tier.id] : currency.tierMonthly[tier.id] * 12;
  const netPreHoliday = cycle === "monthly" ? currency.tierMonthly[tier.id] : yearlyLocal(currency, tier.id);

  // Holiday promo stack
  const netEffective = promo ? applyDiscountLocal(netPreHoliday, promo.discount, currency.roundStep) : netPreHoliday;

  // VAT on the effective net
  const vat = computeVat({ net: netEffective, country, isBusiness, hasValidVatId });

  // Cycle-specific extras
  const annualSavings =
    cycle === "yearly" ? yearlySavingsLocal(currency, tier.id) + (promo ? netPreHoliday - netEffective : 0) : 0;
  const monthlyEquivalent = cycle === "yearly" ? yearlyMonthlyEquivalentLocal(currency, tier.id) : netEffective;

  return {
    tier,
    currency,
    country,
    cycle,
    promo,
    netBaseline,
    netPreHoliday,
    netEffective,
    vat,
    annualSavings,
    monthlyEquivalent,
    per: cycle === "monthly" ? "month" : "year",
    formatted: {
      netBaseline: formatMoney(netBaseline, currency),
      netPreHoliday: formatMoney(netPreHoliday, currency),
      netEffective: formatMoney(netEffective, currency),
      vatAmount: formatMoney(vat.amount, currency),
      gross: formatMoney(vat.gross, currency),
      annualSavings: formatMoney(annualSavings, currency),
      monthlyEquivalent: formatMoney(monthlyEquivalent, currency),
    },
  };
}
