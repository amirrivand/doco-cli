import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildArgs,
  COMPOSE_FILE_PATTERN,
  findComposeFileCandidates,
  listServices,
  listVolumesAndNetworks,
} from '../src/dockerCompose';

const tempDirs: string[] = [];

function tempProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doco-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('COMPOSE_FILE_PATTERN', () => {
  it.each([
    'compose.yaml',
    'compose.yml',
    'docker-compose.yml',
    'docker-compose.prod.yaml',
    'compose.override.yml',
  ])('matches %s', (name) => {
    expect(COMPOSE_FILE_PATTERN.test(name)).toBe(true);
  });

  it.each(['compose.txt', 'docker.yml', 'notes.yaml', 'compose'])('rejects %s', (name) => {
    expect(COMPOSE_FILE_PATTERN.test(name)).toBe(false);
  });
});

describe('findComposeFileCandidates', () => {
  it('returns compose files with the default names first', () => {
    const dir = tempProject({
      'docker-compose.prod.yml': '',
      'compose.yaml': '',
      'notes.txt': '',
      'docker-compose.yml': '',
      'compose.override.yml': '',
    });

    expect(findComposeFileCandidates(dir)).toEqual([
      'compose.yaml',
      'docker-compose.yml',
      'compose.override.yml',
      'docker-compose.prod.yml',
    ]);
  });

  it('returns an empty list when the directory cannot be read', () => {
    expect(findComposeFileCandidates(path.join(os.tmpdir(), 'doco-missing-dir'))).toEqual([]);
  });
});

describe('listServices', () => {
  it('reads service, volume, and network names from the selected files', () => {
    const dir = tempProject({
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
    });

    expect(listServices(dir, ['compose.yaml'])).toEqual(['api', 'web']);
    expect(listVolumesAndNetworks(dir, ['compose.yaml'])).toEqual({
      volumes: ['data'],
      networks: ['front'],
    });
  });

  it('auto-discovers the first candidate when no files are selected', () => {
    const dir = tempProject({
      'compose.yaml': 'services:\n  web:\n    image: nginx\n',
      'docker-compose.prod.yml': 'services:\n  worker:\n    image: redis\n',
    });

    expect(listServices(dir, [])).toEqual(['web']);
  });

  it('merges services across multiple selected files', () => {
    const dir = tempProject({
      'compose.yaml': 'services:\n  web:\n    image: nginx\n',
      'docker-compose.prod.yml': 'services:\n  worker:\n    image: redis\n',
    });

    expect(listServices(dir, ['compose.yaml', 'docker-compose.prod.yml'])).toEqual([
      'web',
      'worker',
    ]);
  });

  it('returns an empty list for invalid yaml or missing files', () => {
    const dir = tempProject({
      'compose.yaml': '::: not yaml',
      'broken.yml': 'services:\n  - just a list\n',
    });

    expect(listServices(dir, ['compose.yaml', 'missing.yml'])).toEqual([]);
  });
});

describe('buildArgs', () => {
  it('places compose files before the action arguments', () => {
    expect(
      buildArgs({
        baseArgs: ['compose'],
        files: ['compose.yaml', 'docker-compose.prod.yml'],
        actionArgs: ['up', '-d'],
      }),
    ).toEqual(['compose', '-f', 'compose.yaml', '-f', 'docker-compose.prod.yml', 'up', '-d']);
  });

  it('omits -f flags when no files are provided', () => {
    expect(
      buildArgs({
        baseArgs: ['compose'],
        actionArgs: ['ps'],
      }),
    ).toEqual(['compose', 'ps']);
  });
});
