import blessed, { Widgets } from 'blessed';
import theme, { glassStyle, menuListStyle, palette, tone } from './theme';
import { icon } from './glyphs';
import type { Screen } from '../types';

/** Masthead card is 4 rows and sits directly above the menu. */
const MASTHEAD_HEIGHT = 4;
const TITLE_HEIGHT = 3;
const FOOTER_HEIGHT = 1;

export const MAIN_LIST_TOP = MASTHEAD_HEIGHT;
export const MAIN_LIST_HEIGHT = '100%-5';

export function flowListTop(origin = 0): number {
  return origin + TITLE_HEIGHT;
}

export function flowListHeight(listTop: number): string {
  return `100%-${listTop + FOOTER_HEIGHT}`;
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

type KeyEvent = Widgets.Events.IKeyEventArg;
type ListWidget = Widgets.ListElement;

export interface ListItem<T> {
  text: string;
  value: T;
  checked?: boolean;
}

/**
 * The digit shortcut label for a row `offset` positions below the top of
 * the current viewport (0-based). Rows 0-8 get '1'-'9', row 9 gets '0'.
 * Anything outside 0-9 has no shortcut.
 */
export function shortcutForOffset(offset: number): string | null {
  if (offset < 0 || offset > 9) return null;
  return DIGIT_KEYS[offset] ?? null;
}

/**
 * Re-renders every row of `list` with a "[N] " shortcut prefix for
 * whichever ten rows are currently visible (based on list.childBase),
 * skipping divider rows. Call this after any render that might change
 * scroll position (initial render, selection, scroll events).
 *
 * `rawTexts[i]` is the item's text with no prefix; `isDivider(i)` reports
 * whether row i is a non-selectable divider.
 */
export function applyShortcutLabels(
  list: ListWidget,
  rawTexts: string[],
  isDivider: ((index: number) => boolean) | null,
): void {
  const base = list.childBase || 0;
  rawTexts.forEach((text, idx) => {
    const item = list.items[idx];
    if (!item) return; // not yet laid out / out of range - skip safely
    if (isDivider && isDivider(idx)) {
      list.setItem(item, text);
      return;
    }
    const key = shortcutForOffset(idx - base);
    const prefix = key ? `${tone.meta(`[${key}]`)} ` : '    ';
    list.setItem(item, prefix + text);
  });
}

/**
 * Binds digit keys 1-9,0 on `list` so pressing one jumps straight to
 * whichever item currently occupies that visible row and invokes
 * `onActivate(index)`. Rows outside the current viewport, and divider
 * rows, are ignored.
 */
export function bindDigitShortcuts(
  list: ListWidget,
  count: number,
  isDivider: ((index: number) => boolean) | null,
  onActivate: (index: number) => void,
): void {
  list.key(DIGIT_KEYS, (ch: string, key: KeyEvent) => {
    const offset = DIGIT_KEYS.indexOf(key.name || ch);
    if (offset === -1) return;
    const idx = (list.childBase || 0) + offset;
    if (idx < 0 || idx >= count) return;
    if (isDivider && isDivider(idx)) return;
    onActivate(idx);
  });
}

function glassCard(
  screen: Screen,
  options: Widgets.BoxOptions,
  focused = false,
): Widgets.BoxElement {
  const box = blessed.box({
    tags: true,
    wrap: false,
    align: 'left',
    border: { type: 'line' },
    ...options,
    style: { ...glassStyle(focused), ...options.style },
  });
  screen.append(box);
  return box;
}

/**
 * Floating masthead. Two lines inside a frosted card.
 */
export function makeHeader(screen: Screen, subtitle?: string): Widgets.BoxElement {
  const line1 = `${tone.accent(icon.brand)}  ${tone.wordmark()}{|} ${tone.meta('menus · flags · history')}`;
  const line2 = subtitle ? `   ${subtitle}` : '';
  return glassCard(screen, {
    top: 0,
    left: 1,
    right: 1,
    height: subtitle ? MASTHEAD_HEIGHT : TITLE_HEIGHT,
    content: subtitle ? `${line1}\n${line2}` : line1,
  });
}

/**
 * One-line glass title used on every screen after the main menu.
 * Pair with `flowListTop` so the list starts on the next row.
 */
export function makeTitle(screen: Screen, title: string, top = 0): Widgets.BoxElement {
  return glassCard(screen, {
    top,
    left: 1,
    right: 1,
    height: TITLE_HEIGHT,
    content: `${tone.accent(icon.brand)}  ${tone.title(title)}`,
  });
}

/**
 * Docked glass bar. `hint` is the screen's own keys; F10 and F4 are
 * always pinned to the right edge.
 */
export function makeFooter(screen: Screen, hint: string): Widgets.BoxElement {
  const keys = `${tone.key('F10')} ${tone.meta('continue')}   ${tone.bad('F4')} ${tone.meta('quit')}`;
  const box = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: FOOTER_HEIGHT,
    tags: true,
    wrap: false,
    align: 'left',
    content: ` ${tone.meta(hint)}{|}${keys} `,
    style: { fg: theme.muted, bg: theme.surface },
  });
  screen.append(box);
  return box;
}

