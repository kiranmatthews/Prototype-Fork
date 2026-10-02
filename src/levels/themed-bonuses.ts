import type { CustomLevelData, LevelEntry, SkyPreset } from '../level';
import { campaignLevelById, campaignLevelByKey, levelAllowsBonus } from '../campaign';
import { EASY_BONUS_LEVEL } from './bonus-easy';
import { makeBonusCourse, type BonusPattern } from './bonus-course-kit';
import { bonusCourseArt, bonusArtAtmosphere, type BonusArtTheme } from './bonus-course-art';

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
    patterns:['fuse','bridge'],color:'#ba976e',accent:'#7ba6b4',tex:'brick',sky:'coast'},
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
  {parentId:'island-hopper',key:'island-hopper',name:'Bonus: Lagoon Relay',theme:'islands',
    patterns:['relay','upper','return'],color:'#c9be8d',accent:'#5caa93',tex:'plank',sky:'coast'},
  {parentId:'codex-lab',key:'codex-switchback',name:'Bonus: Blockworks Reassembly',theme:'blockworks',
    patterns:['return','bridge','finite'],color:'#a7aaab',accent:'#e2a34d',tex:'stone',sky:'day'},
  {parentId:'astra-chimeworks',key:'chimeworks',name:'Bonus: Belfry Counterweights',theme:'chimeworks',
    patterns:['finite','return'],color:'#9baaa4',accent:'#dcbd72',tex:'stone',sky:'sunset'},
  {parentId:'waterpark',key:'waterpark',name:'Bonus: Deadwater Valve House',theme:'waterpark',
    patterns:['fuse','bridge','return'],color:'#85b6bb',accent:'#df9d77',tex:'pavement',sky:'day'},
  {parentId:'nightworks-after-hours',key:'nightworks-after-hours',name:'Bonus: After Hours Dispatch',theme:'afterhours',
    patterns:['relay','fuse','return'],color:'#666b81',accent:'#73d5ca',tex:'stone',sky:'night'},
  {parentId:'crate-primer',key:'crate-primer',name:'Bonus: Apprentice Storehouse',theme:'primer',
    patterns:['upper','finite'],color:'#bba37a',accent:'#b2cd94',tex:'wood',sky:'day'},
  {parentId:'switchyard',key:'switchyard',name:'Bonus: Signal Cabin',theme:'switchyard',
    patterns:['bridge','return','relay'],color:'#a89772',accent:'#dab266',tex:'stone',sky:'sunset'},
  {parentId:'clockwork-gauntlet',key:'clockwork-gauntlet',name:'Bonus: Furnace Reserve',theme:'gauntlet',
    patterns:['finite','return','fuse'],color:'#836b64',accent:'#eaa967',tex:'stone',sky:'night'},
  {parentId:'jungle-terraces',key:'jungle-terraces',name:'Bonus: Jade Reservoir',theme:'terraces',
    patterns:['finite','bridge','fuse'],color:'#c8bc94',accent:'#79a996',tex:'jungle',sky:'day',jungleAtmosphere:true},
  {parentId:'jungle-skyline',key:'jungle-skyline',name:'Bonus: Sun-Crown Treasury',theme:'skyline',
    patterns:['return','relay','upper'],color:'#c4be9a',accent:'#d4b269',tex:'jungle',sky:'sunset',jungleAtmosphere:true},
  {parentId:'drowned-crown',key:'drowned-crown',name:"Bonus: The Captain’s Last Ledger",theme:'pirate',
    patterns:['return','fuse','bridge'],color:'#a67e52',accent:'#d2b572',tex:'plank',sky:'night'},
  {parentId:'bone-yard',key:'bone-yard',name:'Bonus: Ivory Salvage',theme:'boneyard',
    patterns:['relay','finite','return'],color:'#c5b58e',accent:'#73b3a3',tex:'stone',sky:'sunset'},
];

export const THEMED_BONUS_COURSES = THEMED_BONUS_RECIPES.filter(recipe => levelAllowsBonus(recipe.parentId)).map(recipe => {
  const {name,patterns,color,accent,tex,sky,jungleAtmosphere}=recipe;
  const course=makeBonusCourse({name,patterns,style:{color,accent,tex,sky,jungleAtmosphere}});
  const gate=course.data.components.find(component=>component.t==='gate')!;
  const end=gate.p[0]+8;
  course.data.components.push(...bonusCourseArt(recipe.theme,end));
  Object.assign(course.data,bonusArtAtmosphere(recipe.theme));
  return {...course,parentId:recipe.parentId,progressKey:recipe.key,id:`bonus-${recipe.key}`,theme:recipe.theme};
});

export const BONUS_LEVEL_ENTRIES: LevelEntry[] = THEMED_BONUS_COURSES.map(({id,data})=>({id,name:data.name,data}));
const BONUS_BY_KEY=new Map(THEMED_BONUS_COURSES.map(course=>[course.progressKey,course.data]));

/** Unknown editor courses keep the small safe room; campaign aliases share
 * their parent's explicit room, so renamed/editable replacements stay linked. */
export function resolveBonusLevel(parentId:string):CustomLevelData {
  const key=campaignLevelById(parentId)?.progressKey??campaignLevelByKey(parentId)?.progressKey??parentId;
  return BONUS_BY_KEY.get(key)??EASY_BONUS_LEVEL;
}

const UNCOUNTED_CRATES=new Set(['metal','metalbounce','bang','nitrobang']);
export function bonusCrateCount(parentId:string):number {
  if (!levelAllowsBonus(parentId)) return 0;
  return resolveBonusLevel(parentId).components.filter(component=>component.t==='checkpoint'||component.t==='outline'||
    (component.t==='crate'&&!UNCOUNTED_CRATES.has(component.kind??'wood'))).length;
}
