import type * as THREE from 'three';
import { SKIN_BOUNDS_WASM_BYTES } from './skinBoundsKernelBytes';

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
const MAX_WORKSPACE_BYTES=8*1024*1024, PAGE_BYTES=65536;

/** Optional exact scalar accelerator. WebAssembly is compiled asynchronously
 * once; unsupported browsers or CSP simply continue using the original JS.
 * The one bounded workspace is reused synchronously by every character/mesh.
 * All input is copied on each measurement, so geometry edits and live poses
 * cannot leave a stale native arena or retain a removed mesh. */
export class SkinBoundsKernel {
  private status:'cold'|'loading'|'ready'|'unavailable'='cold';
  private pending:Promise<boolean>|null=null;
  private exports:KernelExports|null=null;
  private floats:Float64Array|null=null;
  private integers:Uint32Array|null=null;
  private calls=0;
  private copiedBytes=0;
  private readonly fallbacks={unavailable:0,unsupported:0,small:0,invalid:0,oversize:0,nonfinite:0};

  constructor(private readonly instantiate?:Instantiate) {}

  warm():Promise<boolean> {
    if(this.status==='unavailable')return Promise.resolve(false);
    if(this.pending)return this.pending;
    this.status='loading';
    this.pending=(async()=>{
      try{
        if(typeof WebAssembly==='undefined'||new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw new Error('WebAssembly workspace unavailable');
        const result=await (this.instantiate??(bytes=>WebAssembly.instantiate(bytes)))(SKIN_BOUNDS_WASM_BYTES);
        this.exports=result.instance.exports as KernelExports;
        this.refreshViews();this.status='ready';return true;
      }catch{this.status='unavailable';this.exports=null;return false;}
    })();
    return this.pending;
  }

  diagnostics() {
    return {status:this.status,calls:this.calls,copiedBytes:this.copiedBytes,
      workspaceBytes:this.exports?.memory.buffer.byteLength??0,maxWorkspaceBytes:MAX_WORKSPACE_BYTES,
      fallbacks:{...this.fallbacks}};
  }

  private refreshViews():void {
    const memory=this.exports!.memory.buffer;
    this.floats=new Float64Array(memory);this.integers=new Uint32Array(memory);
  }

  measure(vertices:SkinBoundsVertices,morphs:readonly number[],palette:readonly THREE.Matrix4[],inverse:readonly number[],out:THREE.Box3,affine:boolean):boolean {
    if(!affine){this.fallbacks.unsupported++;return false;}
    const count=vertices.positions.length/3,morphCount=vertices.morphDeltas.length;
    if(!Number.isSafeInteger(count)||vertices.indices.length!==count*4||vertices.weights.length!==count*4||
      vertices.morphDeltas.some(delta=>delta.length!==count*3)||inverse.length!==16||
      !Number.isInteger(vertices.highestWeightedIndex)||vertices.highestWeightedIndex < -1){this.fallbacks.invalid++;return false;}
    // Crossing the JS/native boundary is not worthwhile for tiny meshes.
    if(count<256){this.fallbacks.small++;return false;}
    if(this.status==='cold')void this.warm();
    if(!this.exports){this.fallbacks.unavailable++;return false;}
    const base=48,deltas=base+count*24,influences=deltas+count*24*morphCount;
    const weights=influences+morphCount*8,indices=weights+count*32;
    const matrices=indices+count*16,inv=matrices+palette.length*128,bytes=inv+128;
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
      if(bytes>this.exports.memory.buffer.byteLength){
        this.exports.memory.grow(Math.ceil(bytes/PAGE_BYTES)-this.exports.memory.buffer.byteLength/PAGE_BYTES);
        this.refreshViews();
      }
      const f=this.floats!,u=this.integers!;
      f.set(vertices.positions,base/8);
      for(let i=0;i<morphCount;i++){
        f.set(vertices.morphDeltas[i],deltas/8+i*count*3);
        f[influences/8+i]=morphs[i]??0;
      }
      f.set(vertices.weights,weights/8);u.set(vertices.indices,indices/4);
      // The homogeneous divisor is constant for these finite affine inputs.
      // Matrix inversion can produce d=1±ulp: preserve its exact reciprocal
      // and its original multiplication point, rather than normalizing the
      // matrix or dropping the division. Slot 15 is private workspace ABI.
      for(let i=0;i<palette.length;i++){
        f.set(palette[i].elements,matrices/8+i*16);
        f[matrices/8+i*16+15]=1/palette[i].elements[15];
      }
      f.set(inverse,inv/8);f[inv/8+15]=1/inverse[15];
      this.copiedBytes+=bytes-base;
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
