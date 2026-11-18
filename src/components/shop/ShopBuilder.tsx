import { useEffect, useState } from 'preact/hooks';
import { SHOP } from '../../data';
import type { ShopItem } from '../../data/types';
import { buildGear, decodeBuild, encodeBuild, summarizeBuild, type Build } from '../../engine/shop';
import { getHashQuery, useStored } from '../../hooks';
import { loadRound, saveRound, updateMemory } from '../../state/round';
import { Counter, Section, priceText } from '../ui';

const CATS: { id: ShopItem['category']; label: string }[] = [
  { id: 'ranged', label: 'Ranged' },
  { id: 'melee', label: 'Melee' },
  { id: 'explosive', label: 'Explosives & traps' },
  { id: 'utility', label: 'Utility' },
  { id: 'drone', label: 'Drones' },
  { id: 'cart', label: 'Carts' },
  { id: 'health', label: 'Health' },
];

const PRESETS: { name: string; build: Build }[] = [
  { name: 'Solo carrier', build: { upgrades: { strength: 3, health: 2, stamina: 2, 'tumble-launch': 1 }, items: ['tranq-gun', 'explosive-mine', 'pocket-cart'] } },
  { name: 'Scout', build: { upgrades: { stamina: 4, sprint: 2, health: 2, 'extra-jump': 1 }, items: ['prodzap', 'valuable-tracker'] } },
  { name: 'Monster hunter', build: { upgrades: { health: 3, strength: 2, stamina: 2 }, items: ['tranq-gun', 'sledgehammer', 'grenade', 'explosive-mine'] } },
  { name: 'Squad support', build: { upgrades: { range: 3, health: 2, stamina: 2, 'map-player-count': 1 }, items: ['prodzap', 'indestructible-drone', 'health-medium'] } },
];

export function ShopBuilder() {
  const [stored, setStored] = useStored<{ build: Build }>('repo-field-guide:build:v1', { build: { upgrades: {}, items: [] } });
  const [copied, setCopied] = useState('');
  const build = stored.build;
  const setBuild = (b: Build) => setStored({ build: b });

  // Load a shared build from the URL once.
  useEffect(() => {
    const shared = getHashQuery().get('b');
    if (shared) setBuild(decodeBuild(shared));
  }, []);

  const sum = summarizeBuild(build);
  const toggleItem = (id: string) =>
    setBuild({ ...build, items: build.items.includes(id) ? build.items.filter((x) => x !== id) : [...build.items, id] });

  const share = async () => {
    const url = `${location.origin}${location.pathname}#/shop/builder?b=${encodeURIComponent(encodeBuild(build))}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('Link copied!');
    } catch {
      window.prompt('Copy this link:', url);
      setCopied('');
    }
    setTimeout(() => setCopied(''), 2500);
  };

  const sendToRound = () => {
    const r = loadRound();
    saveRound(updateMemory(r, { items: buildGear(build) }));
    location.hash = '#/';
  };

  return (
    <div class="shop-grid">
      <div class="stack">
        <Section title="Presets">
          <div class="chips">
            {PRESETS.map((p) => (
              <button class="map-chip" onClick={() => setBuild(structuredClone(p.build))}>
                {p.name}
              </button>
            ))}
            <button class="link-btn" onClick={() => setBuild({ upgrades: {}, items: [] })}>
              Clear
            </button>
          </div>
        </Section>

        <Section title="Upgrades">
          <div class="counter-grid">
            {SHOP.upgrades.map((u) => (
              <div class="counter-row" title={u.effect}>
                <span>
                  {u.emoji} {u.name} <span class="muted small">{priceText(u.price)}</span>
                </span>
                <Counter value={build.upgrades[u.id] ?? 0} max={u.cap ?? 15} label={u.name} onChange={(n) => setBuild({ ...build, upgrades: { ...build.upgrades, [u.id]: n } })} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Weapons & tools">
          {CATS.map((c) => (
            <div class="tier-group">
              <h3 class="tier-head">{c.label}</h3>
              <div class="item-grid">
                {SHOP.items
                  .filter((i) => i.category === c.id)
                  .map((it) => {
                    const on = build.items.includes(it.id);
                    return (
                      <button class={`item-btn ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleItem(it.id)} title={it.effect}>
                        {it.emoji} {it.name} <span class="muted small">{priceText(it.price)}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </Section>
      </div>

      <div class="shop-result">
        <section class="threat-banner level-calm">
          <div class="threat-label">Loadout cost</div>
          <div class="threat-word">
            ${sum.costMinK}K{sum.costMaxK !== sum.costMinK && `–${sum.costMaxK}K`}
          </div>
          <div class="muted small">Upgrades are per player. Weapons and tools are shared team gear.</div>
        </section>

        {sum.stats.length > 0 && (
          <Section title="Stat boosts">
            <dl class="facts">
              {sum.stats.map((s) => (
                <>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </>
              ))}
            </dl>
          </Section>
        )}

        <Section title="Tier-3 coverage" aside={<span class="muted small">{sum.covered.length}/{sum.covered.length + sum.uncovered.length}</span>}>
          <p class="muted small">Big monsters this loadout has a counter for:</p>
          <div class="chips">
            {sum.covered.map((m) => (
              <a class="chip chip-owned" href={`#/monsters/${m.id}`}>
                {m.emoji} {m.name}
              </a>
            ))}
            {sum.uncovered.map((m) => (
              <a class="chip chip-missing" href={`#/monsters/${m.id}`}>
                {m.emoji} {m.name}
              </a>
            ))}
          </div>
        </Section>

        {sum.warnings.length > 0 && (
          <Section title="Gaps">
            <ul class="bullets">
              {sum.warnings.map((w) => (
                <li class="bullet bullet-warn">
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div class="btn-row">
          <button class="btn primary" onClick={share}>
            {copied || 'Copy share link'}
          </button>
          <button class="btn" onClick={sendToRound} title="Puts this loadout's gear into Round memory so monster advice knows what you can fight with">
            Use as round gear →
          </button>
        </div>
      </div>
    </div>
  );
}
