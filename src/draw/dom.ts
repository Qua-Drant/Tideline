// DOM 构建：界面结构由代码直接建成节点，不再拼 HTML 字符串、不再解析。
// 本模块只用 createElement / createElementNS / createTextNode / setAttribute / appendChild / replaceChildren 等 DOM 方法，
// 不做任何“字符串 → HTML”的解析：文本一律成为文本节点（不解析，所以不需要也不能再 esc()），属性一律 setAttribute。
//
// 写法（一个模板字符串对应一个返回节点的函数，结构与原模板一一对应）：
//   h('button', {class: 'small-check', 'data-complete': id, 'aria-label': '完成：' + title}, iconEl('circle'))
//   svg('svg', {viewBox: '0 0 20 20', width: 20, height: 20, 'aria-hidden': 'true'}, inkEl(points))
// 子节点：节点、字符串（成为文本节点；与前一个文本节点相邻时并进去，和解析器的结果一样）、数字（转成字符串）；
// null / undefined / false / true / '' 跳过（便于写 cond && h(...)，注意 0 会被写成“0”）；数组（可嵌套）展开。
// 属性值：字符串、数字照写；true 写成空值属性（hidden、disabled、data-popup-frame 这类）；false / null / undefined 不写。
// aria-* 的值只收字符串或数字（"true" / "false" 要写成字符串，不能用布尔，否则 false 会被当成“不写”）；on* 属性不收（不写内联事件）。
//
// 元素属于哪个 document：写入函数（setNodes / insertNodes / replaceWithNodes）在构建期间把“当前 document”设成目标容器的 ownerDocument
// （弹出窗口里的视图因此建在自己窗口的 document 里）；不在写入函数里构建时（例如预先建好、之后克隆的模板），用 within(doc, …) 指定，
// 都没有时用 Obsidian 的 activeDocument（测试工具和 Node 里没有它，退回全局 document）。
// 构建都是同步的（JS 单线程），嵌套的写入函数会先存后还原外层的 document。

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 属性值：字符串、数字照写；true 写空值；false / null / undefined 不写 */
export type AttrValue = string | number | boolean | null | undefined;
/** 属性表（名字照原模板里写的，大小写敏感：SVG 的 viewBox、preserveAspectRatio、maskUnits 等照原样） */
export interface Attrs {
  [name: string]: AttrValue;
  /** aria-* 只收字符串或数字 */
  [aria: `aria-${string}`]: string | number | null | undefined;
  /** 不写内联事件属性 */
  [handler: `on${string}`]: never;
}
/** 子节点 */
export type Child = Node | string | number | boolean | null | undefined | readonly Child[];

let scope: Document | null = null;
// 不在写入函数里构建时的 document：Obsidian 里是当前活动窗口的 document；测试工具（普通浏览器）里没有 activeDocument
function fallbackDoc(): Document {
  return typeof activeDocument === 'undefined' ? window.document : activeDocument;
}
const docNow = (): Document => scope ?? fallbackDoc();

/** 把属性表写到已有元素上（规则与 h / svg 相同） */
export function setAttrs(el: Element, attrs: Attrs): void {
  for (const name in attrs) {
    const v = attrs[name];
    if (v === null || v === undefined || v === false) continue;
    // on*：类型上已经不收；运行时再挡一次（两次字符比较，不分配）
    if (name.charCodeAt(0) === 111 && name.charCodeAt(1) === 110) throw new Error('dom.ts 不写内联事件属性：' + name);
    el.setAttribute(name, v === true ? '' : typeof v === 'string' ? v : String(v));
  }
}

function add(parent: Node, c: Child, doc: Document): void {
  if (c === null || c === undefined || c === false || c === true || c === '') return;
  if (typeof c === 'string' || typeof c === 'number') {
    const s = typeof c === 'string' ? c : String(c), last = parent.lastChild;
    // 相邻的两段文字并成一个文本节点（解析器也是这样）；只发生在本模块刚建的父节点里
    if (last !== null && last.nodeType === 3) (last as Text).appendData(s);
    else parent.appendChild(doc.createTextNode(s));
    return;
  }
  if (Array.isArray(c)) { for (const x of c as readonly Child[]) add(parent, x, doc); return; }
  parent.appendChild(c as Node);
}

/** HTML 元素：h('div', {class: 'x'}, …子节点)。返回具体的元素类型（HTMLDivElement、HTMLButtonElement……） */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const doc = docNow(), el = doc.createElement(tag);
  if (attrs) setAttrs(el, attrs);
  for (let i = 0; i < children.length; i++) add(el, children[i], doc);
  return el;
}

/** SVG 元素（SVG 命名空间）：svg('path', {d, fill}) */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const doc = docNow(), el = doc.createElementNS(SVG_NS, tag);
  if (attrs) setAttrs(el, attrs);
  for (let i = 0; i < children.length; i++) add(el, children[i], doc);
  return el;
}

/** 文档片段：把几个并列的节点当成一个子节点传递 */
export function frag(...children: Child[]): DocumentFragment {
  const doc = docNow(), f = doc.createDocumentFragment();
  for (let i = 0; i < children.length; i++) add(f, children[i], doc);
  return f;
}

/** 在指定 document 里构建（预先建好、之后克隆的模板用） */
export function within<T>(doc: Document, build: () => T): T {
  const outer = scope; scope = doc;
  try { return build(); } finally { scope = outer; }
}

// 在目标的 document 里构建，得到一个片段
function build(target: Node, make: () => Child): DocumentFragment {
  const doc = target.ownerDocument ?? fallbackDoc(), outer = scope; scope = doc;
  try { const f = doc.createDocumentFragment(); add(f, make(), doc); return f; } finally { scope = outer; }
}

/** 换掉 el 的全部子节点。make 返回要放进去的内容；返回 '' / null 等于清空 */
export function setNodes(el: Element, make: () => Child): void {
  el.replaceChildren(build(el, make));
}

/** 插到 el 的旁边或里面：beforebegin / afterbegin / beforeend / afterend */
export function insertNodes(el: Element, position: InsertPosition, make: () => Child): void {
  const f = build(el, make);
  switch (position) {
    case 'beforebegin': el.before(f); break;
    case 'afterbegin': el.prepend(f); break;
    case 'beforeend': el.append(f); break;
    case 'afterend': el.after(f); break;
  }
}

/** 用新内容换掉 el 自己（el 必须有父节点） */
export function replaceWithNodes(el: Element, make: () => Child): void {
  el.replaceWith(build(el, make));
}
