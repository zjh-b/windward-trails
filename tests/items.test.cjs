const test=require('node:test');
const assert=require('node:assert/strict');
const {Game,characters,levels,overlap}=require('../core.js');
const tick=(g,n,input={jumpHeld:true})=>{for(let i=0;i<n;i++)g.step(1/120,input);};
function fresh(index=0,character='hero'){
  const g=new Game();g.start(index,character);
  assert.equal(g.blocks?.length,3,'three reward blocks must exist');
  return g;
}
function quiet(g){g.enemies.forEach(e=>e.alive=false);g.guards.forEach(e=>e.hp=0);g.hazards=[];}
function hit(g,block=g.blocks[0],roll=.1){
  const previous=Math.random;Math.random=()=>roll;
  try{
    Object.assign(g.player,{x:block.x+5,y:block.y+block.h+24+2,vy:-400,vx:0,grounded:false,coyote:0,invulnerable:0});
    g.step(1/120,{jumpHeld:true});
  }finally{Math.random=previous;}
}

test('all maps have three fixed, solid blocks with safe clearances and reachable heads for all characters',()=>{
  for(let i=0;i<levels.length;i++)for(const character of characters){
    const g=fresh(i,character.id);
    for(const b of g.blocks)assert.ok(g.hazards.every(h=>b.x+b.w<h.x-45||b.x>h.x+h.w+45));
    quiet(g);
    assert.equal(new Set(g.blocks.map(b=>b.id)).size,3);
    for(const b of g.blocks){
      assert.equal(b.kind,'reward');assert.equal(b.used,false);assert.equal(b.reward,null);
      assert.ok(g.platforms.includes(b));
      assert.ok(g.platforms.some(p=>p.kind==='ground'&&b.x>=p.x+60&&b.x+b.w<=p.x+p.w-60));
      assert.ok(g.platforms.filter(p=>p!==b&&p.kind!=='ground').every(p=>!overlap(b,p)));
      assert.ok(g.level.ledges.every(([x,y,w])=>b.x+b.w<=x||b.x>=x+w));
      assert.ok(g.checkpoints.every(c=>Math.abs(b.x+b.w/2-(c.x+38))>80));
      assert.ok(g.springs.every(s=>b.x+b.w<s.x-45||b.x>s.x+s.w+45));
      assert.ok(b.x+b.w<g.level.width-900);
      Object.assign(g.player,{x:b.x+5,y:500,vx:0,vy:0,grounded:true,coyote:.11});
      g.step(1/120,{jumpPressed:true,jumpHeld:true});tick(g,70);
      assert.equal(b.used,true,`${g.level.id}/${character.id}/${b.id}`);
    }
  }
});

test('upward visible head contact claims a block once, stops ascent and keeps used blocks solid',()=>{
  const g=fresh();quiet(g);const b=g.blocks[0];hit(g,b);
  assert.equal(b.used,true);assert.equal(g.player.y-24,b.y+b.h);assert.equal(g.player.vy,0);
  assert.equal(g.events.filter(e=>e.type==='reward').length,1);
  const earned=g.collected;hit(g,b,.9);
  assert.equal(g.collected,earned);assert.equal(b.reward,'coins');assert.equal(g.player.vy,0);
  assert.equal(g.events.filter(e=>e.type==='reward').length,1);
});

test('side contacts resolve solidly without a reward',()=>{
  const g=fresh();quiet(g);const b=g.blocks[0];
  Object.assign(g.player,{x:b.x-g.player.w-1,y:b.y+30,vx:320,vy:0,grounded:false,coyote:0});
  g.step(1/120,{axis:1,jumpHeld:true});
  assert.equal(b.used,false);assert.equal(g.player.x+g.player.w,b.x);assert.equal(g.player.vx,0);
});

test('descending on a block lands without claiming it',()=>{
  const g=fresh();quiet(g);const b=g.blocks[0];
  Object.assign(g.player,{x:b.x+4,y:b.y-g.player.h-1,vx:0,vy:300,grounded:false,coyote:0});
  g.step(1/120,{jumpHeld:true});assert.equal(b.used,false);assert.equal(g.player.onPlatform,b.id);assert.equal(g.player.y+g.player.h,b.y);
});

test('shooting a block cannot activate its reward',()=>{
  const g=fresh();quiet(g);const b=g.blocks[0];
  g.projectiles.push({owner:'player',x:b.x-8,y:b.y+15,w:10,h:7,vx:740,vy:0,life:1,damage:1});
  g.step(1/120);assert.equal(b.used,false);assert.equal(g.projectiles.length,0);
});

