/**
 * Deterministically index an expanded triangle list without changing any
 * Float32 attribute bits or triangle order.
 *
 * Attribute tuples are keyed by their raw Uint32 words. An optional Uint8
 * discriminator keeps semantically disconnected vertices (for example,
 * separate garment islands) from being welded together.
 */
export function indexGeneratedGeometry(attributes, discriminator = null) {
  const entries = Object.entries(attributes);
  if (entries.length === 0) throw new Error('at least one Float32 attribute is required');
  const vertexCount = entries[0][1].values.length / entries[0][1].itemSize;
  if (!Number.isInteger(vertexCount)) throw new Error('attribute length is not vertex-aligned');
  for (const [name, attribute] of entries) {
    if (!(attribute.values instanceof Float32Array)) {
      throw new Error(`${name} must be a Float32Array`);
    }
    if (attribute.values.length !== vertexCount * attribute.itemSize) {
      throw new Error(`${name} has a mismatched vertex count`);
    }
  }
  if (discriminator && discriminator.length !== vertexCount) {
    throw new Error('discriminator has a mismatched vertex count');
  }

  const words = new Map(entries.map(([name, attribute]) => [
    name,
    new Uint32Array(
      attribute.values.buffer,
      attribute.values.byteOffset,
      attribute.values.byteLength / Uint32Array.BYTES_PER_ELEMENT,
    ),
  ]));
  const uniqueValues = new Map(entries.map(([name]) => [name, []]));
  const uniqueDiscriminator = discriminator ? [] : null;
  const firstByTuple = new Map();
  const indices = new Uint16Array(vertexCount);

  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const keyWords = [];
    for (const [name, attribute] of entries) {
      const sourceWords = words.get(name);
      const offset = vertex * attribute.itemSize;
      for (let component = 0; component < attribute.itemSize; component++) {
        keyWords.push(sourceWords[offset + component]);
      }
    }
    if (discriminator) keyWords.push(discriminator[vertex]);
    const key = keyWords.join(',');
    let indexedVertex = firstByTuple.get(key);
    if (indexedVertex === undefined) {
      indexedVertex = firstByTuple.size;
      if (indexedVertex > 0xffff) {
        throw new Error('generated mesh needs more than 65536 indexed vertices');
      }
      firstByTuple.set(key, indexedVertex);
      for (const [name, attribute] of entries) {
        const target = uniqueValues.get(name);
        const offset = vertex * attribute.itemSize;
        for (let component = 0; component < attribute.itemSize; component++) {
          target.push(attribute.values[offset + component]);
        }
      }
      if (uniqueDiscriminator) uniqueDiscriminator.push(discriminator[vertex]);
    }
    indices[vertex] = indexedVertex;
  }

  return {
    attributes: Object.fromEntries(
      entries.map(([name]) => [name, new Float32Array(uniqueValues.get(name))]),
    ),
    discriminator: uniqueDiscriminator ? new Uint8Array(uniqueDiscriminator) : null,
    indices,
  };
}

export function encodeFloat32(values) {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('base64');
}

export function encodeUint16(values) {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('base64');
}
