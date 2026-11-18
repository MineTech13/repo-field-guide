import type { MonsterTag } from '../../data/types';
import type { ComboHit, RuleContext } from '../types';

interface ComboRule {
  id: string;
  severity: ComboHit['severity'];
  title: string;
  test: (ctx: RuleContext) => boolean;
  text: (ctx: RuleContext) => string;
}

const namesWithTag = (ctx: RuleContext, tag: MonsterTag, exclude: string[] = []) =>
  ctx.active.filter((m) => m.tags.includes(tag) && !exclude.includes(m.id)).map((m) => m.name);

const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const anyOf = (ctx: RuleContext, ids: string[]) => ids.some((id) => ctx.has(id));

/**
 * Dangerous combinations. Order matters only for display (danger first is
 * handled by the engine). Keep texts short and actionable.
 */
export const COMBO_RULES: ComboRule[] = [
  {
    id: 'huntsman-noise',
    severity: 'danger',
    title: 'Noise draws Huntsman fire',
    test: (ctx) => ctx.has('huntsman') && namesWithTag(ctx, 'noisy').length > 0,
    text: (ctx) =>
      `${list(namesWithTag(ctx, 'noisy'))} make${namesWithTag(ctx, 'noisy').length === 1 ? 's' : ''} noise, and the blind Huntsman shoots at any sound. Deal with them far from its patrol route.`,
  },
  {
    id: 'silent-team',
    severity: 'danger',
    title: 'Full silence mode',
    test: (ctx) => ctx.has('huntsman') && ctx.has('robe'),
    text: () => 'Huntsman AND Robe both punish noise. Crouch-walk, mute voice chat near them, and put loot down gently.',
  },
  {
    id: 'forced-look-robe',
    severity: 'danger',
    title: 'Your camera might betray you',
    test: (ctx) => ctx.has('robe') && namesWithTag(ctx, 'forces-look').length > 0,
    text: (ctx) =>
      `${list(namesWithTag(ctx, 'forces-look'))} can drag your view around, possibly onto the Robe. Avoid ${namesWithTag(ctx, 'forces-look').length === 1 ? 'its' : 'their'} rooms while the Robe roams.`,
  },
  {
    id: 'hide-conflict',
    severity: 'danger',
    title: 'Hiding won\'t save you',
    test: (ctx) => ctx.has('trudge') && anyOf(ctx, ['robe', 'loom']),
    text: () =>
      'The Trudge pulls players out of hiding spots, and the other heavy hitter calls for hiding or keeping still. Leave the whole wing instead of hiding.',
  },
  {
    id: 'hidden-dropoff',
    severity: 'danger',
    title: 'Hidden can drop you into a big monster',
    test: (ctx) => ctx.has('hidden') && ctx.active.some((m) => m.tier === 3),
    text: (ctx) =>
      `The Hidden carries players off, sometimes into a monster's nest, and there's a ${list(ctx.active.filter((m) => m.tier === 3).map((m) => m.name))} around. Use the buddy system so someone can grab you back.`,
  },
  {
    id: 'displacers-near-edges',
    severity: 'danger',
    title: 'Pushes, pulls and throws near edges',
    test: (ctx) =>
      namesWithTag(ctx, 'displacer').length > 0 &&
      (ctx.mapHas('lava') || (ctx.mapHas('pits') && ctx.phase !== 'early')),
    text: (ctx) =>
      `${list(namesWithTag(ctx, 'displacer'))} can push, pull or throw you, and this map has ${ctx.mapHas('lava') ? 'lava' : 'pits'}. Never engage near a ledge. Pull fights into flat rooms.`,
  },
  {
    id: 'headman-dark-map',
    severity: 'warn',
    title: 'Dark map + Headman',
    test: (ctx) => ctx.has('headman') && ctx.mapHas('dark'),
    text: () =>
      'You need your flashlight on this map, but light makes the Headman charge. Point it at the floor and listen for clicking teeth.',
  },
  {
    id: 'oogly-dark-map',
    severity: 'warn',
    title: 'Oogly\'s spotlight in the dark',
    test: (ctx) => ctx.has('oogly') && ctx.mapHas('dark'),
    text: () => 'On a dark map, a sudden bright spotlight is the Oogly. Get out of the light immediately.',
  },
  {
    id: 'elsa-crossfire',
    severity: 'warn',
    title: 'Keep fights away from Elsa',
    test: (ctx) => ctx.has('elsa') && ctx.active.some((m) => m.id !== 'elsa' && !m.tags.includes('passive')),
    text: () => 'If another monster (or a stray swing) hurts Elsa, she transforms. Lead other monsters away from the dog.',
  },
  {
    id: 'loot-under-siege',
    severity: 'warn',
    title: 'Your loot is the target',
    test: (ctx) => namesWithTag(ctx, 'loot-breaker').length >= 2,
    text: (ctx) =>
      `${list(namesWithTag(ctx, 'loot-breaker'))} all wreck or steal valuables. Extract in small batches and keep one player guarding the cart.`,
  },
  {
    id: 'grabbers-solo',
    severity: 'warn',
    title: 'Grabbers: never go alone',
    test: (ctx) => namesWithTag(ctx, 'grabber').length >= 2,
    text: (ctx) =>
      `${list(namesWithTag(ctx, 'grabber'))} pin or carry players. A teammate nearby can pull you free. Alone, you're stuck.`,
  },
  {
    id: 'pony-ceilings',
    severity: 'warn',
    title: 'Look up',
    test: (ctx) => namesWithTag(ctx, 'ceiling').length >= 2 || (ctx.has('pony') && ctx.mapHas('vertical')),
    text: (ctx) =>
      `${list(namesWithTag(ctx, 'ceiling'))} attack${namesWithTag(ctx, 'ceiling').length === 1 ? 's' : ''} from above. Check the ceiling when you enter tall rooms.`,
  },
  {
    id: 'banger-disposal',
    severity: 'warn',
    title: 'Free Banger disposal',
    test: (ctx) => ctx.has('banger') && (ctx.mapHas('pits') || ctx.mapHas('lava') || ctx.mapHas('water')),
    text: () => 'This map has pits, lava or water. Grab Bangers and throw them in before the fuse runs out, or throw them at a big monster.',
  },
  {
    id: 'spewer-clown',
    severity: 'warn',
    title: 'Use the Spewer',
    test: (ctx) => ctx.has('spewer') && ctx.has('clown'),
    text: () => 'Spewer vomit damages monsters: 2–3 vomits can kill a Clown. A latched player can aim at it, carefully.',
  },
  {
    id: 'clump-gas',
    severity: 'warn',
    title: 'Don\'t clump up',
    test: (ctx) => ctx.has('cleanup-crew') && (ctx.has('mentalist') || ctx.has('trudge') || namesWithTag(ctx, 'group').length > 0),
    text: () => 'Cleanup Crew gas and area attacks punish groups standing together. Spread out by a few meters while still covering each other.',
  },
  {
    id: 'heavy-hitters',
    severity: 'danger',
    title: 'Multiple heavy hitters',
    test: (ctx) => ctx.active.filter((m) => m.threat === 'lethal').length >= 2,
    text: (ctx) =>
      `${list(ctx.active.filter((m) => m.threat === 'lethal').map((m) => m.name))} can one-shot. Take only high-value loot and keep your extraction route clear.`,
  },
];

export function findCombos(ctx: RuleContext): ComboHit[] {
  return COMBO_RULES.filter((r) => r.test(ctx)).map((r) => ({
    id: r.id,
    severity: r.severity,
    title: r.title,
    text: r.text(ctx),
  }));
}
