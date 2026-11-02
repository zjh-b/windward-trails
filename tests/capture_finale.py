"""Record a real browser ending for visual review; not a gameplay acceptance test."""
import subprocess
from playwright.sync_api import sync_playwright
from browser_qa import ROOT,local_url,ready,select,attach

out=ROOT.parent/'output_game_v4'
out.mkdir(exist_ok=True)
with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1,
                               record_video_dir=str(out/'raw'),record_video_size={'width':1280,'height':800})
    page=context.new_page();errors=[];resources=[]
    attach(page,'capture',errors,resources);page.goto(url);ready(page)
    select(page,'hero',5);page.click('#start')
    box=page.locator('#stage').bounding_box()
    page.evaluate('''()=>{const g=__qaGame;g.boss.hp=0;g.projectiles=[];
      Object.assign(g.player,{x:g.level.width-185,y:500,vx:0,vy:0,grounded:true,invulnerable:2});
      g.cat.x=g.player.x-55;g.cat.y=570;g.camera=g.level.width-1280;}''')
    page.wait_for_selector('#finale:not([hidden])');page.wait_for_timeout(7600)
    video=page.video;page.close();context.close()
    path=video.path();browser.close()
    assert not errors and not resources,(errors,resources)
crop='crop={}:{}:{}:{}'.format(*(int(box[k])//2*2 for k in ('width','height','x','y')))
target=out/'finale-preview.mp4'
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(path),'-vf',crop,'-an',
                '-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p',
                '-movflags','+faststart',str(target)],check=True)
print(target)
