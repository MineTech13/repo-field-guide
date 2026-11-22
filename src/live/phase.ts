import { matchMap } from './apply';
import type { GameStateV1 } from './schema';
import { mapById } from '../data';

export interface PhaseInfo {
  icon: string;
  title: string;
  detail: string;
  /** The page that fits this phase. */
  href: string;
  /** True while waiting for something to start (menus, lobby, truck). */
  waiting: boolean;
}

const players = (n?: number) => (n && n > 0 ? `${n} player${n === 1 ? '' : 's'}` : '');

/** Human-readable description of what the game is doing right now. */
export function describePhase(s: GameStateV1 | null): PhaseInfo | null {
  if (!s) return null;
  const level = typeof s.levelsCompleted === 'number' ? s.levelsCompleted + 1 : null;
  switch (s.phase) {
    case 'level': {
      const map = mapById.get(matchMap(s.map) ?? '')?.name ?? s.map ?? 'a level';
      const quota = s.haul?.goal ? ` · quota ${Math.min(999, Math.round(((s.haul.current ?? 0) / s.haul.goal) * 100))}%` : '';
      return { icon: '🗺️', title: level ? `Level ${level}` : 'In a level', detail: `${map}${quota}`, href: '#/', waiting: false };
    }
    case 'shop':
      return { icon: '🛒', title: 'Service Station', detail: `${s.surplusK ?? '?'}K surplus${level ? ` · next: level ${level}` : ''}`, href: '#/shop/advisor', waiting: false };
    case 'lobby':
      return { icon: '🚚', title: 'In the truck', detail: `waiting for ${level ? `level ${level}` : 'the next level'}`, href: '#/', waiting: true };
    case 'lobbyMenu':
      return { icon: '👥', title: 'Lobby', detail: [`waiting for the game to start`, players(s.playerCount)].filter(Boolean).join(' · '), href: '#/', waiting: true };
    case 'mainMenu':
      return { icon: '🏠', title: 'Main menu', detail: 'waiting for a game', href: '#/', waiting: true };
    case 'tutorial':
      return { icon: '🎓', title: 'Tutorial', detail: 'practice run', href: '#/', waiting: true };
    case 'arena':
      return { icon: '⚔️', title: 'Arena', detail: 'the run is over', href: '#/', waiting: true };
    default:
      return { icon: '⏳', title: 'Loading', detail: 'between scenes', href: '#/', waiting: true };
  }
}
