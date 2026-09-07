"""Pack the fitted modular Meshy kit, retaining normal and roughness maps.

The two meshes are near/far versions of the same individual stone. They share
one material and three small maps. Source images and raw PBR models stay in
the authoring directory; no credentials or signed URLs enter public files.
"""
from pathlib import Path
import hashlib
import io
import json
import os
import struct
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/jungle-kit'
OUT = ROOT / 'public/jungle-kit/modular'
OUT.mkdir(parents=True, exist_ok=True)
SPECS = json.loads((ROOT/'tools/jungle-kit/module-specs.json').read_text())

def pack(spec):
    name=spec['file']
    raw=(WORK/'modular-baked'/(name+'.glb')).read_bytes()
    n=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+n]); binary=raw[28+n:]
    assert len(doc['materials'])==1
    source_material=doc['materials'][0]
    views=[]; output=bytearray()
    def append(data,target=None):
        output.extend(b'\0' * (-len(output)%4))
        view={'buffer':0,'byteOffset':len(output),'byteLength':len(data)}
        if target:view['target']=target
        views.append(view);output.extend(data)
        return len(views)-1
    # Preserve accessor layout without copying a shared buffer view twice.
    mapping={}
    for accessor in doc['accessors']:
        old_id=accessor['bufferView']
        if old_id not in mapping:
            old=doc['bufferViews'][old_id]; start=old.get('byteOffset',0)
            new=append(binary[start:start+old['byteLength']],old.get('target'))
            if 'byteStride' in old:views[new]['byteStride']=old['byteStride']
            mapping[old_id]=new
        accessor['bufferView']=mapping[old_id]
    images=[]; textures=[]
    def texture(source_index,resolution,label,quality):
        image_def=doc['images'][doc['textures'][source_index]['source']]
        old=doc['bufferViews'][image_def['bufferView']]; start=old.get('byteOffset',0)
        image=Image.open(io.BytesIO(binary[start:start+old['byteLength']])).convert('RGB')
        image.thumbnail((resolution,resolution),Image.Resampling.LANCZOS)
        encoded=io.BytesIO();image.save(encoded,'JPEG',quality=quality,subsampling=0,optimize=True)
        images.append({'name':name+'-'+label,'bufferView':append(encoded.getvalue()),'mimeType':'image/jpeg'})
        textures.append({'source':len(images)-1,'sampler':0})
        return len(textures)-1
    def compressed_albedo(source_index):
        image_def=doc['images'][doc['textures'][source_index]['source']]
        old=doc['bufferViews'][image_def['bufferView']]; start=old.get('byteOffset',0)
        image=Image.open(io.BytesIO(binary[start:start+old['byteLength']])).convert('RGB')
        image.thumbnail((2048,2048),Image.Resampling.LANCZOS)
        texdir=WORK/'modular-textures';texdir.mkdir(exist_ok=True)
        png=texdir/(name+'-albedo.png');ktx=texdir/(name+'-albedo.ktx2')
        image.save(png)
        encoder=os.environ.get('JUNGLE_TOKTX','/tmp/jungle-ktx-runtime/bin/toktx')
        stamp=hashlib.sha256(png.read_bytes()).hexdigest()+'|toktx-4.4.2-etc1s-q255-c3-mips-srgb'
        stamp_file=ktx.with_suffix('.ktx2.source')
        if not ktx.exists() or not stamp_file.exists() or stamp_file.read_text()!=stamp:
            subprocess.run([encoder,'--t2','--encode','etc1s','--qlevel','255','--clevel','3',
                '--threads','2','--genmipmap','--assign_oetf','srgb',str(ktx),str(png)],check=True,capture_output=True)
            stamp_file.write_text(stamp)
        images.append({'name':name+'-albedo-gpu','bufferView':append(ktx.read_bytes()),'mimeType':'image/ktx2'})
        return len(images)-1
    pbr=source_material['pbrMetallicRoughness']
    base_texture=texture(pbr['baseColorTexture']['index'],1024,'albedo-fallback',94)
    textures[base_texture]['extensions']={'KHR_texture_basisu':{'source':compressed_albedo(pbr['baseColorTexture']['index'])}}
    material={'name':name+' stone','doubleSided':spec.get('doubleSided',False),'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':0.92,
        'baseColorTexture':{'index':base_texture}}}
    if 'normalTexture' in source_material:
        material['normalTexture']={'index':texture(source_material['normalTexture']['index'],512,'normal',96),'scale':spec['normal']}
    if 'metallicRoughnessTexture' in pbr:
        material['pbrMetallicRoughness']['metallicRoughnessTexture']={'index':texture(pbr['metallicRoughnessTexture']['index'],256,'roughness',92)}
    doc['materials']=[material]
    doc['extensionsUsed']=['KHR_texture_basisu']
    doc.pop('extensionsRequired',None) # JPEG fallback works without a GPU transcoder.
    doc['bufferViews']=views;doc['images']=images;doc['textures']=textures
    doc['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]
    doc['buffers']=[{'byteLength':len(output)}]
    doc['asset']={'version':'2.0','generator':'Meshy T2 / fitted modular Jungle Ruins kit',
        'copyright':'Created with Meshy and original OpenAI image generation for the project owner.',
        'extras':{'sizeMetres':spec['size'],'lods':2,'albedoResolution':2048,'fallbackResolution':1024,
        'encoder':'Khronos toktx 4.4.2 / ETC1S quality 255',
        'sourceSha256':hashlib.sha256((WORK/spec.get('sourceFile',name+'.glb')).read_bytes()).hexdigest()}}
    json_bytes=json.dumps(doc,separators=(',',':')).encode();json_bytes+=b' '*(-len(json_bytes)%4)
    output.extend(b'\0'*(-len(output)%4))
    glb=struct.pack('<III',0x46546c67,2,28+len(json_bytes)+len(output))+struct.pack('<II',len(json_bytes),0x4e4f534a)+json_bytes+struct.pack('<II',len(output),0x004e4942)+output
    (OUT/(name+'.glb')).write_bytes(glb)
    counts={node['name'].rsplit('_',1)[-1]:sum(doc['accessors'][p['indices']]['count']//3 for p in doc['meshes'][node['mesh']]['primitives']) for node in doc['nodes'] if 'mesh' in node}
    return {**spec,'texture':2048,'fallbackTexture':1024,'bytes':len(glb),'triangles':counts['LOD0'],'lodTriangles':counts['LOD1'],
        'sha256':hashlib.sha256(glb).hexdigest(),'sourceSha256':doc['asset']['extras']['sourceSha256']}

if __name__=='__main__':
    chosen=[s for s in SPECS if not sys.argv[1:] or s['file'] in sys.argv[1:]]
    report=[pack(s) for s in chosen]
    manifest_path=OUT/'manifest.json'
    existing=json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    by_file={entry['file']:entry for entry in [*existing,*report]}
    complete=[by_file[s['file']] for s in SPECS if s['file'] in by_file]
    manifest_path.write_text(json.dumps(complete,indent=2)+'\n')
    # The same authoring spec supplies the browser's type-safe editor catalog.
    lines=['// Generated by tools/jungle-kit/pack_modular.py from module-specs.json.',
        'export const JUNGLE_MODULES = {']
    for s in SPECS:
        lines.append('  '+s['kind']+': '+json.dumps({'file':'modular/'+s['file'],'label':s['label'],'size':s['size'],'wind':s.get('wind',False),'normalStrength':s['normal'],'lod':True,'doubleSided':s.get('doubleSided',False)},separators=(',',':'))+',')
    lines.extend(['} as const;', 'export type JungleModuleKind = keyof typeof JUNGLE_MODULES;',
        'export const JUNGLE_MODULE_KINDS = Object.keys(JUNGLE_MODULES) as JungleModuleKind[];', ''])
    (ROOT/'src/jungleModules.ts').write_text('\n'.join(lines))
    print(json.dumps(report,indent=2))
