import { useMemo, useState } from 'preact/hooks';
import { MAPS, MONSTERS, SHOP, SPAWNS } from '../data';

interface Hit {
  kind: string;
  emoji: string;
  title: string;
  text: string;
  href: string;
}

const norm = (s: string) => s.toLowerCase();

/** Everything searchable, flattened once. */
function buildIndex(): (Hit & { hay: string })[] {
  const out: (Hit & { hay: string })[] = [];
  for (const m of MONSTERS)
    out.push({
      kind: 'Monster',
      emoji: m.emoji,
      title: m.name,
      text: m.golden,
      href: `#/monsters/${m.id}`,
      hay: norm([m.name, ...m.aliases, m.golden, m.tells, m.behavior, ...m.do, ...m.dont, m.counter.kill].join(' ')),
    });
  for (const m of MAPS)
    out.push({ kind: 'Map', emoji: m.emoji, title: m.name, text: m.summary, href: '#/maps', hay: norm([m.name, m.summary, ...m.tips, ...Object.values(m.hazards).flat()].join(' ')) });
  for (const u of SHOP.upgrades) out.push({ kind: 'Upgrade', emoji: u.emoji, title: u.name, text: `${u.effect} ${u.why}`, href: '#/shop/prices', hay: norm(`${u.name} upgrade ${u.effect} ${u.why}`) });
  for (const i of SHOP.items) out.push({ kind: 'Item', emoji: i.emoji, title: i.name, text: i.effect, href: '#/shop/prices', hay: norm(`${i.name} ${i.category} ${i.effect}`) });
  for (const t of SHOP.tips) out.push({ kind: 'Shop tip', emoji: '💡', title: t.title, text: t.text, href: '#/shop/tips', hay: norm(`${t.title} ${t.text}`) });
  for (const l of SHOP.secretShop.layouts)
    out.push({ kind: 'Secret shop', emoji: l.emoji, title: l.name, text: l.how.join(' → '), href: '#/shop/secret', hay: norm(`secret shop ${l.name} ${l.how.join(' ')} ${l.needs}`) });
  SPAWNS.rules.forEach((r, i) => out.push({ kind: 'Spawn rule', emoji: '🧬', title: `Spawn rule ${i + 1}`, text: r, href: '#/spawns', hay: norm(`spawn respawn ${r}`) }));
  return out;
}

const SECTIONS = [
  { href: '#/monsters', emoji: '👹', title: 'Monsters', text: `${MONSTERS.length} monsters: tells, counters and orb values` },
  { href: '#/maps', emoji: '🗺️', title: 'Maps', text: `${MAPS.length} maps and how their hazards scale` },
  { href: '#/spawns', emoji: '🧬', title: 'Spawns & respawns', text: 'Monsters per level, group swaps, respawn timers' },
  { href: '#/shop/prices', emoji: '🏷️', title: 'Items & upgrades', text: `${SHOP.upgrades.length + SHOP.items.length} items with prices` },
  { href: '#/shop/tips', emoji: '💡', title: 'Shop tips & tricks', text: 'Upgrade pool trick, price rolls, Tax Tokens' },
  { href: '#/shop/secret', emoji: '🕵️', title: 'Secret shop', text: 'Every station layout and how to get in' },
];

export function WikiPage() {
  const index = useMemo(buildIndex, []);
  const [q, setQ] = useState('');
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hits = words.length ? index.filter((h) => words.every((w) => h.hay.includes(w))).slice(0, 40) : [];

  return (
    <div class="stack">
      <div class="page-head">
        <h1>Wiki</h1>
        <p class="muted">Search everything: monsters, maps, items, shop tricks, spawn rules.</p>
      </div>
      <input
        class="search big-search"
        type="search"
        autoFocus
        placeholder='Try "stun", "lava", "pony", "stamina", "toilet"…'
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        aria-label="Search the wiki"
      />
      {words.length > 0 ? (
        <div class="stack-s">
          <p class="muted small">
            {hits.length} result{hits.length === 1 ? '' : 's'}
          </p>
          {hits.map((h) => (
            <a class="wiki-hit" href={h.href}>
              <span class="card-emoji">{h.emoji}</span>
              <span>
                <span class="badge">{h.kind}</span> <strong>{h.title}</strong>
                <span class="muted small wiki-text">{h.text}</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div class="ency-grid">
          {SECTIONS.map((s) => (
            <a class="ency-card" href={s.href}>
              <div class="ency-top">
                <span class="card-emoji">{s.emoji}</span>
                <span class="card-name">{s.title}</span>
              </div>
              <p class="ency-golden">{s.text}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
