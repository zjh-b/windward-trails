const test=require('node:test');
const assert=require('node:assert/strict');
const {Finale}=require('../finale.js');
const {profiles,landmarks}=require('../scenery.js');

const input={final:false,reduced:false,heroX:4400,heroY:570,catX:4340,catY:570,goalX:4455,camera:3320};
test('arrival animates presentation without modifying physics input',()=>{
  const source=JSON.parse(JSON.stringify(input)),f=new Finale();f.start(source);
  assert.equal(f.duration,4);f.update(1.1);const s=f.sample();
  assert(s.heroX>input.heroX);assert(s.catHop>0);assert(s.lantern>0);
  assert.deepEqual(source,input);assert.equal(f.finished,false);
  f.update(4);assert.equal(f.finished,true);assert.equal(f.active,false);
});
test('final journey route appears only after arrival and completes once',()=>{
  const f=new Finale();f.start({...input,final:true});assert.equal(f.duration,7);
  assert.equal(f.sample().route,0);f.update(4.8);assert(f.sample().route>.9);
  f.skip();assert.equal(f.finished,true);f.update(2);assert.equal(f.elapsed,7);
  f.reset();assert.equal(f.finished,false);assert.equal(f.active,false);
});
test('paused / hidden presentation does not consume time',()=>{
  const f=new Finale();f.start(input);f.update(1);f.update(9,true);
  assert.equal(f.elapsed,1);f.update(-5);assert.equal(f.elapsed,1);
});
test('reduced motion keeps actors fixed and finishes within a second',()=>{
  const f=new Finale();f.start({...input,reduced:true,final:true});
  f.update(.6);const s=f.sample();assert.equal(s.heroX,input.heroX);assert.equal(s.catHop,0);
  assert.equal(s.pan,0);assert(s.lantern>0);f.update(.5);assert(f.finished);
});
test('each map has stable bounded environmental descriptors and its own light',()=>{
  const ids=['grassland','forest','alpine','lagoon','desert','cavern'];
  assert.deepEqual(Object.keys(profiles),ids);
  for(const id of ids){
    assert.deepEqual(landmarks(id),landmarks(id));assert(landmarks(id).length<=28);
    assert(landmarks(id).every(p=>Number.isFinite(p.x)&&p.scale>0));
    assert(profiles[id].light&&profiles[id].shadow&&profiles[id].motif);
  }
  assert.equal(new Set(ids.map(id=>profiles[id].motif)).size,6);
});
