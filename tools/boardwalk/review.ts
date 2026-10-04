import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {buildWoodPathLayout, UNITY_BEACH_BOARDWALK_PROFILE, type WoodPathPlankPiece, type WoodPathPolePiece} from '../../src/woodPathKit';
import {buildWoodPathMeshes, WOOD_PATH_PLANK_WEIGHTS, WOOD_PATH_POLE_WEIGHTS, woodPathMeshPaint} from '../../src/woodPathMeshes';

const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#dbe5df');document.body.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,300);
scene.add(new THREE.HemisphereLight('#fff2d5','#758b76',2.3));
const sun=new THREE.DirectionalLight('#fff1d7',2);sun.position.set(-8,18,10);scene.add(sun);
const orbit=new OrbitControls(camera,renderer.domElement);
let root=new THREE.Group(),seed=7319,mode='curved path';scene.add(root);
const errors:string[]=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const status=document.querySelector('#status')!;
const sampler={length:44,sampleAtDistance(d:number){const a=d*.019;
  return {center:[(1-Math.cos(a))/.019,4, -Math.sin(a)/.019] as [number,number,number],
    forward:[Math.sin(a),0,-Math.cos(a)] as [number,number,number],right:[-Math.cos(a),0,-Math.sin(a)] as [number,number,number],
    up:[0,1,0] as [number,number,number],width:5.4+.4*Math.sin(d*.15)};}};
function clear(){root.traverse(o=>{if((o as THREE.InstancedMesh).isInstancedMesh)(o as THREE.InstancedMesh).dispose();});scene.remove(root);root=new THREE.Group();scene.add(root);}
function path(){clear();mode='curved path';const layout=buildWoodPathLayout(sampler,{profile:UNITY_BEACH_BOARDWALK_PROFILE,
  plankSeed:seed,poleSeed:seed^0x6f2b,plankVariantWeights:WOOD_PATH_PLANK_WEIGHTS,poleVariantWeights:WOOD_PATH_POLE_WEIGHTS,fallbackBaseY:0});
  root.add(...buildWoodPathMeshes(layout,seed));camera.position.set(-15,13,8);orbit.target.set(2,3,-13);orbit.update();}
function swatches(){clear();mode='all nine models';const layout=buildWoodPathLayout(sampler,{includeSupports:false,includeHandrails:false});
  layout.planks=[];layout.poles=[];
  for(let i=0;i<3;i++){
    const plank:WoodPathPlankPiece={kind:'plank',index:i,distance:i,center:[0,1,-i*3],basis:{right:[1,0,0],up:[0,1,0],forward:[0,0,1]},size:[7,.35,1.3],yawDegrees:0,verticalOffset:0,scaleNoise:1,variantIndex:i,tonalBucket:3};layout.planks.push(plank);
    for(const [role,z,radius] of [['crossbeam',-11-i*2,.25],['top-rail',-19-i*2,.18]] as const){
      const piece:WoodPathPolePiece={kind:'pole',index:layout.poles.length,role,start:[-3.5,1,z],end:[3.5,1,z],center:[0,1,z],direction:[1,0,0],length:7,radius,variantIndex:i,tonalBucket:3,bayIndex:1};layout.poles.push(piece);
    }
  }
  root.add(...buildWoodPathMeshes(layout,seed));camera.position.set(-7,38,7);orbit.target.set(-4,0,-12);orbit.update();}
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;document.querySelector('#controls')!.append(b);};
add('Curved boardwalk',path);add('All nine models',swatches);add('Different seed',()=>{seed+=193;path();});
add('Scaffold side',()=>{camera.position.set(-15,3,-12);orbit.target.set(2,2,-14);orbit.update();});
path();
function draw(){requestAnimationFrame(draw);orbit.update();renderer.render(scene,camera);
  const models=new Map<string,number>();let instances=0;root.traverse(o=>{const m=o as THREE.InstancedMesh;if(m.isInstancedMesh){instances+=m.count;models.set(m.userData.woodPathModel,(models.get(m.userData.woodPathModel)??0)+m.count);}});
  status.textContent=JSON.stringify({mode,seed,paint:woodPathMeshPaint.status,instances,models:Object.fromEntries(models),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,errors},null,2);
}draw();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
