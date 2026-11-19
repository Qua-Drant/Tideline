import {HOST} from '../../host.ts';
import {sh, parts} from '../scene.ts';
import type {Parts, Shape} from '../scene.ts';
import type {Point} from '../ink.ts';
import type {Attrs} from '../dom.ts';
import type {ProtoApi} from './paper-tasks.ts';
import type {cargoR16} from './paper-cargo-r16.ts';
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
// 第 3b2 期：只被已删的旧版函数用的字符串版（rope、coil、hangingCoilR20 及其 F / O）删去；返回对象只留货舱页取用的成员。
// 第 3c 期：马灯开关的空实现（light、lampButton、toggleLamp）与任务页里对它们的调用、task-lamp 动作一并删去。
// 第 3b 期：风景（sceneV 及其各部分）输出描述（draw/scene.ts），原来的字符串版删去；laid、floorCoil 的几何与输出分开，
// 字符串版留给归档箱（archive，还在页面模板里），描述版给风景。画笔：L / C 是字符串版，LV / CV 是描述版（phase2.js 的 api）。
// 第 3e 期：转 TypeScript；归档箱也改成描述版（货单模板改成节点构建），只剩字符串版用的 laid、floorCoil 与 L / C 删去。
const HOLD_W=1491,BEAM_H=28,DECK_Y=120,DECK_B=132;
const TIES=[890,1071,1168,1274,1380],SACK={w:43,h:56,top:36,k:.56},LANTERN={cx:802,cy:65,k:.9};
const LADDER={x:21,stiles:[[7,13],[43,49]],rung:39};
/** 绳子的选项：闭合、边线粗细、绞纹间距、只画哪一段 */
interface LaidOpts { closed?: boolean; edge?: number; pitch?: number; from?: number; to?: number }
export function cargoR23(a: ProtoApi,r16: ReturnType<typeof cargoR16>){
 const {d,INK:I,SECONDARY:M,TICK:T,PAPER:P,inkV:LV,curveV:CV,circleV}=a;
 const FV=(p: Point[],c=P)=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z`,fill:c});
 const OV=(p: Point[],n=1.3,c=I,at: Attrs|null=null)=>LV([...p,p[0]],n,c,at);
 const unit=(w: number)=>w/HOLD_W,fmt=(v: number)=>(+v.toFixed(2)).toString();
 const EV=(x: number,y: number,rx: number,ry: number,n=1,c=I)=>CV(Array.from({length:25},(_,i): Point=>{const t=i*Math.PI/12;return[x+Math.cos(t)*rx,y+Math.sin(t)*ry];}),n,c);
 let seed=11;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 function grainV(x0: number,x1: number,y: number,rows: number,h: number){const s: Parts[]=[];for(let r=0;r<rows;r++){const yy=y+h*(r+1)/(rows+1);let x=x0+8+rnd()*30;while(x<x1-20){const len=Math.min(x1-6-x,60+rnd()*140);s.push(CV([[x,yy],[x+len*.5,yy-.4+rnd()*.8],[x+len,yy]],.5,T));x+=len+18+rnd()*40;}}return s;}
 // Centripetal-free Catmull–Rom resampling, then the tube: fill, two edges, the strand lays and a few lee ticks.
 function sample(p: Point[],step=2): Point[]{if(p.length<3){const[a0,a1]=p[0],[b0,b1]=p[1],n=Math.max(2,Math.ceil(Math.hypot(b0-a0,b1-a1)/step));return Array.from({length:n+1},(_,i): Point=>[a0+(b0-a0)*i/n,a1+(b1-a1)*i/n]);}
 const out: Point[]=[];for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2,n=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/step));for(let j=0;j<n;j++){const t=j/n,t2=t*t,t3=t2*t;out.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)) as Point);}}out.push(p.at(-1)!);return out;}
 const q=(v: number)=>+v.toFixed(2);
 // 一段绳子的几何：外形（ring）、两条边、绞纹（lays）与背光的短线（lee）；laidV 给描述
 function laidGeometry(P: Point[],wd: number,{closed=false,edge=1,pitch=1.05,from=0,to=1}: LaidOpts={}){const n=P.length,A: Point[]=[],B: Point[]=[],T: Point[]=[],N: Point[]=[];for(let i=0;i<n;i++){const a0=P[closed?(i-1+n)%n:Math.max(0,i-1)],a1=P[closed?(i+1)%n:Math.min(n-1,i+1)];let tx=a1[0]-a0[0],ty=a1[1]-a0[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;T.push([tx,ty]);N.push([-ty,tx]);A.push([P[i][0]-ty*wd/2,P[i][1]+tx*wd/2]);B.push([P[i][0]+ty*wd/2,P[i][1]-tx*wd/2]);}
 const ring=closed?`M${A.map(p=>p.map(q).join(',')).join('L')}ZM${B.map(p=>p.map(q).join(',')).join('L')}Z`:`M${[...A,...B.slice().reverse()].map(p=>p.map(q).join(',')).join('L')}Z`;
 let lays='',lee='',run=0,next=wd*.4;const i0=Math.floor(from*(n-1)),i1=Math.ceil(to*(n-1));for(let i=1;i<n;i++){run+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(run<next)continue;next=run+wd*pitch;if(i<i0||i>i1)continue;const[c0,c1]=P[i],[tx,ty]=T[i],[nx,ny]=N[i],h=wd*.47,s=wd*.42,dn=ny>0?1:-1;
 lays+=`M${q(c0+nx*h-tx*s)},${q(c1+ny*h-ty*s)}Q${q(c0+tx*wd*.16)},${q(c1+ty*wd*.16)} ${q(c0-nx*h+tx*s)},${q(c1-ny*h+ty*s)}`;
 lee+=`M${q(c0+dn*nx*h*.15+tx*s*.55)},${q(c1+dn*ny*h*.15+ty*s*.55)}L${q(c0+dn*nx*h*.85+tx*s*.95)},${q(c1+dn*ny*h*.85+ty*s*.95)}`;}
 return{ring,A:closed?[...A,A[0]]:A,B:closed?[...B,B[0]]:B,edge,lays,lee,layW:q(Math.max(.45,wd*.13)),leeW:q(Math.max(.35,wd*.09))};}
 // laysOpacity：绞纹的不透明度（地上盘绳里压在下面的几圈淡一些，原来在字符串上把 .85 换成 .5）
 function laidV(P: Point[],wd: number,opts: LaidOpts,laysOpacity='.85'): Parts[]{const g=laidGeometry(P,wd,opts);return [sh('path',{d:g.ring,fill:P_,'fill-rule':'evenodd'}),CV(g.A,g.edge,I),CV(g.B,g.edge*.9,I),
  sh('path',{d:g.lays,fill:'none',stroke:I,'stroke-width':g.layW,'stroke-linecap':'round',opacity:laysOpacity}),sh('path',{d:g.lee,fill:'none',stroke:M,'stroke-width':g.leeW,'stroke-linecap':'round',opacity:'.75'})];}
 const P_=P,ropeV=(p: Point[],n=1.5)=>laidV(sample(p,1.6),n*2.3,{edge:.75});
 const ellipse=(cx: number,cy: number,rx: number,ry: number,rot=0,k=72)=>Array.from({length:k},(_,i): Point=>{const t=i/k*Math.PI*2,x=Math.cos(t)*rx,y=Math.sin(t)*ry;return[cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)];});
 // A coil lying on the floor: loops flaked one on another, each a closed laid ring; the tail leaves from the bottom loop.
 // 几何（floorCoilParts：尾巴、几笔短线、一圈圈绳）与输出分开：floorCoilV 是描述版（地上的盘绳、归档箱的盘绳）
 type CoilPart=['laid',Point[],number,LaidOpts,boolean]|['tick',Point[]];
 function floorCoilParts(cx: number,cy: number,R: number,wd: number,loops=5,tail=1){const out: CoilPart[]=[];const ry=R*.36,rn=(k: number)=>((Math.sin(k*127.1+cx*.31)*43758.5453)%1+1)%1;
 if(tail)out.push(['laid',sample([[cx+R*.55*tail,cy+ry*.75],[cx+R*1.05*tail,cy+ry+3],[cx+R*1.55*tail,cy+ry+6],[cx+R*2.1*tail,cy+ry+5],[cx+R*2.5*tail,cy+ry+7]],1.6),wd,{edge:.8},true]);
 for(const x of [-.95,-.55,-.1,.4,.85])out.push(['tick',[[cx+R*x-4,cy+ry+wd*.55],[cx+R*x+4,cy+ry+wd*.55]]]);
 // Flaked loops: each a little off-centre, of its own size and tilt; lower loops carry paler lays so the eye
 // of the coil does not fill with ink.
 for(let i=0;i<loops;i++){const last=i===loops-1,r=R*(1-i*.06)*(.9+rn(i)*.18),x=cx+(rn(i+7)-.5)*R*.36,y=cy-i*wd*.32+(rn(i+3)-.5)*wd*.6,rot=(rn(i+11)-.5)*.22;out.push(['laid',ellipse(x,y,r,r*.36*(.9+rn(i+5)*.2),rot,Math.max(56,Math.round(r*2.4))),wd,{closed:true,edge:.85},last]);}return out;}
 const floorCoilV=(cx: number,cy: number,R: number,wd: number,loops=5,tail=1)=>floorCoilParts(cx,cy,R,wd,loops,tail).map(c=>c[0]==='tick'?LV(c[1],.45,M,{opacity:'.7'}):laidV(c[1],c[2],c[3],c[4]?'.85':'.5'));
 const sag=(x0: number,y0: number,x1: number,y1: number,drop: number,k=9)=>Array.from({length:k},(_,i): Point=>{const t=i/(k-1);return[x0+(x1-x0)*t,y0+(y1-y0)*t+Math.sin(t*Math.PI)*drop];});
 // A slimmer main beam: top arris, one inner line, sparse grain, bolts, a pale shadow under it.
 function beamV(){const s: Parts[]=[FV([[0,0],[HOLD_W,0],[HOLD_W,BEAM_H],[0,BEAM_H]]),LV([[0,1],[HOLD_W,1]],1.4),LV([[0,6],[HOLD_W,6]],.7,M),LV([[0,BEAM_H],[HOLD_W,BEAM_H]],1.6),grainV(0,HOLD_W,6,2,BEAM_H-6)];
 for(const x of [120,430,640,960,1220])s.push(circleV(x,17,1.4,.8));for(let x=3;x<HOLD_W;x+=7)s.push(LV([[x,BEAM_H+1],[x-2,BEAM_H+4]],.4,T));return s;}
 // Sack in its own 76 × 100 drawing; the initial is set in the SVG so it moves with the drawing.
 function sackV(x: number,person: {id: string; initial?: string|null},pressed: boolean,s: number){const ox=x-SACK.w/2,oy=SACK.top,k=SACK.k;const o: Parts[]=[CV([[38,-6],[38,6]],1),EV(38,9,4,3,1.1)];const ruff: Point[]=[[30,21],[27,17],[28,14],[32,13],[35,15],[38,12.5],[41,15],[44,13],[48,14],[49,17],[46,21]];o.push(FV(ruff),CV([...ruff,ruff[0]],1.05));for(const k of [33,38,43])o.push(CV([[k,15],[k+.4,18],[k,20.5]],.45,M));
 const body: Point[]=[[30,22],[19,34],[10,54],[7,74],[12,90],[26,97],[50,97],[64,90],[69,74],[66,54],[57,34],[46,22]];o.push(FV(body),CV([...body,body[0]],1.5),CV([[28,21],[38,25],[48,21]],1.6),CV([[29,24],[38,27.5],[47,24]],1));
 for(const p of [[[33,28],[24,48],[21,72]],[[44,28],[53,48],[56,70]],[[16,74],[20,86],[30,93]]] as Point[][])o.push(CV(p,.55,M));for(let i=0;i<7;i++){const k=58+i*1.5;o.push(CV([[k,40+i*3.4],[k+.8,62+i],[k,84-i*1.5]],.4,M,{opacity:'.7'}));}
 const tag: Point[]=[[26,44],[50,43],[51,69],[27,70]];o.push(LV([[38,27],[38,44]],.7),FV(tag),OV(tag,1),circleV(38,47,1,.6));
 // 疑似问题批（扫描新发现）：视图不可见时宽 0，缩放 s = 0，字号 12/s 原来是 Infinity（<text> 的 y、font-size 写出 “Infinity”）；这时整组缩成 0，字号取 0
 const fs=s>0?12/s/k:0;
 o.push(sh('text',{x:'38.5',y:fmt(57+fs*.36),'font-size':fmt(fs),'text-anchor':'middle',fill:I,style:'font-family:var(--sans)','text-decoration':pressed?'underline':null},person.initial==null?'':String(person.initial)));if(pressed)o.push(LV([[31,63.5],[46,63.5]],.9));
 return sh('g',{'data-cargo-sack':`${person.id}`,transform:`translate(${ox} ${oy}) scale(${k})`},o);}
 // Hanging coil: a cleat, loops hung from it back to front, two lashing turns round the neck and a tail.
 function hangingCoilV(cx: number,cy: number){const top=cy-24,o: Parts[]=[FV([[cx-4,top-8],[cx+6,top-8],[cx+6,top-2],[cx-4,top-2]]),OV([[cx-4,top-8],[cx+6,top-8],[cx+6,top-2],[cx-4,top-2]],1),LV([[cx-8,top-8],[cx+10,top-8]],1.2)];
 o.push(laidV(sample([[cx+4,top+44],[cx+6,top+58],[cx+3,top+70],[cx+6,top+80]],1.4),3.2,{edge:.75}));
 for(let i=0;i<6;i++){const rx=10.5+(i%3)*.9-i*.3,ry=21+((i*5)%3)-i*.4,x=cx+1+(i-2.5)*.9,rot=(i-2.5)*.035;o.push(laidV(ellipse(x,top+ry+1,rx,ry,rot,64),3.2,{closed:true,edge:.8}));}
 for(const dy of [4,8.5])o.push(laidV(sample([[cx-11,top+dy+1],[cx+1,top+dy+2.2],[cx+13,top+dy]],1.2),3,{edge:.8}));return o;}
 // Pale sea seen past the open side of the hold: horizon, two far islands, a sail, sparse water strokes.
 // Pale sea past the open side of the hold: no horizon, only sparse water strokes, longer and paler towards the top.
 function vistaV(){const o: Parts[]=[];const y0=BEAM_H+16,y1=DECK_Y-30;for(let i=0;i<22;i++){const x=(i*397+((i*i*53)%211))%HOLD_W,t=((i*7)%11)/10,y=y0+(y1-y0)*t,len=14+(1-t)*26+(i%3)*5;o.push(CV([[x,y],[x+len*.35,y-.6],[x+len*.7,y-.2],[x+len,y+.3]],.45,T,{opacity:(.55+t*.35).toFixed(2)}));if(i%4===0)o.push(CV([[x+len*.3,y+4],[x+len*.75,y+3.6]],.4,T,{opacity:'.6'}));}return sh('g',{'data-cargo-vista':true},o);}
 function riggingV(s: number){const o: Parts[]=[];for(let i=1;i<TIES.length;i++)o.push(ropeV(sag(TIES[i-1],BEAM_H+4,TIES[i],BEAM_H+4,11),1.75));o.push(ropeV(sag(TIES.at(-1)!,BEAM_H+4,1452,BEAM_H,8),1.75));
 for(const x of TIES){o.push(FV([[x-6,2],[x+6,2],[x+6,BEAM_H],[x-6,BEAM_H]]),LV([[x-6,2],[x-6,BEAM_H]],1),LV([[x+6,2],[x+6,BEAM_H]],1));for(let y=5;y<BEAM_H-1;y+=5)o.push(LV([[x-6,y],[x+6,y+2.6]],.7,M));o.push(circleV(x,BEAM_H+5,4,1.2));}
 o.push(circleV(1030,BEAM_H+7,5.5,1.2),circleV(1030,BEAM_H+7,2.6,.7));
 const f=d.ui.taskFilter;(HOST.cargoPeople?HOST.cargoPeople(d,TIES.length-1):d.people.slice(0,TIES.length-1)).forEach((p,i)=>{o.push(sackV(TIES[i+1],p,f.kind==='person'&&f.id===p.id,s));});
 const px=1452;o.push(FV([[px,0],[HOLD_W,0],[HOLD_W,DECK_B],[px,DECK_B]]),LV([[px,0],[px,DECK_B]],1.6));for(let x=px+12;x<HOLD_W;x+=12)o.push(CV([[x,4],[x+.6,DECK_B/2],[x,DECK_B-4]],.5,T));for(const y of [44,98])o.push(FV([[px-3,y-4],[HOLD_W,y-4],[HOLD_W,y+4],[px-3,y+4]]),LV([[px-3,y-4],[HOLD_W,y-4]],1.1),LV([[px-3,y+4],[HOLD_W,y+4]],1.1));
 o.push(hangingCoilV(1432,70));return sh('g',{'data-cargo-rigging':true},o);}
 // Lantern hanging from the beam; the glass stays faintly warm, with no wash around it.
 function lanternV(){const x=LANTERN.cx,y=LANTERN.cy;const s: Parts[]=[LV([[x,y-44],[x,y-36]],1.1),EV(x,y-34,3,2.4,1),sh('rect',{x:x-9,y:y-18,width:'18',height:'34',rx:'3',fill:'#F3E2B8',opacity:'.75'})];
 s.push(CV([[x-11,y-20],[x-9,y-28],[x,y-32],[x+9,y-28],[x+11,y-20]],1.3),LV([[x-13,y-20],[x+13,y-20]],1.4),LV([[x-12,y+17],[x+12,y+17]],1.4),CV([[x-9,y+17],[x-7,y+23],[x+7,y+23],[x+9,y+17]],1.2),LV([[x,y+23],[x,y+27]],1),CV([[x,y+8],[x-2.5,y+3],[x,y-5],[x+2.5,y+3],[x,y+8]],.8,'#B88A4A'));
 for(const k of [-1,1])s.push(LV([[x+k*11,y-20],[x+k*11,y+17]],1.4),LV([[x+k*5,y-19],[x+k*5,y+16]],.6,M));return sh('g',{'data-cargo-lantern':true},sh('g',{transform:`translate(${x} ${y}) scale(${LANTERN.k}) translate(${-x} ${-y})`},s));}
 function railV(){const posts: number[]=[];for(let x=380;x<1440;x+=132)posts.push(x);const top=DECK_Y-22,s: Parts[]=[ropeV(sag(244,DECK_Y-46,posts[0],top+2,8),1.3)];for(let i=1;i<posts.length;i++)s.push(ropeV(sag(posts[i-1],top+2,posts[i],top+2,5),1.2));
 const t=DECK_Y-48;s.push(FV([[238,t],[250,t],[251,DECK_Y],[237,DECK_Y]]),LV([[238,t],[237,DECK_Y]],1.4),LV([[250,t],[251,DECK_Y]],1.4),circleV(244,t-6,6.5,1.4),LV([[236,t+6],[252,t+6]],1.1),CV([[247,t+10],[248,t+26],[247,DECK_Y-3]],.5,M));
 for(const x of posts)s.push(FV([[x-3,top],[x+3,top],[x+3.5,DECK_Y],[x-3.5,DECK_Y]]),LV([[x-3,top],[x-3.5,DECK_Y]],1.1),LV([[x+3,top],[x+3.5,DECK_Y]],1.1),circleV(x,top-2,3.4,1.1));return sh('g',{'data-cargo-rail':true},s);}
 function deckV(){const o: Parts[]=[FV([[0,DECK_Y],[HOLD_W,DECK_Y],[HOLD_W,DECK_B],[0,DECK_B]]),LV([[0,DECK_Y],[HOLD_W,DECK_Y]],1.6),LV([[0,DECK_B],[HOLD_W,DECK_B]],1.5),grainV(0,HOLD_W,DECK_Y,1,13)];for(let x=96;x<HOLD_W;x+=210)o.push(LV([[x,DECK_Y+1],[x,DECK_B-1]],.6,M));return sh('g',{'data-cargo-deck':true},o);}
 // Hatch opening and the whole ladder in page pixels: the stiles start inside the opening, run behind the
 // deck-edge plank (drawn afterwards) and down to the floor, where the inbox pile covers their feet.
 function hatchAndLadderV(w: number,h: number){const s=unit(w),D=DECK_Y*s,B=DECK_B*s,x0=LADDER.x,foot=h-24;const hole: Point[]=[[x0+2,D],[x0+60,D],[x0+70,D-16],[x0+12,D-16]],hatch: Parts[]=[FV(hole,'#D5DAD6')];for(let i=1;i<10;i++){const t=i/10;hatch.push(LV([[x0+2+58*t,D-1],[x0+12+58*t,D-15]],.45,M,{opacity:'.75'}));}
 const ladder: Parts[]=[];for(const[a,b]of LADDER.stiles){const p: Point[]=[[x0+a,D-12],[x0+b,D-12],[x0+b+1.5,foot],[x0+a-1.5,foot]];ladder.push(FV(p),LV([[x0+a,D-12],[x0+a-1.5,foot]],1.3),LV([[x0+b,D-12],[x0+b+1.5,foot]],1.3),CV([[x0+a,D-12],[x0+(a+b)/2,D-14],[x0+b,D-12]],1.1),CV([[x0+(a+b)/2,B+6],[x0+(a+b)/2+.4,(B+foot)/2],[x0+(a+b)/2,foot-6]],.45,M));}
 for(let y=D-8;y<foot-8;y=y<B?B+10:y+LADDER.rung){const p: Point[]=[[x0+13,y],[x0+43,y],[x0+43,y+5],[x0+13,y+5]];ladder.push(FV(p),OV(p,1),circleV(x0+16,y+2.5,.7,.6),circleV(x0+40,y+2.5,.7,.6));}
 return [sh('g',{'data-cargo-hatch':true},hatch),sh('g',{'data-cargo-ladder':true},ladder),sh('g',{'data-cargo-hatch-lip':true},OV([[x0-4,D],[x0+8,D-20],[x0+76,D-20],[x0+66,D]],1.2))];}
 function floorDecorV(w: number,h: number){const y=h-20,s: Parts[]=[floorCoilV(246,y-9,36,6,6,1)];
 const bx=w-172;s.push(FV([[bx,y-38],[bx+28,y-38],[bx+31,y-19],[bx+28,y],[bx,y],[bx-3,y-19]]),CV([[bx,y-38],[bx-3,y-19],[bx,y]],1.4),CV([[bx+28,y-38],[bx+31,y-19],[bx+28,y]],1.4),EV(bx+14,y-38,14,3.5,1.2),CV([[bx,y],[bx+14,y+2],[bx+28,y]],1.2));for(const yy of [y-30,y-8])s.push(CV([[bx-2,yy],[bx+14,yy+2.4],[bx+30,yy]],1.3));return sh('g',{'data-cargo-floor-props':true},s);}
 /** 货舱的风景（描述）：梁、绳、邮包、马灯、栏杆、舱口与梯子、甲板、地板、地上的盘绳与木桶 */
 function sceneV(w: number,h: number){seed=11;const s=unit(w),g=`scale(${fmt(s)})`;
 const out=parts(sh('g',{'data-morph':'deck','data-hold-r20':true,transform:g},vistaV(),beamV(),riggingV(s),railV(),lanternV()),hatchAndLadderV(w,h),sh('g',{transform:g},deckV()),r16.floorV(w,h),floorDecorV(w,h));
 place(HOST.querySelector('#tasks') as HTMLElement|null,w);return out;}
 // Hit areas follow the drawing on every scenery redraw (resize included), not only on page render.
 function place(root: HTMLElement|null,width?: number){if(!root||!root.clientWidth)return;const s=unit(width||root.clientWidth);root.querySelectorAll<HTMLElement>('.cargo-mailbag').forEach((b,i)=>Object.assign(b.style,{left:fmt((TIES[i+1]??TIES.at(-1))*s-SACK.w*s/2)+'px',top:fmt((SACK.top-6)*s)+'px',width:fmt(SACK.w*s)+'px',height:fmt((SACK.h+6)*s)+'px'}));root.style.setProperty('--cargo-s',fmt(s));const today=root.querySelector<HTMLElement>('[data-p2="task-nav-today"]');if(today)today.dataset.p2Drop='today:';}
 // The archive stack keeps R16's crates and lid; only its coil is swapped for a laid one (tail to the left).
 function archive(): Shape{return r16.archiveV(sh('g',{'data-archive-coil':true},floorCoilV(118,123,17,3.6,4,-1)));}
 return{sceneV,archive,place};
}
