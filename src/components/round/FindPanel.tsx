import { floorText, headingTo, turnText, type NavTarget } from '../../engine/navigate';
import type { Vec3 } from '../../live/schema';

const KIND_LABEL: Record<NavTarget['kind'], string> = {
  extraction: 'Extractions',
  truck: 'Truck',
  head: 'Heads',
  valuable: 'Valuables',
  monster: 'Monsters',
};

/** Pick something you've discovered; a compass points to it from where you're looking. */
export function FindPanel({ targets, selected, onSelect, me, yaw }: { targets: NavTarget[]; selected: string | null; onSelect: (id: string | null) => void; me?: Vec3; yaw?: number }) {
  const target = targets.find((t) => t.id === selected) ?? null;
  const h = target && me ? headingTo(me, yaw ?? 0, target.at) : null;
  const floor = h ? floorText(h.dy) : null;
  const groups = (Object.keys(KIND_LABEL) as NavTarget['kind'][]).map((k) => [k, targets.filter((t) => t.kind === k)] as const).filter(([, list]) => list.length);

  return (
    <div class="find">
      {target && h ? (
        <div class="find-compass">
          <div class="compass" aria-hidden="true">
            <span class="compass-arrow" style={{ transform: `rotate(${h.turn}deg)` }}>
              ▲
            </span>
          </div>
          <div class="find-text">
            <strong>
              {target.icon} {target.label}
            </strong>
            <span class="find-dist">{h.distance} m</span>
            <span>
              {turnText(h.turn)}
              {floor && <strong class="find-floor"> · {floor}</strong>}
            </span>
            <span class="muted small">Straight line, walls not counted.</span>
          </div>
          <button class="icon-btn" onClick={() => onSelect(null)} aria-label="Stop finding" title="Stop">
            ✕
          </button>
        </div>
      ) : (
        <p class="muted small find-hint">Find something you've discovered: pick it below and the arrow points the way from where you're looking.</p>
      )}
      <div class="find-groups">
        {groups.map(([kind, list]) => (
          <div class="find-group">
            <span class="find-kind">{KIND_LABEL[kind]}</span>
            {list.slice(0, kind === 'valuable' ? 8 : 12).map((t) => (
              <button class={`find-chip ${t.id === selected ? 'on' : ''}`} aria-pressed={t.id === selected} onClick={() => onSelect(t.id === selected ? null : t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p class="muted small">Nothing discovered yet.</p>}
      </div>
    </div>
  );
}
