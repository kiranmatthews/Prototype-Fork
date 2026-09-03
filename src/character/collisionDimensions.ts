import { PROCEDURAL_SHIN_LENGTH, PROCEDURAL_THIGH_LENGTH } from '../legRig';
import {
  MESHY_HEAD_DEFAULT_GAP,
  MESHY_HEAD_REST_HEIGHT,
} from './meshyHead';
import {
  DEFAULT_CHARACTER_PROPORTIONS,
  type CharacterHeadProfileId,
  type CharacterProportionSettingsValue,
} from './settings';
import {
  MESHY_TORSO_NECK_Y,
  MESHY_TORSO_SPINE_Y,
} from './meshyTorso';

/** The authored levels were built around this standing collision height. */
export const BASE_CHARACTER_HITBOX_HEIGHT = 0.92;

const HEAD_REST_HEIGHT: Readonly<Record<CharacterHeadProfileId, number>> = {
  skull: MESHY_HEAD_REST_HEIGHT,
  // Source runtime Y span 0.7890625 × the authored 0.46 rest scale. Keep this
  // scalar here so collision math does not eagerly pull the evaluation-only
  // alternate-head mesh out of its dynamic chunk.
  roo: 0.7890625 * 0.46,
};

/**
 * Conceptual upright crown height in rig units. This follows Character Lab's
 * persistent design controls, never a transient animation pose.
 */
export function characterDesignHeight(
  value: Readonly<CharacterProportionSettingsValue>,
  headProfile: CharacterHeadProfileId = 'skull',
): number {
  const legDelta =
    PROCEDURAL_THIGH_LENGTH * (value.thighLength - 1) +
    PROCEDURAL_SHIN_LENGTH * (value.shinLength - 1);
  const neckTop =
    MESHY_TORSO_SPINE_Y +
    legDelta +
    (MESHY_TORSO_NECK_Y - MESHY_TORSO_SPINE_Y) * value.torsoLength;
  const crownTop =
    neckTop +
    MESHY_HEAD_DEFAULT_GAP * value.neckLength +
    HEAD_REST_HEIGHT[headProfile] * value.headSize;
  return (
    Math.max(0.2, neckTop, crownTop) *
    value.overallScale *
    value.height
  );
}

const DEFAULT_SKULL_DESIGN_HEIGHT = characterDesignHeight(
  DEFAULT_CHARACTER_PROPORTIONS,
  'skull',
);

/**
 * Scale the forgiving gameplay body with the authored character stature while
 * keeping the shipped default Skull exactly compatible with existing levels.
 */
export function characterCollisionHeight(
  value: Readonly<CharacterProportionSettingsValue>,
  headProfile: CharacterHeadProfileId = 'skull',
): number {
  return (
    BASE_CHARACTER_HITBOX_HEIGHT *
    (characterDesignHeight(value, headProfile) / DEFAULT_SKULL_DESIGN_HEIGHT)
  );
}
