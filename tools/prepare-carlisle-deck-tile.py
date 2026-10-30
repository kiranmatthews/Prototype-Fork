"""Trim joining edges of the generated deck modules; retain their depth and UVs.

The original GLBs remain alongside these fitted modules. This is a fixed join
cut, not simplification or a viewing-distance variant. Texture bytes are copied.
"""
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public/props/carlisle-decks'

def prepare(name, bounds):
    data = (ROOT / f'{name}.glb').read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20+size])
    binary = bytearray(data[size+28:])
    primitive = gltf['meshes'][0]['primitives'][0]

    def read(index):
        a = gltf['accessors'][index]
        view = gltf['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        fmt = {5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        values = struct.unpack_from('<'+fmt*a['count']*count, binary, offset)
        return [values[i:i+count] for i in range(0, len(values), count)]

    positions = read(primitive['attributes']['POSITION'])
    normals = read(primitive['attributes']['NORMAL'])
    uvs = read(primitive['attributes']['TEXCOORD_0'])
    triangles = [i[0] for i in read(primitive['indices'])]
    vertices = [list(p+n+uv) for p,n,uv in zip(positions,normals,uvs)]
    # Four half-spaces in the original model's coordinate system.
    xmin,xmax,zmin,zmax = bounds
    planes = [(0,1,-xmin),(0,-1,xmax),(2,1,-zmin),(2,-1,zmax)]
    result = []
    for i in range(0,len(triangles),3):
        polygon = triangles[i:i+3]
        for axis,sign,offset in planes:
            clipped=[]
            for j,a in enumerate(polygon):
                b=polygon[(j+1)%len(polygon)]
                da=vertices[a][axis]*sign+offset
                db=vertices[b][axis]*sign+offset
                if da>=-1e-8: clipped.append(a)
                if da>1e-8 and db<-1e-8 or da<-1e-8 and db>1e-8:
                    t=da/(da-db)
                    clipped.append(len(vertices))
                    vertices.append([v+(w-v)*t for v,w in zip(vertices[a],vertices[b])])
            polygon=clipped
            if not polygon: break
        for j in range(1,len(polygon)-1): result.extend([polygon[0],polygon[j],polygon[j+1]])
    remap={}
    packed=[]
    indices=[]
    for index in result:
        if index not in remap:
            remap[index]=len(packed)
            packed.append(vertices[index])
        indices.append(remap[index])

    def attribute(values, dimensions, kind, target):
        while len(binary)%4: binary.append(0)
        offset=len(binary)
        flat=[x for row in values for x in row]
        binary.extend(struct.pack('<'+('f' if kind==5126 else 'I')*len(flat),*flat))
        view=len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset,'target':target})
        accessor={'bufferView':view,'componentType':kind,'count':len(values),'type':{1:'SCALAR',2:'VEC2',3:'VEC3'}[dimensions]}
        if dimensions==3:
            accessor['min']=[min(row[i] for row in values) for i in range(3)]
            accessor['max']=[max(row[i] for row in values) for i in range(3)]
        result=len(gltf['accessors']);gltf['accessors'].append(accessor);return result

    primitive['attributes']={
        'POSITION':attribute([v[:3] for v in packed],3,5126,34962),
        'NORMAL':attribute([v[3:6] for v in packed],3,5126,34962),
        'TEXCOORD_0':attribute([v[6:8] for v in packed],2,5126,34962),
    }
    primitive['indices']=attribute([[i] for i in indices],1,5125,34963)
    gltf['buffers'][0]['byteLength']=len(binary)
    gltf['extras']={'authoring':'Carlisle join crop; original texture, sculpted depth and interior faces preserved','source':name+'.glb','joinBounds':bounds}
    raw=json.dumps(gltf,separators=(',',':')).encode()
    raw+=b' '*((-len(raw))%4)
    binary+=b'\0'*((-len(binary))%4)
    output=struct.pack('<III',0x46546c67,2,28+len(raw)+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary
    (ROOT/f'{name}-joined.glb').write_bytes(output)
    return {'source':name,'sourceTriangles':len(triangles)//3,'joinedTriangles':len(indices)//3,'vertices':len(packed),'joinBounds':bounds}

report=[prepare('solid-timber',[-.461,.467,-.257,.261]),prepare('broad-deck',[-.477,.477,-.280,.280])]
(ROOT/'join-cuts.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
