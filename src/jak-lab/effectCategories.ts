import type {Catalogue,Exhibit} from './types';

export const effectCategories=[
  {id:'eco',label:'Eco & energy'},
  {id:'fire',label:'Fire, lava & heat'},
  {id:'smoke',label:'Smoke, steam & dust'},
  {id:'water',label:'Water & bubbles'},
  {id:'impact',label:'Hits, explosions & debris'},
  {id:'attack',label:'Projectiles & attacks'},
  {id:'movement',label:'Footsteps & movement'},
  {id:'nature',label:'Wildlife & weather'},
  {id:'creature',label:'Creature effects'},
  {id:'light',label:'Light, glow & beams'},
  {id:'pickup',label:'Pickups & rewards'},
  {id:'warp',label:'Warps & transitions'},
  {id:'world',label:'Machines & interactions'},
  {id:'hud',label:'HUD & menus'},
  {id:'disappearance',label:'Disappearance effects'},
  {id:'other',label:'Other effects'},
] as const;
export type EffectCategory=typeof effectCategories[number]['id'];
export const categoryLabel=(id:EffectCategory)=>effectCategories.find(category=>category.id===id)!.label;

// Source names describe purpose; shared sprite textures are only a fallback.
// Multi-category membership keeps (for example) eco explosions in both views.
const rules:readonly [EffectCategory,RegExp][]=[
  ['hud',/hud|progress|save-icon|static-screen|part-screen1/],
  ['movement',/footprint|(?:run|land|slide|just)-poof|foot-puff|wheel-puff|trail|lurkercrab-slide|racer-effects|target-racing/],
  ['eco',/eco|energy|powerup|dark-plant|vent-(?:blue|green|red|yellow)|(?:^|-)(?:green|blue|yellow|red)-collect/],
  ['impact',/(?:^|-)hit(?:-|$)|impact|explod|explos|blowup|shatter|debris|crumb|rock|boulder|break|smack|strike-ground|bone-/],
  ['attack',/fireball|shot|missile|projectile|proj-|spinkick|punch|attack|pulse|cannon|launcher/],
  ['fire',/torch|flame|(?:^|-)fire|lava|burn|candle|volcano|fuse|heat-(?:\d|distort)/],
  ['smoke',/smoke|steam|dust|mist|fog|poof|puff|sulphur|heatpipe|vent-(?!blue|red|green|yellow)/],
  ['water',/water|splash|bubble|ripple|drip|whirlpool|fountain|geyser|spout|paddle|boiling|dark-splash|spit/],
  ['nature',/butterfl|(?:^|-)moth(?:-|$)|bird|seagull|flys|fish|(?:^|-)rain(?:-|$)|snowdrop|mountain-snow|update-snow|(?:^|-)stars(?:-|$)|wind/],
  ['creature',/lurker|spider|snake|kermit|gnawer|yeti|flut|(?:^|-)ram(?:-|$)|sharkey|sandworm|darkvine|evilsib|bully/],
  ['light',/glow|beam|starburst|dapple|(?:^|-)sun(?:-|$)|whiteout|lightning|peeper|sagecage|charg(?:ed|ing)-up|evilsib-hover/],
  ['pickup',/collect|fuel-cell|money|buzzer-effect|buzzer-crate|(?:^|-)pickup|reward/],
  ['warp',/warp|trans-pad|appear|intro|credits/],
  ['world',/generator|coil|shield|sheild|machine|controlpanel|gears|pipegame|plat|gate|door|room-|binocular|levitator|ring|spike|keg-bounce|bumper/],
];

export function categoriesFor(exhibit:Exhibit,catalogue:Catalogue):EffectCategory[] {
  if(exhibit.death)return ['disappearance'];
  const effect=exhibit.effect!;
  if(effect.sourceAssembly)return effect.sourceAssembly==='eco-beam'?['eco','light']:['light','world'];
  if(effect.screenHud||effect.name===catalogue.fuelCellHud?.group||effect.source.file.startsWith('engine/ui/'))return ['hud'];
  // Authored dust sheets have numbered source names, while the six direct
  // effect-control launches are material-specific foot/slide marks.
  if(effect.source.file==='levels/beach/beach-part.gc'&&/^group-beach-\d+$/.test(effect.name))return ['smoke'];
  if(effect.directLaunch&&effect.source.file==='engine/game/effect-control.gc'&&
    [95,106,2250,2253,2262,2265].includes(effect.directLaunch.particle))return ['movement'];
  if(effect.directLaunch&&['levels/beach/lurkerworm.gc','levels/jungle/darkvine.gc'].includes(effect.source.file))return ['smoke'];
  const name=effect.name.toLowerCase().replace(/\s+/g,'-');
  const categories=rules.filter(([,pattern])=>pattern.test(name)).map(([category])=>category);
  if(categories.length)return [...new Set(categories)];
  const particles=new Map(catalogue.particles.map(p=>[p.id,p]));
  const seen=new Set<number>(),textures:string[]=[];
  const visit=(id:number)=>{
    if(seen.has(id))return;seen.add(id);
    for(const field of particles.get(id)?.fields??[]) {
      if(field.field==='texture')textures.push(String(field.value));
      if(field.field==='next-launcher')visit(field.base??0);
      if(field.field==='func')for(const action of catalogue.callbackPrograms?.[String(field.value)]?.actions??[])
        if(action.op==='launch')visit(action.particle);
    }
  };
  effect.items.forEach(item=>visit(item.particle));
  const textureNames=textures.join(' ').toLowerCase();
  if(/smoke|dust|mist|cloud|steam|puff/.test(textureNames))return ['smoke'];
  if(/water|splash|bubble|ripple|lakedrop/.test(textureNames))return ['water'];
  if(/fire|flame/.test(textureNames))return ['fire'];
  if(/spark|flare|glow|light|starflash|hotdot/.test(textureNames))return ['light'];
  if(/bird|butterfl|moth|seagull|fish/.test(textureNames))return ['nature'];
  if(/rock|chip|debris/.test(textureNames))return ['impact'];
  return ['other'];
}
