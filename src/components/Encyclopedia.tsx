import { useState } from 'preact/hooks';
import { MONSTERS, THREAT_ORDER } from '../data';
import type { Detection } from '../data/types';
import { Stars, ThreatBadge } from './ui';

type Sort = 'threat' | 'name' | 'tier';
const DETECTIONS: { id: Detection | 'all'; label: string }[] = [
  { id: 'all', label: 'Any detection' },
  { id: 'sight', label: '👀 Sight' },
  { id: 'sound', label: '👂 Sound' },
  { id: 'light', label: '🔦 Light' },
  { id: 'gaze', label: '🙈 Your gaze' },
  { id: 'provoked', label: '✋ Provoked' },
  { id: 'proximity', label: '📍 Close range' },
  { id: 'random', label: '🎲 Picks a target' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function Encyclopedia() {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<0 | 1 | 2 | 3>(0);
  const [det, setDet] = useState<Detection | 'all'>('all');
  const [sort, setSort] = useState<Sort>('threat');
  const q = norm(query);

  const list = MONSTERS.filter(
    (m) =>
      (!q || [m.name, ...m.aliases, ...m.nicknames, m.behavior].some((t) => norm(t).includes(q))) &&
      (tier === 0 || m.tier === tier) &&
      (det === 'all' || m.detection.includes(det)),
  ).sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name)
      : sort === 'tier'
        ? b.tier - a.tier || a.name.localeCompare(b.name)
        : THREAT_ORDER[b.threat] - THREAT_ORDER[a.threat] || b.tier - a.tier || a.name.localeCompare(b.name),
  );

  return (
    <div class="stack">
      <div class="page-head">
        <h1>Monster encyclopedia</h1>
        <p class="muted">
          {MONSTERS.length} monsters, including the v0.3.0 Monster Update and the v0.5.0 Sunstone Update.
        </p>
      </div>
      <div class="filters">
        <input class="search" type="search" placeholder="Search name, callout or behavior…" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="Search monsters" />
        <div class="seg" role="group" aria-label="Tier filter">
          {([0, 3, 2, 1] as const).map((t) => (
            <button class={tier === t ? 'on' : ''} aria-pressed={tier === t} onClick={() => setTier(t)}>
              {t === 0 ? 'All' : '★'.repeat(t)}
            </button>
          ))}
        </div>
        <select value={det} onChange={(e) => setDet((e.target as HTMLSelectElement).value as Detection | 'all')} aria-label="Detection filter">
          {DETECTIONS.map((d) => (
            <option value={d.id}>{d.label}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as Sort)} aria-label="Sort">
          <option value="threat">Sort: most dangerous</option>
          <option value="tier">Sort: tier</option>
          <option value="name">Sort: A–Z</option>
        </select>
      </div>

      <div class="ency-grid">
        {list.map((m) => (
          <a class={`ency-card threat-edge-${m.threat}`} href={`#/monsters/${m.id}`}>
            <div class="ency-top">
              <span class="card-emoji" aria-hidden="true">
                {m.emoji}
              </span>
              <span class="card-title">
                <span class="card-name">{m.name}</span>
                <span class="card-meta">
                  <Stars tier={m.tier} />
                  <ThreatBadge threat={m.threat} />
                  {m.addedIn === '0.5.0' && <span class="badge badge-new">new</span>}
                </span>
              </span>
            </div>
            <p class="ency-golden">{m.golden}</p>
            <p class="ency-nick">“{m.nicknames.join('”, “')}”</p>
          </a>
        ))}
      </div>
      {!list.length && <p class="muted">Nothing matches those filters.</p>}
    </div>
  );
}
