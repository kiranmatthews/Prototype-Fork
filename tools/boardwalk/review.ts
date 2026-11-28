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
// The carpentry at eight heights, side by side, left to right: a stub on ground, knee braces on short piles,
// a boardwalk on ground (knee braces, the way under it open), one panel on piles, one panel above head height
// on ground, a two-panel trestle, a three-panel trestle of spliced logs, and a deck too wide to cross.
const HEIGHTS:{post:number;ground:boolean;width:number}[]=[{post:.9,ground:true,width:5},{post:1.7,ground:false,width:5},
  {post:3.5,ground:true,width:5},{post:4.3,ground:false,width:5},{post:5.6,ground:true,width:5},{post:8,ground:false,width:5},
  {post:13,ground:false,width:5},{post:4.3,ground:false,width:11}];
function heights(){clear();mode='carpentry by height';let x=0;
  HEIGHTS.forEach((row,index)=>{
    x+=row.width/2+3;const at=x;x+=row.width/2+3;
    const layout=buildWoodPathLayout({length:13.5,sampleAtDistance:d=>({center:[at,row.post+.55,-d] as [number,number,number],
      forward:[0,0,-1] as [number,number,number],right:[-1,0,0] as [number,number,number],up:[0,1,0] as [number,number,number],width:row.width})},
      {profile:UNITY_BEACH_BOARDWALK_PROFILE,plankSeed:seed+index,poleSeed:(seed+index)^0x6f2b,plankVariantWeights:WOOD_PATH_PLANK_WEIGHTS,
        poleVariantWeights:WOOD_PATH_POLE_WEIGHTS,fallbackBaseY:0,supportBottom:row.ground?r=>[r.top[0],0,r.top[2]]:undefined});
    root.add(...buildWoodPathMeshes(layout,seed+index));
  });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(x+6,26),new THREE.MeshLambertMaterial({color:'#b9a988'}));
  floor.rotation.x=-Math.PI/2;floor.position.set(x/2,-.01,-6.75);root.add(floor);
  camera.position.set(x/2,9,34);orbit.target.set(x/2,4,-6);orbit.update();}
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;document.querySelector('#controls')!.append(b);};
add('Curved boardwalk',path);add('All nine models',swatches);add('Different seed',()=>{seed+=193;path();});
add('Scaffold side',()=>{camera.position.set(-15,3,-12);orbit.target.set(2,2,-14);orbit.update();});
add('Carpentry by height',heights);
// ?mode=heights opens on the row of heights; ?cam=x,y,z&look=x,y,z places the camera (for review pictures).
const query=new URLSearchParams(location.search);
if(query.get('mode')==='heights')heights();else path();
const numbers=(key:string)=>query.get(key)?.split(',').map(Number).filter(Number.isFinite);
const cam=numbers('cam'),look=numbers('look');
if(cam?.length===3){camera.position.set(cam[0],cam[1],cam[2]);if(look?.length===3)orbit.target.set(look[0],look[1],look[2]);orbit.update();}
if(query.has('clean'))(document.querySelector('aside') as HTMLElement).style.display='none';
function draw(){requestAnimationFrame(draw);orbit.update();renderer.render(scene,camera);
  const models=new Map<string,number>();let instances=0;root.traverse(o=>{const m=o as THREE.InstancedMesh;if(m.isInstancedMesh){instances+=m.count;models.set(m.userData.woodPathModel,(models.get(m.userData.woodPathModel)??0)+m.count);}});
  status.textContent=JSON.stringify({mode,seed,paint:woodPathMeshPaint.status,instances,models:Object.fromEntries(models),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,errors},null,2);
}draw();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
