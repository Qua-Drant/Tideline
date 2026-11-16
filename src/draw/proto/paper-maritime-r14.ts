// Shared objects, drawn in paper coordinates. No image or network dependencies.
// 第 3b 期：几何与输出分开。塔、房子、礁石、水草、云、椭圆的几何是一列笔画（op：填纸的多边形，或一笔 L / C 线），
// 字符串版（页面模板还在用：复盘页的小画、项目页的卷筒）与描述版（…V，风景用，见 scene.ts）都从同一列 op 出，字符串版与原来逐字相同。
// 第 3b2 期：云的字符串版只有已删的旧版海图（r14）用，删去，只留描述版。
// 远岸、完成态的海景、灯塔光束、海鸟只在风景里用，只有描述版。
import type {Point} from '../ink.ts';
import type {Attrs} from '../dom.ts';
import {sh, parts} from '../scene.ts';
import type {Shape, Part, Parts} from '../scene.ts';

/** 字符串画笔（ink.ts 的 ink 或在它前面补点的版本）：点、粗细、颜色、原样拼进 path 的属性 */
export type Pen = (points: Point[], size?: number, color?: string, attrs?: string) => string;
/** 描述画笔（ink.ts 的 inkV 或在它前面补点的版本） */
export type PenV = (points: Point[], size?: number, color?: string, attrs?: Attrs | null) => Shape | null;
/** 画笔：ink 是直线笔（L），curve 是曲线笔（C，没有时用 ink）；…V 是对应的描述版；drawV 是带 data-draw-path 的笔（完成态海景用，没有时用 inkV） */
export interface MaritimePens {
  ink?: Pen; curve?: Pen;
  inkV?: PenV; curveV?: PenV; drawV?: PenV;
}
type Op = readonly ['F', Point[]] | readonly ['L' | 'C', Point[], number, string?];

const P = '#F4F5F2', I = '#1C2A35', M = '#687B83', T = '#B4C2C6';
const fillD = (p: Point[]) => `M${p.map(q => q.join(',')).join('L')}Z`;
const TOWER: Op[] = [['F', [[-9, 0], [-6, -53], [6, -53], [10, 0]]], ['L', [[-9, 0], [-6, -53]], 1.35], ['L', [[6, -53], [10, 0]], 1.35], ['L', [[-11, -69], [0, -80], [11, -69], [-11, -69]], 1.1],
  ['L', [[-7, -69], [-7, -56], [7, -56], [7, -69]], 1.05], ['L', [[0, -69], [0, -56]], .7], ['L', [[-12, -53], [12, -53]], 1.15], ['L', [[-12, -57], [-12, -53]], .8], ['L', [[12, -57], [12, -53]], .8], ['L', [[0, -80], [0, -88]], .9],
  ['L', [[-3, -17], [-3, -1], [3, -1], [3, -17], [-3, -17]], .8], ['L', [[-2, -42], [-2, -35], [2, -35], [2, -42], [-2, -42]], .65], ['L', [[-6, -25], [7, -25]], .45, M], ['L', [[-3, -47], [1, -47]], .4, T]];
const HOUSE: Op[] = [['F', [[0, 0], [0, -15], [15, -26], [31, -15], [31, 0]]], ['L', [[0, 0], [0, -15], [15, -26], [31, -15], [31, 0]], 1], ['L', [[-3, -15], [15, -28], [34, -15]], 1.1], ['L', [[8, -10], [14, -10], [14, 0]], .75],
  ['L', [[21, -10], [26, -10], [26, -5], [21, -5], [21, -10]], .65], ['L', [[22, -22], [22, -31], [26, -31], [26, -19]], .65]];
