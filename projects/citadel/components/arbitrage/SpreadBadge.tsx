"use client";

interface SpreadBadgeProps {
  spread: number; // decimal, e.g. 0.05 = 5%
}

export default function SpreadBadge({ spread }: SpreadBadgeProps) {
  const pct = spread * 100;

  let bg: string;
  let text: string;

  if (pct > 5) {
    bg = "bg-emerald-500/15 border-emerald-500/30";
    text = "text-emerald-400";
  } else if (pct > 2) {
    bg = "bg-amber-500/15 border-amber-500/30";
    text = "text-amber-400";
  } else {
    bg = "bg-gray-700/30 border-gray-600/30";
    text = "text-gray-400";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold font-mono ${bg} ${text}`}
    >
      {pct.toFixed(2)}%
    </span>
  );
}
