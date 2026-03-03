"use client";

import { useState } from "react";
import useSWR from "swr";
import SignalCard from "@/components/SignalCard";
import { Signal, SignalUrgency } from "@/lib/types";

async function fetchSignals(): Promise<Signal[]> {
  const res = await fetch("/api/signals");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.signals || [];
}

type FilterTab = "all" | "critical" | "notable" | "info";

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: "all", label: "All Signals", icon: "📡" },
  { key: "critical", label: "Critical", icon: "🔴" },
  { key: "notable", label: "Notable", icon: "🟡" },
  { key: "info", label: "Informational", icon: "🟢" },
];

export default function SignalsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const {
    data: signals,
    error,
    isLoading,
  } = useSWR("signals", fetchSignals, {
    revalidateOnFocus: false,
    refreshInterval: 600_000,
  });

  const allSignals = signals || [];
  const criticalCount = allSignals.filter((s) => s.urgency === "critical").length;
  const notableCount = allSignals.filter((s) => s.urgency === "notable").length;
  const infoCount = allSignals.filter((s) => s.urgency === "info").length;

  const filtered =
    activeTab === "all"
      ? allSignals
      : allSignals.filter((s) => s.urgency === activeTab);

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">🚨 Signals & Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Intelligence feed — research findings and risk alerts from ecosystem scans
        </p>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Total Signals
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-100">
                {allSignals.length}
              </p>
            </div>
            <span className="text-2xl opacity-60">📡</span>
          </div>
        </div>
        {/* Critical */}
        <div className="bg-gray-900 border border-red-500/15 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-red-400/70 uppercase tracking-wide">
                Critical
              </p>
              <p className="mt-2 text-2xl font-bold text-red-400">
                {criticalCount}
              </p>
            </div>
            <span className="text-2xl opacity-60">🔴</span>
          </div>
        </div>
        {/* Notable */}
        <div className="bg-gray-900 border border-amber-500/15 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-amber-400/70 uppercase tracking-wide">
                Notable
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-400">
                {notableCount}
              </p>
            </div>
            <span className="text-2xl opacity-60">🟡</span>
          </div>
        </div>
        {/* Informational */}
        <div className="bg-gray-900 border border-emerald-500/15 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-400/70 uppercase tracking-wide">
                Informational
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {infoCount}
              </p>
            </div>
            <span className="text-2xl opacity-60">🟢</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs — matching Morpho page style */}
      <div className="flex items-center gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-gray-700 text-gray-100 font-medium"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}{" "}
            {tab.label}
            {tab.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-60">
                ({tab.key === "critical"
                  ? criticalCount
                  : tab.key === "notable"
                  ? notableCount
                  : infoCount})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
          ❌ {error.message}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-pulse">Loading signals...</div>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && !isLoading && !error && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-sm">
            {activeTab === "all"
              ? "No signals detected yet. Check back after the next research scan."
              : `No ${activeTab} signals. Adjust filters to see more.`}
          </p>
        </div>
      )}

      {/* Signal Cards */}
      <div className="flex flex-col gap-4">
        {filtered.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
