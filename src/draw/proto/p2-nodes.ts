// 第 4a 期：phase2.js 交给页面模块的几样字符串小工具（svg、glyph、initial、stateMark）的节点版，项目、复盘、知识库、大脑页共用。
// 几何与字符串版相同：画笔用 phase2 api 的描述版（inkV 先按 6 个单位加密取样，与字符串版 ink 一样；circleV 与 core.circle 一样），建成节点。
// 按钮（phase2 的 button）的节点版是 paper-tasks.ts 的 buttonEl（属性先后：type、data-p2、data-id、aria-label，再是 attrs）。
import {h,svg} from '../dom.ts';
import {iconEl} from '../ink.ts';
import type {Point} from '../ink.ts';
import {parts,partNodes} from '../scene.ts';
import type {Parts} from '../scene.ts';
import type {ProtoApi} from './paper-tasks.ts';

/** 画小图要的两支描述版画笔 */
export type P2Pens=Pick<ProtoApi,'inkV'|'circleV'>;

/** phase2 的 svg(s,w,h)：<svg viewBox="0 0 w h" aria-hidden="true">（不写宽高） */
export const svgP=(k: Parts,w=20,hh=w): SVGSVGElement=>svg('svg',{viewBox:`0 0 ${w} ${hh}`,'aria-hidden':'true'},partNodes(parts(k)));

// phase2 的 glyph 自己画的几种（每笔 [点, 粗细]，粗细默认 1.4）；其余交给 icon
const LINES: Record<string,Point[][]>={
 ship:[[[2,14],[8,19],[24,19],[30,14],[2,14]],[[15,2],[15,14]],[[14,3],[5,12],[14,12]],[[17,5],[25,12],[17,12]]],
 goal:[[[10,1],[13,7],[19,10],[13,13],[10,19],[7,13],[1,10],[7,7],[10,1]]],
 lines:[[[2,4],[18,4]],[[2,10],[18,10]],[[2,16],[18,16]]],
 corner:[[[2,2],[18,2],[18,18],[12,12],[18,12]]],
 bookmark:[[[5,2],[15,2],[15,18],[10,14],[5,18],[5,2]]],
 archive:[[[3,3],[17,3],[18,16],[2,16],[3,3]],[[5,6],[15,6]],[[8,10],[12,10]]],
 left:[[[14,3],[6,10],[14,17]]],
 right:[[[6,3],[14,10],[6,17]]]};
/** phase2 的 glyph(type,size) 的节点版 */
export function glyphEl(a: P2Pens,type: string,size=20): SVGSVGElement{
 if(type==='anchor')return svgP([a.circleV(10,3,2,1.3),a.inkV([[10,5],[10,18],[4,14],[2,10]],1.4),a.inkV([[10,18],[16,14],[18,10]],1.4),a.inkV([[5,8],[15,8]],1.4)]);
 if(type==='person')return svgP(a.circleV(10,10,8,1.3));
 const L=LINES[type];if(!L)return iconEl(type,size);
 return svgP(L.map(p=>a.inkV(p,1.4)),type==='ship'?32:20,type==='ship'?22:20);
}
/** phase2 的 initial(p)：人名首字的圆圈 */
export function initialEl(a: P2Pens,p: {initial: string}): HTMLSpanElement{return h('span',{class:'person-initial'},svgP(a.circleV(14,14,12,1.2),28),h('span',null,p.initial));}
/** phase2 的 stateMark(state) */
export function stateMarkEl(a: P2Pens,state: string|null): SVGSVGElement{return state==='done'?iconEl('check'):state==='in_progress'?svgP([a.circleV(10,10,6.5,1.2),a.inkV([[10,6],[10,14]],1.6)]):state===null?svgP([]):iconEl('circle');}
