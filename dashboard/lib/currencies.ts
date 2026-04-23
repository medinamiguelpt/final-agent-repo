/**
 * Currencies — per-tier local prices and locale-aware formatting.
 *
 * We do NOT convert EUR at runtime — every tier has a hand-picked, round
 * local price per currency. This mirrors how mature SaaS products handle
 * multi-currency (Linear, Notion, Vercel): psychologically clean numbers
 * in each market rather than FX output like €229 → SEK 2,479.42.
 *
 * Scope (EU-only): we price in the 4 currencies actually used inside the
 * EU — EUR for the eurozone, plus SEK / DKK / PLN for the 3 non-euro EU
 * member states we carry hand-rounded tables for. EU member states whose
 * native currency we don't price in (BGN, CZK, HUF, RON) fall back to
 * EUR via COUNTRY_CURRENCY in ./vat.ts.
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

export type CurrencyCode = "EUR" | "SEK" | "DKK" | "PLN";

export interface Currency {
  code: CurrencyCode;
  /** BCP-47 locale used for Intl.NumberFormat */
  locale: string;
  /** Short display name */
  name: string;
  /** Flag emoji for UI flourish */
  flag: string;
  /** Decimal places */
  decimals: 0 | 2;
  /**
   * Monthly list price per tier, hand-rounded for local psychology.
   * Keys must cover every tier in SUBSCRIPTION_TIERS.
   */
  tierMonthly: Record<TierPricing["id"], number>;
  /** Monthly rounding step — 1 for EUR/PLN, 10 for SEK/DKK, etc. */
  roundStep: number;
}

// Rates-of-thumb used when picking the rounded numbers below (Apr 2026 ballpark):
//   SEK 11.35 · DKK 7.45 · PLN 4.30
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
  SEK: {
    code: "SEK",
    locale: "sv-SE",
    name: "Swedish Krona",
    flag: "🇸🇪",
    decimals: 2,
    tierMonthly: { light: 1099, standard: 1999, busy: 3299, heavy: 5699 },
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
};

export const CURRENCY_ORDER: CurrencyCode[] = ["EUR", "SEK", "DKK", "PLN"];

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

/** Format an amount using the currency's locale (e.g. "€229", "kr 2,479"). */
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
