import {createSpaghettiPlatformer} from './spaghetti-platformer-course';
import {withSpaghettiCavern} from './spaghetti-rails-art';
const course=createSpaghettiPlatformer();
export const SPAGHETTI_PLATFORMER_ISLANDS=course.islands;
export const SPAGHETTI_PLATFORMER_CHAPTERS=course.chapters;
export const SPAGHETTI_PLATFORMER_JUMPS=course.jumps;
export const SPAGHETTI_RAILS_PLATFORMING_LEVEL=withSpaghettiCavern(course.data);
