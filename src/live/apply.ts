import { MAPS, MONSTERS } from '../data';
import type { RoundState } from '../engine/types';
import type { GameStateV1, LiveEncounter } from './schema';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Match the game's level name to one of our maps (modded maps → null). */
export function matchMap(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = norm(name);
  for (const m of MAPS) {
    const mn = norm(m.name);
    if (n === mn || n.includes(mn) || mn.includes(n)) return m.id;
    // "McJannek Station" vs asset "Level - Wizard"-style names: match on the distinctive first word.
    const first = norm(m.name.split(' ')[0]);
    if (first.length >= 5 && n.includes(first)) return m.id;
  }
  return null;
}

/** Match an encounter to a monster id by internal key, then by name/alias. */
export function matchMonster(e: LiveEncounter): string | null {
  if (e.key) {
    const byKey = MONSTERS.find((m) => m.gameKey === e.key);
    if (byKey) return byKey.id;
  }
  if (e.name) {
    const n = norm(e.name);
    const byName = MONSTERS.find((m) => [m.name, ...m.aliases].some((a) => norm(a) === n));
    if (byName) return byName.id;
  }
  return null;
}

/** Remembers what was already applied, so manual edits aren't overwritten every poll. */
export interface ApplyMemo {
  /** "<levelsCompleted>|<map>" of the level last applied. */
  levelSig: string | null;
  /** Monster ids already added from the game this level. */
  added: string[];
}

export const emptyMemo = (): ApplyMemo => ({ levelSig: null, added: [] });

export interface ApplyResult {
  state: RoundState;
  memo: ApplyMemo;
  /** Monsters the game reported that this guide doesn't know (modded). */
  unknown: string[];
  /** Respawn countdowns by monster id. */
  respawn: Record<string, number>;
  /** Fields that came from the game this time. */
  fromGame: { map: boolean; level: boolean; monsters: string[]; quota: boolean };
}

/**
 * Merge live game data into the round. Rules (the mod is optional and only fills in):
 * - Map and level are set when the game moves to a new level; manual changes stay until then.
 * - Monsters the game reports are added once per level; you can still remove or change them.
 * - "Killed" follows the game; everything else you set by hand is kept.
 */
export function applyLive(round: RoundState, live: GameStateV1, memo: ApplyMemo): ApplyResult {
  let state = round;
  const nextMemo: ApplyMemo = { levelSig: memo.levelSig, added: [...memo.added] };
  const fromGame: ApplyResult['fromGame'] = { map: false, level: false, monsters: [], quota: false };
  const unknown: string[] = [];
  const respawn: Record<string, number> = {};

  if (live.phase !== 'level' || typeof live.levelsCompleted !== 'number') {
    return { state, memo: nextMemo, unknown, respawn, fromGame };
  }

  const sig = `${live.levelsCompleted}|${live.map ?? ''}`;
  if (sig !== memo.levelSig) {
    // New level in the game: take map + level from the game and start fresh.
    const mapId = matchMap(live.map) ?? matchMap(live.mapAsset);
    state = { ...state, mapId: mapId ?? state.mapId, level: live.levelsCompleted + 1, spotted: [] };
    nextMemo.levelSig = sig;
    nextMemo.added = [];
    fromGame.map = !!mapId;
    fromGame.level = true;
  }

  const spotted = [...state.spotted];
  for (const e of live.seen ?? []) {
    const id = matchMonster(e);
    if (!id) {
      if (e.name && !unknown.includes(e.name)) unknown.push(e.name);
      continue;
    }
    if (typeof e.respawnInSec === 'number') respawn[id] = e.respawnInSec;
    const existing = spotted.findIndex((s) => s.id === id);
    if (existing === -1) {
      if (!nextMemo.added.includes(id)) {
        spotted.push({ id, how: 'seen', killed: !!e.killed });
        nextMemo.added.push(id);
        fromGame.monsters.push(id);
      }
    } else if (!!e.killed !== spotted[existing].killed && nextMemo.added.includes(id)) {
      spotted[existing] = { ...spotted[existing], killed: !!e.killed };
    }
  }
  state = { ...state, spotted };

  if (live.haul?.goal && live.haul.goal > 0 && typeof live.haul.current === 'number') {
    const pct = Math.round((live.haul.current / live.haul.goal) * 100);
    if (pct !== state.memory.quotaPct) {
      state = { ...state, memory: { ...state.memory, quotaPct: Math.max(0, Math.min(200, pct)) } };
      fromGame.quota = true;
    }
  }

  return { state, memo: nextMemo, unknown, respawn, fromGame };
}
