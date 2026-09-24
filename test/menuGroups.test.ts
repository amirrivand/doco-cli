import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/actionsConfig';
import { groupStartIndices, nextGroupItemIndex } from '../src/ui/menuGroups';

const menu = [{ divider: true }, {}, {}, { divider: true }, {}, {}, { divider: true }, {}];

describe('groupStartIndices', () => {
  it('returns the first selectable row of each group', () => {
    expect(groupStartIndices(menu)).toEqual([1, 4, 7]);
  });

  it('ignores a trailing divider with nothing after it', () => {
    expect(groupStartIndices([...menu, { divider: true }])).toEqual([1, 4, 7]);
  });
});

describe('nextGroupItemIndex', () => {
  it('jumps from the middle of a group to the next group', () => {
    expect(nextGroupItemIndex(menu, 5, 1)).toBe(7);
  });

  it('wraps from the last group to the first group', () => {
    expect(nextGroupItemIndex(menu, 7, 1)).toBe(1);
  });

  it('wraps from the first group to the last group', () => {
    expect(nextGroupItemIndex(menu, 1, -1)).toBe(7);
    expect(nextGroupItemIndex(menu, 2, -1)).toBe(7);
  });

  it('moves to the previous group from the middle of a group', () => {
    expect(nextGroupItemIndex(menu, 5, -1)).toBe(1);
  });

  it('stays put when there is only one group', () => {
    const one = [{ divider: true }, {}];
    expect(nextGroupItemIndex(one, 1, 1)).toBe(1);
  });

  it('returns null for an empty menu', () => {
    expect(nextGroupItemIndex([], 0, 1)).toBeNull();
  });
});

describe('action shortcuts', () => {
  it('gives the most-used actions a unique first-letter shortcut', () => {
    const reserved = ['q', 'j', 'k'];
    const withShortcut = ACTIONS.filter((action) => action.shortcut);
    const keys = withShortcut.map((action) => action.shortcut);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z]$/);
      expect(reserved).not.toContain(key);
    }
    expect(Object.fromEntries(withShortcut.map((action) => [action.key, action.shortcut]))).toEqual(
      {
        up: 'u',
        down: 'd',
        stop: 's',
        restart: 'r',
        build: 'b',
        exec: 'e',
        ps: 'p',
        logs: 'l',
      },
    );
  });
});
