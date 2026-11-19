import {HOST} from '../../host.ts';
import {chartLayoutR22,NOW} from './paper-chart-art-r22.ts';
import type {ChartLayout} from './paper-chart-art-r22.ts';
import {chartArtR23} from './paper-chart-art-r23.ts';
import {sh, parts, partNodes} from '../scene.ts';
import type {Parts} from '../scene.ts';
import {h,svg,setNodes} from '../dom.ts';
import type {Child} from '../dom.ts';
import {iconEl} from '../ink.ts';
import {buttonEl as B} from './paper-tasks.ts';
import type {ProtoApi} from './paper-tasks.ts';
import {svgP,glyphEl,stateMarkEl} from './p2-nodes.ts';
import type {Model,ModelProject,ModelStation} from '../../data/types.ts';
// 第 4a 期：转 TypeScript，整页改成节点构建（setNodes 整页换掉 #projects，仍是每次重画整页）；项目名、站名、说明、目标 / 想法 / 文献名一律是文本节点或属性值。
// 船、站点、旗、卷筒来自 chart-art 的节点版；按钮、小图来自 paper-tasks.ts 的 buttonEl 与 p2-nodes.ts（与 phase2 的字符串版同结构、同几何）。
// 关联目标（HOST.projectGoalChips，goals.ts）、相关人员（HOST.projectPeople，people.ts）、新建任务横线（HOST.projectTaskAdd，task-plus.ts）改成返回节点。
// 去掉的死分支：两个钩子没装时的原型写法（目标纸签、人员按钮与人物详情、沟通准备）——插件里 goals.ts（思索页建立时，早于任何一页的绘制）与 people.ts（视图打开时）总会装上；
// 没有调用方的 mapLinks（想法、文献的海图链接）。

