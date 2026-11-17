// 目标（0.8，使用者 2026-11-09）：目标仍是仓库里 目标/ 下的笔记，这里补上“建、改、连”。
//   思索页 › 规划：目标一排每页三个，末尾“+”新建（原位写名字）、‹ › 翻页、“已达成 N”收起或展开达成的目标；
//                  点一个目标弹出详情纸：标题、每周计划投入（± 0.5h）、截止日期、状态（进行中 / 暂停到某天 / 达成）、
//                  关联项目（× 取消、+ 搜索添加）、本周每个项目投入了几小时、在 Obsidian 打开、删除（5 秒内可撤销）。
//   项目页 › 项目详情 › 关联目标：标签后面有 ×，末尾 + 打开可搜索的目标纸条（没有同名的就“新建目标”）。
//   项目页点目标：回到规划并打开它的详情纸，那一格闪一下。
// 关联只写在项目笔记的 goals 里（目标笔记不存项目），改动都在 d 上，由 persist.js 写回。
// 第 3d 期：转 TypeScript；思索页里的一排与详情纸改成 DOM 构建（draw/dom.ts）。项目页的关联目标（HOST.projectGoalChips）还嵌在
// 项目页的 HTML 模板里（paper-projects.js 还没改），那条路径的字符串版（picker、flag）原样保留；纸条搜索时换下的那一段改成节点版。
import {esc, icon, ink, iconEl, inkEl, smearProgressEl, TICK} from '../draw/ink.ts';
import {h, svg, setNodes, insertNodes, replaceWithNodes} from '../draw/dom.ts';
import type {Child} from '../draw/dom.ts';
import {HOST} from '../host.ts';
import type {ProtoButton} from '../host.ts';
import {markDeleted, restoreDeleted} from '../data/trash.ts';
import type {Model, ModelGoal, ModelProject, UIState} from '../data/types.ts';
import type {CompassView} from '../view.ts';

/** 目标用到的界面状态（d.ui 上的几项） */
interface GoalUI {
  goal?: string | null; goalPage: number; goalsDone?: boolean; goalFlash?: string | null; goalNew?: boolean; goalNewDraft?: string;
  goalCal?: string | null; goalCalMonth?: string | null; goalPick?: string | null; goalPickQuery?: string; goalPickFocus?: boolean; goalPickProject?: string | null;
}
/** 下方各页的核心（pages/lower.js 的 core；还没转 TypeScript）里本模块用到的两样 */
interface GoalsCore { readonly data: Model; render(): void }
/** 手里拿的条目：目标或项目（挑选纸条两种用法） */
type Holder = {id?: string; goalIds?: string[]};

