// 目标（0.8，使用者 2026-11-09）：目标仍是仓库里 目标/ 下的笔记，这里补上“建、改、连”。
//   思索页 › 规划：目标一排每页三个，末尾“+”新建（原位写名字）、‹ › 翻页、“已达成 N”收起或展开达成的目标；
//                  点一个目标弹出详情纸：标题、每周计划投入（± 0.5h）、截止日期、状态（进行中 / 暂停到某天 / 达成）、
//                  关联项目（× 取消、+ 搜索添加）、本周每个项目投入了几小时、在 Obsidian 打开、删除（5 秒内可撤销）。
//   项目页 › 项目详情 › 关联目标：标签后面有 ×，末尾 + 打开可搜索的目标纸条（没有同名的就“新建目标”）。
//   项目页点目标：回到规划并打开它的详情纸，那一格闪一下。
// 关联只写在项目笔记的 goals 里（目标笔记不存项目），改动都在 d 上，由 persist.js 写回。
import {esc, icon, ink, smearProgress, circle, TICK} from '../draw/ink.js';
import {HOST} from '../host.js';
import {markDeleted, restoreDeleted} from '../data/trash.js';

const PER = 3, STEP = .5, MAX = 80;
const pad = n => String(n).padStart(2, '0');
const md = date => date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : '';
const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const STATUS = [['active', '进行中'], ['paused', '暂停'], ['done', '达成']];
const hours = n => (Math.round(n * 100) / 100) + 'h';
// 手绘的小勾与小旗（达成、截止）
const tick = `<svg class="goal-tick" viewBox="0 0 16 16" aria-hidden="true">${ink([[3, 8.5], [6.5, 12], [13, 4]], 1.5)}</svg>`;
const flag = `<svg class="goal-flag" viewBox="0 0 14 14" aria-hidden="true">${ink([[3, 13], [3, 1.5]], 1.2)}${ink([[3, 2], [11, 3.6], [3, 7.2]], 1.1)}</svg>`;
const underline = `<svg viewBox="0 0 160 6" preserveAspectRatio="none" aria-hidden="true">${ink([[0, 4], [80, 3.6], [160, 4]], .9, TICK)}</svg>`;

