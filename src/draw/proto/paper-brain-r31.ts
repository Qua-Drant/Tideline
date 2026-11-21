import {HOST} from '../../host.ts';
import {sh} from '../scene.ts';
import type {Part,Shape} from '../scene.ts';
import {h,setNodes} from '../dom.ts';
import {iconEl} from '../ink.ts';
import type {Point} from '../ink.ts';
import {buttonEl as B} from './paper-tasks.ts';
import type {ProtoApi} from './paper-tasks.ts';
import {svgP,glyphEl,initialEl} from './p2-nodes.ts';
import type {Model} from '../../data/types.ts';
// R31 (copied from paper-brain-r25.js, which stays as it was): pill widths follow the font size set in 设置 (they were
// sized for 13px text, so at 特大 even “林老师” lost its last two characters), and a pill that still cannot hold its
// name in one line wraps to two lines (class is-two, centred on the same row) instead of ending in an ellipsis.
// R25 brain (paper-brain.js stays as it was): the graph lives inside a hand-drawn brain that grows out of the seabed
// like a coral. Kinds keep their own band: directions and ideas in the crown, projects and tasks across the middle,
// people on the two flanks, reading at the base. A chip row filters by kind, the toolbar searches, lists and zooms,
// and a side panel ranks the most connected nodes. Node hooks (data-brain-node, graph-muted, brain-list, brain-select)
// keep their names. Positions come from one layout shared by the HTML and the inked relations.
// 第 4a 期：转 TypeScript，整页改成节点构建（setNodes 整页换掉 #brain，仍是每次重画整页）；节点名、类别是文本节点或属性值。
// 按钮、小图来自 paper-tasks.ts 的 buttonEl 与 p2-nodes.ts（与 phase2 的字符串版同结构、同几何）。

