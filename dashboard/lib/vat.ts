/**
 * VAT / sales-tax rates by customer country.
 *
 * Coverage:
 *   - All 27 EU member states (standard rates only; digital services are
 *     always at the standard rate, never reduced rates)
 *   - UK (post-Brexit, separate registration)
 *   - EEA + adjacent: Norway, Switzerland, Iceland
 *   - Key intl markets: USA (blended default), Canada (HST default),
 *     Australia (GST), UAE, Japan
 *
 * B2B with a valid VAT ID in an EU member state other than ours triggers
 * the OSS reverse-charge rule: we issue an invoice at 0% and the customer
 * self-accounts for VAT in their country.
 *
 * Our (vendor) country is hard-coded as Greece (GR) — reverse charge only
 * applies when the customer is in a *different* EU state.
 *
 * This table should be reviewed when rates change — e.g. Estonia moved
 * from 20→22% in Jan 2024, Finland 24→25.5% in Sep 2024.
 */

export type CountryCode =
  // EU-27
  | "AT"
  | "BE"
  | "BG"
  | "HR"
  | "CY"
  | "CZ"
  | "DK"
  | "EE"
  | "FI"
  | "FR"
  | "DE"
  | "GR"
  | "HU"
  | "IE"
  | "IT"
  | "LV"
  | "LT"
  | "LU"
  | "MT"
  | "NL"
  | "PL"
  | "PT"
  | "RO"
  | "SK"
  | "SI"
  | "ES"
  | "SE"
  // Non-EU Europe
  | "GB"
  | "NO"
  | "CH"
  | "IS"
  // Other markets
  | "US"
  | "CA"
  | "AU"
  | "NZ"
  | "AE"
  | "JP"
  | "SG";

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  /** Standard VAT / GST / sales-tax rate, as a decimal (0.24 = 24%). */
  vatRate: number;
  /** Label shown next to the rate — "VAT", "GST", "Sales tax", etc. */
  taxLabel: "VAT" | "GST" | "Consumption tax" | "Sales tax";
  /** True if in EU VAT zone (subject to OSS reverse-charge B2B rules). */
  eu: boolean;
  /** Extra note shown under the VAT line, e.g. tax nuances. */
  note?: string;
  /** Simple regex for client-side VAT-ID plausibility. Real validation
   * needs VIES (EU) or HMRC (UK). */
  vatIdPattern?: RegExp;
  /** Example format shown in placeholder. */
  vatIdExample?: string;
}

/** Vendor's country of establishment — drives reverse-charge logic. */
export const VENDOR_COUNTRY: CountryCode = "GR";

