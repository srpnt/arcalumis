"use client";

import Link from "next/link";
import type { Signal } from "@/lib/types";

const URGENCY_EMOJI: Record<string, string> = {
  critical: "🔴",
  notable: "🟡",
  info: "🟢",
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "< 1h ago";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

interface RecentSignalsProps {
  signals: Signal[];
}

export default function RecentSignals({ signals }: RecentSignalsProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          Recent Signals
        </h2>
        <Link
          href="/signals"
          className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          View all →
        </Link>
      </div>
      {signals.length === 0 ? (
        <p className="text-xs text-gray-600 italic py-1">
          No signals detected
        </p>
      ) : (
        <div className="space-y-1">
          {signals.slice(0, 3).map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/60 transition-colors"
            >
              <span className="text-sm shrink-0">
                {URGENCY_EMOJI[s.urgency] || "⚪"}
              </span>
              <span className="text-xs text-gray-300 truncate flex-1">
                {s.title.replace(/^[🔴🟡🟢]\s*/, "")}
              </span>
              <span className="text-[10px] text-gray-600 shrink-0 font-mono tabular-nums">
                {timeAgo(s.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
