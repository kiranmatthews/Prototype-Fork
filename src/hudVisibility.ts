/**
 * Pure presentation state for the collection HUD. Gameplay state stays with
 * Player; this class only decides which already-known values are on screen.
 */

export type HudPresentationMode = "standard" | "bonus";

export const HUD_FRUIT_POP_MS = 1_700;
export const HUD_INVENTORY_LINGER_MS = 1_800;

export interface HudVisibilityInput {
  mode: HudPresentationMode;
  fruitCollectionRevision: number;
  inventoryHeld: boolean;
  hasEarnedRelic: boolean;
  nowMs: number;
}

export interface HudVisibility {
  showLife: true;
  showBonusTitle: boolean;
  showFruit: boolean;
  showBoxes: boolean;
  showEarnedRelics: boolean;
}

/**
 * Tracks the two transient regular-play reveals. Call `reset` when a level or
 * run is replaced so its initial collection revision cannot look like a fresh
 * pickup.
 */
export class HudVisibilityState {
  private previousFruitRevision: number | null = null;
  private fruitVisibleUntilMs = 0;
  private inventoryVisibleUntilMs = 0;

  reset(fruitCollectionRevision?: number): void {
    this.previousFruitRevision = fruitCollectionRevision ?? null;
    this.fruitVisibleUntilMs = 0;
    this.inventoryVisibleUntilMs = 0;
  }

  clearTransient(): void {
    this.fruitVisibleUntilMs = 0;
    this.inventoryVisibleUntilMs = 0;
  }

  update(input: Readonly<HudVisibilityInput>): HudVisibility {
    const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : 0;

    if (this.previousFruitRevision === null) {
      // First observation establishes the baseline. Loading a saved/checkpoint
      // state is not a collection event and must not flash the fruit counter.
      this.previousFruitRevision = input.fruitCollectionRevision;
    } else {
      if (input.fruitCollectionRevision > this.previousFruitRevision)
        this.fruitVisibleUntilMs = nowMs + HUD_FRUIT_POP_MS;
      this.previousFruitRevision = input.fruitCollectionRevision;
    }

    if (input.mode === "bonus") {
      // Bonus stages own a persistent tally. Do not carry an L2 reveal through
      // a later mode switch when an integration forgets to call reset.
      this.inventoryVisibleUntilMs = 0;
      return {
        showLife: true,
        showBonusTitle: true,
        showFruit: true,
        showBoxes: true,
        showEarnedRelics: false,
      };
    }

    if (input.inventoryHeld)
      this.inventoryVisibleUntilMs = nowMs + HUD_INVENTORY_LINGER_MS;
    const inventoryVisible =
      input.inventoryHeld || nowMs < this.inventoryVisibleUntilMs;

    return {
      showLife: true,
      showBonusTitle: false,
      showFruit: nowMs < this.fruitVisibleUntilMs,
      showBoxes: inventoryVisible,
      showEarnedRelics: inventoryVisible && input.hasEarnedRelic,
    };
  }
}
