/* Windward Trails: all assets and gameplay run locally, without network calls. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false});
  const game=new TrailCore.Game();let H=720;
  let W=1280,dpr=1,ready=false,selected=0,previousStatus='menu',last=0,accumulator=0,visualTime=0,walk=0,toastUntil=0,helpReturn='menu',helpOpen=false;
  const keys=new Set(),touch=new Map();let jumpQueued=false,reloadQueued=false,touchRun=false,lastSave=0,lastRender=0;
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
  const mobileScreen=matchMedia('(pointer:coarse)');
  let landscapeMode=false,landscapeFullscreen=false,orientationRequest=0;
  const finale=new TrailFinale.Finale();let presentationPaused=false;
  const images={},particles=[],rewardPops=[];let rewardNoticeLeft=0;
  let renderedHearts=-1,renderedCoins=-1,renderedAmmo='',renderedTrap='';
  const themes={
    grassland:{sky:'#9fc7ca',earth:'#8a7954',deep:'#575f3e',rim:'#658143',light:'#c0cd7d',grass:'#8caa57',accent:'#e8cf75',mist:'#c9d9b9'},
    forest:{sky:'#4c7b6c',earth:'#485a3c',deep:'#243e30',rim:'#527541',light:'#a5be6d',grass:'#74964a',accent:'#f1db87',mist:'#7d9e84'},
    alpine:{sky:'#b1c7d3',earth:'#8a999b',deep:'#546d75',rim:'#bfccc2',light:'#f0f1df',grass:'#8b9b6d',accent:'#efce80',mist:'#b6cbd3'},
    lagoon:{sky:'#95c9cc',earth:'#b0a384',deep:'#526f68',rim:'#b9c8a3',light:'#ede6be',grass:'#7faaa0',accent:'#e8d7a6',mist:'#95d2ce'},
    desert:{sky:'#dab69b',earth:'#b48055',deep:'#77523e',rim:'#d8ad72',light:'#f6d69a',grass:'#9b945a',accent:'#edc77f',mist:'#e0ba95'},
    cavern:{sky:'#1e384a',earth:'#476c75',deep:'#1c303f',rim:'#639b9c',light:'#a4e1d3',grass:'#72bac2',accent:'#a9ebe0',mist:'#3c7280'}
  };
  const rnd=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const formatTime=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
  function readJourney(){try{const data=JSON.parse(read('windward-journey','null'));return new TrailCore.Game().restore(data)?data:null;}catch{return null;}}
  let journey=readJourney();
  function saveJourney(){
    if(game.status==='menu')return;
    journey=game.snapshot();
    try{if(journey)localStorage.setItem('windward-journey',JSON.stringify(journey));else localStorage.removeItem('windward-journey');}catch{}
  }
  function continueJourney(){
    if(!journey||!game.restore(journey)){journey=null;updateChoices();return;}
    rememberRoute();clearInput();particles.length=0;walk=0;syncUI();unlockAudio();canvas.focus();
    if(game.status==='playing')toast('继续旅程 · 已回到最近的检查点');
  }
  game.setCharacter(read('windward-character','hero'));
  const rememberedLevel=Number(read('windward-level','0'));
  selected=Number.isInteger(rememberedLevel)&&rememberedLevel>=0&&rememberedLevel<TrailCore.levels.length?rememberedLevel:0;
  game.preview(selected);
  const scoreValue=key=>{const n=Number(read(key,'0'));return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0;};
  const bestCoins=index=>scoreValue(`windward-best-${index}`);
  function rememberRoute(){selected=game.index;save('windward-level',selected);save('windward-character',game.character.id);}
  function updateChoices(){
    for(const b of document.querySelectorAll('.character-choice')){
      const active=b.dataset.character===game.character.id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    }
    const weapon=TrailCombat.weapons[game.character.id];
    $('characterDescription').textContent=`${game.character.description} ${weapon.name} · ${weapon.capacity} 发 / ${weapon.reloadDuration} 秒换弹`;
    let completed=0;
    for(const b of document.querySelectorAll('.level-choice')){
      const i=Number(b.dataset.level),active=i===selected,done=read(`windward-complete-${i}`,'0')==='1';
      b.classList.toggle('active',active);b.classList.toggle('completed',done);b.setAttribute('aria-pressed',String(active));
      b.querySelector('.map-record').textContent=done?`✓ 已抵达 · ${bestCoins(i)} 金币`:(i>2?'新的远方':'等待你的脚步');
      if(done)completed++;
    }
    $('mapProgress').textContent=completed?`已抵达 ${completed} / ${TrailCore.levels.length}`:'六处风景，随心选择';
    const encounter=TrailCombat.encounters[selected];
    $('mapDescription').textContent=`${encounter.trap} · ${encounter.guard} · Boss ${encounter.boss}`;
    if(ready)$('start').innerHTML=`出发 · ${TrailCore.levels[selected].name} <span>→</span>`;
    $('continueJourney').hidden=!journey||!ready;
    if(journey)$('continueJourney').textContent=`继续上次 · ${TrailCore.levels[journey.index].name} / ${TrailCore.characters.find(c=>c.id===journey.character).name} →`;
  }
  for(const character of TrailCore.characters){
    const b=document.createElement('button');b.className='character-choice';b.dataset.character=character.id;
    b.setAttribute('aria-label',`${character.name} · ${character.role}`);
    const portrait=document.createElement('span');portrait.className='character-portrait';portrait.setAttribute('aria-hidden','true');
    portrait.style.backgroundImage=`url('assets/${character.sprite}.png')`;
    const meta=window.SPRITES[character.sprite];if(meta)portrait.style.aspectRatio=`${meta.width}/${meta.height}`;
    const copy=document.createElement('span');copy.className='character-copy';
    const name=document.createElement('strong');name.textContent=character.name;const role=document.createElement('small');role.textContent=character.role;copy.append(name,role);b.append(portrait,copy);
    b.onclick=()=>{game.setCharacter(character.id);save('windward-character',character.id);updateChoices();};$('characterOptions').append(b);
  }
  TrailCore.levels.forEach((level,index)=>{
    const b=document.createElement('button');b.className='level-choice';b.dataset.level=index;
    const thumb=document.createElement('span');thumb.className=`thumb ${level.id}`;
    const number=document.createElement('span');number.className='map-number';number.textContent=String(index+1).padStart(2,'0');thumb.append(number);
    const name=document.createElement('strong');name.textContent=level.name;const record=document.createElement('small');record.className='map-record';b.append(thumb,name,record);
    b.onclick=()=>{selected=index;game.preview(index);save('windward-level',index);syncUI();};$('levelOptions').append(b);
  });
  updateChoices();
  let muted=read('windward-muted','0')==='1',audioContext=null,currentAmbient=null;
  const ambient={},ambientLevels=new WeakMap(),activeVoices=new Set(),ambienceVolume=.34;
  for(const id of ['grassland','forest','alpine','lagoon','desert','cavern']){const a=new Audio(`assets/${id}.mp3`);a.loop=true;a.preload='none';a.volume=0;a.muted=true;ambientLevels.set(a,0);ambient[id]=a;}
  function stopVoices(){
    if(!audioContext)return;const now=audioContext.currentTime;
    for(const v of activeVoices){if(v.stopping)continue;v.stopping=true;v.g.gain.cancelScheduledValues(now);v.g.gain.setValueAtTime(0,now);v.o.stop(now+.04);}
  }
  function syncSound(){
    $('sound').textContent=`声音 · ${muted?'关':'开'}`;$('sound').setAttribute('aria-label',muted?'开启声音':'关闭声音');
    currentAmbient=ambient[game.level.id];
    if(muted||document.hidden){for(const a of Object.values(ambient)){a.muted=true;a.volume=0;ambientLevels.set(a,0);a.pause();}}
    if(muted||document.hidden||['menu','paused','gameOver'].includes(game.status))stopVoices();
    if(!muted&&!document.hidden&&game.status==='playing'&&currentAmbient.paused){
      const a=currentAmbient;a.muted=false;a.play().then(()=>{if(a!==currentAmbient||muted||document.hidden||game.status!=='playing'){a.muted=true;a.volume=0;ambientLevels.set(a,0);a.pause();}}).catch(()=>{});
    }
  }
  function updateAmbience(dt){
    for(const a of Object.values(ambient)){
      const audible=a===currentAmbient&&!muted&&!document.hidden&&game.status==='playing',goal=audible?ambienceVolume:0;
      if(audible&&(a.paused||a.readyState<2))continue;
      const step=ambienceVolume*dt/(audible?.6:.16),level=ambientLevels.get(a)||0;
      const next=goal>level?Math.min(goal,level+step):Math.max(goal,level-step);
      ambientLevels.set(a,next);a.volume=next;
      // Some mobile media implementations ignore volume writes. Fade progress
      // belongs to the mixer, so pause/mute must never depend on the getter.
      if(!audible&&next<.001){a.muted=true;a.volume=0;ambientLevels.set(a,0);if(!a.paused)a.pause();}
    }
  }
  function unlockAudio(){
    if(!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch{}}
    if(audioContext?.state==='suspended')audioContext.resume().catch(()=>{});
    syncSound();
  }
  function note(frequency,duration=.12,volume=.045,delay=0,type='sine'){
    if(muted||!audioContext||audioContext.state!=='running')return;
    const at=audioContext.currentTime+delay,o=audioContext.createOscillator(),g=audioContext.createGain();
    const voice={o,g,stopping:false};activeVoices.add(voice);
    o.onended=()=>{activeVoices.delete(voice);o.disconnect();g.disconnect();};
    o.type=type;o.frequency.setValueAtTime(frequency,at);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.012);g.gain.exponentialRampToValueAtTime(.001,at+duration);
    o.connect(g);g.connect(audioContext.destination);o.start(at);o.stop(at+duration+.02);
  }
  function sound(type){
    if(type==='coin'){note(880,.12);note(1320,.16,.035,.05);}
    if(type==='jump')note(340,.12,.025,0,'triangle');
    if(type==='stomp')note(180,.13,.07,0,'triangle');
    if(type==='spring'){note(330,.12);note(660,.18,.05,.06);}
    if(type==='hurt'){note(160,.18,.055,0,'triangle');note(110,.25,.04,.08);}
    if(type==='shot')note(game.character.id==='mage'?640:390,.07,.018,0,'triangle');
    if(type==='hit')note(210,.08,.025,0,'triangle');
    if(type==='reload'){note(290,.06,.02);note(240,.07,.015,.12);}
    if(type==='reloaded')note(720,.08,.025);
    if(type==='reward'){note(587,.12,.022);note(784,.17,.018,.09);}
    if(type==='shield')note(330,.14,.025,0,'triangle');
    if(type==='bossDefeated')[392,523,659,784].forEach((f,i)=>note(f,.4,.04,i*.12));
    if(type==='checkpoint'||type==='complete')[523,659,784,1046].forEach((f,i)=>note(f,.32,.035,i*.1));
  }
  function toast(message,duration=2.5){$('toast').textContent=message;$('toast').classList.add('show');toastUntil=visualTime+duration;}
  function clearInput(){keys.clear();touch.clear();jumpQueued=false;reloadQueued=false;touchRun=false;syncRun();document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
  function syncRun(){$('touchRun').textContent=`快跑 · ${touchRun?'开':'关'}`;$('touchRun').setAttribute('aria-pressed',String(touchRun));}
  function begin(index=selected){game.start(index);rememberRoute();walk=0;particles.length=0;clearInput();syncUI();unlockAudio();canvas.focus();toast(matchMedia('(pointer:coarse)').matches?'左右移动 · 按住跳跃可跳得更高':'向右出发 · 空格跳跃，按住跳得更高',3.2);}
  function home(){saveJourney();clearInput();game.preview(selected);particles.length=0;syncUI();$('start').focus();}
  function modal(kicker,title,text,stats,actions){
    $('modalKicker').textContent=kicker;$('modalTitle').textContent=title;$('modalText').textContent=text;
    $('modalStats').replaceChildren();
    for(const [value,label]of stats){const d=document.createElement('div');d.className='stat';const n=document.createElement('strong');n.textContent=value;const l=document.createElement('span');l.textContent=label;d.append(n,l);$('modalStats').append(d);}
    $('modalActions').replaceChildren();
    for(const [label,action]of actions){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',action);$('modalActions').append(b);}
    $('modal').hidden=false;requestAnimationFrame(()=>$('modalActions').firstElementChild?.focus());
  }
  function resume(){game.status='playing';clearInput();syncUI();unlockAudio();canvas.focus();}
  function retry(){game.retry();particles.length=0;walk=0;clearInput();syncUI();unlockAudio();canvas.focus();}
  function syncUI(){
    helpOpen=false;
    saveJourney();
    const state=game.status,playing=state!=='menu';
    if(state==='menu'||state==='gameOver'||state==='levelComplete'||state==='won'||game.time===0){rewardPops.length=0;rewardNoticeLeft=0;}
    $('rewardNotice').hidden=state!=='playing'||rewardNoticeLeft<=0;
    $('intro').hidden=playing;$('hud').hidden=!playing;$('playHint').hidden=state!=='playing';$('touchControls').hidden=state!=='playing';
    $('stage').classList.toggle('playing',playing);$('modal').hidden=true;
    resize();
    $('levelName').textContent=`0${game.index+1} / ${game.level.name}`;
    $('activeCharacter').textContent=`${game.character.name} · ${game.character.role}`;
    if(state==='levelComplete'||state==='won'){
      save(`windward-best-${game.index}`,Math.max(bestCoins(game.index),game.collected));
      save(`windward-complete-${game.index}`,'1');
    }
    const terminal=state==='levelComplete'||state==='won';
    if(!terminal)finale.reset();
    if(terminal&&!finale.input){
      const p=game.player;
      finale.start({final:state==='won',reduced:reducedMotion.matches,heroX:p.x+p.w/2,heroY:p.y+p.h,
        catX:game.cat.x,catY:game.cat.y,goalX:game.level.width-145,camera:game.camera});
      clearInput();particles.length=0;$('toast').classList.remove('show');
      $('finaleTitle').textContent=state==='won'?'一起抵达远方':`${game.level.name} · 已抵达`;
      $('finaleText').textContent=state==='won'?'每一处微光，都成了旅途的记忆。':'风停在营地，下一段风景正在等你。';
      requestAnimationFrame(()=>$('skipFinale').focus());
    }
    const arrival=terminal&&!finale.finished;
    $('finale').hidden=!arrival;$('stage').classList.toggle('ending',arrival);
    if(arrival){$('hud').hidden=true;updateChoices();syncSound();previousStatus=state;return;}
    if(state==='paused')modal('TAKE A BREATH','在这里歇一会儿','风景会等你，白猫也是。',[],[['继续旅程',resume],['重新开始本关',retry],['返回选关',home]]);
    if(state==='gameOver')modal('TRY AGAIN','再试一次吧','路上的小失误，也是冒险的一部分。',[[game.collected,'本次金币'],[formatTime(game.elapsed),'用时']],[['重试本关',retry],['返回选关',home]]);
    if(state==='levelComplete'){
      modal('A LITTLE FURTHER',`${game.level.name} · 已抵达`,'整理一下背包，下一段风景在等你。',[[game.collected,'沿途金币'],[formatTime(game.elapsed),'关卡用时']],[['前往'+TrailCore.levels[game.index+1].name,()=>{game.next();rememberRoute();clearInput();particles.length=0;syncUI();unlockAudio();canvas.focus();toast(game.level.subtitle);} ],['再走一次本关',retry],['返回选关',home]]);
    }
    if(state==='won'){
      const total=game.bank+game.collected;save('windward-best',Math.max(scoreValue('windward-best'),total));
      modal('THE JOURNEY IS YOURS','一起抵达远方','从草浪到萤晶，每段风景都成了旅途的记忆。\n谢谢你带白猫走到这里。',[[total,'收集金币'],[formatTime(game.campaignTime+game.elapsed),'旅程用时'],[game.deaths,'跌倒次数']],[['从草原重新出发',()=>begin(0)],['返回选关',home]]);
    }
    updateChoices();syncSound();previousStatus=state;
  }
  function showHelp(){
    if(helpOpen)return;helpOpen=true;
    $('finale').hidden=true;
    helpReturn=game.status;if(game.status==='playing')game.status='paused';previousStatus=game.status;clearInput();syncSound();saveJourney();
    modal('HOW TO WANDER','向远方，轻轻一跃','A / D 或 ← / → 移动，空格 / W / ↑ 跳跃，Shift 奔跑。\nF / J 按住射击，E 换弹；空弹夹自动补充，备用弹药不限。\n从下方顶问号方块：随机获得 5 金币、治疗花、8 秒护盾或 10 秒磁力。每块只领一次，道具自动生效。\n治疗花恢复一颗心，满血改为 5 金币；护盾挡一次伤害，不能防止坠落；磁力吸引附近金币。\n限时效果仅在本关有效，暂停不计时，受伤复活清除；继续旅程保留剩余时长。\n跳过陷阱，留意守卫蓄力。检查点恢复生命，击败 Boss 后抵达终点。\nEsc / P 暂停，R 重开。',[],[['知道了，出发',closeHelp]]);
  }
  function closeHelp(){game.status=helpReturn;syncUI();if(game.status==='playing'){unlockAudio();canvas.focus();}else if(game.status==='menu')$('help').focus();}
  $('start').onclick=()=>begin();$('home').onclick=home;$('help').onclick=showHelp;
  function skipFinale(){if(!finale.active||helpOpen)return;finale.skip();syncUI();}
  $('skipFinale').onclick=skipFinale;
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches&&finale.active)skipFinale();});
  $('continueJourney').onclick=continueJourney;
  $('touchRun').onclick=()=>{touchRun=!touchRun;syncRun();};
  $('touchReload').onclick=()=>{reloadQueued=true;unlockAudio();};
  $('pause').onclick=()=>{clearInput();game.pause();syncUI();};
  $('sound').onclick=()=>{muted=!muted;save('windward-muted',muted?'1':'0');unlockAudio();};
  function syncScreenMode(){
    document.body.classList.toggle('landscape-mode',landscapeMode);
    document.body.classList.toggle('landscape-rotated',landscapeMode&&innerHeight>innerWidth);
    const label=mobileScreen.matches?(landscapeMode?'退出横屏':'横屏玩'):(document.fullscreenElement?'退出全屏':'全屏显示');
    $('screenLabel').textContent=label;$('fullscreen').setAttribute('aria-label',label);
    $('fullscreen').title=label;$('fullscreen').setAttribute('aria-pressed',String(landscapeMode||!!document.fullscreenElement));
    requestAnimationFrame(resize);
  }
  async function leaveLandscape(exitFullscreen=true){
    landscapeMode=false;orientationRequest++;syncScreenMode();
    try{screen.orientation?.unlock?.();}catch{/* Native orientation may be unavailable. */}
    const owned=landscapeFullscreen;landscapeFullscreen=false;
    if(exitFullscreen&&owned&&document.fullscreenElement)try{await document.exitFullscreen();}catch{/* The page layout has already been restored. */}
  }
  async function enterLandscape(){
    const request=++orientationRequest;landscapeMode=true;syncScreenMode();
    // Page landscape is immediately usable even when the browser rejects native APIs.
    if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
      try{
        await document.documentElement.requestFullscreen();
        if(request!==orientationRequest||!landscapeMode){if(document.fullscreenElement)await document.exitFullscreen();return;}
        landscapeFullscreen=true;
      }catch{/* Keep the explicit page-landscape layout when fullscreen is denied. */}
    }
    if(request!==orientationRequest||!landscapeMode)return;
    if(screen.orientation?.lock)try{
      await screen.orientation.lock('landscape');
      if(request!==orientationRequest||!landscapeMode)screen.orientation.unlock();
    }catch{/* Screen orientation lock is optional; page landscape remains available. */}
    syncScreenMode();
  }
  $('fullscreen').onclick=async()=>{
    if(mobileScreen.matches){if(landscapeMode)await leaveLandscape();else await enterLandscape();return;}
    try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{toast('当前浏览器暂不支持全屏');}
    syncScreenMode();
  };
  const jumpKeys=['Space','ArrowUp','KeyW'];
  addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(finale.active&&!helpOpen&&['Enter','Space','Escape'].includes(e.code)){e.preventDefault();skipFinale();return;}
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&game.status==='playing')e.preventDefault();
    if(e.repeat)return;
    if(e.code==='Escape'||e.code==='KeyP'){
      if(helpOpen){closeHelp();return;}
      if(game.status==='playing'||game.status==='paused'){clearInput();game.pause();syncUI();if(game.status==='playing')canvas.focus();}return;
    }
    if(e.code==='KeyR'&&game.status==='playing'){retry();return;}
    if(e.code==='KeyM'){muted=!muted;save('windward-muted',muted?'1':'0');syncSound();return;}
    if(game.status!=='playing')return;
    keys.add(e.code);if(jumpKeys.includes(e.code))jumpQueued=true;if(e.code==='KeyE')reloadQueued=true;
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  function loseFocus(){presentationPaused=true;clearInput();if(game.status==='playing'){game.pause();syncUI();}else syncSound();}
  addEventListener('focus',()=>{presentationPaused=false;});
  addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();else presentationPaused=false;});
  addEventListener('pagehide',saveJourney);
  canvas.addEventListener('pointerdown',()=>{if(game.status==='playing')canvas.focus();});
  for(const button of document.querySelectorAll('[data-control]')){
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.set(e.pointerId,button.dataset.control);button.classList.add('pressed');if(button.dataset.control==='jump')jumpQueued=true;unlockAudio();});
    const release=e=>{touch.delete(e.pointerId);button.classList.toggle('pressed',[...touch.values()].includes(button.dataset.control));};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  $('modal').addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;const buttons=[...$('modalActions').querySelectorAll('button')];if(!buttons.length)return;
    if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}
    else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}
  });
  function controls(){const t=[...touch.values()];return{axis:Number(keys.has('ArrowRight')||keys.has('KeyD')||t.includes('right'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')||t.includes('left')),run:touchRun||keys.has('ShiftLeft')||keys.has('ShiftRight'),jumpPressed:jumpQueued,jumpHeld:jumpKeys.some(k=>keys.has(k))||t.includes('jump'),fire:keys.has('KeyF')||keys.has('KeyJ')||t.includes('fire'),reloadPressed:reloadQueued};}
  function resize(){const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;const ratio=width/height;
    const touchLandscape=mobileScreen.matches&&width>height;
    W=touchLandscape?TrailCore.clamp(Math.round(width*1.25),820,1100):Math.max(640,Math.round(ratio*720));
    H=W/ratio;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  new ResizeObserver(resize).observe(canvas);
  document.addEventListener('fullscreenchange',()=>{if(landscapeMode&&landscapeFullscreen&&!document.fullscreenElement)leaveLandscape(false);syncScreenMode();});
  addEventListener('resize',syncScreenMode);addEventListener('orientationchange',syncScreenMode);
  mobileScreen.addEventListener('change',syncScreenMode);window.visualViewport?.addEventListener('resize',syncScreenMode);
  syncScreenMode();

  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);ctx.fill();}
  function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function background(theme,t){
    ctx.fillStyle=theme.sky;ctx.fillRect(0,0,W,H);
    const bg=images['bg-'+game.level.id];
    if(bg){const bw=Math.max(W+250,1710);const x=-(bw-W)*.30-game.camera*.045;ctx.drawImage(bg,0,0,bg.width,810,x,0,bw,H);}
    const wash=ctx.createLinearGradient(0,400,0,720);wash.addColorStop(0,'#23422e00');wash.addColorStop(1,game.index===1?'#152f2a80':game.index===4?'#80513a35':game.index===5?'#091e3850':'#406f4430');ctx.fillStyle=wash;ctx.fillRect(0,0,W,H);
    if(game.level.id==='lagoon'){
      ctx.fillStyle='#2a9f9e65';ctx.fillRect(0,650,W,70);
      for(let i=0;i<18;i++){const x=((i*113-game.camera*.2+t*9)%(W+100)+W+100)%(W+100)-60;line(x,660+i%4*12,x+38,660+i%4*12,'#e6f7db65',1.5);}
    }
    for(let i=0;i<25;i++){
      const x=((rnd(i+100)*1800+t*(6+rnd(i)*8)-game.camera*.1)% (W+50)+W+50)%(W+50)-25;
      const y=80+rnd(i+400)*480+Math.sin(t*.45+i)*18;
      ellipse(x,y,1.2+rnd(i),1.2+rnd(i),game.index===5?'#adf4df99':game.index===1?'#f4e7a866':'#fff7d740');
    }
  }
  function platform(s,theme,t){
    const x=s.x-game.camera,y=s.y;if(x+s.w<-20||x>W+20)return;
    const isGround=s.kind==='ground',bottom=isGround?Math.max(720,H+30):y+43;
    const grad=ctx.createLinearGradient(0,y,0,bottom);grad.addColorStop(0,theme.earth);grad.addColorStop(1,theme.deep);
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(x+3,y+4);ctx.lineTo(x+s.w-3,y+4);ctx.lineTo(x+s.w,bottom-(isGround?0:15));ctx.lineTo(x+s.w*.72,bottom);ctx.lineTo(x+14,bottom-3);ctx.lineTo(x,bottom-15);ctx.closePath();ctx.fill();
    if(game.index===2||game.index===5){
      for(let i=0;i<s.w;i+=72){ctx.fillStyle=i%144? '#afbcbb22':'#253f4b28';ctx.beginPath();ctx.moveTo(x+i,y+20);ctx.lineTo(x+i+58,y+32);ctx.lineTo(x+i+27,bottom);ctx.lineTo(x+i-10,bottom);ctx.fill();}
    }else{
      ctx.strokeStyle='#1c351e28';ctx.lineWidth=2;
      for(let row=0;row<(isGround?4:1);row++){ctx.beginPath();ctx.moveTo(x+5,y+28+row*30);for(let a=8;a<s.w;a+=28)ctx.lineTo(x+a,y+28+row*30+Math.sin(a*.055+s.x)*5);ctx.stroke();}
      for(let i=0;i<s.w;i+=47){ellipse(x+i+20,y+27+rnd(s.x+i)*85,2.7,1.8,'#ddcf9924');}
    }
    rounded(x,y,s.w,12,4,theme.rim);rounded(x+3,y,s.w-6,3,2,theme.light);
    if(s.kind==='moving'){
      for(let i=12;i<s.w;i+=24)line(x+i,y+5,x+i-2,y+20,'#d4bf7b66',2);
      ellipse(x+12,y+12,2,2,'#2a4234');ellipse(x+s.w-12,y+12,2,2,'#2a4234');
      return;
    }
    const from=Math.max(6,Math.floor((-x)/8)*8),to=Math.min(s.w-4,W-x+12);
    if(game.index===4){
      for(let i=from;i<to;i+=29){ellipse(x+i,y-1,4,1.5,theme.light);}
      if(isGround)for(let i=75;i<s.w;i+=240){if(x+i<0||x+i>W)continue;line(x+i,y,x+i,y-24,'#7c9665',6);line(x+i-8,y-12,x+i+8,y-12,'#7c9665',5);line(x+i-8,y-12,x+i-8,y-21,'#7c9665',4);}
      return;
    }
    if(game.index===5){
      for(let i=from;i<to;i+=41){const ht=8+rnd(s.x+i)*18;ctx.fillStyle=theme.grass;ctx.beginPath();ctx.moveTo(x+i-4,y);ctx.lineTo(x+i-3,y-ht);ctx.lineTo(x+i+2,y-ht-5);ctx.lineTo(x+i+7,y-ht);ctx.lineTo(x+i+5,y);ctx.fill();line(x+i+2,y-ht-3,x+i+2,y-2,theme.light,1);}
      return;
    }
    for(let i=from;i<to;i+=8){
      const seed=s.x+i,ht=4+rnd(seed)*15,sway=Math.sin(t*1.5+seed*.06)*3;
      ctx.fillStyle=rnd(seed+7)>.5?theme.light:theme.grass;ctx.beginPath();ctx.moveTo(x+i,y+3);ctx.lineTo(x+i+1+sway,y-ht);ctx.lineTo(x+i+5,y+3);ctx.fill();
      if(isGround&&game.index!==2&&rnd(seed+15)>.93){line(x+i,y,x+i-2,y-21,theme.grass,1);ellipse(x+i-2,y-22,3.5,2.2,'#f2edc7');ellipse(x+i-2,y-22,1,1,'#cdb25a');}
    }
    if(game.index===1&&isGround){
      for(let i=40;i<s.w;i+=150){line(x+i,y+10,x+i+25,y+62,'#334f30',5);line(x+i+25,y+62,x+i+13,y+106,'#334f30',3);}
    }
  }
  function coin(c,t){if(c.taken)return;const x=c.x-game.camera;if(x<-20||x>W+20)return;const y=c.y+Math.sin(t*3+c.x)*3,rx=8*(.3+.7*Math.abs(Math.cos(t*2+c.x*.02)));
    ctx.shadowColor='#f1cf74';ctx.shadowBlur=10;ellipse(x,y,rx+1,11,'#d3a343');ctx.shadowBlur=0;ellipse(x-1,y-1,rx*.75,8.5,'#ffe399');line(x,y-5,x,y+4,'#f9f4ce',1.5);
  }
  function enemy(e,t){
    if(!e.alive&&e.deadTime>.25)return;const x=e.x-game.camera,y=e.y;if(x<-60||x>W+60)return;
    ctx.save();ctx.translate(x+20,y+28);if(!e.alive)ctx.scale(1,.25);
    ellipse(0,1,22,4,'#20332130');
    for(let i=-1;i<=1;i++){const k=Math.sin(t*13+i*2)*3;line(i*11,-7,i*11+5,-1+k,'#3b3b26',2);}
    ellipse(0,-12,20,13,game.index===2?'#7d8e91':'#866342');ellipse(-5,-17,12,6,game.index===2?'#b0beb8':'#b49c66');
    line(0,-24,1,-7,'#615b3b',2);const face=e.dir*13;ellipse(face,-13,7,8,'#514e32');ellipse(face+e.dir*3,-16,2.2,2.7,'#eee8bb');ellipse(face+e.dir*4,-16,1,1.5,'#242a20');
    line(face,-20,face+e.dir*5,-29,'#514e32',1.5);ctx.restore();
  }
  function flag(x,active,t,goal=false){
    x-=game.camera;if(x<-120||x>W+120)return;
    const y=570,ht=goal?150:84;line(x,y,x,y-ht,'#695d3e',goal?6:4);ellipse(x,y-ht,5,5,'#e8d695');
    ctx.fillStyle=goal?'#d6e4ac':active?'#e4cf7b':'#799c70';ctx.beginPath();ctx.moveTo(x,y-ht+5);ctx.bezierCurveTo(x+28,y-ht+Math.sin(t*2)*5,x+39,y-ht+18,x+58,y-ht+8);ctx.lineTo(x+52,y-ht+42);ctx.bezierCurveTo(x+28,y-ht+48,x+22,y-ht+30,x,y-ht+36);ctx.fill();
    if(goal){ctx.fillStyle='#45613c';ctx.font='bold 16px sans-serif';ctx.fillText('终',x+18,y-ht+29);}
    else if(active){ctx.fillStyle='#526b38';ctx.font='bold 16px sans-serif';ctx.fillText('✓',x+18,y-ht+28);}
    if(goal){
      ctx.fillStyle='#dfd7ad';ctx.beginPath();ctx.moveTo(x+70,y);ctx.lineTo(x+115,y-74);ctx.lineTo(x+167,y);ctx.fill();
      ctx.fillStyle='#a5ad7a';ctx.beginPath();ctx.moveTo(x+115,y-74);ctx.lineTo(x+113,y);ctx.lineTo(x+167,y);ctx.fill();
      ctx.fillStyle='#536449';ctx.beginPath();ctx.moveTo(x+93,y);ctx.lineTo(x+115,y-43);ctx.lineTo(x+135,y);ctx.fill();
      ellipse(x+38,y-9,12,4,'#b9a16f');ellipse(x+38,y-13,5+Math.sin(t*6),11,'#f3d789');
    }
  }
  function spring(s,t){const x=s.x-game.camera;if(x<-60||x>W+60)return;rounded(x-3,566,52,6,2,'#877349');ctx.strokeStyle='#e0cc84';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+8,566);for(let j=0;j<4;j++)ctx.lineTo(x+(j%2?33:12),565-j*4);ctx.stroke();rounded(x,548+Math.sin(t*2),46,8,3,'#e6d089');ctx.fillStyle='#6a7044';ctx.font='bold 12px sans-serif';ctx.fillText('↑',x+18,555);}
  function sprite(kind,x,bottom,height,frame,facing=1,opacity=1){
    const im=images[kind],data=window.SPRITES[kind];if(!im||!data)return;const width=height*data.width/data.height;
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(x-game.camera,bottom+2);ctx.scale(facing,1);ctx.drawImage(im,(frame%12)*data.width,0,data.width,data.height,-width/2,-height,width,height);ctx.restore();
  }
  function sign(x,text){x-=game.camera;if(x<-100||x>W+140)return;line(x,570,x,523,'#7f704a',4);rounded(x-43,505,110,29,4,'#e6dfb8');ctx.fillStyle='#4f6344';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(text,x+12,524);ctx.textAlign='left';}
  function hazard(h,t){
    const x=h.x-game.camera;if(x+h.w<0||x>W)return;
    const phase=TrailCombat.trapPhase(h,game.time),active=phase==='active',warning=phase==='warning';
    const color=h.kind==='quicksand'?'#af7844':h.kind==='swamp'?'#475e45':game.encounter.color;
    ellipse(x+h.w/2,569,h.w/2,8,color);line(x,570,x+h.w,570,warning?'#ffe8a3':color,3);
    if(h.kind==='swamp'||h.kind==='quicksand'){
      for(let i=0;i<4;i++){const k=(t*.4+i*.26)%1;ctx.strokeStyle=h.kind==='swamp'?'#9cab6b99':'#efd19c99';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(x+h.w*(.14+i*.23),568,7+k*10,2+k*2,0,0,Math.PI*2);ctx.stroke();}
      if(h.kind==='swamp')for(let i=8;i<h.w;i+=24){line(x+i,567,x+i+3,557,'#83915b',2);ellipse(x+i+3,556,4,2,'#a8b577');}
    }else{
      if(warning){ctx.fillStyle=`rgba(255,219,143,${.1+.1*Math.sin(t*10)})`;ctx.fillRect(x,525,h.w,45);}
      for(let i=5;i<h.w;i+=17){
        const height=active?(h.kind==='tide'?37:24):6;
        if(h.kind==='tide'){line(x+i,570,x+i+Math.sin(t*6+i)*5,570-height,'#a8e3de',4);ellipse(x+i,570-height,3,4,'#ecf8df');}
        else{ctx.fillStyle=active?color:'#9ba994';ctx.beginPath();ctx.moveTo(x+i-6,570);ctx.lineTo(x+i,570-height);ctx.lineTo(x+i+7,570);ctx.fill();line(x+i,570-height,x+i+2,566,'#e3f1cf',1);}
      }
    }
    // A small sign precedes the trap, so its effect is visible before stepping in.
    line(x-14,570,x-14,529,'#7c7355',2);rounded(x-35,517,45,19,3,'#f0e3b8');ctx.fillStyle='#4a5134';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(h.kind==='quicksand'?'流沙':h.kind==='swamp'?'沼泽':'注意',x-12,531);ctx.textAlign='left';
  }
  function sentry(e,t,boss=false){
    if(e.hp<=0)return;const x=e.x-game.camera;if(x+e.w<0||x>W)return;
    const cx=x+e.w/2,cy=e.y,scale=boss?2.4:1,color=game.encounter.color;
    ctx.save();ctx.translate(cx,cy+e.h);ctx.scale(scale,scale);
    ellipse(0,0,21,4,'#10222b55');
    const charge=e.windup>0;
    if(charge){ctx.strokeStyle='#ffe4a1';ctx.lineWidth=1.8;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,-23,28+Math.sin(t*9)*2,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    const fill=e.hitFlash>0?'#fff2ce':color;
    rounded(-15,-40,30,32,5,fill);ctx.fillStyle='#19373660';ctx.beginPath();ctx.moveTo(7,-40);ctx.lineTo(15,-34);ctx.lineTo(15,-8);ctx.lineTo(7,-8);ctx.fill();
    rounded(-12,-9,8,9,2,'#415555');rounded(4,-9,8,9,2,'#415555');
    rounded(-11,-32,22,11,4,'#1f3b43');ellipse(-4,-26,2,2,charge?'#ffb968':'#f0e5ae');ellipse(5,-26,2,2,charge?'#ffb968':'#f0e5ae');
    if(game.index===0||game.index===1){for(const d of [-1,1]){line(d*10,-40,d*18,-54,color,3);line(d*18,-54,d*12,-59,color,2);ellipse(d*17,-54,6,2,game.index===0?'#b7cb73':'#86a169');}}
    if(game.index===2||game.index===5){for(let i=-1;i<=1;i++){ctx.fillStyle=i%2?'#c5e7df':'#9eace1';ctx.beginPath();ctx.moveTo(i*10-4,-40);ctx.lineTo(i*10,-55-Math.abs(i)*4);ctx.lineTo(i*10+5,-40);ctx.fill();}}
    if(game.index===3){for(const d of [-1,1]){line(d*14,-24,d*27,-32,color,5);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(d*29,-37,7,0,Math.PI*1.6);ctx.stroke();}}
    if(game.index===4){rounded(-20,-43,40,8,2,'#d5b182');ctx.fillStyle='#f1d69b';ctx.beginPath();ctx.moveTo(-11,-43);ctx.lineTo(0,-55);ctx.lineTo(12,-43);ctx.fill();}
    const dir=e.facing||-1;line(dir*14,-18,dir*24,-18,'#4c6855',6);ellipse(dir*25,-18,4,4,charge?'#ffe397':'#cce4b2');
    if(boss){ellipse(0,-14,5,6,e.phase===2?'#ffe0a3':'#ecf2bc');ctx.strokeStyle='#dfecc7';ctx.lineWidth=1;ctx.strokeRect(-7,-21,14,14);}
    ctx.restore();
    if(!boss){rounded(x-3,cy-14,e.w+6,4,2,'#18373280');rounded(x-3,cy-14,(e.w+6)*e.hp/e.maxHp,4,2,'#dfdda6');}
  }
  function battleEffects(t){
    for(const h of game.hazards)hazard(h,t);
    for(const guard of game.guards)sentry(guard,t);
    sentry(game.boss,t,true);
    if(game.boss.hp>0){const x=game.level.width-190-game.camera;if(x>-30&&x<W+30){line(x,570,x,400,'#cce4d899',4);for(let y=410;y<565;y+=24){ellipse(x+Math.sin(t*2+y)*4,y,3,3,'#f3e6a2');}ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f4edc8';ctx.fillText('击败守望者',x,390);ctx.textAlign='left';}}
    for(const b of game.projectiles){const x=b.x-game.camera;if(x<-30||x>W+30)continue;line(x-b.vx*.025,b.y+b.h/2,x,b.y+b.h/2,b.color,b.owner==='player'?3:2);ellipse(x,b.y+b.h/2,b.w*.6,b.h*.7,b.color);ellipse(x-1,b.y+b.h/2,2.5,2.5,'#fff4ce');}
  }
  function battleHUD(){
    const w=game.weapon,key=`${game.character.id}:${w.ammo}:${Math.ceil(w.reloadLeft*10)}`;
    if(key!==renderedAmmo){renderedAmmo=key;$('weaponName').textContent=w.name;$('ammoCount').textContent=mobileScreen.matches&&w.reloadLeft>0?`${w.reloadLeft.toFixed(1)}s`:`${w.ammo} / ${w.capacity}`;$('ammoCount').setAttribute('aria-label',w.reloadLeft>0?`换弹剩余 ${w.reloadLeft.toFixed(1)} 秒`:`弹药 ${w.ammo} / ${w.capacity}`);$('ammoPips').textContent='●'.repeat(w.ammo)+'○'.repeat(w.capacity-w.ammo);$('reloadStatus').textContent=w.reloadLeft>0?`换弹中 · ${w.reloadLeft.toFixed(1)} 秒`:(mobileScreen.matches?'弹药':'F 射击 · E 换弹');$('ammoPips').style.setProperty('--reload',String(w.reloadLeft>0?1-w.reloadLeft/w.reloadDuration:1));}
    const visible=game.status!=='menu'&&game.boss.active&&game.boss.hp>0;
    $('bossHud').hidden=!visible;
    if(visible){$('bossName').textContent=game.encounter.boss;$('bossPhase').textContent=game.boss.windup>0?'正在蓄力 · 准备躲避':game.boss.phase===2?'第二阶段':'守望者';$('bossHealth').style.width=`${game.boss.hp/game.boss.maxHp*100}%`;}
    const message=game.status==='playing'?(game.player.trap==='quicksand'?`流沙下陷 ${Math.round(game.player.sink*100)}% · 跳跃脱离`:game.player.trap==='swamp'?'沼泽减速 · 跳跃脱离':''):'';
    if(message!==renderedTrap){renderedTrap=message;$('trapStatus').hidden=!message;$('trapStatus').textContent=message;}
    let anyEffect=false;
    for(const [kind,id]of [['shield','shieldEffect'],['magnet','magnetEffect']]){
      const remaining=Math.ceil(game.effects[kind]),element=$(id);element.hidden=remaining<=0;
      if(remaining>0){anyEffect=true;const value=`${remaining}s`;if(element.querySelector('[data-time]').textContent!==value)element.querySelector('[data-time]').textContent=value;element.setAttribute('aria-label',`${kind==='shield'?'护盾':'磁力'}，剩余 ${remaining} 秒`);}
    }
    $('itemHud').hidden=!anyEffect||game.status==='menu';
  }
  function campLight(s,t){
    const x=game.level.width-107-game.camera,y=557;
    ctx.save();ctx.globalAlpha=s.lantern*.8;
    const g=ctx.createRadialGradient(x,y,2,x,y,110);g.addColorStop(0,'#ffe5a875');g.addColorStop(.45,'#f6c97822');g.addColorStop(1,'#f6c97800');
    ctx.fillStyle=g;ctx.fillRect(x-110,y-110,220,150);
    if(!s.reduced)for(let i=0;i<22;i++){
      const rise=(t*27+i*17)%135,xx=x+Math.sin(i*2.1+t*.7)*(.2+rise/135)*60;
      ctx.globalAlpha=s.lantern*(1-rise/135)*.8;ellipse(xx,y-rise,1.7,2.1,'#ffe9a5');
    }
    ctx.restore();
  }
  function arrivalOverlay(s){
    ctx.save();
    if(s.final){
      ctx.fillStyle=`rgba(9,28,32,${s.route*.48})`;ctx.fillRect(0,0,W,H);
      const names=['草浪','古树','云海','潮声','落日','萤晶'],colors=['#d2df95','#a3c996','#e1edf0','#a4e3d6','#f2c994','#b4eee7'];
      const points=names.map((_,i)=>({x:W*(.17+i*.132),y:H*.24-Math.sin(i/5*Math.PI)*Math.min(55,H*.08)}));
      ctx.lineWidth=1.5;ctx.strokeStyle='#e9dda23b';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
      const route=s.route*5;
      for(let i=0;i<5;i++){
        const f=TrailCore.clamp(route-i,0,1);if(f<=0)continue;
        line(points[i].x,points[i].y,points[i].x+(points[i+1].x-points[i].x)*f,points[i].y+(points[i+1].y-points[i].y)*f,'#f1dfa5',2);
      }
      points.forEach((p,i)=>{
        const alpha=TrailCore.clamp(route-i+1,0,1);ctx.globalAlpha=alpha;
        ellipse(p.x,p.y,5,5,colors[i]);ellipse(p.x,p.y,1.6,1.6,'#fff8dd');
        ctx.fillStyle='#f3edd7';ctx.font='14px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(names[i],p.x,p.y+29);
      });
      ctx.textAlign='left';ctx.globalAlpha=1;
    }
    const bar=Math.min(42,H*.055)*s.letterbox;ctx.fillStyle='#0d2026';ctx.fillRect(0,0,W,bar);ctx.fillRect(0,H-bar,W,bar);
    $('finaleCaption').style.opacity=String(s.title);
    ctx.restore();
  }
  function render(dt){
    const p=game.player,theme=themes[game.level.id],t=reducedMotion.matches?0:visualTime;
    const arrival=finale.input?finale.sample():null;
    const target=arrival?finale.input.camera+(game.level.width-W*.76-finale.input.camera)*arrival.pan:TrailCore.clamp(p.x-W*.36,0,game.level.width-W);
    if(game.status==='menu')game.camera=0;
    else if(Math.abs(game.camera-target)>900&&p.invulnerable>1.4)game.camera=target;
    else game.camera+=(target-game.camera)*(1-Math.exp(-dt*6));
    background(theme,t);
    let verticalOffset=H<720?H*.78-570:Math.max(0,H-720)*.55;
    // Keep elevated routes and spring jumps in view after zooming the phone camera.
    if(H<720&&game.status!=='menu'&&!arrival)verticalOffset=Math.max(verticalOffset,H*.24-(p.y+p.h-94));
    const sceneryView={id:game.level.id,camera:game.camera,width:W,height:H,time:t,reduced:reducedMotion.matches,horizon:570+verticalOffset};
    TrailScenery.back(ctx,sceneryView);
    ctx.save();ctx.translate(0,verticalOffset);
    // Faint silhouette layers sit behind the playable platform, preserving gaps.
    for(const s of game.platforms){
      if(s.kind==='reward'){TrailItemArt.block(ctx,s,game.camera,game.time,reducedMotion.matches);continue;}
      TrailScenery.ledgeShadow(ctx,game.level.id,s,game.camera,game.platforms);platform(arrival&&s.kind==='ground'&&s.x+s.w===game.level.width?{...s,w:s.w+W}:s,theme,t);
    }
    for(const c of game.checkpoints)flag(c.x,c.active,t);
    flag(game.level.width-145,true,t,true);
    if(arrival)campLight(arrival,finale.elapsed);
    sign(220,'营地在前方 →');
    if(game.index===0)sign(650,'空格 · 轻轻一跃');
    if(game.index===1)sign(610,'树根会随风移动');
    if(game.index===2)sign(550,'借一点风的力量 ↑');
    if(game.index===3)sign(570,'踏着潮声向前');
    if(game.index===4)sign(610,'沙丘的风会托住你');
    if(game.index===5)sign(590,'跟着晶石的微光');
    for(const s of game.springs)spring(s,t);
    for(const c of game.coins)coin(c,t);
    for(const e of game.enemies)enemy(e,t);
    battleEffects(t);
    if(game.status==='playing'&&!game.respawnDelay)walk+=Math.abs(p.vx)*dt*.055;
    const frame=p.grounded?Math.floor(walk)%12:5;
    if(game.status==='menu'){sprite(game.character.sprite,W*.48+game.camera,570,112,Math.floor(t*4)%12,1);sprite('cat',W*.48-72+game.camera,570,43,Math.floor(t*4)%12,1);}
    else if(arrival){
      TrailScenery.shadow(ctx,game.level.id,arrival.heroX-game.camera,570,1.15);
      TrailScenery.shadow(ctx,game.level.id,arrival.catX-game.camera,570,.58,arrival.catHop);
      sprite('cat',arrival.catX,arrival.catY-arrival.catHop,40,arrival.frame,1);
      sprite(game.character.sprite,arrival.heroX,arrival.heroY,94,arrival.frame,1);
    }else{
      TrailScenery.shadow(ctx,game.level.id,p.x+p.w/2-game.camera,p.y+p.h+2,1,Math.max(0,500-p.y));
      TrailScenery.shadow(ctx,game.level.id,game.cat.x-game.camera,game.cat.y,.5);
      sprite('cat',game.cat.x,game.cat.y,40,Math.floor(walk)%12,game.cat.facing);
      const opacity=game.respawnDelay?Math.max(0,game.respawnDelay/.65):p.invulnerable>0&&Math.floor(t*12)%2?.4:1;
      sprite(game.character.sprite,p.x+p.w/2,p.y+p.h+p.sink*14,94,frame,p.facing,opacity);
      TrailItemArt.aura(ctx,p,game.effects,game.camera,game.time,reducedMotion.matches);
      const handX=p.x+p.w/2-game.camera+p.facing*16,handY=p.y+48;
      line(handX-p.facing*3,handY+9,handX+p.facing*13,handY-2,'#8b7651',3);ellipse(handX+p.facing*14,handY-3,4,4,game.weapon.color);
    }
    for(let i=particles.length-1;i>=0;i--){const a=particles[i];a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=100*dt;if(a.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=Math.min(1,a.life*2);ellipse(a.x-game.camera,a.y,a.r,a.r,a.color);ctx.globalAlpha=1;}
    for(let i=rewardPops.length-1;i>=0;i--){
      const pop=rewardPops[i];if(game.status==='playing')pop.age+=dt;
      if(pop.age>=1.1){rewardPops.splice(i,1);continue;}
      ctx.save();ctx.globalAlpha=Math.min(1,(1.1-pop.age)*3);
      TrailItemArt.icon(ctx,pop.reward,pop.x-game.camera,pop.y-25-(reducedMotion.matches?0:Math.min(1,pop.age/.45)*25),30);ctx.restore();
    }
    TrailScenery.front(ctx,{...sceneryView,height:H-verticalOffset});
    ctx.restore();
    const shade=ctx.createLinearGradient(0,0,0,120);shade.addColorStop(0,'#0d2e243f');shade.addColorStop(1,'#0d2e2400');ctx.fillStyle=shade;ctx.fillRect(0,0,W,120);
    if(game.respawnDelay>0){ctx.fillStyle=`rgba(92,37,23,${Math.min(.12,game.respawnDelay*.18)})`;ctx.fillRect(0,0,W,H);}
    if(renderedHearts!==game.hearts){$('hearts').innerHTML='♥'.repeat(game.hearts)+`<span class="lost-heart">${'♥'.repeat(3-game.hearts)}</span>`;$('hearts').setAttribute('aria-label',`生命 ${game.hearts} / 3`);renderedHearts=game.hearts;}
    if(renderedCoins!==game.collected){$('coins').textContent=`◉ ${String(game.collected).padStart(2,'0')}`;renderedCoins=game.collected;}
    $('progressFill').style.width=`${TrailCore.clamp(p.x/(game.level.width-200)*100,0,100)}%`;
    battleHUD();
    if(game.status==='playing')rewardNoticeLeft=Math.max(0,rewardNoticeLeft-dt);
    $('rewardNotice').hidden=game.status!=='playing'||rewardNoticeLeft<=0;
    if(finale.active)arrivalOverlay(arrival);
    if(toastUntil<visualTime)$('toast').classList.remove('show');
  }
  function handleEvents(){
    for(const e of game.events.splice(0)){
      sound(e.type);
      if(e.type==='reward'){
        const label=e.reward==='heal'?(e.healed?'治疗花 · 恢复 1 颗心':'治疗花 · 生命已满，金币 +5'):e.reward==='coins'?'金叶奖励 · 金币 +5':e.reward==='shield'?'护盾果 · 8 秒内抵挡一次伤害':'磁力萤石 · 吸引金币 10 秒';
        $('rewardNotice').textContent=label;rewardNoticeLeft=2.8;
        rewardPops.push({reward:e.reward,x:e.x,y:e.y,age:0});saveJourney();
      }
      if(e.type==='shield'){$('rewardNotice').textContent='护盾已挡住伤害';rewardNoticeLeft=1.8;saveJourney();}
      if(e.type==='checkpoint')toast('检查点已点亮 · 生命已恢复，进度已保存');
      if(e.type==='bossAwake')toast(`${game.encounter.boss} · 留意蓄力，跳跃躲避`,2.4);
      if(e.type==='bossPhase')toast('守望者进入第二阶段 · 攻击更频繁',2);
      if(e.type==='bossDefeated')toast('守望者已击败 · 营地屏障已解除',3);
      if(['checkpoint','hurt','bossDefeated'].includes(e.type))saveJourney();
      if(e.type==='spring')toast('顺着风，再跳远一点',1.2);
      if(!reducedMotion.matches&&['coin','stomp','checkpoint','hit','bossDefeated'].includes(e.type)){
        for(let k=0;k<(e.type==='checkpoint'?18:7);k++)particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*120,vy:-40-Math.random()*80,life:.4+Math.random()*.45,r:1.5+Math.random()*2,color:e.type==='stomp'?'#c4d69b':'#fbe5a2'});
      }
    }
  }
  function frame(now){
    const dt=Math.min(.05,(now-last)/1000||0);last=now;visualTime+=dt;
    updateAmbience(dt);
    if(ready&&!document.hidden){
      accumulator+=dt;
      while(accumulator>=1/120){const input=controls();game.step(1/120,input);jumpQueued=false;reloadQueued=false;accumulator-=1/120;}
      handleEvents();if(previousStatus!==game.status)syncUI();
      if(finale.active){finale.update(dt,presentationPaused||helpOpen);if(finale.finished)syncUI();}
      if(game.status==='playing'&&now-lastSave>2000){saveJourney();lastSave=now;}
      if(game.status==='playing'||finale.active||now-lastRender>=32){render(Math.min(.1,(now-lastRender)/1000||dt));lastRender=now;}
    }
    requestAnimationFrame(frame);
  }
  const files={cat:'cat.png'};
  for(const character of TrailCore.characters)files[character.sprite]=`${character.sprite}.png`;
  for(const level of TrailCore.levels)files['bg-'+level.id]=`bg-${level.id}.jpg`;
  Promise.all(Object.entries(files).map(([name,file])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[name]=im;resolve();};im.onerror=reject;im.src='assets/'+file;}))).then(()=>{
    ready=true;resize();syncUI();$('start').disabled=false;
  }).catch(()=>{$('loadError').hidden=false;$('start').textContent='素材加载失败';});
  requestAnimationFrame(frame);
})();
