"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, ArrowRight, Clock, Eye, EyeOff } from "lucide-react";

// ── Theme palette map (mirrors PALETTES in dashboard/page.tsx) ────────────────
const PALETTES = {
  calbliss: {
    light: {
      bg: "#FAFAFF",
      surface: "#F0EBFF",
      surfaceAlt: "#EDE9FE",
      border: "#E4DCFF",
      accent: "#7C3AED",
      accentMid: "#A78BFA",
      accentLight: "#EDE9FE",
      text: "#1A1027",
      textMuted: "#6B6880",
      textFaint: "#9B95B0",
      red: "#EF4444",
      redLight: "#FEE2E2",
    },
    dark: {
      bg: "#0D0714",
      surface: "#16102A",
      surfaceAlt: "#1E1535",
      border: "#2D1F4E",
      accent: "#A78BFA",
      accentMid: "#7C3AED",
      accentLight: "#2D1F4E",
      text: "#F0EEFF",
      textMuted: "#9B95B0",
      textFaint: "#6B6880",
      red: "#F87171",
      redLight: "#450A0A",
    },
  },
  cream: {
    light: {
      bg: "#FAFAF7",
      surface: "#FFFFFF",
      surfaceAlt: "#F5F0E8",
      border: "#E7DFD0",
      accent: "#D97706",
      accentMid: "#F59E0B",
      accentLight: "#FEF3C7",
      text: "#1C1917",
      textMuted: "#78716C",
      textFaint: "#A8A29E",
      red: "#DC2626",
      redLight: "#FEE2E2",
    },
    dark: {
      bg: "#1C1510",
      surface: "#2C201A",
      surfaceAlt: "#352A20",
      border: "#3D2E24",
      accent: "#F59E0B",
      accentMid: "#FCD34D",
      accentLight: "#3D2008",
      text: "#FEF3C7",
      textMuted: "#A8917A",
      textFaint: "#6B5C4A",
      red: "#F87171",
      redLight: "#450A0A",
    },
  },
  slate: {
    light: {
      bg: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceAlt: "#F1F5F9",
      border: "#E2E8F0",
      accent: "#6366F1",
      accentMid: "#A5B4FC",
      accentLight: "#EEF2FF",
      text: "#1E293B",
      textMuted: "#64748B",
      textFaint: "#94A3B8",
      red: "#DC2626",
      redLight: "#FEE2E2",
    },
    dark: {
      bg: "#0F172A",
      surface: "#1E293B",
      surfaceAlt: "#283548",
      border: "#334155",
      accent: "#818CF8",
      accentMid: "#6366F1",
      accentLight: "#1E1B4B",
      text: "#E2E8F0",
      textMuted: "#94A3B8",
      textFaint: "#475569",
      red: "#F87171",
      redLight: "#450A0A",
    },
  },
  teal: {
    light: {
      bg: "#F0FDFA",
      surface: "#FFFFFF",
      surfaceAlt: "#CCFBF1",
      border: "#99F6E4",
      accent: "#0D9488",
      accentMid: "#14B8A6",
      accentLight: "#CCFBF1",
      text: "#134E4A",
      textMuted: "#3B7A74",
      textFaint: "#6DA8A0",
      red: "#DC2626",
      redLight: "#FEE2E2",
    },
    dark: {
      bg: "#0D1F22",
      surface: "#142D32",
      surfaceAlt: "#1A363D",
      border: "#1F4246",
      accent: "#14B8A6",
      accentMid: "#5EEAD4",
      accentLight: "#0D332E",
      text: "#F0FDFA",
      textMuted: "#7CC4BC",
      textFaint: "#3A7068",
      red: "#F87171",
      redLight: "#450A0A",
    },
  },
  contrast: {
    light: {
      bg: "#F3F3F3",
      surface: "#FFFFFF",
      surfaceAlt: "#F3F3F3",
      border: "#CCCCCC",
      accent: "#1A56DB",
      accentMid: "#3B82F6",
      accentLight: "#E8F0FE",
      text: "#111111",
      textMuted: "#444444",
      textFaint: "#777777",
      red: "#DC2626",
      redLight: "#FEE2E2",
    },
    dark: {
      bg: "#0A0A0A",
      surface: "#1A1A1A",
      surfaceAlt: "#222222",
      border: "#333333",
      accent: "#60A5FA",
      accentMid: "#93C5FD",
      accentLight: "#1E3A5F",
      text: "#F9FAFB",
      textMuted: "#999999",
      textFaint: "#555555",
      red: "#F87171",
      redLight: "#450A0A",
    },
  },
  lowvision: {
    light: {
      bg: "#F2F0ED",
      surface: "#ECEAE5",
      surfaceAlt: "#E5E2DC",
      border: "#D0CCC4",
      accent: "#3D5A99",
      accentMid: "#7B96CC",
      accentLight: "#D8E0F0",
      text: "#1A1A1A",
      textMuted: "#6B6560",
      textFaint: "#918C86",
      red: "#B04040",
      redLight: "#F5E0E0",
    },
    dark: {
      bg: "#1E1E20",
      surface: "#2A2A2E",
      surfaceAlt: "#323236",
      border: "#3A3A40",
      accent: "#7B96CC",
      accentMid: "#B8C4DE",
      accentLight: "#28304A",
      text: "#E8E8EA",
      textMuted: "#8A8A90",
      textFaint: "#5A5A62",
      red: "#D08080",
      redLight: "#2E1818",
    },
  },
};

