"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";

function getBrowser(ua: string) {
  if (ua.includes("Chrome"))  return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari"))  return "Safari";
  return "Unknown";
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ latitude: 0, longitude: 0 });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      ()    => resolve({ latitude: 0, longitude: 0 })
    );
  });
}

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    setError("");

    try {
      const { latitude, longitude } = await getLocation();

      const result = await signIn("credentials", {
        redirect:  false,
        email,
        password,
        latitude:  String(latitude),
        longitude: String(longitude),
        browser:   getBrowser(navigator.userAgent),
        system:    navigator.platform,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      const session = await getSession();
      const role    = session?.user?.role ?? "";

      if (role === "ADMIN" || role === "SUPERADMIN") {
        router.push("/admin");
      } else if (role === "MANAGER") {
        router.push("/manager/timesheets");
      } else {
        router.push("/employee");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-white via-slate-50 to-slate-100">
      <div className="w-full max-w-sm p-8 bg-white/90 backdrop-blur rounded-xl shadow-md border border-slate-200">

        <div className="mb-7 text-center">
          <h2 className="text-[22px] font-medium tracking-tight text-slate-800">
            Sign in to your account
          </h2>
          <p className="text-sm text-slate-500 mt-1">Enter your credentials to continue</p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Signing in...
            </>
          ) : "Sign in"}
        </button>

      </div>
    </div>
  );
}
