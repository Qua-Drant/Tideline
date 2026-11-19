import {HOST} from '../../host.ts';
import {sh, parts} from '../scene.ts';
import type {Part,Parts,Shape} from '../scene.ts';
import {h,insertNodes} from '../dom.ts';
import type {Attrs} from '../dom.ts';
import type {Point} from '../ink.ts';
import {taskPage} from './paper-tasks.ts';
import {projectPage} from './paper-projects.ts';
import {reviewPage} from './paper-review.ts';
import {libraryPage} from './paper-library-r25.ts';
import {brainPage} from './paper-brain-r31.ts';
import type {ProjectApi} from './paper-projects.ts';
import type {ReviewApi} from './paper-review.ts';
import type {LibraryApi} from './paper-library-r25.ts';
import type {BrainApi} from './paper-brain-r31.ts';
import type {Model,ModelProject} from '../../data/types.ts';
// 第 4a 期：转 TypeScript。各页（任务、项目、复盘、知识库、大脑）都已改成节点构建，phase2 交给它们的字符串小工具（ink、curve、svg、dash、glyph、button、
// stateMark、initial）没有调用方，删去；节点版在 p2-nodes.ts 与 paper-tasks.ts 的 buttonEl。下方五页的空 section 改成节点插入（属性先后不变）。

