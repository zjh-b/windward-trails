from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

root=Path(__file__).resolve().parent.parent/'qa'
names=[('grassland','日光草原'),('forest','古树秘径'),('alpine','云上山脊'),('lagoon','潮汐群岛'),('desert','落日沙海'),('cavern','萤晶洞窟')]
canvas=Image.new('RGB',(1472,640),'#142820')
draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
for i,(name,label) in enumerate(names):
    x=16+(i%3)*488;y=12+(i//3)*314
    draw.text((x+5,y),label,font=font,fill='#f7f2d9')
    im=Image.open(root/f'scenery-{name}.png').convert('RGB').crop((24,107,1416,890)).resize((472,266),Image.Resampling.LANCZOS)
    canvas.paste(im,(x,y+32))
canvas.save(root/'scenery-overview.png')
print(root/'scenery-overview.png')
