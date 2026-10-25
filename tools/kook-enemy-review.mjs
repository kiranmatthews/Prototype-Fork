import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const out=process.env.KOOK_OUTPUT||'/private/tmp/kook-native-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/kook-review',r=>r.fulfill({contentType:'text/html',body:`<body style="margin:0"><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';import {createKookVisual} from '/src/enemies/kookVisual.ts';
const scene=new THREE.Scene();scene.background=new THREE.Color('#b7c8d5');scene.add(new THREE.HemisphereLight('#f1efff','#68747b',2.4));const light=new THREE.DirectionalLight('#fff1d8',3);light.position.set(3,6,5);scene.add(light);
const origin=new THREE.Vector3(27,80,-45),yaw=.7,fixture=new THREE.Group();fixture.position.copy(origin);fixture.rotation.y=yaw;scene.add(fixture);
const camera=new THREE.PerspectiveCamera(34,2560/1440,.01,100);camera.position.copy(new THREE.Vector3(0,1.6,8).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(origin));camera.lookAt(origin.clone().add(new THREE.Vector3(0,1.25,0)));
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(2560,1440);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
const actors=[createKookVisual('grunt','lookout'),createKookVisual('sentry','gunner')];actors[0].group.position.x=-1.35;actors[1].group.position.x=1.35;for(const a of actors)fixture.add(a.group);scene.updateMatrixWorld(true);await Promise.all(actors.map(a=>a.ready));
window.review={actors,renderer,scene,camera,draw(state='watch',time=0,angle=0){for(const [i,a]of actors.entries()){a.body.rotation.y=angle;for(let j=0;j<30;j++)a.update(1/60,{state:i===0?state:state==='watch'?'doze':state==='shriek'?'fire':'aim',stateTime:time,time:time,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false});}renderer.render(scene,camera);return actors.map(a=>{const bounds=new THREE.Box3().setFromObject(a.body,true);return {diagnostic:a.diagnostics,hands:a.group.userData.kookHandErrors,feet:a.group.userData.kookFootErrors,bottom:bounds.min.y-origin.y,top:bounds.max.y-origin.y};});}};window.review.draw();
</script>`}));
try{await page.goto('http://127.0.0.1:5267/kook-review');await page.waitForFunction(()=>window.review,{timeout:120000});const report=[];
for(const [name,state,time,angle]of [['front','watch',1,0],['quarter','watch',1,.6],['rear','watch',1,Math.PI],['alarm','shriek',.55,0],['aim','windup',.5,.25]]){const result=await page.evaluate(([s,t,a])=>window.review.draw(s,t,a),[state,time,angle]);await page.screenshot({path:out+'/'+name+'.png'});report.push({name,result});for(const actor of result){assert.equal(actor.diagnostic.status,'ready');assert.ok(Math.abs(actor.bottom)<.25,`${name}: foot datum ${actor.bottom}`);assert.ok(actor.top>2&&actor.top<3,`${name}: body top ${actor.top}`);assert.ok([...(actor.hands??[]),...actor.feet].every(e=>e<.03),`${name}: misplaced contact`);}}
await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2)+'\n');console.log(JSON.stringify({out,errors,report}));if(errors.length)throw Error(errors.join('\n'));}finally{await browser.close();}
