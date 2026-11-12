// 人物（0.9，使用者 2026-11-09）：人物仍是仓库里 人物/ 下的笔记，这里补上“建、改、连、见面、提醒”。
//   任务页 › 货舱顶上的邮包：按“该联系了 → 待沟通件数 → 最近联系”排；多于 4 人时最后一只是“还有 N 人”（点开可搜索的名单，也能当落点）；
//                          末尾 + 新建人物；超过联系频率的邮包挂一个提醒色的小签。
//   点邮包 → 右栏是这个人的人物纸：名字（改名）、头像字、联系频率（不提醒 / 每周 / 每两周 / 每月 / 每季度）、上次联系、
//            待沟通几件、相关项目、记录（记一笔，回车带今天的日期）、见面了、在 Obsidian 打开、删除（5 秒内可撤销）。
//   见面了：列出攒着的待沟通任务，每件选“谈过了 / 做完了 / 下次再说”；一句话结论写进 ## 记录（只写进记录，使用者 2026-11-09）；
//          跟进事项一行一件变成新任务（写 @名字 就挂到那人身上待沟通）。整次可以撤销。
//   项目页 › 相关人员：标签后面有 ×，末尾 + 打开可搜索的人物纸条（没有就新建）；点人名去任务页打开人物纸。
//   任务详情的人名标签有 ×；右键“待沟通”可以勾掉；货单输入 @新名字 时补全纸条里能直接新建人物。
// 上次联系不另存：取 ## 记录 里最晚的日期。联系频率写在人物笔记的 cadence（天数）。
import {esc, icon, ink, circle, TICK} from '../draw/ink.js';
import {dayText} from './day-text.js';
import {HOST} from '../host.js';
import {markDeleted, restoreDeleted, dropTasks} from '../data/trash.js';
import {completeTask} from '../data/complete.js';

