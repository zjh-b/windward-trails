(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrailItems=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rewards={
    coins:{name:'金叶奖励',color:'#f3d482',duration:0},
    heal:{name:'治疗花',color:'#f2aab3',duration:0},
    shield:{name:'护盾果',color:'#b8db9b',duration:8},
    magnet:{name:'磁力萤石',color:'#8cddd2',duration:10}
  };
  // Ground-supported optional detours, clear of ledges, traps, springs and checkpoints.
  const positions=[[210,1050,1870],[200,940,1760],[180,1410,1850],[180,1580,2780],[200,1030,2400],[180,1230,2870]];
  function setup(g){
    g.effects={shield:0,magnet:0};g.bonusCoins=0;
    g.blocks=positions[g.index].map((x,i)=>({id:'reward'+i,x,y:370,w:44,h:44,kind:'reward',used:false,reward:null,bumpLeft:0}));
    g.platforms.push(...g.blocks);
  }
  function bump(g,block){
    if(g.status!=='playing'||block.used)return;
    const roll=Math.random(),reward=roll<.35?'coins':roll<.60?'heal':roll<.80?'shield':'magnet';
    block.used=true;block.reward=reward;block.bumpLeft=.22;
    let coins=0,healed=0;
    if(reward==='coins'||(reward==='heal'&&g.hearts>=3))coins=5;
    else if(reward==='heal'){healed=1;g.hearts++;}
    else g.effects[reward]=rewards[reward].duration;
    g.collected+=coins;g.bonusCoins+=coins;
    g.events.push({type:'reward',reward,coins,healed,x:block.x+block.w/2,y:block.y,blockId:block.id});
  }
  function absorb(g,force){
    if(force||g.effects.shield<=0||g.player.invulnerable>0)return false;
    g.effects.shield=0;g.player.invulnerable=.5;
    g.events.push({type:'shield',x:g.player.x+g.player.w/2,y:g.player.y+g.player.h/2});return true;
  }
  function tick(g,dt){
    if(g.status!=='playing'||g.respawnDelay>0)return;
    for(const key of ['shield','magnet'])g.effects[key]=Math.max(0,g.effects[key]-dt);
    for(const block of g.blocks)block.bumpLeft=Math.max(0,block.bumpLeft-dt);
    if(g.effects.magnet<=0)return;
    const x=g.player.x+g.player.w/2,y=g.player.y+g.player.h/2;
    for(const coin of g.coins){
      if(coin.taken)continue;
      const dx=x-coin.x,dy=y-coin.y,distance=Math.hypot(dx,dy);
      if(distance>150||distance===0)continue;
      const step=Math.min(distance,420*dt);coin.x+=dx/distance*step;coin.y+=dy/distance*step;
    }
  }
  return {rewards,setup,tick,bump,absorb};
});
