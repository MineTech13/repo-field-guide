import { useState } from 'preact/hooks';
import { SHOP, SOURCES } from '../../data';
import type { ShopTip } from '../../data/types';

const TAGS: { id: ShopTip['tag'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trick', label: '🎩 Tricks' },
  { id: 'money', label: '💰 Money' },
  { id: 'loadout', label: '🔫 Loadout' },
  { id: 'team', label: '👥 Team' },
  { id: 'basics', label: '📘 Basics' },
];

export function ShopTips() {
  const [tag, setTag] = useState<(typeof TAGS)[number]['id']>('all');
  const tips = SHOP.tips.filter((t) => tag === 'all' || t.tag === tag);
  return (
    <div class="stack">
      <div class="seg" role="group" aria-label="Filter tips">
        {TAGS.map((t) => (
          <button class={tag === t.id ? 'on' : ''} aria-pressed={tag === t.id} onClick={() => setTag(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div class="tips-grid">
        {tips.map((t) => (
          <article class="panel tip-card">
            <h3>
              {t.title} {!t.verified && <span class="badge badge-unverified">community tip</span>}
            </h3>
            <p>{t.text}</p>
          </article>
        ))}
      </div>
      <p class="muted small">
        Sources:{' '}
        {SHOP.sources.map((s, i) => (
          <>
            {i > 0 && ' · '}
            <a href={SOURCES[s].url} target="_blank" rel="noopener noreferrer">
              {SOURCES[s].name}
            </a>
          </>
        ))}
      </p>
    </div>
  );
}
