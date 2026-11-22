import { useEffect, useState } from 'preact/hooks';
import { decodeShareCode } from './decode';
import { DEMO_LOOP, demoState } from './demo';
import { isGameState, type GameStateV1 } from './schema';

/**
 * Optional game companion connection. Nothing here runs unless the user turns it
 * on: no requests to localhost, no browser prompts, no effect on the rest of the site.
 */
export type LiveStatus = 'off' | 'connecting' | 'live' | 'not-found';

export interface LiveSnapshot {
  enabled: boolean;
  /** Switch to the Round page in a level and the Shop advisor in the shop. */
  followGame: boolean;
  port: number;
  status: LiveStatus;
  data: GameStateV1 | null;
  /** Where the current data came from. */
  source: 'live' | 'code' | 'demo' | null;
  /** "Try the demo": made-up data, no game needed. Never saved, never touches your round. */
  demo: boolean;
  receivedAt: number | null;
}

const KEY = 'repo-field-guide:live:v1';
export const DEFAULT_PORT = 47380;
const POLL_MS = 1500;

function loadPrefs(): { enabled: boolean; port: number; followGame: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const port = Number(raw.port);
    return { enabled: raw.enabled === true, port: port >= 1024 && port <= 65535 ? port : DEFAULT_PORT, followGame: raw.followGame !== false };
  } catch {
    return { enabled: false, port: DEFAULT_PORT, followGame: true };
  }
}

let snap: LiveSnapshot = { ...loadPrefs(), status: 'off', data: null, source: null, receivedAt: null, demo: false };
let demoTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(s: LiveSnapshot) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let lastPhase: GameStateV1['phase'] | null = null;

/** Where to go when the game changes phase (only on a change, never on every update). */
export function routeForPhaseChange(prev: GameStateV1['phase'] | null, next: GameStateV1['phase'] | undefined): string | null {
  if (!prev || !next || prev === next) return null;
  if (next === 'shop') return '#/shop/advisor';
  if (next === 'level') return '#/';
  return null;
}

function set(patch: Partial<LiveSnapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l(snap));
}

function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: snap.enabled, port: snap.port, followGame: snap.followGame }));
  } catch {
    /* ignore */
  }
}

function receive(json: unknown) {
  if (!isGameState(json)) return;
  failures = 0;
  set({ status: 'live', data: json, source: 'live', receivedAt: Date.now() });
  const route = routeForPhaseChange(lastPhase, json.phase);
  lastPhase = json.phase ?? lastPhase;
  // The Live page follows the game by itself, so stay there.
  const onLivePage = typeof location !== 'undefined' && location.hash.startsWith('#/live');
  if (route && snap.followGame && !onLivePage && location.hash.split('?')[0] !== route) location.hash = route;
}

let stream: EventSource | null = null;

/**
 * Preferred: one Server-Sent Events stream (mod 0.2+). The mod only sends when
 * something changes, so it's far lighter than polling. Older mods without /events
 * fail before the stream opens, and we fall back to polling.
 */
function connect() {
  disconnect();
  if (!snap.enabled) return;
  if (typeof EventSource === 'undefined') return void poll();
  let opened = false;
  const es = new EventSource(`http://127.0.0.1:${snap.port}/events`);
  stream = es;
  es.onopen = () => {
    opened = true;
    if (snap.status !== 'live') set({ status: 'live' });
  };
  es.onmessage = (e) => {
    try {
      receive(JSON.parse(e.data));
    } catch {
      /* ignore a bad message */
    }
  };
  es.onerror = () => {
    if (!opened) {
      // No stream support (older mod) or the game isn't running: poll instead.
      es.close();
      if (stream === es) stream = null;
      void poll();
      return;
    }
    // The browser reconnects by itself (the mod asks for 3 s).
    set({ status: 'not-found' });
  };
}

function disconnect() {
  stream?.close();
  stream = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

async function poll() {
  timer = null;
  if (!snap.enabled || stream) return;
  try {
    const res = await fetch(`http://127.0.0.1:${snap.port}/state`, { cache: 'no-store' });
    receive(await res.json());
    if (snap.status !== 'live') set({ status: 'live' });
  } catch {
    failures++;
    // Keep the last data; just report that the game isn't answering right now.
    set({ status: snap.status === 'live' && failures < 3 ? 'live' : 'not-found' });
  }
  if (!snap.enabled || stream) return;
  // Game not found for a while: retry the stream now and then (the mod may have been updated/started).
  if (failures > 0 && failures % 10 === 0) return connect();
  timer = setTimeout(poll, failures > 3 ? POLL_MS * 4 : POLL_MS);
}

export const live = {
  get: () => snap,
  subscribe(fn: (s: LiveSnapshot) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setEnabled(enabled: boolean) {
    set({ enabled, status: enabled ? 'connecting' : 'off' });
    lastPhase = null;
    savePrefs();
    failures = 0;
    if (enabled) connect();
    else disconnect();
  },
  setPort(port: number) {
    if (!(port >= 1024 && port <= 65535)) return;
    set({ port });
    savePrefs();
    if (snap.enabled) live.setEnabled(true);
  },
  setFollowGame(followGame: boolean) {
    set({ followGame });
    savePrefs();
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
  /** Play a made-up level (src/live/demo.ts) so you can see the Live page without the game. */
  startDemo() {
    disconnect();
    if (demoTimer) clearInterval(demoTimer);
    const start = Date.now();
    const tick = () => set({ demo: true, status: 'live', data: demoState((Date.now() - start) / 1000), source: 'demo', receivedAt: Date.now() });
    tick();
    demoTimer = setInterval(tick, 1000);
  },
  stopDemo() {
    if (demoTimer) clearInterval(demoTimer);
    demoTimer = null;
    set({ demo: false, data: null, source: null, receivedAt: null, status: snap.enabled ? 'connecting' : 'off' });
    if (snap.enabled) live.setEnabled(true);
  },
};
export { DEMO_LOOP };

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
