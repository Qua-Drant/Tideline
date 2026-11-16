// R21: the selected voyage is the one thing drawn in magenta.
// 第 3b2 期：R21 的海图风景（scene、hud 及其岛屿、水深、界线、水草）与它包着的 R14 海图都已被 R22 / R23 取代，删去；只留船、站点、旗。
export const NOW='#C8206A';
export function chartArtR21(a){
 const L=a.ink,I=a.INK,M=a.SECONDARY;
 // Sailboat; the selected voyage carries magenta sails.
 function ship(size=43,now=false){const c=now?NOW:I,hull=[[2,35],[10,41],[36,41],[44,35],[2,35]],s1=[[21,6],[7,31],[21,31],[21,6]],s2=[[27,12],[38,31],[27,31],[27,12]];
 let s=(now?`<path d="M${s1.join('L')}Z" fill="${NOW}" opacity=".85"/><path d="M${s2.join('L')}Z" fill="${NOW}" opacity=".6"/><path d="M${hull.join('L')}Z" fill="${NOW}" opacity=".9"/>`:'')+L(hull,1.4,c)+L([[24,3],[24,34]],1.2,c)+L(s1,1.1,c)+L(s2,1.1,c)+L([[5,45],[24,44],[42,45]],.7,M);
 if(now)s+=L([[24,3],[31,5],[24,8]],1,NOW);return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${s}</svg>`;}
 function dot(state,now){const c=now?NOW:I;return `<svg viewBox="0 0 14 14" aria-hidden="true">${state==='done'?`<circle cx="7" cy="7" r="4.2" fill="${c}"/>`:state==='in_progress'?a.circle(7,7,4.6,1.5,c)+`<circle cx="7" cy="7" r="1.8" fill="${c}"/>`:a.circle(7,7,4,1.1,now?NOW:M)}</svg>`;}
 function flag(now){const c=now?NOW:I;return `<svg viewBox="0 0 16 22" aria-hidden="true">${L([[3,21],[3,2]],1.3,I)}<path d="M3.5 2.5L14 6L3.5 9.5Z" fill="${c}" opacity="${now?.9:.15}"/>${L([[3.5,2.5],[14,6],[3.5,9.5]],1,c)}</svg>`;}
 return{ship,dot,flag};
}
