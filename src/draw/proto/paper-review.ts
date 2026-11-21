import {HOST} from '../../host.ts';
import {maritimeArt} from './paper-maritime-r14.ts';
import {sh,parts,partNodes} from '../scene.ts';
import type {Parts} from '../scene.ts';
import {h,svg,setNodes,replaceWithNodes} from '../dom.ts';
import type {Attrs,Child} from '../dom.ts';
import {iconEl} from '../ink.ts';
import type {Point} from '../ink.ts';
import {buttonEl as B} from './paper-tasks.ts';
import type {ProtoApi} from './paper-tasks.ts';
import {svgP,glyphEl} from './p2-nodes.ts';
import type {Model,ModelTask,ReviewDay} from '../../data/types.ts';
// 第 4a 期：转 TypeScript，整页改成节点构建（setNodes 整页换掉 #review，仍是每次重画整页）。任务名、习惯名、问题、投入、随手记、成就、感恩、往年、
// 原话、季度文字、生命之轮的领域名一律是文本节点或属性值（原来随手记的时刻、轮子的领域名、季度指标的几项没有转义）。
// 页里的小画（航迹、习惯小图、趋势、配舱、轮子、往年的速写……）原来是 SVG 字符串，改成描述（draw/scene.ts）再建节点，几何与属性先后不变；
// 塔、礁石、房子、水草用 maritime 的描述版（…V，与字符串版同一列笔画）。模板里的换行与一格缩进照原样建成空白文本节点（W）。
// 拖动花瓣时原来每次 pointermove 用 outerHTML 换掉整个 .quarter-rose，现在用 replaceWithNodes 换（同样每次重建，焦点所在的花瓣同样被换掉）。
// 去掉的死代码（没有调用方）：qDonut、quarterPage 里的 bar、harbor。

