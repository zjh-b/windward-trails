"""Browser ambience routing, fades and mute/pause lifecycle; not a listening test."""
from datetime import datetime,timezone
import hashlib
import json
from playwright.sync_api import sync_playwright
from browser_qa import ROOT,OUT,SOURCE_FILES,attach,local_url,ready,select

trace='''(()=>{
  window.__qaAmbience=[];window.__qaVoices=[];
  const Original=window.Audio;
  window.Audio=function(...args){const a=new Original(...args),volume=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'volume');
    a._qaGainWrites=[];let previous=-1;
    Object.defineProperty(a,'volume',{get(){return volume.get.call(a)},set(value){if(value!==previous){a._qaGainWrites.push(value);previous=value;}volume.set.call(a,value);}});
    __qaAmbience.push(a);return a;};
  window.Audio.prototype=Original.prototype;
  const AC=window.AudioContext||window.webkitAudioContext,create=AC.prototype.createOscillator;
  AC.prototype.createOscillator=function(...args){const n=create.apply(this,args),entry={context:this,ended:false,stopAt:null};
    __qaVoices.push(entry);const stop=n.stop.bind(n);n.stop=function(at){entry.stopAt=at??this.context.currentTime;return stop(at);};
    n.addEventListener('ended',()=>entry.ended=true);return n;};
})();'''
hashes={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}
checks,errors,resources=[],[],[]
with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        page=browser.new_page(viewport={'width':1280,'height':800})
        attach(page,'audio',errors,resources);page.add_init_script(trace)
        page.goto(url);ready(page)
        beds=page.evaluate('__qaAmbience.filter(a=>a.loop).map(a=>new URL(a.src).pathname.split("/").pop())')
        assert sorted(beds)==sorted([t+'.mp3' for t in ['grassland','forest','alpine','lagoon','desert','cavern']]),beds
        for index,theme in enumerate(['grassland','forest','alpine','lagoon','desert','cavern']):
            if index:page.click('#home')
            select(page,'hero',index);page.click('#start')
            page.wait_for_function('theme=>__qaAmbience.some(a=>a.src.endsWith(theme+".mp3")&&!a.paused&&a.readyState>=2)',arg=theme)
            page.wait_for_timeout(100)
            gain=page.evaluate('theme=>__qaAmbience.find(a=>a.src.endsWith(theme+".mp3")).volume',theme)
            assert 0<gain<=.34,(theme,gain)
            page.wait_for_timeout(650)
            active=page.evaluate('__qaAmbience.filter(a=>!a.paused).map(a=>({src:a.src,volume:a.volume,duration:a.duration}))')
            assert len(active)==1 and active[0]['src'].endswith(theme+'.mp3'),active
            assert abs(active[0]['volume']-.34)<.005 and active[0]['duration']>=35,active
            assert page.evaluate('theme=>__qaAmbience.find(a=>a.src.endsWith(theme+".mp3"))._qaGainWrites.filter(v=>v>0&&v<.34).length',theme)>=3
        checks.append('six scenes use matching natural recordings; exactly one settled bed; soft start/scene transitions')
        page.evaluate('__qaAmbience.find(a=>!a.paused).currentTime=__qaAmbience.find(a=>!a.paused).duration-.25')
        page.wait_for_function('__qaAmbience.some(a=>!a.paused&&a.currentTime<1)',timeout=5000)
        checks.append('40-second MP3 loop returns to the beginning without ending playback')
        page.click('#pause')
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        assert page.evaluate('__qaAmbience.every(a=>a.paused&&a.muted)'), 'Hiding an already paused page leaves ambience alive'
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_timeout(260)
        assert page.evaluate('__qaAmbience.every(a=>a.paused&&a.volume===0)')
        page.get_by_role('button',name='继续旅程',exact=True).click();page.wait_for_timeout(700)
        assert page.evaluate('__qaAmbience.filter(a=>!a.paused).length')==1
        checks.append('pause fades ambience out, resume restores one bed')
        page.evaluate("__qaGame.events.push({type:'checkpoint',x:__qaGame.player.x,y:__qaGame.player.y})")
        page.wait_for_function('__qaVoices.length>=4')
        page.keyboard.press('KeyM')
        assert page.evaluate('__qaAmbience.every(a=>a.paused&&a.volume===0)')
        assert page.evaluate('__qaVoices.filter(v=>!v.ended).every(v=>v.stopAt<=v.context.currentTime+.06)'), 'Queued notes survive mute'
        page.wait_for_timeout(100)
        assert page.evaluate('__qaVoices.every(v=>v.ended)')
        page.reload();ready(page)
        assert '关' in page.locator('#sound').inner_text()
        page.click('#start');page.wait_for_timeout(300)
        assert page.evaluate('__qaAmbience.every(a=>a.paused)')
        page.click('#sound');page.wait_for_timeout(700)
        assert page.evaluate('__qaAmbience.filter(a=>!a.paused).length')==1
        checks.append('mute immediately stops beds and future scheduled tones; preference survives reload; unmute resumes')
        page.close()
        page=browser.new_page(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
        attach(page,'volume-unavailable',errors,resources);page.add_init_script(trace)
        page.add_init_script("Object.defineProperty(HTMLMediaElement.prototype,'volume',{configurable:true,get(){return 1},set(value){}})")
        page.goto(url);ready(page);page.click('#start');page.wait_for_timeout(650)
        assert page.evaluate('__qaAmbience.filter(a=>!a.paused&&!a.muted).length')==1
        page.click('#pause');page.wait_for_timeout(260)
        assert page.evaluate('__qaAmbience.every(a=>a.paused&&a.muted)')
        checks.append('mobile media ignoring volume writes still stops and mutes reliably')
        # Render the production cancellation function just before a delayed note
        # begins. AudioParam.value alone cannot prove that no transient is emitted.
        stop_source='function stopVoices(){'+(ROOT/'game.js').read_text(encoding='utf-8').split('function stopVoices(){',1)[1].split('\n  function syncSound',1)[0]
        peak=page.evaluate('''async stopSource => {
          const audioContext=new OfflineAudioContext(1,22050,44100),activeVoices=new Set();
          const o=audioContext.createOscillator(),g=audioContext.createGain();
          g.gain.setValueAtTime(0,.1);g.gain.linearRampToValueAtTime(.035,.112);
          g.gain.exponentialRampToValueAtTime(.001,.25);o.connect(g);g.connect(audioContext.destination);
          o.start(.1);o.stop(.27);activeVoices.add({o,g,stopping:false});
          const stop=eval('('+stopSource+')'),suspended=audioContext.suspend(.09);
          const rendered=audioContext.startRendering();await suspended;stop();await audioContext.resume();
          const data=(await rendered).getChannelData(0);let peak=0;
          for(const sample of data)peak=Math.max(peak,Math.abs(sample));return peak;
        }''',stop_source)
        assert peak<.00001,('mute emits a delayed-note transient',peak)
        checks.append('rendered cancellation 10ms before a delayed tone emits no transient')
        assert not errors and not resources,(errors,resources)
    finally:browser.close()
assert hashes=={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in SOURCE_FILES}
(OUT/'audio-browser-verification.json').write_text(json.dumps({'passed':True,'verified_at_utc':datetime.now(timezone.utc).isoformat(),
    'checks':checks,'console_errors':errors,'resource_errors':resources,'source_sha256':hashes,
    'perceptual_listening':'pending'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'checks':checks},ensure_ascii=False))