const ROCK: Op[] = [['C', [[-18, 0], [-12, -8], [-5, -10], [2, -5], [9, -13], [18, -5], [23, 0]], 1], ['L', [[-12, -7], [-7, -3], [1, -2]], .55, M], ['L', [[9, -11], [12, -5], [19, -2]], .55, M]];
const PLANT: Op[] = [['C', [[0, 0], [-1, -15], [1, -32], [0, -49]], .9]];
for (const [xx, yy, side] of [[0, -9, -1], [0, -17, 1], [0, -26, -1], [0, -35, 1], [-.5, -42, -1]]) PLANT.push(['C', [[xx, yy], [xx + side * 8, yy - 4], [xx + side * 9, yy - 10], [xx + side * 3, yy - 7], [xx, yy]], .65, M]);
const CLOUD_TOP: Point[] = [[0, 8], [11, 7], [15, 1], [22, 2], [26, -8], [37, -11], [45, -6], [51, -9], [61, -5], [64, 1], [73, 0], [80, 6], [93, 8]];
const cloudOps = (col: string): Op[] => [['C', CLOUD_TOP, .8, col], ['C', [[5, 12], [28, 11], [46, 13], [68, 11], [92, 12]], .6, col], ['C', [[22, 6], [29, 3], [36, 5]], .5, col], ['C', [[53, 4], [58, 1], [64, 4]], .5, col]];
const ellipsePoints = (x: number, y: number, rx: number, ry: number): Point[] => Array.from({length: 49}, (_, i): Point => [x + Math.cos(i * Math.PI / 24) * rx, y + Math.sin(i * Math.PI / 24) * ry]);

