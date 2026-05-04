"use client";

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

function StatCardSk() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <Sk className="w-9 h-9 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Sk className="h-3 w-20" />
        <Sk className="h-6 w-12" />
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <Sk className="h-8 w-56" />
        <Sk className="h-4 w-40" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <StatCardSk key={i} />)}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="space-y-1.5">
              <Sk className="h-4 w-28" />
              <Sk className="h-3 w-52" />
            </div>
            <Sk className="h-3 w-20" />
          </div>
          <div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3 border-b border-slate-100 last:border-0">
                <Sk className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sk className="h-3.5 w-32" />
                    <Sk className="h-4 w-14 rounded-full" />
                  </div>
                  <Sk className="h-2.5 w-24" />
                  <Sk className="h-1.5 w-full rounded-full mt-1.5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Sk className="h-5 w-16 rounded-full" />
                  <Sk className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 space-y-1.5">
            <Sk className="h-4 w-28" />
            <Sk className="h-3 w-40" />
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Sk className="h-3.5 w-32" />
                  <div className="flex gap-2">
                    <Sk className="h-4 w-14 rounded-full" />
                    <Sk className="h-4 w-8" />
                  </div>
                </div>
                <Sk className="h-1.5 w-full rounded-full" />
                <Sk className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <Sk className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="space-y-1.5">
              <Sk className="h-3 w-32" />
              <Sk className="h-7 w-16" />
              <Sk className="h-2.5 w-40" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sk className="h-4 w-4" />
            <Sk className="h-4 w-32" />
          </div>
          <Sk className="h-3 w-24" />
        </div>
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4 border-b border-slate-100 last:border-0">
              <Sk className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3.5 w-36" />
                <Sk className="h-2.5 w-48" />
                <Sk className="h-2.5 w-32" />
              </div>
              <div className="space-y-1 text-right">
                <Sk className="h-3 w-12 ml-auto" />
                <Sk className="h-3 w-10 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Sk className="h-8 w-48" />
        <Sk className="h-4 w-64" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Sk className="h-9 w-36 rounded-lg" />
        <Sk className="h-9 w-36 rounded-lg" />
        <Sk className="h-9 w-32 rounded-lg" />
        <Sk className="h-9 w-28 rounded-lg ml-auto" />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex gap-6">
          <Sk className="h-3.5 w-28" />
          <Sk className="h-3.5 w-20" />
          <Sk className="h-3.5 w-20" />
          <Sk className="h-3.5 w-16 ml-auto" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <Sk className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3.5 w-40" />
                <Sk className="h-2.5 w-28" />
              </div>
              <Sk className="h-5 w-16 rounded-full" />
              <Sk className="h-5 w-20 rounded-full" />
              <Sk className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Sk className="h-4 w-32" />
        <div className="flex gap-2">
          <Sk className="h-8 w-8 rounded" />
          <Sk className="h-8 w-8 rounded" />
          <Sk className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  );
}

function ProjectCardSk() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <Sk className="w-10 h-10 rounded-lg" />
        <Sk className="h-5 w-14 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Sk className="h-5 w-40" />
        <Sk className="h-3.5 w-full" />
        <Sk className="h-3.5 w-3/4" />
      </div>
      <div className="space-y-1.5">
        <Sk className="h-3 w-28" />
        <Sk className="h-3 w-24" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="w-7 h-7 rounded-full ring-2 ring-white" />
          ))}
        </div>
        <Sk className="h-3 w-16" />
      </div>
    </div>
  );
}

export function ProjectsGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-32" />
          <Sk className="h-4 w-48" />
        </div>
        <Sk className="h-9 w-28 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Sk className="h-9 w-48 rounded-lg" />
        <Sk className="h-9 w-32 rounded-lg" />
        <Sk className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <ProjectCardSk key={i} />)}
      </div>
    </div>
  );
}

export function LeavesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-36" />
          <Sk className="h-4 w-52" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <Sk className="h-4 w-32" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Sk className="h-7 w-12" />
              <Sk className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-5 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <Sk className="h-4 w-28" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-start gap-4">
              <Sk className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sk className="h-4 w-24" />
                  <Sk className="h-5 w-16 rounded-full" />
                </div>
                <Sk className="h-3 w-40" />
                <Sk className="h-3 w-56" />
              </div>
              <Sk className="h-5 w-20 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Sk className="h-9 w-24 rounded-lg" />

      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start gap-5">
        <Sk className="w-16 h-16 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Sk className="h-6 w-48" />
          <Sk className="h-4 w-36" />
          <div className="flex gap-2 pt-1">
            <Sk className="h-5 w-16 rounded-full" />
            <Sk className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Sk className="h-9 w-24 rounded-lg" />
          <Sk className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
            <Sk className="h-3 w-20" />
            <Sk className="h-7 w-12" />
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <Sk className="h-4 w-32" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <Sk className="h-3.5 w-24 flex-shrink-0" />
              <Sk className="h-3.5 w-32 flex-1" />
              <Sk className="h-3.5 w-12" />
              <Sk className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <Sk className="h-4 w-28" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <Sk className="h-3.5 w-20 flex-shrink-0" />
              <Sk className="h-3.5 w-36 flex-1" />
              <Sk className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LeavePoliciesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-40" />
          <Sk className="h-4 w-56" />
        </div>
        <Sk className="h-9 w-36 rounded-lg" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <Sk className="h-5 w-36" />
              <Sk className="h-5 w-5 rounded" />
            </div>
            <Sk className="h-3.5 w-full" />
            <div className="space-y-2">
              <Sk className="h-3 w-24" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Sk key={j} className="h-5 w-20 rounded-full" />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Sk className="h-8 w-20 rounded-lg" />
              <Sk className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimesheetAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Sk className="h-8 w-52" />
        <Sk className="h-4 w-48" />
      </div>
      <div className="flex items-center gap-3">
        <Sk className="h-4 w-24" />
        <Sk className="h-9 w-48 rounded-lg" />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSk key={i} />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <Sk className="h-4 w-36" />
            <Sk className="h-48 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <Sk className="h-4 w-32" />
        <Sk className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}
