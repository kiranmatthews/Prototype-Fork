"""Package the eight generated targets and matching real gameplay captures."""
from pathlib import Path
from PIL import Image
import json,shutil
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/sunny-beach';OUT=ROOT/'public/sunny-beach/gallery'
OUT.mkdir(parents=True,exist_ok=True)
names=['Arrival cove','Raised boardwalk','Sandstone headland','Beach to lagoon','First island','Ramp jump','Rope lagoon','Final island']
manifest=[]
for index,row in enumerate(json.loads((DOC/'prompts.json').read_text())['images']):
    name=row['id'];entry={'id':name,'title':names[index],'number':index+1}
    for phase,label in [('before','before'),('heroes','hero'),('after','playable')]:
        source=DOC/phase/(name+'.png');target=OUT/(name+'-'+label+'.webp')
        image=Image.open(source).convert('RGB');image.save(target,'WEBP',quality=94,method=6)
        entry[label]=target.name
    manifest.append(entry)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
image=Image.open(DOC/'after/02-boardwalk.png').convert('RGB');image.thumbnail((800,500),Image.Resampling.LANCZOS)
image.save(ROOT/'public/level-previews/beachside-run.jpg',quality=90,optimize=True)
print('Packaged eight hero/playable/before comparisons and the Beachside preview.')
