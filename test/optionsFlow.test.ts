import { describe, expect, it } from 'vitest';
import { getAction, getCategories, ACTIONS } from '../src/actionsConfig';
import { buildArgv, tokenize } from '../src/ui/optionsFlow';

describe('tokenize', () => {
  it('splits on whitespace and preserves quoted segments', () => {
    expect(tokenize(`sh -c "echo hello world"`)).toEqual(['sh', '-c', 'echo hello world']);
    expect(tokenize(`sh -c 'echo hello'`)).toEqual(['sh', '-c', 'echo hello']);
    expect(tokenize('  one   two  ')).toEqual(['one', 'two']);
  });
});

describe('buildArgv', () => {
  it('builds a detached up command with services and repeatable flags', () => {
    const action = getAction('up');
    expect(action).toBeDefined();
    if (!action) return;

    expect(
      buildArgv(
        action,
        { '-d': true, '--build': true, '--scale': 'web=3 worker=2', '--timeout': '20' },
        ['web', 'api'],
        {},
      ),
    ).toEqual([
      'up',
      '-d',
      '--build',
      '--scale',
      'web=3',
      '--scale',
      'worker=2',
      '--timeout',
      '20',
      'web',
      'api',
    ]);
  });

  it('places the service before a tokenized exec command', () => {
    const action = getAction('exec');
    expect(action).toBeDefined();
    if (!action) return;

    expect(
      buildArgv(action, { '-T': true, '-u': 'root' }, ['web'], {
        command: 'sh -c "echo hi"',
      }),
    ).toEqual(['exec', '-T', '-u', 'root', 'web', 'sh', '-c', 'echo hi']);
  });

  it('places free-text extras before services for multi-service actions', () => {
    const action = getAction('cp');
    expect(action).toBeDefined();
    if (!action) return;

    expect(
      buildArgv(action, {}, [], {
        source: 'web:/app/log.txt',
        dest: './log.txt',
      }),
    ).toEqual(['cp', 'web:/app/log.txt', './log.txt']);
  });

  it('omits unset flags and empty services', () => {
    const action = getAction('ps');
    expect(action).toBeDefined();
    if (!action) return;

    expect(buildArgv(action, {}, [], {})).toEqual(['ps']);
  });
});

describe('actionsConfig', () => {
  it('looks up actions by key and lists categories in definition order', () => {
    expect(getAction('up')?.label).toContain('create & start');
    expect(getAction('missing')).toBeUndefined();
    expect(getCategories()).toEqual(['Lifecycle', 'Build & Images', 'Execute', 'Inspect', 'Data']);
  });

  it('keeps every action key unique and well-formed', () => {
    const keys = ACTIONS.map((action) => action.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const action of ACTIONS) {
      expect(action.key).toMatch(/^[a-z][\w-]*$/);
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.category.length).toBeGreaterThan(0);
      expect(['none', 'optional', 'required', 'required-single']).toContain(action.needsServices);
    }
  });
});
