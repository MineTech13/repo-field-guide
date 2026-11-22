import { MAPS } from '../../data';
import { phaseFor, phaseLabel } from '../../engine/rules/phase';
import type { RoundState } from '../../engine/types';
import type { LiveSnapshot } from '../../live/store';
import { nextLevel, setLevel, setMap } from '../../state/round';

interface Props {
  state: RoundState;
  update: (fn: (s: RoundState) => RoundState) => void;
  onReset: () => void;
  live: LiveSnapshot;
  fromGame: { map: boolean; level: boolean };
}

/** Compact sticky bar: map · level · next. Everything a round needs, in one row. */
export function RoundBar({ state, update, onReset, live, fromGame }: Props) {
  const phase = phaseFor(state.level);
  return (
    <div class="round-bar" role="group" aria-label="Current level">
      <label class="rb-map">
        <span class="sr-only">Map</span>
        <select
          value={state.mapId ?? ''}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            update((s) => setMap(s, v || null));
          }}
        >
          <option value="">Pick map…</option>
          {MAPS.map((m) => (
            <option value={m.id}>
              {m.emoji} {m.name}
            </option>
          ))}
        </select>
        {fromGame.map && <GameTag />}
      </label>

      <div class="rb-level">
        <button aria-label="Previous level" disabled={state.level <= 1} onClick={() => update((s) => setLevel(s, s.level - 1))}>
          ‹
        </button>
        <span class="rb-level-num" title={phaseLabel(phase)}>
          <small>Lvl</small> {state.level}
          {fromGame.level && <GameTag />}
        </span>
        <button aria-label="Next level number" onClick={() => update((s) => setLevel(s, s.level + 1))}>
          ›
        </button>
      </div>

      <span class={`phase-tag phase-${phase} rb-phase`}>{phase}</span>

      <span class="rb-spacer" />
      <button class="btn primary rb-next" onClick={() => update(nextLevel)} title="Level +1, clears map and monsters">
        Next ▸
      </button>
      <button class="icon-btn rb-reset" onClick={onReset} title="Reset the whole round" aria-label="Reset the whole round">
        ↺
      </button>
    </div>
  );
}

export function GameTag() {
  return (
    <span class="game-tag" title="Filled in by the game companion">
      🎮
    </span>
  );
}

export function LiveBadge({ live }: { live: LiveSnapshot }) {
  const text = live.status === 'live' ? 'Live' : live.status === 'connecting' ? 'Connecting…' : 'Game not found';
  return (
    <a class={`live-badge live-${live.status}`} href="#companion" title="Optional game companion">
      <span class="live-dot" aria-hidden="true" />
      {text}
    </a>
  );
}
