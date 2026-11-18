import { Tabs } from '../ui';
import { ShopAdvisor } from './ShopAdvisor';
import { ShopBuilder } from './ShopBuilder';
import { ShopPrices } from './ShopPrices';
import { ShopSecret } from './ShopSecret';
import { ShopTips } from './ShopTips';

type Tab = 'advisor' | 'builder' | 'tips' | 'secret' | 'prices';
const TABS: { id: Tab; label: string }[] = [
  { id: 'advisor', label: '🛒 Advisor' },
  { id: 'builder', label: '🧩 Builder' },
  { id: 'tips', label: '💡 Tips & tricks' },
  { id: 'secret', label: '🕵️ Secret shop' },
  { id: 'prices', label: '🏷️ Price list' },
];

export function ShopPage({ tab }: { tab?: string }) {
  const active: Tab = (TABS.find((t) => t.id === tab)?.id ?? 'advisor') as Tab;
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Service Station</h1>
        <p class="muted">What to buy between levels: upgrade advice, a loadout builder, shop tricks and where the secret shop hides.</p>
      </div>
      <Tabs tabs={TABS} active={active} hrefBase="#/shop" />
      {active === 'advisor' && <ShopAdvisor />}
      {active === 'builder' && <ShopBuilder />}
      {active === 'tips' && <ShopTips />}
      {active === 'secret' && <ShopSecret />}
      {active === 'prices' && <ShopPrices />}
    </div>
  );
}
