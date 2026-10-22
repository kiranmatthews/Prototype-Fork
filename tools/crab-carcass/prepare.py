"""Fit the reviewed Meshy X-only carcass without editing its surfaces or textures."""
from pathlib import Path
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
JOB = 'crab-stomped-x-only-final'
SOURCE = ROOT/'.img2threejs/crab-carcass'/JOB/'downloads/model.glb'
OUTPUT = ROOT/'public/enemies/crab-stomped.glb'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    tasks = json.loads((HERE/'tasks.json').read_text())['tasks']
    task = tasks[JOB]
    generation = tasks['crab-stomped-x-only']
    pipeline = [{key:tasks[job][key] for key in ('id','resource','consumedCredits')}
        for job in ('crab-stomped-x-only','crab-stomped-x-only-repaired',JOB)]
    assert task['state'] == 'SUCCEEDED', 'Use the recorded, completed Meshy job'
    download = next(item for item in task['downloads'] if item['path'].endswith('/model.glb'))
    raw = SOURCE.read_bytes()
    assert sha(raw) == download['sha256'], 'Source differs from the downloaded Meshy model'
    magic, version, length = struct.unpack_from('<III', raw)
    assert (magic, version, length) == (0x46546c67, 2, len(raw))
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20+size])
    binary_chunks = raw[20+size:]
    binary_size, binary_kind = struct.unpack_from('<II', binary_chunks)
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
    root = len(doc['nodes'])
    scene = doc['scenes'][doc.get('scene',0)]
    doc['nodes'].append({'name':'CoralCrab_GroundedFit', 'children':scene['nodes'],
        'scale':[scale]*3, 'translation':translation})
    scene['nodes'] = [root]
    provenance = {'schemaVersion':2, 'provider':'Meshy', 'generationTaskId':generation['id'],
        'assetTaskId':task['id'], 'assetJob':JOB, 'meshyPipeline':pipeline,
        'consumedCredits':sum(stage['consumedCredits'] for stage in pipeline), 'sourceSha256':sha(raw),
        'sourceBinarySha256':sha(source_binary),
        'reference':generation['reference'], 'referenceSha256':generation['referenceSha256'],
        'sourceTriangles':triangles, 'triangles':triangles, 'textureResolution':[2048,2048],
        'design':'Two X marks directly on a smooth flattened face; no eyeballs, eyebrows or runtime paint.',
        'preparation':'Uniform fit and ground-contact parent only. Complete original Meshy binary retained byte-for-byte: all vertices, normals, UVs, indices, materials and 2K embedded textures. No surface edits, caps, decimation, LOD or texture resizing.',
        'artworkScale':2, 'worldSize':[(high[i]-low[i])*scale*2 for i in range(3)],
        'fitScale':scale, 'fitTranslation':translation}
    doc['asset']['extras'] = {'crabCarcass':provenance}
    encoded = json.dumps(doc,separators=(',',':')).encode()
    encoded += b' ' * (-len(encoded)%4)
    output = struct.pack('<III',magic,version,20+len(encoded)+len(binary_chunks)) + struct.pack('<II',len(encoded),kind) + encoded + binary_chunks
    assert output[28+len(encoded):28+len(encoded)+len(source_binary)] == source_binary
    OUTPUT.write_bytes(output)
    provenance.update(file=OUTPUT.name,bytes=len(output),sha256=sha(output),binaryPreserved=True)
    (OUTPUT.with_suffix('.provenance.json')).write_text(json.dumps(provenance,indent=2)+'\n')
    print(json.dumps(provenance,indent=2))


if __name__ == '__main__':
    main()
