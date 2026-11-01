// Decisions from observable state only; never changes game coordinates or health.
function decision(g,run=false){
  const p=g.player,a=p.x+p.w;
  const floor=g.platforms.find(q=>q.id===p.onPlatform);
  const enemy=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-a<95&&Math.abs(e.y+e.h-(p.y+p.h))<45);
  const gap=floor&&floor.x+floor.w-a<(run?65:32)&&floor.x+floor.w<g.level.width;
  const trap=g.hazards.some(h=>h.x+h.w>p.x&&h.x-a<50&&h.x+h.w-a>0&&p.y+p.h>540);
  const guard=p.grounded&&!gap&&!trap&&g.guards.find(e=>e.hp>0&&e.x-a>110&&e.x-a<420&&Math.abs(p.y+p.h-570)<10);
  const ground=g.platforms.find(s=>s.kind==='ground'&&p.x>s.x+20&&a<s.x+s.w-100);
  const boss=ground&&p.y+p.h>550&&g.boss.hp>0&&g.boss.x-a<510&&g.boss.x>a;
  const behind=ground&&p.grounded&&p.y+p.h>550&&(g.guards.find(e=>e.hp>0&&e.x<p.x&&p.x-e.x<400)||(g.boss.hp>0&&g.boss.x<p.x));
  const incoming=g.projectiles.some(b=>b.owner==='enemy'&&Math.abs(b.x-p.x)<125&&b.y>p.y&&b.y<p.y+p.h+15&&(b.x-p.x)*b.vx<0);
  const jump=p.grounded&&(enemy||gap||trap||incoming);
  return {axis:behind?(p.facing<0?0:-1):boss?0:guard&&!jump?0:1,run,fire:true,jumpPressed:jump,jumpHeld:true};
}
function drive(g,run=false){for(let i=0;i<24000&&g.status==='playing';i++)g.step(1/120,decision(g,run));}
module.exports={drive,decision};
