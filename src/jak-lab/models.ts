import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {assetURL, type Catalogue, type MeshDeathReference, type ModelDefinition, type RenderingMode} from './types';
import {gouraudMaterial} from './gouraudMaterial';
import {compactGeometry} from './compactGeometry';
import {BackgroundPartSelection} from './backgroundParts';
import {preciseBounds} from './modelBounds';
import {ModelDeathPlayback} from './modelDeath';

const loader = new GLTFLoader();
const imagePixels = new WeakMap<object, ImageData>();

function pixels(texture: THREE.Texture): ImageData {
  const image = texture.image as HTMLImageElement | ImageBitmap;
  const cached = imagePixels.get(image); if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', {willReadFrequently: true})!;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  imagePixels.set(image, data); return data;
}

function sample(texture: THREE.Texture, uv: THREE.Vector2, result: THREE.Color): number {
  texture.transformUv(uv);
  const image = pixels(texture);
  const x = Math.max(0, Math.min(image.width - 1, uv.x * image.width - .5));
  const y = Math.max(0, Math.min(image.height - 1, uv.y * image.height - .5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const rgba = [0, 0, 0, 0];
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    const index = (Math.min(image.height - 1, y0 + row) * image.width + Math.min(image.width - 1, x0 + column)) * 4;
    const weight = (row ? fy : 1 - fy) * (column ? fx : 1 - fx) / 255;
    for (let channel = 0; channel < 4; channel++) rgba[channel] += image.data[index + channel] * weight;
  }
  result.setRGB(rgba[0], rgba[1], rgba[2], texture.colorSpace === THREE.SRGBColorSpace ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace);
  return rgba[3];
}

/** Vertex colour + vertex lighting, with original fragment opacity masks;
 * all authored triangles, weights, normals, morphs and tracks are retained. */
function gouraud(mesh: THREE.Mesh): void {
  const source = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
  let geometry = compactGeometry(mesh.geometry);
  // A GLTF multi-material mesh may share a vertex between distinct textures.
  // Expanding its indices preserves every triangle and gives each its own ink.
  if (source.length > 1 && geometry.index) {
    const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded;
  }
  mesh.geometry = geometry;
  // Prelit background exports may have colors/UVs but no normals. The Gouraud
  // alternative needs geometric normals for its vertex-lighting calculation.
  if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
  const uv = geometry.getAttribute('uv'), old = geometry.getAttribute('color');
  const color = new Float32Array(geometry.getAttribute('position').count * 4);
  const sampled = new THREE.Color(), coordinate = new THREE.Vector2();
  const paint = (index: number, material: THREE.MeshStandardMaterial) => {
    let alpha = 1; sampled.setRGB(1, 1, 1);
    if (material.map && uv) sample(material.map, coordinate.set(uv.getX(index), uv.getY(index)), sampled);
    if (old) sampled.multiply(new THREE.Color(old.getX(index), old.getY(index), old.getZ(index)));
    if (old?.itemSize === 4) alpha *= old.getW(index);
    color.set([sampled.r, sampled.g, sampled.b, alpha], index * 4);
  };
  if (source.length === 1) {
    for (let i = 0; i < color.length / 4; i++) paint(i, source[0]);
  } else for (const group of geometry.groups) {
    for (let i = group.start; i < group.start + group.count; i++) paint(i, source[group.materialIndex ?? 0]);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 4));
  const materials = source.map(gouraudMaterial);
  mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
}

export class ModelExhibit {
  readonly root = new THREE.Group();
  readonly original = new THREE.Group();
  readonly alternative = new THREE.Group();
  readonly clips: THREE.AnimationClip[];
  readonly dimensions: THREE.Vector3;
  readonly mixers: THREE.AnimationMixer[];
  private actions: THREE.AnimationAction[] = [];
  private view: RenderingMode = 'compare';
  private displayScale: number;
  private elapsed = 0;
  private readonly source: THREE.Object3D;
  private readonly derived: THREE.Object3D;
  private readonly sourcePosition: THREE.Vector3;
  readonly partSelection: BackgroundPartSelection | null;
  deathPlayback:ModelDeathPlayback|null=null;
  deathReplay='';
  private nativeScale=false;

