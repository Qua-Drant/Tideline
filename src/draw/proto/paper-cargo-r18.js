// R18: the hold is redrawn in code. Only the inbox pile is still in use (R23 draws the rest of the hold);
// it shares R16's vocabulary (plank crates, twisted rope).
export function cargoR18(a,r16){
 const {ink:L,INK:I,PAPER:P}=a;
 const F=(p,c=P)=>`<path d="M${p.map(q=>q.map(v=>+v.toFixed(2)).join(',')).join('L')}Z" fill="${c}"/>`;
 // Inbox pile in the 175 × 142 box: front crates hide the ladder foot (x≈21–83 of the page), the tag hangs on the right crate.
 function loose(n){const k=r16.plankCrate;let s='<g data-cargo-stacked-crates>';s+=k(84,90,64,46,14)+k(2,82,66,54,15)+k(8,44,50,38,14)+`<g transform="rotate(-5 40 50)">${k(14,14,38,30,11)}</g>`+k(60,110,34,26,9);
 const tag=[[96,100],[156,97],[158,134],[98,137]];s+=r16.twisted([[118,90],[112,96],[104,101]],.7,4)+F(tag)+L([...tag,tag[0]],1.1,I)+a.circle(102,105,1.3,.7);s+=`<text x="128" y="116" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--sans)">收件箱</text><text x="128" y="131" font-size="13.5" text-anchor="middle" fill="${I}" style="font-family:var(--mono)">${n}</text></g>`;return s;}
 return{loose};
}
