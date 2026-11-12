import {strokes} from './paper-strokes-r18.js';
// R18: the masthead is redrawn in code. tools/strokes-r18.cjs reduced the user's reference to centre lines with a
// local width; here every line goes through the page's own pen, so weight, taper and smoothing match the rest.
// Same 690 × 767 plane as R17; flags, captions and the sun stay separate code objects.
export const GUIDANCE_W=690,GUIDANCE_H=767,GUIDANCE_HORIZON=626,GUIDANCE_CROP=56;
export const GUIDANCE_FLAGS=[[178,325,77],[272,317,72],[352,305,79],[454,284,66],[531,281,74]].map(([x,y,w])=>({x,y,k:w/68}));
// Right edge the flags need (cloth plus caption margin), in plane units after the crop.
export const GUIDANCE_NEED_W=GUIDANCE_FLAGS.at(-1).x+GUIDANCE_FLAGS.at(-1).k*68+8-GUIDANCE_CROP;
const yardY=x=>319-(x-100)*.1664;
// Shared by the hold: one stroke list → pen paths. Dark lines keep their measured weight; pale hatch stays fine.
export function penLayer(C,layer,{ink='#1C2A35',pale='#687B83',dark=1.15,light=.95}={}){const pts=s=>{const p=[];for(let i=1;i<s.length;i+=2)p.push([s[i],s[i+1]]);return p;};
 return `<g data-pen-light opacity=".7">${layer.light.map(s=>C(pts(s),Math.max(.4,s[0]*light),pale)).join('')}</g><g data-pen-dark>${layer.dark.map(s=>C(pts(s),Math.max(.55,Math.min(3,s[0]*dark)),ink)).join('')}</g>`;}
export function createGuidanceArt({C,circle}){
 const INK='#1C2A35',MID='#687B83',TICK='#B4C2C6';let cached='';
 function body(){if(cached)return cached;let s=`<g data-morph="mast" data-pen-scene="guidance">${penLayer(C,strokes.guidance)}</g>`;
 s+=`<g data-morph="lighthouse" data-pen-scene="lighthouse">${penLayer(C,strokes.lighthouse)}</g>`;
 // Far ridges and low cloud banks, which the pale threshold drops, are restored as a few code lines.
 s+='<g data-guidance-far>'+C([[392,626],[420,616],[446,609],[462,603],[477,597],[492,604],[512,610],[532,617],[556,624]],.8,MID)+C([[440,616],[455,611],[470,606]],.45,TICK)+C([[0,600],[14,594],[28,590],[40,596],[58,604]],.7,MID);
 for(const[x,y,k]of [[214,586,1],[300,584,.7],[512,584,.9],[585,580,.75]])s+=C([[x,y],[x+8*k,y-5*k],[x+18*k,y-6*k],[x+26*k,y-2*k],[x+34*k,y-7*k],[x+46*k,y-6*k],[x+54*k,y]],.6,TICK)+C([[x-6,y+3],[x+60*k,y+3]],.45,TICK);s+='</g>';
 s+=`<g data-morph="horizon">${C([[0,GUIDANCE_HORIZON],[345,GUIDANCE_HORIZON-.3],[690,GUIDANCE_HORIZON]],.9,MID)}</g>`;
 s+=`<g data-morph="sun">${circle(366,562,31,1.25,INK)}</g>`;
 s+='<g data-guidance-halyards>';for(const f of GUIDANCE_FLAGS)for(const [cx,cy] of [[f.x+3*f.k,f.y+8*f.k],[f.x+66*f.k,f.y+3*f.k]])s+=C([[cx,yardY(cx)+5],[cx+.6,(yardY(cx)+cy)/2],[cx,cy]],.9,INK);s+='</g>';
 s+='<g data-guidance-water>';for(let i=0;i<9;i++){const y=632+i*5.5,half=7+i*2.4,x=366+Math.sin(i*1.9)*3;s+=C([[x-half,y],[x-2,y-.4]],.7,MID,'opacity=".75"')+C([[x+3,y+.2],[x+half*.85,y]],.6,MID,'opacity=".6"');}s+='</g>';
 return cached=s;}
 return{body};
}
