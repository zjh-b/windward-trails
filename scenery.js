/* Authored Canvas scenery: bounded, deterministic and entirely offline. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrailScenery=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const profiles={
    grassland:{light:'#ffe5a4',shadow:'#31482a',motif:'meadow',deep:'#63846c',near:'#2c573e',strength:.22,slant:.68,sunX:.24},
    forest:{light:'#fff0bb',shadow:'#152e25',motif:'fern',deep:'#3f7060',near:'#123e31',strength:.23,slant:-.85,sunX:.78},
    alpine:{light:'#ffe5b5',shadow:'#3b5063',motif:'ridge',deep:'#849fae',near:'#3c555c',strength:.17,slant:.6,sunX:.2},
    lagoon:{light:'#fff2c1',shadow:'#254b56',motif:'coast',deep:'#699f9b',near:'#365e58',strength:.2,slant:.75,sunX:.28},
    desert:{light:'#ffd59b',shadow:'#714c4e',motif:'sandstone',deep:'#b17b64',near:'#714c42',strength:.25,slant:1.25,sunX:.36},
    cavern:{light:'#94f1df',shadow:'#112637',motif:'crystal',deep:'#315a6d',near:'#132e42',strength:.22,slant:-.5,sunX:.5}
  };
  const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  function landmarks(id){const seed=Object.keys(profiles).indexOf(id)+1;return Array.from({length:22},(_,i)=>({x:i*98+random(i+seed*37)*70,scale:.55+random(i+seed*71)*.8,seed:i+seed*117}));}
  const tiles=new Map(),glows=new Map();
  function cache(key,image){tiles.set(key,image);if(tiles.size>6)tiles.delete(tiles.keys().next().value);return image;}
  function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);c.fill();}
  function stroke(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  function polygon(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function glow(color){
    if(glows.has(color))return glows.get(color);
    const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
    const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color+'b0');g.addColorStop(.3,color+'50');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,128);glows.set(color,cv);return cv;
  }
  function fern(c,x,y,scale,color,seed=0){
    for(let a=0;a<5;a++){
      const angle=(-2.6+a*.48),len=(45+random(seed+a)*30)*scale;
      const end=[x+Math.cos(angle)*len,y+Math.sin(angle)*len];stroke(c,[[x,y],end],color,1.4*scale);
      for(let j=1;j<7;j++){
        const t=j/8,px=x+(end[0]-x)*t,py=y+(end[1]-y)*t,w=(1-t)*13*scale;
        for(const d of [-1,1])polygon(c,[[px,py],[px+d*w,py-5*scale],[px+d*w*.35,py-9*scale]],color);
      }
    }
  }
  function crystal(c,x,y,s,color){
    polygon(c,[[x-12*s,y],[x-10*s,y-44*s],[x,y-65*s],[x+13*s,y-37*s],[x+10*s,y]],color);
    polygon(c,[[x,y-65*s],[x+13*s,y-37*s],[x+10*s,y],[x,y-9*s]],'#97dbd944');
    stroke(c,[[x,y-60*s],[x,y-10*s]],'#c3f4ea70',1);
  }
  function tile(id,front=false){
    const key=id+(front?'-front':'-back');if(tiles.has(key))return tiles.get(key);
    const p=profiles[id],cv=document.createElement('canvas');cv.width=2304;cv.height=720;const c=cv.getContext('2d');
    if(!front){
      for(let layer=0;layer<2;layer++){
        c.globalAlpha=.11+layer*.035;c.fillStyle=p.deep;c.beginPath();c.moveTo(0,580);
        for(let x=0;x<=2304;x+=16)c.lineTo(x,450+layer*35+Math.sin(x*.003+layer*2)*32+Math.sin(x*.009)*12);
        c.lineTo(2304,720);c.lineTo(0,720);c.fill();
      }
      c.globalAlpha=1;
      for(const o of landmarks(id)){
        const {x,scale:s,seed}=o,y=525+random(seed)*30;c.globalAlpha=.28;
        if(id==='forest'){
          fern(c,x,y,s*.65,p.deep,seed);
        }else if(id==='grassland'){
          for(let j=0;j<5;j++)stroke(c,[[x+j*6,y],[x+j*6-6*s,y-25*s-random(seed+j)*15]],p.deep,2*s);
        }else if(id==='alpine'){
          polygon(c,[[x-65*s,560],[x+10*s,421-40*s],[x+78*s,560]],p.deep);
          polygon(c,[[x-10*s,455-40*s],[x+10*s,421-40*s],[x+28*s,456-40*s]],'#e7eee580');
        }else if(id==='lagoon'){
          ellipse(c,x,560,65*s,14*s,p.deep);
          if(seed%3===0){stroke(c,[[x,450],[x,500]],p.deep,2);polygon(c,[[x-3,453],[x-27*s,489],[x-3,489]],'#edf0d0');}
        }else if(id==='desert'){
          polygon(c,[[x-30*s,555],[x-27*s,460],[x-10*s,450],[x+14*s,456],[x+32*s,555]],p.deep);
          stroke(c,[[x-17*s,479],[x+10*s,484]],'#f3d5a955',3);
        }else if(seed%3===0)crystal(c,x,y,s,p.deep);
      }
    }else{
      for(const o of landmarks(id)){
        const {x,scale:s,seed}=o,y=708+random(seed)*30;c.globalAlpha=.45;
        if(id==='forest')fern(c,x,y,s,p.near,seed);
        else if(id==='cavern')crystal(c,x,y,s*.9,p.near);
        else if(id==='alpine'||id==='desert'){
          polygon(c,[[x-32*s,y],[x-19*s,y-23*s],[x+9*s,y-35*s],[x+32*s,y-9*s],[x+40*s,y]],p.near);
          stroke(c,[[x-15*s,y-21*s],[x+8*s,y-31*s],[x+26*s,y-10*s]],p.light+'40',2);
        }else{
          for(let j=0;j<8;j++){
            const dx=(j-4)*5,h=(15+random(seed+j)*31)*s;
            stroke(c,[[x+dx,y],[x+dx-5,y-h]],p.near,2.4);
            if(id==='grassland'&&j%3===0){ellipse(c,x+dx-5,y-h,3,2,'#e7d398');ellipse(c,x+dx-5,y-h-2,1.4,1.4,'#fff1c0');}
          }
          if(id==='lagoon')ellipse(c,x+22,y-4,15*s,6*s,'#bfd6b5');
        }
      }
    }
    c.globalAlpha=1;
    return cache(key,cv);
  }
  function tileLayer(c,image,view,speed,y){
    const offset=((view.camera*speed)%image.width+image.width)%image.width;
    for(let x=-offset;x<view.width;x+=image.width)c.drawImage(image,x,y);
  }
  function back(c,v){
    const p=profiles[v.id];if(!p)return;c.save();
    tileLayer(c,tile(v.id),v,.18,v.horizon-570);
    // Wide, transparent shafts are prebuilt once per theme and move only a few pixels.
    const key=v.id+'-rays';let ray=tiles.get(key);
    if(!ray){
      ray=document.createElement('canvas');ray.width=1280;ray.height=720;const r=ray.getContext('2d');
      r.filter='blur(18px)';
      for(let i=0;i<4;i++){
        const x=1280*p.sunX+(i-1.5)*72,shift=p.slant*370;
        const g=r.createLinearGradient(x,0,x+shift,680);g.addColorStop(0,p.light+'00');g.addColorStop(.3,p.light+(v.id==='forest'?'40':'20'));g.addColorStop(1,p.light+'00');
        polygon(r,[[x,0],[x+26,0],[x+shift+90,720],[x+shift-90,720]],g);
      }
      r.filter='none';
      cache(key,ray);
    }
    c.globalCompositeOperation='screen';c.globalAlpha=v.id==='cavern'?0:v.id==='forest'?.7:.3;
    c.drawImage(ray,v.reduced?0:Math.sin(v.time*.13)*9,0,v.width,v.height);
    c.globalAlpha=p.strength;
    if(v.id==='cavern'){
      for(let i=0;i<3;i++){const x=((i*490-v.camera*.24)%(v.width+250)+v.width+250)%(v.width+250);c.drawImage(glow(i%2?'#82bcea':p.light),x-180,v.horizon-360,360,300);}
    }else c.drawImage(glow(p.light),v.width*(p.sunX-.28),-v.height*.3,v.width*.65,v.height*.86);
    c.globalCompositeOperation='source-over';c.globalAlpha=1;
    const mist=c.createLinearGradient(0,v.horizon-100,0,v.horizon+10);mist.addColorStop(0,p.deep+'00');mist.addColorStop(.72,p.light+'0c');mist.addColorStop(1,p.deep+'00');c.fillStyle=mist;c.fillRect(0,v.horizon-100,v.width,110);
    if(v.id==='lagoon'){
      c.globalAlpha=.5;
      for(let i=0;i<22;i++){const y=v.horizon-30+i*3,x=v.width*.76+Math.sin(i*2.6+v.time*.5)*12-i*2;stroke(c,[[x-i*2,y],[x+18+i*3,y]],p.light+'60',1.4);}
    }
    if(v.id==='alpine'){
      c.globalAlpha=.12;const drift=v.reduced?0:Math.sin(v.time*.09)*25;
      c.drawImage(glow('#f4faf4'),-140+drift,v.horizon-100,v.width*.9,95);
      c.drawImage(glow('#e6f1ef'),v.width*.45-drift,v.horizon-150,v.width*.8,110);
    }
    c.restore();
  }
  function front(c,v){c.save();const image=tile(v.id,true);tileLayer(c,image,v,.9,v.height-720+8);c.restore();}
  function shadow(c,id,x,y,size=1,lift=0){
    const p=profiles[id];c.save();c.globalAlpha=.42*Math.max(.3,1-lift/200);
    c.drawImage(glow(p.shadow),x-30*size+p.slant*17,y-5,75*size,15*size);
    ellipse(c,x+3,y+2,14*size,2.3*size,p.shadow+'60');c.restore();
  }
  function ledgeShadow(c,id,s,camera,platforms=[]){
    if(s.kind==='ground')return;const x=s.x-camera;if(x+s.w<0)return;
    const projected=s.x+s.w*.55+profiles[id].slant*16;
    const receiver=platforms.find(p=>p.kind==='ground'&&projected>p.x&&projected<p.x+p.w);
    if(!receiver)return;
    c.save();c.globalAlpha=.1;c.fillStyle=profiles[id].shadow;
    c.beginPath();c.ellipse(projected-camera,receiver.y+7,s.w*.53,7,0,0,Math.PI*2);c.fill();c.restore();
  }
  return {profiles,landmarks,back,front,shadow,ledgeShadow};
});
