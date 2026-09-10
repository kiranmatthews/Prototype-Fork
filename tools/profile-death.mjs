import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,Level,Player,CONST})=>{
 const {RigBinding}=await server.ssrLoadModule('/src/animation/rigBinding.ts');
 const {createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/playerCatalog.ts');
 const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
 const scene=new THREE.Scene(),level=new Level(scene,{id:'death-profile',name:'Death profile',data:{v:1,name:'Death profile',spawn:[0,.1,0],killY:-60,components:[{t:'platform',p:[0,-.5,0],s:[40,1,40]},{t:'gate',p:[0,0,-16]}]}});
 const p=new Player(scene);p.rawInput=makeInput();p.respawn(level,true);
 const rig=RigBinding.fromSculptRuntime(p.animationRig.root).definition;
 const runtime=createCharacterAnimationRuntime(p,createPlayerStarterAnimationSuite(rig));
 const metrics={};
 function wrap(owner,key){const native=owner[key].bind(owner);owner[key]=(...args)=>{const start=performance.now();try{return native(...args);}finally{const m=metrics[key]??={calls:0,ms:0};m.calls++;m.ms+=performance.now()-start;}};}
 for(const key of ['stepDeathFall','seatDeathOnGround','refreshCharacterBounds','queryGround'])wrap(p,key);
 wrap(p.interactionMeasure,'minimumPlaneDistance');
 const input=makeInput({inventoryHeld:true});
 const results=[];
 for(const mode of ['idle','death']){
  p.respawn(level,true);p.grounded=true;p.speed=0;p.vVel=0;
  if(mode==='death'){p.die();p.respawnTimer=20;}
  for(const key of Object.keys(metrics))delete metrics[key];
  const samples=[];
  for(let i=0;i<126;i++){const t=performance.now();p.step(CONST.fixedStep,input,level);samples.push(performance.now()-t);}
  samples.sort((a,b)=>a-b);
  results.push({mode,averageMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],metrics:JSON.parse(JSON.stringify(metrics))});
 }
 console.log(JSON.stringify(results,null,2));runtime.dispose();level.dispose();
});
