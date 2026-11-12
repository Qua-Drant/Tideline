export function cargoScene(a){const{d,ink:L,circle,INK:I,SECONDARY:M,TICK:T}=a,C=a.curve,P=a.PAPER;
 const F=p=>`<path d="M${p.map(q=>q.join(',')).join('L')}Z" fill="${P}"/>`;
 function board(w,y,h=12){let s=F([[0,y],[w,y],[w,y+h],[0,y+h]])+C([[0,y],[w*.4,y-.4],[w,y]],2)+C([[0,y+h],[w*.6,y+h+.4],[w,y+h]],1.5);for(let x=12;x<w-18;x+=64)s+=C([[x,y+h*.5],[x+16,y+h*.47],[x+43,y+h*.56]],.55,M);return s;}
 function scene(w,h){let s=`<g data-cargo-beams>${board(w,4,18)}`;for(const x of [w*.13,w*.42,w*.71]){const p=[[x-17,4],[x+8,4],[x+37,51],[x+18,53],[x-17,4]];s+=F(p)+L(p,1.3)+L([[x-10,9],[x+22,48]],.6,M)+circle(x+20,44,1.2,.9);}s+='</g>';
 s+=`<g data-morph="deck">${board(w,122,9)}${F([[6,121],[102,121],[102,134],[6,134]])}${L([[6,122],[6,134],[102,134],[102,122]],1.7)}${F([[5,119],[50,76],[133,77],[101,121]])}${L([[5,119],[50,76],[133,77],[101,121],[5,119]],1.5)}${L([[17,112],[55,83],[118,83],[96,112],[17,112]],.9,M)}${L([[36,101],[102,101]],.6,T)}${L([[48,91],[112,91]],.6,T)}</g>`;
 const lampX=w*.635;s+=L([[lampX,23],[lampX,31]],1.3)+circle(lampX,32,3,1)+a.insetAsset('lantern-r10',lampX-18,32,36,82);
 // A sagging line hangs from physical hooks on the overhead beam.
 s+=C([[w*.72,24],[w*.78,37],[w*.85,30],[w*.91,37],[w*.98,23]],1.5);
 for(const ratio of [.77,.85,.93]){const x=w*ratio;s+=circle(x,31,3,1)+L([[x,29],[x,42]],1.1);}
 s+=`<g data-cargo-floor>${board(w,h-24,10)}`;for(const ratio of [.03,.14,.3,.49,.7,.9]){const x=w*ratio;s+=L([[x,h-13],[x-24,h]],.65,T);}s+='</g>';
 s+=L([[w-10,22],[w-7,121]],2)+L([[w-20,22],[w-17,121]],1.1);return s;}
 function ladder(h){let s='';const height=h-157;for(const x of [7,43]){s+=F([[x,0],[x+6,0],[x+10,height],[x+2,height]])+L([[x,0],[x+6,0],[x+10,height],[x+2,height],[x,0]],1.3);s+=C([[x+3,8],[x+5,height*.5],[x+6,height-9]],.5,M);}const count=Math.floor(height/39);for(let i=0;i<=count;i++){const y=14+i*(height-24)/count;s+=F([[13,y],[46,y],[46,y+6],[13,y+6]])+L([[13,y],[46,y],[46,y+6],[13,y+6],[13,y]],1.05)+circle(16,y+3,.75,.7)+circle(42,y+3,.75,.7);}return `<svg viewBox="0 0 62 ${height}" width="62" height="${height}" aria-hidden="true">${s}</svg>`;}
 function envelope(){let s=C([[38,0],[35,7],[41,12]],1.1)+F([[19,18],[12,39],[7,69],[14,83],[60,83],[70,70],[64,41],[55,18]])+C([[19,18],[24,10],[38,14],[50,9],[55,18],[64,41],[70,70],[60,83],[14,83],[7,69],[12,39],[19,18]],1.35)+L([[19,19],[56,19]],1.7)+C([[25,22],[20,39],[19,59]],.6,M)+C([[50,23],[56,42],[57,69]],.6,M)+C([[10,70],[18,75],[30,77]],.55,T)+C([[45,78],[57,76],[65,69]],.55,T);s+=F([[28,32],[55,31],[56,58],[28,59]])+L([[28,32],[55,31],[56,58],[28,59],[28,32]],1)+circle(41,35,1.4,.75);return s;}
 return{scene,ladder,envelope};}
