// 页内滚动区的“还有下文”（原型 R34：paper-scroll-r34.js）。
// 还没滚到底的滚动区：跨过栏底的那一行整行收掉（--r34-cut + 渐隐只盖行间 8px），下边缘外写“还有 N 项 ▽”。
// 和原型的区别：原型挂在整页的 MutationObserver 上；这里由视图在每次渲染后、以及滚动时调用，坐标相对插件根元素。
// 0.3（使用者 2026-11-08）：插件里不显示系统滚动条，改用手绘小三角提示可滚动——
//   下面还有：三角朝下（列表在栏外写“还有 N 项”，其余滚动区画在下边缘里）；上面还有：三角朝上，画在上边缘里。
//   点三角滚动大半屏。设置、首次起航、纸条等浮层里的滚动区也画（不写条数）；窄视图里整张纸滚动时同样提示。
// 第 3c 期：DOM 构建（draw/dom.ts），不再拼 HTML 字符串；元素建在插件根元素所在的 document 里。
import {walkVisible} from './visible.ts';
import {inkEl} from '../draw/ink.ts';
import type {Point} from '../draw/ink.ts';
import {h, svg, within, insertNodes, setNodes} from '../draw/dom.ts';
const SKIP = '#journal,textarea,input,select,[hidden] *';
const ITEM = ':is(li,.cargo-row,.cargo-group,.plan-task,.day-event,.task-row,.log-year,.log-page-head,.investment,.other-task-items>div,#trail>div)';
const COUNT = ':is(li,.cargo-row,.plan-task,.day-event,.task-row,.log-year,.investment,.other-task-items>div,#trail>div)';
// 浮层里的滚动区（不在 #sheet > section.page 里，或是叠在页面上的纸条）
const OVERLAY = '.settings-view .set-column, .onboarding .ob-page, #search-results, .global-search, .ai-list-panel, .hand-popup, .task-option-items';
const MODAL = '.settings-view, .onboarding';
// 手绘小三角：三条略带抖动的笔压线（inkEl 按参数记下轮廓，同一形状只算一次）
const UP: Point[] = [[2.6, 9.6], [8.1, 2.2], [13.5, 9.4], [2.6, 9.6]], DOWN: Point[] = [[2.6, 2.4], [8, 9.8], [13.4, 2.6], [2.6, 2.4]];
const tri = (up: boolean) => svg('svg', {viewBox: '0 0 16 12', width: 13, height: 10, 'aria-hidden': 'true'}, inkEl(up ? UP : DOWN, 1.15, 'currentColor'));
/** 一处提示：[x, y, 文字, 方向, 滚动区] */
type Mark = [x: number, y: number, text: string, dir: 'up' | 'down', el: HTMLElement];

