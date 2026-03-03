"use client";

import { useState } from "react";
import { Signal } from "@/lib/types";

interface SignalCardProps {
  signal: Signal;
}

const URGENCY_STYLES = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-500/5",
    borderSubtle: "border-red-500/15",
    badge: "bg-red-500/15 text-red-400",
    badgeLabel: "CRITICAL",
    emoji: "🔴",
  },
  notable: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    borderSubtle: "border-amber-500/15",
    badge: "bg-amber-500/15 text-amber-400",
    badgeLabel: "NOTABLE",
    emoji: "🟡",
  },
  info: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    borderSubtle: "border-emerald-500/15",
    badge: "bg-emerald-500/15 text-emerald-400",
    badgeLabel: "INFO",
    emoji: "🟢",
  },
};

export default function SignalCard({ signal }: SignalCardProps) {
  const [expanded, setExpanded] = useState(signal.urgency === "critical");
  const style = URGENCY_STYLES[signal.urgency];

  return (
    <div
      className={`
        rounded-xl border-l-4 ${style.border} ${style.bg}
        border ${style.borderSubtle}
        transition-all duration-200 hover:brightness-110
      `}
    >
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}
              >
                {style.badgeLabel}
              </span>
              <span className="text-xs text-gray-500">{signal.source}</span>
              <span className="text-xs text-gray-600">•</span>
              <span className="text-xs text-gray-500">{signal.date}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-200 mt-2">
              {signal.title}
            </h3>
          </div>
          <button className="text-gray-500 hover:text-gray-300 text-sm ml-3">
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        {expanded && signal.body && (
          <div className="mt-3 pt-3 border-t border-gray-800/50">
            <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {signal.body}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
