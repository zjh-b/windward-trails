(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./combat.js'):root.TrailCombat);
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TrailCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Combat){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const characters=[
    {id:'hero',name:'阿岚',role:'均衡旅人',description:'步伐稳健，适合第一次出发。',speed:320,runSpeed:420,jumpPower:680,sprite:'hero'},
    {id:'ranger',name:'森芽',role:'林间快跑',description:'跑得更快，轻盈穿过远方的风景。',speed:350,runSpeed:455,jumpPower:680,sprite:'ranger'},
    {id:'mage',name:'星澜',role:'高跳旅伴',description:'跳得更高，更容易够到高处的金币。',speed:305,runSpeed:400,jumpPower:740,sprite:'mage'}
  ];
  const levels=[
    {id:'grassland',name:'日光草原',subtitle:'循着草浪，向远方出发',width:4600,
      ground:[[0,860],[990,1640],[1780,2510],[2660,3410],[3570,4600]],
      ledges:[[370,460,160],[615,375,120],[1190,445,170],[2020,455,150],[2260,385,145],[2850,450,170],[3780,450,180]],
      enemies:[550,1300,2110,3020,3880],springs:[3990],moving:[],checkpoints:[1410,3100]},
    {id:'forest',name:'古树秘径',subtitle:'穿过古树，跟上林间的光',width:4600,
      ground:[[0,720],[875,1530],[1690,2380],[2545,3200],[3380,4600]],
      ledges:[[350,455,160],[1120,435,170],[1920,450,160],[2800,435,150],[3610,430,170]],
      enemies:[520,1260,2080,2870,3900],springs:[],moving:[[730,475,115,105,.9],[3210,460,110,110,.8]],checkpoints:[1300,2910]},
    {id:'alpine',name:'云上山脊',subtitle:'越过云海，让旅程抵达山巅',width:4600,
      ground:[[0,760],[930,1590],[1775,2450],[2640,3310],[3505,4600]],
      ledges:[[340,440,150],[1080,440,160],[1970,450,145],[2820,435,150],[3730,425,170]],
      enemies:[490,1290,2110,2900,3980],springs:[640,2370,3230],moving:[[1620,460,110,90,.8]],checkpoints:[1300,2920]},
    {id:'lagoon',name:'潮汐群岛',subtitle:'循着潮声，走过海风里的小岛',width:4400,
      ground:[[0,650],[800,1370],[1520,2240],[2390,3010],[3170,3710],[3870,4400]],
      ledges:[[310,450,150],[980,435,150],[1720,465,170],[1990,375,130],[2570,435,160],[3330,440,170],[4020,450,160]],
      enemies:[420,1050,1900,2640,3420,4110],springs:[],moving:[[650,470,100,70,.75],[3015,475,105,80,.7]],checkpoints:[1250,2890]},
    {id:'desert',name:'落日沙海',subtitle:'踏过金色沙丘，追上落日的余温',width:4900,
      ground:[[0,820],[970,1770],[1930,2680],[2850,3610],[3780,4900]],
      ledges:[[340,455,160],[1140,465,160],[1410,385,150],[2140,440,180],[3040,455,150],[3290,375,140],[3950,450,170],[4480,430,180]],
      enemies:[550,1330,2290,3120,4130,4530],springs:[740,2600,3530],moving:[],checkpoints:[1550,3380]},
    {id:'cavern',name:'萤晶洞窟',subtitle:'跟随萤光，让晶石照亮最后一程',width:5200,
      ground:[[0,710],[870,1460],[1620,2340],[2500,3180],[3350,4050],[4210,5200]],
      ledges:[[310,450,150],[1040,440,155],[1800,460,160],[2080,365,130],[2660,435,160],[3510,455,170],[3770,365,140],[4390,440,170],[4780,420,160]],
      enemies:[460,1090,1970,2780,3680,4520,4870],springs:[2260,3970],moving:[[1470,465,110,80,.85],[3200,455,110,85,.65]],checkpoints:[2130,3890]}
  ];

  class Game {
    constructor(){ this.character=characters[0];this.bank=0;this.campaignTime=0;this.deaths=0;this.events=[];this.loadLevel(0);this.status='menu'; }
    setCharacter(id){this.character=characters.find(character=>character.id===id)||characters[0];return this.character;}
    loadLevel(index){
      this.index=clamp(Number.isFinite(Number(index))?Math.trunc(Number(index)):0,0,levels.length-1);this.level=levels[this.index];
      this.status='playing';this.hearts=3;this.collected=0;this.elapsed=0;this.time=0;this.respawnDelay=0;
      this.events=[];this.checkpoint={x:110,y:500};
      this.platforms=this.level.ground.map(([x,end],i)=>({id:'g'+i,x,y:570,w:end-x,h:300,kind:'ground'}));
      this.level.ledges.forEach(([x,y,w],i)=>{if(x+w<this.level.width-575)this.platforms.push({id:'p'+i,x,y,w,h:24,kind:'ledge'});});
      this.level.moving.forEach(([x,y,w,range,speed],i)=>this.platforms.push({id:'m'+i,x,y,w,h:25,baseX:x,range,speed,kind:'moving',dx:0}));
      this.enemies=this.level.enemies.map((x,i)=>({id:i,x,y:542,w:40,h:28,min:x-65,max:x+95,speed:48+i*5,dir:i%2?-1:1,alive:true,deadTime:0}));
      this.checkpoints=this.level.checkpoints.map(x=>({x,y:570,active:false}));
      this.springs=this.level.springs.map(x=>({x,y:559,w:46,h:11}));
      this.coins=[];
      for(const [a,b] of this.level.ground){for(let x=a+200;x<b-110;x+=100)this.coins.push({x,y:525,taken:false});}
      for(const p of this.platforms.filter(p=>p.kind==='ledge')){
        for(let x=p.x+30;x<p.x+p.w-15;x+=45)this.coins.push({x,y:p.y-36,taken:false});
      }
      for(let i=0;i<this.level.ground.length-1;i++){
        const a=this.level.ground[i][1],b=this.level.ground[i+1][0];
        for(let k=0;k<4;k++)this.coins.push({x:a+(b-a)*k/3,y:465-30*Math.sin(k*Math.PI/3),taken:false});
      }
      this.player={x:110,y:500,w:34,h:70,vx:0,vy:0,grounded:true,coyote:.11,buffer:0,cut:false,invulnerable:0,facing:1,onPlatform:'g0'};
      this.cat={x:62,y:570,facing:1};this.trail=[];this.camera=0;
      Combat.setup(this);
    }
    start(index=0,characterId=this.character.id){this.setCharacter(characterId);this.bank=0;this.campaignTime=0;this.deaths=0;this.loadLevel(index);}
    preview(index){this.loadLevel(index);this.status='menu';}
    retry(){this.loadLevel(this.index);}
    next(){
      if(this.status!=='levelComplete')return;
      this.bank+=this.collected;this.campaignTime+=this.elapsed;this.loadLevel(this.index+1);
    }
    pause(){if(this.status==='playing')this.status='paused';else if(this.status==='paused')this.status='playing';}
    respawn(){
      const p=this.player;Object.assign(p,{x:this.checkpoint.x,y:this.checkpoint.y,vx:0,vy:0,grounded:true,coyote:.11,buffer:0,cut:false,invulnerable:1.6,onPlatform:null});
      this.cat={x:p.x-48,y:p.y+p.h,facing:1};this.trail=[];this.respawnDelay=0;
      Combat.reset(this);
    }
    hurt(force=false){
      if(this.status!=='playing'||this.respawnDelay>0||(!force&&this.player.invulnerable>0))return;
      this.hearts--;this.deaths++;this.events.push({type:'hurt',x:this.player.x,y:this.player.y});
      if(this.hearts<=0)this.status='gameOver';else this.respawnDelay=.65;
    }
    jump(power=this.character.jumpPower,type='jump'){
      const p=this.player;p.vy=-power;p.grounded=false;p.coyote=0;p.buffer=0;p.onPlatform=null;p.cut=type!=='jump';
      this.events.push({type,x:p.x+p.w/2,y:p.y+p.h});
    }
    step(dt,input={}){
      if(this.status!=='playing')return;
      dt=clamp(Number.isFinite(dt)?dt:0,0,1/30);if(!dt)return;
      this.elapsed+=dt;this.time+=dt;
      const p=this.player;
      if(this.respawnDelay>0){this.respawnDelay-=dt;if(this.respawnDelay<=0)this.respawn();return;}
      p.invulnerable=Math.max(0,p.invulnerable-dt);
      Combat.prepare(this,dt,input);
      for(const s of this.platforms){
        if(s.kind==='moving'){
          const old=s.x;s.x=s.baseX+Math.sin(this.time*s.speed)*s.range;s.dx=s.x-old;
          if(p.grounded&&p.onPlatform===s.id)p.x+=s.dx;
        }
      }
      for(const e of this.enemies){
        if(!e.alive){e.deadTime+=dt;continue;}
        e.x+=e.speed*e.dir*dt;
        if(e.x<e.min){e.x=e.min;e.dir=1;}if(e.x>e.max){e.x=e.max;e.dir=-1;}
      }
      p.buffer=input.jumpPressed?.12:Math.max(0,p.buffer-dt);
      p.coyote=p.grounded?.11:Math.max(0,p.coyote-dt);
      const axis=clamp(input.axis||0,-1,1),target=axis*(input.run?this.character.runSpeed:this.character.speed)*p.slow;
      const accel=axis?2300:2000;
      p.vx+=clamp(target-p.vx,-accel*dt,accel*dt);
      if(axis)p.facing=axis>0?1:-1;
      if(p.buffer>0&&p.coyote>0)this.jump();
      if(!input.jumpHeld&&p.vy<-280&&!p.cut){p.vy*=.50;p.cut=true;}
      p.x+=p.vx*dt;p.x=clamp(p.x,0,this.level.width-p.w);
      for(const s of this.platforms){if(s.kind==='ground'&&overlap(p,s)){
        if(p.vx>0)p.x=s.x-p.w;else if(p.vx<0)p.x=s.x+s.w;p.vx=0;
      }}
      const bottom=p.y+p.h;
      p.vy=Math.min(980,p.vy+1800*dt);p.y+=p.vy*dt;p.grounded=false;p.onPlatform=null;
      if(p.vy>=0){
        let floor=null;
        for(const s of this.platforms){
          if(p.x+p.w>s.x+1&&p.x<s.x+s.w-1&&bottom<=s.y+.6&&p.y+p.h>=s.y){if(!floor||s.y<floor.y)floor=s;}
        }
        if(floor){p.y=floor.y-p.h;p.vy=0;p.grounded=true;p.onPlatform=floor.id;}
      }
      for(const spring of this.springs){if(p.grounded&&p.x+p.w>spring.x&&p.x<spring.x+spring.w&&Math.abs(p.y+p.h-570)<2)this.jump(870,'spring');}
      for(const c of this.coins){
        if(!c.taken&&p.x+p.w>c.x-12&&p.x<c.x+12&&p.y+p.h>c.y-12&&p.y<c.y+12){c.taken=true;this.collected++;this.events.push({type:'coin',x:c.x,y:c.y});}
      }
      for(const e of this.enemies){
        if(!e.alive||!overlap(p,e))continue;
        if(p.vy>0&&bottom<=e.y+9){e.alive=false;p.y=e.y-p.h;this.jump(460,'stomp');}
        else this.hurt();
      }
      for(const c of this.checkpoints){
        if(!c.active&&p.x>=c.x&&p.y<650){c.active=true;this.checkpoint={x:c.x+38,y:500};this.hearts=3;this.events.push({type:'checkpoint',x:c.x,y:500});}
      }
      if(p.y>830)this.hurt(true);
      Combat.finish(this,dt);
      this.trail.push({x:p.x-30,y:p.y+p.h,facing:p.facing});
      if(this.trail.length>24){const follow=this.trail.shift();this.cat.x+=(follow.x-this.cat.x)*.3;this.cat.y+=(follow.y-this.cat.y)*.3;this.cat.facing=follow.facing;}
      if(this.status==='playing'&&!this.respawnDelay&&this.boss.hp===0&&p.x>this.level.width-200&&p.y<620){this.status=this.index===levels.length-1?'won':'levelComplete';this.events.push({type:'complete'});}
    }
    snapshot(){
      if(!['playing','paused','levelComplete'].includes(this.status)||this.hearts<=0)return null;
      return {version:1,index:this.index,character:this.character.id,status:this.status==='levelComplete'?'levelComplete':'playing',
        hearts:this.hearts,bank:this.bank,campaignTime:this.campaignTime,elapsed:this.elapsed,deaths:this.deaths,
        checkpoint:this.checkpoints.filter(c=>c.active).length,coins:this.coins.map(c=>c.taken),enemies:this.enemies.map(e=>e.alive),
        guards:this.guards.map(e=>e.hp),boss:this.boss.hp,ammo:this.weapon.ammo,reloadLeft:this.weapon.reloadLeft};
    }
    restore(data){
      if(!data||typeof data!=='object'||data.version!==1||!Number.isInteger(data.index)||data.index<0||data.index>=levels.length||!characters.some(c=>c.id===data.character)||!['playing','levelComplete'].includes(data.status))return false;
      const g=new Game();g.start(data.index,data.character);
      const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
      const finite=(value,max)=>Number.isFinite(value)&&value>=0&&value<=max;
      if(!integer(data.hearts,1,3)||!integer(data.bank,0,10000)||!integer(data.deaths,0,100000)||!finite(data.elapsed,86400)||!finite(data.campaignTime,86400)||!integer(data.checkpoint,0,g.checkpoints.length)||!integer(data.ammo,0,g.weapon.capacity)||!finite(data.reloadLeft,g.weapon.reloadDuration))return false;
      if(!Array.isArray(data.coins)||data.coins.length!==g.coins.length||!data.coins.every(v=>typeof v==='boolean')||!Array.isArray(data.enemies)||data.enemies.length!==g.enemies.length||!data.enemies.every(v=>typeof v==='boolean')||!Array.isArray(data.guards)||data.guards.length!==g.guards.length||!data.guards.every((v,i)=>integer(v,0,g.guards[i].maxHp))||!integer(data.boss,0,g.boss.maxHp))return false;
      if(data.status==='levelComplete'&&(data.boss!==0||data.index===levels.length-1))return false;
      g.coins.forEach((c,i)=>c.taken=data.coins[i]);g.collected=data.coins.filter(Boolean).length;
      g.enemies.forEach((e,i)=>e.alive=data.enemies[i]);g.guards.forEach((e,i)=>e.hp=data.guards[i]);g.boss.hp=data.boss;
      g.checkpoints.forEach((c,i)=>c.active=i<data.checkpoint);
      if(data.checkpoint)g.checkpoint={x:g.checkpoints[data.checkpoint-1].x+38,y:500};
      g.respawn();g.weapon.ammo=data.ammo;g.weapon.reloadLeft=data.reloadLeft;
      Object.assign(g,{hearts:data.hearts,bank:data.bank,campaignTime:data.campaignTime,elapsed:data.elapsed,deaths:data.deaths,status:data.status});
      Object.assign(this,g);return true;
    }
  }
  return {Game,levels,characters,clamp,overlap};
});
