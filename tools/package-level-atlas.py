"""Package this atlas's SVG vocabulary as a native Sketch interchange document.

Figma's Sketch importer preserves bitmap layers, unlike its SVG API importer.
Geometry stays as named editable paths; images remain separate bitmap layers.
Requires Pillow. Schemas/templates follow Sketch's official file format.
"""
from pathlib import Path
from copy import deepcopy
from io import BytesIO
import base64, hashlib, json, math, re, uuid, zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageFont

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/provenance/level-atlas'
T=json.loads((ROOT/'tools/level-atlas-sketch-templates.json').read_text())
INVENTORY=json.loads((OUT/'inventory.json').read_text())
IMAGES={}
IMAGE_CACHE={}
def uid(): return str(uuid.uuid4()).upper()
def frame(x=0,y=0,w=0,h=0):return {'_class':'rect','constrainProportions':False,'x':x,'y':y,'width':max(w,.001),'height':max(h,.001)}
def color(s,alpha=1):
 s=s.lstrip('#');s=''.join(c*2 for c in s) if len(s)==3 else s
 return {'_class':'color','red':int(s[:2],16)/255,'green':int(s[2:4],16)/255,'blue':int(s[4:6],16)/255,'alpha':alpha}
def base(kind,name,box):
 n=deepcopy(T[kind]);n['do_objectID']=uid();n['name']=name;n['frame']=box;n['isVisible']=True;n['isLocked']=False;n['isTemplate']=False
 n.pop('includeInCloudUpload',None);n.pop('presetDictionary',None)
 n['style']['do_objectID']=uid();n['style']['contextSettings']['opacity']=1
 return n
def paint(a,n):
 st=n['style'];st['fills']=[];st['borders']=[]
 if a.get('fill','none')!='none':st['fills']=[{'_class':'fill','isEnabled':True,'fillType':0,'color':color(a['fill'],float(a.get('fill-opacity',1))), 'contextSettings':{'_class':'graphicsContextSettings','blendMode':0,'opacity':1},'gradient':{'_class':'gradient','elipseLength':0,'from':'{0.5, 0}','to':'{0.5, 1}','gradientType':0,'stops':[]},'noiseIndex':0,'noiseIntensity':0,'patternFillType':1,'patternTileScale':1}]
 if a.get('stroke','none')!='none':st['borders']=[{'_class':'border','isEnabled':True,'fillType':0,'color':color(a['stroke'],float(a.get('stroke-opacity',1))), 'contextSettings':{'_class':'graphicsContextSettings','blendMode':0,'opacity':1},'position':0,'thickness':float(a.get('stroke-width',1)),'gradient':{'_class':'gradient','elipseLength':0,'from':'{0.5, 0}','to':'{0.5, 1}','gradientType':0,'stops':[]}}]
 for p in st['fills']+st['borders']:p['gradient']['stops']=[{'_class':'gradientStop','position':0,'color':color('#ffffff')},{'_class':'gradientStop','position':1,'color':color('#000000')}]
 st['contextSettings']['opacity']=float(a.get('opacity',1));st['borderOptions']['dashPattern']=[float(v) for v in a.get('stroke-dasharray','').split()]
 st['windingRule']=1
 return n
def shape(points,closed,a,name):
 xs=[p[0] for p in points];ys=[p[1] for p in points];x,y=min(xs),min(ys);w=max(max(xs)-x,.001);h=max(max(ys)-y,.001)
 n=base('shapePath',name,frame(x,y,w,h));n['isClosed']=closed;n['points']=[]
 for px,py in points:
  p='{'+str((px-x)/w)+', '+str((py-y)/h)+'}'
  n['points'].append({'_class':'curvePoint','point':p,'curveFrom':p,'curveTo':p,'curveMode':1,'cornerRadius':0,'cornerStyle':0,'hasCurveFrom':False,'hasCurveTo':False})
 return paint(a,n)