function makeScrim(screen: Screen): Widgets.BoxElement {
  const scrim = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    style: { bg: palette.scrim },
  });
  screen.append(scrim);
  return scrim;
}

/**
 * A single-select list. Resolves with the selected item's `value`, or null
 * if the user cancels (Escape/q). Visible rows get 1-9,0 shortcuts, and
 * F10 acts as Enter on whatever is currently highlighted.
 *
 * items: [{ text, value }]
 */
export function selectList<T>(
  screen: Screen,
  {
    top = 0,
    height,
    title,
    items,
    hint,
  }: {
    top?: number | string;
    height?: number | string;
    title?: string;
    items: ListItem<T>[];
    hint?: string;
  },
): Promise<T | null> {
  return new Promise((resolve) => {
    const origin = typeof top === 'number' ? top : 0;
    const header = title ? makeTitle(screen, title, origin) : null;
    const listTop = header ? flowListTop(origin) : origin;

    const rawTexts = items.map((item) => item.text);

    const list = blessed.list({
      top: listTop,
      left: 2,
      right: 2,
      height: height || flowListHeight(listTop),
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      items: rawTexts.slice(),
      style: menuListStyle(),
    });

    const footer = makeFooter(screen, hint || '↑↓ move  ·  enter select  ·  esc back');

    screen.append(list);
    list.focus();
    screen.render(); // lay out the list once so its row elements exist

    const relabel = (): void => applyShortcutLabels(list, rawTexts, null);
    relabel();
    list.on('scroll', relabel);
    screen.render();

    let done = false;
    const finish = (value: T | null): void => {
      if (done) return;
      done = true;
      list.destroy();
      footer.destroy();
      if (header) header.destroy();
      screen.render();
      resolve(value);
    };

    list.on('select', (_item, index: number) => {
      const entry = items[index];
      if (entry) finish(entry.value);
    });
    bindDigitShortcuts(list, items.length, null, (idx) => {
      const entry = items[idx];
      if (entry) finish(entry.value);
    });
    list.key(['f10'], () => {
      const entry = items[list.selected];
      if (entry) finish(entry.value);
    });
    list.key(['escape', 'q'], () => finish(null));
  });
}

/**
 * A multi-select checkbox-style list. Toggle with space, confirm with Enter.
 * Resolves with an array of selected `value`s, or null if cancelled.
 * Visible rows get 1-9,0 shortcuts that toggle that row, and F10 always
 * confirms the current selections (same as Enter).
 *
 * items: [{ text, value, checked }]
 */
export function multiSelectList<T>(
  screen: Screen,
  {
    top = 0,
    title,
    items,
    hint,
    allowEmpty = true,
  }: {
    top?: number | string;
    title?: string;
    items: ListItem<T>[];
    hint?: string;
    allowEmpty?: boolean;
  },
): Promise<T[] | null> {
  return new Promise((resolve) => {
    const origin = typeof top === 'number' ? top : 0;
    const header = title ? makeTitle(screen, title, origin) : null;
    const listTop = header ? flowListTop(origin) : origin;

    const state = items.map((item) => !!item.checked);

    const renderLabel = (item: ListItem<T>, checked: boolean): string => {
      const mark = checked ? tone.good(icon.on) : tone.meta(icon.off);
      return `${mark}  ${item.text}`;
    };

    const list = blessed.list({
      top: listTop,
      left: 2,
      right: 2,
      height: flowListHeight(listTop),
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      items: items.map((item, idx) => renderLabel(item, state[idx] ?? false)),
      style: menuListStyle(),
    });

    const footer = makeFooter(
      screen,
      hint || 'space toggle  ·  enter confirm  ·  a all  ·  n none  ·  esc back',
    );

    screen.append(list);
    list.focus();
    screen.render(); // lay out the list once so its row elements exist

    const refresh = (): void => {
      const rawTexts = items.map((item, idx) => renderLabel(item, state[idx] ?? false));
      applyShortcutLabels(list, rawTexts, null);
      screen.render();
    };
    refresh();
    list.on('scroll', refresh);

    let done = false;
    const finish = (value: T[] | null): void => {
      if (done) return;
      done = true;
      list.destroy();
      footer.destroy();
      if (header) header.destroy();
      screen.render();
      resolve(value);
    };

    const confirmSelection = (): void => {
      const selected = items.filter((_, idx) => state[idx]).map((item) => item.value);
      if (!allowEmpty && selected.length === 0) return;
      finish(selected);
    };

    list.key('space', () => {
      const idx = list.selected;
      state[idx] = !state[idx];
      refresh();
    });
    list.key('a', () => {
      for (let i = 0; i < state.length; i++) state[i] = true;
      refresh();
    });
    list.key('n', () => {
      for (let i = 0; i < state.length; i++) state[i] = false;
      refresh();
    });
    bindDigitShortcuts(list, items.length, null, (idx) => {
      state[idx] = !state[idx];
      refresh();
    });
    list.key('enter', confirmSelection);
    list.key(['f10'], confirmSelection);
    list.key(['escape', 'q'], () => finish(null));
  });
}

