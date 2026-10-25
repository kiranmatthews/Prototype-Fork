import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const out=process.env.KOOK_OUTPUT||'/private/tmp/kook-native-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:2560,height:1440},deviceScaleFactor:1,...(process.env.KOOK_MOTION?{recordVideo:{dir:out+'/motion',size:{width:2560,height:1440}}}:{})}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/kook-review',r=>r.fulfill({contentType:'text/html',body:`<body style="margin:0"><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';import {createKookVisual} from '/src/enemies/kookVisual.ts';
const scene=new THREE.Scene();scene.background=new THREE.Color('#b7c8d5');scene.add(new THREE.HemisphereLight('#f1efff','#68747b',2.4));const light=new THREE.DirectionalLight('#fff1d8',3);light.position.set(3,6,5);scene.add(light);
const origin=new THREE.Vector3(27,80,-45),yaw=.7,fixture=new THREE.Group();fixture.position.copy(origin);fixture.rotation.y=yaw;scene.add(fixture);
const camera=new THREE.PerspectiveCamera(34,2560/1440,.01,100);camera.position.copy(new THREE.Vector3(0,1.6,8).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(origin));camera.lookAt(origin.clone().add(new THREE.Vector3(0,1.25,0)));
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(2560,1440);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,6),new THREE.MeshStandardMaterial({color:'#8298a4',roughness:.8}));floor.rotation.x=-Math.PI/2;floor.position.copy(origin);floor.position.y-=.035;scene.add(floor);
const actors=[createKookVisual('grunt','lookout'),createKookVisual('sentry','gunner')];actors[0].group.position.x=-1.35;actors[1].group.position.x=1.35;for(const a of actors)fixture.add(a.group);scene.updateMatrixWorld(true);await Promise.all(actors.map(a=>a.ready));
window.review={actors,renderer,scene,camera,draw(state='watch',time=0,angle=0){for(const [i,a]of actors.entries()){a.body.rotation.y=angle;for(let j=0;j<30;j++)a.update(1/60,{state:i===0?state:state==='watch'?'doze':state==='shriek'?'fire':'aim',stateTime:time,time:time,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false});}renderer.render(scene,camera);return actors.map(a=>{const bounds=new THREE.Box3().setFromObject(a.body,true);return {diagnostic:a.diagnostics,hands:a.group.userData.kookHandErrors,feet:a.group.userData.kookFootErrors,bottom:bounds.min.y-origin.y,top:bounds.max.y-origin.y};});}};window.review.draw();
const sequence=(time,segments)=>{let start=0;for(const [state,duration]of segments){if(time<start+duration)return {state,stateTime:time-start};start+=duration;}return {state:segments[segments.length-1][0],stateTime:0};};
window.review.cycle=angle=>new Promise(resolve=>{
 const started=performance.now(),metrics={angle,frames:0,seconds:0,maxHandError:0,maxFootError:0,minBottom:100,maxBottom:-100,minTop:100,maxTop:0,states:[new Set(),new Set()],nonFinite:0,maxRootScaleError:0};let previous=started;
 const tick=now=>{const time=Math.min(12,(now-started)/1000),dt=Math.min(.05,(now-previous)/1000);previous=now;
  actors.forEach((a,i)=>{a.body.rotation.y=angle;const state=sequence(time,i===0?[['watch',4.04],['windup',.76],['shriek',1.35],['recover',3.1],['watch',2.75]]:[['doze',4.8],['wake',.85],['aim',1.18],['fire',.18],['reload',1.45],['aim',1.18],['fire',.18],['reload',1.45],['doze',.73]]);metrics.states[i].add(state.state);
   a.update(dt,{...state,time,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false});metrics.maxHandError=Math.max(metrics.maxHandError,...(a.group.userData.kookHandErrors??[0]));metrics.maxFootError=Math.max(metrics.maxFootError,...a.group.userData.kookFootErrors);
   metrics.maxRootScaleError=Math.max(metrics.maxRootScaleError,...a.group.scale.toArray().map(x=>Math.abs(x-1)));a.body.traverse(n=>{if(n.isBone&&!n.matrixWorld.elements.every(Number.isFinite))metrics.nonFinite++;});
   if(metrics.frames%12===0){const box=new THREE.Box3().setFromObject(a.body,true),bottom=box.min.y-origin.y,top=box.max.y-origin.y;metrics.minBottom=Math.min(metrics.minBottom,bottom);metrics.maxBottom=Math.max(metrics.maxBottom,bottom);metrics.minTop=Math.min(metrics.minTop,top);metrics.maxTop=Math.max(metrics.maxTop,top);}
  });metrics.frames++;metrics.seconds=time;renderer.render(scene,camera);
  if(time<12)requestAnimationFrame(tick);else resolve({...metrics,states:metrics.states.map(s=>[...s])});
 };requestAnimationFrame(tick);
});
</script>`}));
try{await page.goto('http://127.0.0.1:5267/kook-review');await page.waitForFunction(()=>window.review,{timeout:120000});const report=[];
for(const [name,state,time,angle]of [['front','watch',1,0],['quarter','watch',1,.6],['rear','watch',1,Math.PI],['alarm','shriek',.55,0],['aim','windup',.5,.25]]){const result=await page.evaluate(([s,t,a])=>window.review.draw(s,t,a),[state,time,angle]);await page.screenshot({path:out+'/'+name+'.png'});report.push({name,result});for(const actor of result){assert.equal(actor.diagnostic.status,'ready');assert.ok(Math.abs(actor.bottom)<.25,`${name}: foot datum ${actor.bottom}`);assert.ok(actor.top>2&&actor.top<3,`${name}: body top ${actor.top}`);assert.ok([...(actor.hands??[]),...actor.feet].every(e=>e<.03),`${name}: misplaced contact ${JSON.stringify(actor)}`);}}
if(process.env.KOOK_MOTION){
 const motion=[];for(const [name,angle]of [['front',0],['forty',40*Math.PI/180],['side',Math.PI/2]]){
  const running=page.evaluate(a=>window.review.cycle(a),angle);
  for(const [index,delay]of [1000,3500,700,800,2200,2400].entries()){await page.waitForTimeout(delay);await page.screenshot({path:out+'/motion-'+name+'-'+index+'.png'});}
  const metrics=await running;motion.push({name,...metrics});await writeFile(out+'/motion.json',JSON.stringify({motion,errors},null,2)+'\n');
  assert.ok(metrics.frames>120&&metrics.seconds===12,'Complete real-time motion cycle');assert.equal(metrics.nonFinite,0);assert.equal(metrics.maxRootScaleError,0);assert.ok(metrics.maxHandError<.03&&metrics.maxFootError<.03,'Planted contacts through every frame');assert.ok(metrics.minBottom>-.12&&metrics.maxBottom<.12&&metrics.minTop>1.6&&metrics.maxTop<3,'Deformed skin remains supported');
 }
 console.log('Motion cycles',JSON.stringify(motion));
}
await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2)+'\n');console.log(JSON.stringify({out,errors,report}));if(errors.length)throw Error(errors.join('\n'));}finally{await context.close();await browser.close();}
