# doco

```
┌─────────────────────────────────────────────────────────┐
│  doco · terminal GUI for Docker Compose                 │
│  menus · flags · history — no flags to memorize         │
└─────────────────────────────────────────────────────────┘
```

A thin, honest TUI over the real `docker compose` CLI. Drop into any
project with a compose file, pick actions from menus, toggle every flag
as a checkbox or prompt, and re-run past commands with one keystroke —
or from the shell, with `doco -l`.

We know GUIs are useful — but as a developer, typing in the terminal is
usually faster. doco is built for both worlds: it helps you assemble
commands when you need them, and it trains you on compose subcommands,
arguments, and options along the way — so you learn the CLI without
digging through docs or asking a chatbot.

doco never talks to the Docker daemon — it only builds and runs real
`docker compose` commands. Anything it can do, you could type by hand;
it just remembers the flags for you.

---

## Why doco

|              |                                                                               |
| ------------ | ----------------------------------------------------------------------------- |
| **Discover** | Every compose subcommand and flag, surfaced in menus — not buried in `--help` |
| **Confirm**  | See the exact `docker compose …` line before it runs                          |
| **Replay**   | Per-project history in the menu, or `doco -l` from the shell                  |

---

## Install

```bash
npm install -g @doco/cli
```

That installs the `doco` command. Run it as `doco` — the package name is only for install and uninstall.

**Requirements:** Node.js 16+ and either the Docker Compose v2 plugin
(`docker compose`) or the legacy `docker-compose` binary on your `PATH`.

---

## Use

```bash
cd your-project   # anywhere with compose.yaml / docker-compose.yml
doco              # open the menu
doco -l           # rerun the latest command for this directory
```

### Replay the latest command

`doco -l` (long form: `doco --last`) skips the menu and runs the newest
command saved for this directory, with the same arguments and compose
files. doco prints the command, runs it immediately, and exits with
that command’s status.

```bash
doco -l
# $ docker compose up -d
```

If nothing has been run in this directory yet, doco prints
`No cached commands yet for this project.` and exits `1`.

### Flow

1. **Pick an action** — menu grouped by category (Lifecycle, Build, Execute, Inspect, Data).
2. **Pick service(s)** — detected by parsing your compose file(s).
3. **Set options** — every flag the real subcommand supports, as toggles or text fields.
4. **Confirm** — review the exact command.
5. **Run** — full terminal handoff (colors, progress bars, Ctrl+C, `logs -f`, interactive `exec`).

### Menu categories

| Category           | Actions                                              |
| ------------------ | ---------------------------------------------------- |
| **Lifecycle**      | up, down, start, stop, restart, pause, unpause, kill |
| **Build & Images** | build, pull, push, create                            |
| **Execute**        | exec, run, rm                                        |
| **Inspect**        | ps, logs, top, images, port, config, events          |
| **Data**           | cp, watch, wait, ls, version                         |

### Keyboard

Every screen shows a footer with available keys. These work everywhere:

| Key        | Action                                                     |
| ---------- | ---------------------------------------------------------- |
| **F4**     | Quit immediately (even mid-typing)                         |
| **F10**    | Continue — confirm, accept, submit, or jump to “Continue”  |
| **1–9, 0** | Jump to the item on that visible row (`[1]`–`[9]` / `[0]`) |

On the main menu, **Tab** moves to the first item of the next group (Recent, Lifecycle, Build & Images, and so on). **Shift+Tab** moves to the previous group. From the last group, Tab wraps around to the first group.

The actions you use most often also have a yellow letter on their row — the command's first letter. Press it from anywhere in the menu to open that action:

| Key   | Action  |
| ----- | ------- |
| **u** | up      |
| **d** | down    |
| **s** | stop    |
| **r** | restart |
| **b** | build   |
| **e** | exec    |
| **p** | ps      |
| **l** | logs    |

### History

Every command is saved per project (by cwd) in `~/.doco/history.json`.

- The **5 most recent** are pinned at the top of the main menu, newest first.
- Open **History** for the full list, re-run any entry, or clear it.
- `doco -l` reruns the newest entry from the shell. See [Replay the latest command](#replay-the-latest-command).

### Compose files

By default, doco lets `docker compose` auto-discover files
(`compose.yaml`, `docker-compose.yml`, overrides, etc.) exactly as the CLI does.

For differently named files (`docker-compose.dev.yml`, `docker-compose.prod.yml`, …),
open **Compose file(s)** from the main menu and pick which ones to pass as `-f`.

---

## Uninstall

```bash
npm uninstall -g @doco/cli
```

Cached history at `~/.doco/history.json` is left in place — delete it yourself for a clean slate.

---

## License

MIT
