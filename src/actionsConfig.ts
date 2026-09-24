import type { Action } from './types';

/**
 * Each action describes one `docker compose <cmd>` subcommand.
 *
 * key            - the subcommand itself, e.g. "up"
 * shortcut       - optional main-menu hotkey (the command's first letter).
 *                  Only the actions used most often get one, and only when
 *                  that letter isn't already taken by a more common command
 *                  or by q/j/k (quit and vim-style movement).
 * label          - shown in the main menu
 * category       - grouping used to add section headers in the menu
 * needsServices  - 'none' | 'optional' | 'required' | 'required-single'
 *                  ('required-single' = exactly one service must be picked,
 *                   used for exec/run/port which don't accept multiple)
 * global         - true if the command isn't scoped to the current project's
 *                  services at all (e.g. `docker compose ls`, `version`)
 * flags          - array of { flag, label, type: 'bool'|'text', placeholder,
 *                  repeatable, default }
 * extraArgs      - array of { name, label, placeholder, required } free-text
 *                  values appended positionally after the flags (and after
 *                  service names, where relevant), e.g. the command to run
 *                  for `exec`/`run`, or the port for `port`.
 * interactive    - true = run with inherited stdio (full TTY: colors,
 *                  progress bars, Ctrl+C, follow mode, shells, etc.)
 */

