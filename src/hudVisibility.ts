/**
 * Pure presentation state for the collection HUD. Gameplay state stays with
 * Player; this class only decides which already-known values are on screen.
 */

export type HudPresentationMode = "standard" | "bonus" | "hub";

export const HUD_FRUIT_POP_MS = 1_700;

export interface HudVisibilityInput {
  mode: HudPresentationMode;
  fruitCollectionRevision: number;
  inventoryHeld: boolean;
  hasEarnedRelic: boolean;
  nowMs: number;
}

export interface HudVisibility {
  showLife: boolean;
  showBonusTitle: boolean;
  showFruit: boolean;
  showBoxes: boolean;
  showEarnedRelics: boolean;
  showScore: boolean;
}

/**
 * Tracks the fruit popup and the press-to-toggle regular-play inventory. Call
 * `reset` when a level or run is replaced so its initial collection revision
 * cannot look like a fresh pickup.
 */
export class HudVisibilityState {
  private previousFruitRevision: number | null = null;
  private fruitVisibleUntilMs = 0;
  private inventoryOpen = false;
  private inventoryWasHeld = false;

  reset(fruitCollectionRevision?: number, inventoryHeld = false): void {
    this.previousFruitRevision = fruitCollectionRevision ?? null;
    this.fruitVisibleUntilMs = 0;
    this.inventoryOpen = false;
    this.inventoryWasHeld = inventoryHeld;
  }

  clearTransient(): void {
    this.fruitVisibleUntilMs = 0;
    this.inventoryOpen = false;
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
      // Bonus stages own a persistent tally. Track the physical L2 state so
      // leaving while it is held cannot masquerade as a new press.
      this.inventoryOpen = false;
      this.inventoryWasHeld = input.inventoryHeld;
      return {
        showLife: true,
        showBonusTitle: true,
        showFruit: true,
        showBoxes: true,
        showEarnedRelics: false,
        showScore: false,
      };
    }

    if (input.mode === "hub") {
      this.inventoryOpen = false;
      this.inventoryWasHeld = input.inventoryHeld;
      return {
        showLife: false,
        showBonusTitle: false,
        showFruit: false,
        showBoxes: false,
        showEarnedRelics: false,
        showScore: false,
      };
    }

    const inventoryPressed = input.inventoryHeld && !this.inventoryWasHeld;
    this.inventoryWasHeld = input.inventoryHeld;
    if (inventoryPressed) {
      this.inventoryOpen = !this.inventoryOpen;
      // A deliberate second press dismisses the complete collection HUD,
      // including any pickup timer that would otherwise keep fruit behind.
      if (!this.inventoryOpen) this.fruitVisibleUntilMs = 0;
    }

    return {
      showLife: true,
      showBonusTitle: false,
      // L2 reveals the whole collection stack. Fruit therefore occupies the
      // same fixed slot whether it was opened by a pickup or by inventory.
      showFruit: this.inventoryOpen || nowMs < this.fruitVisibleUntilMs,
      showBoxes: this.inventoryOpen,
      showEarnedRelics: this.inventoryOpen && input.hasEarnedRelic,
      showScore: this.inventoryOpen,
    };
  }
}
