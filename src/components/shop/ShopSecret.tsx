import { useState } from 'preact/hooks';
import { SHOP, SOURCES, shopItemById } from '../../data';

/** "What do you see?" clues that identify the station layout. */
const CLUES: { id: string; clue: string; layout: string }[] = [
  { id: 'toilets', clue: '🚽 Toilet cubicles', layout: 'toilet' },
  { id: 'freezers', clue: '🧊 Freezers with cracked glass', layout: 'basement' },
  { id: 'white-door', clue: '🚪 Plain white door opposite the truck', layout: 'garage' },
  { id: 'diner', clue: '🍔 Diner counter with registers', layout: 'diner' },
  { id: 'stairs', clue: '🪜 A door leading to a staircase', layout: 'office' },
  { id: 'smoke', clue: '🔦 Smoke detector above the shelves', layout: 'ceiling' },
];

export function ShopSecret() {
  const { secretShop } = SHOP;
  const [seen, setSeen] = useState<string[]>([]);
  const matches = new Set(CLUES.filter((c) => seen.includes(c.id)).map((c) => c.layout));
  const layouts = [...secretShop.layouts].sort((a, b) => Number(matches.has(b.id)) - Number(matches.has(a.id)));

  return (
    <div class="stack">
      <section class="panel">
        <h2>Which station did you get?</h2>
        <p class="muted">{secretShop.intro} Tap what you can see and the matching entrance moves to the top.</p>
        <div class="chips">
          {CLUES.map((c) => {
            const on = seen.includes(c.id);
            return (
              <button class={`map-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setSeen(on ? seen.filter((x) => x !== c.id) : [...seen, c.id])}>
                {c.clue}
              </button>
            );
          })}
        </div>
        <p class="small" style={{ marginBottom: 0 }}>
          <strong>Secret shop stock:</strong>{' '}
          {secretShop.stock.map((id, i) => {
            const it = shopItemById.get(id);
            return (
              <>
                {i > 0 && ', '}
                {it ? `${it.emoji} ${it.name}` : id}
              </>
            );
          })}
          .
        </p>
      </section>

      <div class="tips-grid">
        {layouts.map((l) => (
          <article class={`panel secret-card ${matches.has(l.id) ? 'match' : ''}`}>
            <h3>
              <span aria-hidden="true">{l.emoji}</span> {l.name} {matches.has(l.id) && <span class="badge badge-new">your layout?</span>}
            </h3>
            <ol>
              {l.how.map((s) => (
                <li>{s}</li>
              ))}
            </ol>
            <p class="muted small">Needs: {l.needs}</p>
          </article>
        ))}
      </div>
      <p class="muted small">
        Layouts change between updates, and some stations have no secret shop at all. Sources:{' '}
        {secretShop.sources.map((s, i) => (
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
