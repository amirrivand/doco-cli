import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { HistoryEntry, HistoryEntryInput } from './types';

const DOCO_DIR = path.join(os.homedir(), '.doco');
export const HISTORY_FILE = path.join(DOCO_DIR, 'history.json');
const MAX_ENTRIES_PER_PROJECT = 30;

type HistoryStore = Record<string, HistoryEntry[]>;

function ensureDir(): void {
  if (!fs.existsSync(DOCO_DIR)) {
    fs.mkdirSync(DOCO_DIR, { recursive: true });
  }
}

function isStore(value: unknown): value is HistoryStore {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadAll(): HistoryStore {
  try {
    ensureDir();
    if (!fs.existsSync(HISTORY_FILE)) return {};
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    if (!raw.trim()) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed)) return {};
    return parsed;
  } catch {
    // Corrupt or unreadable history should never crash the app.
    return {};
  }
}

function saveAll(data: HistoryStore): void {
  try {
    ensureDir();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Silently ignore - history is a convenience, not critical.
  }
}

function projectKey(cwd: string): string {
  return path.resolve(cwd);
}

export function getHistory(cwd: string): HistoryEntry[] {
  const all = loadAll();
  const key = projectKey(cwd);
  return all[key] || [];
}

/** Newest entry for this project, or undefined when nothing has been run yet. */
export function getLatestHistory(cwd: string): HistoryEntry | undefined {
  return getHistory(cwd)[0];
}

/**
 * entry: {
 *   label: string          human readable summary, e.g. "up -d --build"
 *   command: string        the full shell command that was run
 *   argv: string[]         argv passed to `docker compose`
 *   filesUsed: string[]    -f files used, empty = default discovery
 * }
 */
export function addHistoryEntry(cwd: string, entry: HistoryEntryInput): HistoryEntry {
  const all = loadAll();
  const key = projectKey(cwd);
  const list = all[key] || [];

  const id = crypto.randomBytes(4).toString('hex');
  const record: HistoryEntry = {
    id,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // De-duplicate: if the exact same command is already the most recent, just
  // bump its timestamp instead of cluttering the list.
  const latest = list[0];
  if (latest && latest.command === record.command) {
    latest.timestamp = record.timestamp;
  } else {
    list.unshift(record);
  }

  all[key] = list.slice(0, MAX_ENTRIES_PER_PROJECT);
  saveAll(all);
  return record;
}

export function clearHistory(cwd: string): void {
  const all = loadAll();
  const key = projectKey(cwd);
  delete all[key];
  saveAll(all);
}

export function removeHistoryEntry(cwd: string, id: string): void {
  const all = loadAll();
  const key = projectKey(cwd);
  const list = all[key] || [];
  all[key] = list.filter((entry) => entry.id !== id);
  saveAll(all);
}

export function timeAgo(isoTimestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
