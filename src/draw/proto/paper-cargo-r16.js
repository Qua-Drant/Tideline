import {HOST} from '../../host.ts';
import {sh} from '../scene.ts';
// R16: engraved hold timber, laid rope, drawstring sacks, framed plank crates and a hinged archive crate.
// 第 3b2 期：货舱的梁、舱口、栏杆、绳索、地板字符串版与旧版 scene 已被 R23 取代，删去（scene 里重置 rand 种子的那一句随之删去；
// 它本来就不会被调用，地板木纹的 rand 不重置是已知问题，不在本期修）。留下箱子、归档箱、导航小图与地板描述版。
export function cargoR16(a){
 const {d,ink:L,curve:C,INK:I,SECONDARY:M,TICK:T,PAPER:P}=a;
 const ellipse33=(x,y,rx,ry)=>Array.from({length:33},(_,i)=>[x+Math.cos(i*Math.PI/16)*rx,y+Math.sin(i*Math.PI/16)*ry]);
 const E=(x,y,rx,ry,n=1,c=I)=>C(ellipse33(x,y,rx,ry),n,c);
 const fillD=p=>`M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z`;
 const F=(p,c=P)=>`<path d="${fillD(p)}" fill="${c}"/>`;
 const O=(p,n=1.3,c=I,attrs='')=>L([...p,p[0]],n,c,attrs);
 let seed=40917;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 // Grain that follows a board, broken into a few long strokes with knots.
 // 第 3b 期：几何（grainStrokes，消耗同一个 rand）与输出分开：grain 是字符串版（箱子还在模板里画），grainV 是描述版（货舱地板，风景用）
 function grainStrokes(x,y,w,h,lines=3,knot=true){const out=[];for(let i=0;i<lines;i++){const yy=y+h*(i+1)/(lines+1);let xx=x+2+rand()*w*.1;while(xx<x+w-6){const len=Math.min(x+w-2-xx,w*(.22+rand()*.4));out.push([[[xx,yy+(rand()-.5)],[xx+len*.5,yy+(rand()-.5)*1.2],[xx+len,yy+(rand()-.5)]],.4,i%2?M:T,true]);xx+=len+3+rand()*8;}}if(knot&&w>60){const kx=x+w*(.2+rand()*.6),ky=y+h*(.3+rand()*.4);out.push([Array.from({length:13},(_,i)=>[kx+Math.cos(i*Math.PI/6)*4,ky+Math.sin(i*Math.PI/6)*1.3]),.42,M,false]);}return out;}
 function grain(x,y,w,h,lines=3,knot=true){let s='';for(const[p,n,c,faded]of grainStrokes(x,y,w,h,lines,knot))s+=faded?C(p,n,c,'opacity=".8"'):C(p,n,c);return s;}
 const grainV=(x,y,w,h,lines=3,knot=true)=>grainStrokes(x,y,w,h,lines,knot).map(([p,n,c,faded])=>a.curveV(p,n,c,faded?{opacity:'.8'}:null));
 function twisted(p,n=2,step=5.5){let s=C(p,n,I);for(let i=1;i<p.length;i++){const[a0,a1]=p[i-1],[b0,b1]=p[i],len=Math.hypot(b0-a0,b1-a1),ux=(b0-a0)/len,uy=(b1-a1)/len,w=n*1.05;for(let t=step*.5;t<len;t+=step){const x=a0+ux*t,y=a1+uy*t;s+=L([[x+uy*w-ux*1.3,y-ux*w-uy*1.3],[x-uy*w+ux*1.3,y+ux*w+uy*1.3]],.45,M);}}return s;}

 // 货舱地板的描述版（R23 的风景用）
 function floorV(w,h){const LV=a.inkV,s=[sh('path',{d:fillD([[0,h-20],[w,h-20],[w,h],[0,h]]),fill:P}),LV([[0,h-20],[w,h-20]],1.8),LV([[0,h-14],[w,h-14]],.7,M)];for(let i=0;i<14;i++){const x=i*w/13;s.push(LV([[x,h-14],[x-18,h]],.55,T),a.curveV(ellipse33(x+6,h-17,.7,.5),.6,M));}s.push(grainV(0,h-13,w,12,2,false));return sh('g',{'data-cargo-floor':true},s);}

 // Framed plank crate: front frame boards, inner planks, nails, hatched top and side.
 function plankCrate(x,y,w,h,depth,{plate=false,faint=false}={}){const dx=depth*.8,dy=depth*.55,col=faint?M:I,top=[[x,y],[x+dx,y-dy],[x+w+dx,y-dy],[x+w,y]],side=[[x+w,y],[x+w+dx,y-dy],[x+w+dx,y+h-dy],[x+w,y+h]],front=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],b=Math.max(4,Math.min(8,w*.075));
 let s=F(top,'#EEF0EC')+F(side,'#E6E9E5')+F(front)+O(top,1.2,col)+O(side,1.2,col)+O(front,1.5,col);
 s+=O([[x+b,y+b],[x+w-b,y+b],[x+w-b,y+h-b],[x+b,y+h-b]],.8,col);const rows=Math.max(2,Math.round((h-2*b)/12));for(let i=1;i<rows;i++){const yy=y+b+(h-2*b)*i/rows;s+=L([[x+b,yy],[x+w-b,yy]],.55,M);}
 s+=grain(x+b,y+b,w-2*b,h-2*b,rows,w>40);s+=L([[x+b,y+h-b],[x+w-b,y+b]],.6,T);
 for(const[px,py]of [[x+b/2,y+b/2],[x+w-b/2,y+b/2],[x+b/2,y+h-b/2],[x+w-b/2,y+h-b/2]])s+=E(px,py,.75,.75,.6,col);
 for(let t=.08;t<.98;t+=.075)s+=L([[x+w+dx*t,y-dy*t+2],[x+w+dx*t,y+h-dy*t-2]],.36,M,'opacity=".65"');
 for(let t=.12;t<.95;t+=.1)s+=L([[x+w*t+2,y-1],[x+w*t+dx-1,y-dy+1]],.34,M,'opacity=".5"');
 if(plate){const px=x+w*.17,pw=w*.66,py=y+h*.22,ph=h*.56;s+=F([[px,py],[px+pw,py],[px+pw,py+ph],[px,py+ph]])+O([[px,py],[px+pw,py],[px+pw,py+ph],[px,py+ph]],.9,col)+E(px+3,py+3,.6,.6,.5)+E(px+pw-3,py+3,.6,.6,.5);}
 return s;}
 // viewBox 150 × 126; the label plate spans 17%–67% horizontally.
 function crate(){return `<g data-cargo-list-crate>${plankCrate(6,34,118,86,26,{plate:true})}</g>`;}
 function newCrate(){const x=6,y=34,w=118,h=86,dx=20.8,dy=14.3;return a.dash([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],1.2)+a.dash([[x,y],[x+dx,y-dy],[x+w+dx,y-dy],[x+w+dx,y+h-dy],[x+w,y+h]],1)+L([[x+w*.5-13,y+h*.5],[x+w*.5+13,y+h*.5]],1.4)+L([[x+w*.5,y+h*.5-13],[x+w*.5,y+h*.5+13]],1.4);}
 // viewBox 140 × 140: two archived crates, a coil and the hinged crate on top.
 const LID={x:16,y:50,w:56,h:36,depth:18};
 function archive(){const n=d.lists.filter(l=>l.archived).length,{x,y,w,h,depth}=LID;let s='<g data-cargo-archive-stack><g opacity=".9">'+plankCrate(4,92,96,40,20,{faint:true})+plankCrate(x,y,w,h,depth,{faint:true})+'</g>';
 // R21: a laid coil — loops with heavier fronts and twist ticks, a free tail.
 for(let i=0;i<4;i++){const y=125-i*2.6,r=15-i*.5,q=4.8-i*.1;s+=C(Array.from({length:11},(_,j)=>{const t=Math.PI+j*Math.PI/10;return[118+Math.cos(t)*r,y+Math.sin(t)*q];}),.55,M)+C(Array.from({length:13},(_,j)=>{const t=j*Math.PI/12;return[118+Math.cos(t)*r,y+Math.sin(t)*q];}),1.05,I);for(let j=1;j<12;j+=2){const t=j*Math.PI/12,x=118+Math.cos(t)*r,yy=y+Math.sin(t)*q;s+=L([[x-1,yy-1.3],[x+1,yy+1.2]],.4,M);}}s+=C([[103,126],[96,131],[86,132],[78,133]],1)+C([[103.5,127.5],[96.5,132.5],[86,133.6]],.4,M);
 s+=`<g data-archive-inside></g><g data-archive-lid></g><g data-archive-slips></g>`;
 const tag=[[86,58],[136,56],[137,82],[87,84]];s+=L([[78,50],[84,56],[88,62]],.6,M)+F(tag)+O(tag,1)+E(91,63,1.1,1.1,.6)+`<text x="112" y="75" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--sans)">归档 ${n}</text></g>`;return s;}
 // The lid hinges on its back edge; the open mouth shows a dark interior and the archived slips.
 function lidAt(v){const{x,y,w,depth}=LID,dx=depth*.8,dy=depth*.55,th=v*1.85,B0=[x+dx,y-dy],B1=[x+w+dx,y-dy],F0=[x,y],F1=[x+w,y],lift=(B,Fp)=>[B[0]+(Fp[0]-B[0])*Math.cos(th),B[1]+(Fp[1]-B[1])*Math.cos(th)-Math.sin(th)*22];return{B0,B1,F0,F1,G0:lift(B0,F0),G1:lift(B1,F1)};}
 function paintPose(){const v=d.cache.cargoArchiveMotion?.pose??(d.ui.taskArchive?1:0),q=lidAt(v),inside=[q.F0,q.F1,q.B1,q.B0],lid=[q.B0,q.B1,q.G1,q.G0];
 for(const g of HOST.querySelectorAll('#tasks [data-archive-inside]')){let s='';if(v>.01){s=F(inside,'#D9DED9')+O(inside,.9,M);for(let i=1;i<9;i++){const t=i/9;s+=L([[q.F0[0]+(q.F1[0]-q.F0[0])*t,q.F0[1]-1],[q.B0[0]+(q.B1[0]-q.B0[0])*t,q.B0[1]+1]],.4,M,'opacity=".7"');}}g.innerHTML=s;}
 for(const g of HOST.querySelectorAll('#tasks [data-archive-slips]')){let s='';if(v>.15){const rise=Math.min(1,(v-.15)/.85);for(const[i,ox]of [[0,22],[1,38],[2,54]]){const yy=LID.y-8-rise*(12+i*5),r=[[ox,yy],[ox+15,yy-1],[ox+16,yy+11],[ox+1,yy+12]];s+=`<g opacity="${rise.toFixed(2)}">${F(r)}${O(r,.8)}${L([[ox+3,yy+4],[ox+12,yy+3.6]],.5,M)}${L([[ox+3,yy+7],[ox+10,yy+6.7]],.5,M)}</g>`;}}g.innerHTML=s;}
 for(const g of HOST.querySelectorAll('#tasks [data-archive-lid]')){let s=F(lid,v>.5?'#EEF0EC':P)+O(lid,1.2,M);for(let i=1;i<5;i++){const t=i/5;s+=L([[q.B0[0]+(q.B1[0]-q.B0[0])*t,q.B0[1]],[q.G0[0]+(q.G1[0]-q.G0[0])*t,q.G0[1]]],.5,M,'opacity=".75"');}s+=L([q.G0,q.G1],1.3,M);g.innerHTML=s;}}
 function paint(ms){const m=d.cache.cargoArchiveMotion;if(!m){paintPose();return;}m.time=Math.max(0,Math.min(420,ms));const t=m.time/420,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;m.pose=m.from+(m.to-m.from)*e;m.finished=m.time===420;paintPose();for(const el of HOST.querySelectorAll('#tasks .cargo-archived-list')){el.style.opacity=String(Math.min(1,m.pose*2.2));el.style.transform=`translateY(${8*(1-m.pose)}px)`;}}
 function stop(){if(d.cache.cargoArchiveRAF)cancelAnimationFrame(d.cache.cargoArchiveRAF);d.cache.cargoArchiveRAF=null;}
 function tick(now){d.cache.cargoArchiveRAF=null;const m=d.cache.cargoArchiveMotion;if(!m||m.paused)return;paint(d.ui.page==='tasks'?now-m.startedAt:420);if(!m.finished)d.cache.cargoArchiveRAF=requestAnimationFrame(tick);}

 // Distinct nav marks: tray for the inbox, framed crate for lists, calendar for the coming week.
 function navGlyph(type){const S=s=>`<svg viewBox="0 0 20 20" aria-hidden="true">${s}</svg>`;if(type==='tray')return S(L([[2,11],[6,4],[14,4],[18,11]],1.3)+L([[2,11],[2,17],[18,17],[18,11],[13,11],[12,13.5],[8,13.5],[7,11],[2,11]],1.3));if(type==='crate')return S(O([[3,6],[17,6],[17,17],[3,17]],1.3)+L([[3,6],[6,3],[19,3],[17,6]],1.1)+L([[19,3],[19,14],[17,17]],1.1)+L([[5,11.5],[15,11.5]],.8,M)+L([[6,8.5],[14,14.5]],.7,M));if(type==='calendar')return S(O([[2,5],[18,5],[18,18],[2,18]],1.3)+L([[2,9],[18,9]],1)+L([[6,2],[6,7]],1.3)+L([[14,2],[14,7]],1.3)+L([[6,13],[9,13]],1.2)+L([[11,13],[14,13]],1.2));return null;}
 return{floorV,plankCrate,twisted,crate,newCrate,archive,navGlyph,vignette:()=>'',paint(){paintPose();},toggle(open){stop();const from=d.cache.cargoArchiveMotion?.pose??(open?0:1);d.cache.cargoArchiveMotion={from,to:open?1:0,pose:from,time:0,duration:420,paused:!!d.ui.paused,startedAt:performance.now(),finished:false};if(matchMedia('(prefers-reduced-motion:reduce)').matches)paint(420);else if(!d.ui.paused)d.cache.cargoArchiveRAF=requestAnimationFrame(tick);}};
}
