/**
 * Shared Data Store
 * Read/write JSON to the data/ directory with atomic writes.
 * Write to .tmp then rename to prevent partial reads.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Resolve data directory relative to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");
export const DATA_DIR = join(PROJECT_ROOT, "data");

// Ensure data directories exist
function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

ensureDir(DATA_DIR);
ensureDir(join(DATA_DIR, "plans"));
ensureDir(join(DATA_DIR, "executions"));

/**
 * Atomically write JSON to a file in the data directory.
 * Writes to a .tmp file first, then renames.
 */
export function writeData<T>(filename: string, data: T): void {
  const filepath = join(DATA_DIR, filename);
  ensureDir(dirname(filepath));
  const tmpPath = filepath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(data, replacer, 2), "utf-8");
  renameSync(tmpPath, filepath);
}

/**
 * Read JSON from a file in the data directory.
 * Returns null if file doesn't exist or is unreadable.
 */
export function readData<T>(filename: string): T | null {
  const filepath = join(DATA_DIR, filename);
  try {
    const raw = readFileSync(filepath, "utf-8");
    return JSON.parse(raw, reviver) as T;
  } catch {
    return null;
  }
}

/**
 * List files in a subdirectory of data/
 */
export function listDataFiles(subdir: string): string[] {
  const dirPath = join(DATA_DIR, subdir);
  try {
    return readdirSync(dirPath)
      .filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Get the last modified time of a data file.
 * Returns null if file doesn't exist.
 */
export function getDataMtime(filename: string): number | null {
  const filepath = join(DATA_DIR, filename);
  try {
    return statSync(filepath).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Check if a data file exists
 */
export function dataExists(filename: string): boolean {
  return existsSync(join(DATA_DIR, filename));
}

// ============================================================
// JSON serialization helpers for bigint
// ============================================================

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return { __type: "bigint", value: value.toString() };
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && (value as any).__type === "bigint") {
    return BigInt((value as any).value);
  }
  return value;
}
