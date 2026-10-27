import { rebuildNightworksBonus } from './nightworks-bonus';
import { createCalderaBonus } from './nightworks-caldera-bonus';
import { TEMPLE_NIGHT_ATMOSPHERE } from './temple-night-route';
import type { CustomLevelData, LevelEntry, SkyPreset } from '../level';
import { campaignLevelById, campaignLevelByKey, levelAllowsBonus } from '../campaign';
import { EASY_BONUS_LEVEL } from './bonus-easy';
import {RUMBLEWATER_BONUS_LEVEL} from './rumblewater-bonus';
import {ROLLING_BONES_BONUS_LEVEL} from './rolling-bones-bonus';
import { CUSTARD_BONUS_LEVEL } from './custard-bonus';
import { makeBonusCourse, type BonusPattern } from './bonus-course-kit';
import { BONUS_LAYOUT_REPLACEMENTS, replaceBonusLayout } from './puzzle-bonus';
import { dressJungleBonus } from './jungle-bonus';
import { bonusCourseArt, bonusArtAtmosphere, type BonusArtTheme } from './bonus-course-art';
import { rebuildCarlisleBonus } from './carlisle-bonus';
import { dressBlockworksBonus } from './blockworks-bonus';
import { decorateCoastalBonus } from './coastal-town-art';
import { dressDrownedCrownBonus } from './drowned-crown-bonus';
import { ROOFTOP_PORCH_BONUS } from './rooftop-porch-bonus';
import { dressBananaBayBonus } from './banana-bay-bonus';

interface BonusRecipe {
  parentId: string;
  key: string;
  name: string;
  theme: BonusArtTheme;
  patterns: BonusPattern[];
  color: string;
  accent: string;
  tex: string;
  sky: SkyPreset;
  jungleAtmosphere?: boolean;
}

// Original room sequences informed by PLATFORMER_PUZZLE_RESEARCH.md. Each
// parent has its own setting and order of decisions. Shared modules encode
// tested reach and collision; they do not change the player's movement rules.
export const THEMED_BONUS_RECIPES: readonly BonusRecipe[] = [
  {parentId:'treehouse-trail',key:'treehouse-trail',name:'Bonus: Canopy Cache',theme:'treehouse',
    patterns:['upper','relay'],color:'#b09053',accent:'#e2cf90',tex:'plank',sky:'day',jungleAtmosphere:true},
  {parentId:'jungle',key:'jungle',name:'Bonus: Fern Reliquary',theme:'jungle',
    patterns:['upper','bridge'],color:'#b1b38c',accent:'#83b792',tex:'jungle',sky:'day',jungleAtmosphere:true},
  {parentId:'test',key:'test-course',name:'Bonus: Quayside Cargo',theme:'coast',
    patterns:['fuse','bridge'],color:'#ba976e',accent:'#7ba6b4',tex:'stone',sky:'coast'},
  {parentId:'sky',key:'sky-bridge',name:'Bonus: Cloudtop Lockers',theme:'cloud',
    patterns:['relay','finite'],color:'#d4dde3',accent:'#9dbace',tex:'stone',sky:'day'},
  {parentId:'slip',key:'slipstream',name:'Bonus: Slipstream Airlocks',theme:'slipstream',
    patterns:['upper','relay','bridge'],color:'#91cbd1',accent:'#e9d598',tex:'pavement',sky:'day'},
  {parentId:'dark',key:'nightworks',name:'Bonus: Nightworks Fuse Store',theme:'nightworks',
    patterns:['fuse','return'],color:'#77748a',accent:'#db963f',tex:'stone',sky:'night'},
  {parentId:'beachfront',key:'beachside-run',name:'Bonus: Lifeguard Lockup',theme:'beach',
    patterns:['bridge','upper'],color:'#d4b783',accent:'#79b6bd',tex:'plank',sky:'coast'},
  {parentId:'coastal-street-run',key:'coastal',name:'Bonus: Rooftop Deliveries',theme:'street',
    patterns:['finite','fuse'],color:'#d2a286',accent:'#6dabb3',tex:'pavement',sky:'coast'},
  {parentId:'codex-lab',key:'codex-switchback',name:'Bonus: Haunted Hassle',theme:'blockworks',
    patterns:['return','bridge','finite'],color:'#a7aaab',accent:'#e2a34d',tex:'stone',sky:'day'},
  {parentId:'astra-chimeworks',key:'chimeworks',name:'Bonus: Belfry Counterweights',theme:'chimeworks',
    patterns:['finite','return'],color:'#9baaa4',accent:'#dcbd72',tex:'stone',sky:'sunset'},
  {parentId:'waterpark',key:'waterpark',name:'Bonus: Deadwater Valve House',theme:'waterpark',
    patterns:['fuse','bridge','return'],color:'#85b6bb',accent:'#df9d77',tex:'pavement',sky:'day'},
  {parentId:'nightworks-after-hours',key:'nightworks-after-hours',name:'Bonus: Caldera Counterweights',theme:'afterhours',
    patterns:[],color:'#666b81',accent:'#73d5ca',tex:'stone',sky:'night'},
  {parentId:'jungle-terraces',key:'jungle-terraces',name:'Bonus: Ember Reliquary',theme:'terraces',
    patterns:['finite','bridge','fuse'],color:'#c8bc94',accent:'#79a996',tex:'jungle',sky:'night',jungleAtmosphere:true},
  {parentId:'drowned-crown',key:'drowned-crown',name:"Bonus: The Captain’s Last Ledger",theme:'pirate',
    patterns:['return','fuse','bridge'],color:'#a67e52',accent:'#d2b572',tex:'plank',sky:'night'},
  {parentId:'bone-yard',key:'bone-yard',name:'Bonus: Ivory Salvage',theme:'boneyard',
    patterns:['relay','finite','return'],color:'#c5b58e',accent:'#73b3a3',tex:'stone',sky:'sunset'},
];

