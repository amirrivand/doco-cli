import type { Widgets } from 'blessed';

export type Screen = Widgets.Screen;

export type NeedsServices = 'none' | 'optional' | 'required' | 'required-single';

export interface FlagSpec {
  flag: string;
  label: string;
  type: 'bool' | 'text';
  placeholder?: string;
  repeatable?: boolean;
  default?: boolean | string;
}

export interface ExtraArgSpec {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  default?: string;
}

export interface Action {
  key: string;
  /** Single letter that runs this action from anywhere on the main menu. */
  shortcut?: string;
  label: string;
  category: string;
  needsServices: NeedsServices;
  global?: boolean;
  interactive?: boolean;
  flags: FlagSpec[];
  extraArgs?: ExtraArgSpec[];
}

export interface ComposeBinary {
  bin: string;
  baseArgs: string[];
}

export interface HistoryEntryInput {
  label: string;
  command: string;
  argv: string[];
  global?: boolean;
  filesUsed: string[];
}

export interface HistoryEntry extends HistoryEntryInput {
  id: string;
  timestamp: string;
}

export interface AppState {
  cwd: string;
  binary: ComposeBinary;
  selectedFiles: string[];
  services: string[];
  volumes: string[];
  networks: string[];
  screen: Screen;
}

export type MenuChoice =
  | { type: 'action'; key: string }
  | { type: 'meta'; name: 'history' | 'files' | 'refresh' | 'quit' }
  | { type: 'history'; entry: HistoryEntry };

export type FlagValues = Record<string, true | string>;
