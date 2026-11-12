import {HOST} from '../../host.js';
// R39 “?”说明层（paper.js 只 import 这个文件）。以前每条说明是写死的像素坐标加一个固定偏移画箭头，和页面元素的真实位置无关，
// 布局一变（字号、窗口、R31 以来的改版）就指偏；有几条文字也已经不对（马灯 R23 起没有开关、日视图没有花瓣）。
// 现在每条说明绑定一个元素：说明放在它旁边的空处，手画箭头从说明的边缘画到那个元素的边上。
// paper.js 的 renderHelp() 照旧写 #help，这里在它之后把内容换掉；只要 #help 显示着，换页、改窗口、切灯塔都会重新量。
const $=s=>HOST.querySelector(s),$$=s=>[...HOST.querySelectorAll(s)];
const NS='http://www.w3.org/2000/svg';
// [选择器, 说明, 首选方位 (above|below|left|right)]；选择器只在当前页（不含正在离场的旧页）里找，取第一个可见的
const NOTES={
 thought:()=>HOST.paper?.data?.ui?.lamp===false?[
  ['#lighthouse-toggle','点灯塔，回到规划','below'],
  ['#thought .idea-star,#thought [data-idea-star],#thought .idea-card','点星星回看想法','below'],
  ['#thought .idea-composer,#idea-input','点空白处记下新想法','above']]:[
  ['#lighthouse-toggle','点灯塔，在规划和想法之间切换','below'],
  ['#thought .smear-progress','涂抹表示本周投入占计划的比例','below'],
  ['#thought .day-column:not(.is-today) .plan-task','把任务拖到另一天即可改期','right']],
 ai:()=>[
  ['#ai .flag-button','点一面旗，右侧提示词库同步显示','below'],
  ['#ai .native-model-trigger','选择这一段对话使用的模型','left'],
  ['#ai .native-prompt-actions button','把提示词带入下方对话，或直接复制','below']],
 today:()=>[
  ['#today .focus-primary .complete','完成正在推进的这一件事','below'],
  ['#today [data-action="choose-focus"]','从今天的任务里挑选重点','below'],
  ['#scenery [data-morph="boat"]','品红小船是此刻；旁边的浮标是日程','above'],
  ['#today #habits > *','三态笔触记录习惯，后面是最近 7 天','above'],
  ['#today .dial','拖动拨盘给每日问题打分','right']],
 tasks:()=>[
  ['#tasks .cargo-compose-toggle','加号记下一项新任务','above'],
  ['#tasks .cargo-row [data-p2="task-menu"]','行尾“…”可排到今天、移到清单或标为待沟通','left'],
  ['#tasks .cargo-mailbag','把任务拖到口袋上，交给这个人','below'],
  ['#tasks .cargo-crate','把任务拖到木箱上，放进这个清单','above'],
  ['#tasks .cargo-archive','角落的旧箱子收着归档清单','above']],
 projects:()=>[
  ['#projects .chart-zone-label','四片水域：计划中、进行中、暂停、已完成','below'],
  ['#projects [data-p2="project-open"]','点船展开；拖到另一片水域改状态','below'],
  ['#projects .pd-station','里程碑航程就是项目的进度条目','right']],
 review:()=>{const m=HOST.paper?.data?.ui?.reviewPeriod||'day';return [
  ['#review .review-switch','日、周、季是同一本日志的三种读法','below'],
  ...(m==='day'?[['#review [data-p2="review-prev"]','左右箭头翻到前一天、后一天','below'],['#review .log-right .log-page-head','右页是往年的今天','below']]:[]),
  ...(m==='quarter'?[['#review .q-wheel svg,#review .q-wheel','拖动花瓣给各个领域打分，也能用方向键','right']]:[]),
  ...(m==='week'?[['#review .week-log-row,#review .log-week tr','七天各占一行，合计在最下面','right']]:[])];},
 library:()=>HOST.paper?.data?.ui?.libraryView==='shelf'?[
  ['#library .lib-back,#library [data-p2="library-view"]','回到深海视图','below']]:[
  ['#library [data-p2="library-knot"]','绳结是阅读深度，旁边写着深度范围','right'],
  ['#library .library-sign','悬停看结论；拖到别的绳结改阶段','below'],
  ['#library .lib-view-toggle','进入书架视图，写自己的笔记','below']],
 brain:()=>[
  ['#brain .brain-chips','按类型筛选节点','below'],
  ['#brain .brain-node','点选保留关联；“去…页”跳到它所在的页','below'],
  ['#brain .brain-rank','右侧列出关联最多的节点','left']]};