/** pages/lower.js 的 core（JS）里这里用到的几样 */
export interface P2Core {
 readonly data: Model;
 inkV: (points: Point[], size?: number, color?: string, attrs?: Attrs | null) => Shape | null;
 circleV: (x: number, y: number, r: number, size?: number, color?: string) => Shape | null;
 render(): void;
 navigate(page: string): void;
 drawScenery(): void;
 announce: (message: string, undo: () => void) => void;
 openPDF?: (id: string | undefined) => void;
 complete(id: string): unknown;
}
/** 一页（任务、项目、复盘、知识库、大脑）交回来的接口：都可选，按名字分派事件 */
interface P2Page {
 render(): void;
 scenery(box: DOMRect): Parts;
 action?(key: string, id: string, b: HTMLElement, e: Event): boolean | undefined;
 blank?(e: Event): void;
 input?(e: Event): void;
 submit?(f: HTMLFormElement): boolean;
 key?(e: KeyboardEvent): boolean;
 drop?(drag: {kind: string; id: string}, target: string): boolean;
 context?(e: Event): boolean;
 search?(): void;
 [type: string]: unknown;
}
type DropUI = {drag2?: {kind: string; id: string} | null};
type Camera = {scale: number; tx: number};
const tgt = (e: Event) => e.target as HTMLElement;
export function createPhase2(core: P2Core){
 const d=core.data,$=(s: string)=>HOST.querySelector(s) as HTMLElement|null,$$=(s: string)=>[...HOST.querySelectorAll(s)] as HTMLElement[],INK='#1C2A35',SECONDARY='#5B6871',TICK='#B6C0C5',PAPER='#F4F5F2';
 const ui=d.ui as Model['ui']&DropUI&{cargoInitialized?: boolean},cache=d.cache as {projectCamera?: Camera; shallowFrame?: number|null};
 // 第 3b 期：画笔的几何与输出分开（第 4a 期起只剩描述版）。inkV / dashV 是描述版（见 draw/scene.ts），先按 6 个单位加密取样
 const dense=(points: Point[])=>{const p: Point[]=[];for(let i=1;i<points.length;i++){const from=points[i-1],to=points[i],n=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/6));for(let j=0;j<n;j++)p.push([from[0]+(to[0]-from[0])*j/n,from[1]+(to[1]-from[1])*j/n]);}p.push(points.at(-1)!);return p;};
 const inkV=(points: Point[],size=1.4,color=INK,attrs: Attrs|null=null)=>core.inkV(dense(points),size,color,attrs);
 const dashes=(p: Point[])=>{const out: Point[][]=[];let distance=0;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);let n=0;while(n<len-.001){const phase=(distance+n)%13,span=Math.min(len-n,phase<7?7-phase:13-phase);if(span<.001){n+=.001;continue;}if(phase<7)out.push([[a[0]+(b[0]-a[0])*n/len,a[1]+(b[1]-a[1])*n/len],[a[0]+(b[0]-a[0])*(n+span)/len,a[1]+(b[1]-a[1])*(n+span)/len]]);n+=span;}distance+=len;}return out;};
 const dashV=(p: Point[],size=1.2,color=INK)=>dashes(p).map(q=>inkV(q,size,color));
 const fmt=(date: string|null|undefined)=>date?`${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日`:'';
 const project=(id: string|null|undefined)=>d.projects.find(p=>p.id===id),person=(id: string|null|undefined)=>d.people.find(p=>p.id===id);
 const api: ProjectApi&ReviewApi&LibraryApi&BrainApi={...core,inkV,curveV:core.inkV,circleV:core.circleV,$,$$,d,INK,SECONDARY,TICK,PAPER,dashV,fmt,project,person,update:()=>core.render(),go:(kind: string,id: string)=>openObject(kind,id),textObstacles,newProject};
 function sync(){for(const t of d.tasks){t.peopleIds??=[];t.listId??=null;t.priority??='medium';if(!t.projectId&&t.project)t.projectId=d.projects.find(p=>p.title===t.project)?.id||null;t.project=t.projectId?project(t.projectId)?.title:undefined;}d.summary.inbox=d.tasks.filter(t=>!t.example&&t.status!=='done'&&!t.listId&&!t.projectId).length;d.summary.projects=d.projects.filter(p=>!p.example&&p.status==='active').length;d.summary.doneWeek=d.tasks.filter(t=>!t.example&&t.status==='done'&&(t.completed||t.date)!>=HOST.weekStart(d.clock.date)&&(t.completed||t.date)!<=HOST.weekEnd(d.clock.date)).length;d.summary.literature=d.literature.filter(l=>!l.example&&l.stage==='inbox').length;d.review.trend[11]=d.summary.doneWeek;}
 for(const[id,name]of [['tasks','任务'],['projects','项目'],['review','复盘'],['library','知识库'],['brain','大脑']])if(!$('#'+id))insertNodes($('#help')!,'beforebegin',()=>h('section',{id,class:`page lower-page paper-${id}`,'aria-label':name,hidden:true}));
 const pages: Record<string,P2Page>={tasks:taskPage(api),projects:projectPage(api),review:reviewPage(api),library:libraryPage(api),brain:brainPage(api)};
 function openObject(kind: string,id: string){if(kind==='project'){ui.projectSelected=id;core.navigate('projects');}else if(kind==='task'){ui.taskFilter={kind:'all'};ui.taskDetail=id;core.navigate('tasks');}else if(kind==='person'){ui.taskFilter={kind:'person',id};core.navigate('tasks');}else if(kind==='literature'||kind==='book'){ui.librarySelected={kind,id} as unknown as string;if(ui.libraryView==='shelf')ui.libraryTab=kind;core.navigate('library');}else if(kind==='idea'){ui.lamp=false;ui.ideaDate=null as unknown as string;ui.ideaTag=null;ui.idea=id;core.navigate('thought');}else if(kind==='goal'){ui.lamp=true;ui.goal=id;ui.goalFlash=id;ui.goalCal=null;ui.goalPick=null;core.navigate('thought');}}
 function prepareMeeting(id: string){const who=person(id)!,tasks=d.tasks.filter(t=>t.status!=='done'&&t.discuss&&t.peopleIds.includes(id));const item={id:'prep-'+d.serial++,personId:id,title:`与${who.name}的沟通准备`,date:d.clock.date,text:tasks.map(t=>t.title).join('\n')};d.meetingPreparations.push(item);ui.preparedMeeting=item.id;api.update();}
 function newProject(title: string,ideaId: string|null=null){const p={id:'p-new-'+d.serial++,title,status:'planned',goalIds:[],peopleIds:[],ideaIds:ideaId?[ideaId]:[],literatureIds:[],stations:[],description:''} as unknown as ModelProject;d.projects.push(p);return p;}
 HOST.addEventListener('click',e=>{const b=tgt(e).closest<HTMLButtonElement>('[data-p2]');if(!b||b.disabled)return;e.preventDefault();e.stopImmediatePropagation();const action=b.dataset.p2!,id=b.dataset.id!;if(action==='open-object'){openObject(b.dataset.kind!,id);return;}if(action==='prepare-meeting'){prepareMeeting(id);return;}for(const p of Object.values(pages))if(p.action?.(action,id,b,e))return;},true);
 HOST.addEventListener('click',e=>{pages[ui.page]?.blank?.(e);});
 HOST.addEventListener('dblclick',e=>{const b=tgt(e).closest<HTMLElement>('[data-brain-node]');if(b){e.preventDefault();openObject(b.dataset.kind!,b.dataset.id!);}});
 HOST.addEventListener('input',e=>pages[ui.page]?.input?.(e));
 HOST.addEventListener('submit',e=>{const f=tgt(e).closest<HTMLFormElement>('[data-p2-form]');if(!f)return;e.preventDefault();for(const p of Object.values(pages))if(p.submit?.(f))return;});
 HOST.addEventListener('keydown',e=>{const ke=e as KeyboardEvent;if(ke.key==='Escape'){ui.taskDate=null;ui.taskDetail=ui.taskMenu=ui.projectSelected=ui.librarySelected=ui.brainSelected=ui.wheelMenu=null;ui.projectMenu=ui.libraryMenu=ui.reviewSource=ui.projectSource=ui.newList=ui.newView=ui.newProject=false;ui.brainQuery='';return;}if(tgt(e).matches('input,textarea,select,[contenteditable]'))return;for(const p of Object.values(pages))if(p.key?.(ke))return;});
 HOST.addEventListener('dragstart',e=>{const b=tgt(e).closest<HTMLElement>('[data-p2-drag]');if(!b)return;ui.drag2={kind:b.dataset.p2Drag!,id:b.dataset.id!};(e as DragEvent).dataTransfer!.setData('text/plain',JSON.stringify(ui.drag2));});
 function dropTarget(e: DragEvent){if(ui.page==='projects'&&ui.drag2?.kind==='project'&&(cache.projectCamera?.scale??0)>1){const r=$('#projects')!.getBoundingClientRect(),cam=cache.projectCamera!,x=(e.clientX-r.left-cam.tx)/cam.scale/r.width,status=x<.19?'planned':x<.69?'active':x<.86?'paused':'completed';return $('#projects [data-p2-drop="project:'+status+'"]');}const b=tgt(e).closest<HTMLElement>('[data-p2-drop]');if(b)return b;const drag=ui.drag2;if(!drag)return null;if(ui.page==='projects'&&drag.kind==='project'){const r=$('#projects')!.getBoundingClientRect(),cam=cache.projectCamera||{tx:0,scale:1},x=(e.clientX-r.left-cam.tx)/cam.scale/r.width,status=x<.19?'planned':x<.69?'active':x<.86?'paused':'completed';return $('#projects [data-p2-drop="project:'+status+'"]');}if(ui.page==='library'&&drag.kind==='paper'){const[kind]=drag.id.split('|'),r=$('#library')!.getBoundingClientRect(),book=kind==='book',count=book?3:4,step=(r.height-(book?180:160))/count,level=Math.max(0,Math.min(count-1,Math.floor((e.clientY-r.top-67)/step))),stages=book?['want','reading','done']:['inbox','skimmed','to-deep','deep-done'];return $('#library [data-p2-drop="paper:'+kind+':'+stages[level]+'"]');}return null;}
 HOST.addEventListener('dragover',e=>{const b=dropTarget(e as DragEvent);if(b&&ui.drag2){e.preventDefault();$$('.p2-drop-active').forEach(x=>x.classList.remove('p2-drop-active'));b.classList.add('p2-drop-active');}});
 HOST.addEventListener('drop',e=>{const b=dropTarget(e as DragEvent);if(!b||!ui.drag2)return;e.preventDefault();e.stopImmediatePropagation();const drag=ui.drag2;ui.drag2=null;for(const p of Object.values(pages))if(p.drop?.(drag,b.dataset.p2Drop!))return;},true);
 HOST.addEventListener('dragend',()=>{ui.drag2=null;$$('.p2-drop-active').forEach(x=>x.classList.remove('p2-drop-active'));});
 HOST.addEventListener('scroll',e=>{if(ui.page!=='today'||!tgt(e).closest?.('#journal,#trail,.above'))return;if(cache.shallowFrame)cancelAnimationFrame(cache.shallowFrame);cache.shallowFrame=requestAnimationFrame(()=>{cache.shallowFrame=null;core.drawScenery();});},true);
 HOST.addEventListener('contextmenu',e=>{const plan=tgt(e).closest('[data-plan]');if(plan){e.preventDefault();return;}for(const p of Object.values(pages))if(p.context?.(e)){e.preventDefault();return;}});
 for(const type of ['pointerover','pointerout','focusin','focusout','pointerdown'])HOST.addEventListener(type,e=>{for(const p of Object.values(pages))(p[type] as ((e: Event) => void)|undefined)?.(e);});
 function textObstacles(root: Element|null,base: DOMRect,margin=16,controls=true){const out: {x: number; y: number; width: number; height: number}[]=[];const walk=document.createTreeWalker(root!,NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode,el=n.parentElement!;if(!n.textContent!.trim()||el.closest('[hidden],script,style')||getComputedStyle(el).visibility==='hidden')continue;const range=document.createRange();range.selectNode(n);for(const b of range.getClientRects()){let top=b.top,bottom=b.bottom,left=b.left,right=b.right;for(let a: Element|null=el;a&&a!==root;a=a.parentElement){const st=getComputedStyle(a),r=a.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(st.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}if(/auto|scroll|hidden|clip/.test(st.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}}if(right>left&&bottom>top&&bottom>base.top&&top<HOST.innerHeight)out.push({x:left-base.left-margin,y:top-base.top-margin,width:right-left+margin*2,height:bottom-top+margin*2});}}
 if(controls)for(const el of root!.querySelectorAll('button,input,[role="slider"]')){if(el.closest('[hidden]')||el.classList.contains('p2-background-hit'))continue;const b=el.getBoundingClientRect();let left=b.left,right=b.right,top=b.top,bottom=b.bottom;for(let p: Element|null=el.parentElement;p&&p!==root;p=p.parentElement){const st=getComputedStyle(p),r=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(st.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}if(/auto|scroll|hidden|clip/.test(st.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}}if(right>left&&bottom>top&&top<HOST.innerHeight)out.push({x:left-base.left-margin,y:top-base.top-margin,width:right-left+margin*2,height:bottom-top+margin*2});}return out;}
 function flowV(w: number,h: number,depth: number,obstacles: {x: number; y: number; width: number; height: number}[]){const s: (Shape|null)[]=[];const rows=5+depth*3;for(let i=0;i<rows;i++){const t=i/rows,y=40+(h-75)*Math.pow(t,.8),start=(i%3)*w*.09,end=w*(.68+(i%4)*.08);let ranges=[[start,end]];for(const b of obstacles)if(y>=b.y&&y<=b.y+b.height)ranges=ranges.flatMap(([a,z])=>z<b.x||a>b.x+b.width?[[a,z]]:[[a,Math.min(z,b.x-2)],[Math.max(a,b.x+b.width+2),z]].filter(([a,z])=>z-a>30));for(const[a,z]of ranges)if(z-a>45)s.push(inkV([[a,y],[a+(z-a)*.5,y-.4],[z,y]],.72,TICK,{opacity:'.42'}));}return sh('g',{'data-flow-lines':true},s);}
 // 下方五页的风景：描述（draw/scene.ts）。文字下面挖空的遮罩、几页共用的水流线，加上那一页自己的风景（各页的 scenery 也输出描述）
 // 疑似问题批 F4：纸的顶端在视图底边之下（高度为 0 或视图被盖住）时 h 原来是负的，遮罩写出 height="-24" 一类的负值；夹到 0
 function scenery(box: DOMRect): Part[]{const p=pages[ui.page];if(!p)return [];const root=$('#'+ui.page),obstacles=textObstacles(root,box,16),text=textObstacles(root,box,8,false),h=Math.max(0,Math.min(box.height,HOST.bottom-box.top));
 const flat=['tasks','projects'].includes(ui.page)||ui.page==='library'&&ui.libraryView==='shelf'||ui.page==='brain';
 const mask=sh('defs',null,sh('mask',{id:'p2-ink-mask',maskUnits:'userSpaceOnUse',x:'0',y:'0',width:box.width,height:h},sh('rect',{width:box.width,height:h,fill:'white'}),text.map(r=>sh('rect',{x:r.x,y:r.y,width:r.width,height:r.height,fill:'black'}))));
 const flow=flat?null:flowV(box.width,h,['tasks','projects','review','library','brain'].indexOf(ui.page)+1,obstacles),own=p.scenery(box);
 return parts(mask,sh('g',{mask:'url(#p2-ink-mask)'},flow,own));}
 return {sync,render(){pages[ui.page]?.render();},scenery,openObject,newProject:api.newProject,brainSearch(q: string){ui.brainQuery=q;if(q){ui.brainSelected=null;ui.brainType=null;}pages.brain.search!();}};
}
