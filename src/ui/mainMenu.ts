import blessed from 'blessed';
import { icon } from './glyphs';
import { menuListStyle, tone } from './theme';
import {
  makeHeader,
  makeFooter,
  applyShortcutLabels,
  bindDigitShortcuts,
  MAIN_LIST_TOP,
  MAIN_LIST_HEIGHT,
} from './widgets';
import { nextGroupItemIndex } from './menuGroups';
import { ACTIONS, getCategories } from '../actionsConfig';
import * as history from '../history';
import type { Action, AppState, HistoryEntry, MenuChoice } from '../types';

const CATEGORY_ICON: Record<string, string> = {
  Lifecycle: icon.lifecycle,
  'Build & Images': icon.build,
  Execute: icon.execute,
  Inspect: icon.inspect,
  Data: icon.data,
};

const RECENT_COUNT = 5;

interface MenuRow {
  text: string;
  value: MenuChoice | null;
  divider?: boolean;
  shortcut?: string;
}

/** Gutter plus a 4-wide key slot so shortcut and plain rows share one label column. */
function formatActionRow(action: Action): string {
  const slot = action.shortcut ? `${tone.key(`[${action.shortcut}]`)} ` : '    ';
  return `${tone.meta(icon.chevron)} ${slot}${tone.body(action.label)}`;
}

function formatSection(mark: string, label: string): string {
  return `${tone.accent(mark)}  ${tone.eyebrow(label)}`;
}

function formatMeta(mark: string, label: string, toneName: 'body' | 'bad' = 'body'): string {
  const glyph = toneName === 'bad' ? tone.bad(mark) : tone.accent(mark);
  const text = toneName === 'bad' ? tone.bad(label) : tone.body(label);
  return `${glyph}  ${text}`;
}

function buildMenuItems(state: AppState): MenuRow[] {
  const items: MenuRow[] = [];

  // Cached commands, most recently run first, pinned above everything else
  // so the thing you just did (or want to repeat) is always right at hand.
  const recent = history.getHistory(state.cwd).slice(0, RECENT_COUNT);
  if (recent.length) {
    items.push({
      text: formatSection(icon.recent, 'Recent'),
      value: null,
      divider: true,
    });
    recent.forEach((entry: HistoryEntry) => {
      const summary = entry.label || entry.argv.join(' ');
      items.push({
        text: `${tone.accent(icon.recent)}  ${tone.body(summary)}  ${tone.meta(history.timeAgo(entry.timestamp))}`,
        value: { type: 'history', entry },
      });
    });
  }

  getCategories().forEach((category) => {
    const mark = CATEGORY_ICON[category] || icon.chevron;
    items.push({
      text: formatSection(mark, category),
      value: null,
      divider: true,
    });
    ACTIONS.filter((action) => action.category === category).forEach((action) => {
      items.push({
        text: formatActionRow(action),
        value: { type: 'action', key: action.key },
        shortcut: action.shortcut,
      });
    });
  });

  items.push({
    text: formatSection(icon.workspace, 'Workspace'),
    value: null,
    divider: true,
  });
  items.push({
    text: `${formatMeta(icon.history, 'History')}  ${tone.meta(state.cwd)}`,
    value: { type: 'meta', name: 'history' },
  });
  items.push({
    text: `${formatMeta(icon.files, 'Compose files')}  ${tone.meta(
      state.selectedFiles.length ? state.selectedFiles.join(', ') : 'auto-detect',
    )}`,
    value: { type: 'meta', name: 'files' },
  });
  items.push({
    text: formatMeta(icon.refresh, 'Refresh services'),
    value: { type: 'meta', name: 'refresh' },
  });
  items.push({ text: formatMeta(icon.quit, 'Quit', 'bad'), value: { type: 'meta', name: 'quit' } });

  return items;
}

/**
 * Renders the always-on main menu screen and resolves with the chosen
 * value ({type:'action', key} or {type:'meta', name}) once the user picks
 * something. Never resolves null - Escape/q on the main menu is treated as
 * "quit" for a cleaner top-level experience.
 */
export function showMainMenu(state: AppState): Promise<MenuChoice> {
  return new Promise((resolve) => {
    const screen = state.screen;
    const items = buildMenuItems(state);

    const subtitle = [
      tone.meta(state.cwd),
      tone.meta(`${state.services.length} services`),
      tone.meta(
        `${state.binary.bin}${state.binary.baseArgs.length ? ' ' + state.binary.baseArgs.join(' ') : ''}`,
      ),
    ].join(`  ${tone.sep()}  `);

    const header = makeHeader(screen, subtitle);

    // Keyboard-only navigation (mouse disabled here) so we can reliably
    // skip over the non-selectable category divider rows.
    const rawTexts = items.map((item) => item.text);
    const isDivider = (idx: number): boolean => !!(items[idx] && items[idx].divider);

    const list = blessed.list({
      top: MAIN_LIST_TOP,
      left: 2,
      right: 2,
      height: MAIN_LIST_HEIGHT,
      keys: false,
      mouse: false,
      tags: true,
      items: rawTexts.slice(),
      style: menuListStyle(),
    });

    const footer = makeFooter(screen, '↑↓ move  ·  tab group  ·  enter  ·  1–0 jump  ·  q quit');

    screen.append(list);
    list.focus();

    const firstReal = items.findIndex((item) => !item.divider);
    let current = firstReal;
    const relabel = (): void => applyShortcutLabels(list, rawTexts, isDivider);
    list.select(current);
    screen.render(); // lay out the list once so its row elements exist
    relabel();
    list.on('scroll', relabel);
    screen.render();

    const moveTo = (idx: number, direction: number): void => {
      let i = idx;
      while (i >= 0 && i < items.length && items[i]?.divider) i += direction;
      if (i < 0 || i >= items.length) return; // hit an edge, ignore
      current = i;
      list.select(current);
      relabel();
      screen.render();
    };

    const moveToGroup = (direction: 1 | -1): void => {
      const target = nextGroupItemIndex(items, current, direction);
      if (target === null || target === current) return;
      current = target;
      list.select(current);
      // When the jump pins the row to the top, pull the group header into view.
      const headerIdx = target - 1;
      if (headerIdx >= 0 && items[headerIdx]?.divider && (list.childBase || 0) > headerIdx) {
        list.scroll(-1);
      }
      relabel();
      screen.render();
    };

    let done = false;
    const finish = (value: MenuChoice): void => {
      if (done) return;
      done = true;
      list.destroy();
      footer.destroy();
      header.destroy();
      screen.render();
      resolve(value);
    };

    list.key(['up', 'k'], () => moveTo(current - 1, -1));
    list.key(['down', 'j'], () => moveTo(current + 1, 1));
    list.key(['tab'], () => moveToGroup(1));
    list.key(['S-tab'], () => moveToGroup(-1));
    list.key(['enter', 'f10'], () => {
      const entry = items[current];
      if (!entry || entry.divider || entry.value === null) return;
      finish(entry.value);
    });
    bindDigitShortcuts(list, items.length, isDivider, (idx) => {
      const entry = items[idx];
      if (!entry || entry.value === null) return;
      finish(entry.value);
    });
    const shortcutKeys = items.flatMap((item) => (item.shortcut ? [item.shortcut] : []));
    if (shortcutKeys.length) {
      list.key(shortcutKeys, (ch: string, key: { name?: string }) => {
        const name = key.name || ch;
        const entry = items.find((item) => item.shortcut === name);
        if (!entry?.value) return;
        finish(entry.value);
      });
    }
    list.key(['q'], () => finish({ type: 'meta', name: 'quit' }));
  });
}
