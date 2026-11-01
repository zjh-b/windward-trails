(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrailCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const weapons={
    hero:{name:'风种',capacity:6,interval:.26,reloadDuration:1.25,damage:1,color:'#f9db8b'},
    ranger:{name:'叶矢',capacity:8,interval:.19,reloadDuration:1.45,damage:1,color:'#c4ed98'},
    mage:{name:'星火',capacity:4,interval:.43,reloadDuration:1.6,damage:2,color:'#a6dffa'}
  };
  const encounters=[
    {kind:'thorn',trap:'荆棘丛',boss:'荆冠守望者',guard:'草籽哨兵',color:'#94b368',traps:[[450,80],[2190,100]],guards:[1160,3740],pattern:[0]},
    {kind:'swamp',trap:'黏稠沼泽',boss:'苔沼长老',guard:'苔木守卫',color:'#8ba66e',traps:[[1080,130],[2670,140]],guards:[1810,3520],pattern:[0,-.22]},
    {kind:'ice',trap:'寒霜冰刺',boss:'霜角巨灵',guard:'冰晶哨兵',color:'#b2dfe4',traps:[[1110,95],[2780,100]],guards:[1920,3660],pattern:[-.15,0,.15]},
    {kind:'tide',trap:'潮汐喷涌',boss:'潮汐巨钳',guard:'贝壳守卫',color:'#82cfc5',traps:[[1020,100],[2560,100]],guards:[1640,3300],pattern:[0,-.3]},
    {kind:'quicksand',trap:'下陷流沙',boss:'沙丘石像',guard:'沙岩哨卫',color:'#d4a265',traps:[[1170,155],[3050,145]],guards:[2060,3860],pattern:[-.18,0,.18]},
    {kind:'crystal',trap:'晶簇脉冲',boss:'萤晶核心',guard:'晶石守卫',color:'#a7b9ed',traps:[[1020,100],[2670,110]],guards:[1720,3470],pattern:[-.28,0,.28]}
  ];
  const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function trapPhase(trap,time){
    if(['thorn','swamp','quicksand'].includes(trap.kind))return 'active';
    const phase=((time%trap.period)+trap.period)%trap.period;
    return phase<trap.duration?'active':phase>trap.period-trap.warning?'warning':'idle';
  }
  function setup(g){
    const spec=encounters[g.index];g.encounter=spec;
    g.weapon={...weapons[g.character.id],ammo:weapons[g.character.id].capacity,cooldown:0,reloadLeft:0};
    g.hazards=spec.traps.map(([x,w])=>({kind:spec.kind,name:spec.trap,x,y:554,w,h:16,period:4.4,duration:.85,warning:1.1}));
    g.guards=spec.guards.map((x,id)=>({id,x,y:522,w:36,h:48,hp:2,maxHp:2,windup:0,cooldown:0,ammo:3,reloadLeft:0,facing:-1,hitFlash:0}));
    const hp=8+g.index;
    g.boss={x:g.level.width-355,y:458,w:92,h:112,hp,maxHp:hp,windup:0,cooldown:1,active:false,phase:1,hitFlash:0};
    g.projectiles=[];g.player.sink=0;g.player.slow=1;g.player.trap='';
  }
  function reload(g){
    const w=g.weapon;if(w.reloadLeft>0||w.ammo===w.capacity)return;
    w.reloadLeft=w.reloadDuration;g.events.push({type:'reload'});
  }
  function reset(g){
    g.projectiles=[];g.weapon.ammo=g.weapon.capacity;g.weapon.reloadLeft=0;g.weapon.cooldown=0;
    g.player.sink=0;g.player.trap='';g.player.slow=1;
    for(const guard of g.guards){guard.windup=0;guard.cooldown=1;}
    g.boss.windup=0;g.boss.cooldown=1;g.boss.active=false;
  }
  function prepare(g,dt,input){
    const p=g.player,w=g.weapon;p.slow=1;p.trap='';
    if(p.grounded&&p.y+p.h>=568)for(const trap of g.hazards){
      if(p.x+p.w>trap.x&&p.x<trap.x+trap.w){
        p.trap=trap.kind;
        if(trap.kind==='swamp')p.slow=.43;
        if(trap.kind==='quicksand')p.slow=.56;
      }
    }
    p.sink=Math.max(0,Math.min(1,p.sink+(p.trap==='quicksand'?dt/3.8:-dt*2)));
    w.cooldown=Math.max(0,w.cooldown-dt);
    if(w.reloadLeft>0){w.reloadLeft=Math.max(0,w.reloadLeft-dt);if(!w.reloadLeft){w.ammo=w.capacity;g.events.push({type:'reloaded'});}}
    if(input.reloadPressed)reload(g);
    if(!input.fire||w.reloadLeft>0||w.cooldown>0)return;
    if(w.ammo<=0){reload(g);return;}
    w.ammo--;w.cooldown=w.interval;
    const direction=input.axis?Math.sign(input.axis):p.facing;
    g.projectiles.push({x:p.x+p.w/2+direction*21,y:p.y+48,w:10,h:7,vx:direction*740,vy:0,life:1.4,owner:'player',damage:w.damage,color:w.color});
    g.events.push({type:'shot',x:p.x+p.w/2,y:p.y+48});
    if(w.ammo===0)reload(g);
  }
  function shootEnemy(g,enemy,boss=false){
    const p=g.player,x=enemy.x+enemy.w/2,y=enemy.y+enemy.h*.65;
    const angle=Math.atan2(p.y+p.h*.65-y,p.x+p.w/2-x);
    const pattern=boss?g.encounter.pattern:[0];
    for(const offset of pattern){
      const speed=boss?230:200;
      g.projectiles.push({x,y,w:boss?13:10,h:boss?13:10,vx:Math.cos(angle+offset)*speed,vy:Math.sin(angle+offset)*speed,life:3.6,owner:'enemy',damage:1,color:g.encounter.color});
    }
    g.events.push({type:'enemyShot',x,y});
  }
  function updateSentry(g,e,dt,boss=false){
    if(e.hp<=0)return;
    e.hitFlash=Math.max(0,e.hitFlash-dt);
    const distance=Math.abs(e.x-g.player.x),range=boss?820:470;
    if(distance>range){e.windup=0;return;}
    if(boss&&!e.active){e.active=true;g.events.push({type:'bossAwake'});}
    e.facing=g.player.x<e.x?-1:1;
    if(boss&&e.hp<=e.maxHp/2&&e.phase===1){e.phase=2;g.events.push({type:'bossPhase'});}
    if(!boss&&e.reloadLeft>0){e.reloadLeft-=dt;if(e.reloadLeft<=0)e.ammo=3;return;}
    if(e.windup>0){
      e.windup-=dt;
      if(e.windup<=0){shootEnemy(g,e,boss);e.cooldown=boss?(e.phase===2?2.3:3.2):2.1;if(!boss&&--e.ammo===0)e.reloadLeft=2.6;}
    }else if(e.cooldown>0)e.cooldown-=dt;
    else e.windup=boss?1.05:.85;
  }
  function finish(g,dt){
    const p=g.player;
    for(const trap of g.hazards){
      if(p.x+p.w<=trap.x||p.x>=trap.x+trap.w||p.y+p.h<555)continue;
      if(trap.kind==='quicksand'&&p.sink>=1)g.hurt();
      else if(!['swamp','quicksand'].includes(trap.kind)&&trapPhase(trap,g.time)==='active')g.hurt();
    }
    if(g.respawnDelay>0||g.status!=='playing')return;
    for(const e of g.guards)updateSentry(g,e,dt);
    updateSentry(g,g.boss,dt,true);
    for(const shot of g.projectiles){
      shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
      if(shot.life<=0)continue;
      if(shot.owner==='player'){
        const target=[...g.enemies.filter(e=>e.alive),...g.guards.filter(e=>e.hp>0),...(g.boss.hp>0?[g.boss]:[])].find(e=>hit(shot,e));
        if(target){
          shot.life=0;
          if('hp' in target){target.hp=Math.max(0,target.hp-shot.damage);target.hitFlash=.14;}else{target.alive=false;target.deadTime=0;}
          const defeated=target===g.boss&&target.hp===0;
          g.events.push({type:defeated?'bossDefeated':'hit',x:shot.x,y:shot.y});
          if(defeated){g.hearts=Math.min(3,g.hearts+1);g.projectiles.forEach(b=>{if(b.owner==='enemy')b.life=0;});}
        }
      }else if(hit(shot,p)){shot.life=0;g.hurt();}
      if(g.platforms.some(s=>hit(shot,s)))shot.life=0;
    }
    g.projectiles=g.projectiles.filter(b=>b.life>0&&b.x>-30&&b.x<g.level.width+30&&b.y>-300&&b.y<850);
    for(const e of g.guards){if(e.hp>0&&hit(p,e))g.hurt();}
    if(g.boss.hp>0){
      if(hit(p,g.boss))g.hurt();
      const gate=g.level.width-190;
      if(p.x+p.w>gate){p.x=gate-p.w;p.vx=Math.min(p.vx,0);}
    }
  }
  return {weapons,encounters,trapPhase,setup,prepare,finish,reset};
});
