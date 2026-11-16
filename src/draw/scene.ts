// 风景（#scenery）的描述：先描述、再按需建节点。
// 风景每次重画都会重新算一遍（版式、遮罩、时刻都可能变了），但多数时候算出来和上次一模一样；原来比较整段 SVG 字符串决定要不要重新解析，
// 现在比较两份描述（sameParts），一样就复用上次建好的节点（view.ts 的 showScene），不一样才建新的（buildParts）。
// 描述与 document 无关、建好后不再改动：可以缓存、可以在别的窗口（弹出窗口）的 document 里重建，也可以原样比较。
// 描述的结构与 SVG 一一对应：sh('g', {transform: …}, …子项)。子项是描述或文字（文字成为文本节点，不解析）；
// 数字转成文字；null / undefined / false / '' 跳过；数组（可嵌套）展开；相邻的文字并成一段（和解析器的结果一样）。
// 属性值的写法与 dom.ts 相同：字符串、数字照写；true 写成空值属性；false / null / undefined 不写；属性按写的先后顺序写上。
import {svg, frag, within} from './dom.ts';
import type {Attrs, Child} from './dom.ts';

/** 一个 SVG 元素的描述：标签、属性、子项（已展开：只有描述和文字） */
export interface Shape {
  readonly t: keyof SVGElementTagNameMap;
  readonly a: Attrs | null;
  readonly k: readonly Part[];
}
/** 展开后的一项：元素的描述，或一段文字 */
export type Part = Shape | string;
/** 构建时可以写的子项 */
export type Parts = Part | number | null | undefined | false | readonly Parts[];

function flat(out: Part[], c: Parts): void {
  if (c === null || c === undefined || c === false || c === '') return;
  if (typeof c === 'number') c = String(c);
  if (typeof c === 'string') {
    const n = out.length, last = n ? out[n - 1] : null;
    if (typeof last === 'string') out[n - 1] = last + c; else out.push(c);
    return;
  }
  if (Array.isArray(c)) { for (const x of c as readonly Parts[]) flat(out, x); return; }
  out.push(c as Shape);
}

/** 一个元素的描述：sh('path', {d, fill}) */
export function sh(t: keyof SVGElementTagNameMap, a?: Attrs | null, ...k: Parts[]): Shape {
  const kids: Part[] = [];
  for (let i = 0; i < k.length; i++) flat(kids, k[i]);
  return {t, a: a ?? null, k: kids};
}

/** 并列的几项（展开成一列） */
export function parts(...k: Parts[]): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < k.length; i++) flat(out, k[i]);
  return out;
}

// 属性值相同：同一个值；或两个数字写成文字后相同（NaN、-0 与原来比较字符串时的结果一致）
const sameValue = (x: unknown, y: unknown): boolean => x === y || (typeof x === 'number' && typeof y === 'number' && String(x) === String(y));
function sameAttrs(a: Attrs | null, b: Attrs | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) { const k = ka[i]; if (k !== kb[i] || !sameValue(a[k], b[k])) return false; }
  return true;
}

/** 两份描述是否一样（标签、属性及其先后、文字、子项顺序都一样）：一样时建出来的节点也一样 */
export function sameParts(a: readonly Part[], b: readonly Part[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (typeof x === 'string' || typeof y === 'string') return false;
    if (x.t !== y.t || !sameAttrs(x.a, y.a) || !sameParts(x.k, y.k)) return false;
  }
  return true;
}

function child(p: Part): Child { return typeof p === 'string' ? p : svg(p.t, p.a, p.k.map(child)); }

/** 按描述在 doc 里建节点（放在一个文档片段里） */
export function buildParts(list: readonly Part[], doc: Document): DocumentFragment {
  return within(doc, () => frag(list.map(child)));
}
