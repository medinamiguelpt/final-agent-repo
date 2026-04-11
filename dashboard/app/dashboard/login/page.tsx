"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, ArrowRight, Scissors, Clock, Eye, EyeOff } from "lucide-react";

const C = {
  bg: "#F5F0E8",
  surface: "#FFFFFF",
  surfaceAlt: "#FAF7F2",
  border: "#E0D5C5",
  accent: "#3D4F35",
  accentMid: "#6B7D60",
  accentLight: "#EAF0E6",
  text: "#2A2520",
  textMuted: "#7A6F64",
  textFaint: "#B0A898",
  red: "#B04040",
  redLight: "#FDF0F0",
};

type View = "login" | "signup" | "pending" | "forgot";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
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
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: `0 0 0 8px ${C.accent}12`,
            }}
          >
            <Scissors size={26} style={{ color: C.accent }} />
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.text }}>
            Barber Dashboard
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
