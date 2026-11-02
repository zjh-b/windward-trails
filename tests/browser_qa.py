"""Browser QA using real keyboard/touch; instrumentation never moves the player."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import hashlib
from pathlib import Path
import threading
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'qa'
THEMES = ['grassland', 'forest', 'alpine', 'lagoon', 'desert', 'cavern']
SOURCE_FILES = ['index.html', 'style.css', 'combat.js', 'core.js', 'scenery.js', 'finale.js', 'game.js', 'assets/sprites.js'] + [f'assets/{theme}.mp3' for theme in THEMES]
CAPTURE = '''(() => {
 let core;
 Object.defineProperty(window, 'TrailCore', {
  configurable:true, get(){return core;}, set(value){
   const Base=value.Game;
   value.Game=class extends Base {constructor(...args){super(...args);window.__qaGame??=this;}};
   core=value;
  }
 });
})();'''


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextmanager
def local_url(explicit_url):
    if explicit_url:
        yield explicit_url
        return
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/'
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def state(page):
    return page.evaluate('''() => {const g=window.__qaGame;return {
      status:g.status,x:g.player.x,y:g.player.y,vy:g.player.vy,grounded:g.player.grounded,
      hearts:g.hearts,coins:g.collected,time:g.elapsed,index:g.index,character:g.character?.id};}''')


def ready(page):
    page.wait_for_function('!document.getElementById("start").disabled',timeout=30000)


def attach(page,label,errors,resources):
    page.add_init_script(CAPTURE)
    route=(ROOT/'tests/route.cjs').read_text(encoding='utf-8').split('module.exports=')[0]
    page.add_init_script(route+'\nwindow.__qaDecision=decision;')
    page.on('pageerror',lambda error:errors.append(f'{label}: {error}'))
    page.on('console',lambda message:errors.append(f'{label}: {message.text}') if message.type=='error' else None)
    page.on('response',lambda response:resources.append(f'{label}: {response.status} {response.url}') if response.status>=400 else None)
    page.on('requestfailed',lambda request:resources.append(f'{label}: {request.failure} {request.url}') if request.failure!='net::ERR_ABORTED' else None)


def contract(page):
    assert page.locator('.level-choice').count()==6,'Expected six selectable maps'
    assert page.locator('.character-choice').count()==3,'Expected three selectable characters'
    for index in range(6):
        assert page.locator(f'.level-choice[data-level="{index}"]').count()==1
    for character in ['hero','ranger','mage']:
        assert page.locator(f'.character-choice[data-character="{character}"]').count()==1
    assert page.locator('#characterDescription').inner_text().strip()


def select(page,character,level):
    page.locator(f'.character-choice[data-character="{character}"]').click()
    page.locator(f'.level-choice[data-level="{level}"]').click()


def drive_stage(page,index,checks):
    # Hold jump through its ascent. A fixed 230 ms key press can be observed
    # before the apex on a busy browser and unintentionally becomes a short jump.
    # Polling continues while the key is held so a moving-platform landing is
    # never hidden behind a long, blind wait.
    page.keyboard.down('KeyF')
    deadline=time.monotonic()+160
    jump_held=False
    held=set()
    boss_captured=False
    try:
        while time.monotonic()<deadline:
            decision=page.evaluate('''() => {const g=window.__qaGame,p=g.player,d=window.__qaDecision(g);
              return {status:g.status,x:p.x,y:p.y,time:g.time,vy:p.vy,cut:p.cut,grounded:p.grounded,axis:d.axis,
                jump:d.jumpPressed,boss:g.boss.active&&g.boss.hp>0&&g.boss.x-p.x<550&&p.grounded};}''')
            if decision['status']!='playing':
                break
            wanted={'ArrowRight'} if decision['axis']>0 else {'ArrowLeft'} if decision['axis']<0 else set()
            for key in held-wanted: page.keyboard.up(key)
            for key in wanted-held: page.keyboard.down(key)
            held=wanted
            if jump_held and decision['vy']>=0:
                if index==3 and decision['x']>3500:print('LAGOON_JUMP_RELEASE',decision,flush=True)
                if decision['grounded']:
                    print('JUMP_RELEASE_WHILE_GROUNDED',index,decision,flush=True)
                page.keyboard.up('Space')
                jump_held=False
            if decision['jump'] and not jump_held:
                if index==3 and decision['x']>3500:print('LAGOON_JUMP_PRESS',decision,flush=True)
                page.keyboard.down('Space')
                jump_held=True
            if decision['boss'] and not boss_captured:
                page.screenshot(path=str(OUT/f'{THEMES[index]}-boss.png'))
                boss_captured=True
            page.wait_for_timeout(16)
    finally:
        for key in ['ArrowRight','ArrowLeft','KeyF','Space']:
            page.keyboard.up(key)
    result=state(page)
    expected='won' if index==len(THEMES)-1 else 'levelComplete'
    assert result['status']==expected,{'stage':index,'expected':expected,'state':result}
    page.wait_for_selector('#modal:not([hidden])',timeout=15000)
    checks.append({'keyboard_completed_stage':index,'state':result})
    page.screenshot(path=str(OUT/f'completed-{index}.png'))
    print('STAGE_OK',index,flush=True)


def touch_point(page,selector,touch_id):
    box=page.locator(selector).bounding_box()
    assert box,f'Missing touch target: {selector}'
    return {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':touch_id}


def combat_checks(page,checks):
    page.keyboard.press('KeyR')
    page.keyboard.down('KeyF')
    page.wait_for_timeout(330)
    page.keyboard.up('KeyF')
    ammo=page.evaluate('window.__qaGame.weapon.ammo')
    assert 0<ammo<6,ammo
    page.keyboard.press('KeyE')
    page.wait_for_timeout(100)
    assert '换弹中' in page.locator('#reloadStatus').inner_text()
    page.keyboard.press('Escape')
    before=page.evaluate('window.__qaGame.weapon.reloadLeft')
    page.wait_for_timeout(350)
    assert page.evaluate('window.__qaGame.weapon.reloadLeft')==before and before>0
    saved=page.evaluate("JSON.parse(localStorage.getItem('windward-journey'))")
    page.reload();ready(page)
    assert page.locator('#continueJourney').is_visible()
    page.click('#continueJourney')
    assert state(page)['status']=='playing' and state(page)['index']==saved['index']
    assert state(page)['character']==saved['character']
    page.wait_for_timeout(1500)
    assert page.evaluate('window.__qaGame.weapon.ammo')==6
    page.click('#home')
    page.evaluate("localStorage.setItem('windward-journey','{broken')")
    page.reload();ready(page)
    assert not page.locator('#continueJourney').is_visible()
    select(page,'hero',0);page.click('#start')
    checks.append('real F consumes ammo; E reload freezes on pause; refresh resumes stored journey and reload; corrupt journey safely ignored')


def mobile_check(browser,url,errors,resources,checks,landscape=False):
    size={'width':844,'height':390} if landscape else {'width':390,'height':844}
    label='landscape' if landscape else 'mobile'
    page=browser.new_page(viewport=size,device_scale_factor=1,has_touch=True,is_mobile=True)
    attach(page,label,errors,resources)
    page.goto(url)
    ready(page)
    contract(page)
    page.screenshot(path=str(OUT/f'{label}-title.png'))
    select(page,'ranger',0)
    page.locator('#start').scroll_into_view_if_needed()
    page.click('#start')
    page.wait_for_timeout(120)
    assert page.locator('#touchControls').is_visible()
    boxes=page.locator('#touchControls button').evaluate_all('(buttons)=>buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})')
    for i,a in enumerate(boxes):
        for b in boxes[i+1:]:
            assert not(a['x']<b['right'] and a['right']>b['x'] and a['y']<b['bottom'] and a['bottom']>b['y']),('Touch targets overlap',a,b)
    assert state(page)['character']=='ranger'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label
    before=state(page)
    cdp=page.context.new_cdp_session(page)
    right=touch_point(page,'[data-control=right]',1)
    jump=touch_point(page,'[data-control=jump]',2)
    fire=touch_point(page,'[data-control=fire]',3)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[right]})
    page.wait_for_timeout(180)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[right,jump,fire]})
    page.wait_for_timeout(150)
    jumping=state(page)
    assert jumping['x']>before['x']+40 and jumping['vy']<0,(before,jumping)
    assert page.evaluate('window.__qaGame.weapon.ammo')<8
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[right]})
    page.wait_for_timeout(120)
    assert state(page)['x']>jumping['x']+20
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.click('#touchReload');page.wait_for_timeout(100)
    assert page.evaluate('window.__qaGame.weapon.reloadLeft')>0
    page.click('#touchRun')
    assert page.locator('#touchRun').get_attribute('aria-pressed')=='true'
    page.click('#pause')
    assert page.locator('#touchRun').get_attribute('aria-pressed')=='false'
    page.get_by_role('button',name='继续旅程',exact=True).click()
    assert page.evaluate('document.getElementById("world").width/devicePixelRatio>=639')
    page.screenshot(path=str(OUT/f'{label}-play.png'))
    checks.append(f'{label}: accessible start, simultaneous move/jump/fire, reload, run resets on pause, wide view and no overflow')
    page.close()


def run(browser,url,args,checks,errors,resources):
    page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
    attach(page,'desktop',errors,resources)
    page.goto(url)
    ready(page)
    contract(page)
    checks.append('six map selectors, three characters and ability description')
    if args.contract_only:
        return
    select(page,'ranger',3)
    description=page.locator('#characterDescription').inner_text()
    page.reload()
    ready(page)
    assert page.locator('[data-character=ranger]').get_attribute('aria-pressed')=='true'
    assert page.locator('.level-choice[data-level="3"]').get_attribute('aria-pressed')=='true'
    assert state(page)['character']=='ranger' and state(page)['index']==3
    select(page,'mage',5)
    assert page.locator('#characterDescription').inner_text()!=description
    page.click('#start')
    assert state(page)['character']=='mage' and state(page)['index']==5
    page.keyboard.down('Space')
    page.wait_for_timeout(170)
    assert state(page)['vy']<0
    page.keyboard.up('Space')
    page.click('#home')
    page.evaluate("localStorage.setItem('windward-character','missing-character');localStorage.setItem('windward-level','invalid')")
    page.reload()
    ready(page)
    assert state(page)['character']=='hero' and state(page)['index']==0
    page.evaluate("localStorage.setItem('windward-best-0','Infinity');localStorage.setItem('windward-complete-0','1')")
    page.reload()
    ready(page)
    assert 'Infinity' not in page.locator('.level-choice[data-level="0"] .map-record').inner_text()
    page.evaluate("localStorage.removeItem('windward-best-0');localStorage.removeItem('windward-complete-0')")
    page.reload()
    ready(page)
    select(page,'hero',0)
    page.screenshot(path=str(OUT/'title.png'))
    checks.append('character/map persistence, ability description, direct sixth-map entry and corrupt preference/Infinity record fallback')
    page.click('#start')
    page.wait_for_timeout(120)
    before=state(page)
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(650)
    page.keyboard.up('ArrowRight')
    after=state(page)
    assert after['x']>before['x']+100,(before,after)
    page.keyboard.down('Space')
    page.wait_for_timeout(170)
    jumping=state(page)
    assert jumping['y']<after['y']-25,(jumping,after)
    page.keyboard.up('Space')
    page.wait_for_timeout(650)
    assert state(page)['grounded']
    checks.append('real keyboard movement and jump')
    page.keyboard.press('Escape')
    paused=state(page)
    page.wait_for_timeout(300)
    assert state(page)['status']=='paused' and state(page)['time']==paused['time']
    page.get_by_role('button',name='继续旅程',exact=True).click()
    page.click('#help')
    page.click('#help')
    page.wait_for_timeout(100)
    assert state(page)['status']=='paused'
    assert page.locator('#modalTitle').inner_text()=='向远方，轻轻一跃'
    page.get_by_role('button',name='知道了，出发').click()
    assert state(page)['status']=='playing'
    page.click('#help')
    assert state(page)['status']=='paused'
    page.keyboard.press('Escape')
    assert state(page)['status']=='playing' and not page.locator('#modal').is_visible()
    checks.append('pause freezes physics, repeated help click, help Escape and correct resume state')
    page.screenshot(path=str(OUT/'grassland-play.png'))
    combat_checks(page,checks)
    page.keyboard.press('KeyR')
    for index in range(len(THEMES)):
        assert state(page)['index']==index and state(page)['character']=='hero'
        drive_stage(page,index,checks)
        if index<len(THEMES)-1:
            page.locator('#modalActions button').first.click()
            page.wait_for_timeout(200)
            page.screenshot(path=str(OUT/f'{THEMES[index+1]}-play.png'))
    assert page.locator('#modalTitle').inner_text()=='一起抵达远方'
    page.get_by_role('button',name='从草原重新出发').click()
    assert state(page)['index']==0 and state(page)['hearts']==3
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    assert state(page)['status']=='paused'
    page.click('#home')
    assert page.locator('.level-choice.completed').count()==6
    page.reload()
    ready(page)
    assert page.locator('.level-choice.completed').count()==6
    checks.append('six-stage campaign, restart, focus-loss pause and persistent completion markers')

    offline=browser.new_page(viewport={'width':1280,'height':800})
    attach(offline,'offline',errors,resources)
    offline.goto((ROOT/'index.html').as_uri())
    ready(offline)
    contract(offline)
    image_files=[f'bg-{theme}.jpg' for theme in THEMES]+['hero.png','cat.png','ranger.png','mage.png']
    image_result=offline.evaluate('''files=>Promise.all(files.map(file=>new Promise(resolve=>{
      const image=new Image();image.onload=()=>resolve({file,width:image.width,height:image.height});
      image.onerror=()=>resolve({file,error:true});image.src='assets/'+file;
    })))''',image_files)
    assert all(item.get('width',0)>0 for item in image_result),image_result
    audio_result=offline.evaluate('''()=>Promise.all(['grassland','forest','alpine','lagoon','desert','cavern'].map(name=>new Promise(resolve=>{
      const audio=new Audio();const timer=setTimeout(()=>resolve({name,error:'timeout'}),6000);
      audio.onloadedmetadata=()=>{clearTimeout(timer);resolve({name,duration:audio.duration});};
      audio.onerror=()=>{clearTimeout(timer);resolve({name,error:audio.error?.code});};
      audio.src='assets/'+name+'.mp3';audio.load();
    })))''')
    assert all(item.get('duration',0)>0 for item in audio_result),audio_result
    select(offline,'mage',4)
    offline.click('#start')
    offline.wait_for_timeout(150)
    assert offline.locator('#hud').is_visible() and state(offline)['index']==4
    offline.screenshot(path=str(OUT/'mage-desert-play.png'))
    checks.append({'offline_entry_images_and_audio':{'images':image_result,'audio':audio_result}})
    offline.close()
    mobile_check(browser,url,errors,resources,checks)
    mobile_check(browser,url,errors,resources,checks,landscape=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url',nargs='?',help='Optional preview URL; otherwise start a temporary local server')
    parser.add_argument('--contract-only',action='store_true',help='Check expanded UI contract without campaign play')
    args=parser.parse_args()
    OUT.mkdir(exist_ok=True)
    checks,errors,resources=[],[],[]
    failure=None
    source_hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in SOURCE_FILES}
    try:
        with local_url(args.url) as url,sync_playwright() as playwright:
            try:
                browser=playwright.chromium.launch(headless=True)
            except Exception:
                browser=playwright.chromium.launch(channel='msedge',headless=True)
            try:
                run(browser,url,args,checks,errors,resources)
                assert not errors,errors
                assert not resources,resources
                assert source_hashes=={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in SOURCE_FILES},'Production source changed during browser QA; rerun with stable files'
            except Exception:
                for context in browser.contexts:
                    for index,page in enumerate(context.pages):
                        try:
                            page.screenshot(path=str(OUT/f'failure-{index}.png'))
                        except Exception:
                            pass
                raise
            finally:
                browser.close()
    except Exception as error:
        failure=f'{type(error).__name__}: {error}'
        raise
    finally:
        report={'passed':failure is None,'contract_only':args.contract_only,
                'verified_at_utc':datetime.now(timezone.utc).isoformat(),'checks':checks,
                'console_errors':errors,'resource_errors':resources,'failure':failure,'source_sha256':source_hashes}
        filename='contract-verification.json' if args.contract_only else 'browser-verification.json'
        (OUT/filename).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'passed':failure is None,'checks':len(checks),'failure':failure,
                          'console_errors':errors,'resource_errors':resources},ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
