// Tiny LRU response cache keyed by `mode:stateHash`. Identical situations cost
// zero calls (specs/npc_ai_plan.md §3 B.4). Bounded so a long match cannot grow
// memory without limit.
export interface LlmCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  readonly size: number;
  clear(): void;
}

export function createCache<V>(cap = 256): LlmCache<V> {
  const map = new Map<string, V>();
  return {
    get(key) {
      const value = map.get(key);
      if (value !== undefined) {
        // Refresh recency.
        map.delete(key);
        map.set(key, value);
      }
      return value;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > cap) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
    },
    get size() {
      return map.size;
    },
    clear() {
      map.clear();
    },
  };
}
