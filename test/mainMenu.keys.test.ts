import { PassThrough } from 'stream';
import blessed from 'blessed';
import { describe, expect, it, vi } from 'vitest';
import type { AppState, MenuChoice, Screen } from '../src/types';

vi.mock('../src/history', () => ({
  getHistory: () => [],
  timeAgo: () => 'just now',
}));

import { showMainMenu } from '../src/ui/mainMenu';

function makeScreen(): Screen {
  const input = new PassThrough();
  const output = new PassThrough();
  Object.assign(output, { columns: 100, rows: 40, isTTY: true });
  Object.assign(input, { isTTY: true });
  return blessed.screen({
    smartCSR: true,
    input,
    output,
    terminal: 'xterm-256color',
    fullUnicode: true,
    dockBorders: true,
  });
}

function press(screen: Screen, name: string, shift = false): void {
  const full = shift ? `S-${name}` : name;
  screen.program.emit('keypress', name, {
    name,
    full,
    sequence: name,
    ctrl: false,
    meta: false,
    shift,
  });
}

async function pick(keys: Array<{ name: string; shift?: boolean }>): Promise<MenuChoice> {
  const screen = makeScreen();
  const state: AppState = {
    cwd: '/tmp/doco-project',
    binary: { bin: 'docker', baseArgs: ['compose'] },
    selectedFiles: [],
    services: ['web'],
    volumes: [],
    networks: [],
    screen,
  };
  const pending = showMainMenu(state);
  await new Promise((resolve) => setImmediate(resolve));
  for (const key of keys) press(screen, key.name, key.shift);
  const choice = await pending;
  screen.destroy();
  return choice;
}

describe('main menu keys', () => {
  it('runs a letter shortcut from anywhere on the menu', async () => {
    await expect(pick([{ name: 'l' }])).resolves.toEqual({ type: 'action', key: 'logs' });
    await expect(pick([{ name: 'u' }])).resolves.toEqual({ type: 'action', key: 'up' });
    await expect(pick([{ name: 'b' }])).resolves.toEqual({ type: 'action', key: 'build' });
  });

  it('tabs to the first item of the next group', async () => {
    await expect(pick([{ name: 'tab' }, { name: 'enter' }])).resolves.toEqual({
      type: 'action',
      key: 'build',
    });
  });

  it('wraps from the last group back to the first', async () => {
    const tabs = Array.from({ length: 6 }, () => ({ name: 'tab' }));
    await expect(pick([...tabs, { name: 'enter' }])).resolves.toEqual({
      type: 'action',
      key: 'up',
    });
  });

  it('shift-tabs from the first group to the last group', async () => {
    await expect(pick([{ name: 'tab', shift: true }, { name: 'enter' }])).resolves.toEqual({
      type: 'meta',
      name: 'history',
    });
  });
});
