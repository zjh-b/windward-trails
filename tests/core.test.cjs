const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../core.js');
const tick = (g, n, input={}) => { for(let i=0;i<n;i++) g.step(1/120,input); };

test('a playable game starts with three hearts and stable ground contact', () => {
  assert.equal(typeof Core.Game, 'function');
  const g = new Core.Game(); g.start(0); const y=g.player.y;
  tick(g,240); assert.equal(g.status,'playing'); assert.equal(g.hearts,3);
  assert.ok(Math.abs(g.player.y-y)<.01); assert.ok(g.player.grounded);
});
test('holding jump reaches higher than a short tap; cannot jump in midair', () => {
  const a=new Core.Game(),b=new Core.Game(); a.start(); b.start();
  a.step(1/120,{jumpPressed:true,jumpHeld:true}); b.step(1/120,{jumpPressed:true,jumpHeld:true});
  tick(a,24,{jumpHeld:true}); tick(b,24,{jumpHeld:false});
  assert.ok(a.player.y<b.player.y-20);
  const vy=a.player.vy; a.step(1/120,{jumpPressed:true,jumpHeld:true}); assert.ok(a.player.vy>vy);
});
test('a jump shortly after leaving a ledge is accepted', () => {
  const g=new Core.Game(); g.start(); g.player.x=855; g.player.vx=320;
  tick(g,8,{axis:1,jumpHeld:true}); assert.equal(g.player.grounded,false);
  g.step(1/120,{axis:1,jumpPressed:true,jumpHeld:true}); assert.ok(g.player.vy<-500);
});
test('jump buffering jumps when the player lands', () => {
  const g=new Core.Game(); g.start(); g.player.y=480;g.player.vy=300;g.player.grounded=false;g.player.coyote=0;
  g.step(1/120,{jumpPressed:true,jumpHeld:true}); tick(g,10,{jumpHeld:true}); assert.ok(g.player.vy<0);
});
test('coins cannot be collected twice after respawning', () => {
  const g=new Core.Game();g.start();const c=g.coins[0];g.player.x=c.x-15;g.player.y=c.y-35;
  tick(g,2);const n=g.collected;assert.ok(n>0);g.respawn();g.player.x=c.x-15;g.player.y=c.y-35;
  tick(g,2);assert.equal(g.collected,n);
});
test('descending onto an enemy stomps it and bounces the player', () => {
  const g=new Core.Game();g.start();const e=g.enemies[0];g.player.x=e.x;g.player.y=e.y-g.player.h-3;g.player.vy=480;g.player.grounded=false;
  tick(g,3,{jumpHeld:true});assert.equal(e.alive,false);assert.ok(g.player.vy<0);assert.equal(g.hearts,3);
});
test('damage respawns at a checkpoint with immunity; three hits end the attempt', () => {
  const g=new Core.Game();g.start();g.player.x=g.checkpoints[0].x+10;tick(g,2);
  assert.ok(g.checkpoint.x>1000);g.hurt();tick(g,100);assert.ok(g.player.x>1000);assert.equal(g.hearts,2);
  g.hurt();assert.equal(g.hearts,2);g.player.invulnerable=0;g.hurt();tick(g,100);
  g.player.invulnerable=0;g.hurt();assert.equal(g.status,'gameOver');g.retry();assert.equal(g.hearts,3);assert.equal(g.collected,0);
});
test('pausing freezes simulation and retry clears transient state', () => {
  const g=new Core.Game();g.start();g.pause();const x=g.player.x,t=g.elapsed;tick(g,100,{axis:1});
  assert.equal(g.player.x,x);assert.equal(g.elapsed,t);g.pause();tick(g,40,{axis:1});assert.ok(g.player.x>x);
  g.retry();assert.equal(g.player.vx,0);assert.equal(g.player.vy,0);
});
test('all required routes are traversable with actual movement and jumps', () => {
  for(let stage=0;stage<Core.levels.length;stage++){
    const g=new Core.Game();g.start(stage);
    for(let frame=0;frame<10000 && g.status==='playing';frame++){
      const p=g.player; const ahead=p.x+p.w;
      const floor=g.platforms.find(s=>s.kind==='ground' && ahead>=s.x-5 && ahead<=s.x+s.w);
      const danger=g.enemies.some(e=>e.alive && e.x>p.x && e.x-ahead<115 && Math.abs(e.y+e.h-(p.y+p.h))<45);
      const nearGap=floor && floor.x+floor.w-ahead<90 && floor.x+floor.w<g.level.width;
      const jump=p.grounded && (danger || nearGap);
      g.step(1/120,{axis:1,run:true,jumpPressed:jump,jumpHeld:true});
    }
    assert.ok(['levelComplete','won'].includes(g.status),`stage ${stage}: ${g.status}, x=${g.player.x}, hearts=${g.hearts}`);
    assert.ok(g.collected>5);
  }
});
test('ordinary running speed is enough for every mandatory gap', () => {
  for(let stage=0;stage<Core.levels.length;stage++){
    const g=new Core.Game();g.start(stage);
    for(let frame=0;frame<12000&&g.status==='playing';frame++){
      const p=g.player,a=p.x+p.w;
      const ground=g.platforms.find(s=>s.kind==='ground'&&a>=s.x-5&&a<=s.x+s.w);
      const gap=ground&&ground.x+ground.w-a<32&&ground.x+ground.w<g.level.width;
      const enemy=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-a<90&&Math.abs(e.y+e.h-(p.y+p.h))<45);
      g.step(1/120,{axis:1,jumpPressed:p.grounded&&(gap||enemy),jumpHeld:true});
    }
    assert.ok(['won','levelComplete'].includes(g.status),`normal speed stage ${stage}: ${g.status} x=${g.player.x}`);
  }
});
test('a rider follows the moving platform without falling through it', () => {
  const g=new Core.Game();g.start(1);const platform=g.platforms.find(s=>s.kind==='moving');
  Object.assign(g.player,{x:platform.x+20,y:platform.y-70,vx:0,vy:0,grounded:true,onPlatform:platform.id});
  const offset=g.player.x-platform.x;
  tick(g,100);
  assert.ok(g.player.grounded);assert.equal(g.player.onPlatform,platform.id);
  assert.ok(Math.abs(g.player.x-platform.x-offset)<.01);
});

