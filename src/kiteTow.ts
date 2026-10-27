/** Beach Street's wind is a level rule, never a global skating adjustment. */
export const KITE_TOW = Object.freeze({
  launchSpeed: 10.4,
  riseGravity: 22,
  heldRiseGravity: 16,
  fallGravity: 24,
  steeringSpeed: 9,
  steeringResponse: 12,
  coyoteSeconds: .10,
  bufferSeconds: .14,
  launchDelay: 1.15,
});

export function kiteCruiseSpeed(distance: number): number {
  // A long first district teaches steering and lift before the wind builds.
  return distance < 920 ? 20 : distance < 1830 ? 23 : 25;
}

export class KiteTowMotion {
  age = 0;
  speed = 0;
  lateral = 0;
  coyote = 0;
  jumpBuffer = 0;
  private jumpWasHeld = false;

  reset(): void {
    this.age = this.speed = this.lateral = this.coyote = this.jumpBuffer = 0;
    this.jumpWasHeld = false;
  }

  step(dt: number, distance: number, grounded: boolean,
    input: {moveX: number; jumpHeld: boolean; jumpPressed: boolean; jumpCancelled?: boolean}) {
    this.age += dt;
    const target = this.age < KITE_TOW.launchDelay ? 0 : kiteCruiseSpeed(distance);
    this.speed += Math.max(-10 * dt, Math.min(10 * dt, target - this.speed));
    this.lateral += (input.moveX * KITE_TOW.steeringSpeed - this.lateral) * (1 - Math.exp(-KITE_TOW.steeringResponse * dt));
    this.coyote = grounded ? KITE_TOW.coyoteSeconds : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    // Press to jump. Holding earns lift; it never automatically bunny-hops.
    if (input.jumpPressed || input.jumpHeld && !this.jumpWasHeld) this.jumpBuffer = KITE_TOW.bufferSeconds;
    if (input.jumpCancelled) this.jumpBuffer = 0;
    this.jumpWasHeld = input.jumpHeld;
    const jump = this.jumpBuffer > 0 && this.coyote > 0 && this.speed > 0;
    if (jump) this.jumpBuffer = this.coyote = 0;
    return {jump, dx: this.lateral * dt, dz: -this.speed * dt};
  }

  gravity(rising: boolean, held: boolean): number {
    return rising ? held ? KITE_TOW.heldRiseGravity : KITE_TOW.riseGravity : KITE_TOW.fallGravity;
  }
}