/**
 * A single-line text prompt. Resolves with the entered string, or null if
 * cancelled. F10 submits, same as Enter.
 */
export function textPrompt(
  screen: Screen,
  {
    title,
    placeholder = '',
    initial = '',
  }: { title: string; placeholder?: string; initial?: string },
): Promise<string | null> {
  return new Promise((resolve) => {
    const scrim = makeScrim(screen);
    const box = glassCard(
      screen,
      {
        top: 'center',
        left: 'center',
        width: '64%',
        height: 6,
        label: ` ${title} `,
      },
      true,
    );

    const input = blessed.textbox({
      parent: box,
      top: 1,
      left: 2,
      right: 2,
      height: 1,
      inputOnFocus: true,
      style: { fg: theme.fg, bg: theme.surface },
    });

    blessed.box({
      parent: box,
      bottom: 0,
      left: 2,
      right: 2,
      height: 1,
      tags: true,
      style: { bg: theme.surface },
      content: `${tone.meta('enter / F10 confirm')}   ${tone.meta('esc cancel')}${
        placeholder ? `   ${tone.meta(`e.g. ${placeholder}`)}` : ''
      }`,
    });
    input.setValue(initial);
    input.focus();
    screen.render();

    let done = false;
    const finish = (value: string | null): void => {
      if (done) return;
      done = true;
      box.destroy();
      scrim.destroy();
      screen.render();
      resolve(value);
    };

    input.key(['escape'], () => finish(null));
    input.key(['f10'], () => finish(input.getValue()));
    input.key(['f4'], () => {
      // The textbox grabs all keys while reading input, so the screen-level
      // global F4 handler never sees this — bind it here too.
      screen.destroy();
      process.exit(0);
    });
    input.on('submit', (value: string) => finish(value));
    input.on('cancel', () => finish(null));
    input.readInput();
  });
}

/**
 * A blocking informational message. Waits for any key before resolving.
 */
export function pause(screen: Screen, message: string): Promise<void> {
  return new Promise((resolve) => {
    const box = glassCard(screen, {
      bottom: 0,
      left: 1,
      right: 1,
      height: 3,
      content: `${tone.accent(icon.brand)}  ${tone.body(message)}  ${tone.meta('·  any key')}`,
    });
    screen.render();
    screen.once('keypress', () => {
      box.destroy();
      screen.render();
      resolve();
    });
  });
}

/**
 * Yes/no confirmation. Resolves true/false. F10 always means "yes".
 */
export function confirm(screen: Screen, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const lineCount = String(message).split('\n').length;
    const height = Math.min(20, lineCount + 6);
    const scrim = makeScrim(screen);
    const box = glassCard(
      screen,
      {
        top: 'center',
        left: 'center',
        width: '64%',
        height,
        wrap: true,
        content: [
          '',
          ` ${tone.title(message)}`,
          '',
          ` ${tone.good('y')}  ${tone.meta('/')}  ${tone.key('F10')}   ${tone.meta('yes')}      ${tone.bad('n')}   ${tone.meta('no')}`,
        ].join('\n'),
      },
      true,
    );
    screen.render();

    const onKey = (_ch: string, key: KeyEvent): void => {
      if (key.name === 'y' || key.name === 'f10') {
        cleanup();
        resolve(true);
      } else if (key.name === 'n' || key.name === 'escape') {
        cleanup();
        resolve(false);
      }
    };
    const cleanup = (): void => {
      screen.removeListener('keypress', onKey);
      box.destroy();
      scrim.destroy();
      screen.render();
    };
    screen.on('keypress', onKey);
  });
}

/**
 * A scrollable read-only text viewer (for showing captured command output,
 * history details, etc). Waits for Escape/q.
 */
export function textViewer(
  screen: Screen,
  {
    top = 0,
    title,
    content,
    hint,
  }: { top?: number | string; title?: string; content: string; hint?: string },
): Promise<void> {
  return new Promise((resolve) => {
    const origin = typeof top === 'number' ? top : 0;
    const header = title ? makeTitle(screen, title, origin) : null;
    const listTop = header ? flowListTop(origin) : origin;

    const box = blessed.box({
      top: listTop,
      left: 2,
      right: 2,
      height: flowListHeight(listTop),
      content,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: { ch: ' ', track: { bg: palette.canvas }, style: { bg: palette.accent } },
      style: { fg: palette.ink, bg: palette.canvas },
    });

    const footer = makeFooter(screen, hint || '↑↓ scroll  ·  esc back');

    screen.append(box);
    box.focus();
    screen.render();

    const finish = (): void => {
      box.destroy();
      footer.destroy();
      if (header) header.destroy();
      screen.render();
      resolve();
    };

    box.key(['escape', 'q', 'f10'], finish);
  });
}

export { DIGIT_KEYS };