export const CADENCE = [[0, '不提醒'], [7, '每周'], [14, '每两周'], [30, '每月'], [90, '每季度']];
const CHOICES = [['talked', '谈过了'], ['done', '做完了'], ['later', '下次再说']];
const closed = t => t.status === 'done' || t.status === 'cancelled';
export const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
export const lastContact = p => (p.history || []).reduce((m, h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date || '') && h.date > m ? h.date : m, '');
// 该联系了吗：没设频率 → null；设了但从没记过 → 该联系；否则看离上次联系过了几天
export function dueOf(p, today){
  if (!p.cadence) return null; const last = lastContact(p); if (!last) return {over: true, never: true};
  const gap = days(last, today); return {over: gap > p.cadence, gap, left: p.cadence - gap};
}
export const ago = (date, today) => { const n = days(date, today); return n <= 0 ? '今天' : n === 1 ? '昨天' : n < 14 ? n + ' 天前' : n < 60 ? Math.round(n / 7) + ' 周前' : n < 730 ? Math.round(n / 30) + ' 个月前' : Math.round(n / 365) + ' 年前'; };
export const cleanName = v => String(v || '').replace(/[\\/:*?"<>|#^[\]@!！~]/g, ' ').trim().replace(/\s+/g, '·').slice(0, 40);
const cadenceText = n => CADENCE.find(c => c[0] === n)?.[1] || `每 ${n} 天`;
const underline = `<svg viewBox="0 0 160 6" preserveAspectRatio="none" aria-hidden="true">${ink([[0, 4], [80, 3.6], [160, 4]], .9, TICK)}</svg>`;
const initialMark = p => `<span class="person-initial">${`<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${circle(14, 14, 12, 1.2)}</svg>`}<span>${esc(p.initial || p.name.slice(0, 1))}</span></span>`;

export function createPeople(view){
  const root = view.root, $ = s => root.querySelector(s);
  const data = () => view.lower?.data || null;
  const render = () => view.render(true), touch = () => view.lower?.touch?.();
  const announce = (msg, undo) => view.frame.feedback(msg, undo);
  const personOf = id => data()?.people.find(p => p.id === id);
  const onTasks = () => view.page === 'tasks' && !!data();
  const pendingOf = (p, d) => d.tasks.filter(t => !closed(t) && t.discuss && (t.peopleIds || []).includes(p.id));
  const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };

  // —— 邮包的顺序 ——
  function sorted(d){
    const n = new Map(); for (const t of d.tasks) if (t.discuss && !closed(t)) for (const id of t.peopleIds || []) n.set(id, (n.get(id) || 0) + 1);
    const over = new Map(d.people.map(p => [p.id, !!dueOf(p, d.clock.date)?.over])), last = new Map(d.people.map(p => [p.id, lastContact(p)]));
    return [...d.people].sort((a, b) => (over.get(b.id) - over.get(a.id)) || ((n.get(b.id) || 0) - (n.get(a.id) || 0)) || last.get(b.id).localeCompare(last.get(a.id)) || a.name.localeCompare(b.name, 'zh'));
  }
  HOST.cargoPeople = (d, max) => {
    const s = sorted(d); if (s.length <= max) return s;
    const rest = s.length - (max - 1);
    return [...s.slice(0, max - 1), {id: '__more', name: `还有 ${rest} 人`, initial: '+' + rest, history: []}];
  };
  HOST.cargoMailbags = (d, B) => {
    const f = d.ui.taskFilter, shown = HOST.cargoPeople(d, 4);
    const bags = shown.map(p => {
      if (p.id === '__more') return `<button type="button" class="cargo-mailbag cargo-mailbag-more" data-person-act="more" data-p2-drop="people:" aria-expanded="${!!d.ui.personPick}" aria-label="${esc(p.name)}：打开名单"></button>`;
      const due = dueOf(p, d.clock.date), n = pendingOf(p, d).length;
      const label = `${p.name}的待沟通事项${n ? '，' + n + ' 件' : ''}${due?.over ? '，该联系了' : ''}`;
      return B('task-filter-person', p.id, due?.over ? '<i class="mailbag-due" aria-hidden="true">!</i>' : '', label, `class="cargo-mailbag ${due?.over ? 'is-due' : ''}" data-p2-drop="person:${esc(p.id)}" aria-pressed="${f.kind === 'person' && f.id === p.id}"`);
    }).join('');
    const add = `<button type="button" class="cargo-person-add" data-person-act="new" aria-expanded="${!!d.ui.personNew}" aria-label="新建人物">${icon('plus', 16)}</button>`;
    const form = d.ui.personNew ? `<form class="person-pop person-new hand-popup" data-person-form="new" role="dialog" aria-label="新建人物"><input name="name" value="${esc(d.ui.personNewDraft || '')}" placeholder="名字，回车" aria-label="新人物的名字" autocomplete="off" spellcheck="false">${underline}</form>` : '';
    return bags + add + form + (d.ui.personPick ? picker(d, 'cargo') : '');
  };

  // —— 可搜索的人物纸条（邮包“还有 N 人”、拖到那里、项目的相关人员）——
  function picker(d, where, project = null){
    const q = (d.ui.personPickQuery || '').trim(), has = s => !q || s.toLowerCase().includes(q.toLowerCase());
    const skip = new Set(project?.peopleIds || []);
    const items = sorted(d).filter(p => !skip.has(p.id) && has(p.name)).map(p => { const due = dueOf(p, d.clock.date), n = pendingOf(p, d).length;
      return `<button type="button" role="option" data-person-pick="${esc(p.id)}">${initialMark(p)}<span>${esc(p.name)}</span>${due?.over ? '<small class="overdue">该联系了</small>' : n ? `<small>${n} 件</small>` : ''}</button>`; });
    const name = cleanName(q), create = name && !d.people.some(p => p.name === name) ? `<button type="button" role="option" data-person-pick-new="${esc(name)}">${icon('plus', 15)}<span>新建人物“${esc(name)}”</span></button>` : '';
    const label = d.ui.personPick?.tasks ? `交给谁（${d.ui.personPick.tasks.length} 项）` : project ? '关联人物' : '挑一个人';
    return `<div class="goal-pick person-pick ${where === 'cargo' ? 'person-pop' : ''} hand-popup" role="listbox" aria-label="${label}"><label class="goal-pick-search">${icon('search', 15)}<input data-person-pick-query value="${esc(d.ui.personPickQuery || '')}" placeholder="搜索或新建人物" aria-label="${label}：搜索或新建人物" autocomplete="off"></label><div class="goal-pick-items">${items.join('') + create || '<p>没有别的人物</p>'}</div></div>`;
  }

  // —— 人物纸（任务页右栏，筛选到这个人时）——
  HOST.personDetail = (p, d) => d.ui.personMeet === p.id ? meetSheet(p, d) : paper(p, d);
  function paper(p, d){
    const today = d.clock.date, due = dueOf(p, today), last = lastContact(p), n = pendingOf(p, d).length;
    const projects = d.projects.filter(x => (x.peopleIds || []).includes(p.id));
    const lastText = last ? `${ago(last, today)} · ${dayText(last, today)}${due ? due.over ? ` · 超过 ${-due.left} 天` : ` · 还有 ${due.left} 天` : ''}` : due ? '还没有记录 · 该联系了' : '还没有记录';
    const options = CADENCE.some(c => c[0] === (p.cadence || 0)) ? CADENCE : [...CADENCE, [p.cadence, cadenceText(p.cadence)]];
    const log = [...(p.history || [])].map((h, i) => ({...h, i})).reverse(), all = d.ui.personLogAll === p.id, list = all ? log : log.slice(0, 6);
    return `<div class="person-paper" id="person-paper" data-person="${esc(p.id)}" role="region" aria-label="人物：${esc(p.name)}">
      <div class="person-head"><button type="button" class="person-initial-btn" data-person-act="initial" aria-expanded="${d.ui.personInitial === p.id}" aria-label="改头像字（现在是 ${esc(p.initial)}）">${initialMark(p)}</button>
        <form class="goal-title-form person-name-form" data-person-form="name"><input name="name" class="person-name" value="${esc(p.name)}" aria-label="名字" autocomplete="off" spellcheck="false">${underline}</form>
        <button type="button" class="inline-close" data-person-act="close" aria-label="收起人物纸，回到全部任务">×</button></div>
      ${d.ui.personInitial === p.id ? `<form class="person-initial-form" data-person-form="initial"><span class="goal-label">头像字</span><input name="initial" value="${esc(p.initial)}" maxlength="2" aria-label="头像字（一两个字）" autocomplete="off"><button type="submit">好</button></form>` : ''}
      <div class="goal-field"><span class="goal-label">联系</span><span class="goal-status person-cadence" role="radiogroup" aria-label="多久联系一次">${options.map(([k, t]) => `<button type="button" role="radio" aria-checked="${(p.cadence || 0) === k}" data-person-cadence="${k}">${t}</button>`).join('')}</span></div>
      <div class="goal-field"><span class="goal-label">上次联系</span><span class="person-last ${due?.over ? 'overdue' : ''}">${esc(lastText)}</span></div>
      <div class="goal-field"><span class="goal-label">待沟通</span><span>${n ? `${n} 件，在左边货单里` : '没有攒着的事'}</span></div>
      ${projects.length ? `<div class="goal-field goal-projects"><span class="goal-label">项目</span><span class="goal-chips">${projects.map(x => `<button type="button" class="goal-chip person-project" data-p2="open-object" data-kind="project" data-id="${esc(x.id)}" aria-label="打开项目 ${esc(x.title)}">${esc(x.title)}</button>`).join('')}</span></div>` : ''}
      <div class="person-log"><form class="goal-title-form person-log-form" data-person-form="log"><input name="text" value="${esc(d.ui.personLogDraft || '')}" placeholder="记一笔，回车（带今天的日期）" aria-label="给 ${esc(p.name)} 记一笔" autocomplete="off">${underline}</form>
        ${list.length ? `<ul>${list.map(h => `<li><span class="mono">${h.date ? esc(h.date.slice(5).replace('-', '/')) : '·'}</span><span>${esc(h.text)}</span></li>`).join('')}</ul>` : '<p class="goal-muted">还没有记录：见完面点“见面了”，或在上面记一笔</p>'}
        ${log.length > 6 ? `<button type="button" class="person-log-all" data-person-act="log-all">${all ? '收起' : `全部 ${log.length} 条`}</button>` : ''}</div>
      <div class="goal-foot person-foot"><button type="button" class="person-meet" data-person-act="meet">见面了</button><button type="button" data-person-act="open-note">在 Obsidian 打开</button><button type="button" class="goal-delete" data-person-act="delete">删除</button></div>
    </div>`;
  }
  function meetSheet(p, d){
    const tasks = pendingOf(p, d), ch = d.ui.personMeetChoice || {};
    return `<form class="person-paper person-meet-form" id="person-paper" data-person="${esc(p.id)}" data-person-form="meet" role="region" aria-label="与 ${esc(p.name)} 见面">
      <div class="person-head">${initialMark(p)}<p class="person-meet-title">与 ${esc(p.name)} 见面 · <span>${dayText(d.clock.date)}</span></p><button type="button" class="inline-close" data-person-act="meet-cancel" aria-label="不记了">×</button></div>
      <div class="person-meet-items">${tasks.length ? tasks.map(t => `<div class="person-meet-item"><span class="person-meet-task">${esc(t.title)}</span><span class="goal-status" role="radiogroup" aria-label="${esc(t.title)}">${CHOICES.map(([k, l]) => `<button type="button" role="radio" data-person-choice="${k}" data-id="${esc(t.id)}" aria-checked="${(ch[t.id] || 'talked') === k}">${l}</button>`).join('')}</span></div>`).join('') : '<p class="goal-muted">没有攒着要谈的事</p>'}</div>
      <label class="person-meet-field"><span class="goal-label">结论</span><textarea name="note" rows="2" data-person-draft="note" placeholder="谈了什么、定了什么（写进记录）">${esc(d.ui.personMeetNote || '')}</textarea></label>
      <label class="person-meet-field"><span class="goal-label">跟进</span><textarea name="follow" rows="2" data-person-draft="follow" placeholder="一行一件，变成新任务；写 @名字 就挂到那人身上待沟通">${esc(d.ui.personMeetFollow || '')}</textarea></label>
      <div class="person-meet-foot"><button type="submit" class="person-meet">记下</button><button type="button" data-person-act="meet-cancel">取消</button></div>
    </form>`;
  }

  // —— 项目详情：相关人员的 × 与 + ——
  HOST.projectPeople = (p, d, B) => {
    const chips = (p.peopleIds || []).map(id => { const who = d.people.find(x => x.id === id); if (!who) return '';
      return `<span class="pd-goal pd-person">${B('open-object', id, `${initialMark(who)}<span>${esc(who.name)}</span>`, '打开 ' + who.name + ' 的人物纸', 'data-kind="person" class="project-person"')}<button type="button" class="pd-person-x" data-pperson-unlink="${esc(id)}" data-project="${esc(p.id)}" aria-label="不再关联 ${esc(who.name)}">×</button></span>`; }).join('');
    return chips + `<span class="pd-person-add-wrap"><button type="button" class="pd-person-add" data-pperson-add="${esc(p.id)}" aria-expanded="${d.ui.personPickProject === p.id}" aria-label="关联人物">${icon('plus', 15)}</button>${d.ui.personPickProject === p.id ? picker(d, 'project', p) : ''}</span>`;
  };

  // —— 改动 ——
  function create(raw){
    const d = data(), name = cleanName(raw); if (!d || !name) return null;
    const had = d.people.find(p => p.name === name); if (had) return had;
    const p = {id: 'person-' + d.serial++, name, initial: name.slice(0, 1), cadence: 0, history: []};
    d.people.push(p); touch(); return p;
  }
  HOST.createPerson = create; // 货单 @新名字 的补全（task-plus.js）
  const show = id => { const d = data(); d.ui.taskFilter = {kind: 'person', id}; d.ui.personMeet = null; d.ui.personInitial = null; d.ui.personLogAll = null; d.ui.personLogDraft = ''; };
  function assign(ids, p){
    const d = data(), tasks = ids.map(id => d.tasks.find(t => t.id === id)).filter(Boolean); if (!tasks.length) return;
    const before = tasks.map(t => [t.id, [...(t.peopleIds || [])], t.discuss]);
    for (const t of tasks) { t.peopleIds = [...new Set([...(t.peopleIds || []), p.id])]; t.discuss = true; }
    render(); touch();
    announce(`待沟通 · ${p.name}${tasks.length > 1 ? ' · ' + tasks.length + ' 项' : ''}`, () => { const dd = data(); for (const [id, ppl, disc] of before) { const t = dd.tasks.find(x => x.id === id); if (t) { t.peopleIds = ppl; t.discuss = disc; } } render(); touch(); });
  }
  HOST.personPickFor = ids => { const d = data(); if (!d) return; d.ui.personPick = {tasks: ids}; d.ui.personPickQuery = ''; d.ui.personNew = false; render(); focusPick(); };
  function remove(p){
    const d = data(), hold = view.lower.hold, at = d.people.indexOf(p);
    const tasks = d.tasks.filter(t => (t.peopleIds || []).includes(p.id)).map(t => [t.id, [...t.peopleIds], t.discuss]);
    const projects = d.projects.filter(x => (x.peopleIds || []).includes(p.id)).map(x => x.id);
    d.people.splice(at, 1);
    for (const t of d.tasks) if ((t.peopleIds || []).includes(p.id)) { t.peopleIds = t.peopleIds.filter(id => id !== p.id); if (!t.peopleIds.length) t.discuss = false; }
    for (const x of d.projects) x.peopleIds = (x.peopleIds || []).filter(id => id !== p.id);
    if (d.ui.taskFilter?.kind === 'person' && d.ui.taskFilter.id === p.id) d.ui.taskFilter = {kind: 'all'};
    if (p.id.includes('/')) hold.add(p.id); markDeleted(d, [p.id]); render(); touch(); // 登记删除（P2-10）
    let undone = false; const timer = setTimeout(() => { if (undone) return; hold.delete(p.id); touch(); }, 5300);
    announce('已删除人物 · ' + p.name, () => { undone = true; clearTimeout(timer); hold.delete(p.id); const dd = data(); restoreDeleted(dd, [p.id]);
      if (!dd.people.some(x => x.id === p.id)) dd.people.splice(Math.min(at, dd.people.length), 0, p);
      for (const [id, ppl, disc] of tasks) { const t = dd.tasks.find(x => x.id === id); if (t) { t.peopleIds = ppl; t.discuss = disc; } }
      for (const id of projects) { const x = dd.projects.find(y => y.id === id); if (x && !x.peopleIds.includes(p.id)) x.peopleIds.push(p.id); }
      show(p.id); render(); touch(); });
  }
  function rename(p, raw){
    const d = data(), v = cleanName(raw);
    if (!v || v === p.name) return false;
    if (d.people.some(x => x !== p && x.name === v)) { announce('已经有叫“' + v + '”的人物'); return false; }
    if (p.initial === p.name.slice(0, 1)) p.initial = v.slice(0, 1);
    p.name = v; return true;
  }
  function addLog(p, text){
    const d = data(), t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return;
    const entry = {date: d.clock.date, text: t}; p.history = [...(p.history || []), entry]; d.ui.personLogDraft = '';
    render(); touch();
    announce('记下了 · ' + p.name, () => { const x = personOf(p.id); if (x) { const i = x.history.findLastIndex(h => h.date === entry.date && h.text === entry.text); if (i >= 0) x.history = x.history.filter((_, k) => k !== i); } render(); touch(); });
  }
  // 见面了：谈过的去掉这个人（没人了就不再待沟通），做完的完成（重复任务顺延并留一份完成记录），结论写进记录，跟进变成新任务
  function meet(p, form){
    const d = data(), today = d.clock.date, ch = d.ui.personMeetChoice || {}, tasks = pendingOf(p, d);
    const note = form.elements.note.value.replace(/\s+/g, ' ').trim(), follow = form.elements.follow.value.split('\n').map(s => s.trim()).filter(Boolean);
    const saved = tasks.map(t => [t.id, {peopleIds: [...(t.peopleIds || [])], discuss: t.discuss, status: t.status, completed: t.completed, date: t.date}]);
    const created = [], undos = []; let talked = 0, done = 0;
    for (const t of tasks) {
      const c = ch[t.id] || 'talked'; if (c === 'later') continue;
      t.peopleIds = t.peopleIds.filter(id => id !== p.id); if (!t.peopleIds.length) t.discuss = false;
      if (c === 'talked') { talked++; continue; }
      done++;
      // 0.9.4：和今日页、任务页同一套（data/complete.js）：重复任务留完成记录并顺延、检查项清空；普通任务连带未完成的子任务
      const r = completeTask(d, t); undos.push(r.undo);
    }
    for (const line of follow) { const task = {id: 'task-' + d.serial++, title: line, status: 'open', priority: 'medium', date: null, projectId: null, listId: null, peopleIds: [], discuss: false, tags: [], comments: []}; HOST.taskCreated?.(task, d); d.tasks.push(task); created.push(task); }
    const entry = {date: today, text: note ? '见面：' + note : '见面'}; p.history = [...(p.history || []), entry];
    d.ui.personMeet = null; d.ui.personMeetChoice = null; d.ui.personMeetNote = ''; d.ui.personMeetFollow = '';
    render(); touch();
    const bits = [talked && `谈过 ${talked} 件`, done && `做完 ${done} 件`, follow.length && `跟进 ${follow.length} 件`].filter(Boolean).join('，');
    announce(`记下了与 ${p.name} 的见面${bits ? '：' + bits : ''}`, () => { const dd = data(), ids = new Set(created.map(t => t.id));
      for (const u of [...undos].reverse()) u(); // 完成的撤回（含完成记录、顺延、子任务）
      dropTasks(dd, [...ids]); // 拿掉跟进任务并登记删除（P2-10）
      for (const [id, v] of saved) { const t = dd.tasks.find(x => x.id === id); if (t) Object.assign(t, v); }
      const x = dd.people.find(y => y.id === p.id); if (x) { const i = x.history.findLastIndex(h => h.date === entry.date && h.text === entry.text); if (i >= 0) x.history = x.history.filter((_, k) => k !== i); }
      render(); touch(); });
  }
  const openNote = p => { const w = view.plugin?.writer; if (p.id.includes('/') && w && w.exists?.(p.id) !== false) w.open(p.id); else announce('这个人的笔记还在写，稍等再试'); };

  // 重画之后把焦点放回原来那个按钮（同样的 data-person-* 属性）；找不到就放在人物纸上
  function keep(fn){
    const was = document.activeElement, inside = was && root.contains(was) && was.closest('#person-paper, .cargo-top, .project-people');
    const key = inside && was.matches('button') ? [...was.attributes].filter(a => a.name.startsWith('data-person') || a.name === 'data-id').map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : '';
    fn();
    if (inside && (!document.activeElement?.isConnected || document.activeElement === document.body)) ((key && $(key)) || $('#person-paper') || $('.cargo-person-add'))?.focus({preventScroll: true});
  }
  const focusPick = () => { const q = $('[data-person-pick-query]'); if (q) { q.focus({preventScroll: true}); q.setSelectionRange(q.value.length, q.value.length); } view.frames(); };
  const focusNew = () => { const i = $('.person-new input'); if (i) { i.focus({preventScroll: true}); i.setSelectionRange(i.value.length, i.value.length); } view.frames(); };
  const closePops = d => { d.ui.personPick = null; d.ui.personPickQuery = ''; d.ui.personNew = false; d.ui.personNewDraft = ''; d.ui.personPickProject = null; };

  // —— 点击 ——
  function onClick(e){
    const b = e.target.closest?.('button'); const d = data(); if (!b || b.disabled || !d) return;
    const ds = b.dataset;
    if (view.page === 'projects') {
      const project = d.projects.find(x => x.id === (ds.project || ds.ppersonAdd || d.ui.personPickProject));
      if (ds.ppersonUnlink && project) { stop(e); const who = personOf(ds.ppersonUnlink); project.peopleIds = project.peopleIds.filter(id => id !== ds.ppersonUnlink); render(); touch();
        announce('不再关联 · ' + (who?.name || ''), () => { const x = data().projects.find(y => y.id === project.id); if (x && !x.peopleIds.includes(ds.ppersonUnlink)) x.peopleIds.push(ds.ppersonUnlink); render(); touch(); }); return; }
      if (ds.ppersonAdd) { stop(e); const open = d.ui.personPickProject !== ds.ppersonAdd; closePops(d); d.ui.personPickProject = open ? ds.ppersonAdd : null; render(); if (open) focusPick(); else $(`[data-pperson-add="${CSS.escape(ds.ppersonAdd)}"]`)?.focus({preventScroll: true}); return; }
      if ((ds.personPick || ds.personPickNew) && project && b.closest('.project-people')) { stop(e); const who = ds.personPick ? personOf(ds.personPick) : create(ds.personPickNew); if (who && !project.peopleIds.includes(who.id)) project.peopleIds = [...project.peopleIds, who.id]; closePops(d); render(); touch(); $(`[data-pperson-add="${CSS.escape(project.id)}"]`)?.focus({preventScroll: true}); return; }
      return;
    }
    if (!onTasks()) return;
    if (ds.personPick || ds.personPickNew) { stop(e); const who = ds.personPick ? personOf(ds.personPick) : create(ds.personPickNew), pick = d.ui.personPick; closePops(d); if (!who) { render(); return; }
      if (pick?.tasks) assign(pick.tasks, who); else { show(who.id); keep(render); $('#person-paper')?.focus?.({preventScroll: true}); } return; }
    if (ds.personCadence !== undefined) { stop(e); const p = personOf(d.ui.taskFilter.id); if (!p) return; p.cadence = Number(ds.personCadence) || 0; keep(render); touch(); return; }
    if (ds.personChoice) { stop(e); d.ui.personMeetChoice = {...(d.ui.personMeetChoice || {}), [ds.id]: ds.personChoice}; keep(render); return; }
    const act = ds.personAct; if (!act) return;
    stop(e);
    if (act === 'new') { const open = !d.ui.personNew; closePops(d); d.ui.personNew = open; render(); if (open) focusNew(); else $('.cargo-person-add')?.focus({preventScroll: true}); return; }
    if (act === 'more') { const open = !d.ui.personPick; closePops(d); d.ui.personPick = open ? {} : null; render(); if (open) focusPick(); else $('.cargo-mailbag-more')?.focus({preventScroll: true}); return; }
    const p = d.ui.taskFilter?.kind === 'person' ? personOf(d.ui.taskFilter.id) : null; if (!p) return;
    if (act === 'close') { d.ui.taskFilter = {kind: 'all'}; d.ui.personMeet = null; render(); $(`.cargo-mailbag[data-id="${CSS.escape(p.id)}"]`)?.focus({preventScroll: true}); return; }
    if (act === 'initial') { d.ui.personInitial = d.ui.personInitial === p.id ? null : p.id; render(); const i = $('.person-initial-form input'); i?.focus({preventScroll: true}); i?.select(); return; }
    if (act === 'log-all') { d.ui.personLogAll = d.ui.personLogAll === p.id ? null : p.id; keep(render); return; }
    if (act === 'meet') { d.ui.personMeet = p.id; d.ui.personMeetChoice = {}; d.ui.personMeetNote = ''; d.ui.personMeetFollow = ''; render(); ($('.person-meet-form [data-person-choice]') || $('.person-meet-form textarea'))?.focus({preventScroll: true}); return; }
    if (act === 'meet-cancel') { d.ui.personMeet = null; render(); $('[data-person-act="meet"]')?.focus({preventScroll: true}); return; }
    if (act === 'open-note') { openNote(p); return; }
    if (act === 'delete') { remove(p); return; }
  }
  view.registerDomEvent(root, 'click', onClick, {capture: true});

  view.registerDomEvent(root, 'submit', e => {
    const f = e.target.closest?.('[data-person-form]'); if (!f) return; stop(e); const d = data(); if (!d) return;
    const kind = f.dataset.personForm, p = d.ui.taskFilter?.kind === 'person' ? personOf(d.ui.taskFilter.id) : null;
    if (kind === 'new') { const v = f.elements.name.value; closePops(d); const who = v.trim() ? create(v) : null; if (who) { show(who.id); render(); $('#person-paper')?.focus?.({preventScroll: true}); $('.person-name')?.focus({preventScroll: true}); } else { render(); $('.cargo-person-add')?.focus({preventScroll: true}); } return; }
    if (!p) return;
    if (kind === 'name') { f.elements.name.blur(); return; }
    if (kind === 'initial') { const v = f.elements.initial.value.trim().slice(0, 2); p.initial = v || p.name.slice(0, 1); d.ui.personInitial = null; render(); touch(); $('[data-person-act="initial"]')?.focus({preventScroll: true}); return; }
    if (kind === 'log') { addLog(p, f.elements.text.value); $('.person-log-form input')?.focus({preventScroll: true}); return; }
    if (kind === 'meet') { meet(p, f); $('#person-paper')?.setAttribute('tabindex', '-1'); $('[data-person-act="meet"]')?.focus({preventScroll: true}); }
  }, {capture: true});
  view.registerDomEvent(root, 'change', e => {
    if (!e.target.matches?.('.person-name')) return; const d = data(), p = personOf(d?.ui.taskFilter?.id); if (!p) return;
    if (rename(p, e.target.value)) { render(); touch(); } else e.target.value = p.name;
  }, {capture: true});
  view.registerDomEvent(root, 'input', e => {
    const d = data(); if (!d) return; const t = e.target;
    if (t.matches?.('.person-new input')) { d.ui.personNewDraft = t.value; return; }
    if (t.matches?.('.person-log-form input')) { d.ui.personLogDraft = t.value; return; }
    if (t.matches?.('[data-person-draft]')) { d.ui[t.dataset.personDraft === 'note' ? 'personMeetNote' : 'personMeetFollow'] = t.value; return; }
    if (!t.matches?.('[data-person-pick-query]') || e.isComposing) return;
    d.ui.personPickQuery = t.value; const list = t.closest('.person-pick'), project = d.ui.personPickProject ? d.projects.find(x => x.id === d.ui.personPickProject) : null;
    const tmp = document.createElement('div'); tmp.innerHTML = picker(d, project ? 'project' : 'cargo', project); list.querySelector('.goal-pick-items').replaceWith(tmp.querySelector('.goal-pick-items')); view.frames();
  }, {capture: true});
  view.registerDomEvent(root, 'compositionend', e => { if (e.target.matches?.('[data-person-pick-query]')) e.target.dispatchEvent(new Event('input', {bubbles: true})); }, {capture: true});
  view.registerDomEvent(root, 'keydown', e => {
    const d = data(); if (!d) return;
    if (e.key === 'Enter' && !e.isComposing && e.target.matches?.('[data-person-pick-query]')) { stop(e); e.target.closest('.person-pick').querySelector('[data-person-pick],[data-person-pick-new]')?.click(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.closest?.('.person-meet-form')) { stop(e); e.target.closest('form').requestSubmit(); return; }
    if (e.key !== 'Escape') return;
    if (d.ui.personPick || d.ui.personNew || d.ui.personPickProject) { stop(e); const back = d.ui.personPickProject ? `[data-pperson-add="${CSS.escape(d.ui.personPickProject)}"]` : d.ui.personNew ? '.cargo-person-add' : '.cargo-mailbag-more'; closePops(d); render(); $(back)?.focus({preventScroll: true}); return; }
    if (!onTasks() || !e.target.closest?.('#person-paper')) return;
    if (d.ui.personInitial) { stop(e); d.ui.personInitial = null; render(); $('[data-person-act="initial"]')?.focus({preventScroll: true}); return; }
    if (d.ui.personMeet) { stop(e); d.ui.personMeet = null; render(); $('[data-person-act="meet"]')?.focus({preventScroll: true}); return; }
    const id = d.ui.taskFilter?.id; stop(e); d.ui.taskFilter = {kind: 'all'}; render(); $(`.cargo-mailbag[data-id="${CSS.escape(id)}"]`)?.focus({preventScroll: true});
  }, {capture: true});
  // 点到纸条外面就收起（新人物的输入框空着时）
  view.registerDomEvent(root, 'pointerdown', e => {
    const d = data(); if (!d) return;
    if (d.ui.personPick && !e.target.closest?.('.person-pick, .cargo-mailbag-more')) { closePops(d); render(); return; }
    if (d.ui.personPickProject && !e.target.closest?.('.pd-person-add-wrap')) { d.ui.personPickProject = null; d.ui.personPickQuery = ''; render(); return; }
    if (d.ui.personNew && !e.target.closest?.('.person-new, .cargo-person-add') && !(d.ui.personNewDraft || '').trim()) { d.ui.personNew = false; render(); }
  }, {capture: true});

  return {create};
}
