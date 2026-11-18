import {chartArtR21,NOW} from './paper-chart-art-r21.ts';
import type {ChartApi} from './paper-chart-art-r21.ts';
import {maritimeArt} from './paper-maritime-r14.ts';
import {sh,parts,partNodes} from '../scene.ts';
import type {Shape,Parts} from '../scene.ts';
import {svg} from '../dom.ts';
import type {Point} from '../ink.ts';
export {NOW};
// R22: one layout for the whole chart. Zones, lanes, boats, piers, the archive tube, the new berth and the compass
// are placed first in pixels; islets, soundings, weed, clouds, currents and zone limits then take only the space
// that is still free. HTML and SVG read the same numbers, so nothing overlaps or drifts at any window size.
// 第 4a 期：转 TypeScript；归档卷筒改成节点版（tubeEl，几何相同），字符串版 tube 没有调用方，删去。
/** 版面里占住的一块（tag 说明是什么；fit 放下的还带中心 cx / cy） */
export interface ChartRect {x: number; y: number; w: number; h: number; tag: string; cx?: number; cy?: number}
type Placed=ChartRect&{cx: number; cy: number};
export interface ChartLane {id: string; y: number; start: number; end: number; bx: number; inline: boolean; side: 'left'|'right'}
export interface ChartLayout {
 w: number; h: number; k: number; cL: number; cR: number; zones: Record<string,[number,number]>;
 labels: (ChartRect&{cx: number; zone: string; name: string; state: string})[]; lanes: ChartLane[]; marks: Record<string,{x: number; y: number}>;
 piers: {x0: number; x1: number; y: number}[]; spit: {x: number; y: number; w: number; h: number}; archive: Placed|null; berth: Placed|null; compass: Placed|null;
 clouds: Placed[]; isle: Placed|null; islets: (Placed&{s: number; seed: number})[]; rocks: Placed[]; weeds: (Placed&{kk: number})[]; soundings: (Placed&{t: string})[];
 R: ChartRect[]; leftX: (y: number) => number; rightX: (y: number) => number; top: number; bottom: number;
}
/** 版面的输入：进行中的项目带进度，其余只要 id 与名称（暂停的带 anchor） */
export interface ChartVoyages {active?: {id: string; title: string; ratio: number}[]; planned?: {id: string; title: string}[]; paused?: {id: string; title: string; anchor?: boolean}[]; completed?: {id: string; title: string}[]; archived?: number}
const textW=(s: unknown,fs: number)=>[...String(s)].reduce((n,c)=>n+(c.charCodeAt(0)>255?fs:fs*.58),0);
const LEFT=[[0,.13],[.41,.16],[.57,.19],[.48,.22],[.68,.25],[.51,.29],[.63,.33],[1,.38],[.94,.42],[.73,.45],[.79,.49],[.87,.53],[.75,.57],[.48,.61],[.4,.66],[.52,.71],[.68,.76],[.56,.8],[.27,.84],[.35,.9],[0,.93]];
const RIGHT=[[0,.12],[.33,.17],[.44,.21],[.65,.23],[.71,.28],[.55,.32],[.59,.36],[.45,.4],[.65,.44],[.82,.48],[.79,.52],[.64,.57],[.7,.62],[.86,.66],[1,.71],[.94,.76],[.65,.81],[.71,.85],[.58,.9],[0,.93]];
export function chartLayoutR22(w: number,h: number,{active=[],planned=[],paused=[],completed=[]}: ChartVoyages): ChartLayout{
 const k=Math.max(.82,Math.min(1.12,w/1250)),R: ChartRect[]=[],cL=Math.round(66*k),cR=Math.round(66*k);
 const hit=(r: ChartRect,p: number,ignore?: string[])=>R.some(q=>!(ignore&&ignore.includes(q.tag))&&r.x-p<q.x+q.w&&r.x+r.w+p>q.x&&r.y-p<q.y+q.h&&r.y+r.h+p>q.y);
 const take=<T extends ChartRect>(r: T)=>(R.push(r),r),inside=(r: ChartRect)=>r.x>=1&&r.y>=1&&r.x+r.w<=w-1&&r.y+r.h<=h-1;
 const fit=(cands: number[][],bw: number,bh: number,tag: string,p=8,ignore?: string[]): Placed|null=>{for(const[cx,cy]of cands){const r={x:cx-bw/2,y:cy-bh/2,w:bw,h:bh,tag};if(inside(r)&&!hit(r,p,ignore))return take({...r,cx,cy});}return null;};
 const coastX=(pts: number[][],y: number,band: number)=>{const v=y/h;for(let i=1;i<pts.length;i++)if(v<=pts[i][1]){const[a0,a1]=pts[i-1],[b0,b1]=pts[i],t=(v-a1)/((b1-a1)||1);return(a0+(b0-a0)*t)*band;}return 0;};
 const leftX=(y: number)=>coastX(LEFT,y,cL),rightX=(y: number)=>w-coastX(RIGHT,y,cR);
 const b3=Math.min(w*.87,w-cR-150),b2=Math.min(w*.71,b3-170),b1=Math.max(w*.2,cL+190);
 const zones: Record<string,[number,number]>={planned:[cL,b1],active:[b1,b2],paused:[b2,b3],completed:[b3,w-cR]},mid=(z: string)=>(zones[z][0]+zones[z][1])/2;
 // Fixed furniture: the goal line and list toggle, the four zone captions, both shores and the lower shore.
 take({x:0,y:0,w,h:24,tag:'top'});take({x:w-48,y:0,w:48,h:42,tag:'top'});
 const labels=[['planned','港口','计划中'],['active','开阔海','进行中'],['paused','海湾','暂停'],['completed','对岸','已完成']].map(([z,name,state])=>{const lw=Math.max(textW(name,17),textW(state,11))+18;return{zone:z,name,state,...take({x:mid(z)-lw/2,y:30,w:lw,h:46,tag:'label'}),cx:mid(z)};});
 for(let y=0;y<h;y+=12){const l=leftX(y),r=rightX(y);if(l>1)take({x:0,y,w:l+3,h:12,tag:'land'});if(r<w-1)take({x:r-3,y,w:w-r+3,h:12,tag:'land'});}
 take({x:0,y:h-24,w,h:24,tag:'shore'});
 // Active lanes. A boat sits on its lane at its progress; its name rides above the sails.
 // The first lane keeps its boat name clear of the zone captions; when lanes are close the name moves beside the sails.
 const top=96,bottom=h-46,count=Math.max(3,active.length),start=b1+56,end=b2-76,span=(bottom-top)/count,inline=span<92,first=Math.max(top+span*.5,inline?126:150),gap=count>1?Math.min(span,(bottom-first)/(count-.5)):0;
 const lanes=active.map((p,i): ChartLane=>{const y=Math.round(first+gap*i),bx=start+(end-start)*p.ratio,lw=Math.max(56,textW(p.title,14)+14);take({x:start-12,y:y-10,w:end-start+70,h:20,tag:'lane'});const side=end-bx-36>=lw+28?'right':'left';take(!inline?{x:bx-lw/2,y:y-68,w:lw,h:72,tag:'boat'}:side==='right'?{x:bx-26,y:y-48,w:lw+50,h:52,tag:'boat'}:{x:bx-lw-24,y:y-48,w:lw+50,h:52,tag:'boat'});return{id:p.id,y,start,end,bx,inline,side};});
 // Moored boats: each sits at the end of a pier from its shore; the name stands under the hull.
 const piers: ChartLayout['piers']=[],marks: ChartLayout['marks']={};
 const moor=(list: {id: string; title: string; anchor?: boolean}[],zone: string,side: number)=>{const[z0,z1]=zones[zone];list.forEach(p=>{const bw=Math.max(60,textW(p.title,14)+14),cands: number[][]=[];for(let y=top-10;y<h-90;y+=6)for(const dx of [0,-.18,.18,-.3,.3])cands.push([mid(zone)+(z1-z0)*dx,y+36]);const bh=p.anchor?100:74,r=fit(cands.map(([x,y])=>[x,y+(bh-74)/2]),bw,bh,'boat',10);if(!r)return;marks[p.id]={x:r.cx,y:r.y};if(side){const hy=r.y+38,x0=side<0?leftX(hy)-2:rightX(hy)+2,x1=side<0?r.cx-26:r.cx+26;if(Math.abs(x1-x0)>14){piers.push({x0,x1,y:hy});take({x:Math.min(x0,x1),y:hy-14,w:Math.abs(x1-x0),h:22,tag:'pier'});}}});};
 moor(planned,'planned',-1);moor(completed,'completed',1);
 // The paused bay: a curled spit off the top of its zone; anchored boats ride below it.
 const zw=b3-b2,spit={x:b2+zw*.06,y:top-10,w:Math.min(zw*.6,130*k),h:80*k};take({...spit,tag:'spit'});moor(paused,'paused',0);
 const archive=fit(Array.from({length:40},(_,i)=>[mid('planned')+(i%2?14:0),h-44-i*6]),156,30,'ui',6);
 const berth=fit(Array.from({length:60},(_,i)=>[mid('planned')+[0,-20,20][i%3],h-96-Math.floor(i/3)*8]),116,54,'ui',8);
 // The compass keeps the lower right corner: it shrinks before it moves up.
 const cs=Math.round(Math.min(104*k,h*.26));let compass: Placed|null=null;for(const[s,reach]of [[cs,48],[cs*.82,48],[cs*.66,64],[cs*.66,200]]){const c: number[][]=[];for(let dy=0;dy<reach;dy+=6)for(let dx=0;dx<260;dx+=10)c.push([w-cR-s/2-14-dx,h-30-s/2-dy]);compass=fit(c,s,s,'compass',8);if(compass)break;}
 // Scenery fills what is left, in a stable pseudo-random order.
 const hash=(i: number)=>((Math.sin(i*91.7+w*.013+h*.007)*43758.5453)%1+1)%1,order=(c: number[][])=>c.map((p,i): [number[],number]=>[p,hash(i)]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
 const clouds: Placed[]=[];for(const cx of [mid('active')-170*k,mid('paused')-70*k,mid('active')+160*k,mid('completed')]){const r=fit([[cx,42],[cx+30,46],[cx-40,40]],76*k,20*k,'cloud',4);if(r)clouds.push(r);}
 const water: number[][]=[];for(let y=top-30;y<h-34;y+=22)for(let x=b1+16;x<w-cR-16;x+=26)water.push([x,y]);
 const isle=fit(order(water.filter(([x,y])=>y<h*.62&&x>b1+120)),160*k,64*k,'isle',16);
 const islets: ChartLayout['islets']=[];for(const p of order(water)){if(islets.length>=7)break;const s=(.5+hash(islets.length+11)*.4)*k,r=fit([p],64*s,30*s,'islet',18);if(r)islets.push({...r,s,seed:islets.length+1});}
 const rocks: Placed[]=[];for(const p of order(water.slice().reverse())){if(rocks.length>=5)break;const r=fit([p],34*k,14*k,'rock',14);if(r)rocks.push(r);}
 const weeds: ChartLayout['weeds']=[];for(let x=b1-40;x<w-cR-20;x+=58){if(hash(x*.7)<.45)continue;const kk=.32+hash(x)*.22,r=fit([[x+hash(x+3)*26,h-14-50*kk]],16,100*kk,'weed',4,['shore']);if(r)weeds.push({...r,kk});}
 // Soundings are sparse: about one per 26 000 px² of open water, never closer than 60 px to each other.
 const soundings: ChartLayout['soundings']=[],want=Math.round((w-cL-cR)*(h-90)/26000);for(const[x,y]of order(water)){if(soundings.length>=want)break;if(x<leftX(y)+18||x>rightX(y)-18)continue;const r=fit([[x,y]],18,12,'sounding',22);if(r)soundings.push({...r,t:x>b1&&x<b2?(y>h*.55?'50':'30'):(x<b1?'10':'20')});}
 return{w,h,k,cL,cR,zones,labels,lanes,marks,piers,spit,archive,berth,compass,clouds,isle,islets,rocks,weeds,soundings,R,leftX,rightX,top,bottom};}
export function chartArtR22(a: ChartApi){
 const r21=chartArtR21(a),I=a.INK,M=a.SECONDARY,T=a.TICK,P=a.PAPER,m=maritimeArt(a);
 // A line is drawn only where it does not cross a placed thing; each free run is drawn on its own.
 function runs(pts: Point[],lay: ChartLayout,tags: string[],p=6,step=3){const out: Point[][]=[];let cur: Point[]=[];const block=([x,y]: Point)=>lay.R.some(q=>tags.includes(q.tag)&&x>q.x-p&&x<q.x+q.w+p&&y>q.y-p&&y<q.y+q.h+p);
 for(let i=1;i<pts.length;i++){const[a0,a1]=pts[i-1],[b0,b1]=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b0-a0,b1-a1)/step));for(let j=0;j<n;j++){const q: Point=[a0+(b0-a0)*j/n,a1+(b1-a1)*j/n];if(block(q)){if(cur.length>3)out.push(cur);cur=[];}else cur.push(q);}}if(cur.length>3)out.push(cur);return out;}
 const SOLID=['label','boat','pier','ui','compass','isle','islet','rock','spit','cloud'];
 // 第 3b 期：海图风景输出描述（draw/scene.ts），原来的字符串版只在风景里用，删去。画笔 LV / CV / FV 是描述版
 const LV=a.inkV,CV=a.curveV,FV=(p: Point[])=>sh('path',{d:`M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z`,fill:P});
 function isletV(x: number,y: number,k: number,seed=1){const r=(i: number)=>((Math.sin(i*12.9898+seed*78.233)*43758.5453)%1+1)%1,n=9,pts: Point[]=[];for(let i=0;i<=n;i++){const t=i/n,hh=Math.sin(t*Math.PI)*(14+r(i)*10)*k;pts.push([x-26*k+52*k*t,y-hh]);}
 const s: Parts[]=[FV([...pts,[x+26*k,y],[x-26*k,y]]),CV(pts,1.15,I),CV([[x-30*k,y],[x+30*k,y]],.8,M)];for(let i=0;i<6;i++){const t=.55+i*.07,px=x-26*k+52*k*t,tp=y-Math.sin(t*Math.PI)*16*k;s.push(LV([[px,tp+2],[px-2*k,y-1]],.4,M,{opacity:'.75'}));}
 for(const dy of [4,8])s.push(CV([[x-34*k+dy,y+dy],[x,y+dy+1],[x+34*k-dy,y+dy]],.5,T));return sh('g',{'data-chart-islet':true},s);}
 function shoresV(lay: ChartLayout){const{w,h}=lay;const s: Parts[]=[];const left=Array.from({length:41},(_,i): Point=>{const y=h*(.13+.8*i/40);return[lay.leftX(y),y];}),right=Array.from({length:41},(_,i): Point=>{const y=h*(.12+.81*i/40);return[lay.rightX(y),y];});
 s.push(FV([[0,left[0][1]],...left,[0,left.at(-1)![1]]]),CV(left,1.5),FV([[w,right[0][1]],...right,[w,right.at(-1)![1]]]),CV(right,1.5));for(const[o,col]of [[9,M],[19,T]] as [number,string][]){s.push(CV(left.map(([x,y]): Point=>[x+o*lay.k,y]),.65,col,{opacity:'.8'}),CV(right.map(([x,y]): Point=>[x-o*lay.k,y]),.65,col,{opacity:'.8'}));}
 const k=lay.k;s.push(m.towerV(lay.leftX(h*.27)*.45,h*.27,.5*k),m.houseV(4,h*.31,.5*k),m.houseV(lay.leftX(h*.5)*.35,h*.52,.42*k),m.towerV(w-lay.cR*.45,h*.33,.48*k),m.houseV(w-lay.cR*.6,h*.62,.52*k),m.houseV(w-lay.cR*.3,h*.66,.42*k));
 for(const p of lay.piers){const{x0,x1,y}=p,a0=Math.min(x0,x1),a1=Math.max(x0,x1);s.push(FV([[a0,y-4],[a1,y-4],[a1,y+3],[a0,y+3]]),LV([[a0,y-4],[a1,y-4]],1.05),LV([[a0,y+3],[a1,y+3]],1.05),LV([[x1,y-4],[x1,y+3]],1));const n=Math.max(2,Math.floor((a1-a0)/22));for(let i=1;i<=n;i++){const x=a0+(a1-a0)*i/(n+.4);s.push(LV([[x,y-11],[x,y+8]],.85),a.circleV(x,y-11,1.7,.8));}}
 s.push(CV([[0,h-12],[w*.07,h-15],[w*.12,h-10],[w*.19,h-13],[w*.32,h-11],[w*.43,h-8],[w*.52,h-9],[w*.63,h-8],[w*.73,h-11],[w*.81,h-8],[w*.9,h-13],[w,h-10]],1.1,M));return s;}
 // The paused water is a sheltered cove: an island whose eastern side opens into a small bay, hatched on its lee.
 function bayV(lay: ChartLayout){const{x,y,w:bw,h:bh}=lay.spit,cx=x+bw/2,cy=y+bh*.5,rx=bw*.46,ry=bh*.42,pts: Point[]=[];for(let i=0;i<=48;i++){const t=i/48*Math.PI*2,a=Math.atan2(Math.sin(t),Math.cos(t)),notch=.42*Math.exp(-(a*a)/.18),wob=1+Math.sin(t*5+1.3)*.05+Math.sin(t*3)*.04;pts.push([cx+Math.cos(t)*rx*(wob-notch),cy+Math.sin(t)*ry*(wob-notch*.4)]);}
 const s: Parts[]=[FV(pts),CV(pts,1.2,I),CV(pts.slice(8,22).map(([px,py]): Point=>[cx+(px-cx)*.82,cy+(py-cy)*.82]),.55,M)];for(let i=0;i<9;i++){const t=Math.PI*(.15+i*.075),px=cx+Math.cos(t)*rx*.86,py=cy+Math.sin(t)*ry*.86;s.push(LV([[px,py],[px-3,py-6]],.45,M,{opacity:'.7'}));}
 s.push(CV([[cx-rx*.3,cy-ry*.1],[cx-rx*.1,cy-ry*.5],[cx+rx*.15,cy-ry*.25]],.55,M));for(const o of [7,13])s.push(CV([[cx+rx*.35,cy-ry*.6-o*.3],[cx+rx*.62+o*.4,cy],[cx+rx*.35,cy+ry*.6+o*.3]],.5,T));
 for(const o of [8,15])s.push(CV([[cx-rx*.9,cy+ry+o*.5],[cx,cy+ry+o],[cx+rx*.7,cy+ry+o*.5]],.5,T));s.push(m.towerV(cx-rx*.35,cy-ry*.05,.3*lay.k));return s;}
 function sceneV(lay: ChartLayout): Shape{const{h,k}=lay;const s: Parts[]=[shoresV(lay),bayV(lay)];
 for(const c of lay.clouds)s.push(m.cloudV(c.x,c.y+c.h*.6,.8*k));
 if(lay.isle){const{cx,y:iy,h:ih}=lay.isle,by=iy+ih-8,q=k;s.push(FV([[cx-75*q,by],[cx-45*q,by-12*q],[cx-19*q,by-47*q],[cx+1*q,by-56*q],[cx+22*q,by-22*q],[cx+49*q,by-16*q],[cx+77*q,by]]),CV([[cx-75*q,by],[cx-45*q,by-12*q],[cx-19*q,by-47*q],[cx+1*q,by-56*q],[cx+22*q,by-22*q],[cx+49*q,by-16*q],[cx+77*q,by]],1.15),LV([[cx-18*q,by-42*q],[cx-23*q,by-17*q],[cx-39*q,by-6*q]],.65,M),LV([[cx+3*q,by-45*q],[cx+13*q,by-22*q],[cx+34*q,by-10*q]],.6,M),m.towerV(cx-1*q,by-53*q,.3*q),CV([[cx-82*q,by+5],[cx,by+8],[cx+84*q,by+5]],.6,T));}
 for(const r of lay.islets)s.push(isletV(r.cx,r.y+r.h*.8,r.s,r.seed));for(const r of lay.rocks)s.push(m.rockV(r.cx,r.y+r.h*.8,.55*k));
 // Currents run between the lanes; zone limits are dashed and break around anything placed on them.
 const[a0,a1]=lay.zones.active,ys: number[]=[];const L0=lay.lanes.map(l=>l.y);const all=[lay.top-34,...L0,lay.bottom+20];for(let i=1;i<all.length;i++){const g=all[i]-all[i-1];if(g>40)for(const t of g>70?[.36,.64]:[.5])ys.push(all[i-1]+g*t);}
 for(const[i,y]of ys.entries())for(const run of runs([[a0+20+(i%3)*8,y],[a0+(a1-a0)*.3,y-4],[a0+(a1-a0)*.6,y+2],[a1-10,y]],lay,[...SOLID,'lane'],10))s.push(CV(run,.55,T,{opacity:'.6'}));
 for(const z of ['active','paused','completed']){const x=lay.zones[z][0];for(const run of runs([[x-6,30],[x+4,h*.3],[x-3,h*.6],[x+5,h-30]],lay,[...SOLID,'lane','land'],8,4))s.push(a.dashV(run,.8,M));}
 for(const r of lay.weeds)s.push(m.plantV(r.cx,r.y+r.h,r.kk*k));
 s.push(sh('g',{'data-chart-soundings':true},lay.soundings.map(r=>sh('text',{x:r.cx.toFixed(1),y:(r.y+r.h-2).toFixed(1),'font-size':'9',fill:M,opacity:'.7','text-anchor':'middle',style:'font-family:var(--mono)'},r.t))));
 return sh('g',{'data-r22-chart':true},s);}
 // The archive is a rolled chart with its count; the tube is part of the button, not the scenery.
 function tubeEl(){return svg('svg',{viewBox:'0 0 64 26',width:'54',height:'22','aria-hidden':'true'},partNodes(parts(FV([[8,4],[54,4],[54,22],[8,22]]),LV([[8,4],[54,4]],1.1),LV([[8,22],[54,22]],1.1),m.EV(8,13,4,9,1.1),m.EV(54,13,4,9,1.1),m.EV(54,13,2.2,6,.6,M),LV([[18,5],[18,21]],.9),LV([[44,5],[44,21]],.9))));}
 return{...r21,sceneV,tubeEl};
}
