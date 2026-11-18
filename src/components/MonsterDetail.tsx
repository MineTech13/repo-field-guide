import { useEffect } from 'preact/hooks';
import { ITEMS, monsterById } from '../data';
import { REPO_URL } from '../config';
import { MonsterCard } from './MonsterCard';

export function MonsterDetail({ id }: { id: string }) {
  const m = monsterById.get(id);
  useEffect(() => {
    document.title = m ? `${m.name} · R.E.P.O. Field Guide` : 'R.E.P.O. Field Guide';
    return () => {
      document.title = 'R.E.P.O. Field Guide';
    };
  }, [m]);

  if (!m) {
    return (
      <div class="stack">
        <h1>Unknown monster</h1>
        <a href="#/monsters">← Back to all monsters</a>
      </div>
    );
  }
  const goodItems = ITEMS.filter((i) => i.goodAgainst.includes(m.id));

  return (
    <div class="stack narrow">
      <a href="#/monsters" class="back">
        ← All monsters
      </a>
      <MonsterCard monster={m} full />
      {goodItems.length > 0 && (
        <section class="panel">
          <h2>Gear that helps</h2>
          <ul class="tips">
            {goodItems.map((i) => (
              <li>
                {i.emoji} <strong>{i.name}</strong>: {i.description}
              </li>
            ))}
          </ul>
        </section>
      )}
      {REPO_URL && (
        <p class="muted small">
          Something wrong or outdated?{' '}
          <a href={`${REPO_URL}/edit/main/src/data/monsters.json`} target="_blank" rel="noopener noreferrer">
            Edit monsters.json on GitHub
          </a>
        </p>
      )}
    </div>
  );
}
