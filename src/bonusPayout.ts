import type { CampaignInventory } from "./campaign";
export const BONUS_FRUIT_FLIGHT_SECONDS = 0.45;

/** Display-only transfer: real inventory is banked before the return fade. */
export class BonusPayout {
  private elapsed = 0;
  private parentFruit: number | null = null;
  fruitLaunched = 0;
  fruitPaid = 0;
  livesPaid = 0;
  readonly duration = 2.6;
  static readonly flightDuration = BONUS_FRUIT_FLIGHT_SECONDS;
  constructor(readonly lives: number, readonly fruit: number, readonly deathsRemoved = 0) {}

  get complete(): boolean { return this.elapsed >= this.duration; }

  update(actual: Readonly<CampaignInventory>, dt: number): CampaignInventory {
    this.parentFruit ??= ((actual.fruit - this.fruit) % 100 + 100) % 100;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    const t = this.elapsed / this.duration;
    this.fruitLaunched = Math.floor(this.fruit * Math.min(1, this.elapsed / 1.58));
    this.fruitPaid = Math.floor(this.fruit * Math.max(0, Math.min(1, (this.elapsed - BonusPayout.flightDuration) / 1.58)));
    this.livesPaid = this.complete ? this.lives : Math.floor(this.lives * Math.max(0, Math.min(1, (t - 0.65) / 0.35)));
    // Subtract only what has not yet been shown; new gameplay pickups/damage
    // still appear correctly, and crossing 100 fruit awards the visible life.
    const fruit = actual.fruit - (this.fruit - this.fruitPaid);
    return { fruit: ((fruit % 100) + 100) % 100,
      lives: Math.max(0, actual.lives - (this.lives - this.livesPaid) + Math.floor(fruit / 100)) };
  }

  get lifeAwardsShown(): number {
    return this.livesPaid + Math.floor(((this.parentFruit ?? 0) + this.fruitPaid) / 100);
  }

  displayDeaths(actual: number): number {
    return actual + Math.max(0, this.deathsRemoved - this.lifeAwardsShown);
  }
}
