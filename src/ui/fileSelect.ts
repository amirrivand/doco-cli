import { icon } from './glyphs';
import { tone } from './theme';
import { multiSelectList, pause } from './widgets';
import * as dockerCompose from '../dockerCompose';
import type { AppState } from '../types';

/**
 * Lets the user choose which compose file(s) to pass as `-f`. An empty
 * selection means "let docker compose auto-discover them", which is the
 * default and correct choice for most projects.
 *
 * Mutates state.selectedFiles and state.services in place.
 */
export async function selectComposeFiles(state: AppState): Promise<void> {
  const candidates = dockerCompose.findComposeFileCandidates(state.cwd);

  if (!candidates.length) {
    await pause(
      state.screen,
      'No compose file found in this directory — docker compose will report an error if run',
    );
    return;
  }

  const chosen = await multiSelectList(state.screen, {
    title: 'Compose file(s) to use (none = let docker compose auto-detect)',
    items: candidates.map((file) => ({
      text: `${tone.meta(icon.files)}  ${file}`,
      value: file,
      checked: state.selectedFiles.includes(file),
    })),
    allowEmpty: true,
  });

  if (chosen === null) return; // cancelled, keep previous selection

  state.selectedFiles = chosen;
  state.services = dockerCompose.listServices(state.cwd, chosen);
  Object.assign(state, dockerCompose.listVolumesAndNetworks(state.cwd, chosen));
}
