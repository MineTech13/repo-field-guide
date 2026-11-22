import { useEffect, useRef, useState } from 'preact/hooks';
import { useRound } from '../hooks';
import { defaultRound } from '../state/round';
import type { RoundState } from '../engine/types';
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
  const [saved, updateSaved, replaceSaved] = useRound();
  const snap = useLive();
  // The demo plays on its own throw-away round, so your saved round is never touched.
  const [demoRound, setDemoRound] = useState<RoundState>(defaultRound);
  const demo = snap.demo;
  const state = demo ? demoRound : saved;
  const replace = demo ? setDemoRound : replaceSaved;
  const update = demo ? (fn: (s: RoundState) => RoundState) => setDemoRound((s) => fn(s)) : updateSaved;
  const memo = useRef<ApplyMemo>(demo ? emptyMemo() : loadMemo());
  const wasDemo = useRef(demo);
  if (wasDemo.current !== demo) {
    wasDemo.current = demo;
    memo.current = demo ? emptyMemo() : loadMemo();
  }
  const [liveInfo, setLiveInfo] = useState<LiveInfo>({ unknown: [], respawn: {}, map: false, level: false, monsters: [] });
  useEffect(() => {
    if (!snap.data) return;
    const r = applyLive(state, snap.data, memo.current);
    memo.current = r.memo;
    if (!demo) {
      try {
        sessionStorage.setItem(MEMO_KEY, JSON.stringify(r.memo));
      } catch {
        /* ignore */
      }
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