/** 本页用到的 api（phase2.js 的 api） */
export interface ProjectApi extends ProtoApi {
 dashV: ProtoApi['dashV'];
 textObstacles: (root: Element|null, base: DOMRect, margin?: number, controls?: boolean) => {x: number; y: number; width: number; height: number}[];
 newProject: (title: string, ideaId?: string|null) => ModelProject;
}
interface ProjectUI {projectInit?: boolean; projectPerson?: string|null; projectSource?: boolean}
interface Camera {scale: number; tx: number; ty: number; worldH: number; viewH: number}
interface ProjectCache {projectLayout?: {key: string; lay: ChartLayout}; projectRendered?: string; projectCamera?: Camera}
type Station=ModelStation&{date?: string};
export function projectPage(a: ProjectApi){
 const {d,$,fmt}=a,ui=d.ui as Model['ui']&ProjectUI,cache=d.cache as ProjectCache,statuses: [string,string,string][]=[['planned','box','计划中'],['active','ship','进行中'],['paused','anchor','暂停'],['completed','flag','已完成'],['archived','archive','已归档']],chart=chartArtR23(a);
 const G=(type: string)=>glyphEl(a,type);
 // R21: the chart opens on the first active voyage, as in the reference; stations carry planned dates (fictional data).
 if(!ui.projectInit){ui.projectInit=true;ui.projectSelected??=d.projects.find(p=>p.status==='active')?.id||null;const add=(date: string,n: number)=>{const t=new Date(date+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};// Passed stations sit before today, the rest spread evenly up to the due date.
 const gap=(x: string,y: string)=>Math.round((new Date(y).getTime()-new Date(x).getTime())/864e5);for(const p of d.projects){const end=p.due||p.completed||HOST.monthEnd(d.clock.date),n=p.stations.length,k=p.stations.findIndex(st=>st.state!=='done'),first=k<0?n:k,span=Math.max(n-first,1),days=Math.max(gap(d.clock.date,end),span);(p.stations as Station[]).forEach((st,i)=>{st.date??=i<first?add(d.clock.date,-(first-i)*7):add(d.clock.date,Math.round(days*(i-first+1)/span));});}}
 const md=(date: string|null|undefined)=>date?date.slice(5).replace('-','/'):'';
 const chosen=()=>d.projects.find(p=>p.id===ui.projectSelected),progress=(p: ModelProject)=>p.stations.length?p.stations.reduce((n,s)=>n+(s.state==='done'?1:s.state==='in_progress'?.45:0),0)/p.stations.length:0;
 // R22: every position on the chart comes from one layout of the current size; HTML and scenery share it.
 function layoutFor(w: number,h: number){const by=(st: string)=>d.projects.filter(p=>p.status===st),key=w+'x'+h+'|'+d.projects.map(p=>p.id+p.status+p.title+progress(p)).join();if(cache.projectLayout?.key===key)return cache.projectLayout.lay;
 const lay=chartLayoutR22(w,h,{active:by('active').map(p=>({id:p.id,title:p.title,ratio:progress(p)})),planned:by('planned'),paused:by('paused').map(p=>({...p,anchor:true})),completed:by('completed')});cache.projectLayout={key,lay};return lay;}
 function route(p: ModelProject,w: number,hh: number,_focus=false,index=0){const lane=layoutFor(w,hh).lanes[index],start=lane.start,end=lane.end,y=lane.y,ratio=progress(p),bx=lane.bx;const now=p.id===ui.projectSelected,col=now?NOW:a.INK;const line: Parts[]=[a.dashV([[start,y],[end,y]],1.1,now?NOW:a.SECONDARY)];if(ratio)line.push(a.inkV([[start,y],[bx,y]],1.7,col));
 return h('div',{class:'project-route','data-project-route':p.id,style:`left:0;top:0;width:${w}px;height:${hh}px`},svg('svg',{class:'project-route-ink',viewBox:`0 0 ${w} ${hh}`,'aria-hidden':'true'},partNodes(parts(sh('g',{'data-morph':`route-${p.id}`},line)))),
  B('project-open',p.id,[h('span',null,p.title),chart.shipEl(43,now)],'展开项目 '+p.title,{class:`project-boat active-boat ${lane.inline?'is-inline side-'+lane.side:''} ${p.id===ui.projectSelected?'selected-voyage':''}`,draggable:'true','data-p2-drag':'project',style:lane.inline?(lane.side==='right'?`left:${bx-24}px;top:${y-45}px`:`left:${bx+24}px;top:${y-45}px;transform:translateX(-100%)`):`left:${bx-100}px;top:${y-65}px;width:200px`}),
  p.stations.map((s,i)=>{const x=start+(end-start)*(p.stations.length===1?.5:i/(p.stations.length-1));return B('project-station',p.id+'|'+s.id,[chart.dotEl(s.state,now),h('span',null,s.title)],`${s.title}，${({open:'未开始',in_progress:'进行中',done:'完成'} as Record<string,string>)[s.state]}`,{class:'route-station',style:`left:${x-17}px;top:${y-10}px;width:34px`});}),
  p.due&&[h('span',{class:'route-flag',style:`left:${end-3}px;top:${y-21}px`},chart.flagEl(now)),h('time',{class:'route-due',style:`left:${end+15}px;top:${y-9}px`},md(p.due))]);}
 function mark(p: ModelProject,w: number,h0: number,index: number){const at=layoutFor(w,h0).marks[p.id];if(!at)return null;const x=at.x,y=at.y;return B('project-open',p.id,[chart.shipEl(43,p.id===ui.projectSelected),h('span',null,p.title),p.status==='paused'&&G('anchor')],'展开项目 '+p.title,{class:`project-boat port-boat ${p.status==='completed'?'old-voyage':''} ${p.id===ui.projectSelected?'selected-voyage':''}`,draggable:'true','data-p2-drag':'project',style:`left:${x-66}px;top:${y}px;width:132px;${p.status==='completed'?'opacity:'+(index?.5:.72):''}`});}

 const statusLabel=(st: string)=>statuses.find(x=>x[0]===st)![2];
 // R21 detail: a header with the voyage and its relations, then tasks with progress, the milestone voyage, people and files.
 function detail(p: ModelProject){const tasks=d.tasks.filter(t=>t.projectId===p.id),done=tasks.filter(t=>t.status==='done').length,ideas=p.ideaIds.map(id=>d.ideas.find(x=>x.id===id)).filter(x=>x!==undefined),lits=p.literatureIds.map(id=>d.literature.find(x=>x.id===id)).filter(x=>x!==undefined),bar=tasks.length?done/tasks.length:0;
 const menu=ui.projectMenu&&h('div',{class:'project-status-menu hand-popup',role:'group','aria-label':'项目状态'},statuses.map(([status,glyph,label])=>B('project-status',status,[G(glyph),h('span',null,label)],label,{'aria-pressed':String(p.status===status)})));
 const head=h('div',{class:'pd-head'},h('div',{class:'pd-title'},chart.shipEl(52,true),h('div',{class:'pd-title-text'},h('div',{class:'pd-title-row'},h('h3',null,p.title),h('span',{class:'pd-status'},statusLabel(p.status)),p.resume&&h('time',null,fmt(p.resume))),p.description&&h('p',null,p.description)),
   h('div',{class:'project-detail-top'},B('project-close','',G('left'),'折回海图'),B('project-status-menu','',G(statuses.find(s=>s[0]===p.status)![1]),'更改项目状态'),B('project-source','',G('corner'),'展开项目 Markdown'),menu)),
  h('div',{class:'pd-links'},h('div',{class:'pd-link'},G('goal'),h('span',{class:'pd-label'},'关联目标'),HOST.projectGoalChips!(p,d,B)),
   h('div',{class:'pd-link'},iconEl('star'),h('span',{class:'pd-label'},'相关想法'),h('span',{class:'mono pd-count'},`${ideas.length}`),ideas[0]&&B('open-object',ideas[0].id,'“'+ideas[0].title+'”',ideas[0].title,{'data-kind':'idea',class:'pd-quote'})),
   h('div',{class:'pd-link'},iconEl('book'),h('span',{class:'pd-label'},'相关文献'),h('span',{class:'mono pd-count'},`${lits.length}`),lits[0]&&B('open-object',lits[0].id,lits[0].title,lits[0].title,{'data-kind':'literature',class:'pd-quote'}))));
 const taskCol=h('section',{class:'pd-tasks'},h('header',null,h('span',null,'任务'),h('span',{class:'mono'},`${done}/${tasks.length}`),h('span',{class:'pd-bar','aria-hidden':'true'},svgP([a.inkV([[2,4],[158,4]],1,a.TICK),bar?a.inkV([[2,4],[2+156*bar,4]],2.4,NOW):null],160,8))),
  h('div',{class:'project-task-list'},tasks.length?tasks.map(t=>h('div',null,B('project-task-complete',t.id,stateMarkEl(a,t.status),'完成 '+t.title),B('open-object',t.id,t.title,'打开任务 '+t.title,{'data-kind':'task'}),h('time',{class:`mono ${t.date===d.clock.date?'is-today':''}`},md(t.date)))):h('p',{class:'pd-empty'},'还没有任务')),
  HOST.projectTaskAdd?.(p,d));
 const stationCol=h('section',{class:'pd-stations'},h('header',null,h('span',null,'里程碑航程')),h('div',{class:'project-progress-list'},(p.stations as Station[]).map((st,i)=>B('project-station',p.id+'|'+st.id,[chart.dotEl(st.state,true),h('span',null,st.title),h('time',{class:'mono'},md(st.date))],st.title,{class:`pd-station state-${st.state}`,'data-last':String(i===p.stations.length-1)}))));
 const peopleCol=h('section',{class:'project-relations'},h('header',null,h('span',null,'相关人员')),h('div',{class:'project-people'},HOST.projectPeople!(p,d,B)),h('header',{class:'pd-sub'},h('span',null,'相关文献')),h('div',{class:'pd-files'},lits.map(l=>B('open-object',l.id,[iconEl('note',16),l.title],l.title,{'data-kind':'literature'}))));
 return h('div',{class:'project-detail pd-r21'},head,h('div',{class:'pd-cols'},taskCol,stationCol,peopleCol),ui.projectSource&&h('pre',{class:'markdown-preview'},`---\ntitle: ${p.title}\nstatus: ${p.status}\n---\n\n${p.description}\n\n## 进度\n${p.stations.map(s=>'- ['+(s.state==='done'?'x':s.state==='in_progress'?'/':' ')+'] '+s.title).join('\n')}`));}
 // R21: no zoom; the whole chart is laid into the visible map height and every voyage stays on it.
 function camera(_w: number,worldH: number,viewH: number): Camera{return{scale:1,tx:0,ty:0,worldH,viewH};}
 // 疑似问题批 F4：页面高度不够（视图被盖住时为 0）时 mapH 原来会是负的，航线 <svg> 写出 viewBox "0 0 0 -24"；海图高度夹到 0（下面 scenery 的 mh 同样）
 function render(){const root=$('#projects')!,w=root.clientWidth,h0=root.clientHeight,p=chosen(),mapH=Math.max(0,p?h0-(HOST.innerHeight<=820?298:318):h0-24),worldH=mapH,cam=camera(w,worldH,mapH),lay=layoutFor(w,worldH);cache.projectRendered=w+'x'+mapH;cache.projectCamera=cam;root.classList.toggle('has-project-detail',!!p);
 setNodes(root,()=>{const vessels: Child[]=[d.projects.filter(p=>p.status==='active').map((p,i)=>route(p,w,worldH,false,i)),['planned','paused','completed'].map(status=>d.projects.filter(p=>p.status===status).map((p,i)=>mark(p,w,worldH,i)))];
 return [h('div',{class:'chart-zones','aria-hidden':'true'},layoutFor(w,worldH).labels.map(({cx,name,state})=>h('span',{class:'chart-zone-label',style:`left:${cx.toFixed(0)}px`},h('b',null,name),h('small',null,state)))),
  h('div',{class:'chart-goals'},(p?p.goalIds:d.goals.map(g=>g.id)).map(id=>{const g=d.goals.find(x=>x.id===id)!;return B('open-object',id,[g.title,G('left')],'回到目标 '+g.title,{'data-kind':'goal'});})),
  h('div',{class:'project-map-body',style:`height:${mapH}px`},['planned','active','paused','completed'].map(status=>B('project-zone',status,'',statuses.find(s=>s[0]===status)![2],{class:`chart-zone p2-background-hit zone-${status}`,'data-p2-drop':`project:${status}`})),
   ui.projectList&&h('div',{class:'project-plain-list hand-popup'},h('b',{class:'hand-popup-title'},'全部项目'),statuses.filter(s=>s[0]!=='archived').map(([st,,label])=>d.projects.filter(p=>p.status===st).map(p=>B('project-open',p.id,[chart.shipEl(22),h('span',null,p.title),h('small',null,label)],p.title)))),
   h('div',{class:'project-world',style:`width:${w}px;height:${worldH}px;transform:translate(${cam.tx}px,${cam.ty}px) scale(${cam.scale})`},vessels,B('project-new','',svgP([a.dashV([[4,7],[104,7],[104,42],[4,42],[4,7]],1.15),a.inkV([[45,25],[63,25]],1.2),a.inkV([[54,16],[54,34]],1.2)],110,48),'新建项目',{class:'project-new-berth',style:`left:${lay.berth?lay.berth.x:w*.07}px;top:${lay.berth?lay.berth.y:worldH*.66}px`}))),
  B('project-list','',G('lines'),'切换项目列表',{class:'project-list-toggle','aria-pressed':`${ui.projectList}`}),
  B('project-archive','',[chart.tubeEl(),h('span',null,'归档的项目'),h('span',{class:'mono'},`${d.projects.filter(p=>p.status==='archived').length}`)],'展开归档项目',{class:'project-archive',style:`left:${lay.archive?lay.archive.x:w*.04}px;top:${lay.archive?lay.archive.y:mapH*.88-13}px`}),
  ui.projectArchive&&h('div',{class:'project-archived-list hand-popup',style:`left:${lay.archive?lay.archive.x:w*.04}px;top:${(lay.archive?lay.archive.y:mapH*.88)-8}px;transform:translateY(-100%)`},h('b',{class:'hand-popup-title'},'归档的项目'),d.projects.filter(p=>p.status==='archived').map(p=>B('project-open',p.id,p.title,p.title))),
  ui.newProject&&h('form',{class:'project-new-form line-form hand-popup','data-p2-form':'new-project',style:`left:${lay.berth?lay.berth.x:w*.07}px;top:${(lay.berth?lay.berth.y:mapH*.7)-8}px;transform:translateY(-100%)`},h('b',{class:'hand-popup-title'},'新建项目'),h('input',{name:'title',placeholder:'项目名称','aria-label':'项目名称'}),h('button',{type:'submit',class:'text-button'},'新建')),
  p&&detail(p)];});
 }

 function action(key: string,id: string){if(!key.startsWith('project-'))return false;const p=chosen()!;if(key==='project-open'){ui.projectSelected=ui.projectSelected===id?null:id;ui.projectSource=false;ui.projectPerson=null;}else if(key==='project-close')ui.projectSelected=null;else if(key==='project-list')ui.projectList=!ui.projectList;else if(key==='project-archive')ui.projectArchive=!ui.projectArchive;else if(key==='project-status-menu')ui.projectMenu=!ui.projectMenu;else if(key==='project-status'){p.status=id;if(id==='completed')p.completed=d.clock.date;ui.projectMenu=false;}else if(key==='project-station'){const[pid,sid]=id.split('|'),station=d.projects.find(p=>p.id===pid)!.stations.find(s=>s.id===sid)!;station.state=({open:'in_progress',in_progress:'done',done:'open'} as Record<string,string>)[station.state];}else if(key==='project-person')ui.projectPerson=ui.projectPerson===id?null:id;else if(key==='project-source')ui.projectSource=!ui.projectSource;else if(key==='project-new')ui.newProject=!ui.newProject;else if(key==='project-task-complete'){a.complete(id);return true;}else if(key==='project-zone'){ui.projectSelected=null;}a.update();if(key==='project-new')($('.project-new-form input'))?.focus();if(key==='project-status-menu')($('.project-status-menu button'))?.focus();return true;}
 function scenery(box: DOMRect){const w=box.width,h=Math.min(box.height,HOST.bottom-box.top),mh=Math.max(0,ui.projectSelected?h-(HOST.innerHeight<=820?298:318):h-24),worldH=mh;
 // A resize redraws only the scenery; re-render the chart HTML too when the size it was laid out for changed.
 // 第 3b 期：风景输出描述（draw/scene.ts）
 if(cache.projectRendered!==w+'x'+mh&&$('#projects')!.clientWidth===w)render();const lay=layoutFor(w,mh),cam=cache.projectCamera||camera(w,worldH,mh),root=$('#projects .project-map-body'),obs=a.textObstacles(root,box,12,false),mask=sh('defs',null,sh('mask',{id:'r14-chart-clear',maskUnits:'userSpaceOnUse',x:'0',y:'0',width:w,height:mh},sh('rect',{width:w,height:mh,fill:'white'}),obs.map(r=>sh('rect',{x:r.x,y:r.y,width:r.width,height:r.height,fill:'black'}))),sh('clipPath',{id:'r14-chart-viewport'},sh('rect',{width:w,height:mh})));const s: Parts[]=[mask,sh('g',{mask:'url(#r14-chart-clear)','clip-path':'url(#r14-chart-viewport)'},sh('g',{'data-chart-camera':true,transform:`translate(${cam.tx} ${cam.ty}) scale(${cam.scale})`},chart.sceneV(lay)),chart.hudV(lay))];if(ui.projectSelected)s.push(a.inkV([[0,mh+5],[w*.35,mh+4.8],[w,mh+5]],1.1,a.TICK));return parts(s);}

 return{render,action,scenery,submit(f: HTMLFormElement){if(f.dataset.p2Form!=='new-project')return false;const title=(f.elements.namedItem('title') as HTMLInputElement).value.trim();if(title){const p=a.newProject(title);ui.projectSelected=p.id;ui.newProject=false;a.update();}return true;},drop(drag: {kind: string; id: string},target: string){if(drag.kind!=='project'||!target.startsWith('project:'))return false;const p=d.projects.find(p=>p.id===drag.id)!;p.status=target.split(':')[1];if(p.status==='completed')p.completed=d.clock.date;a.update();return true;},key(e: KeyboardEvent){if(ui.page==='projects'&&e.key==='≡'){e.preventDefault();ui.projectList=!ui.projectList;a.update();return true;}return false;}};
}
