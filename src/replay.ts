import * as dockerCompose from './dockerCompose';
import * as history from './history';
import type { ComposeBinary, HistoryEntry, HistoryEntryInput } from './types';

export function historyEntryInput(entry: HistoryEntry): HistoryEntryInput {
  return {
    label: entry.label,
    command: entry.command,
    argv: entry.argv,
    global: !!entry.global,
    filesUsed: entry.filesUsed || [],
  };
}

/**
 * Run a cached command exactly as it was recorded. Returns the process exit code.
 */
export async function executeHistoryEntry(
  cwd: string,
  binary: ComposeBinary,
  entry: HistoryEntry,
): Promise<number> {
  const code = await dockerCompose.runInherited({
    bin: binary.bin,
    args: dockerCompose.buildArgs({
      baseArgs: binary.baseArgs,
      files: entry.global ? [] : entry.filesUsed || [],
      actionArgs: entry.argv,
    }),
    cwd,
  });

  history.addHistoryEntry(cwd, historyEntryInput(entry));
  return code;
}
