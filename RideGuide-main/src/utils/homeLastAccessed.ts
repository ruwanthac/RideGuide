import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeFunctionId = 'diagnose' | 'chat' | 'tow';

const STORAGE_PREFIX = 'rideguide.homeLastAccessed.v1:';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/** Persists most-recent-first list for this logged-in user (each account = separate storage). */
export async function recordHomeFunctionAccess(userId: string, id: HomeFunctionId): Promise<void> {
  const key = storageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    let list: HomeFunctionId[] = [];
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed.filter((x): x is HomeFunctionId => x === 'diagnose' || x === 'chat' || x === 'tow');
      }
    }
    list = list.filter((x) => x !== id);
    list.unshift(id);
    if (list.length > 10) list = list.slice(0, 10);
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
}

/** Up to three distinct functions, most recently used first. */
export async function getLastAccessedFunctions(userId: string): Promise<HomeFunctionId[]> {
  const key = storageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: HomeFunctionId[] = [];
    const seen = new Set<HomeFunctionId>();
    for (const x of parsed) {
      if (x !== 'diagnose' && x !== 'chat' && x !== 'tow') continue;
      if (seen.has(x)) continue;
      seen.add(x);
      out.push(x);
      if (out.length >= 3) break;
    }
    return out;
  } catch {
    return [];
  }
}
