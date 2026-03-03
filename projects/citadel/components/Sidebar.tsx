"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/morpho", label: "Morpho", icon: "📊" },
  { href: "/yield-comparison", label: "Yield Comparison", icon: "⚖️" },
  { href: "/exposure", label: "Exposure", icon: "🛡" },
  { href: "/signals", label: "Signals", icon: "📡" },
  { href: "/intel", label: "Intel", icon: "🔍" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const expanded = hovered;
  const railWidth = expanded ? "w-48" : "w-[60px]";

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-gray-800 p-2 rounded-lg border border-gray-700"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <span className="text-xl">{mobileOpen ? "✕" : "☰"}</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — icon rail on desktop, full on mobile */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          fixed top-0 left-0 z-40 h-full bg-gray-950 border-r border-gray-800
          transition-all duration-200 ease-in-out
          flex flex-col
          ${railWidth}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-center border-b border-gray-800 shrink-0">
          <Link href="/" className="flex items-center gap-2 group" onClick={() => setMobileOpen(false)}>
            <span className="text-2xl leading-none">🦞</span>
            {expanded && (
              <span className="text-sm font-bold text-gray-100 group-hover:text-emerald-400 transition-colors whitespace-nowrap overflow-hidden">
                The Citadel
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-1.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={!expanded ? item.label : undefined}
                className={`
                  relative flex items-center rounded-lg text-sm font-medium
                  transition-all duration-150 group
                  ${expanded ? "px-3 py-2.5 gap-3" : "justify-center py-2.5"}
                  ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
                  }
                `}
              >
                <span className="text-lg leading-none shrink-0">{item.icon}</span>
                {expanded && (
                  <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                )}
                {/* Tooltip on collapsed */}
                {!expanded && (
                  <span className="absolute left-full ml-2 px-2 py-1 rounded bg-gray-800 text-xs text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 border border-gray-700 shadow-lg">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-gray-800 shrink-0">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {expanded ? <span>Online · v0.2</span> : <span>v0.2</span>}
          </div>
        </div>
      </aside>
    </>
  );
}
