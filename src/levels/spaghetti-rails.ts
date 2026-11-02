// Both forward courses share the periodic-space contract and native kit.
export * from './spaghetti-rails-network';
import {SPAGHETTI_RAILS_LEVEL as greybox} from './spaghetti-rails-network';
import {withSpaghettiCavern} from './spaghetti-rails-art';
export const SPAGHETTI_RAILS_LEVEL=withSpaghettiCavern(greybox);
