import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {UnityOcean} from '../src/unityOcean';
import {Level,BUILTIN_LEVELS} from '../src/level';
import {createUnitySandMaterial} from '../src/unitySandMaterial';
import {createStandingWaterMaterial} from '../src/standingWater';

const query=new URLSearchParams(location.search),quality=query.has('lite')?'lite':'full';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x86bdd0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;
document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x86bdd0);scene.fog=new THREE.Fog(0x86bdd0,100,650);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,0.1,1600);
const controls=new OrbitControls(camera,renderer.domElement);
scene.add(new THREE.HemisphereLight(0xc7e7ff,0xa78a68,2.3));
const sun=new THREE.DirectionalLight(0xffe6c2,3);sun.position.set(-25,40,18);scene.add(sun);
const report=document.querySelector<HTMLPreElement>('#report')!;
const select=document.querySelector<HTMLSelectElement>('#course')!;
const clock={value:0};let paused=false,level:Level|null=null,ocean:UnityOcean|null=null;
let building=false;
let fixture:THREE.Group|null=null;let summary:Record<string,unknown>={};
const scenes=[['fixture','Curved surf + still pool'],['warproom','Island world map'],['beachfront','Beachside Run'],
  ['descent','The Descent coast'],['island-hopper','Island Hopper'],['coastal-street-run','Coastal Street Run'],
  ['jungle','Jungle Ruins swimming cove'],['slip','Slipstream open sea'],['drowned-crown','Drowned Crown moonpool'],
  ['waterpark','Deadwater service wells'],['custard-creek','Custard Creek'],['ghost-train','Ghost Train baths'],['crab-chief','Crab Chief reef']];
for(const [value,label]of scenes)select.add(new Option(label,value));
document.querySelector('#pause')!.addEventListener('click',()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Resume waves':'Pause waves';});
document.querySelector('#verify')!.addEventListener('click',()=>{void verifySampler();});
select.addEventListener('change',()=>{void build(select.value).catch(error=>{building=false;report.textContent=String(error);console.error(error);});});

async function build(id:string):Promise<void>{
  building=true;select.disabled=true;
  level?.dispose();level=null;ocean?.dispose();ocean=null;
  if(fixture){scene.remove(fixture);fixture.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();}});fixture=null;}
  report.textContent='Building '+id;const started=performance.now();
  if(id==='fixture'){
    fixture=new THREE.Group();scene.add(fixture);
    const sandGeo=new THREE.PlaneGeometry(75,96,75,96);sandGeo.rotateX(-Math.PI/2);sandGeo.translate(8,0,-12);
    const pos=sandGeo.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,-pos.getX(i)*0.14+Math.sin(pos.getZ(i)*0.12)*0.35);
    sandGeo.computeVertexNormals();
    const sand=createUnitySandMaterial().material,sandMesh=new THREE.Mesh(sandGeo,sand);fixture.add(sandMesh);
    ocean=new UnityOcean({seaLevel:0,shoreDirX:1,shoreDirZ:0,shore:[{x:0,z:42,sx:1,sz:0,bedSlope:.14,beachSlope:.14},{x:0,z:-62,sx:1,sz:0,bedSlope:.14,beachSlope:.14}],course:[],terrainHeight:()=>-4,quality});
    fixture.add(ocean.group);fixture.updateMatrixWorld(true);ocean.setShoreGeometry([sandMesh]);
    const poolGeo=new THREE.PlaneGeometry(12,14).rotateX(-Math.PI/2);
    const pool=new THREE.Mesh(poolGeo,createStandingWaterMaterial(clock,'#476c63',undefined,poolGeo));pool.position.set(-15,3,-14);fixture.add(pool);pool.name='Sheltered pool';
    camera.position.set(27,12,28);controls.target.set(5,0,-13);
  }else{
    // Review source-owned geometry independently of saved editor overrides.
    const entry=BUILTIN_LEVELS.find(level=>level.id===id);if(!entry)throw new Error('Unknown water level '+id);
    level=new Level(scene,entry);ocean=level.water;
    if(id==='warproom'){camera.position.set(-176,24,94);controls.target.set(-175,-1,35);}
    else if(id==='beachfront'){camera.position.set(27,12,24);controls.target.set(-4,-.36,-18);}
    else if(id==='descent'){camera.position.set(-12,8,16);controls.target.copy(level.spawnPos).add(new THREE.Vector3(-16,-3,-20));}
    else if(id==='island-hopper'){camera.position.set(47,16,24);controls.target.set(8,-.36,-25);}
    else if(id==='coastal-street-run'){camera.position.set(27,12,23);controls.target.copy(level.spawnPos).add(new THREE.Vector3(12,-3,-20));}
    else if(id==='jungle'||id==='treehouse-trail'){camera.position.copy(level.spawnPos).add(new THREE.Vector3(24,9,58));controls.target.copy(level.spawnPos).add(new THREE.Vector3(0,-1.2,43));}
    else if(id==='drowned-crown'){camera.position.set(-23,1,-64);controls.target.set(0,-9,-107);}
    else if(id==='waterpark'){const mesh=level.root.getObjectByName('Standing service-well water');const p=mesh?.position??level.spawnPos;camera.position.copy(p).add(new THREE.Vector3(18,12,16));controls.target.copy(p);}
    else if(id==='waterpark-cup'){camera.position.set(-32,10,-88);controls.target.set(-48,-4,-109);}
    else if(id==='crab-chief'){camera.position.set(34,16,42);controls.target.set(0,-1,-14);}
    else if(id==='custard-creek'){camera.position.copy(level.spawnPos).add(new THREE.Vector3(30,9,-18));controls.target.copy(level.spawnPos).add(new THREE.Vector3(18,-4,-35));}
    else if(id==='ghost-train'){
      const pool=level.root.getObjectByName('Glowing stagnant bath water');const p=pool?.getWorldPosition(new THREE.Vector3())??level.spawnPos;
      camera.position.copy(p).add(new THREE.Vector3(3,4,5));controls.target.copy(p);level.playerPos.copy(p);
    }
    else{camera.position.set(12,-24,-150);controls.target.set(50,-34,-190);}
  }
  camera.lookAt(controls.target);controls.update();select.value=id;
  (document.querySelector('#play')as HTMLAnchorElement).href=`./?playtest&level=${id}`;
  const buildMs=performance.now()-started;
  if(query.has('cold')) {
    const salt=Math.floor(performance.timeOrigin+performance.now());
    scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) {
        const mat=material as THREE.ShaderMaterial;mat.defines={...mat.defines,COAST_REVIEW_SALT:salt};mat.needsUpdate=true;
      }});
  }
  // Texture readiness is independent of shader compile. Measure compile with
  // all real water programs present and KHR parallel compilation where available.
  if(ocean)await new Promise<void>(resolve=>{const poll=()=>{if(ocean?.group.visible)resolve();else requestAnimationFrame(poll);};poll();});
  const compileStart=performance.now();
  report.textContent=`Compiling ${id}`;
  // Actual levels can replace placeholder materials when GLBs arrive. Three
  // r166 compileAsync retains disposed material references during that load.
  // Use the runtime's synchronous path; firstDraw+finish includes completion.
  if(id==='fixture')await renderer.compileAsync(scene,camera);else renderer.compile(scene,camera);
  const compileMs=performance.now()-compileStart;
  report.textContent=`Rendering ${id}`;
  const drawStart=performance.now();level?.update(0);ocean?.update(0,camera);ocean?.renderPasses(renderer,scene,camera);renderer.render(scene,camera);
  report.textContent=`Checking ${id}`;
  summary={scene:id,quality,buildMs:+buildMs.toFixed(2),shaderCompileMs:+compileMs.toFixed(2),firstDrawMs:+(performance.now()-drawStart).toFixed(2),programs:renderer.info.programs?.length,glError:renderer.getContext().getError(),water:ocean?.stats??null};
  report.textContent=JSON.stringify(summary,null,2);if(query.has('verify'))await verifySampler();building=false;select.disabled=false;
}

