"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // 🔥 add this
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter(); // 🔥

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      console.log("LOGIN RESPONSE:", data);

      const token =
        data.access_token || data.token || data.accessToken;

      if (!token) {
        throw new Error("No token returned");
      }

      localStorage.setItem("token", token);

      // 🔥 Decode token to get role
      const payload = JSON.parse(atob(token.split(".")[1]));
      console.log("USER PAYLOAD:", payload);

      const role = payload.role;

  
      if (role === "ADMIN" || role === "SUPERADMIN") {
        router.push("/admin"); 
      } else {
        router.push("/employee");
      }

    } catch (err: any) {
      console.error("LOGIN ERROR:", err);
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
          <h2 className="text-[22px] font-medium tracking-tight text-slate-800 leading-tight">
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
            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
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
            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

     
        <div className="relative group mb-5 text-center">
          <p className="text-xs text-slate-400 cursor-pointer">
            Need demo credentials?
          </p>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs px-3 py-1.5 rounded shadow">
            admin@test.com / 1234
          </div>
        </div>

     
        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
        )}

      
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition duration-200 disabled:opacity-70"
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