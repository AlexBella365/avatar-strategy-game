// Decision journal (specs/npc_ai_plan.md §3 B.5): every LLM response recorded
// against the request fingerprint, so a match played with the LLM enabled can
// be replayed byte-for-byte with the network off.
export type JournalMode = "strategy" | "chooser";

export interface JournalEntry {
  /** State fingerprint (see hash.ts::stateHash). */
  key: string;
  mode: JournalMode;
  /** Raw model response text as received. */
  response: string;
}

export interface LlmJournal {
  record(entry: JournalEntry): void;
  /** Recorded response for a fingerprint+mode, or undefined when absent. */
  get(key: string, mode: JournalMode): string | undefined;
  entries(): JournalEntry[];
  clear(): void;
  readonly size: number;
}

export function journalKey(mode: JournalMode, key: string): string {
  return `${mode}:${key}`;
}

export function createJournal(initial: JournalEntry[] = []): LlmJournal {
  const map = new Map<string, string>();
  const order: JournalEntry[] = [];

  const put = (entry: JournalEntry) => {
    const k = journalKey(entry.mode, entry.key);
    if (!map.has(k)) order.push(entry);
    map.set(k, entry.response);
  };

  for (const entry of initial) put(entry);

  return {
    record(entry) {
      put(entry);
    },
    get(key, mode) {
      return map.get(journalKey(mode, key));
    },
    entries: () => [...order],
    clear() {
      map.clear();
      order.length = 0;
    },
    get size() {
      return map.size;
    },
  };
}
