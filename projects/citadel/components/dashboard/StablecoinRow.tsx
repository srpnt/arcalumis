"use client";

function pegColor(price: number): string {
  const deviation = Math.abs(price - 1);
  if (deviation > 0.005) return "text-red-400";
  if (deviation > 0.002) return "text-amber-400";
  return "text-emerald-400";
}

function pegStatus(price: number): string {
  const deviation = Math.abs(price - 1);
  if (deviation > 0.005) return "OFF-PEG";
  if (deviation > 0.002) return "DRIFT";
  return "ON-PEG";
}

function pegDot(price: number): string {
  const deviation = Math.abs(price - 1);
  if (deviation > 0.005) return "bg-red-500";
  if (deviation > 0.002) return "bg-amber-500";
  return "bg-emerald-500";
}

interface StablecoinRowProps {
  label: string;
  price: number;
}

export default function StablecoinRow({ label, price }: StablecoinRowProps) {
  if (!price) return null;
  const color = pegColor(price);
  const status = pegStatus(price);
  const dot = pegDot(price);
  const deviation = ((price - 1) * 100).toFixed(3);
  const sign = parseFloat(deviation) >= 0 ? "+" : "";

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <span className="text-xs font-medium text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-gray-500 tabular-nums">
          ${price.toFixed(4)}
        </span>
        <span
          className={`text-[9px] font-mono font-semibold ${color} tabular-nums`}
        >
          {sign}
          {deviation}%
        </span>
        <span
          className={`text-[9px] font-semibold px-1 py-0.5 rounded ${color} ${parseFloat(deviation) === 0 && status === "ON-PEG" ? "bg-emerald-500/10" : Math.abs(parseFloat(deviation)) > 0.5 ? "bg-red-500/10" : "bg-emerald-500/10"}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
