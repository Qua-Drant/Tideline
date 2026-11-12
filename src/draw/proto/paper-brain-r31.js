import {HOST} from '../../host.js';
// R31 (copied from paper-brain-r25.js, which stays as it was): pill widths follow the font size set in 设置 (they were
// sized for 13px text, so at 特大 even “林老师” lost its last two characters), and a pill that still cannot hold its
// name in one line wraps to two lines (class is-two, centred on the same row) instead of ending in an ellipsis.
// R25 brain (paper-brain.js stays as it was): the graph lives inside a hand-drawn brain that grows out of the seabed
// like a coral. Kinds keep their own band: directions and ideas in the crown, projects and tasks across the middle,
// people on the two flanks, reading at the base. A chip row filters by kind, the toolbar searches, lists and zooms,
// and a side panel ranks the most connected nodes. Node hooks (data-brain-node, graph-muted, brain-list, brain-select)
// keep their names. Positions come from one layout shared by the HTML and the inked relations.
export function brainPage(a){
 const {d,$,$$,ink,icon,esc,svg,button:B,glyph:G}=a,P=a.PAPER,M=a.SECONDARY,T=a.TICK,I=a.INK;
 const KIND={goal:'目标',idea:'想法',project:'项目',task:'任务',library:'文献',person:'人物'};
 function allNodes(){return [['goal',d.goals],['idea',d.ideas],['project',d.projects],['task',d.tasks],['literature',d.literature],['book',d.books],['person',d.people]].flatMap(([kind,items])=>items.map(item=>({kind,id:item.id,title:item.title||item.name,item,key:kind+':'+item.id})));}
 function allEdges(){const edges=[];for(const p of d.projects){const pk='project:'+p.id;for(const[kind,ids]of [['goal',p.goalIds],['idea',p.ideaIds],['literature',p.literatureIds],['person',p.peopleIds],['task',d.tasks.filter(t=>t.projectId===p.id).map(t=>t.id)]])for(const id of ids)edges.push([pk,kind+':'+id]);}for(const book of d.books)for(const id of book.projectIds)edges.push(['project:'+id,'book:'+book.id]);return edges;}
 function related(){const id=d.ui.brainSelected,set=new Set(id?[id]:[]);if(id)for(const[a,b]of allEdges())if(a===id||b===id){set.add(a);set.add(b);}return set;}
 function glyph(n){return n.kind==='person'?a.initial(n.item):n.kind==='goal'?G('goal'):icon({idea:'star',project:'route',task:'circle',literature:'note',book:'book'}[n.kind]);}
 const group=n=>['literature','book'].includes(n.kind)?'library':n.kind;
 function degrees(){const deg={};for(const[s,t]of allEdges()){deg[s]=(deg[s]||0)+1;deg[t]=(deg[t]||0)+1;}return deg;}
 function visibleNodes(){const nodes=allNodes(),q=(d.ui.brainQuery||'').trim();let v=q?['goal','idea','project','task','library','person'].flatMap(k=>nodes.filter(n=>group(n)===k&&n.title.includes(q)).slice(0,6)):nodes.filter(n=>d.graphDefault[n.kind]?.includes(n.id));if(d.ui.brainType)v=v.filter(n=>group(n)===d.ui.brainType);return v;}
 // ——— One layout: brain ellipse, then rows of pills placed along each band's chord. ———
 function layout(w,h){const rank=!d.ui.brainRankShut,right=rank?Math.min(300,w*.25)+24:56,top=58,bottom=h-92,z=d.ui.brainZoom||1,cx=(w-right)/2+6,rx=Math.min((w-right)/2-58,(bottom-top)*.86)*z,ry=(bottom-top)/2*.96*z,cy=top+(bottom-top)/2+4;
 const L={w,h,cx,cy,rx,ry,right,nodes:[],labels:[],z},chord=y=>rx*Math.sqrt(Math.max(0,1-y*y)),vis=visibleNodes(),fs=d.cache.fontScale||1,pw=n=>Math.min(Math.round((n.kind==='person'?112:184)*fs),Math.round(n.title.length*13*fs+52)),two=(n,wd)=>n.title.length*13*fs>wd-52+2;
 const rows={goal:[-.64],idea:[-.4],project:[-.02],task:[.24],library:[.5,.72]};
 const place=(items,ys,limit=.8)=>{if(!items.length)return;const per=Math.ceil(items.length/ys.length);ys.forEach((yy,r)=>{const part=items.slice(r*per,(r+1)*per);if(!part.length)return;const y=cy+yy*ry,half=chord(yy)*limit,widths=part.map(pw),gap=Math.max(10,(half*2-widths.reduce((s,x)=>s+x,0))/(part.length+1));let x=cx-half+gap,k=Math.min(1,(half*2-10*(part.length+1))/widths.reduce((s,x)=>s+x,0));
 part.forEach((n,i)=>{const wd=Math.round(widths[i]*Math.min(1,k));L.nodes.push({n,x:x+wd/2,y,w:wd,two:two(n,wd)});x+=wd+(k<1?10:gap);});});};
 for(const k of ['goal','idea','project','task','library']){const items=vis.filter(n=>group(n)===k);place(items,items.length>5&&rows[k].length===1?[rows[k][0]-.09,rows[k][0]+.09]:rows[k],k==='project'||k==='task'?.84:.82);}
 const people=vis.filter(n=>n.kind==='person');people.forEach((n,i)=>{const side=i%2?1:-1,yy=i<2?.12:.36,x=cx+side*(chord(yy)*1.02);L.nodes.push({n,x,y:cy+yy*ry,w:pw(n)});});
 L.labels=[['方向与想法','star',cx,cy-ry*.86],['项目与任务','route',cx,cy-ry*.2],['人际','person',cx-rx*.9,cy-ry*.14],['知识','book',cx,cy+ry*.93]].filter(([t])=>!d.ui.brainType||{方向与想法:['goal','idea'],项目与任务:['project','task'],人际:['person'],知识:['library']}[t].includes(d.ui.brainType));
 if(people.length>1)L.labels.push(['人际','person',cx+rx*.9,cy-ry*.14]);d.cache.brainLayout=L;return L;}
 function chips(){const t=d.ui.brainType||'';return `<div class="brain-chips" role="group" aria-label="按类型筛选">${[['','全部'],...Object.entries(KIND)].map(([k,l])=>B('brain-band',k,l,k?'只看'+l:'显示全部类型',`class="brain-chip hand-pill" aria-pressed="${t===k}"`)).join('')}</div>`;}
 function tools(){const z=Math.round((d.ui.brainZoom||1)*100);return `<div class="brain-tools">${B('brain-search','',icon('search'),'搜索节点（/）','class="brain-tool hand-pill"')}${B('brain-clear','',svg(a.circle(10,10,3,1.2)+ink([[10,2],[10,6]],1.1)+ink([[10,14],[10,18]],1.1)+ink([[2,10],[6,10]],1.1)+ink([[14,10],[18,10]],1.1)),'显示所有关联','class="brain-clear brain-tool hand-pill"')}${B('brain-list','',G('lines'),'切换关系列表','class="brain-list-toggle brain-tool hand-pill" aria-pressed="'+d.ui.brainList+'"')}<div class="brain-zoom hand-pill">${B('brain-zoom','-','−','缩小')}<span class="mono">${z}%</span>${B('brain-zoom','+','+','放大')}</div></div>`;}
 function rankPanel(){const deg=degrees(),nodes=allNodes().filter(n=>deg[n.key]).sort((x,y)=>deg[y.key]-deg[x.key]||x.title.localeCompare(y.title)).slice(0,12);if(d.ui.brainRankShut)return B('brain-rank','',G('left'),'展开高关联节点','class="brain-rank-open hand-pill"');
 return `<aside class="brain-rank hand-panel"><header><h3>高关联节点<span class="mono">（${nodes.length}）</span></h3>${B('brain-rank','',G('right'),'收起高关联节点','class="brain-rank-close"')}</header><ol>${nodes.map(n=>`<li>${B('brain-rank-pick',n.key,glyph(n)+`<span>${esc(n.title)}</span><b class="mono">${deg[n.key]}</b>`,n.title,`class="${d.ui.brainSelected===n.key?'is-on':''}"`)}</li>`).join('')}</ol></aside>`;}
 function render(){const root=$('#brain'),w=root.clientWidth,h=root.clientHeight;d.cache.brainRendered=w+'x'+h;const vis=visibleNodes();d.cache.brainNodes=vis;d.cache.brainEdges=allEdges().filter(([s,t])=>vis.some(n=>n.key===s)&&vis.some(n=>n.key===t));
 let html=chips()+tools();
 if(d.ui.brainList)html+=`<div class="brain-plain-list hand-panel">${allNodes().map(n=>B('brain-select',n.id,glyph(n)+`<span>${esc(n.title)}</span>`,n.title,`data-brain-node="${n.key}" data-kind="${n.kind}" class="graph-list-node"`)).join('')}</div>`;
 else{const L=layout(w,h),rel=related();html+=L.labels.map(([t,ic,x,y])=>`<div class="brain-cluster hand-pill" style="left:${x}px;top:${y}px">${ic==='person'?svg(a.circle(7,7,3,1.1)+ink([[2,17],[3,12],[7,10],[11,12],[12,17]],1.1)+a.circle(14,8,2.4,1)+ink([[13,11],[17,12],[18,16]],1),20):icon(ic)}<span>${t}</span></div>`).join('');
 html+=L.nodes.map(({n,x,y,w:wd,two})=>B('brain-select',n.id,glyph(n)+`<span class="node-name">${esc(n.title)}</span>`,n.title,`data-brain-node="${n.key}" data-kind="${n.kind}" class="graph-node brain-node hand-pill ${two?'is-two':''} ${n.kind==='person'?'person-node':''} ${d.ui.brainSelected&&!rel.has(n.key)?'graph-muted':''}" title="${esc(n.title)}" aria-pressed="${d.ui.brainSelected===n.key}" style="left:${Math.round(x-wd/2)}px;top:${Math.round(y-15)}px;width:${wd}px"`)).join('');}
 html+=rankPanel();root.innerHTML=html;applySelection();}
 function applySelection(){const links=related();for(const node of $$('#brain [data-brain-node]')){const key=node.dataset.brainNode;node.classList.toggle('graph-muted',!!d.ui.brainSelected&&!links.has(key));node.setAttribute('aria-pressed',String(key===d.ui.brainSelected));}
 for(const r of $$('#brain [data-p2="brain-rank-pick"]'))r.classList.toggle('is-on',r.dataset.id===d.ui.brainSelected);
 for(const edge of $$('#scenery [data-brain-edge]')){const[s,t]=edge.dataset.brainEdge.split('|');edge.style.opacity=d.ui.brainSelected?(s===d.ui.brainSelected||t===d.ui.brainSelected?'.9':'.06'):'.34';}
 const halo=$('#scenery [data-brain-halo]'),L=d.cache.brainLayout,at=L?.nodes.find(o=>o.n.key===d.ui.brainSelected);if(halo){halo.style.opacity=at?'1':'0';if(at)halo.setAttribute('transform',`translate(${at.x} ${at.y})`);}}
 // ——— Scenery: brain coral, its gyri, a faint neural mesh, relation curves, seabed. ———
 let seed=7;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z" fill="${c}"/>`;
 function outline(L){const{cx,cy,rx,ry}=L,pts=[];for(let i=0;i<=96;i++){const t=i/96*Math.PI*2,c=Math.cos(t),s=Math.sin(t),bump=1+.016*Math.sin(t*13+.6)+.01*Math.sin(t*23),flat=s>0?1-.12*s*s:1+.03*(-s),front=c<0?1+.03*Math.abs(c):1;pts.push([cx+c*rx*1.06*bump*front,cy+s*ry*1.04*bump*flat]);}return pts;}
 function brainArt(L){const{cx,cy,rx,ry}=L;seed=7;let s='<g data-brain-coral>';const o=outline(L),inside=(x,y)=>((x-cx)/(rx*.98))**2+((y-cy)/(ry*.95))**2<1;
 // Stem and roots first, so the brain sits on top of them.
 const sy=cy+ry*.86,base=L.h-22;s+=F([[cx-34,sy],[cx+30,sy],[cx+46,base-14],[cx+92,base],[cx-96,base],[cx-50,base-14]],P);
 for(const k of [-1,1])s+=a.curve([[cx+k*32,sy],[cx+k*28,(sy+base)/2],[cx+k*46,base-14],[cx+k*94,base]],1.2);for(let i=-3;i<=3;i++)s+=a.curve([[cx+i*8,sy+4],[cx+i*9+Math.sin(i)*3,(sy+base)/2],[cx+i*14,base-4]],.5,T);
 s+=F(o)+a.curve(o,1.4)+a.curve(o.map(([x,y])=>[cx+(x-cx)*.965,cy+(y-cy)*.965]),.5,T);
 // Cerebellum and the lateral fissure, then many small gyri.
 const cb=[];for(let i=0;i<=40;i++){const t=i/40*Math.PI*2;cb.push([cx+rx*.5+Math.cos(t)*rx*.3*(1+.04*Math.sin(t*9)),cy+ry*.74+Math.sin(t)*ry*.17]);}s+=a.curve(cb.slice(0,21),1)+'';for(let k=1;k<5;k++)s+=a.curve(Array.from({length:9},(_,i)=>[cx+rx*(.24+i*.065),cy+ry*(.68+k*.045)+Math.sin(i*1.4+k)*2]),.5,T);
 s+=a.curve([[cx-rx*.62,cy+ry*.18],[cx-rx*.3,cy+ry*.06],[cx,cy-ry*.02],[cx+rx*.3,cy-ry*.16],[cx+rx*.5,cy-ry*.34]],.9,M)+a.curve([[cx-rx*.06,cy-ry*.92],[cx-rx*.02,cy-ry*.6],[cx-rx*.1,cy-ry*.3],[cx-rx*.04,cy-ry*.08]],.8,M);
 // Folds: meandering curves that turn back on themselves, in two weights, clipped to the brain.
 for(let g=0;g<70;g++){const x0=cx+(rnd()*2-1)*rx*.9,y0=cy+(rnd()*2-1)*ry*.86;if(!inside(x0,y0))continue;let ang=rnd()*Math.PI*2,x=x0,y=y0;const p=[[x,y]],n=6+Math.floor(rnd()*6);for(let i=0;i<n;i++){ang+=(rnd()-.5)*2.2;const step=9+rnd()*9;x+=Math.cos(ang)*step;y+=Math.sin(ang)*step;if(!inside(x,y))break;p.push([x,y]);}if(p.length>3)s+=a.curve(p,g%4?.55:.8,g%4?T:M,`opacity="${g%4?.95:.55}"`);}
 // Neural mesh: scattered points joined to their two nearest neighbours.
 const pts=[];for(let i=0;i<90;i++){const x=cx+(rnd()*2-1)*rx*.9,y=cy+(rnd()*2-1)*ry*.86;if(inside(x,y))pts.push([x,y]);}let mesh='';for(const p of pts){const near=pts.filter(q=>q!==p).sort((u,v)=>Math.hypot(u[0]-p[0],u[1]-p[1])-Math.hypot(v[0]-p[0],v[1]-p[1])).slice(0,2);for(const q of near)mesh+=`M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`;}
 s+=`<path d="${mesh}" stroke="${M}" stroke-width=".35" fill="none" opacity=".22"/>`+pts.map(([x,y],i)=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i%5?1.1:1.8}" fill="${i%5?M:I}" opacity="${i%5?.45:.6}"/>`).join('');return s+'</g>';}
 function edges(L){const at={};for(const o of L.nodes)at[o.n.key]=o;let s='';const sel=d.ui.brainSelected;for(const[from,to]of d.cache.brainEdges||[]){const p=at[from],q=at[to];if(!p||!q)continue;const mx=(p.x+q.x)/2,my=(p.y+q.y)/2,dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1,bow=Math.min(40,l*.16),c=[mx-dy/l*bow,my+dx/l*bow],pts=Array.from({length:17},(_,i)=>{const t=i/16,u=1-t;return[u*u*p.x+2*u*t*c[0]+t*t*q.x,u*u*p.y+2*u*t*c[1]+t*t*q.y];});
 s+=`<g data-brain-edge="${from}|${to}" opacity="${sel?(from===sel||to===sel?.9:.06):.34}">${a.curve(pts,.95,I)}</g>`;}return s;}
 function seabed(w,h){const y=h-16;let s=a.curve(Array.from({length:31},(_,i)=>[i*w/30,y+Math.sin(i*.9)*2.4]),1.1,M);const rock=(x,wd,ht)=>{const p=[[x,y],[x+wd*.1,y-ht*.6],[x+wd*.32,y-ht],[x+wd*.64,y-ht*.85],[x+wd*.92,y-ht*.4],[x+wd,y]];let o=F(p)+a.curve(p,1);for(let i=0;i<4;i++){const hx=x+wd*(.55+i*.1);o+=ink([[hx,y-2],[hx-4,y-ht*.5]],.45,M);}return o;};
 const weed=(x,hh)=>{let o='';for(let j=0;j<3;j++){const p=[];for(let i=0;i<=8;i++){const t=i/8;p.push([x+j*4+Math.sin(t*5+j)*3,y-t*hh*(1-j*.18)]);}o+=a.curve(p,.7,j?M:I);}return o;};
 const coral=(x,k)=>{let o='';const br=(x0,y0,ang,len,dep)=>{const x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len;o+=a.curve([[x0,y0],[(x0+x1)/2+Math.sin(ang)*2,(y0+y1)/2],[x1,y1]],Math.max(.5,dep*.35),dep>1?I:M);if(dep>0){br(x1,y1,ang-.45,len*.7,dep-1);br(x1,y1,ang+.4,len*.66,dep-1);}};br(x,y,-Math.PI/2,16*k,3);return o;};
 const fish=(x,yy,f=1)=>a.curve(Array.from({length:13},(_,i)=>{const t=i/12*Math.PI*2;return[x+Math.cos(t)*6*f,yy+Math.sin(t)*2.2];}),.7,M)+ink([[x-6*f,yy],[x-10*f,yy-2.6],[x-9.5*f,yy+2.6],[x-6*f,yy]],.7,M);
 s+=rock(10,90,30)+weed(70,70)+coral(120,1.3)+weed(160,48)+rock(w*.2,70,22)+coral(w*.28,1)+fish(w*.22,y-60)+fish(w*.24,y-52)+fish(w*.26,y-64)+rock(w*.6,80,26)+weed(w*.68,62)+coral(w*.73,1.2)+fish(w*.66,y-74,-1)+fish(w*.68,y-66,-1)+weed(w*.8,52)+rock(w*.86,96,30)+coral(w*.95,1.1);return `<g data-brain-seabed>${s}</g>`;}
 function scenery(box){const root=$('#brain'),w=box.width,h=Math.min(box.height,HOST.bottom-box.top);if(root&&d.cache.brainRendered!==root.clientWidth+'x'+root.clientHeight)render();let s=seabed(w,h);if(d.ui.brainList)return s;const L=d.cache.brainLayout||layout(w,h);
 s+=brainArt(L)+edges(L)+`<g data-brain-halo opacity="0" style="transition:opacity .2s">${a.circle(0,0,26,.6,T)}${a.circle(0,0,34,.4,T)}</g>`;setTimeout(applySelection);return s;}
 function action(key,id,b){if(!key.startsWith('brain-'))return false;
 if(key==='brain-select'){d.ui.brainSelected=d.ui.brainSelected===b.dataset.brainNode?null:b.dataset.brainNode;applySelection();return true;}
 if(key==='brain-rank-pick'){d.ui.brainList=false;if(!visibleNodes().some(n=>n.key===id)){d.ui.brainType=null;d.ui.brainQuery='';d.graphDefault[id.split(':')[0]]?.push(id.split(':').slice(1).join(':'));}d.ui.brainSelected=d.ui.brainSelected===id?null:id;a.update();return true;}
 if(key==='brain-search'){HOST.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}));return true;}
 if(key==='brain-list')d.ui.brainList=!d.ui.brainList;else if(key==='brain-clear'){d.ui.brainSelected=null;d.ui.brainType=null;d.ui.brainQuery='';}
 else if(key==='brain-band'){d.ui.brainType=id&&d.ui.brainType!==id?id:null;d.ui.brainSelected=null;d.ui.brainList=false;}
 else if(key==='brain-zoom')d.ui.brainZoom=Math.max(.8,Math.min(1.2,Math.round(((d.ui.brainZoom||1)+(id==='+'?.1:-.1))*10)/10));else if(key==='brain-rank')d.ui.brainRankShut=!d.ui.brainRankShut;
 a.update();return true;}
 return{render,action,scenery,applySelection,search(){render();a.drawScenery();},key(e){const node=e.target.closest('[data-brain-node]');if(d.ui.page==='brain'&&node&&e.shiftKey&&e.key==='Enter'){e.preventDefault();a.go(node.dataset.kind,node.dataset.id);return true;}if(d.ui.page==='brain'&&e.key==='≡'){e.preventDefault();d.ui.brainList=!d.ui.brainList;a.update();return true;}return false;},help:[[420,60,'上方按类型筛选，右侧可缩放与切换列表',30,-30],[560,330,'点选保留关联，双击或 Shift+Enter 回到对象所在页',-20,-130],[1060,200,'右侧列出关联最多的节点',-40,-60]]};
}