export const ACTIONS: Action[] = [
  // ---------------------------------------------------------------- Lifecycle
  {
    key: 'up',
    shortcut: 'u',
    label: 'up — create & start containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '-d', label: 'Detached mode (run in background)', type: 'bool' },
      { flag: '--build', label: 'Build images before starting', type: 'bool' },
      { flag: '--force-recreate', label: 'Force recreate containers', type: 'bool' },
      { flag: '--no-recreate', label: "Don't recreate if already exists", type: 'bool' },
      { flag: '--no-deps', label: "Don't start linked services", type: 'bool' },
      { flag: '--remove-orphans', label: 'Remove containers for undefined services', type: 'bool' },
      { flag: '--abort-on-container-exit', label: 'Stop all on any container exit', type: 'bool' },
      { flag: '--always-recreate-deps', label: 'Recreate dependencies too', type: 'bool' },
      { flag: '-V', label: 'Renew anonymous volumes', type: 'bool' },
      { flag: '--wait', label: 'Wait for services to be healthy/running', type: 'bool' },
      { flag: '--no-start', label: "Create containers but don't start them", type: 'bool' },
      { flag: '--quiet-pull', label: 'Suppress pull progress output', type: 'bool' },
      {
        flag: '--scale',
        label: 'Scale overrides, e.g. "web=3 worker=2"',
        type: 'text',
        repeatable: true,
        placeholder: 'service=num service=num',
      },
      { flag: '--timeout', label: 'Shutdown timeout (seconds)', type: 'text', placeholder: '10' },
    ],
  },
  {
    key: 'down',
    shortcut: 'd',
    label: 'down — stop & remove containers/networks',
    category: 'Lifecycle',
    needsServices: 'none',
    interactive: true,
    flags: [
      { flag: '--volumes', label: 'Also remove named + anonymous volumes', type: 'bool' },
      { flag: '--remove-orphans', label: 'Remove containers for undefined services', type: 'bool' },
      {
        flag: '--rmi',
        label: 'Remove images too (all/local)',
        type: 'text',
        placeholder: 'all | local',
      },
      { flag: '--timeout', label: 'Shutdown timeout (seconds)', type: 'text', placeholder: '10' },
    ],
  },
  {
    key: 'start',
    label: 'start — start existing containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [],
  },
  {
    key: 'stop',
    shortcut: 's',
    label: 'stop — stop running containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '--timeout', label: 'Shutdown timeout (seconds)', type: 'text', placeholder: '10' },
    ],
  },
  {
    key: 'restart',
    shortcut: 'r',
    label: 'restart — restart containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '--timeout', label: 'Shutdown timeout (seconds)', type: 'text', placeholder: '10' },
      { flag: '--no-deps', label: "Don't restart linked services", type: 'bool' },
    ],
  },
  {
    key: 'pause',
    label: 'pause — pause running containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [],
  },
  {
    key: 'unpause',
    label: 'unpause — resume paused containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [],
  },
  {
    key: 'kill',
    label: 'kill — force-stop containers',
    category: 'Lifecycle',
    needsServices: 'optional',
    interactive: true,
    flags: [{ flag: '--signal', label: 'Signal to send', type: 'text', placeholder: 'SIGKILL' }],
  },

  // ------------------------------------------------------------ Build & pull
  {
    key: 'build',
    shortcut: 'b',
    label: 'build — build/rebuild images',
    category: 'Build & Images',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '--no-cache', label: 'Ignore build cache', type: 'bool' },
      { flag: '--pull', label: 'Always pull newer base images', type: 'bool' },
      { flag: '--parallel', label: 'Build images in parallel', type: 'bool' },
      { flag: '-q', label: 'Quiet output', type: 'bool' },
      {
        flag: '--progress',
        label: 'Progress output style',
        type: 'text',
        placeholder: 'auto | plain | tty',
      },
      {
        flag: '--build-arg',
        label: 'Build args, e.g. "KEY=VALUE KEY2=VALUE2"',
        type: 'text',
        repeatable: true,
        placeholder: 'KEY=VALUE',
      },
    ],
  },
  {
    key: 'pull',
    label: 'pull — pull service images',
    category: 'Build & Images',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '--ignore-pull-failures', label: 'Ignore pull failures', type: 'bool' },
      { flag: '--include-deps', label: 'Also pull dependency images', type: 'bool' },
      { flag: '-q', label: 'Quiet output', type: 'bool' },
      { flag: '--policy', label: 'Pull policy', type: 'text', placeholder: 'always | missing' },
    ],
  },
  {
    key: 'push',
    label: 'push — push service images',
    category: 'Build & Images',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '--include-deps', label: 'Also push dependency images', type: 'bool' },
      { flag: '--ignore-push-failures', label: 'Ignore push failures', type: 'bool' },
    ],
  },
  {
    key: 'create',
    label: 'create — create containers without starting',
    category: 'Build & Images',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '--force-recreate', label: 'Force recreate', type: 'bool' },
      { flag: '--no-recreate', label: "Don't recreate if exists", type: 'bool' },
      { flag: '--build', label: 'Build images before creating', type: 'bool' },
      { flag: '--no-build', label: "Don't build images", type: 'bool' },
    ],
  },

  // --------------------------------------------------------------- Execute
  {
    key: 'exec',
    shortcut: 'e',
    label: 'exec — run a command in a running container',
    category: 'Execute',
    needsServices: 'required-single',
    interactive: true,
    flags: [
      { flag: '-d', label: 'Detached mode', type: 'bool' },
      { flag: '--privileged', label: 'Give extended privileges', type: 'bool' },
      { flag: '-T', label: 'Disable pseudo-TTY allocation', type: 'bool' },
      { flag: '-u', label: 'User to run as', type: 'text', placeholder: 'root' },
      { flag: '-w', label: 'Working directory', type: 'text', placeholder: '/app' },
      {
        flag: '--index',
        label: 'Container index (scaled services)',
        type: 'text',
        placeholder: '1',
      },
      {
        flag: '-e',
        label: 'Environment vars, e.g. "KEY=VALUE"',
        type: 'text',
        repeatable: true,
        placeholder: 'KEY=VALUE',
      },
    ],
    extraArgs: [
      {
        name: 'command',
        label: 'Command to run',
        placeholder: 'sh',
        required: true,
        default: 'sh',
      },
    ],
  },
  {
    key: 'run',
    label: 'run — run a one-off command in a new container',
    category: 'Execute',
    needsServices: 'required-single',
    interactive: true,
    flags: [
      { flag: '--rm', label: 'Remove container after it exits', type: 'bool', default: true },
      { flag: '-d', label: 'Detached mode', type: 'bool' },
      { flag: '--no-deps', label: "Don't start linked services", type: 'bool' },
      { flag: '--service-ports', label: "Use the service's configured ports", type: 'bool' },
      { flag: '-T', label: 'Disable pseudo-TTY allocation', type: 'bool' },
      {
        flag: '--entrypoint',
        label: 'Override the entrypoint',
        type: 'text',
        placeholder: '/bin/sh',
      },
      { flag: '-u', label: 'User to run as', type: 'text', placeholder: 'root' },
      { flag: '-w', label: 'Working directory', type: 'text', placeholder: '/app' },
      {
        flag: '-p',
        label: 'Publish a port, e.g. "8080:80"',
        type: 'text',
        placeholder: 'HOST:CONTAINER',
      },
      {
        flag: '-e',
        label: 'Environment vars, e.g. "KEY=VALUE"',
        type: 'text',
        repeatable: true,
        placeholder: 'KEY=VALUE',
      },
    ],
    extraArgs: [
      { name: 'command', label: 'Command to run (optional)', placeholder: '', required: false },
    ],
  },
  {
    key: 'rm',
    label: 'rm — remove stopped containers',
    category: 'Execute',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '-f', label: 'Force removal (no confirmation)', type: 'bool' },
      { flag: '-s', label: 'Stop containers first if running', type: 'bool' },
      { flag: '-v', label: 'Remove anonymous volumes', type: 'bool' },
    ],
  },

  // --------------------------------------------------------------- Inspect
  {
    key: 'ps',
    shortcut: 'p',
    label: 'ps — list containers',
    category: 'Inspect',
    needsServices: 'optional',
    interactive: false,
    flags: [
      { flag: '-a', label: 'Show all (including stopped)', type: 'bool' },
      { flag: '--services', label: 'List service names only', type: 'bool' },
      { flag: '-q', label: 'Only display container IDs', type: 'bool' },
      {
        flag: '--status',
        label: 'Filter by status',
        type: 'text',
        placeholder: 'running | paused | exited',
      },
    ],
  },
  {
    key: 'logs',
    shortcut: 'l',
    label: 'logs — view output from containers',
    category: 'Inspect',
    needsServices: 'optional',
    interactive: true,
    flags: [
      { flag: '-f', label: 'Follow log output', type: 'bool' },
      { flag: '-t', label: 'Show timestamps', type: 'bool' },
      { flag: '--no-color', label: 'Disable color output', type: 'bool' },
      { flag: '--no-log-prefix', label: 'Hide the service name prefix', type: 'bool' },
      { flag: '--tail', label: 'Lines to show from the end', type: 'text', placeholder: 'all' },
      {
        flag: '--since',
        label: 'Show logs since',
        type: 'text',
        placeholder: '2024-01-01T00:00:00',
      },
      {
        flag: '--until',
        label: 'Show logs until',
        type: 'text',
        placeholder: '2024-01-01T00:00:00',
      },
    ],
  },
  {
    key: 'top',
    label: 'top — display running processes',
    category: 'Inspect',
    needsServices: 'optional',
    interactive: false,
    flags: [],
  },
  {
    key: 'images',
    label: 'images — list images used by containers',
    category: 'Inspect',
    needsServices: 'optional',
    interactive: false,
    flags: [{ flag: '-q', label: 'Only display image IDs', type: 'bool' }],
  },
  {
    key: 'port',
    label: 'port — print the public port for a binding',
    category: 'Inspect',
    needsServices: 'required-single',
    interactive: false,
    flags: [
      { flag: '--protocol', label: 'Protocol', type: 'text', placeholder: 'tcp | udp' },
      {
        flag: '--index',
        label: 'Container index (scaled services)',
        type: 'text',
        placeholder: '1',
      },
    ],
    extraArgs: [{ name: 'port', label: 'Private port', placeholder: '80', required: true }],
  },
  {
    key: 'config',
    label: 'config — validate & view the compose config',
    category: 'Inspect',
    needsServices: 'none',
    interactive: false,
    flags: [
      { flag: '--services', label: 'List service names only', type: 'bool' },
      { flag: '--volumes', label: 'List volume names only', type: 'bool' },
      { flag: '--profiles', label: 'List profile names only', type: 'bool' },
      { flag: '-q', label: 'Validate only (quiet)', type: 'bool' },
      { flag: '--resolve-image-digests', label: 'Pin images to digests', type: 'bool' },
      { flag: '--no-interpolate', label: "Don't interpolate env vars", type: 'bool' },
    ],
  },
  {
    key: 'events',
    label: 'events — stream real-time events',
    category: 'Inspect',
    needsServices: 'optional',
    interactive: true,
    flags: [{ flag: '--json', label: 'Output as JSON', type: 'bool' }],
  },

  // ------------------------------------------------------------ Data & misc
  {
    key: 'cp',
    label: 'cp — copy files between host and a container',
    category: 'Data',
    needsServices: 'none',
    interactive: false,
    flags: [
      { flag: '-a', label: 'Archive mode (preserve permissions)', type: 'bool' },
      { flag: '-L', label: 'Follow symbolic links', type: 'bool' },
    ],
    extraArgs: [
      {
        name: 'source',
        label: 'Source (SERVICE:PATH or local PATH)',
        placeholder: 'web:/app/logs/app.log',
        required: true,
      },
      {
        name: 'dest',
        label: 'Destination (local PATH or SERVICE:PATH)',
        placeholder: './app.log',
        required: true,
      },
    ],
  },
  {
    key: 'watch',
    label: 'watch — rebuild/refresh on file changes',
    category: 'Data',
    needsServices: 'optional',
    interactive: true,
    flags: [{ flag: '--no-up', label: "Don't run `up` before watching", type: 'bool' }],
  },
  {
    key: 'wait',
    label: 'wait — wait for containers to stop',
    category: 'Data',
    needsServices: 'required',
    interactive: true,
    flags: [{ flag: '--down-project', label: 'Also run `down` once they exit', type: 'bool' }],
  },
  {
    key: 'ls',
    label: 'ls — list all compose projects on this machine',
    category: 'Data',
    needsServices: 'none',
    global: true,
    interactive: false,
    flags: [
      { flag: '-a', label: 'Show stopped projects too', type: 'bool' },
      { flag: '--format', label: 'Output format', type: 'text', placeholder: 'table | json' },
    ],
  },
  {
    key: 'version',
    label: 'version — show the Docker Compose version',
    category: 'Data',
    needsServices: 'none',
    global: true,
    interactive: false,
    flags: [],
  },
];

export function getAction(key: string): Action | undefined {
  return ACTIONS.find((action) => action.key === key);
}

export function getCategories(): string[] {
  const seen: string[] = [];
  ACTIONS.forEach((action) => {
    if (!seen.includes(action.category)) seen.push(action.category);
  });
  return seen;
}
