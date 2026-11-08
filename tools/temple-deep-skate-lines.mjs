// Instrumented Temple of Embers journey: the existing input-only pilot
// (tools/temple-night-pilot.mjs) with speed, air, grind, brake and crate
// bookkeeping per station, plus an unbraked variant (--greedy) that never
// uses the grab brake, to show what the course does to an uninformed fast
// rider. Writes docs/temple-embers-design/deep/skate-lines[-greedy].json.
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTempleJourney} from './temple-night-pilot.mjs';

const greedy=process.argv.includes('--greedy');
const OUT=`docs/temple-embers-design/deep/skate-lines${greedy?'-greedy':''}.json`;
const round=(n,d=2)=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*10**d)/10**d:n;
const CHAPTERS=[[0,'Fern court',-20,34],[1,'First bank + teaching reservoir',34,151],[2,'Processional climb + switch court',151,285],[3,'Three-times-high ascent',285,359],[4,'Summit fuse court, sanctuary reservoir, first ollie',359,504],[5,'Torch causeway',504,600],[6,'Return gallery, bull bank, cloud reservoir',600,805],[7,'Cloud fuse reprise + crown bank',805,920],[8,'Crown court + sun crown reservoir',920,1049],[9,'Rising sun + giant reservoir',1049,1152],[10,'Descending aqueduct',1152,1194],[11,'Final leap + Ember Gauntlet',1194,1345],[12,'Sanctuary',1345,1392]];

await withBlockworksRuntime(async r=>{
  const route=r.sourceModule.JUNGLE_TERRACES_ROUTE;r.route=route;r.nodeCamera=true;
  const {p,l}=r;
  const kindOf=c=>c.nitroBang?'nitrobang':c.bang?'bang':c.metalBounce?'metalbounce':c.metal?'metal':c.bouncy?'bouncy':c.tnt?'tnt':c.nitro?'nitro':c.multiHit?'multihit':c.mask?'mask':c.life?'life':c.mystery?'mystery':'wood';
  const crateInfo=l.crates.map(c=>{const [s,,side]=route.toLocal([c.home?.x??c.mesh.position.x,c.box.min.y,c.home?.z??c.mesh.position.z]);return {s:round(s,1),side:round(side,1),bottom:round(c.box.min.y),kind:kindOf(c),outline:!!c.wasOutline};});
  const alive=l.crates.map(c=>c.alive);
  const bins=new Map();const bin=s=>Math.floor(s/4)*4;
  const events=[],broken=[];const chapters=CHAPTERS.map(([i,name,a,b])=>({chapter:i,name,a,b,frames:0,maxSpeed:0,minSpeed:Infinity,grindFrames:0,airFrames:0,brakeFrames:0,chargeFrames:0}));
  let prev={grind:false,air:false,brake:false},airStart=null,grindStart=null,brakeStart=null,apexY=-Infinity,vertSeen=false,lastS=-20,error=null;
  const gen=runTempleJourney(r);
  try{
    for(const raw of gen){
      const input=greedy?{...raw,grabHeld:false}:raw;
      r.tick(input);
      const [s,,side]=route.toLocal(p.pos.toArray());
      const b=bin(s);const row=bins.get(b)??{s:b,max:0,min:Infinity,sum:0,n:0,grind:0,air:0,vert:0,brake:0};
      row.max=Math.max(row.max,p.speed);row.min=Math.min(row.min,p.speed);row.sum+=p.speed;row.n++;
      const grinding=p.state==='grind',air=!p.grounded,brake=!!input.grabHeld;
      if(grinding)row.grind++;if(air)row.air++;if(p.vertAir)row.vert++;if(brake)row.brake++;bins.set(b,row);
      const ch=chapters.find(c=>s>=c.a&&s<c.b);
      if(ch){ch.frames++;ch.maxSpeed=Math.max(ch.maxSpeed,p.speed);ch.minSpeed=Math.min(ch.minSpeed,p.speed);if(grinding)ch.grindFrames++;if(air)ch.airFrames++;if(brake)ch.brakeFrames++;if(input.jumpHeld)ch.chargeFrames++;}
      if(grinding&&!prev.grind)grindStart={s,frame:r.frame,speed:p.speed,side};
      if(!grinding&&prev.grind&&grindStart)events.push({type:'grind',from:round(grindStart.s,1),to:round(s,1),side:round(grindStart.side,1),frames:r.frame-grindStart.frame,speedIn:round(grindStart.speed),speedOut:round(p.speed)});
      if(air&&!prev.air){airStart={s,frame:r.frame,y:p.pos.y,speed:p.speed,side};apexY=p.pos.y;vertSeen=false;}
      if(air){apexY=Math.max(apexY,p.pos.y);vertSeen=vertSeen||p.vertAir;}
      if(!air&&prev.air&&airStart){const frames=r.frame-airStart.frame;if(frames>=6)events.push({type:vertSeen?'vertAir':'air',from:round(airStart.s,1),to:round(s,1),side:round(airStart.side,1),frames,apex:round(apexY-airStart.y),speedIn:round(airStart.speed),speedOut:round(p.speed)});}
      if(brake&&!prev.brake)brakeStart={s,frame:r.frame,speed:p.speed};
      if(!brake&&prev.brake&&brakeStart)events.push({type:'brake',from:round(brakeStart.s,1),to:round(s,1),frames:r.frame-brakeStart.frame,speedIn:round(brakeStart.speed),speedOut:round(p.speed)});
      for(let i=0;i<l.crates.length;i++)if(alive[i]&&!l.crates[i].alive){alive[i]=false;broken.push({atStation:round(s,1),frame:r.frame,speed:round(p.speed),state:p.state,...crateInfo[i]});}
      prev={grind:grinding,air,brake};lastS=s;
    }
  }catch(e){error={message:String(e.message).slice(0,600),station:round(lastS,1),frame:r.frame,speed:round(p.speed),state:p.state,position:p.pos.toArray().map(n=>round(n))};}
  const survivors=l.crates.map((c,i)=>({...crateInfo[i],alive:c.alive,pending:!!c.pending,bangUsed:!!c.bangUsed})).filter(c=>c.alive&&!c.pending&&!['metal','metalbounce','bang','nitrobang'].includes(c.kind));
  const report={greedy,generated:new Date().toISOString(),state:p.state,seconds:round(r.frame/60),frames:r.frame,deaths:p.totalDeaths,error,
    chapters:chapters.map(c=>({...c,seconds:round(c.frames/60),minSpeed:round(c.minSpeed),maxSpeed:round(c.maxSpeed),meanSpeedMps:round((c.b-c.a)/Math.max(1e-6,c.frames/60)),grindSeconds:round(c.grindFrames/60),airSeconds:round(c.airFrames/60),brakeSeconds:round(c.brakeFrames/60)})),
    bins:[...bins.values()].sort((a,b)=>a.s-b.s).map(x=>({s:x.s,max:round(x.max,1),min:round(x.min,1),mean:round(x.sum/x.n,1),frames:x.n,grind:x.grind,air:x.air,vert:x.vert,brake:x.brake})),
    events,broken,survivors,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates};
  await writeFile(OUT,JSON.stringify(report,null,1));
  console.log(JSON.stringify({greedy,state:p.state,seconds:report.seconds,deaths:report.deaths,error,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,survivors:survivors.length,chapters:report.chapters.map(c=>[c.chapter,c.seconds,c.minSpeed,c.maxSpeed,c.meanSpeedMps,c.grindSeconds,c.airSeconds,c.brakeSeconds])}));
  console.log('wrote',OUT);
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z},maxFrames:2_000_000});
