"""Ground and size the reviewed Meshy carcass preserving the source and capping three measured pinholes."""
from pathlib import Path
import hashlib
import json
import struct
from repair_holes import cap_pinholes

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT/'.img2threejs/crab-carcass/crab-stomped.glb'
OUTPUT = ROOT/'public/enemies/crab-stomped.glb'
EXPECTED_SOURCE = '73002db11b76bb0cb89a9280d7c82316cac0eb760ca9576d0383ff90e63459db'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    raw = SOURCE.read_bytes()
    assert sha(raw) == EXPECTED_SOURCE, 'Source differs from the reviewed model'
    magic, version, length = struct.unpack_from('<III', raw)
    assert (magic, version, length) == (0x46546c67, 2, len(raw))
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20+size])
    binary_chunks = raw[20+size:]
    binary_size,binary_kind = struct.unpack_from('<II',binary_chunks)
    assert binary_kind == 0x004e4942
    source_binary = binary_chunks[8:8+binary_size]
    assert len(doc['meshes']) == len(doc['nodes']) == 1
    assert doc['nodes'][0]['matrix'] == [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    prims = doc['meshes'][0]['primitives']
    bounds = [doc['accessors'][p['attributes']['POSITION']] for p in prims]
    low = [min(b['min'][axis] for b in bounds) for axis in range(3)]
    high = [max(b['max'][axis] for b in bounds) for axis in range(3)]
    scale = 1.4 / (high[0]-low[0])
    translation = [-.5*(low[0]+high[0])*scale, -low[1]*scale, -.5*(low[2]+high[2])*scale]
    triangles = sum(doc['accessors'][p['indices']]['count']//3 for p in prims)
    assert triangles == 15620
    task = json.loads((HERE/'tasks.json').read_text())['tasks']['crab-stomped']
    binary,patches = cap_pinholes(doc,source_binary)
    binary_chunks = struct.pack('<II',len(binary),binary_kind)+binary
    root = len(doc['nodes'])
    scene = doc['scenes'][doc.get('scene',0)]
    doc['nodes'].append({'name':'CoralCrab_GroundedFit', 'children':scene['nodes'],
        'scale':[scale]*3, 'translation':translation})
    scene['nodes'] = [root]
    provenance = {'schemaVersion':1, 'provider':'Meshy', 'generationTaskId':task['id'],
        'consumedCredits':task['consumedCredits'], 'sourceSha256':sha(raw),
        'reference':task['reference'], 'referenceSha256':task['referenceSha256'],
        'sourceTriangles':triangles, 'triangles':triangles+sum(p['triangles'] for p in patches), 'pinholeCaps':patches, 'textureResolution':[2048,2048],
        'reviewedSource':'.img2threejs/enemies/review/crab-stomped: front, quarter, side, back, top',
        'preparation':'Uniform fit and ground-contact parent; eight added triangles cap three reviewed pinholes. All original vertices, normals, UVs, indices, materials and 2K embedded textures retained byte-for-byte. No LOD or triangle reduction.',
        'artworkScale':2, 'worldSize':[(high[i]-low[i])*scale*2 for i in range(3)],
        'fitScale':scale, 'fitTranslation':translation}
    doc['asset']['extras'] = {'crabCarcass':provenance}
    encoded = json.dumps(doc,separators=(',',':')).encode()
    encoded += b' ' * (-len(encoded)%4)
    output = struct.pack('<III',magic,version,20+len(encoded)+len(binary_chunks)) + struct.pack('<II',len(encoded),kind) + encoded + binary_chunks
    OUTPUT.write_bytes(output)
    assert output[28+len(encoded):28+len(encoded)+len(source_binary)] == source_binary
    provenance.update(file=OUTPUT.name,bytes=len(output),sha256=sha(output),binaryPreserved=True)
    (OUTPUT.with_suffix('.provenance.json')).write_text(json.dumps(provenance,indent=2)+'\n')
    print(json.dumps(provenance,indent=2))

if __name__ == '__main__':
    main()