async function verifySampler():Promise<void>{
  if(!ocean){report.textContent='No open ocean in this scene';return;}
  const owner=ocean as unknown as {oceanMaterial:THREE.ShaderMaterial};
  const source=owner.oceanMaterial,n=48,geometry=new THREE.BufferGeometry(),positions:number[]=[],pixels:number[]=[],tangents:number[]=[];
  for(let i=0;i<n;i++){positions.push((i%12)*3-1,ocean.seaLevel,-Math.floor(i/12)*9-3);pixels.push((i+.5)/n*2-1,0);tangents.push(1,0,0,-1);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aTestPixel',new THREE.Float32BufferAttribute(pixels,2));
  geometry.setAttribute('aOceanTangent',new THREE.Float32BufferAttribute(tangents,4));
  geometry.setAttribute('aShoreDistance',new THREE.Float32BufferAttribute(new Float32Array(n),1));
  const uniforms={...source.uniforms,uTestNormal:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:'attribute vec2 aTestPixel;\n'+source.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;','gl_Position = vec4(aTestPixel,0.0,1.0);gl_PointSize=1.0;'),
    fragmentShader:'uniform float uTestNormal;varying vec3 vWorld;varying vec3 vWaveNormal;void main(){gl_FragColor=uTestNormal>0.5?vec4(normalize(vWaveNormal),1.0):vec4(vWorld,1.0);}'});
  const testScene=new THREE.Scene();testScene.add(new THREE.Points(geometry,material));
  const target=new THREE.WebGLRenderTarget(n,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false});
  const world=new Float32Array(n*4),normals=new Float32Array(n*4);let maxHeightError=0,maxNormalError=0;
  const wasPaused=paused;paused=true;
  for(const time of [0,1.8,4.2,8.7]){
    uniforms.uTime.value=time;renderer.setRenderTarget(target);uniforms.uTestNormal.value=0;renderer.render(testScene,camera);renderer.readRenderTargetPixels(target,0,0,n,1,world);
    uniforms.uTestNormal.value=1;renderer.render(testScene,camera);renderer.readRenderTargetPixels(target,0,0,n,1,normals);
    for(let i=0;i<n;i++){const cpu=ocean.sampleWaterSurface(world[i*4],world[i*4+2],time);
      maxHeightError=Math.max(maxHeightError,Math.abs(cpu.height-world[i*4+1]));
      maxNormalError=Math.max(maxNormalError,Math.abs(cpu.nx-normals[i*4]),Math.abs(cpu.ny-normals[i*4+1]),Math.abs(cpu.nz-normals[i*4+2]));}
  }
  renderer.setRenderTarget(null);target.dispose();geometry.dispose();material.dispose();paused=wasPaused;
  summary={...summary,sampler:{points:n*4,maxHeightError,maxNormalError,pass:maxHeightError<0.035&&maxNormalError<0.015,glError:renderer.getContext().getError()}};
  report.textContent=JSON.stringify(summary,null,2);
}

const timer=new THREE.Clock();function frame(){requestAnimationFrame(frame);const dt=Math.min(timer.getDelta(),.05);if(building)return;if(!paused){clock.value+=dt;level?.update(dt);ocean?.update(dt,camera);}ocean?.renderPasses(renderer,scene,camera);renderer.render(scene,camera);}
void build(query.get('scene')??'fixture').then(()=>frame()).catch(error=>{report.textContent=String(error);console.error(error);});
