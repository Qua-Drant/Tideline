// 0.9.3（上线前评审 P1-4）：空状态与“没有结果”时写一句说明（设计说明第 11 节：空着的地方画虚线轮廓，点它就是新建；
// 口吻跟今日页的“今天没有排定的航程……”一致）。每次渲染后由 view.frames() 调用，只动当前那一页。
//   任务：搜索没有结果 → “没有找到“q””＋清除搜索；一件任务都没有 → 怎么开始
//   项目：一个项目都没有 → 港口里的虚线小船下写“新建项目”
//   知识库：两根测深绳旁各写一句去哪里新建（装了 Zotero Integration 时提一句导入）
//   思索规划：空的那天不写“空”，画一个虚线“+”，点了在那天记一件任务（见 thought.js 与这里的点击）
import {esc} from '../draw/ink.js';
import {FOLDERS} from '../data/index.js';

export function createEmptyStates({view, plugin}){
  const root = view.root, data = () => view.lower?.data || null;
  const put = (host, cls, html, where = 'beforeend') => {
    let el = host.querySelector(':scope > .' + cls);
    if (!html) { el?.remove(); return null; }
    if (!el) { host.insertAdjacentHTML(where, `<div class="${cls} tl-empty-note"></div>`); el = host.querySelector(':scope > .' + cls); }
    if (el.innerHTML !== html) el.innerHTML = html;
    return el;
  };
  function tasks(d){
    const pane = root.querySelector('#tasks .cargo-left-pane'), list = pane?.querySelector('.cargo-manifest'); if (!pane || !list) return;
    const empty = !list.querySelector('.cargo-row') && !!list.querySelector('.empty-outline'), q = (d.ui.taskQuery || '').trim();
    let html = '';
    if (empty && q) html = `<p>没有找到“${esc(q)}”。<button type="button" class="tl-empty-link" data-p2="task-search-clear" data-id="">清除搜索</button></p>`;
    else if (empty && !d.tasks.length) html = '<p>还没有任务。点下面的虚线 + 写一件，回车；或用右上角“记录”随手记下。</p>';
    else if (empty) html = '<p>这里没有任务。</p>';
    const note = put(pane, 'tl-empty-tasks', html);
    if (note && list.nextElementSibling !== note) list.after(note);
    const add = list.querySelector('.empty-outline'); if (add) { const label = q && empty ? `新建任务“${q}”` : '新建任务'; if (add.getAttribute('aria-label') !== label) { add.setAttribute('aria-label', label); add.title = label; } }
  }
  function projects(d){
    const page = root.querySelector('#projects'), berth = page?.querySelector('.project-new-berth'); if (!page || !berth) return;
    const none = !(d.projects || []).some(p => p.status !== 'archived');
    const host = berth.parentElement, note = put(host, 'tl-empty-projects', none ? '<p><b>新建项目</b>还没有项目，点上面的虚线小船起一个。</p>' : '');
    if (note) { note.style.left = berth.offsetLeft + 'px'; note.style.top = (berth.offsetTop + berth.offsetHeight + 8) + 'px'; }
  }
  function library(d){
    const sea = root.querySelector('#library .lib-sea'); if (!sea) return;
    const z = plugin.zotero?.(), zot = !!z && z.installed && z.enabled;
    for (const [kind, has, text] of [
      ['literature', (d.literature || []).filter(l => l.stage !== 'dropped').length, `还没有文献。在 ${FOLDERS.literature}/ 下新建笔记${zot ? '，或用上面的 Zotero 按钮导入' : ''}。`],
      ['book', (d.books || []).length, `还没有读书笔记。在 ${FOLDERS.books}/ 下新建笔记。`]]) {
      const knot = sea.querySelector(`.library-knot[data-id="${kind}|0"]`), note = put(sea, 'tl-empty-' + kind, knot && !has ? `<p>${esc(text)}</p>` : '');
      if (note && knot) { note.style.left = (knot.offsetLeft + 36) + 'px'; note.style.top = (knot.offsetTop + 30) + 'px'; }
    }
  }
  function layout(){
    const d = data(); if (!d) return;
    if (view.page === 'tasks') tasks(d); else if (view.page === 'projects') projects(d); else if (view.page === 'library') library(d);
  }
  // 思索规划：点空着那天的虚线 +，打开“记录”并带上那天的日期
  view.registerDomEvent(root, 'click', e => {
    const b = e.target.closest?.('[data-day-new]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const date = b.dataset.dayNew, m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date || '');
    view.capture?.openWith?.(m ? ` ${Number(m[1])}月${Number(m[2])}日` : '');
  }, {capture: true});
  return {layout};
}
