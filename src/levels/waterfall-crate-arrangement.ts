import type {CustomComponent,CustomLevelData} from '../level';
import type {WaterfallAction} from './waterfall-climb';

/** Harvest the fixed banks; keep the moving decks and launch columns clear. */
export function arrangeWaterfallCrates(C:CustomComponent[],route:WaterfallAction[]):void {
 const counts=new Map<string,number>([
  ['Reedwater mask',3],['Reed shelter parcel',4],['Far-bank cedar cache',4],['Sluice keeper parcel',3],
  ['Ferry shore life',4],['Catch basin supplies',4],['Upper pool cache',3],['Thunder basin mask',3],
  ['Gatehouse hinge parcel',3],['Gatehouse upper cache',4],['Waterwheel lookout life',3],['Aqueduct bank parcel',3],
  ['Lower bell reward',3],['Middle bell reward',3],['Cloud rest mask',3],['Crown refuge supplies',3],['Source pool final cache',4],
 ]);
 const rename=new Map([['Ferry shore life','Ferry shore cache'],['Waterwheel lookout life','Waterwheel lookout cache'],
  ['Thunder basin mask','Thunder basin stores'],['Cloud rest mask','Cloud rest stores']]);
 const old=C.filter(c=>c.t==='crate');for(let i=C.length-1;i>=0;i--)if(C[i].t==='crate')C.splice(i,1);
 const column=(spec:CustomComponent,count:number)=>{for(let i=0;i<count;i++)C.push({...spec,p:[spec.p[0],spec.p[1]+i*.96,spec.p[2]],
  kind:i?'mystery':spec.kind,nm:i?`${spec.nm} · upper ${i}`:spec.nm});};
 for(const c of old){const name=c.nm!;column({...c,nm:rename.get(name)??name,kind:rename.has(name)?'wood':c.kind},counts.get(name)!);}
 for(const a of route)if(a.kind==='cache'&&rename.has(a.target!)){a.name=rename.get(a.target!)!;a.target=a.name;}
 const insert=(anchor:string,before:boolean,name:string,p:[number,number,number],count:number,grp:number,kind:CustomComponent['kind']='wood')=>{
  column({t:'crate',p,kind,grp,nm:name},count);
  const at=route.findIndex(a=>a.name===anchor);if(at<0)throw Error('Missing waterfall harvest anchor: '+anchor);
  route.splice(at+(before?0:1),0,{kind:'cache',name,target:name,to:p,section:grp});
 };
 // Ten boxes per authored checkpoint section: teach, arrival, rest and count.
 insert('Leave the river bank',false,'TEACH / Wet-stone shoulder',[-4,.3,-17],3,10);
 insert('Line up with the fallen trunk',true,'COUNT / Cedar boarding stores',[2,1.2,-95],3,11);
 insert('Cedar spine over open river',true,'TEST / Cedar mounting crown',[-11,7,-287],3,11);
 insert('Step off the cedar bank',false,'TEACH / Sluice sill stores',[3,7,-375],3,12);
 insert('Mount at the millrace head',true,'COUNT / Millrace boarding stores',[6,7,-466],3,13);
 insert('Carve uphill into the catch basin',false,'REWARD / Millrace landing stores',[7,9,-774],3,13);
 insert('Rise above the whitewater',false,'PREPARE / Pool keeper mask',[-3.5,10.8,-813],3,14,'mask');
 insert('Waterfall root-bank arrival',false,'REWARD / Thunder root-bank stores',[-3,12,-886],4,14);
 insert('Great waterwheel lift',true,'COUNT / Waterwheel boarding stores',[2,25.4,-1123],3,22);
 insert('Waterwheel lookout cache',false,'REWARD / Waterwheel upper stores',[-31,53.4,-1123],4,22);
 insert('Face the rising aqueduct',true,'COUNT / Aqueduct boarding stores',[-30,53.4,-1117],3,23);
 insert('Aqueduct crown rail',true,'TEST / Aqueduct mounting stores',[-11,77.4,-1129],4,23);
 insert('Upper bell drum',false,'REWARD / Upper bell stores',[-5,119.4,-1120],4,24);
 insert('Crown counterweight step',false,'TEST / Counterweight rest stores',[22,132.4,-1114.5],4,25);
 insert('Last spray drum',true,'COUNT / Last spray stores',[32,141.4,-1115],3,25);
 insert('Last spray drum',false,'REWARD / Summit landing stores',[47,155.4,-1115],3,40);
}

/** The bonus combines a preserved launcher, timed footing and a real reveal. */
export function arrangeSpillwayCrates(data:CustomLevelData):void {
 const C=data.components,old=C.filter(c=>c.t==='crate');
 const counts=new Map<string,number>([['Arrival parcel',3],['Arrival pair',3],['First wheel supplies',4],
  ['First receiver cache',3],['First receiver pair',3],['Bell keeper provisions',3],['Ferry shore pair',3],
  ['Treasury pair',4],['Revealed spillway parcel 1',3],['Revealed spillway parcel 2',3],
  ['Treasury lower',4],['Keeper life',3],['Last spillway parcel',3]]);
 const obsolete=new Set(['Arrival pair cap','First receiver cap','Ferry shore pair cap','Treasury pair cap','Treasury crown']);
 for(let i=C.length-1;i>=0;i--)if(C[i].t==='crate')C.splice(i,1);
 for(const c of old){if(obsolete.has(c.nm!))continue;const count=counts.get(c.nm!)??1;
  const base={...c,p:[...c.p] as [number,number,number]};
  if(c.nm==='High bell cache')base.p[1]=13.8;
  if(c.nm==='Keeper life'){base.kind='wood';base.nm='Keeper stores';}
  for(let i=0;i<count;i++)C.push({...base,p:[base.p[0]+(count===4?i%2*.96:0),base.p[1]+(count===4?Math.floor(i/2):i)*.96,0],
   kind:i>=(count===4?2:1)?'mystery':base.kind,nm:i?`${base.nm} · upper ${i}`:base.nm});
 }
 const cube={vertices:[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]};
 for(const c of C)if(c.t==='platform'&&c.outline)Object.assign(c,{t:'mesh',...cube});
}
