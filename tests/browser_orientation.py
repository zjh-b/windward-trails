"""Portrait entry -> landscape -> touch gameplay -> rotation -> exit, on one page."""
from datetime import datetime,timezone
import hashlib
import json
from playwright.sync_api import sync_playwright
from browser_qa import ROOT,OUT,SOURCE_FILES,attach,local_url,ready,state,touch_point

hashes={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}
checks,errors,resources=[],[],[]

def inside(page,selector):
    rect=page.locator(selector).bounding_box()
    assert rect,selector
    size=page.viewport_size
    assert rect['x']>=-1 and rect['y']>=-1 and rect['x']+rect['width']<=size['width']+1 and rect['y']+rect['height']<=size['height']+1,(selector,rect,size)
    return rect

with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        attach(page,'portrait-entry',errors,resources)
        # Portable path: unavailable native APIs must not prevent horizontal play.
        page.add_init_script('''Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});
          if(screen.orientation)Object.defineProperty(screen.orientation,'lock',{configurable:true,value:undefined});''')
        page.goto(url);ready(page)
        entry=page.get_by_role('button',name='横屏玩',exact=True)
        assert entry.count()==1,'Missing explicit landscape-play entry on a portrait phone'
        inside(page,'#fullscreen');entry.tap()
        page.wait_for_function("document.body.classList.contains('landscape-mode')")
        assert page.evaluate("document.body.classList.contains('landscape-rotated')")
        inside(page,'#fullscreen')
        page.get_by_role('button',name='出发 · 日光草原').click()
        page.wait_for_timeout(150)
        assert page.evaluate('world.clientWidth>world.clientHeight'), 'Canvas must retain a landscape layout before CSS rotation'
        assert page.evaluate('world.width>world.height'), 'Canvas backing size must follow pre-transform layout'
        for selector in ['[data-control=left]','[data-control=right]','[data-control=fire]','[data-control=jump]','#touchReload','#touchRun','#pause']:
            inside(page,selector)
        before=state(page);cdp=page.context.new_cdp_session(page)
        right=touch_point(page,'[data-control=right]',1);jump=touch_point(page,'[data-control=jump]',2);fire=touch_point(page,'[data-control=fire]',3)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[right]});page.wait_for_timeout(180)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[right,jump,fire]});page.wait_for_timeout(160)
        assert state(page)['x']>before['x']+40 and state(page)['vy']<0
        assert page.evaluate('__qaGame.weapon.ammo')<6
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        page.screenshot(path=str(OUT/'portrait-horizontal-play.png'))
        checks.append('portrait phone: explicit entry; no fullscreen/lock API; rotated wide canvas; real move/jump/fire touch')
        page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(200)
        assert not page.evaluate("document.body.classList.contains('landscape-rotated')")
        assert page.evaluate("document.body.classList.contains('landscape-mode')")
        inside(page,'#fullscreen');inside(page,'[data-control=jump]')
        page.screenshot(path=str(OUT/'native-landscape-play.png'))
        page.get_by_role('button',name='退出横屏',exact=True).tap()
        assert not page.evaluate("document.body.classList.contains('landscape-mode')")
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
        entry.tap();inside(page,'#fullscreen')
        page.get_by_role('button',name='退出横屏',exact=True).tap()
        assert page.locator('#touchControls').is_visible()
        checks.append('same page: physical viewport rotates, exits and re-enters cleanly; touch controls stay inside viewport')
        page.close()
        page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        attach(page,'native-denied',errors,resources)
        page.add_init_script('''window.__orientationCalls=[];
          Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:async function(){__orientationCalls.push('fullscreen');throw new DOMException('Denied','NotAllowedError');}});
          if(screen.orientation)Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async function(value){__orientationCalls.push(value);throw new DOMException('Unsupported','NotSupportedError');}});''')
        page.goto(url);ready(page);page.get_by_role('button',name='横屏玩',exact=True).tap()
        page.wait_for_function("window.__orientationCalls.includes('landscape')")
        assert page.evaluate("document.body.classList.contains('landscape-rotated')")
        assert page.evaluate('__orientationCalls')==['fullscreen','landscape']
        page.get_by_role('button',name='退出横屏',exact=True).tap()
        checks.append('native fullscreen denied and orientation lock rejected: landscape page still works and exits')
        page.close()
        page=browser.new_page(viewport={'width':1280,'height':800})
        attach(page,'desktop-screen',errors,resources);page.goto(url);ready(page)
        page.get_by_role('button',name='全屏显示',exact=True).click()
        page.wait_for_function('!!document.fullscreenElement')
        assert not page.evaluate("document.body.classList.contains('landscape-mode')")
        # Headless Chromium does not implement the browser-chrome Escape shortcut;
        # use its real exitFullscreen API to verify restoration and label state.
        page.evaluate('document.exitFullscreen()')
        page.wait_for_function('!document.fullscreenElement')
        checks.append('desktop retains real fullscreen entry and exit')
        assert not errors and not resources,(errors,resources)
    finally:browser.close()
assert hashes=={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}
(OUT/'orientation-verification.json').write_text(json.dumps({'passed':True,'verified_at_utc':datetime.now(timezone.utc).isoformat(),
    'checks':checks,'console_errors':errors,'resource_errors':resources,'source_sha256':hashes},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'checks':checks},ensure_ascii=False))
