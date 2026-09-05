import type { CampaignInventory } from "./campaign";

/** Display-only transfer: real inventory is banked before the return fade. */
export class BonusPayout {
  private elapsed = 0;
  readonly duration = 2.6;
  constructor(readonly lives: number, readonly fruit: number) {}

  get complete(): boolean { return this.elapsed >= this.duration; }

  update(actual: Readonly<CampaignInventory>, dt: number): CampaignInventory {
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    const t = this.elapsed / this.duration;
    const fruitPaid = Math.floor(this.fruit * Math.min(1, t / 0.78));
    const livesPaid = this.complete ? this.lives : Math.floor(this.lives * Math.max(0, Math.min(1, (t - 0.65) / 0.35)));
    // Subtract only what has not yet been shown; new gameplay pickups/damage
    // still appear correctly, and crossing 100 fruit awards the visible life.
    const fruit = actual.fruit - (this.fruit - fruitPaid);
    return { fruit: ((fruit % 100) + 100) % 100,
      lives: Math.max(0, actual.lives - (this.lives - livesPaid) + Math.floor(fruit / 100)) };
  }
}
