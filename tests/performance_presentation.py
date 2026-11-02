"""Small same-machine v3/v4 render-frequency comparison, without other QA running."""
import hashlib
import json
import subprocess
from playwright.sync_api import sync_playwright
from browser_qa import ROOT,OUT,SOURCE_FILES,local_url,ready

baseline={n:subprocess.check_output(['git','show','HEAD:'+n],cwd=ROOT).decode('utf-8') for n in ['index.html','style.css','game.js']}
samples=[]
with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        for version in ('v3','v4'):
            page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
            if version=='v3':
                def serve(route):
                    name=route.request.url.removeprefix(url).split('?')[0] or 'index.html'
                    if name in baseline:
                        route.fulfill(body=baseline[name],content_type='text/html' if name.endswith('.html') else 'text/css' if name.endswith('.css') else 'application/javascript')
                    else:route.continue_()
                page.route('**/*',serve)
            page.add_init_script('''(()=>{window.draws=0;const original=CanvasRenderingContext2D.prototype.drawImage;
              CanvasRenderingContext2D.prototype.drawImage=function(...a){if(this.canvas.id==='world'&&a[0]?.width===1920)window.draws++;return original.apply(this,a);};})();''')
            page.goto(url);ready(page)
            for index in (0,1,5):
                if index:page.click('#home')
                page.click(f'[data-level="{index}"]');page.click('#start');page.wait_for_timeout(700)
                page.evaluate('window.draws=0;window.sampleStart=performance.now()')
                page.wait_for_timeout(2200)
                sample=page.evaluate('({draws:draws,seconds:(performance.now()-sampleStart)/1000,hidden:document.hidden})')
                sample.update(version=version,level=index)
                sample['draws_per_second']=round(sample['draws']/sample['seconds'],2)
                samples.append(sample)
            page.close()
    finally:browser.close()
report={'environment':'Headless Chromium, desktop 1280x800, 0.7s warmup and 2.2s samples; same local HTTP origin',
        'baseline_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'samples':samples,'source_sha256':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}}
(OUT/'performance-v4.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
