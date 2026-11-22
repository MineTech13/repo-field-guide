import type { Advice } from '../../engine/types';
import { SevIcon } from '../ui';

/** The one card to glance at mid-round: threat, the call, and the top 3 things to watch. */
export function ThreatCard({ advice }: { advice: Advice }) {
  const { score, label, call, watchOut } = advice;
  const top = watchOut.slice(0, 3);
  const more = watchOut.length - top.length;
  return (
    <section class={`threat-banner level-${label.toLowerCase()}`} aria-live="polite">
      <div class="threat-top">
        <div>
          <div class="threat-word">{label}</div>
          <div class="call">
            <strong>{call.title}.</strong> {call.text}
          </div>
        </div>
        <div class="threat-score" aria-label={`Threat score ${score} of 100`}>
          {score}
          <small>/100</small>
        </div>
      </div>
      <div class="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Threat meter">
        <div class="meter-fill" style={{ width: `${score}%` }} />
      </div>
      <ul class="bullets">
        {top.map((b) => (
          <li class={`bullet bullet-${b.severity}`}>
            <SevIcon severity={b.severity} />
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
      {more > 0 && <p class="muted small more-note">+{more} more in the sections below</p>}
    </section>
  );
}
