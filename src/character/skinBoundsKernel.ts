import type * as THREE from 'three';
import { SKIN_BOUNDS_WASM_BYTES } from './skinBoundsKernelBytes';
import { SKIN_BOUNDS_SIMD_WASM_BYTES } from './skinBoundsSimdKernelBytes';

export interface SkinBoundsVertices {
  positions: Float64Array;
  morphDeltas: Float64Array[];
  indices: Uint32Array;
  weights: Float64Array;
  kernelInputsFinite: boolean;
  highestWeightedIndex: number;
}
interface KernelExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  measure: (count:number,morphCount:number,base:number,deltas:number,influences:number,indices:number,weights:number,palette:number,inverse:number,out:number)=>number;
}
type Instantiate = (bytes:typeof SKIN_BOUNDS_WASM_BYTES)=>Promise<WebAssembly.WebAssemblyInstantiatedSource>;
interface ResidentVertices { generation:number; base:number; }
const MAX_WORKSPACE_BYTES=8*1024*1024, PAGE_BYTES=65536;

/** Optional exact f64 accelerator. SIMD pairs independent X/Y calculations;
 * unsupported browsers use scalar WebAssembly, then the original JS if needed.
 * Only the selected module is compiled, asynchronously, once.
 * The one bounded workspace is reused synchronously by every character/mesh.
 * Mutable inputs are copied on each measurement. Owners of immutable derived
 * vertex bundles may reuse their upload; a weak identity map retains only
 * offsets, never meshes or source arrays. Live pose data is always copied. */
export class SkinBoundsKernel {
  private status:'cold'|'loading'|'ready'|'unavailable'='cold';
  private pending:Promise<boolean>|null=null;
  private variant:'scalar'|'simd'|null=null;
  private exports:KernelExports|null=null;
  private floats:Float64Array|null=null;
  private integers:Uint32Array|null=null;
  private calls=0;
  private copiedBytes=0;
  private geometryUploads=0;
  private residentHits=0;
  private residentResets=0;
  private readonly residents=new WeakMap<SkinBoundsVertices,ResidentVertices>();
  private generation=0;
  private dynamicBytes=PAGE_BYTES;
  private residentEnd=PAGE_BYTES;
  private readonly fallbacks={unavailable:0,unsupported:0,small:0,invalid:0,oversize:0,nonfinite:0};

  constructor(private readonly instantiate?:Instantiate) {}

