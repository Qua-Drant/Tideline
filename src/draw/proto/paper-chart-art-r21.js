import {chartArt} from './paper-chart-art-r14.js';
import {maritimeArt} from './paper-maritime-r14.js';
// R21: the chart keeps its R14 coasts and adds what the reference comp reads by — hatched islets, soundings,
// dashed zone limits and weed along the lower shore. The selected voyage is the one thing drawn in magenta.
export const NOW='#C8206A';
export function chartArtR21(a){
 const base=chartArt(a),L=a.ink,C=a.curve,I=a.INK,M=a.SECONDARY,T=a.TICK,P=a.PAPER,m=maritimeArt(a);
 const F=p=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z" fill="${P}"/>`;
 // An islet: irregular crown, paper fill, a waterline, hatching on the shaded right flank and two ripples.
 function islet(x,y,k,seed=1){const r=(i)=>((Math.sin(i*12.9898+seed*78.233)*43758.5453)%1+1)%1,n=9,pts=[];for(let i=0;i<=n;i++){const t=i/n,h=Math.sin(t*Math.PI)*(14+r(i)*10)*k;pts.push([x-26*k+52*k*t,y-h]);}
 let s=F([...pts,[x+26*k,y],[x-26*k,y]])+C(pts,1.15,I)+C([[x-30*k,y],[x+30*k,y]],.8,M);for(let i=0;i<6;i++){const t=.55+i*.07,px=x-26*k+52*k*t,top=y-Math.sin(t*Math.PI)*16*k;s+=L([[px,top+2],[px-2*k,y-1]],.4,M,'opacity=".75"');}
 s+=C([[x-14*k,y-Math.sin(.3*Math.PI)*12*k],[x-6*k,y-4*k]],.5,M);for(const dy of [4,8])s+=C([[x-34*k+dy,y+dy],[x,y+dy+1],[x+34*k-dy,y+dy]],.5,T);return `<g data-chart-islet>${s}</g>`;}
 function soundings(w,h){const pts=[[.21,.2,'10'],[.3,.12,'20'],[.44,.09,'20'],[.52,.24,'30'],[.62,.2,'20'],[.24,.44,'30'],[.4,.43,'20'],[.6,.44,'30'],[.67,.66,'30'],[.26,.68,'10'],[.45,.67,'50'],[.58,.86,'30'],[.33,.9,'50'],[.76,.2,'20'],[.79,.5,'20'],[.86,.28,'20'],[.86,.6,'30'],[.13,.62,'10'],[.11,.2,'10'],[.93,.47,'30']];
 return '<g data-chart-soundings>'+pts.map(([x,y,t])=>`<text x="${(x*w).toFixed(1)}" y="${(y*h).toFixed(1)}" font-size="9" fill="${M}" opacity=".7" text-anchor="middle" style="font-family:var(--mono)">${t}</text>`).join('')+'</g>';}
 function limits(w,h){const X=x=>x*w,Y=y=>y*h;let s='<g data-chart-limits>';
 s+=a.dash([[X(.03),Y(.12)],[X(.13),Y(.1)],[X(.2),Y(.14)],[X(.215),Y(.3)],[X(.205),Y(.55)],[X(.215),Y(.72)],[X(.19),Y(.86)]],.8,M);
 s+=a.dash([[X(.72),Y(.1)],[X(.705),Y(.3)],[X(.712),Y(.55)],[X(.7),Y(.8)],[X(.74),Y(.92)]],.8,M)+a.dash([[X(.875),Y(.1)],[X(.868),Y(.4)],[X(.876),Y(.7)],[X(.86),Y(.9)]],.8,M);return s+'</g>';}
 function weed(w,h){let s='<g data-chart-weed>';for(const[x,k]of [[.16,.6],[.2,.45],[.31,.5],[.5,.45],[.63,.55],[.68,.4],[.78,.6],[.82,.45]])s+=m.plant(x*w,h*.965,k);return s+'</g>';}
 function scene(w,h){const k=Math.min(1,w/1250);let s=base.scene(w,h)+limits(w,h)+soundings(w,h);
 for(const[x,y,kk,seed]of [[.3,.15,.9,1],[.5,.17,.75,2],[.235,.92,.8,3],[.42,.93,.65,4],[.6,.92,.8,5],[.685,.27,.7,6],[.69,.74,.75,7],[.225,.5,.55,8]])s+=islet(x*w,y*h,kk*k,seed);
 return s+weed(w,h);}
 // Sailboat; the selected voyage carries magenta sails.
 function ship(size=43,now=false){const c=now?NOW:I,hull=[[2,35],[10,41],[36,41],[44,35],[2,35]],s1=[[21,6],[7,31],[21,31],[21,6]],s2=[[27,12],[38,31],[27,31],[27,12]];
 let s=(now?`<path d="M${s1.join('L')}Z" fill="${NOW}" opacity=".85"/><path d="M${s2.join('L')}Z" fill="${NOW}" opacity=".6"/><path d="M${hull.join('L')}Z" fill="${NOW}" opacity=".9"/>`:'')+L(hull,1.4,c)+L([[24,3],[24,34]],1.2,c)+L(s1,1.1,c)+L(s2,1.1,c)+L([[5,45],[24,44],[42,45]],.7,M);
 if(now)s+=L([[24,3],[31,5],[24,8]],1,NOW);return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${s}</svg>`;}
 function dot(state,now){const c=now?NOW:I;return `<svg viewBox="0 0 14 14" aria-hidden="true">${state==='done'?`<circle cx="7" cy="7" r="4.2" fill="${c}"/>`:state==='in_progress'?a.circle(7,7,4.6,1.5,c)+`<circle cx="7" cy="7" r="1.8" fill="${c}"/>`:a.circle(7,7,4,1.1,now?NOW:M)}</svg>`;}
 function flag(now){const c=now?NOW:I;return `<svg viewBox="0 0 16 22" aria-hidden="true">${L([[3,21],[3,2]],1.3,I)}<path d="M3.5 2.5L14 6L3.5 9.5Z" fill="${c}" opacity="${now?.9:.15}"/>${L([[3.5,2.5],[14,6],[3.5,9.5]],1,c)}</svg>`;}
 // The compass rose shrinks with the chart so it stays clear of the far-shore voyages.
 function hud(w,h){const k=Math.min(1,h/520);return base.hud(w,h).replace(/<svg x="[^"]+" y="[^"]+" width="112" height="112"/,'<svg x="'+(w-112*k-8)+'" y="'+(h-112*k-14)+'" width="'+112*k+'" height="'+112*k+'"');}
 return{...base,scene,ship,dot,flag,hud};
}
