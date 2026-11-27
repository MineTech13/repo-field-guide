import { useEffect, useRef, useState } from 'preact/hooks';
import { MONSTERS } from '../../data';
import { dollarsK, type ExtractionPlan } from '../../engine/extraction';
import { floorCorners, layerOf, wallSegment, type Route } from '../../engine/pathfind';
import type { GameStateV1, Vec3 } from '../../live/schema';

const PING_ICON: Record<string, string> = { Valuable: '💰', Item: '🔧', Location: '📍', Cosmetic: '🎩', Cart: '🛒' };

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
  target,
  route,
}: {
  live: GameStateV1;
  plan: ExtractionPlan;
  /** Minimap: metres shown around you (null/undefined = whole explored map). */
  radius?: number | null;
  /** Round minimap look, no caption. */
  minimap?: boolean;
  /** Something you're looking for: drawn with a line from you. */
  target?: Vec3 | null;
  /** Walking route to the target over the explored map. */
  route?: Route | null;
}) {
  // The minimap fills its box, so the view takes the box's shape (no letterboxing).
  const box = useRef<HTMLElement>(null);
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!minimap || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setAspect(Math.min(3, Math.max(1 / 3, r.width / r.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minimap]);

  const L = live.layout;
  if (!L) return null;
  const rooms = L.rooms ?? [];
  const me = L.me;
  const floorY = me?.[1] ?? null;
  const myLayer = me ? layerOf(me[1]) : null;
  const sameFloor = (y: number, halfHeight = 2.5) => floorY == null || Math.abs(y - floorY) <= Math.max(2.5, halfHeight);
  const floors = L.floors ?? [];
  const walls = L.walls ?? [];
  const tiles = floors.length > 0;
  const layerFade = (l: number) => (myLayer == null || l === myLayer ? 1 : 0.22);
  const pings = L.pings ?? [];

  // Bounds over everything we draw.
  const xs: number[] = [];
  const zs: number[] = [];
  if (tiles) {
    for (const f of floors)
      for (const [x, z] of floorCorners(f)) {
        xs.push(x);
        zs.push(z);
      }
  } else {
    for (const r of rooms) {
      xs.push(r[0] - r[3] / 2, r[0] + r[3] / 2);
      zs.push(r[2] - r[5] / 2, r[2] + r[5] / 2);
    }
  }
  const marks: Vec3[] = [
    ...(me ? [me] : []),
    ...(L.extraction?.points ?? []).map((p) => p.at),
    ...(L.truck ? [L.truck] : []),
    ...(L.valuables ?? []).map((v) => v.at),
    ...(L.monsters ?? []).map((m) => m.at),
    ...pings.map((p) => p.at),
  ];
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
  if (minimap) [minX, maxX, minZ, maxZ] = frameView([minX, maxX, minZ, maxZ], radius && me ? me : null, radius ?? null, aspect);
  const w = Math.max(20, maxX - minX);
  const h = Math.max(20, maxZ - minZ);
  const unit = Math.min(Math.max(w, h), 2.2 * Math.min(w, h)) / 100; // marker size scales with the map
  const X = (v: Vec3 | number) => (typeof v === 'number' ? v : v[0]);
  const Y = (v: Vec3) => -v[2];
  const fade = (y: number) => (sameFloor(y) ? 1 : 0.3);

  const heads = (live.team ?? []).filter((p) => p.dead && p.head); // yours too: you know where you died

  return (
    <figure class={`live-map ${minimap ? 'minimap' : ''}`} ref={box}>
      <svg viewBox={`${minX} ${-maxZ} ${w} ${h}`} role="img" aria-label="Map of what you've explored">
        {/* The in-game Tab map: floor tiles, walls, doors, stairs (explored rooms only). */}
        {tiles &&
          [...floors]
            .sort((a, b) => (a[2] === myLayer ? 1 : 0) - (b[2] === myLayer ? 1 : 0))
            .map((f) => (
              <polygon
                class={`lm-floor k${f[6]}`}
                points={floorCorners(f)
                  .map(([x, z]) => `${x},${-z}`)
                  .join(' ')}
                opacity={layerFade(f[2])}
              />
            ))}
        {tiles &&
          walls.map((w) => {
            const [x1, z1, x2, z2] = wallSegment(w);
            return <line class={`lm-wall k${w[5]}`} x1={x1} y1={-z1} x2={x2} y2={-z2} opacity={layerFade(w[2])} vector-effect="non-scaling-stroke" />;
          })}
        {!tiles &&
          rooms.map((r) => (
            <rect class="lm-room" x={r[0] - r[3] / 2} y={-(r[2] + r[5] / 2)} width={r[3]} height={r[5]} opacity={sameFloor(r[1], r[4] / 2) ? 1 : 0.25} vector-effect="non-scaling-stroke" />
          ))}

        {/* planned routes: big items to their extraction */}
        {plan.points.map((p) => p.big.map((it) => <line class="lm-route" x1={X(it.at)} y1={Y(it.at)} x2={X(p.at)} y2={Y(p.at)} vector-effect="non-scaling-stroke" opacity={fade(it.at[1]) * 0.8} />))}

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
              {p.done ? '✓' : p.order}
            </text>
            <title>
              Extraction #{p.order}
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
              {p.isLocal ? 'Your' : `${p.name}'s`} head{p.headIn === 'truck' ? ' · in the truck' : p.headIn === 'extraction' ? ' · in an extraction' : ''}
            </title>
          </text>
        ))}

        {(live.team ?? [])
          .filter((p) => !p.isLocal && !p.dead && p.lastSeen)
          .map((p) => (
            <g class="lm-mate" opacity={Math.max(0.35, 1 - (p.lastSeenAgo ?? 0) / 120) * fade(p.lastSeen![1])}>
              <circle cx={X(p.lastSeen!)} cy={Y(p.lastSeen!)} r={unit * 1.8} vector-effect="non-scaling-stroke" />
              <text x={X(p.lastSeen!)} y={Y(p.lastSeen!) - unit * 2.6} font-size={unit * 2.2} text-anchor="middle">
                {p.name}
              </text>
              <title>
                {p.name} · {p.lastSeenHow === 'live' ? 'here now (spectating)' : `${p.lastSeenHow === 'ping' ? 'pinged from here' : 'last seen here'} ${fmtAgo(p.lastSeenAgo)}`}
              </title>
            </g>
          ))}

        {L.truck && (
          <text x={X(L.truck)} y={Y(L.truck)} font-size={unit * 4} text-anchor="middle" dominant-baseline="central" opacity={fade(L.truck[1])}>
            🚚
            <title>Truck</title>
          </text>
        )}

        {pings.map((p) => (
          <g class={`lm-ping k-${p.kind.toLowerCase()}`} opacity={Math.max(0.35, 1 - (p.agoSec ?? 0) / 90) * fade(p.at[1])}>
            <circle cx={X(p.at)} cy={Y(p.at)} r={unit * 2.6} vector-effect="non-scaling-stroke" />
            <text x={X(p.at)} y={Y(p.at)} font-size={unit * 2.8} text-anchor="middle" dominant-baseline="central">
              {p.kind === 'Enemy' ? (p.name ? (MONSTERS.find((m) => m.name === p.name)?.emoji ?? '👾') : '❗') : (PING_ICON[p.kind] ?? '📍')}
            </text>
            <title>
              {p.kind === 'Enemy'
                ? p.name
                  ? `${p.name} (pinged)`
                  : 'Pinged enemy, unknown which (needs Ping Info)'
                : `Pinged ${p.kind.toLowerCase()}${p.name ? `: ${p.name}` : ''}${p.value ? ` ${dollarsK(p.value)}` : ''}`}
              {p.by ? ` · by ${p.by}` : ''} · {fmtAgo(p.agoSec)}
            </title>
          </g>
        ))}

        {target && me && (
          <g class="lm-target">
            {route ? (
              <polyline points={route.points.map((p) => `${X(p)},${Y(p)}`).join(' ')} vector-effect="non-scaling-stroke" />
            ) : (
              <line x1={X(me)} y1={Y(me)} x2={X(target)} y2={Y(target)} vector-effect="non-scaling-stroke" class="straight" />
            )}
            <circle cx={X(target)} cy={Y(target)} r={unit * 4} vector-effect="non-scaling-stroke" />
          </g>
        )}

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

/**
 * Minimap camera, shaped like its box (no wasted bands at the sides). Zoomed: `radius` metres
 * around you on the box's shorter side, more on the longer one. With no radius: the whole
 * explored map.
 */
export function frameView(content: [number, number, number, number], me: Vec3 | null, radius: number | null, aspect: number): [number, number, number, number] {
  const [cMinX, cMaxX, cMinZ, cMaxZ] = content;
  let wW: number;
  let wH: number;
  if (radius && me) {
    wW = 2 * radius * Math.max(1, aspect);
    wH = 2 * radius * Math.max(1, 1 / aspect);
  } else {
    wW = Math.max(20, cMaxX - cMinX);
    wH = Math.max(20, cMaxZ - cMinZ);
    if (wW / wH < aspect) wW = wH * aspect;
    else wH = wW / aspect;
  }
  // Zoomed: centred on you. All: centred on the explored map.
  const cx = radius && me ? me[0] : (cMinX + cMaxX) / 2;
  const cz = radius && me ? me[2] : (cMinZ + cMaxZ) / 2;
  return [cx - wW / 2, cx + wW / 2, cz - wH / 2, cz + wH / 2];
}
