import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { SPAWNS } from '../data';
import type { RoundState } from '../engine/types';
import { bandLabel, spawnCheck } from '../engine/spawns';
import { Section } from './ui';

/** "What's still out there?": compares logged monsters against the per-level spawn table. */
export function SpawnCheckPanel({ state, bare }: { state: RoundState; bare?: boolean }) {
  const c = spawnCheck(state.level, state.spotted);
  const [openTier, setOpenTier] = useState<number | null>(null);

  return (
    <Wrap bare={bare}>
      <p class="muted small" style={{ marginTop: 0 }}>
        {bandLabel(c.band)} normally spawns <strong>{c.totalExpected}</strong> monster types. You've logged {c.totalFound}.
      </p>
      <div class="spawn-tiers">
        {c.tiers.map((t) => (
          <button
            class={`spawn-tier ${t.found > t.expected ? 'extra' : t.missing ? 'missing' : t.expected ? 'done' : 'none'}`}
            aria-expanded={openTier === t.tier}
            onClick={() => setOpenTier(openTier === t.tier ? null : t.tier)}
            disabled={!t.missing}
          >
            <span class="spawn-stars">{'★'.repeat(t.tier)}</span>
            <span class="spawn-count">
              {t.found}/{t.expected}
            </span>
            <span class="small">
              {t.found > t.expected ? 'more than expected' : t.expected === 0 ? 'none this level' : t.missing ? `${t.missing} unseen` : 'all found'}
            </span>
          </button>
        ))}
      </div>
      {openTier != null && (
        <p class="small candidates">
          <strong>Could be:</strong>{' '}
          {c.tiers
            .find((t) => t.tier === openTier)!
            .candidates.map((m) => `${m.emoji} ${m.name}`)
            .join(' · ')}
        </p>
      )}
      <ul class="bullets">
        {c.tiers[0].missing > 0 && (
          <li class="bullet bullet-warn">
            <span>
              A <strong>tier-3</strong> monster is unaccounted for. Listen for the big tells: laughing (Clown), a dragging mace (Trudge), clicking teeth
              (Headman), screen-edge hands (Loom).
            </span>
          </li>
        )}
        {c.overflow && (
          <li class="bullet bullet-info">
            <span>
              More than the table allows. Probably a group swap ({SPAWNS.groupSwap.chancePct}% chance a tier-3 slot becomes a pack) or a mislog.
            </span>
          </li>
        )}
        {c.missing === 0 && !c.overflow && c.totalExpected > 0 && (
          <li class="bullet bullet-info">
            <span>Everything on the spawn table is accounted for. Respawns still happen, and they get faster the longer you stay.</span>
          </li>
        )}
        {c.nextJump && (
          <li class="bullet bullet-info">
            <span>
              Heads up: level {c.nextJump.level} goes up to {c.nextJump.band.t1}/{c.nextJump.band.t2}/{c.nextJump.band.t3} (tier 1/2/3).{' '}
              <a href="#/shop/advisor">Plan your shopping →</a>
            </span>
          </li>
        )}
      </ul>
    </Wrap>
  );
}

function Wrap({ bare, children }: { bare?: boolean; children: ComponentChildren }) {
  if (bare) return <div>{children}</div>;
  return (
    <Section title={"What's still out there?"} aside={<a class="small" href="#/spawns">spawn rules</a>}>
      {children}
    </Section>
  );
}
