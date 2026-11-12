// R23: the chart compass is drawn in the chart's own ink instead of the R10 vector rose. Two wobbly rings with
// ticks, four long points and four short ones, each split along its spine with one half hatched, and a serif N.
// Everything else is R22's chart art, unchanged.
import {chartArtR22} from './paper-chart-art-r22.js';
export function chartArtR23(a){
 const r22=chartArtR22(a),L=a.ink,C=a.curve,I=a.INK,M=a.SECONDARY,T=a.TICK,P=a.PAPER,q=v=>+v.toFixed(1);
 const F=p=>`<path d="M${p.map(v=>v.map(q).join(',')).join('L')}Z" fill="${P}"/>`;
 const ring=(cx,cy,r,n,c,seed)=>C(Array.from({length:37},(_,i)=>{const t=i/36*Math.PI*2+seed,w=1+Math.sin(t*3+seed)*.012+Math.sin(t*7)*.006;return[cx+Math.cos(t)*r*w,cy+Math.sin(t)*r*w];}),n,c);
 // One point: spine from the centre to the tip; the left half is paper, the right half hatched parallel to its edge.
 function point(cx,cy,ang,len,half,lines,n){const at=(r,t)=>[cx+Math.cos(t)*r,cy+Math.sin(t)*r],A=at(len,ang),Bl=at(half,ang-Math.PI/4),Br=at(half,ang+Math.PI/4),O=[cx,cy];
 let s=F([O,Bl,A,Br]),hd='';for(let j=1;j<=lines;j++){const u=j/(lines+1),p0=[O[0]+(A[0]-O[0])*u,O[1]+(A[1]-O[1])*u],p1=[A[0]*u+Br[0]*(1-u),A[1]*u+Br[1]*(1-u)];hd+=`M${p0.map(q)}L${p1.map(q)}`;}
 s+=`<path d="${hd}" fill="none" stroke="${M}" stroke-width=".5" stroke-linecap="round"/>`;
 return s+C([O,Bl,A],n)+C([A,Br,O],n)+L([O,A],n*.7);}
 function rose(x,y,w,h){const cx=x+w/2,cy=y+h/2+2,R=Math.min(w,h)/2-4;let s=`<circle cx="${q(cx)}" cy="${q(cy)}" r="${q(R*.66)}" fill="${P}"/>`;
 s+=ring(cx,cy,R*.64,.85,I,.4)+ring(cx,cy,R*.56,.5,M,1.9)+ring(cx,cy,R*.7,.45,T,2.6);
 // Ticks are plain hairlines (an inked stroke this short would read as an arrowhead).
 let ticks='';for(let i=0;i<32;i++){const t=i/32*Math.PI*2,k=i%4===0?.075:.035,r0=R*.635,r1=r0-R*k;ticks+=`M${q(cx+Math.cos(t)*r0)},${q(cy+Math.sin(t)*r0)}L${q(cx+Math.cos(t)*r1)},${q(cy+Math.sin(t)*r1)}`;}
 s+=`<path d="${ticks}" fill="none" stroke="${M}" stroke-width=".6" stroke-linecap="round"/>`;
 for(let i=0;i<4;i++)s+=point(cx,cy,-Math.PI/4+i*Math.PI/2,R*.5,R*.12,4,.5);
 for(let i=0;i<4;i++)s+=point(cx,cy,-Math.PI/2+i*Math.PI/2,i===0?R*.86:R*.8,R*.16,7,.8);
 s+=`<circle cx="${q(cx)}" cy="${q(cy)}" r="${q(R*.06)}" fill="${P}"/>`+a.circle(cx,cy,R*.06,.7);
 s+=`<text x="${q(cx)}" y="${q(cy-R*.9)}" font-size="${q(Math.max(10,R*.26))}" text-anchor="middle" fill="${I}" style="font-family:var(--serif)">N</text>`;
 return s;}
 // R24: soundings count as solid for the drawn lines, so currents and dashed zone limits break around the figures.
 function scene(lay){return r22.scene({...lay,R:lay.R.map(q=>q.tag==='sounding'?{...q,tag:'rock'}:q)});}
 function hud(lay){const c=lay.compass;return c?`<g data-chart-hud data-chart-compass>${rose(c.x,c.y,c.w,c.h)}</g>`:'';}
 return{...r22,scene,hud};}
