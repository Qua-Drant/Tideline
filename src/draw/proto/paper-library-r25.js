import {HOST} from '../../host.js';
// R25 (copied from paper-library-r24.js, which stays as it was): every rounded box in the deep-sea view — search,
// chips, the view toggle, keywords and the “打开我的知识库” card — is outlined by hand (hand-pill / hand-panel).
// R24 library (paper-library.js stays as it was): two views of the same records.
// · Deep sea — a hull at the top lowers two sounding ropes, 文献 and 读书笔记. Each knot is a reading depth with its
//   range in metres; the records hang from a branch line at that knot as paper tags on two strings. Dropped papers lie
//   on the seabed. A selected record opens a framed card on the right whose last button opens the knowledge base.
// · Knowledge base — a list grouped by stage on the left, the record's abstract, key points and my notes in the middle,
//   reading progress, tags, related records and projects on the right, and a strip of seabed along the foot.
// Interaction hooks used by the earlier rounds (library-sign, drop zones, knot label, gloss, stage menu, project
// filter) keep their names. Authors, years, keywords, abstracts and progress are fictional sample data in memory.
export function libraryPage(a){
 const {d,$,ink,circle,icon,esc,svg,button:B,glyph:G,fmt}=a,P=a.PAPER,M=a.SECONDARY,T=a.TICK,I=a.INK;
 const stages={literature:[['inbox','待泛读','0 – 200 m'],['skimmed','已泛读','200 – 1,000 m'],['to-deep','待精读','1,000 – 3,000 m'],['deep-done','已精读','3,000 m +']],book:[['want','想读','0 – 500 m'],['reading','在读','500 – 2,000 m'],['done','读完','2,000 m +']]};
 const records=kind=>kind==='book'?d.books:d.literature,find=(kind,id)=>records(kind).find(x=>x.id===id),stageOf=(kind,s)=>stages[kind].find(x=>x[0]===s)||['dropped','放弃','沉底'];
 const KW={'lit-01':['研究设计','假设','方法'],'lit-02':['配准','建筑轮廓','误差'],'lit-03':['边界误差','评价','分布'],'lit-04':['制图','图表','写作'],'lit-05':['样本','覆盖偏差'],'lit-06':['定性研究','可追溯'],'lit-07':['写作','不确定性'],'lit-08':['遥感','尺度'],'lit-09':['复现','实验'],'lit-10':['空间样本','外推'],'lit-11':['分割','瓦片'],'lit-12':['边界模型'],'book-01':['研究方法','问题'],'book-02':['写作','读者'],'book-03':['统计','不确定性'],'book-04':['专注','时间'],'book-05':['城市','观察']};
 const AUTH=['林岚 等','周屿 等','陈芮','许衡 等','苏禾','叶舟 等','沈砚','韩溪 等','顾川','程鸥 等','宋岩','方澄'],TYPE=['期刊论文','会议论文','预印本','学位论文'],PROG={inbox:0,skimmed:30,'to-deep':45,'deep-done':100,dropped:10,want:0,reading:60,done:100};
 function meta(kind,item){const all=d.libraryMeta??={},key=kind+'|'+item.id;if(all[key])return all[key];const i=records(kind).indexOf(item),proj=item.projectIds[0]&&a.project(item.projectIds[0]);
 return all[key]={authors:AUTH[(i*5+(kind==='book'?3:0))%AUTH.length],year:2018+(i*3+(kind==='book'?1:0))%8,type:kind==='book'?'专著':TYPE[i%4],added:`2026-10-${String(Math.max(2,28-i*2-(kind==='book'?5:0))).padStart(2,'0')}`,keywords:[...(KW[item.id]||[])],fav:['lit-01','lit-03','book-02'].includes(item.id),
 progress:PROG[item.stage]??0,started:`2026-10-${String(Math.max(1,20-i)).padStart(2,'0')}`,note:'',
 abstract:`本${kind==='book'?'书':'文'}围绕「${item.title}」展开。${item.conclusion}作者用几组对照案例说明这一点，并给出一套可以直接套用的检查步骤。`,
 points:[['核心观点',item.conclusion],['适用范围',proj?`与「${proj.title}」相关的判断与写作。`:'当前研究中需要说明依据的部分。'],['可借用的做法','读完后整理成一页检查清单，放进对应项目。']],
 marks:[`“${item.conclusion}”`,'第 3 节的对照表值得复用。']};}
 const pct=(kind,item)=>{const p=PROG[item.stage]??0;return p===100?100:Math.max(meta(kind,item).progress,p);};
 const ring=(v,r=8,n=1.3)=>{const c=r+2,p=[];for(let i=0;i<=40;i++){const t=-Math.PI/2+i/40*Math.PI*2*Math.max(.001,v/100);p.push([c+Math.cos(t)*r,c+Math.sin(t)*r]);}return svg(circle(c,c,r,.7,T)+(v>0?ink(p,n):''),c*2);};
 const view=()=>d.ui.libraryView==='shelf'?'shelf':'sea',q=()=>(d.ui.libraryQuery||'').trim();
 const matches=(kind,item)=>{const s=q();if(!s)return true;const m=meta(kind,item);return [item.title,item.conclusion,m.authors,...m.keywords].some(x=>x.includes(s));};
 // ——— Deep sea layout: one set of numbers for the HTML tags and the inked ropes, strings and knots. ———
 function seaLayout(w,h){const detail=!!d.ui.librarySelected,litX=Math.max(140,Math.round(w*.13)),bookX=Math.round(w*.54),y0=96,y1=h-104,small=h<700,ch=small?38:42,gap=small?8:12;
 const litArea=[litX+26,bookX-128],bookArea=[bookX+26,detail?Math.round(w*.705)-18:Math.round(w*.74)];const out={w,h,litX,bookX,y0,y1,ch,cards:[],levels:[],detail,drift:[]};
 for(const[kind,x,area]of [['literature',litX,litArea],['book',bookX,bookArea]]){const n=stages[kind].length,step=(y1-y0)/n,span=area[1]-area[0],cols=span>=290?2:1,cw=Math.min(212,Math.floor((span-(cols-1)*14)/cols));
 const groups=stages[kind].map(([s])=>records(kind).filter(l=>l.stage===s)),need=groups.map(g=>18+Math.ceil(g.length/cols)*(ch+gap)+6),extra=Math.max(0,(y1-y0)-need.reduce((a,b)=>a+b,0)),steps=need.every(v=>v<=step)?need.map(()=>step):need.map(v=>v+extra/n);let yy=y0;stages[kind].forEach(([stage,label,depth],level)=>{const y=Math.round(yy),step=steps[level],items=groups[level];yy+=step;out.levels.push({kind,stage,label,depth,x,y,step,area});
 items.forEach((item,k)=>{const col=k%cols,row=Math.floor(k/cols);out.cards.push({kind,item,col,row,x:area[0]+col*(cw+14)+(row%2&&cols>1?10:0),y:y+18+row*(ch+gap),w:cw,h:ch,ky:y,rx:x});});});}
 d.literature.filter(l=>l.stage==='dropped').forEach((item,i)=>out.drift.push({kind:'literature',item,x:litX+30+i*174,y:h-74,w:150,h:34,rot:i%2?4:-5}));return out;}
 function tag(c,cls=''){const{kind,item}=c,active=!d.ui.libraryFilter||item.projectIds.includes(d.ui.libraryFilter),sel=d.ui.librarySelected?.id===item.id,linked=item.projectIds.length,done=['deep-done','done'].includes(item.stage);
 return `<div class="library-sign lib-tag hand-panel ${cls} ${linked?'':'unlinked'} ${active?'':'unrelated'} ${matches(kind,item)?'':'is-unmatched'} ${sel?'is-selected':''}" draggable="true" data-p2-drag="paper" data-id="${kind}|${item.id}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px${c.rot?`;transform:rotate(${c.rot}deg)`:''}">${B('library-open',kind+'|'+item.id,`<span>${esc(item.title)}</span>${done&&item.readDate?`<time class="mono">${fmt(item.readDate)}</time>`:''}`,'打开 '+item.title,`class="paper-title" data-paper-hover="${kind}|${item.id}" aria-describedby="library-gloss"`)}${linked?B('library-project-filter',item.projectIds[0],G('anchor'),'筛选项目 '+a.project(item.projectIds[0]).title,'class="paper-project-mark"'):''}</div>`;}
 function toolbar(){const f=d.ui.libraryFilter;return `<div class="lib-toolbar"><label class="lib-search hand-pill">${icon('search')}<input type="search" data-library-query placeholder="搜索文献、笔记、关键词…" value="${esc(d.ui.libraryQuery||'')}" aria-label="搜索知识库"></label>${f?B('library-clear-filter','',`<span>项目：${esc(a.project(f).title)}</span><i aria-hidden="true">×</i>`,'清除项目筛选','class="library-filter lib-chip hand-pill is-on"'):''}${B('library-view','shelf',G('bookmark')+'<span>知识库</span>','打开我的知识库','class="lib-view-toggle hand-pill"')}</div>`;}
 function detail(kind,item){const m=meta(kind,item),[,label,depth]=stageOf(kind,item.stage);
 return `<aside class="library-detail lib-card hand-panel"><div class="library-detail-actions">${B('library-stage-menu','',icon('lead'),'更改阅读阶段')}${B('library-source','',G('corner'),'展开笔记 Markdown')}${B('library-close','',svg(ink([[4,4],[16,16]],1.3)+ink([[16,4],[4,16]],1.3)),'折回纸签')}</div>
 <div class="lib-kind">${icon('note')}<span>${kind==='book'?'读书笔记':'文献'}</span></div><h3>${esc(item.title)}</h3><p class="lib-meta">${esc(m.authors)} · ${m.year} · ${m.type}</p>
 <h4>一句话结论</h4><p class="lib-conclusion">${esc(item.conclusion)}</p>
 <dl class="lib-facts"><div><dt>${G('anchor')}<span>关联项目</span></dt><dd>${item.projectIds.map(id=>B('open-object',id,esc(a.project(id).title),'打开项目 '+a.project(id).title,'data-kind="project" class="lib-chip hand-pill"')).join('')||'<span class="lib-none">未关联</span>'}</dd></div>
 <div><dt>${svg(ink([[3,6],[17,6]],1)+ink([[3,10],[17,10]],1)+ink([[3,14],[11,14]],1))}<span>所在深度</span></dt><dd>${label}<span class="mono">（${depth}）</span></dd></div>
 <div><dt>${svg(a.circle(10,10,6.5,1.1)+ink([[10,10],[10,5]],1.1)+ink([[10,10],[13.5,12]],1.1))}<span>阅读进度</span></dt><dd class="lib-prog">${ring(pct(kind,item),7,1.6)}<span class="mono">${pct(kind,item)}%</span></dd></div><div><dt>${icon('box')}<span>收录日期</span></dt><dd class="mono">${m.added.replaceAll('-','.')}</dd></div>${item.readDate?`<div><dt>${icon('check')}<span>读完</span></dt><dd>${fmt(item.readDate)}</dd></div>`:''}
 <div><dt>${G('bookmark')}<span>关键词</span></dt><dd class="lib-tags">${m.keywords.map(k=>`<span class="lib-chip hand-pill">${esc(k)}</span>`).join('')}</dd></div></dl>
 ${d.ui.libraryMenu?`<div class="library-stage-menu hand-popup" role="group" aria-label="阅读阶段">${stages[kind].map(([key,lab],i)=>B('library-stage',kind+'|'+item.id+'|'+key,svg(ink([[3,3],[3,20]],1.2)+circle(3,3+i*5,2.4,1.2),24,24)+`<span>${lab}</span>`,lab,`aria-pressed="${key===item.stage}"`)).join('')}${kind==='literature'?B('library-stage',kind+'|'+item.id+'|dropped',G('right')+'<span>放弃</span>','放弃'):''}</div>`:''}
 ${d.ui.librarySource?`<pre class="markdown-preview">${esc(`---\ntitle: ${item.title}\n---\n\nstage:: ${item.stage}\n\n${item.conclusion}`)}</pre>`:''}
 ${B('library-view','shelf',`${icon('book')}<span><b>打开我的知识库</b><small>查看详尽笔记内容、想法与批注</small></span>${G('right')}`,'打开我的知识库','class="lib-open-shelf hand-panel"')}</aside>`;}
 function seaPage(root,w,h){const L=seaLayout(w,h);d.cache.librarySea=L;let html=`<div class="lib-sea">`;
 html+=`<div class="lib-head lib-head-lit" style="left:${L.litX+24}px">${icon('book')}<span>文献</span></div><div class="lib-head lib-head-book" style="left:${L.bookX+24}px">${icon('note')}<span>读书笔记</span></div>`;
 for(const v of L.levels){const zoneW=v.area[1]-v.x+24;html+=`<div class="library-depth-zone p2-background-hit" data-p2-drop="paper:${v.kind}:${v.stage}" style="left:${v.x-12}px;top:${v.y-12}px;width:${zoneW}px;height:${Math.round(v.step)}px" aria-label="${v.label}"></div>`;
 html+=`<div class="lib-depth" style="left:${v.x-18}px;top:${v.y-10}px"><b>${v.label}</b><span class="mono">${v.depth}</span></div>`+B('library-knot',v.kind+'|'+stages[v.kind].findIndex(s=>s[0]===v.stage),svg(circle(9,9,5,1.3),18),v.label,`class="library-knot" data-knot-hover="${v.kind}|${stages[v.kind].findIndex(s=>s[0]===v.stage)}" style="left:${v.x-9}px;top:${v.y-9}px"`);}
 html+=L.cards.map(c=>tag(c)).join('')+L.drift.map(c=>tag(c,'drifted')).join('');
 if(L.drift.length)html+=`<span class="lib-drift-note" style="left:${L.drift.at(-1).x+L.drift.at(-1).w+16}px;top:${h-62}px">沉底 · 已放弃</span>`;
 html+='</div>'+toolbar();const sel=d.ui.librarySelected,item=sel&&find(sel.kind,sel.id);if(item)html+=detail(sel.kind,item);return html;}
 // ——— Knowledge base: list, record, side panels. ———
 function listRow(kind,item){const m=meta(kind,item),sel=d.ui.librarySelected?.kind===kind&&d.ui.librarySelected.id===item.id,v=pct(kind,item);
 return `<li class="lib-row ${sel?'is-selected':''} ${matches(kind,item)?'':'is-unmatched'}">${B('library-pick',kind+'|'+item.id,`<span class="lib-row-ring">${ring(v)}</span><span class="lib-row-main"><b>${esc(item.title)}</b><small>${esc(m.authors)} · ${m.year}<i>${m.type}</i></small></span><span class="lib-row-end mono">${v>0&&v<100?v+'%':v===100?(item.readDate?fmt(item.readDate):'读完'):fmt(m.added)}</span>`,item.title)}</li>`;}
 function listPane(){const tab=d.ui.libraryTab||'literature',groups=tab==='fav'?[['收藏',[...d.literature.map(x=>['literature',x]),...d.books.map(x=>['book',x])].filter(([k,x])=>meta(k,x).fav)]]:[...stages[tab].map(([s,l])=>[l,records(tab).filter(x=>x.stage===s).map(x=>[tab,x])]),...(tab==='literature'?[['放弃',d.literature.filter(x=>x.stage==='dropped').map(x=>['literature',x])]]:[])];
 const shut=d.ui.libraryShut??={'放弃':true};
 return `<section class="lib-list"><div class="lib-tabs" role="tablist">${[['literature','文献'],['book','读书笔记'],['fav','收藏']].map(([k,l])=>B('library-tab',k,l,l,`role="tab" aria-selected="${tab===k}"`)).join('')}</div>
 <label class="lib-search hand-pill">${icon('search')}<input type="search" data-library-query placeholder="搜索标题、作者、关键词…" value="${esc(d.ui.libraryQuery||'')}" aria-label="搜索知识库"></label>
 <div class="lib-groups">${groups.map(([label,items])=>`<div class="lib-group ${shut[label]?'is-shut':''}">${B('library-group',label,`${svg(ink(shut[label]?[[7,4],[13,10],[7,16]]:[[4,7],[10,13],[16,7]],1.3))}<b>${label}</b><span class="mono">${items.length}</span>`,label)}<ul>${items.map(([k,x])=>listRow(k,x)).join('')}</ul></div>`).join('')}</div></section>`;}
 function recordPane(kind,item){const m=meta(kind,item),sub=d.ui.librarySub||'abstract',links=item.projectIds.map(id=>a.project(id));
 const body=sub==='abstract'?`<h4>摘要</h4><p class="lib-abstract">${esc(m.abstract)}</p><h4>关键信息</h4><ul class="lib-points">${m.points.map(([k,v],i)=>`<li>${[icon('note'),G('goal'),icon('route')][i]}<span><b>${k}</b>${esc(v)}</span></li>`).join('')}</ul>`
 :sub==='marks'?`<h4>标注</h4><ul class="lib-marks">${m.marks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
 :sub==='related'?`<h4>相关</h4><ul class="lib-related">${related(kind,item).map(([k,x])=>`<li>${B('library-pick',k+'|'+x.id,icon('note')+`<span>${esc(x.title)}</span><small>${esc(meta(k,x).authors)} · ${meta(k,x).year}</small>`,x.title)}</li>`).join('')||'<li class="lib-none">暂无</li>'}</ul>`
 :`<h4>笔记</h4><p class="lib-abstract">${m.note?esc(m.note):'<span class="lib-none">还没有笔记。</span>'}</p>`;
 return `<section class="lib-record hand-panel"><header><div><h3>${esc(item.title)}</h3><p class="lib-meta">${esc(m.authors)} · ${m.year} · ${m.type}</p></div><div class="lib-record-actions">${B('library-source','',G('corner'),'展开笔记 Markdown')}${B('library-pdf','',`${icon('book')}<span>打开 PDF</span>`,'打开 PDF','class="lib-pdf"')}</div></header>
 <div class="lib-tags">${m.keywords.map(k=>`<span class="lib-chip hand-pill">${esc(k)}</span>`).join('')}</div>
 <div class="lib-subtabs" role="tablist">${[['abstract','摘要'],['note','笔记'],['marks',`标注 (${m.marks.length})`],['related',`相关 (${related(kind,item).length})`]].map(([k,l])=>B('library-sub',k,l,l,`role="tab" aria-selected="${sub===k}"`)).join('')}</div>
 <div class="lib-record-body">${body}${d.ui.librarySource?`<pre class="markdown-preview">${esc(`---\ntitle: ${item.title}\n---\n\nstage:: ${item.stage}\n\n${item.conclusion}`)}</pre>`:''}</div>
 <form class="lib-note" data-p2-form="library-note"><h4>我的笔记</h4><textarea name="note" rows="3" placeholder="写下你的想法、疑问或与自己研究的关联…" aria-label="我的笔记">${esc(m.note)}</textarea><div class="lib-note-bar"><span>${['B','I','≡','↗'].map(x=>`<i>${x}</i>`).join('')}</span><button type="submit" class="text-button">保存</button></div></form></section>`;}
 function related(kind,item){const out=[];for(const k of ['literature','book'])for(const x of records(k))if(x!==item&&x.stage!=='dropped'&&x.projectIds.some(id=>item.projectIds.includes(id)))out.push([k,x]);return out.slice(0,4);}
 function sidePane(kind,item){const m=meta(kind,item),v=pct(kind,item),eta=v>=100?'已读完':v>0?'—':'未开始';
 return `<section class="lib-side"><div class="lib-mini hand-panel"><h4>阅读进度</h4><div class="lib-progress"><span class="lib-big-ring">${ring(v,26,2.2)}<b class="mono">${v}%</b></span><dl><div><dt>收录</dt><dd>${fmt(m.added)}</dd></div><div><dt>开始阅读</dt><dd>${v>0?fmt(m.started):'—'}</dd></div><div><dt>${v>=100?'读完':'预计完成'}</dt><dd>${item.readDate?fmt(item.readDate):eta}</dd></div></dl></div></div>
 <div class="lib-mini hand-panel"><h4>我的标签</h4><div class="lib-tags">${m.keywords.map(k=>`<span class="lib-chip">${esc(k)}${B('library-untag',k,'×','移除标签 '+k)}</span>`).join('')}<form class="lib-tag-form" data-p2-form="library-tag"><input name="tag" placeholder="+ 添加标签" aria-label="添加标签"></form></div></div>
 <div class="lib-mini hand-panel"><h4>相关内容</h4><ul class="lib-related">${related(kind,item).slice(0,3).map(([k,x])=>`<li>${B('library-pick',k+'|'+x.id,icon('note')+`<span>${esc(x.title)}</span><small>${esc(meta(k,x).authors)} · ${meta(k,x).year}</small>`,x.title)}</li>`).join('')||'<li class="lib-none">暂无同项目的记录</li>'}</ul></div>
 <div class="lib-mini hand-panel"><h4>关联项目</h4>${item.projectIds.map(id=>B('open-object',id,G('anchor')+`<span>${esc(a.project(id).title)}</span>`+G('right'),'打开项目 '+a.project(id).title,'data-kind="project" class="lib-project-link"')).join('')||'<p class="lib-none">未关联项目</p>'}</div></section>`;}
 function shelfPage(){
 const tab=d.ui.libraryTab||'literature';
 const items=tab==='fav'
  ? [...d.literature.map(item=>['literature',item]),...d.books.map(item=>['book',item])].filter(([kind,item])=>meta(kind,item).fav)
  : records(tab).map(item=>[tab,item]);
 const selected=d.ui.librarySelected;
 const entry=items.find(([kind,item])=>kind===selected?.kind&&item.id===selected.id)||items.find(([,item])=>item.stage!=='dropped')||items[0];
 const [kind,item]=entry||[];
 const empty={literature:'还没有文献',book:'还没有读书笔记',fav:'还没有收藏'}[tab];
 d.ui.librarySelected=item?{kind,id:item.id}:null;
 return `<div class="lib-shelf">${B('library-view','sea',G('left')+'<span>回到深海</span>','回到深海视图','class="lib-back"')}${listPane()}${item?recordPane(kind,item)+sidePane(kind,item):`<section class="lib-record hand-panel"><p class="lib-none">${empty}</p></section>`}</div>`;}
 function render(){const root=$('#library'),w=root.clientWidth,h=root.clientHeight,mode=view();root.dataset.libraryView=mode;root.classList.toggle('has-library-detail',mode==='sea'&&!!d.ui.librarySelected);d.cache.libraryRendered=mode+w+'x'+h;
 root.innerHTML=(mode==='shelf'?shelfPage():seaPage(root,w,h))+`<div id="library-gloss" class="library-gloss hand-popup" role="tooltip" hidden></div><span id="library-knot-label" class="library-knot-label" hidden></span>`;}
 function move(kind,id,stage){const p=find(kind,id);p.stage=stage;if(['deep-done','done'].includes(stage))p.readDate=d.clock.date;d.ui.libraryMenu=false;d.ui.libraryHover=null;a.update();}
 function action(key,id){if(!key.startsWith('library-'))return false;
 if(key==='library-open'||key==='library-pick'){const[kind,pid]=id.split('|');if(!find(kind,pid))return true;d.ui.librarySelected={kind,id:pid};if(view()==='shelf'&&(d.ui.libraryTab!=='fav'||!meta(kind,find(kind,pid)).fav))d.ui.libraryTab=kind;d.ui.librarySource=false;d.ui.libraryMenu=false;}
 else if(key==='library-close')d.ui.librarySelected=null;else if(key==='library-stage-menu')d.ui.libraryMenu=!d.ui.libraryMenu;else if(key==='library-stage'){const[k,p,s]=id.split('|');move(k,p,s);return true;}
 else if(key==='library-project-filter')d.ui.libraryFilter=d.ui.libraryFilter===id?null:id;else if(key==='library-clear-filter')d.ui.libraryFilter=null;else if(key==='library-source')d.ui.librarySource=!d.ui.librarySource;
 else if(key==='library-view'){d.ui.libraryView=id;d.ui.libraryMenu=false;if(id==='shelf'&&d.ui.librarySelected)d.ui.libraryTab=d.ui.librarySelected.kind;}
 else if(key==='library-tab'){d.ui.libraryTab=id;const k=id==='fav'?null:id;if(k&&d.ui.librarySelected?.kind!==k)d.ui.librarySelected=null;}
 else if(key==='library-sub')d.ui.librarySub=id;else if(key==='library-group'){const s=d.ui.libraryShut??={};s[id]=!s[id];}
 else if(key==='library-untag'){const sel=d.ui.librarySelected,m=meta(sel.kind,find(sel.kind,sel.id));m.keywords=m.keywords.filter(k=>k!==id);}
 else if(key==='library-pdf'){a.openPDF?.(d.ui.librarySelected?.id);return true;}else if(key==='library-knot')return true;
 a.update();if(key==='library-stage-menu')$('.library-stage-menu button')?.focus();if(key==='library-view')$(id==='shelf'?'.lib-back':'.lib-view-toggle')?.focus();return true;}
 function submit(f){const sel=d.ui.librarySelected;if(f.dataset.p2Form==='library-note'&&sel){meta(sel.kind,find(sel.kind,sel.id)).note=f.elements.note.value.trim();d.ui.librarySub='note';a.update();return true;}
 if(f.dataset.p2Form==='library-tag'&&sel){const v=f.elements.tag.value.trim(),m=meta(sel.kind,find(sel.kind,sel.id));if(v&&!m.keywords.includes(v))m.keywords.push(v);a.update();$('.lib-tag-form input')?.focus();return true;}return false;}
 // Search filters in place (no re-render, so the caret stays): unmatched tags and rows fade.
 function input(e){const el=e.target.closest('[data-library-query]');if(!el)return;d.ui.libraryQuery=el.value;for(const n of HOST.querySelectorAll('#library [data-p2-drag="paper"]')){const[k,id]=n.dataset.id.split('|');n.classList.toggle('is-unmatched',!matches(k,find(k,id)));}
 for(const n of HOST.querySelectorAll('#library .lib-row')){const[k,id]=n.querySelector('[data-p2]').dataset.id.split('|');n.classList.toggle('is-unmatched',!matches(k,find(k,id)));}}
 function hover(e,show){if(view()!=='sea')return;const paper=e.target.closest('[data-paper-hover]'),knot=e.target.closest('[data-knot-hover]');
 if(paper){const root=$('#library'),gloss=$('#library-gloss');if(!gloss)return;if(!show&&paper.contains(e.relatedTarget))return;d.ui.libraryHover=show?paper.dataset.paperHover:null;gloss.hidden=!show;if(show){const[k,id]=paper.dataset.paperHover.split('|');if(d.ui.librarySelected?.kind===k&&d.ui.librarySelected.id===id){gloss.hidden=true;d.ui.libraryHover=null;return;}
 const item=find(k,id),b=paper.getBoundingClientRect(),r=root.getBoundingClientRect(),gw=Math.min(240,root.clientWidth*.2),right=b.right-r.left+14;gloss.textContent=item.conclusion;gloss.style.width=gw+'px';gloss.style.left=(right+gw<root.clientWidth-8?right:b.left-r.left-gw-14)+'px';gloss.style.top=Math.max(8,Math.min(b.top-r.top-4,root.clientHeight-110))+'px';}a.drawScenery();}
 if(knot){const label=$('#library-knot-label');if(!label)return;label.hidden=!show;if(show){const[k,n]=knot.dataset.knotHover.split('|'),b=knot.getBoundingClientRect(),r=$('#library').getBoundingClientRect();label.textContent=stages[k][Number(n)][1];label.style.left=b.left-r.left+22+'px';label.style.top=b.top-r.top-4+'px';}}}
 // ——— Scenery ———
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z" fill="${c}"/>`;
 function rope(x,ya,yb){let s=`<path d="M${x-1.6},${ya}L${x-1.6},${yb}L${x+1.6},${yb}L${x+1.6},${ya}Z" fill="${P}"/>`+ink([[x-1.6,ya],[x-1.4,(ya+yb)/2],[x-1.6,yb]],.8)+ink([[x+1.6,ya],[x+1.8,(ya+yb)/2],[x+1.6,yb]],.8);let t='';for(let y=ya+3;y<yb-2;y+=5.5)t+=`M${x-1.4},${(y+1.6).toFixed(1)}L${x+1.4},${(y-1.2).toFixed(1)}`;return s+`<path d="${t}" stroke="${M}" stroke-width=".55" fill="none"/>`;}
 function fish(x,y,k=1,flip=1){const b=Array.from({length:13},(_,i)=>{const t=i/12*Math.PI*2;return[x+Math.cos(t)*6*k*flip,y+Math.sin(t)*2.2*k];});return a.curve(b,.7,M)+ink([[x-6*k*flip,y],[x-10*k*flip,y-2.6*k],[x-9.5*k*flip,y+2.6*k],[x-6*k*flip,y]],.7,M)+circle(x+3.4*k*flip,y-.4*k,.5,.5,M);}
 function school(x,y,n=5,flip=1){let s='';for(let i=0;i<n;i++)s+=fish(x+(i%3)*14*flip+((i*7)%5),y+Math.floor(i/3)*9+(i%2)*3,.85+(i%3)*.1,flip);return s;}
 function coral(x,y,k=1){let s='';const br=(x0,y0,ang,len,dep)=>{const x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len;s+=a.curve([[x0,y0],[(x0+x1)/2+Math.sin(ang)*2,(y0+y1)/2],[x1,y1]],Math.max(.5,dep*.35),dep>1?I:M);if(dep>0){br(x1,y1,ang-.45,len*.7,dep-1);br(x1,y1,ang+.4,len*.66,dep-1);}};br(x,y,-Math.PI/2,16*k,3);return s;}
 function weed(x,y,hh,k=1){let s='';for(let j=0;j<3;j++){const p=[];for(let i=0;i<=8;i++){const t=i/8;p.push([x+j*4*k+Math.sin(t*5+j)*3*k,y-t*hh*(1-j*.18)]);}s+=a.curve(p,.7,j?M:I);}return s;}
 function rock(x,y,wd,ht){const p=[[x,y],[x+wd*.08,y-ht*.6],[x+wd*.3,y-ht],[x+wd*.62,y-ht*.86],[x+wd*.9,y-ht*.45],[x+wd,y]];let s=F([...p])+a.curve(p,1);for(let i=0;i<4;i++){const hx=x+wd*(.55+i*.1);s+=ink([[hx,y-2],[hx-4,y-ht*.5]],.45,M);}return s;}
 function shell(x,y){let s=a.curve(Array.from({length:13},(_,i)=>{const t=Math.PI+i/12*Math.PI;return[x+Math.cos(t)*7,y+Math.sin(t)*6];}),.8);for(let i=1;i<5;i++){const t=Math.PI+i/5*Math.PI;s+=ink([[x,y],[x+Math.cos(t)*6.5,y+Math.sin(t)*5.5]],.45,M);}return s+ink([[x-7,y],[x+7,y]],.8);}
 function anchor(x,y,k=1){return circle(x,y-40*k,4*k,1.1)+ink([[x,y-36*k],[x+2*k,y]],1.5)+ink([[x-10*k,y-28*k],[x+11*k,y-27*k]],1.3)+a.curve([[x-20*k,y-12*k],[x-12*k,y-2*k],[x+2*k,y+1],[x+16*k,y-4*k],[x+22*k,y-14*k]],1.5)+ink([[x-20*k,y-12*k],[x-24*k,y-8*k]],1.2)+ink([[x+22*k,y-14*k],[x+26*k,y-10*k]],1.2);}
 function seabed(w,h,from=0,to=w,dense=1){const y=h-16;let s=a.curve(Array.from({length:31},(_,i)=>{const x=from+(to-from)*i/30;return[x,y+Math.sin(i*.9)*2.2];}),1.1,M);for(let i=0;i<14*dense;i++){const x=from+(to-from)*((i*.618)%1);s+=a.curve([[x,y+6],[x+10,y+5.4],[x+22,y+6]],.45,T);}return s;}
 function seaScenery(w,h){const L=d.cache.librarySea||seaLayout(w,h);let s='<g data-library-sea>';
 // Hull above both ropes: keel line, planks, the ropes' rings.
 const hx0=L.litX-90,hx1=L.bookX+120,hull=[[hx0,-2],[hx1,-2],[hx1-30,20],[(hx0+hx1)/2,30],[hx0+30,20]];s+=`<g data-morph="keel">${F(hull)}${a.curve([[hx0,-2],[hx0+30,20],[(hx0+hx1)/2,30],[hx1-30,20],[hx1,-2]],1.5)}${a.curve([[hx0+14,6],[(hx0+hx1)/2,16],[hx1-14,6]],.6,M)}${a.curve([[hx0+24,13],[(hx0+hx1)/2,23],[hx1-24,13]],.5,T)}</g>`;
 s+=a.curve(Array.from({length:25},(_,i)=>[i*w/24,38+Math.sin(i*1.3)*1.4]),.8,T);
 for(const[x,kind]of [[L.litX,'literature'],[L.bookX,'book']]){const top=kind==='literature'?22:28,bottom=kind==='literature'?L.y1+44:L.y1+20;s+=`<g data-morph="${kind==='literature'?'sounding-rope':'book-rope'}">${circle(x,top,3.6,1.1)}${rope(x,top+3,bottom)}`;
 for(const v of L.levels.filter(v=>v.kind===kind)){const cs=L.cards.filter(c=>c.kind===kind&&c.ky===v.y),end=cs.length?Math.max(...cs.map(c=>c.x+c.w-14)):x+40;s+=ink([[x+5,v.y],[end,v.y+1.5]],.8)+circle(x,v.y,6.5,1.3)+circle(x,v.y,2.4,.8);
 // A tag in a lower row hangs from the tag above it, so strings never run behind another tag.
 for(const c of cs){const up=cs.find(o=>o.col===c.col&&o.row===c.row-1),y0=up?up.y+up.h:v.y+1;for(const sx of up?[Math.max(c.x,up.x)+18,Math.min(c.x+c.w,up.x+up.w)-18]:[c.x+16,c.x+c.w-16])s+=ink([[sx,y0],[sx,c.y]],.6,M)+(up?'':circle(sx,v.y+1,1.3,.6));}}
 s+=kind==='literature'?`</g><g data-morph="sounding-weight">${F([[x-8,bottom],[x+8,bottom],[x+11,bottom+20],[x,bottom+28],[x-11,bottom+20]])}${ink([[x-8,bottom],[x+8,bottom],[x+11,bottom+20],[x,bottom+28],[x-11,bottom+20],[x-8,bottom]],1.4)}</g>`:`${ink([[x-6,bottom],[x+6,bottom],[x,bottom+12],[x-6,bottom]],1.2)}</g>`;}
 // Life in the free water: two schools, a whale far off when the right side is open, bubbles up the rope.
 const g=L.levels.filter(v=>v.kind==='literature');s+=`<g data-library-life>${school(L.litX-108,g[1].y+g[1].step*.55,5)}${school(L.bookX-104,g[2].y+g[2].step*.6,4,-1)}`;
 if(!L.detail){const wx=w*.86,wy=h*.52;s+=a.curve([[wx-80,wy],[wx-50,wy-24],[wx+10,wy-26],[wx+56,wy-8],[wx+80,wy+4],[wx+96,wy-10],[wx+102,wy+2],[wx+92,wy+10],[wx+70,wy+12],[wx+20,wy+22],[wx-40,wy+18],[wx-80,wy]],.8,T)+a.curve([[wx-50,wy+6],[wx-20,wy+12],[wx+20,wy+10]],.5,T)+circle(wx-58,wy-6,1.2,.6,T)+school(w*.8,h*.28,6);}
 for(let i=0;i<5;i++)s+=circle(L.bookX+8+(i%2)*4,L.y0+40+i*22,1.4+(i%3)*.6,.6,T);s+='</g>';
 s+=`<g data-library-seabed>${seabed(w,h,0,w)}${rock(14,h-16,70,24)}${coral(96,h-17,1.1)}${weed(130,h-16,46)}${shell(L.litX+250,h-14)}${coral(L.bookX-60,h-17,.9)}${rock(L.bookX+20,h-16,54,18)}${weed(L.bookX+90,h-16,38,.9)}${coral(w*.66,h-17,1)}${rock(w*.72,h-16,80,26)}${weed(w*.82,h-16,52)}${coral(w*.9,h-17,1.2)}${shell(w*.95,h-13)}</g>`;
 return s+'</g>';}
 function shelfScenery(w,h){const y=h-16;let s='<g data-library-shelf-bed>'+seabed(w,h,0,w,2);s+=coral(30,y,1.3)+weed(62,y,58)+rock(84,y,90,30)+coral(186,y,1)+school(260,y-56,5)+shell(330,y+2)+weed(w*.36,y,46,.9)+coral(w*.42,y,1.1)+school(w*.5,y-70,4,-1)+rock(w*.56,y,70,22)+weed(w*.63,y,62)+coral(w*.7,y,1.2)+anchor(w*.83,y+2,1)+weed(w*.88,y,56)+coral(w*.93,y,1.3)+rock(w*.96,y,60,22);return s+'</g>';}
 function scenery(box){const w=box.width,h=Math.min(box.height,HOST.bottom-box.top);const root=$('#library');if(root&&d.cache.libraryRendered!==view()+root.clientWidth+'x'+root.clientHeight)render();return view()==='shelf'?shelfScenery(w,h):seaScenery(w,h);}
 return{render,action,scenery,submit,input,drop(drag,target){if(drag.kind!=='paper'||!target.startsWith('paper:'))return false;const[kind,id]=drag.id.split('|'),[,dropKind,stage]=target.split(':');if(kind!==dropKind)return true;move(kind,id,stage);return true;},pointerover:e=>hover(e,true),pointerout:e=>hover(e,false),focusin:e=>hover(e,true),focusout:e=>hover(e,false),
 context(e){const paper=e.target.closest('[data-p2-drag="paper"]');if(!paper)return false;const[kind,id]=paper.dataset.id.split('|');d.ui.librarySelected={kind,id};d.ui.libraryMenu=true;a.update();$('.library-stage-menu button')?.focus();return true;},
 key(e){if(d.ui.page!=='library')return false;const paper=e.target.closest('[data-paper-hover]');if(paper&&(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)){e.preventDefault();const[kind,id]=paper.dataset.paperHover.split('|');d.ui.librarySelected={kind,id};d.ui.libraryMenu=true;a.update();$('.library-stage-menu button')?.focus();return true;}return false;},
 help:[[300,90,'绳结是阅读深度，旁边写着深度范围',30,-40],[560,330,'纸签上下拖到别的绳结即可改阶段',0,-110],[960,140,'右上角进入知识库视图',40,-60]]};
}
