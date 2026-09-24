import blessed from 'blessed';
import { icon } from './glyphs';
import { menuListStyle, tone } from './theme';
import {
  makeFooter,
  makeTitle,
  flowListTop,
  flowListHeight,
  selectList,
  multiSelectList,
  textPrompt,
  confirm,
  applyShortcutLabels,
  bindDigitShortcuts,
} from './widgets';
import { createScreen } from './screenFactory';
import * as dockerCompose from '../dockerCompose';
import * as history from '../history';
import { executeHistoryEntry } from '../replay';
import type {
  Action,
  AppState,
  ExtraArgSpec,
  FlagSpec,
  FlagValues,
  HistoryEntry,
  Screen,
} from '../types';

/**
 * Very small shell-style tokenizer: splits on whitespace but respects
 * single and double quotes, so `sh -c "echo hello world"` becomes
 * ['sh', '-c', 'echo hello world'].
 */
export function tokenize(str: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(str)) !== null) {
    const doubleQuoted = match[1];
    const singleQuoted = match[2];
    const bare = match[3];
    if (doubleQuoted !== undefined) tokens.push(doubleQuoted);
    else if (singleQuoted !== undefined) tokens.push(singleQuoted);
    else if (bare !== undefined) tokens.push(bare);
  }
  return tokens;
}

/**
 * A single screen that lists every flag for the action. Boolean flags
 * toggle in place with space/enter; text flags open a small prompt to
 * edit their value. A pinned "Continue" row moves to the next step.
 *
 * Resolves with a map { [flag]: true | string } - or null if the user
 * cancelled the whole flow.
 */
function flagsEditor(
  screen: Screen,
  { title, flags }: { title: string; flags: FlagSpec[] },
): Promise<FlagValues | null> {
  return new Promise((resolve) => {
    if (!flags.length) {
      resolve({});
      return;
    }

    const values: Array<boolean | string> = flags.map((flag) =>
      flag.type === 'bool' ? Boolean(flag.default) : flag.default ? String(flag.default) : '',
    );
    const CONTINUE_IDX = flags.length;

    const header = makeTitle(screen, title);
    const listTop = flowListTop(0);

    const renderLine = (flag: FlagSpec, value: boolean | string): string => {
      if (flag.type === 'bool') {
        const mark = value ? tone.good(icon.on) : tone.meta(icon.off);
        return `${mark}  ${tone.body(flag.label)}  ${tone.meta(flag.flag)}`;
      }
      const shown = value
        ? tone.accent(String(value))
        : tone.meta(flag.placeholder ? `not set  ·  ${flag.placeholder}` : 'not set');
      return `${tone.meta(icon.chevron)}  ${tone.body(flag.label)}  ${tone.meta(flag.flag)}  ${shown}`;
    };

    const items = [
      ...flags.map((flag, index) => renderLine(flag, values[index] ?? '')),
      `${tone.good(icon.forward)}  ${tone.cta('Continue')}`,
    ];

    const list = blessed.list({
      top: listTop,
      left: 2,
      right: 2,
      height: flowListHeight(listTop),
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      items: items.slice(),
      style: menuListStyle(),
    });

    const footer = makeFooter(screen, 'space toggle  ·  enter edit  ·  c continue  ·  esc cancel');

    screen.append(list);
    list.focus();
    screen.render(); // lay out the list once so its row elements exist

    const relabel = (): void => applyShortcutLabels(list, items, null);
    relabel();
    list.on('scroll', relabel);
    screen.render();

    const refresh = (): void => {
      flags.forEach((flag, index) => {
        items[index] = renderLine(flag, values[index] ?? '');
      });
      relabel();
      screen.render();
    };

    let done = false;
    const finish = (result: FlagValues | null): void => {
      if (done) return;
      done = true;
      list.destroy();
      footer.destroy();
      header.destroy();
      screen.render();
      resolve(result);
    };

    const buildResult = (): FlagValues => {
      const result: FlagValues = {};
      flags.forEach((flag, index) => {
        const value = values[index];
        if (flag.type === 'bool' && value) result[flag.flag] = true;
        if (flag.type === 'text' && value && String(value).trim() !== '') {
          result[flag.flag] = String(value).trim();
        }
      });
      return result;
    };

    const activate = async (idx: number): Promise<void> => {
      if (idx === CONTINUE_IDX) {
        finish(buildResult());
        return;
      }
      const flag = flags[idx];
      if (!flag) return;
      if (flag.type === 'bool') {
        values[idx] = !values[idx];
        refresh();
        return;
      }
      const current = values[idx];
      const val = await textPrompt(screen, {
        title: current ? `${flag.label} (currently: ${current} — empty keeps it)` : flag.label,
        placeholder: flag.placeholder,
        initial: '',
      });
      list.focus();
      // Typing something replaces the value; submitting empty keeps the
      // existing one, so re-editing never silently appends to old text.
      if (val !== null && val.trim() !== '') values[idx] = val.trim();
      refresh();
    };

    list.key('space', () => {
      const idx = list.selected;
      const flag = flags[idx];
      if (idx < flags.length && flag && flag.type === 'bool') {
        values[idx] = !values[idx];
        refresh();
      }
    });
    list.on('select', (_item, idx: number) => {
      void activate(idx);
    });
    bindDigitShortcuts(list, items.length, null, (idx) => {
      void activate(idx);
    });
    list.key(['c', 'f10'], () => finish(buildResult()));
    list.key(['escape', 'q'], () => finish(null));
  });
}