export const THEMED_BONUS_COURSES = THEMED_BONUS_RECIPES.filter(recipe => recipe.parentId !== 'astra-chimeworks' && levelAllowsBonus(recipe.parentId)).map(recipe => {
  if (recipe.parentId === 'nightworks-after-hours') return {...createCalderaBonus(),parentId:recipe.parentId,progressKey:recipe.key,id:`bonus-${recipe.key}`,theme:recipe.theme};
  const {name,patterns,color,accent,tex,sky,jungleAtmosphere}=recipe;
  const course=makeBonusCourse({name,patterns,style:{color,accent,tex,sky,jungleAtmosphere}});
  const layout = BONUS_LAYOUT_REPLACEMENTS[recipe.key];
  if (layout) {
    replaceBonusLayout(course.data,layout,{color,accent,tex,sky,jungleAtmosphere});
    course.rooms=[]; course.actions=[];
  }
  const gate=course.data.components.find(component=>component.t==='gate')!;
  const end=gate.p[0]+8;
  if(recipe.key==='coastal')decorateCoastalBonus(course.data,end);
  else if(recipe.theme==='blockworks')dressBlockworksBonus(course.data);
  else if(recipe.parentId==='drowned-crown')dressDrownedCrownBonus(course.data,end);
  else{
    course.data.components.push(...bonusCourseArt(recipe.theme,end));
    Object.assign(course.data,bonusArtAtmosphere(recipe.theme));
    if (recipe.parentId === 'jungle-terraces') {
      course.data.sky='night'; course.data.atmosphere={...TEMPLE_NIGHT_ATMOSPHERE};
      for(let x=4;x<end;x+=18) course.data.components.push({t:'torch',p:[x,0,-4.6],rise:2,w:1.1,nm:'Reliquary torch'});
    }
  }
  if (recipe.parentId === 'test') rebuildCarlisleBonus(course.data);
  if (recipe.parentId === 'jungle') dressJungleBonus(course.data);
  if (recipe.parentId === 'beachfront') dressBananaBayBonus(course.data);
  if (recipe.theme === 'nightworks' || recipe.theme === 'afterhours') rebuildNightworksBonus(course.data);
  return {...course,layout,parentId:recipe.parentId,progressKey:recipe.key,id:`bonus-${recipe.key}`,theme:recipe.theme};
});

export const BONUS_LEVEL_ENTRIES: LevelEntry[] = THEMED_BONUS_COURSES.map(({id,data})=>({id,name:data.name,data}));
BONUS_LEVEL_ENTRIES.push({id:'bonus-custard-creek',name:CUSTARD_BONUS_LEVEL.name,data:CUSTARD_BONUS_LEVEL});
const BONUS_BY_PARENT_ID=new Map(THEMED_BONUS_COURSES.map(course=>[course.parentId,course.data]));
const BONUS_BY_KEY=new Map(THEMED_BONUS_COURSES.map(course=>[course.progressKey,course.data]));
BONUS_BY_KEY.set('custard-creek',CUSTARD_BONUS_LEVEL);
BONUS_BY_KEY.set('rumblewater-run',RUMBLEWATER_BONUS_LEVEL);
BONUS_BY_PARENT_ID.set('rolling-bones',ROLLING_BONES_BONUS_LEVEL);
BONUS_BY_PARENT_ID.set('rooftop-relay',ROOFTOP_PORCH_BONUS);
BONUS_LEVEL_ENTRIES.push({id:'bonus-rooftop-relay',name:ROOFTOP_PORCH_BONUS.name,data:ROOFTOP_PORCH_BONUS});
BONUS_LEVEL_ENTRIES.push({id:'bonus-rumblewater-run',name:RUMBLEWATER_BONUS_LEVEL.name,data:RUMBLEWATER_BONUS_LEVEL});
BONUS_LEVEL_ENTRIES.push({id:'bonus-rolling-bones',name:ROLLING_BONES_BONUS_LEVEL.name,data:ROLLING_BONES_BONUS_LEVEL});

/** Unknown editor courses keep the small safe room; campaign aliases share
 * their parent's explicit room, so renamed/editable replacements stay linked. */
export function resolveBonusLevel(parentId:string):CustomLevelData {
  const definition=campaignLevelById(parentId)??campaignLevelByKey(parentId);
  // Island slot changes must not detach an existing course's authored bonus.
  return BONUS_BY_PARENT_ID.get(definition?.levelId??parentId)
    ??BONUS_BY_KEY.get(definition?.progressKey??parentId)??EASY_BONUS_LEVEL;
}

const UNCOUNTED_CRATES=new Set(['metal','metalbounce','bang','nitrobang']);
export function bonusCrateCount(parentId:string):number {
  if (!levelAllowsBonus(parentId)) return 0;
  return resolveBonusLevel(parentId).components.filter(component=>component.t==='checkpoint'||component.t==='outline'||
    (component.t==='crate'&&!UNCOUNTED_CRATES.has(component.kind??'wood'))).length;
}
