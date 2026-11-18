import { useState } from 'preact/hooks';
import { SOURCES, itemById } from '../data';
import type { Item, Monster } from '../data/types';
import type { Spotted } from '../engine/types';
import { DetectionChips, Stars, ThreatBadge } from './ui';

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

export function MonsterCard({ monster: m, spotted, usableItems = [], noAnswer, defaultOpen, full }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const body = (
    <div class="card-body">
      <p class="tells">
        <strong>How you notice it:</strong> {m.tells}
      </p>
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
          {!m.verified && <span class="badge badge-unverified" title="Sources disagree or info is new. Help verify!">unconfirmed</span>}
        </span>
      </span>
    </>
  );

  const golden = (
    <p class={`golden ${noAnswer ? 'golden-noanswer' : ''}`}>
      <strong>Rule #1:</strong> {m.golden}
      {usableItems.length > 0 && (
        <span class="have">
          {' '}
          You have {usableItems.map((i) => i.name).join(', ')}, so you can fight it.
        </span>
      )}
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
