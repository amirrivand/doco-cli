import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { spawn, spawnSync } from 'child_process';
import type { ComposeBinary } from './types';

export const COMPOSE_FILE_PATTERN = /^(docker-)?compose(\.[\w-]+)?\.ya?ml$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Find every file in `dir` that looks like a compose file.
 * Sorted so the "canonical" default files sort first.
 */
export function findComposeFileCandidates(dir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const matches = entries.filter((file) => COMPOSE_FILE_PATTERN.test(file));

  const rank = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower === 'compose.yaml' || lower === 'compose.yml') return 0;
    if (lower === 'docker-compose.yaml' || lower === 'docker-compose.yml') return 1;
    if (lower.includes('override')) return 2;
    return 3;
  };

  return matches.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Detect whether the `docker compose` (v2 plugin) or legacy `docker-compose`
 * binary is available. Prefers the v2 plugin syntax.
 */
export function detectComposeBinary(): ComposeBinary {
  const pluginCheck = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (pluginCheck.status === 0) {
    return { bin: 'docker', baseArgs: ['compose'] };
  }
  const legacyCheck = spawnSync('docker-compose', ['version'], { stdio: 'ignore' });
  if (legacyCheck.status === 0) {
    return { bin: 'docker-compose', baseArgs: [] };
  }
  // Fall back to the modern plugin form; the error will surface when run.
  return { bin: 'docker', baseArgs: ['compose'] };
}

function readComposeDoc(dir: string, file: string): Record<string, unknown> | null {
  try {
    const full = path.join(dir, file);
    const content = fs.readFileSync(full, 'utf8');
    const doc: unknown = yaml.load(content);
    return isRecord(doc) ? doc : null;
  } catch {
    // ignore parse errors, e.g. files using compose interpolation that
    // isn't valid standalone YAML in edge cases - not fatal.
    return null;
  }
}

function composeTargets(dir: string, files: string[]): string[] {
  return files.length ? files : findComposeFileCandidates(dir).slice(0, 1);
}

function collectKeys(doc: Record<string, unknown> | null, field: string, into: Set<string>): void {
  if (!doc) return;
  const value = doc[field];
  if (isRecord(value)) {
    Object.keys(value).forEach((key) => into.add(key));
  }
}

/**
 * Best-effort parse of service names out of one or more compose files.
 * This is only used to populate the service picker in the UI - the actual
 * `docker compose` invocation always uses the real CLI, so a partial/failed
 * parse here never breaks functionality, it just means the service list is
 * empty and the user can still target "all services".
 */
export function listServices(dir: string, files: string[]): string[] {
  const services = new Set<string>();
  for (const file of composeTargets(dir, files)) {
    collectKeys(readComposeDoc(dir, file), 'services', services);
  }
  return Array.from(services).sort();
}

export function listVolumesAndNetworks(
  dir: string,
  files: string[],
): { volumes: string[]; networks: string[] } {
  const volumes = new Set<string>();
  const networks = new Set<string>();
  for (const file of composeTargets(dir, files)) {
    const doc = readComposeDoc(dir, file);
    collectKeys(doc, 'volumes', volumes);
    collectKeys(doc, 'networks', networks);
  }
  return { volumes: Array.from(volumes).sort(), networks: Array.from(networks).sort() };
}

/**
 * Build the full argv (excluding the binary itself) for a docker compose
 * invocation: [...baseArgs, ...(-f file)*, ...actionArgs]
 */
export function buildArgs({
  baseArgs,
  files,
  actionArgs,
}: {
  baseArgs: string[];
  files?: string[];
  actionArgs: string[];
}): string[] {
  const args = [...baseArgs];
  (files || []).forEach((file) => {
    args.push('-f', file);
  });
  args.push(...actionArgs);
  return args;
}

/**
 * Run a command with stdio fully inherited - used for anything interactive
 * or long-running (up in the foreground, logs -f, exec, run, attach, etc.)
 * Resolves with the exit code.
 */
export function runInherited({
  bin,
  args,
  cwd,
}: {
  bin: string;
  args: string[];
  cwd: string;
}): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, stdio: 'inherit' });
    child.on('close', (code) => resolve(code === null ? 1 : code));
    child.on('error', (err: Error) => {
      process.stderr.write(`\nFailed to launch "${bin}": ${err.message}\n`);
      resolve(1);
    });
  });
}

/**
 * Run a command and capture combined stdout/stderr, streaming chunks to
 * an onData callback as they arrive. Used inside the blessed output pane.
 */
export function runCaptured({
  bin,
  args,
  cwd,
  onData,
}: {
  bin: string;
  args: string[];
  cwd: string;
  onData: (chunk: string) => void;
}): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd });
    child.stdout?.on('data', (chunk: Buffer) => onData(chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => onData(chunk.toString()));
    child.on('close', (code) => resolve(code === null ? 1 : code));
    child.on('error', (err: Error) => {
      onData(`\nFailed to launch "${bin}": ${err.message}\n`);
      resolve(1);
    });
  });
}