async function pickServices(
  screen: Screen,
  state: AppState,
  action: Action,
): Promise<{ services: string[]; cancelled: boolean }> {
  const services = state.services;

  if (action.needsServices === 'none') return { services: [], cancelled: false };

  if (action.needsServices === 'required-single') {
    if (services.length) {
      const chosen = await selectList(screen, {
        title: `Select a service for "${action.key}"`,
        items: services.map((service) => ({
          text: `${tone.meta(icon.chevron)}  ${service}`,
          value: service,
        })),
      });
      if (chosen === null) return { services: [], cancelled: true };
      return { services: [chosen], cancelled: false };
    }
    const typed = await textPrompt(screen, {
      title: 'Service name (none detected automatically)',
      placeholder: 'web',
    });
    if (!typed) return { services: [], cancelled: true };
    return { services: [typed.trim()], cancelled: false };
  }

  if (!services.length) {
    if (action.needsServices === 'required') {
      const typed = await textPrompt(screen, {
        title: 'Service name(s), space separated (none detected automatically)',
        placeholder: 'web worker',
      });
      if (!typed) return { services: [], cancelled: true };
      return { services: typed.trim().split(/\s+/).filter(Boolean), cancelled: false };
    }
    return { services: [], cancelled: false }; // optional + unknown services -> "all"
  }

  const allowEmpty = action.needsServices === 'optional';
  const chosen = await multiSelectList(screen, {
    title: `Select service(s) for "${action.key}"${allowEmpty ? '  (none = all services)' : ''}`,
    items: services.map((service) => ({
      text: `${tone.meta(icon.chevron)}  ${service}`,
      value: service,
    })),
    allowEmpty,
  });
  if (chosen === null) return { services: [], cancelled: true };
  return { services: chosen, cancelled: false };
}

async function collectExtraArgs(
  screen: Screen,
  action: Action,
): Promise<Record<string, string> | null> {
  const values: Record<string, string> = {};
  for (const spec of action.extraArgs || []) {
    const title = spec.default
      ? `${spec.label} (empty uses default: ${spec.default})`
      : `${spec.label}${spec.required ? ' (required)' : ' (optional)'}`;

    const val = await textPrompt(screen, {
      title,
      placeholder: spec.placeholder,
      initial: '',
    });
    if (val === null) return null; // cancelled

    let finalVal = val.trim();
    if (!finalVal && spec.default) finalVal = spec.default;
    if (spec.required && !finalVal) return null;
    values[spec.name] = finalVal;
  }
  return values;
}