  warm():Promise<boolean> {
    if(this.status==='unavailable')return Promise.resolve(false);
    if(this.pending)return this.pending;
    this.status='loading';
    this.pending=(async()=>{
      try{
        if(typeof WebAssembly==='undefined'||new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw new Error('WebAssembly workspace unavailable');
        // Custom instantiators keep the scalar ABI. Unsupported SIMD runtimes
        // use that same fallback; neither variant relaxes f64 operation order.
        this.variant=!this.instantiate&&WebAssembly.validate(SKIN_BOUNDS_SIMD_WASM_BYTES)?'simd':'scalar';
        const bytes=this.variant==='simd'?SKIN_BOUNDS_SIMD_WASM_BYTES:SKIN_BOUNDS_WASM_BYTES;
        const result=await (this.instantiate??(data=>WebAssembly.instantiate(data)))(bytes);
        this.exports=result.instance.exports as KernelExports;
        this.refreshViews();this.status='ready';return true;
      }catch{this.status='unavailable';this.exports=null;return false;}
    })();
    return this.pending;
  }

  diagnostics() {
    return {status:this.status,variant:this.variant,calls:this.calls,copiedBytes:this.copiedBytes,
      geometryUploads:this.geometryUploads,residentHits:this.residentHits,residentResets:this.residentResets,
      workspaceBytes:this.exports?.memory.buffer.byteLength??0,maxWorkspaceBytes:MAX_WORKSPACE_BYTES,
      fallbacks:{...this.fallbacks}};
  }

  private refreshViews():void {
    const memory=this.exports!.memory.buffer;
    this.floats=new Float64Array(memory);this.integers=new Uint32Array(memory);
  }

  /** immutableVertices is opt-in: replacing any geometry/bind input must create
   * a new bundle identity. It never applies to morph weights or bone matrices. */
  measure(vertices:SkinBoundsVertices,morphs:readonly number[],palette:readonly THREE.Matrix4[],inverse:readonly number[],out:THREE.Box3,affine:boolean,immutableVertices=false):boolean {
    if(!affine){this.fallbacks.unsupported++;return false;}
    const count=vertices.positions.length/3,morphCount=vertices.morphDeltas.length;
    if(!Number.isSafeInteger(count)||vertices.indices.length!==count*4||vertices.weights.length!==count*4||
      vertices.morphDeltas.some(delta=>delta.length!==count*3)||inverse.length!==16||
      !Number.isInteger(vertices.highestWeightedIndex)||vertices.highestWeightedIndex < -1){this.fallbacks.invalid++;return false;}
    // Crossing the JS/native boundary is not worthwhile for tiny meshes.
    if(count<256){this.fallbacks.small++;return false;}
    if(this.status==='cold')void this.warm();
    if(!this.exports){this.fallbacks.unavailable++;return false;}
    let base=48,deltas=base+count*24,influences=deltas+count*24*morphCount;
    let weights=influences+morphCount*8,indices=weights+count*32;
    let matrices=indices+count*16,inv=matrices+palette.length*128,bytes=inv+128;
    if(bytes>MAX_WORKSPACE_BYTES){this.fallbacks.oversize++;return false;}
    if(!vertices.kernelInputsFinite||vertices.highestWeightedIndex>=palette.length){this.fallbacks.invalid++;return false;}
    for(let i=0;i<morphCount;i++)if(!Number.isFinite(morphs[i]??0)){this.fallbacks.invalid++;return false;}
    for(let i=0;i<palette.length;i++){
      if(palette[i].elements.length!==16){this.fallbacks.invalid++;return false;}
      for(const value of palette[i].elements)if(!Number.isFinite(value)){this.fallbacks.invalid++;return false;}
      const m=palette[i].elements;
      if(m[3]!==0||m[7]!==0||m[11]!==0||!Number.isFinite(1/m[15])){this.fallbacks.unsupported++;return false;}
    }
    for(const value of inverse)if(!Number.isFinite(value)){this.fallbacks.invalid++;return false;}
    if(inverse[3]!==0||inverse[7]!==0||inverse[11]!==0||!Number.isFinite(1/inverse[15])){this.fallbacks.unsupported++;return false;}
    try{
      const geometryBytes=count*(72+24*morphCount),poseBytes=morphCount*8+(palette.length+1)*128;
      const reserve=Math.max(this.dynamicBytes,Math.ceil((48+poseBytes)/PAGE_BYTES)*PAGE_BYTES);
      const resident=immutableVertices&&reserve+geometryBytes<=MAX_WORKSPACE_BYTES;
      let upload=true;
      if(resident){
        if(reserve!==this.dynamicBytes){
          this.dynamicBytes=reserve;this.residentEnd=reserve;this.generation++;this.residentResets++;
        }
        const saved=this.residents.get(vertices);
        if(saved?.generation===this.generation){base=saved.base;upload=false;}
        else{
          // Reclaim the arena as a whole. Old weak entries are invalidated by
          // generation, so churn cannot grow native memory beyond the cap.
          if(this.residentEnd+geometryBytes>MAX_WORKSPACE_BYTES){
            this.residentEnd=this.dynamicBytes;this.generation++;this.residentResets++;
          }
          base=this.residentEnd;this.residentEnd+=geometryBytes;
        }
        deltas=base+count*24;weights=deltas+count*24*morphCount;indices=weights+count*32;
        influences=48;matrices=influences+morphCount*8;inv=matrices+palette.length*128;
        bytes=base+geometryBytes;
      }else if(this.residentEnd!==this.dynamicBytes){
        // A mutable or nearly arena-sized input uses the original packed
        // layout. Its writes may overlap any resident, including the prefix.
        this.residentEnd=this.dynamicBytes;this.generation++;this.residentResets++;
      }
      if(bytes>this.exports.memory.buffer.byteLength){
        this.exports.memory.grow(Math.ceil(bytes/PAGE_BYTES)-this.exports.memory.buffer.byteLength/PAGE_BYTES);
        this.refreshViews();
      }
      const f=this.floats!,u=this.integers!;
      if(upload){
        f.set(vertices.positions,base/8);
        for(let i=0;i<morphCount;i++)f.set(vertices.morphDeltas[i],deltas/8+i*count*3);
        f.set(vertices.weights,weights/8);u.set(vertices.indices,indices/4);
        this.copiedBytes+=geometryBytes;this.geometryUploads++;
        if(resident)this.residents.set(vertices,{generation:this.generation,base});
      }else{
        this.residentHits++;
      }
      for(let i=0;i<morphCount;i++)f[influences/8+i]=morphs[i]??0;
      // The homogeneous divisor is constant for these finite affine inputs.
      // Matrix inversion can produce d=1±ulp: preserve its exact reciprocal
      // and its original multiplication point, rather than normalizing the
      // matrix or dropping the division. Slot 15 is private workspace ABI.
      for(let i=0;i<palette.length;i++){
        f.set(palette[i].elements,matrices/8+i*16);
        f[matrices/8+i*16+15]=1/palette[i].elements[15];
      }
      f.set(inverse,inv/8);f[inv/8+15]=1/inverse[15];
      this.copiedBytes+=poseBytes;
      // Overflow or invalid intermediate arithmetic retains the scalar
      // project's homogeneous-divisor behavior through the JS fallback.
      if(!this.exports.measure(count,morphCount,base,deltas,influences,indices,weights,matrices,inv,0)){
        this.fallbacks.nonfinite++;return false;
      }
      out.min.set(f[0],f[1],f[2]);out.max.set(f[3],f[4],f[5]);this.calls++;return true;
    }catch{
      // Allocation/CSP/runtime failure is permanent for this optional helper.
      this.status='unavailable';this.exports=null;this.floats=null;this.integers=null;this.fallbacks.unavailable++;return false;
    }
  }
}

export const sharedSkinBoundsKernel=new SkinBoundsKernel();
export const warmSkinBoundsKernel=()=>sharedSkinBoundsKernel.warm();
export const skinBoundsKernelDiagnostics=()=>sharedSkinBoundsKernel.diagnostics();
