import * as THREE from 'three';

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
  const currentBonk = player.isBonking.bind(player);
  player.isBonking = box => currentBonk(box, false);
}
