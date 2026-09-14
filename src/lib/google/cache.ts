import "server-only";

/*
   A small in-process memo for model output.

   The Gemini free tier allows a modest number of requests per minute, and a
   visitor clicking through twelve languages on the advisory page exhausts it
   in seconds — which is exactly what happened the first time this was tested
   end to end: six language switches, then HTTP 429 and English for the rest.

   Every one of those calls was redundant. The advisory for a given episode is
   the same advisory, and the translation of a fixed string into a fixed
   language is the same translation. The answer is not a bigger quota; it is
   not making the call twice. This holds results by content key, which turns a
   language switch into one call the first time and none afterwards.

   In-process and bounded, which is the honest scope for a prototype: it
   empties on restart. Because the key is derived from content rather than
   from a request, moving to a shared cache is a driver change, not a
   redesign.
*/

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 300;

/** Ten minutes: long enough for a demo, short enough to pick up a model change. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** FNV-1a over the inputs, so a key is content-addressed and stable. */
export function contentKey(...parts: unknown[]): string {
  const s = parts
    .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
    .join(" ");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36) + ":" + s.length.toString(36);
}

/**
 * Run `produce` unless an unexpired result is already held.
 *
 * `shouldCache` decides whether a result is worth keeping. A fallback served
 * because the model was rate-limited must never be cached — otherwise one bad
 * minute freezes English into the page for the next ten.
 */
export async function memo<T>(
  key: string,
  produce: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  const held = store.get(key);
  if (held && held.expiresAt > now) {
    return { value: held.value as T, hit: true };
  }

  const value = await produce();
  if (shouldCache(value)) {
    /* Bounded by evicting the oldest insertion; Map preserves insertion order. */
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: now + ttlMs });
  }
  return { value, hit: false };
}

export function _clearCacheForTests(): void {
  store.clear();
}