export function createMore(root: HTMLElement){
  const doc = root.ownerDocument;
  const layer = within(doc, () => h('div', {id: 'r33-more', 'aria-hidden': 'true'})); root.append(layer);
  let list: HTMLElement[] = [], plain: HTMLElement[] = [];
  // 只在渲染后重新找滚动区（滚动时只重量位置）
  let sheet: HTMLElement | null = null; // 窄视图里整张纸也会滚动：标记只画在纸的可见范围里
  const scrolls = (e: Element) => /(auto|scroll)/.test(getComputedStyle(e).overflowY);
  function find(){
    list = []; plain = [];
    const s = root.querySelector<HTMLElement>('#sheet'); sheet = s && getComputedStyle(s).overflowY === 'auto' && s.scrollHeight > s.clientHeight + 1 ? s : null; // 纸真的在滚动时才按纸的可见范围收
    const modal = [...root.querySelectorAll(MODAL)].find(m => m.getClientRects().length);
    for (const e of (modal || root).querySelectorAll<HTMLElement>(OVERLAY)) if (!e.closest('[hidden]') && e.clientHeight >= 40 && scrolls(e)) plain.push(e);
    if (modal) return;
    if (sheet) plain.push(sheet);
    // 只找当前那一页（其余页的 section 是 hidden 的，里面几千个元素不必一个个看）
    const page = [...root.querySelectorAll<HTMLElement>('#sheet > section.page')].find(x => !x.hidden);
    for (const e of page ? page.querySelectorAll<HTMLElement>(':is(div,section,ul,ol,aside,article,main,nav,form)') : []) {
      if (e.closest('[hidden]') || e.matches(SKIP) || e.clientHeight < 80 || plain.includes(e)) continue;
      if (e.scrollHeight - e.clientHeight <= 6 && !e.dataset.r33More && !(e.scrollTop > 0)) continue;
      if (scrolls(e)) list.push(e);
    }
  }
  function cut(e: HTMLElement, top: number, bottom: number){
    let y = Infinity; const take = (t: number) => { if (t > top + 16) y = Math.min(y, t); };
    for (const i of e.querySelectorAll(ITEM)) { const b = i.getBoundingClientRect(); if (b.top > bottom + 2) break; if (b.height && b.height <= 80 && b.top < bottom - 2 && b.bottom > bottom + 2) take(b.top); }
    const range = doc.createRange();
    walkVisible(e, (n: Text) => { range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.top < bottom - 1 && r.bottom > bottom - 8) { const item = n.parentElement!.closest(ITEM), b = item && e.contains(item) ? item.getBoundingClientRect() : null; take(b && b.height <= 80 ? b.top : r.top - 2); } });
    const line = y === Infinity ? bottom : y, items = [...e.querySelectorAll(COUNT)].filter(i => !i.parentElement!.closest(COUNT));
    // 条目按文档顺序从上往下排：二分找第一个在收尾线以下的，后面的都藏着（长清单只量 log n 次）
    let lo = 0, hi = items.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid].getBoundingClientRect().top >= line - 1) hi = mid; else lo = mid + 1; }
    return {line, hidden: items.length - lo};
  }
  let targets: HTMLElement[] = [];
  function paint(){
    const R = root.getBoundingClientRect(), want: Mark[] = [], S = sheet?.getBoundingClientRect(), top = S ? Math.max(R.top, S.top + 18) : R.top, end = S ? Math.min(R.bottom, S.bottom) : R.bottom;
    const inView = (r: DOMRect, e: HTMLElement) => e === sheet || (r.bottom > top && r.top < end);
    for (const e of list) {
      if (!e.isConnected || !e.getClientRects().length) continue;
      const more = e.scrollHeight - e.clientHeight - e.scrollTop > 6, r = e.getBoundingClientRect(), x = Math.round(r.left - R.left + r.width / 2);
      if (e.dataset.r33More !== String(more)) e.dataset.r33More = String(more);
      // 朝上的三角放在上边缘外（和“还有 N 项”放在下边缘外对称），贴着纸顶时才放进边缘里
      if (e.scrollTop > 6 && r.top + 4 > top - 18 && r.top < end) want.push([x, Math.round(r.top - 13 > top ? r.top - R.top - 13 : r.top - R.top + 2), '', 'up', e]);
      if (!more) { e.style.removeProperty('--r34-cut'); continue; }
      const bottom = r.top + e.clientTop + e.clientHeight, c = cut(e, r.top, bottom), px = Math.round(c.line - r.top) + 'px';
      if (e.style.getPropertyValue('--r34-cut') !== px) e.style.setProperty('--r34-cut', px);
      if (inView(r, e)) want.push([x, Math.round(r.bottom + 16 < end ? r.bottom - R.top + 3 : Math.min(r.bottom, end) - R.top - 15), c.hidden > 0 ? `还有 ${c.hidden} 项` : '', 'down', e]);
    }
    for (const e of plain) {
      if (!e.isConnected || !e.getClientRects().length) continue;
      const r = e.getBoundingClientRect(), x = Math.round(r.left - R.left + r.width / 2), bottom = Math.min(r.top + e.clientTop + e.clientHeight, R.bottom);
      if (e.scrollTop > 6) want.push([x, Math.round(Math.max(r.top, R.top) - R.top + 2), '', 'up', e]);
      if (e.scrollHeight - e.clientHeight - e.scrollTop > 6) want.push([x, Math.round(bottom - R.top - 14), '', 'down', e]);
    }
    // 0.9.3：页面的提示不画到盖在纸上的升级纸条上（纸条自己的滚动提示照画）
    const slip = root.querySelector('.upgrade-slip')?.getBoundingClientRect();
    if (slip) for (let i = want.length - 1; i >= 0; i--) { const [x, y, , , e] = want[i], ax = x + R.left, ay = y + R.top + 6; if (!e.closest('.upgrade-slip') && ax > slip.left - 40 && ax < slip.right + 40 && ay > slip.top - 10 && ay < slip.bottom + 10) want.splice(i, 1); }
    while (layer.children.length < want.length) insertNodes(layer, 'beforeend', () => h('i', null, h('span'), h('b')));
    while (layer.children.length > want.length) layer.lastElementChild!.remove();
    targets = want.map(w => w[4]);
    want.forEach(([x, y, t, dir], i) => { const m = layer.children[i] as HTMLElement, v = `translate(calc(${x}px - 50%),${y}px)`;
      if (m.dataset.dir !== dir) { m.dataset.dir = dir; setNodes(m.lastElementChild!, () => tri(dir === 'up')); }
      m.dataset.k = String(i);
      if (m.firstElementChild!.textContent !== t) m.firstElementChild!.textContent = t; if (m.style.transform !== v) m.style.transform = v; });
  }
  // 点三角：朝那个方向滚大半屏（减少动态效果时直接跳）
  layer.addEventListener('pointerdown', e => {
    const m = (e.target as Element).closest<HTMLElement>('i'), el = m && targets[Number(m.dataset.k)]; if (!m || !el) return;
    e.preventDefault(); e.stopPropagation();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'off';
    el.scrollBy({top: (m.dataset.dir === 'up' ? -1 : 1) * Math.max(60, el.clientHeight * .7), behavior: reduce ? 'auto' : 'smooth'});
  });
  return {update(){ find(); paint(); }, paint};
}
