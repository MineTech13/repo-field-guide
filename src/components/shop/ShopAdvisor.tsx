import { useMemo, useState } from 'preact/hooks';
import { SHOP, shopItemById, upgradeById } from '../../data';
import type { ShopItem } from '../../data/types';
import { HAGGLE, STYLES, adviseShopV2, idForAsset, mapGameUpgrades, type ExtraItem, type ShelfCopy, type TeamMember } from '../../engine/shopAdvisor';
import { useStored } from '../../hooks';
import { useLive } from '../../live/store';
import { setNudge, toggleBan, togglePin, usePrefs } from '../../state/prefs';
import { loadRound } from '../../state/round';
import { WaitingBanner } from '../LivePill';
import { Collapsible } from '../round/Collapsible';
import { GameTag } from '../round/RoundBar';
import { Counter, Section, priceText } from '../ui';

interface AdvisorState {
  budgetK: number;
  reserveK: number;
  level: number;
  teamSize: number;
  owned: Record<string, number>;
  ownedItems: string[];
  shelfMode: boolean;
  shelf: ShelfCopy[];
  useGame: boolean;
}

const CATEGORY_LABEL: Record<ShopItem['category'], string> = {
  ranged: 'Ranged',
  melee: 'Melee',
  explosive: 'Explosives & traps',
  health: 'Health',
  utility: 'Utility',
  cart: 'Carts & vehicles',
  drone: 'Drones',
};

const nameOf = (id: string) => upgradeById.get(id)?.name ?? shopItemById.get(id)?.name ?? id;
const midPrice = (id: string) => {
  const p = (upgradeById.get(id) ?? shopItemById.get(id))?.price ?? [1, 1];
  return Math.round((p[0] + p[1]) / 2);
};

