// 知识库页的“Zotero”按钮（0.7，见 data/zotero.js）：装了 Zotero Integration 才出现，放在搜索框和“知识库”之间。
// 点了调它的导入命令（只有一条就直接调；几种导出格式就先给一张手绘小纸条选），弹出 Zotero 的选择框；
// 导进来的笔记落在它的导入文件夹里，索引按文件变化自己更新，知识库页随之出现新文献。
import {esc} from '../draw/ink.js';

const GLYPH = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4.2 4.6 C8 4.3 12 4.4 15.6 4.5 L5 15.4 C8.8 15.6 12.4 15.5 15.9 15.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createZoteroUi({view, plugin}){
  const root = view.root;
  let menu = false;
  const info = () => plugin.zotero?.() || null;
  function layout(){
    if (view.page !== 'library') { menu = false; return; }
    const bar = root.querySelector('#library .lib-toolbar'); if (!bar) return;
    const z = info(), show = !!z && (z.installed || z.folders.length);
    let b = bar.querySelector('[data-tl="zotero"]');
    if (!show) { b?.remove(); return; }
    if (!b) { bar.querySelector('.lib-view-toggle')?.insertAdjacentHTML('beforebegin', `<button type="button" class="lib-zotero hand-pill" data-tl="zotero" aria-haspopup="menu">${GLYPH}<span>Zotero</span></button>`); b = bar.querySelector('[data-tl="zotero"]'); if (!b) return; }
    const state = !z.enabled ? 'Zotero Integration 没有启用' : !z.folders.length ? '没有找到 Zotero Integration 的导入文件夹' : `从 Zotero 导入文献（导入到 ${z.folders.join('、')}）`;
    b.setAttribute('aria-label', state); b.title = state; b.setAttribute('aria-expanded', String(menu));
    let pop = root.querySelector('#library .lib-zotero-menu');
    if (!menu) { pop?.remove(); return; }
    if (!pop) {
      bar.insertAdjacentHTML('beforeend', `<div class="lib-zotero-menu hand-popup" role="menu" aria-label="从 Zotero 导入">${z.imports.map(c => `<button type="button" role="menuitem" data-tl-zotero="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>`);
      pop = bar.querySelector('.lib-zotero-menu'); pop.querySelector('button')?.focus({preventScroll: true});
    }
  }
  async function run(id){
    menu = false; layout(); view.frames();
    const ok = await plugin.importZotero?.(id);
    if (ok === false) view.frame.feedback('没有调起 Zotero Integration 的导入命令');
  }
  async function click(e){
    const pick = e.target.closest?.('[data-tl-zotero]');
    if (pick) { e.preventDefault(); e.stopImmediatePropagation(); run(pick.dataset.tlZotero); return; }
    const b = e.target.closest?.('[data-tl="zotero"]');
    if (!b) { if (menu && !e.target.closest?.('.lib-zotero-menu')) { menu = false; layout(); } return; }
    e.preventDefault(); e.stopImmediatePropagation();
    const z = await plugin.syncZotero?.() || info();
    if (!z?.installed) { view.frame.feedback('没有找到 Zotero Integration 插件：在 Obsidian 的第三方插件里安装并启用它'); return; }
    if (!z.enabled) { view.frame.feedback('Zotero Integration 已安装但没有启用：在 Obsidian 的第三方插件里打开它'); return; }
    if (!z.imports.length) { view.frame.feedback('Zotero Integration 里还没有导入格式：在它的设置里加一个“Import Format”'); return; }
    if (z.imports.length === 1) { run(z.imports[0].id); return; }
    menu = !menu; layout(); view.frames();
  }
  view.registerDomEvent(root, 'click', click, {capture: true});
  view.registerDomEvent(root, 'keydown', e => { if (menu && e.key === 'Escape') { menu = false; layout(); root.querySelector('[data-tl="zotero"]')?.focus(); e.stopPropagation(); } }, {capture: true});
  return {layout};
}
