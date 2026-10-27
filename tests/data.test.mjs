import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildMap,decodePolygons,signedArea,signedDistance,verifySource} from '../scripts/build-data.mjs';
test('pinned source builds 50 states plus DC with inland anchors',()=>{
 const map=buildMap(verifySource());
 assert.equal(map.states.length,51);
 assert.equal(new Set(map.states.map(s=>s.id)).size,51);
 assert.equal(new Set(map.states.map(s=>s.fips)).size,51);
 for(const state of map.states){
  assert.match(state.id,/^[A-Z]{2}$/);assert.ok(state.name.length>2);assert.ok(state.rings.length>0,state.name);
  for(const ring of state.rings){
   assert.ok(ring.length>=3,state.name);assert.notDeepEqual(ring[0],ring.at(-1),'AE closes rings');
   for(const [x,y] of ring){assert.ok(Number.isFinite(x)&&Number.isFinite(y),state.name);assert.ok(x>=0&&x<=975&&y>=0&&y<=610,state.name+': '+x+','+y);}
  }
  assert.ok(signedDistance(state.center,state.rings)>0,state.name+' anchor must be inland');
 }
 for(const id of ['AK','HI','DC','CA','NY'])assert.ok(map.states.find(s=>s.id===id));
});
test('committed JSX data is deterministic and needs no JSON runtime',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(new URL('../src/data.jsxinc',import.meta.url),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.MapCtrlData)),buildMap(verifySource()));
});
test('TopoJSON decoder transforms, reverses, joins and preserves holes',()=>{
 const topology={transform:{scale:[2,3],translate:[10,20]},arcs:[[[0,0],[4,0],[0,4]],[[0,0],[0,4],[4,0]],[[1,1],[2,0],[0,2],[-2,0],[0,-2]]]};
 const [polygon]=decodePolygons(topology,{type:'Polygon',arcs:[[0,-2],[2]]});
 assert.equal(polygon.length,2);assert.equal(polygon[0].length,4);assert.ok(signedArea(polygon[0])>0);assert.ok(signedArea(polygon[1])<0);
 assert.ok(signedDistance([11,21],polygon)>0);assert.ok(signedDistance([14,26],polygon)<0,'hole remains empty');
});
