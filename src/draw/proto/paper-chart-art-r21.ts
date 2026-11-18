// R21: the selected voyage is the one thing drawn in magenta.
// 第 3b2 期：R21 的海图风景（scene、hud 及其岛屿、水深、界线、水草）与它包着的 R14 海图都已被 R22 / R23 取代，删去；只留船、站点、旗。
// 第 4a 期：转 TypeScript。船、站点、旗只有项目页用，项目页改成节点构建后字符串版没有调用方，改成节点版（几何相同：直线笔是 phase2 的 inkV，
// 与原来的字符串画笔 ink 一样先加密取样；圆是 circleV）。
import {svg} from '../dom.ts';
import type {Point} from '../ink.ts';
import {parts,partNodes} from '../scene.ts';
import type {Parts,Shape} from '../scene.ts';
import type {ProtoApi} from './paper-tasks.ts';
export const NOW='#C8206A';
/** 海图各模块用到的 api（phase2.js 的 api 的一部分） */
export type ChartApi=Pick<ProtoApi,'inkV'|'curveV'|'circleV'|'dashV'|'INK'|'SECONDARY'|'TICK'|'PAPER'>;
const nodes=(k: Parts)=>partNodes(parts(k));
export function chartArtR21(a: ChartApi){
 const L=(p: Point[],size: number,color: string): Shape|null=>a.inkV(p,size,color),I=a.INK,M=a.SECONDARY;
 // Sailboat; the selected voyage carries magenta sails.
 function shipEl(size=43,now=false){const c=now?NOW:I,hull: Point[]=[[2,35],[10,41],[36,41],[44,35],[2,35]],s1: Point[]=[[21,6],[7,31],[21,31],[21,6]],s2: Point[]=[[27,12],[38,31],[27,31],[27,12]];
 return svg('svg',{viewBox:'0 0 48 48',width:size,height:size,'aria-hidden':'true'},now&&[svg('path',{d:`M${s1.join('L')}Z`,fill:NOW,opacity:'.85'}),svg('path',{d:`M${s2.join('L')}Z`,fill:NOW,opacity:'.6'}),svg('path',{d:`M${hull.join('L')}Z`,fill:NOW,opacity:'.9'})],
  nodes([L(hull,1.4,c),L([[24,3],[24,34]],1.2,c),L(s1,1.1,c),L(s2,1.1,c),L([[5,45],[24,44],[42,45]],.7,M),now&&L([[24,3],[31,5],[24,8]],1,NOW)]));}
 function dotEl(state: string,now: boolean){const c=now?NOW:I;return svg('svg',{viewBox:'0 0 14 14','aria-hidden':'true'},state==='done'?svg('circle',{cx:'7',cy:'7',r:'4.2',fill:c}):state==='in_progress'?[nodes(a.circleV(7,7,4.6,1.5,c)),svg('circle',{cx:'7',cy:'7',r:'1.8',fill:c})]:nodes(a.circleV(7,7,4,1.1,now?NOW:M)));}
 function flagEl(now: boolean){const c=now?NOW:I;return svg('svg',{viewBox:'0 0 16 22','aria-hidden':'true'},nodes(L([[3,21],[3,2]],1.3,I)),svg('path',{d:'M3.5 2.5L14 6L3.5 9.5Z',fill:c,opacity:`${now?.9:.15}`}),nodes(L([[3.5,2.5],[14,6],[3.5,9.5]],1,c)));}
 return{shipEl,dotEl,flagEl};
}
