import { useState } from 'preact/hooks';
import { SHOP } from '../../data';
import { priceText } from '../ui';

type Row = { id: string; emoji: string; name: string; kind: string; price: [number, number]; effect: string; unverified?: boolean };

const ROWS: Row[] = [
  ...SHOP.upgrades.map((u) => ({ id: u.id, emoji: u.emoji, name: u.name, kind: 'upgrade', price: u.price, effect: u.effect })),
  ...SHOP.items.map((i) => ({ id: i.id, emoji: i.emoji, name: i.name, kind: i.category, price: i.price, effect: i.effect, unverified: i.unverified })),
];
const KINDS = ['all', 'upgrade', 'ranged', 'melee', 'explosive', 'health', 'utility', 'drone', 'cart'];

export function ShopPrices() {
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'price' | 'name'>('price');
  const rows = ROWS.filter((r) => (kind === 'all' || r.kind === kind) && (!q || `${r.name} ${r.effect}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : a.price[0] - b.price[0] || a.name.localeCompare(b.name),
  );

  return (
    <div class="stack">
      <div class="filters">
        <input class="search" type="search" placeholder="Search items…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search items" />
        <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value)} aria-label="Category">
          {KINDS.map((k) => (
            <option value={k}>{k === 'all' ? 'All categories' : k[0].toUpperCase() + k.slice(1)}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as 'price' | 'name')} aria-label="Sort">
          <option value="price">Cheapest first</option>
          <option value="name">A–Z</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="price-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Price</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td class="nowrap">
                  {r.emoji} <strong>{r.name}</strong>
                </td>
                <td class="muted small">{r.kind}</td>
                <td class="nowrap mono">{priceText(r.price)}</td>
                <td>
                  {r.effect}
                  {r.unverified && <span class="badge badge-unverified">unconfirmed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">Prices are community-reported ranges. The shop rolls new prices every level and they trend upward later in a run.</p>
    </div>
  );
}