export function maritimeArt(a: MaritimePens){
 // 字符串版与描述版的画笔都只在用到时取：只画字符串的使用者不必给描述版画笔，反之亦然
 const L: Pen = (...x) => (a.ink ?? missing('ink'))(...x), C: Pen = (...x) => (a.curve || a.ink || missing('ink'))(...x);
 const LV: PenV = (...x) => (a.inkV ?? missing('inkV'))(...x), CV: PenV = (...x) => (a.curveV ?? a.inkV ?? missing('inkV'))(...x);
 const str = (ops: Op[]) => { let s = ''; for (const op of ops) s += op[0] === 'F' ? `<path d="${fillD(op[1])}" fill="${P}"/>` : (op[0] === 'L' ? L : C)(op[1], op[2], op[3]); return s; };
 const shapes = (ops: Op[]): Parts[] => ops.map(op => op[0] === 'F' ? sh('path', {d: fillD(op[1]), fill: P}) : (op[0] === 'L' ? LV : CV)(op[1], op[2], op[3]));
 const at = (x: number, y: number, k: number) => `translate(${x} ${y}) scale(${k})`;
 const F = (p: Point[]) => sh('path', {d: fillD(p), fill: P});
 // —— 字符串版与描述版共用一列 op ——
 const E = (x: number, y: number, rx: number, ry: number, size = 1, col = I) => C(ellipsePoints(x, y, rx, ry), size, col);
 const EV = (x: number, y: number, rx: number, ry: number, size = 1, col = I) => CV(ellipsePoints(x, y, rx, ry), size, col);
 const cloudV = (x: number, y: number, k = 1, col = T) => sh('g', {transform: at(x, y, k)}, shapes(cloudOps(col)));
 const tower = (x: number, y: number, k = 1) => `<g transform="${at(x, y, k)}">${str(TOWER)}</g>`;
 const towerV = (x: number, y: number, k = 1) => sh('g', {transform: at(x, y, k)}, shapes(TOWER));
 const house = (x: number, y: number, k = 1) => `<g transform="${at(x, y, k)}">${str(HOUSE)}</g>`;
 const houseV = (x: number, y: number, k = 1) => sh('g', {transform: at(x, y, k)}, shapes(HOUSE));
 const rock = (x: number, y: number, k = 1) => `<g transform="${at(x, y, k)}">${str(ROCK)}</g>`;
 const rockV = (x: number, y: number, k = 1) => sh('g', {transform: at(x, y, k)}, shapes(ROCK));
 const plant = (x: number, y: number, k = 1) => `<g transform="${at(x, y, k)}">${str(PLANT)}</g>`;
 const plantV = (x: number, y: number, k = 1) => sh('g', {transform: at(x, y, k)}, shapes(PLANT));
 // —— 只在风景里用（描述版） ——
 function birdV(x: number, y: number, k = 1){return sh('g', {'data-seabird': true, transform: `translate(${x} ${y - 3}) scale(${k})`},
  CV([[0, 17], [9, 14], [16, 11], [20, 6], [23, 2], [28, 2], [32, 5], [33, 8], [41, 9], [34, 13], [31, 13], [29, 19], [23, 24], [14, 24], [6, 21], [0, 17]], 1.2), CV([[7, 17], [16, 14], [24, 16], [18, 20], [9, 19]], .85), LV([[10, 17], [20, 17]], .55, M), LV([[0, 17], [4, 21], [10, 21]], .8), LV([[34, 10], [39, 9]], .8),
  sh('g', {'data-bird-eye': true}, EV(27.7, 8, 1.3, 1.3, 2.4)), LV([[17, 24], [16, 29], [11, 30]], .95), LV([[16, 29], [20, 30]], .85), LV([[23, 23], [23, 28], [28, 29]], .95), LV([[23, 28], [20, 29]], .85), CV([[12, 21], [18, 22], [23, 21]], .55, M));}
 function leftCoastV(w: number, y: number){const rw = Math.min(245, w * .21), X = (v: number) => v * rw, s: Parts[] = [];
  s.push(F([[0, y - 18], [X(.1), y - 23], [X(.25), y - 13], [X(.4), y - 17], [X(.57), y - 7], [X(.7), y - 8], [rw, y], [0, y]]), CV([[0, y - 18], [X(.1), y - 23], [X(.25), y - 13], [X(.4), y - 17], [X(.57), y - 7], [X(.7), y - 8], [rw, y]], 1.35));
  s.push(towerV(X(.12), y - 20, .48), houseV(X(.28), y - 12, .58), houseV(X(.44), y - 12, .44), plantV(X(.035), y - 20, .36), plantV(X(.53), y - 8, .25));
  for (const [x, dy, k] of [[.03, -6, .55], [.19, -5, .6], [.4, -3, .44], [.64, -1, .45], [.77, 1, .3]]) s.push(rockV(X(x), y + dy, k));
  for (const p of [[[.03, -14], [.08, -10], [.2, -7]], [[.26, -10], [.32, -6], [.4, -4]], [[.48, -10], [.53, -5], [.58, -3]], [[.65, -5], [.7, -2], [.76, -1]]]) s.push(CV(p.map(([x, dy]): Point => [X(x), y + dy]), .6, M));
  s.push(LV([[X(.61), y - 2], [X(.82), y - 2]], 1.25), LV([[X(.64), y - 7], [X(.64), y + 2]], .9), LV([[X(.73), y - 6], [X(.73), y + 2]], .9), LV([[X(.81), y - 5], [X(.81), y + 2]], .85));
  for (let i = 0; i < 7; i++) { const xx = X(.08 + i * .085), yy = y + 5 + i % 3 * 4; s.push(CV([[xx, yy], [xx + 12, yy - .4], [xx + 25, yy]], .55, T)); }
  return sh('g', {'data-today-left-coast': true, 'data-r14-coast': true}, s);}
 function completedV(w: number, y: number){const DV: PenV = (...x) => (a.drawV ?? a.inkV ?? missing('inkV'))(...x), R = (p: Point[], size = 1, c = I) => DV(p.map(([x, dy]): Point => [x * w, y + dy]), size, c), s: Parts[] = [];
  const ridge: Point[] = [[.57, 0], [.6, -4], [.627, -16], [.653, -13], [.679, -3], [.708, 0], [.73, -13], [.754, -32], [.772, -38], [.79, -66], [.808, -73], [.832, -68], [.85, -54], [.872, -38], [.896, -25], [.925, -18], [.95, -7], [.977, 0], [1, 0]]; s.push(F(ridge.map(([x, dy]): Point => [x * w, y + dy])), R(ridge, 1.7));
  for (const p of [[[.728, -9], [.747, -15], [.758, -25], [.767, -26]], [[.757, -12], [.774, -24], [.78, -40], [.79, -48]], [[.787, -60], [.793, -40], [.805, -34], [.814, -16]], [[.811, -62], [.821, -47], [.84, -41], [.85, -22]], [[.84, -49], [.855, -36], [.875, -26]], [[.875, -17], [.892, -11], [.92, -8]], [[.766, -4], [.781, -9], [.794, -6]], [[.819, -10], [.84, -14], [.861, -8]]] as Point[][]) s.push(R(p, .7, M));
  s.push(towerV(w * .808, y - 71, .8), houseV(w * .842, y - 47, .64), houseV(w * .869, y - 31, .46));
  for (const [x, dy, k] of [[.723, -2, .7], [.744, -3, .5], [.902, -4, .6], [.955, 0, .5]]) s.push(rockV(w * x, y + dy, k));
  s.push(plantV(w * .875, y - 32, .42), plantV(w * .893, y - 22, .34));
  const sunX = w * .693, sunY = y - 168; s.push(DV(Array.from({length: 49}, (_, i): Point => [sunX + Math.cos(i * Math.PI / 24) * 26, sunY + Math.sin(i * Math.PI / 24) * 26]), 1.3, I));
  const birds: Parts[] = []; for (const [x, dy, k] of [[.63, -103, 1], [.68, -131, .7], [.93, -104, .72]]) birds.push(DV([[x * w - 14 * k, y + dy], [x * w - 6 * k, y + dy - 4 * k], [x * w, y + dy], [x * w + 7 * k, y + dy - 4 * k], [x * w + 15 * k, y + dy]], 1, M));
  const water: Parts[] = []; for (let i = 0; i < 15; i++) { const xx = w * .807 + Math.sin(i * 1.91) * 10, yy = y + 6 + i * 3.1, half = 12 + i * 2.1; water.push(DV([[xx - half, yy], [xx, yy - .5], [xx + half * .8, yy]], i % 4 ? .65 : 1.05, M, {opacity: '.55'})); }
  s.push(sh('g', {'data-reward-motion': 'cloud'}, cloudV(w * .57, y - 192, .96), cloudV(w * .88, y - 170, .8)), sh('g', {'data-reward-motion': 'birds'}, birds), sh('g', {'data-reward-motion': 'water'}, water));
  return sh('g', {'data-ink-art': 'completed-sea', 'data-reward-scene': true, 'data-r14-completed': true}, s);
 }
 function beamV(x: number, y: number, w: number, night: boolean): Part[]{const defs: Parts[] = [], paths: Parts[] = [];
  for (const side of [-1, 1]) { const end = side < 0 ? x - Math.min(440, w * .4) : w + 34; defs.push(sh('linearGradient', {id: `r15-lens-${side}`, gradientUnits: 'userSpaceOnUse', x1: x, y1: y, x2: end, y2: y + 40},
   sh('stop', {offset: '0', 'stop-color': '#FFF4C9', 'stop-opacity': night ? .75 : .65}), sh('stop', {offset: '.3', 'stop-color': '#FFF5D4', 'stop-opacity': night ? .31 : .3}), sh('stop', {offset: '1', 'stop-color': '#FFF9E8', 'stop-opacity': '0'}))); }
  for (const side of [-1, 1]) { const end = side < 0 ? x - Math.min(440, w * .4) : w + 34; paths.push(sh('path', {'data-lens-beam': true, 'data-beam-side': side, d: `M${x},${y - 2} L${end},${y + 12} Q${end + side * 8},${y + 39} ${end},${y + 70} L${x},${y + 3}Z`, fill: `url(#r15-lens-${side})`})); }
  return parts(sh('defs', null, defs), paths);}
 return {tower, house, rock, plant, E, cloudV, towerV, houseV, rockV, plantV, birdV, leftCoastV, completedV, beamV};
}
function missing(name: string): never { throw new Error('maritimeArt：画风景要给描述版画笔 ' + name); }
