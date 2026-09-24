import { icon } from './glyphs';
import { tone } from './theme';
import { selectList, pause, confirm } from './widgets';
import * as history from '../history';
import { runFromHistory } from './optionsFlow';
import type { AppState, HistoryEntry } from '../types';

function formatEntry(entry: HistoryEntry): string {
  const summary = entry.label || entry.argv.join(' ');
  return `${tone.accent(icon.recent)}  ${tone.body(summary)}  ${tone.meta(history.timeAgo(entry.timestamp))}`;
}

export async function showHistoryMenu(state: AppState): Promise<void> {
  while (true) {
    const entries = history.getHistory(state.cwd);

    if (!entries.length) {
      await pause(state.screen, 'No cached commands yet for this project');
      return;
    }

    const items = entries.map((entry) => ({ text: formatEntry(entry), value: entry.id }));
    items.push({
      text: `${tone.bad(icon.quit)}  ${tone.bad('Clear history')}`,
      value: '__clear__',
    });

    const choice = await selectList(state.screen, {
      title: `Command history — ${state.cwd}`,
      items,
      hint: '↑↓ move  ·  enter run  ·  esc back',
    });

    if (choice === null) return;

    if (choice === '__clear__') {
      const ok = await confirm(state.screen, 'Clear all cached commands for this project?');
      if (ok) {
        history.clearHistory(state.cwd);
        await pause(state.screen, 'History cleared');
      }
      continue;
    }

    const entry = entries.find((candidate) => candidate.id === choice);
    if (entry) {
      await runFromHistory(state, entry);
    }
  }
}
