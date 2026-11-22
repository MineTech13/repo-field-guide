import { useState } from 'preact/hooks';
import { DEFAULT_PORT, live, type LiveSnapshot } from '../../live/store';

/**
 * Optional game companion. Collapsed by default. Turning it on is the only thing
 * that makes the site talk to localhost; everything else works without the mod.
 */
export function CompanionPanel({ snap }: { snap: LiveSnapshot }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const age = snap.receivedAt ? Math.round((Date.now() - snap.receivedAt) / 1000) : null;

  const importCode = async () => {
    try {
      const data = await live.importCode(code);
      setMsg({ ok: true, text: `Imported (${data.phase ?? 'unknown'} phase).` });
      setCode('');
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div class="companion" id="companion">
      <p class="muted small" style={{ marginTop: 0 }}>
        The <strong>R.E.P.O. Field Guide Companion</strong> mod can fill in this page for you: map, level, quota, and the monsters you've
        actually met. It's completely optional: everything here works by hand too.
      </p>

      <div class="companion-row">
        <label class="switch">
          <input type="checkbox" checked={snap.enabled} onChange={(e) => live.setEnabled((e.target as HTMLInputElement).checked)} />
          <span>Connect to game on this PC</span>
        </label>
        {snap.enabled && (
          <span class={`live-badge live-${snap.status}`}>
            <span class="live-dot" aria-hidden="true" />
            {snap.status === 'live' ? `Live${age != null && age > 5 ? ` · ${age}s ago` : ''}` : snap.status === 'connecting' ? 'Connecting…' : 'Game not found'}
          </span>
        )}
      </div>
      {snap.enabled && snap.status === 'not-found' && (
        <p class="small muted">
          Is the game running with the companion installed? Your browser may also ask once to allow access to local network devices, so
          allow it.
        </p>
      )}
      {snap.enabled && (
        <label class="small muted port">
          Port{' '}
          <input
            type="number"
            min={1024}
            max={65535}
            value={snap.port}
            onChange={(e) => live.setPort(Number((e.target as HTMLInputElement).value) || DEFAULT_PORT)}
          />
        </label>
      )}

      <div class="companion-code">
        <label class="field-label" for="game-code">
          Or paste a game code (Ctrl+F10 in game)
        </label>
        <div class="code-row">
          <input
            id="game-code"
            class="search"
            placeholder="RFG1:…"
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && code && importCode()}
          />
          <button class="btn" disabled={!code.trim()} onClick={importCode}>
            Import
          </button>
        </div>
        {msg && <p class={`small ${msg.ok ? 'ok-text' : 'err-text'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
