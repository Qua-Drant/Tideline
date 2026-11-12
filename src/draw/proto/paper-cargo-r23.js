import {HOST} from '../../host.js';
// R20: one coordinate system for the whole ceiling. Beam, rope stations, sacks (with their initials), lantern,
// rail, hatch and the narrow ladder are all drawn into the scenery SVG from the same width-derived scale, so they
// cannot drift apart when the window changes size. The sack buttons are transparent hit areas placed from the same
// numbers on every scenery redraw. No joists, no loose lid, no lamp switch or glow; the ladder is scenery only.
// R21: the band is shallower (deck at 140 instead of 175); a pale sea vista runs between beam and deck.
// R22 (copied from R20, which stays as it was): every rope is a laid rope — a paper-filled tube with inked edges and
// slanted strand lays — so the beam swags, the rail, the hanging coil and both floor coils read as rope, not wire.
// The vista keeps only sparse water strokes, with no horizon line.
// R23 (copied from R22, which stays as it was): the band is 20 units shallower (deck at 120); sacks and lantern are
// smaller and both end above the rail rope, so nothing hanging from the beam touches it.
export const HOLD_W=1491,BEAM_H=28,DECK_Y=120,DECK_B=132;
const TIES=[890,1071,1168,1274,1380],SACK={w:43,h:56,top:36,k:.56},LANTERN={cx:802,cy:65,k:.9};
const LADDER={x:21,stiles:[[7,13],[43,49]],rung:39};
export function cargoR23(a,r16){
 const {d,curve:C,ink:L,circle,INK:I,SECONDARY:M,TICK:T,PAPER:P,esc}=a;
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z" fill="${c}"/>`;
 const O=(p,n=1.3,c=I,at='')=>L([...p,p[0]],n,c,at);
 const unit=w=>w/HOLD_W,fmt=v=>(+v.toFixed(2)).toString();
 const E=(x,y,rx,ry,n=1,c=I)=>C(Array.from({length:25},(_,i)=>{const t=i*Math.PI/12;return[x+Math.cos(t)*rx,y+Math.sin(t)*ry];}),n,c);
 let seed=11;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 function grain(x0,x1,y,rows,h){let s='';for(let r=0;r<rows;r++){const yy=y+h*(r+1)/(rows+1);let x=x0+8+rnd()*30;while(x<x1-20){const len=Math.min(x1-6-x,60+rnd()*140);s+=C([[x,yy],[x+len*.5,yy-.4+rnd()*.8],[x+len,yy]],.5,T);x+=len+18+rnd()*40;}}return s;}
 // Centripetal-free Catmull–Rom resampling, then the tube: fill, two edges, the strand lays and a few lee ticks.
 function sample(p,step=2){if(p.length<3){const[a0,a1]=p[0],[b0,b1]=p[1],n=Math.max(2,Math.ceil(Math.hypot(b0-a0,b1-a1)/step));return Array.from({length:n+1},(_,i)=>[a0+(b0-a0)*i/n,a1+(b1-a1)*i/n]);}
 const out=[];for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2,n=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/step));for(let j=0;j<n;j++){const t=j/n,t2=t*t,t3=t2*t;out.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));}}out.push(p.at(-1));return out;}
 const q=v=>+v.toFixed(2);
 function laid(P,wd,{closed=false,edge=1,pitch=1.05,from=0,to=1}={}){const n=P.length,A=[],B=[],T=[],N=[];for(let i=0;i<n;i++){const a0=P[closed?(i-1+n)%n:Math.max(0,i-1)],a1=P[closed?(i+1)%n:Math.min(n-1,i+1)];let tx=a1[0]-a0[0],ty=a1[1]-a0[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;T.push([tx,ty]);N.push([-ty,tx]);A.push([P[i][0]-ty*wd/2,P[i][1]+tx*wd/2]);B.push([P[i][0]+ty*wd/2,P[i][1]-tx*wd/2]);}
 const ring=closed?`M${A.map(p=>p.map(q).join(',')).join('L')}ZM${B.map(p=>p.map(q).join(',')).join('L')}Z`:`M${[...A,...B.slice().reverse()].map(p=>p.map(q).join(',')).join('L')}Z`;
 let o=`<path d="${ring}" fill="${P_}" fill-rule="evenodd"/>`+C(closed?[...A,A[0]]:A,edge,I)+C(closed?[...B,B[0]]:B,edge*.9,I);
 let lays='',lee='',run=0,next=wd*.4;const i0=Math.floor(from*(n-1)),i1=Math.ceil(to*(n-1));for(let i=1;i<n;i++){run+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(run<next)continue;next=run+wd*pitch;if(i<i0||i>i1)continue;const[c0,c1]=P[i],[tx,ty]=T[i],[nx,ny]=N[i],h=wd*.47,s=wd*.42,dn=ny>0?1:-1;
 lays+=`M${q(c0+nx*h-tx*s)},${q(c1+ny*h-ty*s)}Q${q(c0+tx*wd*.16)},${q(c1+ty*wd*.16)} ${q(c0-nx*h+tx*s)},${q(c1-ny*h+ty*s)}`;
 lee+=`M${q(c0+dn*nx*h*.15+tx*s*.55)},${q(c1+dn*ny*h*.15+ty*s*.55)}L${q(c0+dn*nx*h*.85+tx*s*.95)},${q(c1+dn*ny*h*.85+ty*s*.95)}`;}
 return o+`<path d="${lays}" fill="none" stroke="${I}" stroke-width="${q(Math.max(.45,wd*.13))}" stroke-linecap="round" opacity=".85"/><path d="${lee}" fill="none" stroke="${M}" stroke-width="${q(Math.max(.35,wd*.09))}" stroke-linecap="round" opacity=".75"/>`;}
 const P_=P,rope=(p,n=1.5)=>laid(sample(p,1.6),n*2.3,{edge:.75});
 const ellipse=(cx,cy,rx,ry,rot=0,k=72)=>Array.from({length:k},(_,i)=>{const t=i/k*Math.PI*2,x=Math.cos(t)*rx,y=Math.sin(t)*ry;return[cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)];});
 // A coil lying on the floor: loops flaked one on another, each a closed laid ring; the tail leaves from the bottom loop.
 function floorCoil(cx,cy,R,wd,loops=5,tail=1){let o='';const ry=R*.36,rn=k=>((Math.sin(k*127.1+cx*.31)*43758.5453)%1+1)%1;
 if(tail)o+=laid(sample([[cx+R*.55*tail,cy+ry*.75],[cx+R*1.05*tail,cy+ry+3],[cx+R*1.55*tail,cy+ry+6],[cx+R*2.1*tail,cy+ry+5],[cx+R*2.5*tail,cy+ry+7]],1.6),wd,{edge:.8});
 for(const x of [-.95,-.55,-.1,.4,.85])o+=L([[cx+R*x-4,cy+ry+wd*.55],[cx+R*x+4,cy+ry+wd*.55]],.45,M,'opacity=".7"');
 // Flaked loops: each a little off-centre, of its own size and tilt; lower loops carry paler lays so the eye
 // of the coil does not fill with ink.
 for(let i=0;i<loops;i++){const last=i===loops-1,r=R*(1-i*.06)*(.9+rn(i)*.18),x=cx+(rn(i+7)-.5)*R*.36,y=cy-i*wd*.32+(rn(i+3)-.5)*wd*.6,rot=(rn(i+11)-.5)*.22,ring=laid(ellipse(x,y,r,r*.36*(.9+rn(i+5)*.2),rot,Math.max(56,Math.round(r*2.4))),wd,{closed:true,edge:.85});o+=last?ring:ring.replace('opacity=".85"','opacity=".5"');}return o;}
 const sag=(x0,y0,x1,y1,drop,k=9)=>Array.from({length:k},(_,i)=>{const t=i/(k-1);return[x0+(x1-x0)*t,y0+(y1-y0)*t+Math.sin(t*Math.PI)*drop];});
 // A slimmer main beam: top arris, one inner line, sparse grain, bolts, a pale shadow under it.
 function beam(){let s=F([[0,0],[HOLD_W,0],[HOLD_W,BEAM_H],[0,BEAM_H]])+L([[0,1],[HOLD_W,1]],1.4)+L([[0,6],[HOLD_W,6]],.7,M)+L([[0,BEAM_H],[HOLD_W,BEAM_H]],1.6)+grain(0,HOLD_W,6,2,BEAM_H-6);
 for(const x of [120,430,640,960,1220])s+=circle(x,17,1.4,.8);for(let x=3;x<HOLD_W;x+=7)s+=L([[x,BEAM_H+1],[x-2,BEAM_H+4]],.4,T);return s;}
 // Sack in its own 76 × 100 drawing; the initial is set in the SVG so it moves with the drawing.
 function sack(x,person,pressed,s){const ox=x-SACK.w/2,oy=SACK.top,k=SACK.k;let o=C([[38,-6],[38,6]],1)+E(38,9,4,3,1.1);const ruff=[[30,21],[27,17],[28,14],[32,13],[35,15],[38,12.5],[41,15],[44,13],[48,14],[49,17],[46,21]];o+=F(ruff)+C([...ruff,ruff[0]],1.05);for(const k of [33,38,43])o+=C([[k,15],[k+.4,18],[k,20.5]],.45,M);
 const body=[[30,22],[19,34],[10,54],[7,74],[12,90],[26,97],[50,97],[64,90],[69,74],[66,54],[57,34],[46,22]];o+=F(body)+C([...body,body[0]],1.5)+C([[28,21],[38,25],[48,21]],1.6)+C([[29,24],[38,27.5],[47,24]],1);
 for(const p of [[[33,28],[24,48],[21,72]],[[44,28],[53,48],[56,70]],[[16,74],[20,86],[30,93]]])o+=C(p,.55,M);for(let i=0;i<7;i++){const k=58+i*1.5;o+=C([[k,40+i*3.4],[k+.8,62+i],[k,84-i*1.5]],.4,M,'opacity=".7"');}
 const tag=[[26,44],[50,43],[51,69],[27,70]];o+=L([[38,27],[38,44]],.7)+F(tag)+O(tag,1)+circle(38,47,1,.6);const fs=12/s/k;
 o+=`<text x="38.5" y="${fmt(57+fs*.36)}" font-size="${fmt(fs)}" text-anchor="middle" fill="${I}" style="font-family:var(--sans)"${pressed?' text-decoration="underline"':''}>${esc(person.initial)}</text>`;if(pressed)o+=L([[31,63.5],[46,63.5]],.9);
 return `<g data-cargo-sack="${person.id}" transform="translate(${ox} ${oy}) scale(${k})">${o}</g>`;}
 // A laid rope coil: stacked loops, the front half of each heavier with twist ticks, a lashing and a free tail.
 function coil(cx,cy,rx,ry,loops,dy,n=1.15){let o='';for(let i=0;i<loops;i++){const y=cy-i*dy,r=rx-i*.6,q=ry-i*.15;o+=C(Array.from({length:13},(_,j)=>{const t=Math.PI+j*Math.PI/12;return[cx+Math.cos(t)*r,y+Math.sin(t)*q];}),.6,M);const front=Array.from({length:17},(_,j)=>{const t=j*Math.PI/16;return[cx+Math.cos(t)*r,y+Math.sin(t)*q];});o+=C(front,n,I);for(let j=1;j<16;j+=2){const t=j*Math.PI/16,x=cx+Math.cos(t)*r,yy=y+Math.sin(t)*q;o+=L([[x-1.2,yy-1.6],[x+1.2,yy+1.4]],.45,M);}}return o;}
 function hangingCoilR20(cx,cy){let o=F([[cx-2,cy-30],[cx+4,cy-30],[cx+4,cy-24],[cx-2,cy-24]])+O([[cx-2,cy-30],[cx+4,cy-30],[cx+4,cy-24],[cx-2,cy-24]],1);
 for(let i=0;i<6;i++){const r=13-i*.4,h=24-i*.8,x=cx+1+i*.6;o+=C(Array.from({length:21},(_,j)=>{const t=-Math.PI/2+j*Math.PI*2/20;return[x+Math.cos(t)*r,cy+4+Math.sin(t)*h];}),i?.55:1.2,i?M:I);}
 for(let j=0;j<12;j++){const t=-Math.PI/2+.3+j*.5,x=cx+1+Math.cos(t)*13,y=cy+4+Math.sin(t)*24;o+=L([[x-1.3,y-1.4],[x+1.3,y+1.4]],.45,M);}
 o+=C([[cx-3,cy-24],[cx-5,cy-16],[cx-3,cy-8]],1.3)+L([[cx-7,cy-20],[cx+3,cy-18]],.8)+L([[cx-7,cy-17],[cx+3,cy-15]],.8)+rope([[cx+6,cy+26],[cx+8,cy+36],[cx+5,cy+44],[cx+7,cy+50]],1.1);return o;}
 // Hanging coil: a cleat, loops hung from it back to front, two lashing turns round the neck and a tail.
 function hangingCoil(cx,cy){let o='';const top=cy-24;o+=F([[cx-4,top-8],[cx+6,top-8],[cx+6,top-2],[cx-4,top-2]])+O([[cx-4,top-8],[cx+6,top-8],[cx+6,top-2],[cx-4,top-2]],1)+L([[cx-8,top-8],[cx+10,top-8]],1.2);
 o+=laid(sample([[cx+4,top+44],[cx+6,top+58],[cx+3,top+70],[cx+6,top+80]],1.4),3.2,{edge:.75});
 for(let i=0;i<6;i++){const rx=10.5+(i%3)*.9-i*.3,ry=21+((i*5)%3)-i*.4,x=cx+1+(i-2.5)*.9,rot=(i-2.5)*.035;o+=laid(ellipse(x,top+ry+1,rx,ry,rot,64),3.2,{closed:true,edge:.8});}
 for(const dy of [4,8.5])o+=laid(sample([[cx-11,top+dy+1],[cx+1,top+dy+2.2],[cx+13,top+dy]],1.2),3,{edge:.8});return o;}
 // Pale sea seen past the open side of the hold: horizon, two far islands, a sail, sparse water strokes.
 // Pale sea past the open side of the hold: no horizon, only sparse water strokes, longer and paler towards the top.
 function vista(){let o='<g data-cargo-vista>';const y0=BEAM_H+16,y1=DECK_Y-30;for(let i=0;i<22;i++){const x=(i*397+((i*i*53)%211))%HOLD_W,t=((i*7)%11)/10,y=y0+(y1-y0)*t,len=14+(1-t)*26+(i%3)*5;o+=C([[x,y],[x+len*.35,y-.6],[x+len*.7,y-.2],[x+len,y+.3]],.45,T,`opacity="${(.55+t*.35).toFixed(2)}"`);if(i%4===0)o+=C([[x+len*.3,y+4],[x+len*.75,y+3.6]],.4,T,'opacity=".6"');}return o+'</g>';}
 function rigging(s){let o='<g data-cargo-rigging>';for(let i=1;i<TIES.length;i++)o+=rope(sag(TIES[i-1],BEAM_H+4,TIES[i],BEAM_H+4,11),1.75);o+=rope(sag(TIES.at(-1),BEAM_H+4,1452,BEAM_H,8),1.75);
 for(const x of TIES){o+=F([[x-6,2],[x+6,2],[x+6,BEAM_H],[x-6,BEAM_H]])+L([[x-6,2],[x-6,BEAM_H]],1)+L([[x+6,2],[x+6,BEAM_H]],1);for(let y=5;y<BEAM_H-1;y+=5)o+=L([[x-6,y],[x+6,y+2.6]],.7,M);o+=circle(x,BEAM_H+5,4,1.2);}
 o+=circle(1030,BEAM_H+7,5.5,1.2)+circle(1030,BEAM_H+7,2.6,.7);
 const f=d.ui.taskFilter;(HOST.cargoPeople?HOST.cargoPeople(d,TIES.length-1):d.people.slice(0,TIES.length-1)).forEach((p,i)=>{o+=sack(TIES[i+1],p,f.kind==='person'&&f.id===p.id,s);});
 const px=1452;o+=F([[px,0],[HOLD_W,0],[HOLD_W,DECK_B],[px,DECK_B]])+L([[px,0],[px,DECK_B]],1.6);for(let x=px+12;x<HOLD_W;x+=12)o+=C([[x,4],[x+.6,DECK_B/2],[x,DECK_B-4]],.5,T);for(const y of [44,98])o+=F([[px-3,y-4],[HOLD_W,y-4],[HOLD_W,y+4],[px-3,y+4]])+L([[px-3,y-4],[HOLD_W,y-4]],1.1)+L([[px-3,y+4],[HOLD_W,y+4]],1.1);
 o+=hangingCoil(1432,70)+'</g>';return o;}
 // Lantern hanging from the beam; the glass stays faintly warm, with no wash around it.
 function lantern(){const x=LANTERN.cx,y=LANTERN.cy;let s=L([[x,y-44],[x,y-36]],1.1)+E(x,y-34,3,2.4,1)+`<rect x="${x-9}" y="${y-18}" width="18" height="34" rx="3" fill="#F3E2B8" opacity=".75"/>`;
 s+=C([[x-11,y-20],[x-9,y-28],[x,y-32],[x+9,y-28],[x+11,y-20]],1.3)+L([[x-13,y-20],[x+13,y-20]],1.4)+L([[x-12,y+17],[x+12,y+17]],1.4)+C([[x-9,y+17],[x-7,y+23],[x+7,y+23],[x+9,y+17]],1.2)+L([[x,y+23],[x,y+27]],1)+C([[x,y+8],[x-2.5,y+3],[x,y-5],[x+2.5,y+3],[x,y+8]],.8,'#B88A4A');
 for(const k of [-1,1])s+=L([[x+k*11,y-20],[x+k*11,y+17]],1.4)+L([[x+k*5,y-19],[x+k*5,y+16]],.6,M);return `<g data-cargo-lantern><g transform="translate(${x} ${y}) scale(${LANTERN.k}) translate(${-x} ${-y})">${s}</g></g>`;}
 function rail(){let s='<g data-cargo-rail>';const posts=[];for(let x=380;x<1440;x+=132)posts.push(x);const top=DECK_Y-22;s+=rope(sag(244,DECK_Y-46,posts[0],top+2,8),1.3);for(let i=1;i<posts.length;i++)s+=rope(sag(posts[i-1],top+2,posts[i],top+2,5),1.2);
 const t=DECK_Y-48;s+=F([[238,t],[250,t],[251,DECK_Y],[237,DECK_Y]])+L([[238,t],[237,DECK_Y]],1.4)+L([[250,t],[251,DECK_Y]],1.4)+circle(244,t-6,6.5,1.4)+L([[236,t+6],[252,t+6]],1.1)+C([[247,t+10],[248,t+26],[247,DECK_Y-3]],.5,M);
 for(const x of posts)s+=F([[x-3,top],[x+3,top],[x+3.5,DECK_Y],[x-3.5,DECK_Y]])+L([[x-3,top],[x-3.5,DECK_Y]],1.1)+L([[x+3,top],[x+3.5,DECK_Y]],1.1)+circle(x,top-2,3.4,1.1);return s+'</g>';}
 function deck(){let o='<g data-cargo-deck>'+F([[0,DECK_Y],[HOLD_W,DECK_Y],[HOLD_W,DECK_B],[0,DECK_B]])+L([[0,DECK_Y],[HOLD_W,DECK_Y]],1.6)+L([[0,DECK_B],[HOLD_W,DECK_B]],1.5)+grain(0,HOLD_W,DECK_Y,1,13);for(let x=96;x<HOLD_W;x+=210)o+=L([[x,DECK_Y+1],[x,DECK_B-1]],.6,M);return o+'</g>';}
 // Hatch opening and the whole ladder in page pixels: the stiles start inside the opening, run behind the
 // deck-edge plank (drawn afterwards) and down to the floor, where the inbox pile covers their feet.
 function hatchAndLadder(w,h){const s=unit(w),D=DECK_Y*s,B=DECK_B*s,x0=LADDER.x,foot=h-24;let o='<g data-cargo-hatch>';const hole=[[x0+2,D],[x0+60,D],[x0+70,D-16],[x0+12,D-16]];o+=F(hole,'#D5DAD6');for(let i=1;i<10;i++){const t=i/10;o+=L([[x0+2+58*t,D-1],[x0+12+58*t,D-15]],.45,M,'opacity=".75"');}o+='</g><g data-cargo-ladder>';
 for(const[a,b]of LADDER.stiles){const p=[[x0+a,D-12],[x0+b,D-12],[x0+b+1.5,foot],[x0+a-1.5,foot]];o+=F(p)+L([[x0+a,D-12],[x0+a-1.5,foot]],1.3)+L([[x0+b,D-12],[x0+b+1.5,foot]],1.3)+C([[x0+a,D-12],[x0+(a+b)/2,D-14],[x0+b,D-12]],1.1)+C([[x0+(a+b)/2,B+6],[x0+(a+b)/2+.4,(B+foot)/2],[x0+(a+b)/2,foot-6]],.45,M);}
 for(let y=D-8;y<foot-8;y=y<B?B+10:y+LADDER.rung){const p=[[x0+13,y],[x0+43,y],[x0+43,y+5],[x0+13,y+5]];o+=F(p)+O(p,1)+circle(x0+16,y+2.5,.7,.6)+circle(x0+40,y+2.5,.7,.6);}
 o+='</g><g data-cargo-hatch-lip>'+O([[x0-4,D],[x0+8,D-20],[x0+76,D-20],[x0+66,D]],1.2)+'</g>';return o;}
 function floorDecor(w,h){const y=h-20;let s='<g data-cargo-floor-props>';s+=floorCoil(246,y-9,36,6,6,1);
 const bx=w-172;s+=F([[bx,y-38],[bx+28,y-38],[bx+31,y-19],[bx+28,y],[bx,y],[bx-3,y-19]])+C([[bx,y-38],[bx-3,y-19],[bx,y]],1.4)+C([[bx+28,y-38],[bx+31,y-19],[bx+28,y]],1.4)+E(bx+14,y-38,14,3.5,1.2)+C([[bx,y],[bx+14,y+2],[bx+28,y]],1.2);for(const yy of [y-30,y-8])s+=C([[bx-2,yy],[bx+14,yy+2.4],[bx+30,yy]],1.3);return s+'</g>';}
 function scene(w,h){seed=11;const s=unit(w),g=`transform="scale(${fmt(s)})"`;
 const out=`<g data-morph="deck" data-hold-r20 ${g}>${vista()}${beam()}${rigging(s)}${rail()}${lantern()}</g>`+hatchAndLadder(w,h)+`<g ${g}>${deck()}</g>`+r16.floor(w,h)+floorDecor(w,h);
 place(HOST.querySelector('#tasks'),w);return out;}
 // Hit areas follow the drawing on every scenery redraw (resize included), not only on page render.
 function place(root,width){if(!root||!root.clientWidth)return;const s=unit(width||root.clientWidth);root.querySelectorAll('.cargo-mailbag').forEach((b,i)=>Object.assign(b.style,{left:fmt((TIES[i+1]??TIES.at(-1))*s-SACK.w*s/2)+'px',top:fmt((SACK.top-6)*s)+'px',width:fmt(SACK.w*s)+'px',height:fmt((SACK.h+6)*s)+'px'}));root.style.setProperty('--cargo-s',fmt(s));const today=root.querySelector('[data-p2="task-nav-today"]');if(today)today.dataset.p2Drop='today:';}
 // The archive stack keeps R16's crates and lid; only its coil is swapped for a laid one (tail to the left).
 function archive(){const src=r16.archive(),open=src.indexOf('<g opacity=".9">'),cut=src.indexOf('<g data-archive-inside>');let i=open,depth=0;for(;i<cut;i++){if(src.startsWith('<g',i))depth++;else if(src.startsWith('</g>',i)){depth--;if(!depth){i+=4;break;}}}return src.slice(0,i)+'<g data-archive-coil>'+floorCoil(118,123,17,3.6,4,-1)+'</g>'+src.slice(cut);}
 return{scene,coil,laid,sample,ellipse,floorCoil,archive,place,light:()=>'',lampButton:()=>'',toggleLamp(){},envelope:()=>''};
}
