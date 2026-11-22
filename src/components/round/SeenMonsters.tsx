import { useRef, useState } from 'preact/hooks';
import { MONSTERS, THREAT_ORDER, monsterById } from '../../data';
import type { Monster } from '../../data/types';
import type { RoundState } from '../../engine/types';
import { toggleSpotted, updateSpotted } from '../../state/round';
import { GameTag } from './RoundBar';

interface Props {
  state: RoundState;
  update: (fn: (s: RoundState) => RoundState) => void;
  /** Monster ids filled in by the game companion this level. */
  fromGame: string[];
  /** Respawn countdowns from the companion, in seconds, by monster id. */
  respawn: Record<string, number>;
  /** Modded monsters the companion reported that the guide doesn't know. */
  unknown: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function search(q: string, exclude: Set<string>): Monster[] {
  const n = norm(q);
  if (!n) return [];
  const scored = MONSTERS.filter((m) => !exclude.has(m.id)).map((m) => {
    const names = [m.name, ...m.aliases, ...m.nicknames].map(norm);
    const score = names.some((x) => x.startsWith(n)) ? 2 : names.some((x) => x.includes(n)) ? 1 : 0;
    return { m, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || THREAT_ORDER[b.m.threat] - THREAT_ORDER[a.m.threat])
    .slice(0, 6)
    .map((x) => x.m);
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Seen monsters as chips, with type-ahead add. The full grid lives in a drawer. */
export function SeenMonsters({ state, update, fromGame, respawn, unknown }: Props) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const spottedIds = new Set(state.spotted.map((s) => s.id));
  const results = search(query, spottedIds);

  const add = (id: string) => {
    update((s) => toggleSpotted(s, id));
    setQuery('');
    input.current?.focus();
  };

  return (
    <section class="panel seen">
      <div class="seen-row">
        <span class="seen-label">Seen</span>
        {state.spotted.length === 0 && !adding && <span class="muted small">no monsters yet</span>}
        {state.spotted.map((s) => {
          const m = monsterById.get(s.id)!;
          const open = menu === s.id;
          return (
            <span class={`chip-wrap ${open ? 'open' : ''}`}>
              <button
                class={`mchip threat-edge-${m.threat} ${s.killed ? 'killed' : ''} ${s.how === 'heard' ? 'heard' : ''}`}
                aria-expanded={open}
                onClick={() => setMenu(open ? null : s.id)}
                title={m.golden}
              >
                <span aria-hidden="true">{m.emoji}</span> <span class="mname">{m.name}</span>
                {s.how === 'heard' && <small> (heard)</small>}
                {s.killed && <small> ☠</small>}
                {respawn[s.id] != null && <small class="respawn"> back {fmt(respawn[s.id])}</small>}
                {fromGame.includes(s.id) && <GameTag />}
              </button>
              {open && (
                <span class="chip-menu" role="menu">
                  <button role="menuitem" onClick={() => update((st) => updateSpotted(st, s.id, { how: s.how === 'seen' ? 'heard' : 'seen' }))}>
                    {s.how === 'seen' ? 'Only heard' : 'Seen'}
                  </button>
                  <button role="menuitem" onClick={() => update((st) => updateSpotted(st, s.id, { killed: !s.killed }))}>
                    {s.killed ? 'Alive again' : 'Killed'}
                  </button>
                  <a role="menuitem" href={`#/monsters/${s.id}`}>
                    Info
                  </a>
                  <button
                    role="menuitem"
                    class="danger"
                    onClick={() => {
                      update((st) => toggleSpotted(st, s.id));
                      setMenu(null);
                    }}
                  >
                    Remove
                  </button>
                </span>
              )}
            </span>
          );
        })}
        {unknown.map((name) => (
          <span class="mchip unknown" title="Reported by the game, but not in this guide (probably a modded monster)">
            ❔ {name}
          </span>
        ))}
        {!adding && (
          <button
            class="mchip add"
            onClick={() => {
              setAdding(true);
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            + add
          </button>
        )}
      </div>

      {adding && (
        <div class="seen-add">
          <input
            ref={input}
            class="search"
            type="search"
            placeholder="Name or callout… (duck, shotgun guy) · Enter to add"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) add(results[0].id);
              if (e.key === 'Escape') {
                setAdding(false);
                setQuery('');
              }
            }}
            aria-label="Add a monster"
          />
          {results.length > 0 && (
            <div class="suggestions" role="listbox">
              {results.map((m, i) => (
                <button role="option" aria-selected={i === 0} class={`suggestion threat-edge-${m.threat}`} onClick={() => add(m.id)}>
                  <span aria-hidden="true">{m.emoji}</span> <strong>{m.name}</strong>
                  <span class="muted small"> {'★'.repeat(m.tier)} · “{m.nicknames[0]}”</span>
                </button>
              ))}
            </div>
          )}
          <div class="seen-add-actions">
            <button class="link-btn" onClick={() => setBrowse(!browse)}>
              {browse ? 'Hide list' : 'Browse all monsters'}
            </button>
            <button
              class="link-btn"
              onClick={() => {
                setAdding(false);
                setBrowse(false);
                setQuery('');
              }}
            >
              Done
            </button>
          </div>
          {browse && (
            <div class="browse">
              {[3, 2, 1].map((tier) => (
                <div class="tier-group">
                  <h3 class="tier-head">{'★'.repeat(tier)} Tier {tier}</h3>
                  <div class="monster-grid">
                    {MONSTERS.filter((m) => m.tier === tier).map((m) => {
                      const on = spottedIds.has(m.id);
                      return (
                        <button class={`monster-btn ${on ? 'on' : ''} threat-edge-${m.threat}`} aria-pressed={on} onClick={() => update((s) => toggleSpotted(s, m.id))}>
                          <span class="monster-emoji" aria-hidden="true">
                            {m.emoji}
                          </span>
                          <span class="monster-btn-name">{m.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
