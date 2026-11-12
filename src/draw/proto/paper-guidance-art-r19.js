import {maritimeArt} from './paper-maritime-r14.js';
// R19: the masthead is drawn by hand in code again (as in R16), on the reference composition measured in R17:
// a 690 × 767 plane, flags hung at measured stations. Long continuous strokes, three weights only
// (structure 1.6, detail 1, pale 0.6), sparse shading — no traced or auto-vectorised lines.
export const GUIDANCE_W=690,GUIDANCE_H=767,GUIDANCE_HORIZON=626,GUIDANCE_CENTER=335,GUIDANCE_SPAN=610;
export const GUIDANCE_FLAGS=[[178,325,77],[272,317,72],[352,305,79],[454,284,66],[531,281,74]].map(([x,y,w])=>({x,y,k:w/68}));
const yardY=x=>334-x*.1637,yardR=x=>6.4-Math.max(0,x)*.0028;
const mastX=y=>113-(y-50)*.012,mastR=y=>12+(y-50)*.031;
export function createGuidanceArt({L,C,circle}){
 const INK='#1C2A35',MID='#687B83',PALE='#B4C2C6',PAPER='#F4F5F2',marine=maritimeArt({ink:L,curve:C,circle});
 const F=p=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z" fill="${PAPER}"/>`;
 const arc=(x,y,rx,ry,a,b,n=1.2,c=INK,attrs='')=>{const k=Math.max(6,Math.ceil(Math.abs(b-a)*12));return C(Array.from({length:k+1},(_,i)=>{const t=a+(b-a)*i/k;return[x+Math.cos(t)*rx,y+Math.sin(t)*ry];}),n,c,attrs);};
 let cached='';
 // Pale cloud bank: a soft upper outline over a few level strokes, all in the pale tone.
 function cloud(x,y,w,h=1){const b=[[0,0],[.08,-.35],[.16,-.5],[.24,-.3],[.33,-.62],[.44,-.75],[.54,-.5],[.63,-.66],[.74,-.45],[.84,-.52],[.93,-.2],[1,0]].map(([u,v])=>[x+u*w,y+v*18*h]);let s=C(b,.7,PALE);for(let i=0;i<4;i++){const yy=y+3+i*3.6,x0=x+w*(.05+i*.06),x1=x+w*(.95-i*.09);s+=C([[x0,yy],[(x0+x1)/2,yy-.4],[x1,yy+.2]],.55,PALE,'opacity=".85"');}return s;}
 function strata(x,y,w){return C([[x,y],[x+w*.35,y-.8],[x+w*.7,y-.2],[x+w,y-1.2]],.55,PALE,'opacity=".8"');}
 function sky(){let s='<g data-guidance-clouds>';for(const[x,y,w,h]of [[200,-40,180,.8],[470,-70,190,1],[20,-10,110,.7],[468,62,210,1.4],[560,30,120,.9],[380,128,300,1.1],[300,172,250,.9],[0,88,120,.8],[212,588,104,.7],[505,586,112,.75],[0,560,70,.6]])s+=cloud(x,y,w,h);
 for(const[x,y,w]of [[260,-60,260],[60,-30,180],[420,96,250],[330,146,330],[250,196,200],[520,214,160],[0,118,150],[40,140,90],[380,540,150],[560,548,120]])s+=strata(x,y,w);return s+'</g>';}
 // R20: far ranges are filled with paper and sit behind the horizon: clouds pass behind them, the sea line runs
 // in front of their feet. A paler back range, a main range with secondary peaks, ridge creases and slope hatching.
 function mountains(){const range=(pts,n,c)=>F([...pts,[pts.at(-1)[0],GUIDANCE_HORIZON+1],[pts[0][0],GUIDANCE_HORIZON+1]])+C(pts,n,c);let s='<g data-guidance-far>';
 s+=range([[356,626],[368,621],[381,617],[393,614],[405,611],[416,609],[428,611]],.7,PALE)+range([[512,612],[526,607],[538,603],[548,601],[558,604],[570,609],[584,615],[597,620],[610,626]],.75,PALE);
 const main=[[392,626],[402,622],[412,618],[421,614],[429,612],[437,608],[445,605],[452,601],[459,600],[466,596],[472,592],[478,589],[483,591],[489,595],[496,598],[503,601],[510,605],[519,608],[529,612],[540,617],[551,621],[562,626]];s+=range(main,.95,MID);
 for(const p of [[[478,589],[474,597],[469,605],[465,614]],[[478,589],[485,599],[490,608],[493,617]],[[459,600],[455,608],[452,616]],[[503,601],[500,609],[498,617]],[[437,608],[434,615]],[[529,612],[527,619]]])s+=C(p,.5,MID,'opacity=".8"');
 for(const[x,y,n]of [[484,596,6],[506,606,5],[462,604,3],[531,614,3]])for(let i=0;i<n;i++)s+=L([[x+i*3.2,y+i*1.6],[x+i*3.2-2.4,y+i*1.6+5]],.4,PALE);
 const hill=[[0,603],[10,598],[18,595],[26,592],[34,594],[44,598],[56,604],[68,611],[80,619],[92,626]];s+=range(hill,.85,MID)+C([[26,592],[29,601],[27,610]],.5,MID,'opacity=".8"')+C([[44,598],[47,606]],.45,MID,'opacity=".8"');
 return s+'</g>';}
 // Island and lighthouse in front of the sea: one ridge line, a waterline, a few rock contours and a simple tower.
 function island(){let s='';const ridge=[[498,654],[514,645],[530,634],[548,627],[566,620],[586,610],[606,601],[624,599],[642,597],[660,590],[676,592],[690,598]];
 s+=`<g data-morph="lighthouse">${F([...ridge,[690,656],[498,656]])}${C(ridge,1.3)}${L([[492,655],[690,655]],1,MID)}`;
 for(const p of [[[530,641],[552,636],[566,630]],[[574,626],[592,621],[604,612]],[[640,606],[658,600],[672,602]],[[612,616],[630,612],[648,614]],[[550,648],[574,645],[600,647]]])s+=C(p,.6,MID);
 for(let i=0;i<9;i++){const x=600+i*8;s+=L([[x,608+i%3*2],[x-3,620+i%2*4]],.45,MID,'opacity=".7"');}
 s+=F([[617,600],[619,572],[628,572],[630,600]])+L([[617,600],[619,572]],1.1)+L([[630,600],[628,572]],1.1)+L([[616,572],[631,572]],1)+L([[618,572],[618,565],[629,565],[629,572]],.9)+L([[616,565],[623.5,558],[631,565]],1)+L([[623.5,558],[623.5,554]],.8)+L([[620,588],[620,594],[623,594],[623,588]],.6)+L([[618,582],[629,582]],.5,MID);
 return s+'</g>';}
 function sea(){let s='<g data-guidance-water>',seed=1721;const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let row=0;row<22;row++){const t=row/21,y=631+t*134,len=10+t*34,step=len*2.4-t*len*.6;for(let x=-10+r()*step;x<690;x+=step*(.8+r()*.5)){const a=x,b=x+len*(.7+r()*.6);if(b<0)continue;s+=C([[a,y+(r()-.5)],[(a+b)/2,y-.4-t*.4],[b,y+(r()-.5)*.6]],.5+t*.35,row%3?PALE:MID,'opacity=".85"');}}
 // The sun's broken reflection, and the island's darker one.
 for(let i=0;i<10;i++){const y=632+i*5,half=6+i*2.2,x=366+Math.sin(i*1.9)*2.5;s+=C([[x-half,y],[x-2,y-.3]],.7,MID)+C([[x+3,y+.2],[x+half*.8,y]],.6,MID,'opacity=".8"');}
 for(let i=0;i<5;i++)s+=C([[600-i*4,660+i*4.5],[640,659.6+i*4.5],[676-i*5,660+i*4.5]],.6,MID,'opacity=".7"');
 return s+'</g>';}
 // Rigging behind the mast: single clean lines, the two main stays slightly heavier.
 function rigging(){let s='<g data-rigging>';for(const[a,b,n]of [[[98,64],[-4,262],1.4],[[104,70],[58,206],1],[[124,70],[176,206],1],[[134,62],[588,238],1.5],[[62,252],[-4,520],1],[[84,262],[8,767],1.2],[[124,300],[244,767],1.5],[[104,330],[200,767],1],[[40,330],[-4,410],.9]])s+=L([a,b],n,n<1.2?MID:INK);return s+'</g>';}
 function mast(){let s='<g data-morph="mast">';const left=[],right=[];for(let y=50;y<=767;y+=20){left.push([mastX(y)-mastR(y),y]);right.push([mastX(y)+mastR(y),y]);}
 s+=F([...left,...right.toReversed()])+C(left,1.7)+C(right,1.7);
 // Shade: three long lines on the right third, one on the left edge, broken only by the bands.
 const runs=[[60,206],[272,296],[310,425],[438,552],[566,710],[724,767]];for(const[k,n,c]of [[.42,.5,MID],[.6,.55,MID],[.78,.6,INK],[-.62,.45,PALE]])for(const[a,b]of runs)s+=C(Array.from({length:6},(_,i)=>{const y=a+(b-a)*i/5;return[mastX(y)+mastR(y)*k,y];}),n,c,'opacity=".75"');
 // Pale grain and a light diagonal hatch on the shaded side give the pole volume without noise.
 for(const[a,b]of runs){for(const k of [-.32,-.08,.18]){const y0=a+6+((k*97+a)%11+11)%11,y1=b-6-((k*53+b)%13+13)%13;if(y1-y0>18)s+=C([[mastX(y0)+mastR(y0)*k,y0],[mastX((y0+y1)/2)+mastR((y0+y1)/2)*k+.4,(y0+y1)/2],[mastX(y1)+mastR(y1)*k,y1]],.45,PALE);}for(let y=a+4;y<b-4;y+=7)s+=L([[mastX(y)+mastR(y)*.66,y+2],[mastX(y)+mastR(y)*.92,y-1.5]],.4,MID,'opacity=".55"');}
 for(const y of [298,430,557,715]){const x=mastX(y),r=mastR(y)+2.5;s+=F([[x-r,y-4],[x+r,y-4],[x+r,y+4],[x-r,y+4]])+arc(x,y-4,r,3,0,Math.PI,1.2)+arc(x,y+4,r,3,0,Math.PI,1.2)+L([[x-r,y-4],[x-r,y+4]],1)+L([[x+r,y-4],[x+r,y+4]],1);for(let k=-.6;k<=.7;k+=.33)s+=L([[x+r*k,y-1],[x+r*k+1.5,y+5]],.45,MID);}
 s+=F([[100,42],[126,42],[126,56],[100,56]])+arc(113,42,13,3,Math.PI,Math.PI*2,1.2)+arc(113,42,13,3,0,Math.PI,1.2)+L([[100,42],[100,56]],1.3)+L([[126,42],[126,56]],1.3)+arc(113,56,13,3,0,Math.PI,1.1)+circle(94,62,3.2,1)+circle(133,61,3.2,1);
 s+=marine.bird(90,17,1);return s+'</g>';}
 // Crow's nest around the mast: back rail behind the pole, platform, front rail, struts to the mast.
 function nestBack(){let s=arc(118,212,86,14,Math.PI,Math.PI*2,1.4)+arc(118,245,80,13,Math.PI,Math.PI*2,1);for(let i=1;i<8;i++){const t=Math.PI+i*Math.PI/8;s+=L([[118+Math.cos(t)*86,212+Math.sin(t)*14],[118+Math.cos(t)*80,245+Math.sin(t)*13]],.8,MID);}return s;}
 function nestFront(){let s='';const plat=Array.from({length:25},(_,i)=>{const t=i*Math.PI/24;return[118+Math.cos(t)*80,245+Math.sin(t)*13];});s+=F([...plat,...plat.toReversed().map(([x,y])=>[x,y+7])]);
 for(const[x0,y0,x1,y1]of [[52,252,104,282],[88,256,108,284],[184,252,132,282],[148,256,128,284]])s+=L([[x0,y0],[x1,y1]],1.1);s+=arc(118,282,18,4,0,Math.PI,1.1);
 s+=arc(118,245,80,13,0,Math.PI,1.6)+arc(118,252,80,13,0,Math.PI,1.3)+L([[38,245],[38,252]],1.2)+L([[198,245],[198,252]],1.2);
 for(let i=0;i<=10;i++){const t=i*Math.PI/10;s+=L([[118+Math.cos(t)*86,212+Math.sin(t)*14],[118+Math.cos(t)*80,245+Math.sin(t)*13]],1.05);}
 s+=arc(118,212,86,14,0,Math.PI,1.7)+arc(118,216,86,14,.15,Math.PI-.15,.7,MID);return s;}
 function yard(){let s='<g data-yard>';const xs=Array.from({length:28},(_,i)=>-12+i*25),top=xs.map(x=>[x,yardY(x)-yardR(x)]),bot=xs.map(x=>[x,yardY(x)+yardR(x)]);
 s+=F([...top,...bot.toReversed()])+C(top,1.5)+C(bot,1.5)+C(xs.filter(x=>x<640).map(x=>[x,yardY(x)+yardR(x)*.45]),.5,MID,'opacity=".8"');s+=circle(665,yardY(665),4.6,1.3)+L([[660,yardY(660)-4.5],[665,yardY(665)-4.6]],1);
 for(const x of [185,262,341,462,580]){const y=yardY(x),r=yardR(x)+1.6;s+=arc(x,y,3,r,-Math.PI/2,Math.PI/2,1.1)+arc(x+4,y,3,r,-Math.PI/2,Math.PI/2,.8,MID);}
 for(let i=0;i<4;i++){const x=104+i*4,y=yardY(x);s+=L([[x-2,y-8],[x+2,y+8]],.95);}
 for(const f of GUIDANCE_FLAGS)for(const[cx,cy]of [[f.x+3*f.k,f.y+8*f.k],[f.x+66*f.k,f.y+3*f.k]])s+=C([[cx,yardY(cx)+yardR(cx)],[cx+.5,(yardY(cx)+cy)/2],[cx,cy]],.9);
 return s+'</g>';}
 function body(){if(cached)return cached;return cached=sky()+mountains()+`<g data-morph="horizon">${C([[0,GUIDANCE_HORIZON],[345,GUIDANCE_HORIZON-.3],[690,GUIDANCE_HORIZON]],.9,MID)}</g>`+`<g data-morph="sun">${circle(366,562,31,1.3,INK)}</g>`+sea()+island()+rigging()+nestBack()+mast()+nestFront()+yard();}
 return{body};
}
