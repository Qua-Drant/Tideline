import {HOST} from '../../host.js';
import {trace,TRACE_SCALE} from './paper-trace-r17.js';
// R17: the hold ceiling, hatch, rail and rope run are the user's reference traced into two ink tones (design §10.2).
// The band keeps the reference proportions (1491 × 188) and scales with the page width; sacks and the lantern
// are separate traced sprites so they stay buttons. The lantern switches a warm wash over the whole hold.
export const HOLD_W=1491,HOLD_H=188;
const LANTERN={x:775,y:46,w:54,h:72,cx:802,cy:77},SACKS=[1071,1168,1274],SACK={w:76,h:100,top:56,tagX:46.5/76,tagY:53/100};
export function cargoR17(a,prev){
 const {d}=a,INK='#1C2A35',MID='#687B83';
 const layer=l=>`<g transform="scale(${1/TRACE_SCALE})"><path d="${l.light}" fill="${MID}" fill-rule="evenodd" opacity=".5"/><path d="${l.dark}" fill="${INK}" fill-rule="evenodd"/></g>`;
 const unit=w=>w/HOLD_W,fmt=v=>(+v.toFixed(2)).toString();
 const lampCenter=w=>({x:fmt(LANTERN.cx*unit(w)),y:fmt(LANTERN.cy*unit(w))});
 const lit=()=>d.ui.cargoLamp!==false;
 function lantern(){const{x,y,w,h}=LANTERN;return `<g data-cargo-flame><rect x="${x+15}" y="${y+6}" width="${w-30}" height="${h-20}" rx="4" fill="#F3D493" opacity=".8"/><path d="M${x+27} ${y+48}c-3-4-3-9 0-15c3 6 3 11 0 15z" fill="#D9A04E" opacity=".9"/></g><g transform="translate(${x} ${y})">${layer(trace.lantern)}</g>`;}
 // The reference ceiling starts at x≈210 (its page title sat in front); the next beam section is reused to close the corner.
 function scene(w,h){const s=unit(w),c=lampCenter(w);return `<g data-morph="deck" data-traced-scene="hold" transform="scale(${fmt(s)})"><defs><clipPath id="r17-hold-corner"><rect width="212" height="78"/></clipPath></defs><g id="r17-hold-ink">${layer(trace.hold)}</g><g clip-path="url(#r17-hold-corner)"><use href="#r17-hold-ink" transform="translate(-300 0)"/></g><g data-cargo-lantern data-center-x="${c.x}" data-center-y="${c.y}">${lantern()}</g></g>`+prev.floor(w,h);}
 // A broad radial wash reaching every corner of the hold; panes stay transparent so it reads behind them.
 function light(w,h){const c=lampCenter(w),r=Math.hypot(Math.max(+c.x,w-c.x),Math.max(+c.y,h-c.y));return `<svg class="cargo-warm-light" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><radialGradient id="r17-lamp-wash" gradientUnits="userSpaceOnUse" cx="${c.x}" cy="${c.y}" r="${fmt(r)}"><stop offset="0" stop-color="#F7D58C" stop-opacity=".46"/><stop offset=".08" stop-color="#F6D896" stop-opacity=".3"/><stop offset=".3" stop-color="#F3DCAB" stop-opacity=".17"/><stop offset=".62" stop-color="#F1E2C2" stop-opacity=".09"/><stop offset="1" stop-color="#F0E6D2" stop-opacity=".03"/></radialGradient></defs><rect data-cargo-glow data-center-x="${c.x}" data-center-y="${c.y}" width="${w}" height="${h}" fill="url(#r17-lamp-wash)"/></svg>`;}
 function envelope(){return `<g transform="translate(0 0)">${layer(trace.sack)}</g>`;}
 // Inline geometry for the buttons that sit on the traced band.
 function place(root){const w=root.clientWidth,s=unit(w);root.style.setProperty('--cargo-s',fmt(s));root.querySelectorAll('.cargo-mailbag').forEach((b,i)=>Object.assign(b.style,{left:fmt((SACKS[i]??SACKS.at(-1))*s-SACK.w*s/2)+'px',top:fmt(SACK.top*s)+'px',width:fmt(SACK.w*s)+'px',height:fmt(SACK.h*s)+'px'}));const t=root.querySelector('.cargo-lamp-toggle');if(t)Object.assign(t.style,{left:fmt((LANTERN.x-4)*s)+'px',top:fmt((LANTERN.y-26)*s)+'px',width:fmt((LANTERN.w+8)*s)+'px',height:fmt((LANTERN.h+30)*s)+'px'});HOST.body.dataset.cargoLamp=lit()?'on':'off';}
 function lampButton(){return `<button type="button" class="cargo-lamp-toggle" data-p2="task-lamp" aria-pressed="${lit()}" aria-label="${lit()?'熄灭马灯':'点亮马灯'}"></button>`;}
 function toggleLamp(){d.ui.cargoLamp=!lit();HOST.body.dataset.cargoLamp=lit()?'on':'off';const t=HOST.querySelector('#tasks .cargo-lamp-toggle');if(t){t.setAttribute('aria-pressed',String(lit()));t.setAttribute('aria-label',lit()?'熄灭马灯':'点亮马灯');}}
 return{scene,light,envelope,place,lampButton,toggleLamp,sackBox:SACK};
}
