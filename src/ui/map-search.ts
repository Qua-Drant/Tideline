// 罗盘小地图与搜索（画面照原型 paper.js 的 renderMap / showSearch / renderSearch）。
//   小地图：点右上的罗盘，列出八层，每层旁边一个数字（都按笔记现算）：思索=待回顾的想法、今日=今天还没完成的任务、任务=收件箱、
//          项目=进行中的项目、复盘=本周完成的任务、知识库=待读的文献；点一行去那一层。Alt + ↑ / ↓ 去上一层、下一层。
//   搜索：按 /（或小地图里没有的时候直接按），按标题找想法、提示词、任务、项目、人物、文献、书籍；点一条（或回车选第一条）
//          跳到它所在的页并打开它。在大脑页输入时，同时筛选大脑里的节点。Esc 关上。
// 第 3c 期：DOM 构建（draw/dom.ts），不再拼 HTML 字符串；小地图与搜索纸条的固定外壳（mapShell / searchShell）从 frame.ts 搬回这里。
import {iconEl} from '../draw/ink.ts';
import {h, setNodes} from '../draw/dom.ts';
import {NAV} from '../frame.ts';
import {HOST} from '../host.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

/** 一条搜索结果：去哪一页、是什么、图标、标题、id */
interface SearchResult { page: string; kind: string; icon: string; title: string; id: string }

/** 小地图的固定外壳（框只建一次，frame.ts 调用） */
export function mapShell(){ return h('div', {id: 'map', class: 'map paper-strip', hidden: true}); }
/** 搜索纸条的固定外壳 */
export function searchShell(){
  return h('div', {id: 'search', class: 'global-search paper-strip hand-popup', hidden: true},
    h('form', {class: 'line-form', role: 'search'},
      h('input', {id: 'global-query', 'aria-label': '搜索任务、想法和提示词', autocomplete: 'off'}),
      h('button', {class: 'icon-button', 'data-action': 'close-search', type: 'button', 'aria-label': '关闭搜索'}, '×')),
    h('div', {id: 'search-results'}));
}
const order = () => NAV.map(n => n[0]);
const LIMIT = 40;

