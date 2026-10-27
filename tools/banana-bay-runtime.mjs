import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
import {normalizeGameInput} from './blockworks-runner.mjs';

/** Native Level/Player fixture. A scenario may choose a start before stepping;
 * the traversal pilots only yield ordinary inputs, never edit gameplay state. */
export async function withBananaBay(run,{bonus=false,start}={}) {
  const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
  new Function('noop',fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
  const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  const warn=console.warn,error=console.error;
  console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
  console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
  let l;
  try{
    const api=await server.ssrLoadModule('/src/level.ts');
    const {Player}=await server.ssrLoadModule('/src/player.ts');
    const {CONST,TUNING}=await server.ssrLoadModule('/src/tuning.ts');
    const sourceModule=await server.ssrLoadModule('/src/levels/sunny-beach.ts');
    const route=await server.ssrLoadModule('/src/levels/banana-bay-route.ts');
    const {resolveBonusLevel}=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
    const source=bonus?resolveBonusLevel('beachfront'):sourceModule.SUNNY_BEACH_LEVEL;
    const id=bonus?'bonus-beachside-run':'beachfront',scene=new THREE.Scene();
    if(process.env.BANANA_BAY_DIAGNOSTICS)console.log('Banana Bay: constructing native level');
    l=new api.Level(scene,{id,name:source.name,...(bonus?{data:source}:{})});
    l.update(0);scene.updateMatrixWorld(true);
    if(process.env.BANANA_BAY_DIAGNOSTICS)console.log('Banana Bay: constructing player');
    const p=new Player(scene);p.enterLevel(id);p.rawInput=normalizeGameInput();
    p.respawn(l,true,false,start?{position:new THREE.Vector3(...start),heading:new THREE.Vector3(0,0,-1)}:undefined);
    if(process.env.BANANA_BAY_DIAGNOSTICS)console.log('Banana Bay: stepping',p.pos.toArray());
    let frame=0,last={};const trace=[],report={actions:[],evidence:[]};
    const snapshot=()=>({frame,p:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,vVel:p.vVel,
      deaths:p.totalDeaths,cratesBroken:p.cratesBroken,masks:p.masks,ground:p.groundHit?.name,input:{...last}});
    const r={THREE,server,...api,sourceModule,source,route,scene,l,p,id,CONST,TUNING,dt:CONST.fixedStep,trace,report,snapshot,
      get frame(){return frame;},tick(sample={}){
        const input=normalizeGameInput(sample,last);last={...sample};
        p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);p.flushLevelCrateRewards(l);p.commitRenderStep(l);frame++;
        const shot=snapshot();trace.push(shot);return shot;
      }};
    return await run(r);
  }finally{l?.dispose();await server.close();console.warn=warn;console.error=error;}
}
