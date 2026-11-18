import {HOST} from '../../host.ts';
import {sh} from '../scene.ts';
import type {Parts} from '../scene.ts';
import {h,setNodes} from '../dom.ts';
import type {Child} from '../dom.ts';
import {iconEl} from '../ink.ts';
import type {Point} from '../ink.ts';
import {buttonEl as B} from './paper-tasks.ts';
import type {ProtoApi} from './paper-tasks.ts';
import {svgP,glyphEl} from './p2-nodes.ts';
import type {LibraryMeta,Model,ModelLibraryItem} from '../../data/types.ts';
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
// 第 4a 期：转 TypeScript，整页改成节点构建（setNodes 整页换掉 #library，仍是每次重画整页）。标题、作者、年份、类型、结论、摘要、要点、标注、
// 关键词、笔记、项目名、搜索词一律是文本节点或属性值（原来年份、类型、要点标题没有转义）。模板里的换行与一格缩进照原样建成空白文本节点（W），
// <textarea> 的初值照 HTML 解析器的规矩去掉开头的一个换行。搜索框只改 class、不重画（光标不动）的做法不变。

/** 本页用到的 api（phase2.js 的 api） */
export interface LibraryApi extends ProtoApi {
 drawScenery: () => void;
 openPDF?: (id: string|undefined) => void;
}
type Kind='literature'|'book';
type Tab=Kind|'fav';
interface Sel {kind: string; id: string}
interface LibraryUI {libraryView?: string; libraryQuery?: string; libraryTab?: Tab; libraryShut?: Record<string,boolean>; librarySub?: string; librarySource?: boolean}
interface Level {kind: Kind; stage: string; label: string; depth: string; x: number; y: number; step: number; area: number[]}
interface Card {kind: Kind; item: ModelLibraryItem; col?: number; row?: number; x: number; y: number; w: number; h: number; ky?: number; rx?: number; rot?: number}
interface SeaLayout {w: number; h: number; litX: number; bookX: number; y0: number; y1: number; ch: number; cards: Card[]; levels: Level[]; detail: boolean; drift: Card[]}
interface LibraryCache {librarySea?: SeaLayout; libraryRendered?: string}
const W='\n ';
const tgt=(e: Event)=>e.target as HTMLElement;
export function libraryPage(a: LibraryApi){
 const {d,$,fmt}=a,P=a.PAPER,M=a.SECONDARY,T=a.TICK,I=a.INK,cache=d.cache as LibraryCache;
 // d.ui 上本页的几项（librarySelected、libraryFilter 在 UIState 里的类型较宽，这里按实际用法读写）
 const ui=d.ui as Omit<Model['ui'],'librarySelected'|'libraryFilter'>&LibraryUI&{librarySelected: Sel|null; libraryFilter: string|null};
 const G=(type: string)=>glyphEl(a,type);
 const stages: Record<Kind,[string,string,string][]>={literature:[['inbox','待泛读','0 – 200 m'],['skimmed','已泛读','200 – 1,000 m'],['to-deep','待精读','1,000 – 3,000 m'],['deep-done','已精读','3,000 m +']],book:[['want','想读','0 – 500 m'],['reading','在读','500 – 2,000 m'],['done','读完','2,000 m +']]};
 const records=(kind: string)=>kind==='book'?d.books:d.literature,find=(kind: string,id: string)=>records(kind).find(x=>x.id===id),stageOf=(kind: Kind,s: string)=>stages[kind].find(x=>x[0]===s)||['dropped','放弃','沉底'];
 const KW: Record<string,string[]>={'lit-01':['研究设计','假设','方法'],'lit-02':['配准','建筑轮廓','误差'],'lit-03':['边界误差','评价','分布'],'lit-04':['制图','图表','写作'],'lit-05':['样本','覆盖偏差'],'lit-06':['定性研究','可追溯'],'lit-07':['写作','不确定性'],'lit-08':['遥感','尺度'],'lit-09':['复现','实验'],'lit-10':['空间样本','外推'],'lit-11':['分割','瓦片'],'lit-12':['边界模型'],'book-01':['研究方法','问题'],'book-02':['写作','读者'],'book-03':['统计','不确定性'],'book-04':['专注','时间'],'book-05':['城市','观察']};
 const AUTH=['林岚 等','周屿 等','陈芮','许衡 等','苏禾','叶舟 等','沈砚','韩溪 等','顾川','程鸥 等','宋岩','方澄'],TYPE=['期刊论文','会议论文','预印本','学位论文'],PROG: Record<string,number>={inbox:0,skimmed:30,'to-deep':45,'deep-done':100,dropped:10,want:0,reading:60,done:100};
 function meta(kind: string,item: ModelLibraryItem): LibraryMeta{const all=d.libraryMeta??={},key=kind+'|'+item.id;if(all[key])return all[key];const i=records(kind).indexOf(item),proj=item.projectIds[0]&&a.project(item.projectIds[0]);
 return all[key]={authors:AUTH[(i*5+(kind==='book'?3:0))%AUTH.length],year:2018+(i*3+(kind==='book'?1:0))%8,type:kind==='book'?'专著':TYPE[i%4],added:`2026-10-${String(Math.max(2,28-i*2-(kind==='book'?5:0))).padStart(2,'0')}`,keywords:[...(KW[item.id]||[])],fav:['lit-01','lit-03','book-02'].includes(item.id),
 progress:PROG[item.stage]??0,started:`2026-10-${String(Math.max(1,20-i)).padStart(2,'0')}`,note:'',
 abstract:`本${kind==='book'?'书':'文'}围绕「${item.title}」展开。${item.conclusion}作者用几组对照案例说明这一点，并给出一套可以直接套用的检查步骤。`,
 points:[['核心观点',item.conclusion],['适用范围',proj?`与「${proj.title}」相关的判断与写作。`:'当前研究中需要说明依据的部分。'],['可借用的做法','读完后整理成一页检查清单，放进对应项目。']],
 marks:[`“${item.conclusion}”`,'第 3 节的对照表值得复用。']};}
 const pct=(kind: string,item: ModelLibraryItem)=>{const p=PROG[item.stage]??0;return p===100?100:Math.max(meta(kind,item).progress,p);};
 const ring=(v: number,r=8,n=1.3)=>{const c=r+2,p: Point[]=[];for(let i=0;i<=40;i++){const t=-Math.PI/2+i/40*Math.PI*2*Math.max(.001,v/100);p.push([c+Math.cos(t)*r,c+Math.sin(t)*r]);}return svgP([a.circleV(c,c,r,.7,T),v>0?a.inkV(p,n):null],c*2);};
 const view=()=>ui.libraryView==='shelf'?'shelf':'sea',q=()=>(ui.libraryQuery||'').trim();
 const matches=(kind: string,item: ModelLibraryItem)=>{const s=q();if(!s)return true;const m=meta(kind,item);return [item.title,item.conclusion,m.authors,...m.keywords].some(x=>x.includes(s));};
 const proj=(id: string)=>a.project(id)!;
 // 原来拼进模板的 ${值}：null / undefined 也写成文字（与模板字符串一样）
 const str=(v: unknown)=>`${v as string}`;
 // ——— Deep sea layout: one set of numbers for the HTML tags and the inked ropes, strings and knots. ———
 function seaLayout(w: number,h: number): SeaLayout{const detail=!!ui.librarySelected,litX=Math.max(140,Math.round(w*.13)),bookX=Math.round(w*.54),y0=96,y1=h-104,small=h<700,ch=small?38:42,gap=small?8:12;
 const litArea=[litX+26,bookX-128],bookArea=[bookX+26,detail?Math.round(w*.705)-18:Math.round(w*.74)];const out: SeaLayout={w,h,litX,bookX,y0,y1,ch,cards:[],levels:[],detail,drift:[]};
 for(const[kind,x,area]of [['literature',litX,litArea],['book',bookX,bookArea]] as [Kind,number,number[]][]){const n=stages[kind].length,step=(y1-y0)/n,span=area[1]-area[0],cols=span>=290?2:1,cw=Math.min(212,Math.floor((span-(cols-1)*14)/cols));
 const groups=stages[kind].map(([s])=>records(kind).filter(l=>l.stage===s)),need=groups.map(g=>18+Math.ceil(g.length/cols)*(ch+gap)+6),extra=Math.max(0,(y1-y0)-need.reduce((a,b)=>a+b,0)),steps=need.every(v=>v<=step)?need.map(()=>step):need.map(v=>v+extra/n);let yy=y0;stages[kind].forEach(([stage,label,depth],level)=>{const y=Math.round(yy),step=steps[level],items=groups[level];yy+=step;out.levels.push({kind,stage,label,depth,x,y,step,area});
 items.forEach((item,k)=>{const col=k%cols,row=Math.floor(k/cols);out.cards.push({kind,item,col,row,x:area[0]+col*(cw+14)+(row%2&&cols>1?10:0),y:y+18+row*(ch+gap),w:cw,h:ch,ky:y,rx:x});});});}
 d.literature.filter(l=>l.stage==='dropped').forEach((item,i)=>out.drift.push({kind:'literature',item,x:litX+30+i*174,y:h-74,w:150,h:34,rot:i%2?4:-5}));return out;}
 function tag(c: Card,cls=''){const{kind,item}=c,active=!ui.libraryFilter||item.projectIds.includes(ui.libraryFilter),sel=ui.librarySelected?.id===item.id,linked=item.projectIds.length,done=['deep-done','done'].includes(item.stage);
 return h('div',{class:`library-sign lib-tag hand-panel ${cls} ${linked?'':'unlinked'} ${active?'':'unrelated'} ${matches(kind,item)?'':'is-unmatched'} ${sel?'is-selected':''}`,draggable:'true','data-p2-drag':'paper','data-id':`${kind}|${item.id}`,style:`left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px${c.rot?`;transform:rotate(${c.rot}deg)`:''}`},
  B('library-open',kind+'|'+item.id,[h('span',null,item.title),done&&item.readDate?h('time',{class:'mono'},fmt(item.readDate)):null],'打开 '+item.title,{class:'paper-title','data-paper-hover':`${kind}|${item.id}`,'aria-describedby':'library-gloss'}),
  linked?B('library-project-filter',item.projectIds[0],G('anchor'),'筛选项目 '+proj(item.projectIds[0]).title,{class:'paper-project-mark'}):null);}
 const search=(placeholder: string)=>h('label',{class:'lib-search hand-pill'},iconEl('search'),h('input',{type:'search','data-library-query':true,placeholder,value:ui.libraryQuery||'','aria-label':'搜索知识库'}));
 function toolbar(){const f=ui.libraryFilter;return h('div',{class:'lib-toolbar'},search('搜索文献、笔记、关键词…'),f?B('library-clear-filter','',[h('span',null,`项目：${proj(f).title}`),h('i',{'aria-hidden':'true'},'×')],'清除项目筛选',{class:'library-filter lib-chip hand-pill is-on'}):null,B('library-view','shelf',[G('bookmark'),h('span',null,'知识库')],'打开我的知识库',{class:'lib-view-toggle hand-pill'}));}
 const preview=(item: ModelLibraryItem)=>h('pre',{class:'markdown-preview'},`---\ntitle: ${item.title}\n---\n\nstage:: ${item.stage}\n\n${item.conclusion}`);
 const chips=(m: LibraryMeta)=>m.keywords.map(k=>h('span',{class:'lib-chip hand-pill'},k));
 function detail(kind: Kind,item: ModelLibraryItem){const m=meta(kind,item),[,label,depth]=stageOf(kind,item.stage);
 return h('aside',{class:'library-detail lib-card hand-panel'},h('div',{class:'library-detail-actions'},B('library-stage-menu','',iconEl('lead'),'更改阅读阶段'),B('library-source','',G('corner'),'展开笔记 Markdown'),B('library-close','',svgP([a.inkV([[4,4],[16,16]],1.3),a.inkV([[16,4],[4,16]],1.3)]),'折回纸签')),W,
 h('div',{class:'lib-kind'},iconEl('note'),h('span',null,kind==='book'?'读书笔记':'文献')),h('h3',null,item.title),h('p',{class:'lib-meta'},`${m.authors} · ${str(m.year)} · ${m.type}`),W,
 h('h4',null,'一句话结论'),h('p',{class:'lib-conclusion'},item.conclusion),W,
 h('dl',{class:'lib-facts'},h('div',null,h('dt',null,G('anchor'),h('span',null,'关联项目')),h('dd',null,item.projectIds.length?item.projectIds.map(id=>B('open-object',id,proj(id).title,'打开项目 '+proj(id).title,{'data-kind':'project',class:'lib-chip hand-pill'})):h('span',{class:'lib-none'},'未关联'))),W,
  h('div',null,h('dt',null,svgP([a.inkV([[3,6],[17,6]],1),a.inkV([[3,10],[17,10]],1),a.inkV([[3,14],[11,14]],1)]),h('span',null,'所在深度')),h('dd',null,label,h('span',{class:'mono'},`（${depth}）`))),W,
  h('div',null,h('dt',null,svgP([a.circleV(10,10,6.5,1.1),a.inkV([[10,10],[10,5]],1.1),a.inkV([[10,10],[13.5,12]],1.1)]),h('span',null,'阅读进度')),h('dd',{class:'lib-prog'},ring(pct(kind,item),7,1.6),h('span',{class:'mono'},`${pct(kind,item)}%`))),h('div',null,h('dt',null,iconEl('box'),h('span',null,'收录日期')),h('dd',{class:'mono'},m.added.replaceAll('-','.'))),item.readDate?h('div',null,h('dt',null,iconEl('check'),h('span',null,'读完')),h('dd',null,fmt(item.readDate))):null,W,
  h('div',null,h('dt',null,G('bookmark'),h('span',null,'关键词')),h('dd',{class:'lib-tags'},chips(m)))),W,
 ui.libraryMenu?h('div',{class:'library-stage-menu hand-popup',role:'group','aria-label':'阅读阶段'},stages[kind].map(([key,lab],i)=>B('library-stage',kind+'|'+item.id+'|'+key,[svgP([a.inkV([[3,3],[3,20]],1.2),a.circleV(3,3+i*5,2.4,1.2)],24,24),h('span',null,lab)],lab,{'aria-pressed':String(key===item.stage)})),kind==='literature'?B('library-stage',kind+'|'+item.id+'|dropped',[G('right'),h('span',null,'放弃')],'放弃'):null):null,W,
 ui.librarySource?preview(item):null,W,
 B('library-view','shelf',[iconEl('book'),h('span',null,h('b',null,'打开我的知识库'),h('small',null,'查看详尽笔记内容、想法与批注')),G('right')],'打开我的知识库',{class:'lib-open-shelf hand-panel'}));}
 function seaPage(w: number,h0: number): Child[]{const L=seaLayout(w,h0);cache.librarySea=L;const sea: Child[]=[];
 sea.push(h('div',{class:'lib-head lib-head-lit',style:`left:${L.litX+24}px`},iconEl('book'),h('span',null,'文献')),h('div',{class:'lib-head lib-head-book',style:`left:${L.bookX+24}px`},iconEl('note'),h('span',null,'读书笔记')));
 for(const v of L.levels){const zoneW=v.area[1]-v.x+24,idx=stages[v.kind].findIndex(s=>s[0]===v.stage);sea.push(h('div',{class:'library-depth-zone p2-background-hit','data-p2-drop':`paper:${v.kind}:${v.stage}`,style:`left:${v.x-12}px;top:${v.y-12}px;width:${zoneW}px;height:${Math.round(v.step)}px`,'aria-label':v.label}));
 sea.push(h('div',{class:'lib-depth',style:`left:${v.x-18}px;top:${v.y-10}px`},h('b',null,v.label),h('span',{class:'mono'},v.depth)),B('library-knot',v.kind+'|'+idx,svgP(a.circleV(9,9,5,1.3),18),v.label,{class:'library-knot','data-knot-hover':`${v.kind}|${idx}`,style:`left:${v.x-9}px;top:${v.y-9}px`}));}
 sea.push(L.cards.map(c=>tag(c)),L.drift.map(c=>tag(c,'drifted')));
 if(L.drift.length)sea.push(h('span',{class:'lib-drift-note',style:`left:${L.drift.at(-1)!.x+L.drift.at(-1)!.w+16}px;top:${h0-62}px`},'沉底 · 已放弃'));
 const sel=ui.librarySelected,item=sel&&find(sel.kind,sel.id);return [h('div',{class:'lib-sea'},sea),toolbar(),item?detail(sel.kind as Kind,item):null];}
 // ——— Knowledge base: list, record, side panels. ———
 function listRow(kind: string,item: ModelLibraryItem){const m=meta(kind,item),sel=ui.librarySelected?.kind===kind&&ui.librarySelected.id===item.id,v=pct(kind,item);
 return h('li',{class:`lib-row ${sel?'is-selected':''} ${matches(kind,item)?'':'is-unmatched'}`},B('library-pick',kind+'|'+item.id,[h('span',{class:'lib-row-ring'},ring(v)),h('span',{class:'lib-row-main'},h('b',null,item.title),h('small',null,`${m.authors} · ${str(m.year)}`,h('i',null,m.type))),h('span',{class:'lib-row-end mono'},v>0&&v<100?v+'%':v===100?(item.readDate?fmt(item.readDate):'读完'):fmt(m.added))],item.title));}
 function listPane(){const tab=ui.libraryTab||'literature',groups: [string,[string,ModelLibraryItem][]][]=tab==='fav'?[['收藏',[...d.literature.map((x): [string,ModelLibraryItem]=>['literature',x]),...d.books.map((x): [string,ModelLibraryItem]=>['book',x])].filter(([k,x])=>meta(k,x).fav)]]:[...stages[tab].map(([s,l]): [string,[string,ModelLibraryItem][]]=>[l,records(tab).filter(x=>x.stage===s).map((x): [string,ModelLibraryItem]=>[tab,x])]),...(tab==='literature'?[['放弃',d.literature.filter(x=>x.stage==='dropped').map((x): [string,ModelLibraryItem]=>['literature',x])]] as [string,[string,ModelLibraryItem][]][]:[])];
 const shut=ui.libraryShut??={'放弃':true};
 return h('section',{class:'lib-list'},h('div',{class:'lib-tabs',role:'tablist'},([['literature','文献'],['book','读书笔记'],['fav','收藏']] as [string,string][]).map(([k,l])=>B('library-tab',k,l,l,{role:'tab','aria-selected':String(tab===k)}))),W,
 search('搜索标题、作者、关键词…'),W,
 h('div',{class:'lib-groups'},groups.map(([label,items])=>h('div',{class:`lib-group ${shut[label]?'is-shut':''}`},B('library-group',label,[svgP(a.inkV(shut[label]?[[7,4],[13,10],[7,16]]:[[4,7],[10,13],[16,7]],1.3)),h('b',null,label),h('span',{class:'mono'},`${items.length}`)],label),h('ul',null,items.map(([k,x])=>listRow(k,x)))))));}
 const relatedLi=(list: [string,ModelLibraryItem][])=>list.map(([k,x])=>h('li',null,B('library-pick',k+'|'+x.id,[iconEl('note'),h('span',null,x.title),h('small',null,`${meta(k,x).authors} · ${str(meta(k,x).year)}`)],x.title)));
 function recordPane(kind: string,item: ModelLibraryItem){const m=meta(kind,item),sub=ui.librarySub||'abstract';
 const icons: Child[]=[iconEl('note'),G('goal'),iconEl('route')];
 const body: Child=sub==='abstract'?[h('h4',null,'摘要'),h('p',{class:'lib-abstract'},m.abstract),h('h4',null,'关键信息'),h('ul',{class:'lib-points'},m.points.map(([k,v],i)=>h('li',null,i<icons.length?icons[i]:'undefined',h('span',null,h('b',null,k),v))))]
 :sub==='marks'?[h('h4',null,'标注'),h('ul',{class:'lib-marks'},m.marks.map(x=>h('li',null,x)))]
 :sub==='related'?[h('h4',null,'相关'),h('ul',{class:'lib-related'},related(kind,item).length?relatedLi(related(kind,item)):h('li',{class:'lib-none'},'暂无'))]
 :[h('h4',null,'笔记'),h('p',{class:'lib-abstract'},m.note?m.note:h('span',{class:'lib-none'},'还没有笔记。'))];
 return h('section',{class:'lib-record hand-panel'},h('header',null,h('div',null,h('h3',null,item.title),h('p',{class:'lib-meta'},`${m.authors} · ${str(m.year)} · ${m.type}`)),h('div',{class:'lib-record-actions'},B('library-source','',G('corner'),'展开笔记 Markdown'),B('library-pdf','',[iconEl('book'),h('span',null,'打开 PDF')],'打开 PDF',{class:'lib-pdf'}))),W,
 h('div',{class:'lib-tags'},chips(m)),W,
 h('div',{class:'lib-subtabs',role:'tablist'},[['abstract','摘要'],['note','笔记'],['marks',`标注 (${m.marks.length})`],['related',`相关 (${related(kind,item).length})`]].map(([k,l])=>B('library-sub',k,l,l,{role:'tab','aria-selected':String(sub===k)}))),W,
 h('div',{class:'lib-record-body'},body,ui.librarySource?preview(item):null),W,
 h('form',{class:'lib-note','data-p2-form':'library-note'},h('h4',null,'我的笔记'),h('textarea',{name:'note',rows:'3',placeholder:'写下你的想法、疑问或与自己研究的关联…','aria-label':'我的笔记'},m.note.startsWith('\n')?m.note.slice(1):m.note),h('div',{class:'lib-note-bar'},h('span',null,['B','I','≡','↗'].map(x=>h('i',null,x))),h('button',{type:'submit',class:'text-button'},'保存'))));}
 function related(kind: string,item: ModelLibraryItem){const out: [string,ModelLibraryItem][]=[];for(const k of ['literature','book'])for(const x of records(k))if(x!==item&&x.stage!=='dropped'&&x.projectIds.some(id=>item.projectIds.includes(id)))out.push([k,x]);return out.slice(0,4);}
 function sidePane(kind: string,item: ModelLibraryItem){const m=meta(kind,item),v=pct(kind,item),eta=v>=100?'已读完':v>0?'—':'未开始';
 return h('section',{class:'lib-side'},h('div',{class:'lib-mini hand-panel'},h('h4',null,'阅读进度'),h('div',{class:'lib-progress'},h('span',{class:'lib-big-ring'},ring(v,26,2.2),h('b',{class:'mono'},`${v}%`)),h('dl',null,h('div',null,h('dt',null,'收录'),h('dd',null,fmt(m.added))),h('div',null,h('dt',null,'开始阅读'),h('dd',null,v>0?fmt(m.started):'—')),h('div',null,h('dt',null,v>=100?'读完':'预计完成'),h('dd',null,item.readDate?fmt(item.readDate):eta))))),W,
 h('div',{class:'lib-mini hand-panel'},h('h4',null,'我的标签'),h('div',{class:'lib-tags'},m.keywords.map(k=>h('span',{class:'lib-chip'},k,B('library-untag',k,'×','移除标签 '+k))),h('form',{class:'lib-tag-form','data-p2-form':'library-tag'},h('input',{name:'tag',placeholder:'+ 添加标签','aria-label':'添加标签'})))),W,
 h('div',{class:'lib-mini hand-panel'},h('h4',null,'相关内容'),h('ul',{class:'lib-related'},related(kind,item).slice(0,3).length?relatedLi(related(kind,item).slice(0,3)):h('li',{class:'lib-none'},'暂无同项目的记录'))),W,
 h('div',{class:'lib-mini hand-panel'},h('h4',null,'关联项目'),item.projectIds.length?item.projectIds.map(id=>B('open-object',id,[G('anchor'),h('span',null,proj(id).title),G('right')],'打开项目 '+proj(id).title,{'data-kind':'project',class:'lib-project-link'})):h('p',{class:'lib-none'},'未关联项目')));}
 function shelfPage(){
 const tab=ui.libraryTab||'literature';
 const items: [string,ModelLibraryItem][]=tab==='fav'
  ? [...d.literature.map((item): [string,ModelLibraryItem]=>['literature',item]),...d.books.map((item): [string,ModelLibraryItem]=>['book',item])].filter(([kind,item])=>meta(kind,item).fav)
  : records(tab).map((item): [string,ModelLibraryItem]=>[tab,item]);
 const selected=ui.librarySelected;
 const entry=items.find(([kind,item])=>kind===selected?.kind&&item.id===selected.id)||items.find(([,item])=>item.stage!=='dropped')||items[0];
 const [kind,item]=entry||[];
 const empty={literature:'还没有文献',book:'还没有读书笔记',fav:'还没有收藏'}[tab];
 ui.librarySelected=item?{kind,id:item.id}:null;
 return h('div',{class:'lib-shelf'},B('library-view','sea',[G('left'),h('span',null,'回到深海')],'回到深海视图',{class:'lib-back'}),listPane(),item?[recordPane(kind,item),sidePane(kind,item)]:h('section',{class:'lib-record hand-panel'},h('p',{class:'lib-none'},empty)));}
 function render(){const root=$('#library')!,w=root.clientWidth,h0=root.clientHeight,mode=view();root.dataset.libraryView=mode;root.classList.toggle('has-library-detail',mode==='sea'&&!!ui.librarySelected);cache.libraryRendered=mode+w+'x'+h0;
 setNodes(root,()=>[mode==='shelf'?shelfPage():seaPage(w,h0),h('div',{id:'library-gloss',class:'library-gloss hand-popup',role:'tooltip',hidden:true}),h('span',{id:'library-knot-label',class:'library-knot-label',hidden:true})]);}
 function move(kind: string,id: string,stage: string){const p=find(kind,id)!;p.stage=stage;if(['deep-done','done'].includes(stage))p.readDate=d.clock.date;ui.libraryMenu=false;ui.libraryHover=null;a.update();}
 function action(key: string,id: string){if(!key.startsWith('library-'))return false;
 if(key==='library-open'||key==='library-pick'){const[kind,pid]=id.split('|');if(!find(kind,pid))return true;ui.librarySelected={kind,id:pid};if(view()==='shelf'&&(ui.libraryTab!=='fav'||!meta(kind,find(kind,pid)!).fav))ui.libraryTab=kind as Tab;ui.librarySource=false;ui.libraryMenu=false;}
 else if(key==='library-close')ui.librarySelected=null;else if(key==='library-stage-menu')ui.libraryMenu=!ui.libraryMenu;else if(key==='library-stage'){const[k,p,s]=id.split('|');move(k,p,s);return true;}
 else if(key==='library-project-filter')ui.libraryFilter=ui.libraryFilter===id?null:id;else if(key==='library-clear-filter')ui.libraryFilter=null;else if(key==='library-source')ui.librarySource=!ui.librarySource;
 else if(key==='library-view'){ui.libraryView=id;ui.libraryMenu=false;if(id==='shelf'&&ui.librarySelected)ui.libraryTab=ui.librarySelected.kind as Tab;}
 else if(key==='library-tab'){ui.libraryTab=id as Tab;const k=id==='fav'?null:id;if(k&&ui.librarySelected?.kind!==k)ui.librarySelected=null;}
 else if(key==='library-sub')ui.librarySub=id;else if(key==='library-group'){const s=ui.libraryShut??={};s[id]=!s[id];}
 else if(key==='library-untag'){const sel=ui.librarySelected!,m=meta(sel.kind,find(sel.kind,sel.id)!);m.keywords=m.keywords.filter(k=>k!==id);}
 else if(key==='library-pdf'){a.openPDF?.(ui.librarySelected?.id);return true;}else if(key==='library-knot')return true;
 a.update();if(key==='library-stage-menu')($('.library-stage-menu button'))?.focus();if(key==='library-view')($(id==='shelf'?'.lib-back':'.lib-view-toggle'))?.focus();return true;}
 function submit(f: HTMLFormElement){const sel=ui.librarySelected,field=(n: string)=>(f.elements.namedItem(n) as HTMLInputElement).value;if(f.dataset.p2Form==='library-note'&&sel){meta(sel.kind,find(sel.kind,sel.id)!).note=field('note').trim();ui.librarySub='note';a.update();return true;}
 if(f.dataset.p2Form==='library-tag'&&sel){const v=field('tag').trim(),m=meta(sel.kind,find(sel.kind,sel.id)!);if(v&&!m.keywords.includes(v))m.keywords.push(v);a.update();($('.lib-tag-form input'))?.focus();return true;}return false;}
 // Search filters in place (no re-render, so the caret stays): unmatched tags and rows fade.
 function input(e: Event){const el=tgt(e).closest<HTMLInputElement>('[data-library-query]');if(!el)return;ui.libraryQuery=el.value;for(const n of HOST.querySelectorAll('#library [data-p2-drag="paper"]') as NodeListOf<HTMLElement>){const[k,id]=n.dataset.id!.split('|');n.classList.toggle('is-unmatched',!matches(k,find(k,id)!));}
 for(const n of HOST.querySelectorAll('#library .lib-row')){const[k,id]=n.querySelector<HTMLElement>('[data-p2]')!.dataset.id!.split('|');n.classList.toggle('is-unmatched',!matches(k,find(k,id)!));}}
 function hover(e: Event,show: boolean){if(view()!=='sea')return;const paper=tgt(e).closest<HTMLElement>('[data-paper-hover]'),knot=tgt(e).closest<HTMLElement>('[data-knot-hover]');
 if(paper){const root=$('#library')!,gloss=$('#library-gloss');if(!gloss)return;if(!show&&paper.contains((e as PointerEvent).relatedTarget as Node|null))return;ui.libraryHover=show?paper.dataset.paperHover:null;gloss.hidden=!show;if(show){const[k,id]=paper.dataset.paperHover!.split('|');if(ui.librarySelected?.kind===k&&ui.librarySelected.id===id){gloss.hidden=true;ui.libraryHover=null;return;}
 const item=find(k,id)!,b=paper.getBoundingClientRect(),r=root.getBoundingClientRect(),gw=Math.min(240,root.clientWidth*.2),right=b.right-r.left+14;gloss.textContent=item.conclusion;gloss.style.width=gw+'px';gloss.style.left=(right+gw<root.clientWidth-8?right:b.left-r.left-gw-14)+'px';gloss.style.top=Math.max(8,Math.min(b.top-r.top-4,root.clientHeight-110))+'px';}a.drawScenery();}
 if(knot){const label=$('#library-knot-label');if(!label)return;label.hidden=!show;if(show){const[k,n]=knot.dataset.knotHover!.split('|'),b=knot.getBoundingClientRect(),r=$('#library')!.getBoundingClientRect();label.textContent=stages[k as Kind][Number(n)][1];label.style.left=b.left-r.left+22+'px';label.style.top=b.top-r.top-4+'px';}}}
 // ——— Scenery ———
 // 第 3b 期：风景输出描述（draw/scene.ts），原来的字符串版只在风景里用，删去。画笔 inkV / curveV / circleV 是描述版（phase2.js 的 api）
 const inkV=a.inkV,curveV=a.curveV,circleV=a.circleV;
 const FV=(p: Point[],c=P)=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z`,fill:c});
 function ropeV(x: number,ya: number,yb: number): Parts[]{let t='';for(let y=ya+3;y<yb-2;y+=5.5)t+=`M${x-1.4},${(y+1.6).toFixed(1)}L${x+1.4},${(y-1.2).toFixed(1)}`;return [sh('path',{d:`M${x-1.6},${ya}L${x-1.6},${yb}L${x+1.6},${yb}L${x+1.6},${ya}Z`,fill:P}),inkV([[x-1.6,ya],[x-1.4,(ya+yb)/2],[x-1.6,yb]],.8),inkV([[x+1.6,ya],[x+1.8,(ya+yb)/2],[x+1.6,yb]],.8),sh('path',{d:t,stroke:M,'stroke-width':'.55',fill:'none'})];}
 function fishV(x: number,y: number,k=1,flip=1): Parts[]{const b=Array.from({length:13},(_,i): Point=>{const t=i/12*Math.PI*2;return[x+Math.cos(t)*6*k*flip,y+Math.sin(t)*2.2*k];});return [curveV(b,.7,M),inkV([[x-6*k*flip,y],[x-10*k*flip,y-2.6*k],[x-9.5*k*flip,y+2.6*k],[x-6*k*flip,y]],.7,M),circleV(x+3.4*k*flip,y-.4*k,.5,.5,M)];}
 function schoolV(x: number,y: number,n=5,flip=1){const s: Parts[]=[];for(let i=0;i<n;i++)s.push(fishV(x+(i%3)*14*flip+((i*7)%5),y+Math.floor(i/3)*9+(i%2)*3,.85+(i%3)*.1,flip));return s;}
 function coralV(x: number,y: number,k=1){const s: Parts[]=[];const br=(x0: number,y0: number,ang: number,len: number,dep: number)=>{const x1=x0+Math.cos(ang)*len,y1=y0+Math.sin(ang)*len;s.push(curveV([[x0,y0],[(x0+x1)/2+Math.sin(ang)*2,(y0+y1)/2],[x1,y1]],Math.max(.5,dep*.35),dep>1?I:M));if(dep>0){br(x1,y1,ang-.45,len*.7,dep-1);br(x1,y1,ang+.4,len*.66,dep-1);}};br(x,y,-Math.PI/2,16*k,3);return s;}
 function weedV(x: number,y: number,hh: number,k=1){const s: Parts[]=[];for(let j=0;j<3;j++){const p: Point[]=[];for(let i=0;i<=8;i++){const t=i/8;p.push([x+j*4*k+Math.sin(t*5+j)*3*k,y-t*hh*(1-j*.18)]);}s.push(curveV(p,.7,j?M:I));}return s;}
 function rockV(x: number,y: number,wd: number,ht: number){const p: Point[]=[[x,y],[x+wd*.08,y-ht*.6],[x+wd*.3,y-ht],[x+wd*.62,y-ht*.86],[x+wd*.9,y-ht*.45],[x+wd,y]];const s: Parts[]=[FV([...p]),curveV(p,1)];for(let i=0;i<4;i++){const hx=x+wd*(.55+i*.1);s.push(inkV([[hx,y-2],[hx-4,y-ht*.5]],.45,M));}return s;}
 function shellV(x: number,y: number){const s: Parts[]=[curveV(Array.from({length:13},(_,i): Point=>{const t=Math.PI+i/12*Math.PI;return[x+Math.cos(t)*7,y+Math.sin(t)*6];}),.8)];for(let i=1;i<5;i++){const t=Math.PI+i/5*Math.PI;s.push(inkV([[x,y],[x+Math.cos(t)*6.5,y+Math.sin(t)*5.5]],.45,M));}s.push(inkV([[x-7,y],[x+7,y]],.8));return s;}
 function anchorV(x: number,y: number,k=1): Parts[]{return [circleV(x,y-40*k,4*k,1.1),inkV([[x,y-36*k],[x+2*k,y]],1.5),inkV([[x-10*k,y-28*k],[x+11*k,y-27*k]],1.3),curveV([[x-20*k,y-12*k],[x-12*k,y-2*k],[x+2*k,y+1],[x+16*k,y-4*k],[x+22*k,y-14*k]],1.5),inkV([[x-20*k,y-12*k],[x-24*k,y-8*k]],1.2),inkV([[x+22*k,y-14*k],[x+26*k,y-10*k]],1.2)];}
 function seabedV(w: number,h: number,from=0,to=w,dense=1){const y=h-16;const s: Parts[]=[curveV(Array.from({length:31},(_,i): Point=>{const x=from+(to-from)*i/30;return[x,y+Math.sin(i*.9)*2.2];}),1.1,M)];for(let i=0;i<14*dense;i++){const x=from+(to-from)*((i*.618)%1);s.push(curveV([[x,y+6],[x+10,y+5.4],[x+22,y+6]],.45,T));}return s;}
 function seaSceneryV(w: number,h: number){const L=cache.librarySea||seaLayout(w,h);const s: Parts[]=[];
 // Hull above both ropes: keel line, planks, the ropes' rings.
 const hx0=L.litX-90,hx1=L.bookX+120,hull: Point[]=[[hx0,-2],[hx1,-2],[hx1-30,20],[(hx0+hx1)/2,30],[hx0+30,20]];s.push(sh('g',{'data-morph':'keel'},FV(hull),curveV([[hx0,-2],[hx0+30,20],[(hx0+hx1)/2,30],[hx1-30,20],[hx1,-2]],1.5),curveV([[hx0+14,6],[(hx0+hx1)/2,16],[hx1-14,6]],.6,M),curveV([[hx0+24,13],[(hx0+hx1)/2,23],[hx1-24,13]],.5,T)));
 s.push(curveV(Array.from({length:25},(_,i): Point=>[i*w/24,38+Math.sin(i*1.3)*1.4]),.8,T));
 for(const[x,kind]of [[L.litX,'literature'],[L.bookX,'book']] as [number,Kind][]){const top=kind==='literature'?22:28,bottom=kind==='literature'?L.y1+44:L.y1+20,line: Parts[]=[circleV(x,top,3.6,1.1),ropeV(x,top+3,bottom)];
 for(const v of L.levels.filter(v=>v.kind===kind)){const cs=L.cards.filter(c=>c.kind===kind&&c.ky===v.y),end=cs.length?Math.max(...cs.map(c=>c.x+c.w-14)):x+40;line.push(inkV([[x+5,v.y],[end,v.y+1.5]],.8),circleV(x,v.y,6.5,1.3),circleV(x,v.y,2.4,.8));
 // A tag in a lower row hangs from the tag above it, so strings never run behind another tag.
 for(const c of cs){const up=cs.find(o=>o.col===c.col&&o.row===c.row!-1),y0=up?up.y+up.h:v.y+1;for(const sx of up?[Math.max(c.x,up.x)+18,Math.min(c.x+c.w,up.x+up.w)-18]:[c.x+16,c.x+c.w-16])line.push(inkV([[sx,y0],[sx,c.y]],.6,M),up?null:circleV(sx,v.y+1,1.3,.6));}}
 // 文献的绳子末端是一个独立的铅锤（data-morph="sounding-weight"），读书笔记的绳子末端只是一个小三角
 if(kind==='literature')s.push(sh('g',{'data-morph':'sounding-rope'},line),sh('g',{'data-morph':'sounding-weight'},FV([[x-8,bottom],[x+8,bottom],[x+11,bottom+20],[x,bottom+28],[x-11,bottom+20]]),inkV([[x-8,bottom],[x+8,bottom],[x+11,bottom+20],[x,bottom+28],[x-11,bottom+20],[x-8,bottom]],1.4)));
 else{line.push(inkV([[x-6,bottom],[x+6,bottom],[x,bottom+12],[x-6,bottom]],1.2));s.push(sh('g',{'data-morph':'book-rope'},line));}}
 // Life in the free water: two schools, a whale far off when the right side is open, bubbles up the rope.
 const g=L.levels.filter(v=>v.kind==='literature'),life: Parts[]=[schoolV(L.litX-108,g[1].y+g[1].step*.55,5),schoolV(L.bookX-104,g[2].y+g[2].step*.6,4,-1)];
 if(!L.detail){const wx=w*.86,wy=h*.52;life.push(curveV([[wx-80,wy],[wx-50,wy-24],[wx+10,wy-26],[wx+56,wy-8],[wx+80,wy+4],[wx+96,wy-10],[wx+102,wy+2],[wx+92,wy+10],[wx+70,wy+12],[wx+20,wy+22],[wx-40,wy+18],[wx-80,wy]],.8,T),curveV([[wx-50,wy+6],[wx-20,wy+12],[wx+20,wy+10]],.5,T),circleV(wx-58,wy-6,1.2,.6,T),schoolV(w*.8,h*.28,6));}
 for(let i=0;i<5;i++)life.push(circleV(L.bookX+8+(i%2)*4,L.y0+40+i*22,1.4+(i%3)*.6,.6,T));s.push(sh('g',{'data-library-life':true},life));
 s.push(sh('g',{'data-library-seabed':true},seabedV(w,h,0,w),rockV(14,h-16,70,24),coralV(96,h-17,1.1),weedV(130,h-16,46),shellV(L.litX+250,h-14),coralV(L.bookX-60,h-17,.9),rockV(L.bookX+20,h-16,54,18),weedV(L.bookX+90,h-16,38,.9),coralV(w*.66,h-17,1),rockV(w*.72,h-16,80,26),weedV(w*.82,h-16,52),coralV(w*.9,h-17,1.2),shellV(w*.95,h-13)));
 return sh('g',{'data-library-sea':true},s);}
 function shelfSceneryV(w: number,h: number){const y=h-16;return sh('g',{'data-library-shelf-bed':true},seabedV(w,h,0,w,2),coralV(30,y,1.3),weedV(62,y,58),rockV(84,y,90,30),coralV(186,y,1),schoolV(260,y-56,5),shellV(330,y+2),weedV(w*.36,y,46,.9),coralV(w*.42,y,1.1),schoolV(w*.5,y-70,4,-1),rockV(w*.56,y,70,22),weedV(w*.63,y,62),coralV(w*.7,y,1.2),anchorV(w*.83,y+2,1),weedV(w*.88,y,56),coralV(w*.93,y,1.3),rockV(w*.96,y,60,22));}
 function scenery(box: DOMRect){const w=box.width,h=Math.min(box.height,HOST.bottom-box.top);const root=$('#library');if(root&&cache.libraryRendered!==view()+root.clientWidth+'x'+root.clientHeight)render();return view()==='shelf'?shelfSceneryV(w,h):seaSceneryV(w,h);}
 return{render,action,scenery,submit,input,drop(drag: {kind: string; id: string},target: string){if(drag.kind!=='paper'||!target.startsWith('paper:'))return false;const[kind,id]=drag.id.split('|'),[,dropKind,stage]=target.split(':');if(kind!==dropKind)return true;move(kind,id,stage);return true;},pointerover:(e: Event)=>hover(e,true),pointerout:(e: Event)=>hover(e,false),focusin:(e: Event)=>hover(e,true),focusout:(e: Event)=>hover(e,false),
 context(e: Event){const paper=tgt(e).closest<HTMLElement>('[data-p2-drag="paper"]');if(!paper)return false;const[kind,id]=paper.dataset.id!.split('|');ui.librarySelected={kind,id};ui.libraryMenu=true;a.update();($('.library-stage-menu button'))?.focus();return true;},
 key(e: KeyboardEvent){if(ui.page!=='library')return false;const paper=tgt(e).closest<HTMLElement>('[data-paper-hover]');if(paper&&(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)){e.preventDefault();const[kind,id]=paper.dataset.paperHover!.split('|');ui.librarySelected={kind,id};ui.libraryMenu=true;a.update();($('.library-stage-menu button'))?.focus();return true;}return false;}};
}
