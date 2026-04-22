# TimeBookingPro — Pricing Handoff for the Landing Page

**Audience:** the engineer building the public landing page at `timebookingpro.com` (using Claude Code).
**Goal:** render pricing on the landing page using the exact same tiers, yearly math, holiday promos, multi-currency rules, and VAT logic as the product dashboard, without reinventing any of it.

Read this once end-to-end before you open Claude Code.

---

## 1. What you're being handed

Three TypeScript modules that together are the **single source of truth** for:

- **Tiers** — three plans (Starter, Professional, Enterprise) with prices, included minutes, overage rates, and feature bullets.
- **Yearly billing** — flat 20% discount, rounded to psychologically clean numbers per currency.
- **Holiday promos** — data-driven seasonal sales (Spring, Easter, Summer, Black Friday, Christmas, New Year). Active promo is auto-selected by today's date.
- **12 currencies** — EUR, USD, GBP, CHF, CAD, AUD, SEK, NOK, DKK, PLN, AED, JPY. Each currency has hand-rounded local prices per tier. **No runtime FX conversion.**
- **38 countries of VAT / sales-tax coverage** — all 27 EU states + UK, NO, CH, IS, US, CA, AU, NZ, AE, JP, SG. Full EU B2B reverse-charge handling for valid VAT IDs.

The three files:

```
lib/pricing.ts      ← tiers, yearly, promos, quote() entry point
lib/currencies.ts   ← per-tier prices per currency, formatting
lib/vat.ts          ← country table, computeVat(), VAT ID validation
```

All three are under 600 lines, framework-agnostic, zero runtime dependencies beyond `Intl`.

---

## 2. How to pull them into your repo

**Option A (now): copy the files verbatim.**

From the dashboard repo, copy these three files into your landing page's `lib/` folder:

```
dashboard/lib/pricing.ts    →  your-landing-repo/lib/pricing.ts
dashboard/lib/currencies.ts →  your-landing-repo/lib/currencies.ts
dashboard/lib/vat.ts        →  your-landing-repo/lib/vat.ts
```

That's it. No npm install needed. They import from each other with relative paths (`./pricing`, `./currencies`, `./vat`).

**Option B (later): shared package.**
When it starts hurting, we extract these three files into an `@timebookingpro/pricing` private npm package or a git submodule. Not yet — copy-paste is fine for two surfaces.

**The rule:** if you change any pricing number, currency, tier, or VAT rate in your copy, tell me so I can mirror it into the dashboard. They must never diverge. See §9.

---

## 3. The only API you need: `quote()`

Everything you render on a tier card comes from one function call.

```ts
import { SUBSCRIPTION_TIERS, quote, HOLIDAY_PROMOS, activeHolidayPromo, YEARLY_DISCOUNT } from "@/lib/pricing";
import { CURRENCY_ORDER, CURRENCIES, formatMoney } from "@/lib/currencies";
import { COUNTRY_ORDER, COUNTRIES, isPlausibleVatId, VENDOR_COUNTRY } from "@/lib/vat";

const q = quote({
  tier: SUBSCRIPTION_TIERS[0],   // "starter" | "professional" | "enterprise"
  cycle: "monthly",              // "monthly" | "yearly"
  currencyCode: "EUR",           // any key from CURRENCIES
  countryCode: "GR",             // any key from COUNTRIES
  isBusiness: false,             // controls reverse-charge eligibility
  hasValidVatId: false,          // true if the user entered a plausible VAT ID
});
```

`quote()` returns everything you need, pre-computed and pre-formatted:

