"""Focused scenery / ending QA. Goal fixtures supplement the real keyboard campaign."""
from datetime import datetime,timezone
import hashlib
import json
import time
from playwright.sync_api import sync_playwright
from browser_qa import ROOT,OUT,THEMES,SOURCE_FILES,attach,local_url,ready,select

checks,errors,resources=[],[],[]
hashes={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}

def finish_fixture(page):
    # Fixture the approach, then let the real core goal predicate and event run.
    page.evaluate('''()=>{const g=__qaGame;g.boss.hp=0;g.projectiles=[];
      Object.assign(g.player,{x:g.level.width-185,y:500,vx:0,vy:0,grounded:true,invulnerable:2});
      g.cat.x=g.player.x-55;g.cat.y=570;g.camera=g.level.width-1280;}''')
    page.wait_for_selector('#finale:not([hidden])')

def frozen(page):
    return page.evaluate('''()=>{const g=__qaGame;return JSON.stringify({p:g.player,c:g.cat,
      time:g.elapsed,h:g.hearts,coins:g.collected,bank:g.bank,campaign:g.campaignTime});}''')

with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
        attach(page,'presentation',errors,resources);page.goto(url);ready(page)
        select(page,'hero',0);page.locator('#start').focus();page.keyboard.press('Enter');finish_fixture(page)
        page.wait_for_timeout(100)
        skip=page.locator('#skipFinale').bounding_box();stage=page.locator('#stage').bounding_box()
        assert skip['y']>=stage['y'] and skip['y']+skip['height']<=stage['y']+stage['height'],{'skip':skip,'stage':stage}
        page.keyboard.press('Enter');page.wait_for_selector('#modal:not([hidden])');page.click('#home')
        checks.append('keyboard-only arrival autofocus keeps the skip button inside the clipped stage')
        for i,theme in enumerate(THEMES):
            if i:page.click('#home')
            select(page,'hero',i);page.click('#start');page.wait_for_timeout(200)
            page.screenshot(path=str(OUT/f'scenery-{theme}.png'))
        # Full final sequence, actual result gate and score freeze.
        finish_fixture(page);before=frozen(page)
        assert page.locator('#skipFinale').is_visible()
        assert not page.locator('#modal').is_visible()
        page.wait_for_timeout(1600)
        page.screenshot(path=str(OUT/'arrival-camp.png'))
        assert frozen(page)==before
        page.click('#help');page.wait_for_timeout(400)
        assert page.locator('#modalTitle').inner_text()=='向远方，轻轻一跃'
        page.keyboard.press('Escape');assert page.locator('#finale').is_visible()
        page.wait_for_timeout(3200)
        page.screenshot(path=str(OUT/'finale-route.png'))
        assert frozen(page)==before
        page.wait_for_selector('#modal:not([hidden])',timeout=6000)
        assert page.locator('#modalTitle').inner_text()=='一起抵达远方'
        assert page.locator('#modalActions button').first.evaluate('(e)=>e===document.activeElement')
        checks.append('natural 7-second final sequence; help interruption; frozen physics, score and timer; results and focus')
        page.get_by_role('button',name='从草原重新出发').click()
        finish_fixture(page);page.wait_for_timeout(900)
        page.screenshot(path=str(OUT/'arrival-ordinary.png'))
        page.keyboard.press('Space')
        page.wait_for_selector('#modal:not([hidden])')
        assert '已抵达' in page.locator('#modalTitle').inner_text()
        checks.append('ordinary arrival; keyboard skip; replay after final restart')
        for key in ('Enter','Escape','button'):
            page.click('#home');select(page,'ranger',1);page.click('#start');finish_fixture(page)
            if key=='button':page.click('#skipFinale')
            else:page.keyboard.press(key)
            page.wait_for_selector('#modal:not([hidden])')
            checks.append('skip via '+key)
        page.click('#home');select(page,'hero',0);page.click('#start');finish_fixture(page)
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.wait_for_timeout(4300);assert page.locator('#finale').is_visible()
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        page.wait_for_selector('#modal:not([hidden])',timeout=6000)
        checks.append('focus loss freezes cinematic and focus resumes it')
        page.close()
        for label,size in [('portrait',{'width':390,'height':844}),('landscape',{'width':844,'height':390})]:
            page=browser.new_page(viewport=size,has_touch=True,is_mobile=True,device_scale_factor=1)
            attach(page,label,errors,resources);page.goto(url);ready(page)
            select(page,'mage',5);page.locator('#start').scroll_into_view_if_needed();page.click('#start')
            finish_fixture(page);page.wait_for_timeout(4500)
            page.screenshot(path=str(OUT/f'finale-{label}.png'))
            box=page.locator('#skipFinale').bounding_box();assert box and box['width']>=44 and box['height']>=40
            assert 0<=box['x']<size['width'] and box['y']+box['height']<=size['height']
            page.tap('#skipFinale');page.wait_for_selector('#modal:not([hidden])')
            checks.append(label+' ending and real touch skip');page.close()
        page=browser.new_page(viewport={'width':1280,'height':800},reduced_motion='reduce')
        attach(page,'reduced',errors,resources);page.goto((ROOT/'index.html').as_uri());ready(page)
        select(page,'mage',5);page.click('#start');finish_fixture(page)
        started=time.monotonic();before=frozen(page)
        page.wait_for_selector('#modal:not([hidden])',timeout=3000)
        assert time.monotonic()-started<2.5 and frozen(page)==before
        checks.append('offline reduced-motion route uses short dissolve; physics frozen; all new files load')
        assert not errors and not resources,(errors,resources)
    finally:browser.close()
assert hashes=={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}
report={'passed':True,'verified_at_utc':datetime.now(timezone.utc).isoformat(),'checks':checks,
        'console_errors':errors,'resource_errors':resources,'source_sha256':hashes}
(OUT/'presentation-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'checks':checks},ensure_ascii=False))
