"""Package rendered game assets; requires Pillow and FFmpeg."""
import json
import subprocess
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / 'assets'
RAW = OUT / 'raw'
metadata = {}
for kind in ['grassland', 'forest', 'alpine']:
    with Image.open(RAW / f'bg-{kind}.png') as im:
        im.convert('RGB').save(OUT / f'bg-{kind}.jpg', quality=91)
for name in ['hero', 'cat']:
    frames = [Image.open(RAW / f'{name}-{i:02d}.png').convert('RGBA') for i in range(12)]
    boxes = [im.getchannel('A').getbbox() for im in frames]
    box = (max(0, min(b[0] for b in boxes)-5), max(0, min(b[1] for b in boxes)-5),
           min(256, max(b[2] for b in boxes)+5), min(256, max(b[3] for b in boxes)+5))
    w, h = box[2]-box[0], box[3]-box[1]
    sheet = Image.new('RGBA', (w*12, h))
    for i, im in enumerate(frames):
        sheet.paste(im.crop(box), (w*i, 0))
    sheet.save(OUT / f'{name}.png', optimize=True)
    metadata[name] = {'width': w, 'height': h, 'frames': 12}
(OUT / 'sprites.js').write_text('window.SPRITES = ' + json.dumps(metadata) + ';\n', encoding='utf-8')
for name, source in [('grassland', 'output_grassland/grassland_ambience.wav'), ('forest', 'output/forest_ambience.wav'), ('alpine', 'output_alpine/alpine_ambience.wav')]:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(HERE.parent / source), '-c:a', 'libmp3lame', '-b:a', '96k', str(OUT / f'{name}.mp3')], check=True)
print(json.dumps(metadata, indent=2))
