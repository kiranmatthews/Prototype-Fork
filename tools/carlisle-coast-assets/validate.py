"""Verify generated kit geometry, texture fallbacks, GPU mip chains and billing."""
import hashlib
import json
import math
from pathlib import Path
import re
import struct

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/carlisle-coast'
report=json.loads((OUT/'provenance.json').read_text())
assert len(report['models'])==6
assert report['credits']['consumed']==90
assert report['credits']['startingBalance']-report['credits']['endingBalance']==90
assert sum(t['consumedCredits'] for t in report['tasks'].values())==90
assert len({t['id'] for t in report['tasks'].values()})==6
for metadata in [OUT/'provenance.json',*OUT.glob('*-manifest.json')]:
    assert not re.search(r'msy_|Bearer\s|Authorization|[?&](?:token|signature|X-Amz)',metadata.read_text(),re.I),metadata
for model in report['models']:
    path=OUT/model['path']; blob=path.read_bytes()
    magic,version,length=struct.unpack_from('<III',blob)
    assert magic==0x46546c67 and version==2 and length==len(blob)
    assert length==model['bytes'] and hashlib.sha256(blob).hexdigest()==model['sha256']
    if model['name'] in ['plank','beam']:
        span=model['sourceSpanGltf']
        assert span[0]>span[2]*4, 'Timber long axis must be local X'
    json_size,json_type=struct.unpack_from('<II',blob,12)
    assert json_type==0x4e4f534a
    doc=json.loads(blob[20:20+json_size]); binary=blob[28+json_size:]
    assert len(doc['materials'])==1
    assert len(doc['meshes'])==2
    assert not doc.get('animations') and not doc.get('skins')
    for view in doc['bufferViews']:
        assert view.get('byteOffset',0)%4==0
        assert view.get('byteOffset',0)+view['byteLength']<=len(binary)
    triangles=[]
    for mesh in doc['meshes']:
        assert len(mesh['primitives'])==1
        primitive=mesh['primitives'][0]
        assert primitive.get('material',0)==0 and primitive.get('mode',4)==4
        triangles.append(doc['accessors'][primitive['indices']]['count']//3)
        positions=doc['accessors'][primitive['attributes']['POSITION']]
        assert positions['type']=='VEC3' and positions['componentType']==5126
        view=doc['bufferViews'][positions['bufferView']]
        offset=view.get('byteOffset',0)+positions.get('byteOffset',0)
        stride=view.get('byteStride',12)
        for i in range(positions['count']):
            point=struct.unpack_from('<fff',binary,offset+i*stride)
            assert all(math.isfinite(x) for x in point)
        for label in ['_JUNGLE_AO','_WIND_FLEX']:
            custom=doc['accessors'][primitive['attributes'][label]]
            assert custom['componentType']==5126 and custom['type']=='SCALAR' and custom['count']==positions['count']
            view=doc['bufferViews'][custom['bufferView']];start=view.get('byteOffset',0)+custom.get('byteOffset',0)
            scalar=struct.unpack_from('<'+'f'*custom['count'],binary,start)
            assert all(math.isfinite(x) and 0<=x<=1 for x in scalar)
            if label=='_JUNGLE_AO': assert min(scalar)>=.799999
        assert 'COLOR_0' not in primitive['attributes']
        assert all(math.isfinite(x) for x in positions['min']+positions['max'])
        assert all(b>a for a,b in zip(positions['min'],positions['max']))
    assert sorted(triangles)==sorted([model['triangles'],model['lodTriangles']])
    assert 100<=model['triangles']<=10000 and 500<=model['lodTriangles']<=1500 and model['lodTriangles']<model['triangles']*.34
    assert len(doc['textures'])==2
    assert 'KHR_texture_basisu' in doc['extensionsUsed']
    assert 'KHR_texture_basisu' not in doc.get('extensionsRequired',[])
    for index,texture in enumerate(doc['textures']):
        fallback=doc['images'][texture['source']]
        assert fallback['mimeType']=='image/jpeg'
        gpu=doc['images'][texture['extensions']['KHR_texture_basisu']['source']]
        assert gpu['mimeType']=='image/ktx2'
        view=doc['bufferViews'][gpu['bufferView']]; start=view.get('byteOffset',0)
        data=binary[start:start+view['byteLength']]
        assert data[:12]==b'\xabKTX 20\xbb\r\n\x1a\n'
        width,height=struct.unpack_from('<II',data,20)
        expected=model['albedoResolution'] if index==0 else model['normalResolution']
        assert (width,height)==(expected,expected)
        levels=struct.unpack_from('<I',data,40)[0]
        assert levels==int(math.log2(width))+1
    print(model['name'],model['triangles'],'triangles',round(length/1048576,2),'MiB',flush=True)
print('Six Carlisle Coast atlas GLBs passed finite geometry, LOD, JPEG fallback, compressed mipmap and exact credit checks.')
