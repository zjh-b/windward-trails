const test=require('node:test');
const assert=require('node:assert/strict');
const {Game,levels,characters}=require('../core.js');
const tick=(g,n,input={})=>{for(let i=0;i<n;i++)g.step(1/120,input);};

test('every map has a distinct trap, two guards and a living boss',()=>{
  const kinds=[];
  levels.forEach((level,i)=>{const g=new Game();g.start(i);assert.ok(g.hazards?.length>=2);assert.equal(g.guards?.length,2);assert.ok(g.boss?.hp>0);kinds.push(g.hazards[0].kind);
    for(const trap of g.hazards)assert.ok(g.platforms.some(s=>s.kind==='ground'&&trap.x>=s.x&&trap.x+trap.w<=s.x+s.w));
    for(const cp of g.checkpoints)assert.ok(!g.hazards.some(h=>cp.x+38+34>h.x&&cp.x+38<h.x+h.w));
  });assert.equal(new Set(kinds).size,6);
});
test('shooting consumes one cartridge and cooldown prevents frame-rate dependent fire',()=>{
  const g=new Game();g.start();assert.equal(g.weapon?.ammo,6);tick(g,1,{fire:true});assert.equal(g.weapon.ammo,5);assert.equal(g.projectiles.filter(b=>b.owner==='player').length,1);tick(g,5,{fire:true});assert.equal(g.weapon.ammo,5);
});
test('manual and empty-magazine reload take time, pause freezes reload',()=>{
  const g=new Game();g.start();tick(g,1,{fire:true});tick(g,1,{reloadPressed:true});assert.ok(g.weapon.reloadLeft>0);const before=g.weapon.reloadLeft;g.pause();tick(g,240,{fire:true});assert.equal(g.weapon.reloadLeft,before);g.pause();tick(g,240);assert.equal(g.weapon.ammo,6);
  g.weapon.ammo=1;g.weapon.cooldown=0;tick(g,1,{fire:true});assert.equal(g.weapon.ammo,0);assert.ok(g.weapon.reloadLeft>0);tick(g,240);assert.equal(g.weapon.ammo,6);
});
test('characters have distinct magazines and stronger star projectiles',()=>{
  assert.deepEqual(characters.map(c=>{const g=new Game();g.start(0,c.id);return g.weapon?.capacity;}),[6,8,4]);
  const g=new Game();g.start(0,'mage');tick(g,1,{fire:true});assert.equal(g.projectiles[0].damage,2);
});
test('guard telegraphs before firing and player projectiles defeat it',()=>{
  const g=new Game();g.start();const e=g.guards?.[0];assert.ok(e);g.player.x=e.x-150;g.enemies=[];tick(g,1);assert.ok(e.windup>0);assert.equal(g.projectiles.filter(b=>b.owner==='enemy').length,0);tick(g,150,{fire:true});assert.equal(e.hp,0);
});
test('boss locks the goal, can be defeated with reloads and then allows finishing',()=>{
  const g=new Game();g.start();assert.ok(g.boss);g.player.x=g.level.width-180;tick(g,1);assert.equal(g.status,'playing');assert.ok(g.player.x<g.level.width-200);
  g.player.x=g.boss.x-450;g.enemies=[];g.guards=[];tick(g,1200,{fire:true});assert.equal(g.boss.hp,0);assert.ok(g.events.some(e=>e.type==='bossDefeated'));g.player.x=g.level.width-180;tick(g,1);assert.equal(g.status,'levelComplete');
});
test('swamp slows movement without instant damage; jumping exits it',()=>{
  const g=new Game();g.start(1);const trap=g.hazards?.[0];assert.ok(trap);g.player.x=trap.x+15;tick(g,25,{axis:1});assert.ok(g.player.vx<170);assert.equal(g.hearts,3);tick(g,1,{jumpPressed:true,jumpHeld:true,axis:1});assert.ok(g.player.vy<-500);
});
test('quicksand warns and sinks slowly; jump reduces sink; staying eventually hurts',()=>{
  const g=new Game();g.start(4);const trap=g.hazards?.[0];assert.ok(trap);g.player.x=trap.x+35;tick(g,120);assert.ok(g.player.sink>.2);assert.equal(g.hearts,3);const sink=g.player.sink;tick(g,30,{jumpPressed:true,jumpHeld:true});assert.ok(g.player.sink<sink);
  g.player.y=500;g.player.vy=0;g.player.grounded=true;g.player.x=trap.x+35;tick(g,600);assert.ok(g.hearts<3);
});
test('periodic traps are harmless while telegraphing and dangerous when active',()=>{
  const g=new Game();g.start(2);const trap=g.hazards?.[0];assert.ok(trap);g.player.x=trap.x+20;g.time=trap.period-trap.warning-.1;tick(g,1);assert.equal(g.hearts,3);
  g.time=trap.period+.1;tick(g,1);assert.equal(g.hearts,2);
});
test('respawn clears hostile projectiles, refills ammo and keeps defeated guardians',()=>{
  const g=new Game();g.start();assert.ok(g.guards);g.guards[0].hp=0;tick(g,1,{fire:true});g.hurt();tick(g,100);assert.equal(g.weapon.ammo,g.weapon.capacity);assert.equal(g.projectiles.length,0);assert.equal(g.guards[0].hp,0);
});
test('checkpoint snapshot restores character, collectibles, combat and journey totals safely',()=>{
  const g=new Game();g.start(1,'mage');assert.equal(typeof g.snapshot,'function');g.player.x=g.checkpoints[0].x+5;tick(g,1);g.coins[0].taken=true;g.collected=1;g.guards[0].hp=0;g.bank=40;g.hearts=2;
  const data=JSON.parse(JSON.stringify(g.snapshot()));const restored=new Game();assert.equal(restored.restore(data),true);assert.equal(restored.character.id,'mage');assert.equal(restored.bank,40);assert.equal(restored.hearts,2);assert.equal(restored.collected,1);assert.equal(restored.guards[0].hp,0);assert.equal(restored.player.x,g.checkpoint.x);assert.ok(restored.player.invulnerable>0);
});
test('invalid snapshots do not mutate game, terminal attempts cannot be resumed',()=>{
  const g=new Game();g.start();assert.equal(typeof g.restore,'function');const before=g.player.x;
  for(const bad of [null,{}, {version:99}, {version:1,index:Infinity},'oops'])assert.equal(g.restore(bad),false);
  assert.equal(g.player.x,before);g.status='gameOver';assert.equal(g.snapshot(),null);g.status='won';assert.equal(g.snapshot(),null);
});

