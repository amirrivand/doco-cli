import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from '../src/types';

vi.mock('../src/dockerCompose', () => ({
  buildArgs: vi.fn(
    ({
      baseArgs,
      files = [],
      actionArgs,
    }: {
      baseArgs: string[];
      files?: string[];
      actionArgs: string[];
    }) => {
      const args = [...baseArgs];
      for (const file of files) args.push('-f', file);
      args.push(...actionArgs);
      return args;
    },
  ),
  runInherited: vi.fn(async () => 0),
}));

vi.mock('../src/history', () => ({
  addHistoryEntry: vi.fn((cwd: string, entry: HistoryEntry) => ({
    ...entry,
    id: 'replayed',
    timestamp: '2026-09-23T12:00:00.000Z',
    cwd,
  })),
}));

const dockerCompose = await import('../src/dockerCompose');
const history = await import('../src/history');
const { executeHistoryEntry, historyEntryInput } = await import('../src/replay');

afterEach(() => {
  vi.clearAllMocks();
});

describe('historyEntryInput', () => {
  it('strips id/timestamp and normalizes optional fields', () => {
    const entry: HistoryEntry = {
      id: 'abc',
      timestamp: '2026-09-23T10:00:00.000Z',
      label: 'up -d',
      command: 'docker compose -f compose.yaml up -d',
      argv: ['up', '-d'],
      filesUsed: undefined as unknown as string[],
    };

    expect(historyEntryInput(entry)).toEqual({
      label: 'up -d',
      command: 'docker compose -f compose.yaml up -d',
      argv: ['up', '-d'],
      global: false,
      filesUsed: [],
    });
  });
});

describe('executeHistoryEntry', () => {
  it('replays a project-scoped command and re-records it', async () => {
    const entry: HistoryEntry = {
      id: '1',
      timestamp: '2026-09-23T10:00:00.000Z',
      label: 'up -d',
      command: 'docker compose -f compose.yaml up -d',
      argv: ['up', '-d'],
      filesUsed: ['compose.yaml'],
    };

    await expect(
      executeHistoryEntry('/tmp/app', { bin: 'docker', baseArgs: ['compose'] }, entry),
    ).resolves.toBe(0);

    expect(dockerCompose.buildArgs).toHaveBeenCalledWith({
      baseArgs: ['compose'],
      files: ['compose.yaml'],
      actionArgs: ['up', '-d'],
    });
    expect(dockerCompose.runInherited).toHaveBeenCalledWith({
      bin: 'docker',
      args: ['compose', '-f', 'compose.yaml', 'up', '-d'],
      cwd: '/tmp/app',
    });
    expect(history.addHistoryEntry).toHaveBeenCalledWith(
      '/tmp/app',
      expect.objectContaining({ label: 'up -d', argv: ['up', '-d'] }),
    );
  });

  it('skips -f files for global history entries', async () => {
    const entry: HistoryEntry = {
      id: '2',
      timestamp: '2026-09-23T10:00:00.000Z',
      label: 'ls',
      command: 'docker compose ls',
      argv: ['ls'],
      global: true,
      filesUsed: ['compose.yaml'],
    };

    vi.mocked(dockerCompose.runInherited).mockResolvedValueOnce(7);

    await expect(
      executeHistoryEntry('/tmp/app', { bin: 'docker', baseArgs: ['compose'] }, entry),
    ).resolves.toBe(7);

    expect(dockerCompose.buildArgs).toHaveBeenCalledWith({
      baseArgs: ['compose'],
      files: [],
      actionArgs: ['ls'],
    });
  });
});
