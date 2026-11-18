import { useState } from 'preact/hooks';
import { ITEMS } from '../data';
import type { Health, RoundState } from '../engine/types';
import { emptyMemory, updateMemory } from '../state/round';

interface Props {
  state: RoundState;
  update: (fn: (s: RoundState) => RoundState) => void;
}

const HEALTH: { id: Health; label: string }[] = [
  { id: 'full', label: '💚 Full' },
  { id: 'hurt', label: '💛 Hurt' },
  { id: 'critical', label: '❤️ Critical' },
];

export function RoundMemory({ state, update }: Props) {
  const mem = state.memory;
  const filled = [mem.teamSize, mem.alive, mem.health, mem.quotaPct].filter((v) => v != null).length + (mem.items.length ? 1 : 0);
  const [open, setOpen] = useState(filled > 0);
  const set = (patch: Partial<typeof mem>) => update((s) => updateMemory(s, patch));

  return (
    <section class="panel memory">
      <button class="memory-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <span class="memory-title">Round memory</span> <span class="muted small">optional · {filled ? `${filled} set` : 'refines the advice'}</span>
        </span>
        <span class={`chev ${open ? 'up' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div class="memory-body">
          <div class="mem-row">
            <div class="field">
              <label class="field-label" for="team-size">
                Team size
              </label>
              <select
                id="team-size"
                value={mem.teamSize ?? ''}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  const n = v ? Number(v) : null;
                  set({ teamSize: n, alive: n == null ? null : Math.min(mem.alive ?? n, n) });
                }}
              >
                <option value="">–</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div class="field">
              <span class="field-label">Alive</span>
              <div class="stepper small">
                <button aria-label="One fewer alive" disabled={mem.alive == null || mem.alive <= 0} onClick={() => set({ alive: Math.max(0, (mem.alive ?? 0) - 1) })}>
                  −
                </button>
                <output aria-live="polite">{mem.alive ?? '–'}</output>
                <button
                  aria-label="One more alive"
                  disabled={mem.teamSize == null || (mem.alive ?? 0) >= mem.teamSize}
                  onClick={() => set({ alive: Math.min(mem.teamSize ?? 6, (mem.alive ?? 0) + 1) })}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div class="field">
            <span class="field-label">Your health</span>
            <div class="seg wide" role="radiogroup" aria-label="Health">
              {HEALTH.map((h) => (
                <button role="radio" aria-checked={mem.health === h.id} class={mem.health === h.id ? 'on' : ''} onClick={() => set({ health: mem.health === h.id ? null : h.id })}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="quota">
              Quota progress{' '}
              <span class="muted">{mem.quotaPct == null ? '(not set)' : `${mem.quotaPct}%${mem.quotaPct >= 100 ? ' ✓ met' : ''}`}</span>
            </label>
            <div class="quota-row">
              <input
                id="quota"
                type="range"
                min={0}
                max={150}
                step={5}
                value={mem.quotaPct ?? 0}
                onInput={(e) => set({ quotaPct: Number((e.target as HTMLInputElement).value) })}
              />
              {mem.quotaPct != null && (
                <button class="tiny-btn" onClick={() => set({ quotaPct: null })}>
                  clear
                </button>
              )}
            </div>
          </div>

          <div class="field">
            <span class="field-label">Gear you have</span>
            <div class="item-grid">
              {ITEMS.map((it) => {
                const on = mem.items.includes(it.id);
                return (
                  <button
                    class={`item-btn ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    title={it.description}
                    onClick={() => set({ items: on ? mem.items.filter((i) => i !== it.id) : [...mem.items, it.id] })}
                  >
                    <span aria-hidden="true">{it.emoji}</span> {it.name}
                  </button>
                );
              })}
            </div>
          </div>

          {filled > 0 && (
            <button class="link-btn" onClick={() => set(emptyMemory())}>
              Clear memory
            </button>
          )}
        </div>
      )}
    </section>
  );
}
