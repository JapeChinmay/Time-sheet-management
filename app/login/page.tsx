"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

/* 🔥 Convert lat/lng → DMS */
function toDMS(value: number, isLat: boolean) {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  const seconds = (((abs - degrees) * 60 - minutes) * 60).toFixed(1);

  const direction = isLat
    ? value >= 0 ? "N" : "S"
    : value >= 0 ? "E" : "W";

  return `${degrees}°${minutes}'${seconds}"${direction}`;
}


async function sendAuditLog(userId: number) {
  const sendPayload = async (location: string) => {
    const userAgent = navigator.userAgent;

    let browser = "Unknown";
    if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Safari")) browser = "Safari";

    const platform = navigator.platform;

    const payload = {
      userId,
      eventType: "LOGIN",
      loggedInAt: new Date().toISOString(),
      location,
      platform,
      browser,
    };

    try {
      await apiFetch("/audit/log", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Audit log failed", err);
    }
  };

  if (!navigator.geolocation) {
    sendPayload("Unavailable");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      const latDMS = toDMS(latitude, true);
      const lngDMS = toDMS(longitude, false);

      const locationString = `${latDMS} ${lngDMS}`;

      sendPayload(locationString);
    },
    () => {
      sendPayload("Permission denied");
    }
  );
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
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const token =
        data.access_token || data.token || data.accessToken;

      if (!token) throw new Error("No token returned");

      localStorage.setItem("token", token);

      /* 🔥 Extract userId from JWT */
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.userId;
      const role = payload.role;

      /* 🔥 Send audit log */
      sendAuditLog(userId);

      /* 🔥 Redirect */
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

        {/* EMAIL */}
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

        {/* PASSWORD */}
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

        {/* ERROR */}
        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">
            {error}
          </p>
        )}

        {/* BUTTON */}
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

        {/* FOOTER */}
        <p className="text-sm text-slate-500 text-center mt-6">
          Don’t have an account?{" "}
          <Link
            href="/signup"
            className="text-slate-800 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}