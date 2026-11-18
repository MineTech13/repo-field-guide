import { monsterById } from '../../data';
import type { Bullet, RuleContext } from '../types';

/** True when the user filled in at least one field of the optional memory panel. */
export function hasMemory(ctx: RuleContext): boolean {
  const m = ctx.state.memory;
  return m.teamSize != null || m.alive != null || m.health != null || m.quotaPct != null || m.items.length > 0;
}

/** Advice that depends on the optional round memory (team / quota / items). */
export function memoryModifiers(ctx: RuleContext): Bullet[] {
  const out: Bullet[] = [];
  const { teamSize, alive, health, quotaPct } = ctx.state.memory;

  if (alive != null && teamSize != null && teamSize > 1) {
    if (alive <= 1) {
      out.push({
        severity: 'danger',
        from: 'memory',
        text: 'You\'re the last one standing. Avoid every fight, revive or recover heads if it\'s safe, and extract with what you have.',
      });
    } else if (alive < teamSize) {
      out.push({
        severity: 'warn',
        from: 'memory',
        text: `${teamSize - alive} down. Recover heads before monsters (especially Head Grab) get to them, and regroup before you push further.`,
      });
    }
  }
  if (alive != null && alive <= 0) {
    out.length = 0;
    out.push({ severity: 'danger', from: 'memory', text: 'Team wipe: nobody is alive. Next round, note what killed you.' });
  }

  if (health === 'critical') {
    out.push({
      severity: 'danger',
      from: 'memory',
      text: 'Critical health: one more hit is probably death. Heal first, avoid Gambit and Tick, and hand risky carries to a healthier teammate.',
    });
  } else if (health === 'hurt') {
    out.push({
      severity: 'warn',
      from: 'memory',
      text: 'Team is hurt. Don\'t take optional fights. A Tick kill leaves a healing cloud, and Gambit\'s wheel is a gamble you can skip.',
    });
  }
  if (health && health !== 'full' && ctx.has('gambit')) {
    out.push({ severity: 'warn', from: 'gambit', text: 'Gambit is around and you\'re hurt. A red or black spin could kill you or leave you at 1 HP. Avoid it.' });
  }

  if (quotaPct != null) {
    if (quotaPct >= 100) {
      out.push({ severity: 'info', from: 'memory', text: 'Quota is met. Everything extra is bonus surplus, so don\'t die for it.' });
    } else if (quotaPct >= 75) {
      out.push({ severity: 'info', from: 'memory', text: 'Almost there. One or two good valuables should finish the quota.' });
    } else if (quotaPct < 30 && ctx.phase !== 'early') {
      out.push({ severity: 'warn', from: 'memory', text: 'Quota is far off. Prioritise big-value items and don\'t waste time fighting for low-value orbs.' });
    }
  }

  // Killed monsters respawn. Community-tested, roughly 15 min early in a level.
  for (const s of ctx.state.spotted) {
    if (s.killed) {
      out.push({
        severity: 'info',
        from: s.id,
        text: `${nameOf(s.id)} is down, but killed monsters respawn (community-tested: ~15 min, faster the longer you stay). Grab its orb!`,
      });
    }
  }

  if (ctx.state.level <= 1 && ctx.has('loom')) {
    out.push({ severity: 'info', from: 'loom', text: 'Guides say Loom doesn\'t spawn on level 1. Double-check what you saw.' });
  }

  return out;
}

function nameOf(id: string): string {
  return monsterById.get(id)?.name ?? id;
}