/** 本页用到的 api（phase2.js 的 api） */
export interface BrainApi extends ProtoApi {
 $$: (s: string) => HTMLElement[];
 drawScenery: () => void;
 go: (kind: string, id: string) => void;
}
interface BrainUI {brainZoom?: number; brainRankShut?: boolean}
interface BrainNode {kind: string; id: string; title: string; item: {id: string; initial?: string}; key: string}
interface Placed {n: BrainNode; x: number; y: number; w: number; two?: boolean}
interface BrainLayout {w: number; h: number; cx: number; cy: number; rx: number; ry: number; right: number; nodes: Placed[]; labels: [string,string,number,number][]; z: number}
interface BrainCache {brainRendered?: string; brainNodes?: BrainNode[]; brainEdges?: [string,string][]; brainLayout?: BrainLayout; fontScale?: number}
const tgt=(e: Event)=>e.target as HTMLElement;
export function brainPage(a: BrainApi){
 const {d,$,$$}=a,ui=d.ui as Model['ui']&BrainUI,cache=d.cache as BrainCache,P=a.PAPER,M=a.SECONDARY,T=a.TICK,I=a.INK;
 const KIND={goal:'目标',idea:'想法',project:'项目',task:'任务',library:'文献',person:'人物'};
 function allNodes(): BrainNode[]{return ([['goal',d.goals],['idea',d.ideas],['project',d.projects],['task',d.tasks],['literature',d.literature],['book',d.books],['person',d.people]] as [string,{id: string; title?: string; name?: string; initial?: string}[]][]).flatMap(([kind,items])=>items.map(item=>({kind,id:item.id,title:(item.title||item.name)!,item,key:kind+':'+item.id})));}
 function allEdges(){const edges: [string,string][]=[];for(const p of d.projects){const pk='project:'+p.id;for(const[kind,ids]of [['goal',p.goalIds],['idea',p.ideaIds],['literature',p.literatureIds],['person',p.peopleIds],['task',d.tasks.filter(t=>t.projectId===p.id).map(t=>t.id)]] as [string,string[]][])for(const id of ids)edges.push([pk,kind+':'+id]);}for(const book of d.books)for(const id of book.projectIds)edges.push(['project:'+id,'book:'+book.id]);return edges;}
 function related(){const id=ui.brainSelected,set=new Set(id?[id]:[]);if(id)for(const[a,b]of allEdges())if(a===id||b===id){set.add(a);set.add(b);}return set;}
 function glyph(n: BrainNode){return n.kind==='person'?initialEl(a,n.item as {initial: string}):n.kind==='goal'?glyphEl(a,'goal'):iconEl(({idea:'star',project:'route',task:'circle',literature:'note',book:'book'} as Record<string,string>)[n.kind]);}
 const group=(n: BrainNode)=>['literature','book'].includes(n.kind)?'library':n.kind;
 function degrees(){const deg: Record<string,number>={};for(const[s,t]of allEdges()){deg[s]=(deg[s]||0)+1;deg[t]=(deg[t]||0)+1;}return deg;}
 function visibleNodes(){const nodes=allNodes(),q=(ui.brainQuery||'').trim();let v=q?['goal','idea','project','task','library','person'].flatMap(k=>nodes.filter(n=>group(n)===k&&n.title.includes(q)).slice(0,6)):nodes.filter(n=>d.graphDefault[n.kind]?.includes(n.id));if(ui.brainType)v=v.filter(n=>group(n)===ui.brainType);return v;}
 // ——— One layout: brain ellipse, then rows of pills placed along each band's chord. ———
 function layout(w: number,h: number): BrainLayout{const rank=!ui.brainRankShut,right=rank?Math.min(300,w*.25)+24:56,top=58,bottom=h-92,z=ui.brainZoom||1,cx=(w-right)/2+6,rx=Math.min((w-right)/2-58,(bottom-top)*.86)*z,ry=(bottom-top)/2*.96*z,cy=top+(bottom-top)/2+4;
 const L: BrainLayout={w,h,cx,cy,rx,ry,right,nodes:[],labels:[],z},chord=(y: number)=>rx*Math.sqrt(Math.max(0,1-y*y)),vis=visibleNodes(),fs=cache.fontScale||1,pw=(n: BrainNode)=>Math.min(Math.round((n.kind==='person'?112:184)*fs),Math.round(n.title.length*13*fs+52)),two=(n: BrainNode,wd: number)=>n.title.length*13*fs>wd-52+2;
 const rows: Record<string,number[]>={goal:[-.64],idea:[-.4],project:[-.02],task:[.24],library:[.5,.72]};
 const place=(items: BrainNode[],ys: number[],limit=.8)=>{if(!items.length)return;const per=Math.ceil(items.length/ys.length);ys.forEach((yy,r)=>{const part=items.slice(r*per,(r+1)*per);if(!part.length)return;const y=cy+yy*ry,half=chord(yy)*limit,widths=part.map(pw),gap=Math.max(10,(half*2-widths.reduce((s,x)=>s+x,0))/(part.length+1));let x=cx-half+gap;const k=Math.min(1,(half*2-10*(part.length+1))/widths.reduce((s,x)=>s+x,0));
 part.forEach((n,i)=>{const wd=Math.round(widths[i]*Math.min(1,k));L.nodes.push({n,x:x+wd/2,y,w:wd,two:two(n,wd)});x+=wd+(k<1?10:gap);});});};
 for(const k of ['goal','idea','project','task','library']){const items=vis.filter(n=>group(n)===k);place(items,items.length>5&&rows[k].length===1?[rows[k][0]-.09,rows[k][0]+.09]:rows[k],k==='project'||k==='task'?.84:.82);}
 const people=vis.filter(n=>n.kind==='person');people.forEach((n,i)=>{const side=i%2?1:-1,yy=i<2?.12:.36,x=cx+side*(chord(yy)*1.02);L.nodes.push({n,x,y:cy+yy*ry,w:pw(n)});});
 L.labels=([['方向与想法','star',cx,cy-ry*.86],['项目与任务','route',cx,cy-ry*.2],['人际','person',cx-rx*.9,cy-ry*.14],['知识','book',cx,cy+ry*.93]] as [string,string,number,number][]).filter(([t])=>!ui.brainType||({方向与想法:['goal','idea'],项目与任务:['project','task'],人际:['person'],知识:['library']} as Record<string,string[]>)[t].includes(ui.brainType));
 if(people.length>1)L.labels.push(['人际','person',cx+rx*.9,cy-ry*.14]);cache.brainLayout=L;return L;}
 function chips(){const t=ui.brainType||'';return h('div',{class:'brain-chips',role:'group','aria-label':'按类型筛选'},[['','全部'],...Object.entries(KIND)].map(([k,l])=>B('brain-band',k,l,k?'只看'+l:'显示全部类型',{class:'brain-chip hand-pill','aria-pressed':String(t===k)})));}
 function tools(){const z=Math.round((ui.brainZoom||1)*100);return h('div',{class:'brain-tools'},B('brain-search','',iconEl('search'),'搜索节点（/）',{class:'brain-tool hand-pill'}),B('brain-clear','',svgP([a.circleV(10,10,3,1.2),a.inkV([[10,2],[10,6]],1.1),a.inkV([[10,14],[10,18]],1.1),a.inkV([[2,10],[6,10]],1.1),a.inkV([[14,10],[18,10]],1.1)]),'显示所有关联',{class:'brain-clear brain-tool hand-pill'}),B('brain-list','',glyphEl(a,'lines'),'切换关系列表',{class:'brain-list-toggle brain-tool hand-pill','aria-pressed':`${ui.brainList}`}),h('div',{class:'brain-zoom hand-pill'},B('brain-zoom','-','−','缩小'),h('span',{class:'mono'},`${z}%`),B('brain-zoom','+','+','放大')));}
 function rankPanel(){const deg=degrees(),nodes=allNodes().filter(n=>deg[n.key]).sort((x,y)=>deg[y.key]-deg[x.key]||x.title.localeCompare(y.title)).slice(0,12);if(ui.brainRankShut)return B('brain-rank','',glyphEl(a,'left'),'展开高关联节点',{class:'brain-rank-open hand-pill'});
 return h('aside',{class:'brain-rank hand-panel'},h('header',null,h('h3',null,'高关联节点',h('span',{class:'mono'},`（${nodes.length}）`)),B('brain-rank','',glyphEl(a,'right'),'收起高关联节点',{class:'brain-rank-close'})),h('ol',null,nodes.map(n=>h('li',null,B('brain-rank-pick',n.key,[glyph(n),h('span',null,n.title),h('b',{class:'mono'},`${deg[n.key]}`)],n.title,{class:ui.brainSelected===n.key?'is-on':''})))));}
 function render(){const root=$('#brain')!,w=root.clientWidth,h0=root.clientHeight;cache.brainRendered=w+'x'+h0;const vis=visibleNodes();cache.brainNodes=vis;cache.brainEdges=allEdges().filter(([s,t])=>vis.some(n=>n.key===s)&&vis.some(n=>n.key===t));
 setNodes(root,()=>{const out: HTMLElement[]=[chips(),tools()];
 if(ui.brainList)out.push(h('div',{class:'brain-plain-list hand-panel'},allNodes().map(n=>B('brain-select',n.id,[glyph(n),h('span',null,n.title)],n.title,{'data-brain-node':n.key,'data-kind':n.kind,class:'graph-list-node'}))));
 else{const L=layout(w,h0),rel=related();for(const[t,ic,x,y]of L.labels)out.push(h('div',{class:'brain-cluster hand-pill',style:`left:${x}px;top:${y}px`},ic==='person'?svgP([a.circleV(7,7,3,1.1),a.inkV([[2,17],[3,12],[7,10],[11,12],[12,17]],1.1),a.circleV(14,8,2.4,1),a.inkV([[13,11],[17,12],[18,16]],1)],20):iconEl(ic),h('span',null,t)));
 for(const{n,x,y,w:wd,two}of L.nodes)out.push(B('brain-select',n.id,[glyph(n),h('span',{class:'node-name'},n.title)],n.title,{'data-brain-node':n.key,'data-kind':n.kind,class:`graph-node brain-node hand-pill ${two?'is-two':''} ${n.kind==='person'?'person-node':''} ${ui.brainSelected&&!rel.has(n.key)?'graph-muted':''}`,title:n.title,'aria-pressed':String(ui.brainSelected===n.key),style:`left:${Math.round(x-wd/2)}px;top:${Math.round(y-15)}px;width:${wd}px`}));}
 out.push(rankPanel());return out;});applySelection();}
 function applySelection(){const links=related();for(const node of $$('#brain [data-brain-node]')){const key=node.dataset.brainNode!;node.classList.toggle('graph-muted',!!ui.brainSelected&&!links.has(key));node.setAttribute('aria-pressed',String(key===ui.brainSelected));}
 for(const r of $$('#brain [data-p2="brain-rank-pick"]'))r.classList.toggle('is-on',r.dataset.id===ui.brainSelected);
 for(const edge of $$('#scenery [data-brain-edge]')){const[s,t]=edge.dataset.brainEdge!.split('|');edge.style.opacity=ui.brainSelected?(s===ui.brainSelected||t===ui.brainSelected?'.9':'.06'):'.34';}
 const halo=$('#scenery [data-brain-halo]'),L=cache.brainLayout,at=L?.nodes.find(o=>o.n.key===ui.brainSelected);if(halo){halo.style.opacity=at?'1':'0';if(at)halo.setAttribute('transform',`translate(${at.x} ${at.y})`);}}
 // ——— Scenery: brain coral, its gyri, a faint neural mesh, relation curves, seabed. ———
 // 第 3b 期：风景输出描述（draw/scene.ts），原来的字符串版只在风景里用，删去。画笔 inkV / curveV / circleV 是描述版（phase2.js 的 api）
 const inkV=a.inkV,curveV=a.curveV,circleV=a.circleV;
 let seed=7;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const FV=(p: Point[],c=P)=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z`,fill:c});
 function outline(L: BrainLayout){const{cx,cy,rx,ry}=L,pts: Point[]=[];for(let i=0;i<=96;i++){const t=i/96*Math.PI*2,c=Math.cos(t),s=Math.sin(t),bump=1+.016*Math.sin(t*13+.6)+.01*Math.sin(t*23),flat=s>0?1-.12*s*s:1+.03*(-s),front=c<0?1+.03*Math.abs(c):1;pts.push([cx+c*rx*1.06*bump*front,cy+s*ry*1.04*bump*flat]);}return pts;}
 function brainArtV(L: BrainLayout){const{cx,cy,rx,ry}=L;seed=7;const s: (Shape|null|(Shape|null)[])[]=[];const o=outline(L),inside=(x: number,y: number)=>((x-cx)/(rx*.98))**2+((y-cy)/(ry*.95))**2<1;
 // Stem and roots first, so the brain sits on top of them.
 const sy=cy+ry*.86,base=L.h-22;s.push(FV([[cx-34,sy],[cx+30,sy],[cx+46,base-14],[cx+92,base],[cx-96,base],[cx-50,base-14]],P));
 for(const k of [-1,1])s.push(curveV([[cx+k*32,sy],[cx+k*28,(sy+base)/2],[cx+k*46,base-14],[cx+k*94,base]],1.2));for(let i=-3;i<=3;i++)s.push(curveV([[cx+i*8,sy+4],[cx+i*9+Math.sin(i)*3,(sy+base)/2],[cx+i*14,base-4]],.5,T));
 s.push(FV(o),curveV(o,1.4),curveV(o.map(([x,y]): Point=>[cx+(x-cx)*.965,cy+(y-cy)*.965]),.5,T));
 // Cerebellum and the lateral fissure, then many small gyri.
 const cb: Point[]=[];for(let i=0;i<=40;i++){const t=i/40*Math.PI*2;cb.push([cx+rx*.5+Math.cos(t)*rx*.3*(1+.04*Math.sin(t*9)),cy+ry*.74+Math.sin(t)*ry*.17]);}s.push(curveV(cb.slice(0,21),1));for(let k=1;k<5;k++)s.push(curveV(Array.from({length:9},(_,i): Point=>[cx+rx*(.24+i*.065),cy+ry*(.68+k*.045)+Math.sin(i*1.4+k)*2]),.5,T));
 s.push(curveV([[cx-rx*.62,cy+ry*.18],[cx-rx*.3,cy+ry*.06],[cx,cy-ry*.02],[cx+rx*.3,cy-ry*.16],[cx+rx*.5,cy-ry*.34]],.9,M),curveV([[cx-rx*.06,cy-ry*.92],[cx-rx*.02,cy-ry*.6],[cx-rx*.1,cy-ry*.3],[cx-rx*.04,cy-ry*.08]],.8,M));
 // Folds: meandering curves that turn back on themselves, in two weights, clipped to the brain.
 for(let g=0;g<70;g++){const x0=cx+(rnd()*2-1)*rx*.9,y0=cy+(rnd()*2-1)*ry*.86;if(!inside(x0,y0))continue;let ang=rnd()*Math.PI*2,x=x0,y=y0;const p: Point[]=[[x,y]],n=6+Math.floor(rnd()*6);for(let i=0;i<n;i++){ang+=(rnd()-.5)*2.2;const step=9+rnd()*9;x+=Math.cos(ang)*step;y+=Math.sin(ang)*step;if(!inside(x,y))break;p.push([x,y]);}if(p.length>3)s.push(curveV(p,g%4?.55:.8,g%4?T:M,{opacity:g%4?.95:.55}));}
 // Neural mesh: scattered points joined to their two nearest neighbours.
 const pts: Point[]=[];for(let i=0;i<90;i++){const x=cx+(rnd()*2-1)*rx*.9,y=cy+(rnd()*2-1)*ry*.86;if(inside(x,y))pts.push([x,y]);}let mesh='';for(const p of pts){const near=pts.filter(q=>q!==p).sort((u,v)=>Math.hypot(u[0]-p[0],u[1]-p[1])-Math.hypot(v[0]-p[0],v[1]-p[1])).slice(0,2);for(const q of near)mesh+=`M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`;}
 s.push(sh('path',{d:mesh,stroke:M,'stroke-width':'.35',fill:'none',opacity:'.22'}),pts.map(([x,y],i)=>sh('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:i%5?1.1:1.8,fill:i%5?M:I,opacity:i%5?.45:.6})));return sh('g',{'data-brain-coral':true},s);}
 function edgesV(L: BrainLayout){const at: Record<string,Placed>={};for(const o of L.nodes)at[o.n.key]=o;const s: Shape[]=[];const sel=ui.brainSelected;for(const[from,to]of cache.brainEdges||[]){const p=at[from],q=at[to];if(!p||!q)continue;const mx=(p.x+q.x)/2,my=(p.y+q.y)/2,dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1,bow=Math.min(40,l*.16),c=[mx-dy/l*bow,my+dx/l*bow],pts=Array.from({length:17},(_,i): Point=>{const t=i/16,u=1-t;return[u*u*p.x+2*u*t*c[0]+t*t*q.x,u*u*p.y+2*u*t*c[1]+t*t*q.y];});
 s.push(sh('g',{'data-brain-edge':`${from}|${to}`,opacity:sel?(from===sel||to===sel?.9:.06):.34},curveV(pts,.95,I)));}return s;}
 function seabedV(w: number,h: number){const y=h-16;type V=Shape|null|V[];const s: V[]=[curveV(Array.from({length:31},(_,i): Point=>[i*w/30,y+Math.sin(i*.9)*2.4]),1.1,M)];const rock=(x: number,wd: number,ht: number)=>{const p: Point[]=[[x,y],[x+wd*.1,y-ht*.6],[x+wd*.32,y-ht],[x+wd*.64,y-ht*.85],[x+wd*.92,y-ht*.4],[x+wd,y]];const o: V[]=[FV(p),curveV(p,1)];for(let i=0;i<4;i++){const hx=x+wd*(.55+i*.1);o.push(inkV([[hx,y-2],[hx-4,y-ht*.5]],.45,M));}return o;};
 const weed=(x: number,hh: number)=>{const o: V[]=[];for(let j=0;j<3;j++){const p: Point[]=[];for(let i=0;i<=8;i++){const t=i/8;p.push([x+j*4+Math.sin(t*5+j)*3,y-t*hh*(1-j*.18)]);}o.push(curveV(p,.7,j?M:I));}return o;};
 const coral=(x: number,k: number)=>{const o: V[]=[];const br=(x0: number,y0: number,ang: number,len: number,dep: number)=>{const x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len;o.push(curveV([[x0,y0],[(x0+x1)/2+Math.sin(ang)*2,(y0+y1)/2],[x1,y1]],Math.max(.5,dep*.35),dep>1?I:M));if(dep>0){br(x1,y1,ang-.45,len*.7,dep-1);br(x1,y1,ang+.4,len*.66,dep-1);}};br(x,y,-Math.PI/2,16*k,3);return o;};
 const fish=(x: number,yy: number,f=1)=>[curveV(Array.from({length:13},(_,i): Point=>{const t=i/12*Math.PI*2;return[x+Math.cos(t)*6*f,yy+Math.sin(t)*2.2];}),.7,M),inkV([[x-6*f,yy],[x-10*f,yy-2.6],[x-9.5*f,yy+2.6],[x-6*f,yy]],.7,M)];
 s.push(rock(10,90,30),weed(70,70),coral(120,1.3),weed(160,48),rock(w*.2,70,22),coral(w*.28,1),fish(w*.22,y-60),fish(w*.24,y-52),fish(w*.26,y-64),rock(w*.6,80,26),weed(w*.68,62),coral(w*.73,1.2),fish(w*.66,y-74,-1),fish(w*.68,y-66,-1),weed(w*.8,52),rock(w*.86,96,30),coral(w*.95,1.1));return sh('g',{'data-brain-seabed':true},s);}
 function scenery(box: DOMRect){const root=$('#brain'),w=box.width,h=Math.min(box.height,HOST.bottom-box.top);if(root&&cache.brainRendered!==root.clientWidth+'x'+root.clientHeight)render();const s: Part[]=[seabedV(w,h)];if(ui.brainList)return s;const L=cache.brainLayout||layout(w,h);
 s.push(brainArtV(L),...edgesV(L),sh('g',{'data-brain-halo':true,opacity:'0',style:'transition:opacity .2s'},circleV(0,0,26,.6,T),circleV(0,0,34,.4,T)));window.setTimeout(applySelection);return s;}
 function action(key: string,id: string,b: HTMLElement){if(!key.startsWith('brain-'))return false;
 if(key==='brain-select'){ui.brainSelected=ui.brainSelected===b.dataset.brainNode?null:b.dataset.brainNode!;applySelection();return true;}
 if(key==='brain-rank-pick'){ui.brainList=false;if(!visibleNodes().some(n=>n.key===id)){ui.brainType=null;ui.brainQuery='';d.graphDefault[id.split(':')[0]]?.push(id.split(':').slice(1).join(':'));}ui.brainSelected=ui.brainSelected===id?null:id;a.update();return true;}
 if(key==='brain-search'){HOST.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}));return true;}
 if(key==='brain-list')ui.brainList=!ui.brainList;else if(key==='brain-clear'){ui.brainSelected=null;ui.brainType=null;ui.brainQuery='';}
 else if(key==='brain-band'){ui.brainType=id&&ui.brainType!==id?id:null;ui.brainSelected=null;ui.brainList=false;}
 else if(key==='brain-zoom')ui.brainZoom=Math.max(.8,Math.min(1.2,Math.round(((ui.brainZoom||1)+(id==='+'?.1:-.1))*10)/10));else if(key==='brain-rank')ui.brainRankShut=!ui.brainRankShut;
 a.update();return true;}
 return{render,action,scenery,applySelection,search(){render();a.drawScenery();},key(e: KeyboardEvent){const node=tgt(e).closest<HTMLElement>('[data-brain-node]');if(ui.page==='brain'&&node&&e.shiftKey&&e.key==='Enter'){e.preventDefault();a.go(node.dataset.kind!,node.dataset.id!);return true;}if(ui.page==='brain'&&e.key==='≡'){e.preventDefault();ui.brainList=!ui.brainList;a.update();return true;}return false;}};
}
