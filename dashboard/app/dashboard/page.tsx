"use client";
import { useState, useEffect, useCallback, useRef, createContext, useContext, Fragment } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Conversation } from "@11labs/client";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Scissors,
  Store,
  Palette,
  Monitor,
  Globe,
  User,
  ShieldCheck,
  Settings as SettingsIcon,
  Check,
  Phone,
  PhoneOff,
  Plus,
  LogOut,
  ChevronDown,
  PhoneCall,
  Inbox,
  Sun,
  Moon,
  CalendarDays,
  Coins,
  Languages,
  CornerUpLeft,
  Voicemail,
  Smartphone,
  X,
  AlertCircle,
  ChevronRight,
  Trophy,
  Sparkles,
  Trash2,
  Download,
  AlertTriangle,
  Loader,
  PersonStanding,
  ArrowRight,
  PanelTop,
  PanelBottom,
  Rows2,
  Rows3,
  Rows4,
  ArrowUpDown,
  ChevronUp,
} from "lucide-react";
import { LanguageKey, LANG_META, LangSettings, DEFAULT_LANG, translate } from "./translations";
import { supabase } from "@/lib/supabase/client";
import AddShopModal from "./AddShopModal";
import { parseBarberNames } from "@/lib/barbers";
import { DEFAULT_AGENT_ID } from "@/lib/config";

const STATUS_I18N: Record<string, string> = { "in-progress": "inProgress" };

// ── Types ────────────────────────────────────────────────────────────────────
interface AgentData {
  id: string;
  name: string;
  language: string;
  languages: string[];
  llm: string;
  voice_id: string;
  last_7_day_call_count: number;
  status: string;
}
interface ConversationSummary {
  conversation_id: string;
  status: "in-progress" | "processing" | "done" | "error";
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
}
interface TranscriptMessage {
  role: "agent" | "user";
  message: string;
  time_in_call_secs: number;
}
interface ConversationDetail {
  conversation_id: string;
  status: string;
  transcript: TranscriptMessage[];
  metadata: { start_time_unix_secs: number; call_duration_secs: number };
  analysis?: { transcript_summary?: string };
}
interface ServiceLine {
  service: string;
  barber: string;
  price: number;
  duration_minutes: number;
}
interface AiBooking {
  conversation_id: string;
  source: "ai-call" | "walk-in" | "human-call" | "website" | "manual";
  status: string; // "confirmed" | "pending" | "cancelled" | "in-progress" | "failed"
  client_name: string;
  service: string;
  barber: string;
  services?: ServiceLine[];
  date: string; // "DD/MM"
  time: string; // "HH:MM"
  price: number; // from data_collection_results.price_quoted (0 if unknown)
  duration_secs: number;
  start_time_unix_secs: number;
  message_count: number;
  summary: string;
  first_user_message?: string;
  call_status: string; // raw ElevenLabs status
  call_language?: string; // ISO 639-1 from data_collection_results
  business_id?: string;
  business_name?: string;
}
type PaletteKey = "slate" | "cream" | "teal" | "contrast" | "lowvision" | "calbliss";
type ModeKey = "light" | "dark" | "system";
type DensityKey = "compact" | "comfortable" | "spacious";
type SettingsSection = "profile" | "appearance" | "dashboard" | "display" | "language" | "account" | "security";
interface Settings {
  mode: ModeKey;
  palette: PaletteKey;
  defaultTab: "hub" | "ledger";
  density: DensityKey;
  autoRefresh: boolean;
  navPosition: "top" | "bottom";
  dyslexia: boolean;
}
interface Colors {
  [key: string]: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderFaint: string;
  accent: string;
  accentMid: string;
  accentLight: string;
  text: string;
  textMuted: string;
  textFaint: string;
  green: string;
  greenLight: string;
  amber: string;
  amberLight: string;
  red: string;
  redLight: string;
  row: string;
  overlay: string;
}
interface BusinessProfile {
  businessName: string;
  ownerName: string;
  size: "solo" | "small" | "medium" | "large";
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postcode: string;
  website: string;
  hours: string;
  barbers: string; // comma-separated
  agentId: string;
  twoFactorEnabled: boolean;
}

// ── Translation context ───────────────────────────────────────────────────────
const LangCtx = createContext<(key: string) => string>((k) => k);
function useT() {
  return useContext(LangCtx);
}

