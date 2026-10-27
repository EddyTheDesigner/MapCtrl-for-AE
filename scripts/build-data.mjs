import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const codes={"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
const round=n=>Math.round(n*1000)/1000;
const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export function signedArea(ring){
 let area=0; for(let i=0,j=ring.length-1;i<ring.length;j=i++) area+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];
 return area/2;
}
// Negative TopoJSON references reverse the whole decoded arc.
export function decodePolygons(topology,geometry){
 const cache=new Map();
 function arc(index){
  const key=index<0?~index:index;
  if(!cache.has(key)){let x=0,y=0;cache.set(key,topology.arcs[key].map(p=>{
   if(!topology.transform)return p.slice(0,2).map(round);
   x+=p[0];y+=p[1];return [round(x*topology.transform.scale[0]+topology.transform.translate[0]),round(y*topology.transform.scale[1]+topology.transform.translate[1])];
  }));}
  const pts=cache.get(key).map(p=>p.slice());return index<0?pts.reverse():pts;
 }
 function ring(refs,hole){
  const points=[];
  for(const ref of refs){const part=arc(ref);if(points.length&&equal(points.at(-1),part[0]))part.shift();points.push(...part);}
  if(points.length>1&&equal(points[0],points.at(-1)))points.pop();
  const clean=points.filter((p,i)=>i===0||!equal(p,points[i-1]));
  if(clean.length<3||Math.abs(signedArea(clean))<0.000001)return null;
  if((signedArea(clean)>0)===hole)clean.reverse();
  return clean;
 }
 const polygons=geometry.type==='Polygon'?[geometry.arcs]:geometry.arcs;
 return (polygons||[]).map(p=>p.map((r,i)=>ring(r,i>0)).filter(Boolean)).filter(p=>p.length);
}
function segmentDistanceSquared(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const t=dx||dy?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))):0;
 return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
}
export function signedDistance(point,rings){
 let inside=false,minimum=Infinity;
 for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  minimum=Math.min(minimum,segmentDistanceSquared(point,a,b));
 }
 return (inside?1:-1)*Math.sqrt(minimum);
}
// Branch-and-bound maximum-clearance anchor, within 0.1 projected pixel.
export function interiorAnchor(polygon){
 const xs=polygon[0].map(p=>p[0]),ys=polygon[0].map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 function cell(x,y,h){const d=signedDistance([x,y],polygon);return {x,y,h,d,max:d+h*Math.SQRT2};}
 let best=cell((minX+maxX)/2,(minY+maxY)/2,0);
 const size=Math.min(maxX-minX,maxY-minY),queue=[];
 if(size<=0)throw Error('Degenerate state polygon');
 for(let x=minX;x<maxX;x+=size)for(let y=minY;y<maxY;y+=size)queue.push(cell(x+size/2,y+size/2,size/2));
 while(queue.length){queue.sort((a,b)=>a.max-b.max);const c=queue.pop();if(c.d>best.d)best=c;if(c.max-best.d<=0.1)continue;const h=c.h/2;queue.push(cell(c.x-h,c.y-h,h),cell(c.x+h,c.y-h,h),cell(c.x-h,c.y+h,h),cell(c.x+h,c.y+h,h));}
 const result=[round(best.x),round(best.y)];if(signedDistance(result,polygon)<=0)throw Error('Invalid interior anchor');return result;
}
export function buildMap(topology){
 const states=topology.objects.states.geometries.filter(g=>codes[String(g.id).padStart(2,'0')]).map(g=>{
  const fips=String(g.id).padStart(2,'0'),polygons=decodePolygons(topology,g);
  if(!polygons.length)throw Error('Empty geometry: '+g.properties.name);
  const largest=polygons.reduce((best,p)=>Math.abs(signedArea(p[0]))>Math.abs(signedArea(best[0]))?p:best);
  return {id:codes[fips],fips,name:g.properties.name,center:interiorAnchor(largest),rings:polygons.flat()};
 }).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 if(states.length!==51)throw Error('Expected 50 states plus DC');
 // The source's Aleutian islands extend past its nominal viewport. Fit all
 // retained geometry uniformly, preserving shapes and inset relationships.
 const points=states.flatMap(s=>s.rings.flat()),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(963/(maxX-minX),598/(maxY-minY));
 const dx=(975-(maxX-minX)*scale)/2,dy=(610-(maxY-minY)*scale)/2;
 const fit=p=>[round((p[0]-minX)*scale+dx),round((p[1]-minY)*scale+dy)];
 for(const state of states){state.rings=state.rings.map(r=>r.map(fit));state.center=fit(state.center);}
 return {width:975,height:610,states};
}
export function verifySource(){
 const bytes=fs.readFileSync(path.join(root,'data/states-albers-10m.json')),source=JSON.parse(fs.readFileSync(path.join(root,'data/source.json'),'utf8'));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==source.sha256)throw Error('Source checksum mismatch: '+hash);
 return JSON.parse(bytes);
}
function preview(map){
 const featured=new Set(['CA','CO','TX','NY']);
 const shapes=map.states.map(s=>'<path id="'+s.id+'" fill="'+(featured.has(s.id)?'#67ddbd':'#354b64')+'" d="'+s.rings.map(r=>'M'+r.map(p=>p.join(',')).join('L')+'Z').join('')+'"><title>'+s.name+'</title></path>').join('\n');
 const labels=map.states.filter(s=>!['DC','RI','DE','CT','NJ','MD','MA'].includes(s.id)).map(s=>'<text x="'+s.center[0]+'" y="'+s.center[1]+'" fill="'+(featured.has(s.id)?'#123a34':'#b7c8d9')+'">'+s.id+'</text>').join('\n');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1095 770" role="img" aria-labelledby="title desc">\n'+
 '<title id="title">MapCtrl for AE - United States map geometry</title><desc id="desc">Actual bundled map geometry: 50 states and DC, with Alaska and Hawaii insets.</desc>'+
 '<rect width="1095" height="770" rx="20" fill="#111b28"/>'+
 '<text x="60" y="54" fill="#f4f7fb" font-family="Arial,sans-serif" font-size="26" font-weight="bold">MapCtrl <tspan fill="#8a9bb0" font-size="15" font-weight="normal">/ for After Effects</tspan></text>'+
 '<text x="60" y="83" fill="#8a9bb0" font-family="Arial,sans-serif" font-size="13">50 STATES + DC / EDITABLE VECTOR GEOMETRY</text>'+
 '<g transform="translate(60 105)" stroke="#111b28" stroke-width="1" stroke-linejoin="round" fill-rule="evenodd">'+shapes+'</g>'+
 '<g transform="translate(60 105)" font-family="Arial,sans-serif" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="central">'+labels+'</g>'+
 '<text x="60" y="739" fill="#8a9bb0" font-family="Arial,sans-serif" font-size="12">Albers USA projection - Alaska and Hawaii are insets - Source: U.S. Census / us-atlas 3.0.1</text></svg>\n';
}
export function writeData(){
 const map=buildMap(verifySource());fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.mkdirSync(path.join(root,'docs'),{recursive:true});
 fs.writeFileSync(path.join(root,'src/data.jsxinc'),'/* Generated by scripts/build-data.mjs. us-atlas 3.0.1 (ISC), Census 2017. See THIRD_PARTY_NOTICES.md. */\nvar MapCtrlData = '+JSON.stringify(map)+';\n');
 fs.writeFileSync(path.join(root,'docs/map-preview.svg'),preview(map));
 console.log('Built '+map.states.length+' state/DC shapes, '+map.states.reduce((n,s)=>n+s.rings.reduce((m,r)=>m+r.length,0),0)+' vertices.');return map;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))writeData();
