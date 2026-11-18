import { mapById, monsterById } from '../data';
import type { Memory, RoundState, Spotted } from '../engine/types';

const KEY = 'repo-field-guide:round:v1';

export const emptyMemory = (): Memory => ({ teamSize: null, alive: null, health: null, quotaPct: null, items: [] });

export const defaultRound = (): RoundState => ({ mapId: null, level: 1, spotted: [], memory: emptyMemory() });

/** Load the saved round. Any storage problem or bad data falls back to a fresh round. */
export function loadRound(): RoundState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultRound();
    return sanitize(JSON.parse(raw));
  } catch {
    return defaultRound();
  }
}

export function saveRound(state: RoundState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / blocked storage: the app still works, it just won't remember */
  }
}

export function sanitize(input: unknown): RoundState {
  const base = defaultRound();
  if (!input || typeof input !== 'object') return base;
  const s = input as Partial<RoundState>;
  const mapId = typeof s.mapId === 'string' && mapById.has(s.mapId) ? s.mapId : null;
  const level = clampLevel(Number(s.level));
  const spotted: Spotted[] = Array.isArray(s.spotted)
    ? s.spotted
        .filter((x): x is Spotted => !!x && typeof x.id === 'string' && monsterById.has(x.id))
        .map((x) => ({ id: x.id, how: x.how === 'heard' ? 'heard' : 'seen', killed: !!x.killed }))
    : [];
  const m = (s.memory ?? {}) as Partial<Memory>;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null;
  const memory: Memory = {
    teamSize: num(m.teamSize, 1, 6),
    alive: num(m.alive, 0, 6),
    health: m.health === 'full' || m.health === 'hurt' || m.health === 'critical' ? m.health : null,
    quotaPct: num(m.quotaPct, 0, 200),
    items: Array.isArray(m.items) ? m.items.filter((i): i is string => typeof i === 'string') : [],
  };
  return { mapId, level, spotted: dedupe(spotted), memory };
}

export const clampLevel = (n: number) => (Number.isFinite(n) ? Math.max(1, Math.min(99, Math.round(n))) : 1);

function dedupe(list: Spotted[]): Spotted[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

// ---- pure updaters (used by the UI, easy to test)

export const setMap = (s: RoundState, mapId: string | null): RoundState => ({ ...s, mapId });
export const setLevel = (s: RoundState, level: number): RoundState => ({ ...s, level: clampLevel(level) });

export function toggleSpotted(s: RoundState, id: string): RoundState {
  const exists = s.spotted.some((x) => x.id === id);
  return {
    ...s,
    spotted: exists ? s.spotted.filter((x) => x.id !== id) : [...s.spotted, { id, how: 'seen', killed: false }],
  };
}

export const updateSpotted = (s: RoundState, id: string, patch: Partial<Spotted>): RoundState => ({
  ...s,
  spotted: s.spotted.map((x) => (x.id === id ? { ...x, ...patch } : x)),
});

/** Next level: level +1, spotted monsters cleared. Map is cleared too, since it's random each level. */
export const nextLevel = (s: RoundState): RoundState => ({
  ...s,
  mapId: null,
  level: clampLevel(s.level + 1),
  spotted: [],
  memory: { ...s.memory, alive: s.memory.teamSize, health: s.memory.health ? 'full' : null },
});

export const updateMemory = (s: RoundState, patch: Partial<Memory>): RoundState => ({
  ...s,
  memory: { ...s.memory, ...patch },
});
