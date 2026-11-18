import type { ComponentChildren } from 'preact';
import type { Detection, Threat } from '../data/types';
import type { Severity } from '../engine/types';

export function Stars({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span class="stars" title={`Tier ${tier}`} aria-label={`Tier ${tier} of 3`}>
      {'★'.repeat(tier)}
      <span class="stars-off">{'★'.repeat(3 - tier)}</span>
    </span>
  );
}

const THREAT_TEXT: Record<Threat, string> = { low: 'Low', medium: 'Medium', high: 'High', lethal: 'Lethal' };
export function ThreatBadge({ threat }: { threat: Threat }) {
  return <span class={`badge threat-${threat}`}>{THREAT_TEXT[threat]}</span>;
}

const DETECTION_TEXT: Record<Detection, string> = {
  sight: '👀 Sight',
  sound: '👂 Sound',
  light: '🔦 Light',
  proximity: '📍 Close range',
  provoked: '✋ Only if provoked',
  gaze: '🙈 Your gaze',
  random: '🎲 Picks a target',
};
export function DetectionChips({ detection }: { detection: Detection[] }) {
  return (
    <span class="chips">
      {detection.map((d) => (
        <span class="chip">{DETECTION_TEXT[d]}</span>
      ))}
    </span>
  );
}

const SEV_ICON: Record<Severity, string> = { danger: '⚠', warn: '!', info: 'i' };
export function SevIcon({ severity }: { severity: Severity }) {
  return (
    <span class={`sev sev-${severity}`} aria-label={severity}>
      {SEV_ICON[severity]}
    </span>
  );
}

export function Section({ title, children, aside }: { title: string; children: ComponentChildren; aside?: ComponentChildren }) {
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Counter({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <span class="stepper small" role="group" aria-label={label}>
      <button aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output>{value}</output>
      <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </span>
  );
}

export const priceText = (p: [number, number]) => (p[0] === p[1] ? `$${p[0]}K` : `$${p[0]}–${p[1]}K`);

export function Tabs<T extends string>({ tabs, active, hrefBase }: { tabs: { id: T; label: string }[]; active: T; hrefBase: string }) {
  return (
    <nav class="tabs" aria-label="Sections">
      {tabs.map((t) => (
        <a href={`${hrefBase}/${t.id}`} class={active === t.id ? 'on' : ''} aria-current={active === t.id ? 'page' : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
