"""Preserve supplied Meshy geometry/UVs; right-size embedded textures for a 0.96 m prop.
Run with a Python containing Pillow, passing the two original GLBs as arguments.
"""
import io,json,struct,sys,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]

def prepare(source, name, dimensions):
    raw=Path(source).read_bytes()
    size,kind=struct.unpack_from('<II',raw,12)
    data=json.loads(raw[20:20+size]);start=20+size
    bin_size,kind=struct.unpack_from('<II',raw,start)
    old=raw[start+8:start+8+bin_size]
    replacements={}
    for index,image in enumerate(data['images']):
        view=data['bufferViews'][image['bufferView']]
        offset=view.get('byteOffset',0)
        texture=Image.open(io.BytesIO(old[offset:offset+view['byteLength']])).convert('RGB')
        texture.thumbnail((dimensions[index],dimensions[index]),Image.Resampling.LANCZOS)
        stream=io.BytesIO();texture.save(stream,format='JPEG',quality=88,optimize=True)
        replacements[image['bufferView']]=stream.getvalue()
    packed=bytearray()
    for index,view in enumerate(data['bufferViews']):
        packed.extend(b'\0'*(-len(packed)%4))
        offset=view.get('byteOffset',0)
        chunk=replacements.get(index,old[offset:offset+view['byteLength']])
        view['byteOffset']=len(packed);view['byteLength']=len(chunk);packed.extend(chunk)
    for material in data['materials']:
        # These props are painted plastic/glass, not raw metal. Meshy's blue
        # metallic map channel is retained in the asset but has zero influence.
        material['pbrMetallicRoughness']['metallicFactor']=0
        material['pbrMetallicRoughness']['roughnessFactor']=.85
        material['normalTexture']['scale']=.45
        material['name']=name
    data['asset']['extras']={'sourceFile':Path(source).name,'sourceSha256':hashlib.sha256(raw).hexdigest(),'changes':'Original mesh and UVs; reduced JPEG sizes; dielectric material'}
    data['buffers'][0]['byteLength']=len(packed)
    header=json.dumps(data,separators=(',',':')).encode();header+=b' '*(-len(header)%4);packed+=b'\0'*(-len(packed)%4)
    output=struct.pack('<III',0x46546c67,2,28+len(header)+len(packed))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(packed),0x004e4942)+packed
    target=ROOT/'public/props/milk-crate'/f'{name}.glb';target.write_bytes(output)
    print(f'{target.name}: {len(raw):,} → {len(output):,} bytes; geometry unchanged')
if __name__=='__main__':
    prepare(sys.argv[1],'blue-crate',(1024,512,512))
    prepare(sys.argv[2],'milk-bottle',(512,256,256))
