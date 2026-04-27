"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

function getBrowser(userAgent: string) {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  return "Unknown";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const userAgent = navigator.userAgent;
      const browser = getBrowser(userAgent);
      const system = navigator.platform;

      const getLocation = () =>
        new Promise<{ latitude: number; longitude: number }>(
          (resolve) => {
            if (!navigator.geolocation) {
              resolve({ latitude: 0, longitude: 0 });
              return;
            }

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              () => {
                resolve({ latitude: 0, longitude: 0 });
              }
            );
          }
        );

      const { latitude, longitude } = await getLocation();

      const payload = {
        email,
        password,
        latitude,
        longitude,
        browser,
        system,
      };

      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const token =
        data.access_token || data.token || data.accessToken;

      if (!token) throw new Error("No token returned");

      localStorage.setItem("token", token);

      const decoded = JSON.parse(atob(token.split(".")[1]));
      const role = decoded.role;

      if (role === "ADMIN" || role === "SUPERADMIN") {
        router.push("/admin");
      } else {
        router.push("/employee");
      }

    } catch (err: any) {
      setError(err.message || "Login failed");
    }

    setLoading(false);
  };

  const Spinner = () => (
    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-white via-slate-50 to-slate-100">

      <div className="w-full max-w-sm p-8 bg-white/90 backdrop-blur rounded-xl shadow-md border border-slate-200">

        <div className="mb-7 text-center">
          <h2 className="text-[22px] font-medium tracking-tight text-slate-800">
            Sign in to your account
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Enter your credentials to continue
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email
          </label>
          <input
            placeholder="admin@test.com"
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>

      </div>
    </div>
  );
}