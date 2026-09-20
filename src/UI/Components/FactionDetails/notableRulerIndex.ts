export interface NotableRulerIndexEntryInput {
  start: string;
  end: string;
  displayName: string;
  tags: string[];
}

export interface NotableRulerIndexEntry {
  dateRange: string;
  displayName: string;
  tagLine?: string;
}

export function buildNotableRulerIndexEntry(
  input: NotableRulerIndexEntryInput
): NotableRulerIndexEntry {
  const tags = input.tags.filter(Boolean).slice(0, 2);
  return {
    dateRange: `${input.start}—${input.end}`,
    displayName: input.displayName,
    tagLine: tags.length > 0 ? tags.join(" · ") : undefined,
  };
}
