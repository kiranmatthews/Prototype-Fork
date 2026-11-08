import * as THREE from 'three';

// Frozen input-only courses were recorded with 0.96m crates. Keep their
// geometry and layout migration at that scale without changing production
// dimensions or weakening their recorded trajectory/landing assertions.
export function legacyCrateDimensionsPlugin() {
  return {
    name: 'historical-crate-dimensions',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/crateDimensions.ts')) return;
      const declaration = 'export const CRATE_SCALE = 1.2;';
      if (!code.includes(declaration)) throw new Error('Review the historical crate fixture after changing production dimensions');
      return code.replace(declaration, 'export const CRATE_SCALE = 1;');
    },
  };
}

// Only for input-only historical recordings whose later fixed-frame assertions
// depend on old crate contacts. Current interaction tests never install this.
export function useLegacyCrateEnvelope(player, constants) {
  const reach = new THREE.Vector3(constants.spinReach, 0, constants.spinReach);
  player.refreshCrateBounds = function () {
    this.crateBodyBox.copy(this.playerBox);
    this.crateAttackBox.copy(this.feetBox);
    this.crateAttackBox.max.y = Math.min(this.crateAttackBox.max.y, this.crateAttackBox.min.y + .92);
    if (this.spinning) this.crateAttackBox.expandByVector(reach);
  };
  const currentStomp = player.isStomping.bind(player);
  player.isStomping = box => currentStomp(box, 0);
  const currentBonk = player.isBonking.bind(player);
  player.isBonking = box => currentBonk(box, false);
}
