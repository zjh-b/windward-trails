"""Real keyboard/touch block hits, reward feedback, saves and small-screen HUD."""
from datetime import datetime,timezone
import hashlib
import json
from playwright.sync_api import sync_playwright
from browser_qa import ROOT,OUT,SOURCE_FILES,attach,local_url,ready,touch_point

checks,errors,resources=[],[],[]
hashes={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}

def hit_first(page,touch=False):
    cdp=page.context.new_cdp_session(page) if touch else None
    if touch:cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[touch_point(page,'[data-control=right]',1)]})
    else:page.keyboard.down('ArrowRight')
    page.wait_for_function('__qaGame.player.x>=__qaGame.blocks[0].x+(__qaGame.blocks[0].w-__qaGame.player.w)/2-24')
    if touch:cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:page.keyboard.up('ArrowRight')
    page.wait_for_timeout(180)
    if touch:cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[touch_point(page,'[data-control=jump]',2)]})
    else:page.keyboard.down('Space')
    page.wait_for_function('__qaGame.blocks[0].used',timeout=3000)
    if touch:cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:page.keyboard.up('Space')
    page.wait_for_timeout(160)

def inspect_hud(page):
    selectors=['.hud-left','.ammo-hud','.hud-center','#pause','#itemHud','#bossHud','#touchRun','#touchReload','[data-control=left]','[data-control=right]','[data-control=fire]','[data-control=jump]']
    rects=[]
    for selector in selectors:
        rect=page.locator(selector).bounding_box();assert rect,(selector,'not visible')
        v=page.viewport_size
        assert rect['x']>=-1 and rect['y']>=-1 and rect['x']+rect['width']<=v['width']+1 and rect['y']+rect['height']<=v['height']+1,(selector,rect,v)
        rects.append((selector,rect))
    for i,(a,r) in enumerate(rects):
        for b,s in rects[i+1:]:
            assert not(r['x']<s['x']+s['width']-1 and r['x']+r['width']>s['x']+1 and r['y']<s['y']+s['height']-1 and r['y']+r['height']>s['y']+1),('HUD overlaps',a,b,r,s)
    for selector in ['#help','#sound','#fullscreen','#pause']:
        rect=page.locator(selector).bounding_box();assert min(rect['width'],rect['height'])>=44,(selector,rect)

with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        page=browser.new_page(viewport={'width':1440,'height':960})
        attach(page,'blocks-desktop',errors,resources);page.add_init_script('Math.random=()=>.7')
        page.goto(url);ready(page)
        assert page.locator('#itemHud').count()==1,'Missing item effect UI'
        page.click('#start');assert page.locator('#itemHud').is_hidden()
        hit_first(page)
        assert page.locator('#shieldEffect').is_visible()
        assert '护盾' in page.locator('#rewardNotice').inner_text()
        assert page.evaluate('__qaGame.effects.shield')>0
        page.screenshot(path=str(OUT/'items-desktop.png'))
        page.click('#pause');before=page.evaluate('__qaGame.effects.shield');page.wait_for_timeout(300)
        assert page.evaluate('__qaGame.effects.shield')==before
        page.reload();ready(page);page.click('#continueJourney')
        assert page.evaluate('__qaGame.blocks[0].used&&__qaGame.effects.shield>0')
        assert page.locator('#shieldEffect').is_visible()
        checks.append('actual keyboard head-hit, shield notice/countdown, pause freeze, used block and effect survive continue')
        page.close()
        for size,rotated in [({'width':844,'height':390},False),({'width':568,'height':320},False),({'width':390,'height':844},True),({'width':390,'height':844},False)]:
            page=browser.new_page(viewport=size,has_touch=True,is_mobile=True,device_scale_factor=1)
            attach(page,'blocks-phone',errors,resources);page.add_init_script('Math.random=()=>.9')
            page.add_init_script("Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined})")
            page.goto(url);ready(page)
            if rotated:page.click('#fullscreen')
            page.locator('#start').scroll_into_view_if_needed();page.click('#start')
            page.click('#help');page.wait_for_timeout(120)
            action=page.locator('#modalActions button').first.bounding_box();stage=page.locator('#stage').bounding_box()
            assert action and action['y']>=stage['y'] and action['y']+action['height']<=stage['y']+stage['height'],('help action clipped',size,rotated,action,stage)
            page.locator('#modalActions button').first.click()
            hit_first(page,touch=True)
            assert page.locator('#magnetEffect').is_visible()
            assert '磁力' in page.locator('#rewardNotice').inner_text()
            # Layout fixture: both effects and the boss may be active together.
            page.evaluate('Object.assign(__qaGame.effects,{shield:8,magnet:10});__qaGame.boss.active=true')
            page.wait_for_timeout(40);page.click('#pause');page.wait_for_timeout(80)
            # Dismiss only the pause panel in this layout fixture; simulation stays frozen.
            page.evaluate("document.getElementById('modal').hidden=true;document.getElementById('touchControls').hidden=false")
            inspect_hud(page)
            page.screenshot(path=str(OUT/f'items-{size["width"]}-{size["height"]}-{"rotated" if rotated else "natural"}.png'))
            page.close()
        checks.append('real touch head-hits; both effect labels plus boss HUD fit 568/844 landscape, portrait and rotated portrait')
        page=browser.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce')
        attach(page,'blocks-offline',errors,resources);page.add_init_script('Math.random=()=>.1')
        page.goto((ROOT/'index.html').as_uri());ready(page);page.click('#start');hit_first(page)
        assert page.evaluate('__qaGame.blocks[0].used&&__qaGame.collected>=5')
        assert page.locator('#itemHud').is_hidden()
        assert '+5' in page.locator('#rewardNotice').inner_text()
        checks.append('offline reduced-motion head-hit applies five bonus coins without an empty effects panel')
        assert not errors and not resources,(errors,resources)
    finally:browser.close()
assert hashes=={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}
report={'passed':True,'verified_at_utc':datetime.now(timezone.utc).isoformat(),'checks':checks,'console_errors':errors,'resource_errors':resources,'source_sha256':hashes}
(OUT/'items-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'checks':checks},ensure_ascii=False))
