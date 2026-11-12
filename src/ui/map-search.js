// 罗盘小地图与搜索（画面照原型 paper.js 的 renderMap / showSearch / renderSearch）。
//   小地图：点右上的罗盘，列出八层，每层旁边一个数字（都按笔记现算）：思索=待回顾的想法、今日=今天还没完成的任务、任务=收件箱、
//          项目=进行中的项目、复盘=本周完成的任务、知识库=待读的文献；点一行去那一层。Alt + ↑ / ↓ 去上一层、下一层。
//   搜索：按 /（或小地图里没有的时候直接按），按标题找想法、提示词、任务、项目、人物、文献、书籍；点一条（或回车选第一条）
//          跳到它所在的页并打开它。在大脑页输入时，同时筛选大脑里的节点。Esc 关上。
import {esc, icon} from '../draw/ink.js';
import {NAV} from '../frame.js';
import {HOST} from '../host.js';

export const MAP_HTML = '<div id="map" class="map paper-strip" hidden></div>';
export const SEARCH_HTML = '<div id="search" class="global-search paper-strip hand-popup" hidden><form class="line-form" role="search"><input id="global-query" aria-label="搜索任务、想法和提示词" autocomplete="off"><button class="icon-button" data-action="close-search" type="button" aria-label="关闭搜索">×</button></form><div id="search-results"></div></div>';
const order = () => NAV.map(n => n[0]);
const LIMIT = 40;

