// 任务页学滴答清单的交互（0.4，docs/滴答清单交互.md）。画面仍是 R39 的纸和墨，这里只补交互：
//   完成过程与撤销、重复任务顺延、删除可撤销（撤销纸条消失后才进回收站）、放弃、置顶、副本、链接
//   键盘操作货单、多选与批量、拖动时的纸签和落点线（排序、拖成子任务、拖到分组改期）
//   货单输入框的智能识别与补全、详情里的优先级 / 时刻 / 提醒 / 重复 / 标签 / 子任务 / 检查项 / 评论
//   清单改名与归档、到点提醒（Obsidian 通知）
// 0.5：详情改成滴答清单那样的一张纸（task-sheet.js），正文用 Obsidian 自带的编辑器即时渲染（task-md-editor.js）。
// 原型模块（src/draw/proto/paper-tasks.js）只留 HOST.task* 钩子（tools/sync-proto.mjs 的改写表），没有这个模块时与 R39 一样。
// 事件都在插件根的捕获阶段处理：原型的监听器挂在冒泡阶段，所以这里先拿到，需要时拦下。
import {Notice} from 'obsidian';
import {HOST} from '../host.js';
import {esc, ink, circle, icon} from '../draw/ink.js';
import {parseTask, nextRepeat, repeatDays, activeToken, suggestions, PRIORITIES, REMINDERS, REPEATS, addDays, addMonths} from './task-parse.js';
import {sheetHtml, splitChecklist, joinChecklist, SLASH, SG} from './task-sheet.js';
import {completeTask, reopenTask} from '../data/complete.js';
import {dropTasks, markDeleted, restoreDeleted} from '../data/trash.js';
import {createMdEditor} from './task-md-editor.js';

const RANK = {pinned: 0, overdue: 1, today: 2, later: 3, none: 4, done: 9};
const P = ['highest', 'high', 'medium', 'low'];
const closed = t => t.status === 'done' || t.status === 'cancelled';
const md = date => date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : '';
const svg = (body, w = 16, h = w) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;
const checks = text => { const all = String(text || '').match(/^\s*[-*]\s+\[[ xX]\]/gm) || []; return {total: all.length, done: all.filter(x => /\[[xX]\]/.test(x)).length}; };
const typing = el => !!el?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"],.cm-editor');
const REMIND_LABEL = Object.fromEntries(REMINDERS);
// 透明的拖动图：真正跟着指针的是 .task-drag-ghost
const BLANK = (() => { if (typeof Image === 'undefined') return null; const i = new Image(); i.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; return i; })();
const remindOffset = r =>({'0': 0, '5m': 5, '30m': 30, '1h': 60, '1d': 1440})[r] ?? null;