  private constructor(source: THREE.Object3D, clips: THREE.AnimationClip[], readonly definition: ModelDefinition) {
    this.source = source;
    this.sourcePosition=source.position.clone();
    const bounds = preciseBounds(source), center = bounds.getCenter(new THREE.Vector3());
    this.dimensions = bounds.getSize(new THREE.Vector3());
    this.displayScale = Math.min(2, 3.8 / Math.max(...this.dimensions.toArray()));
    const derived = this.derived = clone(source);
    derived.traverse(node => {if (node instanceof THREE.Mesh) gouraud(node);});
    this.partSelection=definition.background?new BackgroundPartSelection(source,derived):null;
    source.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
    derived.position.copy(source.position);
    this.original.add(source); this.alternative.add(derived);
    this.root.add(this.original, this.alternative);
    this.clips = clips;
    this.mixers = [new THREE.AnimationMixer(source), new THREE.AnimationMixer(derived)];
    if (clips.length) this.setClip(clips.find(clip => /idle|stance|loop/i.test(clip.name))?.name ?? clips[0].name);
    this.setRendering('compare');
  }
  static async load(definition: ModelDefinition,death?:{catalogue:Catalogue;reference:MeshDeathReference}): Promise<ModelExhibit> {
    const url=assetURL(definition.path);
    let asset;
    if(definition.encoding==='gzip') {
      const response=await fetch(url);
      if(!response.ok||!response.body)throw new Error(`Model transfer failed (${response.status})`);
      const data=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      if(data.byteLength!==definition.decodedBytes)throw new Error('Incomplete model transfer');
      asset=await loader.parseAsync(data,new URL('./',new URL(url,location.href)).href);
    } else asset=await loader.loadAsync(url);
    // Keep the authoritative GLTF node IDs; Three sanitizes and uniquifies
    // display names, which are not stable identifiers for source prototypes.
    asset.scene.traverse(node=>{
      const index=asset.parser.associations.get(node)?.nodes;
      if(index!==undefined)node.userData.jakSourceNode=index;
    });
    const exhibit=new ModelExhibit(asset.scene, asset.animations, definition);
    if(death)try {
      exhibit.deathPlayback=await ModelDeathPlayback.load(death.reference,death.catalogue,exhibit.source,exhibit.derived,
        exhibit.original,exhibit.alternative);
      exhibit.setDeathReplay(death.reference.events.length?'event:0':definition.name==='generic-button-lod0'?'death-warp-out':'death-warp-in');
    } catch(error){exhibit.dispose();throw error;}
    return exhibit;
  }
  get scale(): number {return this.original.scale.x;}
  get time(): number {return this.elapsed;}
  get duration(): number {return this.deathPlayback?.active?this.deathPlayback.duration:this.actions[0]?.getClip().duration ?? 0;}
  get clipName(): string {return this.actions[0]?.getClip().name ?? '';}
  get inspectionSize(): THREE.Vector3 {
    const size = this.dimensions.clone().multiplyScalar(this.scale);
    if(this.deathPlayback)size.addScaledVector(new THREE.Vector3(2,4,2),this.scale);
    if (this.view === 'compare') size.x += Math.abs(this.original.position.x - this.alternative.position.x);
    return size;
  }
  setClip(name: string): void {
    const clip = this.clips.find(candidate => candidate.name === name); if (!clip) return;
    for (const action of this.actions) action.stop();
    this.actions = this.mixers.map(mixer => mixer.clipAction(clip).reset().play());
    this.seek(0);
  }
  setDeathReplay(value:string):void {
    const death=this.deathPlayback;if(!death)return;
    death.configure('');this.deathReplay=value;
    const event=value.startsWith('event:')?death.reference.events[Number(value.slice(6))]:undefined;
    if(event)this.setClip(event.clip);
    for(const action of this.actions){action.setLoop(event?THREE.LoopOnce:THREE.LoopRepeat,event?1:Infinity);action.clampWhenFinished=!!event;action.reset().play();}
    // The snake's straight bind pose extends tens of metres away from its
    // coiled animation. Frame the actual starting pose, preserving every vertex
    // and the clip's subsequent movement in both inspection modes.
    this.source.position.copy(this.sourcePosition);this.sampleAnimation(0);
    const bounds=preciseBounds(this.source),center=bounds.getCenter(new THREE.Vector3());
    bounds.getSize(this.dimensions);this.displayScale=Math.min(2,3.8/Math.max(...this.dimensions.toArray()));
    this.source.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    this.derived.position.copy(this.source.position);this.setNativeScale(this.nativeScale);
    death.configure(event?.effect??value,event?.seconds??0);this.seek(0);
  }
  setNativeScale(native: boolean): void {
    this.nativeScale=native;
    for (const group of [this.original, this.alternative]) group.scale.setScalar(native ? 1 : this.displayScale);
    const separation = Math.max(2.6, this.dimensions.x * this.scale * .5 + .6);
    this.original.position.x = this.view === 'compare' ? -separation : 0;
    this.alternative.position.x = this.view === 'compare' ? separation : 0;
  }
  setPart(id:string):void {
    if(!this.partSelection)return;
    this.partSelection.select(id);
    this.source.position.copy(this.sourcePosition);
    const bounds=preciseBounds(this.source),center=bounds.getCenter(new THREE.Vector3());
    bounds.getSize(this.dimensions);
    this.displayScale=Math.min(2,3.8/Math.max(...this.dimensions.toArray()));
    this.source.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    this.derived.position.copy(this.source.position);
    this.setNativeScale(this.nativeScale);
  }
  partSurfacePoint():THREE.Vector3|null {
    if(!this.partSelection?.current)return null;
    this.root.updateWorldMatrix(true,true);
    let point:THREE.Vector3|null=null;
    this.root.traverseVisible(node=>{
      if(point||!(node instanceof THREE.Mesh))return;
      const g=node.geometry,total=g.index?.count??g.getAttribute('position')?.count??0,start=g.drawRange.start;
      if(total-start<3||g.drawRange.count<3)return;
      point=new THREE.Vector3();
      for(let i=0;i<3;i++)point.add(node.getVertexPosition(g.index?g.index.getX(start+i):start+i,new THREE.Vector3()));
      point.multiplyScalar(1/3).applyMatrix4(node.matrixWorld);
    });
    return point;
  }
  setRendering(mode: RenderingMode): void {
    this.view = mode;
    this.original.visible = mode !== 'gouraud'; this.alternative.visible = mode !== 'original';
    this.setNativeScale(false);
  }
  seek(time: number): void {
    if(this.deathPlayback?.active){
      for(const action of this.actions)action.reset().play();
      this.deathPlayback.seek(time,value=>this.sampleAnimation(value));return;
    }
    this.sampleAnimation(time);
  }
  private sampleAnimation(time:number):void {
    this.elapsed = time;
    for (const mixer of this.mixers) mixer.setTime(time);
    // Keep both render modes in the same exact source pose.
    this.root.updateMatrixWorld(true);
  }
  update(dt: number): void {
    if(this.deathPlayback?.active)this.deathPlayback.update(dt,value=>this.sampleAnimation(value));
    else this.sampleAnimation(this.elapsed+dt);
  }
  get diagnostics() {return {view: this.view, scale: this.scale, clip: this.clipName, seconds: this.elapsed,
    sceneParts:this.partSelection?.parts.length??0,selectedPart:this.partSelection?.current?.id??null};}
  dispose(): void {
    this.deathPlayback?.dispose();
    for (const mixer of this.mixers) {mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot());}
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    for (const root of [this.source, this.derived]) root.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    const images=new Set<ImageBitmap>();
    for (const texture of textures) {
      const image=texture.image as ImageBitmap|undefined;
      if(image&&typeof image.close==='function')images.add(image);
      texture.dispose();
    }
    for(const image of images)image.close();
    this.root.removeFromParent();
  }
}
