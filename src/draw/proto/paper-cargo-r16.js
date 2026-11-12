import {HOST} from '../../host.js';
// R16: engraved hold timber, laid rope, drawstring sacks, framed plank crates and a hinged archive crate.
export function cargoR16(a,prev){
 const {d,ink:L,curve:C,INK:I,SECONDARY:M,TICK:T,PAPER:P}=a;
 const E=(x,y,rx,ry,n=1,c=I)=>C(Array.from({length:33},(_,i)=>[x+Math.cos(i*Math.PI/16)*rx,y+Math.sin(i*Math.PI/16)*ry]),n,c);
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z" fill="${c}"/>`;
 const O=(p,n=1.3,c=I,attrs='')=>L([...p,p[0]],n,c,attrs);
 let seed=40917;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const hatch=(x0,y0,x1,y1,step,dx,dy,n=.36,c=M,op=.6)=>{let s='';for(let x=x0;x<x1;x+=step)s+=L([[x,y0],[x+dx,y0+dy]],n,c,`opacity="${op}"`);return s;};
 // Grain that follows a board, broken into a few long strokes with knots.
 function grain(x,y,w,h,lines=3,knot=true){let s='';for(let i=0;i<lines;i++){const yy=y+h*(i+1)/(lines+1);let xx=x+2+rand()*w*.1;while(xx<x+w-6){const len=Math.min(x+w-2-xx,w*(.22+rand()*.4));s+=C([[xx,yy+(rand()-.5)],[xx+len*.5,yy+(rand()-.5)*1.2],[xx+len,yy+(rand()-.5)]],.4,i%2?M:T,'opacity=".8"');xx+=len+3+rand()*8;}}if(knot&&w>60){const kx=x+w*(.2+rand()*.6),ky=y+h*(.3+rand()*.4);s+=C(Array.from({length:13},(_,i)=>[kx+Math.cos(i*Math.PI/6)*4,ky+Math.sin(i*Math.PI/6)*1.3]),.42,M);}return s;}
 function twisted(p,n=2,step=5.5){let s=C(p,n,I);for(let i=1;i<p.length;i++){const[a0,a1]=p[i-1],[b0,b1]=p[i],len=Math.hypot(b0-a0,b1-a1),ux=(b0-a0)/len,uy=(b1-a1)/len,w=n*1.05;for(let t=step*.5;t<len;t+=step){const x=a0+ux*t,y=a1+uy*t;s+=L([[x+uy*w-ux*1.3,y-ux*w-uy*1.3],[x-uy*w+ux*1.3,y+ux*w+uy*1.3]],.45,M);}}return s;}
 const sag=(x0,y0,x1,y1,drop,n=9)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return[x0+(x1-x0)*t,y0+(y1-y0)*t+Math.sin(t*Math.PI)*drop];});
 function bolt(x,y){return E(x,y,1.6,1.1)+L([[x-.9,y],[x+.9,y]],.5,M);}

 // A heavy beam seen slightly from below: top strip, grained face, cast shadow on the bulkhead.
 function beam(x,y,w,h){let s=F([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])+F([[x,y+h],[x+w,y+h],[x+w,y+h+5],[x,y+h+5]],'#E9ECE8');s+=L([[x,y],[x+w,y]],1.6)+L([[x,y+h],[x+w,y+h]],1.7)+L([[x,y+h+5],[x+w,y+h+5]],.8,M)+L([[x,y+5],[x+w,y+5]],.6,M);
 s+=grain(x,y+5,w,h-5,3);s+=hatch(x+2,y+h+.8,x+w-4,0,3,-2,4,.34,M,.55);for(let xx=x+40;xx<x+w-20;xx+=w/9)s+=bolt(xx,y+h*.62)+L([[xx+26,y+6],[xx+26,y+h-1]],.55,M);return s;}
 // Knee brace with a visible thickness; its shaded side is hatched.
 function brace(x){const p=[[x-34,28],[x-12,28],[x+24,70],[x+4,76]],side=[[x-12,28],[x-4,28],[x+31,66],[x+24,70]];let s=F(p)+F(side,'#E8EBE7')+O(p,1.7)+O(side,1.2);for(let i=0;i<14;i++){const t=(i+.5)/14;s+=L([[x-10+t*35,29+t*39],[x-4+t*35,29+t*37]],.38,M,'opacity=".75"');}s+=grain(0,0,0,0,0,false);for(const k of [.3,.55,.8])s+=C([[x-34+22*k,29],[x-12+22*k,52],[x+4+20*k,74]],.45,k===.55?M:T);s+=C([[x-26,40],[x-21,43],[x-25,46]],.5,M)+bolt(x-22,34)+bolt(x+12,68)+L([[x-36,28],[x-2,28]],1.2);return s;}
 // Deck opening with a coaming, a propped grating lid and a dark well for the ladder.
 function hatchway(){const outer=[[0,121],[37,82],[132,84],[100,122]],inner=[[13,115],[42,90],[118,91],[93,115]];let s=F(outer)+O(outer,1.7)+F(inner,'#E4E7E3')+O(inner,1.1);
 for(let i=0;i<18;i++){const t=i/18;s+=L([[16+t*76,114],[44+t*72,92]],.4,M,'opacity=".7"');}
 s+=L([[0,121],[0,131]],1.4)+L([[100,122],[100,132]],1.4)+L([[0,131],[100,132]],1.3)+hatch(3,122.5,98,0,3.2,0,8,.36,M,.5);
 const lid=[[37,82],[132,84],[148,40],[56,37]];s+=F(lid)+O(lid,1.5)+L([[132,84],[136,86],[152,42],[148,40]],1)+L([[148,40],[152,42]],.8);
 for(let i=1;i<4;i++){const t=i/4;s+=L([[37+t*19,82-t*45],[132+t*16,84-t*44]],.6,M);}s+=grain(48,44,86,34,4,true);for(const t of [.22,.78]){const x0=37+t*95,y0=82+t*2,x1=56+t*92,y1=37+t*3;s+=F([[x0-4,y0],[x0+4,y0],[x1+4,y1],[x1-4,y1]])+O([[x0-4,y0],[x0+4,y0],[x1+4,y1],[x1-4,y1]],.9)+E((x0+x1)/2,(y0+y1)/2,.8,.8,.6);}
 s+=L([[142,62],[166,118]],1.2)+L([[145,62],[169,118]],.6,M)+bolt(91,60);return `<g data-cargo-hatchway>${s}</g>`;}
 function ladderTop(){let s="";for(const x of [28,64]){const p=[[x,100],[x+6,100],[x+7,140],[x+1,140]];s+=F(p)+O(p,1.2)+C([[x+3,104],[x+4,136]],.45,M);}s+=F([[34,110],[64,110],[64,115],[34,115]])+O([[34,110],[64,110],[64,115],[34,115]],1);return s;}
 function rail(w){let s='';const posts=[];for(let i=0;i<10;i++)posts.push(184+i*(w-204)/9);for(let i=1;i<posts.length;i++)s+=twisted(sag(posts[i-1],108,posts[i],108,5.5,8),1.15,6);for(const x of posts){s+=F([[x-2.4,108],[x+2.4,108],[x+2.8,122],[x-2.8,122]])+O([[x-2.4,108],[x+2.4,108],[x+2.8,122],[x-2.8,122]],1)+E(x,106.5,3.1,2,.9)+L([[x+1.2,110],[x+1.6,121]],.4,M);}return s;}
 // The rope run on the right: belayed on the wall post, with knotted hang points and a hanging coil.
 function rigging(w){let s='<g data-cargo-rigging>';const pts=[[w*.715,27],[w*.745,40],[w*.77,44],[w*.81,38],[w*.85,43],[w*.89,38],[w*.93,43],[w*.965,35],[w-15,30]];s+=twisted(pts,2.2,5);
 for(const r of [.77,.85,.93]){const x=w*r,y=r===.85?43:44;s+=C([[x-4,y-3],[x-5,y+1],[x,y+4],[x+5,y+1],[x+4,y-3]],1.1)+L([[x-3.5,y-1.5],[x+3.5,y+2]],.6,M)+L([[x-3.5,y+1.5],[x+3,y+3.5]],.6,M);}
 s+=E(w*.715,26,3,2.2,1.1)+L([[w*.715,22],[w*.715,27]],1.2);const cx=w-24;for(let i=0;i<5;i++)s+=E(cx,64+i*.6,9+i*1.1,17-i*.4,i===0?1.2:.6,i===0?I:M);s+=twisted([[w-15,30],[cx+3,46]],1.6,5)+C([[cx-4,80],[cx-6,92],[cx-2,100]],1.1)+L([[cx+6,52],[cx+10,58]],.5,M);
 s+='</g>';return s;}
 function scene(w,h){seed=40917;let s=`<g data-cargo-beams>${F([[0,0],[w,0],[w,2],[0,2]])}${beam(0,2,w,26)}`;for(const x of [w*.15,w*.42,w*.7])s+=brace(x);s+='</g>';
 s+=`<g data-morph="deck">${hatchway()}${rail(w)}${beam(0,122,w,10)}${ladderTop()}</g>`;
 const lx=w*.635;s+=L([[lx,29],[lx,34]],1.2)+prev.lantern(lx,76);
 s+=rigging(w);
 s+=`<g data-cargo-wall>${F([[w-13,26],[w-3,26],[w-3,122],[w-13,122]])}${O([[w-13,26],[w-3,26],[w-3,122],[w-13,122]],1.4)}${hatch(w-11,30,w-5,0,2,0,88,.34,M,.5)}</g>`;
 s+=floor(w,h);return s;}
 function floor(w,h){let s="";s+=`<g data-cargo-floor>${F([[0,h-20],[w,h-20],[w,h],[0,h]])}${L([[0,h-20],[w,h-20]],1.8)}${L([[0,h-14],[w,h-14]],.7,M)}`;for(let i=0;i<14;i++){const x=i*w/13;s+=L([[x,h-14],[x-18,h]],.55,T)+E(x+6,h-17,.7,.5,.6,M);}s+=grain(0,h-13,w,12,2,false)+'</g>';return s;}

 // Drawstring sack in the 80 × 94 box; the tag keeps the initial's existing position.
 function envelope(){let s=L([[40,0],[40,6]],1)+C([[36,6],[34,9],[38,12],[42,12],[46,9],[44,6]],1);
 const ruff=[[29,20],[25,13],[30,15],[34,10],[38,14],[42,9],[46,14],[51,11],[55,15],[51,20]];s+=F(ruff)+C([...ruff,ruff[0]],1.15);for(const x of [32,38,44,49])s+=L([[x,14],[x+1,19]],.5,M);
 const body=[[30,22],[20,32],[11,50],[8,68],[13,83],[26,89],[54,89],[67,83],[72,67],[68,48],[59,31],[50,22]];s+=F(body)+C([...body,body[0]],1.5);
 s+=C([[28,20],[40,24],[53,20]],1.6)+C([[29,23],[40,26.5],[52,23]],1.1)+L([[33,21],[36,25]],.55,M)+L([[44,22],[47,25]],.55,M);
 for(const p of [[[33,27],[25,46],[23,70]],[[47,27],[56,44],[60,66]],[[36,28],[34,40]],[[16,66],[20,80],[30,86]]])s+=C(p,.55,M);
 for(let i=0;i<11;i++){const x=58+i*1.3,top=34+i*2.6,bot=84-i*1.4;if(bot-top<6)break;s+=C([[x,top],[x+1.2,(top+bot)/2],[x-.2,bot]],.38,M,'opacity=".7"');}for(let i=0;i<8;i++)s+=L([[22+i*5,86],[25+i*5,82]],.36,M,'opacity=".6"');
 const tag=[[27,35],[53,34],[54,58],[28,59]];s+=L([[40,26],[40,34]],.7)+F(tag)+O(tag,1)+E(40,37.5,1.1,1.1,.7);return s;}

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
 // viewBox 175 × 142: a leaning pile of crates with a tied tag for the inbox count.
 function loose(n){let s='<g data-cargo-stacked-crates>';s+=plankCrate(2,84,72,52,16)+plankCrate(80,94,58,42,14)+plankCrate(12,38,56,42,15)+plankCrate(140,110,26,26,8);s+=`<g transform="rotate(-6 100 70)">${plankCrate(78,56,46,34,12)}</g>`;
 const tag=[[92,98],[156,95],[158,134],[94,137]];s+=L([[93,101],[80,92],[76,86]],.7)+F(tag)+O(tag,1.1)+E(98,103,1.3,1.3,.7);s+=`<text x="125" y="114" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--sans)">收件箱</text><text x="126" y="130" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--mono)">${n}</text></g>`;return s;}
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
 return{scene,floor,plankCrate,twisted,envelope,crate,newCrate,loose,archive,navGlyph,light:prev.light,vignette:()=>'',paint(){paintPose();},toggle(open){stop();const from=d.cache.cargoArchiveMotion?.pose??(open?0:1);d.cache.cargoArchiveMotion={from,to:open?1:0,pose:from,time:0,duration:420,paused:!!d.ui.paused,startedAt:performance.now(),finished:false};if(matchMedia('(prefers-reduced-motion:reduce)').matches)paint(420);else if(!d.ui.paused)d.cache.cargoArchiveRAF=requestAnimationFrame(tick);},pause(){stop();const m=d.cache.cargoArchiveMotion;if(m)m.paused=true;return m?{time:m.time,duration:420}:null;},seek(ms){paint(ms);return d.cache.cargoArchiveMotion?.time??null;},reset(){stop();d.cache.cargoArchiveMotion=null;paintPose();}};
}
