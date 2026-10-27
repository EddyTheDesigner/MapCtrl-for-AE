import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const clone=v=>JSON.parse(JSON.stringify(v));
const defs={
 'ADBE Transform Group':{'ADBE Anchor Point':[0,0],'ADBE Position':[0,0],'ADBE Scale':[100,100,100],'ADBE Rotate Z':0},
 'ADBE Vector Group':{'ADBE Vectors Group':null},
 'ADBE Vector Shape - Group':{'ADBE Vector Shape':{}},
 'ADBE Vector Graphic - Fill':{'ADBE Vector Fill Color':[1,1,1,1],'ADBE Vector Fill Rule':1},
 'ADBE Vector Graphic - Stroke':{'ADBE Vector Stroke Color':[1,1,1,1],'ADBE Vector Stroke Width':1,'ADBE Vector Stroke Line Join':1,'ADBE Vector Stroke Line Cap':1,'ADBE Vector Stroke Dashes':null},
 'ADBE Vector Shape - Ellipse':{'ADBE Vector Ellipse Size':[100,100],'ADBE Vector Ellipse Position':[0,0]},
 'ADBE Vector Filter - Trim':{'ADBE Vector Trim End':100},
 'ADBE Layer Control':{'ADBE Layer Control-0001':0},
 'ADBE Text Properties':{'ADBE Text Document':{text:'',fontSize:20}}
};
const allowed={
 'ADBE Root Vectors Group':['ADBE Vector Group'],
 'ADBE Vectors Group':['ADBE Vector Shape - Group','ADBE Vector Graphic - Fill','ADBE Vector Graphic - Stroke','ADBE Vector Shape - Ellipse','ADBE Vector Filter - Trim'],
 'ADBE Vector Stroke Dashes':['ADBE Vector Stroke Dash 1','ADBE Vector Stroke Gap 1','ADBE Vector Stroke Offset'],
 'ADBE Effect Parade':['ADBE Layer Control']
};
class Node{
 constructor(key,value,layer){Object.assign(this,{key,name:key,value,layer,children:[],generation:0,keys:[],expression:'',expressionEnabled:false,ease:[]});if(defs[key])for(const[k,v]of Object.entries(defs[key]))this.children.push(new Node(k,v,layer));}
}
function handle(n,ancestry=[]){
 const check=()=>{for(const[parent,gen]of ancestry)assert.equal(parent.generation,gen,'AE indexed group invalidated a cached property handle');};
 const child=c=>c?handle(c,[...ancestry,[n,n.generation]]):null;
 const validate=v=>{if(n.key==='ADBE Scale')assert.equal(v.length,3,'AE Scale expects three components');};
 const methods={
  property(k){check();return child(typeof k==='number'?n.children[k-1]:n.children.find(c=>c.name===k||c.key===k));},
  addProperty(k){check();assert.ok(allowed[n.key]?.includes(k),'Unsupported match name '+k+' on '+n.key);n.generation++;const p=new Node(k,defs[k]?null:0,n.layer);n.children.push(p);return child(p);},
  setValue(v){check();validate(v);assert.equal(n.keys.length,0,'setValue on animated property');n.value=clone(v);if(n.key==='ADBE Layer Control-0001')n.link=n.layer.comp.layer(v);},
  setValueAtTime(t,v){check();validate(v);assert.ok(Number.isFinite(t));const old=n.keys.find(k=>Math.abs(k.time-t)<1e-8);if(old)old.value=clone(v);else n.keys.push({time:t,value:clone(v)});n.keys.sort((a,b)=>a.time-b.time);},
  valueAtTime(t){check();if(!n.keys.length)return clone(n.value);if(t<=n.keys[0].time)return clone(n.keys[0].value);if(t>=n.keys.at(-1).time)return clone(n.keys.at(-1).value);for(let i=1;i<n.keys.length;i++)if(n.keys[i].time>=t){const a=n.keys[i-1],b=n.keys[i],f=(t-a.time)/(b.time-a.time);return Array.isArray(a.value)?a.value.map((v,j)=>v+(b.value[j]-v)*f):a.value+(b.value-a.value)*f;}},
  keyTime(k){check();return n.keys[k-1].time;},
  keyValue(k){check();return clone(n.keys[k-1].value);},
  removeKey(k){check();n.keys.splice(k-1,1);},
  nearestKeyIndex(t){check();return n.keys.reduce((best,k,i)=>Math.abs(k.time-t)<Math.abs(n.keys[best].time-t)?i:best,0)+1;},
  setInterpolationTypeAtKey(k,a,b){check();assert.ok(n.keys[k-1]);n.keys[k-1].interpolation=[a,b];},
  setTemporalEaseAtKey(k,a,b){check();const expected=n.key==='ADBE Scale'?3:1;assert.equal(a.length,expected);assert.equal(b.length,expected);n.ease.push(k);}
 };
 return new Proxy({},{
  get(_t,k){check();if(k==='_node')return n;if(methods[k])return methods[k];if(k==='numKeys')return n.keys.length;if(k==='numProperties')return n.children.length;if(k==='propertyValueType')return n.key==='ADBE Scale'?'ThreeD':n.key.indexOf('Color')>=0?'COLOR':'OneD';if(k==='value')return clone(n.value);return n[k];},
  set(_t,k,v){check();if(k==='expression')n.expressionEnabled=!!v;n[k]=v;return true;}
 });
}
class Layer{
 get containingComp(){return this.comp;}
 constructor(comp,name){Object.assign(this,{comp,name,comment:'',selected:false,locked:false,parent:null});this.nodes=['ADBE Transform Group','ADBE Root Vectors Group','ADBE Effect Parade','ADBE Text Properties'].map(k=>new Node(k,null,this));}
 get index(){return this.comp.list.indexOf(this)+1;}
 property(k){const n=this.nodes.find(n=>n.key===k);return n?handle(n):null;}
 moveToBeginning(){this.comp.list.splice(this.index-1,1);this.comp.list.unshift(this);}
 moveAfter(other){this.comp.list.splice(this.index-1,1);this.comp.list.splice(other.index,0,this);}
 get anchorPoint(){return this.property('ADBE Transform Group').property('ADBE Anchor Point').value;}
 toComp(p){const t=this.property('ADBE Transform Group'),a=t.property('ADBE Anchor Point').value,s=t.property('ADBE Scale').value,pos=t.property('ADBE Position').value;const q=p.map((v,i)=>(v-a[i])*s[i]/100+pos[i]);return this.parent?this.parent.toComp(q):q;}
 fromComp(p){const q=this.parent?this.parent.fromComp(p):p,t=this.property('ADBE Transform Group'),a=t.property('ADBE Anchor Point').value,s=t.property('ADBE Scale').value,pos=t.property('ADBE Position').value;return q.map((v,i)=>(v-pos[i])*100/s[i]+a[i]);}
}
class Comp{
 constructor(name='Test',w=1920,h=1080,duration=10,fps=30){Object.assign(this,{name,width:w,height:h,duration,frameDuration:1/fps,time:0,list:[]});const add=n=>{const l=new Layer(this,n);this.list.unshift(l);return l;};this.layers={addNull:()=>add('Null'),addShape:()=>add('Shape'),addText:s=>add(s)};}
 get numLayers(){return this.list.length;}
 get selectedLayers(){return this.list.filter(l=>l.selected);}
 layer(i){return this.list[i-1];}
 openInViewer(){this.opened=true;}
}
function fixture(noActive=false){
 const comp=new Comp('Test',1920,1080,20,30),counters={open:0,close:0};
 const app={project:{activeItem:noActive?null:comp,items:{addComp:(name,w,h,_aspect,duration,fps)=>{const c=new Comp(name,w,h,duration,fps);app.project.activeItem=c;return c;}}},beginUndoGroup(){counters.open++;},endUndoGroup(){counters.close++;}};
 const sandbox={app,CompItem:Comp,Shape:function(){},PropertyValueType:{TwoD:'TwoD',ThreeD:'ThreeD',COLOR:'COLOR',OneD:'OneD'},KeyframeInterpolationType:{BEZIER:'BEZIER',LINEAR:'LINEAR'},KeyframeEase:function(speed,influence){Object.assign(this,{speed,influence});},ParagraphJustification:{LEFT_JUSTIFY:0}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(new URL('../src/data.jsxinc',import.meta.url),'utf8'),sandbox);vm.runInContext(fs.readFileSync(new URL('../src/core.jsxinc',import.meta.url),'utf8'),sandbox);
 return{core:sandbox.MapCtrlCore,data:sandbox.MapCtrlData,comp,app,counters};
}
const groupContents=(layer,name)=>layer.property('ADBE Root Vectors Group').property(name).property('ADBE Vectors Group');
const fillProp=layer=>groupContents(layer,'State').property('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color');
const transform=(layer,name)=>layer.property('ADBE Transform Group').property(name);
const state=(comp,id)=>comp.list.find(l=>l.comment==='mapctrl:v1|state|'+id);
const trim=layer=>groupContents(layer,'Route').property('ADBE Vector Filter - Trim').property('ADBE Vector Trim End');
function evaluateRoute(route){
 const expr=groupContents(route,'Route').property('Route path').property('ADBE Vector Shape').expression;
 return clone(vm.runInNewContext(expr,{thisLayer:route,effect:name=>()=>{const n=route.property('ADBE Effect Parade').property(name).property(1)._node;if(!route.comp.list.includes(n.link))throw Error('Missing layer');return n.link;},createPath:pts=>pts}));
}
test('all state shapes, metadata, root transform and idempotent create',()=>{
 const{core,data,comp,counters}=fixture();const{root}=core.createMap({});
 assert.equal(data.states.length,51);assert.equal(comp.numLayers,52);assert.equal(root.comment,'mapctrl:v1|root');assert.equal(core.getMap(),root);
 for(const d of data.states){const l=state(comp,d.id);assert.ok(l);assert.equal(l.parent,root);assert.deepEqual(transform(l,'ADBE Position').value,clone(d.center));const g=groupContents(l,'State');assert.equal(g.numProperties,d.rings.length+2);assert.equal(g.property('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Rule').value,2);assert.equal(g.property(1).property('ADBE Vector Shape').value.closed,true);}
 assert.equal(core.createMap({}).root,root);assert.equal(comp.numLayers,52);assert.equal(counters.open,counters.close);
 for(const layer of comp.list){assert.equal(layer.inPoint,0);assert.equal(layer.outPoint,comp.duration);}
 comp.list.splice(state(comp,'NY').index-1,1);assert.throws(()=>core.createMap({}),/incomplete/);
});
test('creates a useful composition when no composition is active',()=>{
 const{core,app}=fixture(true);const result=core.createMap({});assert.equal(result.comp.width,1920);assert.equal(result.comp.height,1080);assert.equal(result.comp.duration,10);assert.equal(app.project.activeItem,result.comp);
});
test('fills, stagger, easing dimensions and key preservation',()=>{
 const{core,comp}=fixture();core.createMap({});core.setStateFill(['CA'],[0.2,0.3,0.4],{});assert.deepEqual(fillProp(state(comp,'CA')).value,[0.2,0.3,0.4,1]);
 const ca=fillProp(state(comp,'CA'));ca.setValueAtTime(0,[0,0,0,1]);ca.setValueAtTime(15,[1,1,1,1]);comp.time=2;
 core.setStateFill(['CA','NY'],[1,0.2,0.3],{animate:true,duration:2,stagger:0.5});
 assert.deepEqual(ca._node.keys.map(k=>k.time),[0,2,4,15]);assert.deepEqual(ca.keyValue(3),[1,0.2,0.3,1]);assert.equal(ca._node.ease.length,2);
 assert.deepEqual(fillProp(state(comp,'NY'))._node.keys.map(k=>k.time),[2.5,4.5]);core.selectStates(['CA','NY']);assert.deepEqual(clone(core.getSelectedStateIds()).sort(),['CA','NY']);
});
test('preflight rejects invalid changes before touching any state',()=>{
 const{core,comp,counters}=fixture();core.createMap({});const ca=fillProp(state(comp,'CA')),before=ca.value,undoCount=counters.open;
 state(comp,'NY').locked=true;assert.throws(()=>core.setStateFill(['CA','NY'],[1,0,0],{}),/Unlock/);assert.deepEqual(ca.value,before);assert.equal(counters.open,undoCount);state(comp,'NY').locked=false;
 ca.expression='value';assert.throws(()=>core.setStateFill(['CA'],[1,0,0],{}),/expression/);ca.expression='';
 comp.time=19;assert.throws(()=>core.setStateFill(['CA'],[1,0,0],{animate:true,duration:2}),/exceeds/);assert.throws(()=>core.setStateFill(['CA'],[2,0,0],{}),/Red/);assert.equal(counters.open,counters.close);
});
test('pins, labels and routes retain links through move, rename and reorder',()=>{
 const{core,comp}=fixture();const{root}=core.createMap({});const a=core.addPin([100,200],'West',{animate:true,duration:1}),b=core.addPin([600,250],'East',{});
 assert.equal(transform(a,'ADBE Scale').numKeys,2);assert.equal(comp.list.find(l=>l.comment===a.comment.replace('|pin|','|label|')).parent,a);
 const ids=clone(core.getPins());const route=core.createRoute([{pinId:ids.find(p=>p.name==='Pin - West').id},{point:[400,150]},{pinId:ids.find(p=>p.name==='Pin - East').id}],{animate:true,duration:3,flow:20});
 assert.equal(trim(route).numKeys,2);assert.deepEqual(evaluateRoute(route).map(p=>p.map(v=>Math.round(v*1e7)/1e7)),[[100,200],[400,150],[600,250]]);
 a.name='Renamed location';a.moveToBeginning();transform(a,'ADBE Position').setValue([150,210]);transform(root,'ADBE Position').setValue([300,200]);transform(root,'ADBE Scale').setValue([80,80,100]);
 const pts=evaluateRoute(route);assert.ok(Math.abs(pts[0][0]-150)<1e-7);assert.ok(Math.abs(pts[0][1]-210)<1e-7);assert.deepEqual(pts[1],[400,150]);
 const dash=groupContents(route,'Route').property('ADBE Vector Graphic - Stroke').property('ADBE Vector Stroke Dashes');assert.equal(dash.property('ADBE Vector Stroke Dash 1').value,8);assert.equal(dash.property('ADBE Vector Stroke Gap 1').value,6);assert.match(dash.property('ADBE Vector Stroke Offset').expression,/20/);
 comp.list.splice(a.index-1,1);assert.deepEqual(evaluateRoute(route)[0],[100,200]);
});
test('bad waypoints and duration never leave partial new layers',()=>{
 const{core,comp}=fixture();core.createMap({});const count=comp.numLayers;
 assert.throws(()=>core.addPin([NaN,0],'',{}),/Map X/);assert.throws(()=>core.createRoute([{point:[1,2]}],{}),/two waypoints/);
 assert.throws(()=>core.createRoute([{point:[1,2]},{pinId:'missing'}],{}),/removed/);assert.throws(()=>core.createRoute([{point:[1,2]},{point:[1,2]}],{}),/different/);
 comp.time=19;assert.throws(()=>core.addPin([1,2],'',{animate:true,duration:2}),/exceeds/);assert.equal(comp.numLayers,count);
});
test('animate selected objects; all only when timeline selection is empty',()=>{
 const{core,comp,counters}=fixture();core.createMap({});const a=core.addPin([100,100],'',{}),b=core.addPin([200,200],'',{});
 assert.equal(core.animatePins({duration:1}),1);assert.equal(transform(a,'ADBE Scale').numKeys,0);assert.equal(transform(b,'ADBE Scale').numKeys,2);
 comp.list.forEach(l=>l.selected=false);assert.equal(core.animatePins({duration:1}),2);
 const route=core.createRoute([{point:[1,2]},{point:[50,60]}],{});assert.ok(route.index>a.index&&route.index>b.index,'Routes render below pins');assert.throws(()=>core.animatePins({duration:1}),/Select a MapCtrl/);assert.equal(core.animateRoutes({duration:1}),1);assert.equal(trim(route).numKeys,2);assert.equal(counters.open,counters.close);
});
test('mock invalidates property handles after indexed addProperty',()=>{
 const n=new Node('ADBE Vectors Group',null,null),g=handle(n),stale=g.addProperty('ADBE Vector Graphic - Fill');g.addProperty('ADBE Vector Graphic - Stroke');assert.throws(()=>stale.property('ADBE Vector Fill Color'),/invalidated/);assert.ok(g.property('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color'));
});
