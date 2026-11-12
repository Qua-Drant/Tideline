// R31 (copied from paper-onboarding-art-r30.js, which stays as it was): the same drawings with more of them alive.
// The lantern flame flickers and its glow breathes, a far sail crosses the porthole, both hourglasses run out and turn
// over, the quill nods while a line writes itself, the sextant's index arm walks along the limb, the dividers step,
// the course dashes are inked one after another and the position ping spreads, the lighthouse beam sweeps, gulls flap
// as they glide, the masthead pennant flutters and a fish jumps in the sea band. All of it is <g class="ob-a …">, so
// paper-r30/r31.css stop every loop when 过场 is not 完整 or the system asks for less motion.
// R30 first-voyage illustrations (paper-onboarding-art-r28.js stays as it was). Same five scenes, with the drawing
// faults fixed: the sextant's limb now sits under the frame instead of floating above it, both hourglasses are drawn
// as two bulbs instead of a crossed box, the chart dividers stand on the table instead of hanging through it, the
// rolled chart lies on the table, the inkwell no longer sits on the open page, and the stray caret on the hold floor
// is gone. Parts that move are wrapped in <g class="ob-a …">; paper-r30.css gives them the slow loops.
export function createVoyageArt({ink,circle}){
 const I='#1C2A35',M='#5B6871',T='#B6C0C5',P='#F4F5F2';
 // Straight edges are densified first, so the pen's smoothing cannot bow them between corners.
 const dense=p=>{const o=[];for(let i=0;i<p.length-1;i++){const[a0,a1]=p[i],[b0,b1]=p[i+1],n=Math.max(1,Math.ceil(Math.hypot(b0-a0,b1-a1)/5));for(let k=0;k<n;k++)o.push([a0+(b0-a0)*k/n,a1+(b1-a1)*k/n]);}o.push(p.at(-1));return o;};
 const L=(p,w=1.2,c=I)=>w?ink(p.length>2&&p.length<9?dense(p):p,w,c):'';
 const F=p=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(1)).join(',')).join('L')}Z" fill="${P}"/>`;
 const svg=(s,w,h)=>`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${s}</svg>`;
 const G=(cls,inner,origin='',delay=0)=>`<g class="ob-a ${cls}"${origin||delay?` style="${origin?`transform-origin:${origin};`:''}${delay?`--ob-d:${delay}ms`:''}"`:''}>${inner}</g>`;
 const ell=(cx,cy,rx,ry,a0=0,a1=Math.PI*2,n=28)=>Array.from({length:n+1},(_,i)=>{const t=a0+(a1-a0)*i/n;return[cx+Math.cos(t)*rx,cy+Math.sin(t)*ry];});
 const hatch=(x0,y0,x1,y1,step=5,w=.45,c=M)=>{let s='';for(let x=x0-(y1-y0);x<x1;x+=step){const a=[Math.max(x0,x),Math.max(x0,x)===x?y1:y1-(x0-x)],b=[Math.min(x1,x+(y1-y0)),Math.min(x1,x+(y1-y0))===x+(y1-y0)?y0:y0+(x+(y1-y0)-x1)];s+=L([a,b],w,c);}return s;};
 const waves=(x0,x1,y,n=10,c=T)=>{let s='';for(let i=0;i<n;i++){const x=x0+(x1-x0)*((i*.618)%1),yy=y+(i%4)*7;s+=L([[x,yy],[x+10,yy-1.2],[x+22,yy]],.55,i%3?c:M);}return s;};
 const bird=(x,y,k=1,i=0)=>G('ob-a-glide',G('ob-a-flap',L([[x-6*k,y],[x-2*k,y-3*k],[x,y]],.8)+L([[x,y],[x+2*k,y-3*k],[x+6*k,y]],.8),`${x}px ${y}px`,i*170),'',i*900);
 function crate(x,y,w,h){let s=F([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])+L([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],1.3);for(let k=1;k<4;k++)s+=L([[x+2,y+h*k/4],[x+w-2,y+h*k/4]],.5,M);s+=L([[x+4,y+h-4],[x+w-4,y+4]],1)+L([[x+8,y+h-4],[x+w-4,y+8]],.5,M);for(const[a,b]of [[x+5,y+5],[x+w-5,y+5],[x+5,y+h-5],[x+w-5,y+h-5]])s+=circle(a,b,1,.7);return s;}
 function barrel(cx,y0,y1,r){let s=F([...ell(cx,y0,r,r*.28,Math.PI,Math.PI*2),[cx+r*1.08,(y0+y1)/2],...ell(cx,y1,r,r*.28,0,Math.PI),[cx-r*1.08,(y0+y1)/2]]);s+=L(ell(cx,y0,r,r*.28),1.2)+L([[cx-r,y0],[cx-r*1.1,(y0+y1)/2],[cx-r,y1]],1.3)+L([[cx+r,y0],[cx+r*1.1,(y0+y1)/2],[cx+r,y1]],1.3)+L(ell(cx,y1,r,r*.28,0,Math.PI),1.2);
  for(const t of [.18,.82])s+=L(ell(cx,y0+(y1-y0)*t,r*1.06,r*.28,0,Math.PI),1.4);for(let k=-2;k<=2;k++)s+=L([[cx+k*r*.38,y0+r*.28],[cx+k*r*.42,(y0+y1)/2],[cx+k*r*.38,y1+r*.26]],.45,M);return s+hatch(cx+r*.45,y0+6,cx+r*1.05,y1,5,.4);}
 function coil(cx,cy,r){let s='';for(let i=0;i<5;i++)s+=L(ell(cx+(i%2)*2,cy-i*3,r-i*1.6,(r-i*1.6)*.36),i===4?1.2:.7,i===4?I:M);return s+L([[cx+r,cy],[cx+r+16,cy+6],[cx+r+40,cy+4]],1);}
 // Lantern hangs from the deckhead beam, not from mid-air.
 function lantern(x,top,y){return G('ob-a-glow',`<circle cx="${x}" cy="${y}" r="40" fill="#F3E2B8" opacity=".38"/><circle cx="${x}" cy="${y}" r="24" fill="#F3E2B8" opacity=".45"/>`,`${x}px ${y}px`)+L([[x,top],[x,y-26]],1)+circle(x,y-24,2.6,1)+`<rect x="${x-9}" y="${y-14}" width="18" height="28" rx="3" fill="#F3E2B8" opacity=".7"/>`+L([[x-11,y-16],[x+11,y-16]],1.3)+L([[x-10,y+14],[x+10,y+14]],1.3)+L([[x-9,y-16],[x-9,y+14]],1.2)+L([[x+9,y-16],[x+9,y+14]],1.2)+L([[x-11,y-16],[x-7,y-24],[x+7,y-24],[x+11,y-16]],1.1)+G('ob-a-flicker',`<path d="M${x},${y+6}C${x-4},${y+2} ${x-2},${y-3} ${x},${y-7}C${x+2},${y-3} ${x+4},${y+2} ${x},${y+6}Z" fill="#E2B45A" opacity=".75"/>`+L([[x,y+6],[x-2,y+1],[x,y-6],[x+2,y+1],[x,y+6]],.8,'#B88A4A'),`${x}px ${y+6}px`)+L([[x-7,y+14],[x-4,y+20],[x+4,y+20],[x+7,y+14]],1);}
 function porthole(cx,cy,r){let s=circle(cx,cy,r+7,1.4)+circle(cx,cy,r,1.1);for(let i=0;i<8;i++){const t=i*Math.PI/4;s+=circle(cx+Math.cos(t)*(r+3.5),cy+Math.sin(t)*(r+3.5),1,.7);}s+=L([[cx-r+2,cy+3],[cx+r-2,cy+3]],.9)+L([[cx-r+9,cy+2],[cx-6,cy-5],[cx+2,cy+2]],.7,M)+L([[cx-r+9,cy+2],[cx-10,cy+2]],.7,M);for(let i=0;i<3;i++)s+=L([[cx-r+10+i*9,cy+11+i*4],[cx-r+20+i*9,cy+10.6+i*4]],.5,T);
  s+=`<clipPath id="ob-port-${cx}"><circle cx="${cx}" cy="${cy}" r="${r-1.5}"/></clipPath><g clip-path="url(#ob-port-${cx})">`+G('ob-a-pass',L([[cx-6,cy+3],[cx+6,cy+3]],.8)+L([[cx,cy+2],[cx,cy-9]],.7)+L([[cx-.5,cy-8],[cx-5,cy+1],[cx-.5,cy+1]],.6,M))+G('ob-a-drift',L([[cx-r,cy+7],[cx-r+12,cy+6],[cx-r+24,cy+7]],.5,M)+L([[cx+4,cy+8],[cx+16,cy+7],[cx+28,cy+8]],.5,T))+'</g>';return s;}
 // A two-bulb hourglass: plates, waist, sand in the lower bulb and the running thread.
 function hourglass(cx,top,bot,hw){const mid=(top+bot)/2;let s=L([[cx-hw,top],[cx+hw,top]],1.3)+L([[cx-hw,bot],[cx+hw,bot]],1.3)+L([[cx-hw+2,top+2],[cx-hw*.42,mid],[cx-hw+2,bot-2]],.9)+L([[cx+hw-2,top+2],[cx+hw*.42,mid],[cx+hw-2,bot-2]],.9);
  // the two heaps are mirror images, so after the half turn the full lower bulb is the new upper one
  const heap=(y0,y1)=>{const p=[[cx-hw+5,y0],[cx+hw-5,y0],[cx+1.6,y1],[cx-1.6,y1]];return F(p)+L([p[0],p[3],p[2],p[1]],.55,M);};
  s+=G('ob-a-drain',heap(top+4,mid-2),`${cx}px ${mid-2}px`)+G('ob-a-fill',heap(bot-4,mid+2),`${cx}px ${bot-4}px`);
  s+=G('ob-a-stream-on',`<line class="ob-a ob-a-stream" x1="${cx}" y1="${mid-1}" x2="${cx}" y2="${bot-5}" stroke="${M}" stroke-width=".9" stroke-linecap="round" stroke-dasharray="1.4 2.6"/>`);
  return G('ob-a-turn',s,`${cx}px ${mid}px`);}
 function cabin(){let s='';for(let x=12;x<350;x+=26)s+=L([[x,8],[x+.6,240]],.5,T);s+=L([[0,8],[360,8]],1.2)+L([[0,240],[360,240]],1.5)+L([[0,250],[360,250]],.6,M);for(let i=0;i<6;i++)s+=L([[i*64,240],[i*64-30,300]],.5,T);
  s+=porthole(285,70,26)+G('ob-a-sway',lantern(70,8,70),'70px 8px');
  s+=crate(150,150,96,90)+crate(176,96,70,54)+`<text x="211" y="128" text-anchor="middle" font-size="11" fill="${M}" style="font-family:var(--mono)">LOG</text>`+barrel(305,170,236,28)+coil(70,236,30);
  for(const x of [20,120,250])s+=L([[x,262],[x+30,262]],.5,T);return svg(s,360,300);}
 function quill(x,y,k=1,dir=1){let s='';const B=t=>[x+dir*t*48*k,y-t*150*k+t*t*30*k],pts=Array.from({length:21},(_,i)=>B(i/20));let left=[],right=[];pts.forEach(([px,py],i)=>{const t=i/20,f=t<.3?0:Math.sin(Math.PI*(t-.3)/.7)**.7;left.push([px-11*k*f,py-3*k*f]);right.push([px+6*k*f,py+2*k*f]);});
  s+=F([...left.slice(5),...right.slice(5).reverse()])+L(left.slice(5),.9)+L(right.slice(5),.8)+L(pts,1.2);for(let i=7;i<20;i++)s+=L([pts[i],left[Math.min(20,i+1)]],.4,M)+L([pts[i],right[Math.min(20,i+1)]],.4,M);return s;}
 function daily(){let s=L([[0,240],[360,240]],1.5)+L([[0,250],[360,250]],.6,M);
  // open logbook
  const l=[[40,228],[176,236],[180,128],[50,118]],r=[[180,236],[316,226],[306,116],[184,128]];s+=F(l)+F(r)+L([...l,l[0]],1.3)+L([...r,r[0]],1.3)+L([[178,128],[178,236]],1);for(let i=0;i<6;i++){const y=140+i*14;s+=L([[60,y-2+i*.4],[166,y+6]],.45,T)+L([[194,y+6],[298,y-2]],.45,T);}
  for(let i=0;i<4;i++){const y=146+i*18;s+=L([[66,y],[70,y+4],[77,y-4]],1,i<3?I:T)+L([[84,y],[150,y+4]],.6,M);}s+=L([[200,150],[290,144]],.8)+L([[200,170],[270,165]],.6,M)+G('ob-a-write-line',L([[200,186],[284,180]],.6,M),'200px 186px');
  s+=G('ob-a-tick',L([[66,200],[70,204],[77,196]],1.1),'66px 200px');
  // inkwell now stands on the desk, clear of the right page; hourglass at the left end of the desk
  s+=F([[322,238],[318,214],[326,207],[338,207],[346,214],[342,238]])+L([[322,238],[318,214],[326,207],[338,207],[346,214],[342,238],[322,238]],1.2)+hatch(332,216,344,236,4,.4)+G('ob-a-quill',quill(334,207,.82,-1),'334px 207px');
  s+=hourglass(33,180,236,13);
  return svg(s,360,300);}
 function gauges(){let s=L([[0,250],[360,250]],1.5)+L([[0,260],[360,260]],.6,M);
  // barometer on the wall: full 240° scale, the needle swings a little
  s+=circle(80,90,46,1.5)+circle(80,90,38,.8,M)+circle(80,90,3,1);for(let i=0;i<=24;i++){const t=Math.PI*(.67+i*1.66/24);s+=L([[80+Math.cos(t)*33,90+Math.sin(t)*33],[80+Math.cos(t)*(i%4?36.5:38),90+Math.sin(t)*(i%4?36.5:38)]],i%4?.5:.9);}
  s+=G('ob-a-needle',L([[80,90],[101,66]],1.3)+L([[80,90],[67,103]],.9,'#C8206A'),'80px 90px')+`<text x="80" y="124" text-anchor="middle" font-size="7" fill="${M}" style="font-family:var(--mono)">BARO</text>`+L([[80,36],[80,44]],1)+circle(80,32,3,1);
  // sextant: frame pivot at the top, the limb arcs below it, index arm to the vernier on the limb
  const px=236,py=104,R=86;const a0=Math.PI*.16,a1=Math.PI*.84;const pt=t=>[px+Math.cos(t)*R,py+Math.sin(t)*R];
  s+=L(Array.from({length:29},(_,i)=>pt(a0+(a1-a0)*i/28)),1.5);
  for(let i=0;i<=20;i++){const t=a0+(a1-a0)*i/20;s+=L([pt(t),[px+Math.cos(t)*(R+(i%5?5:8)),py+Math.sin(t)*(R+(i%5?5:8))]],i%5?.45:.9);}
  s+=L([[px,py],pt(a0)],1.3)+L([[px,py],pt(a1)],1.3);let arm=L([[px,py],pt(Math.PI*.36)],1.4);
  s+=F([[px-30,py+6],[px-2,py+6],[px-2,py+24],[px-30,py+24]])+L([[px-30,py+6],[px-2,py+6],[px-2,py+24],[px-30,py+24],[px-30,py+6]],1)+L([[px-30,py+15],[px-52,py+15]],2.2)+L([[px-52,py+12],[px-52,py+18]],1);
  const v=pt(Math.PI*.36);arm+=F([[v[0]-7,v[1]-4],[v[0]+7,v[1]-4],[v[0]+7,v[1]+8],[v[0]-7,v[1]+8]])+L([[v[0]-7,v[1]-4],[v[0]+7,v[1]-4],[v[0]+7,v[1]+8],[v[0]-7,v[1]+8],[v[0]-7,v[1]-4]],.9);s+=G('ob-a-arm',arm,`${px}px ${py}px`)+circle(px,py,5,1.2);
  s+=G('ob-a-glint',L([[px-16,py+15],[px-16,py+5]],.7,M)+L([[px-21,py+10],[px-11,py+10]],.7,M),`${px-16}px ${py+10}px`);
  s+=L([[px+18,py+34],[px+40,py+34],[px+40,py+46],[px+18,py+46],[px+18,py+34]],1);
  s+=hourglass(325,186,248,15);
  return svg(s,360,300);}
 function chartTable(){let s=L([[0,256],[360,256]],1.5);
  const sheet=[[20,60],[300,48],[312,236],[30,246]];s+=F(sheet)+L([...sheet,sheet[0]],1.3);s+=L([[40,90],[90,110],[80,150],[120,190],[110,230]],1)+L([[260,70],[230,110],[250,150],[220,200],[240,232]],1);
  for(let i=0;i<14;i++){const x=110+i*9,y=200-i*8+Math.sin(i)*4;s+=G('ob-a-dash',L([[x,y],[x+4,y-2]],.9,M),'',i*240);}
  s+=G('ob-a-ping',`<circle cx="232" cy="96" r="4" fill="none" stroke="#C8206A" stroke-width=".9"/>`,'232px 96px')+circle(232,96,3.2,1,'#C8206A')+L([[232,92],[232,84]],.9,'#C8206A');
  const cx=170,cy=150;for(let i=0;i<8;i++){const t=i*Math.PI/4,r=i%2?12:24;s+=L([[cx,cy],[cx+Math.cos(t)*r,cy+Math.sin(t)*r]],i%2?.6:1);}s+=circle(cx,cy,26,.5,M);
  for(const y of [100,140,180,220])s+=L([[34,y],[300,y-6]],.35,T);for(const x of [80,140,200,260])s+=L([[x,56],[x+6,240]],.35,T);
  // dividers stand on the table; brass compass and the rolled chart lie beside them
  s+=G('ob-a-leg-l',L([[72,256],[96,196]],1.3),'96px 196px')+G('ob-a-leg-r',L([[96,196],[120,256]],1.3),'96px 196px')+circle(96,194,4,1.1);
  s+=`<circle cx="300" cy="222" r="34" fill="${P}"/>`+circle(300,222,34,1.5)+circle(300,222,27,.7,M)+G('ob-a-needle',L([[300,199],[306,222],[300,245],[294,222],[300,199]],1.1)+`<path d="M300,199L306,222L294,222Z" fill="#C8206A" opacity=".8"/>`,'300px 222px')+circle(300,222,2,1);
  s+=F([[148,236],[232,232],[236,252],[152,256]])+L([[148,236],[232,232]],1.2)+L([[152,256],[236,252]],1.2)+L(ell(233,242,5.5,10),1.2)+L([[176,234],[177,254]],1)+L([[206,233],[207,253]],1)+L([[152,240],[230,236]],.4,M)+L([[154,247],[232,243]],.4,M);
  return svg(s,360,300);}
 function harbor(big=false){let s='';const W=760,H=320,y=228;
  for(const[cx,cy,k]of [[200,70,1],[520,50,.8],[660,90,.6]])s+=G('ob-a-drift',L([[cx-40*k,cy],[cx-30*k,cy-10*k],[cx-12*k,cy-14*k],[cx,cy-22*k],[cx+18*k,cy-16*k],[cx+34*k,cy-8*k],[cx+44*k,cy]],.8,T)+L([[cx-48*k,cy+1],[cx+52*k,cy+1]],.6,T));
  s+=`<circle cx="400" cy="${y-8}" r="38" fill="none" stroke="#B6C0C5" stroke-width="1.2"/>`;for(let i=0;i<9;i++){const t=Math.PI*(1.1+i*.1);s+=L([[400+Math.cos(t)*48,y-8+Math.sin(t)*48],[400+Math.cos(t)*58,y-8+Math.sin(t)*58]],.6,T);}
  s+=L([[0,y],[180,y-1],[320,y+1],[480,y],[760,y-1]],1.3)+L([[0,y+3],[760,y+3]],.4,T)+G('ob-a-drift-slow',waves(10,750,y+14,30))+L([[360,y+6],[440,y+6]],.6,M)+L([[370,y+12],[430,y+12]],.5,T);
  // hill, houses, lighthouse, rocks
  const hill=[[0,y-36],[40,y-60],[100,y-66],[160,y-48],[210,y-20],[240,y]];s+=F([...hill,[0,y]])+L(hill,1.3)+hatch(150,y-40,230,y-2,6,.4);
  for(const[hx,hy]of [[30,y-70],[62,y-74]])s+=F([[hx,hy],[hx+20,hy],[hx+20,hy+16],[hx,hy+16]])+L([[hx,hy+16],[hx,hy],[hx+10,hy-9],[hx+20,hy],[hx+20,hy+16]],1)+L([[hx+7,hy+16],[hx+7,hy+9],[hx+12,hy+9],[hx+12,hy+16]],.7);
  const lx=125;s+=F([[lx-12,y-56],[lx-8,y-140],[lx+8,y-140],[lx+12,y-56]])+L([[lx-12,y-56],[lx-8,y-140],[lx+8,y-140],[lx+12,y-56]],1.4)+L([[lx-10,y-146],[lx+10,y-146],[lx+10,y-158],[lx-10,y-158],[lx-10,y-146]],1.2)+L([[lx-13,y-158],[lx,y-170],[lx+13,y-158]],1.2)+L([[lx-10,y-116],[lx+10,y-116]],.7)+L([[lx-11,y-90],[lx+11,y-90]],.7)+hatch(lx+3,y-138,lx+11,y-58,5,.4);
  {let beam=`<path d="M${lx+8},${y-152}L${lx+92},${y-178}L${lx+92},${y-128}Z" fill="#F3E2B8" opacity=".35"/>`;for(let i=0;i<4;i++){const t=-.35+i*.1;beam+=L([[lx+14,y-152],[lx+14+Math.cos(t)*70,y-152+Math.sin(t)*70]],.4,T);}s+=G('ob-a-beam',beam,`${lx}px ${y-152}px`)+G('ob-a-glow',`<circle cx="${lx}" cy="${y-152}" r="9" fill="#F3E2B8" opacity=".6"/>`,`${lx}px ${y-152}px`);}
  s+=L([[210,y-8],[330,y-8]],1.3)+L([[210,y-2],[330,y-2]],1);for(const x of [222,252,282,312,328])s+=L([[x,y-12],[x,y+14]],1.2);s+=coil(300,y-14,8);
  // ship: hull, stays, then the two sails either side of their masts, masts on top; the whole group rides the swell
  const bx=580;const sail=(x0,top,bot,w,dir)=>F(dir<0?[[x0,top],[x0-w,bot],[x0,bot]]:[[x0,top],[x0+w,bot],[x0,bot]])+L(dir<0?[[x0,top],[x0-w*1.04,bot-6],[x0,bot],[x0,top]]:[[x0,top],[x0+w*1.04,bot-6],[x0,bot],[x0,top]],1.2)+Array.from({length:4},(_,i)=>L(dir<0?[[x0-w*(i+1)/5*1.02,top+(bot-top)*(i+1)/5],[x0,top+(bot-top)*(i+1)/5]]:[[x0+w*(i+1)/5*1.02,top+(bot-top)*(i+1)/5],[x0,top+(bot-top)*(i+1)/5]],.4,M)).join('');
  let ship=L([[bx-10,y-190],[bx+96,y-8]],.6,M)+L([[bx-10,y-190],[bx-104,y-8]],.6,M)+L([[bx+46,y-134],[bx+86,y-8]],.5,M);
  ship+=sail(bx-14,y-182,y-26,76,-1)+sail(bx+50,y-128,y-24,50,1);
  ship+=F([[bx-80,y-8],[bx+84,y-8],[bx+64,y+12],[bx-66,y+12]])+L([[bx-80,y-8],[bx-66,y+12],[bx+64,y+12],[bx+84,y-8],[bx-80,y-8]],1.6)+hatch(bx-60,y-4,bx+60,y+10,7,.4);
  ship+=L([[bx-10,y-8],[bx-10,y-190]],1.5)+L([[bx+46,y-8],[bx+46,y-134]],1.3)+G('ob-a-flutter',L([[bx-14,y-190],[bx+10,y-184],[bx-14,y-178]],1,M),`${bx-14}px ${y-184}px`)+L([[bx-10,y-186],[bx-58,y-30]],.45,M);
  s+=G('ob-a-bob',ship,`${bx}px ${y+12}px`);
  s+=G('ob-a-shimmer',L([[bx-84,y+18],[bx+90,y+17]],.7,M)+L([[bx-60,y+26],[bx+60,y+25]],.5,T)+L([[bx-34,y+33],[bx+30,y+32]],.45,T),`${bx}px ${y+24}px`);[[330,80,1],[356,66,.8],[700,120,.9],[470,96,.7]].forEach(([x,yy,k],i)=>{s+=bird(x,yy,k,i);});
  return svg(s,W,H);}
 // A laid rope with three knots, to sit under a page title. Drawn 1080 wide so it spans the same column as the step.
 function rope(){let s='';const W=1080,y=10;s+=L(Array.from({length:55},(_,i)=>[i*W/54,y-2+Math.sin(i*.9)*.6]),.9)+L(Array.from({length:55},(_,i)=>[i*W/54,y+2+Math.sin(i*.9+1)*.6]),.9);for(let x=4;x<W;x+=7)s+=L([[x,y+2.4],[x+3,y-2.4]],.45,M);
  for(const x of [W*.18,W*.5,W*.82])s+=`<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="${P}"/>`+L(ell(x,y,9,6),1.1)+L([[x-5,y-4],[x+5,y+4]],.7)+L([[x-5,y+4],[x+5,y-4]],.7);return svg(s,W,20);}
 // A band of sea above the course: buoys, a far sail, gulls and rows of water.
 function seaBand(){let s=G('ob-a-drift-slow',waves(0,1000,18,40))+L([[0,12],[260,10],[520,13],[760,10],[1000,12]],.7,T);
  [140,620].forEach((x,i)=>{s+=G('ob-a-bob',L([[x-6,30],[x+6,30],[x+4,14],[x-4,14],[x-6,30]],1.1)+L([[x,14],[x,4]],1)+L([[x,4],[x+8,7],[x,10]],.9,'#C8206A'),`${x}px 30px`,i*1900)+L([[x-10,33],[x+10,33]],.6,T);});
  s+=G('ob-a-jump',L(ell(470,30,6,2.2),.8,M)+L([[464,30],[459,27],[459,33],[464,30]],.8,M),'470px 40px');
  s+=G('ob-a-bob',L([[840,24],[870,24]],1)+L([[852,24],[852,2]],.9)+L([[851,4],[842,21],[851,21]],.8)+L([[854,6],[862,21],[854,21]],.8),'855px 24px');[[380,8],[400,4],[960,10]].forEach(([x,y],i)=>{s+=bird(x,y,.8,i+1);});
  for(const x of [250,720])s+=L(ell(x,30,7,2.5),.7,M)+L([[x-7,30],[x-11,27],[x-11,33],[x-7,30]],.7,M);return svg(s,1000,44).replace('<svg ','<svg preserveAspectRatio="none" ');}
 return{cabin,daily,gauges,chartTable,harbor,waves,rope,seaBand};}
