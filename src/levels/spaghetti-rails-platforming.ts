import {createSpaghettiPlatformer} from './spaghetti-platformer-course';
import {withSpaghettiCavern} from './spaghetti-rails-art';
const course=createSpaghettiPlatformer();
export const SPAGHETTI_PLATFORMER_ISLANDS=course.islands;
export const SPAGHETTI_PLATFORMER_CHAPTERS=course.chapters;
export const SPAGHETTI_PLATFORMER_JUMPS=course.route.legs.filter(e=>e.kind==='jump').map(e=>({name:e.name,from:e.from.p,to:e.to.p,fromWidth:e.from.w,fromDepth:e.from.d,toWidth:e.to.w,toDepth:e.to.d}));
export const SPAGHETTI_PLATFORMER_BOX_ROUTE=course.route.stops;
export const SPAGHETTI_PLATFORMER_ROUTE_LEGS=course.route.legs;
export const SPAGHETTI_RAILS_PLATFORMING_LEVEL=withSpaghettiCavern(course.data);
