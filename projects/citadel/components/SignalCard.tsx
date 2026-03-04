"use client";

import { useState, useRef, useEffect } from "react";
import { Signal } from "@/lib/types";

interface SignalCardProps {
  signal: Signal;
}

const URGENCY_CONFIG = {
  critical: {
    borderColor: "border-l-red-500",
    gradientFrom: "from-red-500/[0.06]",
    gradientTo: "to-transparent",
    borderHover: "hover:border-red-500/30",
    badgeBg: "bg-red-500/15",
    badgeText: "text-red-400",
    badgeBorder: "border-red-500/25",
    label: "CRITICAL",
    icon: "🔴",
    outerBorder: "border-red-500/10",
  },
  notable: {
    borderColor: "border-l-amber-500",
    gradientFrom: "from-amber-500/[0.04]",
    gradientTo: "to-transparent",
    borderHover: "hover:border-amber-500/30",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-400",
    badgeBorder: "border-amber-500/25",
    label: "NOTABLE",
    icon: "🟡",
    outerBorder: "border-amber-500/10",
  },
  info: {
    borderColor: "border-l-emerald-500",
    gradientFrom: "from-emerald-500/[0.03]",
    gradientTo: "to-transparent",
    borderHover: "hover:border-emerald-500/30",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-400",
    badgeBorder: "border-emerald-500/25",
    label: "INFO",
    icon: "🟢",
    outerBorder: "border-emerald-500/10",
  },
};

export default function SignalCard({ signal }: SignalCardProps) {
  const [expanded, setExpanded] = useState(signal.urgency === "critical");
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const cfg = URGENCY_CONFIG[signal.urgency];

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [signal.body, expanded]);

  return (
    <div
      className={`
        relative rounded-xl border-l-4 ${cfg.borderColor}
        border ${cfg.outerBorder}
        bg-gradient-to-r ${cfg.gradientFrom} ${cfg.gradientTo}
        transition-all duration-300 ease-in-out
        ${cfg.borderHover}
        hover:shadow-lg hover:shadow-black/20
        hover:translate-x-0.5
        group
      `}
    >
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header Row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <span
            className={`
              inline-flex items-center gap-1.5
              text-[10px] font-bold uppercase tracking-wider
              px-2.5 py-1 rounded-full
              border ${cfg.badgeBorder}
              ${cfg.badgeBg} ${cfg.badgeText}
            `}
          >
            <span className="text-[9px]">{cfg.icon}</span>
            {cfg.label}
          </span>
          <span className="text-xs text-gray-500 font-mono">{signal.source}</span>
          <span className="text-xs text-gray-700">•</span>
          <span className="text-xs text-gray-500">{signal.date}</span>
          <div className="flex-1" />
          <span
            className={`
              text-gray-600 group-hover:text-gray-400
              transition-all duration-300
              text-xs
              ${expanded ? "rotate-180" : "rotate-0"}
            `}
            style={{ display: "inline-block", transition: "transform 0.3s ease" }}
          >
            ▼
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-200 leading-snug group-hover:text-gray-100 transition-colors">
          {signal.title.replace(/^[\u{1F534}\u{1F7E1}\u{1F7E2}]\s*/u, "")}
        </h3>

        {/* Preview: first line when collapsed */}
        {!expanded && signal.body && (
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">
            {signal.body.split("\n")[0]}
          </p>
        )}
      </div>

      {/* Expandable Body */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? `${contentHeight + 40}px` : "0px",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="px-5 pb-5">
          <div className="pt-3 border-t border-gray-800/50">
            <div className="text-sm text-gray-300 leading-relaxed max-h-72 overflow-y-auto pr-2 scrollbar-thin space-y-1">
              {signal.body.split("\n").filter(line => !line.match(/^\|[-\s|:]+\|$/)).map((line, i) => {
                // Convert markdown table rows to clean text
                if (line.startsWith("|") && line.endsWith("|")) {
                  const cells = line.split("|").filter(Boolean).map(c => c.trim());
                  return <div key={i} className="text-xs text-gray-400 font-mono">{cells.join("  ·  ")}</div>;
                }
                // Bold markdown
                const parts = line.replace(/\*\*(.*?)\*\*/g, "⟨b⟩$1⟨/b⟩").split(/⟨\/?b⟩/);
                const isBullet = line.startsWith("- ");
                return (
                  <div key={i} className={isBullet ? "pl-3 text-sm" : "text-sm"}>
                    {isBullet && <span className="text-gray-600 mr-1">•</span>}
                    {parts.map((part, j) => j % 2 === 1
                      ? <span key={j} className="font-semibold text-gray-200">{part}</span>
                      : <span key={j}>{isBullet && j === 0 ? part.replace(/^- /, "") : part}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