export function createGoals({core, view, render}){
  const d = core.data, $ = s => HOST.querySelector(s);
  const goalOf = id => d.goals.find(g => g.id === id);
  const today = () => d.clock.date;
  const linked = g => d.projects.filter(p => (p.goalIds || []).includes(g.id));
  const touch = () => view.lower?.touch?.();
  const announce = (msg, undo) => view.frame.feedback(msg, undo);
  const shown = () => d.goals.filter(g => d.ui.goalsDone ? true : g.status !== 'done');
  const overdue = g => g.due && g.status !== 'done' && g.due < today();
  d.ui.goalPage ??= 0;

  // —— 规划里的一排 ——
  function goalButton(g){
    const done = g.status === 'done', paused = g.status === 'paused';
    const state = done ? `已达成${g.completed ? '于' + g.completed : ''}` : paused ? (g.resume ? '暂停，恢复于' + g.resume : '暂停') : `本周投入 ${g.spent}h / ${g.planned}h`;
    const mark = done ? `<span class="goal-done">${tick}${g.completed ? `<span class="mono">${md(g.completed)}</span>` : ''}</span>` : paused ? `<span class="resume">${g.resume || '暂停'}</span>` : smearProgress(g.spent, g.planned, 126, g.id);
    const due = g.due && !done ? `<small class="goal-due ${overdue(g) ? 'overdue' : ''}">${flag}${md(g.due)}</small>` : '';
    return `<button class="goal ${paused ? 'paused' : ''} ${done ? 'is-done' : ''} ${d.ui.goal === g.id ? 'is-open' : ''} ${d.ui.goalFlash === g.id ? 'is-flash' : ''}" data-goal="${esc(g.id)}" aria-expanded="${d.ui.goal === g.id}" aria-label="${esc(g.title)}，${state}${g.due ? '，截止 ' + g.due : ''}"><span class="goal-name">${esc(g.title)}</span>${mark}${due}</button>`;
  }
  function row(){
    const list = shown(), pages = Math.max(1, Math.ceil(list.length / PER));
    // 打开的那个目标（从项目页跳过来的）要在当前这一页
    const at = list.findIndex(g => g.id === d.ui.goal); if (at >= 0 && d.ui.goalFlash) d.ui.goalPage = Math.floor(at / PER);
    d.ui.goalPage = Math.max(0, Math.min(pages - 1, d.ui.goalPage));
    const page = list.slice(d.ui.goalPage * PER, d.ui.goalPage * PER + PER), doneCount = d.goals.filter(g => g.status === 'done').length;
    const cells = page.map(goalButton).join('') + (page.length < PER && d.ui.goalNew ? newForm() : '') + '<span class="goal-filler" aria-hidden="true"></span>'.repeat(Math.max(0, PER - page.length - (page.length < PER && d.ui.goalNew ? 1 : 0)));
    const paging = pages > 1 ? `<span class="goal-paging"><button type="button" data-goal-page="-1" aria-label="上一页目标" ${d.ui.goalPage ? '' : 'disabled'}>‹</button><span class="mono">${d.ui.goalPage + 1}/${pages}</span><button type="button" data-goal-page="1" aria-label="下一页目标" ${d.ui.goalPage < pages - 1 ? '' : 'disabled'}>›</button></span>` : '';
    const tools = `<div class="goal-tools">${page.length >= PER && d.ui.goalNew ? newForm() : `<button type="button" class="goal-add" data-goal-act="new" aria-label="新建目标">${icon('plus', 18)}</button>`}${paging}${doneCount ? `<button type="button" class="goal-done-toggle" data-goal-act="toggle-done" aria-pressed="${!!d.ui.goalsDone}">${d.ui.goalsDone ? '收起已达成' : '已达成 ' + doneCount}</button>` : ''}</div>`;
    const empty = !d.goals.length && !d.ui.goalNew ? '<button type="button" class="goal-empty" data-goal-act="new">写下第一个目标：每周想往哪里投时间</button>' : '';
    return (empty || cells) + tools;
  }
  const newForm = () => `<form class="goal-new" data-goal-form="new"><input name="title" placeholder="目标名称，回车" aria-label="新目标的名称" autocomplete="off" spellcheck="false">${underline}</form>`;

  // —— 详情纸 ——
  function calendar(kind, value){
    const month = d.ui.goalCalMonth || (validDate(value) ? value : today()).slice(0, 7), [y, m] = month.split('-').map(Number);
    const start = new Date(month + '-01T12:00:00Z'), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const first = (start.getUTCDay() + 6) % 7, days = end.getUTCDate();
    return `<div class="goal-cal" role="dialog" aria-label="${kind === 'due' ? '选择截止日期' : '选择恢复日期'}"><div class="goal-cal-month"><button type="button" data-goal-month="-1" aria-label="上个月">‹</button><span>${y} 年 ${m} 月</span><button type="button" data-goal-month="1" aria-label="下个月">›</button></div>
      <div class="goal-cal-grid">${[...'一二三四五六日'].map(x => `<span>${x}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({length: days}, (_, i) => { const date = `${month}-${pad(i + 1)}`; return `<button type="button" data-goal-day="${date}" aria-label="${date}" aria-pressed="${date === value}" ${date === today() ? 'aria-current="date"' : ''}>${i + 1}</button>`; }).join('')}</div>
      <div class="goal-cal-foot"><button type="button" data-goal-day="${today()}">今天</button>${value ? `<button type="button" data-goal-day="">${kind === 'due' ? '不设截止' : '不定日期'}</button>` : ''}</div></div>`;
  }
  function picker(kind, g){ // kind: 'project'（给目标挑项目）或 'goal'（给项目挑目标）
    const q = (d.ui.goalPickQuery || '').trim(), has = s => !q || s.toLowerCase().includes(q.toLowerCase());
    const items = kind === 'project'
      ? d.projects.filter(p => !(p.goalIds || []).includes(g.id) && has(p.title)).sort((a, b) => (a.status === 'done') - (b.status === 'done')).map(p => `<button type="button" role="option" data-goal-pick="${esc(p.id)}">${icon('route', 15)}<span>${esc(p.title)}</span>${p.status === 'done' ? '<small>已完成</small>' : ''}</button>`)
      : d.goals.filter(x => !(g.goalIds || []).includes(x.id) && has(x.title)).map(x => `<button type="button" role="option" data-goal-pick="${esc(x.id)}">${flag}<span>${esc(x.title)}</span>${x.status === 'done' ? '<small>已达成</small>' : ''}</button>`);
    const create = kind === 'goal' && q && !d.goals.some(x => x.title === q) ? `<button type="button" role="option" data-goal-pick-new="${esc(q)}">${icon('plus', 15)}<span>新建目标“${esc(q)}”</span></button>` : '';
    return `<div class="goal-pick hand-popup" role="listbox" aria-label="${kind === 'project' ? '关联项目' : '关联目标'}"><label class="goal-pick-search">${icon('search', 15)}<input data-goal-pick-query value="${esc(d.ui.goalPickQuery || '')}" placeholder="${kind === 'project' ? '搜索项目' : '搜索或新建目标'}" aria-label="${kind === 'project' ? '搜索项目' : '搜索或新建目标'}" autocomplete="off"></label><div class="goal-pick-items">${items.join('') + create || `<p>${kind === 'project' ? '没有可关联的项目' : '没有可关联的目标'}</p>`}</div></div>`;
  }
  function paper(g){
    const projects = linked(g), status = g.status || 'active', cal = d.ui.goalCal;
    const week = projects.length ? projects.map(p => `<li><span>${esc(p.title)}</span><span class="mono">${hours(g.byProject?.find(x => x.id === p.id)?.hours || 0)}</span></li>`).join('') : '<li class="goal-muted">还没有关联项目：在今日页给项目记投入，就会算进这里</li>';
    return `<div class="goal-paper hand-popup" id="goal-paper" tabindex="-1" role="dialog" aria-label="目标：${esc(g.title)}">
      <button type="button" class="inline-close" data-goal-act="close" aria-label="关上目标详情">×</button>
      <form class="goal-title-form" data-goal-form="title"><input name="title" class="goal-title" value="${esc(g.title)}" aria-label="目标名称" autocomplete="off" spellcheck="false">${underline}</form>
      <div class="goal-field"><span class="goal-label">每周计划</span><span class="goal-stepper"><button type="button" data-goal-act="minus" aria-label="少 0.5 小时" ${g.planned > 0 ? '' : 'disabled'}>−</button><b class="mono" aria-live="polite">${hours(g.planned)}</b><button type="button" data-goal-act="plus" aria-label="多 0.5 小时">+</button></span></div>
      <div class="goal-field"><span class="goal-label">截止</span><button type="button" class="goal-date ${overdue(g) ? 'overdue' : ''}" data-goal-act="cal-due" aria-expanded="${cal === 'due'}">${flag}<span>${g.due ? g.due + (overdue(g) ? ' · 已过' : '') : '不设'}</span></button></div>
      ${cal === 'due' ? calendar('due', g.due) : ''}
      <div class="goal-field"><span class="goal-label">状态</span><span class="goal-status" role="radiogroup" aria-label="目标状态">${STATUS.map(([k, t]) => `<button type="button" role="radio" aria-checked="${status === k}" data-goal-status="${k}">${t}</button>`).join('')}</span></div>
      ${status === 'paused' ? `<div class="goal-field"><span class="goal-label">回来</span><button type="button" class="goal-date" data-goal-act="cal-resume" aria-expanded="${cal === 'resume'}">${icon('sunrise', 15)}<span>${g.resumeDate || '不定日期'}</span></button></div>${cal === 'resume' ? calendar('resume', g.resumeDate) : ''}` : ''}
      ${status === 'done' ? `<div class="goal-field"><span class="goal-label">达成于</span><span class="mono">${g.completed || today()}</span></div>` : ''}
      <div class="goal-field goal-projects"><span class="goal-label">项目</span><span class="goal-chips">${projects.map(p => `<span class="goal-chip"><button type="button" data-goal-open-project="${esc(p.id)}">${esc(p.title)}</button><button type="button" class="goal-chip-x" data-goal-unlink="${esc(p.id)}" aria-label="取消关联 ${esc(p.title)}">×</button></span>`).join('')}<button type="button" class="goal-chip-add" data-goal-act="pick" aria-expanded="${d.ui.goalPick === g.id}" aria-label="关联项目">${icon('plus', 15)}</button></span></div>
      ${d.ui.goalPick === g.id ? picker('project', g) : ''}
      <div class="goal-week"><p><span>本周投入</span><b class="mono">${hours(g.spent)} / ${hours(g.planned)}</b></p><ul>${week}</ul></div>
      <div class="goal-foot"><button type="button" data-goal-act="open-note">在 Obsidian 打开</button><button type="button" class="goal-delete" data-goal-act="delete">删除</button></div>
    </div>`;
  }
  // 详情纸贴在那一格下面，超出纸面时往左挪
  function place(){
    const el = $('#goal-paper'), btn = el && $(`#goals [data-goal="${CSS.escape(d.ui.goal)}"]`), box = $('#planning'); if (!el || !box) return;
    const b = box.getBoundingClientRect(), r = btn ? btn.getBoundingClientRect() : $('#goals').getBoundingClientRect(), w = el.offsetWidth;
    el.style.left = Math.max(0, Math.min(r.left - b.left, b.width - w - 8)) + 'px'; el.style.top = (r.bottom - b.top + 8) + 'px';
    el.style.maxHeight = Math.max(160, Math.min(innerHeight, HOST.bottom) - r.bottom - 22) + 'px'; // 纸不超出视图底边，长了就在纸里滚
  }

  function renderRow(){
    const host = $('#goals'); if (!host) return;
    // 重画前记下焦点在哪个按钮上（同样的 data-goal-* 属性），画完放回去；找不到就放在详情纸或这一格上，Esc 才到得了插件
    const was = document.activeElement, inside = was && (host.contains(was) || $('#goal-paper')?.contains(was));
    const key = inside && was.matches('button') ? [...was.attributes].filter(a => a.name.startsWith('data-goal')).map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : '';
    host.innerHTML = row();
    $('#goal-paper')?.remove();
    view.root?.toggleAttribute('data-goal-paper', !!goalOf(d.ui.goal)); // 纸开着时“还有 N 项”那一层不压在纸上
    // 找不到时不清掉 d.ui.goal：原生 Obsidian 里新目标的笔记可能比项目笔记晚进索引，中间重建一次模型时它暂时不在
    const g = goalOf(d.ui.goal);
    if (g) { $('#planning').insertAdjacentHTML('beforeend', paper(g)); place(); view.frames(); }
    if (inside && !document.activeElement?.isConnected || inside && document.activeElement === document.body) (key && $(key) || $('#goal-paper') || $(`#goals [data-goal="${CSS.escape(d.ui.goal || '')}"]`) || $('#goals .goal-add'))?.focus({preventScroll: true});
    if (d.ui.goalNew) { const input = $('.goal-new input'); input?.focus({preventScroll: true}); if (input && d.ui.goalNewDraft) input.value = d.ui.goalNewDraft; }
    if (d.ui.goalPick) { const q = $('[data-goal-pick-query]'); if (q && d.ui.goalPickFocus) { q.focus({preventScroll: true}); q.setSelectionRange(q.value.length, q.value.length); } }
    if (d.ui.goalFlash) setTimeout(() => { d.ui.goalFlash = null; $('#goals .is-flash')?.classList.remove('is-flash'); }, 1600);
  }
  const rerender = () => { renderRow(); };

  // —— 改动 ——
  function create(title, open = true){
    const t = String(title || '').trim().replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').slice(0, 80); if (!t) return null;
    if (d.goals.some(g => g.title === t)) { announce('已经有叫“' + t + '”的目标'); return d.goals.find(g => g.title === t); }
    const g = {id: 'goal-' + d.serial++, title: t, planned: 0, spent: 0, status: 'active', due: null, completed: null, resumeDate: null, projectIds: [], byProject: []};
    d.goals.push(g); if (open) { d.ui.goal = g.id; d.ui.goalPage = Math.floor((shown().length - 1) / PER); }
    touch(); return g;
  }
  function setStatus(g, s){
    g.status = s; g.completed = s === 'done' ? (g.completed || today()) : null; if (s !== 'paused') g.resumeDate = null; g.resume = s === 'paused' && g.resumeDate ? md(g.resumeDate) : undefined;
    d.ui.goalCal = s === 'paused' ? 'resume' : null; d.ui.goalCalMonth = null;
    if (s === 'done') announce('目标达成 · ' + g.title);
  }
  function remove(g){
    const hold = view.lower.hold, at = d.goals.indexOf(g), from = linked(g).map(p => p.id);
    d.goals.splice(at, 1); for (const p of d.projects) p.goalIds = (p.goalIds || []).filter(id => id !== g.id);
    if (g.id.includes('/')) hold.add(g.id); markDeleted(d, [g.id]); d.ui.goal = null; rerender(); touch(); // 登记删除（P2-10）
    let undone = false; const timer = setTimeout(() => { if (undone) return; hold.delete(g.id); touch(); }, 5300);
    announce('已删除目标 · ' + g.title, () => { undone = true; clearTimeout(timer); hold.delete(g.id); restoreDeleted(d, [g.id]);
      if (!d.goals.includes(g)) d.goals.splice(Math.min(at, d.goals.length), 0, g);
      for (const p of d.projects) if (from.includes(p.id) && !p.goalIds.includes(g.id)) p.goalIds.push(g.id);
      d.ui.goal = g.id; core.render(); touch(); });
  }
  const openNote = g => { const w = view.plugin?.writer; if (g.id.includes('/') && w && w.exists?.(g.id) !== false) w.open(g.id); else announce('这个目标的笔记还在写，稍等再试'); };

  // —— 规划里的点击 ——
  function onThoughtClick(e, b){
    const ds = b.dataset, g = goalOf(d.ui.goal);
    if (ds.goal) { d.ui.goal = d.ui.goal === ds.goal ? null : ds.goal; d.ui.goalCal = null; d.ui.goalPick = null; d.ui.goalPickQuery = ''; d.ui.goalNew = false; rerender();
      $(`#goals [data-goal="${CSS.escape(ds.goal)}"]`)?.focus({preventScroll: true}); return true; } // 一排重画过，焦点放回这一格（Esc 才到得了插件）
    if (ds.goalPage) { d.ui.goalPage += Number(ds.goalPage); d.ui.goal = null; rerender(); return true; }
    if (ds.goalStatus && g) { setStatus(g, ds.goalStatus); if (ds.goalStatus === 'done' && !d.ui.goalsDone) d.ui.goal = null; render(); return true; }
    if (ds.goalMonth) { const t = new Date((d.ui.goalCalMonth || ((d.ui.goalCal === 'due' ? g?.due : g?.resumeDate) || today()).slice(0, 7)) + '-01T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + Number(ds.goalMonth)); d.ui.goalCalMonth = t.toISOString().slice(0, 7); rerender(); $(`[data-goal-month="${ds.goalMonth}"]`)?.focus({preventScroll: true}); return true; }
    if (ds.goalDay !== undefined && g) { if (d.ui.goalCal === 'due') g.due = ds.goalDay || null; else { g.resumeDate = ds.goalDay || null; g.resume = g.resumeDate ? md(g.resumeDate) : undefined; } d.ui.goalCal = null; d.ui.goalCalMonth = null; render(); return true; }
    if (ds.goalUnlink && g) { const p = d.projects.find(x => x.id === ds.goalUnlink); if (p) p.goalIds = p.goalIds.filter(id => id !== g.id); rerender(); return true; }
    if (ds.goalPick && g) { const p = d.projects.find(x => x.id === ds.goalPick); if (p && !p.goalIds.includes(g.id)) p.goalIds = [...(p.goalIds || []), g.id]; d.ui.goalPick = null; d.ui.goalPickQuery = ''; rerender(); return true; }
    if (ds.goalOpenProject) { d.ui.goal = null; view.lower.openObject('project', ds.goalOpenProject); return true; }
    switch (ds.goalAct) {
      case 'new': d.ui.goalNew = true; d.ui.goalNewDraft = ''; d.ui.goal = null; d.ui.goalPage = Math.max(0, Math.ceil(shown().length / PER) - 1); rerender(); return true;
      case 'toggle-done': d.ui.goalsDone = !d.ui.goalsDone; d.ui.goal = null; rerender(); return true;
      case 'close': d.ui.goal = null; d.ui.goalCal = null; d.ui.goalPick = null; rerender(); $(`#goals [data-goal]`)?.focus({preventScroll: true}); return true;
    }
    if (!g) return false;
    switch (ds.goalAct) {
      case 'minus': g.planned = Math.max(0, +(g.planned - STEP).toFixed(2)); rerender(); $('[data-goal-act="minus"]')?.focus({preventScroll: true}); return true;
      case 'plus': g.planned = Math.min(MAX, +(g.planned + STEP).toFixed(2)); rerender(); $('[data-goal-act="plus"]')?.focus({preventScroll: true}); return true;
      case 'cal-due': case 'cal-resume': { const k = ds.goalAct.slice(4); d.ui.goalCal = d.ui.goalCal === k ? null : k; d.ui.goalCalMonth = null; rerender(); return true; }
      case 'pick': d.ui.goalPick = d.ui.goalPick === g.id ? null : g.id; d.ui.goalPickQuery = ''; d.ui.goalPickFocus = true; rerender(); d.ui.goalPickFocus = false; return true;
      case 'open-note': openNote(g); return true;
      case 'delete': remove(g); return true;
    }
    return false;
  }
  HOST.addEventListener('click', e => {
    if (d.ui.page !== 'thought') return; const b = e.target.closest('button'); if (!b || b.disabled || !b.closest('#planning')) return;
    if (onThoughtClick(e, b)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // —— 项目详情：关联目标的 × 与 + ——
  HOST.projectGoalChips = (p, dd, B) => {
    const chips = (p.goalIds || []).map(id => { const g = dd.goals.find(x => x.id === id); if (!g) return ''; return `<span class="pd-goal">${B('open-object', id, esc(g.title), g.title, 'data-kind="goal" class="pd-chip"')}<button type="button" class="pd-goal-x" data-pgoal-unlink="${esc(id)}" data-project="${esc(p.id)}" aria-label="取消关联 ${esc(g.title)}">×</button></span>`; }).join('');
    return chips + `<span class="pd-goal-add-wrap"><button type="button" class="pd-goal-add" data-pgoal-add="${esc(p.id)}" aria-expanded="${dd.ui.goalPickProject === p.id}" aria-label="关联目标">${icon('plus', 15)}</button>${dd.ui.goalPickProject === p.id ? picker('goal', p) : ''}</span>`;
  };
  const projectRerender = (focusQuery = false) => { core.render(); if (focusQuery) { const q = $('#projects [data-goal-pick-query]'); if (q) { q.focus({preventScroll: true}); q.setSelectionRange(q.value.length, q.value.length); } } view.frames(); };
  HOST.addEventListener('click', e => {
    if (d.ui.page !== 'projects') return; const b = e.target.closest('button'); if (!b || b.disabled) return; const ds = b.dataset;
    const p = d.projects.find(x => x.id === (ds.project || ds.pgoalAdd || d.ui.goalPickProject));
    let hit = true;
    if (ds.pgoalUnlink && p) p.goalIds = p.goalIds.filter(id => id !== ds.pgoalUnlink);
    else if (ds.pgoalAdd) { d.ui.goalPickProject = d.ui.goalPickProject === ds.pgoalAdd ? null : ds.pgoalAdd; d.ui.goalPickQuery = ''; projectRerender(!!d.ui.goalPickProject); e.preventDefault(); e.stopImmediatePropagation(); return; }
    else if (ds.goalPick && p && b.closest('#projects .goal-pick')) { if (!p.goalIds.includes(ds.goalPick)) p.goalIds = [...p.goalIds, ds.goalPick]; d.ui.goalPickProject = null; }
    else if (ds.goalPickNew && p) { const g = create(ds.goalPickNew, false); if (g && !p.goalIds.includes(g.id)) p.goalIds = [...p.goalIds, g.id]; d.ui.goalPickProject = null; }
    else hit = false;
    if (hit) { e.preventDefault(); e.stopImmediatePropagation(); d.ui.goalPickQuery = ''; projectRerender(); touch(); }
  }, true);

  // —— 输入：新目标名、标题、纸条搜索 ——
  HOST.addEventListener('submit', e => {
    const f = e.target.closest?.('[data-goal-form]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    if (f.dataset.goalForm === 'new') { const v = f.elements.title.value; d.ui.goalNew = false; d.ui.goalNewDraft = ''; if (v.trim()) { create(v); render(); } else rerender(); }
    if (f.dataset.goalForm === 'title') f.elements.title.blur();
  }, true);
  HOST.addEventListener('change', e => {
    if (!e.target.matches?.('.goal-title')) return; const g = goalOf(d.ui.goal), v = e.target.value.trim().replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
    if (!g || !v || v === g.title) { e.target.value = g?.title || ''; return; }
    if (d.goals.some(x => x !== g && x.title === v)) { announce('已经有叫“' + v + '”的目标'); e.target.value = g.title; return; }
    g.title = v; render(); touch();
  }, true);
  HOST.addEventListener('input', e => {
    if (e.target.matches?.('.goal-new input')) { d.ui.goalNewDraft = e.target.value; return; }
    if (!e.target.matches?.('[data-goal-pick-query]') || e.isComposing) return;
    d.ui.goalPickQuery = e.target.value; const list = e.target.closest('.goal-pick');
    const fresh = d.ui.page === 'projects' ? picker('goal', d.projects.find(x => x.id === d.ui.goalPickProject) || {goalIds: []}) : picker('project', goalOf(d.ui.goal));
    const tmp = document.createElement('div'); tmp.innerHTML = fresh; list.querySelector('.goal-pick-items').replaceWith(tmp.querySelector('.goal-pick-items')); view.frames();
  }, true);
  HOST.addEventListener('compositionend', e => { if (e.target.matches?.('[data-goal-pick-query]')) e.target.dispatchEvent(new Event('input', {bubbles: true})); }, true);
  HOST.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing && e.target.matches?.('[data-goal-pick-query]')) { e.preventDefault(); e.target.closest('.goal-pick').querySelector('[data-goal-pick],[data-goal-pick-new]')?.click(); return; }
    if (e.key !== 'Escape') return;
    if (d.ui.page === 'projects' && d.ui.goalPickProject) { e.preventDefault(); e.stopImmediatePropagation(); const id = d.ui.goalPickProject; d.ui.goalPickProject = null; projectRerender(); $(`#projects [data-pgoal-add="${CSS.escape(id)}"]`)?.focus({preventScroll: true}); return; }
    if (d.ui.page !== 'thought') return;
    if (d.ui.goalNew) { e.preventDefault(); e.stopImmediatePropagation(); d.ui.goalNew = false; d.ui.goalNewDraft = ''; rerender(); $('.goal-add')?.focus({preventScroll: true}); return; }
    if (d.ui.goalCal || d.ui.goalPick) { e.preventDefault(); e.stopImmediatePropagation(); d.ui.goalCal = null; d.ui.goalPick = null; rerender(); return; }
    if (d.ui.goal) { e.preventDefault(); e.stopImmediatePropagation(); const id = d.ui.goal; d.ui.goal = null; rerender(); $(`#goals [data-goal="${CSS.escape(id)}"]`)?.focus({preventScroll: true}); }
  }, true);
  // 点到纸外面就收起（新目标的输入框空着时也收起）
  HOST.addEventListener('pointerdown', e => {
    if (d.ui.page === 'thought') {
      if (d.ui.goalNew && !e.target.closest?.('.goal-new') && !(d.ui.goalNewDraft || '').trim()) { d.ui.goalNew = false; rerender(); }
      if (d.ui.goal && !e.target.closest?.('#goal-paper, #goals [data-goal], #feedback')) { d.ui.goal = null; d.ui.goalCal = null; d.ui.goalPick = null; rerender(); }
    }
    if (d.ui.page === 'projects' && d.ui.goalPickProject && !e.target.closest?.('.pd-goal-add-wrap')) { d.ui.goalPickProject = null; projectRerender(); }
  }, true);

  return {renderRow, place};
}
