"use client";

import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">

      {/* NAV */}
      <header className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
          <h1 className="text-lg font-semibold text-slate-900">
            WorkPulse
          </h1>

          <button
            onClick={() => router.push("/login")}
            className="text-sm px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 leading-tight">
          Track work.  
          <br />
          Manage time.  
          <br />
          Stay in control.
        </h1>

        <p className="text-slate-500 mt-5 text-lg max-w-2xl mx-auto">
          A simple timesheet and approval system for teams.  
          Submit requests, track work, and keep everything organized.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Get Started
          </button>

          <button className="px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
            Learn More
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-6">
        {[
          {
            title: "Time Tracking",
            desc: "Log work hours quickly without complexity.",
          },
          {
            title: "Leave Requests",
            desc: "Submit and manage leave requests easily.",
          },
          {
            title: "Approvals",
            desc: "Structured approval flow for teams.",
          },
        ].map((f, i) => (
          <div
            key={i}
            className="border border-slate-200 rounded-lg p-6 hover:shadow-sm transition"
          >
            <h3 className="text-md font-semibold text-slate-900">
              {f.title}
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="text-center pb-20">
        <h2 className="text-xl font-semibold text-slate-900">
          Start managing your time better today
        </h2>

        <button
          onClick={() => router.push("/login")}
          className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          Get Started
        </button>
      </section>

    </div>
  );
}