import { THREAT_ORDER, itemById, mapById, monsterById } from '../data';
import type { Monster, MonsterTag, Threat } from '../data/types';
import { findCombos } from './rules/combos';
import { hasMemory, memoryModifiers } from './rules/optional';
import { PHASE_MULTIPLIER, phaseFor } from './rules/phase';
import type { Advice, Bullet, MonsterAdvice, RoundState, RuleContext, Severity, ThreatLabel } from './types';

export const THREAT_WEIGHT: Record<Threat, number> = { low: 4, medium: 8, high: 14, lethal: 19 };
const MAX_WATCH_OUT = 5;

export function buildContext(state: RoundState): RuleContext {
  const map = state.mapId ? mapById.get(state.mapId) ?? null : null;
  const phase = phaseFor(state.level);
  const active: Monster[] = [];
  for (const s of state.spotted) {
    const m = monsterById.get(s.id);
    if (m && !s.killed && !active.includes(m)) active.push(m);
  }
  const ids = new Set(active.map((m) => m.id));
  const tags = new Set<MonsterTag>(active.flatMap((m) => m.tags));
  return {
    state,
    phase,
    map,
    active,
    ids,
    tags,
    has: (id) => ids.has(id),
    hasTag: (t) => tags.has(t),
    mapHas: (t) => !!map?.tags.includes(t),
  };
}

export function labelFor(score: number): ThreatLabel {
  if (score <= 20) return 'Calm';
  if (score <= 45) return 'Tense';
  if (score <= 70) return 'Dangerous';
  return 'Critical';
}

const SEVERITY_RANK: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };

export function advise(state: RoundState): Advice {
  const ctx = buildContext(state);
  const { phase, map } = ctx;

  // ---- monsters, sorted most dangerous first (seen before heard, alive before killed)
  const monsters: MonsterAdvice[] = state.spotted
    .map((spotted) => ({ spotted, monster: monsterById.get(spotted.id) }))
    .filter((x): x is { spotted: typeof x.spotted; monster: Monster } => !!x.monster)
    .map(({ spotted, monster }) => {
      const usableItems = monster.counter.items
        .filter((id) => state.memory.items.includes(id))
        .map((id) => itemById.get(id)!)
        .filter(Boolean);
      return {
        monster,
        spotted,
        usableItems,
        noAnswer: state.memory.items.length > 0 && monster.tier === 3 && usableItems.length === 0,
      };
    })
    .sort(
      (a, b) =>
        Number(a.spotted.killed) - Number(b.spotted.killed) ||
        THREAT_ORDER[b.monster.threat] - THREAT_ORDER[a.monster.threat] ||
        b.monster.tier - a.monster.tier ||
        Number(a.spotted.how === 'heard') - Number(b.spotted.how === 'heard'),
    );

  // ---- combos
  const combos = findCombos(ctx).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  // ---- score
  let raw = 0;
  for (const { monster, spotted } of monsters) {
    let w = THREAT_WEIGHT[monster.threat];
    if (spotted.how === 'heard') w *= 0.85;
    if (spotted.killed) w *= 0.25;
    raw += w;
  }
  raw *= PHASE_MULTIPLIER[phase];
  if (map) raw += map.hazardWeight[phase];
  for (const c of combos) raw += c.severity === 'danger' ? 4 : 2;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const label = labelFor(score);

  // ---- optional memory modifiers
  const modifiers = memoryModifiers(ctx);

  // ---- watch-out bullets: danger combos → golden rules → map → warn combos
  const watchOut: Bullet[] = [];
  for (const c of combos.filter((c) => c.severity === 'danger')) {
    watchOut.push({ severity: 'danger', from: `combo:${c.id}`, text: `${c.title}: ${c.text}` });
  }
  for (const { monster, spotted } of monsters) {
    if (spotted.killed) continue;
    const severity: Severity = THREAT_ORDER[monster.threat] >= 2 ? 'danger' : monster.tags.includes('passive') ? 'info' : 'warn';
    watchOut.push({ severity, from: monster.id, text: `${monster.emoji} ${monster.name}: ${monster.golden}` });
  }
  if (map) {
    const hazard = map.hazards[phase][0];
    if (hazard) watchOut.push({ severity: phase === 'late' ? 'warn' : 'info', from: 'map', text: `${map.emoji} ${hazard}` });
  }
  for (const c of combos.filter((c) => c.severity === 'warn')) {
    watchOut.push({ severity: 'warn', from: `combo:${c.id}`, text: `${c.title}: ${c.text}` });
  }
  for (const m of modifiers.filter((m) => m.severity === 'danger')) watchOut.unshift(m);
  if (monsters.length === 0) {
    watchOut.push({
      severity: 'info',
      from: 'hint',
      text: 'No monsters logged yet. Listen for tells (laughing, breathing, dragging mace, bells) and add them as you spot them.',
    });
  }
  const seen = new Set<string>();
  const topWatchOut = watchOut
    .filter((b) => (seen.has(b.text) ? false : (seen.add(b.text), true)))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, MAX_WATCH_OUT);

  return {
    score,
    label,
    phase,
    map,
    call: overallCall(score, ctx),
    watchOut: topWatchOut,
    combos,
    monsters,
    modifiers,
  };
}

function overallCall(score: number, ctx: RuleContext): { title: string; text: string } {
  const { quotaPct, alive, teamSize } = ctx.state.memory;
  if (alive != null && alive <= 0) return { title: 'Run over', text: 'Everyone is down. Reset and try a safer route next level.' };
  if (hasMemory(ctx) && quotaPct != null && quotaPct >= 100) {
    return score > 45
      ? { title: 'Extract now', text: 'Quota is met and the level is dangerous. Get to extraction and leave. Surplus isn\'t worth a wipe.' }
      : { title: 'Bonus time', text: 'Quota is met. Grab extra surplus nearby, but head for extraction at the first sign of trouble.' };
  }
  if (alive === 1 && teamSize != null && teamSize > 1) {
    return { title: 'Survive first', text: 'Last one alive. Move quietly, take safe valuables only, and extract.' };
  }
  if (score <= 20) return { title: 'Loot freely', text: 'Low threat right now. Sweep in pairs, call out tells, and build up the cart.' };
  if (score <= 45) return { title: 'Work carefully', text: 'Real threats around. Scout rooms before carrying loot through them and keep a clear route back.' };
  if (score <= 70) return { title: 'Pick your fights', text: 'Dangerous level. Go for high-value items, avoid the marked monsters, and extract in batches.' };
  return { title: 'Get out', text: 'Very dangerous. Extract what you have, stick together, and don\'t chase small loot.' };
}
