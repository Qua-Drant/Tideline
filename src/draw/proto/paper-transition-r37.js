import {HOST} from '../../host.js';
// R37 全站过场（复制自 paper-transition-r36.js；paper.js 改为 import 这个文件，r36 保留不动）。
// R37 修（二）：新页的淡入、纸的平移、指针、描线走完就撤（fill:backwards），不再挂到 700ms 结束；挂着的动画让文字和线在合成层里用灰阶抗锯齿，
//   结束一撤换回普通渲染，字和海平线的边缘会闪一下。衔接元素的真身在最后 100ms 淡入盖住变形线，变形线随即隐去，不再两层叠着。
// R37 修：以前新页 section 和风景 #scenery 各自平移。过场途中页面会排一次风景重画，指引页的桅杆和旗、今日的海平线都是量着页面内容的位置画的，
//   这时内容正平移到半路，风景就按偏了的位置画好留下来（指引页桅杆、海平线偏 34–84px，点一下重画才归位）。
//   现在改为整张纸 #sheet 一起平移：中途任何时候重画，内容与风景的相对位置都对。覆盖层移到纸外（纸平移时会成为新的层叠上下文），
//   离场的旧页、天空带在纸里面，按纸的位移逐帧反向补偿，看起来仍是原来的走法。
// R36 全站过场（复制自 paper-transition-r35.js 后加逐点路径变形；paper.js 改为 import 这个文件，r35 保留不动）。
// R36 新增：海平线、太阳这类同名衔接元素，以及“海平线↔甲板线”“海图航线↔日志航迹”两组接力，不再只按包围盒平移缩放，
//   而是把两边的笔压线轮廓按弧长各重采样 180 个点、对齐起点与方向，逐点插值（海岸线真的“弯”成海平线，海平线弯折成甲板线）。
//   每组取最长的几条线一一配对；旧页多出来的线压到新主线上最近的位置并淡出，新页多出来的线从旧主线上长出来并淡入。
//   插值时间跟着一条驱动动画（Web Animations）走，所以停帧 seek、暂停、取消、途中改目标都和其余部分一致；途中改目标时从半路上的点出发。
// 以下是 R35 的说明：
// R35 全站过场（设计说明第 9 节）。paper.js 只 import 这个文件，各页的渲染一行不改。
// 做法：在 data.ui.page 上挂一个设置器。navigate() 先改 page 再同步 render()，所以：
//   换页前一刻（设置器里）——量下旧画面：衔接元素的位置、罗盘指针的角度，并把旧风景整张抄进覆盖层；
//   换页之后（微任务里，render 已完成）——量下新画面，用 Web Animations 播放：
//   1) 纸的滑动：旧页（原地保留的 section，不复制，不会出现重复的 id）向滑动方向移出并淡出，新页和新风景从另一侧滑入；距离随层数增加，有上限。
//   2) 罗盘指针：从旧角度转到新角度（每一次切换都有）。
//   3) 衔接元素：两页都有的同名 data-morph（太阳、灯塔、海平线……）从旧位置和形状直接变到新的；
//      第 9 节表里的接力（太阳→小船、海平线→甲板、航线记号→航线、航线→日志航迹、舷窗→深海、铅锤→大脑节点）由旧元素飞到新元素处淡去，新元素在那里画出。
//   4) 描线：当天第一次到达某一层时，新风景在第 400ms 起用 300ms 画出来；再次到达只随纸滑入，不重画。
//   时长：移动 500ms（先慢、中间快、最后慢），全程 ≤700ms；新页从第一帧起就能点（旧页 pointer-events:none、inert）。
//   可打断：途中再切换，从当前画面（指针角度、衔接元素在半路的位置、纸的偏移）直接转向新目标。
//   过场=简洁：只做纸的滑动和指针转动；过场=关闭或系统要求减少动态效果：直接切换。
// 测试与逐帧检查：window.paperTransition.state() / seek(ms) / finish()，进行中 <html data-r35-run>。
const ORDER=['thought','ai','today','tasks','projects','review','library','brain'];
const ANGLE={thought:0,ai:45,today:90,tasks:108,projects:126,review:144,library:162,brain:180};
const T={move:500,drawAt:400,draw:300,fadeOld:260,fadeNew:200};
const EASE='cubic-bezier(.65,0,.35,1)',OUT='cubic-bezier(.33,0,.2,1)';
const NS='http://www.w3.org/2000/svg';
const N=180,KEEP=4,EXTRA=12;
const POINT=new Set(['horizon','sun']);
const $=s=>HOST.querySelector(s),$$=s=>[...HOST.querySelectorAll(s)];
// 接力用到的元素。content=true 的在页面内容里（随纸滑动），其余在风景里。
const PICK={
 sun:()=>$$('#scenery [data-morph="sun"]'),boat:()=>$$('#scenery [data-morph="boat"]'),
 horizon:()=>$$('#scenery [data-morph="horizon"]'),deck:()=>$$('#scenery [data-morph="deck"]'),
 taskRoutes:()=>$$('#tasks .cargo-row [data-p2="task-filter-project"]'),
 routes:()=>$$('#projects [data-morph^="route-"]'),
 logTrail:()=>$$('#review .log-trail'),
 porthole:()=>$$('#scenery [data-morph="porthole"]'),keel:()=>$$('#scenery [data-morph="keel"]'),
 weight:()=>$$('#scenery [data-morph="sounding-weight"]'),
 brainNode:()=>{const f=HOST.paper?.data?.tasks?.find(t=>t.focus||t.id==='focus-method');const n=f&&$(`#brain [data-brain-node="task:${f.id}"]`);return n?[n]:$$('#brain .brain-node[data-kind="task"]').slice(0,1);},
 mast:()=>$$('#scenery [data-morph="mast"]')};
