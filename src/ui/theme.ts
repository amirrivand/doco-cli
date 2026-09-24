/**
 * Cinematic dark glass.
 * Canvas is the ground, surface is the frosted card, raised is the
 * focused row. One indigo accent, green for go, coral for stop.
 * Type is the terminal's own mono face: tracking and weight do the hierarchy.
 */
export const palette = {
  canvas: '#0C1222',
  surface: '#171E32',
  raised: '#2C3658',
  scrim: '#06080F',
  hairline: '#6A6490',
  ink: '#F4F5F8',
  muted: '#A7B0C4',
  accent: '#B088FF',
  good: '#3DDC97',
  bad: '#F07178',
} as const;

export interface Theme {
  fg: string;
  bg: string;
  surface: string;
  border: { fg: string; bg: string };
  focusBorder: { fg: string; bg: string };
  label: { fg: string; bold: boolean };
  selected: { bg: string; fg: string; bold: boolean };
  muted: string;
  accent: string;
  good: string;
  bad: string;
}

const theme: Theme = {
  fg: palette.ink,
  bg: palette.canvas,
  surface: palette.surface,
  border: { fg: palette.hairline, bg: palette.surface },
  focusBorder: { fg: palette.accent, bg: palette.surface },
  label: { fg: palette.accent, bold: true },
  selected: { bg: palette.raised, fg: palette.ink, bold: true },
  muted: palette.muted,
  accent: palette.accent,
  good: palette.good,
  bad: palette.bad,
};

function open(color: string): string {
  return `{${color}-fg}`;
}

function close(color: string): string {
  return `{/${color}-fg}`;
}

export function paint(color: string, text: string): string {
  return `${open(color)}${text}${close(color)}`;
}

export function paintBold(color: string, text: string): string {
  return `{bold}${open(color)}${text}${close(color)}{/bold}`;
}

/** Tracked capitals for section labels. */
export function track(label: string): string {
  return label.toUpperCase().split('').join(' ');
}

export const tone = {
  wordmark(): string {
    return `{bold}${paint(palette.ink, 'd o c')}${paint(palette.accent, 'o')}{/bold}`;
  },
  eyebrow(label: string): string {
    return paint(palette.muted, track(label));
  },
  title(text: string): string {
    return paintBold(palette.ink, text);
  },
  body(text: string): string {
    return paint(palette.ink, text);
  },
  meta(text: string): string {
    return paint(palette.muted, text);
  },
  accent(text: string): string {
    return paint(palette.accent, text);
  },
  key(text: string): string {
    return paintBold(palette.accent, text);
  },
  good(text: string): string {
    return paint(palette.good, text);
  },
  cta(text: string): string {
    return paintBold(palette.good, text);
  },
  bad(text: string): string {
    return paint(palette.bad, text);
  },
  sep(): string {
    return paint(palette.muted, '·');
  },
};

export function glassStyle(focused = false): {
  fg: string;
  bg: string;
  border: { fg: string; bg: string };
  label: { fg: string; bold: boolean };
} {
  return {
    fg: palette.ink,
    bg: palette.surface,
    border: focused ? theme.focusBorder : theme.border,
    label: theme.label,
  };
}

export function menuListStyle(): {
  fg: string;
  bg: string;
  selected: { bg: string; fg: string; bold: boolean };
  item: { fg: string; bg: string };
} {
  return {
    fg: palette.ink,
    bg: palette.canvas,
    selected: theme.selected,
    item: { fg: palette.ink, bg: palette.canvas },
  };
}

export default theme;
