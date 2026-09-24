export interface GroupedRow {
  divider?: boolean;
}

/** Index of the first selectable row in each divider-separated group. */
export function groupStartIndices(items: GroupedRow[]): number[] {
  const starts: number[] = [];
  let atBoundary = true;
  items.forEach((item, index) => {
    if (item.divider) {
      atBoundary = true;
      return;
    }
    if (atBoundary) {
      starts.push(index);
      atBoundary = false;
    }
  });
  return starts;
}

/**
 * First selectable row of the next or previous group.
 * Tab on the last group wraps to the first group's first item.
 */
export function nextGroupItemIndex(
  items: GroupedRow[],
  current: number,
  direction: 1 | -1,
): number | null {
  const starts = groupStartIndices(items);
  if (starts.length === 0) return null;

  let groupIndex = 0;
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    if (start !== undefined && start <= current) groupIndex = i;
  }

  const next = (groupIndex + direction + starts.length) % starts.length;
  return starts[next] ?? null;
}
