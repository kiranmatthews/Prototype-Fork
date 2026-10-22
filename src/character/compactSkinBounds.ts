import type { SkinBoundsVertices } from './skinBoundsKernel';

/** Remove bit-identical samples from exclusively owned, derived bounds input.
 * Render geometry stays untouched. Include every morph delta, index and weight
 * so future live poses cannot separate two samples that were merged here.
 * Preserve first-occurrence order and signed zero; nonfinite data keeps the
 * original fallback loop. Work is paid only when source/bind data changes. */
export function compactSkinBoundsVertices(vertices:SkinBoundsVertices):void {
  const count=vertices.positions.length/3;
  // Tiny surfaces do not repay hashing. Bound transient indexing work for
  // unusually large imported meshes; they retain the original exact scan.
  if(!vertices.kernelInputsFinite||!Number.isInteger(count)||count<2048||count>131072||
    vertices.indices.length!==count*4||vertices.weights.length!==count*4)return;
  let bytes=vertices.positions.byteLength+vertices.indices.byteLength+vertices.weights.byteLength;
  for(const delta of vertices.morphDeltas){if(delta.length!==count*3)return;bytes+=delta.byteLength;}
  if(bytes>16*1024*1024)return;
  const fields=[
    {words:new Uint32Array(vertices.positions.buffer,vertices.positions.byteOffset,vertices.positions.length*2),width:6},
    {words:vertices.indices,width:4},
    {words:new Uint32Array(vertices.weights.buffer,vertices.weights.byteOffset,vertices.weights.length*2),width:8},
    ...vertices.morphDeltas.map(delta=>({words:new Uint32Array(delta.buffer,delta.byteOffset,delta.length*2),width:6})),
  ];
  let capacity=1;
  while(capacity<count*2)capacity*=2;
  const table=new Uint32Array(capacity),mask=capacity-1;
  let unique=0,probes=0;
  samples:for(let i=0;i<count;i++){
    let hash=2166136261;
    for(const {words,width} of fields){
      const offset=i*width;
      for(let c=0;c<width;c++)hash=Math.imul(hash^words[offset+c],16777619);
    }
    hash^=hash>>>16;
    let slot=hash&mask,duplicate=false;
    while(table[slot]){
      if(++probes>count*4){
        // Adversarial collisions must not make an optional preparation pass
        // quadratic. Keep the compacted prefix and append every unread sample;
        // this remains exact even when some duplicates survive the bailout.
        for(const {words,width} of fields)words.copyWithin(unique*width,i*width,count*width);
        unique+=count-i;
        break samples;
      }
      const candidate=table[slot]-1;
      let equal=true;
      for(const {words,width} of fields){
        const from=i*width,to=candidate*width;
        for(let c=0;c<width;c++)if(words[from+c]!==words[to+c]){equal=false;break;}
        if(!equal)break;
      }
      if(equal){duplicate=true;break;}
      slot=(slot+1)&mask;
    }
    if(duplicate)continue;
    // The compacted prefix never overwrites an unread source sample. Store
    // prefix indices so later probes still compare the original bit patterns.
    if(unique!==i)for(const {words,width} of fields)
      words.copyWithin(unique*width,i*width,(i+1)*width);
    table[slot]=++unique;
  }
  if(unique===count)return;
  // Release unused tails, rather than retaining the full buffers via subarray.
  vertices.positions=vertices.positions.slice(0,unique*3);
  vertices.indices=vertices.indices.slice(0,unique*4);
  vertices.weights=vertices.weights.slice(0,unique*4);
  vertices.morphDeltas=vertices.morphDeltas.map(delta=>delta.slice(0,unique*3));
}
