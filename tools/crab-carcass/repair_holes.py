"""Add caps for three measured pinholes; retain every original surface attribute."""
from collections import defaultdict
import struct


def cap_pinholes(doc, binary):
    def read(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        columns={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        fmt='<'+{5126:'f',5123:'H',5125:'I'}[a['componentType']]*columns
        stride=view.get('byteStride',struct.calcsize(fmt));offset=view.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from(fmt,binary,offset+i*stride) for i in range(a['count'])]
    primitive=doc['meshes'][0]['primitives'][0]
    points=read(primitive['attributes']['POSITION']);indices=[x[0] for x in read(primitive['indices'])]
    welded={};vertex=[];representative={}
    for i,p in enumerate(points):
        key=tuple(round(x,6) for x in p);v=welded.setdefault(key,len(welded));vertex.append(v);representative[v]=i
    edges=defaultdict(list)
    for i in range(0,len(indices),3):
        tri=indices[i:i+3]
        for j in range(3):
            a,b=tri[j],tri[(j+1)%3];edges[tuple(sorted((vertex[a],vertex[b])))].append((a,b))
    boundary=[values[0] for values in edges.values() if len(values)==1]
    neighbours=defaultdict(list);outgoing={}
    for a,b in boundary:
        neighbours[vertex[a]].append(vertex[b]);neighbours[vertex[b]].append(vertex[a]);outgoing[vertex[a]]=(a,b)
    remaining=set(neighbours);patches=[];caps=[]
    while remaining:
        root=min(remaining);stack=[root];component=set()
        while stack:
            v=stack.pop()
            if v in component:continue
            component.add(v);stack.extend(neighbours[v])
        remaining-=component
        ps=[points[representative[v]] for v in sorted(component)]
        extent=max(max(p[i] for p in ps)-min(p[i] for p in ps) for i in range(3))
        # Leave large anatomical openings and intersecting generated panels
        # alone. These three compact holes were visible in the eye and limbs.
        if len(component)>5 or extent>.04 or any(len(neighbours[v])!=2 for v in component):continue
        ordered=[];v=root
        for _ in component:
            a,b=outgoing[v];ordered.append(a);v=vertex[b]
        assert v==root and len(set(vertex[i] for i in ordered))==len(component)
        # Reverse the existing boundary winding; source UVs and vertex normals
        # remain attached to the exact original vertices on either side.
        for j in range(1,len(ordered)-1):caps.extend((ordered[0],ordered[j+1],ordered[j]))
        patches.append({'boundaryVertices':len(ordered),'triangles':len(ordered)-2,
            'center':[sum(p[i] for p in ps)/len(ps) for i in range(3)],'sourceExtent':extent})
    assert len(patches)==3 and len(caps)//3==8, 'Reviewed pinhole topology changed'
    data=bytearray(binary)
    while len(data)%4:data.append(0)
    view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(data),'byteLength':len(caps)*4,'target':34963})
    data.extend(struct.pack('<'+'I'*len(caps),*caps))
    accessor=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5125,'count':len(caps),'type':'SCALAR'})
    doc['meshes'][0]['primitives'].append({'attributes':dict(primitive['attributes']),'indices':accessor,'material':primitive['material'], 'mode':4})
    doc['buffers'][0]['byteLength']=len(data)
    assert bytes(data[:len(binary)])==binary
    return bytes(data),patches
