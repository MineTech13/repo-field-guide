import { describePhase } from '../live/phase';
import { useLive } from '../live/store';

/** Top-bar status while the optional game companion is connected. Hidden otherwise. */
export function LivePill() {
  const snap = useLive();
  if (!snap.enabled) return null;
  if (snap.status !== 'live' || !snap.data) {
    return (
      <a class={`live-pill live-${snap.status}`} href="#/" title="Game companion">
        <span class="live-dot" aria-hidden="true" />
        <span class="live-pill-text">{snap.status === 'connecting' ? 'Connecting…' : 'Game not found'}</span>
      </a>
    );
  }
  const info = describePhase(snap.data)!;
  return (
    <a class={`live-pill live-live ${info.waiting ? 'waiting' : ''}`} href={info.href} title={`${info.title} · ${info.detail}`}>
      <span class="live-dot" aria-hidden="true" />
      <span class="live-pill-text">
        {info.icon} <strong>{info.title}</strong>
        <span class="live-pill-detail"> · {info.detail}</span>
      </span>
    </a>
  );
}

/** Banner for pages whose content needs a phase the game isn't in right now. */
export function WaitingBanner({ want }: { want: 'level' | 'shop' }) {
  const snap = useLive();
  if (!snap.enabled || snap.status !== 'live' || !snap.data) return null;
  const info = describePhase(snap.data)!;
  if (snap.data.phase === want) return null;
  const text =
    want === 'level'
      ? info.waiting
        ? 'This page fills in as soon as the next level starts. Meanwhile you can plan below or browse the wiki.'
        : 'You’re not in a level right now. Here’s your last level.'
      : 'You’re not in the shop right now, so this is your plan for the next visit.';
  return (
    <div class="waiting-banner" role="status">
      <span class="waiting-icon" aria-hidden="true">
        {info.icon}
      </span>
      <span>
        <strong>
          {info.title} · {info.detail}
        </strong>
        <span class="muted small"> {text}</span>
      </span>
    </div>
  );
}