export function ShopAdvisor() {
  const round = useMemo(loadRound, []);
  const snap = useLive();
  const [prefs, setPrefs] = usePrefs();
  const [st, setSt] = useStored<AdvisorState>('repo-field-guide:shop:v2', {
    budgetK: 30,
    reserveK: 0,
    level: Math.max(1, round.level),
    teamSize: round.memory.teamSize ?? 2,
    owned: {},
    ownedItems: [],
    shelfMode: false,
    shelf: [],
    useGame: true,
  });
  const set = (patch: Partial<AdvisorState>) => setSt((s) => ({ ...s, ...patch }));
  const hurt = round.memory.health === 'hurt' || round.memory.health === 'critical';

  // ---- optional game companion data (fills in, never required)
  const game = snap.data && st.useGame ? snap.data : null;
  const inShop = game?.phase === 'shop';
  // Unknown (modded) items keep their game asset name as id; names come from the game's catalog.
  const idOf = (asset: string) => idForAsset(asset) ?? asset;
  const gameShelf: ShelfCopy[] | null =
    inShop && game?.shelf
      ? game.shelf.map((c) => ({ id: idOf(c.item), priceK: c.priceK, fromGame: true, discounted: c.haggle === 'Discounted', rejected: c.haggle === 'Rejected' }))
      : null;
  const extras: Record<string, ExtraItem> = {};
  for (const c of [...(game?.catalog ?? []), ...(game?.shelf ?? [])]) {
    const id = idOf(c.item);
    if (upgradeById.has(id) || shopItemById.has(id)) continue;
    extras[id] = { name: c.name || c.item.replace(/^Item /, ''), kind: c.type === 'item_upgrade' ? 'upgrade' : 'item', type: c.type };
  }
  const gameBasket = inShop && game?.basket ? game.basket.map((c) => ({ id: idOf(c.item), priceK: c.priceK })) : undefined;
  const inventory: Record<string, number> | undefined = game?.owned
    ? Object.fromEntries(Object.entries(game.owned).map(([asset, n]) => [idOf(asset), n]))
    : undefined;
  const gameTeam: TeamMember[] | null = game?.players?.length
    ? game.players.map((p) => ({ name: p.name, isLocal: !!p.isLocal, upgrades: mapGameUpgrades(p.upgrades) }))
    : null;
  const gameLocal = gameTeam?.find((m) => m.isLocal);
  const label = (id: string) => upgradeById.get(id)?.name ?? shopItemById.get(id)?.name ?? extras[id]?.name ?? id;

  const input = {
    budgetK: game?.surplusK ?? st.budgetK,
    reserveK: st.reserveK,
    level: game?.levelsCompleted ?? st.level,
    teamSize: gameTeam?.length ?? st.teamSize,
    owned: gameLocal?.upgrades ?? st.owned,
    ownedItems: st.ownedItems,
    shelf: gameShelf ?? (st.shelfMode ? st.shelf : []),
    team: gameTeam ?? undefined,
    hurt,
    prefs,
    basket: gameBasket,
    basketTotalK: inShop ? game?.basketTotalK : undefined,
    inventory,
    haggleAttemptsLeft: inShop ? game?.shopkeeper?.attemptsLeft : undefined,
    extras,
  };
  const advice = adviseShopV2(input);
  const unknownOnShelf = gameShelf?.filter((c) => !upgradeById.has(c.id) && !shopItemById.has(c.id)) ?? [];
  const ownedFromGame = new Set(Object.keys(inventory ?? {}).filter((id) => shopItemById.has(id)));

  return (
    <div class="shop-grid">
      <div class="stack">
        <WaitingBanner want="shop" />
        {snap.data && (
          <section class={`panel game-fill ${st.useGame ? 'on' : ''}`}>
            <label class="switch">
              <input type="checkbox" checked={st.useGame} onChange={(e) => set({ useGame: (e.target as HTMLInputElement).checked })} />
              <span>
                <GameTag /> Use data from the game
              </span>
            </label>
            <span class="muted small">
              {snap.source === 'code' ? 'from a pasted code' : snap.status === 'live' ? 'live' : 'last known'} ·{' '}
              {gameShelf ? `${gameShelf.length} shelf copies` : 'no shelf (not in the shop)'} · surplus ${snap.data.surplusK ?? '?'}K
              {gameTeam ? ` · ${gameTeam.length} player${gameTeam.length === 1 ? '' : 's'}` : ''}
            </span>
          </section>
        )}

        <Section title="Your situation">
          <div class="mem-row">
            <div class="field">
              <label class="field-label" for="budget">
                Surplus ($K) {game?.surplusK != null && <GameTag />}
              </label>
              <input
                id="budget"
                class="num-input"
                type="number"
                min={0}
                value={input.budgetK}
                disabled={game?.surplusK != null}
                onInput={(e) => set({ budgetK: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })}
              />
            </div>
            <div class="field">
              <label class="field-label" for="reserve">
                Keep in reserve ($K)
              </label>
              <input id="reserve" class="num-input" type="number" min={0} value={st.reserveK} onInput={(e) => set({ reserveK: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
            </div>
            <div class="field">
              <span class="field-label">Levels cleared {game?.levelsCompleted != null && <GameTag />}</span>
              {game?.levelsCompleted != null ? <output class="num-out">{game.levelsCompleted}</output> : <Counter value={st.level} min={0} max={99} label="levels cleared" onChange={(level) => set({ level })} />}
            </div>
            <div class="field">
              <span class="field-label">Players {gameTeam && <GameTag />}</span>
              {gameTeam ? <output class="num-out">{gameTeam.length}</output> : <Counter value={st.teamSize} min={1} max={6} label="players" onChange={(teamSize) => set({ teamSize })} />}
            </div>
          </div>
          {hurt && <p class="muted small">❤️ Round memory says your team is hurt, so health packs get priority.</p>}
        </Section>

        <Collapsible id="shop-prefs" title="Your preferences" badge={STYLES.find((s) => s.id === prefs.style)!.label} defaultOpen>
          <div class="field">
            <span class="field-label">Playstyle</span>
            <div class="style-grid" role="radiogroup" aria-label="Playstyle">
              {STYLES.map((s) => (
                <button role="radio" aria-checked={prefs.style === s.id} class={`style-btn ${prefs.style === s.id ? 'on' : ''}`} onClick={() => setPrefs((p) => ({ ...p, style: s.id }))}>
                  <strong>{s.label}</strong>
                  <span class="muted small">{s.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="bias">
              Spend more on {prefs.gearBias < 0 ? 'gear' : prefs.gearBias > 0 ? 'upgrades' : 'both equally'}
            </label>
            <div class="bias-row">
              <span class="small muted">Gear</span>
              <input id="bias" type="range" min={-2} max={2} step={1} value={prefs.gearBias} onInput={(e) => setPrefs((p) => ({ ...p, gearBias: Number((e.target as HTMLInputElement).value) }))} />
              <span class="small muted">Upgrades</span>
            </div>
          </div>
          <div class="field">
            <span class="field-label">Upgrades: how much do you want each?</span>
            <div class="nudge-list">
              {SHOP.upgrades
                .filter((u) => !(u.coopOnly && input.teamSize <= 1))
                .map((u) => {
                  const n = prefs.nudge[u.id] ?? 0;
                  return (
                    <div class={`nudge-row ${prefs.banned.includes(u.id) ? 'banned' : ''}`}>
                      <span class="nudge-name">
                        {u.emoji} {u.name}
                      </span>
                      <span class="seg nudge-seg" role="group" aria-label={`${u.name} preference`}>
                        {[-2, -1, 0, 1, 2].map((v) => (
                          <button class={n === v ? 'on' : ''} aria-pressed={n === v} onClick={() => setPrefs((p) => setNudge(p, u.id, v))} title={['avoid', 'less', 'normal', 'more', 'love it'][v + 2]}>
                            {['−−', '−', '·', '+', '++'][v + 2]}
                          </button>
                        ))}
                      </span>
                      <PinBan id={u.id} prefs={prefs} setPrefs={setPrefs} />
                    </div>
                  );
                })}
            </div>
            <p class="muted small">Pin or ban weapons and tools straight from the suggestions, or in the price list.</p>
          </div>
        </Collapsible>

        <Section title="Your upgrades" aside={gameLocal && <span class="small muted"><GameTag /> from the game</span>}>
          <div class="counter-grid">
            {SHOP.upgrades
              .filter((u) => !(u.coopOnly && input.teamSize <= 1))
              .map((u) => (
                <div class="counter-row">
                  <span>
                    {u.emoji} {u.name}
                  </span>
                  {gameLocal ? (
                    <output class="num-out">{gameLocal.upgrades[u.id] ?? 0}</output>
                  ) : (
                    <Counter value={st.owned[u.id] ?? 0} max={20} label={u.name} onChange={(n) => set({ owned: { ...st.owned, [u.id]: n } })} />
                  )}
                </div>
              ))}
          </div>
          {gameTeam && gameTeam.length > 1 && (
            <p class="small muted team-line">
              Team:{' '}
              {gameTeam
                .filter((m) => !m.isLocal)
                .map((m) => `${m.name} (${Object.entries(m.upgrades).map(([id, n]) => `${nameOf(id)} ${n}`).join(', ') || 'no upgrades'})`)
                .join(' · ')}
            </p>
          )}
        </Section>

        <Collapsible id="shop-gear" title="Gear the team owns" badge={st.ownedItems.length || undefined}>
          <div class="item-grid">
            {SHOP.items
              .filter((i) => i.category !== 'health' && i.category !== 'explosive' && i.id !== 'energy-crystal')
              .map((it) => {
                const fromGame = ownedFromGame.has(it.id);
                const on = fromGame || st.ownedItems.includes(it.id);
                return (
                  <button
                    class={`item-btn ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    disabled={fromGame}
                    title={fromGame ? 'Your team owns this (from the game)' : undefined}
                    onClick={() => set({ ownedItems: on ? st.ownedItems.filter((x) => x !== it.id) : [...st.ownedItems, it.id] })}
                  >
                    {it.emoji} {it.name} {fromGame && <GameTag />}
                  </button>
                );
              })}
          </div>
        </Collapsible>

        {gameShelf ? (
          <Section title="Shelf" aside={<span class="small muted"><GameTag /> from the game</span>}>
            <div class="shelf-read">
              {[...gameShelf].sort((a, b) => a.priceK - b.priceK).map((c) => {
                const known = upgradeById.has(c.id) || shopItemById.has(c.id);
                const state = c.discounted ? 'discounted' : c.rejected ? 'rejected' : '';
                return (
                  <span
                    class={`copy-chip ${known ? '' : 'unknown'} ${state}`}
                    title={c.discounted ? 'The shopkeeper gave a discount on this copy' : c.rejected ? 'The shopkeeper turned this copy down' : known ? '' : 'From another mod'}
                  >
                    {known ? '' : '🧩 '}
                    {label(c.id)} <strong>${c.priceK}K</strong>
                    {c.discounted && <small> 🤝 discounted</small>}
                    {c.rejected && <small> ✗ turned down</small>}
                  </span>
                );
              })}
            </div>
            {unknownOnShelf.length > 0 && (
              <div class="modded">
                <p class="muted small">
                  🧩 From other mods. The guide can’t judge these, so rate them yourself and the advisor will include them:
                </p>
                {[...new Set(unknownOnShelf.map((c) => c.id))].map((id) => {
                  const n = prefs.nudge[id] ?? 0;
                  return (
                    <div class="nudge-row">
                      <span class="nudge-name">
                        🧩 {label(id)} <span class="muted small">{extras[id]?.type ?? ''}</span>
                      </span>
                      <span class="seg nudge-seg" role="group" aria-label={`${label(id)} rating`}>
                        {[-1, 0, 1, 2].map((v) => (
                          <button class={n === v ? 'on' : ''} aria-pressed={n === v} onClick={() => setPrefs((p) => setNudge(p, id, v))} title={['not useful', 'unrated', 'good', 'great'][v + 1]}>
                            {['−', '?', '+', '++'][v + 1]}
                          </button>
                        ))}
                      </span>
                      <PinBan id={id} prefs={prefs} setPrefs={setPrefs} />
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        ) : (
          <ManualShelf st={st} set={set} teamSize={input.teamSize} />
        )}
      </div>

      <div class="shop-result">
        <section class="threat-banner level-calm">
          <div class="threat-top">
            <div>
              <div class="threat-label">{advice.planning ? 'Plan for the next shop' : 'Buy this'}</div>
              <div class="threat-word">{advice.picks.length ? `${advice.picks.reduce((a, p) => a + p.qty, 0)} buys` : 'Nothing yet'}</div>
            </div>
            <div class="threat-score">
              ${advice.spentK}K<small> / ${input.budgetK}K</small>
            </div>
          </div>
          <div class="meter">
            <div class="meter-fill shop-fill" style={{ width: `${input.budgetK ? Math.min(100, (advice.spentK / input.budgetK) * 100) : 0}%` }} />
          </div>
          <div class="muted small">
            ${advice.leftK}K left{st.reserveK ? ` (incl. $${st.reserveK}K reserve)` : ''}
            {advice.planning ? ' · prices estimated' : ''}
          </div>
        </section>

        {advice.basket.length > 0 && (
          <section class="panel basket">
            <div class="panel-head">
              <h2>🧺 In your basket</h2>
              <span class="small muted">
                <GameTag /> ${advice.basket.reduce((a, c) => a + c.priceK, 0)}K → ${advice.afterBasketK}K left
              </span>
            </div>
            <div class="shelf-read">
              {advice.basket.map((c) => (
                <span class="copy-chip">
                  {c.name} <strong>${c.priceK}K</strong>
                </span>
              ))}
            </div>
          </section>
        )}

        {advice.haggle && (advice.haggle.best || advice.haggle.freebies.length > 0) && (
          <section class="panel haggle">
            <h2>🤝 Haggle with the shopkeeper</h2>
            {advice.haggle.best && (
              <p>
                Show him the <strong>{advice.haggle.best.name}</strong> (${advice.haggle.best.priceK}K). If he likes it (1 in 3), you save{' '}
                <strong>
                  ${advice.haggle.best.save[0]}
                  {advice.haggle.best.save[1] !== advice.haggle.best.save[0] ? `–${advice.haggle.best.save[1]}` : ''}K
                </strong>
                .
              </p>
            )}
            {advice.haggle.freebies.length > 0 && (
              <p class="small">
                Cheap picks become <strong>free</strong> if he likes them (he always takes at least ${HAGGLE.minOffK}K off): {advice.haggle.freebies.join(', ')}.
              </p>
            )}
            <p class="muted small">
              {advice.haggle.attemptsLeft != null ? `${advice.haggle.attemptsLeft} of ${HAGGLE.attempts} tries left this visit.` : `${HAGGLE.attempts} tries per shop visit.`} Hold the item up to his face; a copy he turns down stays at full price.
            </p>
          </section>
        )}

        {advice.picks.length > 0 ? (
          <ol class="picks">
            {advice.picks.map((p) => (
              <li class="pick">
                <span class="pick-emoji">{p.emoji}</span>
                <span class="pick-main">
                  <strong>
                    {p.qty > 1 ? `${p.qty}× ` : ''}
                    {p.name}
                    {p.qty > 1 && <span class="muted small"> ({p.prices.map((x) => `$${x}K`).join(' + ')})</span>}
                  </strong>
                  <span class="muted small">{p.reasons[0]}</span>
                  {p.reasons.length > 1 && <span class="pick-why small">+ {p.reasons.slice(1).join(' · ')}</span>}
                  {p.giveTo && <span class="pick-give small">👤 Give to {p.giveTo}</span>}
                  <PinBan id={p.id} prefs={prefs} setPrefs={setPrefs} compact />
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
            Prices and stock limits come from the game itself. <a href="#/shop/tips">How the shop works →</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function PinBan({ id, prefs, setPrefs, compact }: { id: string; prefs: ReturnType<typeof usePrefs>[0]; setPrefs: ReturnType<typeof usePrefs>[1]; compact?: boolean }) {
  const pinned = prefs.pinned.includes(id);
  const banned = prefs.banned.includes(id);
  return (
    <span class={`pinban ${compact ? 'compact' : ''}`}>
      <button class={`tiny-btn ${pinned ? 'on' : ''}`} aria-pressed={pinned} title="Always suggest this when I can afford it" onClick={() => setPrefs((p) => togglePin(p, id))}>
        📌{compact ? (pinned ? ' pinned' : ' pin') : ''}
      </button>
      <button class={`tiny-btn ${banned ? 'on' : ''}`} aria-pressed={banned} title="Never suggest this" onClick={() => setPrefs((p) => toggleBan(p, id))}>
        🚫{compact ? (banned ? ' never' : ' not for me') : ''}
      </button>
    </span>
  );
}

/** Manual shelf entry: one price per copy, because every copy rolls its own price. */
function ManualShelf({ st, set, teamSize }: { st: AdvisorState; set: (p: Partial<AdvisorState>) => void; teamSize: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const copies = (id: string) => st.shelf.map((c, i) => ({ ...c, i })).filter((c) => c.id === id);
  const addCopy = (id: string) => set({ shelf: [...st.shelf, { id, priceK: midPrice(id) }] });
  const setCopy = (i: number, priceK: number) => set({ shelf: st.shelf.map((c, j) => (j === i ? { ...c, priceK } : c)) });
  const removeCopy = (i: number) => set({ shelf: st.shelf.filter((_, j) => j !== i) });

  const row = (id: string, emoji: string, name: string, price: [number, number], max: number) => {
    const list = copies(id);
    return (
      <div class={`shelf-row ${list.length ? 'active' : ''}`}>
        <span class="shelf-name">
          {emoji} {name} <span class="muted small">{priceText(price)}</span>
        </span>
        <span class="copies">
          {list.map((c) => (
            <span class="copy-edit">
              $
              <input type="number" min={0} value={c.priceK} aria-label={`${name} copy price in thousands`} onInput={(e) => setCopy(c.i, Math.max(0, Number((e.target as HTMLInputElement).value) || 0))} />K
              <button class="tiny-btn remove" aria-label={`Remove a ${name} copy`} onClick={() => removeCopy(c.i)}>
                ✕
              </button>
            </span>
          ))}
          {list.length < max && (
            <button class="tiny-btn" onClick={() => addCopy(id)} title={`Up to ${max} on the shelf`}>
              + copy
            </button>
          )}
        </span>
      </div>
    );
  };

  return (
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
        <p class="muted">
          Planning mode estimates prices with the game’s formula. In the shop, switch to “I'm in the shop” and add each copy with its
          price, or let the optional game companion fill this in.
        </p>
      ) : (
        <div class="stack-s">
          <p class="muted small">Add each copy with its own price (copies of the same item can cost different amounts).</p>
          <h3 class="tier-head">Upgrades</h3>
          {SHOP.upgrades.filter((u) => !(u.coopOnly && teamSize <= 1)).map((u) => row(u.id, u.emoji, u.name, u.price, u.maxInShop))}
          {(Object.keys(CATEGORY_LABEL) as ShopItem['category'][]).map((cat) => {
            const items = SHOP.items.filter((i) => i.category === cat);
            const count = st.shelf.filter((c) => items.some((i) => i.id === c.id)).length;
            return (
              <details class="shelf-cat" open={open === cat} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setOpen(cat)}>
                <summary>
                  {CATEGORY_LABEL[cat]} <span class="muted small">{count || ''}</span>
                </summary>
                {items.map((it) => row(it.id, it.emoji, it.name, it.price, it.maxInShop))}
              </details>
            );
          })}
          {st.shelf.length > 0 && (
            <button class="link-btn" onClick={() => set({ shelf: [] })}>
              Clear shelf
            </button>
          )}
        </div>
      )}
    </Section>
  );
}