export const COUNTRIES: Record<CountryCode, Country> = {
  // ── EU ───────────────────────────────────────────────────────────────────
  AT: {
    code: "AT",
    name: "Austria",
    flag: "🇦🇹",
    vatRate: 0.2,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^ATU\d{8}$/,
    vatIdExample: "ATU12345678",
  },
  BE: {
    code: "BE",
    name: "Belgium",
    flag: "🇧🇪",
    vatRate: 0.21,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^BE0?\d{9,10}$/,
    vatIdExample: "BE0123456789",
  },
  BG: {
    code: "BG",
    name: "Bulgaria",
    flag: "🇧🇬",
    vatRate: 0.2,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^BG\d{9,10}$/,
    vatIdExample: "BG123456789",
  },
  HR: {
    code: "HR",
    name: "Croatia",
    flag: "🇭🇷",
    vatRate: 0.25,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^HR\d{11}$/,
    vatIdExample: "HR12345678901",
  },
  CY: {
    code: "CY",
    name: "Cyprus",
    flag: "🇨🇾",
    vatRate: 0.19,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^CY\d{8}[A-Z]$/,
    vatIdExample: "CY12345678X",
  },
  CZ: {
    code: "CZ",
    name: "Czechia",
    flag: "🇨🇿",
    vatRate: 0.21,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^CZ\d{8,10}$/,
    vatIdExample: "CZ12345678",
  },
  DK: {
    code: "DK",
    name: "Denmark",
    flag: "🇩🇰",
    vatRate: 0.25,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^DK\d{8}$/,
    vatIdExample: "DK12345678",
  },
  EE: {
    code: "EE",
    name: "Estonia",
    flag: "🇪🇪",
    vatRate: 0.22,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^EE\d{9}$/,
    vatIdExample: "EE123456789",
  },
  FI: {
    code: "FI",
    name: "Finland",
    flag: "🇫🇮",
    vatRate: 0.255,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^FI\d{8}$/,
    vatIdExample: "FI12345678",
  },
  FR: {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    vatRate: 0.2,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
    vatIdExample: "FRXX123456789",
  },
  DE: {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    vatRate: 0.19,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^DE\d{9}$/,
    vatIdExample: "DE123456789",
  },
  GR: {
    code: "GR",
    name: "Greece",
    flag: "🇬🇷",
    vatRate: 0.24,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^EL\d{9}$/,
    vatIdExample: "EL123456789",
    note: "VAT charged locally — no reverse charge for Greek customers.",
  },
  HU: {
    code: "HU",
    name: "Hungary",
    flag: "🇭🇺",
    vatRate: 0.27,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^HU\d{8}$/,
    vatIdExample: "HU12345678",
  },
  IE: {
    code: "IE",
    name: "Ireland",
    flag: "🇮🇪",
    vatRate: 0.23,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^IE\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
    vatIdExample: "IE1234567X",
  },
  IT: {
    code: "IT",
    name: "Italy",
    flag: "🇮🇹",
    vatRate: 0.22,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^IT\d{11}$/,
    vatIdExample: "IT12345678901",
  },
  LV: {
    code: "LV",
    name: "Latvia",
    flag: "🇱🇻",
    vatRate: 0.21,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^LV\d{11}$/,
    vatIdExample: "LV12345678901",
  },
  LT: {
    code: "LT",
    name: "Lithuania",
    flag: "🇱🇹",
    vatRate: 0.21,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^LT(\d{9}|\d{12})$/,
    vatIdExample: "LT123456789",
  },
  LU: {
    code: "LU",
    name: "Luxembourg",
    flag: "🇱🇺",
    vatRate: 0.17,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^LU\d{8}$/,
    vatIdExample: "LU12345678",
  },
  MT: {
    code: "MT",
    name: "Malta",
    flag: "🇲🇹",
    vatRate: 0.18,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^MT\d{8}$/,
    vatIdExample: "MT12345678",
  },
  NL: {
    code: "NL",
    name: "Netherlands",
    flag: "🇳🇱",
    vatRate: 0.21,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^NL\d{9}B\d{2}$/,
    vatIdExample: "NL123456789B01",
  },
  PL: {
    code: "PL",
    name: "Poland",
    flag: "🇵🇱",
    vatRate: 0.23,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^PL\d{10}$/,
    vatIdExample: "PL1234567890",
  },
  PT: {
    code: "PT",
    name: "Portugal",
    flag: "🇵🇹",
    vatRate: 0.23,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^PT\d{9}$/,
    vatIdExample: "PT123456789",
  },
  RO: {
    code: "RO",
    name: "Romania",
    flag: "🇷🇴",
    vatRate: 0.19,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^RO\d{2,10}$/,
    vatIdExample: "RO12345678",
  },
  SK: {
    code: "SK",
    name: "Slovakia",
    flag: "🇸🇰",
    vatRate: 0.23,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^SK\d{10}$/,
    vatIdExample: "SK1234567890",
  },
  SI: {
    code: "SI",
    name: "Slovenia",
    flag: "🇸🇮",
    vatRate: 0.22,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^SI\d{8}$/,
    vatIdExample: "SI12345678",
  },
  ES: {
    code: "ES",
    name: "Spain",
    flag: "🇪🇸",
    vatRate: 0.21,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
    vatIdExample: "ESX12345678",
  },
  SE: {
    code: "SE",
    name: "Sweden",
    flag: "🇸🇪",
    vatRate: 0.25,
    taxLabel: "VAT",
    eu: true,
    vatIdPattern: /^SE\d{12}$/,
    vatIdExample: "SE123456789012",
  },

  // ── Non-EU Europe ────────────────────────────────────────────────────────
  GB: {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    vatRate: 0.2,
    taxLabel: "VAT",
    eu: false,
    vatIdPattern: /^GB\d{9}$/,
    vatIdExample: "GB123456789",
    note: "UK VAT registered separately from EU OSS.",
  },
  NO: {
    code: "NO",
    name: "Norway",
    flag: "🇳🇴",
    vatRate: 0.25,
    taxLabel: "VAT",
    eu: false,
    vatIdPattern: /^NO\d{9}MVA$/,
    vatIdExample: "NO123456789MVA",
  },
  CH: {
    code: "CH",
    name: "Switzerland",
    flag: "🇨🇭",
    vatRate: 0.081,
    taxLabel: "VAT",
    eu: false,
    vatIdPattern: /^CHE-?\d{3}\.?\d{3}\.?\d{3}( MWST)?$/,
    vatIdExample: "CHE-123.456.789",
  },
  IS: {
    code: "IS",
    name: "Iceland",
    flag: "🇮🇸",
    vatRate: 0.24,
    taxLabel: "VAT",
    eu: false,
    vatIdPattern: /^IS\d{5,6}$/,
    vatIdExample: "IS12345",
  },

  // ── Other markets ────────────────────────────────────────────────────────
  US: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    vatRate: 0,
    taxLabel: "Sales tax",
    eu: false,
    note: "Sales tax varies by state and is calculated at checkout where applicable.",
  },
  CA: {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    vatRate: 0.13,
    taxLabel: "GST",
    eu: false,
    note: "HST shown (Ontario default). Actual GST/HST/PST varies by province.",
  },
  AU: {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    vatRate: 0.1,
    taxLabel: "GST",
    eu: false,
    vatIdPattern: /^\d{11}$/,
    vatIdExample: "12345678901 (ABN)",
  },
  NZ: { code: "NZ", name: "New Zealand", flag: "🇳🇿", vatRate: 0.15, taxLabel: "GST", eu: false },
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    vatRate: 0.05,
    taxLabel: "VAT",
    eu: false,
    vatIdPattern: /^\d{15}$/,
    vatIdExample: "100123456700003 (TRN)",
  },
  JP: { code: "JP", name: "Japan", flag: "🇯🇵", vatRate: 0.1, taxLabel: "Consumption tax", eu: false },
  SG: { code: "SG", name: "Singapore", flag: "🇸🇬", vatRate: 0.09, taxLabel: "GST", eu: false },
};

