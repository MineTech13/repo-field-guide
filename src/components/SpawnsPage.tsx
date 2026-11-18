import { useState } from 'preact/hooks';
import { MONSTERS, SOURCES, SPAWNS, monsterById } from '../data';
import { bandLabel, bandTotal, respawnTimeAt } from '../engine/spawns';
import { Section } from './ui';

export function SpawnsPage() {
  const [minutes, setMinutes] = useState(12);
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Spawns & respawns</h1>
        <p class="muted">How many monsters each level rolls, which ones can show up, and how fast they come back.</p>
      </div>

      <Section title="Monsters per level">
        <div class="table-wrap">
          <table class="price-table">
            <thead>
              <tr>
                <th>Levels</th>
                <th>★ Tier 1</th>
                <th>★★ Tier 2</th>
                <th>★★★ Tier 3</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {SPAWNS.bands.map((b) => (
                <tr>
                  <td class="nowrap">
                    <strong>{bandLabel(b)}</strong>
                  </td>
                  <td class="mono">{b.t1}</td>
                  <td class="mono">{b.t2}</td>
                  <td class="mono">{b.t3}</td>
                  <td class="mono">{bandTotal(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="muted small">{SPAWNS.groupSwap.text}</p>
        <div class="chips">
          {SPAWNS.groupSwap.groups.map((g) => (
            <a class="chip" href={`#/monsters/${g.id}`}>
              {g.count}× {monsterById.get(g.id)?.emoji} {monsterById.get(g.id)?.name}
            </a>
          ))}
        </div>
      </Section>

      <div class="maps-grid">
        {([3, 2, 1] as const).map((tier) => (
          <Section title={`${'★'.repeat(tier)} Tier ${tier} pool`}>
            <div class="chips">
              {MONSTERS.filter((m) => m.tier === tier).map((m) => (
                <a class={`chip threat-edge-${m.threat}`} href={`#/monsters/${m.id}`}>
                  {m.emoji} {m.name}
                </a>
              ))}
            </div>
            <p class="muted small">Each one in the pool is equally likely to be picked.</p>
          </Section>
        ))}
      </div>

      <Section title="Respawn timer">
        <div class="field">
          <label class="field-label" for="mins">
            Time spent in the level: {minutes} min
          </label>
          <input id="mins" type="range" min={0} max={60} value={minutes} onInput={(e) => setMinutes(Number((e.target as HTMLInputElement).value))} />
        </div>
        <p class="call">
          A despawned monster comes back in about <strong>{respawnTimeAt(minutes)}</strong>. If you killed it, roughly triple that.
        </p>
        <div class="table-wrap">
          <table class="price-table">
            <thead>
              <tr>
                <th>Time in level</th>
                <th>Respawn delay</th>
              </tr>
            </thead>
            <tbody>
              {SPAWNS.respawn.map((r) => (
                <tr class={minutes >= r.fromMin && (r.toMin == null || minutes < r.toMin) ? 'row-on' : ''}>
                  <td class="mono">{r.toMin == null ? `${r.fromMin}+ min` : `${r.fromMin}–${r.toMin} min`}</td>
                  <td>{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Rules worth knowing">
        <ul class="tips">
          {SPAWNS.rules.map((r) => (
            <li>• {r}</li>
          ))}
        </ul>
        <p class="muted small">
          {SPAWNS.notes}{' '}
          {SPAWNS.sources.map((s, i) => (
            <>
              {i > 0 && ' · '}
              <a href={SOURCES[s].url} target="_blank" rel="noopener noreferrer">
                {SOURCES[s].name}
              </a>
            </>
          ))}
        </p>
      </Section>
    </div>
  );
}