export function buildArgv(
  action: Action,
  flagValues: FlagValues,
  serviceList: string[],
  extraArgValues: Record<string, string>,
): string[] {
  const argv = [action.key];

  (action.flags || []).forEach((flag) => {
    const value = flagValues[flag.flag];
    if (value === undefined) return;
    if (flag.type === 'bool') {
      argv.push(flag.flag);
    } else if (flag.repeatable) {
      String(value)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => argv.push(flag.flag, token));
    } else {
      argv.push(flag.flag, String(value));
    }
  });

  const appendExtra = (spec: ExtraArgSpec): void => {
    const val = extraArgValues[spec.name];
    if (!val) return;
    if (action.needsServices === 'required-single' && spec.name === 'command') {
      argv.push(...tokenize(val));
    } else {
      argv.push(val);
    }
  };

  if (action.needsServices === 'required-single') {
    const only = serviceList[0];
    if (only) argv.push(only);
    (action.extraArgs || []).forEach(appendExtra);
  } else {
    (action.extraArgs || []).forEach(appendExtra);
    if (serviceList.length) argv.push(...serviceList);
  }

  return argv;
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}

/**
 * Tear the TUI down, run the real `docker compose ...` with a fully
 * inherited TTY (so colors, progress bars, follow mode and Ctrl+C all work
 * exactly like running it by hand), then rebuild the TUI.
 *
 * Mutates state.screen to point at the freshly created screen.
 */
async function executeArgv(
  state: AppState,
  action: Action,
  argv: string[],
  filesOverride?: string[],
): Promise<void> {
  const filesUsed = action.global ? [] : filesOverride || state.selectedFiles || [];
  const fullArgs = dockerCompose.buildArgs({
    baseArgs: state.binary.baseArgs,
    files: filesUsed,
    actionArgs: argv,
  });

  const commandString = `${state.binary.bin} ${fullArgs.join(' ')}`;

  const proceed = await confirm(state.screen, `Run:\n\n  ${commandString}`);
  if (!proceed) return;

  state.screen.destroy();

  process.stdout.write(`\n$ ${commandString}\n\n`);
  const code = await dockerCompose.runInherited({
    bin: state.binary.bin,
    args: fullArgs,
    cwd: state.cwd,
  });
  process.stdout.write(`\n[exit code ${code}] — press Enter to return to doco...`);
  await waitForEnter();

  history.addHistoryEntry(state.cwd, {
    label: `${action.key} ${argv.slice(1).join(' ')}`.trim(),
    command: commandString,
    argv,
    global: !!action.global,
    filesUsed,
  });

  state.screen = createScreen();
}

/**
 * Run the full wizard for one action: pick services -> edit flags -> confirm
 * -> execute -> save to history.
 */
export async function runActionFlow(state: AppState, action: Action): Promise<void> {
  const { cancelled: svcCancelled, services } = await pickServices(state.screen, state, action);
  if (svcCancelled) return;

  const flagValues = await flagsEditor(state.screen, {
    title: `Options for "docker compose ${action.key}"`,
    flags: action.flags || [],
  });
  if (flagValues === null) return;

  const extraArgValues = await collectExtraArgs(state.screen, action);
  if (extraArgValues === null) return;

  const argv = buildArgv(action, flagValues, services, extraArgValues);
  await executeArgv(state, action, argv);
}

/**
 * Re-run a previously cached command exactly as it was recorded.
 */
export async function runFromHistory(state: AppState, entry: HistoryEntry): Promise<void> {
  const ok = await confirm(state.screen, `Run again:\n\n  ${entry.command}`);
  if (!ok) return;

  state.screen.destroy();
  process.stdout.write(`\n$ ${entry.command}\n\n`);
  const code = await executeHistoryEntry(state.cwd, state.binary, entry);
  process.stdout.write(`\n[exit code ${code}] — press Enter to return to doco...`);
  await waitForEnter();

  state.screen = createScreen();
}