/** Ordered for the UI — vendor country first, then EU alpha, then RoW. */
export const COUNTRY_ORDER: CountryCode[] = [
  "GR",
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "CH",
  "NO",
  "IS",
  "US",
  "CA",
  "AU",
  "NZ",
  "AE",
  "JP",
  "SG",
];

// ─────────────────────────────────────────────────────────────────────────────
// VAT computation
// ─────────────────────────────────────────────────────────────────────────────

export interface VatComputation {
  /** Effective rate applied (0 if reverse charged or no VAT). */
  rate: number;
  /** Absolute VAT / GST amount in the net's currency. */
  amount: number;
  /** Gross = net + amount */
  gross: number;
  /** True if this is an EU intra-community B2B supply with valid VAT ID. */
  reverseCharged: boolean;
  /** Label for the tax line — "VAT (24%)", "GST (10%)", "Reverse charged", etc. */
  label: string;
  /** Short explanation shown in small print. */
  explanation: string;
}

/**
 * Compute VAT for a net amount given the customer's country, whether they are
 * a business, and whether they supplied a plausible VAT ID.
 *
 * Rules applied:
 *   - EU B2B with valid VAT ID in a country other than the vendor's →
 *     reverse charge (0% VAT, customer self-accounts)
 *   - EU B2C or EU B2B without a VAT ID → charge customer-country VAT (OSS)
 *   - UK / NO / CH / etc. → charge local rate (we're assumed registered)
 *   - US → 0% at platform level (sales tax handled at checkout per state)
 */
export function computeVat({
  net,
  country,
  isBusiness,
  hasValidVatId,
}: {
  net: number;
  country: Country;
  isBusiness: boolean;
  hasValidVatId: boolean;
}): VatComputation {
  // EU reverse-charge: B2B, customer in EU, different country from vendor, valid VAT ID
  const reverseCharged = country.eu && isBusiness && hasValidVatId && country.code !== VENDOR_COUNTRY;
  if (reverseCharged) {
    return {
      rate: 0,
      amount: 0,
      gross: net,
      reverseCharged: true,
      label: "Reverse charged",
      explanation: "EU intra-community supply — you self-account for VAT under Article 196 of the VAT Directive.",
    };
  }

  if (country.vatRate === 0) {
    return {
      rate: 0,
      amount: 0,
      gross: net,
      reverseCharged: false,
      label: "No tax added",
      explanation: country.note ?? "No platform-level tax added for this country.",
    };
  }

  const rate = country.vatRate;
  const amount = round2(net * rate);
  const gross = round2(net + amount);
  const pct = rate >= 0.1 ? (rate * 100).toFixed(0) : (rate * 100).toFixed(1).replace(/\.0$/, "");
  return {
    rate,
    amount,
    gross,
    reverseCharged: false,
    label: `${country.taxLabel} (${pct}%)`,
    explanation: country.note ?? `${country.taxLabel} charged at the rate applicable in ${country.name}.`,
  };
}

/** True if the VAT ID looks plausible for the given country (pattern match). */
export function isPlausibleVatId(country: Country, id: string): boolean {
  if (!country.vatIdPattern) return false;
  const normalised = id.replace(/\s+/g, "").toUpperCase();
  return country.vatIdPattern.test(normalised);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
