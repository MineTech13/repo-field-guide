import { useState } from 'preact/hooks';
import { SOURCES, itemById } from '../data';
import type { Item, Monster, MonsterTag } from '../data/types';
import type { Spotted } from '../engine/types';
import { DETECTION_TEXT, DetectionChips, Stars, ThreatBadge } from './ui';

interface Props {
  monster: Monster;
  spotted?: Spotted;
  usableItems?: Item[];
  noAnswer?: boolean;
  defaultOpen?: boolean;
  /** Full mode shows everything open, with sources (detail page). */
  full?: boolean;
}

const ADDED: Record<Monster['addedIn'], string> = {
  'early-access': 'Early Access',
  '0.3.0': 'v0.3.0 Monster Update',
  '0.5.0': 'v0.5.0 Sunstone Update',
};

/** Short labels for the compact card. Hover shows the longer meaning. */
const TAG_TEXT: Record<MonsterTag, [string, string]> = {
  passive: ['😐 Passive', 'Leaves you alone unless provoked'],
  noisy: ['🔊 Noisy', 'Makes noise that draws other monsters'],
  'loot-breaker': ['💥 Breaks loot', 'Damages or destroys valuables'],
  displacer: ['🌀 Throws you', 'Moves or throws players around'],
  grabber: ['✊ Grabs', 'Grabs and holds players'],
  group: ['👥 Group', 'Spawns as a group'],
  ceiling: ['⬆️ Ceiling', 'Hangs from the ceiling: look up'],
  invisible: ['🫥 Invisible', 'Hard or impossible to see'],
  'stay-quiet': ['🤫 Stay quiet', 'Silence is your defence'],
  'look-away': ['🙈 Look away', 'Don\u2019t look at it'],
  'forces-look': ['👁️ Forces your gaze', 'Locks your view onto it'],
  'after-death': ['☠️ After death', 'Still dangerous after it dies'],
};

/** One row of short facts: how it finds you, HP, stun, traits, counters. */
function QuickTags({ m, usableItems }: { m: Monster; usableItems: Item[] }) {
  return (
    <div class="quick-tags">
      {m.detection.map((d) => (
        <span class="qtag qtag-detect" title="Detects you by">
          {DETECTION_TEXT[d]}
        </span>
      ))}
      <span class="qtag" title="Health">
        ❤️ {m.hp} HP
      </span>
      {m.counter.stun != null && (
        <span class={`qtag ${m.counter.stun ? 'qtag-good' : 'qtag-bad'}`} title={m.counter.stun ? 'Can be stunned' : 'Can\u2019t be stunned'}>
          {m.counter.stun ? '⚡ Stunnable' : '🚫 No stun'}
        </span>
      )}
      {m.tags.map((t) => (
        <span class="qtag" title={TAG_TEXT[t][1]}>
          {TAG_TEXT[t][0]}
        </span>
      ))}
      {m.counter.items.length > 0 && (
        <span class="qtag qtag-counters" title={`Counters: ${m.counter.items.map((id) => itemById.get(id)?.name).join(', ')}`}>
          Counters{' '}
          {m.counter.items.map((id) => {
            const it = itemById.get(id);
            const owned = usableItems.some((u) => u.id === id);
            return it ? <span class={owned ? 'qtag-owned' : ''}>{it.emoji}</span> : null;
          })}
        </span>
      )}
    </div>
  );
}

export function MonsterCard({ monster: m, spotted, usableItems = [], noAnswer, defaultOpen, full }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const body = (
    <div class="card-body">
      <p class="tells">
        <strong>How you notice it:</strong> {m.tells}
      </p>
      {m.nicknames.length > 0 && (
        <p class="tells">
          <strong>Callouts:</strong> “{m.nicknames.join('”, “')}”
        </p>
      )}
      <p>{m.behavior}</p>
      <dl class="facts">
        <dt>Detects you by</dt>
        <dd>
          <DetectionChips detection={m.detection} />
        </dd>
        <dt>Damage</dt>
        <dd>{m.damage}</dd>
        <dt>HP</dt>
        <dd>{m.hp}</dd>
        <dt>Orb value</dt>
        <dd>{m.orb}</dd>
      </dl>
      <div class="dodont">
        {m.do.length > 0 && (
          <div class="do">
            <h4>Do</h4>
            <ul>
              {m.do.map((d) => (
                <li>{d}</li>
              ))}
            </ul>
          </div>
        )}
        {m.dont.length > 0 && (
          <div class="dont">
            <h4>Don’t</h4>
            <ul>
              {m.dont.map((d) => (
                <li>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div class="counter">
        <h4>
          Fight it? <span class="muted small">{m.counter.stun === false ? 'Can’t be stunned' : m.counter.stun ? 'Can be stunned' : ''}</span>
        </h4>
        <p>{m.counter.kill}</p>
        {m.counter.items.length > 0 && (
          <span class="chips">
            {m.counter.items.map((id) => {
              const it = itemById.get(id)!;
              const owned = usableItems.some((u) => u.id === id);
              return (
                <span class={`chip ${owned ? 'chip-owned' : ''}`} title={it.description}>
                  {it.emoji} {it.name}
                  {owned && ' ✓'}
                </span>
              );
            })}
          </span>
        )}
      </div>
      {m.notes && <p class="note">ℹ {m.notes}</p>}
      {full && (
        <p class="muted small sources">
          Sources:{' '}
          {m.sources.map((s, i) => (
            <>
              {i > 0 && ' · '}
              <a href={SOURCES[s].url} target="_blank" rel="noopener noreferrer">
                {SOURCES[s].name}
              </a>
            </>
          ))}
          <br />
          Added in: {ADDED[m.addedIn]}
        </p>
      )}
    </div>
  );

  const header = (
    <>
      <span class="card-emoji" aria-hidden="true">
        {m.emoji}
      </span>
      <span class="card-title">
        <span class="card-name">
          {m.name}
          {m.aliases.length > 0 && <span class="muted small"> aka {m.aliases.join(', ')}</span>}
        </span>
        <span class="card-meta">
          <Stars tier={m.tier} />
          <ThreatBadge threat={m.threat} />
          {spotted?.how === 'heard' && <span class="badge">heard only</span>}
          {spotted?.killed && <span class="badge badge-dead">killed</span>}
          {!m.verified && (
            <span class="badge badge-unverified" title="Sources disagree or info is new. Help verify!">
              unconfirmed
            </span>
          )}
        </span>
      </span>
    </>
  );

  const golden = (
    <p class={`golden ${noAnswer ? 'golden-noanswer' : ''}`}>
      <strong>Rule #1:</strong> {m.golden}
      {usableItems.length > 0 && <span class="have"> You have {usableItems.map((i) => i.name).join(', ')}, so you can fight it.</span>}
      {noAnswer && <span class="have"> Nothing in your kit counters this one. Avoid it.</span>}
    </p>
  );

  if (full) {
    return (
      <article class={`card threat-edge-${m.threat} full`}>
        <div class="card-head">{header}</div>
        {golden}
        {body}
      </article>
    );
  }

  return (
    <article class={`card threat-edge-${m.threat} ${spotted?.killed ? 'killed' : ''}`}>
      <button class="card-head card-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {header}
        <span class={`chev ${open ? 'up' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {golden}
      <QuickTags m={m} usableItems={usableItems} />
      {open && (
        <>
          {body}
          <a class="more-link" href={`#/monsters/${m.id}`}>
            Full entry and sources →
          </a>
        </>
      )}
    </article>
  );
}
