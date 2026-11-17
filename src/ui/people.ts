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
// 第 3d 期：转 TypeScript。邮包、人物纸、见面纸、项目的相关人员都还嵌在任务页 / 项目页的 HTML 模板里（paper-tasks.js、paper-projects.js 还没改），
// 这几处的字符串版原样保留；只有纸条搜索时换下的那一段（可选的人）改成节点版，不再借一个临时元素解析 HTML。
// 第 3e 期：货舱模板（paper-tasks.ts）转成节点构建，邮包、名单纸条、人物纸、见面纸改成节点版，字符串版删去；
// 项目页的相关人员（projectPeople 与它的名单纸条 picker）还嵌在 paper-projects.js 的模板里，字符串版原样保留。
import {esc, icon, circle, iconEl, circleEl, inkEl, TICK} from '../draw/ink.ts';
import {h, svg, replaceWithNodes} from '../draw/dom.ts';
import {dayText} from './day-text.ts';
import {HOST} from '../host.ts';
import {markDeleted, restoreDeleted, dropTasks} from '../data/trash.ts';
import {completeTask} from '../data/complete.ts';
import type {Model, ModelPerson, ModelProject, ModelTask, PersonHistory, UIState} from '../data/types.ts';
import type {CompassView} from '../view.ts';

/** 人物用到的界面状态（d.ui 上的几项） */
interface PeopleUI {
  personPick?: {tasks?: string[]} | null; personPickQuery?: string; personPickProject?: string | null; personNew?: boolean; personNewDraft?: string;
  personMeet?: string | null; personMeetChoice?: Record<string, string> | null; personMeetNote?: string; personMeetFollow?: string;
  personInitial?: string | null; personLogAll?: string | null; personLogDraft?: string;
}
type PUI = UIState & PeopleUI;
/** “还有 N 人”那只邮包（不是真人物） */
type Bag = ModelPerson | {id: '__more'; name: string; initial: string; history: PersonHistory[]; cadence?: number};
interface Due { over: boolean; never?: boolean; gap?: number; left?: number }

