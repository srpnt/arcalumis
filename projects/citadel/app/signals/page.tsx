"use client";

import { useState } from "react";
import useSWR from "swr";
import SignalCard from "@/components/SignalCard";
import MetricCard from "@/components/MetricCard";
import { Signal, SignalUrgency } from "@/lib/types";

async function fetchSignals(): Promise<Signal[]> {
  const res = await fetch("/api/signals");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.signals || [];
}

const URGENCY_FILTERS: { key: SignalUrgency; label: string; emoji: string }[] = [
  { key: "critical", label: "Critical", emoji: "🔴" },
  { key: "notable", label: "Notable", emoji: "🟡" },
  { key: "info", label: "Info", emoji: "🟢" },
];

export default function SignalsPage() {
  const [activeFilters, setActiveFilters] = useState<Set<SignalUrgency>>(
    new Set(["critical", "notable", "info"])
  );

  const { data: signals, error, isLoading } = useSWR(
    "signals",
    fetchSignals,
    { revalidateOnFocus: false, refreshInterval: 600_000 }
  );

  const toggleFilter = (urgency: SignalUrgency) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(urgency)) {
        next.delete(urgency);
      } else {
        next.add(urgency);
      }
      return next;
    });
  };

  const filtered = (signals || []).filter((s) => activeFilters.has(s.urgency));

  const criticalCount = (signals || []).filter(
    (s) => s.urgency === "critical"
  ).length;
  const notableCount = (signals || []).filter(
    (s) => s.urgency === "notable"
  ).length;
  const infoCount = (signals || []).filter((s) => s.urgency === "info").length;

  return (
    <div className="pt-8 md:pt-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">🚨 Signals & Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Research findings and risk alerts from ecosystem scans
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Signals"
          value={String((signals || []).length)}
          icon="📡"
        />
        <MetricCard
          label="🔴 Critical"
          value={String(criticalCount)}
          icon="🔴"
        />
        <MetricCard
          label="🟡 Notable"
          value={String(notableCount)}
          icon="🟡"
        />
        <MetricCard label="🟢 Info" value={String(infoCount)} icon="🟢" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 mr-2">Filter:</span>
        {URGENCY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => toggleFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeFilters.has(f.key)
                ? f.key === "critical"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : f.key === "notable"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-gray-800 border-gray-700 text-gray-500"
            }`}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
          ❌ {error.message}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading signals...
        </div>
      )}

      {/* Signal Cards */}
      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No signals match the current filter. Try adjusting the filters above.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
