import { useEffect, useState } from 'preact/hooks';
import { decodeShareCode } from './decode';
import { isGameState, type GameStateV1 } from './schema';

/**
 * Optional game companion connection. Nothing here runs unless the user turns it
 * on: no requests to localhost, no browser prompts, no effect on the rest of the site.
 */
export type LiveStatus = 'off' | 'connecting' | 'live' | 'not-found';

export interface LiveSnapshot {
  enabled: boolean;
  port: number;
  status: LiveStatus;
  data: GameStateV1 | null;
  /** Where the current data came from. */
  source: 'live' | 'code' | null;
  receivedAt: number | null;
}

const KEY = 'repo-field-guide:live:v1';
export const DEFAULT_PORT = 47380;
const POLL_MS = 1500;

function loadPrefs(): { enabled: boolean; port: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const port = Number(raw.port);
    return { enabled: raw.enabled === true, port: port >= 1024 && port <= 65535 ? port : DEFAULT_PORT };
  } catch {
    return { enabled: false, port: DEFAULT_PORT };
  }
}

let snap: LiveSnapshot = { ...loadPrefs(), status: 'off', data: null, source: null, receivedAt: null };
const listeners = new Set<(s: LiveSnapshot) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

function set(patch: Partial<LiveSnapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l(snap));
}

function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: snap.enabled, port: snap.port }));
  } catch {
    /* ignore */
  }
}

async function poll() {
  timer = null;
  if (!snap.enabled) return;
  try {
    const res = await fetch(`http://127.0.0.1:${snap.port}/state`, { cache: 'no-store' });
    const json: unknown = await res.json();
    if (!isGameState(json)) throw new Error('bad payload');
    failures = 0;
    set({ status: 'live', data: json, source: 'live', receivedAt: Date.now() });
  } catch {
    failures++;
    // Keep the last data; just report that the game isn't answering right now.
    set({ status: snap.status === 'live' && failures < 3 ? 'live' : 'not-found' });
  }
  if (snap.enabled) timer = setTimeout(poll, failures > 3 ? POLL_MS * 4 : POLL_MS);
}

export const live = {
  get: () => snap,
  subscribe(fn: (s: LiveSnapshot) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setEnabled(enabled: boolean) {
    set({ enabled, status: enabled ? 'connecting' : 'off' });
    savePrefs();
    if (timer) clearTimeout(timer);
    timer = null;
    failures = 0;
    if (enabled) void poll();
  },
  setPort(port: number) {
    if (!(port >= 1024 && port <= 65535)) return;
    set({ port });
    savePrefs();
    if (snap.enabled) live.setEnabled(true);
  },
  /** Paste-in fallback: works without any connection. */
  async importCode(code: string) {
    const data = await decodeShareCode(code);
    set({ data, source: 'code', receivedAt: Date.now() });
    return data;
  },
  clear() {
    set({ data: null, source: null, receivedAt: null });
  },
};

// Resume polling on load only if the user turned it on earlier.
if (typeof window !== 'undefined' && snap.enabled) live.setEnabled(true);

export function useLive(): LiveSnapshot {
  const [s, setS] = useState(snap);
  useEffect(() => {
    const unsub = live.subscribe(setS);
    return () => {
      unsub();
    };
  }, []);
  return s;
}
