"use client";

interface NodeStatusProps {
  online: boolean;
  loading?: boolean;
}

export default function NodeStatus({ online, loading }: NodeStatusProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${
          online
            ? "bg-emerald-500 animate-pulse"
            : "bg-red-500"
        }`}
      />
      <span className={online ? "text-emerald-400" : "text-red-400"}>
        {online ? "Node connected" : "Node offline"}
      </span>
    </div>
  );
}
