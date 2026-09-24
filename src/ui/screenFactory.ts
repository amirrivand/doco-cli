import blessed from 'blessed';
import theme from './theme';
import type { Screen } from '../types';

export function createScreen(): Screen {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'doco',
    fullUnicode: true,
    dockBorders: true,
  });
  blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });
  screen.key(['C-c', 'f4'], () => {
    screen.destroy();
    process.exit(0);
  });
  return screen;
}
