import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSync = vi.fn();
const spawn = vi.fn();

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawnSync: (...args: unknown[]) => spawnSync(...args),
    spawn: (...args: unknown[]) => spawn(...args),
  };
});

const { detectComposeBinary, runCaptured, runInherited } = await import('../src/dockerCompose');

beforeEach(() => {
  spawnSync.mockReset();
  spawn.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectComposeBinary', () => {
  it('prefers the docker compose plugin when available', () => {
    spawnSync.mockImplementation((command: string) => ({
      status: command === 'docker' ? 0 : 1,
    }));

    expect(detectComposeBinary()).toEqual({ bin: 'docker', baseArgs: ['compose'] });
  });

  it('falls back to the legacy docker-compose binary', () => {
    spawnSync.mockImplementation((command: string) => ({
      status: command === 'docker-compose' ? 0 : 1,
    }));

    expect(detectComposeBinary()).toEqual({ bin: 'docker-compose', baseArgs: [] });
  });

  it('defaults to the plugin form when nothing is installed', () => {
    spawnSync.mockReturnValue({ status: 1 });
    expect(detectComposeBinary()).toEqual({ bin: 'docker', baseArgs: ['compose'] });
  });
});

describe('runInherited', () => {
  it('resolves with the child exit code', async () => {
    const child = new EventEmitter();
    spawn.mockReturnValue(child);

    const pending = runInherited({ bin: 'docker', args: ['compose', 'ps'], cwd: '/tmp' });
    child.emit('close', 0);
    await expect(pending).resolves.toBe(0);
  });

  it('treats a null exit code and spawn errors as failure', async () => {
    const child = new EventEmitter();
    spawn.mockReturnValue(child);
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const pendingNull = runInherited({ bin: 'docker', args: ['compose', 'ps'], cwd: '/tmp' });
    child.emit('close', null);
    await expect(pendingNull).resolves.toBe(1);

    const pendingError = runInherited({ bin: 'missing', args: [], cwd: '/tmp' });
    child.emit('error', new Error('ENOENT'));
    await expect(pendingError).resolves.toBe(1);
    expect(write).toHaveBeenCalled();
  });
});

describe('runCaptured', () => {
  it('streams stdout and stderr chunks to the callback', async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawn.mockReturnValue(child);

    const chunks: string[] = [];
    const pending = runCaptured({
      bin: 'docker',
      args: ['compose', 'ps'],
      cwd: '/tmp',
      onData: (chunk) => chunks.push(chunk),
    });

    child.stdout.emit('data', Buffer.from('hello '));
    child.stderr.emit('data', Buffer.from('world'));
    child.emit('close', 0);

    await expect(pending).resolves.toBe(0);
    expect(chunks).toEqual(['hello ', 'world']);
  });
});