for(const [roll,reward] of [[0,'coins'],[.349999,'coins'],[.35,'heal'],[.599999,'heal'],[.6,'shield'],[.799999,'shield'],[.8,'magnet'],[.999999,'magnet']]){
  test(`weighted reward branch ${roll} produces ${reward}`,()=>{
    const g=fresh();quiet(g);g.hearts=2;const before=g.collected;hit(g,g.blocks[0],roll);
    assert.equal(g.blocks[0].reward,reward);
    assert.equal(g.collected-before,reward==='coins'?5:0);assert.equal(g.hearts,reward==='heal'?3:2);
    assert.equal(g.effects.shield,reward==='shield'?8:0);assert.equal(g.effects.magnet,reward==='magnet'?10:0);
    const event=g.events.find(e=>e.type==='reward');assert.equal(event.reward,reward);assert.equal(event.coins,reward==='coins'?5:0);
    assert.equal(event.healed,reward==='heal'?1:0);assert.equal(event.blockId,g.blocks[0].id);
  });
}

test('full-health healing converts to five bonus coins and refreshes never stacks effects',()=>{
  const g=fresh();quiet(g);hit(g,g.blocks[0],.4);assert.equal(g.hearts,3);assert.equal(g.bonusCoins,5);
  assert.equal(g.events.find(e=>e.type==='reward').coins,5);
  hit(g,g.blocks[1],.7);tick(g,120);assert.ok(Math.abs(g.effects.shield-7)<1e-9);
  hit(g,g.blocks[2],.7);assert.equal(g.effects.shield,8);
});

test('pause and completed levels freeze timers; countdowns and bump feedback expire',()=>{
  const g=fresh();quiet(g);hit(g,g.blocks[0],.7);hit(g,g.blocks[1],.9);
  const before={...g.effects};g.pause();tick(g,120);assert.deepEqual(g.effects,before);
  g.pause();tick(g,120);assert.ok(g.effects.magnet<10);assert.equal(g.blocks[0].bumpLeft,0);
  g.status='levelComplete';const frozen={...g.effects};tick(g,120);assert.deepEqual(g.effects,frozen);
  g.status='playing';tick(g,1300);assert.deepEqual(g.effects,{shield:0,magnet:0});
});

test('shield absorbs ordinary damage once, protects against simultaneous hits, and skips invulnerability',()=>{
  const g=fresh();hit(g,g.blocks[0],.7);g.hurt();g.hurt();
  assert.equal(g.hearts,3);assert.equal(g.deaths,0);assert.equal(g.effects.shield,0);assert.equal(g.player.invulnerable,.5);
  assert.equal(g.events.filter(e=>e.type==='shield').length,1);
  hit(g,g.blocks[1],.7);g.player.invulnerable=1;g.hurt();assert.equal(g.effects.shield,8);
  g.player.invulnerable=0;g.effects.shield=0;g.hurt();assert.equal(g.hearts,2);
});

test('shield never absorbs falling; respawn clears both effects but preserves used blocks',()=>{
  const g=fresh();hit(g,g.blocks[0],.7);hit(g,g.blocks[1],.9);g.hurt(true);
  assert.equal(g.hearts,2);tick(g,100);assert.deepEqual(g.effects,{shield:0,magnet:0});assert.equal(g.blocks[0].used,true);
});

test('saving during an accepted damage fade cannot preserve effects cleared by respawn',()=>{
  for(const force of [false,true]){
    const g=fresh();quiet(g);hit(g,g.blocks[0],.9);
    if(force)hit(g,g.blocks[1],.7);
    g.hurt(force);assert.ok(g.respawnDelay>0);
    const restored=new Game();assert.equal(restored.restore(g.snapshot()),true);
    assert.deepEqual(restored.effects,{shield:0,magnet:0});
    assert.deepEqual(g.effects,{shield:0,magnet:0});
    assert.equal(restored.hearts,2);assert.equal(restored.blocks[0].used,true);
  }
});

test('magnet pulls only untaken coins inside 150 units and collects them exactly once',()=>{
  const g=fresh();quiet(g);hit(g,g.blocks[0],.9);Object.assign(g.player,{x:110,y:500,vy:0,vx:0});
  const x=g.player.x+17,y=g.player.y+35;
  g.coins=[{x:x+149,y,taken:false},{x:x+151,y,taken:false},{x:x+80,y,taken:true}];
  const before=g.collected;g.step(1/120);assert.ok(g.coins[0].x<x+149);assert.equal(g.coins[1].x,x+151);assert.equal(g.coins[2].x,x+80);
  tick(g,120);assert.equal(g.coins[0].taken,true);assert.equal(g.collected,before+1);tick(g,120);assert.equal(g.collected,before+1);
});

