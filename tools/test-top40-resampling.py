"""Check the filter's colour, alpha, normal and data-map semantics."""
import importlib.util
from pathlib import Path
import numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('top40',Path(__file__).with_name('prepare-top40-glb-textures.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
resize=module.bicubic_sharper
source=Image.fromarray(np.array([[[0,0,0,255],[255,255,255,255]]],dtype=np.uint8))
colour=np.asarray(resize(source,(1,1),'baseColorTexture'))[0,0]
assert np.max(abs(colour[:3].astype(int)-188))<=1
linear=np.asarray(resize(source,(1,1),'metallicRoughnessTexture'))[0,0]
assert np.max(abs(linear[:3].astype(int)-128))<=1
transparent=Image.fromarray(np.array([[[255,0,0,255],[0,0,255,0]]],dtype=np.uint8))
edge=np.asarray(resize(transparent,(1,1),'baseColorTexture'))[0,0]
assert edge[0]>=254 and edge[2]<=1 and 126<=edge[3]<=129,'Hidden blue must not bleed into visible red'
normals=Image.fromarray(np.array([[[255,128,128,255],[128,255,128,255]]],dtype=np.uint8))
normal=np.asarray(resize(normals,(1,1),'normalTexture'))[0,0,:3]/127.5-1
assert abs(np.linalg.norm(normal)-1)<.01 and np.allclose(normal[:2],2**-.5,atol=.01)
flat=Image.new('RGBA',(1024,1024),(128,128,255,255))
assert np.array_equal(np.asarray(resize(flat,(256,256),'normalTexture')),np.full((256,256,4),(128,128,255,255),dtype=np.uint8))
assert resize(source,source.size,'baseColorTexture').tobytes()==source.tobytes()
print('PASS bicubic sharper: linear-light colour, alpha edges, unit normals, linear data, exact unchanged sizes')
