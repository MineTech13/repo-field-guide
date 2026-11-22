import { useEffect, useState } from 'preact/hooks';
import { defaultPrefs, type ShopPrefs } from '../engine/shopAdvisor';

const KEY = 'repo-field-guide:shop-prefs:v1';

function load(): ShopPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const d = defaultPrefs();
    return {
      style: ['balanced', 'carrier', 'scout', 'fighter', 'support'].includes(raw.style) ? raw.style : d.style,
      nudge: raw.nudge && typeof raw.nudge === 'object' ? raw.nudge : d.nudge,
      pinned: Array.isArray(raw.pinned) ? raw.pinned : d.pinned,
      banned: Array.isArray(raw.banned) ? raw.banned : d.banned,
      gearBias: Number.isFinite(raw.gearBias) ? Math.max(-2, Math.min(2, raw.gearBias)) : d.gearBias,
    };
  } catch {
    return defaultPrefs();
  }
}

/** Personal shop preferences, saved in this browser. */
export function usePrefs(): [ShopPrefs, (fn: (p: ShopPrefs) => ShopPrefs) => void] {
  const [prefs, setPrefs] = useState<ShopPrefs>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);
  return [prefs, (fn) => setPrefs((p) => fn(p))];
}

export const togglePin = (p: ShopPrefs, id: string): ShopPrefs => ({
  ...p,
  pinned: p.pinned.includes(id) ? p.pinned.filter((x) => x !== id) : [...p.pinned, id],
  banned: p.banned.filter((x) => x !== id),
});

export const toggleBan = (p: ShopPrefs, id: string): ShopPrefs => ({
  ...p,
  banned: p.banned.includes(id) ? p.banned.filter((x) => x !== id) : [...p.banned, id],
  pinned: p.pinned.filter((x) => x !== id),
});

export const setNudge = (p: ShopPrefs, id: string, n: number): ShopPrefs => {
  const nudge = { ...p.nudge };
  const v = Math.max(-2, Math.min(2, n));
  if (v === 0) delete nudge[id];
  else nudge[id] = v;
  return { ...p, nudge };
};
