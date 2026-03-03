"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatUsd } from "@/lib/format";

interface ChainDonutProps {
  ethTvl: number;
  baseTvl: number;
}

const COLORS = { Ethereum: "#10b981", Base: "#3b82f6" };

interface DonutTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-200 font-medium">{payload[0].name}</p>
      <p className="text-gray-400">{formatUsd(payload[0].value)}</p>
    </div>
  );
}

export default function ChainDonut({ ethTvl, baseTvl }: ChainDonutProps) {
  const total = ethTvl + baseTvl;
  if (total === 0) return null;

  const data = [
    { name: "Ethereum", value: ethTvl },
    { name: "Base", value: baseTvl },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-2">
        ⛓ Chain Distribution
      </h3>
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={55}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name as keyof typeof COLORS] || "#6b7280"}
              />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => {
              const item = data.find((d) => d.name === value);
              const pct = item ? ((item.value / total) * 100).toFixed(1) : "0";
              return (
                <span className="text-gray-400 text-xs">
                  {value} ({pct}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
