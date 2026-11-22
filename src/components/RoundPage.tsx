import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { advise } from '../engine/advise';
import { useRound } from '../hooks';
import { applyLive, emptyMemo, type ApplyMemo } from '../live/apply';
import { useLive } from '../live/store';
import { defaultRound } from '../state/round';
import { MonsterCard } from './MonsterCard';
import { Collapsible } from './round/Collapsible';
import { CompanionPanel } from './round/CompanionPanel';
import { RoundBar } from './round/RoundBar';
import { SeenMonsters } from './round/SeenMonsters';
import { ThreatCard } from './round/ThreatCard';
import { RoundMemory } from './RoundMemory';
import { SpawnCheckPanel } from './SpawnCheckPanel';
import { SevIcon } from './ui';

const MEMO_KEY = 'repo-field-guide:live-memo:v1';

function loadMemo(): ApplyMemo {
  try {
    return { ...emptyMemo(), ...JSON.parse(sessionStorage.getItem(MEMO_KEY) ?? '{}') };
  } catch {
    return emptyMemo();
  }
}

/** Round page, "Focus view": one column, the essentials first, details folded away. */
export function RoundPage() {
  const [state, update, replace] = useRound();
  const advice = useMemo(() => advise(state), [state]);
  const snap = useLive();

  // ---- optional game companion: merge its data in, never take over
  const memo = useRef<ApplyMemo>(loadMemo());
  const [liveInfo, setLiveInfo] = useState({ unknown: [] as string[], respawn: {} as Record<string, number>, map: false, level: false, monsters: [] as string[] });
  useEffect(() => {
    if (!snap.data) return;
    const r = applyLive(state, snap.data, memo.current);
    memo.current = r.memo;
    try {
      sessionStorage.setItem(MEMO_KEY, JSON.stringify(r.memo));
    } catch {
      /* ignore */
    }
    if (JSON.stringify(r.state) !== JSON.stringify(state)) replace(r.state);
    setLiveInfo((prev) => ({
      unknown: r.unknown,
      respawn: r.respawn,
      map: r.fromGame.map || (prev.map && !r.fromGame.level),
      level: r.fromGame.level || prev.level,
      monsters: [...new Set([...(r.fromGame.level ? [] : prev.monsters), ...r.fromGame.monsters])],
    }));
    // Only react to new game data, not to our own state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.data]);

  const { map, phase, combos, monsters, modifiers } = advice;
  const memoryBullets = modifiers.filter((m) => m.severity !== 'danger');
  const memFilled =
    [state.memory.teamSize, state.memory.alive, state.memory.health, state.memory.quotaPct].filter((v) => v != null).length +
    (state.memory.items.length ? 1 : 0);

  return (
    <div class="focus">
      <RoundBar
        state={state}
        update={update}
        live={snap}
        fromGame={{ map: liveInfo.map, level: liveInfo.level }}
        onReset={() => {
          if (confirm('Clear the whole round, including the optional memory?')) replace(defaultRound());
        }}
      />

      <ThreatCard advice={advice} />

      <SeenMonsters state={state} update={update} fromGame={liveInfo.monsters} respawn={liveInfo.respawn} unknown={liveInfo.unknown} />

      <Collapsible id="playbook" title="Monster playbook" badge={monsters.length || undefined} defaultOpen>
        {monsters.length === 0 ? (
          <p class="muted small">Add monsters you've seen to get their rules here.</p>
        ) : (
          <div class="cards">
            {monsters.map((ma, i) => (
              <MonsterCard
                key={ma.monster.id}
                monster={ma.monster}
                spotted={ma.spotted}
                usableItems={ma.usableItems}
                noAnswer={ma.noAnswer}
                defaultOpen={i === 0 && !ma.spotted.killed}
              />
            ))}
          </div>
        )}
      </Collapsible>

      {combos.length > 0 && (
        <Collapsible id="combos" title="Dangerous combos" badge={combos.length} tone={combos.some((c) => c.severity === 'danger') ? 'danger' : 'warn'} defaultOpen>
          <ul class="bullets">
            {combos.map((c) => (
              <li class={`bullet bullet-${c.severity}`}>
                <SevIcon severity={c.severity} />
                <span>
                  <strong>{c.title}.</strong> {c.text}
                </span>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      <Collapsible id="map" title={map ? `${map.emoji} ${map.name} hazards` : 'Map hazards'} badge={map ? phase : undefined}>
        {!map ? (
          <p class="muted small">Pick the map in the bar above.</p>
        ) : (
          <>
            <p class="muted">{map.summary}</p>
            <ul class="bullets">
              {map.hazards[phase].map((h) => (
                <li class={`bullet bullet-${phase === 'early' ? 'info' : 'warn'}`}>
                  <SevIcon severity={phase === 'early' ? 'info' : 'warn'} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <dl class="facts">
              <dt>Light</dt>
              <dd>{map.lighting}</dd>
              <dt>Hiding</dt>
              <dd>{map.hiding}</dd>
            </dl>
            <ul class="tips">
              {map.tips.map((t) => (
                <li>💡 {t}</li>
              ))}
            </ul>
          </>
        )}
      </Collapsible>

      <Collapsible id="spawns" title="What's still out there?">
        <SpawnCheckPanel state={state} bare />
      </Collapsible>

      <Collapsible id="memory" title="Round memory" badge={memFilled ? `${memFilled} set` : 'optional'}>
        {memoryBullets.length > 0 && (
          <ul class="bullets" style={{ marginBottom: '12px' }}>
            {memoryBullets.map((b) => (
              <li class={`bullet bullet-${b.severity}`}>
                <SevIcon severity={b.severity} />
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        )}
        <RoundMemory state={state} update={update} bare />
      </Collapsible>

      <Collapsible id="companion" title="Game companion" badge={snap.enabled ? (snap.status === 'live' ? '🟢 live' : '⚪ on') : 'optional'}>
        <CompanionPanel snap={snap} />
      </Collapsible>
    </div>
  );
}
