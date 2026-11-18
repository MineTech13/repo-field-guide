import { useState } from 'preact/hooks';
import { MONSTERS, monsterById } from '../data';
import type { RoundState } from '../engine/types';
import { toggleSpotted, updateSpotted } from '../state/round';
import { Section } from './ui';

interface Props {
  state: RoundState;
  update: (fn: (s: RoundState) => RoundState) => void;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function MonsterPicker({ state, update }: Props) {
  const [query, setQuery] = useState('');
  const spottedIds = new Set(state.spotted.map((s) => s.id));
  const q = norm(query);
  const matches = MONSTERS.filter((m) => !q || [m.name, ...m.aliases].some((n) => norm(n).includes(q)));

  return (
    <Section title="Monsters this level" aside={<span class="muted small">{state.spotted.length} logged</span>}>
      {state.spotted.length > 0 && (
        <ul class="spotted-list" aria-label="Logged monsters">
          {state.spotted.map((s) => {
            const m = monsterById.get(s.id)!;
            return (
              <li class={`spotted ${s.killed ? 'killed' : ''} threat-edge-${m.threat}`}>
                <span class="spotted-name">
                  <span aria-hidden="true">{m.emoji}</span> {m.name}
                </span>
                <span class="seg" role="group" aria-label={`${m.name}: seen or heard`}>
                  <button class={s.how === 'seen' ? 'on' : ''} aria-pressed={s.how === 'seen'} onClick={() => update((st) => updateSpotted(st, s.id, { how: 'seen' }))}>
                    Seen
                  </button>
                  <button class={s.how === 'heard' ? 'on' : ''} aria-pressed={s.how === 'heard'} onClick={() => update((st) => updateSpotted(st, s.id, { how: 'heard' }))}>
                    Heard
                  </button>
                </span>
                <button
                  class={`tiny-btn ${s.killed ? 'on' : ''}`}
                  aria-pressed={s.killed}
                  onClick={() => update((st) => updateSpotted(st, s.id, { killed: !s.killed }))}
                  title="Mark as killed"
                >
                  {s.killed ? '☠ Killed' : 'Killed?'}
                </button>
                <button class="tiny-btn remove" aria-label={`Remove ${m.name}`} onClick={() => update((st) => toggleSpotted(st, s.id))}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input
        class="search"
        type="search"
        placeholder="Search monsters… (e.g. clown, duck)"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        aria-label="Search monsters"
      />

      {[3, 2, 1].map((tier) => {
        const group = matches.filter((m) => m.tier === tier);
        if (!group.length) return null;
        return (
          <div class="tier-group">
            <h3 class="tier-head">
              {'★'.repeat(tier)} Tier {tier}
              <span class="muted small">{tier === 3 ? 'big threats' : tier === 2 ? 'mid' : 'small or passive'}</span>
            </h3>
            <div class="monster-grid">
              {group.map((m) => {
                const on = spottedIds.has(m.id);
                return (
                  <button
                    class={`monster-btn ${on ? 'on' : ''} threat-edge-${m.threat}`}
                    aria-pressed={on}
                    onClick={() => update((s) => toggleSpotted(s, m.id))}
                    title={m.golden}
                  >
                    <span class="monster-emoji" aria-hidden="true">
                      {m.emoji}
                    </span>
                    <span class="monster-btn-name">{m.name}</span>
                    {m.addedIn === '0.5.0' && <span class="new-dot">NEW</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {!matches.length && <p class="muted">No monster matches “{query}”.</p>}
    </Section>
  );
}
