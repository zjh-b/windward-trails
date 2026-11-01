"""Walk into swamp/quicksand through real keyboard input, then jump out."""
import hashlib
import json
import time
from playwright.sync_api import sync_playwright
from browser_qa import ROOT, OUT, SOURCE_FILES, attach, local_url, ready, select, state

checks,errors,resources=[],[],[]
hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in SOURCE_FILES}
with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        for index,safe,kind in [(1,1000,'swamp'),(4,1010,'quicksand')]:
            page=browser.new_page(viewport={'width':1280,'height':800})
            attach(page,kind,errors,resources);page.goto(url);ready(page)
            select(page,'hero',index);page.click('#start')
            held=set();jump=False;deadline=time.monotonic()+25
            while time.monotonic()<deadline:
                data=page.evaluate('''()=>{const g=__qaGame;return {x:g.player.x,vy:g.player.vy,
                  d:__qaDecision(g),status:g.status};}''')
                assert data['status']=='playing',data
                if data['x']>=safe:break
                wanted={'ArrowRight','KeyF'}
                for key in wanted-held:page.keyboard.down(key)
                held=wanted
                if jump and data['vy']>=0:page.keyboard.up('Space');jump=False
                if data['d']['jumpPressed'] and not jump:page.keyboard.down('Space');jump=True
                page.wait_for_timeout(16)
            else:raise AssertionError('Did not reach trap approach')
            for key in held|{'Space'}:page.keyboard.up(key)
            page.wait_for_function('__qaGame.player.grounded&&__qaGame.player.y>495',timeout=6000)
            page.keyboard.down('ArrowRight')
            page.wait_for_function('__qaGame.player.x>=__qaGame.hazards[0].x+20',timeout=4000)
            page.keyboard.up('ArrowRight');page.wait_for_timeout(700)
            trapped=page.evaluate('({trap:__qaGame.player.trap,sink:__qaGame.player.sink,hearts:__qaGame.hearts})')
            assert trapped['trap']==kind and trapped['hearts']==3,trapped
            assert page.locator('#trapStatus').is_visible()
            if kind=='quicksand':assert trapped['sink']>.1,trapped
            page.screenshot(path=str(OUT/f'{kind}-trap.png'))
            page.keyboard.down('Space');page.keyboard.down('ArrowRight');page.wait_for_timeout(250)
            airborne=page.evaluate('({trap:__qaGame.player.trap,sink:__qaGame.player.sink,y:__qaGame.player.y})')
            assert airborne['trap']=='' and airborne['y']<490,airborne
            if kind=='quicksand':assert airborne['sink']<trapped['sink']
            page.keyboard.up('Space');page.keyboard.up('ArrowRight')
            checks.append({'trap':kind,'real_keyboard_entry':trapped,'jump_escape':airborne})
            page.close()
        assert not errors and not resources,(errors,resources)
        assert hashes=={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in SOURCE_FILES}
    finally:browser.close()
report={'passed':True,'checks':checks,'console_errors':errors,'resource_errors':resources,'source_sha256':hashes}
(OUT/'traps-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
