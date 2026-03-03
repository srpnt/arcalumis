"use client";

interface ChainBadgeProps {
  chain: string;
}

export default function ChainBadge({ chain }: ChainBadgeProps) {
  const isEth = chain.toLowerCase() === "ethereum";
  const isBase = chain.toLowerCase() === "base";

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${
          isEth
            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            : isBase
            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            : "bg-gray-700/50 text-gray-400 border border-gray-600"
        }
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isEth ? "bg-indigo-400" : isBase ? "bg-blue-400" : "bg-gray-400"
        }`}
      />
      {chain}
    </span>
  );
}