```ts
{
  tier,                 // same tier object you passed in
  currency,             // full Currency object (flag, locale, etc.)
  country,              // full Country object (vatRate, taxLabel, etc.)
  cycle,                // "monthly" | "yearly"
  promo,                // active HolidayPromo or null

  netBaseline,          // list price before any discount
  netPreHoliday,        // after yearly discount, before holiday
  netEffective,         // final net after all discounts — VAT applies to this

  vat: {
    rate,               // e.g. 0.24 for Greece
    amount,             // absolute VAT in local currency
    gross,              // net + VAT (or net if reverseCharged)
    reverseCharged,     // true for EU B2B with valid VAT ID cross-border
    label,              // "VAT (24%)" or "Reverse charged" or "No tax added"
    explanation,        // small-print copy
  },

  annualSavings,        // local-currency yearly saving vs monthly
  monthlyEquivalent,    // monthly-equivalent when cycle="yearly"

  per,                  // "month" or "year"

  formatted: {          // pre-formatted strings (use these, not the numbers)
    netBaseline, netPreHoliday, netEffective,
    vatAmount, gross,
    annualSavings, monthlyEquivalent,
  },
}
```

**Always render from `formatted.*`** — those strings have the right symbol, decimal behaviour, and grouping for the user's currency locale. Never `"€" + number` yourself.

---

## 4. UI components to build

You don't need to match the dashboard's visual design exactly — do whatever looks right on the landing page. But the landing page should include these five pieces, and they should **all react to the same region state**:

### 4.1. Region picker

Three controls, rendered together near the pricing grid:

1. **Currency dropdown** — iterate `CURRENCY_ORDER`, show `{flag} {code} — {name}`
2. **Billing country dropdown** — iterate `COUNTRY_ORDER`, show `{flag} {name} · {rate}% {taxLabel}`
3. **"I'm buying for a business" checkbox** — when checked + EU country ≠ Greece, reveal a VAT ID input that validates via `isPlausibleVatId(country, id)`

Initial defaults: `EUR` / `GR` / unchecked. But **geolocate the visitor on first load** if you can (Vercel's `x-vercel-ip-country` header, Cloudflare's `CF-IPCountry`, or just `navigator.language`) and set smart defaults — someone in Germany shouldn't see Greek VAT.

### 4.2. Billing-cycle toggle

Monthly ↔ Yearly with a `−20%` badge on the Yearly side. Read the percentage from `YEARLY_DISCOUNT` so it updates automatically if we change it.

### 4.3. Holiday-promo banner

```ts
const promo = activeHolidayPromo(billingCycle);
```

If `promo` is non-null, render a banner showing `promo.name`, `promo.tagline`, `promo.emoji`, `promo.color` (accent), and `promo.code` as a dashed coupon chip. The dashboard uses a gradient background of `${promo.color}15 → ${promo.color}05`.

No hardcoded promo names. It has to be data-driven — we add sales by appending to `HOLIDAY_PROMOS`, and both surfaces pick them up automatically.

### 4.4. Three tier cards

For each tier in `SUBSCRIPTION_TIERS`, call `quote()` and render:

- **Name** + optional `badge` ("Most popular", "Best value")
- **Big price**: `q.formatted.netEffective` with `/{q.per}` suffix
- **Strikethrough**: when `q.promo` is non-null, show `q.formatted.netPreHoliday` struck through above the big price
- **Monthly-equivalent** (when yearly): `"{q.formatted.monthlyEquivalent}/mo billed annually"`
- **Tax breakdown** (a small bordered box):
  ```
  Net            €229.00
  VAT (24%)      €54.96
  ─────────────
  Total due      €283.96 /month
  ```
  For reverse charge, the tax line shows "Reverse charged" with `—` in the amount column. For US, show "No tax added".
- **Yearly savings chip** (when cycle="yearly"): `"Save €X/yr"` (+ "includes N% holiday off" if promo)
- **Feature pills**: `tier.features` + a currency-aware `"€1.145/min"` badge + `"Overage €0.60/min"` badge + (for tiers 2+) a green `"−37% /min vs. Starter"` chip showing the upgrade value
- **CTA button** tinted with `tier.color` — "Start with {tier.name}" or equivalent

### 4.5. Fine print

A line under the grid noting:
- Taxes shown for `{country.flag} {country.name}` with `country.note` appended if present
- Prices exclude / include VAT depending on country
- Overage billed at tier rate shown above

### Computing the per-minute figures

