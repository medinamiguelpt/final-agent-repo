"use client";
import { useState, useEffect, useRef } from "react";
import { BARBER_NAME_POOL, SERVICE_CATALOGUE, MIN_BARBERS, MAX_BARBERS, rInt, pick, pickN } from "@/lib/barbers";
import type { BarberDraft, BarberService } from "@/lib/barbers";
import { DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME } from "@/lib/config";

type ServiceEntry = BarberService & { _id: string };
type BarberEntry  = { _id: string; name: string; services: ServiceEntry[] };
function emptyBarber(): BarberEntry { return { _id: crypto.randomUUID(), name: "", services: [] }; }
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import {
  X, MapPin, Phone, Mail, Globe, Clock, ChevronDown,
  AlertCircle, Check, Loader, Wand2, Zap, ArrowDownToLine,
  BarChart2, FileText, Bot, ChevronLeft, UploadCloud, Users,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DayHours    { open: string; close: string; closed: boolean }
type Hours = Record<string, DayHours>;
type CreationMode = "scratch" | "migrate" | "demo";

interface FormState {
  name: string; phone: string; email: string;
  address: string; city: string; country: string;
  website: string; description: string; timezone: string;
}

interface MigrationState {
  csvFile:        boolean; csvData:     File | null;
  elevenLabs:     boolean; elAgentId:   string;
  otherPlatform:  boolean; otherUrl:    string;
  manualLater:    boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS: { key: string; label: string }[] = [
  { key:"mon", label:"Mon" }, { key:"tue", label:"Tue" }, { key:"wed", label:"Wed" },
  { key:"thu", label:"Thu" }, { key:"fri", label:"Fri" }, { key:"sat", label:"Sat" },
  { key:"sun", label:"Sun" },
];

const DEFAULT_HOURS: Hours = Object.fromEntries(
  DAYS.map(({ key }) => [key, { open:"09:00", close:"18:00", closed: key === "sun" }])
);

const TIMEZONES = [
  "Europe/Athens","Europe/London","Europe/Paris","Europe/Berlin","Europe/Madrid",
  "Europe/Lisbon","Europe/Rome","Europe/Amsterdam","Europe/Brussels","Europe/Vienna",
  "Europe/Warsaw","Europe/Prague","Europe/Budapest","Europe/Bucharest","Europe/Istanbul",
  "Europe/Moscow","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Toronto","America/Sao_Paulo","America/Buenos_Aires","America/Mexico_City",
  "Asia/Dubai","Asia/Riyadh","Asia/Istanbul","Asia/Tokyo","Asia/Shanghai","Asia/Singapore",
  "Asia/Kolkata","Asia/Karachi","Africa/Cairo","Africa/Johannesburg","Australia/Sydney",
  "Pacific/Auckland","UTC",
];

const DEFAULT_MIGRATION: MigrationState = {
  csvFile: false,        csvData:    null,
  elevenLabs: false,     elAgentId:  "",
  otherPlatform: false,  otherUrl:   "",
  manualLater: false,
};

const SHARED_AGENT_ID   = DEFAULT_AGENT_ID;
const SHARED_AGENT_NAME = DEFAULT_AGENT_NAME;

async function generateDemoBookings(businessId: string, shopName: string, token: string, barberNames?: string[]) {
  const res = await fetch("/api/demo-bookings", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ business_id: businessId, shop_name: shopName, barber_names: barberNames }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn("[AddShopModal] demo bookings warn:", data);
  }
}

// ── Demo autofill pool ────────────────────────────────────────────────────────
const DEMO_POOL = [
  { name:"Barberia Nikos",       phone:"+30 210 123 4567", email:"nikos@barberia.gr",     address:"Ermou 42",          city:"Athens",       country:"Greece",   website:"https://barberia-nikos.gr",     description:"Classic Greek barbershop in the heart of Athens." },
  { name:"The Greek Cut",        phone:"+30 210 987 6543", email:"info@thegreekcut.com",  address:"Mitropoleos 18",    city:"Athens",       country:"Greece",   website:"https://thegreekcut.com",       description:"Modern cuts and traditional hot-towel shaves." },
  { name:"Acropolis Barbershop", phone:"+30 211 234 5678", email:"hello@acropolis.gr",    address:"Adrianou 7",        city:"Athens",       country:"Greece",   website:"https://acropolisbarber.gr",    description:"Where ancient tradition meets modern style." },
  { name:"Thessaloniki Blades",  phone:"+30 2310 456 789", email:"blades@thessbarber.gr", address:"Tsimiski 55",       city:"Thessaloniki", country:"Greece",   website:"https://thessalonikiblades.gr", description:"Premium grooming in the second city of Greece." },
  { name:"Kostas & Sons",        phone:"+30 210 555 0011", email:"kostas@kostas-sons.gr", address:"Patission 101",     city:"Athens",       country:"Greece",   website:"https://kostas-sons.gr",        description:"Family barbershop since 1987." },
  { name:"Crete Barbers Co.",    phone:"+30 2810 303 030", email:"crete@barbersco.gr",    address:"25is Avgoustou 12", city:"Heraklion",    country:"Greece",   website:"https://cretebarbers.gr",       description:"Sun, sea and the perfect fade." },
  { name:"Lisboa Cuts",          phone:"+351 21 345 6789", email:"info@lisboacuts.pt",    address:"Rua Augusta 100",   city:"Lisbon",       country:"Portugal", website:"https://lisboacuts.pt",         description:"Premium grooming in Baixa-Chiado." },
  { name:"Madrid Shave Club",    phone:"+34 91 123 4567",  email:"hola@madridshave.es",   address:"Gran Via 28",       city:"Madrid",       country:"Spain",    website:"https://madridshaveclub.es",    description:"Old-school barbers, new-school attitude." },
];

function pickDemo(): { form: FormState; hours: Hours } {
  const d = pick(DEMO_POOL);
  return {
    form: { ...d, timezone:"Europe/Athens" },
    hours: Object.fromEntries(
      DAYS.map(({ key }) => [key, { open:"09:00", close:"18:00", closed: key === "sun" }])
    ),
  };
}


// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open:      boolean;
  onClose:   () => void;
  onCreated: (biz: { id: string; name: string; plan: string; barbers?: string[]; barberData?: BarberDraft[] }) => void;
  C: Record<string, string>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AddShopModal({ open, onClose, onCreated, C }: Props) {
  // ── Step / mode ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [mode, setMode] = useState<CreationMode | null>(null);

  // ── Form ─────────────────────────────────────────────────────────────────────
  const [filledFrom,   setFilledFrom]   = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name:"", phone:"", email:"", address:"", city:"", country:"",
    website:"", description:"", timezone:"Europe/Athens",
  });
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);

  // ── Barbers ───────────────────────────────────────────────────────────────────
  const [barbers, setBarbers] = useState<BarberEntry[]>(() => [emptyBarber(), emptyBarber(), emptyBarber()]);

  // ── Migration ─────────────────────────────────────────────────────────────────
  const [migration, setMig] = useState<MigrationState>(DEFAULT_MIGRATION);

  // ── Submit state ─────────────────────────────────────────────────────────────
  const [submitting,     setSubmitting]     = useState(false);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [error,          setError]          = useState("");

  const errorRef    = useRef<HTMLDivElement>(null);
  const csvRef      = useRef<HTMLInputElement>(null);

  // ── Reset on open ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep("choose"); setMode(null); setError(""); setSubmitting(false);
      setGeneratingDemo(false); setFilledFrom(null);
      setMig(DEFAULT_MIGRATION);
      setForm({ name:"", phone:"", email:"", address:"", city:"", country:"",
                website:"", description:"", timezone:"Europe/Athens" });
      setHours(DEFAULT_HOURS);
      setBarbers([emptyBarber(), emptyBarber(), emptyBarber()]);
    }
  }, [open]);

  // ── Scroll error into view ───────────────────────────────────────────────────
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }, [error]);

  // ── Escape to close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // ── Mode selection ───────────────────────────────────────────────────────────
  function selectMode(m: CreationMode) { setMode(m); setStep("form"); }
  function goBack()                    { setStep("choose"); setMode(null); setError(""); }

  // ── Barber helpers ────────────────────────────────────────────────────────────
  function addBarber() {
    if (barbers.length >= MAX_BARBERS) return;
    setBarbers(prev => [...prev, emptyBarber()]);
  }

  function removeBarber(bi: number) {
    if (barbers.length <= MIN_BARBERS) return;
    setBarbers(prev => prev.filter((_, i) => i !== bi));
  }

  function setBarberName(bi: number, name: string) {
    setBarbers(prev => prev.map((b, i) => i === bi ? { ...b, name } : b));
  }

  function toggleService(bi: number, svc: BarberService) {
    setBarbers(prev => prev.map((b, i) => {
      if (i !== bi) return b;
      const has = b.services.some(s => s.name === svc.name);
      return { ...b, services: has ? b.services.filter(s => s.name !== svc.name) : [...b.services, { _id: crypto.randomUUID(), ...svc }] };
    }));
  }

  function addCustomService(bi: number) {
    setBarbers(prev => prev.map((b, i) => i === bi ? { ...b, services: [...b.services, { _id: crypto.randomUUID(), name: "", price: 0 }] } : b));
  }

  function setServiceField(bi: number, si: number, patch: Partial<BarberService>) {
    setBarbers(prev => prev.map((b, i) => i !== bi ? b : { ...b, services: b.services.map((s, j) => j === si ? { ...s, ...patch } : s) }));
  }

  function removeService(bi: number, si: number) {
    setBarbers(prev => prev.map((b, i) => i !== bi ? b : { ...b, services: b.services.filter((_, j) => j !== si) }));
  }

  function randomizeBarbers(count?: number) {
    const n = count ?? rInt(3, MAX_BARBERS);
    const names = pickN(BARBER_NAME_POOL, n);
    setBarbers(names.map(name => ({
      _id: crypto.randomUUID(),
      name,
      services: pickN(SERVICE_CATALOGUE, rInt(2, 4)).map(svc => ({ _id: crypto.randomUUID(), ...svc })),
    })));
  }

  // ── Demo autofill ─────────────────────────────────────────────────────────────
  function fillDemo() {
    const { form: f, hours: h } = pickDemo();
    setForm(f); setHours(h); setFilledFrom("demo");
    randomizeBarbers();
  }

  // ── Form helpers ──────────────────────────────────────────────────────────────
  function setField(k: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function setDayHours(day: string, patch: Partial<DayHours>) {
    setHours(h => ({ ...h, [day]: { ...h[day], ...patch } }));
  }

  function toggleMig<K extends keyof MigrationState>(k: K) {
    setMig(m => ({ ...m, [k]: !m[k] }));
  }
  function setMigField<K extends keyof MigrationState>(k: K, v: MigrationState[K]) {
    setMig(m => ({ ...m, [k]: v }));
  }

  // ── Migration validation ──────────────────────────────────────────────────────
  function migrationValid(): boolean {
    if (mode !== "migrate") return true;
    return (
      (migration.csvFile        && migration.csvData !== null)              ||
      (migration.elevenLabs     && migration.elAgentId.trim().length > 0)  ||
      (migration.otherPlatform  && migration.otherUrl.trim().length > 0)   ||
      migration.manualLater
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())     { setError("Business name is required"); return; }
    if (!form.timezone.trim()) { setError("Timezone is required"); return; }
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Please provide at least a phone number or email"); return;
    }
    if (!migrationValid()) {
      setError("Please select at least one migration source, or check \u2018I\u2019ll add data manually\u2019"); return;
    }
    setError(""); setSubmitting(true);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (!session) { setError(sessErr?.message ?? "Session expired — please refresh the page"); return; }
      const token = session.access_token;

      const res = await fetch("/api/businesses", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          name:              form.name.trim(),
          phone:             form.phone    || null,
          email:             form.email    || null,
          address:           form.address  || null,
          city:              form.city     || null,
          country:           form.country  || null,
          website:           form.website  || null,
          description:       form.description || null,
          hours,
          timezone:          form.timezone || "Europe/Athens",
          plan:              "demo",
          // Agent links
          agent_id:          SHARED_AGENT_ID,
          agent_name:        SHARED_AGENT_NAME,
          extra_agent_id:    (mode === "migrate" && migration.elevenLabs && migration.elAgentId.trim())
                               ? migration.elAgentId.trim() : null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setError(payload.error ?? "Business creation failed — please try again"); return; }

      const biz = payload.business;
      if (!biz) { setError("Business creation failed unexpectedly."); return; }

      const finalBarberData: BarberDraft[] = barbers
        .filter(b => b.name.trim())
        .map(({ name, services }) => ({ name: name.trim(), services: services.map(({ name: n, price }) => ({ name: n, price })) }));
      const finalBarbers = finalBarberData.map(b => b.name);

      // Demo mode: generate bookings via server-side route
      if (mode === "demo") {
        setGeneratingDemo(true);
        try { await generateDemoBookings(biz.id, biz.name, token, finalBarbers.length ? finalBarbers : undefined); }
        catch (err) { console.warn("[AddShopModal] demo data warn:", err); }
        finally { setGeneratingDemo(false); }
      }

      onCreated({ id: biz.id, name: biz.name, plan: biz.plan ?? "demo", barbers: finalBarbers.length ? finalBarbers : undefined, barberData: finalBarberData.length ? finalBarberData : undefined });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Unexpected error: ${msg}`);
      console.error("[AddShopModal] caught:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width:"100%", boxSizing:"border-box", padding:"10px 12px",
    background:C.surfaceAlt, border:`1.5px solid ${C.border}`, borderRadius:10,
    color:C.text, fontSize:14, fontFamily:"inherit", outline:"none",
    transition:"border-color .15s",
  };
  const lbl: React.CSSProperties = {
    display:"block", fontSize:11, fontWeight:700, color:C.textFaint,
    textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5,
  };
  const fw: React.CSSProperties = { display:"flex", flexDirection:"column", gap:0 };

  // ── Mode definitions ──────────────────────────────────────────────────────────
  const MODES: { id: CreationMode; Icon: React.ElementType; color: string; title: string; sub: string; badge?: string }[] = [
    {
      id:"scratch", Icon:Zap, color:"#f59e0b",
      title:"Start from scratch",
      sub:"Open a clean shop with an empty database. Add appointments as they come in.",
    },
    {
      id:"migrate", Icon:ArrowDownToLine, color:C.accent,
      title:"Migrate existing data",
      sub:"Upload a CSV or link your ElevenLabs agent to import past bookings.",
      badge:"Recommended",
    },
    {
      id:"demo", Icon:BarChart2, color:"#a855f7",
      title:"Load demo data",
      sub:"Populate with 30–40 realistic sample bookings: AI calls, walk-ins, cancellations and more.",
      badge:"For testing",
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: CHOOSE
  // ─────────────────────────────────────────────────────────────────────────────
  const chooseContent = (
    <div style={{
      position:"relative", zIndex:1, width:"100%", maxWidth:580,
      background:C.surface, border:`1px solid ${C.border}`, borderRadius:20,
      boxShadow:"0 24px 80px rgba(0,0,0,.5)", overflow:"hidden",
      animation:"gbf-fadeIn .2s ease",
    }}>
      {/* Header */}
      <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"var(--gbf-font-display)", fontSize:18, fontWeight:700, color:C.text }}>Add a barbershop</div>
        <button onClick={onClose} style={{ background:C.borderFaint, border:"none", borderRadius:99, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.textMuted }}>
          <X size={16} />
        </button>
      </div>

      {/* Cards */}
      <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ fontSize:13, color:C.textMuted, marginBottom:4 }}>
          How would you like to set up your new shop?
        </div>

        {MODES.map(({ id, Icon, color, title, sub, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectMode(id)}
            style={{
              display:"flex", alignItems:"flex-start", gap:16, width:"100%",
              padding:"16px 18px", borderRadius:14, textAlign:"left",
              border:`1.5px solid ${C.border}`, background:C.surfaceAlt,
              cursor:"pointer", fontFamily:"inherit", transition:"border-color .15s, background .15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = color;
              (e.currentTarget as HTMLButtonElement).style.background  = `${color}12`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
              (e.currentTarget as HTMLButtonElement).style.background  = C.surfaceAlt;
            }}
          >
            <div style={{ width:40, height:40, borderRadius:10, background:`${color}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{title}</span>
                {badge && (
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:99, background:`${color}22`, color, letterSpacing:"0.04em" }}>
                    {badge}
                  </span>
                )}
              </div>
              <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.5 }}>{sub}</div>
            </div>
            <ChevronDown size={14} style={{ color:C.textFaint, transform:"rotate(-90deg)", flexShrink:0, marginTop:4 }} />
          </button>
        ))}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: FORM
  // ─────────────────────────────────────────────────────────────────────────────
  const modeInfo = MODES.find(m => m.id === mode)!;

  const migrationSection = mode === "migrate" && (
    <div>
      <div style={{ fontSize:12, fontWeight:700, color:C.textFaint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
        Import sources
        <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, marginLeft:6, color:C.textFaint }}>— select at least one</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

        {/* CSV file */}
        <MigRow
          checked={migration.csvFile}
          onToggle={() => { toggleMig("csvFile"); if (!migration.csvFile) setTimeout(() => csvRef.current?.click(), 80); }}
          icon={<FileText size={15} style={{ color:"#22c55e" }} />}
          label="CSV / spreadsheet"
          sub="Upload a file with your existing bookings"
          C={C}
        >
          {migration.csvFile && (
            <div style={{ marginTop:8 }}>
              <input
                ref={csvRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv"
                onChange={e => setMigField("csvData", e.target.files?.[0] ?? null)}
                style={{ display:"none" }}
              />
              <button
                type="button"
                onClick={() => csvRef.current?.click()}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, border:`1.5px dashed ${C.border}`, background:"none", color:C.textMuted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}
              >
                <UploadCloud size={14} />
                {migration.csvData ? migration.csvData.name : "Choose file…"}
              </button>
              {migration.csvData && (
                <div style={{ marginTop:6, fontSize:11, color:C.accent, display:"flex", alignItems:"center", gap:5 }}>
                  <Check size={11} strokeWidth={3} /> File ready — will be processed after shop creation
                </div>
              )}
            </div>
          )}
        </MigRow>

        {/* ElevenLabs agent */}
        <MigRow
          checked={migration.elevenLabs}
          onToggle={() => toggleMig("elevenLabs")}
          icon={<Bot size={15} style={{ color:"#f97316" }} />}
          label="ElevenLabs agent"
          sub="Pull conversations from another agent ID"
          C={C}
        >
          {migration.elevenLabs && (
            <input
              value={migration.elAgentId}
              onChange={e => setMigField("elAgentId", e.target.value)}
              placeholder="agent_XXXXXXXXXXXXXXXXXXXX"
              style={{ ...inp, marginTop:8, fontSize:12, fontFamily:"monospace" }}
              autoFocus
            />
          )}
        </MigRow>

        {/* Other booking platform */}
        <MigRow
          checked={migration.otherPlatform}
          onToggle={() => toggleMig("otherPlatform")}
          icon={<Globe size={15} style={{ color:"#a855f7" }} />}
          label="Other booking system"
          sub="Treatwell, Fresha, Booksy, or any other platform"
          C={C}
        >
          {migration.otherPlatform && (
            <input
              value={migration.otherUrl}
              onChange={e => setMigField("otherUrl", e.target.value)}
              placeholder="https://your-platform.com/export"
              style={{ ...inp, marginTop:8, fontSize:12 }}
              autoFocus
            />
          )}
        </MigRow>

        {/* Manual later */}
        <MigRow
          checked={migration.manualLater}
          onToggle={() => toggleMig("manualLater")}
          icon={<Clock size={15} style={{ color:C.textMuted }} />}
          label="I'll add data manually"
          sub="Start with an empty shop and enter past bookings by hand"
          C={C}
        />

      </div>
    </div>
  );

  const demoSection = mode === "demo" && (
    <div style={{ padding:"14px 16px", borderRadius:12, background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.2)" }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#a855f7", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>
        <BarChart2 size={13} /> What will be generated
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px", fontSize:12, color:C.textMuted, lineHeight:1.7 }}>
        <div>• 30–40 realistic bookings</div>
        <div>• ~60% AI agent calls</div>
        <div>• Walk-ins & manual entries</div>
        <div>• Completed, missed & cancelled</div>
        <div>• 3-month date spread</div>
        <div>• Barbers named from your shop</div>
      </div>
    </div>
  );

  const buttonLabel = (() => {
    if (generatingDemo) return "Generating data…";
    if (submitting)     return "Creating…";
    if (mode === "demo") return "Create & generate data";
    return "Create shop";
  })();

  const formContent = (
    <div style={{
      position:"relative", zIndex:1, width:"100%", maxWidth:580,
      maxHeight:"90vh", display:"flex", flexDirection:"column",
      background:C.surface, border:`1px solid ${C.border}`, borderRadius:20,
      boxShadow:"0 24px 80px rgba(0,0,0,.5)", overflow:"hidden",
      animation:"gbf-fadeIn .2s ease",
    }}>
      {/* Header */}
      <div style={{ padding:"14px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <button
          type="button"
          onClick={goBack}
          style={{ background:C.borderFaint, border:"none", borderRadius:99, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.textMuted, flexShrink:0 }}
        >
          <ChevronLeft size={15} />
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"var(--gbf-font-display)", fontSize:16, fontWeight:700, color:C.text }}>Add a barbershop</div>
        </div>
        {modeInfo && (
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:99, background:`${modeInfo.color}22`, color:modeInfo.color, letterSpacing:"0.04em", flexShrink:0 }}>
            {modeInfo.title}
          </span>
        )}
        <button onClick={onClose} style={{ background:C.borderFaint, border:"none", borderRadius:99, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.textMuted, flexShrink:0 }}>
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:20, flex:1 }}>

          {/* ── Quick-fill ──────────────────────────────────────────────── */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.textFaint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Quick fill</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button
                type="button"
                onClick={fillDemo}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 14px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.surfaceAlt, color:C.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"border-color .15s, background .15s", flexShrink:0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; (e.currentTarget as HTMLButtonElement).style.background = C.accentLight; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.background = C.surfaceAlt; }}
              >
                <Wand2 size={14} style={{ color:C.accent }} />
                Auto-fill demo
              </button>
            </div>

            {filledFrom && (
              <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.accent }}>
                <Check size={12} strokeWidth={3} />
                Filled with demo data — review and adjust below
              </div>
            )}
          </div>

          {/* ── Core fields ───────────────────────────────────────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div style={{ ...fw, gridColumn:"1/-1" }}>
              <label style={lbl}>Business name *</label>
              <input value={form.name} onChange={setField("name")} placeholder="e.g. Kostas Barbershop" style={inp} required />
            </div>
            <div style={fw}>
              <label style={lbl}><Phone size={10} style={{ display:"inline", marginRight:4 }} />Phone *</label>
              <input value={form.phone} onChange={setField("phone")} placeholder="+30 21 0000 0000" style={inp} type="tel" />
            </div>
            <div style={fw}>
              <label style={lbl}><Mail size={10} style={{ display:"inline", marginRight:4 }} />Email</label>
              <input value={form.email} onChange={setField("email")} placeholder="shop@example.com" style={inp} type="email" />
            </div>
            <div style={{ ...fw, gridColumn:"1/-1" }}>
              <label style={lbl}><MapPin size={10} style={{ display:"inline", marginRight:4 }} />Address</label>
              <input value={form.address} onChange={setField("address")} placeholder="Street & number" style={inp} />
            </div>
            <div style={fw}>
              <label style={lbl}>City</label>
              <input value={form.city} onChange={setField("city")} placeholder="Athens" style={inp} />
            </div>
            <div style={fw}>
              <label style={lbl}>Country</label>
              <input value={form.country} onChange={setField("country")} placeholder="Greece" style={inp} />
            </div>
            <div style={fw}>
              <label style={lbl}><Globe size={10} style={{ display:"inline", marginRight:4 }} />Website</label>
              <input value={form.website} onChange={setField("website")} placeholder="https://…" style={inp} type="url" />
            </div>
            <div style={fw}>
              <label style={lbl}><Clock size={10} style={{ display:"inline", marginRight:4 }} />Timezone *</label>
              <div style={{ position:"relative" }}>
                <select value={form.timezone} onChange={setField("timezone")} style={{ ...inp, paddingRight:32, appearance:"none", cursor:"pointer" }}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g," ")}</option>)}
                </select>
                <ChevronDown size={14} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:C.textFaint }} />
              </div>
            </div>
            <div style={{ ...fw, gridColumn:"1/-1" }}>
              <label style={lbl}>Short description</label>
              <textarea value={form.description} onChange={setField("description") as unknown as React.ChangeEventHandler<HTMLTextAreaElement>}
                placeholder="A few words about your barbershop…"
                rows={2}
                style={{ ...inp, resize:"vertical", minHeight:64, lineHeight:1.5 }}
              />
            </div>
          </div>

          {/* ── Business hours ─────────────────────────────────────────────── */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:C.textFaint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Business Hours</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {DAYS.map(({ key, label }) => {
                const h = hours[key] ?? { open:"09:00", close:"18:00", closed:false };
                return (
                  <div key={key} style={{ display:"grid", gridTemplateColumns:"44px 1fr", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.textMuted }}>{label}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <button
                        type="button"
                        onClick={() => setDayHours(key, { closed: !h.closed })}
                        style={{ width:36, height:20, borderRadius:99, border:"none", cursor:"pointer", position:"relative", flexShrink:0, background: h.closed ? C.borderFaint : C.accent, transition:"background .15s" }}
                      >
                        <span style={{ position:"absolute", top:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .15s", left: h.closed ? 2 : 18 }} />
                      </button>
                      {h.closed ? (
                        <span style={{ fontSize:12, color:C.textFaint }}>Closed</span>
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <input type="time" value={h.open}  onChange={e => setDayHours(key, { open:  e.target.value })} style={{ ...inp, width:100, padding:"5px 8px", fontSize:13 }} />
                          <span style={{ fontSize:12, color:C.textFaint }}>–</span>
                          <input type="time" value={h.close} onChange={e => setDayHours(key, { close: e.target.value })} style={{ ...inp, width:100, padding:"5px 8px", fontSize:13 }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Team / Barbers ─────────────────────────────────────────────── */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:C.textFaint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <Users size={13} style={{ color:C.textFaint }} />
                Team / Barbers
                <span style={{ fontSize:11, fontWeight:500, textTransform:"none", letterSpacing:0, color:C.textFaint }}>({barbers.length}/{MAX_BARBERS})</span>
              </div>
              {mode === "demo" && (
                <button
                  type="button"
                  onClick={() => randomizeBarbers(barbers.length)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.accent, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"border-color .15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = C.border}
                >
                  <Wand2 size={11} /> Randomize all
                </button>
              )}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {barbers.map((barber, bi) => (
                <div key={barber._id} style={{ border:`1.5px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>

                  {/* Card header: number badge + name input + remove */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.surfaceAlt, borderBottom:`1px solid ${C.borderFaint}` }}>
                    <span style={{ fontSize:11, fontWeight:800, color:C.accent, background:C.accentLight, minWidth:22, height:22, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, letterSpacing:"-0.02em" }}>{bi + 1}</span>
                    <input
                      value={barber.name}
                      onChange={e => setBarberName(bi, e.target.value)}
                      placeholder="Barber name (required)…"
                      style={{ ...inp, border:"none", background:"transparent", padding:"0", fontSize:14, fontWeight:600, flex:1, minWidth:0 }}
                    />
                    {barbers.length > MIN_BARBERS && (
                      <button
                        type="button"
                        onClick={() => removeBarber(bi)}
                        title="Remove barber"
                        style={{ width:26, height:26, borderRadius:7, border:`1px solid ${C.borderFaint}`, background:"none", color:C.textFaint, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"border-color .15s, color .15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.red; (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderFaint; (e.currentTarget as HTMLButtonElement).style.color = C.textFaint; }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Services */}
                  <div style={{ padding:"12px 14px" }}>

                    {/* Chip picker */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom: barber.services.length > 0 ? 10 : 0 }}>
                      {SERVICE_CATALOGUE.map(svc => {
                        const active = barber.services.some(s => s.name === svc.name);
                        return (
                          <button
                            key={svc.name}
                            type="button"
                            onClick={() => toggleService(bi, svc)}
                            style={{ fontSize:11, padding:"4px 10px", borderRadius:99, fontFamily:"inherit", cursor:"pointer", transition:"all .12s", border:`1px solid ${active ? C.accent : C.border}`, background: active ? C.accentLight : "transparent", color: active ? C.accent : C.textMuted, fontWeight: active ? 700 : 500 }}
                          >
                            {active ? "✓ " : ""}{svc.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Added services — editable rows */}
                    {barber.services.length > 0 && (
                      <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
                        {barber.services.map((svc, si) => (
                          <div key={svc._id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <input
                              value={svc.name}
                              onChange={e => setServiceField(bi, si, { name: e.target.value })}
                              placeholder="Service name"
                              style={{ ...inp, flex:1, padding:"6px 10px", fontSize:12 }}
                            />
                            <div style={{ position:"relative", flexShrink:0 }}>
                              <span style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", fontSize:12, color:C.textFaint, pointerEvents:"none" }}>€</span>
                              <input
                                value={svc.price || ""}
                                onChange={e => setServiceField(bi, si, { price: Number(e.target.value) || 0 })}
                                type="number"
                                min="0"
                                placeholder="0"
                                style={{ ...inp, width:72, paddingLeft:22, padding:"6px 8px 6px 22px", fontSize:12 }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeService(bi, si)}
                              style={{ width:24, height:24, borderRadius:6, border:`1px solid ${C.borderFaint}`, background:"none", color:C.textFaint, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"border-color .15s, color .15s" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.red; (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderFaint; (e.currentTarget as HTMLButtonElement).style.color = C.textFaint; }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add custom service */}
                    <button
                      type="button"
                      onClick={() => addCustomService(bi)}
                      style={{ fontSize:12, color:C.accent, background:"none", border:"none", cursor:"pointer", padding:"2px 0", fontFamily:"inherit", fontWeight:600, display:"flex", alignItems:"center", gap:5, opacity:0.8, transition:"opacity .12s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"}
                    >
                      <span style={{ fontSize:16, lineHeight:1 }}>+</span> Add custom service
                    </button>
                  </div>
                </div>
              ))}

              {/* Add barber button */}
              {barbers.length < MAX_BARBERS && (
                <button
                  type="button"
                  onClick={addBarber}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px", borderRadius:14, border:`1.5px dashed ${C.border}`, background:"transparent", color:C.textMuted, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"border-color .15s, color .15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; (e.currentTarget as HTMLButtonElement).style.color = C.accent; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted; }}
                >
                  <Users size={13} /> Add barber
                </button>
              )}
            </div>
          </div>

          {/* ── Mode-specific sections ─────────────────────────────────────── */}
          {migrationSection}
          {demoSection}

          {/* ── ElevenLabs note ───────────────────────────────────────────── */}
          <div style={{ padding:"12px 14px", borderRadius:10, background:C.surfaceAlt, border:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"flex-start" }}>
            <Bot size={14} style={{ color:C.accent, flexShrink:0, marginTop:1 }} />
            <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.5 }}>
              The shared ElevenLabs agent will be automatically linked to this shop. All future calls made through it will be recorded under this shop&apos;s data.
            </div>
          </div>

          {error && (
            <div ref={errorRef} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:C.redLight, border:`1px solid ${C.red}44`, borderRadius:10, fontSize:13, color:C.red }}>
              <AlertCircle size={14} style={{ flexShrink:0 }} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:`1px solid ${C.border}`, display:"flex", gap:10, justifyContent:"flex-end", flexShrink:0, background:C.surface }}>
          <button type="button" onClick={onClose} style={{ padding:"10px 20px", borderRadius:10, border:`1px solid ${C.border}`, background:"none", color:C.textMuted, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || generatingDemo}
            style={{ padding:"10px 24px", borderRadius:10, border:"none", background:(submitting || generatingDemo) ? C.accentLight : C.accent, color:(submitting || generatingDemo) ? C.accentMid : C.bg, fontSize:14, fontWeight:800, cursor:(submitting || generatingDemo) ? "not-allowed" : "pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8 }}
          >
            {(submitting || generatingDemo) && <Loader size={14} style={{ animation:"gbf-spin 1s linear infinite" }} />}
            {buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );

  // ── Wrapper ───────────────────────────────────────────────────────────────────
  const modal = (
    <div style={{ position:"fixed", inset:0, zIndex:10002, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.65)", backdropFilter:"blur(4px)" }} />
      {step === "choose" ? chooseContent : formContent}
      <style>{`
        @keyframes gbf-spin  { to { transform: rotate(360deg); } }
        @keyframes gbf-fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

// ── Migration row helper ──────────────────────────────────────────────────────
function MigRow({
  checked, onToggle, icon, label, sub, C, children,
}: {
  checked:  boolean;
  onToggle: () => void;
  icon:     React.ReactNode;
  label:    string;
  sub:      string;
  C:        Record<string, string>;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderRadius:10, border:`1.5px solid ${checked ? C.accent : C.border}`, background: checked ? C.accentLight : C.surfaceAlt, transition:"border-color .15s, background .15s", overflow:"hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"10px 14px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}
      >
        <div style={{ width:28, height:28, borderRadius:7, background: checked ? `${C.accent}22` : C.borderFaint, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background .15s" }}>
          {icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</div>
          <div style={{ fontSize:11, color:C.textMuted, marginTop:1 }}>{sub}</div>
        </div>
        <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checked ? C.accent : C.border}`, background: checked ? C.accent : "none", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
          {checked && <Check size={10} strokeWidth={3} style={{ color:C.bg }} />}
        </div>
      </button>
      {children && <div style={{ padding:"0 14px 12px" }}>{children}</div>}
    </div>
  );
}
