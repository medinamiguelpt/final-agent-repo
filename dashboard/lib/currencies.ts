/**
 * Currencies — per-tier local prices and locale-aware formatting.
 *
 * We do NOT convert EUR at runtime — every tier has a hand-picked, round
 * local price per currency. This mirrors how mature SaaS products handle
 * multi-currency (Linear, Notion, Vercel): psychologically clean numbers
 * in each market rather than FX output like €229 → $247.32.
 *
 * To add a currency:
 *   1. Add a row below with a sensible rounded monthly price per tier
 *   2. Ensure `locale` exists in the runtime ICU data (Node 22 ships full-icu)
 *
 * Yearly price = monthly × 12 × (1 − YEARLY_DISCOUNT), rounded up to a
 * "pretty" local number by `prettyLocal()` below. Promo discounts then
 * apply on top.
 */

import { YEARLY_DISCOUNT, type TierPricing } from "./pricing";

export type CurrencyCode =
  | "EUR"
  | "USD"
  | "GBP"
  | "CHF"
  | "CAD"
  | "AUD"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "AED"
  | "JPY";

export interface Currency {
  code: CurrencyCode;
  /** BCP-47 locale used for Intl.NumberFormat */
  locale: string;
  /** Short display name */
  name: string;
  /** Flag emoji for UI flourish */
  flag: string;
  /** Decimal places (0 for JPY, 2 for the rest) */
  decimals: 0 | 2;
  /**
   * Monthly list price per tier, hand-rounded for local psychology.
   * Keys must cover every tier in SUBSCRIPTION_TIERS.
   */
  tierMonthly: Record<TierPricing["id"], number>;
  /** Monthly rounding step — 1 for JPY prices, 10 for SEK/NOK, etc. */
  roundStep: number;
}

// Rates-of-thumb used when picking the rounded numbers below (Apr 2026 ballpark):
//   USD 1.08 · GBP 0.86 · CHF 0.97 · CAD 1.48 · AUD 1.63 · SEK 11.35
//   NOK 11.55 · DKK 7.45 · PLN 4.30 · AED 3.97 · JPY 163
export const CURRENCIES: Record<CurrencyCode, Currency> = {
  EUR: {
    code: "EUR",
    locale: "en-IE",
    name: "Euro",
    flag: "🇪🇺",
    decimals: 2,
    tierMonthly: { light: 99, standard: 179, busy: 299, heavy: 499 },
    roundStep: 1,
  },
  USD: {
    code: "USD",
    locale: "en-US",
    name: "US Dollar",
    flag: "🇺🇸",
    decimals: 2,
    tierMonthly: { light: 109, standard: 199, busy: 329, heavy: 549 },
    roundStep: 1,
  },
  GBP: {
    code: "GBP",
    locale: "en-GB",
    name: "British Pound",
    flag: "🇬🇧",
    decimals: 2,
    tierMonthly: { light: 89, standard: 159, busy: 259, heavy: 429 },
    roundStep: 1,
  },
  CHF: {
    code: "CHF",
    locale: "de-CH",
    name: "Swiss Franc",
    flag: "🇨🇭",
    decimals: 2,
    tierMonthly: { light: 99, standard: 179, busy: 289, heavy: 489 },
    roundStep: 1,
  },
  CAD: {
    code: "CAD",
    locale: "en-CA",
    name: "Canadian Dollar",
    flag: "🇨🇦",
    decimals: 2,
    tierMonthly: { light: 149, standard: 269, busy: 449, heavy: 739 },
    roundStep: 1,
  },
  AUD: {
    code: "AUD",
    locale: "en-AU",
    name: "Australian Dollar",
    flag: "🇦🇺",
    decimals: 2,
    tierMonthly: { light: 159, standard: 289, busy: 479, heavy: 799 },
    roundStep: 1,
  },
  SEK: {
    code: "SEK",
    locale: "sv-SE",
    name: "Swedish Krona",
    flag: "🇸🇪",
    decimals: 2,
    tierMonthly: { light: 1099, standard: 1999, busy: 3299, heavy: 5699 },
    roundStep: 10,
  },
  NOK: {
    code: "NOK",
    locale: "nb-NO",
    name: "Norwegian Krone",
    flag: "🇳🇴",
    decimals: 2,
    tierMonthly: { light: 1099, standard: 1999, busy: 3399, heavy: 5799 },
    roundStep: 10,
  },
  DKK: {
    code: "DKK",
    locale: "da-DK",
    name: "Danish Krone",
    flag: "🇩🇰",
    decimals: 2,
    tierMonthly: { light: 749, standard: 1349, busy: 2249, heavy: 3699 },
    roundStep: 10,
  },
  PLN: {
    code: "PLN",
    locale: "pl-PL",
    name: "Polish Złoty",
    flag: "🇵🇱",
    decimals: 2,
    tierMonthly: { light: 429, standard: 779, busy: 1299, heavy: 2149 },
    roundStep: 1,
  },
  AED: {
    code: "AED",
    locale: "en-AE",
    name: "UAE Dirham",
    flag: "🇦🇪",
    decimals: 2,
    tierMonthly: { light: 399, standard: 729, busy: 1199, heavy: 1999 },
    roundStep: 1,
  },
  JPY: {
    code: "JPY",
    locale: "ja-JP",
    name: "Japanese Yen",
    flag: "🇯🇵",
    decimals: 0,
    tierMonthly: { light: 16000, standard: 29000, busy: 48000, heavy: 81000 },
    roundStep: 100,
  },
};

export const CURRENCY_ORDER: CurrencyCode[] = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "AED",
  "JPY",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Round to a "pretty" local number. Rounds up to nearest `roundStep`, then
 * subtracts 1 unit (or 1/100 for step=1 on JPY-like) for charm-pricing.
 * Used for yearly + holiday discounted totals.
 */
function prettyLocal(value: number, step: number): number {
  const rounded = Math.ceil(value / step) * step;
  return rounded - (step >= 10 ? 1 : step === 1 ? 1 : 0);
}

/** Format an amount using the currency's locale (e.g. "€229", "$249", "¥37,000"). */
export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
}

/** Yearly list price (pre-promo) in local currency. */
export function yearlyLocal(currency: Currency, tierId: TierPricing["id"]): number {
  const monthly = currency.tierMonthly[tierId];
  return prettyLocal(monthly * 12 * (1 - YEARLY_DISCOUNT), currency.roundStep);
}

/** Monthly-equivalent amount when billed yearly. */
export function yearlyMonthlyEquivalentLocal(currency: Currency, tierId: TierPricing["id"]): number {
  return Math.round(yearlyLocal(currency, tierId) / 12);
}

/** Annual savings vs paying monthly, local currency. */
export function yearlySavingsLocal(currency: Currency, tierId: TierPricing["id"]): number {
  return currency.tierMonthly[tierId] * 12 - yearlyLocal(currency, tierId);
}

/** Apply a percent discount and re-round to pretty local number. */
export function applyDiscountLocal(amount: number, pct: number, step: number): number {
  return prettyLocal(amount * (1 - pct), step);
}