/** 本页用到的 api（phase2.js 的 api） */
export interface ReviewApi extends ProtoApi {
 dashV: ProtoApi['dashV'];
}
interface ReviewUI {wheelDragging?: string|null; wheelMenu: string|null; reviewDay: number; reviewPeriod: string; reviewSource: boolean}
type Day=ReviewDay&{done: ModelTask[]};
const W='\n ';
const tgt=(e: Event)=>e.target as HTMLElement;
const str=(v: unknown)=>`${v as string}`;
export function reviewPage(a: ReviewApi){
 const {d,$,fmt}=a,m=maritimeArt(a),ui=d.ui as Model['ui']&ReviewUI;
 const G=(type: string)=>glyphEl(a,type);
 // 画笔（描述版）：ink 是 phase2 的加密直线笔，curve 是不加密的曲线笔，circle 是手绘圆
 const ink=a.inkV,curve=a.curveV,circle=a.circleV;
 const txt=(attrs: Attrs,s: unknown)=>sh('text',attrs,str(s));
 function day(index: number): Day{const r=d.review.days[index],current=r.date===d.clock.date;return{...r,habits:current?d.habits.map(h=>h.value):r.habits,questions:current?d.questions.map(q=>q.value):r.questions,investments:current?d.investments:r.investments,journal:current?d.journal:r.journal,done:d.tasks.filter(t=>t.status==='done'&&(t.completed||t.date)===r.date)};}
 const habitMark=(v: boolean|null|undefined)=>v===null?svgP([]):v?iconEl('dot'):iconEl('circle');
 // R21 day spread, after the reference logbook: the left page reads the day top to bottom (trail, habits, questions,
 // hours, then notes / achievements / gratitude side by side); the right page lists this date in earlier years.
 const WEEK=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],weekday=(date: string)=>WEEK[new Date(date+'T12:00:00Z').getUTCDay()];
 d.review.pastYears??=[{year:2025,items:['把数据预处理流程整理成一页清单','读完两篇建筑轮廓提取的论文','和林老师讨论了方法的改进方向'],sketch:'harbor'},{year:2024,items:['搭好了第一版实验环境','画出初步的结果对照图','参加了实验室组会'],sketch:'lake'},{year:2023,items:['整理暑期实习的测量记录','读了关于地表模型生成的文献','做了一次方法对比实验'],sketch:'village'},{year:2022,items:['去江边做了一天实地调研','学了摄影测量的基础知识','交了课程实验报告初稿'],sketch:'ridge'}];
 const S=a.SECONDARY,T=a.TICK;
 function sketch(kind: string){const s: Parts[]=[];const c=(p: Point[],n=1,col=a.INK)=>curve(p,n,col);
 if(kind==='harbor'){s.push(c([[0,52],[40,50],[80,52],[150,51]],.7,S));for(const[x,h]of [[52,22],[62,30],[72,18],[84,26],[96,14]])s.push(ink([[x,50],[x,50-h],[x+9,50-h],[x+9,50]],.9));s.push(m.towerV(118,50,.42),c([[10,56],[40,55],[70,57]],.5,T),c([[90,58],[130,57]],.5,T));}
 else if(kind==='lake'){s.push(c([[0,46],[24,30],[40,36],[62,14],[86,34],[104,26],[130,40],[150,44]],1),c([[62,14],[56,30],[50,40]],.5,S),c([[104,26],[98,36]],.5,S));for(let i=0;i<4;i++)s.push(c([[20+i*8,52+i*3],[70,51+i*3],[120-i*8,52+i*3]],.5,T));}
 else if(kind==='village'){s.push(c([[0,48],[150,48]],.7,S),m.houseV(30,48,.5),m.houseV(52,48,.42),m.towerV(80,48,.4),m.houseV(96,48,.5),m.plantV(122,48,.3),c([[20,54],[60,53],[110,55]],.5,T));}
 else if(kind==='ship'){s.push(c([[0,50],[40,49],[90,51],[150,50]],.7,S),ink([[46,44],[56,52],[94,52],[104,44],[46,44]],1.1),ink([[74,8],[74,44]],1),ink([[71,12],[52,40],[71,40],[71,12]],.9),ink([[78,16],[96,40],[78,40],[78,16]],.9),ink([[74,8],[82,10],[74,12]],.8),c([[20,56],[60,55],[120,57]],.5,T),c([[100,59],[140,58]],.5,T));for(const[x,y]of [[24,14],[120,10],[132,18]])s.push(ink([[x-4,y],[x,y-2.6],[x+4,y]],.6),ink([[x+4,y],[x+8,y-2.6],[x+12,y]],.6));}
 else if(kind==='light'){s.push(m.towerV(104,48,.5),c([[70,50],[84,42],[96,44],[112,40],[126,46],[150,50]],1),c([[80,48],[92,46]],.5,S),c([[0,52],[60,51],[150,52]],.6,S),c([[10,57],[70,56],[130,58]],.5,T),c([[30,30],[60,28]],.4,T));for(const[x,y]of [[30,16],[44,10]])s.push(ink([[x-4,y],[x,y-2.6],[x+4,y]],.6),ink([[x+4,y],[x+8,y-2.6],[x+12,y]],.6));}
 else {s.push(c([[0,44],[30,26],[48,34],[70,16],[96,30],[120,24],[150,40]],1),c([[0,50],[40,40],[80,46],[120,38],[150,46]],.7,S));for(let i=0;i<6;i++)s.push(ink([[74+i*5,22+i*3],[71+i*5,28+i*3]],.45,S));s.push(c([[10,58],[60,57],[140,58]],.5,T));}
 return svgP(s,150,62);}
 function dayPage(): Child{const r=day(ui.reviewDay),all=d.tasks.filter(t=>t.date===r.date||(t.status==='done'&&(t.completed||t.date)===r.date)),total=Math.max(all.length,r.done.length),habitsDone=r.habits.filter(Boolean).length,hours=r.investments.reduce((n,i)=>n+i.hours,0),max=Math.max(1,total);
 const trail: Parts[]=[ink([[6,14],[322,14]],1,a.TICK)];const xs=Array.from({length:max},(_,i)=>8+i*(312/Math.max(1,max-1)));if(r.done.length)trail.push(ink([[6,14],[xs[r.done.length-1]||6,14]],1.8));xs.forEach((x,i)=>{trail.push(i<r.done.length?sh('circle',{cx:x,cy:'14',r:'3.4',fill:a.INK}):circle(x,14,3.2,1,a.SECONDARY));});if(r.done.length){const bx=xs[r.done.length-1];trail.push(ink([[bx-7,6],[bx+7,6],[bx+4,9],[bx-4,9],[bx-7,6]],1.1),ink([[bx,6],[bx,-6]],1),ink([[bx,-5],[bx+6,2],[bx,2]],1));}
 const shades=[a.INK,a.SECONDARY,a.TICK,'#8C979C','#D9DEE0'];const bar: Parts[]=[];let x=0;r.investments.forEach((inv,i)=>{const len=hours?inv.hours/hours*316:0;bar.push(ink([[x+2,6],[x+len-2,6]],5,shades[i%shades.length]));x+=len;});
 const head=h('div',{class:'log-page-head'},h('div',{class:'log-date'},fmt(r.date)),h('span',{class:'log-weekday'},str(weekday(r.date))),B('review-prev','',G('left'),'前一天',{class:'review-step'}),B('review-next','',G('right'),'后一天',{class:'review-step'}));
 const none=()=>h('p',{class:'log-none'},'—');
 const left=h('div',{class:'log-left log-scroll log-day'},head,W,
 h('section',{class:'log-sec'},h('h4',null,G('route'),h('span',null,'航迹'),h('small',{class:'mono'},`完成 ${r.done.length} / ${total}`)),h('div',{class:'log-trail',role:'img','aria-label':`完成 ${r.done.length} 件，共 ${total} 件`},svgP(trail,330,22)),h('div',{class:'log-trail-names'},r.done.map(t=>B('open-object',t.id,t.title,'打开任务 '+t.title,{'data-kind':'task'})))),W,
 h('section',{class:'log-sec'},h('h4',null,iconEl('check'),h('span',null,'习惯'),h('small',{class:'mono'},`${habitsDone} / ${d.habits.length}`)),h('div',{class:'log-habits'},d.habits.map((hb,i)=>h('span',{class:'log-habit'},habitMark(r.habits[i]),h('small',null,hb.name))))),W,
 h('section',{class:'log-sec'},h('h4',null,G('goal'),h('span',null,'每日问题')),d.questions.map((q,i)=>h('div',{class:'log-question'},h('span',{class:'mono'},`${i+1}`),h('span',null,q.title),h('span',{class:'mono'},r.questions[i]==null?'—':`${r.questions[i]} / 10`)))),W,
 h('section',{class:'log-sec'},h('h4',null,iconEl('sunrise'),h('span',null,'时间投入'),h('small',{class:'mono'},`${hours}h`)),h('div',{class:'log-hours-bar'},svgP(bar,320,12)),h('div',{class:'log-hours'},r.investments.map((inv,i)=>h('span',null,h('i',{style:`background:${shades[i%shades.length]}`}),inv.title,h('b',{class:'mono'},`${inv.hours}h`))))),W,
 h('div',{class:'log-notes'},h('section',null,h('h4',null,iconEl('note'),h('span',null,'随手记')),r.journal.length?r.journal.map(n=>h('p',null,h('time',{class:'mono'},n.time),n.text)):none()),h('section',null,h('h4',null,iconEl('flag'),h('span',null,'成就')),r.achievements.length?r.achievements.map(t=>h('p',null,t)):none()),h('section',null,h('h4',null,G('lead'),h('span',null,'感恩')),r.gratitude.length?r.gratitude.map(t=>h('p',null,t)):none())));
 const md=r.date.slice(5),right=h('div',{class:'log-right log-past log-scroll'},h('div',{class:'log-page-head'},h('h4',{class:'log-past-title'},'往年今日'),h('span',{class:'log-weekday'},fmt(r.date))),d.review.pastYears.map((y,i)=>h('article',{class:'log-year'},h('div',null,h('h5',null,h('span',{class:'mono'},`${y.year}`),h('small',null,str(weekday(y.year+'-'+md)))),h('ul',null,y.items.map(t=>h('li',null,t))),i===0?h('blockquote',null,d.past.text):null),sketch(y.sketch))),r.quote?h('p',{class:'log-quote'},r.quote):null);
 return [left,right];}
 // R22 week spread, after the reference logbook: the left page carries the twelve-week trend and a seven-day table
 // (done, habits, state); the right page gathers the week's achievements, thanks and own words, each with a sketch.
 // Ink only; magenta marks the current week and today.
 const MD=(date: string)=>Number(date.slice(5,7))+'/'+Number(date.slice(8)),WD=['周日','周一','周二','周三','周四','周五','周六'],wd=(date: string)=>WD[new Date(date+'T12:00:00Z').getUTCDay()];
 const score=(r: Day)=>{const v=r.questions.filter(x=>x!==null);return v.length?v.reduce((n,x)=>n+x,0)/v.length:null;};
 // Small habit glyphs: water drop, a stretch, an open book, the moon.（描述，建节点时每次新建）
 const HABIT_GLYPH: Parts[][]=[[ink([[7,1.5],[3.2,7.5],[3.6,10.6],[7,12.6],[10.4,10.6],[10.8,7.5],[7,1.5]],1.05)],[circle(7,2.6,1.5,1),ink([[7,4.4],[7,8.6]],1.1),ink([[3,5.6],[7,6.4],[11,5.6]],1),ink([[7,8.6],[4.6,12.4]],1),ink([[7,8.6],[9.4,12.4]],1)],[ink([[1.5,3.5],[7,4.6],[12.5,3.5],[12.5,11.5],[7,12.4],[1.5,11.5],[1.5,3.5]],1),ink([[7,4.6],[7,12.4]],.9)],[ink([[9.6,1.8],[6.2,2.6],[3.6,5.6],[3.4,9.2],[5.8,12],[9.4,12.4],[12,10.6],[8.6,10],[6.6,7.6],[7,4.2],[9.6,1.8]],1)]];
 // 疑似问题批 F6：近 12 周完成数全为 0 时 max = 0，Y() 原来是 0/0 = NaN（<text y="NaN">、点的 cy 与位置都是 NaN）；刻度至少到 10，全 0 时点画在基线上
 function weekTrend(){const t=d.review.trend,Wd=440,H=104,x0=30,x1=330,top=12,base=80,max=Math.max(10,Math.ceil(Math.max(...t)/10)*10),X=(i: number)=>x0+i*(x1-x0)/(t.length-1),Y=(v: number)=>base-v/max*(base-top);
 const s: Parts[]=[];for(const v of [0,max/2,max]){s.push(ink([[x0-4,Y(v)],[x1+6,Y(v)]],.45,a.TICK),txt({x:x0-9,y:Y(v)+3,'text-anchor':'end',class:'ax'},v));}
 s.push(ink(t.map((v,i): Point=>[X(i),Y(v)]),1.35));t.forEach((v,i)=>{s.push(i===t.length-1?[sh('circle',{cx:X(i),cy:Y(v),r:'3.4',fill:'#C8206A'}),txt({x:X(i)+2,y:Y(v)-8,class:'now','text-anchor':'middle'},v)]:sh('circle',{cx:X(i),cy:Y(v),r:'2.2',fill:a.INK}));s.push(txt({x:X(i),y:base+16,'text-anchor':'middle',class:'ax'},33+i));});
 s.push(txt({x:x1+12,y:base+16,class:'ax'},'周'),sh('g',{transform:`translate(${Wd-62} ${base+4})`},m.towerV(0,0,.5),m.rockV(-30,0,.6),m.rockV(26,1,.45)),curve([[x1+30,base+5],[Wd-80,base+3],[Wd-40,base+6],[Wd-2,base+4]],.6,a.SECONDARY),curve([[x1+44,base+10],[Wd-30,base+10]],.45,a.TICK));
 return h('div',{class:'review-trend wk-trend'},svg('svg',{viewBox:`0 0 ${Wd} ${H}`,'aria-hidden':'true'},partNodes(parts(s))),t.map((v,i)=>B('review-trend',String(i),'','第 '+(33+i)+' 周完成 '+v,{class:'trend-point',style:`left:${(X(i)/Wd*100).toFixed(2)}%;top:${(Y(v)/H*100).toFixed(2)}%`})),h('span',{id:'review-trend-value',class:'trend-value',hidden:true}));}
 function weekPage(): Child{const days=d.review.days.map((_,i)=>day(i)),scores=days.map(score),maxDone=Math.max(5,...days.map(r=>r.done.length));
 const rows=days.map((r,i)=>{const n=r.done.length,future=r.date>d.clock.date,today=r.date===d.clock.date,tags=r.investments.map(x=>x.title).join(' · ');
 const trail: Parts[]=[];for(let j=0;j<maxDone;j++){const x=5+j*11;trail.push(j<n?sh('circle',{cx:x,cy:'7',r:'2.6',fill:today?'#C8206A':a.INK}):circle(x,7,2.3,.8,a.TICK));}if(n>1)trail.unshift(ink([[5,7],[5+(n-1)*11,7]],1.3,today?'#C8206A':a.INK));
 const sc=scores[i],hist=scores.slice(0,i+1).filter(v=>v!==null).slice(-5),spark: Parts=sc===null?null:hist.length>1?ink(hist.map((v,j): Point=>[3+j*(38/(hist.length-1)),17-v*1.5]),1.1):circle(22,17-sc*1.5,1.8,1);
 return h('div',{class:`week-log-row ${today?'is-today':''} ${future?'is-future':''}`},h('div',{class:'wk-date'},h('b',{class:'mono'},MD(r.date)),h('span',null,str(wd(r.date))),tags?h('small',null,tags):h('small',{class:'wk-none'},future?'未到':'未记录')),W,
 h('div',{class:'wk-done','aria-label':`完成 ${n} 件`},future?h('span',{class:'wk-none'},'—'):[svgP(trail,maxDone*11,14),h('span',{class:'mono'},`${n} 件`)]),W,
 h('div',{class:'week-habits wk-habits','aria-label':d.habits.map((hb,j)=>hb.name+' '+(r.habits[j]===null?'未记录':r.habits[j]?'完成':'未完成')).join('，')},r.habits.map(v=>h('i',{class:v===null?'is-null':v?'is-on':'is-off'}))),W,
 h('div',{class:'week-question wk-state','aria-label':`当日状态 ${sc===null?'未记录':sc.toFixed(1)}`},sc===null?h('span',{class:'wk-none'},'—'):[svgP(spark,44,18),h('span',{class:'mono'},sc.toFixed(1))]));});
 const past=days.filter(r=>r.date<=d.clock.date),hab=past.flatMap(r=>r.habits).filter(v=>v!==null),sc=scores.filter(v=>v!==null),avg=sc.length?(sc.reduce((x,y)=>x+y,0)/sc.length).toFixed(1):'—';
 const sum=h('div',{class:'week-sum'},h('span',null,'本周至今'),h('span',null,h('b',{class:'mono'},`${past.reduce((x,r)=>x+r.done.length,0)}`),' 件完成'),h('span',null,'习惯 ',h('b',{class:'mono'},`${hab.filter(Boolean).length}/${hab.length}`)),h('span',null,'状态均值 ',h('b',{class:'mono'},avg)),h('span',null,'记录 ',h('b',{class:'mono'},`${past.length}/7`),' 天'));
 const left=h('div',{class:'log-left log-week log-scroll'},h('div',{class:'log-page-head'},h('div',{class:'log-date'},'2026 年 第 44 周'),h('span',{class:'log-weekday'},`${fmt(d.review.weekDates[0])} – ${fmt(d.review.weekDates[6])}`)),W,
 h('section',{class:'log-sec wk-trend-sec'},h('h4',null,G('route'),h('span',null,'最近 12 周完成')),weekTrend()),W,
 h('div',{class:'week-table'},h('div',{class:'week-head'},h('span',null,'日期'),h('span',null,'当日完成'),h('span',{class:'wk-habit-head'},HABIT_GLYPH.map((g,j)=>h('span',{title:d.habits[j]?.name||''},svgP(g,14,14)))),h('span',null,'当日状态')),rows),sum);
 const all=(k: 'achievements'|'gratitude')=>days.flatMap(r=>r[k].map(t=>({t,date:r.date})));
 const list=(items: {t: string; date: string}[],cls: string)=>h('ul',{class:`wk-list ${cls}`},items.length?items.map(x=>h('li',null,h('span',null,x.t),h('time',{class:'mono'},MD(x.date)))):h('li',{class:'log-none'},'—'));
 const quotes=days.filter(r=>r.quote).map(r=>h('blockquote',{class:'wk-quote'},h('p',null,r.quote,h('time',{class:'mono'},`${MD(r.date)} ${str(wd(r.date))}`))));
 const right=h('div',{class:'log-right weekly-right log-week-right log-scroll'},W,
 h('section',{class:'wk-block'},h('h4',null,iconEl('flag'),h('span',null,'成就')),h('div',{class:'wk-body'},list(all('achievements'),''),sketch('ship'))),W,
 h('section',{class:'wk-block'},h('h4',null,G('lead'),h('span',null,'感恩')),h('div',{class:'wk-body'},list(all('gratitude'),''),sketch('light'))),W,
 h('section',{class:'wk-block wk-quote-block'},h('h4',null,iconEl('note'),h('span',null,'这一周的原话'),h('span',{class:'wk-h-sketch'},sketch('ridge'))),h('div',{class:'wk-quotes'},quotes)));
 return [left,right];}
 // R22 quarter spread: the season's voyage across the top of both pages, then harvest and key numbers, the wheel
 // across the gutter, next season's directions and experiments; trend, time and one sentence along the bottom.
 // All quarter figures are fictional sample data held in memory.
 d.review.quarter??={harvest:[['实验方法有了初稿',true],['建立了更稳定的身体节律',true],['推动了研究方向的系统梳理',true],['与家人有了更多高质量相处',false]],
 metrics:[['task','完成任务','128','','+18%'],['clock','深度投入','86.5','h','+12%'],['book','阅读量','12','本','+33%'],['run','运动次数','36','次','+20%'],['moon','平均睡眠','7.4','h','+3%'],['heart','习惯达成率','78','%','+6pp']],
 directions:[['flask','深化研究方法',.7],['book','维持规律作息与运动',.6],['home','改善居住与工作环境',.4]],
 experiments:[['每日专注块 ≥ 3 小时',false,[3,5,4,6,5]],['每周 3 次运动',true,[2,3,3,4,3]],['尝试数字极简',false,[4,3,5,4,5]],['为家人准备一次特别体验',false,[1,3,2,4,5]]],
 tasks:[48,56,61,70,72,80,85,88,98,104,110,128],hours:[24,28,31,39,40,44,49,54,58,63,70,86.5],
 time:[['研究与学习',34],['实验与项目',24],['生活事务',16],['运动健康',11],['阅读与思考',9],['其他',6]]};
 const Q=d.review.quarter;
 const QG: Record<string,Parts[]>={task:[ink([[4,3],[14,3],[14,16],[4,16],[4,3]],1.1),ink([[7,2],[11,2],[11,4.4],[7,4.4],[7,2]],.9),ink([[6.4,9.6],[8.4,11.6],[12,7.4]],1.1)],clock:[circle(9,9,6.6,1.1),ink([[9,5],[9,9],[12,10.6]],1.1)],book:[ink([[2,4],[9,5.4],[16,4],[16,14.6],[9,15.6],[2,14.6],[2,4]],1.05),ink([[9,5.4],[9,15.6]],.9)],
 run:[ink([[2,9],[16,9]],1.2),ink([[4,6],[4,12]],1.6),ink([[14,6],[14,12]],1.6),ink([[1.5,7.6],[1.5,10.4]],1.2),ink([[16.5,7.6],[16.5,10.4]],1.2)],moon:[ink([[12.4,2.4],[7.6,3.4],[4.4,7.4],[4.6,12],[8,15],[12.6,15],[15.4,12.6],[11,12],[8.4,9],[9,5],[12.4,2.4]],1.05)],
 heart:[ink([[9,15.4],[3.2,9.6],[2.4,6],[4.4,3.4],[7.4,3.4],[9,5.6],[10.6,3.4],[13.6,3.4],[15.6,6],[14.8,9.6],[9,15.4]],1.05)],flask:[ink([[7,2.4],[11,2.4]],1.1),ink([[7.6,2.6],[7.6,7.4],[3.4,14.6],[4.4,16],[13.6,16],[14.6,14.6],[10.4,7.4],[10.4,2.6]],1.05),ink([[5.2,12],[12.8,12]],.8,a.SECONDARY)],
 home:[ink([[2.4,8.6],[9,3],[15.6,8.6]],1.1),ink([[4,7.4],[4,15.6],[14,15.6],[14,7.4]],1.05),ink([[7.6,15.6],[7.6,11],[10.4,11],[10.4,15.6]],.9)]};
 // 疑似问题批 F7：原来 svg(QG[k])，认不得的 k（季度笔记里没写或写错的 icon）会把文字 “undefined” 写进 svg；改为不画图标，照近旁 stateMarkEl / habitMark 的惯例留一个空的 svg
 const qg=(k: unknown)=>h('span',{class:'q-glyph'},svgP(typeof k==='string'&&Object.hasOwn(QG,k)?QG[k]:[],18,18));
 function voyage(){const Wd=900,H=96,P=(t: number): Point=>[70+t*760,64-Math.sin(t*Math.PI)*34],months: [string,number][]=[['10月',.17],['11月',.5],['12月',.83]],now=(29)/92;
 const s: Parts[]=[curve(Array.from({length:41},(_,i)=>P(i/40)),1.2)];for(const[label,t]of months){const[x,y]=P(t);s.push(circle(x,y,3.6,1.2),txt({x,y:y+20,'text-anchor':'middle',class:'ax-m'},label));}
 const[nx,ny]=P(now);s.push(sh('circle',{cx:nx,cy:ny,r:'4.2',fill:'#C8206A'}),ink([[nx,ny-6],[nx,ny-22]],1.1,'#C8206A'),ink([[nx,ny-22],[nx+9,ny-18],[nx,ny-14]],1,'#C8206A'));
 s.push(sh('g',{transform:`translate(36 ${H-8})`},m.towerV(0,0,.42),m.rockV(-18,0,.5),m.rockV(18,1,.42)),curve([[0,H-7],[120,H-9],[260,H-5],[420,H-8],[600,H-6],[760,H-9],[900,H-6]],.55,a.TICK));
 for(const[x,hh]of [[300,10],[520,7],[690,9]])s.push(curve([[x-40,H-7],[x-15,H-7-hh*.6],[x,H-7-hh],[x+18,H-7-hh*.5],[x+44,H-7]],.6,a.SECONDARY));
 s.push(sh('g',{transform:`translate(${Wd-46} ${H-46})`},chartShip()));for(const[x,y]of [[170,18],[640,14]])s.push(ink([[x-5,y],[x,y-3],[x+5,y]],.7),ink([[x+6,y-1],[x+10,y-3.6],[x+14,y-1]],.7));
 const goals=d.goals.map((g,i)=>{const[x,y]=P(months[i]?.[1]??.5);return B('open-object',g.id,g.title,g.title,{'data-kind':'goal',class:'q-goal',style:`left:${(x/Wd*100).toFixed(2)}%;top:${((y-12)/H*100).toFixed(2)}%`});});
 return h('div',{class:'q-voyage'},svg('svg',{viewBox:`0 0 ${Wd} ${H}`,'aria-hidden':'true'},partNodes(parts(s))),h('div',{class:'quarter-goals q-goals'},goals));}
 function chartShip(): Parts[]{return [ink([[4,36],[10,42],[36,42],[42,36],[4,36]],1.2),ink([[23,4],[23,35]],1.1),ink([[21,7],[8,32],[21,32],[21,7]],1),ink([[26,12],[37,32],[26,32],[26,12]],1),curve([[0,46],[24,45],[46,46]],.6,a.SECONDARY)];}
 function qTrend(){const Wd=420,H=150,x0=34,x1=410,top=14,base=118,max=160,X=(i: number)=>x0+i*(x1-x0)/11,Y=(v: number)=>base-v/max*(base-top);const s: Parts[]=[];
 for(const v of [0,40,80,120,160])s.push(ink([[x0-3,Y(v)],[x1,Y(v)]],.4,a.TICK),txt({x:x0-7,y:Y(v)+3,'text-anchor':'end',class:'ax'},v));
 s.push(ink(Q.tasks.map((v,i): Point=>[X(i),Y(v)]),1.35),Q.tasks.map((v,i)=>sh('circle',{cx:X(i),cy:Y(v),r:'1.9',fill:a.INK})),a.dashV(Q.hours.map((v,i): Point=>[X(i),Y(v)]),1.1,a.SECONDARY),Q.hours.map((v,i)=>circle(X(i),Y(v),1.8,.9,a.SECONDARY)));
 Q.tasks.forEach((_,i)=>{if(i%2===0||i===11)s.push(txt({x:X(i),y:base+15,'text-anchor':'middle',class:'ax'},`${33+i}周`));});return svg('svg',{class:'q-chart',viewBox:`0 0 ${Wd} ${H}`,'aria-label':'整体趋势：任务完成数与深度投入'},partNodes(parts(s)));}
 // R24: time is stowed as crates along one hold, widths by share, each with its own hatch; legend underneath.
 function qCargo(){const Wd=400,H=58,total=Q.time.reduce((n,x)=>n+x[1],0);const s: Parts[]=[],defs: Parts[]=[];let x=4;
 // 一格的纹样，裁在 clip（原来字符串版先写 #q-crate-i，图例里再替换成 #q-crate-i-k）
 const hatch=(i: number,x0: number,y0: number,w: number,h: number,clip: string)=>{const o: Parts[]=[];const L=(p: Point,q: Point,n=.55,c=a.SECONDARY)=>sh('path',{d:`M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`,stroke:c,'stroke-width':`${n}`});
 if(i===0||i===1)for(let k=-h;k<w;k+=i?5:3.6)o.push(L([x0+k,y0+h],[x0+k+h,y0]));if(i===0)for(let k=0;k<w+h;k+=5)o.push(L([x0+k,y0+h],[x0+k-h,y0],.4));if(i===2)for(let k=-h;k<w;k+=8)o.push(L([x0+k,y0+h],[x0+k+h,y0]));if(i===3)for(let k=5;k<h;k+=6)o.push(L([x0,y0+k],[x0+w,y0+k]));if(i===4)for(let yy=y0+6;yy<y0+h;yy+=7)for(let xx=x0+5+(yy%2)*3;xx<x0+w;xx+=7)o.push(sh('circle',{cx:xx.toFixed(1),cy:yy.toFixed(1),r:'.9',fill:a.SECONDARY}));return sh('g',{'clip-path':`url(#${clip})`,fill:'none'},o);};
 Q.time.forEach(([,v],i)=>{const w=(Wd-8)*v/total,y0=12,h=H-18;defs.push(sh('clipPath',{id:`q-crate-${i}`},sh('rect',{x:(x+1.5).toFixed(1),y:`${y0+1.5}`,width:Math.max(0,w-3).toFixed(1),height:`${h-3}`})));
 s.push(sh('rect',{x:(x+1).toFixed(1),y:`${y0}`,width:(w-2).toFixed(1),height:`${h}`,fill:a.PAPER}),hatch(i,x+1,y0,w-2,h,`q-crate-${i}`),ink([[x+1,y0],[x+w-1,y0+.4],[x+w-1,y0+h],[x+1,y0+h-.3],[x+1,y0]],1.05),w>26?ink([[x+4,y0+4],[x+w-4,y0+4]],.45,a.TICK):null);
 if(w>34)s.push(txt({x:(x+w/2).toFixed(1),y:'8','text-anchor':'middle',class:'ax'},`${v}%`));x+=w;});
 const all: Parts[]=[sh('defs',null,defs),s,curve([[0,H-4],[Wd*.3,H-3],[Wd*.7,H-4.5],[Wd,H-3.5]],1.1),ink([[0,H-1],[Wd,H-1]],.5,a.TICK)];
 const sw=(i: number)=>svg('svg',{viewBox:'0 0 22 12','aria-hidden':'true'},partNodes(parts(sh('defs',null,sh('clipPath',{id:`q-crate-${i}-k`},sh('rect',{x:'1',y:'1',width:'20',height:'10'}))),hatch(i,1,1,20,10,`q-crate-${i}-k`),ink([[1,1],[21,1],[21,11],[1,11],[1,1]],.9))));
 return h('div',{class:'q-cargo'},svg('svg',{class:'q-cargo-hold',viewBox:`0 0 ${Wd} ${H}`,'aria-label':`时间投入分布：${Q.time.map(([l,v])=>str(l)+' '+v+'%').join('，')}`},partNodes(parts(all))),h('ul',null,Q.time.map(([label,v],i)=>h('li',null,sw(i),h('span',null,str(label)),h('b',{class:'mono'},`${v}%`)))));}
 // The wheel keeps its 500-unit geometry (drag and keys score against it); it gains rings, spokes and a pale fill.
 function roseEl(){const c=250,max=155;const s: Parts[]=[sh('circle',{cx:`${c}`,cy:`${c}`,r:`${max+18}`,fill:a.PAPER,opacity:'.92'})];for(const k of [.25,.5,.75,1])s.push(a.dashV(Array.from({length:65},(_,i): Point=>[c+Math.cos(i/64*Math.PI*2)*(45+(max-45)*k),c+Math.sin(i/64*Math.PI*2)*(45+(max-45)*k)]),.6,a.TICK));
 for(let i=0;i<8;i++){const t=-Math.PI/2+i*Math.PI/4;s.push(ink([[c+Math.cos(t)*24,c+Math.sin(t)*24],[c+Math.cos(t)*(max+14),c+Math.sin(t)*(max+14)]],.5,a.TICK));}
 d.review.wheel.forEach((r,i)=>{const angle=-Math.PI/2+i*Math.PI/4,length=r.value===null?max*.52:45+r.value/10*(max-45),edge1=angle-.22,edge2=angle+.22,p: Point[]=[[c+Math.cos(angle)*24,c+Math.sin(angle)*24],[c+Math.cos(edge1)*length*.55,c+Math.sin(edge1)*length*.55],[c+Math.cos(angle)*length,c+Math.sin(angle)*length],[c+Math.cos(edge2)*length*.55,c+Math.sin(edge2)*length*.55],[c+Math.cos(angle)*24,c+Math.sin(angle)*24]],lx=c+Math.cos(angle)*206,ly=c+Math.sin(angle)*196;
 s.push(sh('g',null,sh('g',{role:'slider',tabindex:'0','data-wheel':r.id,'aria-label':r.title,'aria-valuemin':'1','aria-valuemax':'10','aria-valuenow':r.value===null?null:`${r.value}`,'aria-valuetext':`${r.value??'未评分'}`},sh('path',{d:`M${c},${c}L${c+Math.cos(angle-.38)*280},${c+Math.sin(angle-.38)*280}L${c+Math.cos(angle+.38)*280},${c+Math.sin(angle+.38)*280}Z`,fill:'transparent'}),sh('path',{d:`M${p.map(q=>q.join(',')).join('L')}Z`,fill:r.value===null?'transparent':'#DADFE0',opacity:'.85'}),r.value===null?a.dashV(p,1.25):ink(p,1.45)),
  txt({x:lx,y:ly-8,'text-anchor':'middle','dominant-baseline':'middle'},r.title),txt({class:'wheel-score',x:lx,y:ly+18,'text-anchor':'middle','dominant-baseline':'middle'},r.value??'—')));});
 s.push(sh('circle',{cx:`${c}`,cy:`${c}`,r:'18',fill:a.PAPER}),circle(c,c,18,1.4),circle(c,c,5,1));return svg('svg',{class:'quarter-rose',viewBox:'-40 -10 580 520','aria-label':'本季度生命之轮'},partNodes(parts(s)));}
 function quarterPage(){const selected=d.review.wheel.find(r=>r.id===ui.wheelMenu);
 const harvest=h('section',{class:'q-card hand-panel q-harvest'},h('h4',null,iconEl('flag'),h('span',null,'本季靠岸'),h('small',null,'主要收获')),h('ul',{class:'q-checks'},Q.harvest.map(([t,ok])=>h('li',null,ok?iconEl('check'):iconEl('circle'),h('span',null,t)))),h('p',{class:'q-foot'},'靠岸 ',h('b',{class:'mono'},`${Q.harvest.filter(x=>x[1]).length} / ${Q.harvest.length}`),h('span',null,svgP([Q.harvest.map((x,i)=>[circle(8+i*18,7,4,1.1),x[1]?sh('circle',{cx:`${8+i*18}`,cy:'7',r:'2.2',fill:a.INK}):null]),ink([[12,7],[22,7]],.6),ink([[30,7],[40,7]],.6),ink([[48,7],[58,7]],.6)],70,14))));
 const metrics=h('section',{class:'q-card hand-panel q-metrics'},h('h4',null,G('route'),h('span',null,'航行数据'),h('small',null,'关键指标')),h('div',{class:'q-metric-grid'},Q.metrics.map(([g,label,v,unit,delta])=>h('div',{class:'q-metric'},qg(g),h('div',null,h('small',null,str(label)),h('b',null,v,h('em',null,str(unit))),h('span',{class:'mono'},`▲ ${str(delta)}`))))));
 const wheel=h('section',{class:'q-card hand-panel q-wheel'},h('h4',null,h('span',null,'生命之轮'),h('small',null,'季度评分 · 拖动花瓣打分')),roseEl(),selected?h('form',{class:'wheel-editor line-form','data-p2-form':'wheel'},h('span',null,selected.title),h('input',{type:'number',min:'1',max:'10',name:'score',value:`${selected.value??''}`,'aria-label':`${selected.title}评分`}),h('button',{type:'submit',class:'text-button'},'保存'),B('wheel-clear',selected.id,'清除','清除评分')):null);
 const course=(v: number)=>{const Wd=150,x=6+(Wd-20)*v;return svg('svg',{viewBox:`0 0 ${Wd} 18`,'aria-hidden':'true'},partNodes(parts(a.dashV([[6,12],[Wd-14,12]],.8,a.TICK),ink([[6,12],[x,12]],1.5),ink([[x-7,13],[x+7,13],[x+4,16],[x-4,16],[x-7,13]],1),ink([[x,13],[x,3]],.9),ink([[x-.5,4],[x-6,11.5],[x-.5,11.5]],.8),ink([[x+.8,5],[x+5,11.5],[x+.8,11.5]],.8),ink([[Wd-14,12],[Wd-14,3]],.9),ink([[Wd-14,3],[Wd-7,5],[Wd-14,7]],.8,a.SECONDARY))));};
 const directions=h('section',{class:'q-card hand-panel q-directions'},h('h4',null,G('goal'),h('span',null,'下一程航向'),h('small',null,'下季度方向')),Q.directions.map(([g,t,v])=>h('div',{class:'q-direction'},qg(g),h('span',null,str(t)),h('span',{class:'q-bar'},course(v)),h('b',{class:'mono'},`${Math.round(v*100)}%`))));
 const cal=()=>svgP([ink([[2,4],[14,4],[14,14],[2,14],[2,4]],1),ink([[2,7],[14,7]],.8),ink([[5,2],[5,5]],1),ink([[11,2],[11,5]],1)],16,16);
 const experiments=h('section',{class:'q-card hand-panel q-experiments'},h('h4',null,qg('flask'),h('span',null,'试航'),h('small',null,'下季度实验')),Q.experiments.map(([t,ok,sp])=>h('div',{class:'q-exp'},ok?iconEl('check'):iconEl('circle'),h('span',null,str(t)),cal(),svgP([ink(sp.map((v,i): Point=>[3+i*14,14-v*2]),1.1),sp.map((v,i)=>sh('circle',{cx:`${3+i*14}`,cy:`${14-v*2}`,r:'1.5',fill:a.INK}))],62,16))));
 const trend=h('section',{class:'q-card hand-panel q-trend'},h('h4',null,G('route'),h('span',null,'航速'),h('small',null,'整体趋势'),h('span',{class:'q-legend'},h('i',{class:'solid'}),'任务完成数',h('i',{class:'dash'}),'深度投入 (h)')),qTrend());
 const time=h('section',{class:'q-card hand-panel q-time'},h('h4',null,iconEl('sunrise'),h('span',null,'配舱'),h('small',null,'时间投入'),h('span',{class:'q-legend'},'本季共 ',h('b',{class:'mono'},'312.5 h'))),qCargo());
 const quote=h('section',{class:'q-card hand-panel q-quote'},h('h4',null,iconEl('note'),h('span',null,'航海日志'),h('small',null,'本季一句话')),h('blockquote',null,d.review.quarterText),h('p',{class:'q-quote-sign'},`— 记于 ${fmt(d.clock.date)}`),sketch('light'));
 return h('div',{class:'quarter-sheet'},h('div',{class:'q-head'},h('div',{class:'log-date'},'2026 · 第四季'),h('span',{class:'log-weekday'},'10月 – 12月'),B('review-source','',G('corner'),'打开季度复盘笔记',{class:'quarter-fold'})),voyage(),h('div',{class:'q-grid'},harvest,wheel,directions,metrics,experiments,trend,time,quote),ui.reviewSource?h('pre',{class:'quarter-source markdown-preview'},`2026-Q4\n\n${d.review.quarterText}\n\n${d.review.wheel.map(r=>r.title+': '+(r.value??'')).join('\n')}`):null);}
 function skyDiscV(x: number,y: number){const hour=Number(d.clock.time.slice(0,2));if(hour>=6&&hour<18)return sh('g',{'data-porthole-sky':'sun'},a.circleV(x,y,9,1.1));const p: Point[]=[];for(let i=0;i<=20;i++){const t=-Math.PI/2-i*Math.PI/20;p.push([x+Math.cos(t)*10,y+Math.sin(t)*10]);}for(let i=0;i<=20;i++){const t=i*Math.PI/20;p.push([x-Math.sin(t)*4,y+Math.cos(t)*10]);}return sh('g',{'data-porthole-sky':'moon'},a.inkV(p,1.1));}
 // R24: the day/week/season switch hangs from the top bar inside a hand-drawn pill instead of a CSS border.
 function switchFrame(){const Wd=192,H=38,r=17,p: Point[]=[];for(let i=0;i<=56;i++){const t=i/56,L=2*(Wd-2*r)+2*Math.PI*r,u=t*L,j=Math.sin(i*1.7)*.35;let x: number,y: number;if(u<Wd-2*r){x=r+u;y=1.5;}else if(u<Wd-2*r+Math.PI*r){const q=(u-(Wd-2*r))/r-Math.PI/2;x=Wd-r+Math.cos(q)*(r-1.5);y=H/2+Math.sin(q)*(H/2-1.5);}else if(u<2*(Wd-2*r)+Math.PI*r){x=Wd-r-(u-(Wd-2*r)-Math.PI*r);y=H-1.5;}else{const q=(u-2*(Wd-2*r)-Math.PI*r)/r+Math.PI/2;x=r+Math.cos(q)*(r-1.5);y=H/2+Math.sin(q)*(H/2-1.5);}p.push([x,y+j]);}
 return svg('svg',{class:'review-switch-frame',viewBox:`0 0 ${Wd} ${H}`,'aria-hidden':'true'},svg('path',{d:`M${p.map(q=>q.map(v=>v.toFixed(1)).join(',')).join('L')}Z`,fill:a.PAPER}),partNodes(parts(ink(p,1.3),ink([[Wd/3,7],[Wd/3+.4,H-7]],.5,a.TICK),ink([[Wd*2/3,7],[Wd*2/3-.4,H-7]],.5,a.TICK))));}
 function render(){const root=$('#review')!,mode=ui.reviewPeriod;root.dataset.period=mode;root.classList.toggle('is-quarter',mode==='quarter');setNodes(root,()=>[h('div',{class:'review-switch'},switchFrame(),[['day','日'],['week','周'],['quarter','季']].map(([key,label])=>B('review-mode',key,label,label,{'aria-pressed':String(key===mode)}))),mode==='quarter'?quarterPage():h('div',{class:'log-book'},mode==='day'?dayPage():weekPage())]);}
 function changeScore(id: string,value: number|null){const r=d.review.wheel.find(r=>r.id===id)!;r.value=value;ui.wheelMenu=null;a.update();($('[data-wheel="'+id+'"]'))?.focus();}
 function action(key: string,id: string){if(key==='wheel-clear'){changeScore(id,null);return true;}if(!key.startsWith('review-'))return false;if(key==='review-mode')ui.reviewPeriod=id;else if(key==='review-prev'){ui.reviewPeriod='day';ui.reviewDay=Math.max(0,ui.reviewDay-1);}else if(key==='review-next'){ui.reviewPeriod='day';ui.reviewDay=Math.min(6,ui.reviewDay+1);}else if(key==='review-source')ui.reviewSource=!ui.reviewSource;else if(key==='review-trend')return true;a.update();return true;}
 function wheelMenu(id: string){ui.wheelMenu=id;a.update();($('.wheel-editor input'))?.focus();}
 function pointerdown(e: PointerEvent){const node=tgt(e).closest<SVGGElement>('[data-wheel]');if(!node)return;const id=node.dataset.wheel!,rose=node.ownerSVGElement!,box=rose.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2;ui.wheelDragging=id;node.setPointerCapture?.(e.pointerId);const move=(ev: Event)=>{const pe=ev as PointerEvent,radius=Math.hypot(pe.clientX-cx,pe.clientY-cy)/Math.min(box.width/580,box.height/520),score=Math.max(1,Math.min(10,Math.round((radius-45)/110*10)));d.review.wheel.find(r=>r.id===id)!.value=score;replaceWithNodes($('.quarter-rose')!,roseEl);};const end=()=>{HOST.removeEventListener('pointermove',move);HOST.removeEventListener('pointerup',end);ui.wheelDragging=null;a.update();};HOST.addEventListener('pointermove',move);HOST.addEventListener('pointerup',end,{once:true});e.preventDefault();}
 function hover(e: Event,show: boolean){const b=tgt(e).closest<HTMLElement>('.trend-point');if(!b)return;const value=$('#review-trend-value');if(!value)return;value.hidden=!show;if(show){const i=Number(b.dataset.id);value.textContent=String(d.review.trend[i]);value.style.left=b.style.left;value.classList.add('is-placed');}}
 // R21 cabin: pale plank wall, a bound logbook with page stacks on the desk, a bolted porthole onto the sea,
 // a hanging lantern and the quill. Line only; the reference's colour and furniture are reduced to these objects.
 // 第 3b 期：风景（船舱、舷窗、书桌、羽毛笔）输出描述（draw/scene.ts），原来的字符串版只在风景里用，删去。画笔 inkV / a.curveV / a.circleV / a.dashV 是描述版
 const inkV=a.inkV;
 function scenery(box: DOMRect): Parts{const w=box.width,h=Math.min(box.height,HOST.bottom-box.top),quarter=ui.reviewPeriod==='quarter',circle=a.circleV;
 // R23: the season is one plain sheet again (as in R21), with only a pale water line along its foot.
 if(quarter){const q: Parts[]=[a.curveV([[0,h-12],[w*.18,h-15],[w*.36,h-11],[w*.55,h-14],[w*.74,h-10],[w,h-13]],.7,a.SECONDARY)];for(let i=0;i<9;i++){const x=w*(.05+i*.11)+((i*37)%29),y=h-6+(i%2)*2;q.push(a.curveV([[x,y],[x+14,y-.6],[x+30,y]],.5,a.TICK));}return sh('g',{'data-quarter-sheet':true},q);}
 // R24 cabin: the book takes 82% of the width; the cabin column on the right is narrower and carries the detail —
 // a curtain rod with tied-back drapes round the porthole, the lantern, a small shelf (hourglass, ship in a bottle,
 // two books), and on the desk a brass compass, a tied chart roll and the quill in its inkwell, all in ink.
 const P=a.PAPER,F=(p: Point[],c=P)=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z`,fill:c}),desk=h-38,top=14,x0=w*.858,cw=w-x0;const wall: Parts[]=[];
 for(let x=x0+14;x<w;x+=30)wall.push(a.curveV([[x,top+12],[x+.6,desk*.5],[x,desk-2]],.55,a.TICK));for(let x=0;x<x0;x+=46)wall.push(a.curveV([[x,top],[x+.5,top+26]],.5,a.TICK,{opacity:'.7'}));
 wall.push(inkV([[0,top],[w,top]],.8,a.TICK),F([[x0,top],[w,top],[w,top+12],[x0,top+12]]),inkV([[x0,top+12],[w,top+12]],1.1),inkV([[x0,top],[x0,desk]],.9,a.SECONDARY));const s: Parts[]=[sh('g',{'data-cabin-wall':true},wall)];
 const bw=w*.838,x=12,y=46,bottom=h-72,midx=bw*.5;
 // Cover and the page stacks under each page, then the two pages with a curled outer corner.
 s.push(F([[x-8,y+4],[bw+8,y+4],[bw+10,bottom+18],[x-10,bottom+18]]),inkV([[x-8,y+4],[midx,y+14],[bw+8,y+4],[bw+10,bottom+18],[midx,bottom+26],[x-10,bottom+18],[x-8,y+4]],1.5));
 for(let i=1;i<=4;i++){const dy=i*2.6;s.push(inkV([[x+2-i,bottom+dy],[midx-12,bottom+6+dy],[midx,bottom+14+dy]],.55,a.SECONDARY),inkV([[midx,bottom+14+dy],[midx+12,bottom+6+dy],[bw+i-2,bottom+dy]],.55,a.SECONDARY));}
 const left: Point[]=[[x+10,y],[midx-12,y+6],[midx,y+15],[midx-2,bottom+10],[midx-12,bottom+6],[x,bottom]],right: Point[]=[[midx,y+15],[midx+12,y+6],[bw-10,y],[bw,bottom],[midx+12,bottom+6],[midx-2,bottom+10]];
 s.push(F(left),F(right),inkV([...left,left[0]],1.4),inkV([...right,right[0]],1.4),inkV([[midx,y+15],[midx-2,bottom+10]],1.1));
 for(let i=0;i<10;i++){const yy=y+40+i*(bottom-y-60)/9;s.push(inkV([[midx-10,yy],[midx-3,yy+2]],.4,a.TICK),inkV([[midx+2,yy+2],[midx+9,yy]],.4,a.TICK));}
 s.push(inkV([[bw-40,y+2],[bw-14,y-1],[bw-24,y+18]],.9,a.SECONDARY));
 s.push(inkV([[0,desk],[w*.5,desk+1],[w,desk]],1.5),inkV([[0,desk+8],[w,desk+8]],.7,a.SECONDARY),a.curveV([[40,desk+4],[300,desk+3.6],[620,desk+4.4]],.45,a.TICK),a.curveV([[w*.55,desk+4],[w*.8,desk+3.4],[w-30,desk+4]],.45,a.TICK));
 // Porthole: brass ring with bolts, sea, a far island and the sun or moon.
 const r=Math.min(54,cw*.31),cx=x0+cw*.56,cy=top+40+r,port: Parts[]=[circle(cx,cy,r+10,1.6),circle(cx,cy,r,1.3)];for(let i=0;i<10;i++){const t=i*Math.PI/5;port.push(circle(cx+Math.cos(t)*(r+5),cy+Math.sin(t)*(r+5),1.5,.8));}
 const win: Parts[]=[inkV([[cx-r,cy+14],[cx+r,cy+14]],1.1),a.curveV([[cx-r,cy+14],[cx-32,cy+6],[cx-18,cy+1],[cx-4,cy+9],[cx+6,cy+14]],.9,a.SECONDARY)];
 for(let i=0;i<6;i++){const yy=cy+22+i*7,len=12+i*4;for(let k=0;k<3;k++){const xx=cx-r+14+k*r*.66+((i*17)%19);win.push(a.curveV([[xx,yy],[xx+len/2,yy-.6],[xx+len,yy]],.55,i%2?a.TICK:a.SECONDARY));}}
 for(const[xx,yy,k]of [[cx-32,cy-30,.5],[cx+8,cy-40,.4]])win.push(a.curveV([[xx,yy],[xx+10*k,yy-6*k],[xx+24*k,yy-7*k],[xx+36*k,yy-2*k],[xx+50*k,yy]],.6,a.TICK));
 // 疑似问题批 F5：视图不可见时船舱宽 cw = 0，舷窗半径 r = 0，剪裁圆原来写出 r="-1"；夹到 0
 win.push(skyDiscV(cx+22,cy-8));port.push(sh('defs',null,sh('clipPath',{id:'review-window-clip'},sh('circle',{cx,cy,r:Math.max(0,r-1)}))),sh('g',{'clip-path':'url(#review-window-clip)'},win));s.push(sh('g',{'data-morph':'porthole'},port));
 // Curtain rod over the porthole and one drape on the far side, swept back by a rope tie; the lantern keeps the
 // near side. Folds converge on the tie and fan out again below it.
 const rod=top+24,rl=cx-r-14,rr=w-4,c: Parts[]=[inkV([[rl,rod],[rr,rod]],1.4),circle(rl-2,rod,2.6,1)];
 {const ox=rr,inner=cx+r+12,dir=-1,tie=cy+r*.25,hem=cy+r+40,pts: Point[]=[[ox,rod+2],[inner,rod+2],[inner+2,rod+26],[ox+dir*13,tie],[ox+dir*17,tie+30],[ox+dir*21,hem],[ox,hem+3]];
 c.push(F(pts),a.curveV([...pts,pts[0]],1.05));for(let k=1;k<4;k++){const fx=ox+(inner-ox)*k/4,tx=ox+dir*(3+k*3);c.push(a.curveV([[fx,rod+5],[(fx+tx)/2,(rod+tie)/2],[tx,tie-2]],.5,a.SECONDARY),a.curveV([[tx,tie+4],[tx+dir*k*1.4,(tie+hem)/2],[ox+dir*(4+k*4.5),hem-2]],.5,a.SECONDARY));}
 c.push(a.curveV([[ox+dir*15,tie-4],[ox+dir*7,tie-6],[ox,tie-3]],1),a.curveV([[ox+dir*15,tie+3],[ox+dir*7,tie+4],[ox,tie+2]],1),a.curveV([[ox+dir*15,tie-4],[ox+dir*18,tie],[ox+dir*15,tie+3]],1),a.curveV([[ox+dir*16,tie],[ox+dir*20,tie+11],[ox+dir*18,tie+19]],.8),a.curveV([[ox+dir*16,tie+1],[ox+dir*24,tie+9],[ox+dir*25,tie+16]],.7));
 for(let k=0;k<5;k++)c.push(circle(ox+(inner-ox)*k/4,rod+1,1.8,.8));}
 s.push(sh('g',{'data-cabin-curtain':true},c));
 // Lantern on a short chain from the ceiling beam, left of the porthole.
 const lx=x0+Math.max(18,cw*.1),ly=rod+52;s.push(sh('g',{'data-cabin-lantern':true},inkV([[lx,top+12],[lx,ly-30]],1),circle(lx,ly-27,3,1),sh('rect',{x:lx-9,y:ly-16,width:'18',height:'32',rx:'3',fill:'#F3E2B8',opacity:'.7'}),a.curveV([[lx-11,ly-18],[lx-9,ly-26],[lx,ly-29],[lx+9,ly-26],[lx+11,ly-18]],1.2),inkV([[lx-12,ly-18],[lx+12,ly-18]],1.3),inkV([[lx-11,ly+16],[lx+11,ly+16]],1.3),inkV([[lx-10,ly-18],[lx-10,ly+16]],1.3),inkV([[lx+10,ly-18],[lx+10,ly+16]],1.3),inkV([[lx-4,ly-17],[lx-4,ly+15]],.5,a.SECONDARY),a.curveV([[lx,ly+8],[lx-2.4,ly+3],[lx,ly-4],[lx+2.4,ly+3],[lx,ly+8]],.8,'#B88A4A'),a.curveV([[lx-8,ly+16],[lx-6,ly+22],[lx+6,ly+22],[lx+8,ly+16]],1.1)));
 // Shelf under the porthole: plank on two brackets, an hourglass, a ship in a bottle and two leaning books.
 const sy=cy+r+58;if(sy<desk-190){const o: Parts[]=[];const s0=x0+10,s1=w-8;o.push(F([[s0,sy],[s1,sy],[s1,sy+6],[s0,sy+6]]),inkV([[s0,sy],[s1,sy]],1.2),inkV([[s0,sy+6],[s1,sy+6]],1),inkV([[s0,sy],[s0,sy+6]],1));
 for(const bx of [s0+16,s1-16])o.push(inkV([[bx,sy+6],[bx,sy+22],[bx-10,sy+6]],.9));
 const hx=s0+22;o.push(inkV([[hx-9,sy],[hx+9,sy]],1.2),inkV([[hx-9,sy-30],[hx+9,sy-30]],1.2),inkV([[hx-7,sy-29],[hx-7,sy-1]],.7),inkV([[hx+7,sy-29],[hx+7,sy-1]],.7),a.curveV([[hx-5,sy-28],[hx-1,sy-17],[hx-1,sy-13],[hx-5,sy-2]],.9),a.curveV([[hx+5,sy-28],[hx+1,sy-17],[hx+1,sy-13],[hx+5,sy-2]],.9),F([[hx-4,sy-2],[hx,sy-8],[hx+4,sy-2]],'#C9CFCF'));
 const bx=hx+22,by=sy-9,bl=Math.min(64,cw*.33);o.push(F([[bx,by-8],[bx+bl-14,by-8],[bx+bl-6,by-4],[bx+bl,by-4],[bx+bl,by+4],[bx+bl-6,by+4],[bx+bl-14,by+8],[bx,by+8]]),a.curveV([[bx+6,by-8],[bx,by-6],[bx-1,by],[bx,by+6],[bx+6,by+8],[bx+bl-14,by+8],[bx+bl-6,by+4],[bx+bl,by+4],[bx+bl,by-4],[bx+bl-6,by-4],[bx+bl-14,by-8],[bx+6,by-8]],1),F([[bx+bl,by-3],[bx+bl+6,by-3],[bx+bl+6,by+3],[bx+bl,by+3]],'#D9C9A8'),inkV([[bx+bl,by-3],[bx+bl+6,by-3],[bx+bl+6,by+3],[bx+bl,by+3]],.8));
 const k=bx+bl*.38;o.push(inkV([[k-12,by+5],[k+12,by+5],[k+8,by+7],[k-9,by+7],[k-12,by+5]],.8),inkV([[k,by+5],[k,by-6]],.6),inkV([[k-1,by-5],[k-8,by+3],[k-1,by+3]],.6),inkV([[k+1,by-4],[k+7,by+3],[k+1,by+3]],.6),a.curveV([[bx+3,by+6],[bx+bl*.5,by+5],[bx+bl-14,by+6]],.4,a.TICK));
 const ex=s1-30;o.push(F([[ex,sy],[ex+11,sy],[ex+11,sy-34],[ex,sy-34]]),inkV([[ex,sy],[ex+11,sy],[ex+11,sy-34],[ex,sy-34],[ex,sy]],1),inkV([[ex+2,sy-28],[ex+9,sy-28]],.5,a.SECONDARY),F([[ex+12,sy],[ex+22,sy],[ex+30,sy-28],[ex+20,sy-30]]),inkV([[ex+12,sy],[ex+22,sy],[ex+30,sy-28],[ex+20,sy-30],[ex+12,sy]],1),inkV([[ex+19,sy-22],[ex+25,sy-21]],.5,a.SECONDARY));
 s.push(sh('g',{'data-cabin-shelf':true},o));}
 // Between shelf and desk, when there is room: a small pinned chart (coast, dashed course, star) and a rope hank on a peg.
 const my0=sy+44,qk=Math.min(1.15,cw/190),room=desk-250*qk-my0;if(sy<desk-190&&room>96){const o: Parts[]=[];const fw=Math.min(118,cw*.58),fh=Math.min(78,room-14),fx=x0+cw*.36,fy=my0;
 o.push(F([[fx,fy],[fx+fw,fy+2],[fx+fw-1,fy+fh],[fx+1,fy+fh-1]]),inkV([[fx,fy],[fx+fw,fy+2],[fx+fw-1,fy+fh],[fx+1,fy+fh-1],[fx,fy]],1.1),circle(fx+fw/2,fy+3,1.8,.9));
 o.push(a.curveV([[fx+6,fy+fh*.2],[fx+fw*.22,fy+fh*.32],[fx+fw*.18,fy+fh*.58],[fx+fw*.32,fy+fh*.86],[fx+fw*.3,fy+fh-3]],.9),a.curveV([[fx+fw-6,fy+fh*.24],[fx+fw*.8,fy+fh*.4],[fx+fw*.86,fy+fh*.62],[fx+fw*.74,fy+fh-4]],.9));
 o.push(a.dashV([[fx+fw*.3,fy+fh*.5],[fx+fw*.5,fy+fh*.38],[fx+fw*.68,fy+fh*.56]],.8,a.SECONDARY),inkV([[fx+fw*.66,fy+fh*.52],[fx+fw*.7,fy+fh*.58],[fx+fw*.64,fy+fh*.6]],.8,'#C8206A'));
 const sx=fx+fw*.5,sy2=fy+fh*.74;o.push(inkV([[sx,sy2-7],[sx+1.6,sy2-1.6],[sx+7,sy2],[sx+1.6,sy2+1.6],[sx,sy2+7],[sx-1.6,sy2+1.6],[sx-7,sy2],[sx-1.6,sy2-1.6],[sx,sy2-7]],.7));
 const px=x0+cw*.15,py=my0+4;o.push(circle(px,py,2.4,1),inkV([[px,py+2],[px-1,py+9]],1));for(let i=0;i<5;i++){const ry=Math.min(34,fh*.42)-i*.6,rx=9-i*.3;o.push(a.curveV(Array.from({length:21},(_,j): Point=>{const t=-Math.PI/2+j*Math.PI*2/20;return[px+(i-2)*.9+Math.cos(t)*rx,py+9+ry+Math.sin(t)*ry];}),i===4?1.1:.6,i===4?a.INK:a.SECONDARY));}
 o.push(a.curveV([[px-8,py+14],[px,py+17],[px+8,py+14]],.9),a.curveV([[px-8,py+18],[px,py+21],[px+8,py+18]],.9),a.curveV([[px+3,py+9+Math.min(34,fh*.42)*2-2],[px+5,py+9+Math.min(34,fh*.42)*2+10],[px+2,py+9+Math.min(34,fh*.42)*2+18]],.9));
 s.push(sh('g',{'data-cabin-chart':true},o));}
 // R25: what room is left above the quill takes a barometer dial and a spyglass resting on two hooks.
 {const qk=Math.min(1.15,cw/190),from=(sy<desk-190?sy+44:sy+30)+(sy<desk-190&&desk-250*qk-(sy+44)>96?Math.min(78,desk-250*qk-(sy+44)-14)+22:0);const o: Parts[]=[];
 const room=desk-34-from;if(room>56){const br=Math.min(26,cw*.15,room/2-12),bx=x0+cw*.3,by=from+Math.min(br+12,room*.4);o.push(sh('circle',{cx:bx,cy:by,r:br+5,fill:P}),circle(bx,by,br+5,1.3),circle(bx,by,br,.7,a.SECONDARY));for(let i=0;i<=12;i++){const t=Math.PI*(.8+i*1.4/12);o.push(inkV([[bx+Math.cos(t)*br*.8,by+Math.sin(t)*br*.8],[bx+Math.cos(t)*br*.95,by+Math.sin(t)*br*.95]],i%3?.45:.8));}
 o.push(inkV([[bx,by],[bx+br*.55,by-br*.45]],1.1),inkV([[bx,by],[bx-br*.25,by+br*.2]],.8,'#C8206A'),circle(bx,by,2,1),inkV([[bx-br-5,by-br-10],[bx,by-br-5]],.6,a.SECONDARY),circle(bx,by-br-12,1.8,.9),sh('text',{x:bx,y:by+br*.55,'text-anchor':'middle','font-size':'6',fill:a.SECONDARY,style:'font-family:var(--mono)'},'BARO'));
 if(by+br+44<desk-70){const gy=by+br+44,g0=x0+cw*.08,g1=x0+cw*.66;for(const hx of [g0+14,g1-18])o.push(inkV([[hx,gy-14],[hx,gy-4],[hx+5,gy-1]],1));o.push(F([[g0,gy-5],[g1-30,gy-7],[g1-30,gy+3],[g0,gy+4]]),inkV([[g0,gy-5],[g1-30,gy-7]],1),inkV([[g0,gy+4],[g1-30,gy+3]],1),F([[g1-30,gy-8],[g1-6,gy-10],[g1-6,gy+5],[g1-30,gy+4]]),inkV([[g1-30,gy-8],[g1-6,gy-10],[g1-6,gy+5],[g1-30,gy+4],[g1-30,gy-8]],1.1));for(const k of [.3,.55])o.push(inkV([[g0+(g1-30-g0)*k,gy-6],[g0+(g1-30-g0)*k,gy+3.6]],.7));o.push(a.curveV(Array.from({length:9},(_,i): Point=>{const t=i/8*Math.PI*2;return[g0+Math.cos(t)*2.4,gy-.5+Math.sin(t)*4.5];}),.9));
 const lr=Math.min(24,cw*.14),ly2=gy+30+lr;if(ly2+lr<desk-40){const lx2=x0+cw*.3;o.push(sh('circle',{cx:lx2,cy:ly2,r:lr,fill:P}),circle(lx2,ly2,lr,1.3),circle(lx2,ly2,lr*.52,1.1));for(let q=0;q<4;q++){const t0=q*Math.PI/2+Math.PI/4-.28,t1=t0+.56;for(let k=0;k<5;k++){const t=t0+(t1-t0)*k/4;o.push(inkV([[lx2+Math.cos(t)*lr*.55,ly2+Math.sin(t)*lr*.55],[lx2+Math.cos(t)*lr*.97,ly2+Math.sin(t)*lr*.97]],.5,a.SECONDARY));}}o.push(inkV([[lx2,ly2-lr-10],[lx2,ly2-lr]],.8),circle(lx2,ly2-lr-12,1.8,.9),a.curveV([[lx2-lr*.9,ly2-lr*.3],[lx2-lr*1.2,ly2+lr*.4],[lx2-lr*.8,ly2+lr*1.1]],.7,a.SECONDARY));}}}
 s.push(sh('g',{'data-cabin-fill':true},o));}
 s.push(deskThingsV(x0,cw,desk));return s;}
 // Desk: a brass compass in its box and a tied chart roll at the left, the inkwell and quill at the right.
 function deskThingsV(x0: number,cw: number,desk: number){const P=a.PAPER,F=(p: Point[],c=P)=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z`,fill:c}),s: Parts[]=[];
 const mx=x0+24,my=desk-6;s.push(F([[mx-20,my-4],[mx+20,my-4],[mx+20,my+5],[mx-20,my+5]]),inkV([[mx-20,my-4],[mx+20,my-4],[mx+20,my+5],[mx-20,my+5],[mx-20,my-4]],1),F([[mx-20,my-4],[mx-15,my-11],[mx+25,my-11],[mx+20,my-4]]),inkV([[mx-20,my-4],[mx-15,my-11],[mx+25,my-11],[mx+20,my-4]],.9),inkV([[mx+20,my+5],[mx+25,my-2],[mx+25,my-11]],.9));
 s.push(a.curveV(Array.from({length:25},(_,i): Point=>{const t=i/24*Math.PI*2;return[mx+2.5+Math.cos(t)*13,my-7.5+Math.sin(t)*3];}),.8),inkV([[mx-6,my-6.5],[mx+11,my-8.5]],1,'#C8206A'),inkV([[mx-6,my-6.5],[mx+2.5,my-7.5]],1.2));
