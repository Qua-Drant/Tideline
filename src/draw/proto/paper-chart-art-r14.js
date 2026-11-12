import {maritimeArt} from './paper-maritime-r14.js';
export function chartArt(a){const L=a.ink,C=a.curve,I=a.INK,M=a.SECONDARY,T=a.TICK,P=a.PAPER,m=maritimeArt(a),F=p=>`<path d="M${p.map(q=>q.join(',')).join('L')}Z" fill="${P}"/>`;
 function scene(w,h){let s='',X=x=>x*w,Y=y=>y*h,R=p=>p.map(([x,y])=>[X(x),Y(y)]);
 // The ports occupy the margins. Navigation remains in the open water between them.
 const left=R([[0,.13],[.026,.16],[.036,.19],[.03,.22],[.043,.25],[.032,.29],[.04,.33],[.063,.38],[.059,.42],[.046,.45],[.05,.49],[.055,.53],[.047,.57],[.03,.61],[.025,.66],[.033,.71],[.043,.76],[.035,.8],[.017,.84],[.022,.9],[0,.93]]);
 const right=R([[1,.12],[.978,.17],[.971,.21],[.957,.23],[.953,.28],[.964,.32],[.961,.36],[.97,.4],[.957,.44],[.946,.48],[.948,.52],[.958,.57],[.954,.62],[.943,.66],[.934,.71],[.938,.76],[.957,.81],[.953,.85],[.962,.9],[1,.93]]);
 s+=F(left)+C(left,1.55)+F(right)+C(right,1.55);
 for(const[k,col]of [[.009,M],[.02,T]]){s+=C(left.map(([x,y],i)=>[x+(i?X(k):0),y]),.7,col)+C(right.map(([x,y],i)=>[x-(i?X(k):0),y]),.7,col);}
 // Timber piers, mooring posts and a few buildings give the two shores scale.
 for(const[side,ratio]of [[0,.31],[0,.47],[1,.35],[1,.61]]){const edge=side?w:0,dir=side?-1:1,y=Y(ratio),len=X(side?.115:.12);s+=F([[edge,y-5],[edge+dir*len,y-5],[edge+dir*len,y+3],[edge,y+3]])+L([[edge,y-5],[edge+dir*len,y-5],[edge+dir*len,y+3],[edge,y+3]],1.05);for(let i=1;i<=6;i++){const x=edge+dir*len*i/7;s+=L([[x,y-12],[x,y+7]],.85)+a.circle(x,y-12,1.8,.8);}s+=L([[edge+dir*12,y-9],[edge+dir*(len-7),y-9]],.6,M);}
 s+=m.tower(X(.026),Y(.27),.55)+m.house(X(.002),Y(.28),.58)+m.house(X(.04),Y(.49),.45)+m.tower(X(.976),Y(.33),.53)+m.house(X(.95),Y(.61),.6)+m.house(X(.98),Y(.64),.48);
 // A curled bay makes the paused water distinct from a rectangular board column.
 const bay=R([[.735,.18],[.716,.25],[.725,.36],[.762,.39],[.808,.35],[.846,.41],[.851,.55],[.831,.66],[.852,.75]]);
 const peninsula=R([[.735,.18],[.72,.22],[.708,.27],[.714,.32],[.725,.36],[.747,.387],[.764,.372],[.78,.352],[.764,.348],[.742,.353],[.728,.324],[.725,.276],[.742,.218],[.735,.18]]);s+=F(peninsula)+C(peninsula,1.2,M)+C(R([[.725,.23],[.717,.274],[.724,.321],[.741,.366],[.758,.363]]),.6,T);s+=C(bay.slice(4),1.1,M);for(let i=1;i<3;i++)s+=C(bay.map(([x,y],j)=>[x+(j<4?-i*6:i*6),y+i*3]),.7,T);
 s+=m.rock(X(.738),Y(.31),.62)+m.rock(X(.831),Y(.69),.5)+m.plant(X(.842),Y(.74),.55);
 // A small high island, a lighthouse and broken contour rings at the top of the chart.
 const by=Y(.16),ix=X(.59),k=Math.min(1,w/1250);s+=m.rock(ix-63*k,by,.7*k)+F([[ix-75*k,by],[ix-45*k,by-12*k],[ix-19*k,by-47*k],[ix+1*k,by-56*k],[ix+22*k,by-22*k],[ix+49*k,by-16*k],[ix+77*k,by],[ix-75*k,by]])+C([[ix-75*k,by],[ix-45*k,by-12*k],[ix-19*k,by-47*k],[ix+1*k,by-56*k],[ix+22*k,by-22*k],[ix+49*k,by-16*k],[ix+77*k,by]],1.15)+L([[ix-18*k,by-42*k],[ix-23*k,by-17*k],[ix-39*k,by-6*k]],.65,M)+L([[ix+3*k,by-45*k],[ix+13*k,by-22*k],[ix+34*k,by-10*k]],.6,M)+m.tower(ix-1*k,by-53*k,.33*k);
 for(const dy of [7,14])s+=C([[ix-89*k,by+dy],[ix-30*k,by+dy+5],[ix+35*k,by+dy+5],[ix+91*k,by+dy]],.65,T);
 s+=m.cloud(X(.35),Y(.07),.8)+m.cloud(X(.7),Y(.08),.65)+m.cloud(X(.85),Y(.06),.8);
 for(const[x,y,k]of [[.19,.25,.55],[.188,.56,.6],[.68,.57,.5],[.895,.13,.52]]){s+=m.rock(X(x),Y(y),k);s+=C([[X(x)-23*k,Y(y)+4],[X(x),Y(y)+6],[X(x)+27*k,Y(y)+4]],.6,T);}
 // Chart currents curve around the active lanes, with large gaps for their names.
 for(let i=0;i<12;i++){const y=Y(.22+i*.058),start=X(.2)+(i%3)*8,end=X(.68);s+=C([[start,y],[X(.28),y-5],[X(.44),y+2],[X(.59),y-2],[end,y+1]],.55,T,'opacity=".58"');}
 for(const[xx,yy]of [[.075,.77],[.89,.81],[.24,.89],[.034,.28],[.046,.54],[.025,.8],[.97,.43],[.95,.7],[.731,.34]])s+=m.rock(X(xx),Y(yy),.7);
 s+=C(R([[0,.96],[.07,.94],[.12,.97],[.19,.95],[.23,.98],[.32,.965],[.43,.985],[.52,.978],[.63,.986],[.73,.97],[.81,.985],[.9,.957],[1,.974]]),1.15,M);
 s+=m.plant(X(.038),Y(.95),.75)+m.plant(X(.9),Y(.96),.68)+m.plant(X(.935),Y(.96),.48);
 return '<g data-r14-chart>'+s+'</g>';
 }
 function hud(w,h){const tx=w*.09,ty=h*.88;let s='<g data-chart-hud>';s+=`<g data-map-tube transform="translate(${tx} ${ty}) rotate(-5)">${F([[-43,-13],[43,-13],[43,13],[-43,13]])}${L([[-43,-13],[43,-13],[43,13],[-43,13]],1.1)}${m.E(-43,0,6,13,1.1)}${m.E(43,0,6,13,1.1)}${m.E(43,0,3.5,9,.65,M)}${L([[-29,-12],[-29,12]],1)}${L([[27,-12],[27,12]],1)}</g>`;s+=a.insetAsset('compass-rose-r10',w-123,h-132,112,112);return s+'</g>';}
 function ship(size=43){let s=L([[2,35],[10,41],[36,41],[44,35],[2,35]],1.4)+L([[24,3],[24,34]],1.2)+L([[21,6],[7,31],[21,31],[21,6]],1.1)+L([[27,12],[38,31],[27,31],[27,12]],1.1)+L([[5,45],[24,44],[42,45]],.7,M);return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${s}</svg>`;}
 return{scene,ship,hud};}
