import {sourceAssemblyDefinitions} from './sourceAssemblies';
import {screenHudDefinitions,screenHudDefinition} from './screenHud';
import {categoriesFor} from './effectCategories';
import type {Catalogue,EffectDefinition,Exhibit} from './types';

/** The lab contains effects only. Models are private emission/animation inputs,
 * never independently browsable cards, including with an older catalogue. */
export function effectExhibits(catalogue:Catalogue):Exhibit[] {
  const pretty=(name:string)=>name.replace(/^group-/,'').replace(/-lod0$/,'').replace(/-/g,' ');
  const direct:EffectDefinition[]=(catalogue.sourceInventory?.standaloneParticles??[]).flatMap(entry=>
    [...new Set(entry.launches.map(launch=>launch.is3d))].map(is3d=>{
      const launch=entry.launches.find(candidate=>candidate.is3d===is3d)!;
      return {id:10000+entry.particle*2+Number(is3d),name:`${launch.source.function??'direct-launch'} / particle ${entry.particle}${is3d?' / 3D':''}`,
        source:launch.source,items:[{particle:entry.particle,flags:['launch-asap',...(is3d?['is-3d']:[])]}],
        directLaunch:{particle:entry.particle,function:launch.source.function}};
    }));
  const disappearances:Exhibit[]=(catalogue.meshDeaths?.models??[]).flatMap(death=>{
    const model=catalogue.models.find(model=>model.id===death.model);
    if(!model||model.background||(!death.events.length&&!['sunken/generic-button-lod0','common/eichar-lod0'].includes(model.id)))return [];
    return [{id:'death:'+model.id,name:`${pretty(model.name)} · ${death.events.length?'death effect':'warp disappearance'}`,
      area:model.area,kind:'effect',category:'disappearance',model,death}];
  });
  const exhibits:Exhibit[]=[...disappearances,
    ...[...catalogue.groups,...direct,...sourceAssemblyDefinitions,...screenHudDefinitions(catalogue)].map(effect=>({
      id:'effect:'+effect.id,name:pretty(effect.name),area:effect.source.file.startsWith('levels/')?effect.source.file.split('/')[1]:'engine',
      kind:'effect' as const,category:effect.sourceAssembly||effect.screenHud||screenHudDefinition(effect,catalogue)||
        effect.name===catalogue.fuelCellHud?.group?'assembly' as const:'particle' as const,effect,
    }))].sort((a,b)=>(a.area===b.area?0:a.area==='common'?-1:b.area==='common'?1:a.area.localeCompare(b.area))||a.name.localeCompare(b.name));
  for(const exhibit of exhibits)exhibit.categories=categoriesFor(exhibit,catalogue);
  return exhibits;
}