test('six distinct maps can be selected, with safe checkpoint landing positions', () => {
  assert.deepEqual(Core.levels.map(l=>l.id),['grassland','forest','alpine','lagoon','desert','cavern']);
  for(let stage=0;stage<Core.levels.length;stage++){
    const g=new Core.Game();g.start(stage);assert.equal(g.index,stage);
    for(const checkpoint of g.checkpoints){
      const x=checkpoint.x+38;
      assert.ok(g.platforms.some(s=>s.kind==='ground'&&x>=s.x&&x+g.player.w<s.x+s.w),g.level.id);
    }
  }
});

test('character choice changes real speed and jump height while retaining common collision size', () => {
  assert.equal(Core.characters?.length,3);
  const results={};
  for(const character of Core.characters){
    const g=new Core.Game();g.start(0,character.id);assert.equal(g.character.id,character.id);
    tick(g,24,{axis:1});const speed=g.player.vx;
    tick(g,24,{axis:1,run:true});const runSpeed=g.player.vx;
    g.retry();const origin=g.player.y;g.step(1/120,{jumpPressed:true,jumpHeld:true});
    tick(g,35,{jumpHeld:true});
    results[character.id]={speed,runSpeed,height:origin-g.player.y};
    assert.equal(speed,character.speed);assert.equal(runSpeed,character.runSpeed);
    assert.equal(g.player.w,34);assert.equal(g.player.h,70);assert.equal(g.hearts,3);
  }
  assert.ok(results.ranger.speed>results.hero.speed);
  assert.ok(results.ranger.runSpeed>results.hero.runSpeed);
  assert.ok(results.mage.height>results.hero.height+10);
});

test('retry, preview and continuing beyond the alpine map preserve the selected character', () => {
  const g=new Core.Game();g.start(2,'mage');g.retry();assert.equal(g.character.id,'mage');
  g.preview(2);assert.equal(g.character.id,'mage');g.start(2);
  g.player.x=g.level.width-180;tick(g,1);assert.equal(g.status,'levelComplete');
  g.next();assert.equal(g.index,3);assert.equal(g.character.id,'mage');
  g.start(Core.levels.length-1,'ranger');g.player.x=g.level.width-180;tick(g,1);
  assert.equal(g.status,'won');g.next();assert.equal(g.index,Core.levels.length-1);
});

test('unknown characters and malformed level choices fall back to valid playable content', () => {
  const g=new Core.Game();g.start(999,'missing');assert.equal(g.index,Core.levels.length-1);
  assert.equal(g.character.id,'hero');
  g.setCharacter('mage');assert.equal(g.character.id,'mage');
  g.setCharacter('__proto__');assert.equal(g.character.id,'hero');
  for(const value of [-10,NaN,Infinity,'not-a-map']){g.start(value);assert.equal(g.index,0);}
});

test('all eighteen character and map combinations can finish at ordinary speed', () => {
  assert.equal(Core.characters?.length,3);assert.equal(Core.levels.length,6);
  for(const character of Core.characters)for(let stage=0;stage<Core.levels.length;stage++){
    const g=new Core.Game();g.start(stage,character.id);
    for(let frame=0;frame<14000&&g.status==='playing';frame++){
      const p=g.player,a=p.x+p.w;
      const ground=g.platforms.find(s=>s.kind==='ground'&&a>=s.x-5&&a<=s.x+s.w);
      const gap=ground&&ground.x+ground.w-a<32&&ground.x+ground.w<g.level.width;
      const enemy=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-a<90&&Math.abs(e.y+e.h-(p.y+p.h))<45);
      g.step(1/120,{axis:1,jumpPressed:p.grounded&&(gap||enemy),jumpHeld:true});
    }
    assert.ok(['won','levelComplete'].includes(g.status),`${character.id} in ${g.level.id}: ${g.status} x=${g.player.x}`);
    assert.ok(g.collected>5);
  }
});
