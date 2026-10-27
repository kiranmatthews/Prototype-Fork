// The rejected, compact layout is independently preserved in
// spaghetti-rails-platforming.ts. Race changes must never rewrite that copy.
export * from './spaghetti-rails-network';
import {SPAGHETTI_RAILS_LEVEL as greybox} from './spaghetti-rails-network';
import {withSpaghettiCavern} from './spaghetti-rails-art';
export const SPAGHETTI_RAILS_LEVEL=withSpaghettiCavern(greybox);
