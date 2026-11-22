import { REPO_URL } from './config';
import { useRoute, useTheme } from './hooks';
import { AboutPage } from './components/AboutPage';
import { Encyclopedia } from './components/Encyclopedia';
import { MapsPage } from './components/MapsPage';
import { MonsterDetail } from './components/MonsterDetail';
import { LivePage } from './components/LivePage';
import { LivePill } from './components/LivePill';
import { RoundPage } from './components/RoundPage';
import { ShopPage } from './components/shop/ShopPage';
import { SpawnsPage } from './components/SpawnsPage';
import { WikiPage } from './components/WikiPage';

const NAV = [
  { href: '#/', label: 'Round', match: [''] },
  { href: '#/live', label: 'Live', match: ['live'] },
  { href: '#/shop', label: 'Shop', match: ['shop'] },
  { href: '#/wiki', label: 'Wiki', match: ['wiki', 'monsters', 'maps', 'spawns'] },
  { href: '#/about', label: 'About', match: ['about'] },
];

const WIKI_SUB = [
  { href: '#/wiki', label: 'Search', match: 'wiki' },
  { href: '#/monsters', label: 'Monsters', match: 'monsters' },
  { href: '#/maps', label: 'Maps', match: 'maps' },
  { href: '#/spawns', label: 'Spawns', match: 'spawns' },
];

export function App() {
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();
  const top = route[0] ?? '';
  const nav = NAV;
  const inWiki = ['wiki', 'monsters', 'maps', 'spawns'].includes(top);

  let page;
  if (top === 'monsters' && route[1]) page = <MonsterDetail id={route[1]} />;
  else if (top === 'monsters') page = <Encyclopedia />;
  else if (top === 'maps') page = <MapsPage />;
  else if (top === 'spawns') page = <SpawnsPage />;
  else if (top === 'wiki') page = <WikiPage />;
  else if (top === 'shop') page = <ShopPage tab={route[1]} />;
  else if (top === 'about') page = <AboutPage />;
  else if (top === 'live') page = <LivePage />;
  else page = <RoundPage />;

  return (
    <>
      <header class="topbar">
        <a class="brand" href="#/">
          <span class="brand-mark" aria-hidden="true">
            ◎
          </span>
          <span>
            R.E.P.O. <b>Field Guide</b>
          </span>
        </a>
        <nav class="nav" aria-label="Main">
          {nav.map((n) => (
            <a href={n.href} class={n.match.includes(top) ? 'active' : ''} aria-current={n.match.includes(top) ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <LivePill />
        <button class="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>
      <main class={`page ${top === 'live' ? 'page-live' : ''}`}>
        {inWiki && (
          <nav class="tabs wiki-sub" aria-label="Wiki sections">
            {WIKI_SUB.map((s) => (
              <a href={s.href} class={top === s.match ? 'on' : ''} aria-current={top === s.match ? 'page' : undefined}>
                {s.label}
              </a>
            ))}
          </nav>
        )}
        {page}
      </main>
      {top !== 'live' && (
        <footer class="footer">
          <p>
            Unofficial fan project. Not affiliated with or endorsed by semiwork. Info is gathered from community guides and may lag behind game updates.{' '}
            {REPO_URL && <a href={REPO_URL}>Contribute on GitHub</a>}
          </p>
        </footer>
      )}
    </>
  );
}
