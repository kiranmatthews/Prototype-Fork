export * from './spaghetti-infinite-course';
import {createSpaghettiCourse} from './spaghetti-infinite-course';
const course=createSpaghettiCourse();
export const SPAGHETTI_DOCKS=course.docks;
export const SPAGHETTI_RUNS=course.runs;
export const SPAGHETTI_PATHS=course.runs.map(run=>({name:run.name,stage:run.stage,choice:run.choice,runs:[run]}));
export const SPAGHETTI_RAILS_LEVEL=course.data;
export const createSpaghettiRailsGreybox=()=>createSpaghettiCourse().data;
