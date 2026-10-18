"""Role-aware local texture filtering; no geometry or UV edits."""
from PIL import Image,ImageFilter
import numpy as np

def resize_map(image,size,role):
 """Filter colour in linear light; filter tangent-space normals as vectors."""
 pixels=np.asarray(image.convert('RGBA')).astype(np.float32)/255
 alpha=Image.fromarray(pixels[:,:,3]).resize(size,Image.Resampling.LANCZOS)
 values=pixels[:,:,:3]
 if role=='baseColorTexture':
  if np.any(pixels[:,:,3]!=1):raise ValueError('Opaque colour filtering requires opaque source alpha')
  values=np.where(values<=.04045,values/12.92,((values+.055)/1.055)**2.4)
 elif role=='normalTexture':values=values*2-1
 values=np.stack([np.asarray(Image.fromarray(values[:,:,i]).resize(size,Image.Resampling.LANCZOS)) for i in range(3)],axis=2)
 if role=='baseColorTexture':
  values=np.clip(values,0,1);values=np.where(values<=.0031308,values*12.92,1.055*values**(1/2.4)-.055)
 elif role=='normalTexture':
  lengths=np.linalg.norm(values,axis=2,keepdims=True);values/=np.maximum(lengths,1e-8);values=(values+1)*.5
 output=np.concatenate([np.clip(values,0,1),np.clip(np.asarray(alpha),0,1)[:,:,None]],axis=2)
 resized=Image.fromarray(np.rint(output*255).astype(np.uint8))
 if role=='baseColorTexture':
  # Only opaque JPEG base colours reach this path. A restrained sharpening
  # pass restores local contrast without changing UVs or painting detail.
  resized=resized.convert('RGB').filter(ImageFilter.UnsharpMask(radius=.6,percent=45,threshold=2)).convert('RGBA')
 return resized