export function createMapSearch({view, plugin}: {view: CompassView; plugin: CompassPlugin}){
  const root = view.root, $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  let results: SearchResult[] = [];
  // —— 小地图 ——
  function counts(): Record<string, number>{
    const ix = plugin.index, {date} = plugin.clock(), X = ix.examples || new Set(), real = <T extends {id: string}>(m: Map<string, T>) => [...m.values()].filter(x => !X.has(x.id)), tasks = real(ix.tasks), open = (t: {status: string}) => t.status !== 'done' && t.status !== 'cancelled';
    const ws = HOST.weekStart(date), we = HOST.weekEnd(date), lists = new Set(ix.config.lists.map(l => l.title));
    return {thought: real(ix.ideas).filter(i => i.review).length, today: tasks.filter(t => t.date === date && open(t)).length,
      tasks: tasks.filter(t => open(t) && !t.project && !(t.list && lists.has(t.list))).length, projects: real(ix.projects).filter(p => p.status === 'active').length,
      review: tasks.filter(t => t.status === 'done' && (t.completed || t.date)! >= ws && (t.completed || t.date)! <= we).length, library: real(ix.literature).filter(l => l.stage === 'inbox').length}; // 都不算示例笔记（设计说明 22.5）
  }
  function renderMap(){
    const c = counts();
    setNodes($('#map'), () => NAV.map(([id, name, ic]) => h('button', {class: 'map-row', 'data-page': id, 'aria-label': name + (c[id] !== undefined ? ' ' + c[id] : ''), 'aria-current': id === view.page ? 'true' : null},
      iconEl(ic), h('b', {class: 'map-name'}, view.hand.textEl(name, {size: 18})), h('span', null, c[id] ?? ''))));
  }
  function toggleMap(on = $('#map').hidden){
    $('#map').hidden = !on;
    if (on) { closeSearch(); renderMap(); view.frames(); $('#map').querySelector<HTMLElement>('button')?.focus(); }
  }
  // —— 搜索 ——
  function candidates(): SearchResult[]{
    const ix = plugin.index, {date} = plugin.clock();
    return [...[...ix.ideas.values()].map(i => ({page: 'thought', kind: 'idea', icon: 'star', title: i.title, id: i.id})),
      ...[...ix.prompts.values()].map(p => ({page: 'ai', kind: 'prompt', icon: 'flag', title: p.title, id: p.id})),
      ...[...ix.tasks.values()].map(t => t.date === date ? {page: 'today', kind: 'today', icon: 'sunrise', title: t.title, id: t.id} : {page: 'tasks', kind: 'task', icon: 'box', title: t.title, id: t.id}),
      ...[...ix.projects.values()].map(p => ({page: 'projects', kind: 'project', icon: 'route', title: p.title, id: p.id})),
      ...[...ix.people.values()].map(p => ({page: 'tasks', kind: 'person', icon: 'circle', title: p.name, id: p.id})),
      ...[...ix.literature.values()].map(p => ({page: 'library', kind: 'literature', icon: 'lead', title: p.title, id: p.id})),
      ...[...ix.books.values()].map(p => ({page: 'library', kind: 'book', icon: 'book', title: p.title, id: p.id}))];
  }
  function renderSearch(q: string){
    const s = q.trim().toLowerCase();
    if (view.page === 'brain') view.lower?.brainSearch?.(q);
    const all = candidates().filter(x => x.title.toLowerCase().includes(s)).sort((a, b) => order().indexOf(a.page) - order().indexOf(b.page));
    results = all.slice(0, LIMIT);
    setNodes($('#search-results'), () => results.length
      ? [results.map((r, i) => h('button', {class: 'search-result', 'data-search-result': i}, iconEl(r.icon), h('span', null, r.title))),
        all.length > LIMIT ? h('p', {class: 'search-more'}, `还有 ${all.length - LIMIT} 条，多打几个字缩小范围`) : null]
      : h('p', null, '没有找到相符的内容'));
    view.frames(); // 0.7：搜索纸条的边框是手绘的，结果多少变了就按新尺寸重画
  }
  function showSearch(){ toggleMap(false); $('#search').hidden = false; $<HTMLInputElement>('#global-query').value = ''; renderSearch(''); $('#global-query').focus(); }
  function closeSearch(){ if ($('#search').hidden) return; $('#search').hidden = true; if (view.page === 'brain' && view.lower?.data?.ui?.brainQuery) { view.lower.brainSearch?.(''); } }
  // 跳过去并打开它（原型 search-result 的点击）
  function open(r: SearchResult){
    closeSearch();
    if (r.kind === 'today') { view.go('today'); view.ui.detail = r.id; view.render(true); return; }
    if (r.kind === 'idea' || r.kind === 'prompt') {
      view.lower ??= view.createLower(); const d = view.lower.model();
      if (r.kind === 'idea') Object.assign(d.ui, {lamp: false, idea: r.id, ideaExpanded: true, ideaDate: null, ideaTag: null}); // ideaDate 在这里清成 null（类型上是 string）
      else { d.ui.prompt = r.id; d.ui.aiView = 'prompt'; }
      view.go(r.page); return;
    }
    view.lower ??= view.createLower(); view.lower.openObject(r.kind, r.id);
  }

  view.registerDomEvent(root, 'click', e => {
    const b = (e.target as Element).closest<HTMLElement>('button'); if (!b) return;
    if (b.classList.contains('map-row') && b.dataset.page) { e.stopPropagation(); toggleMap(false); view.go(b.dataset.page); return; }
    if (b.dataset.searchResult !== undefined) { e.stopPropagation(); const r = results[Number(b.dataset.searchResult)]; if (r) open(r); return; }
    if (b.dataset.action === 'close-search') { e.stopPropagation(); closeSearch(); }
  }, {capture: true});
  // 点到小地图、搜索框外面就收起
  view.registerDomEvent(root, 'pointerdown', e => { if (!$('#map').hidden && !(e.target as Element).closest('#map,#compass-toggle')) toggleMap(false); });
  view.registerDomEvent(root, 'input', e => { const t = e.target as HTMLInputElement; if (t.id === 'global-query') renderSearch(t.value); });
  view.registerDomEvent(root, 'submit', e => { if ((e.target as Element).closest('#search')) { e.preventDefault(); e.stopImmediatePropagation(); if (results[0]) open(results[0]); } }, {capture: true});
  // 按键：/ 搜索、Esc 收起、Alt + ↑ / ↓ 换层（只在潮线是当前视图、焦点不在别的输入框时）
  view.registerDomEvent(document, 'keydown', e => {
    if (!root.isConnected) return;
    const mine = view.app.workspace.getActiveViewOfType?.(view.constructor as typeof CompassView) === view || root.contains(document.activeElement);
    if (!mine) return;
    const typing = (e.target as Element).closest?.('input,textarea,select,[contenteditable],.cm-editor');
    if (e.key === 'Escape') { if (!$('#search').hidden) { e.preventDefault(); closeSearch(); } else if (!$('#map').hidden) { e.preventDefault(); toggleMap(false); } return; }
    if (typing) return;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); showSearch(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); const O = order(), i = O.indexOf(view.page); view.go(O[Math.max(0, Math.min(O.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]); }
  });
  return {toggleMap, showSearch, closeSearch, refresh(){ if (!$('#map').hidden) renderMap(); }};
}
