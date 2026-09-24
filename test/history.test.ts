import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHome = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsMod = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require('path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const osMod = require('os') as typeof import('os');
  return fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'doco-home-'));
});

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  const mocked = {
    ...actual,
    homedir: () => mockHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

const {
  HISTORY_FILE,
  addHistoryEntry,
  clearHistory,
  getHistory,
  getLatestHistory,
  removeHistoryEntry,
  timeAgo,
} = await import('../src/history');

const projectA = path.join(mockHome, 'project-a');
const projectB = path.join(mockHome, 'project-b');

function entry(command: string, label = command) {
  return {
    label,
    command,
    argv: command.split(' ').slice(2),
    filesUsed: [] as string[],
  };
}

beforeEach(() => {
  fs.rmSync(path.join(mockHome, '.doco'), { recursive: true, force: true });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  fs.rmSync(mockHome, { recursive: true, force: true });
});

describe('timeAgo', () => {
  it('says just now within the last minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:30Z'));
    expect(timeAgo('2026-09-23T10:00:00Z')).toBe('just now');
  });

  it('reports minutes, hours, and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
    expect(timeAgo('2026-09-23T11:55:00Z')).toBe('5m ago');
    expect(timeAgo('2026-09-23T10:00:00Z')).toBe('2h ago');
    expect(timeAgo('2026-09-21T12:00:00Z')).toBe('2d ago');
  });
});

describe('history store', () => {
  it('writes history under the isolated home directory', () => {
    expect(HISTORY_FILE).toBe(path.join(mockHome, '.doco', 'history.json'));
    expect(HISTORY_FILE.startsWith(os.homedir())).toBe(true);
  });

  it('adds newest entries first and keeps projects separate', () => {
    addHistoryEntry(projectA, entry('docker compose up -d', 'up -d'));
    addHistoryEntry(projectA, entry('docker compose logs -f', 'logs -f'));
    addHistoryEntry(projectB, entry('docker compose ps', 'ps'));

    expect(getHistory(projectA).map((item) => item.label)).toEqual(['logs -f', 'up -d']);
    expect(getHistory(projectB).map((item) => item.label)).toEqual(['ps']);
    expect(getLatestHistory(projectA)?.label).toBe('logs -f');
    expect(getLatestHistory(path.join(mockHome, 'empty'))).toBeUndefined();
  });

  it('deduplicates an identical command by bumping the latest timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
    const first = addHistoryEntry(projectA, entry('docker compose up -d', 'up -d'));

    vi.setSystemTime(new Date('2026-09-23T11:00:00Z'));
    const second = addHistoryEntry(projectA, entry('docker compose up -d', 'up -d'));

    const list = getHistory(projectA);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(first.id);
    expect(list[0]?.timestamp).toBe('2026-09-23T11:00:00.000Z');
    expect(second.command).toBe(first.command);
  });

  it('removes a single entry and can clear a project', () => {
    const kept = addHistoryEntry(projectA, entry('docker compose up', 'up'));
    const removed = addHistoryEntry(projectA, entry('docker compose down', 'down'));

    removeHistoryEntry(projectA, removed.id);
    expect(getHistory(projectA).map((item) => item.id)).toEqual([kept.id]);

    clearHistory(projectA);
    expect(getHistory(projectA)).toEqual([]);
    expect(fs.existsSync(HISTORY_FILE)).toBe(true);
  });

  it('returns an empty list when the history file is corrupt', () => {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, '{not-json', 'utf8');
    expect(getHistory(projectA)).toEqual([]);

    fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
    expect(getHistory(projectA)).toEqual([]);
  });

  it('caps the history list at 30 entries per project', () => {
    for (let i = 0; i < 35; i += 1) {
      addHistoryEntry(projectA, entry(`docker compose up ${i}`, `up ${i}`));
    }
    expect(getHistory(projectA)).toHaveLength(30);
    expect(getHistory(projectA)[0]?.label).toBe('up 34');
    expect(getHistory(projectA)[29]?.label).toBe('up 5');
  });
});
