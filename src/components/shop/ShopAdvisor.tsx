import { useMemo, useState } from 'preact/hooks';
import { SHOP } from '../../data';
import type { ShopItem, TeamMode } from '../../data/types';
import { adviseShop } from '../../engine/shop';
import { useStored } from '../../hooks';
import { loadRound } from '../../state/round';
import { Counter, Section, priceText } from '../ui';

interface AdvisorState {
  budgetK: number;
  reserveK: number;
  mode: TeamMode;
  level: number;
  owned: Record<string, number>;
  ownedItems: string[];
  shelfMode: boolean;
  shelf: Record<string, { count: number; priceK?: number }>;
}

const MODES: { id: TeamMode; label: string }[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'duo', label: 'Duo' },
  { id: 'squad', label: 'Squad (3+)' },
];

const CATEGORY_LABEL: Record<ShopItem['category'], string> = {
  ranged: 'Ranged',
  melee: 'Melee',
  explosive: 'Explosives & traps',
  health: 'Health',
  utility: 'Utility',
  cart: 'Carts',
  drone: 'Drones',
};

export function ShopAdvisor() {
  const round = useMemo(loadRound, []);
  const teamFromRound: TeamMode | null =
    round.memory.teamSize == null ? null : round.memory.teamSize <= 1 ? 'solo' : round.memory.teamSize === 2 ? 'duo' : 'squad';
  const [st, setSt] = useStored<AdvisorState>('repo-field-guide:shop:v1', {
    budgetK: 30,
    reserveK: 0,
    mode: teamFromRound ?? 'duo',
    level: round.level,
    owned: {},
    ownedItems: [],
    shelfMode: false,
    shelf: {},
  });
  const [showOwnedItems, setShowOwnedItems] = useState(false);
  const set = (patch: Partial<AdvisorState>) => setSt((s) => ({ ...s, ...patch }));
  const hurt = round.memory.health === 'hurt' || round.memory.health === 'critical';

  const shelf = st.shelfMode ? Object.fromEntries(Object.entries(st.shelf).filter(([, v]) => v.count > 0)) : {};
  const advice = adviseShop({ ...st, shelf, hurt });

  const shelfCount = (id: string) => st.shelf[id]?.count ?? 0;
  const setShelf = (id: string, count: number, priceK?: number) =>
    set({ shelf: { ...st.shelf, [id]: { count, priceK: priceK ?? st.shelf[id]?.priceK } } });

  return (
    <div class="shop-grid">
      <div class="stack">
        <Section title="Your situation">
          <div class="mem-row">
            <div class="field">
              <label class="field-label" for="budget">
                Surplus ($K)
              </label>
              <input id="budget" class="num-input" type="number" min={0} step={1} value={st.budgetK} onInput={(e) => set({ budgetK: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
            </div>
            <div class="field">
              <label class="field-label" for="reserve">
                Keep in reserve ($K)
              </label>
              <input id="reserve" class="num-input" type="number" min={0} step={1} value={st.reserveK} onInput={(e) => set({ reserveK: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
            </div>
            <div class="field">
              <span class="field-label">Level just cleared</span>
              <Counter value={st.level} min={1} max={99} label="level" onChange={(level) => set({ level })} />
            </div>
          </div>
          <div class="field">
            <span class="field-label">Team</span>
            <div class="seg wide" role="radiogroup" aria-label="Team size">
              {MODES.map((m) => (
                <button role="radio" aria-checked={st.mode === m.id} class={st.mode === m.id ? 'on' : ''} onClick={() => set({ mode: m.id })}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {hurt && <p class="muted small">❤️ Round memory says your team is hurt, so health packs get priority.</p>}
        </Section>

        <Section title="Upgrades you already have">
          <div class="counter-grid">
            {SHOP.upgrades
              .filter((u) => !(u.coopOnly && st.mode === 'solo'))
              .map((u) => (
                <div class="counter-row">
                  <span>
                    {u.emoji} {u.name}
                  </span>
                  <Counter value={st.owned[u.id] ?? 0} max={u.cap ?? 20} label={u.name} onChange={(n) => set({ owned: { ...st.owned, [u.id]: n } })} />
                </div>
              ))}
          </div>
        </Section>

        <section class="panel memory">
          <button class="memory-toggle" aria-expanded={showOwnedItems} onClick={() => setShowOwnedItems(!showOwnedItems)}>
            <span>
              <span class="memory-title">Gear the team owns</span> <span class="muted small">{st.ownedItems.length ? `${st.ownedItems.length} items` : 'so it won\'t suggest duplicates'}</span>
            </span>
            <span class={`chev ${showOwnedItems ? 'up' : ''}`}>▾</span>
          </button>
          {showOwnedItems && (
            <div class="memory-body">
              <div class="item-grid">
                {SHOP.items
                  .filter((i) => i.category !== 'health' && i.category !== 'explosive')
                  .map((it) => {
                    const on = st.ownedItems.includes(it.id);
                    return (
                      <button class={`item-btn ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ ownedItems: on ? st.ownedItems.filter((x) => x !== it.id) : [...st.ownedItems, it.id] })}>
                        {it.emoji} {it.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </section>

        <Section
          title="What's on the shelf?"
          aside={
            <div class="seg" role="radiogroup" aria-label="Shelf mode">
              <button role="radio" aria-checked={!st.shelfMode} class={!st.shelfMode ? 'on' : ''} onClick={() => set({ shelfMode: false })}>
                Plan ahead
              </button>
              <button role="radio" aria-checked={st.shelfMode} class={st.shelfMode ? 'on' : ''} onClick={() => set({ shelfMode: true })}>
                I'm in the shop
              </button>
            </div>
          }
        >
          {!st.shelfMode ? (
            <p class="muted">Planning mode assumes anything can show up and uses guide prices. Switch to “I'm in the shop” and enter what's actually for sale.</p>
          ) : (
            <div class="stack-s">
              <p class="muted small">Set how many of each are on the shelf. Optionally type the real price in $K.</p>
              <h3 class="tier-head">Upgrades</h3>
              {SHOP.upgrades
                .filter((u) => !(u.coopOnly && st.mode === 'solo'))
                .map((u) => (
                  <ShelfRow id={u.id} emoji={u.emoji} name={u.name} price={u.price} count={shelfCount(u.id)} priceK={st.shelf[u.id]?.priceK} onChange={setShelf} />
                ))}
              {(Object.keys(CATEGORY_LABEL) as ShopItem['category'][]).map((cat) => (
                <details class="shelf-cat">
                  <summary>
                    {CATEGORY_LABEL[cat]}{' '}
                    <span class="muted small">
                      {SHOP.items.filter((i) => i.category === cat && shelfCount(i.id) > 0).length || ''}
                    </span>
                  </summary>
                  {SHOP.items
                    .filter((i) => i.category === cat)
                    .map((it) => (
                      <ShelfRow id={it.id} emoji={it.emoji} name={it.name} price={it.price} count={shelfCount(it.id)} priceK={st.shelf[it.id]?.priceK} onChange={setShelf} />
                    ))}
                </details>
              ))}
              <button class="link-btn" onClick={() => set({ shelf: {} })}>
                Clear shelf
              </button>
            </div>
          )}
        </Section>
      </div>

      <div class="shop-result">
        <section class="threat-banner level-calm">
          <div class="threat-top">
            <div>
              <div class="threat-label">Shopping list</div>
              <div class="threat-word">{advice.picks.length ? `${advice.picks.reduce((a, p) => a + p.qty, 0)} buys` : 'Nothing yet'}</div>
            </div>
            <div class="threat-score">
              ${advice.spentK}K<small> / ${st.budgetK}K</small>
            </div>
          </div>
          <div class="meter">
            <div class="meter-fill shop-fill" style={{ width: `${st.budgetK ? Math.min(100, (advice.spentK / st.budgetK) * 100) : 0}%` }} />
          </div>
          <div class="muted small">
            ${advice.leftK}K left{st.reserveK ? ` (incl. $${st.reserveK}K reserve)` : ''}
          </div>
        </section>

        {advice.picks.length > 0 ? (
          <ol class="picks">
            {advice.picks.map((p) => (
              <li class="pick">
                <span class="pick-emoji">{p.emoji}</span>
                <span class="pick-main">
                  <strong>
                    {p.qty > 1 ? `${p.qty}× ` : ''}
                    {p.name}
                  </strong>
                  <span class="muted small">{p.reason}</span>
                </span>
                <span class="pick-cost">${p.costK}K</span>
              </li>
            ))}
          </ol>
        ) : (
          <p class="panel muted">Nothing worth buying fits the budget. Save it for next time, or lower the reserve.</p>
        )}

        <Section title="Good to know">
          <ul class="bullets">
            {advice.notes.map((n) => (
              <li class={`bullet bullet-${n.startsWith('⚠') ? 'warn' : 'info'}`}>
                <span>{n}</span>
              </li>
            ))}
            {advice.skipped.map((s) => (
              <li class="bullet bullet-info">
                <span>
                  <strong>{s.name}:</strong> {s.reason}
                </span>
              </li>
            ))}
          </ul>
          <p class="muted small">
            Prices are community-reported ranges and shift each level. Picks are a suggestion. <a href="#/shop/tips">Shop tricks →</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function ShelfRow(p: { id: string; emoji: string; name: string; price: [number, number]; count: number; priceK?: number; onChange: (id: string, count: number, priceK?: number) => void }) {
  return (
    <div class={`counter-row ${p.count ? 'active' : ''}`}>
      <span>
        {p.emoji} {p.name} <span class="muted small">{priceText(p.price)}</span>
      </span>
      <span class="shelf-controls">
        {p.count > 0 && (
          <input
            class="price-input"
            type="number"
            min={0}
            placeholder="$K"
            aria-label={`${p.name} actual price in thousands`}
            value={p.priceK ?? ''}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              p.onChange(p.id, p.count, v === '' ? undefined : Math.max(0, Number(v)));
            }}
          />
        )}
        <Counter value={p.count} max={6} label={`${p.name} on shelf`} onChange={(n) => p.onChange(p.id, n)} />
      </span>
    </div>
  );
}
