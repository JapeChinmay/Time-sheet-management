"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

const handleSignup = async () => {
  setLoading(true);
  setError("");
  setSuccess("");

  try {
    await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        role: "INTERNAL", // default role
      }),
    });

    setSuccess("Account created. You can login now.");
  } catch (err: any) {
    setError(err.message || "Signup failed");
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
            Create your account
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Start managing your time efficiently
          </p>
        </div>

    
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Full Name
          </label>
          <input
            placeholder="John Doe"
            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

     
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email
          </label>
          <input
            placeholder="you@example.com"
            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

    
        <div className="mb-5 relative group">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            onChange={(e) => setPassword(e.target.value)}
          />

    
          <div className="absolute right-0 -top-6 hidden group-hover:block text-xs bg-slate-800 text-white px-2 py-1 rounded shadow">
            Min 6 characters
          </div>
        </div>

    
        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 mb-4 text-center">{success}</p>
        )}

      
        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition duration-200 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Spinner />
              Creating...
            </>
          ) : (
            "Create account"
          )}
        </button>

      
        <p className="text-sm text-slate-500 text-center mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-slate-800 font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}