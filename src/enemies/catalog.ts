import type {EnemyKind} from './types';

/** Presentation names for the generated roster; serialized gameplay IDs stay stable. */
export const ENEMY_NAMES:Readonly<Record<EnemyKind,string>>={
  grunt:'Coral Crab',spiker:'Bristleback',turtle:'Mossback',charger:'Russet Bull',
  hopper:'Spring Frog',floater:'Violet Watcher',sentry:'Ember Sentry',spinner:'Brass Whirler',
};
export function enemyThumbnail(kind:EnemyKind):string {
  return `${import.meta.env.BASE_URL}enemies/icons/${kind}.png`;
}
