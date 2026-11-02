/* Original wood-and-leaf reward art; visual functions never modify gameplay. */
(function(root){
  'use strict';
  function leaf(ctx,x,y,size,color){
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-size*.5,y+size*.4);
    ctx.bezierCurveTo(x-size*.6,y-size*.4,x+size*.1,y-size*.7,x+size*.6,y-size*.4);
    ctx.bezierCurveTo(x+size*.7,y+size*.2,x,y+size*.6,x-size*.5,y+size*.4);ctx.fill();
  }
  function icon(ctx,kind,x,y,size){
    ctx.save();ctx.translate(x,y);ctx.scale(size/32,size/32);ctx.lineWidth=2;ctx.lineJoin='round';
    if(kind==='coins'){
      ctx.fillStyle='#f0c86c';ctx.strokeStyle='#8c6230';ctx.beginPath();ctx.ellipse(0,0,11,13,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#fff3bc';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();
    }else if(kind==='heal'){
      for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);ctx.fillStyle='#efb8a7';ctx.beginPath();ctx.ellipse(0,-7,5,7,0,0,Math.PI*2);ctx.fill();ctx.restore();}
      ctx.fillStyle='#ffe5a2';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();leaf(ctx,9,11,9,'#a9c58b');
    }else if(kind==='shield'){
      ctx.fillStyle='#b8d698';ctx.strokeStyle='#557647';ctx.beginPath();ctx.moveTo(0,-14);ctx.quadraticCurveTo(7,-8,12,-9);ctx.lineTo(11,2);ctx.quadraticCurveTo(9,10,0,15);ctx.quadraticCurveTo(-9,10,-11,2);ctx.lineTo(-12,-9);ctx.quadraticCurveTo(-7,-8,0,-14);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#f5efd0';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(0,8);ctx.moveTo(-5,0);ctx.lineTo(0,4);ctx.lineTo(5,0);ctx.stroke();
    }else{
      ctx.fillStyle='#9fded1';ctx.strokeStyle='#437c75';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(10,-4);ctx.lineTo(7,10);ctx.lineTo(-4,14);ctx.lineTo(-11,3);ctx.lineTo(-7,-10);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#eaffdf';ctx.beginPath();ctx.moveTo(-4,-5);ctx.lineTo(2,0);ctx.lineTo(-2,7);ctx.stroke();
      ctx.strokeStyle='#baded2';ctx.beginPath();ctx.arc(0,0,18,-.6,.6);ctx.stroke();ctx.beginPath();ctx.arc(0,0,18,Math.PI-.6,Math.PI+.6);ctx.stroke();
    }
    ctx.restore();
  }
  function block(ctx,b,camera,time,reduced){
    const lift=reduced?0:Math.sin(Math.PI*Math.min(1,(b.bumpLeft||0)/.22))*7;
    const x=b.x-camera,y=b.y-lift,w=b.w,h=b.h;
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle='#172c2545';ctx.fillRect(3,h,w,5);
    ctx.fillStyle=b.used?'#6c7058':'#956b3e';ctx.fillRect(0,0,w,h);
    ctx.fillStyle=b.used?'#8b9271':'#ddbd79';ctx.fillRect(3,3,w-6,h-6);
    ctx.fillStyle=b.used?'#747d63':'#b18c50';ctx.fillRect(5,7,w-10,h-12);
    ctx.strokeStyle=b.used?'#a4ac86':'#f0d99b';ctx.lineWidth=1;ctx.strokeRect(3.5,3.5,w-7,h-7);
    ctx.strokeStyle=b.used?'#606b54':'#8c673d';ctx.beginPath();ctx.moveTo(6,h-8);ctx.quadraticCurveTo(w*.5,h-12,w-6,h-8);ctx.stroke();
    if(b.used){leaf(ctx,w/2,h/2,15,'#bbc49c');}
    else{
      ctx.fillStyle='#fff1ba';ctx.font='bold 29px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',w/2,h/2+1);
      leaf(ctx,w-8,8,8,'#dce6a6');
      if(!reduced){ctx.globalAlpha=.25+.15*Math.sin(time*2+b.x);ctx.strokeStyle='#fff4c9';ctx.strokeRect(-2,-2,w+4,h+4);}
    }
    ctx.restore();
  }
  function aura(ctx,p,effects,camera,time,reduced){
    const x=p.x+p.w/2-camera,y=p.y+p.h-45;
    ctx.save();
    if(effects.shield>0){
      ctx.fillStyle='#d4e7a714';ctx.strokeStyle='#d4e7a7b0';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(x,y,32,53,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      leaf(ctx,x+25,y-38,12,'#e5edbd');
    }
    if(effects.magnet>0){
      const phase=reduced?0:time*.9;ctx.strokeStyle='#a0ded382';ctx.lineWidth=1.4;
      for(let i=0;i<3;i++){const a=phase+i*Math.PI*2/3;ctx.beginPath();ctx.ellipse(x,y,43,38,a,a+.2,a+1);ctx.stroke();}
    }
    ctx.restore();
  }
  root.TrailItemArt={block,icon,aura};
})(typeof globalThis!=='undefined'?globalThis:this);