def group(children,name,a=None,kind='group'):
 if not children:return None
 x=min(n['frame']['x'] for n in children);y=min(n['frame']['y'] for n in children)
 r=max(n['frame']['x']+n['frame']['width'] for n in children);b=max(n['frame']['y']+n['frame']['height'] for n in children)
 n=base(kind,name,frame(x,y,r-x,b-y));n['layers']=children
 for c in children:c['frame']['x']-=x;c['frame']['y']-=y
 if a:paint(a,n)
 if kind=='shapeGroup':n['windingRule']=1
 return n
def paths(d):
 tokens=re.findall(r'[MLZmlz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d)
 if re.search(r'[ACHQSTVac hqstv]'.replace(' ',''),d):raise ValueError('Unsupported path command')
 result=[];current=[];cmd=None;i=0;position=(0,0)
 while i<len(tokens):
  if tokens[i].isalpha():
   cmd=tokens[i];i+=1
   if cmd.lower()=='z':
    if current:result.append((current,True));position=current[0];current=[]
    continue
  if cmd is None:raise ValueError('Missing command')
  x,y=float(tokens[i]),float(tokens[i+1]);i+=2
  if cmd.islower():x+=position[0];y+=position[1]
  if cmd.lower()=='m':
   if current:result.append((current,False));current=[]
   cmd='l' if cmd.islower() else 'L'
  current.append((x,y));position=(x,y)
 if current:result.append((current,False))
 return result
def image_ref(uri):
 if uri in IMAGE_CACHE:return IMAGE_CACHE[uri]
 raw=base64.b64decode(uri.split(',',1)[1]);im=Image.open(BytesIO(raw));b=BytesIO();im.save(b,'PNG');raw=b.getvalue();key=hashlib.sha256(raw).hexdigest()+'.png';IMAGES[key]=raw;IMAGE_CACHE[uri]=key
 return key
def convert(e):
 tag=e.tag.rsplit('}',1)[-1];a=e.attrib;name=a.get('id',tag)
 if tag in ['defs','title','desc']:return []
 if tag=='g':
  children=[n for child in e for n in convert(child)]
  if a.get('clip-path'):
   # Each map has one plot clip. The standard Sketch mask precedes its chain.
   p=CURRENT['projection'];mask=shape([(p['offsetX'],p['offsetY']),(p['offsetX']+(p['maxX']-p['minX'])*8,p['offsetY']),(p['offsetX']+(p['maxX']-p['minX'])*8,p['offsetY']+(p['maxZ']-p['minZ'])*8),(p['offsetX'],p['offsetY']+(p['maxZ']-p['minZ'])*8)],True,{'fill':'#ffffff'},'Map extent mask');mask['hasClippingMask']=True;children.insert(0,mask)
  n=group(children,name,a);return [n] if n else []
 if tag=='path':
  ps=paths(a['d']);children=[shape(p,closed,a,name) for p,closed in ps if len(p)>1]
  if len(children)<=1:return children
  # Compound paths share one fill and even-odd holes, as in the SVG union.
  for c in children:c['style']['fills']=[];c['style']['borders']=[]
  n=group(children,name,a,'shapeGroup');return [n] if n else []
 if tag in ['rect','circle']:
  if tag=='rect':
   x,y,w,h=[float(a.get(k,0)) for k in ['x','y','width','height']];points=[(x,y),(x+w,y),(x+w,y+h),(x,y+h)]
  else:
   cx,cy,r=[float(a[k]) for k in ['cx','cy','r']];points=[(cx+r*math.cos(i*math.tau/32),cy+r*math.sin(i*math.tau/32)) for i in range(32)]
  return [shape(points,True,a,name)]
 if tag=='image':
  uri=a.get('{http://www.w3.org/1999/xlink}href',a.get('href'));key=image_ref(uri)
  n=base('bitmap',name,frame(*[float(a.get(k,0)) for k in ['x','y','width','height']]))
  n['image']={'_class':'MSJSONFileReference','_ref_class':'MSImageData','_ref':'images/'+key};return [n]
 if tag=='text':
  value=''.join(e.itertext());size=float(a.get('font-size',12));bold=float(a.get('font-weight',400))>=600;fontname='Arial-BoldMT' if bold else 'ArialMT'
  fontfile='/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf'
  font=ImageFont.truetype(fontfile,round(size*10));w=font.getlength(value)/10+4;h=size*1.35;x=float(a.get('x',0));y=float(a.get('y',0))-size
  anchor=a.get('text-anchor');x-=w/2 if anchor=='middle' else w if anchor=='end' else 0
  n=base('text',value,frame(x,y,w,h));attributes={'MSAttributedStringFontAttribute':{'_class':'fontDescriptor','attributes':{'name':fontname,'size':size}},'MSAttributedStringColorAttribute':color(a.get('fill','#173c33')),'kerning':float(a.get('letter-spacing',0)),'paragraphStyle':{'_class':'paragraphStyle','alignment':0},'textStyleVerticalAlignmentKey':0}
  n['attributedString']={'_class':'attributedString','string':value,'attributes':[{'_class':'stringAttribute','location':0,'length':len(value.encode('utf-16-le'))//2,'attributes':attributes}]};n['style']['textStyle']={'_class':'textStyle','encodedAttributes':attributes,'verticalAlignment':0};n['glyphBounds']='{{0, 0}, {'+str(w)+', '+str(h)+'}}';n['textBehaviour']=0
  if 'paint-order' in a:
   backing=shape([(x-2,y),(x+w+2,y),(x+w+2,y+h),(x-2,y+h)],True,{'fill':'#fffdf5','fill-opacity':'.82'},'Label backing')
   return [backing,n]
  return [n]
 raise ValueError('Unhandled SVG element '+tag)

pages=[];document=deepcopy(T['document']);document['do_objectID']=uid();document['pages']=[];document['perDocumentLibraries']=[]
meta=deepcopy(T['meta']);meta['pagesAndArtboards']={};meta.pop('fonts',None)
for island,name in [('island-1','01 · Island 1'),('island-2','02 · Island 2'),('hidden-shores','03 · Hidden Shores')]:
 page=base('page',name,frame());page['layers']=[];x=100;y=100;row_h=0
 for row in INVENTORY['levels']:
  if row['islandId']!=island:continue
  CURRENT=row
  if x>100 and x+row['width']>12000:x=100;y+=row_h+250;row_h=0
  svg=ET.parse(OUT/row['file']).getroot();artboard=base('artboard',f"{row['order']:02d} · {row['name']} · {row['snapshotId']}",frame(x,y,row['width'],row['height']))
  artboard['layers']=[n for child in svg for n in convert(child)]
  artboard['layers'].append(base('group','ANNOTATIONS · add notes and arrows here',frame(0,0,row['width'],row['height'])))
  page['layers'].append(artboard);x+=row['width']+200;row_h=max(row_h,row['height'])
  print(row['name'],len(artboard['layers']),'top-level layers')
 page['frame']=frame();pages.append(page);document['pages'].append({'_class':'MSJSONFileReference','_ref_class':'MSImmutablePage','_ref':'pages/'+page['do_objectID']})
 meta['pagesAndArtboards'][page['do_objectID']]={'name':name,'artboards':{a['do_objectID']:{'name':a['name']} for a in page['layers']}}
target=OUT/'Level Atlas.sketch'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('document.json',json.dumps(document));z.writestr('meta.json',json.dumps(meta));z.writestr('user.json',json.dumps({'document':{'pageListHeight':110,'pageListCollapsed':0},**{p['do_objectID']:{'scrollOrigin':'{0, 0}','zoomValue':.2} for p in pages}}))
 for p in pages:z.writestr('pages/'+p['do_objectID']+'.json',json.dumps(p))
 for key,data in IMAGES.items():z.writestr('images/'+key,data)
print('Wrote',target, 'with',len(IMAGES),'deduplicated PNG assets')
print('Validate with tools/validate-level-atlas-sketch.py and the official Sketch schemas.')