test('retry and next clear blocks and effects while next banks reward coins',()=>{
  const g=fresh();hit(g,g.blocks[0],.1);hit(g,g.blocks[1],.7);g.retry();
  assert.equal(g.collected,0);assert.equal(g.bonusCoins,0);assert.deepEqual(g.effects,{shield:0,magnet:0});assert.ok(g.blocks.every(b=>!b.used));
  hit(g,g.blocks[0],.1);hit(g,g.blocks[1],.9);g.status='levelComplete';g.next();
  assert.equal(g.bank,5);assert.equal(g.collected,0);assert.ok(g.blocks.every(b=>!b.used));assert.deepEqual(g.effects,{shield:0,magnet:0});
});

test('v2 save round-trip restores block outcomes, bonus coins and remaining effects after checkpoint respawn',()=>{
  const g=fresh();quiet(g);hit(g,g.blocks[0],.1);hit(g,g.blocks[1],.7);hit(g,g.blocks[2],.9);tick(g,60);
  if(!g.coins[0].taken){g.coins[0].taken=true;g.collected++;}g.bank=17;g.checkpoints[0].active=true;g.checkpoint={x:g.checkpoints[0].x+38,y:500};
  const earned=g.collected;
  const save=JSON.parse(JSON.stringify(g.snapshot()));assert.equal(save.version,2);
  const restored=new Game();assert.equal(restored.restore(save),true);assert.equal(restored.collected,earned);assert.equal(restored.bank,17);
  assert.deepEqual(restored.effects,g.effects);assert.deepEqual(restored.blocks.map(b=>[b.used,b.reward]),g.blocks.map(b=>[b.used,b.reward]));
  assert.equal(restored.player.x,g.checkpoint.x);hit(restored,restored.blocks[0],.7);assert.equal(restored.collected,earned);
  restored.status='levelComplete';restored.next();assert.equal(restored.bank,17+earned);
});

test('sparse arrays and non-string reward names cannot bypass atomic save validation',()=>{
  const source=fresh();hit(source,source.blocks[0],.1);const save=source.snapshot();
  const mutations=[s=>delete s.blocks[0],s=>delete s.coins[0],s=>delete s.enemies[0],s=>delete s.guards[0],s=>{s.blocks[0].reward=['coins'];s.bonusCoins=0;}];
  const target=fresh(2);const before=JSON.stringify(target.snapshot());
  for(const mutate of mutations){const bad=structuredClone(save);mutate(bad);assert.equal(target.restore(bad),false);assert.equal(JSON.stringify(target.snapshot()),before);}
});

test('v1 saves remain readable with unused blocks and no effects or bonus coins',()=>{
  const g=fresh();g.coins[0].taken=true;g.collected=1;const save=g.snapshot();save.version=1;
  delete save.blocks;delete save.effects;delete save.bonusCoins;
  const restored=new Game();assert.equal(restored.restore(save),true);assert.equal(restored.collected,1);assert.ok(restored.blocks.every(b=>!b.used));assert.deepEqual(restored.effects,{shield:0,magnet:0});
});

test('malformed item saves are rejected atomically',()=>{
  const source=fresh();hit(source,source.blocks[0],.1);const save=source.snapshot();
  const mutations=[s=>delete s.blocks,s=>s.blocks.pop(),s=>s.blocks[0].used='yes',s=>s.blocks[0].reward='__proto__',s=>s.blocks[1].reward='coins',s=>s.blocks[0].reward=null,s=>s.blocks[1].id=s.blocks[0].id,s=>s.bonusCoins=100,s=>s.bonusCoins=-5,s=>s.bonusCoins=1.5,s=>s.effects.shield=8.1,s=>s.effects.magnet=NaN,s=>s.effects.magnet='10',s=>delete s.effects,s=>s.effects.shield=1];
  const target=fresh(2,'mage');const before=JSON.stringify(target.snapshot()),player=target.player;
  for(const mutate of mutations){const bad=structuredClone(save);mutate(bad);assert.equal(target.restore(bad),false);assert.equal(JSON.stringify(target.snapshot()),before);assert.equal(target.player,player);}
});
