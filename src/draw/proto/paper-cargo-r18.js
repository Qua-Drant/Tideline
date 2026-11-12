import {HOST} from '../../host.js';
import {strokes} from './paper-strokes-r18.js';
import {penLayer} from './paper-guidance-art-r18.js';
// R18: the hold is redrawn in code. The ceiling band keeps the reference proportions (1491 × 188) and goes through
// the page pen; the ladder, hanging rope and inbox pile share its vocabulary (timber edges, pale grain, nail heads)
// so hatch → ladder → pile read as one scene. Sacks and the lantern stay buttons; the lamp switch is unchanged.
export const HOLD_W=1491,HOLD_H=188,HATCH_Y=170;
// The ladder (an HTML button at x 21–83) starts just below the coaming board; the hatch is drawn in page pixels
// around it so the stiles disappear into the opening behind that board.
const ladderTop=s=>HATCH_Y*s+8;
const LANTERN={x:775,y:46,w:54,h:72,cx:802,cy:77};
export function cargoR18(a,r16,r17){
 const {d,curve:C,ink:L,INK:I,SECONDARY:M,TICK:T,PAPER:P}=a;
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z" fill="${c}"/>`;
 const unit=w=>w/HOLD_W,fmt=v=>(+v.toFixed(2)).toString();
 let holdInk='',sackInk='',lanternInk='';
 function lantern(){const{x,y,w,h}=LANTERN;lanternInk||=penLayer(C,strokes.lantern,{dark:.9,light:.8});return `<g data-cargo-flame><rect x="${x+15}" y="${y+6}" width="${w-30}" height="${h-20}" rx="4" fill="#F3D493" opacity=".8"/><path d="M${x+27} ${y+48}c-3-4-3-9 0-15c3 6 3 11 0 15z" fill="#D9A04E" opacity=".9"/></g><g transform="translate(${x} ${y})">${lanternInk}</g>`;}
 // A rope dropped from the hatch post down the ladder side to the pile, in plane units of the whole hold.
 function rope(w,h){const s=unit(w),x0=7,y0=HATCH_Y*s-30,y1=h-118,pts=[];for(let i=0;i<=12;i++){const t=i/12;pts.push([x0+Math.sin(t*Math.PI)*5-t*2,y0+(y1-y0)*t]);}return `<g data-cargo-ladder-rope>${r16.twisted(pts,1.2,6)}${C([[x0-3,y1],[x0-7,y1+8],[x0-1,y1+14],[x0+5,y1+8],[x0+1,y1+2]],.9,I)}</g>`;}
 function hatch(w){const s=unit(w),D=HATCH_Y*s,k=x=>x,board=(x0,y0,x1,y1)=>F([[x0,y0],[x1,y0],[x1,y1],[x0,y1]])+L([[x0,y0],[x1,y0]],1.3,I)+L([[x0,y1],[x1,y1]],1.3,I)+L([[x0,y0],[x0,y1]],1.1,I)+L([[x1,y0],[x1,y1]],1.1,I);let o='<g data-cargo-hatch>';
 // Coaming top face around the opening, then the dark well with the ladder heads inside it.
 const outer=[[6,D-2],[98,D-2],[112,D-20],[22,D-20]],hole=[[16,D-4],[90,D-4],[100,D-16],[27,D-16]];o+=F(outer)+L([...outer,outer[0]],1.4,I)+F(hole,'#DADFDB')+L([...hole,hole[0]],1,I);for(let i=0;i<14;i++){const t=i/14;o+=L([[18+t*70,D-5],[28+t*70,D-15]],.4,M,'opacity=\".8\"');}
 for(const x of [24,68]){const p=[[x,D-14],[x+11,D-14],[x+11,D+9],[x,D+9]];o+=F(p)+L([[x,D-14],[x,D+9]],1.4,I)+L([[x+11,D-14],[x+11,D+9]],1.3,I);}o+=F([[35,D-9],[68,D-9],[68,D-4],[35,D-4]])+L([[35,D-9],[68,D-9]],1,I)+L([[35,D-4],[68,D-4]],.9,I);
 o+=board(4,D-2,100,D+9)+C([[10,D+3.5],[40,D+3],[70,D+4],[94,D+3.4]],.45,M)+a.circle(10,D+3.5,1,.8)+a.circle(94,D+3.5,1,.8);
 // The lid, slid aside onto the deck: planks parallel to its front edge with broken grain, two thin cleats.
 const lid=[[104,D+2],[198,D+2],[214,D-16],[120,D-16]];o+=F(lid)+L([...lid,lid[0]],1.4,I)+F([[104,D+2],[198,D+2],[198,D+7],[104,D+7]])+L([[104,D+7],[198,D+7]],1.2,I)+L([[198,D+2],[198,D+7],[214,D-11],[214,D-16]],1,I);
 for(let i=1;i<4;i++){const t=i/4;o+=L([[104+t*16,D+2-t*18],[198+t*16,D+2-t*18]],.75,I);}
 for(let r=0;r<4;r++){const t=(r+.5)/4,y=D+2-t*18;for(let x=110+t*16;x<186+t*16;x+=24+(r*11)%9)o+=C([[x,y],[x+9,y-.3],[x+15,y+.2]],.42,M,'opacity=".8"');}
 for(const t of [.2,.8]){const x=104+t*94;o+=L([[x,D+2],[x+16,D-16]],.7,M)+a.circle(x+3,D-1,.8,.6)+a.circle(x+13,D-13,.8,.6);}
 // A bollard post at the hatch corner, which also anchors the hanging rope.
 o+=F([[2,D-44],[12,D-44],[12,D-2],[2,D-2]])+L([[2,D-44],[2,D-2]],1.3,I)+L([[12,D-44],[12,D-2]],1.3,I)+C([[0,D-44],[2,D-50],[7,D-52],[12,D-50],[14,D-44],[0,D-44]],1.2,I)+L([[1,D-36],[13,D-36]],1,I);for(let y=D-42;y<D-4;y+=4)o+=L([[9,y],[11,y+2]],.35,M,'opacity=\".6\"');
 return o+'</g>';}
 function scene(w,h){const s=unit(w),c={x:fmt(LANTERN.cx*s),y:fmt(LANTERN.cy*s)};holdInk||=penLayer(C,strokes.hold);
 return `<g data-morph="deck" data-pen-scene="hold" transform="scale(${fmt(s)})"><defs><clipPath id="r18-hold-corner"><rect width="212" height="78"/></clipPath></defs><g id="r18-hold-ink">${holdInk}</g><g clip-path="url(#r18-hold-corner)"><use href="#r18-hold-ink" transform="translate(-300 0)"/></g><g data-cargo-lantern data-center-x="${c.x}" data-center-y="${c.y}">${lantern()}</g></g>`+hatch(w)+rope(w,h)+r16.floor(w,h);}
 function envelope(){sackInk||=penLayer(C,strokes.sack,{dark:.85,light:.8});return sackInk;}
 // Ladder in the same timber language: two stiles with edge, grain and shade, boarded rungs with nail heads.
 function ladder(){const root=HOST.querySelector('#tasks'),s=unit(root?.clientWidth||1248),height=Math.max(200,(root?.clientHeight||752)-ladderTop(s)-24);let o='';
 // Stiles: paper body, two inked edges, broken grain, and a shaded right third.
 for(const x of [4,46]){const p=[[x,0],[x+12,0],[x+12,height],[x,height]];o+=F(p)+L([[x,0],[x+.6,height]],1.5,I)+L([[x+12,0],[x+12.4,height]],1.45,I);for(let y=3;y<height-12;y+=21+((x*7+y)%13)){const len=12+((y*13)%19),gx=x+3+((y*5)%4);o+=C([[gx,y],[gx+.5,y+len*.5],[gx+.3,y+len]],.45,M,'opacity=".8"');}for(let y=2;y<height;y+=3.6)o+=L([[x+8.4,y],[x+11.2,y+1.2]],.38,M,'opacity=".6"');}
 // Rungs: thick boards overhanging both stiles, a shadow line beneath, nail heads where they cross.
 const gap=46,count=Math.floor((height-24)/gap);for(let i=0;i<=count;i++){const y=20+i*gap,p=[[1,y],[61,y],[61,y+7],[1,y+7]];o+=F(p)+C([[1,y+3.5],[0,y+.4],[3,y],[59,y],[62,y+.4],[61,y+3.5],[62,y+6.6],[59,y+7],[3,y+7],[0,y+6.6],[1,y+3.5]],1.2,I)+C([[8,y+3.4],[24,y+3],[40,y+3.8],[54,y+3.3]],.42,M,'opacity=".8"')+L([[16,y+9],[46,y+9.3]],.4,M,'opacity=".55"');for(const x of [10,52])o+=a.circle(x,y+3.5,.95,.8);}
 return `<svg viewBox="0 0 62 ${fmt(height)}" width="62" height="${fmt(height)}" preserveAspectRatio="none" aria-hidden="true" data-ladder-r18>${o}</svg>`;}
 // Inbox pile in the 175 × 142 box: front crates hide the ladder foot (x≈21–83 of the page), the tag hangs on the right crate.
 function loose(n){const k=r16.plankCrate;let s='<g data-cargo-stacked-crates>';s+=k(84,90,64,46,14)+k(2,82,66,54,15)+k(8,44,50,38,14)+`<g transform="rotate(-5 40 50)">${k(14,14,38,30,11)}</g>`+k(60,110,34,26,9);
 const tag=[[96,100],[156,97],[158,134],[98,137]];s+=r16.twisted([[118,90],[112,96],[104,101]],.7,4)+F(tag)+L([...tag,tag[0]],1.1,I)+a.circle(102,105,1.3,.7);s+=`<text x="128" y="116" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--sans)">收件箱</text><text x="128" y="131" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--mono)">${n}</text></g>`;return s;}
 function place(root){r17.place(root);const s=unit(root.clientWidth),lad=root.querySelector('.cargo-ladder');if(lad){const height=Math.max(200,root.clientHeight-ladderTop(s)-24);Object.assign(lad.style,{top:fmt(ladderTop(s))+'px',height:fmt(height)+'px'});}}
 return{scene,envelope,ladder,loose,place};
}
