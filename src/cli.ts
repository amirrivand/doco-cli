#!/usr/bin/env node

import * as dockerCompose from './dockerCompose';
import { getAction } from './actionsConfig';
import { getLatestHistory } from './history';
import { executeHistoryEntry } from './replay';
import { createScreen } from './ui/screenFactory';
import { showMainMenu } from './ui/mainMenu';
import { runActionFlow, runFromHistory } from './ui/optionsFlow';
import { selectComposeFiles } from './ui/fileSelect';
import { showHistoryMenu } from './ui/historyMenu';
import { pause } from './ui/widgets';
import type { AppState } from './types';

function wantsLatestCommand(argv: string[]): boolean {
  return argv.includes('-l') || argv.includes('--last');
}

/**
 * `doco -l` reruns the newest cached command for this directory and exits
 * with that command's status. No menu, no confirmation.
 */
async function replayLatestCommand(): Promise<void> {
  const cwd = process.cwd();
  const entry = getLatestHistory(cwd);
  if (!entry) {
    console.error('No cached commands yet for this project.');
    process.exit(1);
  }

  const binary = dockerCompose.detectComposeBinary();
  process.stdout.write(`$ ${entry.command}\n\n`);
  const code = await executeHistoryEntry(cwd, binary, entry);
  process.exit(code);
}

async function main(): Promise<void> {
  if (wantsLatestCommand(process.argv.slice(2))) {
    await replayLatestCommand();
    return;
  }

  const cwd = process.cwd();
  const binary = dockerCompose.detectComposeBinary();
  const defaultFiles: string[] = []; // empty = let docker compose auto-discover

  const state: AppState = {
    cwd,
    binary,
    selectedFiles: defaultFiles,
    services: dockerCompose.listServices(cwd, defaultFiles),
    volumes: [],
    networks: [],
    screen: createScreen(),
  };
  Object.assign(state, dockerCompose.listVolumesAndNetworks(cwd, defaultFiles));

  while (true) {
    const choice = await showMainMenu(state);

    if (choice.type === 'meta') {
      if (choice.name === 'quit') break;
      if (choice.name === 'files') {
        await selectComposeFiles(state);
        continue;
      }
      if (choice.name === 'refresh') {
        state.services = dockerCompose.listServices(cwd, state.selectedFiles);
        Object.assign(state, dockerCompose.listVolumesAndNetworks(cwd, state.selectedFiles));
        await pause(state.screen, `Refreshed — ${state.services.length} service(s) detected`);
        continue;
      }
      if (choice.name === 'history') {
        await showHistoryMenu(state);
        continue;
      }
      continue;
    }

    if (choice.type === 'action') {
      const action = getAction(choice.key);
      if (action) await runActionFlow(state, action);
      continue;
    }

    if (choice.type === 'history') {
      await runFromHistory(state, choice.entry);
      continue;
    }
  }

  state.screen.destroy();
  process.stdout.write('\n◈  see you next time.\n');
  process.exit(0);
}

main().catch((err: unknown) => {
  try {
    // Best-effort terminal restore if something threw mid-render.
    process.stdout.write('\x1b[?1049l\x1b[?25h');
  } catch {
    /* ignore */
  }
  const detail = err instanceof Error && err.stack ? err.stack : err;
  console.error('\ndoco crashed:', detail);
  process.exit(1);
});
