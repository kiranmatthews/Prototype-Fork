"""Numerical checks for the colour/vector/data-map distinction."""
from PIL import Image
import numpy as np
from texture_resampling import resize_map

def image(values):return Image.fromarray(np.array(values,dtype=np.uint8))
# Equal black/white energy should remain equal in linear light, not become
# gamma-space mid-grey. A 1px output cannot be affected by the sharpness pass.
source=image([[[0,0,0,255],[255,255,255,255]]]);original=source.tobytes()
colour=np.asarray(resize_map(source,(1,1),'baseColorTexture'))[0,0]
assert np.max(np.abs(colour[:3].astype(int)-188))<=1,colour
assert colour[3]==255 and source.tobytes()==original
# Packed data channels are already linear and must not receive gamma/sharpen.
data=np.asarray(resize_map(source,(1,1),'metallicRoughnessTexture'))[0,0]
assert np.max(np.abs(data[:3].astype(int)-128))<=1,data
# +X and +Y normal directions average to the unit diagonal, not a shortened
# RGB midpoint. The third component keeps its original tangent-space sign.
normal=image([[[255,128,128,255],[128,255,128,255]]])
result=np.asarray(resize_map(normal,(1,1),'normalTexture'))[0,0,:3]/127.5-1
assert abs(np.linalg.norm(result)-1)<.01,result
assert np.allclose(result[:2],[2**-.5,2**-.5],atol=.01),result
assert abs(result[2])<.015,result
# Flat normals remain flat through an aggressive 16x reduction.
flat=Image.new('RGBA',(64,64),(128,128,255,255));small=resize_map(flat,(4,4),'normalTexture')
assert small.size==(4,4) and np.array_equal(np.asarray(small),np.full((4,4,4),(128,128,255,255),dtype=np.uint8))
try:resize_map(Image.new('RGBA',(4,4),(255,0,0,0)),(2,2),'baseColorTexture')
except ValueError:pass
else:raise AssertionError('Transparent colour requires a separate alpha-aware review')
print('PASS linear-light colour, unmodified linear data, unit-length normal vectors, dimensions and source retention')