test('checkpoint heals once and cannot repeatedly refill life by walking back',()=>{
  const g=new Game();g.start();g.hearts=1;g.player.x=g.checkpoints[0].x;tick(g,1);
  assert.equal(g.hearts,3);g.hearts=2;g.player.x-=40;tick(g,1);g.player.x+=50;tick(g,1);assert.equal(g.hearts,2);
});
test('boss enters its second phase and emits the map-specific fan after a windup',()=>{
  const g=new Game();g.start(4);g.player.x=g.boss.x-400;g.boss.hp=5;g.enemies=[];g.guards=[];
  tick(g,1);assert.equal(g.boss.phase,2);assert.ok(g.events.some(e=>e.type==='bossPhase'));
  tick(g,125);assert.ok(g.boss.windup>0);assert.equal(g.projectiles.length,0);
  tick(g,130);assert.equal(g.projectiles.filter(b=>b.owner==='enemy').length,3);
});
test('solid platforms block projectiles and pause freezes hostile shots',()=>{
  const g=new Game();g.start();g.projectiles=[{x:200,y:560,w:10,h:10,vx:0,vy:200,life:3,owner:'enemy'}];
  g.pause();tick(g,120);assert.equal(g.projectiles[0].y,560);g.pause();tick(g,10);assert.equal(g.projectiles.length,0);assert.equal(g.hearts,3);
});
test('tampered complete snapshots are rejected without changing the current game',()=>{
  const g=new Game();g.start(3,'ranger');const original=g.snapshot();
  for(const changes of [{ammo:99},{boss:-1},{hearts:0},{reloadLeft:Infinity},{coins:[]},{guards:[-1,2]},{status:'levelComplete'}]){
    assert.equal(g.restore({...original,...changes}),false);assert.deepEqual(g.snapshot(),original);
  }
  g.boss.hp=0;g.status='levelComplete';const resumed=new Game();assert.equal(resumed.restore(g.snapshot()),true);assert.equal(resumed.status,'levelComplete');resumed.next();assert.equal(resumed.index,4);assert.equal(resumed.character.id,'ranger');
});