if(cw>=190){const rx=mx+40,ry=desk-7;s.push(F([[rx,ry-6],[rx+46,ry-8],[rx+47,ry+5],[rx+1,ry+6]]),inkV([[rx,ry-6],[rx+46,ry-8]],1),inkV([[rx+1,ry+6],[rx+47,ry+5]],1),a.curveV(Array.from({length:13},(_,i): Point=>{const t=i/12*Math.PI*2;return[rx+46.5+Math.cos(t)*3,ry-1.5+Math.sin(t)*6.5];}),.9),a.curveV([[rx,ry-6],[rx-2.5,ry],[rx+1,ry+6]],.9),inkV([[rx+24,ry-7],[rx+24.5,ry+5.5]],1.1),a.curveV([[rx+24,ry+5],[rx+20,ry+12],[rx+16,ry+13]],.7),a.curveV([[rx+25,ry+5],[rx+30,ry+11],[rx+34,ry+12]],.7),a.curveV([[rx+8,ry-3],[rx+40,ry-4]],.4,a.SECONDARY));}
 s.push(quillV(x0+cw*.74,desk,Math.min(1.15,cw/190)));return sh('g',{'data-cabin-desk':true},s);}
 // Inkwell and quill, drawn here in ink: a squat bottle with hatched shade, a long feather with a fuller left vane,
 // barbs combed towards the tip and two split gaps, the shaft entering the neck.
 function quillV(x: number,y: number,k: number){const P=a.PAPER,F=(p: Point[],c=P)=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z`,fill:c}),s: Parts[]=[];
 const Wd=24*k,H=30*k,N=9*k,body: Point[]=[[x-Wd,y],[x-Wd-2*k,y-H*.55],[x-Wd+3*k,y-H],[x-N,y-H-4*k],[x-N,y-H-10*k],[x+N,y-H-10*k],[x+N,y-H-4*k],[x+Wd-3*k,y-H],[x+Wd+2*k,y-H*.55],[x+Wd,y]];
 const Bz=(t: number): Point=>{const u=1-t,c0=[x+2*k,y-H-6*k],c1=[x+10*k,y-150*k],c2=[x+46*k,y-218*k];return[u*u*c0[0]+2*u*t*c1[0]+t*t*c2[0],u*u*c0[1]+2*u*t*c1[1]+t*t*c2[1]];};
 // 疑似问题批 F5：视图不可见时船舱宽 cw = 0，缩放 k = 0，羽杆缩成一点，相邻两点重合 l = 0，原来 0/0 得 NaN（羽片三条路径 “MNaN,NaN…”、羽枝 “M0.0,-38.0QNaN…”）；重合时法线取 0
 const pts=Array.from({length:41},(_,i)=>Bz(i/40)),nrm=(i: number)=>{const p=pts[Math.max(0,i-1)],q=pts[Math.min(40,i+1)],l=Math.hypot(q[0]-p[0],q[1]-p[1]);return l?[(q[1]-p[1])/l,-(q[0]-p[0])/l]:[0,0];};
 const vane=(side: number,wd: number)=>pts.map((p,i): Point=>{const t=i/40,f=t<.3?0:Math.pow(Math.sin(Math.PI*Math.min(1,(t-.3)/.7)),.75)*(t>.93?.6:1),gap=(side<0&&Math.abs(t-.62)<.02)||(side>0&&Math.abs(t-.48)<.02)?.55:1,[nx,ny]=nrm(i);return[p[0]+nx*wd*k*f*gap*side,p[1]+ny*wd*k*f*gap*side];});
 const L1=vane(-1,17),R1=vane(1,10);s.push(F([...L1.slice(12),...R1.slice(12).reverse()]),a.curveV(L1.slice(11),1),a.curveV(R1.slice(11),.9));
 let barbs='';for(let i=13;i<39;i++){for(const[side,V]of [[-1,L1],[1,R1]] as [number,Point[]][]){const j=Math.min(40,i+2),p=pts[i],q=V[j];barbs+=`M${p[0].toFixed(1)},${p[1].toFixed(1)}Q${((p[0]+q[0])/2+(side<0?-1:1)*1.2*k).toFixed(1)},${((p[1]+q[1])/2+1.5*k).toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`;}}
 s.push(sh('path',{d:barbs,fill:'none',stroke:a.SECONDARY,'stroke-width':(.45*k+.15).toFixed(2),'stroke-linecap':'round',opacity:'.8'}));
 for(let i=6;i<13;i++){const p=pts[i],[nx,ny]=nrm(i);s.push(inkV([[p[0],p[1]],[p[0]-nx*(4+(i%3))*k,p[1]-ny*(4+(i%3))*k+3*k]],.45,a.SECONDARY));}
 s.push(a.curveV(pts,1.3),a.curveV(pts.slice(0,30).map(([px,py]): Point=>[px+.9,py]),.5,a.SECONDARY));
 s.push(F(body),a.curveV([...body,body[0]],1.3),a.curveV(Array.from({length:17},(_,i): Point=>{const t=i/16*Math.PI*2;return[x+Math.cos(t)*N,y-H-10*k+Math.sin(t)*2.6*k];}),1),sh('ellipse',{cx:x.toFixed(1),cy:(y-H-10*k).toFixed(1),rx:(N-2*k).toFixed(1),ry:(1.6*k).toFixed(1),fill:a.INK}));
 for(let i=0;i<7;i++){const hx=x+Wd*.25+i*Wd*.11;s.push(inkV([[hx,y-2*k],[hx+5*k,y-H*.78]],.5,a.SECONDARY));}s.push(a.curveV([[x-Wd+3*k,y-H*.62],[x,y-H*.68],[x+Wd-3*k,y-H*.62]],.5,a.SECONDARY),a.curveV([[x-Wd-8*k,y+1],[x,y+2.5],[x+Wd+14*k,y+1]],.6,a.TICK));
 return sh('g',{'data-cabin-quill':true},s);}
 return{render,action,scenery,pointerdown,pointerover:(e: Event)=>hover(e,true),pointerout:(e: Event)=>hover(e,false),focusin:(e: Event)=>hover(e,true),focusout:(e: Event)=>hover(e,false),submit(f: HTMLFormElement){if(f.dataset.p2Form!=='wheel')return false;const v=Number((f.elements.namedItem('score') as HTMLInputElement).value);if(v>=1&&v<=10)changeScore(ui.wheelMenu!,v);return true;},key(e: KeyboardEvent){if(ui.page!=='review')return false;const node=tgt(e).closest<SVGGElement>('[data-wheel]');if(node){const r=d.review.wheel.find(r=>r.id===node.dataset.wheel)!;if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End','Delete','Backspace'].includes(e.key)){e.preventDefault();const v=e.key==='Home'?1:e.key==='End'?10:['Delete','Backspace'].includes(e.key)?null:Math.max(1,Math.min(10,(r.value||1)+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1)));changeScore(r.id,v);return true;}if(e.key==='Enter'||e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){e.preventDefault();wheelMenu(r.id);return true;}}if(ui.reviewPeriod==='day'&&['ArrowLeft','ArrowRight'].includes(e.key)&&!e.altKey){e.preventDefault();action(e.key==='ArrowLeft'?'review-prev':'review-next','');return true;}return false;},context(e: Event){const node=tgt(e).closest<SVGGElement>('[data-wheel]');if(node){wheelMenu(node.dataset.wheel!);return true;}return false;}};
}