const CADENCE: [number, string][] = [[0, '不提醒'], [7, '每周'], [14, '每两周'], [30, '每月'], [90, '每季度']];
const CHOICES = [['talked', '谈过了'], ['done', '做完了'], ['later', '下次再说']];
const closed = (t: ModelTask) => t.status === 'done' || t.status === 'cancelled';
export const days = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const lastContact = (p: {history?: PersonHistory[]}) => (p.history || []).reduce((m, x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && x.date > m ? x.date : m, '');
// 该联系了吗：没设频率 → null；设了但从没记过 → 该联系；否则看离上次联系过了几天
function dueOf(p: {cadence?: number; history?: PersonHistory[]}, today: string): Due | null{
  if (!p.cadence) return null; const last = lastContact(p); if (!last) return {over: true, never: true};
  const gap = days(last, today); return {over: gap > p.cadence, gap, left: p.cadence - gap};
}
const ago = (date: string, today: string) => { const n = days(date, today); return n <= 0 ? '今天' : n === 1 ? '昨天' : n < 14 ? n + ' 天前' : n < 60 ? Math.round(n / 7) + ' 周前' : n < 730 ? Math.round(n / 30) + ' 个月前' : Math.round(n / 365) + ' 年前'; };
const cleanName = (v: string | null | undefined) => String(v || '').replace(/[\\/:*?"<>|#^[\]@!！~]/g, ' ').trim().replace(/\s+/g, '·').slice(0, 40);
const cadenceText = (n: number) => CADENCE.find(c => c[0] === n)?.[1] || `每 ${n} 天`;
// 输入横线下的墨线（节点版，每次新建）
const underlineEl = () => svg('svg', {viewBox: '0 0 160 6', preserveAspectRatio: 'none', 'aria-hidden': 'true'}, inkEl([[0, 4], [80, 3.6], [160, 4]], .9, TICK));
const initialMark = (p: {initial?: string; name: string}) => `<span class="person-initial">${`<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${circle(14, 14, 12, 1.2)}</svg>`}<span>${esc(p.initial || p.name.slice(0, 1))}</span></span>`;
// 节点版（纸条搜索时换下的那一段用）
const initialMarkEl = (p: ModelPerson) => h('span', {class: 'person-initial'}, svg('svg', {viewBox: '0 0 28 28', width: 28, height: 28, 'aria-hidden': 'true'}, circleEl(14, 14, 12, 1.2)), h('span', null, p.initial || p.name.slice(0, 1)));

export function createPeople(view: CompassView){
  const root = view.root, $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s);
  const data = () => view.lower?.data || null;
  const render = () => view.render(true), touch = () => view.lower?.touch?.();
  // 改了模型之后：先记下要写回（touch），再重画（顺序反过来时，重画当中模型可能被按索引重建、冲掉刚做的修改）
  const commit = () => { touch(); render(); };
  const announce = (msg: string, undo?: () => unknown) => view.frame.feedback(msg, undo);
  const personOf = (id: string | null | undefined) => data()?.people.find(p => p.id === id);
  const onTasks = () => view.page === 'tasks' && !!data();
  const pendingOf = (p: {id: string}, d: Model) => d.tasks.filter(t => !closed(t) && t.discuss && (t.peopleIds || []).includes(p.id));
  const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const uiOf = (d: Model) => d.ui as PUI;

  // —— 邮包的顺序 ——
  function sorted(d: Model){
    const n = new Map<string, number>(); for (const t of d.tasks) if (t.discuss && !closed(t)) for (const id of t.peopleIds || []) n.set(id, (n.get(id) || 0) + 1);
    const over = new Map(d.people.map(p => [p.id, !!dueOf(p, d.clock.date)?.over])), last = new Map(d.people.map(p => [p.id, lastContact(p)]));
    return [...d.people].sort((a, b) => (Number(over.get(b.id)) - Number(over.get(a.id))) || ((n.get(b.id) || 0) - (n.get(a.id) || 0)) || last.get(b.id)!.localeCompare(last.get(a.id)!) || a.name.localeCompare(b.name, 'zh'));
  }
  // “还有 N 人”那只邮包不是真人物：类型上按 ModelPerson 交给货舱（它只读 id / name / initial）
  HOST.cargoPeople = (d, max) => {
    const s = sorted(d); if (s.length <= max) return s;
    const rest = s.length - (max - 1);
    return [...s.slice(0, max - 1), {id: '__more', name: `还有 ${rest} 人`, initial: '+' + rest, history: []} as unknown as ModelPerson];
  };
  // 第 3e 期：货舱模板转成节点构建，邮包、新建人物、名单纸条改成节点版（字符串版删去）
  HOST.cargoMailbags = (d, B) => {
    const ui = uiOf(d), f = ui.taskFilter, shown = HOST.cargoPeople!(d, 4) as Bag[];
    const bags = shown.map(p => {
      if (p.id === '__more') return h('button', {type: 'button', class: 'cargo-mailbag cargo-mailbag-more', 'data-person-act': 'more', 'data-p2-drop': 'people:', 'aria-expanded': String(!!ui.personPick), 'aria-label': `${p.name}：打开名单`});
      const due = dueOf(p, d.clock.date), n = pendingOf(p, d).length;
      const label = `${p.name}的待沟通事项${n ? '，' + n + ' 件' : ''}${due?.over ? '，该联系了' : ''}`;
      return B('task-filter-person', p.id, due?.over ? h('i', {class: 'mailbag-due', 'aria-hidden': 'true'}, '!') : null, label, {class: `cargo-mailbag ${due?.over ? 'is-due' : ''}`, 'data-p2-drop': 'person:' + p.id, 'aria-pressed': String(f.kind === 'person' && f.id === p.id)});
    });
    const add = h('button', {type: 'button', class: 'cargo-person-add', 'data-person-act': 'new', 'aria-expanded': String(!!ui.personNew), 'aria-label': '新建人物'}, iconEl('plus', 16));
    const form = ui.personNew ? h('form', {class: 'person-pop person-new hand-popup', 'data-person-form': 'new', role: 'dialog', 'aria-label': '新建人物'},
      h('input', {name: 'name', value: ui.personNewDraft || '', placeholder: '名字，回车', 'aria-label': '新人物的名字', autocomplete: 'off', spellcheck: 'false'}), underlineEl()) : null;
    return [bags, add, form, ui.personPick ? pickerEl(d) : null];
  };

  // —— 可搜索的人物纸条（邮包“还有 N 人”、拖到那里、项目的相关人员）——
  // 可选的人与“新建”：字符串版与节点版共用
  function pickerItems(d: Model, project: ModelProject | null){
    const ui = uiOf(d), q = (ui.personPickQuery || '').trim(), has = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
    const skip = new Set(project?.peopleIds || []);
    const people = sorted(d).filter(p => !skip.has(p.id) && has(p.name)).map(p => ({p, due: dueOf(p, d.clock.date), n: pendingOf(p, d).length}));
    const name = cleanName(q), create = name && !d.people.some(p => p.name === name) ? name : '';
    return {people, create};
  }
  function picker(d: Model, where: string, project: ModelProject | null = null){
    const ui = uiOf(d), {people, create: name} = pickerItems(d, project);
    const items = people.map(({p, due, n}) => `<button type="button" role="option" data-person-pick="${esc(p.id)}">${initialMark(p)}<span>${esc(p.name)}</span>${due?.over ? '<small class="overdue">该联系了</small>' : n ? `<small>${n} 件</small>` : ''}</button>`);
    const create = name ? `<button type="button" role="option" data-person-pick-new="${esc(name)}">${icon('plus', 15)}<span>新建人物“${esc(name)}”</span></button>` : '';
    const label = ui.personPick?.tasks ? `交给谁（${ui.personPick.tasks.length} 项）` : project ? '关联人物' : '挑一个人';
    return `<div class="goal-pick person-pick ${where === 'cargo' ? 'person-pop' : ''} hand-popup" role="listbox" aria-label="${label}"><label class="goal-pick-search">${icon('search', 15)}<input data-person-pick-query value="${esc(ui.personPickQuery || '')}" placeholder="搜索或新建人物" aria-label="${label}：搜索或新建人物" autocomplete="off"></label><div class="goal-pick-items">${items.join('') + create || '<p>没有别的人物</p>'}</div></div>`;
  }
  function pickerItemsEl(d: Model, project: ModelProject | null){
    const {people, create} = pickerItems(d, project);
    const items = people.map(({p, due, n}) => h('button', {type: 'button', role: 'option', 'data-person-pick': p.id}, initialMarkEl(p), h('span', null, p.name), due?.over ? h('small', {class: 'overdue'}, '该联系了') : n ? h('small', null, `${n} 件`) : null));
    return h('div', {class: 'goal-pick-items'}, items.length || create ? [items, create ? h('button', {type: 'button', role: 'option', 'data-person-pick-new': create}, iconEl('plus', 15), h('span', null, `新建人物“${create}”`)) : null] : h('p', null, '没有别的人物'));
  }

  // 货舱顶上的名单纸条（节点版；项目页的还嵌在项目页模板里，用上面的字符串版 picker）
  function pickerEl(d: Model){
    const ui = uiOf(d), label = ui.personPick?.tasks ? `交给谁（${ui.personPick.tasks.length} 项）` : '挑一个人';
    return h('div', {class: 'goal-pick person-pick person-pop hand-popup', role: 'listbox', 'aria-label': label},
      h('label', {class: 'goal-pick-search'}, iconEl('search', 15), h('input', {'data-person-pick-query': true, value: ui.personPickQuery || '', placeholder: '搜索或新建人物', 'aria-label': `${label}：搜索或新建人物`, autocomplete: 'off'})),
      pickerItemsEl(d, null));
  }

  // —— 人物纸（任务页右栏，筛选到这个人时）——
  HOST.personDetail = (p, d) => uiOf(d).personMeet === p.id ? meetSheet(p, d) : paper(p, d);
  // 人物纸、见面纸（节点版；结构、属性与原来的模板一一对应，模板里的换行与缩进照样留成空白文本）
  function paper(p: ModelPerson, d: Model){
    const ui = uiOf(d), today = d.clock.date, due = dueOf(p, today), last = lastContact(p), n = pendingOf(p, d).length;
    const projects = d.projects.filter(x => (x.peopleIds || []).includes(p.id));
    const lastText = last ? `${ago(last, today)} · ${dayText(last, today)}${due ? due.over ? ` · 超过 ${-due.left!} 天` : ` · 还有 ${due.left} 天` : ''}` : due ? '还没有记录 · 该联系了' : '还没有记录';
    const options = CADENCE.some(c => c[0] === (p.cadence || 0)) ? CADENCE : [...CADENCE, [p.cadence, cadenceText(p.cadence)] as [number, string]];
    const log = [...(p.history || [])].map((x, i) => ({...x, i})).reverse(), all = ui.personLogAll === p.id, list = all ? log : log.slice(0, 6);
    const W6 = '\n      ', W8 = '\n        ';
    return h('div', {class: 'person-paper', id: 'person-paper', 'data-person': p.id, role: 'region', 'aria-label': `人物：${p.name}`}, W6,
      h('div', {class: 'person-head'}, h('button', {type: 'button', class: 'person-initial-btn', 'data-person-act': 'initial', 'aria-expanded': String(ui.personInitial === p.id), 'aria-label': `改头像字（现在是 ${p.initial}）`}, initialMarkEl(p)), W8,
        h('form', {class: 'goal-title-form person-name-form', 'data-person-form': 'name'}, h('input', {name: 'name', class: 'person-name', value: p.name, 'aria-label': '名字', autocomplete: 'off', spellcheck: 'false'}), underlineEl()), W8,
        h('button', {type: 'button', class: 'inline-close', 'data-person-act': 'close', 'aria-label': '收起人物纸，回到全部任务'}, '×')), W6,
      ui.personInitial === p.id ? h('form', {class: 'person-initial-form', 'data-person-form': 'initial'}, h('span', {class: 'goal-label'}, '头像字'),
        h('input', {name: 'initial', value: p.initial, maxlength: '2', 'aria-label': '头像字（一两个字）', autocomplete: 'off'}), h('button', {type: 'submit'}, '好')) : null, W6,
      h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '联系'), h('span', {class: 'goal-status person-cadence', role: 'radiogroup', 'aria-label': '多久联系一次'},
        options.map(([k, t]) => h('button', {type: 'button', role: 'radio', 'aria-checked': String((p.cadence || 0) === k), 'data-person-cadence': k}, t)))), W6,
      h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '上次联系'), h('span', {class: `person-last ${due?.over ? 'overdue' : ''}`}, lastText)), W6,
      h('div', {class: 'goal-field'}, h('span', {class: 'goal-label'}, '待沟通'), h('span', null, n ? `${n} 件，在左边货单里` : '没有攒着的事')), W6,
      projects.length ? h('div', {class: 'goal-field goal-projects'}, h('span', {class: 'goal-label'}, '项目'), h('span', {class: 'goal-chips'},
        projects.map(x => h('button', {type: 'button', class: 'goal-chip person-project', 'data-p2': 'open-object', 'data-kind': 'project', 'data-id': x.id, 'aria-label': `打开项目 ${x.title}`}, x.title)))) : null, W6,
      h('div', {class: 'person-log'}, h('form', {class: 'goal-title-form person-log-form', 'data-person-form': 'log'},
        h('input', {name: 'text', value: ui.personLogDraft || '', placeholder: '记一笔，回车（带今天的日期）', 'aria-label': `给 ${p.name} 记一笔`, autocomplete: 'off'}), underlineEl()), W8,
        list.length ? h('ul', null, list.map(x => h('li', null, h('span', {class: 'mono'}, x.date ? x.date.slice(5).replace('-', '/') : '·'), h('span', null, x.text)))) : h('p', {class: 'goal-muted'}, '还没有记录：见完面点“见面了”，或在上面记一笔'), W8,
        log.length > 6 ? h('button', {type: 'button', class: 'person-log-all', 'data-person-act': 'log-all'}, all ? '收起' : `全部 ${log.length} 条`) : null), W6,
      h('div', {class: 'goal-foot person-foot'}, h('button', {type: 'button', class: 'person-meet', 'data-person-act': 'meet'}, '见面了'), h('button', {type: 'button', 'data-person-act': 'open-note'}, '在 Obsidian 打开'), h('button', {type: 'button', class: 'goal-delete', 'data-person-act': 'delete'}, '删除')), '\n    ');
  }
  // <textarea> 的内容：HTML 解析器会去掉开头的一个换行（原来经解析器写入），这里照做
  const textareaText = (v: string) => v.startsWith('\n') ? v.slice(1) : v;
  function meetSheet(p: ModelPerson, d: Model){
    const ui = uiOf(d), tasks = pendingOf(p, d), ch = ui.personMeetChoice || {};
    const W6 = '\n      ';
    return h('form', {class: 'person-paper person-meet-form', id: 'person-paper', 'data-person': p.id, 'data-person-form': 'meet', role: 'region', 'aria-label': `与 ${p.name} 见面`}, W6,
      h('div', {class: 'person-head'}, initialMarkEl(p), h('p', {class: 'person-meet-title'}, `与 ${p.name} 见面 · `, h('span', null, dayText(d.clock.date))), h('button', {type: 'button', class: 'inline-close', 'data-person-act': 'meet-cancel', 'aria-label': '不记了'}, '×')), W6,
      h('div', {class: 'person-meet-items'}, tasks.length ? tasks.map(t => h('div', {class: 'person-meet-item'}, h('span', {class: 'person-meet-task'}, t.title), h('span', {class: 'goal-status', role: 'radiogroup', 'aria-label': t.title},
        CHOICES.map(([k, l]) => h('button', {type: 'button', role: 'radio', 'data-person-choice': k, 'data-id': t.id, 'aria-checked': String((ch[t.id] || 'talked') === k)}, l))))) : h('p', {class: 'goal-muted'}, '没有攒着要谈的事')), W6,
      h('label', {class: 'person-meet-field'}, h('span', {class: 'goal-label'}, '结论'), h('textarea', {name: 'note', rows: '2', 'data-person-draft': 'note', placeholder: '谈了什么、定了什么（写进记录）'}, textareaText(ui.personMeetNote || ''))), W6,
      h('label', {class: 'person-meet-field'}, h('span', {class: 'goal-label'}, '跟进'), h('textarea', {name: 'follow', rows: '2', 'data-person-draft': 'follow', placeholder: '一行一件，变成新任务；写 @名字 就挂到那人身上待沟通'}, textareaText(ui.personMeetFollow || ''))), W6,
      h('div', {class: 'person-meet-foot'}, h('button', {type: 'submit', class: 'person-meet'}, '记下'), h('button', {type: 'button', 'data-person-act': 'meet-cancel'}, '取消')), '\n    ');
  }

  // —— 项目详情：相关人员的 × 与 + ——
  HOST.projectPeople = (p, d, B) => {
    const ui = uiOf(d);
    const chips = (p.peopleIds || []).map(id => { const who = d.people.find(x => x.id === id); if (!who) return '';
      return `<span class="pd-goal pd-person">${B('open-object', id, `${initialMark(who)}<span>${esc(who.name)}</span>`, '打开 ' + who.name + ' 的人物纸', 'data-kind="person" class="project-person"')}<button type="button" class="pd-person-x" data-pperson-unlink="${esc(id)}" data-project="${esc(p.id)}" aria-label="不再关联 ${esc(who.name)}">×</button></span>`; }).join('');
    return chips + `<span class="pd-person-add-wrap"><button type="button" class="pd-person-add" data-pperson-add="${esc(p.id)}" aria-expanded="${ui.personPickProject === p.id}" aria-label="关联人物">${icon('plus', 15)}</button>${ui.personPickProject === p.id ? picker(d, 'project', p) : ''}</span>`;
  };

  // —— 改动 ——
  function create(raw: string | undefined){
    const d = data(), name = cleanName(raw); if (!d || !name) return null;
    const had = d.people.find(p => p.name === name); if (had) return had;
    const p: ModelPerson = {id: 'person-' + d.serial++, name, initial: name.slice(0, 1), cadence: 0, history: []};
    d.people.push(p); touch(); return p;
  }
  HOST.createPerson = create; // 货单 @新名字 的补全（task-plus.js）
  const show = (id: string) => { const d = data()!, ui = uiOf(d); ui.taskFilter = {kind: 'person', id}; ui.personMeet = null; ui.personInitial = null; ui.personLogAll = null; ui.personLogDraft = ''; };
  function assign(ids: string[], p: ModelPerson){
    const d = data()!, tasks = ids.map(id => d.tasks.find(t => t.id === id)).filter((t): t is ModelTask => !!t); if (!tasks.length) return;
    const before = tasks.map((t): [string, string[], boolean | undefined] => [t.id, [...(t.peopleIds || [])], t.discuss]);
    for (const t of tasks) { t.peopleIds = [...new Set([...(t.peopleIds || []), p.id])]; t.discuss = true; }
    commit();
    announce(`待沟通 · ${p.name}${tasks.length > 1 ? ' · ' + tasks.length + ' 项' : ''}`, () => { const dd = data()!; for (const [id, ppl, disc] of before) { const t = dd.tasks.find(x => x.id === id); if (t) { t.peopleIds = ppl; t.discuss = disc; } } commit(); });
  }
  HOST.personPickFor = ids => { const d = data(); if (!d) return; const ui = uiOf(d); ui.personPick = {tasks: ids}; ui.personPickQuery = ''; ui.personNew = false; render(); focusPick(); };
  function remove(p: ModelPerson){
    const d = data()!, ui = uiOf(d), hold = view.lower!.hold, at = d.people.indexOf(p);
    const tasks = d.tasks.filter(t => (t.peopleIds || []).includes(p.id)).map((t): [string, string[], boolean | undefined] => [t.id, [...t.peopleIds], t.discuss]);
    const projects = d.projects.filter(x => (x.peopleIds || []).includes(p.id)).map(x => x.id);
    d.people.splice(at, 1);
    for (const t of d.tasks) if ((t.peopleIds || []).includes(p.id)) { t.peopleIds = t.peopleIds.filter(id => id !== p.id); if (!t.peopleIds.length) t.discuss = false; }
    for (const x of d.projects) x.peopleIds = (x.peopleIds || []).filter(id => id !== p.id);
    if (ui.taskFilter?.kind === 'person' && ui.taskFilter.id === p.id) ui.taskFilter = {kind: 'all'};
    if (p.id.includes('/')) hold.add(p.id); markDeleted(d, [p.id]); commit(); // 登记删除（P2-10）
    let undone = false; const timer = setTimeout(() => { if (undone) return; hold.delete(p.id); touch(); }, 5300);
    announce('已删除人物 · ' + p.name, () => { undone = true; clearTimeout(timer); hold.delete(p.id); const dd = data()!; restoreDeleted(dd, [p.id]);
      if (!dd.people.some(x => x.id === p.id)) dd.people.splice(Math.min(at, dd.people.length), 0, p);
      for (const [id, ppl, disc] of tasks) { const t = dd.tasks.find(x => x.id === id); if (t) { t.peopleIds = ppl; t.discuss = disc; } }
      for (const id of projects) { const x = dd.projects.find(y => y.id === id); if (x && !x.peopleIds.includes(p.id)) x.peopleIds.push(p.id); }
      show(p.id); commit(); });
  }
  function rename(p: ModelPerson, raw: string){
    const d = data()!, v = cleanName(raw);
    if (!v || v === p.name) return false;
    if (d.people.some(x => x !== p && x.name === v)) { announce('已经有叫“' + v + '”的人物'); return false; }
    if (p.initial === p.name.slice(0, 1)) p.initial = v.slice(0, 1);
    p.name = v; return true;
  }
  function addLog(p: ModelPerson, text: string){
    const d = data()!, t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return;
    const entry = {date: d.clock.date, text: t}; p.history = [...(p.history || []), entry]; uiOf(d).personLogDraft = '';
    commit();
    announce('记下了 · ' + p.name, () => { const x = personOf(p.id); if (x) { const i = x.history.findLastIndex(y => y.date === entry.date && y.text === entry.text); if (i >= 0) x.history = x.history.filter((_, k) => k !== i); } commit(); });
  }
  // 见面了：谈过的去掉这个人（没人了就不再待沟通），做完的完成（重复任务顺延并留一份完成记录），结论写进记录，跟进变成新任务
  function meet(p: ModelPerson, form: HTMLFormElement){
    const d = data()!, ui = uiOf(d), today = d.clock.date, ch = ui.personMeetChoice || {}, tasks = pendingOf(p, d);
    const fields = form.elements as HTMLFormControlsCollection & {note: HTMLTextAreaElement; follow: HTMLTextAreaElement};
    const note = fields.note.value.replace(/\s+/g, ' ').trim(), follow = fields.follow.value.split('\n').map(s => s.trim()).filter(Boolean);
    const saved = tasks.map(t => [t.id, {peopleIds: [...(t.peopleIds || [])], discuss: t.discuss, status: t.status, completed: t.completed, date: t.date}] as const);
    const created: ModelTask[] = [], undos: (() => void)[] = []; let talked = 0, done = 0;
    for (const t of tasks) {
      const c = ch[t.id] || 'talked'; if (c === 'later') continue;
      t.peopleIds = t.peopleIds.filter(id => id !== p.id); if (!t.peopleIds.length) t.discuss = false;
      if (c === 'talked') { talked++; continue; }
      done++;
      // 0.9.4：和今日页、任务页同一套（data/complete.js）：重复任务留完成记录并顺延、检查项清空；普通任务连带未完成的子任务
      const r = completeTask(d, t); undos.push(() => r.undo());
    }
    for (const line of follow) { const task = {id: 'task-' + d.serial++, title: line, status: 'open', priority: 'medium', date: null, projectId: null, listId: null, peopleIds: [], discuss: false, tags: [], comments: []} as unknown as ModelTask; HOST.taskCreated?.(task, d); d.tasks.push(task); created.push(task); } // 新任务还没写成笔记：只有这几项
    const entry = {date: today, text: note ? '见面：' + note : '见面'}; p.history = [...(p.history || []), entry];
    ui.personMeet = null; ui.personMeetChoice = null; ui.personMeetNote = ''; ui.personMeetFollow = '';
    commit();
    const bits = [talked && `谈过 ${talked} 件`, done && `做完 ${done} 件`, follow.length && `跟进 ${follow.length} 件`].filter(Boolean).join('，');
    announce(`记下了与 ${p.name} 的见面${bits ? '：' + bits : ''}`, () => { const dd = data()!, ids = new Set(created.map(t => t.id));
      for (const u of [...undos].reverse()) u(); // 完成的撤回（含完成记录、顺延、子任务）
      dropTasks(dd, [...ids]); // 拿掉跟进任务并登记删除（P2-10）
      for (const [id, v] of saved) { const t = dd.tasks.find(x => x.id === id); if (t) Object.assign(t, v); }
      const x = dd.people.find(y => y.id === p.id); if (x) { const i = x.history.findLastIndex(y => y.date === entry.date && y.text === entry.text); if (i >= 0) x.history = x.history.filter((_, k) => k !== i); }
      commit(); });
  }
  const openNote = (p: ModelPerson) => { const w = view.plugin?.writer; if (p.id.includes('/') && w && w.exists?.(p.id) !== false) w.open(p.id); else announce('这个人的笔记还在写，稍等再试'); };

  // 重画之后把焦点放回原来那个按钮（同样的 data-person-* 属性）；找不到就放在人物纸上
  function keep(fn: () => void){
    const was = document.activeElement, inside = was && root.contains(was) && was.closest('#person-paper, .cargo-top, .project-people');
    const key = inside && was.matches('button') ? [...was.attributes].filter(a => a.name.startsWith('data-person') || a.name === 'data-id').map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : '';
    fn();
    if (inside && (!document.activeElement?.isConnected || document.activeElement === document.body)) ((key ? $(key) : null) || $('#person-paper') || $('.cargo-person-add'))?.focus({preventScroll: true});
  }
  const focusPick = () => { const q = $<HTMLInputElement>('[data-person-pick-query]'); if (q) { q.focus({preventScroll: true}); q.setSelectionRange(q.value.length, q.value.length); } view.frames(); };
  const focusNew = () => { const i = $<HTMLInputElement>('.person-new input'); if (i) { i.focus({preventScroll: true}); i.setSelectionRange(i.value.length, i.value.length); } view.frames(); };
  const closePops = (d: Model) => { const ui = uiOf(d); ui.personPick = null; ui.personPickQuery = ''; ui.personNew = false; ui.personNewDraft = ''; ui.personPickProject = null; };

  // —— 点击 ——
  function onClick(e: MouseEvent){
    const b = (e.target as Element).closest?.<HTMLButtonElement>('button'); const d = data(); if (!b || b.disabled || !d) return;
    const ds = b.dataset, ui = uiOf(d);
    if (view.page === 'projects') {
      const project = d.projects.find(x => x.id === (ds.project || ds.ppersonAdd || ui.personPickProject));
      if (ds.ppersonUnlink && project) { stop(e); const gone = ds.ppersonUnlink, who = personOf(gone); project.peopleIds = project.peopleIds.filter(id => id !== gone); commit();
        announce('不再关联 · ' + (who?.name || ''), () => { const x = data()!.projects.find(y => y.id === project.id); if (x && !x.peopleIds.includes(gone)) x.peopleIds.push(gone); commit(); }); return; }
      if (ds.ppersonAdd) { stop(e); const open = ui.personPickProject !== ds.ppersonAdd; closePops(d); ui.personPickProject = open ? ds.ppersonAdd : null; render(); if (open) focusPick(); else $(`[data-pperson-add="${CSS.escape(ds.ppersonAdd)}"]`)?.focus({preventScroll: true}); return; }
      if ((ds.personPick || ds.personPickNew) && project && b.closest('.project-people')) { stop(e); const who = ds.personPick ? personOf(ds.personPick) : create(ds.personPickNew); if (who && !project.peopleIds.includes(who.id)) project.peopleIds = [...project.peopleIds, who.id]; closePops(d); commit(); $(`[data-pperson-add="${CSS.escape(project.id)}"]`)?.focus({preventScroll: true}); return; }
      return;
    }
    if (!onTasks()) return;
    if (ds.personPick || ds.personPickNew) { stop(e); const who = ds.personPick ? personOf(ds.personPick) : create(ds.personPickNew), pick = ui.personPick; closePops(d); if (!who) { render(); return; }
      if (pick?.tasks) assign(pick.tasks, who); else { show(who.id); keep(render); $('#person-paper')?.focus?.({preventScroll: true}); } return; }
    if (ds.personCadence !== undefined) { stop(e); const p = personOf(ui.taskFilter.id); if (!p) return; p.cadence = Number(ds.personCadence) || 0; touch(); keep(render); return; }
    if (ds.personChoice) { stop(e); ui.personMeetChoice = {...(ui.personMeetChoice || {}), [ds.id!]: ds.personChoice}; keep(render); return; }
    const act = ds.personAct; if (!act) return;
    stop(e);
    if (act === 'new') { const open = !ui.personNew; closePops(d); ui.personNew = open; render(); if (open) focusNew(); else $('.cargo-person-add')?.focus({preventScroll: true}); return; }
    if (act === 'more') { const open = !ui.personPick; closePops(d); ui.personPick = open ? {} : null; render(); if (open) focusPick(); else $('.cargo-mailbag-more')?.focus({preventScroll: true}); return; }
    const p = ui.taskFilter?.kind === 'person' ? personOf(ui.taskFilter.id) : null; if (!p) return;
    if (act === 'close') { ui.taskFilter = {kind: 'all'}; ui.personMeet = null; render(); $(`.cargo-mailbag[data-id="${CSS.escape(p.id)}"]`)?.focus({preventScroll: true}); return; }
    if (act === 'initial') { ui.personInitial = ui.personInitial === p.id ? null : p.id; render(); const i = $<HTMLInputElement>('.person-initial-form input'); i?.focus({preventScroll: true}); i?.select(); return; }
    if (act === 'log-all') { ui.personLogAll = ui.personLogAll === p.id ? null : p.id; keep(render); return; }
    if (act === 'meet') { ui.personMeet = p.id; ui.personMeetChoice = {}; ui.personMeetNote = ''; ui.personMeetFollow = ''; render(); ($('.person-meet-form [data-person-choice]') || $('.person-meet-form textarea'))?.focus({preventScroll: true}); return; }
    if (act === 'meet-cancel') { ui.personMeet = null; render(); $('[data-person-act="meet"]')?.focus({preventScroll: true}); return; }
    if (act === 'open-note') { openNote(p); return; }
    if (act === 'delete') { remove(p); return; }
  }
  view.registerDomEvent(root, 'click', onClick, {capture: true});

  view.registerDomEvent(root, 'submit', e => {
    const f = (e.target as Element).closest?.<HTMLFormElement>('[data-person-form]'); if (!f) return; stop(e); const d = data(); if (!d) return;
    const ui = uiOf(d), kind = f.dataset.personForm, p = ui.taskFilter?.kind === 'person' ? personOf(ui.taskFilter.id) : null;
    const field = (name: string) => f.elements.namedItem(name) as HTMLInputElement;
    if (kind === 'new') { const v = field('name').value; closePops(d); const who = v.trim() ? create(v) : null; if (who) { show(who.id); render(); $('#person-paper')?.focus?.({preventScroll: true}); $('.person-name')?.focus({preventScroll: true}); } else { render(); $('.cargo-person-add')?.focus({preventScroll: true}); } return; }
    if (!p) return;
    if (kind === 'name') { field('name').blur(); return; }
    if (kind === 'initial') { const v = field('initial').value.trim().slice(0, 2); p.initial = v || p.name.slice(0, 1); ui.personInitial = null; commit(); $('[data-person-act="initial"]')?.focus({preventScroll: true}); return; }
    if (kind === 'log') { addLog(p, field('text').value); $('.person-log-form input')?.focus({preventScroll: true}); return; }
    if (kind === 'meet') { meet(p, f); $('#person-paper')?.setAttribute('tabindex', '-1'); $('[data-person-act="meet"]')?.focus({preventScroll: true}); }
  }, {capture: true});
  view.registerDomEvent(root, 'change', e => {
    const t = e.target as HTMLInputElement;
    if (!t.matches?.('.person-name')) return; const d = data(), p = personOf(d?.ui.taskFilter?.id); if (!p) return;
    if (rename(p, t.value)) { commit(); } else t.value = p.name;
  }, {capture: true});
  view.registerDomEvent(root, 'input', e => {
    const d = data(); if (!d) return; const t = e.target as HTMLInputElement, ui = uiOf(d);
    if (t.matches?.('.person-new input')) { ui.personNewDraft = t.value; return; }
    if (t.matches?.('.person-log-form input')) { ui.personLogDraft = t.value; return; }
    if (t.matches?.('[data-person-draft]')) { if (t.dataset.personDraft === 'note') ui.personMeetNote = t.value; else ui.personMeetFollow = t.value; return; }
    if (!t.matches?.('[data-person-pick-query]') || (e as InputEvent).isComposing) return;
    ui.personPickQuery = t.value; const list = t.closest('.person-pick')!, project = ui.personPickProject ? d.projects.find(x => x.id === ui.personPickProject) || null : null;
    // 只换下可选的那一段（原来是拼一整张纸条的 HTML、借临时元素解析后取出这一段）
    replaceWithNodes(list.querySelector('.goal-pick-items')!, () => pickerItemsEl(d, project)); view.frames();
  }, {capture: true});
  view.registerDomEvent(root, 'compositionend', e => { if ((e.target as Element).matches?.('[data-person-pick-query]')) e.target!.dispatchEvent(new Event('input', {bubbles: true})); }, {capture: true});
  view.registerDomEvent(root, 'keydown', e => {
    const d = data(); if (!d) return; const t = e.target as Element, ui = uiOf(d);
    if (e.key === 'Enter' && !e.isComposing && t.matches?.('[data-person-pick-query]')) { stop(e); t.closest('.person-pick')!.querySelector<HTMLElement>('[data-person-pick],[data-person-pick-new]')?.click(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && t.closest?.('.person-meet-form')) { stop(e); t.closest('form')!.requestSubmit(); return; }
    if (e.key !== 'Escape') return;
    if (ui.personPick || ui.personNew || ui.personPickProject) { stop(e); const back = ui.personPickProject ? `[data-pperson-add="${CSS.escape(ui.personPickProject)}"]` : ui.personNew ? '.cargo-person-add' : '.cargo-mailbag-more'; closePops(d); render(); $(back)?.focus({preventScroll: true}); return; }
    if (!onTasks() || !t.closest?.('#person-paper')) return;
    if (ui.personInitial) { stop(e); ui.personInitial = null; render(); $('[data-person-act="initial"]')?.focus({preventScroll: true}); return; }
    if (ui.personMeet) { stop(e); ui.personMeet = null; render(); $('[data-person-act="meet"]')?.focus({preventScroll: true}); return; }
    const id = ui.taskFilter?.id; stop(e); ui.taskFilter = {kind: 'all'}; render(); $(`.cargo-mailbag[data-id="${CSS.escape(id!)}"]`)?.focus({preventScroll: true});
  }, {capture: true});
  // 点到纸条外面就收起（新人物的输入框空着时）
  view.registerDomEvent(root, 'pointerdown', e => {
    const d = data(); if (!d) return; const t = e.target as Element, ui = uiOf(d);
    if (ui.personPick && !t.closest?.('.person-pick, .cargo-mailbag-more')) { closePops(d); render(); return; }
    if (ui.personPickProject && !t.closest?.('.pd-person-add-wrap')) { ui.personPickProject = null; ui.personPickQuery = ''; render(); return; }
    if (ui.personNew && !t.closest?.('.person-new, .cargo-person-add') && !(ui.personNewDraft || '').trim()) { ui.personNew = false; render(); }
  }, {capture: true});

  return {create};
}
