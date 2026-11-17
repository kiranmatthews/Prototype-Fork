import * as THREE from 'three';
import type { Level } from '../level';
import type { Player } from '../player';
import type { SkateRace } from '../race/runtime';
import type { CountryClubCarts } from './course';
import type { GolfCartRace } from './race';

/** The golf carts carry about 1.4 MB of embedded Meshy meshes. The game loads
 * their code with the first level that has carts instead of at start. Each
 * load is reported to Three's default loading manager, so the presentation
 * gate keeps a level covered until its carts exist. Labs and tools import the
 * cart modules directly and are unaffected. */
function tracked<T>(name: string, load: () => Promise<T>): Promise<T> {
  const manager = THREE.DefaultLoadingManager, url = `golf-cart/${name}`;
  manager.itemStart(url);
  return load().then(
    value => { manager.itemEnd(url); return value; },
    error => { manager.itemError(url); manager.itemEnd(url); throw error; },
  );
}

let raceModule: Promise<typeof import('./race')> | null = null;
let raceClass: typeof GolfCartRace | null = null;
/** The cart-race runtime, once loaded; null until then. */
export function loadedGolfCartRace(): typeof GolfCartRace | null { return raceClass; }
export function loadGolfCartRace(): Promise<typeof GolfCartRace> {
  raceModule ??= tracked('race', () => import('./race'));
  return raceModule.then(module => (raceClass = module.GolfCartRace), error => { raceModule = null; throw error; });
}

/** Country Club's roaming carts, loaded the first time that course is entered. */
export class LazyCountryClubCarts {
  private carts: CountryClubCarts | null = null;
  private loading: Promise<void> | null = null;
  private target: { level: Level; id: string } | null = null;
  private visible = true;
  constructor(private readonly scene: THREE.Scene) {}
  get fleet(): CountryClubCarts['fleet'] { return this.carts?.fleet ?? null; }
  attach(level: Level, id: string): void {
    this.target = { level, id };
    if (this.carts) { this.carts.attach(level, id); this.carts.setVisible(this.visible); return; }
    if (id !== 'country-club') return;
    this.loading ??= tracked('course', () => import('./course')).then(module => {
      this.carts = new module.CountryClubCarts(this.scene);
      // Build for the course that is current now, which may have changed.
      if (this.target) this.attach(this.target.level, this.target.id);
    }, error => { this.loading = null; console.error('Golf carts failed to load.', error); });
  }
  setVisible(visible: boolean): void { this.visible = visible; this.carts?.setVisible(visible); }
  step(dt: number, player: Player, race?: SkateRace): void { this.carts?.step(dt, player, race); }
  /** Resolves once the carts for the attached course exist (or none are needed). */
  ready(): Promise<void> { return this.loading ?? Promise.resolve(); }
}
