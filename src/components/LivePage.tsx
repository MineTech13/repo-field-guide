import { useMemo, useState } from 'preact/hooks';
import { advise } from '../engine/advise';
import { dollarsK, planExtraction } from '../engine/extraction';
import { navTargets } from '../engine/navigate';
import { buildGrid, findRoute } from '../engine/pathfind';
import { describePhase } from '../live/phase';
import { live as liveStore } from '../live/store';
import { useLiveRound } from '../live/useLiveRound';
import { CompanionPanel } from './round/CompanionPanel';
import { ExtractionPlanner } from './round/ExtractionPlanner';
import { FindPanel } from './round/FindPanel';
import { LiveMap } from './round/LiveMap';
import { DETECTION_TEXT, SevIcon, ThreatBadge } from './ui';

const ZOOM_KEY = 'repo-field-guide:live-zoom:v1';
const ZOOMS: { label: string; radius: number | null }[] = [
  { label: 'Near', radius: 25 },
  { label: 'Mid', radius: 50 },
  { label: 'Far', radius: 100 },
  { label: 'All', radius: null },
];

/**
 * Second-screen companion: everything you've discovered at a glance, with a minimap.
 * Needs the optional companion mod; without it, it explains how to connect.
 */
export function LivePage() {
  const { state, snap, liveInfo } = useLiveRound();
  const advice = useMemo(() => advise(state), [state]);
  const live = snap.data;
  const layout = live?.phase === 'level' ? live.layout : undefined;
  const plan = useMemo(() => planExtraction(layout), [layout]);
  const targets = useMemo(() => (live ? navTargets(live, plan) : []), [live, plan]);
  const [findId, setFindId] = useState<string | null>(null);
  const findTarget = targets.find((t) => t.id === findId) ?? null;
  // The walkable grid only changes when more of the map is explored.
  const tileSig = `${layout?.floors?.length ?? 0}|${layout?.walls?.length ?? 0}`;
  const grid = useMemo(() => (layout ? buildGrid(layout) : null), [tileSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = useMemo(() => (grid && findTarget && layout?.me ? findRoute(grid, layout.me, findTarget.at) : null), [grid, findTarget?.id, layout?.me?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [zoom, setZoom] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(ZOOM_KEY) ?? 1);
    } catch {
      return 1;
    }
  });
  const pickZoom = (i: number) => {
    setZoom(i);
    try {
      localStorage.setItem(ZOOM_KEY, String(i));
    } catch {
      /* ignore */
    }
  };

  if ((!snap.enabled && !snap.demo) || snap.status !== 'live' || !live) {
    return (
      <div class="live-page live-setup">
        <section class="panel">
          <h2>Live companion</h2>
          <p>
            Put this page on a second screen while you play. With the optional companion mod running, it shows what you've discovered: a minimap, monsters you've met, the extraction plan, your team
            and what to watch out for.
          </p>
          <p>
            <button class="btn primary" onClick={() => liveStore.startDemo()}>
              ▶ Try the demo
            </button>{' '}
            <span class="muted small">A made-up level, no game needed. Your own round isn't touched.</span>
          </p>
          <RecordingPicker />
          <CompanionPanel snap={snap} />
        </section>
      </div>
    );
  }

  const info = describePhase(live)!;
  const team = live.team ?? [];
  const me = live.me;
  const hpPct = me?.health != null && me.maxHealth ? Math.round((me.health / me.maxHealth) * 100) : null;
  const haul = live.haul;
  const quotaPct = haul?.goal ? Math.min(100, Math.round(((haul.current ?? 0) / haul.goal) * 100)) : null;
  const seenAgo = new Map((layout?.monsters ?? []).map((m) => [m.key, m.agoSec]));
  const valuables = layout?.valuables ?? [];

  return (
    <div class="live-page">
      {snap.demo && (
        <div class="demo-bar" role="status">
          <span>
            <span class="demo-tag">{snap.demoLabel === 'demo' ? 'DEMO' : 'REPLAY'}</span>{' '}
            {snap.demoLabel === 'demo' ? 'A made-up level to show what the Live page does with the companion mod. It loops every 2 minutes.' : `Playing back ${snap.demoLabel}. It loops.`}
          </span>
          <button class="btn" onClick={() => liveStore.stopDemo()}>
            Stop demo
          </button>
        </div>
      )}
      {/* ---- status strip ---- */}
      <header class="live-strip panel">
        <div class="ls-phase">
          <span class="ls-icon" aria-hidden="true">
            {info.icon}
          </span>
          <span>
            <strong>{info.title}</strong>
            <span class="muted"> · {info.detail}</span>
          </span>
        </div>
        {quotaPct != null && (
          <div class="ls-meter" title={`Haul ${dollarsK(haul?.current ?? 0)} of ${dollarsK(haul?.goal ?? 0)}`}>
            <span class="ls-label">Quota</span>
            <span class="ls-bar">
              <span style={{ width: `${quotaPct}%` }} class={quotaPct >= 100 ? 'full' : ''} />
            </span>
            <span class="ls-val">{quotaPct}%</span>
          </div>
        )}
        {hpPct != null && (
          <div class="ls-meter" title={`${me?.health} / ${me?.maxHealth} HP`}>
            <span class="ls-label">You</span>
            <span class="ls-bar hp">
              <span style={{ width: `${hpPct}%` }} class={hpPct >= 70 ? 'full' : hpPct >= 35 ? 'mid' : 'low'} />
            </span>
            <span class="ls-val">{me?.dead ? '💀' : `${me?.health} HP`}</span>
          </div>
        )}
        {team.length > 0 && (
          <div class="ls-team">
            {team.map((p) => (
              <span class={`ls-mate ${p.dead ? 'dead' : ''}`} title={p.dead ? `Down, head found${p.headIn === 'truck' ? ', in the truck' : ''}` : 'Alive (as far as you know)'}>
                {p.dead ? '💀' : '🙂'} {p.isLocal ? 'You' : p.name}
                {p.headIn === 'truck' ? ' 🚚' : ''}
              </span>
            ))}
          </div>
        )}
      </header>

      {live.phase !== 'level' ? (
        <section class="panel live-waiting">
          <div class="lw-icon" aria-hidden="true">
            {info.icon}
          </div>
          <h2>
            {info.title} <span class="muted">· {info.detail}</span>
          </h2>
          {live.phase === 'shop' ? (
            <p>
              <a class="btn primary" href="#/shop/advisor">
                Open the shop advisor
              </a>
            </p>
          ) : (
            <p class="muted">This page fills in when the next level starts. Below: what you met last level.</p>
          )}
          {advice.monsters.length > 0 && (
            <p class="small">
              Last level:{' '}
              {advice.monsters.map((m) => (
                <span class="chip">
                  {m.monster.emoji} {m.monster.name}
                </span>
              ))}
            </p>
          )}
        </section>
      ) : (
        <div class="live-grid">
          {/* ---- minimap ---- */}
          <section class="panel live-mapbox">
            <div class="lm-head">
              <h2>Map</h2>
              <span class="seg" role="group" aria-label="Zoom">
                {ZOOMS.map((z, i) => (
                  <button class={zoom === i ? 'on' : ''} aria-pressed={zoom === i} onClick={() => pickZoom(i)}>
                    {z.label}
                  </button>
                ))}
              </span>
            </div>
            {layout ? (
              <LiveMap live={live} plan={plan} radius={ZOOMS[zoom]?.radius} minimap target={findTarget?.at} route={route} />
            ) : (
              <p class="muted small">Turn on "Map and extraction planner" in the mod settings.</p>
            )}
            <p class="muted small lm-legend">▲ you · ■ extraction (number = planned order) · ● valuable · 🚚 truck · 💀 found head · faded = other floor · only what's been discovered</p>
          </section>

          <div class="live-side">
            {/* ---- watch out ---- */}
            <section class={`panel live-threat level-${advice.label.toLowerCase()}`}>
              <div class="lt-head">
                <strong class="threat-word">{advice.label}</strong>
                <span class="muted small">
                  {advice.call.title}. {advice.call.text}
                </span>
                <span class="threat-score">{advice.score}</span>
              </div>
              <ul class="bullets">
                {advice.watchOut.slice(0, 4).map((b) => (
                  <li class={`bullet bullet-${b.severity}`}>
                    <SevIcon severity={b.severity} />
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ---- find ---- */}
            {layout && (
              <section class="panel live-find">
                <h2>Find</h2>
                <FindPanel targets={targets} selected={findTarget ? findId : null} onSelect={setFindId} me={layout.me} yaw={layout.yaw} route={route} hasTiles={!!grid} />
              </section>
            )}

            {/* ---- monsters met ---- */}
            <section class="panel">
              <h2>Monsters met</h2>
              {advice.monsters.length === 0 && liveInfo.unknown.length === 0 && <p class="muted small">None yet. They appear once they've been on your screen.</p>}
              <ul class="live-monsters">
                {advice.monsters.map(({ monster: m, spotted }) => {
                  const ago = seenAgo.get(m.gameKey);
                  const back = liveInfo.respawn[m.id];
                  return (
                    <li class={spotted.killed ? 'killed' : ''}>
                      <span class="lmo-emoji" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <span class="lmo-main">
                        <span class="lmo-name">
                          <a href={`#/monsters/${m.id}`}>{m.name}</a> <ThreatBadge threat={m.threat} />
                          {spotted.killed && <span class="badge badge-dead">killed</span>}
                          {back != null && <span class="badge">back in {fmt(back)}</span>}
                          {ago != null && !spotted.killed && <span class="muted small"> · seen {fmt(ago)} ago</span>}
                        </span>
                        <span class="lmo-rule">{m.golden}</span>
                        <span class="lmo-tags">
                          {m.detection.map((d) => (
                            <span class="qtag qtag-detect">{DETECTION_TEXT[d]}</span>
                          ))}
                          {m.counter.stun != null && <span class={`qtag ${m.counter.stun ? 'qtag-good' : 'qtag-bad'}`}>{m.counter.stun ? '⚡ Stunnable' : '🚫 No stun'}</span>}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {liveInfo.unknown.map((n) => (
                  <li>
                    <span class="lmo-emoji">❓</span>
                    <span class="lmo-main">
                      <span class="lmo-name">{n}</span>
                      <span class="muted small">From another mod, not in the guide.</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ---- extraction ---- */}
            {layout && (
              <section class="panel">
                <h2>Extraction plan</h2>
                <ExtractionPlanner plan={plan} total={layout.extraction?.total} completed={layout.extraction?.completed} compact />
              </section>
            )}

            {/* ---- discovered ---- */}
            {layout && (
              <section class="panel">
                <h2>Discovered</h2>
                <dl class="live-stats">
                  <dt>Valuables</dt>
                  <dd>
                    {valuables.length} · {dollarsK(plan.discoveredValue)}
                  </dd>
                  <dt>Biggest</dt>
                  <dd>
                    {[...valuables]
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 3)
                      .map((v) => `${v.name} ${dollarsK(v.value)}`)
                      .join(', ') || '–'}
                  </dd>
                  <dt>In extraction</dt>
                  <dd>{dollarsK(plan.inHaul)}</dd>
                  <dt>Extractions</dt>
                  <dd>
                    {plan.points.length} of {layout.extraction?.total ?? '?'} found · {layout.extraction?.completed ?? 0} done
                  </dd>
                  <dt>Rooms explored</dt>
                  <dd>{layout.rooms?.length ?? 0}</dd>
                  <dt>Level</dt>
                  <dd>{monsterCount(state.spotted.length)}</dd>
                </dl>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

function monsterCount(n: number): string {
  return n === 0 ? 'no monsters met yet' : `${n} monster type${n === 1 ? '' : 's'} met`;
}

/** Load a recording from the mod's debug mode and play it back. Reads the file locally; nothing is uploaded. */
function RecordingPicker() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <p>
      <label class="btn">
        ▶ Play a recording…
        <input
          type="file"
          accept=".jsonl,.json,.txt"
          class="sr-only"
          onChange={async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
              const n = liveStore.playRecording(await file.text(), file.name);
              setMsg(`${n} frames loaded.`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Could not read that file.');
            }
          }}
        />
      </label>{' '}
      <span class="muted small">{msg ?? 'A .jsonl file from the mod\'s "Record sessions" debug setting (BepInEx/config/RepoFieldGuide/recordings).'}</span>
    </p>
  );
}
