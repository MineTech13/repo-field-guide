import { SOURCES } from '../data';
import { REPO_URL } from '../config';

export function AboutPage() {
  return (
    <div class="stack narrow prose">
      <h1>About</h1>
      <p>
        An unofficial helper for <strong>R.E.P.O.</strong>, the co-op horror extraction game. Keep it open on a second screen or your phone. As
        you play, tell it where you are and what you've run into, and it gives you the rules that matter right now.
      </p>

      <h2>How to use it</h2>
      <ol>
        <li>
          Pick the <strong>map</strong> and set the <strong>level</strong>.
        </li>
        <li>
          Tap <strong>monsters</strong> as you see or hear them. Mark them <em>heard</em> if you only heard them, or <em>killed</em> once
          they're down.
        </li>
        <li>
          Read the <strong>Watch out</strong> list. Dangerous combos (like Huntsman + Banger) show up automatically.
        </li>
        <li>
          Optional: open <strong>Round memory</strong> to log team status, quota progress and gear. The advice adapts (for example, "quota met,
          extract now" or "you have a tranq gun, so you can fight this").
        </li>
        <li>
          Hit <strong>Next level</strong> when you move on. Your round is saved in this browser.
        </li>
        <li>
          At the Service Station, open <a href="#/shop">Shop</a>. Enter your surplus and what's on the shelf for a shopping list, plan a
          loadout in the builder, or check where the secret shop hides.
        </li>
      </ol>

      <h2>How accurate is it?</h2>
      <p>
        The game is in Early Access and changes often. Monster details come from community guides, which sometimes disagree. Where they do,
        the entry says so, and entries with shaky info are marked <span class="badge badge-unverified">unconfirmed</span>. The threat score
        and level phases are a rough guide, not game data.
      </p>

      <h2>Sources</h2>
      <ul>
        {Object.values(SOURCES).map((s) => (
          <li>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.name}
            </a>
            {s.note && <span class="muted"> ({s.note})</span>}
          </li>
        ))}
      </ul>

      <h2>Contribute</h2>
      <p>
        All monster, map and item info lives in plain JSON files under <code>src/data/</code>. Fix a number, add a monster, open a pull
        request.{' '}
        {REPO_URL && (
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Project on GitHub →
          </a>
        )}
      </p>

      <h2>Disclaimer</h2>
      <p class="muted">
        Fan-made and not affiliated with or endorsed by semiwork. R.E.P.O. and related names are property of their respective owners. This
        site uses no game assets.
      </p>
    </div>
  );
}
