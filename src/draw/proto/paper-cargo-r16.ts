import {HOST} from '../../host.ts';
import {sh, parts, partNodes} from '../scene.ts';
import type {Parts, Shape} from '../scene.ts';
import {randomFor} from '../ink.ts';
import type {Point} from '../ink.ts';
import {setNodes} from '../dom.ts';
import type {Attrs} from '../dom.ts';
import type {ProtoApi} from './paper-tasks.ts';
// R16: engraved hold timber, laid rope, drawstring sacks, framed plank crates and a hinged archive crate.
// 第 3b2 期：货舱的梁、舱口、栏杆、绳索、地板字符串版与旧版 scene 已被 R23 取代，删去（scene 里重置 rand 种子的那一句随之删去；
// 它本来就不会被调用，地板木纹的 rand 不重置是已知问题，不在本期修）。留下箱子、归档箱、导航小图与地板描述版。
// 第 3c 期：木纹按对象确定。原来各处共用闭包里的一个 rand（种子只在已删的旧 scene 里重置），木纹随“之前画过几只箱子、重画过几次”而变，
// 货舱风景的描述每次都不同、复用不上节点。现在每一处木纹从自己的种子起一个新序列：地板固定种子；清单箱按清单 id 的字符串散列
// （randomFor）；归档箱、收件箱那堆各用固定种子加序号。同一份数据、同一尺寸，重画多少次、先画哪个，结果都相同。
// 生成器（线性同余）与笔画的数量、长短、抖动都没变，只是序列固定下来。
// 第 3e 期：转 TypeScript。箱子、归档箱、导航小图也改成描述版（draw/scene.ts；货单模板改成节点构建，由 partNodes 建节点），
// 字符串版删去；归档箱盖子的逐帧动画改用 setNodes 换掉三个 <g> 的内容（原来写 innerHTML）。几何、笔画的先后与木纹种子都没变。
// 原来 R16 的归档箱自带一盘绳，R23 用字符串剪接换成自己的盘绳（R16 那盘从未显示）；现在由 R23 直接把盘绳交给 archiveV，R16 的那盘删去。
/** 一只箱子的木纹随机序列（0–1） */
type Rand = () => number;
export function cargoR16(a: ProtoApi){
 const {d,inkV:LV,curveV:CV,INK:I,SECONDARY:M,TICK:T,PAPER:P}=a;
 const ellipse33=(x: number,y: number,rx: number,ry: number)=>Array.from({length:33},(_,i): Point=>[x+Math.cos(i*Math.PI/16)*rx,y+Math.sin(i*Math.PI/16)*ry]);
 const EV=(x: number,y: number,rx: number,ry: number,n=1,c=I)=>CV(ellipse33(x,y,rx,ry),n,c);
 const fillD=(p: Point[])=>`M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z`;
 const FV=(p: Point[],c=P)=>sh('path',{d:fillD(p),fill:c});
 const OV=(p: Point[],n=1.3,c=I,attrs: Attrs|null=null)=>LV([...p,p[0]],n,c,attrs);
 // 从种子 n 起一个新的伪随机序列（0–1；与原来共用的 rand 是同一个生成器）
 const seeded=(n: number): Rand=>()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 const FLOOR_SEED=40917,ARCHIVE_SEED=52011;
 // Grain that follows a board, broken into a few long strokes with knots.
 // 第 3b 期：几何（grainStrokes）与输出分开（第 3e 期起只剩描述版 grainV）
 function grainStrokes(rand: Rand,x: number,y: number,w: number,h: number,lines=3,knot=true){const out: [Point[],number,string,boolean][]=[];for(let i=0;i<lines;i++){const yy=y+h*(i+1)/(lines+1);let xx=x+2+rand()*w*.1;while(xx<x+w-6){const len=Math.min(x+w-2-xx,w*(.22+rand()*.4));out.push([[[xx,yy+(rand()-.5)],[xx+len*.5,yy+(rand()-.5)*1.2],[xx+len,yy+(rand()-.5)]],.4,i%2?M:T,true]);xx+=len+3+rand()*8;}}if(knot&&w>60){const kx=x+w*(.2+rand()*.6),ky=y+h*(.3+rand()*.4);out.push([Array.from({length:13},(_,i): Point=>[kx+Math.cos(i*Math.PI/6)*4,ky+Math.sin(i*Math.PI/6)*1.3]),.42,M,false]);}return out;}
 const grainV=(rand: Rand,x: number,y: number,w: number,h: number,lines=3,knot=true)=>grainStrokes(rand,x,y,w,h,lines,knot).map(([p,n,c,faded])=>CV(p,n,c,faded?{opacity:'.8'}:null));
 function twistedV(p: Point[],n=2,step=5.5){const s: Parts[]=[CV(p,n,I)];for(let i=1;i<p.length;i++){const[a0,a1]=p[i-1],[b0,b1]=p[i],len=Math.hypot(b0-a0,b1-a1),ux=(b0-a0)/len,uy=(b1-a1)/len,w=n*1.05;for(let t=step*.5;t<len;t+=step){const x=a0+ux*t,y=a1+uy*t;s.push(LV([[x+uy*w-ux*1.3,y-ux*w-uy*1.3],[x-uy*w+ux*1.3,y+ux*w+uy*1.3]],.45,M));}}return s;}

 // 货舱地板的描述版（R23 的风景用）
 function floorV(w: number,h: number){const s: Parts[]=[sh('path',{d:fillD([[0,h-20],[w,h-20],[w,h],[0,h]]),fill:P}),LV([[0,h-20],[w,h-20]],1.8),LV([[0,h-14],[w,h-14]],.7,M)];for(let i=0;i<14;i++){const x=i*w/13;s.push(LV([[x,h-14],[x-18,h]],.55,T),CV(ellipse33(x+6,h-17,.7,.5),.6,M));}s.push(grainV(seeded(FLOOR_SEED),0,h-13,w,12,2,false));return sh('g',{'data-cargo-floor':true},s);}

 // Framed plank crate: front frame boards, inner planks, nails, hatched top and side.
 // rand：这只箱子木纹的随机序列（调用方按箱子的身份给）
 function plankCrateV(x: number,y: number,w: number,h: number,depth: number,{plate=false,faint=false,rand}: {plate?: boolean; faint?: boolean; rand: Rand}){const dx=depth*.8,dy=depth*.55,col=faint?M:I,top: Point[]=[[x,y],[x+dx,y-dy],[x+w+dx,y-dy],[x+w,y]],side: Point[]=[[x+w,y],[x+w+dx,y-dy],[x+w+dx,y+h-dy],[x+w,y+h]],front: Point[]=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],b=Math.max(4,Math.min(8,w*.075));
 const s: Parts[]=[FV(top,'#EEF0EC'),FV(side,'#E6E9E5'),FV(front),OV(top,1.2,col),OV(side,1.2,col),OV(front,1.5,col)];
 s.push(OV([[x+b,y+b],[x+w-b,y+b],[x+w-b,y+h-b],[x+b,y+h-b]],.8,col));const rows=Math.max(2,Math.round((h-2*b)/12));for(let i=1;i<rows;i++){const yy=y+b+(h-2*b)*i/rows;s.push(LV([[x+b,yy],[x+w-b,yy]],.55,M));}
 s.push(grainV(rand,x+b,y+b,w-2*b,h-2*b,rows,w>40));s.push(LV([[x+b,y+h-b],[x+w-b,y+b]],.6,T));
 for(const[px,py]of [[x+b/2,y+b/2],[x+w-b/2,y+b/2],[x+b/2,y+h-b/2],[x+w-b/2,y+h-b/2]])s.push(EV(px,py,.75,.75,.6,col));
 for(let t=.08;t<.98;t+=.075)s.push(LV([[x+w+dx*t,y-dy*t+2],[x+w+dx*t,y+h-dy*t-2]],.36,M,{opacity:'.65'}));
 for(let t=.12;t<.95;t+=.1)s.push(LV([[x+w*t+2,y-1],[x+w*t+dx-1,y-dy+1]],.34,M,{opacity:'.5'}));
 if(plate){const px=x+w*.17,pw=w*.66,py=y+h*.22,ph=h*.56;s.push(FV([[px,py],[px+pw,py],[px+pw,py+ph],[px,py+ph]]),OV([[px,py],[px+pw,py],[px+pw,py+ph],[px,py+ph]],.9,col),EV(px+3,py+3,.6,.6,.5),EV(px+pw-3,py+3,.6,.6,.5));}
 return s;}
 // viewBox 150 × 126; the label plate spans 17%–67% horizontally.
 // key：清单的 id（木纹由它决定，箱子换了位置木纹跟着走）
 function crate(key: string){return sh('g',{'data-cargo-list-crate':true},plankCrateV(6,34,118,86,26,{plate:true,rand:randomFor('cargo-crate|'+key)}));}
 function newCrate(){const x=6,y=34,w=118,h=86,dx=20.8,dy=14.3;return parts(a.dashV([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],1.2),a.dashV([[x,y],[x+dx,y-dy],[x+w+dx,y-dy],[x+w+dx,y+h-dy],[x+w,y+h]],1),LV([[x+w*.5-13,y+h*.5],[x+w*.5+13,y+h*.5]],1.4),LV([[x+w*.5,y+h*.5-13],[x+w*.5,y+h*.5+13]],1.4));}
 // viewBox 140 × 140: two archived crates, a coil (R23 给) and the hinged crate on top.
 const LID={x:16,y:50,w:56,h:36,depth:18};
 function archiveV(coil: Parts): Shape{const n=d.lists.filter(l=>l.archived).length,{x,y,w,h,depth}=LID;
 const tag: Point[]=[[86,58],[136,56],[137,82],[87,84]];
 return sh('g',{'data-cargo-archive-stack':true},sh('g',{opacity:'.9'},plankCrateV(4,92,96,40,20,{faint:true,rand:seeded(ARCHIVE_SEED)}),plankCrateV(x,y,w,h,depth,{faint:true,rand:seeded(ARCHIVE_SEED+1)})),
  coil,sh('g',{'data-archive-inside':true}),sh('g',{'data-archive-lid':true}),sh('g',{'data-archive-slips':true}),
  LV([[78,50],[84,56],[88,62]],.6,M),FV(tag),OV(tag,1),EV(91,63,1.1,1.1,.6),sh('text',{x:'112',y:'75','font-size':'13.5','text-anchor':'middle',fill:I,style:'font-family:var(--sans)'},`归档 ${n}`));}
 // The lid hinges on its back edge; the open mouth shows a dark interior and the archived slips.
 function lidAt(v: number){const{x,y,w,depth}=LID,dx=depth*.8,dy=depth*.55,th=v*1.85,B0: Point=[x+dx,y-dy],B1: Point=[x+w+dx,y-dy],F0: Point=[x,y],F1: Point=[x+w,y],lift=(B: Point,Fp: Point): Point=>[B[0]+(Fp[0]-B[0])*Math.cos(th),B[1]+(Fp[1]-B[1])*Math.cos(th)-Math.sin(th)*22];return{B0,B1,F0,F1,G0:lift(B0,F0),G1:lift(B1,F1)};}
 interface ArchiveMotion { from: number; to: number; pose: number; time: number; duration: number; paused: boolean; startedAt: number; finished: boolean }
 const motion=()=>d.cache.cargoArchiveMotion as ArchiveMotion|null|undefined;
 // 三个 <g> 的内容逐帧换掉（原来写 innerHTML；结构与笔画都没变）
 const paintG=(sel: string,make: ()=>Parts)=>{for(const g of HOST.querySelectorAll(sel)){const list=parts(make());setNodes(g,()=>partNodes(list));}};
 function paintPose(){const v=motion()?.pose??(d.ui.taskArchive?1:0),q=lidAt(v),inside=[q.F0,q.F1,q.B1,q.B0],lid=[q.B0,q.B1,q.G1,q.G0];
 paintG('#tasks [data-archive-inside]',()=>{const s: Parts[]=[];if(v>.01){s.push(FV(inside,'#D9DED9'),OV(inside,.9,M));for(let i=1;i<9;i++){const t=i/9;s.push(LV([[q.F0[0]+(q.F1[0]-q.F0[0])*t,q.F0[1]-1],[q.B0[0]+(q.B1[0]-q.B0[0])*t,q.B0[1]+1]],.4,M,{opacity:'.7'}));}}return s;});
 paintG('#tasks [data-archive-slips]',()=>{const s: Parts[]=[];if(v>.15){const rise=Math.min(1,(v-.15)/.85);for(const[i,ox]of [[0,22],[1,38],[2,54]]){const yy=LID.y-8-rise*(12+i*5),r: Point[]=[[ox,yy],[ox+15,yy-1],[ox+16,yy+11],[ox+1,yy+12]];s.push(sh('g',{opacity:rise.toFixed(2)},FV(r),OV(r,.8),LV([[ox+3,yy+4],[ox+12,yy+3.6]],.5,M),LV([[ox+3,yy+7],[ox+10,yy+6.7]],.5,M)));}}return s;});
 paintG('#tasks [data-archive-lid]',()=>{const s: Parts[]=[FV(lid,v>.5?'#EEF0EC':P),OV(lid,1.2,M)];for(let i=1;i<5;i++){const t=i/5;s.push(LV([[q.B0[0]+(q.B1[0]-q.B0[0])*t,q.B0[1]],[q.G0[0]+(q.G1[0]-q.G0[0])*t,q.G0[1]]],.5,M,{opacity:'.75'}));}s.push(LV([q.G0,q.G1],1.3,M));return s;});}
 function paint(ms: number){const m=motion();if(!m){paintPose();return;}m.time=Math.max(0,Math.min(420,ms));const t=m.time/420,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;m.pose=m.from+(m.to-m.from)*e;m.finished=m.time===420;paintPose();for(const el of HOST.querySelectorAll('#tasks .cargo-archived-list') as Iterable<HTMLElement>){el.style.opacity=String(Math.min(1,m.pose*2.2));el.style.transform=`translateY(${8*(1-m.pose)}px)`;}}
 function stop(){if(d.cache.cargoArchiveRAF)HOST.cancelFrame(d.cache.cargoArchiveRAF as number);d.cache.cargoArchiveRAF=null;}
 function tick(now: number){d.cache.cargoArchiveRAF=null;const m=motion();if(!m||m.paused)return;paint(d.ui.page==='tasks'?now-m.startedAt:420);if(!m.finished)d.cache.cargoArchiveRAF=HOST.requestFrame(tick);}

 // Distinct nav marks: tray for the inbox, framed crate for lists, calendar for the coming week.
 function navGlyph(type: string): Shape|null{const S=(...k: Parts[])=>sh('svg',{viewBox:'0 0 20 20','aria-hidden':'true'},...k);if(type==='tray')return S(LV([[2,11],[6,4],[14,4],[18,11]],1.3),LV([[2,11],[2,17],[18,17],[18,11],[13,11],[12,13.5],[8,13.5],[7,11],[2,11]],1.3));if(type==='crate')return S(OV([[3,6],[17,6],[17,17],[3,17]],1.3),LV([[3,6],[6,3],[19,3],[17,6]],1.1),LV([[19,3],[19,14],[17,17]],1.1),LV([[5,11.5],[15,11.5]],.8,M),LV([[6,8.5],[14,14.5]],.7,M));if(type==='calendar')return S(OV([[2,5],[18,5],[18,18],[2,18]],1.3),LV([[2,9],[18,9]],1),LV([[6,2],[6,7]],1.3),LV([[14,2],[14,7]],1.3),LV([[6,13],[9,13]],1.2),LV([[11,13],[14,13]],1.2));return null;}
 return{floorV,plankCrateV,seeded,twistedV,crate,newCrate,archiveV,navGlyph,paint(){paintPose();},toggle(open: boolean){stop();const from=motion()?.pose??(open?0:1);d.cache.cargoArchiveMotion={from,to:open?1:0,pose:from,time:0,duration:420,paused:!!d.ui.paused,startedAt:performance.now(),finished:false};if(matchMedia('(prefers-reduced-motion:reduce)').matches)paint(420);else if(!d.ui.paused)d.cache.cargoArchiveRAF=HOST.requestFrame(tick);}};
}