const pick=sel=>{for(const s of sel.split(','))for(const e of $$(s.trim())){if(e.closest('.r35-leaving,[hidden]'))continue;const r=e.getBoundingClientRect();if(r.width>2&&r.height>2&&r.bottom>0&&r.top<HOST.bottom&&getComputedStyle(e).visibility!=='hidden')return e;}return null;};
const over=(a,b,m=0)=>!(a.x+a.w+m<=b.x||b.x+b.w+m<=a.x||a.y+a.h+m<=b.y||b.y+b.h+m<=a.y);
// 手画箭头：一条略弯的线加两笔箭头，起点在说明的边上，终点停在目标边外 4px
function arrow(x1,y1,x2,y2,seed){const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,bend=(seed%2?1:-1)*Math.min(18,L*.12);
 const cx=(x1+x2)/2+nx*bend,cy=(y1+y2)/2+ny*bend,a=Math.atan2(y2-cy,x2-cx),h=9;
 const head=`M${(x2-h*Math.cos(a-.45)).toFixed(1)},${(y2-h*Math.sin(a-.45)).toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}L${(x2-h*Math.cos(a+.45)).toFixed(1)},${(y2-h*Math.sin(a+.45)).toFixed(1)}`;
 return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="${head}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;}
// 矩形边上离 (px,py) 最近的点
function edge(r,px,py,pad=0){const x0=r.x-pad,y0=r.y-pad,x1=r.x+r.w+pad,y1=r.y+r.h+pad,cx=Math.max(x0,Math.min(x1,px)),cy=Math.max(y0,Math.min(y1,py));
 if(px>x0&&px<x1&&py>y0&&py<y1){const d=[px-x0,x1-px,py-y0,y1-py],k=d.indexOf(Math.min(...d));return k===0?[x0,py]:k===1?[x1,py]:k===2?[px,y0]:[px,y1];}return[cx,cy];}
let sig='',building=false;
function build(){const help=$('#help');if(!help||help.hidden){sig='';return;}if(!help.querySelector('.r39-note'))sig='';/* paper.js 刚重写过 */const page=HOST.paper?.data?.ui?.page,defs=NOTES[page]?.();if(!defs)return;
 const H=help.getBoundingClientRect(),view=(R=>({x:R.left-H.left+8,y:R.top-H.top+8,w:R.width-16,h:R.height-16}))(HOST.root.getBoundingClientRect());
 const targets=defs.map(([s,t,side])=>{const e=pick(s);if(!e)return null;const r=e.getBoundingClientRect();return{e,t,side,r:{x:r.left-H.left,y:r.top-H.top,w:r.width,h:r.height}};}).filter(Boolean);
 const key=page+'|'+targets.map(x=>x.t+Object.values(x.r).map(Math.round).join(',')).join('|')+'|'+HOST.innerWidth+'x'+HOST.innerHeight;targets.forEach((x,i)=>{if(x.e.dataset.helpTarget!==String(i))x.e.dataset.helpTarget=String(i);});/* 风景重画后目标是新元素：位置没变也要重新标记 */
 if(key===sig)return;sig=key;
 // 先把说明量出大小
 building=true;help.innerHTML=targets.map(x=>`<div class="help-note r39-note">${x.t}</div>`).join('');const boxes=[...help.children].map(n=>({w:Math.ceil(n.offsetWidth),h:Math.ceil(n.offsetHeight)}));
 const placed=[],avoid=targets.map(x=>x.r).concat([...HOST.querySelectorAll('.rail,.page-head,#compass-toggle,#capture-toggle')].map(e=>{const r=e.getBoundingClientRect();return{x:r.left-H.left,y:r.top-H.top,w:r.width,h:r.height};}));
 // 这一页的文字行与控件也要避开（说明的纸色底会把它们盖住）
 const sec=HOST.byId(page),ink=[];if(sec){const rg=document.createRange(),w=document.createTreeWalker(sec,NodeFilter.SHOW_TEXT);let n=0;
  while(w.nextNode()&&n<900){const t=w.currentNode;if(!t.textContent.trim()||t.parentElement.closest('svg,[hidden],.r35-leaving'))continue;rg.selectNodeContents(t);for(const r of rg.getClientRects()){if(r.width&&r.bottom>0&&r.top<HOST.bottom){ink.push({x:r.left-H.left,y:r.top-H.top,w:r.width,h:r.height});n++;}}}
  for(const e of sec.querySelectorAll('button,input,textarea,.dial,.cargo-crate,.cargo-mailbag,.flag-button,.brain-node,.library-sign')){const r=e.getBoundingClientRect();if(r.width&&r.width<420&&r.height<320&&r.bottom>0&&r.top<HOST.bottom)ink.push({x:r.left-H.left,y:r.top-H.top,w:r.width,h:r.height});}}
 const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 const GAP=46,out=[];
 targets.forEach((x,i)=>{const {w,h}=boxes[i],r=x.r,cx=r.x+r.w/2,cy=r.y+r.h/2;const order={above:['above','below','right','left'],below:['below','above','right','left'],left:['left','right','below','above'],right:['right','left','below','above']}[x.side];
  const cand=[];for(const s of order)for(const k of [0,-1,1,-2,2,-3,3])for(const g of [GAP,GAP+34,GAP+80]){const shift=k*Math.max(w,h)*.45;
   const p=s==='above'?{x:cx-w/2+shift,y:r.y-g-h}:s==='below'?{x:cx-w/2+shift,y:r.y+r.h+g}:s==='left'?{x:r.x-g-w,y:cy-h/2+shift*.5}:{x:r.x+r.w+g,y:cy-h/2+shift*.5};
   const b={x:Math.max(view.x,Math.min(view.x+view.w-w,p.x)),y:Math.max(view.y,Math.min(view.y+view.h-h,p.y)),w,h};
   const cost=placed.filter(q=>over(b,q,10)).length*100+avoid.filter(q=>over(b,q,4)).length*40+ink.reduce((n,q)=>n+area(b,q),0)/40+Math.abs(b.x-p.x)/20+Math.abs(b.y-p.y)/20+Math.abs(k)*2+order.indexOf(s)*3+(g-GAP)/6;cand.push([cost,b]);}
  cand.sort((a,b)=>a[0]-b[0]);const b=cand[0][1];placed.push(b);
  // 箭头：从说明边上离目标最近的点，画到目标边外 4px
  const [tx,ty]=edge(r,b.x+b.w/2,b.y+b.h/2,4),[sx,sy]=edge(b,tx,ty,2);
  out.push({b,arrow:arrow(sx-b.x,sy-b.y,tx-b.x,ty-b.y,i),tip:[tx,ty],target:i});});
 help.innerHTML=out.map((o,i)=>`<div class="help-note r39-note" data-help-target="${i}" style="left:${o.b.x}px;top:${o.b.y}px" data-tip="${o.tip.map(v=>v.toFixed(1)).join(',')}"><svg class="r39-arrow" width="1" height="1" aria-hidden="true">${o.arrow}</svg>${targets[i].t}</div>`).join('');
 targets.forEach((x,i)=>{x.e.dataset.helpTarget=String(i);});building=false;}
let queued=false;
function settle(){if(queued||building)return;queued=true;requestAnimationFrame(()=>{queued=false;build();});}
// 只在说明显示时才盯整页（R39：说明收起时什么也不做，不给过场添负担）
const page=new MutationObserver(ms=>{if(building)return;if(ms.every(m=>m.target.closest?.('#help')&&m.target.id!=='help'&&[...m.addedNodes].every(n=>n.classList?.contains('r39-note'))))return;settle();});
let tick=0;
function watch(){const help=$('#help');if(!help)return;const on=!help.hidden;
 if(on&&!tick){page.observe(HOST.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-pressed','class']});tick=setInterval(()=>{if(!HOST.root.hasAttribute('data-r35-run'))settle();},400);settle();}
 else if(!on&&tick){page.disconnect();clearInterval(tick);tick=0;sig='';}
 else if(on)settle();}
(function hook(){const help=$('#help');if(!help){requestAnimationFrame(hook);return;}new MutationObserver(watch).observe(help,{attributes:true,attributeFilter:['hidden'],childList:true});watch();})();
addEventListener('resize',()=>{sig='';if(tick)settle();});
