import * as THREE from 'three';

/** Keep every index, triangle, attribute and morph value while dropping vertex
 * rows this mesh never draws. Background primitives share enormous source
 * buffers; copying those whole buffers per material would multiply memory. */
export function compactGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const indices = source.index;
  if (!indices) return source.clone();
  const rows: number[] = [], remap = new Map<number, number>(), mapped: number[] = [];
  for (let i = 0; i < indices.count; i++) {
    const original = indices.getX(i);
    let index = remap.get(original);
    if (index === undefined) {index = rows.length; remap.set(original, index); rows.push(original);}
    mapped.push(index);
  }
  const copy = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute => {
    const interleaved = 'isInterleavedBufferAttribute' in attribute && attribute.isInterleavedBufferAttribute;
    const data = interleaved ? attribute.data.array : attribute.array;
    const stride = interleaved ? attribute.data.stride : attribute.itemSize;
    const offset = interleaved ? attribute.offset : 0;
    const ArrayType = data.constructor as {new(length: number): THREE.TypedArray};
    const packed = new ArrayType(rows.length * attribute.itemSize);
    for (let target = 0; target < rows.length; target++) {
      if (rows[target] >= attribute.count) throw new Error('Source index exceeds vertex attribute');
      // Read the stored components directly; getX/getY would normalize integer
      // colors/weights and then quantize them a second time when storing them.
      for (let channel = 0; channel < attribute.itemSize; channel++)
        packed[target * attribute.itemSize + channel] = data[rows[target] * stride + offset + channel];
    }
    const result = new THREE.BufferAttribute(packed, attribute.itemSize, attribute.normalized);
    result.name = attribute.name;
    return result;
  };
  const geometry = new THREE.BufferGeometry();
  geometry.name = source.name; geometry.userData = {...source.userData};
  geometry.setIndex(mapped);
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, copy(attribute));
  for (const [name, targets] of Object.entries(source.morphAttributes)) {
    if (targets) geometry.morphAttributes[name as keyof typeof geometry.morphAttributes] = targets.map(copy);
  }
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  for (const group of source.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
  return geometry;
}
