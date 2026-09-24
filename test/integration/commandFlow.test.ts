import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAction } from '../../src/actionsConfig';
import {
  buildArgs,
  findComposeFileCandidates,
  listServices,
  listVolumesAndNetworks,
} from '../../src/dockerCompose';
import { buildArgv } from '../../src/ui/optionsFlow';

const mockHome = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsMod = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require('path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const osMod = require('os') as typeof import('os');
  return fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'doco-int-home-'));
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

vi.mock('../../src/dockerCompose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/dockerCompose')>();
  return {
    ...actual,
    runInherited: vi.fn(async () => 0),
  };
});

const history = await import('../../src/history');
const replay = await import('../../src/replay');
const dockerCompose = await import('../../src/dockerCompose');

const tempDirs: string[] = [];

function tempProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doco-int-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

beforeEach(() => {
  fs.rmSync(path.join(mockHome, '.doco'), { recursive: true, force: true });
  vi.clearAllMocks();
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

afterAll(() => {
  fs.rmSync(mockHome, { recursive: true, force: true });
});

describe('integration: compose project to runnable command', () => {
  it('discovers files, parses services, and builds a real up argv', () => {
    const cwd = tempProject({
      'compose.yaml': [
        'services:',
        '  web:',
        '    image: nginx',
        '  api:',
        '    image: node',
        'volumes:',
        '  data:',
        'networks:',
        '  front:',
      ].join('\n'),
      'docker-compose.prod.yml': 'services:\n  worker:\n    image: redis\n',
      'README.md': 'ignore me',
    });

    const files = findComposeFileCandidates(cwd);
    expect(files[0]).toBe('compose.yaml');

    const services = listServices(cwd, ['compose.yaml', 'docker-compose.prod.yml']);
    const resources = listVolumesAndNetworks(cwd, ['compose.yaml']);
    expect(services).toEqual(['api', 'web', 'worker']);
    expect(resources).toEqual({ volumes: ['data'], networks: ['front'] });

    const action = getAction('up');
    expect(action).toBeDefined();
    if (!action) return;

    const argv = buildArgv(action, { '-d': true, '--build': true }, ['web', 'api'], {});
    const fullArgs = buildArgs({
      baseArgs: ['compose'],
      files: ['compose.yaml', 'docker-compose.prod.yml'],
      actionArgs: argv,
    });

    expect(fullArgs).toEqual([
      'compose',
      '-f',
      'compose.yaml',
      '-f',
      'docker-compose.prod.yml',
      'up',
      '-d',
      '--build',
      'web',
      'api',
    ]);
    expect(`docker ${fullArgs.join(' ')}`).toBe(
      'docker compose -f compose.yaml -f docker-compose.prod.yml up -d --build web api',
    );
  });

  it('builds an exec command the same way the UI would hand off to docker', () => {
    const cwd = tempProject({
      'compose.yaml': 'services:\n  web:\n    image: nginx\n',
    });
    const action = getAction('exec');
    expect(action).toBeDefined();
    if (!action) return;

    const argv = buildArgv(action, { '-u': 'root' }, listServices(cwd, []), {
      command: 'sh -c "npm test"',
    });

    expect(
      buildArgs({
        baseArgs: ['compose'],
        files: ['compose.yaml'],
        actionArgs: argv,
      }),
    ).toEqual([
      'compose',
      '-f',
      'compose.yaml',
      'exec',
      '-u',
      'root',
      'web',
      'sh',
      '-c',
      'npm test',
    ]);
  });
});

describe('integration: history round-trip and replay', () => {
  it('records a built command and replays it with the same argv and files', async () => {
    const cwd = tempProject({
      'compose.yaml': 'services:\n  web:\n    image: nginx\n',
    });
    const action = getAction('logs');
    expect(action).toBeDefined();
    if (!action) return;

    const argv = buildArgv(action, { '-f': true, '--tail': '100' }, ['web'], {});
    const filesUsed = ['compose.yaml'];
    const fullArgs = buildArgs({
      baseArgs: ['compose'],
      files: filesUsed,
      actionArgs: argv,
    });
    const command = `docker ${fullArgs.join(' ')}`;

    const saved = history.addHistoryEntry(cwd, {
      label: `${action.key} ${argv.slice(1).join(' ')}`.trim(),
      command,
      argv,
      filesUsed,
    });

    expect(history.getLatestHistory(cwd)).toMatchObject({
      id: saved.id,
      command,
      argv: ['logs', '-f', '--tail', '100', 'web'],
      filesUsed,
    });

    await expect(
      replay.executeHistoryEntry(cwd, { bin: 'docker', baseArgs: ['compose'] }, saved),
    ).resolves.toBe(0);

    expect(dockerCompose.runInherited).toHaveBeenCalledWith({
      bin: 'docker',
      args: fullArgs,
      cwd,
    });

    expect(history.getHistory(cwd)).toHaveLength(1);
    expect(history.getLatestHistory(cwd)?.command).toBe(command);
  });

  it('replays global commands without attaching project compose files', async () => {
    const cwd = tempProject({
      'compose.yaml': 'services:\n  web:\n    image: nginx\n',
    });
    const action = getAction('version');
    expect(action).toBeDefined();
    if (!action) return;

    const argv = buildArgv(action, {}, [], {});
    const saved = history.addHistoryEntry(cwd, {
      label: action.key,
      command: 'docker compose version',
      argv,
      global: true,
      filesUsed: ['compose.yaml'],
    });

    await replay.executeHistoryEntry(cwd, { bin: 'docker', baseArgs: ['compose'] }, saved);

    expect(dockerCompose.runInherited).toHaveBeenCalledWith({
      bin: 'docker',
      args: ['compose', 'version'],
      cwd,
    });
  });
});