export function createMapSearch({view, plugin}){
  const root = view.root, $ = s => root.querySelector(s);
  let results = [];
  // —— 小地图 ——
  function counts(){
    const ix = plugin.index, {date} = plugin.clock(), X = ix.examples || new Set(), real = m => [...m.values()].filter(x => !X.has(x.id)), tasks = real(ix.tasks), open = t => t.status !== 'done' && t.status !== 'cancelled';
    const ws = HOST.weekStart(date), we = HOST.weekEnd(date), lists = new Set(ix.config.lists.map(l => l.title));
    return {thought: real(ix.ideas).filter(i => i.review).length, today: tasks.filter(t => t.date === date && open(t)).length,
      tasks: tasks.filter(t => open(t) && !t.project && !(t.list && lists.has(t.list))).length, projects: real(ix.projects).filter(p => p.status === 'active').length,
      review: tasks.filter(t => t.status === 'done' && (t.completed || t.date) >= ws && (t.completed || t.date) <= we).length, library: real(ix.literature).filter(l => l.stage === 'inbox').length}; // 都不算示例笔记（设计说明 22.5）
  }
  function renderMap(){
    const c = counts();
    $('#map').innerHTML = NAV.map(([id, name, ic]) => `<button class="map-row" data-page="${id}" aria-label="${name}${c[id] !== undefined ? ' ' + c[id] : ''}" ${id === view.page ? 'aria-current="true"' : ''}>${icon(ic)}<b class="map-name">${view.hand.text(name, {size: 18})}</b><span>${c[id] ?? ''}</span></button>`).join('');
  }
  function toggleMap(on = $('#map').hidden){
    $('#map').hidden = !on;
    if (on) { closeSearch(); renderMap(); view.frames(); $('#map button')?.focus(); }
  }
  // —— 搜索 ——
  function candidates(){
    const ix = plugin.index, {date} = plugin.clock();
    return [...[...ix.ideas.values()].map(i => ({page: 'thought', kind: 'idea', icon: 'star', title: i.title, id: i.id})),
      ...[...ix.prompts.values()].map(p => ({page: 'ai', kind: 'prompt', icon: 'flag', title: p.title, id: p.id})),
      ...[...ix.tasks.values()].map(t => t.date === date ? {page: 'today', kind: 'today', icon: 'sunrise', title: t.title, id: t.id} : {page: 'tasks', kind: 'task', icon: 'box', title: t.title, id: t.id}),
      ...[...ix.projects.values()].map(p => ({page: 'projects', kind: 'project', icon: 'route', title: p.title, id: p.id})),
      ...[...ix.people.values()].map(p => ({page: 'tasks', kind: 'person', icon: 'circle', title: p.name, id: p.id})),
      ...[...ix.literature.values()].map(p => ({page: 'library', kind: 'literature', icon: 'lead', title: p.title, id: p.id})),
      ...[...ix.books.values()].map(p => ({page: 'library', kind: 'book', icon: 'book', title: p.title, id: p.id}))];
  }
  function renderSearch(q){
    const s = q.trim().toLowerCase();
    if (view.page === 'brain') view.lower?.brainSearch?.(q);
    const all = candidates().filter(x => x.title.toLowerCase().includes(s)).sort((a, b) => order().indexOf(a.page) - order().indexOf(b.page));
    results = all.slice(0, LIMIT);
    $('#search-results').innerHTML = results.map((r, i) => `<button class="search-result" data-search-result="${i}">${icon(r.icon)}<span>${esc(r.title)}</span></button>`).join('')
      + (all.length > LIMIT ? `<p class="search-more">还有 ${all.length - LIMIT} 条，多打几个字缩小范围</p>` : '') || '<p>没有找到相符的内容</p>';
    if (!results.length) $('#search-results').innerHTML = '<p>没有找到相符的内容</p>';
    view.frames(); // 0.7：搜索纸条的边框是手绘的，结果多少变了就按新尺寸重画
  }
  function showSearch(){ toggleMap(false); $('#search').hidden = false; $('#global-query').value = ''; renderSearch(''); $('#global-query').focus(); }
  function closeSearch(){ if ($('#search').hidden) return; $('#search').hidden = true; if (view.page === 'brain' && view.lower?.data?.ui?.brainQuery) { view.lower.brainSearch?.(''); } }
  // 跳过去并打开它（原型 search-result 的点击）
  function open(r){
    closeSearch();
    if (r.kind === 'today') { view.go('today'); view.ui.detail = r.id; view.render(true); return; }
    if (r.kind === 'idea' || r.kind === 'prompt') {
      view.lower ??= view.createLower(); const d = view.lower.model();
      if (r.kind === 'idea') { d.ui.lamp = false; d.ui.idea = r.id; d.ui.ideaExpanded = true; d.ui.ideaDate = null; d.ui.ideaTag = null; }
      else { d.ui.prompt = r.id; d.ui.aiView = 'prompt'; }
      view.go(r.page); return;
    }
    view.lower ??= view.createLower(); view.lower.openObject(r.kind, r.id);
  }

  view.registerDomEvent(root, 'click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('map-row') && b.dataset.page) { e.stopPropagation(); toggleMap(false); view.go(b.dataset.page); return; }
    if (b.dataset.searchResult !== undefined) { e.stopPropagation(); const r = results[Number(b.dataset.searchResult)]; if (r) open(r); return; }
    if (b.dataset.action === 'close-search') { e.stopPropagation(); closeSearch(); }
  }, {capture: true});
  // 点到小地图、搜索框外面就收起
  view.registerDomEvent(root, 'pointerdown', e => { if (!$('#map').hidden && !e.target.closest('#map,#compass-toggle')) toggleMap(false); });
  view.registerDomEvent(root, 'input', e => { if (e.target.id === 'global-query') renderSearch(e.target.value); });
  view.registerDomEvent(root, 'submit', e => { if (e.target.closest('#search')) { e.preventDefault(); e.stopImmediatePropagation(); if (results[0]) open(results[0]); } }, {capture: true});
  // 按键：/ 搜索、Esc 收起、Alt + ↑ / ↓ 换层（只在潮线是当前视图、焦点不在别的输入框时）
  view.registerDomEvent(document, 'keydown', e => {
    if (!root.isConnected) return;
    const mine = view.app.workspace.getActiveViewOfType?.(view.constructor) === view || root.contains(document.activeElement);
    if (!mine) return;
    const typing = e.target.closest?.('input,textarea,select,[contenteditable],.cm-editor');
    if (e.key === 'Escape') { if (!$('#search').hidden) { e.preventDefault(); closeSearch(); } else if (!$('#map').hidden) { e.preventDefault(); toggleMap(false); } return; }
    if (typing) return;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); showSearch(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); const O = order(), i = O.indexOf(view.page); view.go(O[Math.max(0, Math.min(O.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]); }
  });
  return {toggleMap, showSearch, closeSearch, refresh(){ if (!$('#map').hidden) renderMap(); }};
}