const DEFAULT_C = PALETTES.calbliss.dark;

function resolveTheme() {
  try {
    const saved = localStorage.getItem("gbf-settings");
    if (!saved) return DEFAULT_C;
    const { palette, mode } = JSON.parse(saved);
    const p = PALETTES[palette as keyof typeof PALETTES] ?? PALETTES.calbliss;
    const effectiveMode =
      mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
    return effectiveMode === "dark" ? p.dark : p.light;
  } catch {
    return DEFAULT_C;
  }
}

type View = "login" | "signup" | "pending" | "forgot";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [C] = useState(resolveTheme);
  const [view, setView] = useState<View>(params.get("pending") ? "pending" : "login");
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [view]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profileRaw } = await supabase
        .from("profiles")
        .select("approved")
        .eq("id", session.user.id)
        .single();
      const profile = profileRaw as { approved: boolean } | null;
      if (profile?.approved) router.replace("/dashboard");
    });
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const { data: profileRaw } = await supabase.from("profiles").select("approved").eq("id", data.user.id).single();
    const profile = profileRaw as { approved: boolean } | null;
    if (!profile?.approved) {
      setView("pending");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSuccess("Account created — awaiting admin approval.");
    setView("pending");
    setLoading(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/dashboard`,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSuccess("Check your email for a reset link.");
    setLoading(false);
  }

  const inp: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    border: `1.5px solid ${C.border}`,
    borderRadius: 12,
    background: C.surfaceAlt,
    color: C.text,
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color .15s",
  };

  const btn = (disabled = false): React.CSSProperties => ({
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: disabled ? C.accentLight : C.accent,
    color: disabled ? C.accentMid : "#FFFFFF",
    fontSize: 15,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    transition: "background .15s, transform .1s",
    width: "100%",
    marginTop: 4,
    letterSpacing: "0.02em",
  });

  const label: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: C.textFaint,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'Source Sans 3', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: `0 0 0 8px ${C.accent}12, 0 0 0 1px ${C.border}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/icon.svg"
              alt="TimeBookingPro"
              width={60}
              height={60}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.text }}>
            TimeBookingPro
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.textFaint,
              marginTop: 4,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            AI Receptionist Platform
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: "28px 28px 24px",
            boxShadow: "0 8px 40px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04)",
            animation: "fadeSlideUp .25s ease",
          }}
        >
          {view === "pending" && (
            <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                <Clock size={40} style={{ color: C.textMuted }} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>Pending approval</div>
              <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
                {success || "Your account is awaiting admin approval. You'll be notified once activated."}
              </div>
              <button onClick={() => setView("login")} style={{ ...btn(), marginTop: 0 }}>
                ← Back to sign in
              </button>
            </div>
          )}

          {view === "login" && (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Welcome back</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>Sign in to your dashboard</div>
              </div>
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={label}>Email</label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="demo@barbershop.com"
                    required
                    style={inp}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label style={label}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPass(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{ ...inp, paddingRight: 44 }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: C.textFaint,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div
                    style={{
                      fontSize: 13,
                      color: C.red,
                      background: C.redLight,
                      padding: "10px 14px",
                      borderRadius: 8,
                    }}
                  >
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} style={btn(loading)}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 13 }}>
                <button
                  onClick={() => {
                    setView("forgot");
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: C.textMuted,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Forgot password?
                </button>
                <button
                  onClick={() => {
                    setView("signup");
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: C.accent,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                  }}
                >
                  Create account →
                </button>
              </div>
            </>
          )}

          {view === "signup" && (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Create account</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>Access requires manual approval</div>
              </div>
              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={label}>Full name</label>
                  <input
                    ref={emailRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    style={inp}
                  />
                </div>
                <div>
                  <label style={label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@barbershop.com"
                    required
                    style={inp}
                  />
                </div>
                <div>
                  <label style={label}>Password</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Min. 8 characters"
                    minLength={8}
                    required
                    style={inp}
                  />
                </div>
                {error && (
                  <div
                    style={{
                      fontSize: 13,
                      color: C.red,
                      background: C.redLight,
                      padding: "10px 14px",
                      borderRadius: 8,
                    }}
                  >
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} style={btn(loading)}>
                  {loading ? "Creating account…" : "Request access"}
                </button>
              </form>
              <button
                onClick={() => {
                  setView("login");
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: C.textMuted,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  marginTop: 14,
                  padding: 0,
                }}
              >
                ← Back to sign in
              </button>
            </>
          )}

          {view === "forgot" && (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Reset password</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>We&apos;ll email you a reset link</div>
              </div>
              <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={label}>Email</label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@barbershop.com"
                    required
                    style={inp}
                  />
                </div>
                {error && (
                  <div
                    style={{
                      fontSize: 13,
                      color: C.red,
                      background: C.redLight,
                      padding: "10px 14px",
                      borderRadius: 8,
                    }}
                  >
                    {error}
                  </div>
                )}
                {success && (
                  <div
                    style={{
                      fontSize: 13,
                      color: C.accent,
                      background: C.accentLight,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${C.accent}33`,
                    }}
                  >
                    {success}
                  </div>
                )}
                <button type="submit" disabled={loading} style={btn(loading)}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <button
                onClick={() => {
                  setView("login");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: C.textMuted,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  marginTop: 14,
                  padding: 0,
                }}
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>

        {/* Demo hint */}
        {view === "login" && (
          <button
            type="button"
            onClick={() => {
              setEmail("demo@barbershop.com");
              setPass("demo1234");
            }}
            style={{
              marginTop: 14,
              padding: "14px 16px",
              borderRadius: 14,
              width: "100%",
              background: `${C.accent}0D`,
              border: `1.5px solid ${C.accent}30`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "all .2s cubic-bezier(.4,0,.2,1)",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.background = `${C.accent}20`;
              b.style.borderColor = `${C.accent}60`;
              b.style.transform = "translateY(-1px)";
              b.style.boxShadow = `0 4px 20px ${C.accent}18`;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.background = `${C.accent}0D`;
              b.style.borderColor = `${C.accent}30`;
              b.style.transform = "translateY(0)";
              b.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                flexShrink: 0,
                background: `${C.accent}20`,
                border: `1px solid ${C.accent}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={16} style={{ color: C.accent }} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Try the demo</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", marginTop: 1 }}>
                demo@barbershop.com · demo1234
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                color: C.accent,
                background: `${C.accent}18`,
                padding: "5px 10px",
                borderRadius: 8,
              }}
            >
              Fill in <ArrowRight size={11} strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accent}22 !important; }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