```ts
const perMinute = q.currency.tierMonthly[tier.id] / tier.minutesPerMonth;
const overagePerMinute = q.currency.overageByTier[tier.id];
// For the "−X% /min vs. previous tier" chip:
const prev = SUBSCRIPTION_TIERS[index - 1];
const prevPerMinute = q.currency.tierMonthly[prev.id] / prev.minutesPerMonth;
const savingsPct = Math.round((1 - perMinute / prevPerMinute) * 100);
```

Wrap all of those in `formatMoney(amount, q.currency)` to render.

---

## 5. The commitments behind these numbers

Do not change any of the following without a conversation.

### 5.1. Margin floor — ≥80% operating margin per tier

Prices were set to maintain **≥80% operating margin at each tier individually** (not blended, not at some target customer count — per tier, always). Reducing any price, adding included minutes, or cutting overage rates without re-validating margin is off-limits.

### 5.2. The minute ladder is tuned

| Tier | Minutes | Price | €/included min |
|---|---:|---:|---:|
| Starter | 200 | €229 | €1.145 |
| Professional | 600 | €429 | €0.715 (−37% vs Starter) |
| Enterprise | 1,600 | €859 | €0.537 (−25% vs Professional) |

Upgrade economics:
- Starter → Professional: **+€200/mo for +400 min** → €0.50/min incremental
- Professional → Enterprise: **+€430/mo for +1,000 min** → €0.43/min incremental

Each marginal minute gets cheaper as you climb. That's a deliberate ladder shape, not accidental.

### 5.3. Local prices are hand-rounded, not FX-converted

Currencies in `currencies.ts` have explicit `tierMonthly` values per tier. We do **not** convert EUR at runtime. Customers in the US see `$249 / $479 / $939`, not `$247.32 / $463.11 / $927.72`. This is how Linear, Notion, Vercel, Figma, and every other serious SaaS does it. If FX rates drift meaningfully (>10%), we re-hand-round all currencies in one pass — not continuously.

### 5.4. VAT rules are real

The reverse-charge logic in `computeVat()` is production-correct under EU OSS for digital services. Vendor country is hard-coded as Greece (`VENDOR_COUNTRY = "GR"`). If you ship anything that actually collects money, VAT IDs also need server-side VIES validation — the `isPlausibleVatId()` regex check is only a format guard. Add a TODO for that; do not ship collection without it.

### 5.5. Holiday promos are data

```ts
HOLIDAY_PROMOS: [
  { id, name, tagline, discount, starts, ends, code, appliesTo: "monthly" | "yearly" | "both", color, emoji },
  ...
]
```

Promos stack on top of the yearly discount. To add a sale, append to the array. To remove or edit, modify in place. Both landing page and dashboard read from the same array.

---

## 6. Accessibility + i18n quick notes

- `formatMoney()` uses `Intl.NumberFormat` with the currency's `locale`, so output matches local conventions (`€229` vs `229,00 €` vs `¥37,000`). Don't bypass it.
- Currency and country selectors should be native `<select>` elements (or properly-attributed custom pickers) — keyboard + screen reader matter here.
- The reverse-charge label needs a tooltip / aria-describedby pointing to `vat.explanation` so customers understand why they're not being charged VAT.
- If the landing page is multilingual (Greek / English at minimum), tier names and feature strings will need translation. The data in `pricing.ts` is English-only today — propose a translation layer if you need it, don't inline translated strings in `pricing.ts`.

---

## 7. A Claude Code prompt you can paste

When you're ready to build the pricing section, paste this into Claude Code inside your landing-page repo:

