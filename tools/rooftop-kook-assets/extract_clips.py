"""Keep official animation tracks, without shipping six duplicate character meshes."""
from pathlib import Path
import json,struct,sys
from pack_clips import SOURCES,pack_character
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'.img2threejs/rooftop-kook'
characters={'karen':['idle','shout','angry'],'kook':['idle','aim','shoot'],'karen-rain':['idle','shout','angry'],'kook-rain':['idle']}
for character in sys.argv[1:] or ['karen','kook']:
 names=characters[character]
 clips=[]
 for name in names:
  source=next((WORK/(character+'-'+name)/'downloads').glob('*.glb'))
  raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
  def values(index):
   a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];assert a['componentType']==5126
   width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
   stride=v.get('byteStride',width*4)
   return [round(x,7) for i in range(a['count']) for x in struct.unpack_from('<'+'f'*width,binary,start+i*stride)]
  tracks=[];duration=0
  for channel in doc['animations'][0]['channels']:
   sampler=doc['animations'][0]['samplers'][channel['sampler']];target=channel['target'];bone=doc['nodes'][target['node']]['name'];path=target['path']
   if bone=='Armature':continue
   times=values(sampler['input']);duration=max(duration,times[-1]);value=values(sampler['output'])
   tracks.append({'name':bone+'.'+{'rotation':'quaternion','translation':'position','scale':'scale'}[path],
    'type':'quaternion' if path=='rotation' else 'vector','times':times,'values':value})
  clips.append({'name':name,'duration':duration,'tracks':tracks});print(character,name,duration,len(tracks))
 SOURCES.mkdir(parents=True,exist_ok=True)
 out=SOURCES/(character+'-clips.json');out.write_text(json.dumps(clips,separators=(',',':'))+'\n')
 pack_character(character)
