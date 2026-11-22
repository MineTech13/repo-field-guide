import { useEffect, useRef, useState } from 'preact/hooks';
import { useRound } from '../hooks';
import { applyLive, emptyMemo, type ApplyMemo } from './apply';
import { useLive } from './store';

const MEMO_KEY = 'repo-field-guide:live-memo:v1';

function loadMemo(): ApplyMemo {
  try {
    return { ...emptyMemo(), ...JSON.parse(sessionStorage.getItem(MEMO_KEY) ?? '{}') };
  } catch {
    return emptyMemo();
  }
}

export interface LiveInfo {
  unknown: string[];
  respawn: Record<string, number>;
  map: boolean;
  level: boolean;
  monsters: string[];
}

/**
 * The round state, with the optional game companion's data merged in (fills in, never
 * takes over). Shared by the Round page and the Live page.
 */
export function useLiveRound() {
  const [state, update, replace] = useRound();
  const snap = useLive();
  const memo = useRef<ApplyMemo>(loadMemo());
  const [liveInfo, setLiveInfo] = useState<LiveInfo>({ unknown: [], respawn: {}, map: false, level: false, monsters: [] });
  useEffect(() => {
    if (!snap.data) return;
    const r = applyLive(state, snap.data, memo.current);
    memo.current = r.memo;
    try {
      sessionStorage.setItem(MEMO_KEY, JSON.stringify(r.memo));
    } catch {
      /* ignore */
    }
    if (JSON.stringify(r.state) !== JSON.stringify(state)) replace(r.state);
    setLiveInfo((prev) => ({
      unknown: r.unknown,
      respawn: r.respawn,
      map: r.fromGame.map || (prev.map && !r.fromGame.level),
      level: r.fromGame.level || prev.level,
      monsters: [...new Set([...(r.fromGame.level ? [] : prev.monsters), ...r.fromGame.monsters])],
    }));
    // Only react to new game data, not to our own state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.data]);
  return { state, update, replace, snap, liveInfo };
}
