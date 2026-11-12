import {HOST} from '../../host.js';
// R19: the hold ceiling is drawn by hand in code (as R16 was) on the reference layout measured in R17 — a
// 1491 × 188 band scaled with the page width. Long clean strokes in three weights; no traced or vectorised data.
// The narrow ladder of R14–R17 returns. It passes behind the deck-edge plank into the hatch coaming, so the
// stiles in the opening and the ladder button below are the same two stiles.
export const HOLD_W=1491,DECK_Y=175;
const LANTERN={cx:802,cy:91},TIES=[890,1071,1168,1274,1380],SACK={w:76,h:100,top:58};
// Narrow ladder geometry in its own 62-px box (page x 21–83): stiles widen slightly towards the floor.
const STILES=[[7,13],[43,49]],RUNG=39;
export function cargoR19(a,r16,r17){
 const {d,curve:C,ink:L,circle,INK:I,SECONDARY:M,TICK:T,PAPER:P}=a;
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z" fill="${c}"/>`;
 const O=(p,n=1.3,c=I,at='')=>L([...p,p[0]],n,c,at);
 const unit=w=>w/HOLD_W,fmt=v=>(+v.toFixed(2)).toString();
 const E=(x,y,rx,ry,n=1,c=I,a0=0,a1=Math.PI*2)=>{const k=Math.max(8,Math.ceil(Math.abs(a1-a0)*10));return C(Array.from({length:k+1},(_,i)=>{const t=a0+(a1-a0)*i/k;return[x+Math.cos(t)*rx,y+Math.sin(t)*ry];}),n,c);};
 let seed=7;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 // Long broken grain along a board, pale; at most three rows.
 function grain(x0,x1,y,rows,h){let s='';for(let r=0;r<rows;r++){const yy=y+h*(r+1)/(rows+1);let x=x0+8+rnd()*30;while(x<x1-20){const len=Math.min(x1-6-x,60+rnd()*140);s+=C([[x,yy],[x+len*.5,yy-.5+rnd()],[x+len,yy]],.5,T);x+=len+18+rnd()*40;}}return s;}
 const rope=(p,n=1.5)=>C(p,n,I)+C(p.map(([x,y])=>[x+.6,y+1.3]),.5,M,'opacity=".8"');
 const sag=(x0,y0,x1,y1,drop,k=9)=>Array.from({length:k},(_,i)=>{const t=i/(k-1);return[x0+(x1-x0)*t,y0+(y1-y0)*t+Math.sin(t*Math.PI)*drop];});
 function beam(){let s=F([[0,0],[HOLD_W,0],[HOLD_W,44],[0,44]])+L([[0,1],[HOLD_W,1]],1.4)+L([[0,7],[HOLD_W,7]],.8,M)+L([[0,44],[HOLD_W,44]],1.7)+grain(0,HOLD_W,7,3,37);for(const x of [120,430,700,960,1220])s+=circle(x,26,1.6,.9)+circle(x,26,.5,.5);
 for(const x of [60,380,640,900,1180,1420])s+=L([[x,8],[x,43]],.6,M);s+=hatchLine(0,HOLD_W,45,4);return s;}
 function hatchLine(x0,x1,y,h){let s='';for(let x=x0+3;x<x1;x+=7)s+=L([[x,y],[x-2,y+h]],.4,T);return s;}
 // Joists running towards the viewer: underside, side face with sparse hatching, square cut end.
 function joist(x){const face=[[x,0],[x+44,0],[x+4,66],[x-40,66]],side=[[x+44,0],[x+56,0],[x+16,66],[x+4,66]],end=[[x-40,66],[x+4,66],[x+4,80],[x-40,80]],endSide=[[x+4,66],[x+16,66],[x+16,76],[x+4,80]];
 let s=F(face)+F(side,'#ECEEEA')+F(end)+F(endSide,'#E4E7E3')+O(face,1.5)+O(side,1.2)+O(end,1.4)+O(endSide,1.1);for(const k of [.32,.62])s+=C([[x+44*k,2],[x+44*k-20,33],[x+44*k-40,64]],.5,T);for(let t=.1;t<.95;t+=.13)s+=L([[x+44+12*t-40*t*0+(-40*t),66*t],[x+56-40*t,66*t-2]],.4,M,'opacity=".7"');s+=C([[x-34,72],[x-18,71.5],[x-2,72.5]],.45,T)+circle(x+20,12,1.4,.8);return s;}
 function lantern(){const x=LANTERN.cx,y=LANTERN.cy;let s=L([[x,y-44],[x,y-36]],1.1)+E(x,y-34,3,2.4,1);
 s+=`<g data-cargo-flame><rect x="${x-9}" y="${y-18}" width="18" height="34" rx="3" fill="#F3D493" opacity=".85"/><path d="M${x} ${y+8}c-3-4-3-9 0-15c3 6 3 11 0 15z" fill="#D9A04E" opacity=".9"/></g>`;
 s+=C([[x-11,y-20],[x-9,y-28],[x,y-32],[x+9,y-28],[x+11,y-20]],1.3)+L([[x-13,y-20],[x+13,y-20]],1.4)+L([[x-12,y+17],[x+12,y+17]],1.4)+C([[x-9,y+17],[x-7,y+23],[x+7,y+23],[x+9,y+17]],1.2)+L([[x,y+23],[x,y+27]],1);
 for(const k of [-1,1])s+=L([[x+k*11,y-20],[x+k*11,y+17]],1.4)+L([[x+k*5,y-19],[x+k*5,y+16]],.6,M);return `<g data-cargo-lantern data-center-x="__CX__" data-center-y="__CY__"><g transform="translate(${x} ${y}) scale(1.35) translate(${-x} ${-y})">${s}</g></g>`;}
 // Rope run on the right: tied round the beam at each station, sagging between, belayed on the wall post.
 function rigging(){let s='<g data-cargo-rigging>';for(let i=1;i<TIES.length;i++)s+=rope(sag(TIES[i-1],40,TIES[i],40,13));s+=rope(sag(TIES.at(-1),40,1452,34,10));
 for(const x of TIES){s+=F([[x-6,4],[x+6,4],[x+6,44],[x-6,44]])+L([[x-6,4],[x-6,44]],1)+L([[x+6,4],[x+6,44]],1);for(let y=8;y<43;y+=6)s+=L([[x-6,y],[x+6,y+3]],.7,M);s+=circle(x,48,4.2,1.2)+L([[x-2,52],[x-3,58]],1)+L([[x+2,52],[x+3,58]],1);}
 s+=circle(1030,49,6,1.2)+circle(1030,49,3,.7)+L([[1030,43],[1030,44]],1);
 const px=1452;s+=F([[px,0],[HOLD_W,0],[HOLD_W,188],[px,188]])+L([[px,0],[px,188]],1.6)+grain(px,HOLD_W,0,0,0);for(let x=px+12;x<HOLD_W;x+=12)s+=C([[x,4],[x+.6,90],[x,184]],.5,T);for(const y of [52,128])s+=F([[px-3,y-4],[HOLD_W,y-4],[HOLD_W,y+4],[px-3,y+4]])+L([[px-3,y-4],[HOLD_W,y-4]],1.1)+L([[px-3,y+4],[HOLD_W,y+4]],1.1);
 for(let i=0;i<4;i++)s+=E(1434,96+i,10+i*1.5,22-i,i?.6:1.2,i?M:I);s+=rope([[1440,74],[1446,60],[1452,48]],1.3)+C([[1428,118],[1426,132],[1430,142]],1.1);
 return s+'</g>';}
 // Gallery rail: one tall post at the hatch, small posts after it, rope sagging between; then the deck-edge plank.
 function rail(){let s='<g data-cargo-rail>';const posts=[];for(let x=380;x<1440;x+=132)posts.push(x);s+=rope(sag(244,124,posts[0],152,8),1.3);for(let i=1;i<posts.length;i++)s+=rope(sag(posts[i-1],152,posts[i],152,5),1.2);
 s+=F([[238,126],[250,126],[251,175],[237,175]])+L([[238,126],[237,175]],1.4)+L([[250,126],[251,175]],1.4)+circle(244,120,6.5,1.4)+L([[236,132],[252,132]],1.1)+C([[247,136],[248,155],[247,172]],.5,M);
 for(const x of posts)s+=F([[x-3,150],[x+3,150],[x+3.5,175],[x-3.5,175]])+L([[x-3,150],[x-3.5,175]],1.1)+L([[x+3,150],[x+3.5,175]],1.1)+circle(x,148,3.4,1.1);
 return s+'</g>';}
 function deck(w){const s=unit(w);let o='<g data-cargo-deck>'+F([[0,DECK_Y],[HOLD_W,DECK_Y],[HOLD_W,188],[0,188]])+L([[0,DECK_Y],[HOLD_W,DECK_Y]],1.6)+L([[0,188],[HOLD_W,188]],1.5)+grain(0,HOLD_W,DECK_Y,1,13);for(let x=96;x<HOLD_W;x+=210)o+=L([[x,DECK_Y+1],[x,187]],.6,M)+circle(x+6,DECK_Y+6.5,.9,.6);return o+'</g>';}
 // Hatch in page pixels around the ladder: a dark opening on the deck, the two stile heads inside it, the
 // coaming lip in front; the open lid lies flat beside it. The deck-edge plank (drawn after) hides the stile feet.
 function hatch(w){const s=unit(w),D=DECK_Y*s,x0=21;let o='<g data-cargo-hatch>';const hole=[[x0+2,D],[x0+60,D],[x0+70,D-16],[x0+12,D-16]];o+=F(hole,'#D5DAD6')+O(hole,1.3);for(let i=1;i<10;i++){const t=i/10;o+=L([[x0+2+58*t,D-1],[x0+12+58*t,D-15]],.45,M,'opacity=".75"');}
 for(const[a,b]of STILES){o+=F([[x0+a,D-12],[x0+b,D-12],[x0+b,D+2],[x0+a,D+2]])+L([[x0+a,D-12],[x0+a,D+2]],1.2)+L([[x0+b,D-12],[x0+b,D+2]],1.2)+C([[x0+a,D-12],[x0+(a+b)/2,D-14],[x0+b,D-12]],1.1);}
 o+=F([[x0+13,D-8],[x0+43,D-8],[x0+43,D-4],[x0+13,D-4]])+L([[x0+13,D-8],[x0+43,D-8]],.9)+L([[x0+13,D-4],[x0+43,D-4]],.7,M);
 const lip=[[x0-4,D],[x0+66,D],[x0+78,D-18],[x0+76,D-20],[x0+8,D-20],[x0-6,D-2]];o+=O([[x0-4,D],[x0+8,D-20],[x0+76,D-20],[x0+66,D]],1.2,I);
 const lid=[[x0+86,D],[x0+170,D],[x0+182,D-14],[x0+98,D-14]];o+=F(lid)+O(lid,1.3)+L([[x0+86,D],[x0+86,D+4],[x0+170,D+4],[x0+170,D]],1.1);for(const t of [.33,.66])o+=L([[x0+86+84*t,D],[x0+98+84*t,D-14]],.7,M);o+=C([[x0+100,D-7],[x0+130,D-7.4],[x0+168,D-7]],.45,T);
 return o+'</g>';}
 function scene(w,h){seed=7;const s=unit(w),c={x:fmt(LANTERN.cx*s),y:fmt(LANTERN.cy*s)};
 const band=`<g data-morph="deck" data-hold-r19 transform="scale(${fmt(s)})">${beam()}${joist(196)}${joist(300)}${joist(546)}${rigging()}${rail()}${lantern().replace('__CX__',c.x).replace('__CY__',c.y)}</g>`;
 return band+hatch(w)+`<g transform="scale(${fmt(s)})">${deck(w)}</g>`+floorDecor(w,h)+r16.floor(w,h);}
 // Floor props from the reference: a coiled rope by the inbox pile and a small cask by the archive.
 function floorDecor(w,h){const y=h-20;let s='<g data-cargo-floor-props>';for(let i=0;i<4;i++)s+=E(232,y-5-i*2.2,24-i*4,6-i*.9,i?.7:1.2,i?M:I);s+=C([[252,y-6],[262,y-4],[270,y-1]],1)+C([[214,y-8],[204,y-3],[198,y]],.9);
 const bx=w-172;s+=F([[bx,y-38],[bx+28,y-38],[bx+31,y-19],[bx+28,y],[bx,y],[bx-3,y-19]])+C([[bx,y-38],[bx-3,y-19],[bx,y]],1.4)+C([[bx+28,y-38],[bx+31,y-19],[bx+28,y]],1.4)+E(bx+14,y-38,14,3.5,1.2)+C([[bx,y],[bx+14,y+2],[bx+28,y]],1.2);for(const yy of [y-30,y-8])s+=C([[bx-2,yy],[bx+14,yy+2.4],[bx+30,yy]],1.3);s+=C([[bx+8,y-34],[bx+7,y-19],[bx+8,y-3]],.5,T)+C([[bx+20,y-34],[bx+21,y-19],[bx+20,y-3]],.5,T);
 return s+'</g>';}
 // Clean drawstring sack, 76 × 100; the HTML initial sits on the tag (50%, 56%).
 function envelope(){let s=C([[38,0],[38,6]],1)+E(38,9,4,3,1.1);const ruff=[[30,21],[27,17],[28,14],[32,13],[35,15],[38,12.5],[41,15],[44,13],[48,14],[49,17],[46,21]];s+=F(ruff)+C([...ruff,ruff[0]],1.05);for(const x of [33,38,43])s+=C([[x,15],[x+.4,18],[x,20.5]],.45,M);
 const body=[[30,22],[19,34],[10,54],[7,74],[12,90],[26,97],[50,97],[64,90],[69,74],[66,54],[57,34],[46,22]];s+=F(body)+C([...body,body[0]],1.5)+C([[28,21],[38,25],[48,21]],1.6)+C([[29,24],[38,27.5],[47,24]],1);
 for(const p of [[[33,28],[24,48],[21,72]],[[44,28],[53,48],[56,70]],[[16,74],[20,86],[30,93]]])s+=C(p,.55,M);for(let i=0;i<7;i++){const x=58+i*1.5;s+=C([[x,40+i*3.4],[x+.8,62+i],[x,84-i*1.5]],.4,M,'opacity=".7"');}
 const tag=[[26,44],[50,43],[51,69],[27,70]];s+=L([[38,27],[38,44]],.7)+F(tag)+O(tag,1)+circle(38,47,1,.6);return s;}
 // Narrow ladder (R14–R17 style): two slim stiles, boarded rungs; drawn from just under the deck plank.
 function ladder(){const root=HOST.querySelector('#tasks'),s=unit(root?.clientWidth||1248),height=Math.max(200,(root?.clientHeight||752)-ladderTop(s)-24);let o='';
 for(const[a,b]of STILES){const p=[[a,0],[b,0],[b+1.5,height],[a-1.5,height]];o+=F(p)+L([[a,0],[a-1.5,height]],1.3)+L([[b,0],[b+1.5,height]],1.3)+C([[(a+b)/2,6],[(a+b)/2+.4,height/2],[(a+b)/2,height-6]],.45,M);}
 const count=Math.floor((height-12)/RUNG);for(let i=0;i<=count;i++){const y=10+i*RUNG,p=[[13,y],[43,y],[43,y+6],[13,y+6]];o+=F(p)+O(p,1)+circle(16,y+3,.7,.6)+circle(40,y+3,.7,.6);}
 return `<svg viewBox="0 0 62 ${fmt(height)}" width="62" height="${fmt(height)}" preserveAspectRatio="none" aria-hidden="true" data-ladder-r19>${o}</svg>`;}
 const ladderTop=s=>188*s;
 function place(root){r17.place(root);const s=unit(root.clientWidth);root.querySelectorAll('.cargo-mailbag').forEach((b,i)=>Object.assign(b.style,{left:fmt((TIES[i+1]??TIES.at(-1))*s-SACK.w*s/2)+'px',top:fmt(SACK.top*s)+'px',width:fmt(SACK.w*s)+'px',height:fmt(SACK.h*s)+'px'}));const t=root.querySelector('.cargo-lamp-toggle');if(t)Object.assign(t.style,{left:fmt((LANTERN.cx-20)*s)+'px',top:fmt((LANTERN.cy-40)*s)+'px',width:fmt(40*s)+'px',height:fmt(72*s)+'px'});
 const lad=root.querySelector('.cargo-ladder');if(lad)Object.assign(lad.style,{top:fmt(ladderTop(s))+'px',height:fmt(Math.max(200,root.clientHeight-ladderTop(s)-24))+'px'});}
 function light(w,h){const c={x:LANTERN.cx*unit(w),y:LANTERN.cy*unit(w)};return r17.light(w,h).replace(/cx="[^"]+" cy="[^"]+"/,`cx="${fmt(c.x)}" cy="${fmt(c.y)}"`).replace(/data-center-x="[^"]+" data-center-y="[^"]+"/,`data-center-x="${fmt(c.x)}" data-center-y="${fmt(c.y)}"`).replace(/ r="[^"]+">/,` r="${fmt(Math.hypot(Math.max(c.x,w-c.x),Math.max(c.y,h-c.y)))}">`);}
 return{scene,envelope,ladder,place,light};
}
