import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture(){
 const all=[],calls=[];
 function graphics(){
  const g={BrushType:{SOLID_COLOR:0},PenType:{SOLID_COLOR:0}};
  g.newBrush=(t,c)=>({t,c});g.newPen=(t,c,w)=>({t,c,w});
  for(const name of ['newPath','moveTo','lineTo','closePath','rectPath','ellipsePath','fillPath','strokePath']){
   g[name]=(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'Finite draw coordinates');};
  }
  return g;
 }
 class Control{
  constructor(type,text='',opts={}){Object.assign(this,{type,text:typeof text==='string'?text:'',children:[],items:[],opts,enabled:true,graphics:graphics(),events:{},preferredSize:{},minimumSize:{},maximumSize:{},layout:{layout(){},resize(){}}});all.push(this);}
  get size(){const d=this.preferredSize;return {width:d.width||d[0]||(this.type==='palette'?350:100),height:d.height||d[1]||(this.type==='palette'?650:25)};}
  get selection(){if(this.type==='tabbedpanel')return this._selection;const chosen=this.items.filter(i=>i.selected);return this.opts.multiselect?(chosen.length?chosen:null):(chosen[0]||null);}
  set selection(value){if(this.type==='tabbedpanel'){this._selection=value;return;}for(const i of this.items)i.selected=false;if(typeof value==='number'){if(this.items[value])this.items[value].selected=true;}else if(value)value.selected=true;}
  add(type,_bounds,text,opts){if(type==='item'){const item={text:_bounds,index:this.items.length,selected:false};this.items.push(item);return item;}const c=new Control(type,text,opts);c.parent=this;this.children.push(c);return c;}
  removeAll(){this.items=[];}
  addEventListener(name,fn){this.events[name]=fn;}
  notify(name){if(this[name])this[name]();}
  center(){}show(){}
 }
 class Window extends Control{constructor(type,title){super(type,title);}}
 class Panel extends Control{}
 let pins=[],failPins=false;
 const core={version:'1.0.0',getPins(){if(failPins)throw Error('No active map');return pins;},getSelectedStateIds(){return ['CA'];}};
 for(const key of ['createMap','selectStates','setStateFill','animatePins','animateRoutes','createRoute'])core[key]=(...args)=>calls.push({key,args:copy(args)});
 core.addPin=(p,label,opts)=>{calls.push({key:'addPin',args:copy([p,label,opts])});pins.push({id:'pin-'+pins.length,name:label||'Waypoint',point:copy(p)});};
 const sandbox={Panel,Window,MapCtrlCore:core,ScriptUI:{newFont(){return {}; }},$:{colorPicker(){return 0x123456;}},alert(){}};
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(new URL('../src/data.jsxinc',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../src/ui.jsxinc',import.meta.url),'utf8'),sandbox);
 const win=sandbox.MapCtrlUI(null),tabs=all.find(c=>c.type==='tabbedpanel'),preview=all.find(c=>c.type==='panel'),status=win.children.at(-1);
 const button=tip=>{const c=all.find(c=>c.type==='button'&&c.helpTip?.startsWith(tip));assert.ok(c,'Button '+tip);return c;};
 const mode=name=>{tabs.selection=tabs.children.find(c=>c.text===name);tabs.onChange();};
 const clickMap=(point,ctrlKey=false)=>{const w=preview.size.width,h=preview.size.height,s=Math.min((w-18)/975,(h-18)/610);preview.events.click({button:0,clientX:(w-975*s)/2+point[0]*s,clientY:(h-610*s)/2+point[1]*s,ctrlKey});};
 return {all,calls,win,button,mode,clickMap,status,data:sandbox.MapCtrlData,failPins(){failPins=true;}};
}
test('ScriptUI initializes, draws vector icons and gives every action a tooltip',()=>{
 const f=fixture(),buttons=f.all.filter(c=>c.type==='button');
 assert.ok(buttons.length>=20);
 for(const b of buttons){assert.equal(b.text,'');assert.ok(b.helpTip);assert.equal(typeof b.onClick,'function');assert.equal(typeof b.onDraw,'function');b.onDraw();}
 f.all.find(c=>c.type==='panel').onDraw();
 assert.equal(f.all.filter(c=>c.type==='tab').length,3);
});
test('map multi-selection drives fill actions and invalid color cannot invoke the engine',()=>{
 const f=fixture();f.button('Create a United States').onClick();
 f.clickMap(f.data.states.find(s=>s.id==='CA').center);f.clickMap(f.data.states.find(s=>s.id==='TX').center,true);
 f.button('Apply fill').onClick();assert.deepEqual(f.calls.at(-1).args[0],['CA','TX']);
 f.button('Animate selected states').onClick();assert.equal(f.calls.at(-1).args[2].animate,true);
 const color=f.all.find(c=>c.type==='edittext'&&c.helpTip?.startsWith('Six-digit'));color.text='bad';const n=f.calls.length;
 f.button('Apply fill').onClick();assert.equal(f.calls.length,n);assert.match(f.status.text,/six-digit/);
});
test('pins, fixed waypoints, linked pins and reorder reach the correct actions',()=>{
 const f=fixture();f.mode('Pins');f.clickMap([200,200]);f.button('Add a pin').onClick();
 assert.deepEqual(f.calls.at(-1).args[0],[200,200]);assert.equal(f.calls.at(-1).args[2].animate,true);
 f.mode('Routes');f.clickMap([400,250]);f.button('Append this pin').onClick();f.button('Move selected waypoint up').onClick();
 f.button('Create an animated dashed route').onClick();
 const result=f.calls.at(-1);assert.equal(result.key,'createRoute');assert.equal(result.args[0][0].pinId,'pin-0');assert.deepEqual(result.args[0][1].point,[400,250]);assert.equal(result.args[1].flow,24);
 f.button('Clear all queued').onClick();assert.equal(f.all.find(c=>c.helpTip==='Route waypoints, in travel order').items.length,0);
});
test('pin refresh clears stale pins when the active map becomes unavailable',()=>{
 const f=fixture();f.mode('Pins');f.clickMap([200,200]);f.button('Add a pin').onClick();f.failPins();f.mode('Routes');
 const menu=f.all.find(c=>c.type==='dropdownlist');assert.equal(menu.items.length,1);assert.ok(!menu.selection._pinId);assert.match(f.status.text,/No active map/);
});