export function createTaskPlus(view){
  const root = view.root;
  const data = () => view.lower?.data || null;
  const onTasks = () => view.page === 'tasks' && !!data();
  const motion = () => view.plugin.local?.device?.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 插件自己（点击、回车）要的重画照常；写回引起的回声重画在详情里打字时由 holdRender 挡一下（view.render）
  let allowRender = false, lastSheetKey = 0;
  const render = () => { allowRender = true; try { view.render(true); } finally { allowRender = false; } };
  const touch = () => view.lower?.touch?.();
  const get = id => data()?.tasks.find(t => t.id === id);
  const recent = new Set(); // 这次打开以来完成 / 放弃的：留在底部“已完成”组里，能看见也能点回来
  const completing = new Set();
  let info = {depth: new Map(), group: new Map(), kids: new Map(), children: new Map()};
  // 每个任务的全部子任务（不论是否在当前筛选里）：排序时建一次，行尾计数和详情都查它
  const childrenOf = id => info.children.get(id) || [];
  // 详情里几个输入框的草稿与焦点：写回引起整页重画时不丢正在打的字
  const drafts = new Map(); let inputWanted = null;
  const draft = (kind, id) => esc(drafts.get(kind + '|' + id) || '');
  let pendingFocus = null, suggest = null, drag = null, rename = null, ticker = 0, composerWanted = false;
  const notified = new Set();

  // ———— 撤销纸条 ————
  function feedback(message, undo, result){
    view.frame.feedback(message, undo ? async () => { undo(); render(); touch(); } : null, result);
  }
  const current = t => data()?.tasks.find(x => x.id === t.id) || t;
  const snapshot = (tasks, keys) => { const saved = tasks.map(t => [t, Object.fromEntries(keys.map(k => [k, Array.isArray(t[k]) ? [...t[k]] : t[k]]))]); return () => { for (const [t, v] of saved) Object.assign(current(t), v); }; };
  const dropTask = t => { const d = data(); if (d) dropTasks(d, [t.id]); }; // 拿掉并登记删除（P2-10）
  const FIELDS = ['status', 'completed', 'date', 'markdown', 'description', 'priority', 'pinned', 'order', 'parentId', 'listId', 'projectId', 'project', 'peopleIds', 'discuss', 'time', 'remind', 'repeat', 'tags', 'comments', 'title', 'mode'];
  // 详情里临时打开的块（子任务、评论输入）与正文编辑器
  const want = {child: null, comment: null};
  let editor = null, flushTimer = 0, slash = null;

  // ———— 原型钩子：分组、排序、行与详情里补的东西 ————
  function baseGroup(t, today){ if (closed(t)) return 'done'; if (t.pinned) return 'pinned'; if (!t.date) return 'none'; return t.date < today ? 'overdue' : t.date === today ? 'today' : 'later'; }
  HOST.taskShowDone = (t, d) => recent.has(t.id) || (t.status === 'done' && t.completed === d.clock.date);
  HOST.taskGroupOf = t => closed(t) ? 'done' : info.group.get(t.id) || (t.pinned ? 'pinned' : null);
  HOST.taskOrder = (found, d) => {
    const collapsed = d.ui.cargoCollapsed ??= {}; if (!('done' in collapsed)) collapsed.done = true;
    const today = d.clock.date, ids = new Set(found.map(t => t.id)), kids = new Map(), tops = [];
    const byId = new Map(d.tasks.map(t => [t.id, t]));
    const ancestorLoop = t => { const seen = new Set([t.id]); let p = t.parentId; while (p) { if (seen.has(p)) return true; seen.add(p); p = byId.get(p)?.parentId; } return false; };
    for (const t of found) {
      const parent = t.parentId && ids.has(t.parentId) ? byId.get(t.parentId) : null;
      if (parent && closed(parent) === closed(t) && !ancestorLoop(t)) { if (!kids.has(parent.id)) kids.set(parent.id, []); kids.get(parent.id).push(t); }
      else tops.push(t);
    }
    const g = t => baseGroup(t, today);
    const sameLevel = (x, y) => ((x.order ?? 1e9) - (y.order ?? 1e9)) || (P.indexOf(x.priority) - P.indexOf(y.priority));
    tops.sort((x, y) => RANK[g(x)] - RANK[g(y)] || (g(x) === 'done' ? (y.completed || '').localeCompare(x.completed || '') : (x.date || '9999').localeCompare(y.date || '9999')) || sameLevel(x, y));
    const out = [], depth = new Map(), group = new Map();
    const walk = (t, level, grp) => { out.push(t); depth.set(t.id, level); if (level) group.set(t.id, grp); for (const c of (kids.get(t.id) || []).sort(sameLevel)) walk(c, Math.min(level + 1, 3), grp); };
    for (const t of tops) walk(t, 0, g(t));
    const children = new Map(); for (const t of d.tasks) if (t.parentId) { if (!children.has(t.parentId)) children.set(t.parentId, []); children.get(t.parentId).push(t); }
    info = {depth, group, kids, children};
    return out;
  };
  HOST.taskDepth = t => info.depth.get(t.id) || 0;
  HOST.taskRowClass = (t, d) => [d.ui.taskSelection?.includes(t.id) && 'is-multi', completing.has(t.id) && 'is-completing', t.status === 'cancelled' && 'is-cancelled', t.status === 'done' && 'is-done',
    (info.depth.get(t.id) || 0) > 0 && 'is-child', drag?.ids.includes(t.id) && 'is-drag-source'].filter(Boolean).join(' ');
  HOST.taskRowMarks = (t, d) => {
    const marks = [], kids = childrenOf(t.id), c = checks(t.markdown ?? t.description);
    if (t.time) marks.push(`<span class="task-mark mono" aria-label="时刻 ${t.time}">${t.time}</span>`);
    if (kids.length) marks.push(`<span class="task-mark mono" aria-label="子任务 完成 ${kids.filter(closed).length} / ${kids.length}">${svg(ink([[3,3],[3,11],[12,11]],1.1) + ink([[3,7],[12,7]],1.1), 14)}${kids.filter(closed).length}/${kids.length}</span>`);
    if (c.total) marks.push(`<span class="task-mark mono" aria-label="检查项 完成 ${c.done} / ${c.total}">${svg(ink([[2,8],[5,11],[12,3]],1.2), 14)}${c.done}/${c.total}</span>`);
    for (const tag of (t.tags || []).slice(0, 2)) marks.push(`<span class="task-mark task-tag">#${esc(tag)}</span>`);
    if (t.comments?.length) marks.push(`<span class="task-mark mono" aria-label="${t.comments.length} 条评论">${svg(ink([[2,3],[13,3],[13,10],[7,10],[4,13],[4,10],[2,10],[2,3]],1.1), 15)}${t.comments.length}</span>`);
    return marks.length ? `<span class="task-marks">${marks.join('')}</span>` : '';
  };
  HOST.taskCreated = (task, d) => {
    task.tags ??= []; task.comments ??= [];
    const r = parseTask(task.title, d, d.clock.date);
    if (!r.tokens.length) return;
    task.title = r.title;
    if (r.date) task.date = r.date;
    if (r.time) task.time = r.time;
    if (r.priority) task.priority = r.priority;
    if (r.listId) task.listId = r.listId;
    if (r.projectId) { task.projectId = r.projectId; task.project = d.projects.find(p => p.id === r.projectId)?.title; }
    if (r.peopleIds) { task.peopleIds = [...new Set([...(task.peopleIds || []), ...r.peopleIds])]; task.discuss = true; }
    if (r.tags) task.tags = [...new Set([...task.tags, ...r.tags])];
    if (r.repeat) task.repeat = r.repeat;
  };
  // 0.6 任务与项目打通：左栏清单下面列出进行中 / 计划中 / 暂停的项目（带未完成件数，可当落点）；项目详情的任务列表下面直接新建任务
  const OPEN_PROJECT = p => ['active', 'planned', 'paused'].includes(p.status);
  HOST.taskNavProject = p => OPEN_PROJECT(p);
  HOST.taskProjectCount = (p, d) => d.tasks.filter(t => t.projectId === p.id && !closed(t)).length;
  HOST.projectTaskAdd = p => `<form class="project-task-add" data-tl-form="project-task" data-id="${esc(p.id)}"><span class="project-task-add-box" aria-hidden="true">${SG.box}</span><input name="title" value="${draft('ptask', p.id)}" placeholder="添加任务，回车（明天、!高、#标签）" aria-label="给 ${esc(p.title)} 添加任务" autocomplete="off"></form>`;
  let projectWanted = null;
  // 项目详情（0.7）：标题直接改——回车或离开就改名（笔记跟着改文件名，任务里的项目名一起换），Esc 放弃；
  // 任务栏标题旁加一个“+”，点了把光标放进下面的新建横线。重画后按草稿和焦点补回
  let projectTitle = null; // {id, text, focus}
  function projectLayout(){
    const d = data(), id = d?.ui.projectSelected, h = root.querySelector('#projects .project-detail .pd-title h3'); if (!h || !id) return;
    const p = d.projects.find(x => x.id === id); if (!p) return;
    if (h.dataset.ppTitle !== id) { h.dataset.ppTitle = id; h.setAttribute('contenteditable', 'plaintext-only'); h.setAttribute('role', 'textbox'); h.setAttribute('spellcheck', 'false'); h.setAttribute('aria-label', '项目名称，可直接修改'); h.setAttribute('enterkeyhint', 'done'); }
    if (projectTitle && projectTitle.id !== id) projectTitle = null;
    if (projectTitle) { if (h.textContent !== projectTitle.text) h.textContent = projectTitle.text; if (projectTitle.focus && (document.activeElement === document.body || !document.activeElement || !root.contains(document.activeElement))) { h.focus({preventScroll: true}); caretEnd(h); } }
    const head = root.querySelector('#projects .pd-tasks > header');
    if (head && !head.querySelector('.pd-task-new')) head.insertAdjacentHTML('beforeend', `<button type="button" class="pd-task-new" data-tl="project-task-new" aria-label="给 ${esc(p.title)} 新建任务">${icon('plus', 15)}</button>`);
  }
  function commitProjectTitle(h){
    const d = data(), p = d?.projects.find(x => x.id === h.dataset.ppTitle); if (!p) return;
    const text = h.textContent.replace(/\s+/g, ' ').trim(); projectTitle = null;
    if (!text || text === p.title) { h.textContent = p.title; return; }
    if (d.projects.some(x => x !== p && x.title === text)) { h.textContent = p.title; feedback('已有同名项目「' + text + '」，没有改名'); return; }
    const old = p.title, tasks = d.tasks.filter(t => t.projectId === p.id);
    p.title = text; for (const t of tasks) t.project = text;
    view.render(true); touch();
    feedback(`项目改名 · ${old} → ${text}`, () => { const n = data(), q = n.projects.find(x => x.title === text); if (!q) return; q.title = old; for (const t of n.tasks) if (t.projectId === q.id) t.project = old; });
  }
  function addProjectTask(form){
    const d = data(), p = d?.projects.find(x => x.id === form.dataset.id), input = form.elements.title, raw = input.value.trim(); if (!p || !raw) return;
    const r = parseTask(raw, d, d.clock.date), siblings = d.tasks.filter(t => t.projectId === p.id);
    const task = {id: 'task-' + d.serial++, title: r.title, status: 'open', priority: r.priority || 'medium', date: r.date || null, time: r.time, repeat: r.repeat, projectId: p.id, project: p.title,
      listId: r.listId || null, peopleIds: r.peopleIds || [], discuss: !!r.peopleIds?.length, tags: r.tags || [], comments: [], order: siblings.length ? Math.max(...siblings.map(t => t.order ?? 0)) + 10 : 10};
    d.tasks.push(task); drafts.delete('ptask|' + p.id); input.value = ''; projectWanted = p.id;
    render(); touch();
    feedback(`已加进项目「${p.title}」 · ${task.title}`, () => dropTask(task));
  }
  HOST.taskDetailHtml = (t, d) => sheetHtml(t, d, {draft, want, kids: childrenOf(t.id).length ? childrenOf(t.id) : d.tasks.filter(x => x.parentId === t.id), title: drafts.get('title|' + t.id), toolbar: !!d.ui.taskToolbar});

  // ———— 完成：先在纸上落一道墨，停一下，再收进“已完成” ————
  function complete(id){
    const t = get(id); if (!t) return false;
    if (closed(t)) { reopen(t); return true; }
    if (completing.has(id)) return true;
    if (view.page === 'tasks' && motion()) { completing.add(id); render(); setTimeout(() => { completing.delete(id); finish(get(id)); }, 620); }
    else finish(t);
    return true;
  }
  // 完成会产生哪些变更由 data/complete.js 决定（今日页也用它）：重复任务留完成记录、原任务顺延、检查项清空；其它任务连同未完成的子任务一起完成
  function finish(t){
    const d = data(); if (!t || !d) return;
    const {next, record, family, undo} = completeTask(d, t);
    if (record) recent.add(record.id); else { recent.add(t.id); for (const k of family) recent.add(k.id); }
    render(); touch();
    feedback(next ? `已完成 · ${t.title}，下一次 ${md(t.date)}` : '已完成 · ' + t.title, () => { const id = record?.id; undo(); if (id) recent.delete(id); data().ui.taskDetail = t.id; data().cache.taskScrollRequest = t.id; }, 'check');
  }
  function reopen(t){
    const {undo} = reopenTask(data(), t);
    render(); touch();
    feedback('重新打开 · ' + t.title, undo, 'circle');
  }
  function setStatus(list, status, label){
    const d = data(), restore = snapshot(list, FIELDS);
    for (const t of list) { t.status = status; t.completed = status === 'done' ? d.clock.date : undefined; if (status !== 'open') recent.add(t.id); }
    render(); touch();
    feedback(label, restore, status === 'done' ? 'check' : null);
  }

  // ———— 删除：先从货单拿走，撤销纸条消失后才交给回收站 ————
  function remove(ids){
    const d = data(); if (!d || !ids.length) return;
    const all = new Set(), add = id => { all.add(id); for (const c of d.tasks) if (c.parentId === id && !all.has(c.id)) add(c.id); };
    ids.forEach(add);
    const removed = d.tasks.map((t, i) => [t, i]).filter(([t]) => all.has(t.id));
    if (!removed.length) return;
    const hold = view.lower.hold;
    d.tasks = d.tasks.filter(t => !all.has(t.id));
    for (const id of all) hold.add(id);
    markDeleted(d, all); // 登记删除（P2-10）；hold 里的等撤销纸条消失后才真的删
    if (d.ui.taskSelection) d.ui.taskSelection = d.ui.taskSelection.filter(id => !all.has(id));
    if (all.has(d.ui.taskDetail)) d.ui.taskDetail = null;
    render(); touch();
    let undone = false;
    const timer = setTimeout(() => { if (undone) return; for (const id of all) hold.delete(id); touch(); }, 5300);
    view.frame.feedback(`已删除 · ${removed.length > 1 ? removed.length + ' 项' : removed[0][0].title}`, async () => {
      undone = true; clearTimeout(timer);
      const now = data(); for (const [t, i] of removed) { if (!now.tasks.some(x => x.id === t.id)) now.tasks.splice(Math.min(i, now.tasks.length), 0, t); }
      for (const id of all) hold.delete(id);
      restoreDeleted(now, all);
      now.ui.taskDetail = removed[0][0].id; now.cache.taskScrollRequest = removed[0][0].id;
      render(); touch();
    });
  }
  function duplicate(t){
    const d = data(), copy = {...t, id: 'task-' + d.serial++, status: 'open', completed: undefined, peopleIds: [...(t.peopleIds || [])], tags: [...(t.tags || [])], comments: [], order: t.order != null ? t.order + .5 : undefined};
    d.tasks.splice(d.tasks.indexOf(t) + 1, 0, copy); d.ui.taskDetail = copy.id; d.cache.taskScrollRequest = copy.id;
    render(); touch();
    feedback('已创建副本 · ' + t.title, () => { dropTask(copy); data().ui.taskDetail = t.id; });
  }

  // ———— 详情里的小按钮与输入 ————
  function act(button){
    const d = data(), a = button.dataset.tp, t = get(button.dataset.id), v = button.dataset.value;
    if (a === 'open') { if (!t) return; d.ui.taskDetail = t.id; d.ui.taskSelection = null; d.cache.taskScrollRequest = t.id; render(); return; }
    if (!t) return;
    if (a === 'toggle') { complete(t.id); return; }
    if (a === 'schedule') { root.querySelector(`#tasks [data-p2="task-date"][data-id="${CSS.escape(t.id)}"]`)?.click(); return; }
    if (a === 'delete') { remove([t.id]); return; }
    if (a === 'duplicate') { duplicate(t); return; }
    if (a === 'link') { navigator.clipboard?.writeText(`[[${t.title}]]`).catch(() => {}); view.frame.feedback('已复制链接 · [[' + t.title + ']]'); return; }
    if (a === 'checkitem') { syncBody(); const {desc, items} = splitChecklist(t.markdown ?? t.description), it = items[Number(v)]; if (!it) return; it.done = !it.done; setBody(t, joinChecklist(desc, items)); render(); touch(); return; }
    const restore = snapshot([t], FIELDS);
    if (a === 'mode') { syncBody(); t.mode = t.mode === 'checklist' ? undefined : 'checklist'; render(); touch(); feedback(t.mode ? '改成检查项 · ' + t.title : '切回文本 · ' + t.title, restore); return; }
    if (a === 'priority') { t.priority = v; feedback('优先级' + PRIORITIES.find(p => p[0] === v)[1] + ' · ' + t.title, restore); }
    else if (a === 'pin') { t.pinned = !t.pinned || undefined; feedback((t.pinned ? '已置顶 · ' : '取消置顶 · ') + t.title, restore); }
    else if (a === 'cancel') { if (t.status === 'cancelled') { t.status = 'open'; feedback('已恢复 · ' + t.title, restore); } else { setStatus([t], 'cancelled', '已放弃 · ' + t.title); return; } }
    else if (a === 'unperson') { t.peopleIds = (t.peopleIds || []).filter(x => x !== v); if (!t.peopleIds.length) t.discuss = false; feedback('不再待沟通 · ' + (data().people.find(p => p.id === v)?.name || ''), restore); }
    else if (a === 'untag') { t.tags = (t.tags || []).filter(x => x !== v); feedback('去掉标签 #' + v, restore); }
    else if (a === 'uncomment') { t.comments = (t.comments || []).filter((_, i) => i !== Number(v)); feedback('删掉一条评论', restore); }
    render(); touch();
  }
  function enterInput(input){
    const d = data(), t = get(input.dataset.id), text = input.value.trim(), kind = input.dataset.tpInput;
    if (!t || !text) return;
    drafts.delete(kind + '|' + t.id);
    const restore = snapshot([t], FIELDS);
    if (kind === 'tag') { const tag = text.replace(/^#/, '').replace(/\s+/g, ''); if (tag && !(t.tags || []).includes(tag)) { t.tags = [...(t.tags || []), tag]; feedback('加上标签 #' + tag, restore); } }
    else if (kind === 'check') { syncBody(); const body = (t.markdown ?? t.description ?? '').replace(/\s*$/, ''); setBody(t, (body ? body + '\n' : '') + '- [ ] ' + text); if (t.mode !== 'checklist') feedback('加上检查项', restore); }
    else if (kind === 'comment') { const {date, time} = view.plugin.clock(); t.comments = [...(t.comments || []), `${date} ${time} ${text.replace(/\s+/g, ' ')}`]; feedback('已评论 · ' + t.title, restore); }
    else if (kind === 'child') {
      const r = parseTask(text, d, d.clock.date), siblings = d.tasks.filter(x => x.parentId === t.id);
      const child = {id: 'task-' + d.serial++, title: r.title, status: 'open', priority: r.priority || 'medium', date: r.date || t.date || null, time: r.time, repeat: r.repeat, projectId: t.projectId, project: t.project, listId: t.listId,
        peopleIds: [], tags: r.tags || [], comments: [], parentId: t.id, order: siblings.length ? Math.max(...siblings.map(x => x.order ?? 0)) + 10 : 10};
      d.tasks.push(child);
      feedback('加上子任务 · ' + child.title, () => dropTask(child));
    }
    pendingFocus = {selector: `[data-tp-input="${kind}"][data-id="${CSS.escape(t.id)}"]`};
    render(); touch();
  }

  // ———— 日期纸条：快捷日期、时刻、提醒、重复（日历上标出重复落在哪几天）————
  function enhanceDateEditor(){
    const form = root.querySelector('#tasks .cargo-date-editor'); if (!form || form.querySelector('.task-when-extra')) return;
    const t = get(form.dataset.id); if (!t) return;
    const custom = t.repeat && !REPEATS.includes(t.repeat);
    form.insertAdjacentHTML('afterbegin', `<div class="task-when-quick" role="group" aria-label="快捷日期">${[['今天', 0], ['明天', 1], ['下周', 7], ['下个月', 'm']].map(([l, n]) => `<button type="button" data-tp-quick="${n}">${l}</button>`).join('')}<button type="button" data-tp-quick="">不安排</button></div>`);
    form.insertAdjacentHTML('beforeend', `<div class="task-when-extra">
      <label>时刻 <input name="time" type="time" value="${esc(t.time || '')}" aria-label="时刻"></label>
      <label>提醒 <select name="remind" aria-label="提醒">${REMINDERS.map(([v, l]) => `<option value="${v}" ${(t.remind || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>重复 <select name="repeat" aria-label="重复"><option value="">不重复</option>${REPEATS.map(r => `<option ${t.repeat === r ? 'selected' : ''}>${r}</option>`).join('')}<option value="custom" ${custom ? 'selected' : ''}>自定义…</option></select></label>
      <label class="task-repeat-custom" ${custom ? '' : 'hidden'}>规则 <input name="repeatCustom" value="${esc(custom ? t.repeat : '')}" placeholder="每2天 · 每周一、三 · 每3个月" aria-label="自定义重复"></label>
    </div>`);
    // 提交按钮放到最后
    const submit = form.querySelector('button[type="submit"]'); if (submit) form.append(submit);
  }
  function repeatRule(form){ const v = form.elements.repeat?.value; return v === 'custom' ? form.elements.repeatCustom?.value.trim() || null : v || null; }
  function saveDate(form){
    const t = get(form.dataset.id); if (!t) return;
    const d = data(), restore = snapshot([t], FIELDS), field = form.elements.date;
    const date = field?.value || null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { field.reportValidity?.(); return; }
    const rule = repeatRule(form);
    if (rule && !nextRepeat(date || d.clock.date, rule)) { const input = form.elements.repeatCustom; input?.setCustomValidity('认不出这条规则，例如：每2天、每周一、三、每3个月'); input?.reportValidity(); return; }
    t.date = date || (form.elements.time?.value || rule ? d.clock.date : null);
    t.time = form.elements.time?.value || undefined;
    t.remind = t.time ? form.elements.remind?.value || undefined : undefined;
    t.repeat = rule || undefined;
    d.ui.taskDate = null; d.cache.taskScrollRequest = t.id;
    render(); touch();
    feedback(t.title + ' · ' + ([t.date ? md(t.date) : '移出计划', t.time, t.repeat].filter(Boolean).join(' ')), restore);
  }
  // task-pickers.js 的日历会问：这个月里哪些天落在重复规则上
  HOST.taskRepeatDays = (field, month) => { const form = field.closest('.cargo-date-editor'); if (!form) return new Set(); const rule = repeatRule(form); return rule ? repeatDays(field.value || data()?.clock.date, rule, month) : new Set(); };

  // ———— 多选与批量 ————
  const selection = () => data()?.ui.taskSelection || [];
  const rowIds = () => [...root.querySelectorAll('#tasks .cargo-manifest .cargo-row')].map(r => r.dataset.id);
  function select(id, {range = false, toggle = false} = {}){
    const d = data(), ids = rowIds(); let sel = selection().slice();
    if (!sel.length && d.ui.taskDetail && d.ui.taskDetail !== id) sel = [d.ui.taskDetail];
    if (range) { const anchor = d.ui.taskSelectAnchor || d.ui.taskDetail || id, a = ids.indexOf(anchor), b = ids.indexOf(id); if (a >= 0 && b >= 0) sel = [...new Set([...sel, ...ids.slice(Math.min(a, b), Math.max(a, b) + 1)])]; else sel.push(id); }
    else if (toggle) sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    if (!range) d.ui.taskSelectAnchor = id;
    d.ui.taskSelection = sel.length > 1 ? sel : null;
    d.ui.taskDetail = id;
    render();
  }
  function batchPanel(){
    const d = data(), sel = selection().map(get).filter(Boolean); if (sel.length < 2) return;
    const pane = root.querySelector('#tasks .cargo-detail-pane'); if (!pane || pane.querySelector('.task-batch')) return;
    const b = (act, label, extra = '') => `<button type="button" data-tb="${act}" ${extra}>${label}</button>`;
    pane.innerHTML = `<article class="task-batch" aria-label="批量处理"><div class="cargo-document-head"><h3>已选 ${sel.length} 项</h3></div>
      <div class="detail-actions task-batch-actions">${b('done', '全部完成')}${b('today', '今天做')}${b('pin', '置顶')}${b('cancel', '放弃')}${b('delete', '删除')}${b('clear', '取消选择')}</div>
      <div class="task-plus-row"><span class="task-plus-label">优先级</span><span class="task-priority">${PRIORITIES.map(([v, l]) => b('priority', l, `data-value="${v}"`)).join('')}</span></div>
      <form class="line-form task-batch-move" data-tp-form="move"><select name="to" aria-label="移到清单"><option value="inbox:">移出清单</option><optgroup label="清单">${d.lists.filter(l => !l.archived).map(l => `<option value="list:${esc(l.id)}">${esc(l.title)}</option>`).join('')}</optgroup></select><button type="submit" class="text-button">移动</button></form>
      <ul class="task-batch-list">${sel.map(t => `<li>${esc(t.title)}</li>`).join('')}</ul>
      <p class="task-batch-hint">也可以把选中的任一行拖到货箱、梯子或邮包上，一起移动。</p></article>`;
  }
  function batch(act, value){
    const d = data(), sel = selection().map(get).filter(Boolean); if (!sel.length) return;
    if (act === 'clear') { d.ui.taskSelection = null; render(); return; }
    if (act === 'delete') { remove(sel.map(t => t.id)); return; }
    if (act === 'done') { setStatus(sel.filter(t => !closed(t)), 'done', `已完成 ${sel.length} 项`); return; }
    if (act === 'cancel') { setStatus(sel.filter(t => !closed(t)), 'cancelled', `已放弃 ${sel.length} 项`); return; }
    const restore = snapshot(sel, FIELDS);
    for (const t of sel) {
      if (act === 'today') t.date = d.clock.date;
      if (act === 'pin') t.pinned = true;
      if (act === 'priority') t.priority = value;
      if (act === 'move') moveTo(t, value);
    }
    render(); touch();
    feedback(`已处理 ${sel.length} 项`, restore);
  }
  function moveTo(t, value){
    const i = value.indexOf(':'), k = value.slice(0, i), id = value.slice(i + 1), d = data();
    if (k === 'list') t.listId = id; else if (k === 'inbox') t.listId = null; else if (k === 'today') t.date = d.clock.date;
    else if (k === 'person') { t.peopleIds = [...new Set([...(t.peopleIds || []), id])]; t.discuss = true; }
    else if (k === 'date' && id === 'none') { t.date = null; t.time = undefined; t.remind = undefined; }
    else if (k === 'pin') t.pinned = true;
    else if (k === 'done' && !closed(t)) { t.status = 'done'; t.completed = d.clock.date; recent.add(t.id); }
    else if (k === 'project') { const p = d.projects.find(x => x.id === id); if (p) { t.projectId = p.id; t.project = p.title; } }
    else if (k === 'cancel' && !closed(t)) { t.status = 'cancelled'; t.completed = undefined; recent.add(t.id); }
  }

  // ———— 键盘 ————
  function moveFocus(step, {extend = false, to = null} = {}){
    const d = data(), ids = rowIds(); if (!ids.length) return;
    const cur = ids.indexOf(d.ui.taskDetail), next = ids[to === 'first' ? 0 : to === 'last' ? ids.length - 1 : Math.max(0, Math.min(ids.length - 1, (cur < 0 ? (step > 0 ? -1 : ids.length) : cur) + step))];
    if (extend) { const anchor = d.ui.taskSelectAnchor || d.ui.taskDetail || next; d.ui.taskSelectAnchor = anchor; const a = ids.indexOf(anchor), b = ids.indexOf(next); const sel = ids.slice(Math.min(a, b), Math.max(a, b) + 1); d.ui.taskSelection = sel.length > 1 ? sel : null; }
    else { d.ui.taskSelection = null; d.ui.taskSelectAnchor = next; }
    d.ui.taskDetail = next; d.cache.taskScrollRequest = next; pendingFocus = {row: next};
    render();
  }
  function indent(t, outward){
    const d = data(), ids = rowIds(), restore = snapshot([t], FIELDS);
    if (outward) { if (!t.parentId) return; const p = get(t.parentId); t.parentId = p?.parentId || null; t.order = (p?.order ?? 0) + 1; }
    else {
      const above = ids[ids.indexOf(t.id) - 1], prev = above && get(above); if (!prev || prev.id === t.parentId) return;
      // 只能挂到同一层级、紧挨在上面的那一行（或它的祖先）下面
      let target = prev; while (target && (target.parentId || null) !== (t.parentId || null) && target.parentId) target = get(target.parentId);
      if (!target || target.id === t.id) return;
      t.parentId = target.id; const kids = d.tasks.filter(x => x.parentId === target.id && x !== t); t.order = kids.length ? Math.max(...kids.map(x => x.order ?? 0)) + 10 : 10;
    }
    pendingFocus = {row: t.id}; render(); touch();
    feedback((outward ? '移出子任务 · ' : '作为子任务 · ') + t.title, restore);
  }
  function key(e){
    if (!onTasks() || e.defaultPrevented) return;
    const d = data(), target = e.target;
    if (menu) { menuKey(e); return; }
    const keyRow = target.closest?.('#tasks .cargo-manifest .cargo-row');
    if (keyRow && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { const r = keyRow.getBoundingClientRect(); stop(e); openMenu(keyRow.dataset.id, {x: r.left + 120, y: r.bottom}); return; }
    // 货单输入框的补全纸条
    if (target.id === 'cargo-task-input' && suggest?.items.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { suggest.index = (suggest.index + (e.key === 'ArrowDown' ? 1 : -1) + suggest.items.length) % suggest.items.length; paintSuggest(); stop(e); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { choose(suggest.index); stop(e); return; }
      if (e.key === 'Escape') { closeSuggest(); stop(e); return; }
    }
    if (slash && slashKey(e)) return;
    if (target.matches?.('[data-tp-title]') && !e.isComposing) { if (e.key === 'Enter') { stop(e); commitTitle(target, true); return; } if (e.key === 'Escape') { stop(e); drafts.delete('title|' + target.dataset.tpTitle); target.textContent = get(target.dataset.tpTitle)?.title || ''; target.blur(); return; } }
    if (target.matches?.('[data-tp-item]') && !e.isComposing && itemKey(e, target)) return;
    if (target.matches?.('[data-tp-input]') && e.key === 'Enter' && !e.isComposing) { enterInput(target); stop(e); return; }
    if (target.matches?.('[data-tp-input]') && e.key === 'Escape') { target.value = ''; target.blur(); stop(e); return; }
    if (rename && e.key === 'Escape') { closeRename(true); stop(e); return; }
    if (typing(target) || e.isComposing) return;
    if (root.querySelector('#tasks .hand-popup:not(.task-drag-tag)')) return; // 纸条开着时交给纸条
    const focusedRow = target.closest?.('#tasks .cargo-row')?.dataset.id, sel = selection().length && (!focusedRow || selection().includes(focusedRow)) ? selection() : [];
    // 焦点在哪一行就作用于哪一行；多选时（焦点在选中的行里或不在任何行上）作用于整组
    const current = get(focusedRow || d.ui.taskDetail), targets = sel.length ? sel.map(get).filter(Boolean) : current ? [current] : [];
    const mod = e.ctrlKey || e.metaKey, inPage = !!target.closest?.('#tasks') || target === root || target === document.body, inList = !!target.closest?.('#tasks .cargo-manifest') || target === root || target === document.body;
    if (!inPage) return;
    const onOtherButton = target.matches?.('button,a,select') && !inList;
    if (e.key === 'ArrowDown' || (e.key === 'j' && !mod)) { moveFocus(1, {extend: e.shiftKey}); stop(e); }
    else if (e.key === 'ArrowUp' || (e.key === 'k' && !mod)) { moveFocus(-1, {extend: e.shiftKey}); stop(e); }
    else if (e.key === 'Home' && !typing(target)) { moveFocus(0, {to: 'first'}); stop(e); }
    else if (e.key === 'End' && !typing(target)) { moveFocus(0, {to: 'last'}); stop(e); }
    else if (e.key === 'Escape' && sel.length) { d.ui.taskSelection = null; render(); stop(e); }
    else if (mod && e.key.toLowerCase() === 'a' && root.querySelector('#tasks .cargo-manifest')?.contains(target)) { const ids = rowIds(); d.ui.taskSelection = ids.length > 1 ? ids : null; render(); stop(e); }
    else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && view.frame.undo) { root.querySelector('#feedback [data-action="undo"]')?.click(); stop(e); }
    else if (!targets.length) return;
    else if (onOtherButton && (e.key === ' ' || e.key === 'Enter' || e.key === 'Delete')) return;
    else if (e.key === ' ' || (mod && e.key === 'Enter')) { if (targets.length > 1) batch('done'); else complete(targets[0].id); stop(e); }
    else if (e.key === 'Delete' || (e.key === 'Backspace' && mod)) { remove(targets.map(t => t.id)); stop(e); }
    else if (e.key === 'Enter' && targets.length === 1 && inList) { focusBody(targets[0].id); stop(e); }
    else if (e.altKey && /^[1-4]$/.test(e.key)) { const v = ['low', 'medium', 'high', 'highest'][Number(e.key) - 1]; const restore = snapshot(targets, FIELDS); targets.forEach(t => { t.priority = v; }); render(); touch(); feedback('优先级' + PRIORITIES.find(p => p[0] === v)[1], restore); stop(e); }
    else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && targets.length === 1) { indent(targets[0], e.key === 'ArrowLeft'); stop(e); }
    else if (e.key === 'n' && !mod && !e.altKey) { const input = root.querySelector('#cargo-task-input'); if (input) input.focus(); else root.querySelector('#tasks [data-p2="task-compose"]')?.click(); stop(e); }
    else if (e.key === 'p' && !mod && !e.altKey) { const restore = snapshot(targets, FIELDS); const on = !targets.every(t => t.pinned); targets.forEach(t => { t.pinned = on || undefined; }); render(); touch(); feedback(on ? '已置顶' : '取消置顶', restore); stop(e); }
  }
  const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const caretEnd = el => { if ('value' in el && el.setSelectionRange) { const n = el.value.length; try { el.setSelectionRange(n, n); } catch {} } else if (el.isContentEditable) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } };

  // ———— 货单输入框：识别出的片段写成小纸签，# @ ~ ! 弹补全 ————
  function paintTokens(input){
    const d = data(), form = input.closest('form'); if (!form) return;
    let box = form.parentElement.querySelector('.cargo-tokens');
    const r = parseTask(input.value, d, d.clock.date);
    if (!r.tokens.length) { box?.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'cargo-tokens'; box.setAttribute('aria-live', 'polite'); form.after(box); }
    const label = t => t.kind === 'date' ? md(t.label) : t.label;
    box.innerHTML = r.tokens.map(t => `<span class="cargo-token" data-kind="${t.kind}">${esc(label(t))}</span>`).join('') + (r.title ? `<span class="cargo-token-title">→ ${esc(r.title)}</span>` : '');
  }
  function openSuggest(input){
    const d = data(), token = activeToken(input.value, input.selectionStart ?? input.value.length), items = token ? suggestions(token, d) : [];
    if (!items.length) { closeSuggest(); return; }
    suggest = {input, token, items, index: 0};
    let box = root.querySelector('#tasks .task-suggest');
    if (!box) { box = document.createElement('div'); box.className = 'task-suggest hand-popup'; box.setAttribute('role', 'listbox'); box.id = 'task-suggest'; root.querySelector('#tasks').append(box); input.setAttribute('aria-controls', box.id); }
    paintSuggest();
    const r = input.getBoundingClientRect(), base = (box.offsetParent || root).getBoundingClientRect();
    box.style.left = (r.left - base.left + Math.min(input.value.length * 7, r.width - 220)) + 'px'; box.style.top = (r.bottom - base.top + 6) + 'px';
    view.frames();
  }
  function paintSuggest(){
    const box = root.querySelector('#tasks .task-suggest'); if (!box || !suggest) return;
    const frame = box.querySelector(':scope > .hand-popup-frame');
    box.innerHTML = suggest.items.map((s, i) => `<button type="button" role="option" id="task-suggest-${i}" data-tp-suggest="${i}" aria-selected="${i === suggest.index}">${esc(s.label)}</button>`).join('');
    if (frame) box.prepend(frame);
    suggest.input.setAttribute('aria-activedescendant', 'task-suggest-' + suggest.index);
  }
  function choose(i){
    const s = suggest?.items[i]; if (!s) return;
    if (s.create) HOST.createPerson?.(s.create); // 0.9 @新名字：先建人物，再照常插入
    const {input, token} = suggest, v = input.value, insert = s.insert + ' ';
    input.value = v.slice(0, token.start) + insert + v.slice(token.end).replace(/^\s+/, '');
    const pos = token.start + insert.length; input.setSelectionRange(pos, pos);
    data().ui.cargoDraft = input.value;
    closeSuggest(); paintTokens(input); input.focus();
  }
  function closeSuggest(){ suggest?.input?.removeAttribute('aria-activedescendant'); suggest = null; root.querySelector('#tasks .task-suggest')?.remove(); }

  // ———— 清单改名与归档（左侧清单或货箱上右键）————
  // 左侧“新建清单”（0.7）：不弹纸条，在加号右边给一条输入横线；回车建好，Esc 或空着离开就收起。重画后按草稿和焦点原样补回
  let navAdd = null; // {draft, focus}
  function paintNavAdd(){
    const btn = root.querySelector('#tasks [data-p2="task-nav-new-list"]'); if (!btn) return null;
    if (!btn.parentElement.classList.contains('cargo-nav-adder')) { const wrap = document.createElement('div'); wrap.className = 'cargo-nav-adder'; btn.before(wrap); wrap.append(btn); }
    btn.setAttribute('aria-expanded', String(!!navAdd));
    let form = btn.parentElement.querySelector('.cargo-nav-newlist');
    if (!navAdd) { form?.remove(); return null; }
    if (!form) { btn.insertAdjacentHTML('afterend', `<form class="cargo-nav-newlist" data-tp-form="nav-list"><input name="title" placeholder="清单名称，回车" aria-label="新清单的名称" autocomplete="off" spellcheck="false"></form>`); form = btn.nextElementSibling; form.elements.title.value = navAdd.draft || ''; }
    return form.elements.title;
  }
  function openNavAdd(){ closeMenu(false); closeRename(false); navAdd = {draft: '', focus: true}; const input = paintNavAdd(); input?.focus({preventScroll: true}); }
  function closeNavAdd(focus){ navAdd = null; paintNavAdd(); if (focus) root.querySelector('#tasks [data-p2="task-nav-new-list"]')?.focus({preventScroll: true}); }
  function addNavList(form){
    const d = data(), input = form.elements.title, title = input.value.trim();
    if (!title) { closeNavAdd(true); return; }
    if (d.lists.some(l => l.title === title)) { input.setCustomValidity('已有同名清单'); input.reportValidity(); return; }
    const before = {...d.ui.taskFilter};
    d.lists.push({id: title, title, archived: false}); navAdd = null;
    d.ui.taskFilter = {kind: 'list', id: title}; d.ui.taskArchive = false;
    render(); touch();
    feedback('新建清单 · ' + title, () => { const n = data(); if (n.tasks.some(t => t.listId === title)) return; n.lists = n.lists.filter(l => l.id !== title); if (n.ui.taskFilter.kind === 'list' && n.ui.taskFilter.id === title) n.ui.taskFilter = before; });
  }
  function openRename(listId, anchor){
    closeRename(false);
    const d = data(), list = d.lists.find(l => l.id === listId); if (!list) return;
    rename = {id: listId};
    const box = anchor.getBoundingClientRect(), wrap = root.querySelector('#tasks'), base = wrap.getBoundingClientRect();
    wrap.insertAdjacentHTML('beforeend', `<form class="task-rename line-form hand-popup" role="dialog" aria-label="整理清单" data-tp-form="rename"><input name="title" value="${esc(list.title)}" aria-label="清单名称" autocomplete="off" required><button type="submit" class="text-button">改名</button><button type="button" class="text-button" data-tp-list="archive">${list.archived ? '取出' : '归档'}</button></form>`);
    const form = wrap.querySelector('.task-rename');
    const x = Math.min(box.left - base.left, base.width - form.offsetWidth - 12), y = box.bottom - base.top + 6 + form.offsetHeight > base.height ? box.top - base.top - form.offsetHeight - 6 : box.bottom - base.top + 6;
    form.style.left = Math.max(12, x) + 'px'; form.style.top = Math.max(12, y) + 'px';
    view.frames(); form.elements.title.select(); form.elements.title.focus();
  }
  function closeRename(focus){ const form = root.querySelector('#tasks .task-rename'); form?.remove(); if (focus && rename) root.querySelector(`#tasks [data-p2="task-nav-list"][data-id="${CSS.escape(rename.id)}"]`)?.focus(); rename = null; }
  function applyRename(form){
    const d = data(), list = d.lists.find(l => l.id === rename?.id), title = form.elements.title.value.trim(); if (!list || !title) return;
    if (title !== list.title && d.lists.some(l => l.title === title)) { form.elements.title.setCustomValidity('已有同名清单'); form.elements.title.reportValidity(); return; }
    const old = list.id, moved = d.tasks.filter(t => t.listId === old);
    const movedIds = moved.map(t => t.id);
    const undo = () => { const n = data(), l = n.lists.find(x => x.id === title); if (l) { l.id = old; l.title = old; } for (const t of n.tasks) if (movedIds.includes(t.id)) t.listId = old; for (const v of n.savedViews) if (v.filter?.kind === 'list' && v.filter.id === title) v.filter.id = old; if (n.ui.taskFilter.kind === 'list' && n.ui.taskFilter.id === title) n.ui.taskFilter = {kind: 'list', id: old}; };
    list.id = title; list.title = title; for (const t of moved) t.listId = title;
    for (const v of d.savedViews) if (v.filter?.kind === 'list' && v.filter.id === old) v.filter.id = title;
    if (d.ui.taskFilter.kind === 'list' && d.ui.taskFilter.id === old) d.ui.taskFilter = {kind: 'list', id: title};
    closeRename(false); render(); touch();
    feedback(`清单改名 · ${old} → ${title}`, undo);
  }
  function toggleArchive(){
    const d = data(), list = d.lists.find(l => l.id === rename?.id); if (!list) return;
    const before = list.archived; list.archived = !list.archived;
    if (list.archived && d.ui.taskFilter.kind === 'list' && d.ui.taskFilter.id === list.id) d.ui.taskFilter = {kind: 'all'};
    closeRename(false); render(); touch();
    const name = list.title; feedback((list.archived ? '已归档清单 · ' : '已取出清单 · ') + name, () => { const l = data().lists.find(x => x.id === name); if (l) l.archived = before; });
  }

  // ———— 详情纸：正文、标题、检查项模式、斜杠菜单、文本样式 ————
  const setBody = (t, text) => { t.markdown = text; t.description = text.split('\n\n')[0].replace(/^#+\s*/, ''); };
  // 正文编辑器里的字才是最新的：动别的字段之前先收回来
  function syncBody(){ const t = editor && get(editor.taskId()); if (t && editor.el.isConnected && editor.get() !== (t.markdown ?? t.description ?? '')) setBody(t, editor.get()); }
  function flushSoon(){ clearTimeout(flushTimer); flushTimer = setTimeout(() => { flushTimer = 0; touch(); }, 900); }
  function ensureEditor(){
    editor ??= createMdEditor(view, {
      onChange(text){ const t = get(editor.taskId()); if (!t) return; setBody(t, text); flushSoon(); checkSlash(); },
      onBlur(){ closeSlash(); syncBody(); clearTimeout(flushTimer); flushTimer = 0; touch(); },
    });
    return editor;
  }
  function focusBody(id){
    const d = data(); d.ui.taskDetail = id; d.ui.taskSelection = null;
    const t = get(id);
    pendingFocus = t?.mode === 'checklist' ? {selector: `[data-tp-input="check"][data-id="${CSS.escape(id)}"]`} : {body: id};
    render();
  }
  function commitTitle(el, toBody){
    const t = get(el.dataset.tpTitle); if (!t) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim(); drafts.delete('title|' + t.id);
    if (toBody) pendingFocus = t.mode === 'checklist' ? {selector: `[data-tp-input="check"][data-id="${CSS.escape(t.id)}"]`} : {body: t.id};
    if (text && text !== t.title) { const restore = snapshot([t], FIELDS); t.title = text; render(); touch(); feedback('改名 · ' + text, restore); }
    else { if (!text) el.textContent = t.title; if (toBody) render(); }
  }
  // 检查项模式：描述和每一条都直接改；回车在下面加一条，空行退格删掉
  function editChecklist(id, fn){ const t = get(id); if (!t) return null; const {desc, items} = splitChecklist(t.markdown ?? t.description); const r = fn(items, desc); setBody(t, joinChecklist(r?.desc ?? desc, items)); return t; }
  function itemKey(e, input){
    const id = input.dataset.id, i = Number(input.dataset.tpItem);
    if (e.key === 'Enter') { stop(e); editChecklist(id, items => { items.splice(i + 1, 0, {done: false, text: ''}); }); pendingFocus = {selector: `[data-tp-item="${i + 1}"][data-id="${CSS.escape(id)}"]`}; render(); touch(); return true; }
    if (e.key === 'Backspace' && !input.value) { stop(e); editChecklist(id, items => { items.splice(i, 1); }); pendingFocus = {selector: i > 0 ? `[data-tp-item="${i - 1}"][data-id="${CSS.escape(id)}"]` : `[data-tp-desc="${CSS.escape(id)}"]`}; render(); touch(); return true; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { stop(e); const next = root.querySelector(`#tasks [data-tp-item="${i + (e.key === 'ArrowDown' ? 1 : -1)}"][data-id="${CSS.escape(id)}"]`) || (e.key === 'ArrowDown' ? root.querySelector(`#tasks [data-tp-input="check"][data-id="${CSS.escape(id)}"]`) : null); next?.focus(); return true; }
    return false;
  }
  // 行首标记：标题、列表、检查项、引用互相替换
  const PREFIX = /^(\s*)(#{1,6}\s+|[-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+\.\s+|>\s?)/;
  function linePrefix(prefix, cycleHeading = false){
    const ed = ensureEditor(), {n, text, ch} = ed.line(), m = PREFIX.exec(text), old = m ? m[2] : '', rest = text.slice(m ? m[0].length : 0), indent = m ? m[1] : '';
    let next = prefix;
    if (cycleHeading) { const level = /^#{1,6}\s/.test(old) ? old.trim().length : 0; next = level >= 3 ? '' : '#'.repeat(level + 1) + ' '; }
    else if (old.trim() === prefix.trim()) next = ''; // 再点一次取消
    const line = indent + next + rest; ed.replaceLine(n, line, Math.max(indent.length + next.length, ch - (old.length - next.length))); ed.focus();
  }
  function applyStyle(kind){
    const ed = ensureEditor(); if (!ed.el.isConnected) return;
    ({h: () => linePrefix('', true), b: () => ed.wrap('**', '**'), i: () => ed.wrap('*', '*'), s: () => ed.wrap('~~', '~~'), mark: () => ed.wrap('==', '=='), code: () => ed.wrap('`', '`'), link: () => ed.wrap('[[', ']]'),
      check: () => linePrefix('- [ ] '), ul: () => linePrefix('- '), ol: () => linePrefix('1. '), quote: () => linePrefix('> '), hr: () => ed.insertBlock('---'),
      h1: () => linePrefix('# '), h2: () => linePrefix('## '), h3: () => linePrefix('### ')})[kind]?.();
  }
  // 斜杠菜单：正文里打 / 弹出（不抢焦点，接着打字就筛选，↑↓ 选，回车插入，Esc 收起）
  function checkSlash(){
    if (!editor?.hasFocus()) { closeSlash(); return; }
    const {text, ch} = editor.line(), m = /(?:^|\s)\/([^\s/]{0,8})$/.exec(text.slice(0, ch));
    if (!m) { closeSlash(); return; }
    const q = m[1], items = SLASH.filter(x => x && (!q || x[1].includes(q) || x[0].startsWith(q.toLowerCase())));
    if (!items.length) { closeSlash(); return; }
    slash = {q, ch, items, index: Math.min(slash?.q === q ? slash.index : 0, items.length - 1)};
    paintSlash();
  }
  function paintSlash(){
    let box = root.querySelector('#tasks .task-slash');
    if (!box) { box = document.createElement('div'); box.className = 'task-slash task-ctx hand-popup'; box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', '插入'); box.id = 'task-slash'; root.querySelector('#tasks').append(box); }
    const groups = slash.q ? [slash.items] : [SLASH.slice(0, SLASH.indexOf(null)), SLASH.slice(SLASH.indexOf(null) + 1)];
    let i = 0;
    box.innerHTML = groups.map(g => g.map(x => { const k = i++; return `<button type="button" role="option" id="task-slash-${k}" data-ts-slash="${x[0]}" aria-selected="${k === slash.index}"><span class="task-ctx-glyph">${x[2]}</span><span>${x[1]}</span></button>`; }).join('')).join('<hr>');
    const c = editor.caret(); placeAt(box, c.left - 12, c.bottom + 6);
    if (box.getBoundingClientRect().top < c.bottom) placeAt(box, c.left - 12, c.top - box.offsetHeight - 6);
    view.frames();
  }
  function closeSlash(){ slash = null; root.querySelector('#tasks .task-slash')?.remove(); }
  function slashKey(e){
    if (!editor?.hasFocus()) { closeSlash(); return false; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { slash.index = (slash.index + (e.key === 'ArrowDown' ? 1 : -1) + slash.items.length) % slash.items.length; paintSlash(); stop(e); return true; }
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.isComposing) { stop(e); applySlash(slash.items[slash.index][0]); return true; }
    if (e.key === 'Escape') { stop(e); closeSlash(); return true; }
    return false;
  }
  function applySlash(kind){
    if (!slash || !editor) return;
    const {q} = slash, {ch} = editor.line(), id = editor.taskId();
    closeSlash(); editor.replace(ch - q.length - 1, ch, '');
    if (kind === 'child') { want.child = id; pendingFocus = {selector: `[data-tp-input="child"][data-id="${CSS.escape(id)}"]`}; syncBody(); render(); return; }
    if (kind === 'tag') { syncBody(); openMenu(id, null, null, 'sheet', 'tag'); return; }
    applyStyle(kind);
  }

  // ———— 拖动：手绘纸签跟着指针，落点画一道墨线（左边起点表示层级）————
  function dragStart(e){
    const row = e.target.closest?.('#tasks .cargo-manifest .cargo-row'); if (!row || !onTasks()) return;
    const sel = selection(), ids = sel.includes(row.dataset.id) ? sel : [row.dataset.id], t = get(row.dataset.id); if (!t) return;
    drag = {ids, over: null};
    // 跟着指针走的是这一行的半透明影子（圆角纸片），不用浏览器自带的拖动图：自带的在不同系统上时有时无、看不清
    const r = row.getBoundingClientRect(), ghost = row.cloneNode(true);
    ghost.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    ghost.classList.remove('is-selected', 'is-multi', 'is-drag-source');
    const wrap = document.createElement('div');
    wrap.className = 'task-drag-ghost'; wrap.setAttribute('aria-hidden', 'true'); wrap.style.width = r.width + 'px';
    wrap.append(ghost);
    if (ids.length > 1) wrap.insertAdjacentHTML('beforeend', `<span class="task-drag-count mono">${ids.length}</span>`);
    root.querySelector('#tasks').append(wrap);
    wrap.style.left = '0px'; wrap.style.top = '0px';
    const o = wrap.getBoundingClientRect(); // fixed 的参照可能不是视口（祖先有 transform 时）：量一次原点
    const clamp = (v, max) => Math.max(8, Math.min(max - 8, v));
    drag.ghost = {el: wrap, ox: o.left, oy: o.top, dx: clamp(e.clientX - r.left, r.width), dy: clamp(e.clientY - r.top, r.height)};
    moveGhost(e.clientX, e.clientY);
    try { e.dataTransfer.setDragImage(BLANK, 0, 0); } catch {}
    for (const id of ids) root.querySelector(`#tasks .cargo-row[data-id="${CSS.escape(id)}"]`)?.classList.add('is-drag-source');
  }
  function moveGhost(x, y){
    const g = drag?.ghost; if (!g || (!x && !y)) return;
    g.el.style.transform = `translate(${Math.round(x - g.dx - g.ox)}px, ${Math.round(y - g.dy - g.oy)}px)`;
  }
  function dropLine(){ let line = root.querySelector('#tasks .task-drop-line'); if (!line) { line = document.createElement('div'); line.className = 'task-drop-line'; line.setAttribute('aria-hidden', 'true'); line.innerHTML = svg(circle(4, 4, 2.6, 1.3) + ink([[7,4],[400,4.4]],1.5), 400, 8).replace('<svg ', '<svg preserveAspectRatio="none" '); root.querySelector('#tasks').append(line); } return line; }
  function dragOver(e){
    if (!drag || !onTasks()) return;
    if (typing(e.target)) { e.dataTransfer.dropEffect = 'none'; return; }
    const row = e.target.closest?.('#tasks .cargo-manifest .cargo-row');
    if (!row || drag.ids.includes(row.dataset.id)) {
      drag.over = null; root.querySelector('#tasks .task-drop-line')?.remove();
      // 不是落点（或是只收筛选的“保存视图”那排）时，别留着上一个落点的框
      const zone = e.target.closest?.('#tasks [data-p2-drop]');
      if (!zone || zone.dataset.p2Drop === 'save-view:') { root.querySelectorAll('.p2-drop-active').forEach(x => x.classList.remove('p2-drop-active')); if (zone) { e.stopImmediatePropagation(); e.dataTransfer.dropEffect = 'none'; } }
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation(); e.dataTransfer.dropEffect = 'move';
    const r = row.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2, depth = Number(row.dataset.depth || 0);
    const name = row.querySelector('.cargo-task-name')?.getBoundingClientRect() || r;
    const child = after && e.clientX > name.left + 36 && depth < 3;
    drag.over = {id: row.dataset.id, after, child};
    const line = dropLine(), base = line.offsetParent?.getBoundingClientRect() || root.getBoundingClientRect();
    const left = (child ? name.left + 24 : name.left - 8) - base.left;
    line.style.left = left + 'px'; line.style.width = Math.max(40, r.right - base.left - left) + 'px'; line.style.top = ((after ? r.bottom : r.top) - base.top - 4) + 'px';
    root.querySelectorAll('.p2-drop-active').forEach(x => x.classList.remove('p2-drop-active'));
  }
  function dropOn(e){
    if (!drag || !onTasks()) return;
    // 拖着任务落到输入框上：不把拖动数据当文字插进去
    if (typing(e.target)) { stop(e); cleanupDrag(); data().ui.drag2 = null; return; }
    const d = data(), moving = drag.ids.map(get).filter(Boolean);
    if (drag.over) {
      e.preventDefault(); e.stopImmediatePropagation();
      const target = get(drag.over.id), {after, child} = drag.over; cleanupDrag(); d.ui.drag2 = null;
      if (!target || !moving.length) return;
      // 不能挂到自己的子孙下面
      const isDescendant = (id, of) => { let p = get(id)?.parentId; while (p) { if (p === of) return true; p = get(p)?.parentId; } return false; };
      if (moving.some(t => t.id === target.id || isDescendant(target.id, t.id))) return;
      const restore = snapshot(d.tasks, ['order', 'parentId', 'date', 'pinned', 'time', 'remind', 'status', 'completed']);
      const parentId = child ? target.id : target.parentId || null;
      const today = d.clock.date, group = HOST.taskGroupOf(target) || baseGroup(target, today);
      for (const t of moving) {
        t.parentId = parentId;
        if (!child && !target.parentId) {
          // 跨分组：通过拖动改期（与思索规划一致，只改日期）
          if (group === 'pinned') t.pinned = true; else if (t.pinned && group !== 'pinned') t.pinned = undefined;
          if (['today', 'later', 'overdue', 'none'].includes(group) && baseGroup(t, today) !== group) { t.date = target.date || null; if (!t.date) { t.time = undefined; t.remind = undefined; } }
          if (group === 'done' && !closed(t)) { t.status = 'done'; t.completed = today; recent.add(t.id); }
          if (group !== 'done' && closed(t)) { t.status = 'open'; t.completed = undefined; }
        }
      }
      // 同一层重新编号：10、20、30……
      const siblings = rowIds().map(get).filter(t => t && (t.parentId || null) === parentId && !moving.includes(t));
      let at = child ? siblings.length : siblings.indexOf(target) + (after ? 1 : 0);
      if (child) at = siblings.length;
      siblings.splice(Math.max(0, at), 0, ...moving);
      siblings.forEach((t, i) => { t.order = (i + 1) * 10; });
      d.ui.taskDetail = moving[0].id; pendingFocus = {row: moving[0].id};
      render(); touch();
      feedback(child ? `作为「${target.title}」的子任务` : `已移动 · ${moving.length > 1 ? moving.length + ' 项' : moving[0].title}`, restore);
      return;
    }
    const zone = e.target.closest?.('#tasks [data-p2-drop]'); if (!zone) { cleanupDrag(); return; }
    if (zone.dataset.p2Drop === 'people:') { e.preventDefault(); e.stopImmediatePropagation(); d.ui.drag2 = null; cleanupDrag(); HOST.personPickFor?.(moving.map(t => t.id)); return; } // 0.9 拖到“还有 N 人”：打开名单挑一个
    const value = zone.dataset.p2Drop, mine = /^(date:none|pin:|done:|cancel:)$/.test(value) || value.startsWith('project:');
    if (!mine && moving.length < 2) { cleanupDrag(); return; } // 单条拖到货箱、梯子、邮包：交给原型
    if (!/^(list|inbox|person|today|date|pin|done|cancel|project):/.test(value)) { cleanupDrag(); return; }
    e.preventDefault(); e.stopImmediatePropagation(); d.ui.drag2 = null; cleanupDrag();
    const restore = snapshot(moving, FIELDS);
    for (const t of moving) moveTo(t, value);
    render(); touch();
    const what = moving.length > 1 ? `${moving.length} 项` : moving[0].title;
    if (value.startsWith('project:')) { feedback(`已归入项目「${d.projects.find(p => p.id === value.slice(8))?.title || ''}」 · ${moving.length > 1 ? moving.length + ' 项' : moving[0].title}`, restore); return; }
    feedback(({'done:': '已完成 · ', 'date:none': '移出计划 · ', 'pin:': '已置顶 · ', 'cancel:': '已放弃 · '})[value] ? ({'done:': '已完成 · ', 'date:none': '移出计划 · ', 'pin:': '已置顶 · ', 'cancel:': '已放弃 · '})[value] + what : '已移动 · ' + what, restore, value === 'done:' ? 'check' : null);
  }
  function cleanupDrag(){
    drag?.ghost?.el.remove();
    root.querySelector('#tasks .task-drop-line')?.remove();
    root.querySelectorAll('#tasks .is-drag-source').forEach(x => x.classList.remove('is-drag-source'));
    drag = null;
  }

  // ———— 到点提醒（Obsidian 通知；只在潮线开着时）————
  function remind(){
    const tasks = data()?.tasks || [...view.plugin.index.tasks.values()], {date, time} = view.plugin.clock(), now = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    for (const t of tasks) {
      if (closed(t) || !t.time || !t.remind || !t.date) continue;
      const offset = remindOffset(t.remind); if (offset === null) continue;
      const due = (t.date === date ? 0 : t.date === addDays(date, 1) ? 1440 : null); if (due === null) continue;
      const at = due + Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3, 5)) - offset, key = t.id + '|' + t.date + '|' + t.time + '|' + t.remind;
      if (now >= at && now < at + 10 && !notified.has(key)) { notified.add(key); new Notice(`潮线提醒：${t.title}（${t.date === date ? '今天' : '明天'} ${t.time}）`, 8000); }
    }
  }

  // ———— 右键菜单（按滴答清单的结构，画成手绘纸条）————
  //   顶部两排：日期（今天、明天、下周、其他日期）与优先级；下面是子任务、置顶、放弃、移动到 ›、待沟通 ›、标签、副本、链接、删除。
  //   多选时作用于整组（只留整组能做的几项）。键盘：↑↓ 移动，→ / Enter 打开子菜单，← 收回，Esc 关掉并把焦点还给行。
  let menu = null; // {ids, anchor, kind: row | priority | list | sheet, sub}
  const G = {
    today: svg(ink([[1,13],[17,13]],1.2) + ink(Array.from({length: 13}, (_, i) => [9 + Math.cos(Math.PI + i * Math.PI / 12) * 4.5, 13 + Math.sin(Math.PI + i * Math.PI / 12) * 4.5]),1.2) + ink([[9,2],[9,5]],1.1), 18),
    tomorrow: svg(ink([[1,14],[17,14]],1.2) + ink(Array.from({length: 13}, (_, i) => [9 + Math.cos(Math.PI + i * Math.PI / 12) * 4, 14 + Math.sin(Math.PI + i * Math.PI / 12) * 4]),1.2) + ink([[12,4],[16,4]],1.1) + ink([[14,2],[14,6]],1.1), 18),
    week: svg(ink([[2,4],[16,4],[16,16],[2,16],[2,4]],1.1) + ink([[2,8],[16,8]],1) + ink([[6,11],[12,11]],1.2) + ink([[10,9],[12,11],[10,13]],1.1), 18),
    other: svg(ink([[2,4],[16,4],[16,16],[2,16],[2,4]],1.1) + ink([[2,8],[16,8]],1) + [6,9,12].map(x => circle(x, 12, .6, 1)).join(''), 18),
    child: svg(ink([[4,3],[4,13],[14,13]],1.2) + ink([[11,10],[14,13],[11,16]],1.1), 18),
    pin: svg(ink([[9,2],[9,10]],1.3) + ink([[5,10],[13,10]],1.3) + ink([[9,10],[9,16]],1.1), 18),
    cancel: svg(circle(9,9,6,1.1) + ink([[5,5],[13,13]],1.1), 18),
    move: svg(ink([[3,14],[6,11],[6,6],[11,3],[15,3]],1.2) + circle(15,3,1.6,1.1), 18),
    discuss: svg(ink([[2,3],[15,3],[15,11],[8,11],[5,15],[5,11],[2,11],[2,3]],1.1), 18),
    tag: svg(ink([[2,2],[9,2],[16,9],[9,16],[2,9],[2,2]],1.1) + circle(6,6,1,1), 18),
    copy: svg(ink([[6,2],[16,2],[16,12]],1.1) + ink([[2,6],[12,6],[12,16],[2,16],[2,6]],1.1), 18),
    link: svg(ink([[3,10],[7,6],[10,9]],1.2) + ink([[8,8],[11,5],[15,9]],1.2), 18),
    trash: svg(ink([[3,5],[15,5]],1.2) + ink([[5,5],[6,16],[12,16],[13,5]],1.2) + ink([[7,5],[8,2],[10,2],[11,5]],1.1), 18),
    open: svg(ink([[3,2],[12,2],[15,5],[15,16],[3,16],[3,2]],1.1) + ink([[6,8],[12,8]],1) + ink([[6,11],[12,11]],1), 18),
  };
  const more = svg(ink([[6,4],[11,9],[6,14]],1.2), 14);
  const flagOf = v => SG.flag(({highest: 3, high: 2, medium: 1, low: 0})[v]);
  function menuHtml(){
    const d = data(), tasks = menu.ids.map(get).filter(Boolean), one = tasks.length === 1 ? tasks[0] : null;
    if (menu.kind === 'priority') return PRIORITIES.map(([v, label]) => `<button type="button" role="menuitemradio" data-tm="priority" data-value="${v}" aria-checked="${one?.priority === v}"><span class="task-ctx-glyph task-flag-${v}">${flagOf(v)}</span><span>${label}优先级</span>${one?.priority === v ? '<span class="task-ctx-tick">✓</span>' : ''}</button>`).join('');
    if (menu.kind === 'list') {
      const opt = (value, glyph, label, on) => `<button type="button" role="menuitemradio" data-tm="move" data-value="${esc(value)}" data-filter="${esc(label)}" aria-checked="${!!on}"><span class="task-ctx-glyph">${glyph}</span><span>${esc(label)}</span>${on ? '<span class="task-ctx-tick">✓</span>' : ''}</button>`;
      return `<label class="task-ctx-search">${SG.search}<input data-tm-input="list" placeholder="搜索清单或项目" aria-label="搜索清单或项目" autocomplete="off"></label>
        ${opt('inbox:', SG.tray, '收件箱', !one.listId && !one.projectId)}
        ${d.lists.filter(l => !l.archived).map(l => opt('list:' + l.id, SG.list, l.title, one.listId === l.id)).join('')}
        ${d.projects.some(p => ['active', 'planned', 'paused'].includes(p.status)) ? `<hr><button type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-tm-sub="project" data-filter="项目"><span class="task-ctx-glyph">${SG.route}</span><span>项目${one.projectId ? ' · ' + esc(d.projects.find(p => p.id === one.projectId)?.title || '') : ''}</span><span class="task-ctx-more">${more}</span></button>` : ''}`;
    }
    if (menu.kind === 'sheet') {
      const item = (act, glyph, label, extra = '') => `<button type="button" role="menuitem" data-tm="${act}" ${extra}><span class="task-ctx-glyph">${glyph}</span><span>${label}</span></button>`;
      const sub = (act, glyph, label) => `<button type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-tm-sub="${act}"><span class="task-ctx-glyph">${glyph}</span><span>${label}</span><span class="task-ctx-more">${more}</span></button>`;
      return `${item('child', G.child, '添加子任务')}${item('pin', G.pin, one.pinned ? '取消置顶' : '置顶')}${item('cancel', G.cancel, one.status === 'cancelled' ? '恢复' : '放弃')}
        ${sub('tag', G.tag, '标签')}${d.people.length ? sub('discuss', G.discuss, '待沟通') : ''}${sub('project', SG.route, '关联项目')}<hr>
        ${item('duplicate', G.copy, '创建副本')}${item('link', G.link, '复制链接')}${one.id.includes('/') ? item('note', G.open, '打开笔记') : ''}<hr>
        ${item('delete', G.trash, '删除', 'class="is-danger"')}`;
    }
    const allPinned = tasks.every(t => t.pinned), allCancelled = tasks.every(t => t.status === 'cancelled');
    const item = (act, glyph, label, extra = '') => `<button type="button" role="menuitem" data-tm="${act}" ${extra}><span class="task-ctx-glyph">${glyph}</span><span>${label}</span></button>`;
    const sub = (act, glyph, label) => `<button type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-tm-sub="${act}"><span class="task-ctx-glyph">${glyph}</span><span>${label}</span><span class="task-ctx-more">${more}</span></button>`;
    const date = (v, glyph, label) => `<button type="button" role="menuitem" data-tm="date" data-value="${v}" aria-label="${label}"><span class="task-ctx-glyph">${glyph}</span><span class="task-ctx-cap">${label}</span></button>`;
    const pr = PRIORITIES.map(([v, label]) => `<button type="button" role="menuitemradio" data-tm="priority" data-value="${v}" aria-checked="${tasks.every(t => t.priority === v)}" aria-label="优先级${label}">${label}</button>`).join('');
    return `<div class="task-ctx-head">${tasks.length > 1 ? `已选 ${tasks.length} 项` : esc(one?.title || '')}</div>
      <div class="task-ctx-row" role="group" aria-label="日期"><span class="task-ctx-label">日期</span><span class="task-ctx-dates">${date(0, G.today, '今天')}${date(1, G.tomorrow, '明天')}${date(7, G.week, '下周')}${one ? date('other', G.other, '其他') : ''}</span></div>
      <div class="task-ctx-row" role="group" aria-label="优先级"><span class="task-ctx-label">优先级</span><span class="task-ctx-priority">${pr}</span></div>
      <hr>
      ${one ? item('child', G.child, '添加子任务') : ''}
      ${item('pin', G.pin, allPinned ? '取消置顶' : '置顶')}
      ${item('cancel', G.cancel, allCancelled ? '恢复' : '放弃')}
      ${sub('move', G.move, '移动到')}
      ${d.people.length ? sub('discuss', G.discuss, '待沟通') : ''}
      ${d.projects.some(OPEN_PROJECT) ? sub('project', SG.route, '关联项目') : ''}
      ${one ? sub('tag', G.tag, '标签') : ''}
      <hr>
      ${one ? item('duplicate', G.copy, '创建副本') : ''}
      ${one ? item('link', G.link, '复制链接') : ''}
      ${one && one.id.includes('/') ? item('note', G.open, '打开笔记') : ''}
      ${item('delete', G.trash, tasks.length > 1 ? `删除 ${tasks.length} 项` : '删除', 'class="is-danger"')}`;
  }
  function subHtml(kind){
    const d = data(), tasks = menu.ids.map(get).filter(Boolean);
    const opt = (value, label, on) => `<button type="button" role="menuitemradio" data-tm="${kind}" data-value="${esc(value)}" aria-checked="${!!on}"><span>${esc(label)}</span></button>`;
    if (kind === 'move') return opt('inbox:', '收件箱（移出清单）', tasks.every(t => !t.listId)) + d.lists.filter(l => !l.archived).map(l => opt('list:' + l.id, l.title, tasks.every(t => t.listId === l.id))).join('');
    if (kind === 'project') return opt('', '不关联项目', tasks.every(t => !t.projectId)) + d.projects.filter(OPEN_PROJECT).map(p => opt(p.id, p.title, tasks.every(t => t.projectId === p.id))).join('');
    if (kind === 'tag') {
      const t = tasks[0], all = [...new Set([...d.tasks.flatMap(x => x.tags || []), ...(t?.tags || [])])].sort((a, b) => a.localeCompare(b, 'zh'));
      return `<label class="task-ctx-search">${SG.search}<input data-tm-input="tag" placeholder="输入标签，回车新建" aria-label="输入标签" autocomplete="off"></label>` + all.map(tag => `<button type="button" role="menuitemcheckbox" data-tm="tagtoggle" data-value="${esc(tag)}" data-filter="${esc(tag)}" aria-checked="${!!t?.tags?.includes(tag)}"><span class="task-ctx-glyph">${t?.tags?.includes(tag) ? SG.boxDone : SG.box}</span><span>#${esc(tag)}</span></button>`).join('');
    }
    return d.people.map(p => opt('person:' + p.id, p.name, tasks.every(t => t.discuss && t.peopleIds?.includes(p.id)))).join('');
  }
  function placeAt(el, x, y, flipFrom = null){
    const wrap = root.querySelector('#tasks'), base = (el.offsetParent || wrap).getBoundingClientRect(), bounds = root.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    if (x + w > bounds.right - 10) x = flipFrom !== null ? flipFrom - w : bounds.right - 10 - w;
    if (y + h > bounds.bottom - 10) y = bounds.bottom - 10 - h;
    el.style.left = Math.max(bounds.left + 10, x) - base.left + 'px'; el.style.top = Math.max(bounds.top + 10, y) - base.top + 'px';
  }
  function openMenu(id, at, anchor = null, kind = 'row', sub = null){
    closeMenu(false); closeRename(false); closeSlash(); syncBody();
    const d = data(), sel = selection(), ids = kind === 'row' && sel.length > 1 && sel.includes(id) ? sel.slice() : [id];
    if (ids.length === 1 && (d.ui.taskDetail !== id || d.ui.taskSelection)) { d.ui.taskDetail = id; d.ui.taskSelection = null; render(); } // 先重画，再登记菜单（重画后的检查会清掉没有节点的菜单）
    menu = {ids, anchor: id, at, dots: !!anchor && kind === 'row', kind, sub}; root.dataset.taskMenu = 'open';
    mountMenu();
  }
  // 挂上菜单节点。写回引起原型整页重画时会把它清掉：layout() 发现菜单还开着就在原处重新挂上
  function mountMenu(){
    const el = document.createElement('div');
    el.className = 'task-ctx hand-popup'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', '任务菜单'); el.id = 'task-ctx';
    if (menu.kind !== 'row') { el.classList.add('task-ctx-' + menu.kind); el.setAttribute('aria-label', ({priority: '优先级', list: '所在清单', sheet: '更多'})[menu.kind]); }
    el.innerHTML = menuHtml(); root.querySelector('#tasks').append(el);
    const dots = menu.dots && root.querySelector(`#tasks .cargo-row[data-id="${CSS.escape(menu.anchor)}"] [data-p2="task-menu"]`);
    const button = menu.kind !== 'row' && root.querySelector(`#tasks .task-sheet [data-ts="${menu.kind === 'sheet' ? 'more' : menu.kind}"][data-id="${CSS.escape(menu.anchor)}"]`);
    if (button) { const r = button.getBoundingClientRect(); if (menu.kind === 'list') placeAt(el, r.left, r.top - el.offsetHeight - 6); else placeAt(el, r.right - el.offsetWidth, r.bottom + 6); }
    else if (dots) { const r = dots.getBoundingClientRect(); placeAt(el, r.right - el.offsetWidth, r.bottom + 6); } else placeAt(el, menu.at?.x ?? 0, menu.at?.y ?? 0);
    view.frames();
    const subTrigger = menu.sub && el.querySelector(`[data-tm-sub="${menu.sub}"]`);
    if (subTrigger) openSub(subTrigger, true);
    else (el.querySelector('[data-tm-input]') || el.querySelector('[aria-checked="true"]') || el.querySelector('[role^="menuitem"]'))?.focus({preventScroll: true});
    if (menu.focus) { root.querySelector('#tasks .task-ctx-sub ' + menu.focus)?.focus({preventScroll: true}); menu.focus = null; }
  }
  function openSub(trigger, focus){
    const box = root.querySelector('#tasks .task-ctx'); if (!box) return;
    closeSub();
    trigger.setAttribute('aria-expanded', 'true');
    const el = document.createElement('div');
    el.className = 'task-ctx task-ctx-sub hand-popup'; el.setAttribute('role', 'menu'); el.dataset.sub = trigger.dataset.tmSub;
    el.setAttribute('aria-label', ({move: '移动到清单', discuss: '待沟通的人', tag: '标签', project: '关联项目'})[trigger.dataset.tmSub]);
    menu.sub = trigger.dataset.tmSub;
    el.innerHTML = subHtml(trigger.dataset.tmSub); root.querySelector('#tasks').append(el);
    const r = trigger.getBoundingClientRect(), outer = box.getBoundingClientRect();
    placeAt(el, outer.right - 4, r.top - 10, outer.left + 4);
    view.frames(); if (focus) (el.querySelector('[data-tm-input]') || el.querySelector('[role^="menuitem"]'))?.focus({preventScroll: true});
  }
  function closeSub(){ if (menu) menu.sub = null; root.querySelector('#tasks .task-ctx-sub')?.remove(); root.querySelector('#tasks .task-ctx [aria-expanded="true"]')?.setAttribute('aria-expanded', 'false'); }
  function closeMenu(focus = true){
    if (!menu) return;
    const id = menu.anchor; menu = null; delete root.dataset.taskMenu;
    root.querySelectorAll('#tasks .task-ctx').forEach(x => x.remove());
    if (focus) root.querySelector(`#tasks .cargo-row[data-id="${CSS.escape(id)}"] .cargo-task-name`)?.focus({preventScroll: true});
  }
  function menuAct(button){
    const d = data(), act = button.dataset.tm, v = button.dataset.value, tasks = menu.ids.map(get).filter(Boolean), one = tasks[0];
    // 标签：点了不收起，接着勾别的
    if (act === 'tagtoggle' && one) { const restore = snapshot([one], FIELDS), on = !one.tags?.includes(v); one.tags = on ? [...(one.tags || []), v] : (one.tags || []).filter(x => x !== v); menu.focus = `[data-tm="tagtoggle"][data-value="${CSS.escape(v)}"]`; render(); touch(); feedback((on ? '加上标签 #' : '去掉标签 #') + v, restore); return; }
    const fromSheet = menu.kind !== 'row';
    closeMenu(false);
    if (!tasks.length) return;
    if (act === 'child' && fromSheet) { want.child = one.id; pendingFocus = {selector: `[data-tp-input="child"][data-id="${CSS.escape(one.id)}"]`}; render(); return; }
    if (act === 'project') { const restore = snapshot(tasks, FIELDS), p = d.projects.find(x => x.id === v); for (const t of tasks) { t.projectId = p?.id || null; t.project = p?.title; } render(); touch(); feedback(p ? '关联项目 · ' + p.title : '不再关联项目 · ' + one.title, restore); return; }
    if (act === 'date' && v === 'other') { d.ui.taskDetail = one.id; d.ui.taskDate = one.id; d.cache.taskScrollRequest = one.id; render(); root.querySelector('#tasks .cargo-date-editor input')?.focus(); return; }
    if (act === 'child') { d.ui.taskDetail = one.id; d.ui.taskSelection = null; want.child = one.id; pendingFocus = {selector: `[data-tp-input="child"][data-id="${CSS.escape(one.id)}"]`}; render(); return; }
    if (act === 'delete') { remove(tasks.map(t => t.id)); return; }
    if (act === 'duplicate') { duplicate(one); return; }
    if (act === 'link') { navigator.clipboard?.writeText(`[[${one.title}]]`).catch(() => {}); view.frame.feedback('已复制链接 · [[' + one.title + ']]'); return; }
    if (act === 'note') { view.app?.workspace?.openLinkText?.(one.id, '', true); return; }
    if (act === 'cancel' && !tasks.every(t => t.status === 'cancelled')) { setStatus(tasks.filter(t => !closed(t)), 'cancelled', tasks.length > 1 ? `已放弃 ${tasks.length} 项` : '已放弃 · ' + one.title); return; }
    const restore = snapshot(tasks, FIELDS), label = tasks.length > 1 ? `${tasks.length} 项` : one.title;
    let message = '';
    if (act === 'date') { const date = addDays(d.clock.date, Number(v)); for (const t of tasks) t.date = date; message = `${label} · ${md(date)}`; }
    else if (act === 'priority') { for (const t of tasks) t.priority = v; message = `优先级${PRIORITIES.find(p => p[0] === v)[1]} · ${label}`; }
    else if (act === 'pin') { const on = !tasks.every(t => t.pinned); for (const t of tasks) t.pinned = on || undefined; message = (on ? '已置顶 · ' : '取消置顶 · ') + label; }
    else if (act === 'cancel') { for (const t of tasks) { t.status = 'open'; t.completed = undefined; } message = '已恢复 · ' + label; }
    else if (act === 'discuss' && v.startsWith('person:') && tasks.every(t => t.discuss && t.peopleIds?.includes(v.slice(7)))) { const pid = v.slice(7); for (const t of tasks) { t.peopleIds = t.peopleIds.filter(x => x !== pid); if (!t.peopleIds.length) t.discuss = false; } message = '不再待沟通 · ' + (d.people.find(p => p.id === pid)?.name || ''); } // 0.9：已勾上的再点一次就去掉
    else if (act === 'move' || act === 'discuss') { for (const t of tasks) moveTo(t, v); const name = v.startsWith('list:') ? v.slice(5) : v.startsWith('person:') ? d.people.find(p => p.id === v.slice(7))?.name : '收件箱'; message = (act === 'move' ? '已移到 ' : '待沟通 · ') + name; }
    d.cache.taskScrollRequest = one.id;
    render(); touch();
    feedback(message, restore);
  }
  function addTag(raw){
    const tag = String(raw || '').trim().replace(/^#/, '').replace(/\s+/g, ''), t = menu && get(menu.anchor); if (!tag || !t) return;
    if (!t.tags?.includes(tag)) { const restore = snapshot([t], FIELDS); t.tags = [...(t.tags || []), tag]; menu.focus = '[data-tm-input="tag"]'; render(); touch(); feedback('加上标签 #' + tag, restore); }
  }
  function filterMenu(input){
    const q = input.value.trim().toLowerCase(), box = input.closest('.task-ctx');
    for (const b of box.querySelectorAll('[data-filter]')) b.hidden = !!q && !b.dataset.filter.toLowerCase().includes(q);
    for (const hr of box.querySelectorAll('hr')) hr.hidden = !!q;
  }
  function menuKey(e){
    const items = box => [...box.querySelectorAll('[role^="menuitem"]')];
    const sub = root.querySelector('#tasks .task-ctx-sub'), main = root.querySelector('#tasks .task-ctx:not(.task-ctx-sub)');
    if (!main) { menu = null; delete root.dataset.taskMenu; return; } // 原型重画时把菜单一起清掉了
    const inSub = !!sub?.contains(document.activeElement), box = inSub ? sub : main, list = items(box).filter(x => !x.hidden), i = list.indexOf(document.activeElement);
    const search = document.activeElement?.matches?.('[data-tm-input]') ? document.activeElement : null;
    if (search && e.key === 'Enter' && !e.isComposing) { stop(e); if (search.dataset.tmInput === 'tag') addTag(search.value); else list[0]?.click(); return; }
    if (search && e.key === 'ArrowDown') { stop(e); list[0]?.focus({preventScroll: true}); return; }
    if (search && e.key === 'ArrowLeft' && inSub && !search.value) { const name = sub.dataset.sub; closeSub(); main.querySelector(`[data-tm-sub="${name}"]`)?.focus(); stop(e); return; }
    if (search && !['Escape', 'Tab', 'ArrowUp'].includes(e.key)) return; // 让字打进搜索框
    if (e.key === 'Escape') { if (inSub) { const name = sub.dataset.sub; closeSub(); main.querySelector(`[data-tm-sub="${name}"]`)?.focus(); } else closeMenu(true); stop(e); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') { const n = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length; list[n]?.focus({preventScroll: true}); stop(e); return; }
    if (e.key === 'ArrowRight' && document.activeElement?.dataset.tmSub) { openSub(document.activeElement, true); stop(e); return; }
    if (e.key === 'ArrowLeft' && inSub) { const name = sub.dataset.sub; closeSub(); main.querySelector(`[data-tm-sub="${name}"]`)?.focus(); stop(e); return; }
    if (e.key === 'Tab') { closeMenu(true); stop(e); }
  }

  // ———— 事件（捕获阶段，在原型之前）————
  view.registerDomEvent(root, 'click', e => {
    if (!onTasks()) return;
    const d = data();
    if (menu) {
      // 有二级菜单的项：点了展开并把焦点交给二级菜单（指针移上去时已经展开过，点一下不会又收起）
      const sub = e.target.closest('[data-tm-sub]'); if (sub) { stop(e); clearTimeout(hoverTimer); if (sub.getAttribute('aria-expanded') !== 'true') openSub(sub, false); (root.querySelector('#tasks .task-ctx-sub [data-tm-input]') || root.querySelector('#tasks .task-ctx-sub [role^="menuitem"]'))?.focus({preventScroll: true}); return; }
      const item = e.target.closest('[data-tm]'); if (item) { stop(e); menuAct(item); return; }
      if (e.target.closest('.task-ctx')) { stop(e); return; }
      closeMenu(false);
    }
    if (e.target.closest('[data-p2="task-nav-new-list"]')) { stop(e); if (navAdd) closeNavAdd(false); else openNavAdd(); return; }
    // 行尾的“⋯”也打开同一个菜单（详情里的“移到清单”仍是原来的移动纸条）
    const dots = e.target.closest('#tasks .cargo-row [data-p2="task-menu"]'); if (dots) { stop(e); const r = dots.getBoundingClientRect(); openMenu(dots.dataset.id, {x: r.right - 244, y: r.bottom + 6}, dots); return; }
    const suggestion = e.target.closest('[data-tp-suggest]'); if (suggestion) { stop(e); choose(Number(suggestion.dataset.tpSuggest)); return; }
    if (suggest && !e.target.closest('#cargo-task-input')) closeSuggest();
    const quick = e.target.closest('[data-tp-quick]');
    if (quick) { stop(e); const form = quick.closest('form'), field = form.elements.date, n = quick.dataset.tpQuick; field.value = n === '' ? '' : n === 'm' ? addMonths(d.clock.date, 1) : addDays(d.clock.date, Number(n)); field.dispatchEvent(new Event('input', {bubbles: true})); field.setCustomValidity?.(''); return; }
    const listButton = e.target.closest('[data-tp-list]'); if (listButton) { stop(e); toggleArchive(); return; }
    if (rename && !e.target.closest('.task-rename')) closeRename(false);
    const ts = e.target.closest('[data-ts]');
    if (ts) {
      stop(e); const id = ts.dataset.id, k = ts.dataset.ts;
      if (k === 'priority' || k === 'list' || k === 'more') { openMenu(id, null, ts, k === 'more' ? 'sheet' : k); return; }
      if (k === 'style') { syncBody(); d.ui.taskToolbar = !d.ui.taskToolbar; pendingFocus = d.ui.taskToolbar ? {body: id} : null; render(); return; }
      if (k === 'comment') { syncBody(); want.comment = want.comment === id && !get(id)?.comments?.length ? null : id; pendingFocus = want.comment ? {selector: `[data-tp-input="comment"][data-id="${CSS.escape(id)}"]`} : null; render(); return; }
    }
    const slashItem = e.target.closest('[data-ts-slash]'); if (slashItem) { stop(e); applySlash(slashItem.dataset.tsSlash); return; }
    const tf = e.target.closest('[data-tf]'); if (tf) { stop(e); applyStyle(tf.dataset.tf); return; }
    if (slash && !e.target.closest('.task-md-editor')) closeSlash();
    const b = e.target.closest('[data-tp]'); if (b) { stop(e); act(b); return; }
    const tb = e.target.closest('[data-tb]'); if (tb) { stop(e); batch(tb.dataset.tb, tb.dataset.value); return; }
    const row = e.target.closest('#tasks .cargo-manifest .cargo-row');
    if (row && (e.ctrlKey || e.metaKey || e.shiftKey) && !e.target.closest('.p2-check')) { stop(e); select(row.dataset.id, {range: e.shiftKey, toggle: !e.shiftKey}); return; }
    if (row && !e.target.closest('.p2-check')) { if (selection().length) d.ui.taskSelection = null; d.ui.taskSelectAnchor = row.dataset.id; if (e.target.closest('.cargo-task-name')) pendingFocus = {row: row.dataset.id}; }
    composerWanted = !!e.target.closest('#cargo-task-input');
  }, {capture: true});
  // 焦点可能在页面主体上（原型重画后）：在文档上听，但只在潮线是当前视图、焦点在插件里或无处可去时处理
  const active = () => { const leaf = view.app?.workspace?.activeLeaf; return !leaf || leaf.view === view; };
  // 在这些地方打字时，写回引起的回声重画先等一等（任务详情、项目标题、项目里的新建任务、左侧新建清单）
  const HOLD = '#tasks .task-sheet, [data-pp-title], [data-tl-form="project-task"], [data-tp-form="nav-list"]';
  view.registerDomEvent(document, 'keydown', e => { if (e.target?.closest?.(HOLD) && typing(e.target)) lastSheetKey = performance.now(); }, {capture: true});
  view.registerDomEvent(root, 'keydown', e => { if (e.key === 'Escape' && e.target.closest?.('[data-tp-form="nav-list"]')) { stop(e); closeNavAdd(true); } }, {capture: true});
  view.registerDomEvent(document, 'keydown', e => { if (!root.isConnected) return; const ae = document.activeElement; if (root.contains(ae) || ((!ae || ae === document.body) && active())) key(e); }, {capture: true});
  view.registerDomEvent(root, 'input', e => {
    if (e.target.closest?.('[data-tl-form="project-task"]')) { drafts.set('ptask|' + e.target.form.dataset.id, e.target.value); return; }
    if (!onTasks()) return;
    if (e.target.id === 'cargo-task-input') { paintTokens(e.target); openSuggest(e.target); }
    if (e.target.matches?.('[data-tp-input]')) drafts.set(e.target.dataset.tpInput + '|' + e.target.dataset.id, e.target.value);
    if (e.target.matches?.('[data-tp-title]')) drafts.set('title|' + e.target.dataset.tpTitle, e.target.textContent);
    if (e.target.matches?.('[data-tm-input]')) filterMenu(e.target);
    if (e.target.closest?.('[data-tp-form="nav-list"]') && navAdd) { navAdd.draft = e.target.value; e.target.setCustomValidity(''); }
    if (e.target.matches?.('[data-tp-desc]')) { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; editChecklist(el.dataset.tpDesc, () => ({desc: el.value})); flushSoon(); }
    if (e.target.matches?.('[data-tp-item]')) { const el = e.target; editChecklist(el.dataset.id, items => { if (items[Number(el.dataset.tpItem)]) items[Number(el.dataset.tpItem)].text = el.value; }); flushSoon(); }
    if (e.target.closest?.('.cargo-date-editor')) {
      const form = e.target.closest('.cargo-date-editor');
      if (e.target.name === 'repeat') { form.querySelector('.task-repeat-custom').hidden = e.target.value !== 'custom'; }
      if (e.target.name === 'repeatCustom') e.target.setCustomValidity('');
    }
  }, {capture: true});
  view.registerDomEvent(root, 'change', e => { if (onTasks() && e.target.name === 'repeat' && e.target.closest('.cargo-date-editor')) e.target.closest('.cargo-date-editor').querySelector('.task-repeat-custom').hidden = e.target.value !== 'custom'; }, {capture: true});
  view.registerDomEvent(root, 'submit', e => {
    if (e.target.matches?.('[data-tl-form="project-task"]')) { stop(e); addProjectTask(e.target); return; }
    if (!onTasks()) return;
    const form = e.target;
    if (form.matches('.cargo-date-editor')) { stop(e); saveDate(form); return; }
    if (form.matches('[data-tp-form="rename"]')) { stop(e); applyRename(form); return; }
    if (form.matches('[data-tp-form="nav-list"]')) { stop(e); addNavList(form); return; }
    if (form.matches('[data-tp-form="move"]')) { stop(e); batch('move', form.elements.to.value); return; }
    if (form.matches('[data-p2-form="cargo-task"]')) { closeSuggest(); root.querySelector('#tasks .cargo-tokens')?.remove(); composerWanted = true; }
  }, {capture: true});
  view.registerDomEvent(root, 'contextmenu', e => {
    if (!onTasks()) return;
    const row = e.target.closest('#tasks .cargo-manifest .cargo-row');
    if (row) { stop(e); openMenu(row.dataset.id, {x: e.clientX, y: e.clientY}); return; }
    const list = e.target.closest('#tasks [data-p2="task-nav-list"], #tasks .cargo-crate[data-p2-drop^="list:"]');
    if (!list) return;
    stop(e); openRename(list.dataset.id, list);
  }, {capture: true});
  // 指针移到有二级菜单的项上就展开（稍等一下，斜着划向二级菜单时不会被路过的项收起）；移到别的项上收起
  let hoverTimer = 0;
  view.registerDomEvent(root, 'mouseover', e => {
    if (!menu || !onTasks()) return;
    if (e.target.closest?.('#tasks .task-ctx-sub')) { clearTimeout(hoverTimer); return; }
    if (!e.target.closest?.('#tasks .task-ctx')) return;
    const item = e.target.closest('[data-tm-sub],[role^="menuitem"],[data-tm-input]'); if (!item) return;
    clearTimeout(hoverTimer);
    if (item.dataset.tmSub) { if (item.getAttribute('aria-expanded') !== 'true') hoverTimer = setTimeout(() => { if (menu && item.isConnected) openSub(item, false); }, 140); }
    else if (root.querySelector('#tasks .task-ctx-sub')) hoverTimer = setTimeout(() => { if (!menu || !item.isConnected) return; const inSub = !!root.querySelector('#tasks .task-ctx-sub')?.contains(document.activeElement); closeSub(); if (inSub) item.focus({preventScroll: true}); }, 300);
  }, {capture: true});
  // 用户滚动（滚轮）时收起菜单；重画恢复滚动位置引起的 scroll 不算
  view.registerDomEvent(root, 'wheel', e => { if (menu && !e.target.closest?.('.task-ctx')) closeMenu(false); }, {capture: true, passive: true});
  const wantedOf = el => el.matches?.('[data-tp-input]') ? `[data-tp-input="${el.dataset.tpInput}"][data-id="${CSS.escape(el.dataset.id)}"]`
    : el.matches?.('[data-tp-title]') ? `[data-tp-title="${CSS.escape(el.dataset.tpTitle)}"]` : el.matches?.('[data-tp-desc]') ? `[data-tp-desc="${CSS.escape(el.dataset.tpDesc)}"]`
    : el.matches?.('[data-tp-item]') ? `[data-tp-item="${el.dataset.tpItem}"][data-id="${CSS.escape(el.dataset.id)}"]` : null;
  view.registerDomEvent(root, 'focusin', e => { if (navAdd) navAdd.focus = !!e.target.closest?.('[data-tp-form="nav-list"]'); composerWanted = e.target.id === 'cargo-task-input'; inputWanted = wantedOf(e.target); projectWanted = e.target.closest?.('[data-tl-form="project-task"]')?.dataset.id || null; }, {capture: true});
  // 标题离开就保存（重画时被摘下不算离开）
  view.registerDomEvent(root, 'focusout', e => {
    const nav = e.target.closest?.('[data-tp-form="nav-list"]');
    // 离开横线：空着就收起（点别处常会引起整页重画，旧的横线已被换掉，所以按草稿判断，不看节点还在不在）
    if (nav) setTimeout(() => { if (!navAdd || document.activeElement?.closest?.('[data-tp-form="nav-list"]')) return; navAdd.focus = false; if (!(navAdd.draft || '').trim()) closeNavAdd(false); }, 0);
    const el = e.target.closest?.('[data-tp-title]'); if (!el) return;
    setTimeout(() => { if (!el.isConnected || el === document.activeElement || !onTasks()) return; if (drafts.has('title|' + el.dataset.tpTitle)) commitTitle(el, false); }, 0);
    if (e.target.matches?.('[data-tp-desc],[data-tp-item]')) setTimeout(() => { if (e.target.isConnected && !e.target.contains(document.activeElement)) { clearTimeout(flushTimer); flushTimer = 0; touch(); } }, 0);
  }, {capture: true});
  view.registerDomEvent(root, 'input', e => { const h = e.target.closest?.('[data-pp-title]'); if (h) projectTitle = {id: h.dataset.ppTitle, text: h.textContent, focus: true}; }, {capture: true});
  view.registerDomEvent(root, 'keydown', e => {
    const h = e.target.closest?.('[data-pp-title]'); if (!h) return;
    if (e.key === 'Enter' && !e.isComposing) { stop(e); commitProjectTitle(h); h.blur(); }
    else if (e.key === 'Escape') { stop(e); projectTitle = null; const p = data()?.projects.find(x => x.id === h.dataset.ppTitle); if (p) h.textContent = p.title; h.blur(); }
    else e.stopPropagation(); // 打字时不触发页面的快捷键
  }, {capture: true});
  view.registerDomEvent(root, 'focusin', e => { if (e.target.closest?.('[data-pp-title]') && projectTitle) projectTitle.focus = true; }, {capture: true});
  view.registerDomEvent(root, 'focusout', e => { const h = e.target.closest?.('[data-pp-title]'); if (!h) return; setTimeout(() => { if (!h.isConnected || h === document.activeElement) return; if (projectTitle) { projectTitle.focus = false; commitProjectTitle(h); } }, 0); }, {capture: true});
  view.registerDomEvent(root, 'click', e => { if (e.target.closest?.('[data-tl="project-task-new"]')) { e.preventDefault(); e.stopImmediatePropagation(); const input = root.querySelector('#projects [data-tl-form="project-task"] input'); input?.scrollIntoView({block: 'nearest'}); input?.focus(); } }, {capture: true});
  // 标题只收纯文字（粘贴进来的换行变空格）
  view.registerDomEvent(root, 'paste', e => { const el = e.target.closest?.('[data-tp-title],[data-pp-title]'); if (!el) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' ')); }, {capture: true});
  // 点文本样式和斜杠菜单不让正文失去焦点（选中的字还在）
  view.registerDomEvent(root, 'mousedown', e => { if (e.target.closest?.('[data-tf],[data-ts-slash]')) e.preventDefault(); }, {capture: true});
  view.registerDomEvent(root, 'dragstart', dragStart, {capture: true});
  view.registerDomEvent(root, 'dragover', dragOver, {capture: true});
  view.registerDomEvent(root, 'drop', dropOn, {capture: true});
  view.registerDomEvent(root, 'dragend', () => cleanupDrag(), {capture: true});
  // 指针在窗口里任何地方移动都让影子跟上（离开潮线的区域也跟着）
  view.registerDomEvent(document, 'dragover', e => { if (drag) moveGhost(e.clientX, e.clientY); }, {capture: true});
  // 正文编辑：离开编辑区就保存（Esc 仍是放弃）
  view.registerDomEvent(root, 'focusout', e => {
    const area = e.target.closest?.('[data-task-edit-body],[data-task-edit-title]'); if (!area || !onTasks()) return;
    const id = area.dataset.taskEditBody || area.dataset.taskEditTitle;
    setTimeout(() => {
      const active = document.activeElement;
      if (active?.closest?.('[data-task-edit-body],[data-task-edit-title],.cargo-edit-tools') || !data()?.ui.taskEdits?.[id]) return;
      root.querySelector(`#tasks [data-p2="task-edit-save"][data-id="${CSS.escape(id)}"]`)?.click();
    }, 0);
  }, {capture: true});
  ticker = window.setInterval(remind, 30000); view.registerInterval?.(ticker);

  return {
    complete,
    // 每次画完之后：分组标题当落点、日期纸条补字段、批量纸、恢复焦点
    layout(){
      if (view.page === 'projects') projectLayout();
      if (projectWanted && view.page === 'projects') {
        const input = root.querySelector(`[data-tl-form="project-task"][data-id="${CSS.escape(projectWanted)}"] input`), lost = !document.activeElement || document.activeElement === document.body || !root.contains(document.activeElement);
        if (input && lost) input.focus({preventScroll: true});
      }
      if (!onTasks()) return;
      if (drag?.ghost && !drag.ghost.el.isConnected) root.querySelector('#tasks')?.append(drag.ghost.el);
      if (menu && !root.querySelector('#tasks .task-ctx')) { if (menu.ids.some(get)) mountMenu(); else { menu = null; delete root.dataset.taskMenu; } }
      for (const g of root.querySelectorAll('#tasks .cargo-group')) {
        const k = g.dataset.id, drop = {today: 'today:', none: 'date:none', pinned: 'pin:', done: 'done:'}[k];
        if (drop && g.dataset.p2Drop !== drop) g.dataset.p2Drop = drop;
      }
      // 左侧导航与“最近完成”书签也能当落点（拖到今天、收件箱、某个清单、已完成）；拖到右下角的归档箱即放弃（可撤销）
      const zones = [['[data-p2="task-nav-today"]', () => 'today:'], ['[data-p2="task-nav-inbox"]', () => 'inbox:'], ['[data-p2="task-filter-done"]', () => 'done:'], ['[data-p2="task-nav-list"]', el => 'list:' + el.dataset.id], ['.cargo-archive', () => 'cancel:'], ['[data-p2="task-nav-project"]', el => 'project:' + el.dataset.id]];
      for (const [sel, value] of zones) for (const el of root.querySelectorAll('#tasks ' + sel)) { const v = value(el); if (el.dataset.p2Drop !== v) el.dataset.p2Drop = v; }
      enhanceDateEditor();
      batchPanel();
      const navInput = paintNavAdd();
      if (navInput && navAdd.focus && (document.activeElement === document.body || !document.activeElement || !root.contains(document.activeElement))) { navInput.focus({preventScroll: true}); caretEnd(navInput); }
      const slot = root.querySelector('#tasks .task-md-host'), slotTask = slot && get(slot.dataset.id);
      if (slotTask && editor && editor.taskId() === slotTask.id && (flushTimer || editor.editing())) { const text = editor.get(); if (text !== (slotTask.markdown ?? slotTask.description ?? '')) setBody(slotTask, text); }
      if (slotTask) ensureEditor().attach(slot, slotTask);
      for (const el of root.querySelectorAll('#tasks [data-tp-desc]')) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
      if (want.child && want.child !== data().ui.taskDetail) want.child = null;
      if (want.comment && want.comment !== data().ui.taskDetail) want.comment = null;
      if (slash && !root.querySelector('#tasks .task-slash')) { if (editor?.hasFocus()) paintSlash(); else slash = null; }
      const composer = root.querySelector('#cargo-task-input');
      const lost = document.activeElement === document.body || !document.activeElement || !root.contains(document.activeElement);
      if (composerWanted && composer && lost) composer.focus({preventScroll: true});
      const detailInput = inputWanted && !pendingFocus && root.querySelector('#tasks ' + inputWanted);
      if (detailInput && lost) { detailInput.focus({preventScroll: true}); caretEnd(detailInput); }
      if (pendingFocus) {
        const f = pendingFocus; pendingFocus = null;
        if (f.body) { if (editor?.el.isConnected) editor.focus(); }
        else {
          const el = f.row ? root.querySelector(`#tasks .cargo-row[data-id="${CSS.escape(f.row)}"] .cargo-task-name`) : root.querySelector('#tasks ' + f.selector);
          el?.focus({preventScroll: false}); if (el && !f.row) caretEnd(el);
        }
      }
    },
    // 在详情里打字（标题、正文、检查项、评论……）时，写回引起的回声重画先等一等：返回还要等几毫秒，0 表示照常画
    holdRender(){
      if (allowRender || !data()) return 0;
      const ae = document.activeElement; if (!ae?.closest?.(HOLD) || !typing(ae)) return 0;
      const left = 1200 - (performance.now() - lastSheetKey);
      return left > 0 ? Math.ceil(left) : 0;
    },
    leave(){ navAdd = null; clearTimeout(hoverTimer); syncBody(); if (flushTimer) { clearTimeout(flushTimer); flushTimer = 0; touch(); } closeMenu(false); closeSuggest(); closeSlash(); closeRename(false); cleanupDrag(); if (data()) data().ui.taskSelection = null; },
    destroy(){ editor?.destroy(); editor = null; },
  };
}
