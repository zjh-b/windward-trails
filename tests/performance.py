"""Compare old/new drawing frequency under the same browser and HTTP origin."""
import hashlib
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_qa import ROOT, OUT, local_url

BASELINE='b8b38dfec9dc080b912e606d3ad21843bb7a553d'
files=['index.html','style.css','core.js','game.js']
baseline={name:subprocess.check_output(['git','show',f'{BASELINE}:{name}'],cwd=ROOT).decode('utf-8') for name in files}
results=[]
with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        for version in ['before','after']:
            page=browser.new_page(viewport={'width':1280,'height':800})
            if version=='before':
                def serve(route):
                    name=route.request.url.removeprefix(url) or 'index.html'
                    if name in baseline:
                        mime='text/html' if name.endswith('.html') else 'text/css' if name.endswith('.css') else 'application/javascript'
                        route.fulfill(body=baseline[name],content_type=mime)
                    else:route.continue_()
                page.route('**/*',serve)
            page.add_init_script('''(()=>{window.count={draws:0,frames:0};const orig=CanvasRenderingContext2D.prototype.drawImage;
              CanvasRenderingContext2D.prototype.drawImage=function(...a){if(a[0]?.width===1920)count.draws++;return orig.apply(this,a);};
              function tick(){count.frames++;requestAnimationFrame(tick);}requestAnimationFrame(tick);})();''')
            page.goto(url);page.wait_for_function('!document.getElementById("start").disabled')
            for phase in ['menu','playing','paused']:
                if phase=='playing':page.click('#start')
                if phase=='paused':page.keyboard.press('Escape')
                page.wait_for_timeout(500)
                page.evaluate('window.count={draws:0,frames:0};window.sampleStart=performance.now()')
                page.wait_for_timeout(2500)
                result=page.evaluate('({draws:count.draws,frames:count.frames,seconds:(performance.now()-sampleStart)/1000,hidden:document.hidden,paused:!document.getElementById("modal").hidden})')
                result.update(version=version,phase=phase)
                result['draws_per_second']=round(result['draws']/result['seconds'],2)
                result['raf_per_second']=round(result['frames']/result['seconds'],2)
                results.append(result)
            page.close()
    finally:browser.close()
report={'environment':'Headless Chromium 1280x800, same local HTTP origin; 2.5 s samples after 0.5 s warmup',
        'baseline_commit':BASELINE,'samples':results,
        'current_source_sha256':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files}}
(OUT/'performance-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
