"use client";

interface RiskTierBadgeProps {
  tier: number;
  label: string;
  emoji: string;
}

const TIER_STYLES: Record<number, string> = {
  1: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  2: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  3: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  4: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function RiskTierBadge({ tier, label, emoji }: RiskTierBadgeProps) {
  const style = TIER_STYLES[tier] || TIER_STYLES[4];

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border
        ${style}
      `}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  );
}
