import { useCallback, useEffect, useState } from 'preact/hooks';
import type { RoundState } from './engine/types';
import { loadRound, saveRound } from './state/round';

/** Hash router: '#/monsters/robe' → ['monsters', 'robe']. */
export function useRoute(): string[] {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    let last = parse().join('/');
    const on = () => {
      const next = parse();
      setRoute(next);
      if (next.join('/') !== last) window.scrollTo(0, 0);
      last = next.join('/');
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function useRound(): [RoundState, (fn: (s: RoundState) => RoundState) => void, (s: RoundState) => void] {
  const [state, setState] = useState<RoundState>(loadRound);
  useEffect(() => saveRound(state), [state]);
  const update = useCallback((fn: (s: RoundState) => RoundState) => setState((s) => fn(s)), []);
  return [state, update, setState];
}

type Theme = 'dark' | 'light';
const THEME_KEY = 'repo-field-guide:theme';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      /* ignore */
    }
    return 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/** Query params inside the hash: '#/shop/builder?b=...' */
export function getHashQuery(): URLSearchParams {
  const q = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q);
}

/** localStorage-backed state for small UI preferences. Falls back to memory if storage is blocked. */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }, [key, val]);
  return [val, setVal];
}

/** Big screens (e.g. a second monitor) show everything at once instead of folding it away. */
export const WIDE_QUERY = '(min-width: 1280px)';

export function useWide(): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_QUERY).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_QUERY);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}