// ── Palettes (WCAG AA/AAA accessible) ────────────────────────────────────────
const PALETTES: Record<PaletteKey, { name: string; swatch: string; light: Colors; dark: Colors }> = {
  cream: {
    name: "Warm Cream + Amber",
    swatch: "#D97706",
    light: {
      bg: "#FAFAF7",
      surface: "#FFFFFF",
      surfaceAlt: "#F5F0E8",
      border: "#E7DFD0",
      borderFaint: "#EDE5D8",
      accent: "#D97706",
      accentMid: "#F59E0B",
      accentLight: "#FEF3C7",
      text: "#1C1917",
      textMuted: "#78716C",
      textFaint: "#A8A29E",
      green: "#16A34A",
      greenLight: "#DCFCE7",
      amber: "#D97706",
      amberLight: "#FEF3C7",
      red: "#DC2626",
      redLight: "#FEE2E2",
      row: "#F7F5F0",
      overlay: "rgba(28,25,23,0.5)",
    },
    dark: {
      bg: "#1C1510",
      surface: "#2C201A",
      surfaceAlt: "#352A20",
      border: "#3D2E24",
      borderFaint: "#342820",
      accent: "#F59E0B",
      accentMid: "#FCD34D",
      accentLight: "#3D2008",
      text: "#FEF3C7",
      textMuted: "#A8917A",
      textFaint: "#6B5C4A",
      green: "#4ADE80",
      greenLight: "#052E16",
      amber: "#FCD34D",
      amberLight: "#422006",
      red: "#F87171",
      redLight: "#450A0A",
      row: "#221A14",
      overlay: "rgba(0,0,0,0.7)",
    },
  },
  slate: {
    name: "Slate + Indigo",
    swatch: "#6366F1",
    light: {
      bg: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceAlt: "#F1F5F9",
      border: "#E2E8F0",
      borderFaint: "#EDF2F7",
      accent: "#6366F1",
      accentMid: "#A5B4FC",
      accentLight: "#EEF2FF",
      text: "#1E293B",
      textMuted: "#64748B",
      textFaint: "#94A3B8",
      green: "#16A34A",
      greenLight: "#DCFCE7",
      amber: "#D97706",
      amberLight: "#FEF9C3",
      red: "#DC2626",
      redLight: "#FEE2E2",
      row: "#F8FAFC",
      overlay: "rgba(30,41,59,0.5)",
    },
    dark: {
      bg: "#0F172A",
      surface: "#1E293B",
      surfaceAlt: "#283548",
      border: "#334155",
      borderFaint: "#293548",
      accent: "#818CF8",
      accentMid: "#6366F1",
      accentLight: "#1E1B4B",
      text: "#E2E8F0",
      textMuted: "#94A3B8",
      textFaint: "#475569",
      green: "#4ADE80",
      greenLight: "#052E16",
      amber: "#FBBF24",
      amberLight: "#422006",
      red: "#F87171",
      redLight: "#450A0A",
      row: "#162032",
      overlay: "rgba(0,0,0,0.7)",
    },
  },
  teal: {
    name: "Midnight Teal",
    swatch: "#0D9488",
    light: {
      bg: "#F0FDFA",
      surface: "#FFFFFF",
      surfaceAlt: "#CCFBF1",
      border: "#99F6E4",
      borderFaint: "#B2F5EA",
      accent: "#0D9488",
      accentMid: "#14B8A6",
      accentLight: "#CCFBF1",
      text: "#134E4A",
      textMuted: "#3B7A74",
      textFaint: "#6DA8A0",
      green: "#059669",
      greenLight: "#D1FAE5",
      amber: "#D97706",
      amberLight: "#FEF3C7",
      red: "#DC2626",
      redLight: "#FEE2E2",
      row: "#F0FDF9",
      overlay: "rgba(19,78,74,0.5)",
    },
    dark: {
      bg: "#0D1F22",
      surface: "#142D32",
      surfaceAlt: "#1A363D",
      border: "#1F4246",
      borderFaint: "#1A3840",
      accent: "#14B8A6",
      accentMid: "#5EEAD4",
      accentLight: "#0D332E",
      text: "#F0FDFA",
      textMuted: "#7CC4BC",
      textFaint: "#3A7068",
      green: "#34D399",
      greenLight: "#052E16",
      amber: "#FBBF24",
      amberLight: "#422006",
      red: "#F87171",
      redLight: "#450A0A",
      row: "#0F2528",
      overlay: "rgba(0,0,0,0.7)",
    },
  },
  contrast: {
    name: "WCAG AAA High Contrast",
    swatch: "#1A56DB",
    light: {
      bg: "#F3F3F3",
      surface: "#FFFFFF",
      surfaceAlt: "#F3F3F3",
      border: "#CCCCCC",
      borderFaint: "#DDDDDD",
      accent: "#1A56DB",
      accentMid: "#3B82F6",
      accentLight: "#E8F0FE",
      text: "#111111",
      textMuted: "#444444",
      textFaint: "#777777",
      green: "#16A34A",
      greenLight: "#DCFCE7",
      amber: "#A16207",
      amberLight: "#FFF3CD",
      red: "#DC2626",
      redLight: "#FEE2E2",
      row: "#F8F8F8",
      overlay: "rgba(17,17,17,0.5)",
    },
    dark: {
      bg: "#0A0A0A",
      surface: "#1A1A1A",
      surfaceAlt: "#222222",
      border: "#333333",
      borderFaint: "#2A2A2A",
      accent: "#60A5FA",
      accentMid: "#93C5FD",
      accentLight: "#1E3A5F",
      text: "#F9FAFB",
      textMuted: "#999999",
      textFaint: "#555555",
      green: "#4ADE80",
      greenLight: "#052E16",
      amber: "#FBBF24",
      amberLight: "#422006",
      red: "#F87171",
      redLight: "#450A0A",
      row: "#111111",
      overlay: "rgba(0,0,0,0.85)",
    },
  },
  lowvision: {
    name: "Low Vision Soft",
    swatch: "#3D5A99",
    light: {
      bg: "#F2F0ED",
      surface: "#ECEAE5",
      surfaceAlt: "#E5E2DC",
      border: "#D0CCC4",
      borderFaint: "#DCD8D0",
      accent: "#3D5A99",
      accentMid: "#7B96CC",
      accentLight: "#D8E0F0",
      text: "#1A1A1A",
      textMuted: "#6B6560",
      textFaint: "#918C86",
      green: "#3D8C5A",
      greenLight: "#D8F0E0",
      amber: "#B07830",
      amberLight: "#F5E8D0",
      red: "#B04040",
      redLight: "#F5E0E0",
      row: "#EDEAE5",
      overlay: "rgba(26,26,26,0.5)",
    },
    dark: {
      bg: "#1E1E20",
      surface: "#2A2A2E",
      surfaceAlt: "#323236",
      border: "#3A3A40",
      borderFaint: "#333338",
      accent: "#7B96CC",
      accentMid: "#B8C4DE",
      accentLight: "#28304A",
      text: "#E8E8EA",
      textMuted: "#8A8A90",
      textFaint: "#5A5A62",
      green: "#6AC88A",
      greenLight: "#1A2E20",
      amber: "#D0A850",
      amberLight: "#2E2410",
      red: "#D08080",
      redLight: "#2E1818",
      row: "#232326",
      overlay: "rgba(0,0,0,0.65)",
    },
  },
  calbliss: {
    name: "CalBliss Purple",
    swatch: "#7C3AED",
    light: {
      bg: "#FAFAFF",
      surface: "#F0EBFF",
      surfaceAlt: "#EDE9FE",
      border: "#E4DCFF",
      borderFaint: "#EDE9FE",
      accent: "#7C3AED",
      accentMid: "#A78BFA",
      accentLight: "#EDE9FE",
      text: "#1A1027",
      textMuted: "#6B6880",
      textFaint: "#9B95B0",
      green: "#16A34A",
      greenLight: "#DCFCE7",
      amber: "#F5A623",
      amberLight: "#FEF3C7",
      red: "#EF4444",
      redLight: "#FEE2E2",
      row: "#F5F0FF",
      overlay: "rgba(26,16,39,0.5)",
    },
    dark: {
      bg: "#0D0714",
      surface: "#16102A",
      surfaceAlt: "#1E1535",
      border: "#2D1F4E",
      borderFaint: "#1E1535",
      accent: "#A78BFA",
      accentMid: "#7C3AED",
      accentLight: "#2D1F4E",
      text: "#F0EEFF",
      textMuted: "#9B95B0",
      textFaint: "#6B6880",
      green: "#4ADE80",
      greenLight: "#052E16",
      amber: "#F5A623",
      amberLight: "#422006",
      red: "#F87171",
      redLight: "#450A0A",
      row: "#110A1E",
      overlay: "rgba(0,0,0,0.75)",
    },
  },
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: Settings = {
  mode: "dark",
  palette: "calbliss",
  defaultTab: "hub",
  density: "comfortable",
  autoRefresh: true,
  navPosition: "top",
  dyslexia: false,
};
const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "Greek Barber Festival",
  ownerName: "",
  size: "small",
  email: "demo@barbershop.com",
  phone: "",
  address: "Leoforos Kifissou 42, Egaleo",
  city: "Athens",
  country: "GR",
  postcode: "",
  website: "",
  hours: "Tue–Sat · 10:00–20:00",
  barbers: "Nikos, Giorgos, Eleni, Petros",
  agentId: DEFAULT_AGENT_ID,
  twoFactorEnabled: false,
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const s = localStorage.getItem("gbf-dashboard-settings");
    if (!s) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(s);
    // Coerce legacy string autoRefresh ("off"|"30s"|"1m"|"5m") to boolean
    if (typeof parsed.autoRefresh === "string") {
      parsed.autoRefresh = parsed.autoRefresh !== "off";
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function loadProfile(): BusinessProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const s = localStorage.getItem("gbf-business-profile");
    return s ? { ...DEFAULT_PROFILE, ...JSON.parse(s) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}
function loadLangSettings(): LangSettings {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const s = localStorage.getItem("gbf-language-settings");
    return s ? { ...DEFAULT_LANG, ...JSON.parse(s) } : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}
function resolveMode(mode: ModeKey): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function getColors(settings: Settings): Colors {
  const p = PALETTES[settings.palette] ?? PALETTES.cream;
  return p[typeof window !== "undefined" ? resolveMode(settings.mode) : "light"];
}

// ── Static data ───────────────────────────────────────────────────────────────
const TODAY = new Date();
const fmt = (d: Date) => d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
const d0 = fmt(TODAY),
  d1 = fmt(new Date(TODAY.getTime() + 86400000)),
  d2 = fmt(new Date(TODAY.getTime() + 172800000));

const APPOINTMENTS = [
  {
    id: 1,
    name: "Αλέξανδρος",
    service: "Haircut",
    barber: "Nikos",
    date: d0,
    time: "10:30",
    status: "confirmed",
    price: 15,
  },
  {
    id: 2,
    name: "Maria S.",
    service: "Eyebrow Grooming",
    barber: "Eleni",
    date: d0,
    time: "11:00",
    status: "confirmed",
    price: 5,
  },
  {
    id: 3,
    name: "Δημήτρης",
    service: "Haircut + Beard Combo",
    barber: "Giorgos",
    date: d0,
    time: "12:00",
    status: "in-progress",
    price: 22,
  },
  {
    id: 4,
    name: "Sofia A.",
    service: "Full Shave",
    barber: "Petros",
    date: d0,
    time: "13:30",
    status: "confirmed",
    price: 12,
  },
  {
    id: 5,
    name: "Νίκος Κ.",
    service: "Beard Trim",
    barber: "Nikos",
    date: d0,
    time: "14:00",
    status: "pending",
    price: 10,
  },
  {
    id: 6,
    name: "Elena P.",
    service: "Hair Styling",
    barber: "Eleni",
    date: d0,
    time: "15:00",
    status: "confirmed",
    price: 20,
  },
  {
    id: 7,
    name: "Βασίλης",
    service: "Full Shave",
    barber: "Giorgos",
    date: d0,
    time: "16:30",
    status: "confirmed",
    price: 12,
  },
  {
    id: 8,
    name: "Κώστας Μ.",
    service: "Kids Cut",
    barber: "Petros",
    date: d0,
    time: "17:00",
    status: "cancelled",
    price: 10,
  },
  {
    id: 9,
    name: "Θανάσης",
    service: "Haircut",
    barber: "Nikos",
    date: d1,
    time: "10:30",
    status: "confirmed",
    price: 15,
  },
  {
    id: 10,
    name: "Ειρήνη",
    service: "Haircut + Beard Combo",
    barber: "Eleni",
    date: d1,
    time: "11:00",
    status: "pending",
    price: 22,
  },
  {
    id: 11,
    name: "Παναγιώτης",
    service: "Full Shave",
    barber: "Giorgos",
    date: d1,
    time: "13:00",
    status: "confirmed",
    price: 12,
  },
  {
    id: 12,
    name: "Μαρία Κ.",
    service: "Eyebrow Grooming",
    barber: "Eleni",
    date: d1,
    time: "14:30",
    status: "confirmed",
    price: 5,
  },
  {
    id: 13,
    name: "Γιώργης",
    service: "Beard Trim",
    barber: "Petros",
    date: d1,
    time: "15:00",
    status: "confirmed",
    price: 10,
  },
  {
    id: 14,
    name: "Στέλιος",
    service: "Haircut",
    barber: "Nikos",
    date: d2,
    time: "10:00",
    status: "confirmed",
    price: 15,
  },
  {
    id: 15,
    name: "Χριστίνα",
    service: "Hair Styling",
    barber: "Eleni",
    date: d2,
    time: "11:00",
    status: "confirmed",
    price: 20,
  },
];
const DENSITY_PAD: Record<DensityKey, { card: string; row: string; gap: number }> = {
  compact: { card: "14px 18px", row: "9px 14px", gap: 14 },
  comfortable: { card: "20px 24px", row: "14px 16px", gap: 20 },
  spacious: { card: "28px 32px", row: "18px 20px", gap: 28 },
};
const STATUS_BORDER: Record<string, string> = {
  confirmed: "#3D7A50",
  "in-progress": "#B8782A",
  pending: "#9AAABB",
  cancelled: "#B04040",
};

// ── Language badge config ────────────────────────────────────────────────────
const LANG_BADGE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  el: { color: "#2563EB", bg: "#DBEAFE", border: "#2563EB22" }, // blue
  en: { color: "#B45309", bg: "#FEF3C7", border: "#D9770822" }, // amber
  es: { color: "#DC2626", bg: "#FEE2E2", border: "#DC262622" }, // red
  pt: { color: "#16A34A", bg: "#DCFCE7", border: "#16A34A22" }, // green
  fr: { color: "#7C3AED", bg: "#EDE9FE", border: "#7C3AED22" }, // purple
  de: { color: "#CA8A04", bg: "#FEF9C3", border: "#CA8A0422" }, // yellow
  ar: { color: "#0D9488", bg: "#CCFBF1", border: "#0D948822" }, // teal
};
const LANG_BADGE_FALLBACK = { color: "#6B7280", bg: "#F3F4F6", border: "#6B728022" };

const MOCK_SESSIONS = [
  { id: 1, device: "Chrome · macOS", location: "Athens, GR", current: true, lastSeen: "Now" },
  { id: 2, device: "Safari · iPhone", location: "Athens, GR", current: false, lastSeen: "2h ago" },
];

// ── Analytics Mock Data ───────────────────────────────────────────────────────
const REVENUE_TREND = [
  { label: "25/3", revenue: 280, appts: 14 },
  { label: "26/3", revenue: 0, appts: 0 },
  { label: "27/3", revenue: 340, appts: 17 },
  { label: "28/3", revenue: 295, appts: 15 },
  { label: "29/3", revenue: 410, appts: 21 },
  { label: "30/3", revenue: 365, appts: 18 },
  { label: "31/3", revenue: 320, appts: 16 },
  { label: "1/4", revenue: 0, appts: 0 },
  { label: "2/4", revenue: 380, appts: 19 },
  { label: "3/4", revenue: 425, appts: 22 },
  { label: "4/4", revenue: 310, appts: 16 },
  { label: "5/4", revenue: 450, appts: 23 },
  { label: "6/4", revenue: 390, appts: 20 },
  { label: "Today", revenue: 175, appts: 9 },
];
const CALL_TREND = [
  { label: "Tue", successful: 8, failed: 1 },
  { label: "Wed", successful: 12, failed: 2 },
  { label: "Thu", successful: 9, failed: 0 },
  { label: "Fri", successful: 15, failed: 3 },
  { label: "Sat", successful: 18, failed: 2 },
  { label: "Sun", successful: 0, failed: 0 },
  { label: "Mon", successful: 11, failed: 1 },
];
const BARBER_STATS = [
  {
    name: "Nikos",
    revenue: 1840,
    clients: 87,
    appts: 92,
    topService: "Haircut",
    avgTicket: 20.0,
    utilization: 88,
    color: "#3D7A50",
  },
  {
    name: "Giorgos",
    revenue: 1620,
    clients: 74,
    appts: 79,
    topService: "Haircut + Beard Combo",
    avgTicket: 20.5,
    utilization: 78,
    color: "#1B5EBE",
  },
  {
    name: "Eleni",
    revenue: 1280,
    clients: 68,
    appts: 73,
    topService: "Eyebrow Grooming",
    avgTicket: 17.5,
    utilization: 72,
    color: "#C0305A",
  },
  {
    name: "Petros",
    revenue: 1100,
    clients: 52,
    appts: 58,
    topService: "Full Shave",
    avgTicket: 19.0,
    utilization: 63,
    color: "#6747C7",
  },
];
const SERVICE_STATS = [
  { name: "Haircut", count: 48, revenue: 720, pct: 31 },
  { name: "Beard Trim", count: 32, revenue: 320, pct: 21 },
  { name: "Full Shave", count: 18, revenue: 216, pct: 12 },
  { name: "Eyebrow Grooming", count: 16, revenue: 80, pct: 11 },
  { name: "Haircut + Beard Combo", count: 20, revenue: 440, pct: 13 },
  { name: "Hair Styling", count: 10, revenue: 200, pct: 7 },
  { name: "Kids Cut", count: 8, revenue: 80, pct: 5 },
];
const PEAK_DAYS = ["Tue", "Wed", "Thu", "Fri", "Sat"];
const PEAK_HOURS_LABELS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const PEAK_DATA = [
  [1, 2, 2, 3, 2, 2, 1, 1, 0, 0],
  [2, 3, 3, 4, 3, 3, 2, 2, 1, 0],
  [1, 2, 3, 3, 2, 2, 2, 1, 0, 0],
  [2, 4, 4, 4, 3, 4, 3, 3, 2, 1],
  [3, 4, 4, 4, 4, 4, 4, 3, 2, 1],
];
const PEAK_LABELS = ["Quiet", "Light", "Moderate", "Busy", "Peak"];

// ── Demo AI bookings (simulated call history for demo purposes) ───────────────
// Timestamps are computed relative to page load so "X ago" labels stay accurate.
// IDs start with "demo_" so transcript fetch is skipped (no real ElevenLabs record).
const _N = Math.floor(Date.now() / 1000);
const _dfmt = (d: Date) => d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
const _pastDate = (daysAgo: number) => _dfmt(new Date(Date.now() - daysAgo * 86400000));

type TMsg = { role: "agent" | "user"; message: string; time_in_call_secs: number };
const DEMO_TRANSCRIPTS: Record<string, TMsg[]> = {
  demo_001: [
    {
      role: "agent",
      message: "Καλησπέρα σας, Greek Barber Festival. Τι μπορώ να κάνω για εσάς;",
      time_in_call_secs: 0,
    },
    { role: "user", message: "Γεια σας, θα ήθελα να κλείσω ένα ραντεβού για κούρεμα.", time_in_call_secs: 7 },
    { role: "agent", message: "Τι μέρα και ώρα σας βολεύει;", time_in_call_secs: 10 },
    { role: "user", message: "Σήμερα στις δεκα και μισή, με τον Nikos.", time_in_call_secs: 18 },
    { role: "agent", message: "Σήμερα στις δέκα και μισή με τον Nikos. Πώς σας λένε;", time_in_call_secs: 22 },
    { role: "user", message: "Μιχάλης.", time_in_call_secs: 32 },
    {
      role: "agent",
      message: "Μιχάλη, κούρεμα με τον Nikos σήμερα στις δέκα και μισή. Θέλετε να προσθέσουμε και beard trim;",
      time_in_call_secs: 35,
    },
    { role: "user", message: "Όχι, μόνο κούρεμα. Ευχαριστώ!", time_in_call_secs: 44 },
    { role: "agent", message: "Κλείσαμε! Τα λέμε, Μιχάλη!", time_in_call_secs: 46 },
  ],
  demo_002: [
    {
      role: "agent",
      message: "Good afternoon, thank you for calling Greek Barber Festival! How can I help you today?",
      time_in_call_secs: 0,
    },
    { role: "user", message: "Hi! I'd like to book a hair styling appointment please.", time_in_call_secs: 6 },
    { role: "agent", message: "What day and time works for you?", time_in_call_secs: 9 },
    { role: "user", message: "This afternoon if possible?", time_in_call_secs: 18 },
    { role: "agent", message: "What time in the afternoon?", time_in_call_secs: 22 },
    { role: "user", message: "Two o'clock works.", time_in_call_secs: 33 },
    { role: "agent", message: "Two works. Do you have a preference for a barber?", time_in_call_secs: 36 },
    { role: "user", message: "Eleni please.", time_in_call_secs: 41 },
    { role: "agent", message: "What is your name?", time_in_call_secs: 44 },
    { role: "user", message: "Elena.", time_in_call_secs: 48 },
    {
      role: "agent",
      message: "Elena, hair styling with Eleni today at two. Would you like to add a beard trim or eyebrow grooming?",
      time_in_call_secs: 50,
    },
    { role: "user", message: "No thanks, just the styling.", time_in_call_secs: 56 },
    { role: "agent", message: "All set! See you, Elena!", time_in_call_secs: 58 },
    { role: "user", message: "Thank you so much!", time_in_call_secs: 53 },
    { role: "agent", message: "You're welcome! See you this afternoon!", time_in_call_secs: 55 },
  ],
  demo_003: [
    { role: "agent", message: "Καλημέρα, Greek Barber Festival! Τι μπορώ να κάνω για εσάς;", time_in_call_secs: 0 },
    {
      role: "user",
      message: "Γεια σας! Θα ήθελα κούρεμα και γένια μαζί. Έχω μία ειδική εκδήλωση αύριο.",
      time_in_call_secs: 5,
    },
    { role: "agent", message: "Τι μέρα και ώρα σας βολεύει;", time_in_call_secs: 9 },
    { role: "user", message: "Αύριο στις 11 αν γίνεται, με τον Giorgos.", time_in_call_secs: 20 },
    { role: "agent", message: "Αύριο στις έντεκα με τον Giorgos. Πώς σας λένε;", time_in_call_secs: 25 },
    { role: "user", message: "Δημήτρης.", time_in_call_secs: 34 },
    {
      role: "agent",
      message:
        "Δημήτρη, κούρεμα και γένια combo με τον Giorgos αύριο στις έντεκα. Θέλετε να προσθέσουμε και eyebrow grooming;",
      time_in_call_secs: 37,
    },
    { role: "user", message: "Όχι ευχαριστώ.", time_in_call_secs: 44 },
    { role: "agent", message: "Κλείσαμε! Τα λέμε, Δημήτρη!", time_in_call_secs: 46 },
    { role: "user", message: "Ευχαριστώ πολύ!", time_in_call_secs: 48 },
  ],
  demo_004: [
    { role: "agent", message: "Greek Barber Festival, καλησπέρα! Πώς μπορώ να σας εξυπηρετήσω;", time_in_call_secs: 0 },
    {
      role: "user",
      message: "Γεια σας, θέλω να κλείσω ραντεβού για διαμόρφωση φρυδιών με την Eleni.",
      time_in_call_secs: 6,
    },
    {
      role: "agent",
      message: "Φυσικά! Η Eleni είναι ειδικεύεται στο eyebrow grooming. Ποιο απόγευμα σας βολεύει;",
      time_in_call_secs: 10,
    },
    { role: "user", message: "Χθες στις 4 και μισή αν γίνεται.", time_in_call_secs: 18 },
    { role: "agent", message: "Βλέπω ότι η Eleni είναι ελεύθερη στις 16:30. Πώς σας λένε;", time_in_call_secs: 22 },
    { role: "user", message: "Sofia Makri.", time_in_call_secs: 30 },
    {
      role: "agent",
      message: "Άψογα Sofia! Eyebrow grooming με την Eleni στις 16:30. Σας περιμένουμε!",
      time_in_call_secs: 33,
    },
  ],
  demo_005: [
    { role: "agent", message: "Καλημέρα, Greek Barber Festival! Τι μπορώ να κάνω για εσάς;", time_in_call_secs: 0 },
    {
      role: "user",
      message: "Γεια σας. Θέλω να ακυρώσω το ραντεβού μου, κάτι έτυχε στη δουλειά.",
      time_in_call_secs: 5,
    },
    {
      role: "agent",
      message: "Λυπάμαι που το ακούω αυτό. Μπορείτε να μου πείτε το όνομά σας για να βρω το ραντεβού;",
      time_in_call_secs: 10,
    },
    { role: "user", message: "Κώστας Βασιλόπουλος.", time_in_call_secs: 18 },
    {
      role: "agent",
      message: "Βρήκα το ραντεβού σας Κώστα — ξύρισμα με τον Petros στις 09:30. Θέλετε να το ακυρώσω;",
      time_in_call_secs: 22,
    },
    { role: "user", message: "Ναι παρακαλώ.", time_in_call_secs: 32 },
    {
      role: "agent",
      message: "Το ραντεβού ακυρώθηκε. Θα θέλατε να κλείσουμε κάποια άλλη ημέρα;",
      time_in_call_secs: 35,
    },
    { role: "user", message: "Όχι αυτή τη στιγμή, θα επικοινωνήσω ξανά. Ευχαριστώ.", time_in_call_secs: 41 },
    { role: "agent", message: "Κανένα πρόβλημα! Σας περιμένουμε όποτε θέλετε. Καλή συνέχεια!", time_in_call_secs: 45 },
  ],
  demo_006: [
    { role: "agent", message: "Greek Barber Festival, καλημέρα! Πώς μπορώ να σας βοηθήσω;", time_in_call_secs: 0 },
    {
      role: "user",
      message: "Γεια! Θέλω ραντεβού για τακτοποίηση μούσι. Με τον Nikos αν μπορεί.",
      time_in_call_secs: 6,
    },
    { role: "agent", message: "Τι μέρα και ώρα σας βολεύει;", time_in_call_secs: 11 },
    { role: "user", message: "Στη μία το μεσημέρι.", time_in_call_secs: 19 },
    { role: "agent", message: "Στη μία με τον Nikos. Πώς σας λένε;", time_in_call_secs: 23 },
    { role: "user", message: "Γιώργης.", time_in_call_secs: 30 },
    {
      role: "agent",
      message: "Γιώργη, beard trim με τον Nikos σήμερα στη μία. Θέλετε να προσθέσουμε και κούρεμα;",
      time_in_call_secs: 33,
    },
    { role: "user", message: "Όχι, μόνο γένια. Ευχαριστώ!", time_in_call_secs: 40 },
    { role: "agent", message: "Κλείσαμε! Τα λέμε, Γιώργη!", time_in_call_secs: 42 },
  ],
  demo_007: [
    { role: "agent", message: "Good afternoon, Greek Barber Festival! How can I assist you?", time_in_call_secs: 0 },
    { role: "user", message: "Hi, I'd like to book a kids haircut for my son. He's eight.", time_in_call_secs: 6 },
    { role: "agent", message: "What day and time works for you?", time_in_call_secs: 10 },
    { role: "user", message: "Wednesday at three if possible.", time_in_call_secs: 18 },
    { role: "agent", message: "Three works. Do you have a preference for a barber?", time_in_call_secs: 22 },
    { role: "user", message: "Eleni please.", time_in_call_secs: 28 },
    { role: "agent", message: "What is your name?", time_in_call_secs: 31 },
    { role: "user", message: "Maria.", time_in_call_secs: 36 },
    {
      role: "agent",
      message: "Maria, kids cut with Eleni Wednesday at three. Would you like to add eyebrow grooming?",
      time_in_call_secs: 39,
    },
    { role: "user", message: "No thanks, just the haircut.", time_in_call_secs: 45 },
    { role: "agent", message: "All set! See you, Maria!", time_in_call_secs: 47 },
  ],
  demo_008: [
    { role: "agent", message: "Good morning, Greek Barber Festival! How can I help you?", time_in_call_secs: 0 },
    { role: "user", message: "Hi there, my name's James. I'd like to book a haircut.", time_in_call_secs: 5 },
    {
      role: "agent",
      message: "Hi James! Happy to help. Do you have a preferred barber or style in mind?",
      time_in_call_secs: 9,
    },
    {
      role: "user",
      message: "I've heard Giorgos is good. Do you have him available Tuesday morning?",
      time_in_call_secs: 16,
    },
    {
      role: "agent",
      message: "Yes! Giorgos has a slot at 11:30 on Tuesday. Shall I book that for you?",
      time_in_call_secs: 21,
    },
    {
      role: "user",
      message: "Please, yes. Also — can you give me directions? I'm not familiar with the area.",
      time_in_call_secs: 30,
    },
    {
      role: "agent",
      message:
        "Of course! We're on Kifissou 42, Athens. There's parking nearby. Google Maps will get you there easily.",
      time_in_call_secs: 36,
    },
    { role: "user", message: "Great, thanks a lot!", time_in_call_secs: 50 },
    {
      role: "agent",
      message: "You're welcome James! Haircut with Giorgos Tuesday at 11:30 — see you then!",
      time_in_call_secs: 53,
    },
    { role: "user", message: "Perfect, see you!", time_in_call_secs: 62 },
  ],
  demo_009: [
    { role: "agent", message: "Greek Barber Festival, καλημέρα! Σε τι μπορώ να σας βοηθήσω;", time_in_call_secs: 0 },
    { role: "user", message: "Γεια σας. Θέλω ξύρισμα με τον Petros.", time_in_call_secs: 5 },
    { role: "agent", message: "Τι μέρα και ώρα σας βολεύει;", time_in_call_secs: 9 },
    { role: "user", message: "Τρίτη πρωί, δέκα η ώρα.", time_in_call_secs: 16 },
    { role: "agent", message: "Τρίτη στις δέκα με τον Petros. Πώς σας λένε;", time_in_call_secs: 19 },
    { role: "user", message: "Αλέξανδρος.", time_in_call_secs: 27 },
    {
      role: "agent",
      message: "Αλέξανδρε, ξύρισμα με τον Petros Τρίτη στις δέκα. Θέλετε να προσθέσουμε και beard trim;",
      time_in_call_secs: 30,
    },
    { role: "user", message: "Όχι, μόνο ξύρισμα.", time_in_call_secs: 36 },
    { role: "agent", message: "Κλείσαμε! Τα λέμε, Αλέξανδρε!", time_in_call_secs: 38 },
    { role: "user", message: "Ευχαριστώ, γεια σας.", time_in_call_secs: 39 },
  ],
  demo_010: [
    { role: "agent", message: "Καλησπέρα, Greek Barber Festival! Πώς μπορώ να σας εξυπηρετήσω;", time_in_call_secs: 0 },
    { role: "user", message: "Γεια σας, είμαι ο Νίκος. Θέλω να κλείσω για τακτοποίηση μούσι.", time_in_call_secs: 6 },
    { role: "agent", message: "Τι μέρα και ώρα σας βολεύει;", time_in_call_secs: 11 },
    { role: "user", message: "Σάββατο στις δώδεκα, με τον Giorgos.", time_in_call_secs: 20 },
    { role: "agent", message: "Σάββατο στις δώδεκα με τον Giorgos. Πώς σας λένε;", time_in_call_secs: 24 },
    { role: "user", message: "Νίκος.", time_in_call_secs: 30 },
    {
      role: "agent",
      message: "Νίκο, beard trim με τον Giorgos Σάββατο στις δώδεκα. Θέλετε να προσθέσουμε και κούρεμα;",
      time_in_call_secs: 33,
    },
    { role: "user", message: "Όχι ευχαριστώ.", time_in_call_secs: 38 },
    { role: "agent", message: "Κλείσαμε! Τα λέμε, Νίκο!", time_in_call_secs: 40 },
    { role: "user", message: "Εξαιρετικά, ευχαριστώ!", time_in_call_secs: 34 },
    { role: "agent", message: "Παρακαλώ Νίκο! Σας περιμένουμε. Καλό απόγευμα!", time_in_call_secs: 37 },
  ],
};

const DEMO_AI_BOOKINGS: AiBooking[] = [
  {
    conversation_id: "demo_001",
    source: "ai-call",
    status: "confirmed",
    client_name: "Μιχάλης",
    service: "Haircut",
    barber: "Nikos",
    date: d0,
    time: "10:30",
    price: 15,
    duration_secs: 87,
    message_count: 9,
    start_time_unix_secs: _N - 3 * 3600,
    summary: "Michalis called to book a haircut for today at 10:30 with Nikos. Classic short cut requested.",
    first_user_message: "Γεια σας, θέλω να κλείσω ραντεβού για κούρεμα σήμερα στις 10:30 αν είναι διαθέσιμος ο Nikos.",
    call_status: "done",
    call_language: "el",
  },
  {
    conversation_id: "demo_002",
    source: "ai-call",
    status: "confirmed",
    client_name: "Elena P.",
    service: "Hair Styling",
    barber: "Eleni",
    date: d0,
    time: "14:00",
    price: 20,
    duration_secs: 134,
    message_count: 12,
    start_time_unix_secs: _N - 5 * 3600,
    summary: "Elena called about hair styling options and booked a slot at 14:00 with Eleni.",
    first_user_message: "Hi! I was wondering about your hair styling options and how much it costs?",
    call_status: "done",
    call_language: "en",
  },
  {
    conversation_id: "demo_003",
    source: "ai-call",
    status: "confirmed",
    client_name: "Δημήτρης",
    service: "Haircut + Beard Combo",
    barber: "Giorgos",
    date: _pastDate(1),
    time: "11:00",
    price: 22,
    duration_secs: 112,
    message_count: 10,
    start_time_unix_secs: _N - 26 * 3600,
    summary: "Dimitris booked the haircut + beard combo with Giorgos at 11:00. Special occasion.",
    first_user_message: "Θέλω να κλείσω για κούρεμα και γένια μαζί για αύριο στις 11. Είναι για μια ειδική περίσταση.",
    call_status: "done",
    call_language: "el",
  },
  {
    conversation_id: "demo_004",
    source: "ai-call",
    status: "confirmed",
    client_name: "Sofia M.",
    service: "Eyebrow Grooming",
    barber: "Eleni",
    date: _pastDate(1),
    time: "16:30",
    price: 5,
    duration_secs: 68,
    message_count: 7,
    start_time_unix_secs: _N - 30 * 3600,
    summary: "Sofia booked an eyebrow grooming session with Eleni at 16:30 yesterday.",
    first_user_message:
      "Καλημέρα! Θέλω να κλείσω ραντεβού για διαμόρφωση φρυδιών — είναι διαθέσιμη η Eleni σήμερα το απόγευμα;",
    call_status: "done",
    call_language: "el",
  },
  {
    conversation_id: "demo_005",
    source: "ai-call",
    status: "cancelled",
    client_name: "Κώστας Β.",
    service: "Full Shave",
    barber: "Petros",
    date: _pastDate(2),
    time: "09:30",
    price: 12,
    duration_secs: 45,
    message_count: 5,
    start_time_unix_secs: _N - 52 * 3600,
    summary: "Kostas called to cancel his full shave with Petros. Will call back to reschedule.",
    first_user_message: "Γεια σας, πρέπει να ακυρώσω το ραντεβού μου για ξύρισμα με τον Petros. Κάτι έτυχε.",
    call_status: "done",
    call_language: "el",
  },
  {
    conversation_id: "demo_006",
    source: "ai-call",
    status: "confirmed",
    client_name: "Γιώργης Π.",
    service: "Beard Trim",
    barber: "Nikos",
    date: _pastDate(3),
    time: "13:00",
    price: 10,
    duration_secs: 93,
    message_count: 8,
    start_time_unix_secs: _N - 75 * 3600,
    summary: "Giorgos booked a beard trim with Nikos at 13:00. Also asked about beard care products.",
    first_user_message: "Θέλω να κλείσω για τακτοποίηση μούσι — μπορώ συγκεκριμένα με τον Nikos αν γίνεται;",
    call_status: "done",
    call_language: "el",
  },
  {
    conversation_id: "demo_007",
    source: "ai-call",
    status: "confirmed",
    client_name: "Maria K.",
    service: "Kids Cut",
    barber: "Eleni",
    date: _pastDate(4),
    time: "15:00",
    price: 10,
    duration_secs: 78,
    message_count: 8,
    start_time_unix_secs: _N - 98 * 3600,
    summary: "Maria booked a kids cut for her son with Eleni at 15:00. Asked about the process.",
    first_user_message: "Hi, do you do kids haircuts? My son is 8 and needs a trim.",
    call_status: "done",
    call_language: "en",
  },
  {
    conversation_id: "demo_008",
    source: "ai-call",
    status: "confirmed",
    client_name: "James T.",
    service: "Haircut",
    barber: "Giorgos",
    date: _pastDate(5),
    time: "11:30",
    price: 15,
    duration_secs: 101,
    message_count: 11,
    start_time_unix_secs: _N - 122 * 3600,
    summary: "James booked a haircut with Giorgos at 11:30 on Tuesday. Asked for directions.",
    first_user_message: "Hi there! I'd like to book a haircut please. Can I get an appointment with Giorgos this week?",
    call_status: "done",
    call_language: "en",
  },
  {
    conversation_id: "demo_009",
    source: "ai-call",
    status: "confirmed",
    client_name: "Αλέξανδρος",
    service: "Full Shave",
    barber: "Petros",
    date: _pastDate(6),
    time: "10:00",
    price: 12,
    duration_secs: 59,
    message_count: 6,
    start_time_unix_secs: _N - 148 * 3600,
    summary: "Alexandros booked a full shave with Petros at 10:00. Short efficient call.",
    first_user_message: "Γεια, θέλω να κάνω ξύρισμα. Είναι διαθέσιμος ο Petros τη Δευτέρα στις 10;",
    call_status: "done",
    call_language: "el",
  },
  {
    conversation_id: "demo_010",
    source: "ai-call",
    status: "confirmed",
    client_name: "Νίκος Π.",
    service: "Beard Trim",
    barber: "Giorgos",
    date: _pastDate(7),
    time: "12:00",
    price: 10,
    duration_secs: 82,
    message_count: 9,
    start_time_unix_secs: _N - 170 * 3600,
    summary: "Nikos (regular customer) booked a beard trim with Giorgos at noon.",
    first_user_message:
      "Γεια σας, είμαι τακτικός πελάτης — ο Νίκος. Θέλω να κλείσω για τακτοποίηση μούσι με τον Giorgos.",
    call_status: "done",
    call_language: "el",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(unixSecs: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSecs);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function fmtDuration(secs: number): string {
  if (!secs || secs < 1) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Responsive CSS ────────────────────────────────────────────────────────────
const RESPONSIVE_CSS = `
  /* ── Design tokens ───────────────────────────────────────────────────────── */
  :root {
    --gbf-font-sans:   var(--font-inter,   'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif);
    --gbf-font-display:var(--font-display, 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif);
    --gbf-radius-card: 20px;
    --gbf-radius-sm:   12px;
    --gbf-radius-xs:   8px;
    --gbf-shadow-card: 0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.05);
    --gbf-shadow-lift: 0 4px 12px rgba(0,0,0,.06), 0 12px 32px rgba(0,0,0,.09);
    --gbf-shadow-float:0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.06);
    --gbf-transition:  all .2s cubic-bezier(.4,0,.2,1);
  }

  /* ── Keyframes ──────────────────────────────────────────────────────────── */
  @keyframes gbf-pulse     { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes gbf-shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes gbf-fadeIn    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gbf-slideR    { from{transform:translateX(100%);opacity:.8} to{transform:translateX(0);opacity:1} }
  @keyframes gbf-slideL    { from{transform:translateX(-100%);opacity:.8} to{transform:translateX(0);opacity:1} }
  @keyframes gbf-slideU    { from{transform:translateY(100%);opacity:.8} to{transform:translateY(0);opacity:1} }
  @keyframes gbf-staggerIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gbf-numIn     { from{opacity:0;transform:translateY(8px) scale(.94)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes gbf-ringPulse { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.06);opacity:1} }
  @keyframes gbf-glow      { 0%,100%{box-shadow:0 0 6px rgba(79,142,247,.25)} 50%{box-shadow:0 0 20px rgba(79,142,247,.55)} }
  @keyframes gbf-floatIn   { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes gbf-gradFlow  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes gbf-popScale  { 0%{transform:scale(.82);opacity:0} 65%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
  @keyframes gbf-swipeHint { 0%,100%{transform:translateX(0)} 40%{transform:translateX(5px)} }
  @keyframes gbf-cardIn    { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

  /* ── Call orb widget ──────────────────────────────────────────────────────── */
  .gbf-call-orb {
    width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
    transition: box-shadow .2s, transform .15s;
    display: flex; align-items: center; justify-content: center;
    padding: 0; font-family: inherit;
  }
  .gbf-call-orb:hover  { transform: scale(1.08); }
  .gbf-call-orb:active { transform: scale(.92); }
  @media (max-width: 480px) {
    .gbf-call-orb { width: 50px; height: 50px; }
    .gbf-call-fab { bottom: 16px!important; right: 12px!important; }
  }
  @keyframes gbf-borderGlow{ 0%,100%{border-color:transparent} 50%{border-color:rgba(79,142,247,.5)} }

  /* ── Base ───────────────────────────────────────────────────────────────── */
  *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;box-sizing:border-box;font-family:var(--gbf-font-sans)}
  button,[role="button"],a,select,input{touch-action:manipulation;-webkit-tap-highlight-color:transparent}

  /* ── Skeleton ───────────────────────────────────────────────────────────── */
  .gbf-skeleton{background:linear-gradient(90deg,rgba(128,128,128,.07) 25%,rgba(128,128,128,.14) 50%,rgba(128,128,128,.07) 75%);background-size:200% 100%;animation:gbf-shimmer 1.8s infinite;border-radius:var(--gbf-radius-sm)}

  /* ── Animation utilities ─────────────────────────────────────────────────── */
  .gbf-tab-content  { animation:gbf-fadeIn .22s ease-out both; }
  .gbf-float-in     { animation:gbf-floatIn .38s cubic-bezier(.34,1.56,.64,1) both; }
  .gbf-pop-scale    { animation:gbf-popScale .4s cubic-bezier(.34,1.56,.64,1) both; }
  .gbf-num-in       { animation:gbf-numIn .42s cubic-bezier(.34,1.56,.64,1) both; }
  .gbf-ring-idle    { animation:gbf-ringPulse 3s ease-in-out infinite; }
  .gbf-glow-live    { animation:gbf-glow 2s ease-in-out infinite; }
  .gbf-card-in      { animation:gbf-cardIn .34s cubic-bezier(.34,1.56,.64,1) both; }

  /* ── Loading progress bar ────────────────────────────────────────────────── */
  .gbf-progress-top{height:2px;width:100%;background:linear-gradient(90deg,#4f8ef7,#a78bfa,#f472b6,#4f8ef7);background-size:300% 100%;animation:gbf-gradFlow 1.6s ease-in-out infinite}

  /* ── Focus ───────────────────────────────────────────────────────────────── */
  button:focus-visible,select:focus-visible,input:focus-visible{outline:2.5px solid currentColor;outline-offset:3px;border-radius:var(--gbf-radius-xs)}
  .gbf-btn:active        { opacity:.8; transform:scale(.97); transition-duration:.08s; }
  .gbf-card-pressable:active { transform:scale(.985); }

  /* ── Hover lift ──────────────────────────────────────────────────────────── */
  .gbf-lift{transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s ease,border-color .18s ease!important;will-change:transform}
  .gbf-lift:hover  { transform:translateY(-3px); box-shadow:var(--gbf-shadow-lift); }
  .gbf-lift:active { transform:translateY(-1px) scale(.99); transition-duration:.08s!important; }
  .gbf-lift-sm{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}
  .gbf-lift-sm:hover  { transform:translateY(-2px); box-shadow:0 2px 8px rgba(0,0,0,.06),0 8px 20px rgba(0,0,0,.08); }
  .gbf-lift-sm:active { transform:scale(.985); transition-duration:.08s!important; }

  /* ── Universal button hover — visible on any background ─────────────────── */
  .gbf-btn:not(:disabled):not([aria-current="page"]):hover { filter: brightness(0.91) !important; }
  .gbf-btn:not(:disabled):active { filter: brightness(0.84) !important; }

  /* ── Icon buttons (small round/square icon-only) ─────────────────────────── */
  .gbf-icon-btn{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,border-color .2s,background .15s!important;will-change:transform}
  .gbf-icon-btn:hover{transform:scale(1.18)!important;box-shadow:0 0 0 3px var(--gbf-c-accent-light,rgba(143,191,127,.25))!important;border-color:var(--gbf-c-accent,#6a9a5c)!important}
  .gbf-icon-btn:active{transform:scale(.88)!important;transition-duration:.07s!important}

  /* ── Tab navigation hover ────────────────────────────────────────────────── */
  .gbf-tab-btn{transition:color .15s,background .15s,transform .15s,box-shadow .15s!important}
  .gbf-tab-btn:hover:not([aria-current="page"]){background:var(--gbf-c-accent-light,rgba(143,191,127,.18))!important;color:var(--gbf-c-accent,#6a9a5c)!important;transform:translateY(-2px)!important;box-shadow:0 4px 12px rgba(0,0,0,.08)!important}
  .gbf-tab-btn[aria-current="page"]:hover{box-shadow:0 4px 16px rgba(0,0,0,.1)!important}
  .gbf-tab-btn:active:not([aria-current="page"]){transform:translateY(0) scale(.97)!important;transition-duration:.07s!important}

  /* ── Action / CTA buttons ────────────────────────────────────────────────── */
  .gbf-action-btn{transition:transform .2s ease,box-shadow .2s ease!important}
  .gbf-action-btn:hover{transform:translateY(-3px)!important;box-shadow:0 8px 24px rgba(0,0,0,.22)!important}
  .gbf-action-btn:active{transform:translateY(0)!important;transition-duration:.07s!important}

  /* ── Dropdown / menu items ───────────────────────────────────────────────── */
  .gbf-menu-item{transition:background .12s,transform .15s,color .12s!important}
  .gbf-menu-item:hover{background:var(--gbf-c-accent-light,rgba(143,191,127,.18))!important;transform:translateX(5px)!important;color:var(--gbf-c-accent,#6a9a5c)!important}

  /* ── Settings sidebar nav ────────────────────────────────────────────────── */
  .gbf-settings-nav-btn{transition:background .15s,transform .18s ease!important}
  .gbf-settings-nav-btn:not([data-active="true"]):hover{background:var(--gbf-c-accent-light,rgba(143,191,127,.18))!important;transform:translateX(5px)!important}

  /* ── Chips ───────────────────────────────────────────────────────────────── */
  .gbf-chip:hover{transform:translateY(-2px) scale(1.04)!important;box-shadow:0 4px 12px rgba(0,0,0,.12)!important}

  /* ── Input / select / textarea hover ─────────────────────────────────────── */
  input:not(:focus):not(:disabled):hover,
  select:not(:focus):not(:disabled):hover,
  textarea:not(:focus):not(:disabled):hover{border-color:var(--gbf-c-accent,#6a9a5c)!important;box-shadow:0 0 0 2px var(--gbf-c-accent-light,rgba(143,191,127,.2))!important}

  /* ── Stagger-in ───────────────────────────────────────────────────────────── */
  .gbf-stagger>*{animation:gbf-staggerIn .32s ease both}
  .gbf-stagger>*:nth-child(1){animation-delay:.03s}.gbf-stagger>*:nth-child(2){animation-delay:.08s}
  .gbf-stagger>*:nth-child(3){animation-delay:.13s}.gbf-stagger>*:nth-child(4){animation-delay:.18s}
  .gbf-stagger>*:nth-child(5){animation-delay:.22s}.gbf-stagger>*:nth-child(6){animation-delay:.26s}
  .gbf-stagger>*:nth-child(n+7){animation-delay:.30s}

  /* ── Table row hover ──────────────────────────────────────────────────────── */
  .gbf-tr-hover{transition:background .14s,box-shadow .14s!important}
  .gbf-tr-hover:hover{background:var(--gbf-c-accent-light,rgba(143,191,127,.12))!important;box-shadow:inset 3px 0 0 var(--gbf-c-accent,#6a9a5c)!important}
  .gbf-tr-hover.gbf-ai-row:hover{background:var(--gbf-c-accent-light,rgba(143,191,127,.18))!important;box-shadow:inset 3px 0 0 var(--gbf-c-accent,#6a9a5c)!important;cursor:pointer}

  /* ── Heat cell ────────────────────────────────────────────────────────────── */
  .gbf-heat-cell{transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease;border-radius:6px;cursor:default}
  .gbf-heat-cell:hover{transform:scale(1.25);box-shadow:0 3px 10px rgba(0,0,0,.22);position:relative;z-index:2}

  /* ── Tooltip ──────────────────────────────────────────────────────────────── */
  .gbf-tip{position:relative}
  .gbf-tip::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:rgba(10,10,10,.92);color:#fff;font-size:11px;font-weight:500;padding:6px 12px;border-radius:10px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .18s;z-index:60;letter-spacing:0;font-family:var(--gbf-font-sans);backdrop-filter:blur(8px)}
  .gbf-tip:hover::after{opacity:1}

  /* ── Bar chart row hover — spotlight: hovered row stays full, siblings dim ── */
  .gbf-bar-row{transition:opacity .18s}
  .gbf-bar-group:has(.gbf-bar-row:hover) .gbf-bar-row{opacity:.35;transition:opacity .15s}
  .gbf-bar-group:has(.gbf-bar-row:hover) .gbf-bar-row:hover{opacity:1}
  .gbf-bar-row:hover .gbf-bar-label{font-weight:700;color:inherit}

  /* ── Recent calls conversation item ─────────────────────────────────────── */
  .gbf-conv-item{transition:border-color .15s,box-shadow .15s}
  .gbf-conv-item:hover{border-color:var(--gbf-c-accent,#6a9a5c)!important;box-shadow:0 4px 16px rgba(0,0,0,.1)!important}

  /* ── Service item ─────────────────────────────────────────────────────────── */
  .gbf-svc-item{transition:background .15s,border-color .18s,transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .18s ease!important;cursor:default}
  .gbf-svc-item:hover{transform:translateY(-2px)!important;border-color:var(--gbf-c-accent,#6a9a5c)!important;box-shadow:0 4px 16px rgba(0,0,0,.12)!important}

  /* ── Live transcript message bubble ──────────────────────────────────────── */
  @keyframes gbf-msg-in{from{opacity:0;transform:translateY(6px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  .gbf-msg-bubble{animation:gbf-msg-in .22s ease forwards}

  /* ── Feed card ────────────────────────────────────────────────────────────── */
  .gbf-feed-card{flex-shrink:0;transition:transform .2s ease,box-shadow .2s ease,border-color .18s ease!important}
  .gbf-feed-card:hover{transform:translateY(-3px)!important;box-shadow:0 8px 28px rgba(0,0,0,.16)!important;border-left-color:var(--gbf-c-accent,#6a9a5c)!important}
  .gbf-feed-card:active{transform:scale(.98)!important;transition-duration:.08s!important}

  /* ── Feed scroll ──────────────────────────────────────────────────────────── */
  .gbf-feed-scroll{scrollbar-width:thin;scrollbar-color:#4f8ef7 transparent;-webkit-overflow-scrolling:touch}
  .gbf-feed-scroll::-webkit-scrollbar{width:3px}
  .gbf-feed-scroll::-webkit-scrollbar-track{background:transparent}
  .gbf-feed-scroll::-webkit-scrollbar-thumb{background:#4f8ef755;border-radius:99px}
  .gbf-feed-scroll::-webkit-scrollbar-thumb:hover{background:#4f8ef7aa}

  /* ── Chip (compact info badge) ────────────────────────────────────────────── */
  .gbf-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap;transition:transform .15s,box-shadow .15s;flex-shrink:0}
  .gbf-chip:active{transform:scale(.95)}

  /* ── KPI strip (mobile horizontal-scroll quick stats) ────────────────────── */
  .gbf-kpi-strip{display:none}
  @media(max-width:768px){
    .gbf-kpi-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .gbf-kpi-strip::-webkit-scrollbar{display:none}
  }

  /* ── Features strip (3-col → 1-col on mobile) ────────────────────────────── */
  .gbf-features-strip{display:grid;grid-template-columns:repeat(3,1fr)}
  @media(max-width:768px){
    .gbf-features-strip{grid-template-columns:1fr}
  }

  /* ── Recent calls row — hide aux info on very small screens ──────────────── */
  .gbf-recent-time{flex-shrink:0}
  .gbf-recent-msgs{flex-shrink:0}
  @media(max-width:480px){
    .gbf-recent-time{display:none}
    .gbf-recent-msgs{display:none}
  }

  /* ── Header height token — keeps top nav sticky just below the header ──────── */
  :root { --gbf-header-h: 64px; }
  @media(min-width:1800px)  { :root { --gbf-header-h: 84px; } }
  @media(max-width:768px)   { :root { --gbf-header-h: 56px; } }
  @media(max-width:390px)   { :root { --gbf-header-h: 52px; } }
  @media(orientation:landscape) and (max-height:600px) and (min-width:600px) { :root { --gbf-header-h: 52px; } }

  /* TOP NAV MODE — sticky just below the header */
  .gbf-topnav {
    position: sticky;
    top: var(--gbf-header-h);
    z-index: 29;
  }

  /* ────────────────────────────────────────────────────────────────────────────
     BOTTOM NAV MODE — tabs pinned to bottom of screen on all devices
     ──────────────────────────────────────────────────────────────────────────── */
  .gbf-nav-bottom {
    position:fixed; bottom:0; left:0; right:0; z-index:35;
    border-top:1px solid var(--gbf-border, rgba(0,0,0,.1));
    border-bottom:none!important;
    padding-bottom:env(safe-area-inset-bottom,0px);
    box-shadow:0 -4px 24px rgba(0,0,0,.10);
    border-radius:0;
  }
  /* Pad content so it isn't hidden behind the fixed nav */
  .gbf-content-bnav { padding-bottom:calc(60px + env(safe-area-inset-bottom,0px) + 24px)!important; }

  /* ── Desktop bottom nav — row layout with full labels ─────────────────────── */
  @media(min-width:769px){
    .gbf-nav-bottom .gbf-tabs-inner { padding:0 24px!important; gap:8px!important; }
    .gbf-nav-bottom .gbf-tab-btn {
      flex-direction:row!important;
      gap:8px!important;
      height:56px!important;
      min-height:56px!important;
      font-size:14px!important;
      font-weight:600!important;
      padding:0 20px!important;
      border-bottom:none!important;
      border-radius:12px!important;
      flex:unset!important;
    }
    .gbf-nav-bottom .gbf-tab-icon svg { width:18px!important; height:18px!important; }
    .gbf-nav-bottom .gbf-tab-full { display:inline!important; }
    .gbf-nav-bottom .gbf-tab-short { display:none!important; }
  }

  /* ── Mobile bottom nav — column layout with short labels ─────────────────── */
  @media(max-width:768px){
    .gbf-nav-bottom { border-radius:20px 20px 0 0; }
    .gbf-nav-bottom .gbf-tabs-inner { padding:0 8px!important; }
    .gbf-nav-bottom .gbf-tab-btn {
      flex-direction:column!important;
      gap:3px!important;
      height:60px!important;
      min-height:60px!important;
      font-size:10px!important;
      padding:8px 6px 4px!important;
      border-bottom:3px solid transparent!important;
    }
    .gbf-nav-bottom .gbf-tab-icon {
      margin-right:0!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
    }
    .gbf-nav-bottom .gbf-tab-icon svg { width:22px!important; height:22px!important; }
    .gbf-nav-bottom .gbf-tab-full { display:none!important; }
    .gbf-nav-bottom .gbf-tab-short { display:inline!important; }
  }

  /* ── Floating elements above bottom nav ────────────────────────────────────
     When bottom nav is active every fixed/floating element that sits at the
     bottom must be lifted by nav-height + safe-area + breathing room.
     Nav height = 60px  ·  padding-bottom = env(safe-area-inset-bottom,0)
     ──────────────────────────────────────────────────────────────────────── */
  :root { --gbf-bnav-lift: calc(60px + env(safe-area-inset-bottom,0px) + 16px); }

  /* ElevenLabs call widget — the wrapper itself carries both classes */
  .gbf-call-fab.gbf-bnav-widget { bottom:var(--gbf-bnav-lift)!important; }

  /* Everything else inside the main wrapper — targeted via gbf-has-bnav class */
  .gbf-has-bnav .gbf-scroll-top { bottom:var(--gbf-bnav-lift)!important; }

  /* ────────────────────────────────────────────────────────────────────────────
     TOUCH TARGETS — thumb-friendly sizes (Apple HIG 44pt · Material 48dp)
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:768px){
    /* Feed card footer "View Ledger" button */
    .gbf-feed-history-btn {
      width:100%; justify-content:center;
      min-height:48px!important;
      padding:12px 20px!important;
      font-size:13px!important;
      border-radius:0!important;
      border-top:1px solid rgba(0,0,0,.07);
    }
    /* Tag pills inside feed cards */
    .gbf-tag-pill {
      min-height:44px!important;
      padding:10px 14px!important;
      font-size:12px!important;
    }
    /* Settings toggle hit area */
    .gbf-toggle-row { min-height:52px; padding:10px 0!important; }
    /* Action buttons in transcript */
    .gbf-action-btn { min-height:44px; padding:10px 16px!important; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     SCROLL TO TOP — floating button, mobile only
     ──────────────────────────────────────────────────────────────────────────── */
  .gbf-scroll-top {
    position:fixed; right:16px; bottom:96px; z-index:40;
    width:46px; height:46px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; font-weight:700; border:none; cursor:pointer;
    box-shadow:0 4px 20px rgba(0,0,0,.22);
    transition:opacity .25s, transform .25s, bottom .25s;
    opacity:0; pointer-events:none; transform:translateY(8px);
  }
  .gbf-scroll-top.gbf-scroll-top-visible {
    opacity:1; pointer-events:auto; transform:translateY(0);
  }
  @media(min-width:769px){ .gbf-scroll-top { display:none!important; } }

  /* ── Mob-only / mob-hide ──────────────────────────────────────────────────── */
  .gbf-mob-only{display:none!important}
  .gbf-tab-icon{display:none;align-items:center}

  /* ── Swipe hint ───────────────────────────────────────────────────────────── */
  .gbf-swipe-hint{animation:gbf-swipeHint 2.2s ease-in-out 1.2s 1}

  /* ── Settings drawer — desktop ────────────────────────────────────────────── */
  .gbf-settings-drawer{position:fixed;top:0;right:0;bottom:0;left:auto;width:680px;border-radius:0;max-height:100vh;animation:gbf-slideR .28s cubic-bezier(.32,.72,0,1) both}

  /* ── Cancel modal — centered dialog on desktop, bottom sheet on mobile ──────── */
  .gbf-cancel-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2001;
    width: min(500px, calc(100vw - 40px));
    max-height: calc(100vh - 64px);
    overflow-y: auto;
    border-radius: 20px;
    animation: gbf-scaleIn .2s cubic-bezier(.32,.72,0,1) both;
    -webkit-overflow-scrolling: touch;
  }
  @keyframes gbf-scaleIn {
    from { opacity: 0; transform: translate(-50%, -48%) scale(.96); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @media(max-width:600px) {
    .gbf-cancel-modal {
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      transform: none;
      width: 100%;
      max-height: 92vh;
      border-radius: 20px 20px 0 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      animation: gbf-slideU .25s cubic-bezier(.32,.72,0,1) both;
    }
    @keyframes gbf-scaleIn { from {} to {} } /* override on mobile */
  }
  /* ── Walk-in modal — centered on desktop, bottom sheet on mobile ──────────── */
  .gbf-walkin-overlay { display:flex; align-items:center; justify-content:center; }
  .gbf-walkin-panel   { border-radius:20px; width:min(560px,calc(100vw - 32px)); max-height:90vh; }
  @media(max-width:768px){
    .gbf-walkin-overlay { align-items:flex-end; }
    .gbf-walkin-panel   { border-radius:24px 24px 0 0; width:100%; max-height:92vh; padding-bottom:env(safe-area-inset-bottom,0px); }
  }

  .gbf-settings-body{display:flex;flex:1;overflow:hidden;min-height:0}
  .gbf-settings-nav{width:190px;flex-shrink:0;padding:8px 0;overflow-y:auto}
  .gbf-settings-main{flex:1;overflow-y:auto;padding:0 28px 48px;-webkit-overflow-scrolling:touch}
  .gbf-settings-handle{display:none}
  .gbf-mob-back{display:none!important}
  .gbf-mob-hide{}

  /* ── ElevenLabs widget ────────────────────────────────────────────────────── */
  /* custom call FAB — positioned via inline styles */

  /* ────────────────────────────────────────────────────────────────────────────
     LAYOUT — Desktop (≥ 1025px)
     ──────────────────────────────────────────────────────────────────────────── */
  .gbf-header        { padding:0 32px; }
  .gbf-header-inner  { height:64px; }
  .gbf-header-date   { display:block; }
  .gbf-header-live-text { display:inline; }
  .gbf-tabs-inner    { padding:0 32px; }
  .gbf-tab-btn       { padding:16px 24px; font-size:14px; white-space:nowrap; }
  .gbf-tab-full      { display:inline; }
  .gbf-tab-short     { display:none; }
  .gbf-content       { padding:28px 32px 108px; }
  .gbf-stat-grid     { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  .gbf-hub-grid      { display:grid; grid-template-columns:1fr 1.2fr; gap:20px; align-items:start; }
  .gbf-hub-main      { display:grid; grid-template-columns:340px 1fr; gap:20px; align-items:start; }
  .gbf-services-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; }
  .gbf-ledger-table  { display:block; }
  .gbf-ledger-cards  { display:none; }
  .gbf-filter-selects{ display:flex; flex-wrap:wrap; gap:8px; flex:1; }
  .gbf-footer        { padding:16px 32px; }

  /* ────────────────────────────────────────────────────────────────────────────
     TV / LARGE DISPLAY — ≥ 1800px
     Standards: Smart TV Alliance UI Guidelines, HbbTV 2.0, W3C TV
     Safe zone: 5% inset · Focus rings for remote · Min font 16px body
     ──────────────────────────────────────────────────────────────────────────── */
  @media(min-width:1800px){
    .gbf-header        { padding:0 72px; }
    .gbf-header-inner  { height:84px; }
    .gbf-tabs-inner    { padding:0 72px; }
    .gbf-tab-btn       { padding:24px 40px; font-size:17px; }
    .gbf-content       { padding:48px 72px 128px; max-width:1700px!important; }
    .gbf-stat-grid     { gap:28px; }
    .gbf-footer        { padding:28px 72px; font-size:14px; }
    .gbf-settings-drawer{ width:800px; }
    .gbf-stat-num      { font-size:46px!important; letter-spacing:-1px!important; }
    .gbf-stat-label    { font-size:16px!important; }
    .gbf-stat-sub      { font-size:13px!important; }
    /* Remote-control focus ring */
    button:focus,a:focus,select:focus{ outline:3px solid currentColor; outline-offset:4px; }
  }
  @media(min-width:2400px){
    .gbf-content  { padding:64px 96px 144px; }
    .gbf-stat-grid{ gap:36px; }
    .gbf-stat-num { font-size:60px!important; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     TABLET LANDSCAPE — 1025px–1200px
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:1200px) and (min-width:1025px){
    .gbf-stat-grid{ grid-template-columns:repeat(4,1fr); gap:14px; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     TABLET — ≤ 1024px  (iPad 9th gen, iPad Air, Android tablets)
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:1024px){
    .gbf-stat-grid   { grid-template-columns:repeat(2,1fr); }
    .gbf-hub-grid    { grid-template-columns:1fr; }
    .gbf-hub-main    { grid-template-columns:1fr; }
    .gbf-content     { padding:24px 24px 100px; }
    .gbf-header      { padding:0 24px; }
    .gbf-tabs-inner  { padding:0 24px; }
    .gbf-settings-drawer{ width:560px; }
    .gbf-settings-nav   { width:170px; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     SMALL TABLET — ≤ 900px  (iPad mini, 7–8″ tablets)
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:900px){
    .gbf-stat-grid { grid-template-columns:repeat(2,1fr); gap:12px; }
    .gbf-content   { padding:20px 20px 96px; }
    .gbf-header    { padding:0 20px; }
    .gbf-tabs-inner{ padding:0 20px; }
    .gbf-header-date{ display:none; }
    .gbf-header-right{ gap:8px!important; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     MOBILE — ≤ 768px
     Standards: Apple HIG (44pt min target), Material Design 3 (48dp)
     16px input font prevents iOS auto-zoom · Safe areas via @supports below
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:768px){
    .gbf-call-fab{bottom:20px!important;right:16px!important}

    .gbf-header           { padding:0 16px; }
    .gbf-header-inner     { height:56px; }
    .gbf-header-date      { display:none; }
    .gbf-header-live-text { display:none; }
    .gbf-header-right     { gap:6px!important; }
    .gbf-tabs-inner       { padding:0; overflow-x:auto; scrollbar-width:none; }
    .gbf-tabs-inner::-webkit-scrollbar{ display:none; }
    .gbf-tab-btn          { padding:0 14px; height:50px; font-size:13px; flex:1; justify-content:center; min-width:72px; }
    .gbf-tab-icon         { display:inline-flex; margin-right:5px; vertical-align:middle; align-items:center; }
    .gbf-tab-full         { display:none; }
    .gbf-tab-short        { display:inline; }
    .gbf-content          { padding:14px 14px 108px; }
    .gbf-stat-grid        { grid-template-columns:repeat(2,1fr); gap:10px; }
    .gbf-services-grid    { grid-template-columns:repeat(2,1fr); gap:8px; }
    .gbf-ledger-table     { display:none; }
    .gbf-ledger-cards     { display:flex; flex-direction:column; gap:12px; }
    .gbf-filter-selects   { flex-direction:column; gap:8px; }
    .gbf-footer           { padding:14px 16px; flex-wrap:wrap; gap:4px; font-size:11px; }
    .gbf-mob-only         { display:block!important; }
    .gbf-mob-flex         { display:flex!important; }

    /* Settings — bottom sheet */
    .gbf-settings-drawer{top:auto;right:0;bottom:0;left:0;width:100%;border-radius:20px 20px 0 0;max-height:94vh;animation:gbf-slideU .3s cubic-bezier(.32,.72,0,1) both}
    .gbf-settings-handle  { display:flex; }
    .gbf-settings-body    { flex-direction:column; }
    .gbf-settings-nav     { width:100%; padding:0; }
    .gbf-settings-main    { padding:0 16px 48px; }
    .gbf-mob-back         { display:flex!important; }
    .gbf-mob-hide         { display:none!important; }

    /* iOS auto-zoom prevention (font-size < 16px on inputs triggers zoom) */
    select,input,textarea{ font-size:16px!important; min-height:44px; }

    /* Touch-friendly min tap targets */
    button       { min-height:36px; }
    .gbf-tab-btn { min-height:50px; }

    /* Disable desktop hover-lift on touch devices (no hover state anyway) */
    .gbf-lift:hover   { transform:none; box-shadow:none; }
    .gbf-lift:active  { transform:scale(.98); box-shadow:0 2px 14px rgba(0,0,0,.14); transition-duration:.08s!important; }
    .gbf-lift-sm:hover  { transform:none; box-shadow:none; }
    .gbf-lift-sm:active { transform:scale(.985); }

    /* Stat card number/label sizing */
    .gbf-stat-num   { font-size:26px!important; }
    .gbf-stat-label { font-size:12px!important; }
    .gbf-stat-sub   { font-size:11px!important; }

    /* Feed cards on mobile — slightly more padding for thumb targets */
    .gbf-feed-card > div { padding-left:16px!important; padding-right:16px!important; }

    /* Horizontal-scroll wrapper for charts / wide content */
    .gbf-mob-scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px}

    /* Ledger card improvements */
    .gbf-ledger-cards .gbf-lift-sm:active{ transform:scale(.99); }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     SMALL MOBILE — ≤ 480px  (Android phones, older iPhones)
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:480px){
    .gbf-content         { padding:12px 12px 104px; }
    .gbf-stat-grid       { gap:8px; }
    .gbf-tab-btn         { padding:0 10px; font-size:12px; }
    .gbf-header-right    { gap:4px!important; }
    .gbf-lang-label      { display:none; }
    .gbf-header-right .gbf-icon-btn  { width:34px!important; height:34px!important; }
    .gbf-header-right .gbf-action-btn{ height:34px!important; padding:0 8px!important; }
    /* Filter selects: 2-column grid at narrow phones */
    .gbf-filter-selects  { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    /* Ledger cards: always column, never the IVI row wrap */
    .gbf-ledger-cards    { display:flex!important; flex-direction:column!important; flex-wrap:nowrap!important; }
    .gbf-ledger-cards>*  { flex:none!important; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     TINY PHONE — ≤ 390px  (iPhone SE, older small Androids)
     ──────────────────────────────────────────────────────────────────────────── */
  @media(max-width:390px){
    .gbf-content      { padding:10px 10px 100px; }
    .gbf-stat-grid    { gap:7px; }
    .gbf-header-inner { height:52px; }
    .gbf-header-right { gap:3px!important; }
    .gbf-header-live  { display:none; }
    .gbf-header-right .gbf-icon-btn  { width:32px!important; height:32px!important; border-radius:8px!important; }
    .gbf-header-right .gbf-action-btn{ height:32px!important; padding:0 6px!important; border-radius:8px!important; }
    .gbf-services-grid{ grid-template-columns:1fr; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     CAR IVI — landscape, height ≤ 600px, width ≥ 600px
     Standards: ISO 15008:2017 (driver distraction), NHTSA 2012 guidelines,
                ISO 9241-161 (min touch 20mm ≈ 72px @ 96dpi)
     Rules: ≤ 5 top-level items · large targets · reduced animation · high contrast
     ──────────────────────────────────────────────────────────────────────────── */
  @media(orientation:landscape) and (max-height:600px) and (min-width:600px){
    .gbf-header        { padding:0 24px; }
    .gbf-header-inner  { height:52px; }
    .gbf-header-date   { display:none; }
    .gbf-tabs-inner    { padding:0 24px; }
    .gbf-tab-btn       { padding:0 20px; height:52px; font-size:14px; min-height:52px; }
    .gbf-content       { padding:10px 24px 76px; }
    .gbf-stat-grid     { grid-template-columns:repeat(4,1fr); gap:10px; }
    .gbf-hub-grid      { grid-template-columns:1fr; }
    .gbf-hub-main      { grid-template-columns:1fr; }
    .gbf-ledger-table  { display:none; }
    .gbf-ledger-cards  { display:flex; flex-direction:row; flex-wrap:wrap; gap:10px; }
    .gbf-ledger-cards>*{ flex:1 1 300px; }
    .gbf-footer        { padding:8px 24px; }
    .gbf-settings-drawer{ width:min(90vw,400px); }
    /* Large touch targets — safety critical */
    button    { min-height:52px; min-width:52px; }
    select    { min-height:52px; font-size:16px!important; }
    /* Stat numbers — readable at arm's length */
    .gbf-stat-num  { font-size:28px!important; }
    /* Reduce distracting motion while driving */
    .gbf-lift:hover   { transform:none; }
    .gbf-lift-sm:hover{ transform:none; }
    .gbf-stagger>*{ animation-duration:.1s!important; }
    .gbf-ivi-hide { display:none!important; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     SAFE AREA INSETS — iPhone notch / Dynamic Island / punch-hole cameras
     ──────────────────────────────────────────────────────────────────────────── */
  @supports(padding-bottom:env(safe-area-inset-bottom)){
    .gbf-content         { padding-bottom:calc(108px + env(safe-area-inset-bottom)); }
    .gbf-settings-drawer { padding-bottom:env(safe-area-inset-bottom); }
    .gbf-footer          { padding-bottom:calc(14px + env(safe-area-inset-bottom)); }
    @media(max-width:768px){
      .gbf-content       { padding-bottom:calc(104px + env(safe-area-inset-bottom)); }
    }
  }
  @supports(padding-left:env(safe-area-inset-left)){
    @media(orientation:landscape){
      .gbf-content{ padding-left:max(14px,env(safe-area-inset-left)); padding-right:max(14px,env(safe-area-inset-right)); }
      .gbf-header { padding-left:max(24px,env(safe-area-inset-left)); padding-right:max(24px,env(safe-area-inset-right)); }
    }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     RTL — Arabic and other right-to-left languages
     ──────────────────────────────────────────────────────────────────────────── */
  [dir="rtl"] .gbf-settings-drawer{right:auto;left:0;border-left:none;animation-name:gbf-slideL}
  [dir="rtl"] .gbf-settings-nav  { border-right:none; border-left-width:1px; border-left-style:solid; }
  [dir="rtl"] .gbf-settings-main { direction:rtl; }
  [dir="rtl"] .gbf-footer        { direction:rtl; }
  @media(max-width:768px){
    [dir="rtl"] .gbf-settings-drawer{ right:0; left:0; animation-name:gbf-slideU; }
  }

  /* ────────────────────────────────────────────────────────────────────────────
     REDUCED MOTION — accessibility (WCAG 2.3 · prefers-reduced-motion)
     ──────────────────────────────────────────────────────────────────────────── */
  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{
      animation-duration:.01ms!important;
      animation-iteration-count:1!important;
      transition-duration:.01ms!important;
    }
  }
`;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(128,128,128,0.06)",
        border: "1px solid rgba(128,128,128,0.10)",
        borderRadius: "var(--gbf-radius-card)",
        padding: "20px 24px",
      }}
    >
      <div className="gbf-skeleton" style={{ height: 28, width: "45%", marginBottom: 8 }} />
      <div className="gbf-skeleton" style={{ height: 13, width: "65%", marginBottom: 6 }} />
      <div className="gbf-skeleton" style={{ height: 12, width: "50%" }} />
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: SettingsSection; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "profile",
    label: "Business Profile",
    icon: <Store size={15} strokeWidth={1.75} />,
    desc: "Your barbershop info",
  },
  { id: "appearance", label: "Appearance", icon: <Palette size={15} strokeWidth={1.75} />, desc: "Theme & colours" },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={15} strokeWidth={1.75} />,
    desc: "Data & refresh",
  },
  { id: "display", label: "Display", icon: <Monitor size={15} strokeWidth={1.75} />, desc: "Layout & density" },
  { id: "language", label: "Language", icon: <Globe size={15} strokeWidth={1.75} />, desc: "UI & translation" },
  { id: "account", label: "Account", icon: <User size={15} strokeWidth={1.75} />, desc: "Email & plan" },
  { id: "security", label: "Security", icon: <ShieldCheck size={15} strokeWidth={1.75} />, desc: "Auth & sessions" },
];