> I'm building the pricing section on the TimeBookingPro landing page. I have three TypeScript modules from the product dashboard in `lib/pricing.ts`, `lib/currencies.ts`, `lib/vat.ts`. They export `SUBSCRIPTION_TIERS`, `HOLIDAY_PROMOS`, `YEARLY_DISCOUNT`, `activeHolidayPromo()`, `quote()`, `CURRENCIES`, `CURRENCY_ORDER`, `formatMoney()`, `COUNTRIES`, `COUNTRY_ORDER`, `isPlausibleVatId()`, `VENDOR_COUNTRY`.
>
> Build a Pricing section with:
> 1. A sticky region picker (currency + billing country + "buying for a business" checkbox; VAT ID input appears for EU customers outside Greece with live regex validation)
> 2. A Monthly / Yearly toggle showing the `YEARLY_DISCOUNT` percentage as a "-20%" badge
> 3. An auto-selected holiday-promo banner when `activeHolidayPromo(cycle)` is non-null, showing name, tagline, emoji, coupon code
> 4. Three tier cards rendered from `SUBSCRIPTION_TIERS.map(tier => quote({ tier, cycle, currencyCode, countryCode, isBusiness, hasValidVatId: isPlausibleVatId(country, vatId) }))`. Each card shows strikethrough pre-promo price, big net effective price with /month or /year, a Net / VAT / Total breakdown, yearly savings chip, currency-aware €/min badge, overage badge, "-X% /min vs previous tier" chip from tier 2 onward, feature pills from `tier.features`, and a CTA.
> 5. Fine print with the country's tax note and a line about VAT inclusion.
>
> Use our existing design tokens (don't match the dashboard pixel-for-pixel; our landing page has its own visual language). Geolocate on first load via the `x-vercel-ip-country` request header to set sensible defaults. Render all money via `formatMoney()` — never concatenate symbols manually. Don't modify anything inside the three `lib/` files; they're the source of truth shared with the product.

---

## 8. What to check before shipping

- [ ] Switch currency to each of the 12 supported → all prices format correctly (JPY has no decimals; SEK uses spaces and comma-decimal; AED uses Arabic numerals in `ar-AE` locale — we use `en-AE` so that's fine)
- [ ] Switch country to each EU state → VAT rate matches expected (spot check: DE 19%, FR 20%, HU 27%, LU 17%, FI 25.5%)
- [ ] Check US → shows "No tax added" with state-tax note
- [ ] Check UK → shows 20% VAT
- [ ] Enter `DE123456789` as a German B2B VAT ID → line shows "Reverse charged —", total = net
- [ ] Enter gibberish → red border, "Invalid format" message, still charges VAT
- [ ] Flip Monthly → Yearly → prices drop ~20%, savings chip appears, monthly-equivalent line shows
- [ ] During an active promo date range → banner appears, pre-promo price strikes through, savings chip mentions holiday stacking
- [ ] Tier 2 and 3 show the green `"-37% /min vs Starter"` / `"-25% /min vs Professional"` chips
- [ ] Keyboard nav works on all dropdowns and the VAT ID input
- [ ] Page doesn't layout-shift when the region picker values change

---

## 9. Change management — keeping dashboard and landing in sync

When any of these change:

- Tier price or minute count → `pricing.ts SUBSCRIPTION_TIERS`
- Yearly discount percentage → `pricing.ts YEARLY_DISCOUNT`
- Holiday promo added / edited / removed → `pricing.ts HOLIDAY_PROMOS`
- Currency added or price rebased → `currencies.ts CURRENCIES`
- VAT rate change → `vat.ts COUNTRIES`

Message me so I can apply the same change to the dashboard's copy, or vice versa. Until we extract these into a shared package, it's a human sync.

**Never** change the exported shapes (`TierPricing`, `Currency`, `Country`, `Quote`) without coordinating — both surfaces import the types.

---

## 10. Files referenced, with current line counts

| File | Lines | Purpose |
|---|---:|---|
| `lib/pricing.ts` | 372 | Tiers, yearly, promos, `quote()` |
| `lib/currencies.ts` | 242 | Currency table, formatting |
| `lib/vat.ts` | 579 | Country table, VAT computation, VAT ID validation |

Everything else — the dashboard's React components, Supabase queries, agent integration — is irrelevant to the landing page.

---

## TL;DR

1. Copy three files into your `lib/`.
2. Call `quote()` per tier per render.
3. Always format via `formatMoney()` and the `formatted.*` strings.
4. Don't change tier prices, minutes, or VAT rules without syncing with me.
5. Ask me if anything in this doc is ambiguous before you code around it.
