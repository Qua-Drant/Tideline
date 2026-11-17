// 知识库页的“Zotero”按钮（0.7，见 data/zotero.ts）：装了 Zotero Integration 才出现，放在搜索框和“知识库”之间。
// 点了调它的导入命令（只有一条就直接调；几种导出格式就先给一张手绘小纸条选），弹出 Zotero 的选择框；
// 导进来的笔记落在它的导入文件夹里，索引按文件变化自己更新，知识库页随之出现新文献。
// 第 3c 期：转 TypeScript；按钮、图标与小纸条用 DOM 构建（draw/dom.ts），不再插 HTML 字符串。
import {h, svg, insertNodes} from '../draw/dom.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

// 按钮上的“Z”字（16×16）
const glyph = () => svg('svg', {viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true'},
  svg('path', {d: 'M4.2 4.6 C8 4.3 12 4.4 15.6 4.5 L5 15.4 C8.8 15.6 12.4 15.5 15.9 15.3', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));

export function createZoteroUi({view, plugin}: {view: CompassView; plugin: CompassPlugin}){
  const root = view.root;
  let menu = false;
  const info = () => plugin.zotero?.() || null;
  function layout(){
    if (view.page !== 'library') { menu = false; return; }
    const bar = root.querySelector('#library .lib-toolbar'); if (!bar) return;
    const z = info(), show = !!z && (z.installed || z.folders.length);
    let b = bar.querySelector<HTMLElement>('[data-tl="zotero"]');
    if (!show) { b?.remove(); return; }
    if (!b) { const toggle = bar.querySelector('.lib-view-toggle'); if (toggle) insertNodes(toggle, 'beforebegin', () => h('button', {type: 'button', class: 'lib-zotero hand-pill', 'data-tl': 'zotero', 'aria-haspopup': 'menu'}, glyph(), h('span', null, 'Zotero'))); b = bar.querySelector<HTMLElement>('[data-tl="zotero"]'); if (!b) return; }
    const state = !z.enabled ? 'Zotero Integration 没有启用' : !z.folders.length ? '没有找到 Zotero Integration 的导入文件夹' : `从 Zotero 导入文献（导入到 ${z.folders.join('、')}）`;
    b.setAttribute('aria-label', state); b.title = state; b.setAttribute('aria-expanded', String(menu));
    let pop = root.querySelector('#library .lib-zotero-menu');
    if (!menu) { pop?.remove(); return; }
    if (!pop) {
      insertNodes(bar, 'beforeend', () => h('div', {class: 'lib-zotero-menu hand-popup', role: 'menu', 'aria-label': '从 Zotero 导入'}, z.imports.map(c => h('button', {type: 'button', role: 'menuitem', 'data-tl-zotero': c.id}, c.name))));
      pop = bar.querySelector('.lib-zotero-menu')!; pop.querySelector<HTMLElement>('button')?.focus({preventScroll: true});
    }
  }
  async function run(id: string){
    menu = false; layout(); view.frames();
    const ok = await plugin.importZotero?.(id);
    if (ok === false) view.frame.feedback('没有调起 Zotero Integration 的导入命令');
  }
  async function click(e: MouseEvent){
    const t = e.target as Element, pick = t.closest?.<HTMLElement>('[data-tl-zotero]');
    if (pick) { e.preventDefault(); e.stopImmediatePropagation(); void run(pick.dataset.tlZotero!); return; }
    const b = t.closest?.('[data-tl="zotero"]');
    if (!b) { if (menu && !t.closest?.('.lib-zotero-menu')) { menu = false; layout(); } return; }
    e.preventDefault(); e.stopImmediatePropagation();
    const z = await plugin.syncZotero?.() || info();
    if (!z?.installed) { view.frame.feedback('没有找到 Zotero Integration 插件：在 Obsidian 的第三方插件里安装并启用它'); return; }
    if (!z.enabled) { view.frame.feedback('Zotero Integration 已安装但没有启用：在 Obsidian 的第三方插件里打开它'); return; }
    if (!z.imports.length) { view.frame.feedback('Zotero Integration 里还没有导入格式：在它的设置里加一个“Import Format”'); return; }
    if (z.imports.length === 1) { void run(z.imports[0].id); return; }
    menu = !menu; layout(); view.frames();
  }
  view.registerDomEvent(root, 'click', click, {capture: true});
  view.registerDomEvent(root, 'keydown', e => { if (menu && e.key === 'Escape') { menu = false; layout(); root.querySelector<HTMLElement>('[data-tl="zotero"]')?.focus(); e.stopPropagation(); } }, {capture: true});
  return {layout};
}