// 每个接力目标只在哪几页出现：换页前只采集目标页真用得上的来源（R37：以前去项目页也会去采甲板线，白花几十毫秒）
const ON={sun:['thought','ai'],boat:['today'],horizon:['thought','ai','today'],deck:['tasks'],taskRoutes:['tasks'],routes:['projects'],logTrail:['review'],porthole:['review'],keel:['library'],weight:['library'],brainNode:['brain']};
const MORPH_ON={horizon:['thought','ai','today'],sun:['thought','ai'],lighthouse:['thought','ai']};
const idOf=e=>e.dataset?.id||e.dataset?.morph?.replace(/^route-/,'')||'';
// [旧, 新, 按项目一一对应]
const RELAY=[['sun','boat'],['boat','sun'],['horizon','deck',false,true],['deck','horizon',false,true],['taskRoutes','routes',true],['routes','taskRoutes',true],
 ['routes','logTrail',false,true],['logTrail','routes',false,true],['porthole','keel'],['keel','porthole'],['weight','brainNode'],['brainNode','weight']];
let run=null,drawn={},hooked=false,frozen=null;
const mode=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return 'off';return HOST.paper?.data?.settingsR27?.motion||'full';};
const rect=e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};};
const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
function overlay(){let o=$('#r35-overlay');if(!o){o=document.createElementNS(NS,'svg');o.id='r35-overlay';o.setAttribute('aria-hidden','true');$('#sheet').before(o);}return o;}
// 把一个元素原样抄进覆盖层（屏幕坐标），返回包着它的 <g>。
function ghost(el,cls=''){const g=document.createElementNS(NS,'g');g.setAttribute('class','r35-g '+cls);let c;
 if(el instanceof SVGElement&&el.tagName!=='svg'&&el.parentNode instanceof SVGElement){const m=el.parentNode.getScreenCTM();c=el.cloneNode(true);const w=document.createElementNS(NS,'g');w.setAttribute('transform',`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);w.append(c);g.append(w);}
 else{const s=el.tagName==='svg'?el:el.querySelector('svg');if(!s)return null;const r=rect(s);c=s.cloneNode(true);c.removeAttribute('id');c.removeAttribute('class');for(const[k,v]of [['x',r.x],['y',r.y],['width',r.w],['height',r.h]])c.setAttribute(k,v);g.append(c);}
 if(el.closest?.('#scenery'))g.classList.add('r35-art');
 for(const n of g.querySelectorAll('[id]'))n.removeAttribute('id');return g;}
function needle(){return $('#compass-svg [data-morph="compass-needle"]');}
function needleAngle(){const n=needle();if(!n)return null;const t=getComputedStyle(n).transform;if(t&&t!=='none'){const m=new DOMMatrix(t);return Math.atan2(m.b,m.a)*180/Math.PI;}return null;}
// — 逐点变形 —
// 一组元素里最长的几条路径，按弧长各取 N 个点，换算成屏幕坐标；颜色和透明度取计算值（夜航已换好色）。
function samples(p){
 const key=p.getAttribute('d')||'';
 if(HOST.samples.has(key))return HOST.samples.get(key);
 const raw=polyline(p),points=[];
 if(raw){
  const lengths=[0];
  for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length];lengths.push(lengths[i]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  const length=lengths.at(-1);
  if(!length)return null;
  let j=0;
  for(let i=0;i<N;i++){
   const want=length*i/N;
   while(j<raw.length-1&&lengths[j+1]<want)j++;
   const a=raw[j],b=raw[(j+1)%raw.length],u=(want-lengths[j])/((lengths[j+1]-lengths[j])||1);
   points.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);
  }
 }else{
  let length;try{length=p.getTotalLength();}catch{return null;}
  if(!length)return null;
  for(let i=0;i<N;i++){const q=p.getPointAtLength(length*i/N);points.push([q.x,q.y]);}
 }
 HOST.samples.set(key,points);
 if(HOST.samples.size>400)HOST.samples.delete(HOST.samples.keys().next().value);
 return points;
}
function collect(els){
 const out=[];
 for(const el of els)for(const p of el.tagName==='path'?[el]:el.querySelectorAll('path')){
  if(p.closest('mask,clipPath,defs'))continue;
  const w=p.getBoundingClientRect().width;
  if(w>2)out.push({p,w,el});
 }
 return out.sort((a,b)=>b.w-a.w).slice(0,KEEP+EXTRA).flatMap(({p,w,el})=>{
  const points=samples(p),m=p.getScreenCTM();
  if(!points||!m)return [];
  const pts=points.map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]);
  let op=1;
  for(let e=p;e&&e!==el.parentElement;e=e.parentElement)op*=+getComputedStyle(e).opacity;
  return [{pts,w,fill:getComputedStyle(p).fill,op}];
 });
}
const sceneShapes=new WeakMap();
function collectScene(el){
 const scene=$('#scenery').__compassScene,m=el.getScreenCTM();
 if(!scene||!m)return collect([el]);
 let shapes=sceneShapes.get(scene);
 if(!shapes){shapes=new Map();sceneShapes.set(scene,shapes);}
 const name=el.dataset.morph;
 const key=[HOST.root.dataset.theme,m.a,m.b,m.c,m.d,m.e,m.f].join('|');
 const saved=shapes.get(name);
 if(saved?.key===key)return saved.paths;
 const paths=collect([el]);
 shapes.set(name,{key,paths});
 return paths;
}
const collectRelay=(els,stable=true)=>stable&&els.length===1&&els[0].closest('#scenery')?collectScene(els[0]):collect(els);
function polyline(p){const d=p.getAttribute('d')||'';if(/[^MLZmlz\d\s.,eE+-]/.test(d)||/[mlz]/.test(d.replace(/e/gi,'')))return null;const n=d.match(/-?[\d.]+(?:e[-+]?\d+)?/gi);if(!n||n.length<6||n.length%2)return null;const out=[];for(let i=0;i<n.length;i+=2)out.push([+n[i],+n[i+1]]);return out;}
const box=a=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[x,y]of a){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return{x0,y0,w:Math.max(x1-x0,1),h:Math.max(y1-y0,1)};};
const affine=(a,b)=>([x,y])=>[b.x0+(x-a.x0)/a.w*b.w,b.y0+(y-a.y0)/a.h*b.h];
function nearest(set,[x,y]){let best=set[0],d=1e18;for(const q of set){const e=(q[0]-x)**2+(q[1]-y)**2;if(e<d){d=e;best=q;}}return best;}
// 目标点序对齐到起点：正反两个方向、每隔 4 个点试一次起点，取总距离最小的
function align(a,b){let best=b,cost=1e18;for(const r of [b,[...b].reverse()])for(let k=0;k<N;k+=4){let c=0;for(let i=0;i<N;i+=6){const q=r[(i+k)%N];c+=(q[0]-a[i][0])**2+(q[1]-a[i][1])**2;}if(c<cost){cost=c;best=r.slice(k).concat(r.slice(0,k));}}return best;}
function plan(oldP,newP){const items=[],n=Math.min(oldP.length,newP.length,KEEP),A=affine(box(oldP[0].pts),box(newP[0].pts)),B=affine(box(newP[0].pts),box(oldP[0].pts));
 for(let i=0;i<n;i++)items.push({from:oldP[i].pts,to:align(oldP[i].pts,newP[i].pts),fill:newP[i].fill,f0:oldP[i].fill,op0:oldP[i].op,op1:newP[i].op});
 for(const o of oldP.slice(n))items.push({from:o.pts,to:o.pts.map(q=>nearest(newP[0].pts,A(q))),fill:o.fill,f0:o.fill,op0:o.op,op1:0});
 for(const w of newP.slice(n))items.push({from:w.pts.map(q=>nearest(oldP[0].pts,B(q))),to:w.pts,fill:w.fill,f0:w.fill,op0:0,op1:w.op});return items;}
// cubic-bezier(.65,0,.35,1)，和移动用同一条曲线
function bez(x1,y1,x2,y2){const c=(a,b,t)=>3*a*t*(1-t)**2+3*b*t*t*(1-t)+t**3;return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1,t=x;for(let i=0;i<22;i++){t=(lo+hi)/2;if(c(x1,x2,t)<x)lo=t;else hi=t;}return c(y1,y2,t);};}
const EZ=bez(.65,0,.35,1);
// 可插值的自定义属性：变形目标淡入用。不支持 registerProperty 的浏览器退回 R36 的做法（结束时直接显示）
const REVEAL=(()=>{try{CSS.registerProperty({name:'--r37-reveal',syntax:'<number>',inherits:true,initialValue:'1'});return true;}catch{return !!window.CSS?.registerProperty;}})();
const pairings=new WeakMap();
function pairing(oldP,newP){
 let targets=pairings.get(oldP);
 if(!targets){targets=new WeakMap();pairings.set(oldP,targets);}
 if(!targets.has(newP))targets.set(newP,plan(oldP,newP));
 return targets.get(newP);
}
function pointGroup(oldP,newP,name,A){const g=document.createElementNS(NS,'g');g.setAttribute('class','r35-g r35-fly r36-morph');if(name)g.dataset.name=name;
 g._items=pairing(oldP,newP).map(it=>{const path=document.createElementNS(NS,'path');path.setAttribute('fill',it.fill);g.append(path);return{...it,path};});
 g._drive=A(g,REVEAL?[{opacity:1},{opacity:1,offset:.98},{opacity:0}]:[{opacity:1},{opacity:1}],{duration:REVEAL?T.move+10:T.move,easing:'linear'});paint(g);return g;}
function paint(g){const t=Math.min(1,Math.max(0,(g._drive?.currentTime??0)/T.move)),e=EZ(t);if(t===g._painted)return;g._painted=t;
 for(const it of g._items){const pts=it.from.map((a,i)=>{const b=it.to[i];return[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e];});it.now=pts;
  it.path.setAttribute('d','M'+pts.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join('L')+'Z');it.path.setAttribute('opacity',(it.op0+(it.op1-it.op0)*e).toFixed(3));if(it.f0!==it.fill)it.path.setAttribute('fill',e<.5?it.f0:it.fill);}}
// 半路上的逐点变形：取它此刻的点，作为下一段的“旧样子”
const nowPaths=g=>g._items.filter(it=>+it.path.getAttribute('opacity')>.05).map(it=>({pts:it.now||it.from,w:box(it.now||it.from).w,fill:it.path.getAttribute('fill'),op:+it.path.getAttribute('opacity')})).sort((a,b)=>b.w-a.w);
// — 换页前 —
let cost={};
function before(from,to){const _t=performance.now();try{return before_(from,to);}finally{cost={before:Math.round((performance.now()-_t)*10)/10};}}
function before_(from,to){const m=mode();if(m==='off'||!HOST.paper?.ready){finish();return;}
 const prev=run?.pending?null:run;const snap={from,to,m,t0:performance.now(),morph:{},src:{},angle:prev?needleAngle()??ANGLE[from]:ANGLE[from],leaving:null};
 // 衔接元素的“旧样子”：进行中就用半路上的覆盖层副本，否则用当前画面里的。
 if(m==='full'){const inflight={};if(prev)for(const g of prev.flying)if(g.isConnected&&g.dataset.name)inflight[g.dataset.name]=g;
  for(const el of $$('#scenery [data-morph]')){const n=el.dataset.morph;if(inflight[n]||!visible(el))continue;if(MORPH_ON[n]&&!MORPH_ON[n].includes(to))continue;snap.morph[n]={rect:rect(el),paths:POINT.has(n)?(prev?collect([el]):collectScene(el)):null};}
  for(const[n,g]of Object.entries(inflight)){const r=rect(g);snap.morph[n]={rect:{x:r.x,y:r.y,w:r.width??r.w,h:r.height??r.h},paths:g._items?nowPaths(g):null};}
  if(prev)for(const g of prev.flying)if(g.isConnected&&g._items&&g.dataset.relay)(snap.srcPaths??={})[g.dataset.relay]=nowPaths(g);
  for(const[a,b,byId,pts]of RELAY){if(!ON[b]?.includes(to))continue;const need=!snap.src[a],want=pts&&!snap.srcPaths?.[a];if(!need&&!want)continue;const els=PICK[a]().filter(visible);if(!els.length)continue;
   if(need){
    const seen=new Set();
    snap.src[a]=els.flatMap(e=>{const id=idOf(e);if(byId&&seen.has(id))return [];seen.add(id);return [{id,rect:rect(e),node:ghost(e)}];});
   }if(want)(snap.srcPaths??={})[a]=collectRelay(els,!prev);}}
 // 旧风景整张抄下来（去掉 id），旧页 section 原地保留。
 const sc=$('#scenery');snap.scene=sc.cloneNode(true);snap.scene.removeAttribute('id');snap.scene.classList.add('r35-old-scene');const sr=rect(sc);snap.sceneRect=sr;
 for(const n of snap.scene.querySelectorAll('[id]'))n.removeAttribute('id');
 snap.sceneStart=prev?layerNow(sc):{y:0,o:1};
 const sec=HOST.byId(from);if(sec){snap.leaving=sec;snap.leaveStart=prev?layerNow(sec):{y:0,o:1};snap.leaveDisplay=getComputedStyle(sec).display;}
 if(from==='thought'&&$('#sky')&&!$('#sky').hidden)snap.sky=true;
 finish();run={pending:true,snapshot:snap};queueMicrotask(()=>after(snap));}
const ty=el=>{const t=getComputedStyle(el).transform;return t&&t!=='none'?new DOMMatrix(t).f:0;};
// 一层此刻的视觉位移：自己的平移加上纸的平移（纸里面的东西）
function layerNow(el){const sh=$('#sheet');return{y:ty(el)+(el!==sh&&sh.contains(el)?ty(sh):0),o:+getComputedStyle(el).opacity};}
// 纸里面的东西想走 visual(u) 这条路，而纸在第 t 毫秒的位移是 sheetY(t)：逐帧减掉纸的位移，得到它自己要走的关键帧
function compensated(dur,visual,opacity,sheetY){const kf=[];for(let k=0;k<=8;k++){const u=k/8,t=u*dur;kf.push({offset:u,transform:`translateY(${(visual(u)-sheetY(t)).toFixed(2)}px)`,opacity:opacity(u)});}return kf;}
// — 换页后 —
function after(s){const _t=performance.now();try{return after_(s);}finally{cost.after=Math.round((performance.now()-_t)*10)/10;}}
function measureTargets(s,sheet){
 const same=[],relays=[],used=new Set();
 if(s.m!=='full')return {same,relays};
 for(const el of $$('#scenery [data-morph]')){
  const n=el.dataset.morph,old=s.morph[n];
  if(!old||!visible(el))continue;
  const paths=old.paths?.length?collectScene(el):null;
  same.push({n,old,paths,shape:paths?.length?null:ghost(el,'r35-fly'),target:paths?.length?null:rect(el)});
  used.add(n);
 }
 for(const[a,b,byId,pts]of RELAY){
  const sp=pts&&s.srcPaths?.[a],src=s.src[a]||(sp?[]:null);
  if(!src||used.has(a==='weight'?'sounding-weight':a))continue;
  const tgt=PICK[b]().filter(visible);
  if(!tgt.length)continue;
  const tp=sp?.length?collectRelay(tgt):null,links=[];
  if(!tp?.length){
   const first=new Map();
   if(byId)for(const e of tgt){const id=idOf(e);if(!first.has(id))first.set(id,e);}
   for(const one of src){
    const t=byId?first.get(one.id):tgt[0];
    if(t)links.push({one,tr:rect(t)});
   }
  }
  relays.push({a,b,tgt,sp,tp,links,sheetRect:a==='porthole'?rect(sheet):null});
  used.add(b);
 }
 return {same,relays};
}
function after_(s){if(run?.snapshot!==s)return;const to=HOST.byId(s.to);if(!to||to.hidden){finish();return;}
 const dir=ORDER.indexOf(s.to)>ORDER.indexOf(s.from)?1:-1,layers=Math.abs(ORDER.indexOf(s.to)-ORDER.indexOf(s.from)),d=Math.min(84,20+14*layers);
 const anims=[],flying=[],hide=[],fade=[],o=overlay();o.replaceChildren();
 const first=s.m==='full'&&!drawn[day()+s.to];drawn[day()+s.to]=true;
 const A=(el,kf,opt)=>{if(!el)return null;const a=el.animate(kf,{duration:T.move,easing:EASE,fill:'both',...opt});anims.push(a);return a;};
 HOST.root.setAttribute('data-r35-run',s.m);
 // 1) 纸：旧页移出，新页滑入
 const sc=$('#scenery'),sheet=$('#sheet'),{same,relays}=measureTargets(s,sheet),sheetY=t=>dir*d*(1-EZ(Math.min(1,t/T.move)));
 if(s.leaving&&s.leaving!==to){const L=s.leaving;L.classList.add('r35-leaving');L.inert=true;L.style.setProperty('display',s.leaveDisplay==='none'?'block':s.leaveDisplay,'important');
  const IN=bez(.55,0,.8,.4),dl=T.fadeOld+40;A(L,compensated(dl,u=>s.leaveStart.y-dir*d*IN(u),u=>s.leaveStart.o*(1-IN(u)),sheetY),{duration:dl,easing:'linear'});}
 const oldScene=s.scene;oldScene.setAttribute('x',s.sceneRect.x);oldScene.setAttribute('y',s.sceneRect.y);oldScene.setAttribute('width',s.sceneRect.w);oldScene.setAttribute('height',s.sceneRect.h);
 const og=document.createElementNS(NS,'g');og.setAttribute('class','r35-g r35-art');og.append(oldScene);o.append(og);
 A(og,[{transform:`translateY(${s.sceneStart.y}px)`,opacity:s.sceneStart.o},{transform:`translateY(${s.sceneStart.y-dir*d}px)`,opacity:0}],{duration:T.fadeOld,easing:OUT});

 if(s.sky){const k=$('#sky');k.classList.add('r35-leaving');k.style.setProperty('display','block','important');const O=bez(.33,0,.2,1),dk=T.fadeOld+60;A(k,compensated(dk,u=>-dir*60*O(u),u=>1-O(u),sheetY),{duration:dk,easing:'linear'});}
 // 2) 罗盘指针
 const spin=()=>{const n=needle();if(!n)return;n.style.transformOrigin='32px 32px';n.style.transformBox='view-box';let a=s.angle,b=ANGLE[s.to];if(Math.abs(b-a)>180)a+=a<b?360:-360;
  const x=n.animate([{transform:`rotate(${b}deg)`},{transform:`rotate(${b}deg)`}],{duration:T.move,easing:EASE,fill:'backwards'});anims.push(x);return x;};
 spin();
 // 3) 衔接元素（只在“完整”）
 if(s.m==='full'){
  for(const {n,old,paths:np,shape,target} of same){
   let g=null;
   if(np?.length){g=pointGroup(old.paths,np,n,A);g.classList.add('r35-art');}
   else{g=shape;g.dataset.name=n;morph(g,old.rect,target,A);if(REVEAL)A(g.firstElementChild,[{opacity:1},{opacity:1,offset:.98},{opacity:0}],{duration:T.move+10,easing:'linear'});}
   o.append(g);flying.push(g);fade.push(`#scenery [data-morph="${n}"]`);
   oldScene.querySelectorAll(`[data-morph="${n}"]`).forEach(x=>x.remove());}
  const SEL={horizon:'#scenery [data-morph="horizon"]',deck:'#scenery [data-morph="deck"]',routes:'#projects [data-morph^="route-"]',logTrail:'#review .log-trail'};
  for(const {a,b,tgt,sp,tp,links,sheetRect} of relays){
   if(tp?.length){// 逐点：旧线弯成新线，目标藏到变形结束，不再另画
    if(a==='horizon'||a==='deck')oldScene.querySelectorAll(`[data-morph="${a}"]`).forEach(x=>x.remove());
    if(s.leaving)for(const e of PICK[a]())e.style.visibility='hidden',(s.restore??=[]).push(e);
    const g=pointGroup(sp,tp,null,A);g.dataset.relay=b;if(b==='horizon'||b==='deck')g.classList.add('r35-art');o.append(g);flying.push(g);fade.push(SEL[b]);continue;}
   if(a.match(/sun|boat|horizon|deck|porthole|keel|weight/))oldScene.querySelectorAll(`[data-morph="${({weight:'sounding-weight'})[a]||a}"]`).forEach(x=>x.remove());
   if(s.leaving)for(const e of PICK[a]())e.style.visibility='hidden',(s.restore??=[]).push(e);
   for(const {one,tr} of links){const g=one.node;g.classList.add('r35-fly');o.append(g);flying.push(g);
    if(a==='porthole'){const sr=sheetRect;const k=Math.max(sr.w/one.rect.w,sr.h/one.rect.h)*1.1;A(g,[{transform:'scale(1)',opacity:1},{transform:`scale(${k})`,opacity:0}],{});g.style.transformOrigin=`${one.rect.x+one.rect.w/2}px ${one.rect.y+one.rect.h/2}px`;continue;}
    // 飞到目标处（航线：落在航线起点；其余：中心），只收拢不放大，线不会被拉粗
    const px=b==='routes'?tr.x+8:tr.x+tr.w/2,cx=px-(one.rect.x+one.rect.w/2),cy=tr.y+tr.h/2-(one.rect.y+one.rect.h/2);g.style.transformOrigin=`${one.rect.x+one.rect.w/2}px ${one.rect.y+one.rect.h/2}px`;
    const sx=Math.min(1,tr.w/Math.max(one.rect.w,1)),sy=Math.min(1,Math.max(tr.h,8)/Math.max(one.rect.h,1));
    A(g,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${cx*.85}px,${cy*.85}px) scale(${1-(1-sx)*.85},${1-(1-sy)*.85})`,opacity:1,offset:.8},{transform:`translate(${cx}px,${cy}px) scale(${sx},${sy})`,opacity:0}],{});}
   // 第一次到达时目标画出来（R37：风景里的目标交给整张风景的描线；页面内容里的目标直接在真元素上划开，不再在覆盖层里另画一份，覆盖层就能在 520ms 清空）
   if(first)for(const t of tgt){if(t.closest('#scenery'))continue;const at=T.drawAt/(T.drawAt+T.draw);
    A(t,[{clipPath:'inset(-4px 100% -4px -4px)',offset:0},{clipPath:'inset(-4px 100% -4px -4px)',offset:at},{clipPath:'inset(-4px -4px -4px -4px)'}],{duration:T.drawAt+T.draw,easing:'linear',fill:'backwards'});}}
  // 4) 描线：当天第一次到达，新风景在第 400ms 起画出（大脑页的外壳从上往下）
  if(first){const hid=s.to==='brain'?'inset(0 0 100% 0)':'inset(0 100% 0 0)',at=T.drawAt/(T.drawAt+T.draw);
   A(sc,[{clipPath:hid,offset:0},{clipPath:hid,offset:at},{clipPath:'inset(0 0 0 0)'}],{duration:T.drawAt+T.draw,easing:'linear',fill:'backwards'});}
 }
 // 新页与新风景的滑入放在最后：上面量衔接元素的目标位置时，新画面还停在终点（R36 修：以前先滑后量，目标偏了一个滑动距离，结束时会跳）
 A(sheet,[{transform:`translateY(${dir*d}px)`},{transform:'translateY(0)'}],{fill:'backwards'});
 A(to,[{opacity:0,easing:'cubic-bezier(.2,.75,.35,1)'},{opacity:1}],{duration:T.fadeNew,fill:'backwards'});
 if(s.to==='thought'&&$('#sky')&&!$('#sky').hidden)A($('#sky'),[{transform:`translateY(${-dir*(60+d)}px)`,opacity:0},{transform:'translateY(0)',opacity:1}],{fill:'backwards'});
 let style=$('#r35-hide');if(!style){style=document.createElement('style');style.id='r35-hide';HOST.root.append(style);}
 // 变形的目标：最后 100ms 里真元素淡入、盖在变形线上面（覆盖层在纸下面），结束移走覆盖层时不会冒出变形没画到的细线（R37：甲板下沿以前会在结束时跳出来）
 if(fade.length&&REVEAL)for(const layer of new Set(fade.map(sel=>sel.startsWith('#scenery')?sc:to)))A(layer,[{'--r37-reveal':0,offset:0},{'--r37-reveal':0,offset:(T.move-100)/T.move},{'--r37-reveal':1}],{easing:'linear',fill:'backwards'});
 style.textContent=(hide.length?hide.join(',')+'{visibility:hidden!important}':'')+(fade.length?fade.join(',')+(REVEAL?'{opacity:var(--r37-reveal,1)!important}':'{visibility:hidden!important}'):'');
 const total=Math.max(T.move,...anims.map(a=>{const t=a.effect.getComputedTiming();return (t.delay||0)+(t.activeDuration||0);}));
 // 分阶段收场（R37）：看不见的东西立刻撤掉，不让挂着的动画把新页文字拖进合成层；时间跟着一条没有目标的计时动画走，停帧、打断都一致
 const clock=new Animation(new KeyframeEffect(null,[],{duration:total,fill:'both'}),document.timeline);clock.currentTime=0;anims.push(clock);
 const stages=[{at:T.fadeOld+60,fn:()=>{og.remove();for(const e of $$('.r35-leaving')){e.getAnimations().forEach(a=>a.cancel());e.classList.remove('r35-leaving');e.style.removeProperty('display');e.inert=false;}}},
  {at:T.move+20,fn:()=>{for(const g of flying)if(REVEAL||!(g.dataset.name||g.dataset.relay)){for(const x of [g,...g.querySelectorAll('*')])x.getAnimations().forEach(a=>a.cancel());g.remove();}
   const n=needle();if(n){n.style.transformOrigin='';n.style.transformBox='';}}}];
 const r=run={...s,anims,flying,total,dir,d,first,clock,stages,startFrame:0,stageFrame:0};
 clock.onfinish=()=>{if(run===r)finish();};
 const hold=frozen;frozen=null;
 if(hold!==null)pause(r,hold);
 else{
  for(const a of anims)a.pause();
  r.startFrame=requestAnimationFrame(()=>play(r));
 }}

function morph(g,from,to,A){const fx=to.w<4||from.w<4?1:from.w/to.w,fy=to.h<4||from.h<4?1:from.h/to.h;g.style.transformOrigin=`${to.x}px ${to.y}px`;
 A(g,[{transform:`translate(${from.x-to.x}px,${from.y-to.y}px) scale(${fx},${fy})`},{transform:'translate(0,0) scale(1,1)'}],{});}
function draw(g,r,axis,A){g.style.clipPath='inset(0 100% 0 0)';A(g,[{clipPath:'inset(-4px 100% -4px -4px)',offset:0},{clipPath:'inset(-4px 100% -4px -4px)',offset:T.drawAt/(T.drawAt+T.draw)},{clipPath:'inset(-4px -4px -4px -4px)'}],{duration:T.drawAt+T.draw,easing:'linear'});void r;void axis;}
function day(){return (HOST.paper?.data?.clock?.date||'')+'|';}
// 到点的收场阶段各执行一次
function stage(r){
 if(run!==r)return;
 const t=r.clock.currentTime??0;
 if(t<=T.move+20)for(const g of r.flying)if(g.isConnected&&g._items)paint(g);
 for(const st of r.stages)if(!st.done&&t>=st.at){st.done=true;st.fn();}
 if(r.clock.playState==='running'&&r.stages.some(st=>!st.done)&&!r.stageFrame){
  r.stageFrame=requestAnimationFrame(()=>{r.stageFrame=0;stage(r);});
 }
}
function pause(r,ms){
 cancelAnimationFrame(r.startFrame);cancelAnimationFrame(r.stageFrame);r.startFrame=r.stageFrame=0;
 for(const a of r.anims){a.pause();a.currentTime=ms;}
 stage(r);
}
function play(r){
 if(run!==r)return;
 cancelAnimationFrame(r.startFrame);r.startFrame=0;
 for(const a of r.anims)a.play();
 stage(r);
}
function finish(){const r=run;run=null;if(!r||r.pending)return;queueMicrotask(()=>{if(!run)HOST.onTransitionEnd?.();});cancelAnimationFrame(r.startFrame);cancelAnimationFrame(r.stageFrame);r.clock.onfinish=null;
 for(const a of r.anims||[])a.cancel();for(const e of r.restore||[])e.style.visibility='';
 for(const e of $$('.r35-leaving')){e.classList.remove('r35-leaving');e.style.removeProperty('display');e.inert=false;}
 const n=needle();if(n){n.style.transformOrigin='';n.style.transformBox='';}
 $('#r35-overlay')?.replaceChildren();const st=$('#r35-hide');if(st)st.textContent='';HOST.root.removeAttribute('data-r35-run');}
function hook(){const p=HOST.paper;if(hooked||!p?.ready||!p.data?.ui)return false;hooked=true;let cur=p.data.ui.page;
 Object.defineProperty(p.data.ui,'page',{configurable:true,enumerable:true,get:()=>cur,set:v=>{if(v!==cur&&ORDER.includes(v)&&ORDER.includes(cur)){const f=cur;cur=v;before(f,v);}else cur=v;}});return true;}
HOST.transition={before:(f,t)=>before(f,t),finish:()=>{frozen=null;finish();}};
HOST.transitionApi={
 state:()=>run&&!run.pending?{running:true,from:run.from,to:run.to,mode:run.m,first:!!run.first,elapsed:Math.round(run.clock.currentTime??0),total:run.total,distance:run.d,direction:run.dir}:{running:false},
 // 逐帧检查：把正在进行（或下一次）的过场停在第 ms 毫秒；resume() 恢复。
 seek(ms){if(run&&!run.pending)pause(run,ms);else frozen=ms;return this.state();},
 // 只设定下一段过场停在第 ms 毫秒，不动正在进行的这段（用来检查“途中改目标”的接续）
 holdNext(ms){frozen=ms;return this.state();},
 resume(){frozen=null;if(run&&!run.pending)play(run);},
 finish(){frozen=null;finish();},
 cost:()=>({...cost}),
 forget(){drawn={};}};