function SettingsPanel({
  settings,
  onUpdate,
  profile,
  onProfileUpdate,
  onClose,
  onLogout,
  C,
  langSettings,
  onLangUpdate,
  onAddShop,
  businesses,
  currentBiz,
  onSwitchBiz,
  onDeleteBiz,
}: {
  settings: Settings;
  onUpdate: (p: Partial<Settings>) => void;
  profile: BusinessProfile;
  onProfileUpdate: (p: Partial<BusinessProfile>) => void;
  onClose: () => void;
  onLogout: () => void;
  C: Colors;
  langSettings: LangSettings;
  onLangUpdate: (p: Partial<LangSettings>) => void;
  onAddShop?: () => void;
  businesses?: { id: string; name: string; plan?: string }[];
  currentBiz?: { id: string; name: string; plan?: string } | null;
  onSwitchBiz?: (biz: { id: string; name: string; plan?: string }) => void;
  onDeleteBiz?: (id: string) => Promise<void>;
}) {
  const t = useT();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [mobContent, setMobContent] = useState(false); // mobile: false=list, true=content
  const [profileDraft, setProfileDraft] = useState<BusinessProfile>(profile);
  const [profileSaved, setProfileSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingBiz, setDeletingBiz] = useState<{ id: string; name: string; inProgress?: boolean } | null>(null);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleNavClick = (id: SettingsSection) => {
    setActiveSection(id);
    setMobContent(true);
    setProfileSaved(false);
  };
  const handleBack = () => setMobContent(false);

  const saveProfile = () => {
    onProfileUpdate(profileDraft);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const section = (title: string, desc?: string) => (
    <div style={{ marginBottom: 18, marginTop: 28, paddingBottom: 10, borderBottom: `1px solid ${C.borderFaint}` }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          fontFamily: "var(--gbf-font-display)",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </div>
      {desc && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3, lineHeight: 1.4 }}>{desc}</div>}
    </div>
  );

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { type?: string; placeholder?: string; readonly?: boolean; mono?: boolean; hint?: string },
  ) => (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 700,
          color: C.textMuted,
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      <input
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder ?? ""}
        readOnly={opts?.readonly}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 14px",
          borderRadius: "var(--gbf-radius-sm)",
          border: `1px solid ${C.border}`,
          background: opts?.readonly ? C.surfaceAlt : C.surface,
          color: C.text,
          fontSize: 14,
          fontFamily: opts?.mono ? "'JetBrains Mono', 'Fira Code', monospace" : "var(--gbf-font-sans)",
          outline: "none",
          transition: "border-color .2s, box-shadow .2s",
        }}
        onFocus={(e) => {
          if (!opts?.readonly) {
            e.target.style.borderColor = C.accent;
            e.target.style.boxShadow = `0 0 0 3px ${C.accentLight}`;
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = C.border;
          e.target.style.boxShadow = "none";
        }}
      />
      {opts?.hint && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>{opts.hint}</div>}
    </div>
  );

  const toggle = (label: string, sublabel: string, value: boolean, onChange: (v: boolean) => void) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: `1px solid ${C.borderFaint}`,
      }}
    >
      <div style={{ marginRight: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sublabel}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="gbf-btn"
        style={{
          width: 48,
          height: 28,
          borderRadius: 99,
          border: "none",
          cursor: "pointer",
          background: value ? C.accent : C.border,
          position: "relative",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .2s",
            boxShadow: "0 1px 4px rgba(0,0,0,.25)",
          }}
        />
      </button>
    </div>
  );

  // ── Section: Profile ──────────────────────────────────────────────────────
  const ProfileSection = () => (
    <div>
      {section("Business Information")}
      {field("Business name", profileDraft.businessName, (v) => setProfileDraft((d) => ({ ...d, businessName: v })), {
        placeholder: "e.g. Kostas Barbershop",
      })}
      {field("Owner / Contact name", profileDraft.ownerName, (v) => setProfileDraft((d) => ({ ...d, ownerName: v })), {
        placeholder: "Your full name",
      })}
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Business size
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(
            [
              ["solo", "Solo (just me)"],
              ["small", "2–5 barbers"],
              ["medium", "6–15 barbers"],
              ["large", "16+ barbers"],
            ] as [BusinessProfile["size"], string][]
          ).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setProfileDraft((d) => ({ ...d, size: val }))}
              className="gbf-btn"
              style={{
                padding: "10px 12px",
                borderRadius: "var(--gbf-radius-xs)",
                cursor: "pointer",
                fontFamily: "var(--gbf-font-sans)",
                fontSize: 13,
                fontWeight: 500,
                border: `1.5px solid ${profileDraft.size === val ? C.accent : C.border}`,
                background: profileDraft.size === val ? C.accentLight : C.surface,
                color: profileDraft.size === val ? C.accent : C.textMuted,
                transition: "all .2s",
                letterSpacing: "-0.01em",
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {section("Contact & Location")}
      {field("Email", profileDraft.email, (v) => setProfileDraft((d) => ({ ...d, email: v })), {
        type: "email",
        placeholder: "hello@yourbarbershop.com",
      })}
      {field("Phone", profileDraft.phone, (v) => setProfileDraft((d) => ({ ...d, phone: v })), {
        type: "tel",
        placeholder: "+30 210 000 0000",
      })}
      {field("Website", profileDraft.website, (v) => setProfileDraft((d) => ({ ...d, website: v })), {
        type: "url",
        placeholder: "https://yourbarbershop.com",
      })}
      {field("Street address", profileDraft.address, (v) => setProfileDraft((d) => ({ ...d, address: v })), {
        placeholder: "e.g. Kifissou 42",
      })}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          {field("City", profileDraft.city, (v) => setProfileDraft((d) => ({ ...d, city: v })), {
            placeholder: "Athens",
          })}
        </div>
        <div>
          {field("Postcode", profileDraft.postcode, (v) => setProfileDraft((d) => ({ ...d, postcode: v })), {
            placeholder: "12345",
          })}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            marginBottom: 5,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Country
        </label>
        <select
          value={profileDraft.country}
          onChange={(e) => setProfileDraft((d) => ({ ...d, country: e.target.value }))}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--gbf-radius-sm)",
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            fontSize: 14,
            fontFamily: "var(--gbf-font-sans)",
            outline: "none",
          }}
        >
          {[
            ["GR", "🇬🇷 Greece"],
            ["GB", "🇬🇧 United Kingdom"],
            ["DE", "🇩🇪 Germany"],
            ["ES", "🇪🇸 Spain"],
            ["FR", "🇫🇷 France"],
            ["IT", "🇮🇹 Italy"],
            ["US", "🇺🇸 United States"],
            ["AU", "🇦🇺 Australia"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {section("Operations")}
      {field("Operating hours", profileDraft.hours, (v) => setProfileDraft((d) => ({ ...d, hours: v })), {
        placeholder: "e.g. Tue–Sat · 10:00–20:00",
      })}
      {field("Team members", profileDraft.barbers, (v) => setProfileDraft((d) => ({ ...d, barbers: v })), {
        placeholder: "Nikos, Giorgos, Eleni, Petros",
        hint: "Comma-separated — shown in the dashboard and agent config",
      })}

      <button
        onClick={saveProfile}
        style={{
          marginTop: 20,
          width: "100%",
          padding: "13px",
          borderRadius: "var(--gbf-radius-sm)",
          background: profileSaved ? C.green : C.accent,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--gbf-font-display)",
          letterSpacing: "-0.01em",
          transition: "background .2s, transform .1s",
        }}
      >
        {profileSaved ? t("profileSaved") : t("saveProfile")}
      </button>
      <p style={{ fontSize: 12, color: C.textFaint, marginTop: 10, lineHeight: 1.5, textAlign: "center" }}>
        Changes are reflected immediately in the dashboard and AI agent greeting.
      </p>
    </div>
  );

  // ── Palette row renderer ────────────────────────────────────────────────
  const paletteRows = (keys: PaletteKey[]) =>
    keys.map((key) => {
      const p = PALETTES[key];
      const lightActive = settings.palette === key && settings.mode === "light";
      const darkActive = settings.palette === key && settings.mode === "dark";
      const sysActive = settings.palette === key && settings.mode === "system";
      return (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 0",
            borderBottom: `1px solid ${C.borderFaint}`,
          }}
        >
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: C.text }}>{p.name}</span>
          <button
            onClick={() => onUpdate({ palette: key, mode: "light" })}
            title={`${p.name} Light`}
            className="gbf-btn"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              background: p.light.bg,
              border: `2.5px solid ${lightActive || sysActive ? p.light.accent : "transparent"}`,
              boxShadow: lightActive || sysActive ? `0 0 0 1px ${p.light.accentMid}` : "0 1px 4px rgba(0,0,0,.12)",
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 5,
                right: 5,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: p.light.accent,
              }}
            />
            {(lightActive || sysActive) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={13} strokeWidth={3} />
              </div>
            )}
          </button>
          <button
            onClick={() => onUpdate({ palette: key, mode: "dark" })}
            title={`${p.name} Dark`}
            className="gbf-btn"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              background: p.dark.bg,
              border: `2.5px solid ${darkActive ? p.dark.accent : "transparent"}`,
              boxShadow: darkActive ? `0 0 0 1px ${p.dark.accentMid}` : "0 1px 4px rgba(0,0,0,.3)",
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 5,
                right: 5,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: p.dark.accent,
              }}
            />
            {darkActive && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: p.dark.text,
                }}
              >
                <Check size={13} strokeWidth={3} />
              </div>
            )}
          </button>
        </div>
      );
    });

  // ── Section: Appearance ───────────────────────────────────────────────────
  const AppearanceSection = () => (
    <div>
      {section("Color palette & mode")}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 28, marginBottom: 6, paddingRight: 4 }}>
        <span
          style={{
            fontSize: 10,
            color: C.textFaint,
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Sun size={10} strokeWidth={2} /> LIGHT
        </span>
        <span
          style={{
            fontSize: 10,
            color: C.textFaint,
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Moon size={10} strokeWidth={2} /> DARK
        </span>
      </div>
      {paletteRows(["calbliss", "cream", "slate", "teal"])}
      {toggle("Follow system", "Auto-switch with OS dark mode", settings.mode === "system", (v) =>
        onUpdate({ mode: v ? "system" : "light" }),
      )}

      {section("Accessibility")}
      {paletteRows(["contrast", "lowvision"])}
      {toggle(
        "Dyslexia-friendly mode",
        "OpenDyslexic font, increased spacing, no uppercase text",
        settings.dyslexia,
        (v) => onUpdate({ dyslexia: v }),
      )}
    </div>
  );

  // ── Section: Dashboard ────────────────────────────────────────────────────
  const DashboardSection = () => (
    <div>
      {section("Data", "Configure how the dashboard fetches and displays live data")}
      <div
        style={{
          marginTop: 20,
          background: C.accentLight,
          borderRadius: "var(--gbf-radius-sm)",
          padding: "14px 16px",
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 4,
            fontFamily: "var(--gbf-font-display)",
            letterSpacing: "-0.01em",
          }}
        >
          Data sources
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["AI Voice Receptionist", "Connected"],
            ["Appointment Ledger", "Local data"],
            ["Live call feed", "Always · every 10 s"],
          ].map(([name, note]) => (
            <div
              key={name}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
            >
              <span style={{ color: C.textMuted }}>{name}</span>
              <span
                style={{ color: C.green, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
              >
                <Check size={12} strokeWidth={3} /> {note}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Section: Display ──────────────────────────────────────────────────────
  const DisplaySection = () => (
    <div>
      {section("Layout", "Adjust how content is sized and spaced")}
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Density</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(
          [
            ["compact", <Rows4 key="compact" size={20} />, "Compact", "More rows visible, tighter padding"],
            ["comfortable", <Rows3 key="comfortable" size={20} />, "Default", "Balanced spacing for everyday use"],
            ["spacious", <Rows2 key="spacious" size={20} />, "Spacious", "Larger cards, easier reading"],
          ] as [DensityKey, React.ReactNode, string, string][]
        ).map(([val, icon, label, desc]) => {
          const active = settings.density === val;
          return (
            <button
              key={val}
              onClick={() => onUpdate({ density: val })}
              className="gbf-btn"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "14px 10px",
                borderRadius: 14,
                cursor: "pointer",
                fontFamily: "var(--gbf-font-sans)",
                border: `2px solid ${active ? C.accent : C.border}`,
                background: active ? C.accentLight : C.surface,
                transition: "all .2s",
              }}
            >
              <span style={{ color: active ? C.accent : C.textMuted, display: "flex" }}>{icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? C.accent : C.text }}>{label}</span>
              <span style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.3, textAlign: "center" }}>{desc}</span>
            </button>
          );
        })}
      </div>

      {section("Mobile navigation", "How the tab bar appears on phones and small tablets")}
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {(
          [
            ["top", <PanelTop key="top" size={20} />, "Top", "Classic — stays below the header"],
            [
              "bottom",
              <PanelBottom key="bottom" size={20} />,
              "Bottom",
              "App-style — pinned to the bottom for thumb reach",
            ],
          ] as [Settings["navPosition"], React.ReactNode, string, string][]
        ).map(([val, icon, label, desc]) => {
          const active = settings.navPosition === val;
          return (
            <button
              key={val}
              onClick={() => onUpdate({ navPosition: val })}
              className="gbf-btn"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
                padding: "12px 14px",
                borderRadius: 14,
                cursor: "pointer",
                fontFamily: "var(--gbf-font-sans)",
                border: `2px solid ${active ? C.accent : C.border}`,
                background: active ? C.accentLight : C.surface,
                transition: "all .2s",
              }}
            >
              <span style={{ color: active ? C.accent : C.textMuted, display: "flex" }}>{icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? C.accent : C.text }}>{label}</span>
              <span style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.3 }}>{desc}</span>
            </button>
          );
        })}
      </div>
      <div
        style={{ fontSize: 11, color: C.textFaint, marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}
      >
        <Smartphone size={12} style={{ color: C.textFaint, flexShrink: 0 }} />
        <span>Bottom nav only activates on screens ≤ 768px wide</span>
      </div>
    </div>
  );

  // ── Section: Account ──────────────────────────────────────────────────────
  const PLANS = [
    {
      id: "demo",
      name: "Demo",
      price: "Free",
      color: "#9AAABB",
      features: [],
      desc: "You're in the demo phase — calls are free and unlimited. Add as many barbershops as you like and explore everything the platform has to offer.",
    },
    {
      id: "starter",
      name: "Starter",
      price: "€79/mo",
      color: "#3D7A50",
      features: ["200 min/month"],
    },
    {
      id: "professional",
      name: "Professional",
      price: "€149/mo",
      color: "#1B5EBE",
      features: ["500 min/month"],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "€299/mo",
      color: "#6747C7",
      features: ["1,200 min/month"],
    },
  ];
  const initials = (profile.ownerName || profile.businessName).slice(0, 2).toUpperCase();

  const AccountSection = () => (
    <div>
      {section("Your account")}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 0",
          borderBottom: `1px solid ${C.borderFaint}`,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentMid})`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            fontWeight: 800,
            flexShrink: 0,
            fontFamily: "var(--gbf-font-display)",
            letterSpacing: "-0.02em",
            boxShadow: `0 4px 12px ${C.accent}44`,
          }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              fontFamily: "var(--gbf-font-display)",
              letterSpacing: "-0.02em",
            }}
          >
            {profile.businessName || "My Barbershop"}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{profile.email}</div>
        </div>
        <span
          style={{
            marginLeft: "auto",
            background: C.accentLight,
            color: C.accent,
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 99,
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          Demo
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
        {[
          ["Change email", "Update your login email address"],
          ["Change password", "Use a strong, unique password"],
        ].map(([label, desc]) => (
          <button
            key={label}
            className="gbf-btn"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              background: "none",
              border: "none",
              borderBottom: `1px solid ${C.borderFaint}`,
              cursor: "pointer",
              fontFamily: "inherit",
              width: "100%",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{desc}</div>
            </div>
            <ChevronRight size={16} style={{ color: C.textFaint, flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {section("Your shops")}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
        {(businesses && businesses.length > 0
          ? businesses
          : [{ id: "", name: profile.businessName || "Greek Barber Festival", plan: undefined }]
        ).map((shop) => {
          const isActive = currentBiz ? currentBiz.id === shop.id : true;
          const isDeleting = deletingBiz?.id === shop.id;
          const inProgress = isDeleting && !!deletingBiz?.inProgress;
          return (
            <div
              key={shop.id || shop.name}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${isDeleting ? C.red + "66" : isActive ? C.accent + "33" : C.border}`,
                background: isDeleting ? C.redLight : isActive ? C.accentLight : C.surface,
                transition: "all .15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
                <div
                  onClick={() => shop.id && onSwitchBiz?.(shop)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                    minWidth: 0,
                    cursor: shop.id ? "pointer" : "default",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: isDeleting ? C.red + "22" : isActive ? C.accent : C.surfaceAlt,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Store size={16} color={isDeleting ? C.red : isActive ? "#fff" : C.textMuted} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isDeleting ? C.red : C.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {shop.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      Owner · {isActive ? "Active" : "Tap to switch"}
                    </div>
                  </div>
                </div>
                {shop.id && !isDeleting && (
                  <button
                    onClick={() => setDeletingBiz({ id: shop.id, name: shop.name })}
                    className="gbf-btn"
                    title="Delete this barbershop"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "border-color .15s, background .15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = C.red;
                      (e.currentTarget as HTMLButtonElement).style.background = C.redLight;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    <Trash2 size={13} style={{ color: C.textMuted }} />
                  </button>
                )}
                {shop.id && isDeleting && (
                  <button
                    onClick={() => setDeletingBiz(null)}
                    className="gbf-btn"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <X size={13} style={{ color: C.textMuted }} />
                  </button>
                )}
                {isActive && !isDeleting && (
                  <Check size={14} style={{ color: C.accent, flexShrink: 0 }} strokeWidth={2.5} />
                )}
              </div>

              {isDeleting && (
                <div style={{ padding: "0 14px 14px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "10px 12px",
                      background: C.redLight,
                      border: `1px solid ${C.red}33`,
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  >
                    <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: C.red, lineHeight: 1.5 }}>
                      <strong>This will permanently delete</strong> all data for <em>{shop.name}</em> — calls,
                      appointments, agents, and the barbershop itself. This cannot be undone.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="gbf-btn"
                      disabled={inProgress}
                      onClick={async () => {
                        const {
                          data: { user },
                        } = await supabase.auth.getUser();
                        if (!user) return;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const sb = supabase as any;
                        const [{ data: bizData }, { data: calls }, { data: appts }] = await Promise.all([
                          sb.from("businesses").select("*").eq("id", shop.id).single(),
                          sb.from("calls").select("*").eq("business_id", shop.id),
                          sb.from("appointments").select("*").eq("business_id", shop.id),
                        ]);
                        const backup = {
                          exported_at: new Date().toISOString(),
                          business: bizData,
                          calls: calls ?? [],
                          appointments: appts ?? [],
                        };
                        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `backup-${shop.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.surfaceAlt,
                        color: C.text,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <Download size={12} /> Download backup
                    </button>
                    <button
                      className="gbf-btn"
                      disabled={inProgress}
                      onClick={async () => {
                        setDeletingBiz((d) => (d ? { ...d, inProgress: true } : null));
                        try {
                          await onDeleteBiz?.(shop.id);
                          setDeletingBiz(null);
                        } finally {
                          setDeletingBiz((d) => (d ? { ...d, inProgress: false } : null));
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: C.red,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: inProgress ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        opacity: inProgress ? 0.7 : 1,
                      }}
                    >
                      {inProgress ? (
                        <Loader size={12} style={{ animation: "gbf-spin 1s linear infinite" }} />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      {inProgress ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      className="gbf-btn"
                      disabled={inProgress}
                      onClick={() => setDeletingBiz(null)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: "transparent",
                        color: C.textMuted,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={() => onAddShop?.()}
          className="gbf-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: `1.5px dashed ${C.border}`,
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
            transition: "border-color .15s, background .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent;
            (e.currentTarget as HTMLButtonElement).style.background = C.accentLight;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Plus size={16} style={{ color: C.textMuted }} strokeWidth={2} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Add a barbershop</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Connect another location to your account</div>
          </div>
        </button>
      </div>

      {section("Subscription")}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PLANS.map((plan) => {
          const current = plan.id === "demo";
          return (
            <div
              key={plan.id}
              style={{
                border: `1.5px solid ${current ? plan.color : C.border}`,
                borderRadius: 16,
                padding: "14px 18px",
                background: current ? C.accentLight : C.surface,
                transition: "all .2s",
                boxShadow: current ? `0 2px 12px ${plan.color}18` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: plan.color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{plan.name}</span>
                  {current && (
                    <span
                      style={{
                        fontSize: 10,
                        background: plan.color,
                        color: "#fff",
                        padding: "2px 7px",
                        borderRadius: 99,
                        fontWeight: 700,
                      }}
                    >
                      CURRENT
                    </span>
                  )}
                </div>
                {!current && <span style={{ fontSize: 15, fontWeight: 700, color: plan.color }}>{plan.price}</span>}
              </div>
              {"desc" in plan ? (
                <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, margin: 0 }}>{plan.desc}</p>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {plan.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        fontSize: 11,
                        color: C.textMuted,
                        background: C.surfaceAlt,
                        padding: "2px 8px",
                        borderRadius: 99,
                        border: `1px solid ${C.borderFaint}`,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {!current && (
                <button
                  className="gbf-btn"
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "9px",
                    borderRadius: "var(--gbf-radius-xs)",
                    background: plan.color,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--gbf-font-display)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Upgrade to {plan.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Section: Security ─────────────────────────────────────────────────────
  const SecuritySection = () => (
    <div>
      {section("Authentication")}
      {toggle("Two-factor authentication", "Require a code from your phone on login", profile.twoFactorEnabled, (v) =>
        onProfileUpdate({ twoFactorEnabled: v }),
      )}
      {profile.twoFactorEnabled && (
        <div
          style={{
            marginTop: 10,
            background: C.greenLight,
            borderRadius: "var(--gbf-radius-xs)",
            padding: "10px 14px",
            fontSize: 13,
            color: C.green,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Check size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} /> 2FA is active. Your account is protected.
        </div>
      )}

      {section("Active sessions", "Devices currently signed in to your account")}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {MOCK_SESSIONS.map((sess) => (
          <div
            key={sess.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              background: C.surfaceAlt,
              borderRadius: "var(--gbf-radius-sm)",
              border: `1px solid ${C.borderFaint}`,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{sess.device}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                {sess.location} · {sess.lastSeen}
              </div>
            </div>
            {sess.current ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.green,
                  background: C.greenLight,
                  padding: "3px 9px",
                  borderRadius: 99,
                }}
              >
                Current
              </span>
            ) : (
              <button
                className="gbf-btn"
                style={{
                  fontSize: 12,
                  color: C.red,
                  background: C.redLight,
                  border: "none",
                  borderRadius: 8,
                  padding: "5px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                }}
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        className="gbf-btn"
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: "var(--gbf-radius-sm)",
          background: "transparent",
          border: `1px solid ${C.border}`,
          color: C.textMuted,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "var(--gbf-font-sans)",
          fontWeight: 500,
        }}
      >
        Sign out all other devices
      </button>

      {section("API & Integration")}
      <div
        style={{
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: "var(--gbf-radius-sm)",
          padding: "12px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          ElevenLabs Agent ID
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{ flex: 1, fontSize: 12, color: C.textMuted, fontFamily: "monospace", wordBreak: "break-all" }}>
            {profile.agentId.slice(0, 12)}••••••••••••{profile.agentId.slice(-4)}
          </code>
          <button
            className="gbf-btn"
            onClick={() => navigator.clipboard?.writeText(profile.agentId)}
            style={{
              fontSize: 11,
              background: C.accentLight,
              color: C.accent,
              border: "none",
              borderRadius: 6,
              padding: "5px 9px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Copy
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5, marginBottom: 24 }}>
        Your API credentials are stored server-side and never exposed to the browser. All calls to ElevenLabs are
        proxied through our secure backend.
      </div>

      {/* Sign out */}
      <button
        onClick={onLogout}
        className="gbf-btn"
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "var(--gbf-radius-sm)",
          background: "transparent",
          border: `1px solid ${C.border}`,
          color: C.textMuted,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "var(--gbf-font-sans)",
          marginBottom: 10,
          letterSpacing: "-0.01em",
        }}
      >
        Sign out
      </button>

      {/* Danger zone */}
      <div style={{ border: `1px solid ${C.red}30`, borderRadius: 16, padding: "16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>Danger zone</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
          Permanently delete your account and all data. This action cannot be undone.
        </div>
        <input
          type="text"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder='Type "DELETE" to confirm'
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            borderRadius: "var(--gbf-radius-xs)",
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            fontSize: 13,
            fontFamily: "var(--gbf-font-sans)",
            outline: "none",
            marginBottom: 8,
            transition: "border-color .2s",
          }}
        />
        <button
          disabled={deleteConfirm !== "DELETE"}
          className="gbf-btn"
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: "var(--gbf-radius-xs)",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "var(--gbf-font-display)",
            letterSpacing: "-0.01em",
            background: deleteConfirm === "DELETE" ? C.red : C.surfaceAlt,
            color: deleteConfirm === "DELETE" ? "#fff" : C.textFaint,
            border: "none",
            cursor: deleteConfirm === "DELETE" ? "pointer" : "not-allowed",
            transition: "all .15s",
          }}
        >
          Delete account
        </button>
      </div>
    </div>
  );

  // ── Section: Language ─────────────────────────────────────────────────────
  const LanguageSection = () => (
    <div>
      {section(t("interfaceLang"))}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {(Object.entries(LANG_META) as [LanguageKey, (typeof LANG_META)[LanguageKey]][]).map(([key, meta]) => {
          const active = langSettings.lang === key;
          return (
            <button
              key={key}
              onClick={() => onLangUpdate({ lang: key })}
              className="gbf-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 14px",
                borderRadius: "var(--gbf-radius-sm)",
                border: `1.5px solid ${active ? C.accent : C.border}`,
                background: active ? C.accentLight : C.surface,
                cursor: "pointer",
                fontFamily: "var(--gbf-font-sans)",
                textAlign: "left",
                transition: "all .2s",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.flag}</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    color: active ? C.accent : C.text,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {meta.native}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{meta.name}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {meta.rtl && (
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textFaint,
                      background: C.surfaceAlt,
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: `1px solid ${C.borderFaint}`,
                    }}
                  >
                    RTL
                  </span>
                )}
                {active && <Check size={16} style={{ color: C.accent, flexShrink: 0 }} strokeWidth={2.5} />}
              </div>
            </button>
          );
        })}
      </div>

      {section(t("translateScope"), t("translateScopeHint"))}
      {toggle(t("translateUI"), "Labels, tabs, buttons, navigation", langSettings.translateUI, (v) =>
        onLangUpdate({ translateUI: v }),
      )}
      {toggle(t("translateServices"), "Service names in appointments", langSettings.translateServices, (v) =>
        onLangUpdate({ translateServices: v }),
      )}
      {toggle(t("translateDates"), "Date & time locale formatting", langSettings.translateDates, (v) =>
        onLangUpdate({ translateDates: v }),
      )}

      <div
        style={{
          marginTop: 20,
          background: C.accentLight,
          borderRadius: "var(--gbf-radius-sm)",
          padding: "14px 16px",
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textFaint,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          {t("previewLabel")}
        </div>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{t("aiDashboard")}</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          {t("hubFull")} · {t("ledgerFull")}
        </div>
        <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>
          {t("confirmed")} · {t("pending")} · {t("cancelled")}
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return <ProfileSection />;
      case "appearance":
        return <AppearanceSection />;
      case "dashboard":
        return <DashboardSection />;
      case "display":
        return <DisplaySection />;
      case "language":
        return <LanguageSection />;
      case "account":
        return <AccountSection />;
      case "security":
        return <SecuritySection />;
    }
  };

  return (
    <>
      {/* Backdrop — above ElevenLabs widget (z 200) */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: C.overlay,
          zIndex: 10000,
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />

      <div
        className="gbf-settings-drawer"
        style={{
          zIndex: 10001,
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: "-2px 0 8px rgba(0,0,0,.04), -8px 0 32px rgba(0,0,0,.08), -24px 0 80px rgba(0,0,0,.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="gbf-settings-handle" style={{ justifyContent: "center", padding: "10px 0 2px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: C.border }} />
        </div>

        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            position: "sticky",
            top: 0,
            background: `${C.surface}EE`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          {/* Mobile back button */}
          <button
            className={`gbf-btn gbf-mob-back`}
            onClick={handleBack}
            style={{
              display: mobContent ? undefined : "none",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.accent,
              fontSize: 14,
              fontWeight: 600,
              padding: "4px 0",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {t("back")}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              {mobContent
                ? t(`sNav${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}`)
                : t("settingsTitle")}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
              {mobContent
                ? t(`sNav${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}Desc`)
                : t("settingsSubtitle")}
            </div>
          </div>
          <button
            onClick={onClose}
            className="gbf-btn gbf-icon-btn"
            style={{
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: "50%",
              width: 44,
              height: 44,
              cursor: "pointer",
              color: C.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background .15s",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="gbf-settings-body">
          {/* Nav sidebar */}
          <nav
            className={`gbf-settings-nav${mobContent ? " gbf-mob-hide" : ""}`}
            style={{ borderRight: `1px solid ${C.border}`, background: C.surfaceAlt, padding: "4px 0" }}
          >
            {NAV_ITEMS.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  data-active={active ? "true" : undefined}
                  className="gbf-btn gbf-settings-nav-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "calc(100% - 16px)",
                    margin: "2px 8px",
                    padding: "9px 10px",
                    borderRadius: 10,
                    background: active ? C.accentLight : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "background .15s",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: active ? C.accentMid + "22" : C.borderFaint,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: active ? C.accent : C.textMuted,
                      flexShrink: 0,
                      transition: "all .2s",
                    }}
                  >
                    {item.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        color: active ? C.accent : C.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {t(`sNav${item.id.charAt(0).toUpperCase() + item.id.slice(1)}`)}
                    </div>
                  </div>
                  {/* Mobile chevron */}
                  <svg
                    className="gbf-mob-back"
                    style={{ marginLeft: "auto", color: C.textFaint, flexShrink: 0 }}
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="5,2 11,7 5,12" />
                  </svg>
                </button>
              );
            })}
          </nav>

          {/* Content area */}
          <div className={`gbf-settings-main${!mobContent ? " gbf-mob-hide" : ""}`}>
            <div style={{ paddingTop: 4 }}>{renderSection()}</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── GearIcon ──────────────────────────────────────────────────────────────────
function GearIcon() {
  return <SettingsIcon size={18} strokeWidth={1.75} />;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  value,
  label,
  sub,
  C,
  density,
  loading,
  onClick,
  tip,
}: {
  value: string | number;
  label: string;
  sub?: string;
  C: Colors;
  density: DensityKey;
  loading?: boolean;
  onClick?: () => void;
  tip?: string;
}) {
  const [hov, setHov] = useState(false);
  const pad = DENSITY_PAD[density];
  const isClickable = !!onClick;
  if (loading) return <SkeletonCard />;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="gbf-lift"
      style={{
        background: C.surface,
        border: `1px solid ${hov && isClickable ? C.accentMid : C.border}`,
        borderRadius: "var(--gbf-radius-card)",
        padding: pad.card,
        position: "relative",
        overflow: "hidden",
        cursor: isClickable ? "pointer" : "default",
        boxShadow: hov && isClickable ? "var(--gbf-shadow-lift)" : "var(--gbf-shadow-card)",
        transition: "box-shadow .22s ease, border-color .18s ease",
      }}
    >
      {/* Clickable indicator arrow */}
      {isClickable && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            color: C.accent,
            opacity: hov ? 1 : 0.28,
            transition: "opacity .18s, transform .18s",
            transform: hov ? "translateX(2px)" : "none",
            display: "flex",
          }}
        >
          <ArrowRight size={13} strokeWidth={2} />
        </div>
      )}
      {/* Accent bar at top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: hov && isClickable ? C.accent : C.accentLight,
          borderRadius: "20px 20px 0 0",
          transition: "background .22s",
        }}
      />
      <div
        key={String(value)}
        className="gbf-num-in gbf-stat-num"
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: C.accent,
          letterSpacing: "-0.6px",
          lineHeight: 1.05,
          fontFamily: "var(--gbf-font-display)",
        }}
      >
        {value}
      </div>
      <div
        className="gbf-stat-label"
        style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 5, letterSpacing: "-0.01em" }}
      >
        {label}
      </div>
      {sub && (
        <div className="gbf-stat-sub" style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 500 }}>
          {sub}
        </div>
      )}
      {tip && hov && (
        <div
          style={{ position: "absolute", bottom: 8, right: 10, fontSize: 10, color: C.textFaint, fontStyle: "italic" }}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ status, label, C }: { status: string; label: string; C: Colors }) {
  const colors: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: C.greenLight, color: C.green },
    "in-progress": { bg: C.amberLight, color: C.amber },
    pending: { bg: C.borderFaint, color: C.textMuted },
    cancelled: { bg: C.redLight, color: C.red },
    failed: { bg: C.borderFaint, color: C.textFaint },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 99,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── WalkInModal ───────────────────────────────────────────────────────────────
const SERVICE_OPTIONS = [
  "Haircut",
  "Beard Trim",
  "Full Shave",
  "Haircut + Beard Combo",
  "Kids Cut",
  "Hair Styling",
  "Eyebrow Grooming",
];

type WalkInServiceLine = { service: string; barber: string; price: string; duration_minutes: number };

function WalkInModal({
  C,
  barbers,
  businessId,
  onClose,
  onSaved,
}: {
  C: Colors;
  barbers: string[];
  businessId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<WalkInServiceLine[]>([
    { service: SERVICE_OPTIONS[0], barber: barbers[0] ?? "", price: "", duration_minutes: 30 },
  ]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now.toTimeString().slice(0, 5);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const inp: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 13px",
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    background: C.surfaceAlt,
    color: C.text,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer" };
  const lbl: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: C.textFaint,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    display: "block",
    marginBottom: 5,
  };

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function updateSvc(i: number, patch: Partial<WalkInServiceLine>) {
    setServices((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function fillDemo() {
    const firstNames = [
      "Alexandros",
      "Dimitrios",
      "Giorgos",
      "Nikos",
      "Kostas",
      "Ioannis",
      "Thanasis",
      "Petros",
      "Stelios",
      "Makis",
      "Manolis",
      "Christos",
    ];
    const lastNames = [
      "Papadopoulos",
      "Nikolaou",
      "Georgiou",
      "Ioannou",
      "Alexiou",
      "Petrou",
      "Stavropoulos",
      "Karamanlis",
      "Lambrakis",
    ];
    const rnd = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const DEMO_SVCS: { service: string; price: number; duration_minutes: number }[] = [
      { service: "Haircut", price: 15, duration_minutes: 30 },
      { service: "Beard Trim", price: 10, duration_minutes: 20 },
      { service: "Full Shave", price: 12, duration_minutes: 25 },
      { service: "Haircut + Beard Combo", price: 22, duration_minutes: 45 },
      { service: "Kids Cut", price: 10, duration_minutes: 20 },
      { service: "Hair Styling", price: 20, duration_minutes: 40 },
      { service: "Eyebrow Grooming", price: 8, duration_minutes: 15 },
      { service: "Eyebrow Grooming", price: 5, duration_minutes: 10 },
    ];

    const count = Math.random() < 0.5 ? 1 : Math.random() < 0.65 ? 2 : 3;
    const pool = [...DEMO_SVCS].sort(() => Math.random() - 0.5).slice(0, count);
    const barberPool = barbers.length ? barbers : ["Nikos", "Giorgos", "Petros"];

    setName(`${rnd(firstNames)} ${rnd(lastNames)}`);
    setPhone(
      `+30 69${String(Math.floor(Math.random() * 90 + 10))} ${String(Math.floor(Math.random() * 900 + 100))} ${String(Math.floor(Math.random() * 900 + 100))}`,
    );
    setServices(pool.map((s) => ({ ...s, price: String(s.price), barber: rnd(barberPool) })));

    // Set time to a plausible barbershop slot (09:00–17:30)
    const hour = Math.floor(Math.random() * 9) + 9;
    const mins = Math.random() < 0.5 ? "00" : "30";
    setTime(`${String(hour).padStart(2, "0")}:${mins}`);
  }

  const totalPrice = services.reduce((s, l) => s + (parseFloat(l.price) || 0), 0);
  const totalDuration = services.reduce((s, l) => s + l.duration_minutes, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Client name is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErr("Not authenticated — please refresh and log in again.");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          business_id: businessId,
          client_name: name.trim(),
          phone_number: phone.trim() || undefined,
          services: services.map((l) => ({
            service: l.service,
            barber: l.barber || undefined,
            price: parseFloat(l.price) || 0,
            duration_minutes: l.duration_minutes,
          })),
          service_type: services[0].service,
          barber_name: services[0].barber || undefined,
          duration_minutes: services.reduce((s, l) => s + l.duration_minutes, 0),
          price: services.reduce((s, l) => s + (parseFloat(l.price) || 0), 0) || undefined,
          appointment_date: date,
          appointment_time: time,
          notes: notes.trim() || undefined,
          source: "walk-in",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr("Network error");
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="gbf-walkin-overlay"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: C.overlay }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="gbf-walkin-panel"
        style={{
          background: C.surface,
          overflowY: "auto",
          padding: "28px 24px 32px",
          boxShadow: "0 -8px 40px rgba(0,0,0,.3)",
          animation: "gbf-slideU .25s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 99, background: C.border, margin: "0 auto 22px" }} />

        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Walk-in Entry</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Register a walk-in to the dashboard</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={fillDemo}
              className="gbf-btn"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.accent,
                background: C.accentLight,
                border: `1px solid ${C.accent}44`,
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <Sparkles size={11} strokeWidth={2.5} /> Fill demo
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.surfaceAlt,
                color: C.textMuted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Row: name + phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Client name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                required
                style={inp}
                autoFocus
              />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+30 694..."
                style={inp}
                type="tel"
              />
            </div>
          </div>

          {/* Services list */}
          <div>
            <label style={lbl}>Services</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {services.map((svc, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 80px 72px 32px",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <select
                    value={svc.service}
                    onChange={(e) => updateSvc(i, { service: e.target.value })}
                    style={{ ...sel, padding: "8px 10px", fontSize: 13 }}
                  >
                    {SERVICE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={svc.barber}
                    onChange={(e) => updateSvc(i, { barber: e.target.value })}
                    style={{ ...sel, padding: "8px 10px", fontSize: 13 }}
                  >
                    <option value="">— Any —</option>
                    {barbers.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={svc.duration_minutes}
                    onChange={(e) => updateSvc(i, { duration_minutes: parseInt(e.target.value) })}
                    style={{ ...sel, padding: "8px 6px", fontSize: 13 }}
                  >
                    {[15, 20, 30, 45, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>
                        {d}m
                      </option>
                    ))}
                  </select>
                  <input
                    value={svc.price}
                    onChange={(e) => updateSvc(i, { price: e.target.value })}
                    placeholder="€"
                    type="number"
                    min="0"
                    step="0.50"
                    style={{ ...inp, padding: "8px 8px", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => services.length > 1 && setServices((prev) => prev.filter((_, j) => j !== i))}
                    disabled={services.length === 1}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: C.surfaceAlt,
                      color: services.length === 1 ? C.textFaint : C.red,
                      cursor: services.length === 1 ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 16,
                      opacity: services.length === 1 ? 0.3 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {/* Add service button */}
            <button
              type="button"
              onClick={() =>
                setServices((prev) => [
                  ...prev,
                  { service: SERVICE_OPTIONS[0], barber: barbers[0] ?? "", price: "", duration_minutes: 30 },
                ])
              }
              style={{
                marginTop: 8,
                padding: "7px 14px",
                borderRadius: 8,
                border: `1.5px dashed ${C.accent}66`,
                background: "transparent",
                color: C.accentMid,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              + Add service
            </button>
            {/* Total summary */}
            {services.length > 0 && (totalPrice > 0 || totalDuration > 0) && (
              <div style={{ marginTop: 6, fontSize: 12, color: C.textMuted }}>
                Total: <span style={{ fontWeight: 700, color: C.accent }}>€{totalPrice.toFixed(2)}</span> ·{" "}
                <span style={{ fontWeight: 700, color: C.accent }}>{totalDuration} min</span>
              </div>
            )}
          </div>

          {/* Row: date + time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Date</label>
              <input value={date} onChange={(e) => setDate(e.target.value)} type="date" required style={inp} />
            </div>
            <div>
              <label style={lbl}>Time</label>
              <input value={time} onChange={(e) => setTime(e.target.value)} type="time" required style={inp} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" style={inp} />
          </div>

          {err && (
            <div style={{ fontSize: 13, color: C.red, background: C.redLight, padding: "10px 14px", borderRadius: 8 }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "14px",
              borderRadius: 12,
              border: "none",
              background: saving ? C.accentLight : C.accent,
              color: saving ? C.accentMid : C.bg,
              fontSize: 15,
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              marginTop: 4,
              transition: "background .15s",
            }}
          >
            {saving ? "Saving…" : "Save Walk-in"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ── HubTab ────────────────────────────────────────────────────────────────────
type LiveMsg = { role: "agent" | "user"; text: string; ts: number };

function HubTab({
  agent,
  C,
  density,
  loading,
  profile,
  conversations,
  aiBookings,
  liveCall,
  onTabChange,
  onConvSelect,
  callActive,
  callStatus,
  liveTranscript,
  agentMode,
  onHumanTakeover,
  businesses,
  currentBiz,
}: {
  agent: AgentData | null;
  C: Colors;
  density: DensityKey;
  loading: boolean;
  profile: BusinessProfile;
  conversations: ConversationSummary[];
  aiBookings: AiBooking[];
  liveCall: boolean;
  onTabChange: (tab: "hub" | "ledger" | "analytics") => void;
  onConvSelect: (convId: string) => void;
  callActive: boolean;
  callStatus: "idle" | "connecting" | "active";
  liveTranscript: LiveMsg[];
  agentMode: "idle" | "listening" | "speaking" | "thinking";
  onHumanTakeover: () => void;
  businesses?: { id: string; name: string }[];
  currentBiz?: { id: string; name: string } | null;
}) {
  const t = useT();
  const [hideNoAnswer, setHideNoAnswer] = useState(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll only the transcript container — never the page.
    // (scrollIntoView on a child bubbles up and can scroll the whole window.)
    const el = transcriptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveTranscript]);
  const languages = agent?.languages ?? ["el", "en", "es", "pt", "fr", "de", "ar"];

  const [nowSecs] = useState(() => Math.floor(Date.now() / 1000));
  const sevenDaysAgo = nowSecs - 7 * 86400;
  const real7dCalls = conversations.filter((c) => c.start_time_unix_secs > sevenDaysAgo).length;
  const aiTodayBookings = aiBookings.filter(
    (b) => b.date === d0 && b.call_status !== "error" && b.status !== "failed" && b.status !== "cancelled",
  );
  const mockTodayAppts = APPOINTMENTS.filter((a) => a.date === d0 && a.status !== "cancelled");
  // Gate on whether ANY real AI data exists, not just today — prevents showing demo fallback for real shops with no calls today
  const usingRealData = aiBookings.length > 0 && !aiBookings.every((b) => b.conversation_id.startsWith("demo_"));
  const totalTodayCount = usingRealData
    ? aiTodayBookings.length
    : aiTodayBookings.length > 0
      ? aiTodayBookings.length
      : mockTodayAppts.length;
  const aiTodayRevenue = aiTodayBookings.reduce((s, b) => s + (b.price || 0), 0);
  const revenue = usingRealData
    ? aiTodayRevenue
    : aiTodayRevenue > 0
      ? aiTodayRevenue
      : mockTodayAppts.reduce((s, a) => s + a.price, 0);
  const callCount = real7dCalls > 0 ? real7dCalls : (agent?.last_7_day_call_count ?? 0);
  const pad = DENSITY_PAD[density];
  const barbers = parseBarberNames(profile.barbers);
  const agentName = agent?.name?.split(/\s*[\u2014—]\s*/)[0] ?? "Kostas";

  // Categorise each booking for the feed
  type FeedEntry = AiBooking & { feedType: string; feedColor: string; feedBg: string };
  const allFeedEntries: FeedEntry[] = aiBookings.map((b) => {
    const sum = b.summary.toLowerCase();
    let feedType = "CALL";
    let feedColor = C.accent;
    let feedBg = C.accentLight;
    if (b.call_status === "in-progress") {
      feedType = "LIVE";
      feedColor = C.red;
      feedBg = C.redLight;
    } else if (b.message_count === 0) {
      feedType = "NO ANSWER";
      feedColor = C.textFaint;
      feedBg = C.borderFaint;
    } else if (b.status === "failed" && (b.message_count ?? 0) <= 1 && (b.duration_secs ?? 0) < 20) {
      feedType = "DROPPED";
      feedColor = C.amber;
      feedBg = C.amberLight;
    } else if (b.call_status === "error") {
      feedType = "MISSED";
      feedColor = C.textFaint;
      feedBg = C.borderFaint;
    } else if (b.status === "cancelled" || /\bcancel/i.test(sum)) {
      feedType = "CANCEL";
      feedColor = C.amber;
      feedBg = C.amberLight;
    } else if (/reschedul/i.test(sum)) {
      feedType = "RESCHEDULE";
      feedColor = C.accentMid;
      feedBg = C.accentLight;
    } else if (b.status === "pending") {
      feedType = "PENDING";
      feedColor = C.amber;
      feedBg = C.amberLight;
    } else if (b.status === "confirmed" || (b.service && b.service !== "—")) {
      feedType = "BOOKED";
      feedColor = C.green;
      feedBg = C.greenLight;
    }
    return { ...b, feedType, feedColor, feedBg };
  });
  const noAnswerCount = allFeedEntries.filter((e) => e.feedType === "NO ANSWER" || e.feedType === "DROPPED").length;
  const feedEntries = hideNoAnswer
    ? allFeedEntries.filter((e) => e.feedType !== "NO ANSWER" && e.feedType !== "DROPPED")
    : allFeedEntries;

  const isAllShops = currentBiz === null && (businesses?.length ?? 0) > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: pad.gap }}>
      {/* ── All-shops aggregation banner ── */}
      {isAllShops && businesses && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 12,
            background: C.accentLight,
            border: `1px solid ${C.accent}33`,
          }}
        >
          <Store size={14} style={{ color: C.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>All shops</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            — showing aggregated data from {businesses.length} barbershops:
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {businesses.map((b) => (
              <span
                key={b.id}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                }}
              >
                {b.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Mobile quick-stats KPI strip (horizontal scroll, hidden on desktop) ── */}
      <div className="gbf-kpi-strip gbf-stagger" style={{ marginBottom: 8 }}>
        {[
          {
            icon: (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: liveCall ? C.red : C.green,
                  display: "inline-block",
                }}
              />
            ),
            val: liveCall ? "LIVE" : "READY",
            label: "Status",
            color: liveCall ? C.red : C.green,
            bg: liveCall ? C.redLight : C.greenLight,
          },
          {
            icon: <PhoneCall size={13} strokeWidth={2} />,
            val: callCount,
            label: t("callsWeek"),
            color: C.accent,
            bg: C.accentLight,
          },
          {
            icon: <CalendarDays size={13} strokeWidth={2} />,
            val: totalTodayCount,
            label: t("bookingsToday"),
            color: C.green,
            bg: C.greenLight,
          },
          {
            icon: <Coins size={13} strokeWidth={2} />,
            val: `€${revenue}`,
            label: t("revenueToday"),
            color: C.amber,
            bg: C.amberLight,
          },
          {
            icon: <Languages size={13} strokeWidth={2} />,
            val: languages.length,
            label: t("languages"),
            color: C.accent,
            bg: C.accentLight,
          },
        ].map(({ icon, val, label, color, bg }) => (
          <div
            key={label}
            className="gbf-chip"
            style={{ background: bg, border: `1px solid ${color}33`, color: C.text, gap: 5 }}
          >
            <span style={{ display: "flex", alignItems: "center", color }}>{icon}</span>
            <span style={{ fontWeight: 800, color, fontSize: 13 }}>{val}</span>
            <span style={{ fontWeight: 500, color: C.textMuted, fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Stat cards ── */}
      <div className="gbf-stat-grid gbf-stagger">
        <StatCard
          value={languages.length}
          label={t("languages")}
          sub={t("autoDetected")}
          C={C}
          density={density}
          loading={loading}
        />
        <StatCard
          value={totalTodayCount}
          label={t("bookingsToday")}
          sub={liveCall ? "Live call now" : t("viaAI")}
          C={C}
          density={density}
          loading={loading}
          onClick={() => onTabChange("ledger")}
          tip="Open Ledger"
        />
        <StatCard
          value={`€${revenue}`}
          label={t("revenueToday")}
          sub={usingRealData ? t("fromAICalls") : t("demoData")}
          C={C}
          density={density}
          loading={loading}
          onClick={() => onTabChange("analytics")}
          tip="View Analytics"
        />
        <StatCard
          value={callCount}
          label={t("callsWeek")}
          sub={t("realTime")}
          C={C}
          density={density}
          loading={loading}
          onClick={() => onTabChange("analytics")}
          tip="View Analytics"
        />
      </div>

      {/* ── Main two-col: Terminal + Live Feed ── */}
      <div style={{ gap: pad.gap }} className="gbf-hub-main">
        {/* ── INTERACTION TERMINAL ── */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Terminal header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${C.borderFaint}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  color: C.textFaint,
                  textTransform: "uppercase",
                }}
              >
                Interaction Terminal
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: liveCall ? C.redLight : C.greenLight,
                padding: "4px 10px",
                borderRadius: 99,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: liveCall ? C.red : C.green,
                  display: "inline-block",
                  animation: "gbf-pulse 1.5s infinite",
                }}
              />
              <span
                style={{ fontSize: 10, fontWeight: 800, color: liveCall ? C.red : C.green, letterSpacing: "0.08em" }}
              >
                {liveCall ? "ON CALL" : "ALWAYS ACTIVE"}
              </span>
            </div>
          </div>

          {/* ── LIVE CALL: real-time transcript ─────────────────────────────── */}
          {callActive ? (
            <>
              {/* Mode indicator bar */}
              <div
                style={{
                  padding: "10px 20px",
                  borderBottom: `1px solid ${C.borderFaint}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    display: "inline-block",
                    flexShrink: 0,
                    background:
                      agentMode === "speaking"
                        ? C.accent
                        : agentMode === "listening"
                          ? C.green
                          : agentMode === "thinking"
                            ? C.amber
                            : C.textFaint,
                    animation: agentMode !== "idle" ? "gbf-pulse 0.8s infinite" : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color:
                      agentMode === "speaking"
                        ? C.accent
                        : agentMode === "listening"
                          ? C.green
                          : agentMode === "thinking"
                            ? C.amber
                            : C.textFaint,
                  }}
                >
                  {agentMode === "speaking"
                    ? "Agent speaking"
                    : agentMode === "listening"
                      ? "Listening…"
                      : agentMode === "thinking"
                        ? "Processing…"
                        : "Connected"}
                </span>
                <span
                  style={{ marginLeft: "auto", fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums" }}
                >
                  {liveTranscript.length} messages
                </span>
              </div>

              {/* Transcript scroll area */}
              <div
                ref={transcriptScrollRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  minHeight: 220,
                  maxHeight: 340,
                }}
              >
                {liveTranscript.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: C.textFaint, fontSize: 12 }}>
                    Waiting for conversation to begin…
                  </div>
                ) : (
                  liveTranscript.map((msg) => (
                    <div
                      key={msg.ts}
                      className="gbf-msg-bubble"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: msg.role === "agent" ? "flex-start" : "flex-end",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: C.textFaint,
                          marginBottom: 3,
                          paddingLeft: msg.role === "agent" ? 4 : 0,
                          paddingRight: msg.role === "user" ? 4 : 0,
                        }}
                      >
                        {msg.role === "agent" ? agentName.toUpperCase() : "CALLER"}
                      </div>
                      <div
                        style={{
                          maxWidth: "85%",
                          background: msg.role === "agent" ? C.accentLight : C.surfaceAlt,
                          border: `1px solid ${msg.role === "agent" ? C.accentMid + "33" : C.border}`,
                          borderRadius: msg.role === "agent" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                          padding: "8px 12px",
                          fontSize: 13,
                          color: C.text,
                          lineHeight: 1.5,
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Human Takeover button */}
              <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.borderFaint}` }}>
                <button
                  onClick={onHumanTakeover}
                  style={{
                    width: "100%",
                    background: C.red,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 16px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "var(--gbf-font-sans)",
                    letterSpacing: "-0.01em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "opacity .15s",
                  }}
                >
                  <CornerUpLeft size={15} strokeWidth={2} /> Human Takeover — End AI Call
                </button>
                <div style={{ fontSize: 10, color: C.textFaint, textAlign: "center", marginTop: 6, lineHeight: 1.4 }}>
                  Agent will say goodbye &amp; hang up. You follow up directly.
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── IDLE: normal agent view ─────────────────────────────────── */}
              <div
                style={{
                  padding: "28px 20px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {/* Outer ring + avatar */}
                <div style={{ position: "relative" }}>
                  <div
                    className={liveCall ? "" : "gbf-ring-idle"}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      border: `2px solid ${C.borderFaint}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        border: `2px solid ${C.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          background: liveCall ? C.redLight : C.accentLight,
                          border: `2px solid ${liveCall ? C.red + "44" : C.accentMid + "44"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          animation: liveCall ? "gbf-pulse 2s infinite" : "none",
                          transition: "background .3s, border-color .3s",
                        }}
                      >
                        <Scissors size={26} style={{ color: liveCall ? C.red : C.accent }} strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 6,
                      right: 6,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: liveCall ? C.red : C.green,
                      border: `2px solid ${C.surface}`,
                      animation: "gbf-pulse 2s infinite",
                    }}
                  />
                </div>

                <div style={{ textAlign: "center" }}>
                  {loading ? (
                    <div className="gbf-skeleton" style={{ height: 20, width: 90, margin: "0 auto" }} />
                  ) : (
                    <div
                      style={{ fontFamily: "var(--gbf-font-display)", fontSize: 20, fontWeight: 600, color: C.text }}
                    >
                      {agentName}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{t("aiFrontDesk")}</div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: liveCall ? C.red : C.textFaint,
                    fontStyle: "italic",
                    textAlign: "center",
                    minHeight: 18,
                    lineHeight: 1.4,
                  }}
                >
                  {liveCall ? "Call in progress — updating…" : "Ready to handle the next appointment"}
                </div>

                <div
                  style={{
                    width: "100%",
                    background: callStatus === "connecting" ? C.amberLight : C.accentLight,
                    border: `1px dashed ${callStatus === "connecting" ? C.amber : C.accentMid}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    textAlign: "center",
                    transition: "background .3s",
                  }}
                >
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: callStatus === "connecting" ? C.amber : C.accent }}
                  >
                    {callStatus === "connecting" ? "Connecting to agent…" : t("tapCall")}
                  </div>
                  <div style={{ fontSize: 11, color: C.accentMid, marginTop: 3 }}>{t("anyLang")} — tap call button</div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      style={{
                        background: C.surfaceAlt,
                        color: C.textMuted,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 99,
                        border: `1px solid ${C.borderFaint}`,
                      }}
                    >
                      {lang.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ padding: "0 20px 6px", borderTop: `1px solid ${C.borderFaint}` }}>
                {[
                  [t("business"), profile.businessName || "Greek Barber Festival"],
                  [t("hours"), profile.hours || "Tue–Sat · 10:00–20:00"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "9px 0",
                      borderBottom: `1px solid ${C.borderFaint}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: C.text,
                        fontWeight: 600,
                        textAlign: "right",
                        maxWidth: "58%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 20px 20px" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: C.textFaint,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {t("team")}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(barbers.length > 0 ? barbers : ["Nikos", "Giorgos", "Eleni", "Petros"]).map((b) => (
                    <span
                      key={b}
                      style={{
                        background: C.accentLight,
                        color: C.accent,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 12px",
                        borderRadius: 99,
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── LIVE ACTION FEED ── */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Feed header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${C.borderFaint}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  color: C.textFaint,
                  textTransform: "uppercase",
                }}
              >
                Live Action Feed
              </div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>Real calls · updates every 10s</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {liveCall && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: C.redLight,
                    padding: "4px 10px",
                    borderRadius: 99,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: C.red,
                      display: "inline-block",
                      animation: "gbf-pulse 0.8s infinite",
                    }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.red, letterSpacing: "0.06em" }}>LIVE</span>
                </div>
              )}
              {noAnswerCount > 0 && (
                <button
                  onClick={() => setHideNoAnswer((h) => !h)}
                  title={hideNoAnswer ? "Show no-answer calls" : "Hide no-answer calls"}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    padding: "4px 9px",
                    borderRadius: 6,
                    lineHeight: 1.4,
                    background: hideNoAnswer ? C.accentLight : C.borderFaint,
                    color: hideNoAnswer ? C.accent : C.textFaint,
                    transition: "background .15s, color .15s",
                  }}
                >
                  {hideNoAnswer ? `+ ${noAnswerCount} ${t("noAnswer")}` : `Hide ${noAnswerCount} ${t("noAnswer")}`}
                </button>
              )}
              <span style={{ fontSize: 11, color: C.textFaint }}>{feedEntries.length} calls</span>
            </div>
          </div>

          {/* Feed entries */}
          <div
            className="gbf-stagger gbf-feed-scroll"
            style={{
              overflowY: "auto",
              minHeight: 200,
              maxHeight: "min(640px, 55vh)",
              padding: "16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {feedEntries.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: C.accentLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Voicemail size={26} style={{ color: C.accent }} strokeWidth={1.5} />
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>No calls yet</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
                  Use the call button (bottom-right) to make a call.
                  <br />
                  It will appear here in real time.
                </div>
              </div>
            ) : (
              feedEntries.map((entry) => {
                const isLiveEntry = entry.feedType === "LIVE";
                // Prefer the actual first client message; fall back to a cleaned-up summary snippet
                const rawFirst = entry.first_user_message?.trim() ?? "";
                const rawSummary = entry.summary
                  ? entry.summary
                      .replace(/^(The client|The caller|Client|Caller)\b[^.]*?\bcalled\b[^.]*?[.]/i, "")
                      .replace(/^[\s,\.]+/, "")
                      .trim()
                  : "";
                const quote = rawFirst
                  ? rawFirst.slice(0, 140) + (rawFirst.length > 140 ? "…" : "")
                  : rawSummary.slice(0, 120) + (rawSummary.length > 120 ? "…" : "");

                const tags: string[] = [];
                if (entry.services && entry.services.length > 1) {
                  tags.push(`${entry.services.length} services`);
                  const uniqueBarbers = [...new Set(entry.services.map((s: ServiceLine) => s.barber).filter(Boolean))];
                  uniqueBarbers.forEach((b: string) => {
                    if (b && b !== "TBD") tags.push(b);
                  });
                } else {
                  if (entry.service && entry.service !== "—") tags.push(entry.service);
                  if (entry.barber && entry.barber !== "TBD") tags.push(entry.barber);
                }
                if (entry.date) tags.push(`${entry.date}${entry.time ? " · " + entry.time : ""}`);
                if (entry.price > 0) tags.push(`€${entry.price}`);

                return (
                  <div
                    key={entry.conversation_id}
                    className="gbf-feed-card"
                    onClick={() => {
                      navigator.vibrate?.(8);
                      onConvSelect(entry.conversation_id);
                    }}
                    title="Click to view full transcript in Ledger"
                    style={{
                      borderTop: `1px solid ${isLiveEntry ? entry.feedColor + "44" : C.borderFaint}`,
                      borderRight: `1px solid ${isLiveEntry ? entry.feedColor + "44" : C.borderFaint}`,
                      borderBottom: `1px solid ${isLiveEntry ? entry.feedColor + "44" : C.borderFaint}`,
                      borderLeft: `4px solid ${entry.feedColor}`,
                      borderRadius: 10,
                      background: C.surface,
                      overflow: "hidden",
                      boxShadow: isLiveEntry
                        ? `0 0 0 1px ${entry.feedColor}22, 0 4px 16px rgba(0,0,0,.07)`
                        : "0 1px 2px rgba(0,0,0,.03), 0 2px 8px rgba(0,0,0,.04)",
                      cursor: "pointer",
                      transition: "box-shadow .15s",
                    }}
                  >
                    {/* Header: badge + name + time */}
                    <div style={{ padding: "11px 14px 10px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: "0.12em",
                            color: entry.feedColor,
                            background: entry.feedBg,
                            border: `1px solid ${entry.feedColor}33`,
                            padding: "3px 8px",
                            borderRadius: 5,
                            textTransform: "uppercase" as const,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          {isLiveEntry && (
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: entry.feedColor,
                                display: "inline-block",
                                animation: "gbf-pulse 0.8s infinite",
                              }}
                            />
                          )}
                          {entry.feedType}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {entry.call_language &&
                            (() => {
                              const lc = LANG_BADGE_COLORS[entry.call_language] ?? LANG_BADGE_FALLBACK;
                              return (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: lc.color,
                                    background: lc.bg,
                                    border: `1px solid ${lc.border}`,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  {entry.call_language.toUpperCase()}
                                </span>
                              );
                            })()}
                          <span style={{ fontSize: 10, color: C.textFaint, fontVariantNumeric: "tabular-nums" }}>
                            {timeAgo(entry.start_time_unix_secs)}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: C.text,
                          lineHeight: 1.2,
                          letterSpacing: "-0.01em",
                          wordBreak: "break-word",
                        }}
                      >
                        {entry.client_name || "Unknown"}
                      </div>
                    </div>

                    {/* Quote — the actual client's words, prominent */}
                    {quote && (
                      <div style={{ padding: "0 14px 13px" }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: C.textMuted,
                            lineHeight: 1.6,
                            borderLeft: `3px solid ${entry.feedColor}`,
                            paddingLeft: 10,
                          }}
                        >
                          &ldquo;{quote}&rdquo;
                        </div>
                      </div>
                    )}

                    {/* Tags + duration */}
                    {(tags.length > 0 || entry.duration_secs > 0) && (
                      <div
                        style={{
                          padding: "8px 14px 11px",
                          borderTop: `1px solid ${C.borderFaint}`,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 5,
                          alignItems: "center",
                        }}
                      >
                        {tags.map((tag, i) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: i === 0 ? C.accent : C.textMuted,
                              background: i === 0 ? C.accentLight : C.borderFaint,
                              padding: "3px 9px",
                              borderRadius: 5,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {entry.duration_secs > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              color: C.textFaint,
                              marginLeft: "auto",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {fmtDuration(entry.duration_secs)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Feed footer */}
          {feedEntries.length > 0 && (
            <div
              style={{
                borderTop: `1px solid ${C.borderFaint}`,
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 11, color: C.textFaint }}>{feedEntries.length} calls shown</span>
              <button
                onClick={() => onTabChange("ledger")}
                className="gbf-btn"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.accent,
                  background: C.accentLight,
                  border: `1px solid ${C.accentMid ?? C.accent}33`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "var(--gbf-font-sans)",
                  padding: "7px 14px",
                  letterSpacing: "-0.01em",
                  transition: "opacity .15s",
                }}
              >
                View full history in Ledger{" "}
                <ArrowRight
                  size={12}
                  strokeWidth={2}
                  style={{ display: "inline", verticalAlign: "middle", marginLeft: 2 }}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Services ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
        <div
          style={{
            fontFamily: "var(--gbf-font-display)",
            fontSize: 17,
            fontWeight: 600,
            color: C.text,
            marginBottom: 14,
          }}
        >
          {t("servicesTitle")}
        </div>
        <div className="gbf-services-grid gbf-stagger">
          {(
            [
              [t("svcHaircut"), "€15"],
              [t("svcBeard"), "€10"],
              [t("svcShave"), "€12"],
              [t("svcCombo"), "€22"],
              [t("svcKids"), "€10"],
              [t("svcStyling"), "€20"],
              [t("svcBrow"), "€5"],
            ] as [string, string][]
          ).map(([name, price]) => (
            <div
              key={name}
              className="gbf-lift-sm gbf-svc-item"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: C.surfaceAlt,
                borderRadius: 10,
                border: `1px solid ${C.borderFaint}`,
              }}
            >
              <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: 14, color: C.accent, fontWeight: 700, marginLeft: 8 }}>{price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Cancellation reasons ──────────────────────────────────────────────────────
const CANCEL_REASONS = [
  "Sickness / Illness",
  "Cancelled by client",
  "Error while scheduling",
  "Double booking",
  "Barber unavailable",
  "Emergency",
  "No-show",
  "Shop closed / Holiday",
  "Weather conditions",
  "Other",
] as const;
type CancelEntry = { reason: string; note: string; cancelledAt: number };
interface CancelModal {
  ids: string[];
  mode: "single" | "all-today";
  label: string; // human-readable description shown in modal header
}

// ── Source catalogue ─────────────────────────────────────────────────────────
type SourceKey = "call" | "walk-in" | "website" | "manual";
const ALL_SOURCES: SourceKey[] = ["call", "walk-in", "website", "manual"];
const SOURCE_CONFIG: Record<SourceKey, { labelKey: string; icon: React.ReactNode; color: string }> = {
  call: { labelKey: "srcCall", icon: <PhoneCall size={13} strokeWidth={2} />, color: "#6C63FF" },
  "walk-in": { labelKey: "srcWalkIn", icon: <PersonStanding size={13} strokeWidth={2} />, color: "#22C55E" },
  website: { labelKey: "srcWebsite", icon: <Globe size={13} strokeWidth={2} />, color: "#F59E0B" },
  manual: { labelKey: "srcManual", icon: <ClipboardList size={13} strokeWidth={2} />, color: "#A78BFA" },
};

// ── LedgerTab ─────────────────────────────────────────────────────────────────
function LedgerTab({
  C,
  density,
  aiBookings,
  liveCall,
  selectedConvId,
  onConvSelected,
  businesses,
  isAllShops,
  currentBiz,
  onRefreshData,
}: {
  C: Colors;
  density: DensityKey;
  aiBookings: AiBooking[];
  liveCall: boolean;
  selectedConvId?: string | null;
  onConvSelected?: () => void;
  businesses?: { id: string; name: string }[];
  isAllShops?: boolean;
  currentBiz?: { id: string; name: string; plan?: string } | null;
  onRefreshData?: () => void;
}) {
  const t = useT();
  const tStatus = (s: string) => t(STATUS_I18N[s] ?? s);
  const statusLabel = (a: UnifiedEntry) => {
    if (a.status === "failed" && a.isAiCall) {
      if ((a.message_count ?? 0) === 0) return "No Answer";
      if ((a.message_count ?? 0) <= 1 && (a.duration_secs ?? 0) < 20) return "Dropped";
    }
    return tStatus(a.status);
  };
  const [filterDate, setFilterDate] = useState("all");
  const [filterBarber, setFilterBarber] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterShop, setFilterShop] = useState("all");
  const [openFilter, setOpenFilter] = useState<"date" | "barber" | "status" | "shop" | null>(null);
  const [hideNoAnswer, setHideNoAnswer] = useState(false);
  const [filterSources, setFilterSources] = useState<Set<SourceKey>>(new Set(ALL_SOURCES));

  // ── Sort state ─────────────────────────────────────────────────────────────
  type SortCol = "client" | "service" | "barber" | "datetime" | "price" | "status";
  const [sortCol, setSortCol] = useState<SortCol>("datetime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "datetime" || col === "price" ? "desc" : "asc");
    }
  }

  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);

  async function regenerateDemoData() {
    if (!currentBiz?.id || regenLoading) return;
    setRegenLoading(true);
    setRegenMsg(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setRegenMsg("Not signed in.");
        return;
      }
      const res = await fetch("/api/demo-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ business_id: currentBiz.id, shop_name: currentBiz.name, regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenMsg(data.error ?? "Failed.");
        return;
      }
      setRegenMsg(`Done — ${data.inserted?.appointments ?? 0} new entries`);
      onRefreshData?.();
    } catch {
      setRegenMsg("Error regenerating data.");
    } finally {
      setRegenLoading(false);
      setTimeout(() => setRegenMsg(null), 4000);
    }
  }

  // Unified scroll-to-center for both expand clicks and feed→ledger navigation.
  // Polls via rAF until the expanded detail is in the DOM, then scrolls.
  function scrollAndCenter(id: string, highlight = false) {
    let n = 0;
    function attempt() {
      const dtTrigger = document.getElementById(`dt-ledger-entry-${id}`) as HTMLElement | null;
      const mTrigger = document.getElementById(`m-ledger-entry-${id}`) as HTMLElement | null;
      // offsetParent is null for display:none elements — pick the visible one
      const trigger = mTrigger?.offsetParent ? mTrigger : dtTrigger?.offsetParent ? dtTrigger : null;
      if (!trigger) {
        if (n++ < 20) requestAnimationFrame(attempt);
        return;
      }

      const isMobile = trigger === mTrigger;
      const detailEl = document.getElementById(
        isMobile ? `m-ledger-detail-${id}` : `dt-ledger-detail-${id}`,
      ) as HTMLElement | null;
      // Wait for React to render the expanded content
      if (!detailEl) {
        if (n++ < 20) requestAnimationFrame(attempt);
        return;
      }

      if (isMobile) {
        // Wrapper already contains the full expanded block; browser handles centering natively
        trigger.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        // Desktop: measure from header-row top to detail-row bottom
        const top = trigger.getBoundingClientRect().top;
        const bottom = detailEl.getBoundingClientRect().bottom;
        const totalH = bottom - top;
        const pad = totalH < window.innerHeight ? (window.innerHeight - totalH) / 2 : 16;
        window.scrollTo({ top: Math.max(0, window.scrollY + top - pad), behavior: "smooth" });
      }

      if (highlight) {
        trigger.style.outline = `2.5px solid ${C.accent}`;
        trigger.style.outlineOffset = "2px";
        trigger.style.borderRadius = "14px";
        setTimeout(() => {
          trigger.style.outline = trigger.style.outlineOffset = trigger.style.borderRadius = "";
        }, 2500);
      }
    }
    requestAnimationFrame(attempt);
  }
  const [transcripts, setTranscripts] = useState<Record<string, ConversationDetail>>({});
  const [loadingCallId, setLoadingCallId] = useState<string | null>(null);
  const transcriptsRef = useRef(transcripts);
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);
  // Cancellation state — persisted to localStorage
  const [cancelled, setCancelled] = useState<Record<string, CancelEntry>>(() => {
    try {
      return JSON.parse(localStorage.getItem("gbf-cancelled") ?? "{}");
    } catch {
      return {};
    }
  });
  const [cancelModal, setCancelModal] = useState<CancelModal | null>(null);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelNote, setCancelNote] = useState("");
  const pad = DENSITY_PAD[density];

  function openCancelModal(modal: CancelModal) {
    setCancelReason(CANCEL_REASONS[0]);
    setCancelNote("");
    setCancelModal(modal);
  }

  function confirmCancel() {
    if (!cancelModal) return;
    const entry: CancelEntry = { reason: cancelReason, note: cancelNote.trim(), cancelledAt: Date.now() };
    const next = { ...cancelled };
    for (const id of cancelModal.ids) next[id] = entry;
    setCancelled(next);
    try {
      localStorage.setItem("gbf-cancelled", JSON.stringify(next));
    } catch {}
    setCancelModal(null);
  }

  // ── Fetch transcript (no toggle behaviour) ────────────────────────────────
  const fetchTranscript = useCallback(async (id: string, summary?: string, forceRefresh = false) => {
    if (!forceRefresh && transcriptsRef.current[id]) return;
    if (id.startsWith("demo_")) {
      setTranscripts((prev) => {
        const next = {
          ...prev,
          [id]: {
            conversation_id: id,
            status: "done",
            transcript: DEMO_TRANSCRIPTS[id] ?? [],
            metadata: { start_time_unix_secs: 0, call_duration_secs: 0 },
            analysis: { transcript_summary: summary ?? "" },
          },
        };
        const keys = Object.keys(next);
        if (keys.length > 20) delete next[keys[0]];
        return next;
      });
      return;
    }
    setLoadingCallId(id);
    try {
      const data: ConversationDetail = await fetch(`/api/elevenlabs/conversation/${id}`).then((r) => r.json());
      setTranscripts((prev) => {
        const next = { ...prev, [id]: data };
        const keys = Object.keys(next);
        if (keys.length > 20) delete next[keys[0]];
        return next;
      });
    } catch {
    } finally {
      setLoadingCallId(null);
    }
  }, []);

  // ── React whenever parent selects a conversation from the Hub feed ────────
  useEffect(() => {
    if (!selectedConvId) return;
    setExpandedCalls((prev) => new Set([...prev, selectedConvId]));
    fetchTranscript(selectedConvId);
    scrollAndCenter(selectedConvId, true);
    onConvSelected?.();
  }, [selectedConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll the live call's transcript every 2 s while the call is in progress ──
  const liveConvId = aiBookings.find((b) => b.call_status === "in-progress")?.conversation_id;
  useEffect(() => {
    if (!liveConvId) return;
    // Kick off immediately, then poll
    fetchTranscript(liveConvId, undefined, true);
    const iv = setInterval(() => {
      if (!document.hidden) fetchTranscript(liveConvId, undefined, true);
    }, 2_000);
    return () => clearInterval(iv);
  }, [liveConvId, fetchTranscript]);

  // ── User-click toggle: expand / collapse ─────────────────────────────────
  async function loadCallTranscript(id: string, summary?: string) {
    const willOpen = !expandedCalls.has(id);
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (willOpen) {
      scrollAndCenter(id);
      if (!transcriptsRef.current[id]) await fetchTranscript(id, summary);
    }
  }

  // ── Merge demo appointments + AI bookings ──────────────────────────────────
  interface UnifiedEntry {
    id: string;
    name: string;
    service: string;
    barber: string;
    date: string;
    time: string;
    price: number;
    status: string;
    source: SourceKey;
    isAiCall?: boolean; // true when original source was "ai-call" — drives badge + expand
    conversation_id?: string;
    summary?: string;
    start_time_unix_secs?: number;
    call_status?: string;
    message_count?: number;
    duration_secs?: number;
    business_id?: string;
    business_name?: string;
    services?: ServiceLine[];
    call_language?: string;
  }

  const demoEntries: UnifiedEntry[] = APPOINTMENTS.map((a) => ({
    ...a,
    id: String(a.id),
    source: "manual" as SourceKey,
  }));
  const aiEntries: UnifiedEntry[] = aiBookings.map((b) => ({
    id: b.conversation_id,
    name: b.client_name || "Unknown",
    service: b.service,
    barber: b.barber,
    services: b.services,
    date: b.date,
    time: b.time,
    price: b.price,
    status: b.status,
    // Both "ai-call" and "human-call" map to the unified "call" filter key;
    // isAiCall preserves the distinction for the AI badge and transcript expand.
    source: (b.source === "walk-in"
      ? "walk-in"
      : b.source === "website"
        ? "website"
        : b.source === "manual"
          ? "manual"
          : "call") as SourceKey,
    isAiCall: b.source === "ai-call",
    conversation_id: b.conversation_id,
    summary: b.summary,
    start_time_unix_secs: b.start_time_unix_secs,
    call_status: b.call_status,
    message_count: b.message_count,
    duration_secs: b.duration_secs,
    business_id: b.business_id,
    business_name: b.business_name,
    call_language: b.call_language,
  }));

  // Combine — AI entries first (most recent first), then demo
  const aiSorted = [...aiEntries].sort((a, b) => (b.start_time_unix_secs ?? 0) - (a.start_time_unix_secs ?? 0));
  const allEntries: UnifiedEntry[] = [...aiSorted, ...demoEntries];

  // Dates for filter: combine both sources
  const dates = Array.from(new Set(allEntries.map((a) => a.date)));

  // Apply local cancellations on top of server status
  const allEntriesWithLocal = allEntries.map((a) => (cancelled[a.id] ? { ...a, status: "cancelled" } : a));

  const isNoAnswer = (a: UnifiedEntry) =>
    a.isAiCall === true && (a.status === "failed" || (a.message_count ?? 0) === 0) && (a.service === "—" || !a.service);
  const noAnswerCount = allEntriesWithLocal.filter(isNoAnswer).length;
  const filtered = allEntriesWithLocal.filter(
    (a) =>
      filterSources.has(a.source) &&
      (filterDate === "all" || a.date === filterDate) &&
      (filterBarber === "all" || a.barber === filterBarber || a.services?.some((s) => s.barber === filterBarber)) &&
      (filterStatus === "all" || a.status === filterStatus) &&
      (filterShop === "all" || a.business_id === filterShop) &&
      !(hideNoAnswer && isNoAnswer(a)),
  );
  // ── Sort filtered entries ────────────────────────────────────────────────
  const STATUS_ORDER: Record<string, number> = { confirmed: 0, "in-progress": 1, pending: 2, cancelled: 3, failed: 4 };

  // Chronological key from date (dd/mm) + time (hh:mm) — used when start_time_unix_secs is missing
  function dateTimeKey(d: string, t: string): number {
    const [dd, mm] = (d || "00/00").split("/").map(Number);
    const [hh, mi] = (t || "00:00").split(":").map(Number);
    // mm*100_0000 + dd*10000 + hh*100 + mi  gives a monotonic key
    return (mm || 0) * 1_000_000 + (dd || 0) * 10_000 + (hh || 0) * 100 + (mi || 0);
  }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "client":
        cmp = (a.name || "").localeCompare(b.name || "");
        break;
      case "service":
        cmp = (a.service || "").localeCompare(b.service || "");
        break;
      case "barber":
        cmp = (a.barber || "").localeCompare(b.barber || "");
        break;
      case "datetime":
        // Prefer unix timestamp (precise); fall back to parsed date/time string
        cmp =
          (a.start_time_unix_secs ?? dateTimeKey(a.date, a.time)) -
          (b.start_time_unix_secs ?? dateTimeKey(b.date, b.time));
        break;
      case "price":
        cmp = a.price - b.price;
        break;
      case "status":
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // "active" = confirmed/pending bookings only — excludes cancelled, failed, and no-answer calls
  const active = filtered.filter((a) => a.status !== "cancelled" && a.status !== "failed" && a.call_status !== "error");
  const revenue = active.reduce((s, a) => s + a.price, 0);
  const fillPct = Math.min(100, Math.round((active.filter((a) => a.date === d0).length / 20) * 100));

  // Today's non-cancelled entries (for "cancel all today" action)
  const todayActive = allEntriesWithLocal.filter(
    (a) => a.date === d0 && a.status !== "cancelled" && a.status !== "failed" && a.call_status !== "error",
  );

  // Derive barbers from actual entries (deduplicated)
  const availableBarbers = Array.from(
    new Set(
      allEntriesWithLocal.flatMap(
        (a) => a.services?.map((s) => s.barber).filter(Boolean) ?? (a.barber && a.barber !== "TBD" ? [a.barber] : []),
      ),
    ),
  ).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: pad.gap }}>
      {/* ── Cancellation modal — rendered via portal so fixed positioning is always viewport-relative ── */}
      {cancelModal &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              onClick={() => setCancelModal(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.55)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                zIndex: 2000,
              }}
            />
            {/* Dialog — centered on desktop, bottom sheet on mobile via .gbf-cancel-modal */}
            <div
              className="gbf-cancel-modal"
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                boxShadow: "0 24px 80px rgba(0,0,0,.45)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Mobile drag handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
                <div
                  className="gbf-settings-handle"
                  style={{ width: 36, height: 4, borderRadius: 99, background: C.border }}
                />
              </div>
              {/* Header — sticky so title stays visible when body scrolls */}
              <div
                style={{
                  padding: "16px 20px 14px",
                  borderBottom: `1px solid ${C.border}`,
                  background: C.surfaceAlt,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
                      {cancelModal.mode === "all-today" ? t("cancelAllToday") : t("cancelAppt")}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, wordBreak: "break-word" }}>
                      {cancelModal.label}
                    </div>
                  </div>
                  <button
                    onClick={() => setCancelModal(null)}
                    className="gbf-btn gbf-icon-btn"
                    style={{
                      background: C.borderFaint,
                      border: "none",
                      borderRadius: 99,
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: C.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              {/* Body — scrollable if content overflows on small screens */}
              <div style={{ padding: "20px 20px 8px", overflowY: "auto", flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textFaint,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                  }}
                >
                  {t("cancelReason")}
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 14,
                    color: C.text,
                    background: C.surfaceAlt,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 10,
                    padding: "11px 12px",
                    fontFamily: "inherit",
                    outline: "none",
                    cursor: "pointer",
                    marginBottom: 16,
                    minHeight: 44,
                  }}
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textFaint,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                  }}
                >
                  {cancelReason === "Other" ? "Describe the reason" : "Additional note"}{" "}
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder={cancelReason === "Other" ? "Tell us what happened…" : "Any extra context…"}
                  rows={cancelReason === "Other" ? 4 : 3}
                  style={{
                    width: "100%",
                    fontSize: 14,
                    color: C.text,
                    background: C.surfaceAlt,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 10,
                    padding: "11px 12px",
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {/* Footer — sticky at bottom, full-width buttons on mobile */}
              <div
                style={{
                  padding: "12px 20px 16px",
                  borderTop: `1px solid ${C.border}`,
                  display: "flex",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setCancelModal(null)}
                  className="gbf-btn"
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${C.border}`,
                    background: "transparent",
                    color: C.textMuted,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 48,
                  }}
                >
                  {t("keepAppt")}
                </button>
                <button
                  onClick={confirmCancel}
                  className="gbf-btn"
                  style={{
                    flex: 2,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: C.red,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 48,
                  }}
                >
                  {cancelModal.mode === "all-today"
                    ? `Cancel ${cancelModal.ids.length} appointment${cancelModal.ids.length !== 1 ? "s" : ""}`
                    : "Cancel appointment"}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* Live call alert in ledger */}
      {liveCall && (
        <div
          style={{
            background: C.amberLight,
            border: `1px solid ${C.amber}55`,
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.amber,
              display: "inline-block",
              animation: "gbf-pulse 1s infinite",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{t("liveAICall")}</span>
            <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{t("liveAICallSub")}</span>
          </div>
        </div>
      )}

      <div className="gbf-stat-grid gbf-stagger">
        <StatCard value={`${fillPct}%`} label={t("occupancy")} sub={t("todaySlots")} C={C} density={density} />
        <StatCard
          value={new Set(active.map((a) => a.name)).size}
          label={t("clients")}
          sub={t("inView")}
          C={C}
          density={density}
        />
        <StatCard value={`€${revenue}`} label={t("revenue")} sub={t("confirmedOnly")} C={C} density={density} />
        <StatCard
          value={active.length}
          label={t("appointments")}
          sub={`${active.filter((a) => a.isAiCall).length} AI · ${active.filter((a) => a.source === "walk-in").length} walk-in · ${active.filter((a) => a.source === "manual").length} manual`}
          C={C}
          density={density}
        />
      </div>

      {/* View toggle + filters */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
        {/* View mode pills */}
        {/* Source filter — icon + checkbox per type + Select All */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textFaint,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {t("srcSource")}
            </span>
            <button
              onClick={() =>
                setFilterSources(filterSources.size === ALL_SOURCES.length ? new Set() : new Set(ALL_SOURCES))
              }
              className="gbf-btn"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textMuted,
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "3px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {filterSources.size === ALL_SOURCES.length ? t("deselectAll") : t("selectAll")}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_SOURCES.map((src) => {
              const cfg = SOURCE_CONFIG[src];
              const checked = filterSources.has(src);
              const count = allEntriesWithLocal.filter((a) => a.source === src).length;
              if (count === 0) return null;
              return (
                <button
                  key={src}
                  onClick={() => {
                    const next = new Set(filterSources);
                    if (checked) {
                      next.delete(src);
                    } else {
                      next.add(src);
                    }
                    setFilterSources(next);
                  }}
                  className="gbf-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 99,
                    border: `1.5px solid ${checked ? cfg.color + "99" : C.border}`,
                    background: checked ? cfg.color + "18" : C.surfaceAlt,
                    color: checked ? cfg.color : C.textMuted,
                    fontSize: 12,
                    fontWeight: checked ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all .15s",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: 14,
                      height: 14,
                      border: `1.5px solid ${checked ? cfg.color : C.border}`,
                      borderRadius: 4,
                      background: checked ? cfg.color : "transparent",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all .15s",
                    }}
                  >
                    {checked && <Check size={9} strokeWidth={3} style={{ color: "#fff" }} />}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {cfg.icon}
                    {t(cfg.labelKey)}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* ── Custom filter dropdowns ── */}
        {(() => {
          const anyActive =
            filterDate !== "all" ||
            filterBarber !== "all" ||
            filterStatus !== "all" ||
            filterShop !== "all" ||
            filterSources.size !== ALL_SOURCES.length;

          const filterBtn = (
            id: "date" | "barber" | "status" | "shop",
            label: string,
            value: string,
            options: [string, string][],
            onSelect: (v: string) => void,
          ) => {
            const isOpen = openFilter === id;
            const isActive = value !== "all";
            const display = options.find(([v]) => v === value)?.[1] ?? label;
            return (
              <div key={id} style={{ position: "relative" }}>
                <button
                  onClick={() => setOpenFilter(isOpen ? null : id)}
                  className="gbf-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    border: `1.5px solid ${isActive ? C.accent + "99" : C.border}`,
                    background: isActive ? C.accentLight : C.surfaceAlt,
                    color: isActive ? C.accent : C.textMuted,
                    transition: "all .15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>{display}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transition: "transform .15s",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      flexShrink: 0,
                    }}
                  />
                </button>
                {isOpen && (
                  <>
                    {createPortal(
                      <div onClick={() => setOpenFilter(null)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />,
                      document.body,
                    )}
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 151,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 12,
                        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
                        padding: 6,
                        minWidth: 180,
                        maxHeight: 280,
                        overflowY: "auto",
                      }}
                    >
                      {options.map(([v, l]) => {
                        const sel = v === value;
                        return (
                          <button
                            key={v}
                            onClick={() => {
                              onSelect(v);
                              setOpenFilter(null);
                            }}
                            className="gbf-btn"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "9px 12px",
                              borderRadius: 8,
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 13,
                              fontWeight: sel ? 700 : 400,
                              background: sel ? C.accentLight : "transparent",
                              color: sel ? C.accent : C.text,
                              transition: "background .1s",
                            }}
                          >
                            <span>{l}</span>
                            {sel && <Check size={13} strokeWidth={2.5} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          };

          const dateOptions: [string, string][] = [
            ["all", t("allDates")],
            ...dates.map((d) => [d, d] as [string, string]),
          ];
          const barberOptions: [string, string][] = [
            ["all", t("allBarbers")],
            ...availableBarbers.map((b) => [b, b] as [string, string]),
          ];
          const statusOptions: [string, string][] = [
            ["all", t("allStatuses")],
            ["confirmed", t("confirmed")],
            ["in-progress", t("inProgress")],
            ["pending", t("pending")],
            ["cancelled", t("cancelled")],
          ];
          const shopOptions: [string, string][] = [
            ["all", "All shops"],
            ...(businesses ?? []).map((b) => [b.id, b.name] as [string, string]),
          ];

          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {filterBtn("date", t("allDates"), filterDate, dateOptions, setFilterDate)}
              {filterBtn("barber", t("allBarbers"), filterBarber, barberOptions, setFilterBarber)}
              {filterBtn("status", t("allStatuses"), filterStatus, statusOptions, setFilterStatus)}
              {isAllShops &&
                businesses &&
                businesses.length > 1 &&
                filterBtn("shop", "All shops", filterShop, shopOptions, setFilterShop)}
              {anyActive && (
                <button
                  onClick={() => {
                    setFilterDate("all");
                    setFilterBarber("all");
                    setFilterStatus("all");
                    setFilterShop("all");
                    setFilterSources(new Set(ALL_SOURCES));
                  }}
                  className="gbf-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "7px 12px",
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: "transparent",
                    color: C.textMuted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all .15s",
                  }}
                >
                  <X size={11} /> {t("clearAll")}
                </button>
              )}
            </div>
          );
        })()}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              {filtered.length} {t("apptsShown")}{" "}
              {aiBookings.length > 0 && `· ${aiBookings.length} ${t("realAICalls")}`}
            </span>
            {noAnswerCount > 0 && (
              <button
                onClick={() => setHideNoAnswer((h) => !h)}
                title={hideNoAnswer ? "Show no-answer calls" : "Hide no-answer calls"}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  lineHeight: 1.4,
                  background: hideNoAnswer ? C.accentLight : C.borderFaint,
                  color: hideNoAnswer ? C.accent : C.textFaint,
                  transition: "background .15s, color .15s",
                }}
              >
                {hideNoAnswer ? `+ ${noAnswerCount} ${t("noAnswer")}` : `Hide ${noAnswerCount} ${t("noAnswer")}`}
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {todayActive.length > 0 && (
              <button
                onClick={() =>
                  openCancelModal({
                    ids: todayActive.map((a) => a.id),
                    mode: "all-today",
                    label: `${todayActive.length} appointment${todayActive.length !== 1 ? "s" : ""} on ${d0}`,
                  })
                }
                className="gbf-btn"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.red,
                  background: C.redLight,
                  border: `1px solid ${C.red}44`,
                  borderRadius: 8,
                  padding: "5px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <X size={11} /> {t("cancelAllBtn")} ({todayActive.length})
              </button>
            )}
            {currentBiz && (currentBiz.plan === "demo" || currentBiz.plan === "free") && (
              <button
                onClick={regenerateDemoData}
                disabled={regenLoading}
                className="gbf-btn"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.textMuted,
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "5px 12px",
                  cursor: regenLoading ? "default" : "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: regenLoading ? 0.6 : 1,
                  transition: "all .15s",
                }}
              >
                {regenLoading ? (
                  <Loader size={11} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <CornerUpLeft size={11} />
                )}
                {regenLoading ? t("regenerating") : t("regenerateDemo")}
              </button>
            )}
            {regenMsg && <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{regenMsg}</span>}
          </div>
        </div>
      </div>

      {/* ── Expand / Collapse all ── */}
      {(() => {
        const aiFiltered = filtered.filter((a) => a.isAiCall && a.conversation_id);
        const allExpanded = aiFiltered.length > 0 && aiFiltered.every((a) => expandedCalls.has(a.id));
        if (aiFiltered.length === 0) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {expandedCalls.size > 0 && (
              <button
                onClick={() => setExpandedCalls(new Set())}
                className="gbf-btn"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.textMuted,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all .15s",
                }}
              >
                <ChevronDown size={13} style={{ transform: "rotate(180deg)" }} /> {t("collapseAll")}
              </button>
            )}
            {!allExpanded && (
              <button
                onClick={async () => {
                  const toOpen = aiFiltered.filter((a) => !expandedCalls.has(a.id));
                  setExpandedCalls(new Set(aiFiltered.map((a) => a.id)));
                  for (const a of toOpen) fetchTranscript(a.conversation_id!, a.summary);
                }}
                className="gbf-btn"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.accent,
                  background: C.accentLight,
                  border: `1px solid ${C.accent}44`,
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all .15s",
                }}
              >
                <ChevronDown size={13} /> {t("expandAll")} ({aiFiltered.length})
              </button>
            )}
          </div>
        );
      })()}

      {/* Desktop table */}
      <div
        className="gbf-ledger-table"
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {(
                  [
                    { label: "", col: null },
                    { label: t("colClient"), col: "client" as SortCol },
                    { label: t("colService"), col: "service" as SortCol },
                    { label: t("colBarber"), col: "barber" as SortCol },
                    { label: t("colDate"), col: "datetime" as SortCol },
                    { label: t("colTime"), col: "datetime" as SortCol },
                    { label: t("colPrice"), col: "price" as SortCol },
                    { label: "", col: null },
                    { label: t("colStatus"), col: "status" as SortCol },
                  ] as { label: string; col: SortCol | null }[]
                ).map((h, i) => (
                  <th
                    key={i}
                    onClick={h.col ? () => toggleSort(h.col!) : undefined}
                    style={{
                      padding: "10px 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: sortCol === h.col ? C.accent : C.textFaint,
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      borderBottom: `1px solid ${C.border}`,
                      whiteSpace: "nowrap",
                      cursor: h.col ? "pointer" : "default",
                      userSelect: h.col ? "none" : undefined,
                      transition: "color .15s",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {h.label}
                      {h.col &&
                        (sortCol === h.col ? (
                          sortDir === "asc" ? (
                            <ChevronUp size={12} strokeWidth={2.5} />
                          ) : (
                            <ChevronDown size={12} strokeWidth={2.5} />
                          )
                        ) : (
                          <ArrowUpDown size={11} strokeWidth={2} style={{ opacity: 0.35 }} />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 14 }}>
                    {filterShop !== "all" ? t("noAICalls") : t("noEntriesMatch")}
                  </td>
                </tr>
              ) : (
                sorted.map((a, i) => {
                  const isAI = a.isAiCall === true;
                  const isLiveRow = a.call_status === "in-progress";
                  const isOpen = expandedCalls.has(a.id);
                  const detail = a.conversation_id ? transcripts[a.conversation_id] : undefined;
                  return (
                    <Fragment key={a.id}>
                      <tr
                        id={`dt-ledger-entry-${a.id}`}
                        className={`gbf-tr-hover${isAI ? " gbf-ai-row" : ""}`}
                        style={{
                          background: isLiveRow ? C.amberLight : i % 2 === 0 ? C.surface : C.surfaceAlt,
                          cursor: isAI ? "pointer" : "default",
                        }}
                        onClick={() =>
                          isAI && a.conversation_id ? loadCallTranscript(a.conversation_id, a.summary) : undefined
                        }
                      >
                        <td style={{ padding: pad.row, borderBottom: `1px solid ${C.borderFaint}`, width: 28 }}>
                          <span
                            title={t(SOURCE_CONFIG[a.source]?.labelKey ?? a.source)}
                            style={{
                              color: SOURCE_CONFIG[a.source]?.color ?? C.textFaint,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {SOURCE_CONFIG[a.source]?.icon}
                          </span>
                        </td>
                        <td style={{ padding: pad.row, borderBottom: `1px solid ${C.borderFaint}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{a.name}</span>
                            {a.call_language &&
                              (() => {
                                const lc = LANG_BADGE_COLORS[a.call_language] ?? LANG_BADGE_FALLBACK;
                                return (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 800,
                                      color: lc.color,
                                      background: lc.bg,
                                      border: `1px solid ${lc.border}`,
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                      letterSpacing: "0.06em",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {a.call_language.toUpperCase()}
                                  </span>
                                );
                              })()}
                          </div>
                          {isAI && a.start_time_unix_secs && (
                            <div style={{ fontSize: 10, color: C.textFaint }}>{timeAgo(a.start_time_unix_secs)}</div>
                          )}
                          {isAllShops && isAI && a.business_name && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: C.accent,
                                marginTop: 2,
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <Store size={9} /> {a.business_name}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: pad.row,
                            fontSize: 13,
                            color: C.textMuted,
                            borderBottom: `1px solid ${C.borderFaint}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.services && a.services.length > 1
                            ? a.services.map((s: ServiceLine) => s.service).join(" + ")
                            : a.service}
                        </td>
                        <td style={{ padding: pad.row, borderBottom: `1px solid ${C.borderFaint}` }}>
                          {a.services && a.services.length > 1 ? (
                            (() => {
                              const uniqueBarbers = [
                                ...new Set(a.services.map((s: ServiceLine) => s.barber).filter(Boolean)),
                              ];
                              return (
                                <span
                                  style={{
                                    background: C.accentLight,
                                    color: C.accent,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "3px 10px",
                                    borderRadius: 99,
                                  }}
                                >
                                  {uniqueBarbers.join(" · ") || a.barber}
                                </span>
                              );
                            })()
                          ) : (
                            <span
                              style={{
                                background: C.accentLight,
                                color: C.accent,
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "3px 10px",
                                borderRadius: 99,
                              }}
                            >
                              {a.barber}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: pad.row,
                            fontSize: 13,
                            color: C.text,
                            borderBottom: `1px solid ${C.borderFaint}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.date}
                        </td>
                        <td
                          style={{
                            padding: pad.row,
                            fontSize: 13,
                            color: C.text,
                            borderBottom: `1px solid ${C.borderFaint}`,
                          }}
                        >
                          {a.time}
                        </td>
                        <td
                          style={{
                            padding: pad.row,
                            fontSize: 13,
                            fontWeight: 700,
                            color: a.price > 0 ? C.accent : C.textFaint,
                            borderBottom: `1px solid ${C.borderFaint}`,
                          }}
                        >
                          {a.price > 0 ? `€${a.price}` : "—"}
                        </td>
                        <td style={{ padding: pad.row, borderBottom: `1px solid ${C.borderFaint}`, width: 32 }}>
                          {(a.isAiCall || a.source === "website") && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: "#6C63FF",
                                background: "#6C63FF18",
                                border: "1px solid #6C63FF44",
                                borderRadius: 4,
                                padding: "2px 5px",
                                letterSpacing: "0.04em",
                              }}
                            >
                              AI
                            </span>
                          )}
                        </td>
                        <td style={{ padding: pad.row, borderBottom: `1px solid ${C.borderFaint}`, minWidth: 160 }}>
                          <div
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <Badge status={a.status} label={statusLabel(a)} C={C} />
                              {cancelled[a.id] && (
                                <span
                                  title={`${cancelled[a.id].reason}${cancelled[a.id].note ? ` — ${cancelled[a.id].note}` : ""}`}
                                  style={{ fontSize: 10, color: C.textFaint, cursor: "help" }}
                                >
                                  ℹ
                                </span>
                              )}
                            </div>
                            {a.status !== "cancelled" && a.call_status !== "error" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCancelModal({
                                    ids: [a.id],
                                    mode: "single",
                                    label: `${a.name} · ${a.service} · ${a.date} ${a.time}`,
                                  });
                                }}
                                className="gbf-btn"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: C.red,
                                  background: "transparent",
                                  border: `1px solid ${C.red}55`,
                                  borderRadius: 6,
                                  padding: "5px 10px",
                                  minHeight: 28,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded transcript row */}
                      {isOpen && isAI && (
                        <tr key={`${a.id}-detail`} id={`dt-ledger-detail-${a.id}`}>
                          <td
                            colSpan={9}
                            style={{
                              background: C.surfaceAlt,
                              borderBottom: `1px solid ${C.border}`,
                              padding: "12px 20px",
                            }}
                          >
                            {loadingCallId === a.conversation_id ? (
                              <div style={{ display: "flex", gap: 10 }}>
                                <div className="gbf-skeleton" style={{ height: 12, width: "30%" }} />
                                <div className="gbf-skeleton" style={{ height: 12, width: "20%" }} />
                              </div>
                            ) : detail ? (
                              <div>
                                {/* Summary */}
                                {detail.analysis?.transcript_summary && (
                                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 700, color: C.accent }}>Summary: </span>
                                    {detail.analysis.transcript_summary}
                                  </div>
                                )}
                                {/* Messages */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    maxHeight: 240,
                                    overflowY: "auto",
                                  }}
                                >
                                  {(detail.transcript ?? []).map((msg, mi) => (
                                    <div key={msg.time_in_call_secs ?? mi} style={{ display: "flex", gap: 8 }}>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: msg.role === "agent" ? C.accent : C.textMuted,
                                          minWidth: 36,
                                          flexShrink: 0,
                                          paddingTop: 1,
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {msg.role === "agent" ? "AI" : "User"}
                                      </span>
                                      <span style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>
                                        {msg.message}
                                      </span>
                                    </div>
                                  ))}
                                  {(detail.transcript ?? []).length === 0 && (
                                    <span style={{ fontSize: 12, color: C.textFaint }}>No transcript yet.</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: C.red }}>Failed to load.</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="gbf-ledger-cards">
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: C.textMuted }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: C.surfaceAlt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Inbox size={24} style={{ color: C.textFaint }} strokeWidth={1.5} />
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t("noAppts")}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{t("adjustFilters")}</div>
          </div>
        ) : (
          sorted.map((a) => {
            const isAI = a.isAiCall === true;
            const isLiveRow = a.call_status === "in-progress";
            const isOpen = expandedCalls.has(a.id);
            const detail = a.conversation_id ? transcripts[a.conversation_id] : undefined;
            return (
              <div key={a.id} id={`m-ledger-entry-${a.id}`}>
                <div
                  className={`gbf-lift-sm${isAI ? " gbf-card-pressable" : ""}`}
                  onClick={() =>
                    isAI && a.conversation_id ? loadCallTranscript(a.conversation_id, a.summary) : undefined
                  }
                  style={{
                    background: isLiveRow ? C.amberLight : C.surface,
                    borderRadius: 14,
                    overflow: "hidden",
                    borderTop: `1px solid ${isLiveRow ? C.amber + "55" : C.border}`,
                    borderRight: `1px solid ${isLiveRow ? C.amber + "55" : C.border}`,
                    borderBottom: `1px solid ${isLiveRow ? C.amber + "55" : C.border}`,
                    borderLeft: `4px solid ${STATUS_BORDER[a.status] ?? C.border}`,
                    cursor: isAI ? "pointer" : "default",
                  }}
                >
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span
                            title={t(SOURCE_CONFIG[a.source]?.labelKey ?? a.source)}
                            style={{
                              color: SOURCE_CONFIG[a.source]?.color ?? C.textFaint,
                              display: "flex",
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            {SOURCE_CONFIG[a.source]?.icon}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
                            {a.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 7px",
                              borderRadius: 99,
                              fontWeight: 700,
                              background: (SOURCE_CONFIG[a.source]?.color ?? C.textFaint) + "18",
                              color: SOURCE_CONFIG[a.source]?.color ?? C.textFaint,
                            }}
                          >
                            {t(SOURCE_CONFIG[a.source]?.labelKey ?? a.source)}
                          </span>
                          {a.call_language &&
                            (() => {
                              const lc = LANG_BADGE_COLORS[a.call_language] ?? LANG_BADGE_FALLBACK;
                              return (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: lc.color,
                                    background: lc.bg,
                                    border: `1px solid ${lc.border}`,
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  {a.call_language.toUpperCase()}
                                </span>
                              );
                            })()}
                          {isLiveRow && (
                            <span
                              style={{
                                fontSize: 10,
                                background: C.redLight,
                                color: C.red,
                                padding: "2px 7px",
                                borderRadius: 99,
                                fontWeight: 800,
                                animation: "gbf-pulse 1s infinite",
                              }}
                            >
                              LIVE
                            </span>
                          )}
                        </div>
                        {a.services && a.services.length > 1 ? (
                          <div style={{ marginTop: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                            {a.services.map((s: ServiceLine, si: number) => (
                              <div key={si} style={{ fontSize: 12, color: C.textMuted }}>
                                {s.service}
                                {s.barber && s.barber !== "TBD" ? (
                                  <span style={{ color: C.textFaint }}> · {s.barber}</span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{a.service}</div>
                        )}
                        {isAI && a.start_time_unix_secs && (
                          <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
                            {timeAgo(a.start_time_unix_secs)}
                          </div>
                        )}
                        {isAllShops && isAI && a.business_name && (
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: C.accent,
                              marginTop: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Store size={9} /> {a.business_name}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: a.price > 0 ? C.accent : C.textFaint,
                            lineHeight: 1.1,
                          }}
                        >
                          {a.price > 0 ? `€${a.price}` : "—"}
                        </div>
                        {(a.isAiCall || a.source === "website") && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#6C63FF",
                              background: "#6C63FF18",
                              border: "1px solid #6C63FF44",
                              borderRadius: 4,
                              padding: "2px 6px",
                              letterSpacing: "0.04em",
                            }}
                          >
                            AI
                          </span>
                        )}
                        {isAI && (
                          <span
                            style={{
                              fontSize: 11,
                              color: C.textFaint,
                              opacity: isOpen ? 1 : 0.5,
                              transition: "transform .2s",
                              transform: isOpen ? "rotate(180deg)" : "none",
                              display: "inline-block",
                            }}
                          >
                            ▾
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 10,
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {a.services && a.services.length > 1 ? (
                          (() => {
                            const uniqueBarbers = [
                              ...new Set(a.services.map((s: ServiceLine) => s.barber).filter(Boolean)),
                            ];
                            return (
                              <span
                                style={{
                                  background: C.accentLight,
                                  color: C.accent,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: "3px 10px",
                                  borderRadius: 99,
                                }}
                              >
                                {uniqueBarbers.join(" · ") || a.barber}
                              </span>
                            );
                          })()
                        ) : (
                          <span
                            style={{
                              background: C.accentLight,
                              color: C.accent,
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "3px 10px",
                              borderRadius: 99,
                            }}
                          >
                            {a.barber}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: C.textMuted }}>
                          {a.date} · {a.time}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          flexShrink: 0,
                          minWidth: 140,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Badge status={a.status} label={statusLabel(a)} C={C} />
                          {cancelled[a.id] && (
                            <span
                              title={`${cancelled[a.id].reason}${cancelled[a.id].note ? ` — ${cancelled[a.id].note}` : ""}`}
                              style={{ fontSize: 11, color: C.textFaint, cursor: "help" }}
                            >
                              ℹ
                            </span>
                          )}
                        </div>
                        {a.status !== "cancelled" && a.call_status !== "error" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCancelModal({
                                ids: [a.id],
                                mode: "single",
                                label: `${a.name} · ${a.service} · ${a.date} ${a.time}`,
                              });
                            }}
                            className="gbf-btn"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.red,
                              background: C.redLight,
                              border: `1px solid ${C.red}44`,
                              borderRadius: 8,
                              padding: "8px 14px",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              minHeight: 44,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <X size={11} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    {isAI && !isOpen && (
                      <div
                        style={{
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: `1px solid ${C.borderFaint}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, color: C.textFaint }}>Tap to view transcript</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Mobile transcript expansion */}
                {isOpen && isAI && (
                  <div
                    id={`m-ledger-detail-${a.id}`}
                    className="gbf-card-in"
                    style={{
                      background: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      borderTop: "none",
                      borderRadius: "0 0 16px 16px",
                      padding: "14px 16px",
                    }}
                  >
                    {loadingCallId === a.conversation_id ? (
                      <div className="gbf-skeleton" style={{ height: 12, width: "60%" }} />
                    ) : detail ? (
                      <div>
                        {/* Summary */}
                        {detail.analysis?.transcript_summary && (
                          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, color: C.accent }}>Summary: </span>
                            {detail.analysis.transcript_summary}
                          </div>
                        )}
                        {/* Messages */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          {(detail.transcript ?? []).map((msg, mi) => (
                            <div key={msg.time_in_call_secs ?? mi} style={{ display: "flex", gap: 8 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: msg.role === "agent" ? C.accent : C.textMuted,
                                  minWidth: 32,
                                  flexShrink: 0,
                                  textTransform: "uppercase",
                                }}
                              >
                                {msg.role === "agent" ? "AI" : "You"}
                              </span>
                              <span style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>{msg.message}</span>
                            </div>
                          ))}
                          {(detail.transcript ?? []).length === 0 && (
                            <span style={{ fontSize: 12, color: C.textFaint }}>No transcript yet.</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: C.red }}>Failed to load.</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── RecentCallsSection ────────────────────────────────────────────────────────
function RecentCallsSection({
  conversations,
  liveCall,
  C,
  density,
}: {
  conversations: ConversationSummary[];
  liveCall: boolean;
  C: Colors;
  density: DensityKey;
}) {
  const pad = DENSITY_PAD[density];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, ConversationDetail>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const recent = conversations.slice(0, 15);

  async function loadTranscript(id: string) {
    if (transcripts[id]) {
      setExpandedId(expandedId === id ? null : id);
      return;
    }
    setLoadingId(id);
    setExpandedId(id);
    try {
      const data: ConversationDetail = await fetch(`/api/elevenlabs/conversation/${id}`).then((r) => r.json());
      setTranscripts((prev) => {
        const next = { ...prev, [id]: data };
        const keys = Object.keys(next);
        if (keys.length > 20) delete next[keys[0]];
        return next;
      });
    } catch {
    } finally {
      setLoadingId(null);
    }
  }

  const statusColor = (s: string) => {
    if (s === "in-progress" || s === "processing") return C.amber;
    if (s === "done") return C.green;
    return C.red;
  };
  const statusLabel = (s: string) => {
    if (s === "in-progress") return "Live";
    if (s === "processing") return "Processing";
    if (s === "done") return "Done";
    return "Error";
  };

  if (recent.length === 0)
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
        <div
          style={{
            fontFamily: "var(--gbf-font-display)",
            fontSize: 17,
            fontWeight: 600,
            color: C.text,
            marginBottom: 6,
          }}
        >
          Recent AI Calls
        </div>
        <div style={{ fontSize: 13, color: C.textMuted }}>No calls recorded yet. Try the widget below!</div>
      </div>
    );

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--gbf-font-display)", fontSize: 17, fontWeight: 600, color: C.text }}>
            Recent AI Calls
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            Live from ElevenLabs · click to view transcript
          </div>
        </div>
        {liveCall && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: C.redLight,
              padding: "6px 14px",
              borderRadius: 99,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: C.red,
                display: "inline-block",
                animation: "gbf-pulse 1s infinite",
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>Call in progress</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recent.map((conv) => {
          const isLive = conv.status === "in-progress";
          const isOpen = expandedId === conv.conversation_id;
          const detail = transcripts[conv.conversation_id];
          const isLoading = loadingId === conv.conversation_id;

          return (
            <div
              key={conv.conversation_id}
              className="gbf-conv-item"
              style={{
                border: `1px solid ${isLive ? C.amber + "88" : C.borderFaint}`,
                borderRadius: 12,
                overflow: "hidden",
                background: isLive ? C.amberLight : C.surfaceAlt,
              }}
            >
              {/* Row header */}
              <button
                onClick={() => loadTranscript(conv.conversation_id)}
                className="gbf-btn"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: statusColor(conv.status),
                    flexShrink: 0,
                    animation: isLive ? "gbf-pulse 1s infinite" : "none",
                  }}
                />
                {/* Time */}
                <span
                  className="gbf-recent-time"
                  style={{ fontSize: 12, color: C.textMuted, minWidth: 70, flexShrink: 0 }}
                >
                  {timeAgo(conv.start_time_unix_secs)}
                </span>
                {/* Status badge */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: statusColor(conv.status),
                    background: statusColor(conv.status) + "22",
                    padding: "3px 9px",
                    borderRadius: 99,
                    flexShrink: 0,
                  }}
                >
                  {statusLabel(conv.status)}
                </span>
                {/* Duration */}
                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: "auto", flexShrink: 0 }}>
                  {fmtDuration(conv.call_duration_secs)}
                </span>
                {/* Msgs */}
                {conv.message_count > 0 && (
                  <span className="gbf-recent-msgs" style={{ fontSize: 11, color: C.textFaint, flexShrink: 0 }}>
                    {conv.message_count} msgs
                  </span>
                )}
                {/* Chevron */}
                <span
                  style={{
                    fontSize: 12,
                    color: C.textFaint,
                    flexShrink: 0,
                    transform: isOpen ? "rotate(180deg)" : "none",
                    transition: "transform .2s",
                  }}
                >
                  ▾
                </span>
              </button>

              {/* Expanded transcript */}
              {isOpen && (
                <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${C.borderFaint}` }}>
                  {isLoading ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 0" }}>
                      <div className="gbf-skeleton" style={{ height: 12, width: "40%" }} />
                      <div className="gbf-skeleton" style={{ height: 12, width: "30%" }} />
                    </div>
                  ) : detail ? (
                    <div>
                      {/* Summary */}
                      {detail.analysis?.transcript_summary && (
                        <div
                          style={{
                            fontSize: 12,
                            color: C.textMuted,
                            background: C.accentLight,
                            padding: "10px 12px",
                            borderRadius: 8,
                            marginTop: 12,
                            marginBottom: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: C.accent }}>Summary: </span>
                          {detail.analysis.transcript_summary}
                        </div>
                      )}
                      {/* Transcript messages */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          marginTop: 10,
                          maxHeight: 320,
                          overflowY: "auto",
                        }}
                      >
                        {(detail.transcript ?? []).map((msg) => {
                          const isAgent = msg.role === "agent";
                          return (
                            <div
                              key={msg.time_in_call_secs}
                              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: isAgent ? C.accent : C.textMuted,
                                  minWidth: 38,
                                  flexShrink: 0,
                                  paddingTop: 2,
                                  textTransform: "uppercase",
                                }}
                              >
                                {isAgent ? "AI" : "User"}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{msg.message}</span>
                                <span style={{ fontSize: 10, color: C.textFaint, marginLeft: 8 }}>
                                  {fmtDuration(msg.time_in_call_secs)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {(detail.transcript ?? []).length === 0 && (
                          <span style={{ fontSize: 12, color: C.textFaint }}>No transcript available yet.</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: C.red, padding: "10px 0", display: "block" }}>
                      Failed to load transcript.
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AnalyticsTab ──────────────────────────────────────────────────────────────
function AnalyticsTab({
  C,
  density,
  conversations,
  liveCall,
  businesses,
  currentBiz,
}: {
  C: Colors;
  density: DensityKey;
  conversations: ConversationSummary[];
  liveCall: boolean;
  businesses?: { id: string; name: string }[];
  currentBiz?: { id: string; name: string } | null;
}) {
  const t = useT();
  const pad = DENSITY_PAD[density];
  const isAllShopsAnalytics = currentBiz === null && (businesses?.length ?? 0) > 1;

  // KPIs — blend real conversation data with mock historical data
  const [nowSecs] = useState(() => Math.floor(Date.now() / 1000));
  const sevenDaysAgo = nowSecs - 7 * 86400;
  const real7d = conversations.filter((c) => c.start_time_unix_secs > sevenDaysAgo);
  const realCalls7d = real7d.length;
  const realFailed = real7d.filter((c) => c.status === "error").length;
  const realDone = realCalls7d - realFailed; // everything non-error = answered (matches bar chart green)
  const totalRevenue = REVENUE_TREND.reduce((s, d) => s + d.revenue, 0);
  const totalAppts = REVENUE_TREND.reduce((s, d) => s + d.appts, 0);
  // Build per-day call trend from real data when available
  const callTrend = (() => {
    if (realCalls7d === 0) return CALL_TREND;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets: Record<string, { successful: number; failed: number }> = {};
    // Seed last 7 days in order
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nowSecs * 1000 - i * 86400000);
      const label = dayNames[d.getDay()];
      buckets[label] = { successful: 0, failed: 0 };
    }
    for (const c of real7d) {
      const d = new Date(c.start_time_unix_secs * 1000);
      const label = dayNames[d.getDay()];
      if (!buckets[label]) buckets[label] = { successful: 0, failed: 0 };
      if (c.status === "error") buckets[label].failed++;
      else buckets[label].successful++;
    }
    return Object.entries(buckets).map(([label, v]) => ({ label, ...v }));
  })();
  const successCalls = realCalls7d > 0 ? realDone : callTrend.reduce((s, d) => s + d.successful, 0);
  const failedCalls = realCalls7d > 0 ? realFailed : callTrend.reduce((s, d) => s + d.failed, 0);
  const totalCalls = successCalls + failedCalls;
  const successRate = Math.min(100, Math.round((successCalls / Math.max(totalCalls, 1)) * 100));
  const avgTicket = totalAppts > 0 ? (totalRevenue / totalAppts).toFixed(2) : "0";
  const totalBarberRev = BARBER_STATS.reduce((s, b) => s + b.revenue, 0);
  const maxCallsDay = Math.max(...callTrend.map((d) => d.successful + d.failed), 1);
  const maxSvcCount = Math.max(...SERVICE_STATS.map((s) => s.count));

  // Revenue SVG chart
  const maxRev = Math.max(...REVENUE_TREND.map((d) => d.revenue), 1);
  const W = 600,
    H = 100,
    padX = 8,
    padY = 10;
  const pts = REVENUE_TREND.map((d, i) => ({
    x: padX + (i / (REVENUE_TREND.length - 1)) * (W - padX * 2),
    y: padY + (1 - d.revenue / maxRev) * (H - padY * 2),
    ...d,
  }));
  const linePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = [
    `${pts[0].x.toFixed(1)},${H}`,
    ...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1].x.toFixed(1)},${H}`,
  ].join(" ");
  const labelIdxs = [0, 3, 6, 9, 13];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: pad.gap }}>
      {/* ── All-shops analytics banner ── */}
      {isAllShopsAnalytics && businesses && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 12,
            background: C.accentLight,
            border: `1px solid ${C.accent}33`,
          }}
        >
          <BarChart3 size={14} style={{ color: C.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Aggregated analytics</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            — across {businesses.length} barbershops. Full per-shop breakdown coming soon.
          </span>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="gbf-stat-grid gbf-stagger">
        <StatCard
          value={`€${totalRevenue.toLocaleString()}`}
          label={t("aMonthRevenue")}
          sub={t("aLast14d")}
          C={C}
          density={density}
        />
        <StatCard
          value={`${successRate}%`}
          label={t("aCallSuccessRate")}
          sub={`${successCalls} ${t("aOkLabel")} · ${failedCalls} ${t("aMissedShort")}`}
          C={C}
          density={density}
        />
        <StatCard
          value={totalCalls}
          label={t("aAICallsWeek")}
          sub={`${failedCalls} ${t("aUnanswered")}`}
          C={C}
          density={density}
        />
        <StatCard value={`€${avgTicket}`} label={t("aAvgTicket")} sub={t("aPerAppt")} C={C} density={density} />
      </div>

      {/* ── Revenue Trend ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--gbf-font-display)", fontSize: 17, fontWeight: 600, color: C.text }}>
              {t("aRevenueTrend")}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t("aDailyEarnings")}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, lineHeight: 1 }}>
              €{totalRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {totalAppts} {t("aAppointments")}
            </div>
          </div>
        </div>
        {/* Area Chart */}
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ display: "block", height: 110, borderRadius: 10 }}
        >
          <defs>
            <linearGradient id="gbf-rev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={C.accent} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid */}
          {[0, 33, 66, 100].map((pct) => {
            const y = padY + (pct / 100) * (H - padY * 2);
            return <line key={pct} x1={padX} y1={y} x2={W - padX} y2={y} stroke={C.borderFaint} strokeWidth="0.8" />;
          })}
          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#gbf-rev-grad)" />
          {/* Line */}
          <polyline
            points={linePoints}
            fill="none"
            stroke={C.accent}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Dots on non-zero days */}
          {pts
            .filter((p) => p.revenue > 0)
            .map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={C.accent} />
            ))}
          {/* Zero-day markers */}
          {pts
            .filter((p) => p.revenue === 0)
            .map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="none" stroke={C.border} strokeWidth="1.5" />
            ))}
        </svg>
        {/* X-axis labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {labelIdxs.map((i) => (
            <span key={i} style={{ fontSize: 10, color: C.textFaint }}>
              {REVENUE_TREND[i].label}
            </span>
          ))}
        </div>
        {/* Zero = closed indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${C.borderFaint}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: `1.5px solid ${C.border}`,
                background: "transparent",
              }}
            />
            <span style={{ fontSize: 11, color: C.textFaint }}>{t("aClosedDay")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent }} />
            <span style={{ fontSize: 11, color: C.textFaint }}>{t("aRevRecorded")}</span>
          </div>
        </div>
      </div>

      {/* ── Two-col row: Calls + Services ── */}
      <div className="gbf-hub-grid">
        {/* AI Calls Chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--gbf-font-display)", fontSize: 17, fontWeight: 600, color: C.text }}>
              {t("aAICalls")}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t("aCallsSubtitle")}</div>
          </div>
          <div className="gbf-bar-group" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {callTrend.map((day) => {
              const total = day.successful + day.failed;
              const sPct = total > 0 ? (day.successful / maxCallsDay) * 100 : 0;
              const fPct = total > 0 ? (day.failed / maxCallsDay) * 100 : 0;
              return (
                <div key={day.label} className="gbf-bar-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    className="gbf-bar-label"
                    style={{ fontSize: 12, color: C.textMuted, width: 30, flexShrink: 0 }}
                  >
                    {day.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      height: 22,
                      borderRadius: 6,
                      overflow: "hidden",
                      background: C.borderFaint,
                    }}
                  >
                    <div
                      style={{
                        width: `${sPct}%`,
                        background: C.green,
                        transition: "width .4s",
                        borderRadius: fPct > 0 ? "6px 0 0 6px" : 6,
                      }}
                    />
                    <div
                      style={{
                        width: `${fPct}%`,
                        background: C.red,
                        transition: "width .4s",
                        borderRadius: sPct > 0 ? "0 6px 6px 0" : 6,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: total === 0 ? C.textFaint : C.text,
                      fontWeight: 600,
                      width: 22,
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {total}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Totals + legend */}
          <div
            style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.borderFaint}` }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: C.green, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>
                {t("aAnswered")} ({successCalls})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: C.red, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>
                {t("aMissed")} ({failedCalls})
              </span>
            </div>
          </div>
          {/* Success rate pill */}
          <div
            style={{
              marginTop: 10,
              background: C.greenLight,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{t("aSuccessRate")}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{successRate}%</span>
          </div>
        </div>

        {/* Service Breakdown */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--gbf-font-display)", fontSize: 17, fontWeight: 600, color: C.text }}>
              {t("aSvcBreakdown")}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t("aSvcSubtitle")}</div>
          </div>
          <div className="gbf-bar-group" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SERVICE_STATS.map((svc, i) => (
              <div key={svc.name} className="gbf-bar-row">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i === 0 && <Trophy size={13} style={{ color: C.accent, flexShrink: 0 }} />}
                    <span
                      className="gbf-bar-label"
                      style={{ fontSize: 13, color: C.text, fontWeight: i < 3 ? 600 : 400 }}
                    >
                      {svc.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: C.textFaint }}>{svc.count}×</span>
                    <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>€{svc.revenue}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: C.borderFaint, borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(svc.count / maxSvcCount) * 100}%`,
                      background: i === 0 ? C.accent : C.accentMid,
                      borderRadius: 99,
                      opacity: i === 0 ? 1 : 0.6 + i * 0.04 * -1 + 0.3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Total */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${C.borderFaint}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 13, color: C.textMuted }}>{t("aTotalServices")}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>
              €{SERVICE_STATS.reduce((s, v) => s + v.revenue, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Barber Performance ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--gbf-font-display)", fontSize: 17, fontWeight: 600, color: C.text }}>
              {t("aBarberPerf")}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t("aBarberSubtitle")}</div>
          </div>
          <span
            style={{
              fontSize: 11,
              color: C.textFaint,
              background: C.surfaceAlt,
              padding: "4px 10px",
              borderRadius: 99,
              border: `1px solid ${C.borderFaint}`,
            }}
          >
            {t("aMonthOf")}
          </span>
        </div>
        <div className="gbf-stat-grid gbf-stagger">
          {BARBER_STATS.map((barber, rank) => (
            <div
              key={barber.name}
              className="gbf-lift"
              style={{
                background: C.surfaceAlt,
                borderRadius: 14,
                padding: "18px 16px",
                border: `1.5px solid ${rank === 0 ? barber.color + "55" : C.borderFaint}`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Rank badge */}
              {rank < 3 && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 12,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    background: [C.accent, C.textMuted, C.textFaint][rank] + "33",
                    color: [C.accent, C.textMuted, C.textFaint][rank],
                  }}
                >
                  #{rank + 1}
                </div>
              )}
              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: barber.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    flexShrink: 0,
                    boxShadow: `0 2px 8px ${barber.color}55`,
                  }}
                >
                  {barber.name[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{barber.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    #{rank + 1} {t("aRanked")}
                  </div>
                </div>
              </div>
              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  [t("revenue"), `€${barber.revenue.toLocaleString()}`, C.accent],
                  [t("clients"), String(barber.clients), C.text],
                  [t("appointments"), String(barber.appts), C.text],
                  [t("aAvgTicket"), `€${barber.avgTicket}`, C.text],
                ].map(([label, val, color]) => (
                  <div key={label as string} style={{ background: C.surface, borderRadius: 8, padding: "8px 10px" }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.textFaint,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: color as string }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* Top service */}
              <span
                style={{
                  fontSize: 11,
                  background: C.accentLight,
                  color: C.accent,
                  padding: "4px 10px",
                  borderRadius: 99,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles size={10} /> {barber.topService}
              </span>
              {/* Utilization */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: C.textFaint }}>{t("aScheduleUtil")}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>{barber.utilization}%</span>
                </div>
                <div style={{ height: 5, background: C.borderFaint, borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${barber.utilization}%`,
                      background: barber.color,
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>
              {/* Revenue share */}
              <div style={{ marginTop: 8, fontSize: 11, color: C.textFaint }}>
                {Math.round((barber.revenue / Math.max(totalBarberRev, 1)) * 100)}% {t("aTeamRevenue")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent AI Calls (live from ElevenLabs) ── */}
      <RecentCallsSection conversations={conversations} liveCall={liveCall} C={C} density={density} />

      {/* ── Peak Hours Heatmap ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: pad.card }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--gbf-font-display)", fontSize: 17, fontWeight: 600, color: C.text }}>
            {t("aPeakHours")}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t("aPeakSubtitle")}</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 340 }}>
            {/* Hour header */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8, marginLeft: 38 }}>
              {PEAK_HOURS_LABELS.map((h) => (
                <div
                  key={h}
                  style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.textFaint, fontWeight: 600 }}
                >
                  {h}:00
                </div>
              ))}
            </div>
            {/* Rows */}
            {PEAK_DAYS.map((day, di) => (
              <div key={day} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 5 }}>
                <span style={{ width: 34, fontSize: 11, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>
                  {day}
                </span>
                {PEAK_DATA[di].map((intensity, hi) => {
                  const opacities = [0, 0.15, 0.35, 0.6, 0.9];
                  return (
                    <div
                      key={hi}
                      className="gbf-heat-cell gbf-tip"
                      data-tip={`${day} ${PEAK_HOURS_LABELS[hi]}:00 — ${PEAK_LABELS[intensity]}`}
                      style={{
                        flex: 1,
                        height: 30,
                        background: intensity === 0 ? C.borderFaint : C.accent,
                        opacity: intensity === 0 ? 0.25 : opacities[intensity],
                      }}
                    />
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 10, color: C.textFaint }}>Quiet</span>
              {[0.15, 0.35, 0.6, 0.9].map((o, i) => (
                <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: C.accent, opacity: o }} />
              ))}
              <span style={{ fontSize: 10, color: C.textFaint }}>Peak</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE);
  const [langSettings, setLangSettings] = useState<LangSettings>(DEFAULT_LANG);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [C, setC] = useState<Colors>(PALETTES.cream.light);
  const [tab, setTab] = useState<"hub" | "ledger" | "analytics">("hub");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [liveCall, setLiveCall] = useState(false);
  const [aiBookings, setAiBookings] = useState<AiBooking[]>([]);
  const [manualBookings, setManualBookings] = useState<AiBooking[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active">("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<LiveMsg[]>([]);
  const [agentMode, setAgentMode] = useState<"idle" | "listening" | "speaking" | "thinking">("idle");
  const conversationRef = useRef<Conversation | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [businesses, setBusinesses] = useState<{ id: string; name: string; plan?: string }[]>([]);
  const [currentBiz, setCurrentBiz] = useState<{ id: string; name: string; plan?: string } | null>(null);
  // Single menu state — only one header dropdown open at a time
  type HeaderMenu = "biz" | "lang" | "credits" | null;
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const bizOpen = openMenu === "biz";
  const langOpen = openMenu === "lang";
  const creditsOpen = openMenu === "credits";
  const setBizOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const val = typeof v === "function" ? v(openMenu === "biz") : v;
    setOpenMenu(val ? "biz" : null);
  };
  const setLangOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const val = typeof v === "function" ? v(openMenu === "lang") : v;
    setOpenMenu(val ? "lang" : null);
  };
  const setCreditsOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const val = typeof v === "function" ? v(openMenu === "credits") : v;
    setOpenMenu(val ? "credits" : null);
  };
  const [walkinOpen, setWalkinOpen] = useState(false);
  const TOTAL_CREDITS = 10000; // 10,000 minutes (demo)
  const [addShopOpen, setAddShopOpen] = useState(false);

  // Close dropdowns on Escape
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [bizOpen, langOpen, creditsOpen]);

  // Scroll-to-top visibility
  useEffect(() => {
    const handler = () => setShowScrollTop(window.pageYOffset > 280);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Auth guard (Supabase) ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/dashboard/login");
        return;
      }
      const { data: profRaw } = await supabase.from("profiles").select("approved").eq("id", session.user.id).single();
      const prof = profRaw as { approved: boolean } | null;
      if (!prof?.approved) {
        router.replace("/dashboard/login?pending=1");
        return;
      }
      setUserEmail(session.user.email ?? "");
      setAuthReady(true);
    });
    // Listen for auth state changes (sign-out from another tab, token expiry)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/dashboard/login");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // ── Load persisted state ──
  useEffect(() => {
    if (!authReady) return;
    const s = loadSettings();
    const p = loadProfile();
    const l = loadLangSettings();
    setSettings(s);
    setProfile(p);
    setLangSettings(l);
    setTab("hub");
    setC(getColors(s));
  }, [authReady]);

  useEffect(() => {
    setC(getColors(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => setC(getColors(settings));
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("gbf-dashboard-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<BusinessProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("gbf-business-profile", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateLangSettings = useCallback((patch: Partial<LangSettings>) => {
    setLangSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("gbf-language-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string): string => {
      const { lang, translateUI, translateServices } = langSettings;
      if (lang === "en") return translate(key, "en");
      const isService = key.startsWith("svc") || key === "servicesTitle";
      if (isService) return translateServices ? translate(key, lang) : translate(key, "en");
      return translateUI ? translate(key, lang) : translate(key, "en");
    },
    [langSettings],
  );

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/dashboard/login");
  }, [router]);

  // ── Fetch businesses for shop switcher ──
  const loadBusinesses = useCallback(async () => {
    // Query directly via authenticated browser client — RLS ensures user sees only their businesses
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: members } = await supabase.from("business_members").select("business_id").eq("user_id", user.id);

    const ids = (members ?? []).map((m: { business_id: string }) => m.business_id);
    if (ids.length === 0) return;

    const { data: bizData } = await supabase.from("businesses").select("id, name, plan").in("id", ids);

    const list = (bizData ?? []) as { id: string; name: string; plan?: string }[];
    if (list.length > 0) {
      setBusinesses(list);
      setCurrentBiz((prev) => prev ?? list[0]);
    }
  }, []);

  const handleDeleteBiz = useCallback(
    async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      await sb.from("appointments").delete().eq("business_id", id);
      await sb.from("calls").delete().eq("business_id", id);
      await sb.from("agents").delete().eq("business_id", id);
      await sb.from("business_members").delete().eq("business_id", id);
      await sb.from("businesses").delete().eq("id", id);
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      setCurrentBiz((prev) => (prev?.id === id ? null : prev));
      await loadBusinesses();
    },
    [loadBusinesses],
  );

  useEffect(() => {
    if (!authReady) return;
    loadBusinesses();
  }, [authReady, loadBusinesses]);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Pass auth token so API routes can identify the user even when cookies are unreliable
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const [data, bookingsData, manualData] = await Promise.all([
        fetch("/api/elevenlabs").then((r) => (r.ok ? r.json() : { conversations: [], agent: null })),
        fetch(`/api/elevenlabs/bookings${currentBiz ? `?business_id=${currentBiz.id}` : ""}`, { headers: authHeaders })
          .then((r) => r.json())
          .catch(() => ({ bookings: [] })),
        currentBiz
          ? fetch(`/api/appointments?business_id=${currentBiz.id}`, { headers: authHeaders })
              .then((r) => (r.ok ? r.json() : { bookings: [] }))
              .catch(() => ({ bookings: [] }))
          : Promise.resolve({ bookings: [] }),
      ]);
      if (data.agent) setAgent(data.agent);
      const convs: ConversationSummary[] = data.conversations ?? [];
      setConversations(convs);
      setLiveCall(data.has_live_call ?? convs.some((c) => c.status === "in-progress"));
      // Enrich with business_name so the ledger can show per-shop badges
      const BAD_NAMES =
        /^(initiated|switching|attempted|disconnected|connected|transferred|forwarded|terminated|ended|started|continued|resumed|abandoned|dropped|client|caller|user|customer|unknown|today|yesterday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|tonight|εεε?|ε|ααα|λοιπόν|eee|aaa|erm|err|ehm)$/i;
      const real: AiBooking[] = (bookingsData.bookings ?? []).map((b: AiBooking) => ({
        ...b,
        client_name: BAD_NAMES.test(b.client_name.trim().replace(/[,;.!?]+$/, "")) ? "" : b.client_name,
        business_name: b.business_id
          ? (businesses.find((biz) => biz.id === b.business_id)?.name ?? currentBiz?.name ?? "Unknown shop")
          : currentBiz?.name,
      }));
      // Keep demo bookings as baseline, prepend any real calls on top
      const isDemoBiz = !currentBiz || currentBiz.id === "00000000-0000-0000-0000-000000000001";
      const realOnly = real.filter((b) => !b.conversation_id.startsWith("demo_"));
      if (isDemoBiz) {
        setAiBookings([...realOnly, ...DEMO_AI_BOOKINGS]);
      } else {
        setAiBookings(real);
      }
      setManualBookings(manualData.bookings ?? []);
    } catch {
      /* swallow — UI stays stale */
    } finally {
      setLoading(false);
    }
  }, [currentBiz, businesses]);

  // Track state transitions so we can trigger a full refresh when a live call ends
  const prevLiveCallRef = useRef<boolean>(false);
  const prevConvCountRef = useRef<number>(0);

  // Lightweight live-status check — only ElevenLabs call feed, no bookings
  const fetchLiveStatus = useCallback(async () => {
    try {
      const data = await fetch("/api/elevenlabs").then((r) => (r.ok ? r.json() : { conversations: [], agent: null }));
      if (data.agent) setAgent(data.agent);
      const convs: ConversationSummary[] = data.conversations ?? [];
      setConversations(convs);
      const nowLive = data.has_live_call ?? convs.some((c) => c.status === "in-progress");
      setLiveCall(nowLive);

      // Trigger full refresh when: (a) a live call just ended, or (b) new conversations appeared
      const callEnded = prevLiveCallRef.current && !nowLive;
      const newConvs = convs.length > prevConvCountRef.current;
      if (callEnded || newConvs) {
        fetchDashboardData();
      }
      prevLiveCallRef.current = nowLive;
      prevConvCountRef.current = convs.length;
    } catch {
      /* swallow */
    }
  }, [fetchDashboardData]);

  // Initial full fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Live status poll: fast (2 s) when a call is in progress, slow (15 s) when idle.
  // When a call ends or a new one appears, triggers a full data refresh (see fetchLiveStatus).
  useEffect(() => {
    const interval = liveCall ? 2_000 : 15_000;
    const iv = setInterval(() => {
      if (!document.hidden) fetchLiveStatus();
    }, interval);
    return () => clearInterval(iv);
  }, [fetchLiveStatus, liveCall]);

  // ── Realtime: refresh on new calls/appointments ──
  useEffect(() => {
    if (!authReady) return;
    const channel = supabase
      .channel("gbf-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
        fetchDashboardData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        fetchDashboardData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authReady, fetchDashboardData]);

  // ── Start call via @11labs/client SDK (gives us real callbacks) ────────────
  const startCall = useCallback(async () => {
    if (callStatus !== "idle") return;
    setCallStatus("connecting");
    setCallError(null);
    setLiveTranscript([]);
    setAgentMode("idle");
    try {
      // Request mic permission explicitly before WebRTC
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (permErr) {
      const msg = "Microphone access denied. Please allow microphone access and try again.";
      console.error("[ElevenLabs] mic permission:", permErr);
      setCallError(msg);
      setCallStatus("idle");
      return;
    }
    // Fetch server-signed URL so auth happens server-side (API key never exposed to client)
    let signedUrl: string;
    try {
      const r = await fetch("/api/elevenlabs/signed-url");
      const data = (await r.json()) as { signed_url?: string; error?: string };
      if (!r.ok || !data.signed_url) {
        const msg = data.error ?? `Signed URL fetch failed (${r.status})`;
        setCallError(msg);
        setCallStatus("idle");
        return;
      }
      signedUrl = data.signed_url;
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      setCallError(`Network error fetching signed URL: ${msg}`);
      setCallStatus("idle");
      return;
    }

    try {
      const conv = await Conversation.startSession({
        signedUrl,
        onConnect: () => {
          setCallStatus("active");
          setCallActive(true);
          setLiveCall(true);
        },
        onDisconnect: () => {
          conversationRef.current = null;
          setCallStatus("idle");
          setCallActive(false);
          setAgentMode("idle");
          // Refresh at 2s, 6s, 15s — ElevenLabs processes transcript asynchronously
          setTimeout(fetchDashboardData, 2000);
          setTimeout(fetchDashboardData, 6000);
          setTimeout(fetchDashboardData, 15000);
          setTimeout(() => {
            setLiveTranscript([]);
            setLiveCall(false);
          }, 6000);
        },
        onMessage: ({ source, message }: { source: string; message: string }) => {
          const text = message?.trim();
          if (!text) return;
          const role: LiveMsg["role"] = source === "ai" ? "agent" : "user";
          setLiveTranscript((prev) => [...prev, { role, text, ts: Date.now() }]);
        },
        onModeChange: ({ mode }: { mode: string }) => {
          setAgentMode(mode as "idle" | "listening" | "speaking" | "thinking");
        },
        onError: (msg: string, context?: unknown) => {
          const full = `${msg}${context ? ` — ${JSON.stringify(context)}` : ""}`;
          console.error("[ElevenLabs] onError:", full);
          setCallError(full);
          setCallStatus("idle");
          setCallActive(false);
        },
      });
      conversationRef.current = conv;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ElevenLabs] startSession failed:", msg);
      setCallError(msg);
      setCallStatus("idle");
    }
  }, [callStatus, fetchDashboardData]);

  // ── Human takeover — inject farewell then end session ───────────────────────
  const handleHumanTakeover = useCallback(async () => {
    setLiveTranscript((prev) => [
      ...prev,
      {
        role: "agent",
        text: "A member of our team will be with you shortly. Thank you for calling, goodbye!",
        ts: Date.now(),
      },
    ]);
    await new Promise((r) => setTimeout(r, 1200)); // let UI show farewell
    conversationRef.current?.endSession();
  }, []);

  // ── End call normally (red button) ──────────────────────────────────────────
  const endCall = useCallback(() => {
    conversationRef.current?.endSession();
  }, []);

  if (!authReady) return <div style={{ minHeight: "100vh", background: "#F5F0E8" }} />;

  const isRTL = LANG_META[langSettings.lang].rtl;
  const navBottom = settings.navPosition === "bottom";
  const tabs = [
    {
      id: "hub" as const,
      label: t("hubFull"),
      short: t("hubShort"),
      icon: <LayoutDashboard size={18} strokeWidth={1.75} />,
    },
    {
      id: "ledger" as const,
      label: t("ledgerFull"),
      short: t("ledgerShort"),
      icon: <ClipboardList size={18} strokeWidth={1.75} />,
    },
    {
      id: "analytics" as const,
      label: t("analyticsFull"),
      short: t("analyticsShort"),
      icon: <BarChart3 size={18} strokeWidth={1.75} />,
    },
  ];

  return (
    <LangCtx.Provider value={t}>
      <>
        <style>{RESPONSIVE_CSS}</style>
        {settings.dyslexia && (
          <>
            <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/opendyslexic" />
            <style>{`
              * { font-family: 'OpenDyslexic', sans-serif !important; }
              * { letter-spacing: 0.05em !important; word-spacing: 0.12em !important; }
              p, span, div, td, th, li, label, button, input, select, textarea { line-height: 1.65 !important; }
              * { text-transform: none !important; }
            `}</style>
          </>
        )}
        <style>{`
        :root {
          --gbf-c-accent:       ${C.accent};
          --gbf-c-accent-light: ${C.accentLight};
          --gbf-c-accent-mid:   ${C.accentMid};
          --gbf-c-surface-alt:  ${C.surfaceAlt};
        }
      `}</style>

        {/* ── Add shop modal ── */}
        <AddShopModal
          open={addShopOpen}
          onClose={() => setAddShopOpen(false)}
          onCreated={(biz) => {
            const newBiz = { id: biz.id, name: biz.name, plan: biz.plan };
            setBusinesses((prev) => {
              if (prev.some((b) => b.id === newBiz.id)) return prev;
              return [...prev, newBiz];
            });
            setCurrentBiz(newBiz);
            if (biz.barbers && biz.barbers.length > 0) {
              updateProfile({ barbers: biz.barbers.join(", ") });
            }
            loadBusinesses();
          }}
          C={C}
        />

        {/* ── Call orb widget ── */}
        <div
          className={`gbf-call-fab${navBottom ? " gbf-bnav-widget" : ""}`}
          style={{
            position: "fixed",
            bottom: 24,
            right: 16,
            zIndex: 500,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Error toast */}
          {callError && (
            <div
              onClick={() => setCallError(null)}
              style={{
                maxWidth: "min(280px, calc(100vw - 32px))",
                background: "#2a1010",
                border: `1px solid ${C.red}55`,
                borderRadius: 12,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: C.red,
                boxShadow: "0 4px 16px rgba(0,0,0,.25)",
                cursor: "pointer",
                animation: "gbf-staggerIn .2s ease",
                lineHeight: 1.4,
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{callError}</span>
            </div>
          )}

          {/* Orb */}
          <div style={{ position: "relative" }}>
            {callStatus === "idle" && (
              <div
                style={{
                  position: "absolute",
                  right: 64,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: `${C.surface}ee`,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "6px 12px",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.accent,
                  boxShadow: `0 4px 16px ${C.overlay}`,
                  animation: "gbf-staggerIn .2s ease",
                  pointerEvents: "none" as const,
                }}
              >
                Talk to Kostas
              </div>
            )}
            {callStatus === "connecting" && (
              <div
                style={{
                  position: "absolute",
                  right: 64,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: `${C.surface}ee`,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "6px 12px",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.accent,
                  boxShadow: `0 4px 16px ${C.overlay}`,
                  animation: "gbf-staggerIn .2s ease",
                  pointerEvents: "none" as const,
                }}
              >
                Connecting…
              </div>
            )}
            {callStatus === "active" && (
              <div
                style={{
                  position: "absolute",
                  right: 64,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: `${C.surface}ee`,
                  border: `1px solid ${C.red}66`,
                  borderRadius: 10,
                  padding: "6px 12px",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.red,
                  boxShadow: `0 4px 16px ${C.overlay}`,
                  animation: "gbf-staggerIn .2s ease",
                  pointerEvents: "none" as const,
                }}
              >
                Tap to end call
              </div>
            )}
            <button
              onClick={callStatus === "idle" ? startCall : callStatus === "active" ? endCall : undefined}
              className="gbf-call-orb"
              title={callStatus === "active" ? "End call" : "Start a call with Kostas"}
              style={
                callStatus === "active"
                  ? {
                      background: C.red,
                      boxShadow: `0 4px 20px ${C.red}66`,
                      animation: "gbf-pulse 1.2s ease infinite",
                    }
                  : callStatus === "connecting"
                    ? {
                        background: C.accent,
                        boxShadow: `0 4px 20px ${C.accent}88`,
                        animation: "gbf-pulse .8s ease infinite",
                        pointerEvents: "none",
                      }
                    : {
                        background: C.accent,
                        boxShadow: `0 4px 20px ${C.accent}66`,
                      }
              }
            >
              {callStatus === "active" ? (
                <PhoneOff size={22} color="#fff" strokeWidth={2.5} />
              ) : callStatus === "connecting" ? (
                <Loader size={22} color="#fff" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Phone size={22} color="#fff" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            profile={profile}
            onProfileUpdate={updateProfile}
            onClose={() => setSettingsOpen(false)}
            onLogout={handleLogout}
            C={C}
            langSettings={langSettings}
            onLangUpdate={updateLangSettings}
            onAddShop={() => setAddShopOpen(true)}
            businesses={businesses}
            currentBiz={currentBiz}
            onSwitchBiz={(biz) => {
              setCurrentBiz(biz);
              setSettingsOpen(false);
            }}
            onDeleteBiz={handleDeleteBiz}
          />
        )}

        {walkinOpen && (
          <WalkInModal
            C={C}
            barbers={parseBarberNames(profile.barbers)}
            businessId={currentBiz?.id ?? businesses[0]?.id ?? "00000000-0000-0000-0000-000000000001"}
            onClose={() => setWalkinOpen(false)}
            onSaved={() => {
              fetchDashboardData();
            }}
          />
        )}

        <div
          dir={isRTL ? "rtl" : "ltr"}
          className={navBottom ? "gbf-has-bnav" : ""}
          style={{ minHeight: "100vh", background: C.bg, color: C.text, transition: "background .3s, color .3s" }}
        >
          {/* Loading progress bar — fixed at very top */}
          {loading && (
            <div className="gbf-progress-top" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100 }} />
          )}

          {/* Header */}
          <header
            className="gbf-header"
            style={{
              background: `${C.surface}E8`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderBottom: `1px solid ${C.border}`,
              position: "sticky",
              top: 0,
              zIndex: 30,
              transition: "background .3s, border-color .3s",
              boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div
              className="gbf-header-inner"
              style={{
                maxWidth: 1200,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Logo + shop switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 1 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: C.accentLight,
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Scissors size={18} style={{ color: C.accent }} strokeWidth={1.75} />
                </div>
                {businesses.length >= 1 ? (
                  <div style={{ position: "relative", minWidth: 0 }}>
                    <button
                      onClick={() => setBizOpen((v) => !v)}
                      className="gbf-btn"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: bizOpen ? C.accentLight : C.surfaceAlt,
                        border: `1px solid ${bizOpen ? C.accent : C.border}`,
                        borderRadius: 10,
                        cursor: "pointer",
                        padding: "6px 10px 6px 10px",
                        fontFamily: "inherit",
                        textAlign: "left",
                        transition: "background .15s, border-color .15s",
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      <Store size={14} style={{ color: C.accent, flexShrink: 0 }} />
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div
                          style={{
                            fontFamily: "var(--gbf-font-display)",
                            fontSize: 14,
                            fontWeight: 700,
                            color: C.text,
                            lineHeight: 1.2,
                            letterSpacing: "-0.01em",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {currentBiz?.name ?? "All shops"}
                        </div>
                        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: "0.04em", fontWeight: 500 }}>
                          {businesses.length} barbershop{businesses.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <ChevronDown
                        size={13}
                        style={{
                          color: C.textFaint,
                          transition: "transform .15s",
                          transform: bizOpen ? "rotate(180deg)" : "none",
                          flexShrink: 0,
                        }}
                      />
                    </button>
                    {bizOpen && (
                      <>
                        {createPortal(
                          <div onClick={() => setBizOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />,
                          document.body,
                        )}
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            left: 0,
                            right: "auto",
                            maxWidth: "calc(100vw - 32px)",
                            zIndex: 201,
                            background: C.surface,
                            border: `1px solid ${C.border}`,
                            borderRadius: 14,
                            boxShadow: "0 8px 32px rgba(0,0,0,.18)",
                            padding: 8,
                            minWidth: 220,
                            animation: "gbf-fadeIn .15s ease",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: C.textFaint,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              padding: "4px 12px 8px",
                            }}
                          >
                            Your Shops
                          </div>
                          {/* All shops option */}
                          <button
                            onClick={() => {
                              setCurrentBiz(null);
                              setBizOpen(false);
                            }}
                            className="gbf-btn gbf-menu-item"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: "9px 12px",
                              borderRadius: 10,
                              border: "none",
                              background: currentBiz === null ? C.accentLight : "transparent",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textAlign: "left",
                            }}
                          >
                            <LayoutDashboard
                              size={14}
                              style={{ color: currentBiz === null ? C.accent : C.textMuted, flexShrink: 0 }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: currentBiz === null ? 700 : 500,
                                color: currentBiz === null ? C.accent : C.text,
                              }}
                            >
                              All shops
                            </span>
                            {currentBiz === null && (
                              <Check
                                size={13}
                                style={{ color: C.accent, marginLeft: "auto", flexShrink: 0 }}
                                strokeWidth={2.5}
                              />
                            )}
                          </button>
                          <div style={{ height: 1, background: C.borderFaint, margin: "4px 0" }} />
                          {businesses.map((biz) => (
                            <button
                              key={biz.id}
                              onClick={() => {
                                setCurrentBiz(biz);
                                setBizOpen(false);
                              }}
                              className="gbf-btn gbf-menu-item"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                width: "100%",
                                padding: "9px 12px",
                                borderRadius: 10,
                                border: "none",
                                background: currentBiz?.id === biz.id ? C.accentLight : "transparent",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                              }}
                            >
                              <Store
                                size={14}
                                style={{ color: currentBiz?.id === biz.id ? C.accent : C.textMuted, flexShrink: 0 }}
                              />
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: currentBiz?.id === biz.id ? 700 : 500,
                                  color: currentBiz?.id === biz.id ? C.accent : C.text,
                                }}
                              >
                                {biz.name}
                              </span>
                              {currentBiz?.id === biz.id && (
                                <Check
                                  size={13}
                                  style={{ color: C.accent, marginLeft: "auto", flexShrink: 0 }}
                                  strokeWidth={2.5}
                                />
                              )}
                            </button>
                          ))}
                          <div style={{ height: 1, background: C.borderFaint, margin: "4px 0" }} />
                          <button
                            onClick={() => {
                              setBizOpen(false);
                              setAddShopOpen(true);
                            }}
                            className="gbf-btn gbf-menu-item"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: "9px 12px",
                              borderRadius: 10,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textAlign: "left",
                            }}
                          >
                            <Plus size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: C.textMuted }}>Add a shop…</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontFamily: "inherit",
                      textAlign: "left",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--gbf-font-display)",
                        fontSize: 16,
                        fontWeight: 700,
                        color: C.text,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {currentBiz?.name ?? profile.businessName ?? "Greek Barber Festival"}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.textMuted,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 500,
                      }}
                    >
                      {t("aiDashboard")}
                    </div>
                  </button>
                )}
              </div>
              <div
                className="gbf-header-right"
                style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 1, minWidth: 0 }}
              >
                <span className="gbf-header-date" style={{ fontSize: 13, color: C.textMuted }}>
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <div
                  className="gbf-header-live"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: loading ? C.borderFaint : C.greenLight,
                    padding: "6px 11px",
                    borderRadius: 99,
                    transition: "background .3s",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: loading ? C.textFaint : C.green,
                      display: "inline-block",
                      animation: loading ? "none" : "gbf-pulse 2s infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="gbf-header-live-text"
                    style={{
                      fontSize: 11,
                      color: loading ? C.textMuted : C.green,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {loading ? t("loading") : t("live")}
                  </span>
                </div>
                {/* Dark / light mode toggle */}
                <button
                  onClick={() => updateSettings({ mode: resolveMode(settings.mode) === "dark" ? "light" : "dark" })}
                  className="gbf-btn gbf-icon-btn"
                  title={resolveMode(settings.mode) === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.surfaceAlt,
                    cursor: "pointer",
                    color: C.textMuted,
                    flexShrink: 0,
                    transition: "all .15s",
                  }}
                >
                  {resolveMode(settings.mode) === "dark" ? (
                    <Sun size={15} strokeWidth={2} />
                  ) : (
                    <Moon size={15} strokeWidth={2} />
                  )}
                </button>
                {/* Language picker */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    onClick={() => setLangOpen((v) => !v)}
                    className="gbf-btn gbf-icon-btn"
                    title="Language"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0 10px",
                      height: 40,
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: langOpen ? C.accentLight : C.surfaceAlt,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: C.text,
                      transition: "all .15s",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{LANG_META[langSettings.lang].flag}</span>
                  </button>
                  {langOpen && (
                    <>
                      {createPortal(
                        <div onClick={() => setLangOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />,
                        document.body,
                      )}
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          right: isRTL ? "auto" : 0,
                          left: isRTL ? 0 : "auto",
                          zIndex: 201,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 14,
                          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
                          padding: 8,
                          minWidth: 190,
                        }}
                      >
                        {(Object.entries(LANG_META) as [LanguageKey, (typeof LANG_META)[LanguageKey]][]).map(
                          ([key, meta]) => {
                            const active = langSettings.lang === key;
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  updateLangSettings({ lang: key });
                                  setLangOpen(false);
                                }}
                                className="gbf-btn gbf-menu-item"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  width: "100%",
                                  padding: "9px 12px",
                                  borderRadius: 10,
                                  border: "none",
                                  background: active ? C.accentLight : "transparent",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  textAlign: "left",
                                  transition: "background .1s",
                                }}
                              >
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{meta.flag}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: active ? 700 : 500,
                                      color: active ? C.accent : C.text,
                                    }}
                                  >
                                    {meta.native}
                                  </div>
                                </div>
                                {active && (
                                  <Check size={14} style={{ color: C.accent, flexShrink: 0 }} strokeWidth={2.5} />
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Walk-in quick entry */}
                <button
                  onClick={() => setWalkinOpen(true)}
                  title="Register walk-in"
                  className="gbf-btn gbf-action-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    height: 40,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: `1px solid ${C.accent}44`,
                    background: C.accentLight,
                    color: C.accent,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                    transition: "all .15s",
                  }}
                >
                  <Plus size={15} strokeWidth={2.5} />
                  <span className="gbf-header-date">Walk-in</span>
                </button>

                {/* Credits / balance */}
                {(() => {
                  const usedCredits = Math.ceil(
                    [...aiBookings, ...manualBookings].reduce((sum, b) => sum + (b.duration_secs || 0), 0) / 60,
                  );
                  const remaining = Math.max(0, TOTAL_CREDITS - usedCredits);
                  const pct = Math.round((remaining / TOTAL_CREDITS) * 100);
                  return (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        onClick={() => setCreditsOpen((v) => !v)}
                        title="Credits balance"
                        className="gbf-btn gbf-icon-btn"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0 12px",
                          height: 40,
                          borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          background: creditsOpen ? C.accentLight : C.surfaceAlt,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          color: C.text,
                          transition: "all .15s",
                        }}
                      >
                        <Coins size={14} style={{ color: C.accent }} strokeWidth={2.2} />
                        <span
                          className="gbf-header-date"
                          style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: "0.01em" }}
                        >
                          {remaining.toLocaleString()}
                        </span>
                        <span className="gbf-header-date" style={{ fontSize: 10, color: C.textFaint, fontWeight: 500 }}>
                          min
                        </span>
                      </button>
                      {creditsOpen && (
                        <>
                          {createPortal(
                            <div
                              onClick={() => setCreditsOpen(false)}
                              style={{ position: "fixed", inset: 0, zIndex: 25 }}
                            />,
                            document.body,
                          )}
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 8px)",
                              right: isRTL ? "auto" : 0,
                              left: isRTL ? 0 : "auto",
                              zIndex: 201,
                              background: C.surface,
                              border: `1px solid ${C.border}`,
                              borderRadius: 14,
                              boxShadow: "0 8px 32px rgba(0,0,0,.18)",
                              padding: 16,
                              minWidth: 230,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 14,
                              }}
                            >
                              <Coins size={16} style={{ color: C.accent }} strokeWidth={2.2} />
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Balance</span>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 12,
                                  color: C.textMuted,
                                  marginBottom: 4,
                                }}
                              >
                                <span>Total</span>
                                <span style={{ fontWeight: 600, color: C.text }}>
                                  {TOTAL_CREDITS.toLocaleString()} min
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 12,
                                  color: C.textMuted,
                                  marginBottom: 8,
                                }}
                              >
                                <span>Remaining</span>
                                <span style={{ fontWeight: 600, color: pct > 20 ? C.green : C.accent }}>
                                  {remaining.toLocaleString()} min
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  borderRadius: 3,
                                  background: C.borderFaint,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    borderRadius: 3,
                                    background: pct > 20 ? C.green : C.accent,
                                    transition: "width .3s",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: C.textFaint,
                                  marginTop: 4,
                                  textAlign: "right",
                                }}
                              >
                                {usedCredits.toLocaleString()} min used ({100 - pct}%)
                              </div>
                            </div>
                            <button
                              className="gbf-btn"
                              style={{
                                width: "100%",
                                padding: "8px 0",
                                borderRadius: 8,
                                border: `1px solid ${C.accent}44`,
                                background: C.accentLight,
                                color: C.accent,
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "all .15s",
                              }}
                            >
                              Upgrade
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* User + logout */}
                {userEmail && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span
                      className="gbf-header-date"
                      style={{
                        fontSize: 12,
                        color: C.textFaint,
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {userEmail}
                    </span>
                    <button
                      onClick={handleLogout}
                      title="Sign out"
                      className="gbf-btn gbf-icon-btn"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: `1px solid ${C.border}`,
                        background: C.surfaceAlt,
                        color: C.textMuted,
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all .15s",
                      }}
                    >
                      <LogOut size={15} strokeWidth={2} />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setOpenMenu(null);
                  }}
                  title="Settings"
                  className="gbf-btn gbf-icon-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.surfaceAlt,
                    color: C.textMuted,
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all .15s",
                  }}
                >
                  <GearIcon />
                </button>
              </div>
            </div>
          </header>

          {/* Tabs — top position: sticky below header; hidden when bottom nav active */}
          {!navBottom && (
            <div className="gbf-topnav" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
              <div className="gbf-tabs-inner" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 2 }}>
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setTab(tb.id)}
                    className="gbf-tab-btn gbf-btn"
                    aria-current={tab === tb.id ? "page" : undefined}
                    style={{
                      fontWeight: tab === tb.id ? 700 : 500,
                      color: tab === tb.id ? C.accent : C.textMuted,
                      background: tab === tb.id ? C.accentLight : "transparent",
                      border: "none",
                      borderBottom: tab === tb.id ? `2px solid ${C.accent}` : "2px solid transparent",
                      borderRadius: "10px 10px 0 0",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "color .2s, background .2s",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <span className="gbf-tab-icon" style={{ display: "flex", alignItems: "center" }}>
                      {tb.icon}
                    </span>
                    <span className="gbf-tab-full">{tb.label}</span>
                    <span className="gbf-tab-short">{tb.short}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content — all three tabs stay mounted; CSS hides the inactive ones */}
          <div
            className={`gbf-content${navBottom ? " gbf-content-bnav" : ""}`}
            style={{ maxWidth: 1200, margin: "0 auto" }}
          >
            <div style={{ display: tab === "hub" ? "block" : "none" }} className="gbf-tab-content">
              <HubTab
                agent={agent}
                C={C}
                density={settings.density}
                loading={loading}
                profile={profile}
                conversations={conversations}
                aiBookings={aiBookings}
                liveCall={liveCall}
                onTabChange={setTab}
                onConvSelect={(id) => {
                  setSelectedConvId(id);
                  setTab("ledger");
                }}
                callActive={callActive}
                callStatus={callStatus}
                liveTranscript={liveTranscript}
                agentMode={agentMode}
                onHumanTakeover={handleHumanTakeover}
                businesses={businesses}
                currentBiz={currentBiz}
              />
            </div>
            <div style={{ display: tab === "ledger" ? "block" : "none" }} className="gbf-tab-content">
              <LedgerTab
                key={currentBiz?.id ?? "all"}
                C={C}
                density={settings.density}
                aiBookings={[...aiBookings, ...manualBookings]}
                liveCall={liveCall}
                selectedConvId={selectedConvId}
                onConvSelected={() => setSelectedConvId(null)}
                businesses={businesses}
                isAllShops={currentBiz === null && businesses.length > 1}
                currentBiz={currentBiz}
                onRefreshData={fetchDashboardData}
              />
            </div>
            <div style={{ display: tab === "analytics" ? "block" : "none" }} className="gbf-tab-content">
              <AnalyticsTab
                C={C}
                density={settings.density}
                conversations={conversations}
                liveCall={liveCall}
                businesses={businesses}
                currentBiz={currentBiz}
              />
            </div>
          </div>

          {/* Footer */}
          <footer
            className="gbf-footer"
            style={{
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: C.textMuted }}>{t("poweredBy")}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>AI Voice Receptionist</span>
            <span style={{ fontSize: 12, color: C.textFaint }}>·</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{t("footerSuffix")}</span>
          </footer>

          {/* Bottom nav — fixed at bottom on all screen sizes when navPosition === "bottom" */}
          {navBottom && (
            <div
              className="gbf-nav-bottom"
              style={{ background: `${C.surface}F0`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            >
              <div className="gbf-tabs-inner" style={{ maxWidth: 1200, margin: "0 auto", display: "flex" }}>
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setTab(tb.id)}
                    className="gbf-tab-btn gbf-btn"
                    aria-current={tab === tb.id ? "page" : undefined}
                    style={{
                      fontWeight: tab === tb.id ? 700 : 500,
                      color: tab === tb.id ? C.accent : C.textMuted,
                      background: tab === tb.id ? C.accentLight : "transparent",
                      border: "none",
                      borderRadius: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "color .2s, background .2s",
                      display: "flex",
                      alignItems: "center",
                      flexDirection: "column",
                      flex: 1,
                      gap: 2,
                    }}
                  >
                    <span className="gbf-tab-icon" style={{ margin: 0, display: "flex", alignItems: "center" }}>
                      {tb.icon}
                    </span>
                    <span className="gbf-tab-full" style={{ letterSpacing: "-0.01em" }}>
                      {tb.label}
                    </span>
                    <span className="gbf-tab-short" style={{ fontSize: 10, letterSpacing: "-0.01em" }}>
                      {tb.short}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scroll-to-top button — mobile only, appears after scrolling 280px */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={`gbf-scroll-top${showScrollTop ? " gbf-scroll-top-visible" : ""}`}
            style={{ background: C.accent, color: "#fff" }}
            title="Scroll to top"
          >
            ↑
          </button>
        </div>
      </>
    </LangCtx.Provider>
  );
}
