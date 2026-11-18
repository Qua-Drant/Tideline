import type {IndexEvent, JournalEntry} from '../data/types.ts';

export type TimelineEntry = IndexEvent & {kind: 'event' | 'journal'};

export function timelineEntries(date: string, events: IndexEvent[], journal: JournalEntry[]): TimelineEntry[] {
  const result: TimelineEntry[] = events.map(event => ({...event, kind: 'event'}));
  for (const entry of journal) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(entry.time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || !entry.text.trim()) continue;
    result.push({id: `tideline-journal:${date}:${entry.id}`, date, time: `${match[1].padStart(2, '0')}:${match[2]}`,
      title: entry.text, description: `随手记，来自日记/${date}.md。`, kind: 'journal'});
  }
  return result.sort((a, b) => a.time.localeCompare(b.time));
}
