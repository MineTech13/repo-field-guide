import { floorText, headingTo, steerPoint, turnText, type NavTarget } from '../../engine/navigate';
import type { Route } from '../../engine/pathfind';
import type { Vec3 } from '../../live/schema';

const KIND_LABEL: Record<NavTarget['kind'], string> = {
  extraction: 'Extractions',
  truck: 'Truck',
  mate: 'Team',
  head: 'Heads',
  valuable: 'Valuables',
  monster: 'Monsters',
  ping: 'Pings',
};

/** Pick something you've discovered; a compass points to it from where you're looking. */
export function FindPanel({
  targets,
  selected,
  onSelect,
  me,
  yaw,
  route,
  hasTiles,
}: {
  targets: NavTarget[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  me?: Vec3;
  yaw?: number;
  route?: Route | null;
  hasTiles?: boolean;
}) {
  const target = targets.find((t) => t.id === selected) ?? null;
  // With a route, point along it (round the next corner), not straight through walls.
  const aim = target && me ? (route ? steerPoint(me, route.points) : target.at) : null;
  const h = aim && me ? headingTo(me, yaw ?? 0, aim) : null;
  const straight = target && me ? headingTo(me, yaw ?? 0, target.at) : null;
  const floor = straight ? floorText(straight.dy) : null;
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
            <span class="find-dist">{route ? `${route.length} m walk` : `${straight!.distance} m`}</span>
            <span>
              {route ? `Go ${turnText(h.turn)}` : turnText(h.turn)}
              {floor && <strong class="find-floor"> · {floor}</strong>}
              {route && route.floorChanges > 0 && <span class="muted"> · take the stairs</span>}
            </span>
            <span class="muted small">
              {route?.partial
                ? 'Route to the edge of what’s explored, then straight on: the way there isn’t explored yet.'
                : route
                  ? 'Route over the explored map, through doors and up/down stairs.'
                  : hasTiles
                    ? 'No known way there through explored rooms yet: straight line shown.'
                    : 'Straight line, walls not counted.'}
            </span>
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