const PER = 3, STEP = .5, MAX = 80;
const pad = (n: number) => String(n).padStart(2, '0');
const md = (date: string | null | undefined) => date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : '';
const validDate = (v: string | null | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const STATUS: [string, string][] = [['active', '进行中'], ['paused', '暂停'], ['done', '达成']];
const hours = (n: number) => (Math.round(n * 100) / 100) + 'h';
// 手绘的小勾与小旗（达成、截止）
const flag = `<svg class="goal-flag" viewBox="0 0 14 14" aria-hidden="true">${ink([[3, 13], [3, 1.5]], 1.2)}${ink([[3, 2], [11, 3.6], [3, 7.2]], 1.1)}</svg>`; // 字符串版：项目页的目标纸条用
const tickEl = () => svg('svg', {class: 'goal-tick', viewBox: '0 0 16 16', 'aria-hidden': 'true'}, inkEl([[3, 8.5], [6.5, 12], [13, 4]], 1.5));
const flagEl = () => svg('svg', {class: 'goal-flag', viewBox: '0 0 14 14', 'aria-hidden': 'true'}, inkEl([[3, 13], [3, 1.5]], 1.2), inkEl([[3, 2], [11, 3.6], [3, 7.2]], 1.1));
const underlineEl = () => svg('svg', {viewBox: '0 0 160 6', preserveAspectRatio: 'none', 'aria-hidden': 'true'}, inkEl([[0, 4], [80, 3.6], [160, 4]], .9, TICK));

export function createGoals({core, view, render}: {core: GoalsCore; view: CompassView; render: () => void}){
  const d = core.data, ui = d.ui as UIState & GoalUI, $ = <T extends Element = HTMLElement>(s: string) => HOST.querySelector(s) as T | null;
  const goalOf = (id: string | null | undefined) => d.goals.find(g => g.id === id);
  const today = () => d.clock.date;
  const linked = (g: ModelGoal) => d.projects.filter(p => (p.goalIds || []).includes(g.id));
  const touch = () => view.lower?.touch?.();
  const announce = (msg: string, undo?: () => unknown) => view.frame.feedback(msg, undo);
  const shown = () => d.goals.filter(g => ui.goalsDone ? true : g.status !== 'done');
  const overdue = (g: ModelGoal) => g.due && g.status !== 'done' && g.due < today();
  ui.goalPage ??= 0;

  // —— 规划里的一排 ——
  function goalButton(g: ModelGoal){
    const done = g.status === 'done', paused = g.status === 'paused';
    const state = done ? `已达成${g.completed ? '于' + g.completed : ''}` : paused ? (g.resume ? '暂停，恢复于' + g.resume : '暂停') : `本周投入 ${g.spent}h / ${g.planned}h`;
    const mark = done ? h('span', {class: 'goal-done'}, tickEl(), g.completed ? h('span', {class: 'mono'}, md(g.completed)) : null) : paused ? h('span', {class: 'resume'}, g.resume || '暂停') : smearProgressEl(g.spent, g.planned, 126, g.id);
    const due = g.due && !done ? h('small', {class: `goal-due ${overdue(g) ? 'overdue' : ''}`}, flagEl(), md(g.due)) : null;
    return h('button', {class: `goal ${paused ? 'paused' : ''} ${done ? 'is-done' : ''} ${ui.goal === g.id ? 'is-open' : ''} ${ui.goalFlash === g.id ? 'is-flash' : ''}`, 'data-goal': g.id, 'aria-expanded': String(ui.goal === g.id), 'aria-label': `${g.title}，${state}${g.due ? '，截止 ' + g.due : ''}`},
      h('span', {class: 'goal-name'}, g.title), mark, due);
  }
  function row(): Child{
    const list = shown(), pages = Math.max(1, Math.ceil(list.length / PER));
    // 打开的那个目标（从项目页跳过来的）要在当前这一页
    const at = list.findIndex(g => g.id === ui.goal); if (at >= 0 && ui.goalFlash) ui.goalPage = Math.floor(at / PER);
    ui.goalPage = Math.max(0, Math.min(pages - 1, ui.goalPage));
    const page = list.slice(ui.goalPage * PER, ui.goalPage * PER + PER), doneCount = d.goals.filter(g => g.status === 'done').length;
    const inRow = page.length < PER && !!ui.goalNew;
    const cells = [page.map(goalButton), inRow ? newForm() : null, Array.from({length: Math.max(0, PER - page.length - (inRow ? 1 : 0))}, () => h('span', {class: 'goal-filler', 'aria-hidden': 'true'}))];
    const paging = pages > 1 ? h('span', {class: 'goal-paging'},
      h('button', {type: 'button', 'data-goal-page': '-1', 'aria-label': '上一页目标', disabled: !ui.goalPage}, '‹'),
      h('span', {class: 'mono'}, `${ui.goalPage + 1}/${pages}`),
      h('button', {type: 'button', 'data-goal-page': '1', 'aria-label': '下一页目标', disabled: !(ui.goalPage < pages - 1)}, '›')) : null;
    const tools = h('div', {class: 'goal-tools'}, page.length >= PER && ui.goalNew ? newForm() : h('button', {type: 'button', class: 'goal-add', 'data-goal-act': 'new', 'aria-label': '新建目标'}, iconEl('plus', 18)), paging,
      doneCount ? h('button', {type: 'button', class: 'goal-done-toggle', 'data-goal-act': 'toggle-done', 'aria-pressed': String(!!ui.goalsDone)}, ui.goalsDone ? '收起已达成' : '已达成 ' + doneCount) : null);
    const empty = !d.goals.length && !ui.goalNew ? h('button', {type: 'button', class: 'goal-empty', 'data-goal-act': 'new'}, '写下第一个目标：每周想往哪里投时间') : null;
    return [empty || cells, tools];
  }
  const newForm = () => h('form', {class: 'goal-new', 'data-goal-form': 'new'}, h('input', {name: 'title', placeholder: '目标名称，回车', 'aria-label': '新目标的名称', autocomplete: 'off', spellcheck: 'false'}), underlineEl());

  // —— 详情纸 ——
  // 原模板在三块之间有换行缩进（空白文字节点，落在块级元素之间，不占位置），节点版不再写出
  function calendar(kind: string, value: string | null){
    const month = ui.goalCalMonth || (validDate(value) ? value! : today()).slice(0, 7), [y, m] = month.split('-').map(Number);
    const start = new Date(month + '-01T12:00:00Z'), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const first = (start.getUTCDay() + 6) % 7, days = end.getUTCDate();
    return h('div', {class: 'goal-cal', role: 'dialog', 'aria-label': kind === 'due' ? '选择截止日期' : '选择恢复日期'},
      h('div', {class: 'goal-cal-month'}, h('button', {type: 'button', 'data-goal-month': '-1', 'aria-label': '上个月'}, '‹'), h('span', null, `${y} 年 ${m} 月`), h('button', {type: 'button', 'data-goal-month': '1', 'aria-label': '下个月'}, '›')),
      h('div', {class: 'goal-cal-grid'}, [...'一二三四五六日'].map(x => h('span', null, x)), Array.from({length: first}, () => h('span')), Array.from({length: days}, (_, i) => { const date = `${month}-${pad(i + 1)}`;
        return h('button', {type: 'button', 'data-goal-day': date, 'aria-label': date, 'aria-pressed': String(date === value), 'aria-current': date === today() ? 'date' : null}, i + 1); })),
      h('div', {class: 'goal-cal-foot'}, h('button', {type: 'button', 'data-goal-day': today()}, '今天'), value ? h('button', {type: 'button', 'data-goal-day': ''}, kind === 'due' ? '不设截止' : '不定日期') : null));
  }
  // 挑选纸条（kind: 'project' 给目标挑项目，'goal' 给项目挑目标）。字符串版给项目页的模板（HOST.projectGoalChips）用，与原来逐字相同
  function picker(kind: string, g: Holder){
    const q = (ui.goalPickQuery || '').trim(), has = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
    const items = kind === 'project'
      ? d.projects.filter(p => !(p.goalIds || []).includes(g.id!) && has(p.title)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')).map(p => `<button type="button" role="option" data-goal-pick="${esc(p.id)}">${icon('route', 15)}<span>${esc(p.title)}</span>${p.status === 'done' ? '<small>已完成</small>' : ''}</button>`)
      : d.goals.filter(x => !(g.goalIds || []).includes(x.id) && has(x.title)).map(x => `<button type="button" role="option" data-goal-pick="${esc(x.id)}">${flag}<span>${esc(x.title)}</span>${x.status === 'done' ? '<small>已达成</small>' : ''}</button>`);
    const create = kind === 'goal' && q && !d.goals.some(x => x.title === q) ? `<button type="button" role="option" data-goal-pick-new="${esc(q)}">${icon('plus', 15)}<span>新建目标“${esc(q)}”</span></button>` : '';
    return `<div class="goal-pick hand-popup" role="listbox" aria-label="${kind === 'project' ? '关联项目' : '关联目标'}"><label class="goal-pick-search">${icon('search', 15)}<input data-goal-pick-query value="${esc(ui.goalPickQuery || '')}" placeholder="${kind === 'project' ? '搜索项目' : '搜索或新建目标'}" aria-label="${kind === 'project' ? '搜索项目' : '搜索或新建目标'}" autocomplete="off"></label><div class="goal-pick-items">${items.join('') + create || `<p>${kind === 'project' ? '没有可关联的项目' : '没有可关联的目标'}</p>`}</div></div>`;
  }
  // 节点版：可选的条目（.goal-pick-items）
  function pickerItemsEl(kind: string, g: Holder){
    const q = (ui.goalPickQuery || '').trim(), has = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
    const items = kind === 'project'
      ? d.projects.filter(p => !(p.goalIds || []).includes(g.id!) && has(p.title)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')).map(p => h('button', {type: 'button', role: 'option', 'data-goal-pick': p.id}, iconEl('route', 15), h('span', null, p.title), p.status === 'done' ? h('small', null, '已完成') : null))
      : d.goals.filter(x => !(g.goalIds || []).includes(x.id) && has(x.title)).map(x => h('button', {type: 'button', role: 'option', 'data-goal-pick': x.id}, flagEl(), h('span', null, x.title), x.status === 'done' ? h('small', null, '已达成') : null));
    const create = kind === 'goal' && q && !d.goals.some(x => x.title === q) ? h('button', {type: 'button', role: 'option', 'data-goal-pick-new': q}, iconEl('plus', 15), h('span', null, `新建目标“${q}”`)) : null;
    return h('div', {class: 'goal-pick-items'}, items.length || create ? [items, create] : h('p', null, kind === 'project' ? '没有可关联的项目' : '没有可关联的目标'));
  }
  function pickerEl(kind: string, g: Holder){
    const label = kind === 'project' ? '搜索项目' : '搜索或新建目标';
    return h('div', {class: 'goal-pick hand-popup', role: 'listbox', 'aria-label': kind === 'project' ? '关联项目' : '关联目标'},
      h('label', {class: 'goal-pick-search'}, iconEl('search', 15), h('input', {'data-goal-pick-query': true, value: ui.goalPickQuery || '', placeholder: label, 'aria-label': label, autocomplete: 'off'})),
      pickerItemsEl(kind, g));
  }
  function paper(g: ModelGoal){
    const projects = linked(g), status = g.status || 'active', cal = ui.goalCal;
    const week = projects.length ? projects.map(p => h('li', null, h('span', null, p.title), h('span', {class: 'mono'}, hours(g.byProject?.find(x => x.id === p.id)?.hours || 0)))) : h('li', {class: 'goal-muted'}, '还没有关联项目：在今日页给项目记投入，就会算进这里');
    return h('div', {class: 'goal-paper hand-popup', id: 'goal-paper', tabindex: '-1', role: 'dialog', 'aria-label': `目标：${g.title}`},
      h('button', {type: 'button', class: 'inline-close', 'data-goal-act': 'close', 'aria-label': '关上目标详情'}, '×'),
      h('form', {class: 'goal-title-form', 'data-goal-form': 'title'}, h('input', {name: 'title', class: 'goal-title', value: g.title, 'aria-label': '目标名称', autocomplete: 'off', spellcheck: 'false'}), underlineEl()),
      h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '每周计划'), h('span', {class: 'goal-stepper'},
        h('button', {type: 'button', 'data-goal-act': 'minus', 'aria-label': '少 0.5 小时', disabled: !(g.planned > 0)}, '−'), h('b', {class: 'mono', 'aria-live': 'polite'}, hours(g.planned)), h('button', {type: 'button', 'data-goal-act': 'plus', 'aria-label': '多 0.5 小时'}, '+'))),
      h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '截止'), h('button', {type: 'button', class: `goal-date ${overdue(g) ? 'overdue' : ''}`, 'data-goal-act': 'cal-due', 'aria-expanded': String(cal === 'due')}, flagEl(), h('span', null, g.due ? g.due + (overdue(g) ? ' · 已过' : '') : '不设'))),
      cal === 'due' ? calendar('due', g.due) : null,
      h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '状态'), h('span', {class: 'goal-status', role: 'radiogroup', 'aria-label': '目标状态'}, STATUS.map(([k, t]) => h('button', {type: 'button', role: 'radio', 'aria-checked': String(status === k), 'data-goal-status': k}, t)))),
      status === 'paused' ? [h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '回来'), h('button', {type: 'button', class: 'goal-date', 'data-goal-act': 'cal-resume', 'aria-expanded': String(cal === 'resume')}, iconEl('sunrise', 15), h('span', null, g.resumeDate || '不定日期'))), cal === 'resume' ? calendar('resume', g.resumeDate) : null] : null,
      status === 'done' ? h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '达成于'), h('span', {class: 'mono'}, g.completed || today())) : null,
      h('div', {class: 'goal-field goal-projects'}, h('span', {class: 'goal-label'}, '项目'), h('span', {class: 'goal-chips'},
        projects.map(p => h('span', {class: 'goal-chip'}, h('button', {type: 'button', 'data-goal-open-project': p.id}, p.title), h('button', {type: 'button', class: 'goal-chip-x', 'data-goal-unlink': p.id, 'aria-label': `取消关联 ${p.title}`}, '×'))),
        h('button', {type: 'button', class: 'goal-chip-add', 'data-goal-act': 'pick', 'aria-expanded': String(ui.goalPick === g.id), 'aria-label': '关联项目'}, iconEl('plus', 15)))),
      ui.goalPick === g.id ? pickerEl('project', g) : null,
      h('div', {class: 'goal-week'}, h('p', null, h('span', null, '本周投入'), h('b', {class: 'mono'}, `${hours(g.spent)} / ${hours(g.planned)}`)), h('ul', null, week)),
      h('div', {class: 'goal-foot'}, h('button', {type: 'button', 'data-goal-act': 'open-note'}, '在 Obsidian 打开'), h('button', {type: 'button', class: 'goal-delete', 'data-goal-act': 'delete'}, '删除')));
  }
  // 详情纸贴在那一格下面，超出纸面时往左挪
  function place(){
    const el = $('#goal-paper'), btn = el && $(`#goals [data-goal="${CSS.escape(ui.goal || '')}"]`), box = $('#planning'); if (!el || !box) return;
    const b = box.getBoundingClientRect(), r = btn ? btn.getBoundingClientRect() : $('#goals')!.getBoundingClientRect(), w = el.offsetWidth;
    el.style.left = Math.max(0, Math.min(r.left - b.left, b.width - w - 8)) + 'px'; el.style.top = (r.bottom - b.top + 8) + 'px';
    el.style.maxHeight = Math.max(160, Math.min(innerHeight, HOST.bottom) - r.bottom - 22) + 'px'; // 纸不超出视图底边，长了就在纸里滚
  }

  function renderRow(){
    const host = $('#goals'); if (!host) return;
    // 重画前记下焦点在哪个按钮上（同样的 data-goal-* 属性），画完放回去；找不到就放在详情纸或这一格上，Esc 才到得了插件
    const was = document.activeElement, inside = !!was && (host.contains(was) || !!$('#goal-paper')?.contains(was));
    const key = inside && was.matches('button') ? [...was.attributes].filter(a => a.name.startsWith('data-goal')).map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : '';
    setNodes(host, row);
    $('#goal-paper')?.remove();
    view.root?.toggleAttribute('data-goal-paper', !!goalOf(ui.goal)); // 纸开着时“还有 N 项”那一层不压在纸上
    // 找不到时不清掉 d.ui.goal：原生 Obsidian 里新目标的笔记可能比项目笔记晚进索引，中间重建一次模型时它暂时不在
    const g = goalOf(ui.goal);
    if (g) { insertNodes($('#planning')!, 'beforeend', () => paper(g)); place(); view.frames(); }
    if (inside && !document.activeElement?.isConnected || inside && document.activeElement === document.body) ((key ? $(key) : null) || $('#goal-paper') || $(`#goals [data-goal="${CSS.escape(ui.goal || '')}"]`) || $('#goals .goal-add'))?.focus({preventScroll: true});
    if (ui.goalNew) { const input = $<HTMLInputElement>('.goal-new input'); input?.focus({preventScroll: true}); if (input && ui.goalNewDraft) input.value = ui.goalNewDraft; }
    if (ui.goalPick) { const q = $<HTMLInputElement>('[data-goal-pick-query]'); if (q && ui.goalPickFocus) { q.focus({preventScroll: true}); q.setSelectionRange(q.value.length, q.value.length); } }
    if (ui.goalFlash) setTimeout(() => { ui.goalFlash = null; $('#goals .is-flash')?.classList.remove('is-flash'); }, 1600);
  }
  const rerender = () => { renderRow(); };

  // —— 改动 ——
  function create(title: string, open = true){
    const t = String(title || '').trim().replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').slice(0, 80); if (!t) return null;
    if (d.goals.some(g => g.title === t)) { announce('已经有叫“' + t + '”的目标'); return d.goals.find(g => g.title === t)!; }
    const g = {id: 'goal-' + d.serial++, title: t, planned: 0, spent: 0, status: 'active', due: null, completed: null, resumeDate: null, projectIds: [], byProject: []} as unknown as ModelGoal; // 新目标还没写成笔记：没有 example 等字段
    d.goals.push(g); if (open) { ui.goal = g.id; ui.goalPage = Math.floor((shown().length - 1) / PER); }
    touch(); return g;
  }
  function setStatus(g: ModelGoal, s: string){
    g.status = s; g.completed = s === 'done' ? (g.completed || today()) : null; if (s !== 'paused') g.resumeDate = null; g.resume = s === 'paused' && g.resumeDate ? md(g.resumeDate) : undefined;
    ui.goalCal = s === 'paused' ? 'resume' : null; ui.goalCalMonth = null;
    if (s === 'done') announce('目标达成 · ' + g.title);
  }
  function remove(g: ModelGoal){
    const hold = view.lower!.hold, at = d.goals.indexOf(g), from = linked(g).map(p => p.id);
    d.goals.splice(at, 1); for (const p of d.projects) p.goalIds = (p.goalIds || []).filter(id => id !== g.id);
    if (g.id.includes('/')) hold.add(g.id); markDeleted(d, [g.id]); ui.goal = null; touch(); rerender(); // 登记删除（P2-10）
    let undone = false; const timer = setTimeout(() => { if (undone) return; hold.delete(g.id); touch(); }, 5300);
    announce('已删除目标 · ' + g.title, () => { undone = true; clearTimeout(timer); hold.delete(g.id); restoreDeleted(d, [g.id]);
      if (!d.goals.includes(g)) d.goals.splice(Math.min(at, d.goals.length), 0, g);
      for (const p of d.projects) if (from.includes(p.id) && !p.goalIds.includes(g.id)) p.goalIds.push(g.id);
      ui.goal = g.id; touch(); core.render(); });
  }
  const openNote = (g: ModelGoal) => { const w = view.plugin?.writer; if (g.id.includes('/') && w && w.exists?.(g.id) !== false) w.open(g.id); else announce('这个目标的笔记还在写，稍等再试'); };

  // —— 规划里的点击 ——
  function onThoughtClick(b: HTMLElement){
    const ds = b.dataset, g = goalOf(ui.goal);
    if (ds.goal) { ui.goal = ui.goal === ds.goal ? null : ds.goal; ui.goalCal = null; ui.goalPick = null; ui.goalPickQuery = ''; ui.goalNew = false; rerender();
      $(`#goals [data-goal="${CSS.escape(ds.goal)}"]`)?.focus({preventScroll: true}); return true; } // 一排重画过，焦点放回这一格（Esc 才到得了插件）
    if (ds.goalPage) { ui.goalPage += Number(ds.goalPage); ui.goal = null; rerender(); return true; }
    if (ds.goalStatus && g) { setStatus(g, ds.goalStatus); if (ds.goalStatus === 'done' && !ui.goalsDone) ui.goal = null; render(); return true; }
    if (ds.goalMonth) { const t = new Date((ui.goalCalMonth || ((ui.goalCal === 'due' ? g?.due : g?.resumeDate) || today()).slice(0, 7)) + '-01T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + Number(ds.goalMonth)); ui.goalCalMonth = t.toISOString().slice(0, 7); rerender(); $(`[data-goal-month="${ds.goalMonth}"]`)?.focus({preventScroll: true}); return true; }
    if (ds.goalDay !== undefined && g) { if (ui.goalCal === 'due') g.due = ds.goalDay || null; else { g.resumeDate = ds.goalDay || null; g.resume = g.resumeDate ? md(g.resumeDate) : undefined; } ui.goalCal = null; ui.goalCalMonth = null; render(); return true; }
    if (ds.goalUnlink && g) { const p = d.projects.find(x => x.id === ds.goalUnlink); if (p) p.goalIds = p.goalIds.filter(id => id !== g.id); rerender(); return true; }
    if (ds.goalPick && g) { const p = d.projects.find(x => x.id === ds.goalPick); if (p && !p.goalIds.includes(g.id)) p.goalIds = [...(p.goalIds || []), g.id]; ui.goalPick = null; ui.goalPickQuery = ''; rerender(); return true; }
    if (ds.goalOpenProject) { ui.goal = null; view.lower!.openObject('project', ds.goalOpenProject); return true; }
    switch (ds.goalAct) {
      case 'new': ui.goalNew = true; ui.goalNewDraft = ''; ui.goal = null; ui.goalPage = Math.max(0, Math.ceil(shown().length / PER) - 1); rerender(); return true;
      case 'toggle-done': ui.goalsDone = !ui.goalsDone; ui.goal = null; rerender(); return true;
      case 'close': ui.goal = null; ui.goalCal = null; ui.goalPick = null; rerender(); $(`#goals [data-goal]`)?.focus({preventScroll: true}); return true;
    }
    if (!g) return false;
    switch (ds.goalAct) {
      case 'minus': g.planned = Math.max(0, +(g.planned - STEP).toFixed(2)); rerender(); $('[data-goal-act="minus"]')?.focus({preventScroll: true}); return true;
      case 'plus': g.planned = Math.min(MAX, +(g.planned + STEP).toFixed(2)); rerender(); $('[data-goal-act="plus"]')?.focus({preventScroll: true}); return true;
      case 'cal-due': case 'cal-resume': { const k = ds.goalAct.slice(4); ui.goalCal = ui.goalCal === k ? null : k; ui.goalCalMonth = null; rerender(); return true; }
      case 'pick': ui.goalPick = ui.goalPick === g.id ? null : g.id; ui.goalPickQuery = ''; ui.goalPickFocus = true; rerender(); ui.goalPickFocus = false; return true;
      case 'open-note': openNote(g); return true;
      case 'delete': remove(g); return true;
    }
    return false;
  }
  HOST.addEventListener('click', e => {
    if (ui.page !== 'thought') return; const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b || b.disabled || !b.closest('#planning')) return;
    if (onThoughtClick(b)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // —— 项目详情：关联目标的 × 与 + ——（项目页的模板还是字符串，这里给它字符串）
  HOST.projectGoalChips = (p: ModelProject, dd: Model, B: ProtoButton) => {
    const pui = dd.ui as UIState & GoalUI;
    const chips = (p.goalIds || []).map(id => { const g = dd.goals.find(x => x.id === id); if (!g) return ''; return `<span class="pd-goal">${B('open-object', id, esc(g.title), g.title, 'data-kind="goal" class="pd-chip"')}<button type="button" class="pd-goal-x" data-pgoal-unlink="${esc(id)}" data-project="${esc(p.id)}" aria-label="取消关联 ${esc(g.title)}">×</button></span>`; }).join('');
    return chips + `<span class="pd-goal-add-wrap"><button type="button" class="pd-goal-add" data-pgoal-add="${esc(p.id)}" aria-expanded="${pui.goalPickProject === p.id}" aria-label="关联目标">${icon('plus', 15)}</button>${pui.goalPickProject === p.id ? picker('goal', p) : ''}</span>`;
  };
  const projectRerender = (focusQuery = false) => { core.render(); if (focusQuery) { const q = $<HTMLInputElement>('#projects [data-goal-pick-query]'); if (q) { q.focus({preventScroll: true}); q.setSelectionRange(q.value.length, q.value.length); } } view.frames(); };
  HOST.addEventListener('click', e => {
    if (ui.page !== 'projects') return; const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b || b.disabled) return; const ds = b.dataset;
    const p = d.projects.find(x => x.id === (ds.project || ds.pgoalAdd || ui.goalPickProject));
    let hit = true;
    if (ds.pgoalUnlink && p) p.goalIds = p.goalIds.filter(id => id !== ds.pgoalUnlink);
    else if (ds.pgoalAdd) { ui.goalPickProject = ui.goalPickProject === ds.pgoalAdd ? null : ds.pgoalAdd; ui.goalPickQuery = ''; projectRerender(!!ui.goalPickProject); e.preventDefault(); e.stopImmediatePropagation(); return; }
    else if (ds.goalPick && p && b.closest('#projects .goal-pick')) { if (!p.goalIds.includes(ds.goalPick)) p.goalIds = [...p.goalIds, ds.goalPick]; ui.goalPickProject = null; }
    else if (ds.goalPickNew && p) { const g = create(ds.goalPickNew, false); if (g && !p.goalIds.includes(g.id)) p.goalIds = [...p.goalIds, g.id]; ui.goalPickProject = null; }
    else hit = false;
    if (hit) { e.preventDefault(); e.stopImmediatePropagation(); ui.goalPickQuery = ''; touch(); projectRerender(); }
  }, true);

  // —— 输入：新目标名、标题、纸条搜索 ——
  HOST.addEventListener('submit', e => {
    const f = (e.target as Element).closest?.<HTMLFormElement>('[data-goal-form]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const title = f.elements.namedItem('title') as HTMLInputElement;
    if (f.dataset.goalForm === 'new') { const v = title.value; ui.goalNew = false; ui.goalNewDraft = ''; if (v.trim()) { create(v); render(); } else rerender(); }
    if (f.dataset.goalForm === 'title') title.blur();
  }, true);
  HOST.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    if (!t.matches?.('.goal-title')) return; const g = goalOf(ui.goal), v = t.value.trim().replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
    if (!g || !v || v === g.title) { t.value = g?.title || ''; return; }
    if (d.goals.some(x => x !== g && x.title === v)) { announce('已经有叫“' + v + '”的目标'); t.value = g.title; return; }
    g.title = v; touch(); render();
  }, true);
  HOST.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.matches?.('.goal-new input')) { ui.goalNewDraft = t.value; return; }
    if (!t.matches?.('[data-goal-pick-query]') || (e as InputEvent).isComposing) return;
    ui.goalPickQuery = t.value; const list = t.closest('.goal-pick')!;
    // 只换下可选的那一段（原来是拼一整张纸条的 HTML、解析后取出这一段）
    const holder: Holder = ui.page === 'projects' ? d.projects.find(x => x.id === ui.goalPickProject) || {goalIds: []} : goalOf(ui.goal)!;
    replaceWithNodes(list.querySelector('.goal-pick-items')!, () => pickerItemsEl(ui.page === 'projects' ? 'goal' : 'project', holder)); view.frames();
  }, true);
  HOST.addEventListener('compositionend', e => { if ((e.target as Element).matches?.('[data-goal-pick-query]')) e.target!.dispatchEvent(new Event('input', {bubbles: true})); }, true);
  HOST.addEventListener('keydown', ev => {
    const e = ev as KeyboardEvent, t = e.target as Element;
    if (e.key === 'Enter' && !e.isComposing && t.matches?.('[data-goal-pick-query]')) { e.preventDefault(); t.closest('.goal-pick')!.querySelector<HTMLElement>('[data-goal-pick],[data-goal-pick-new]')?.click(); return; }
    if (e.key !== 'Escape') return;
    if (ui.page === 'projects' && ui.goalPickProject) { e.preventDefault(); e.stopImmediatePropagation(); const id = ui.goalPickProject; ui.goalPickProject = null; projectRerender(); $(`#projects [data-pgoal-add="${CSS.escape(id)}"]`)?.focus({preventScroll: true}); return; }
    if (ui.page !== 'thought') return;
    if (ui.goalNew) { e.preventDefault(); e.stopImmediatePropagation(); ui.goalNew = false; ui.goalNewDraft = ''; rerender(); $('.goal-add')?.focus({preventScroll: true}); return; }
    if (ui.goalCal || ui.goalPick) { e.preventDefault(); e.stopImmediatePropagation(); ui.goalCal = null; ui.goalPick = null; rerender(); return; }
    if (ui.goal) { e.preventDefault(); e.stopImmediatePropagation(); const id = ui.goal; ui.goal = null; rerender(); $(`#goals [data-goal="${CSS.escape(id)}"]`)?.focus({preventScroll: true}); }
  }, true);
  // 点到纸外面就收起（新目标的输入框空着时也收起）
  HOST.addEventListener('pointerdown', e => {
    const t = e.target as Element;
    if (ui.page === 'thought') {
      if (ui.goalNew && !t.closest?.('.goal-new') && !(ui.goalNewDraft || '').trim()) { ui.goalNew = false; rerender(); }
      if (ui.goal && !t.closest?.('#goal-paper, #goals [data-goal], #feedback')) { ui.goal = null; ui.goalCal = null; ui.goalPick = null; rerender(); }
    }
    if (ui.page === 'projects' && ui.goalPickProject && !t.closest?.('.pd-goal-add-wrap')) { ui.goalPickProject = null; projectRerender(); }
  }, true);

  return {renderRow, place};
}
