import type {CustomComponent, CustomLevelData} from '../level';
import type {RaceKnot} from '../race/types';
import {COUNTRY_CLUB_LENGTH as length, COUNTRY_CLUB_GAPS as gaps,
  COUNTRY_CLUB_CORNERS as corners, COUNTRY_CLUB_PADS as pads,
  COUNTRY_CLUB_TRACK_PITS as pits, countryClubPoint as point,
  countryClubWidth as width, countryClubRacingOffset as offset} from './country-club-layout';

/** Country Club supplies geometry/navigation; Slipstream's shared SkateRace
 * owns riders, countdown, item rules, recovery, trials, rewards and results. */
export function buildCountryClubRace(base:CustomLevelData):CustomLevelData {
  const finish=length-14,start=18;
  const line:RaceKnot[]=[];
  for(let s=start;s<finish;s+=3){
    const u=offset(s);
    line.push([...point(s,u),Math.max(5,width(s)-Math.abs(u)*2-3)]);
  }
  line.push([...point(finish),width(finish)-2]);
  const components:CustomComponent[]=base.components.filter(c=>
    !['checkpoint','wumpa','crystal','clock','bonusplatform'].includes(c.t));
  for(const c of components)if(c.t==='crate'&&!['tnt','nitro'].includes(c.kind??''))c.kind='empty';
  // Four-wide item rows follow supported straights. No row crowds a launch,
  // sharp bend, boost plate or the usable side of an excavated sand trap.
  let row=0;
  for(let s=100;s<finish-65;s+=125){
    if(gaps.some(g=>s>g.a-60&&s<g.b+50)||corners.some(c=>s>c.entry-35&&s<c.exit+35)||
      pads.some(p=>Math.abs(s-p.s)<15)||pits.some(p=>Math.abs(s-p.s)<p.halfLength+18))continue;
    row++;
    for(const [i,u]of [-4.2,-1.4,1.4,4.2].entries())components.push({
      t:'crate',kind:'mystery',p:point(s,u),grp:14,nm:`Race / item row ${row} / ${i+1}`});
  }
  return {...base,spawn:point(start,0,.1),components,perfectGrindBoost:true,allBalanceCrates:false,
    medalTimes:{gold:115,silver:145,bronze:190},
    groups:[...(base.groups??[]),{id:14,nm:'Race / shared Slipstream item rows',editorOnly:true}],
    skateRace:{v:1,racers:8,seed:18404,stages:['Clubhouse','Front nine','Back nine','Home stretch'],
      line,jumps:gaps.map(g=>({takeoff:point(g.a-5),landing:point(g.b+5)})),finishWidth:width(finish),originalLength:length},
  };
}
