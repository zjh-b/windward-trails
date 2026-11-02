/* A presentation-only timeline. No core state, DOM or storage mutations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrailFinale=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const ease=v=>{v=clamp(v);return 1-(1-v)**3;};
  class Finale{
    constructor(){this.reset();}
    reset(){this.active=false;this.finished=false;this.elapsed=0;this.duration=0;this.input=null;}
    start(input){this.input={...input};this.elapsed=0;this.duration=input.reduced?1:input.final?7:4;this.active=true;this.finished=false;}
    update(dt,paused=false){if(!this.active||paused||!Number.isFinite(dt))return;this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,dt));if(this.elapsed>=this.duration){this.active=false;this.finished=true;}}
    skip(){if(!this.input)return;this.elapsed=this.duration;this.active=false;this.finished=true;}
    sample(){
      if(!this.input)return null;
      const i=this.input,t=this.elapsed,m=i.reduced?0:ease(t/1.65);
      const hop=i.reduced?0:Math.sin(Math.PI*clamp((t-.65)/.85))*32;
      return {progress:clamp(t/this.duration),pan:m,heroX:i.heroX+(i.goalX+58-i.heroX)*m,
        heroY:i.heroY+(570-i.heroY)*m,catX:i.catX+(i.goalX+3-i.catX)*m,
        catY:i.catY+(570-i.catY)*m,catHop:hop,
        frame:i.reduced||t>1.65?0:Math.floor(t*9)%12,
        lantern:ease((t-(i.reduced?0:.55))/(i.reduced?.4:.9)),
        route:i.final?ease((t-(i.reduced?0:2.35))/(i.reduced?.6:2.3)):0,
        title:ease((t-(i.reduced?.1:i.final?4.2:1.6))/.7),
        letterbox:i.reduced?0:ease(t/.7),final:i.final,reduced:i.reduced};
    }
  }
  return {Finale};
});
