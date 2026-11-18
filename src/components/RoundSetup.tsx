import { MAPS } from '../data';
import { phaseFor, phaseLabel } from '../engine/rules/phase';
import type { RoundState } from '../engine/types';
import { nextLevel, setLevel, setMap } from '../state/round';
import { Section } from './ui';

interface Props {
  state: RoundState;
  update: (fn: (s: RoundState) => RoundState) => void;
  onReset: () => void;
}

export function RoundSetup({ state, update, onReset }: Props) {
  const phase = phaseFor(state.level);
  return (
    <Section
      title="This level"
      aside={
        <button class="link-btn" onClick={onReset}>
          Reset
        </button>
      }
    >
      <div class="field">
        <span class="field-label" id="map-label">
          Map
        </span>
        <div class="map-chips" role="radiogroup" aria-labelledby="map-label">
          {MAPS.map((m) => (
            <button
              role="radio"
              aria-checked={state.mapId === m.id}
              class={`map-chip ${state.mapId === m.id ? 'on' : ''}`}
              onClick={() => update((s) => setMap(s, s.mapId === m.id ? null : m.id))}
            >
              <span class="map-emoji" aria-hidden="true">
                {m.emoji}
              </span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div class="level-row">
        <div class="field">
          <label class="field-label" for="level-input">
            Level
          </label>
          <div class="stepper">
            <button aria-label="Previous level" onClick={() => update((s) => setLevel(s, s.level - 1))} disabled={state.level <= 1}>
              −
            </button>
            <input
              id="level-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={state.level}
              onInput={(e) => update((s) => setLevel(s, Number((e.target as HTMLInputElement).value)))}
            />
            <button aria-label="Next level number" onClick={() => update((s) => setLevel(s, s.level + 1))}>
              +
            </button>
          </div>
          <span class={`phase-tag phase-${phase}`}>{phaseLabel(phase)}</span>
        </div>
        <button class="btn primary" onClick={() => update(nextLevel)} title="Level +1, clears map and monsters">
          Next level ▸
        </button>
      </div>
    </Section>
  );
}
