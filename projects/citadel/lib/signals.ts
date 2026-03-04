// ============================================================
// Signals Parser — reads research/*.md files server-side
// ============================================================

import { Signal, SignalUrgency } from "./types";
import fs from "fs";
import path from "path";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(
  process.env.HOME || "/home/piton",
  ".openclaw/workspace"
);
const RESEARCH_DIR = path.join(WORKSPACE_DIR, "research");

function parseSignals(content: string, sourceName: string): Signal[] {
  const signals: Signal[] = [];
  const lines = content.split("\n");
  let current: Partial<Signal> | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (current) {
      current.body = bodyLines.join("\n").trim();
      signals.push(current as Signal);
    }
    current = null;
    bodyLines = [];
  };

  for (const line of lines) {
    let urgency: SignalUrgency | null = null;

    if (line.includes("🔴")) urgency = "critical";
    else if (line.includes("🟡")) urgency = "notable";
    else if (line.includes("🟢")) urgency = "info";

    const isSignalLine =
      urgency !== null &&
      (line.includes("Alert") ||
        line.includes("Signal") ||
        line.includes("#") ||
        line.includes("Info"));

    if (isSignalLine && urgency) {
      flush();
      current = {
        id: `${sourceName}-${signals.length}`,
        urgency,
        title: line.replace(/^#+\s*/, "").trim(),
        body: "",
        source: sourceName,
        date: extractDateFromFilename(sourceName),
      };
    } else if (current) {
      // If we hit a new H2 that isn't a signal, flush
      if (
        line.startsWith("## ") &&
        !line.includes("🔴") &&
        !line.includes("🟡") &&
        !line.includes("🟢")
      ) {
        flush();
      } else {
        bodyLines.push(line);
      }
    }
  }

  flush();
  return signals;
}

function extractDateFromFilename(name: string): string {
  const match = name.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const match2 = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (match2) return match2[1];
  return new Date().toISOString().slice(0, 10);
}

export function loadAllSignals(): Signal[] {
  if (!fs.existsSync(RESEARCH_DIR)) return [];

  const files = fs
    .readdirSync(RESEARCH_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  const allSignals: Signal[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(RESEARCH_DIR, file), "utf-8");
      const signals = parseSignals(content, file);
      allSignals.push(...signals);
    } catch {
      // skip unreadable files
    }
  }

  // Sort: critical first, then notable, then info
  const urgencyOrder: Record<SignalUrgency, number> = {
    critical: 0,
    notable: 1,
    info: 2,
  };

  allSignals.sort(
    (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  );

  return allSignals;
}
