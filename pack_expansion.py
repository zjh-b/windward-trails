"""Pack expansion renders; preserve existing hero/cat metadata and images."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
OUT=HERE/'assets';RAW=OUT/'raw'
for kind in ['lagoon','desert','cavern']:
    with Image.open(RAW/f'bg-{kind}.png') as im:
        im.convert('RGB').save(OUT/f'bg-{kind}.jpg',quality=92)
meta_path=OUT/'sprites.js'
metadata=json.loads(meta_path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
for name in ['ranger','mage']:
    frames=[Image.open(RAW/f'{name}-{i:02d}.png').convert('RGBA') for i in range(12)]
    boxes=[im.getchannel('A').getbbox() for im in frames]
    assert all(boxes),name
    assert all(b[0]>0 and b[1]>0 and b[2]<256 and b[3]<256 for b in boxes), f'{name}: sprite touches render edge'
    box=(max(0,min(b[0] for b in boxes)-5),max(0,min(b[1] for b in boxes)-5),min(256,max(b[2] for b in boxes)+5),min(256,max(b[3] for b in boxes)+5))
    w,h=box[2]-box[0],box[3]-box[1]
    sheet=Image.new('RGBA',(w*12,h))
    for i,im in enumerate(frames):sheet.paste(im.crop(box),(w*i,0))
    sheet.save(OUT/f'{name}.png',optimize=True)
    frames[0].crop(box).save(OUT/f'{name}-portrait.png',optimize=True)
    metadata[name]={'width':w,'height':h,'frames':12}
meta_path.write_text('window.SPRITES = '+json.dumps(metadata)+';\n',encoding='utf-8')
sheet=Image.new('RGB',(960,900),'#183329')
for i,kind in enumerate(['lagoon','desert','cavern']):
    with Image.open(OUT/f'bg-{kind}.jpg') as im:sheet.paste(im.resize((480,270)),(0,i*290))
for i,kind in enumerate(['hero','ranger','mage']):
    m=metadata[kind]
    with Image.open(OUT/f'{kind}.png') as im:
        portrait=im.crop((0,0,m['width'],m['height']))
        portrait.thumbnail((150,260))
        sheet.paste(portrait,(490+i*155,290),portrait)
sheet.save(RAW/'expansion-contact-sheet.jpg',quality=92)
print(json.dumps(metadata,indent=2))
