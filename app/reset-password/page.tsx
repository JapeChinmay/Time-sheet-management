"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2, XCircle } from "lucide-react";

function ResetPasswordInner() {
  const router      = useRouter();
  const params      = useSearchParams();
  const token       = params.get("token") ?? "";

  const [checking,  setChecking]  = useState(true);
  const [valid,     setValid]     = useState(false);
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  /* Validate token on mount */
  useEffect(() => {
    if (!token) { setChecking(false); return; }
    fetch(`/api/auth/validate-reset/${token}`)
      .then((r) => r.json())
      .then((d) => setValid(d.valid === true))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const submit = async () => {
    setError("");
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? "Failed to reset password.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* Loading */
  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 size={28} className="animate-spin text-slate-400" />
    </div>
  );

  /* Invalid / expired token */
  if (!token || !valid) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 max-w-sm w-full text-center space-y-4">
        <XCircle size={40} className="text-red-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900">Link Expired or Invalid</h2>
        <p className="text-sm text-slate-500">This password reset link is no longer valid. Please ask your admin to resend the welcome email.</p>
        <button onClick={() => router.push("/login")}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition">
          Go to Login
        </button>
      </div>
    </div>
  );

  /* Success */
  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 max-w-sm w-full text-center space-y-4">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900">Password Set!</h2>
        <p className="text-sm text-slate-500">Redirecting you to login…</p>
      </div>
    </div>
  );

  /* Form */
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 max-w-sm w-full space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <KeyRound size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Set Your Password</h2>
            <p className="text-xs text-slate-400">Choose a strong password to get started</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full border border-slate-200 px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
              <button onClick={() => setShowPwd((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Confirm Password</label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Repeat password"
              className="w-full border border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 size={15} className="animate-spin" /> Setting password…</> : "Set Password"}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
