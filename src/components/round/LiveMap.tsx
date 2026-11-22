import { MONSTERS } from '../../data';
import { dollarsK, type ExtractionPlan } from '../../engine/extraction';
import type { GameStateV1, Vec3 } from '../../live/schema';

const monsterByKey = new Map(MONSTERS.map((m) => [m.gameKey, m]));

/**
 * Top-down map from the companion: explored rooms, found extraction points, discovered
 * valuables, where you last saw each monster, and found heads. Other floors are faded.
 * Game coordinates: x = east, z = north, y = up. Units are metres.
 */
export function LiveMap({
  live,
  plan,
  radius,
  minimap,
}: {
  live: GameStateV1;
  plan: ExtractionPlan;
  /** Minimap: metres shown around you (null/undefined = whole explored map). */
  radius?: number | null;
  /** Round minimap look, no caption. */
  minimap?: boolean;
}) {
  const L = live.layout;
  if (!L) return null;
  const rooms = L.rooms ?? [];
  const me = L.me;
  const floorY = me?.[1] ?? null;
  const sameFloor = (y: number, halfHeight = 2.5) => floorY == null || Math.abs(y - floorY) <= Math.max(2.5, halfHeight);

  // Bounds over everything we draw.
  const xs: number[] = [];
  const zs: number[] = [];
  for (const r of rooms) {
    xs.push(r[0] - r[3] / 2, r[0] + r[3] / 2);
    zs.push(r[2] - r[5] / 2, r[2] + r[5] / 2);
  }
  const marks: Vec3[] = [...(me ? [me] : []), ...(L.extraction?.points ?? []).map((p) => p.at), ...(L.valuables ?? []).map((v) => v.at), ...(L.monsters ?? []).map((m) => m.at)];
  for (const m of marks) {
    xs.push(m[0]);
    zs.push(m[2]);
  }
  if (!xs.length) return <p class="muted small">Nothing explored yet. The map fills in as you explore.</p>;
  const pad = 6;
  let minX = Math.min(...xs) - pad;
  let maxX = Math.max(...xs) + pad;
  let minZ = Math.min(...zs) - pad;
  let maxZ = Math.max(...zs) + pad;
  if (radius && me) {
    minX = me[0] - radius;
    maxX = me[0] + radius;
    minZ = me[2] - radius;
    maxZ = me[2] + radius;
  } else if (minimap) {
    // Whole map in a square frame: centre it.
    const size = Math.max(maxX - minX, maxZ - minZ);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    minX = cx - size / 2;
    maxX = cx + size / 2;
    minZ = cz - size / 2;
    maxZ = cz + size / 2;
  }
  const w = Math.max(20, maxX - minX);
  const h = Math.max(20, maxZ - minZ);
  const unit = Math.max(w, h) / 100; // marker size scales with the map
  const X = (v: Vec3 | number) => (typeof v === 'number' ? v : v[0]);
  const Y = (v: Vec3) => -v[2];
  const fade = (y: number) => (sameFloor(y) ? 1 : 0.3);

  const heads = (live.team ?? []).filter((p) => p.dead && p.head && !p.isLocal);

  return (
    <figure class={`live-map ${minimap ? 'minimap' : ''}`}>
      <svg viewBox={`${minX} ${-maxZ} ${w} ${h}`} role="img" aria-label="Map of what you've explored">
        {rooms.map((r) => (
          <rect class="lm-room" x={r[0] - r[3] / 2} y={-(r[2] + r[5] / 2)} width={r[3]} height={r[5]} opacity={sameFloor(r[1], r[4] / 2) ? 1 : 0.25} vector-effect="non-scaling-stroke" />
        ))}

        {/* planned routes: big items to their extraction */}
        {plan.points.map((p) =>
          p.items.slice(0, 8).map((it) => <line class="lm-route" x1={X(it.at)} y1={Y(it.at)} x2={X(p.at)} y2={Y(p.at)} vector-effect="non-scaling-stroke" opacity={fade(it.at[1]) * 0.8} />),
        )}

        {(L.valuables ?? []).map((v) => {
          const r = unit * (0.6 + Math.sqrt(v.value) / 80);
          return (
            <circle class={`lm-val ${v.inHaul ? 'in-haul' : ''}`} cx={X(v.at)} cy={Y(v.at)} r={r} opacity={fade(v.at[1])}>
              <title>
                {v.name} · {dollarsK(v.value)}
                {v.size ? ` · ${v.size}` : ''}
                {v.inHaul ? ' · in extraction' : ''}
              </title>
            </circle>
          );
        })}

        {plan.points.map((p) => (
          <g opacity={fade(p.at[1])}>
            <rect
              class={`lm-ext ${p.current ? 'current' : ''} ${p.done ? 'done' : ''}`}
              x={X(p.at) - unit * 2}
              y={Y(p.at) - unit * 2}
              width={unit * 4}
              height={unit * 4}
              rx={unit * 0.6}
              vector-effect="non-scaling-stroke"
            />
            <text class="lm-label" x={X(p.at)} y={Y(p.at) + unit * 0.9} font-size={unit * 2.4} text-anchor="middle">
              E{p.index + 1}
            </text>
            <title>
              Extraction {p.index + 1}
              {p.done ? ' · done' : p.current ? ' · active' : ''} · planned {dollarsK(p.planned)}
              {p.goal ? ` of ${dollarsK(p.goal)}` : ''}
            </title>
          </g>
        ))}

        {(L.monsters ?? []).map((m) => {
          const info = m.key ? monsterByKey.get(m.key) : undefined;
          return (
            <text x={X(m.at)} y={Y(m.at)} font-size={unit * 4} text-anchor="middle" dominant-baseline="central" opacity={m.killed ? 0.35 : fade(m.at[1])}>
              {info?.emoji ?? '❓'}
              <title>
                {info?.name ?? m.name ?? 'Unknown monster'} · last seen {fmtAgo(m.agoSec)}
                {m.killed ? ' · killed' : ''}
              </title>
            </text>
          );
        })}

        {heads.map((p) => (
          <text x={X(p.head!)} y={Y(p.head!)} font-size={unit * 3.6} text-anchor="middle" dominant-baseline="central" opacity={fade(p.head![1])}>
            💀
            <title>
              {p.name}'s head{p.headIn === 'truck' ? ' · in the truck' : p.headIn === 'extraction' ? ' · in an extraction' : ''}
            </title>
          </text>
        ))}

        {me && (
          <g transform={`translate(${X(me)} ${Y(me)}) rotate(${L.yaw ?? 0})`}>
            <polygon class="lm-me" points={`0,${-unit * 3} ${unit * 2},${unit * 2} 0,${unit * 1} ${-unit * 2},${unit * 2}`} vector-effect="non-scaling-stroke" />
            <title>You</title>
          </g>
        )}
      </svg>
      {!minimap && (
        <figcaption class="muted small">▲ you · ■ extraction · ● discovered valuable (bigger = more $) · dashed line = suggested route · faded = other floor. Only what's been discovered.</figcaption>
      )}
    </figure>
  );
}

function fmtAgo(sec?: number): string {
  if (sec == null) return 'earlier';
  if (sec < 60) return `${Math.round(sec)} s ago`;
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} ago`;
}
