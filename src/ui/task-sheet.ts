// 任务详情的整张纸（0.5，学滴答清单的布局，画法仍是 R39 的纸和墨）：
//   顶部：完成框 | 日期与提醒 ………… 优先级小旗
//   中间：标题（直接改）、右侧切换“文本 / 检查项”；所属项目、待沟通的人、标签；正文是即时渲染的 Markdown 编辑器
//         （打 / 弹出插入菜单）；有子任务、评论时接在下面
//   底部：所在清单（点开可搜索、切换清单或项目）………… 文本样式 A、评论、更多 ⋯
// 这里只搭结构；按钮的行为在 task-plus.ts（data-tp / data-ts / data-tf），正文编辑器在 task-md-editor.ts。
// 第 3e 期：转 TypeScript；小图标、插入菜单的图改成节点版（每次调用新建一份）。
import {inkEl, circleEl} from '../draw/ink.ts';
import type {Point} from '../draw/ink.ts';
import {h, svg} from '../draw/dom.ts';
import type {Child} from '../draw/dom.ts';
import {PRIORITIES, REMINDERS} from './task-parse.ts';
import type {Model, ModelTask} from '../data/types.ts';

/** 18×18 的小图（节点版） */
export const sv = (kids: Child, w = 18, hh = w) => svg('svg', {viewBox: `0 0 ${w} ${hh}`, width: w, height: hh, 'aria-hidden': 'true'}, kids);
const md = (date: string | null | undefined) => date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : '';
const closed = (t: ModelTask) => t.status === 'done' || t.status === 'cancelled';
const REMIND_LABEL = Object.fromEntries(REMINDERS);

// 手绘小图标（自己画的，不用滴答清单的图标）
const BOX: Point[] = [[3,3.4],[15,3],[15.2,15],[3.2,15.2],[3,3.4]];
const FLAG: Point[] = [[4,3],[14,3.4],[11.5,6.5],[14.4,10],[4,10]];
/** 小图标的节点版：每个都是返回新 <svg> 的函数 */
export const SG = {
  box: () => sv(inkEl(BOX,1.3)),
  boxDone: () => sv([inkEl(BOX,1.3), inkEl([[5.5,9],[8.2,12],[13,5.6]],1.6)]),
  boxCancel: () => sv([inkEl(BOX,1.3), inkEl([[6,6],[12,12]],1.2), inkEl([[12,6],[6,12]],1.2)]),
  cal: () => sv([inkEl([[2.5,4],[15.5,4],[15.5,15.5],[2.5,15.5],[2.5,4]],1.2), inkEl([[2.5,7.5],[15.5,7.5]],1), inkEl([[6,2],[6,5]],1.2), inkEl([[12,2],[12,5]],1.2), [6,9,12].map(x => circleEl(x, 11, .5, 1))]),
  flag: (level: number) => sv([inkEl([[4,2],[4,16.5]],1.4), level > 0 ? inkEl(FLAG,1.2) : inkEl(FLAG,1.1),
    level >= 2 ? [inkEl([[5.5,5],[11.5,5.2]],1.6), inkEl([[5.5,8],[11.6,8.2]],1.6)] : level === 1 ? inkEl([[5.5,6.5],[10.5,6.6]],1.5) : null]),
  text: () => sv([inkEl([[3,4],[15,4]],1.2), inkEl([[3,8],[15,8]],1.2), inkEl([[3,12],[11,12]],1.2)]),
  checklist: () => sv([inkEl([[2.5,4.5],[4.5,6.5],[7.5,2.5]],1.2), inkEl([[10,4.5],[16,4.5]],1.2), inkEl([[2.5,11.5],[4.5,13.5],[7.5,9.5]],1.2), inkEl([[10,11.5],[16,11.5]],1.2)]),
  tray: () => sv([inkEl([[2,10],[5,3],[13,3],[16,10],[16,15],[2,15],[2,10]],1.2), inkEl([[2,10],[6,10],[7,12],[11,12],[12,10],[16,10]],1.1)]),
  list: () => sv([inkEl([[2.5,3],[13.5,3],[15.5,5],[15.5,15],[2.5,15],[2.5,3]],1.2), inkEl([[5.5,7],[12.5,7]],1), inkEl([[5.5,10.5],[11,10.5]],1)]),
  route: () => sv([inkEl([[3,15],[6,11],[6,6],[11,3],[15,3]],1.2), circleEl(15,3,1.6,1.1)]),
  style: () => sv([inkEl([[3,15],[9,2.5],[15,15]],1.3), inkEl([[5.5,10],[12.5,10]],1.2), inkEl([[2,17],[16,17]],1.1)], 18, 18),
  comment: () => sv(inkEl([[2,3],[16,3],[16,12],[8,12],[5,15.5],[5,12],[2,12],[2,3]],1.2)),
  more: () => sv([circleEl(4,9,1,1.3), circleEl(9,9,1,1.3), circleEl(14,9,1,1.3)]),
  close: () => sv(inkEl([[11,4],[6,9],[11,14]],1.3)),
  search: () => sv([circleEl(8,8,5,1.2), inkEl([[11.6,11.6],[16,16]],1.3)]),
  person: () => sv([circleEl(9,6,3,1.1), inkEl([[3,16],[4.5,12],[9,10.5],[13.5,12],[15,16]],1.1)]),
};
/** 文本样式与插入菜单的一项：[动作, 名称, 小图（返回新节点的函数）] */
export type ToolItem = [kind: string, label: string, glyph: () => Child];
const letter = (tag: 'b' | 'i' | 's', text: string) => () => h(tag, {class: 'task-tf-letter'}, text);
const olText = (y: number, n: string) => svg('text', {x: '1', y: String(y), 'font-size': '5', fill: 'currentColor'}, n);
const STYLE_TOOLS: (ToolItem | null)[] = [
  ['h', '标题', letter('b', 'H')], ['b', '粗体', letter('b', 'B')], ['i', '斜体', letter('i', 'I')], ['s', '删除线', letter('s', 'S')],
  ['mark', '高亮', () => sv([inkEl([[3,14],[6,11],[12,5],[14,7],[8,13],[5,16],[3,14]],1.1), inkEl([[2,17],[16,17]],2.2)], 18)],
  null,
  ['check', '检查项', () => sv([inkEl([[3,3.4],[15,3],[15.2,15],[3.2,15.2],[3,3.4]],1.1), inkEl([[5.5,9],[8,11.5],[12.5,6]],1.3)])],
  ['ul', '无序列表', () => sv([circleEl(3.5,5,.8,1.2), inkEl([[7,5],[16,5]],1.1), circleEl(3.5,9.5,.8,1.2), inkEl([[7,9.5],[16,9.5]],1.1), circleEl(3.5,14,.8,1.2), inkEl([[7,14],[16,14]],1.1)])],
  ['ol', '有序列表', () => sv([olText(7, '1'), olText(12, '2'), olText(17, '3'), inkEl([[7,5],[16,5]],1.1), inkEl([[7,10],[16,10]],1.1), inkEl([[7,15],[16,15]],1.1)])],
  null,
  ['quote', '引用', () => sv([inkEl([[3,3],[3,15]],1.6), inkEl([[7,6],[15,6]],1.1), inkEl([[7,11],[13,11]],1.1)])],
  ['code', '代码', () => sv([inkEl([[6,4],[2,9],[6,14]],1.2), inkEl([[12,4],[16,9],[12,14]],1.2)])],
  ['link', '关联笔记 [[ ]]', () => sv([inkEl([[3,10],[7,6],[10,9]],1.2), inkEl([[8,8],[11,5],[15,9]],1.2), inkEl([[7,12],[11,8]],1.1)])],
  ['hr', '分割线', () => sv([inkEl([[2,9],[16,9]],1.2), inkEl([[2,5],[5,5]],1), inkEl([[13,13],[16,13]],1)])],
];
const tool = (i: number) => (STYLE_TOOLS[i] as ToolItem)[2];
/** 斜杠菜单：两组之间是 null（画一道分隔线） */
export const SLASH: (ToolItem | null)[] = [
  ['h1', '一级标题', letter('b', 'H1')], ['h2', '二级标题', letter('b', 'H2')], ['h3', '三级标题', letter('b', 'H3')],
  ['ul', '无序列表', tool(7)], ['ol', '有序列表', tool(8)], ['check', '检查项', tool(6)], ['quote', '引用', tool(10)], ['hr', '水平分割线', tool(13)],
  null,
  ['child', '子任务', () => sv([inkEl([[4,3],[4,13],[14,13]],1.2), inkEl([[11,10],[14,13],[11,16]],1.1)])],
  ['tag', '标签', () => sv([inkEl([[2,2],[9,2],[16,9],[9,16],[2,9],[2,2]],1.1), circleEl(6,6,1,1)])],
  ['link', '关联笔记', tool(12)],
];

/** 检查项的一条 */
export interface CheckItem { done: boolean; text: string }
// 检查项模式：正文里不是检查项的行算“描述”，检查项一行一条
export function splitChecklist(text: string | null | undefined): {desc: string; items: CheckItem[]}{
  const desc: string[] = [], items: CheckItem[] = [];
  for (const line of String(text || '').split('\n')) {
    const m = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/.exec(line);
    if (m) items.push({done: m[1] !== ' ', text: m[2]}); else desc.push(line);
  }
  return {desc: desc.join('\n').trim(), items};
}
export const joinChecklist = (desc: string, items: CheckItem[]) => [desc.trim(), items.map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n')].filter(Boolean).join('\n\n');

function whenText(t: ModelTask){
  return [t.date ? md(t.date) : '', t.time || '', t.repeat ? t.repeat : '', t.time && t.remind ? '提醒 ' + REMIND_LABEL[t.remind] : ''].filter(Boolean).join(' · ');
}

/** 详情纸要的上下文：草稿（kind|id → 正在打的字）、临时打开的块、子任务、标题草稿、是否开着文本样式条 */
export interface SheetContext { draft(kind: string, id: string): string; want: {child: string | null; comment: string | null}; kids: ModelTask[]; title?: string; toolbar: boolean }

// 详情纸（节点版）。结构、属性及先后与原来的模板一一对应；模板里的换行与缩进照样留成空白文本节点。
// 用户输入（标题、标签、人名、项目名、检查项、评论、草稿）一律是文本节点或属性值。
const W2 = '\n  ', W4 = '\n    ', W6 = '\n      ', W8 = '\n        ';
// <textarea> 的内容：HTML 解析器会去掉开头的一个换行（原来经解析器写入），这里照做
const textareaText = (s: string) => s.startsWith('\n') ? s.slice(1) : s;
export function sheetNodes(t: ModelTask, d: Model, ctx: SheetContext): HTMLElement{
  const id = t.id, checklist = t.mode === 'checklist', level = ({highest: 3, high: 2, medium: 1, low: 0} as Record<string, number>)[t.priority] ?? 1;
  const prName = PRIORITIES.find(p => p[0] === t.priority)?.[1] || '中';
  const parent = t.parentId ? d.tasks.find(x => x.id === t.parentId) : null;
  const project = t.projectId ? d.projects.find(p => p.id === t.projectId) : null, list = t.listId ? d.lists.find(l => l.id === t.listId) : null;
  const when = whenText(t), overdue = t.date && t.date < d.clock.date && !closed(t);
  const people = (t.peopleIds || []).map(pid => d.people.find(p => p.id === pid)).filter(p => !!p);
  const chips: Child[] = [
    project ? h('button', {type: 'button', class: 'task-chip', 'data-p2': 'open-object', 'data-kind': 'project', 'data-id': project.id, 'aria-label': '打开项目 ' + project.title}, SG.route(), h('span', null, project.title)) : null,
    ...people.map(p => h('span', {class: 'task-chip task-chip-person'},
      h('button', {type: 'button', 'data-p2': 'open-object', 'data-kind': 'person', 'data-id': p.id, 'aria-label': p.name + '的待沟通事项'}, SG.person(), h('span', null, p.name)),
      h('button', {type: 'button', 'data-tp': 'unperson', 'data-id': id, 'data-value': p.id, 'aria-label': `不再和 ${p.name} 沟通这件事`}, '×'))),
    ...(t.tags || []).map(tag => h('span', {class: 'task-chip task-chip-tag'}, h('span', null, '#' + tag),
      h('button', {type: 'button', 'data-tp': 'untag', 'data-id': id, 'data-value': tag, 'aria-label': '去掉标签 ' + tag}, '×'))),
  ].filter(Boolean);
  const check = closed(t) ? (t.status === 'cancelled' ? SG.boxCancel() : SG.boxDone()) : SG.box();
  const kids = ctx.kids;
  let body: HTMLElement;
  if (checklist) {
    const {desc, items} = splitChecklist(t.markdown ?? t.description);
    body = h('div', {class: 'task-checklist', 'data-id': id}, W6,
      h('textarea', {class: 'task-check-desc', 'data-tp-desc': id, rows: '1', placeholder: '描述', 'aria-label': '描述'}, textareaText(ctx.draft('desc', t.id) || desc)), W6,
      items.map((it, i) => h('div', {class: `task-check-item ${it.done ? 'is-done' : ''}`},
        h('button', {type: 'button', class: 'task-check-box', 'data-tp': 'checkitem', 'data-id': id, 'data-value': i, 'aria-label': `${it.done ? '取消勾选' : '勾选'} ${it.text}`, 'aria-pressed': String(it.done)}, it.done ? SG.boxDone() : SG.box()),
        h('input', {class: 'task-check-text', 'data-tp-item': i, 'data-id': id, value: it.text, 'aria-label': `检查项 ${i + 1}`, autocomplete: 'off'}))), W6,
      h('div', {class: 'task-check-item is-new'}, h('span', {class: 'task-check-box', 'aria-hidden': 'true'}, SG.box()),
        h('input', {class: 'task-check-text', 'data-tp-input': 'check', 'data-id': id, value: ctx.draft('check', t.id), placeholder: '回车添加下一项', 'aria-label': '添加检查项', autocomplete: 'off'})), W4);
  } else body = h('div', {class: 'task-md-host', 'data-id': id});
  const subs = kids.length || ctx.want.child === t.id ? h('section', {class: 'task-sheet-section task-sheet-subs', 'aria-label': '子任务'}, h('h4', null, '子任务 ', h('span', {class: 'mono'}, kids.length ? kids.filter(closed).length + '/' + kids.length : '')), W6,
    kids.map(k => h('div', {class: 'task-sub'},
      h('button', {type: 'button', class: 'task-check-box', 'data-tp': 'toggle', 'data-id': k.id, 'aria-label': `${closed(k) ? '重新打开' : '完成'} ${k.title}`}, closed(k) ? SG.boxDone() : SG.box()),
      h('button', {type: 'button', class: `task-sub-title ${closed(k) ? 'is-closed' : ''}`, 'data-tp': 'open', 'data-id': k.id}, k.title),
      k.date ? h('span', {class: 'mono task-sub-date'}, md(k.date)) : null)), W6,
    h('div', {class: 'task-sub is-new'}, h('span', {class: 'task-check-box', 'aria-hidden': 'true'}, SG.box()),
      h('input', {class: 'task-plus-input', 'data-tp-input': 'child', 'data-id': id, value: ctx.draft('child', t.id), placeholder: '添加子任务，回车', 'aria-label': '添加子任务', autocomplete: 'off'}))) : null;
  const comments = t.comments?.length || ctx.want.comment === t.id ? h('section', {class: 'task-sheet-section task-sheet-comments', 'aria-label': '评论'}, h('h4', null, '评论 ', h('span', {class: 'mono'}, t.comments?.length || '')), W6,
    (t.comments || []).map((line, i) => { const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(.*)$/.exec(line); return h('p', {class: 'task-comment'}, h('span', {class: 'mono'}, m ? m[1].slice(5) : ''), ' ', h('span', null, m ? m[2] : line), ' ',
      h('button', {type: 'button', 'data-tp': 'uncomment', 'data-id': id, 'data-value': i, 'aria-label': '删掉这条评论'}, '×')); }), W6,
    h('input', {class: 'task-plus-input', 'data-tp-input': 'comment', 'data-id': id, value: ctx.draft('comment', t.id), placeholder: '写一条评论，回车', 'aria-label': '写评论', autocomplete: 'off'})) : null;
  const dateForm = d.ui.taskDate === t.id ? h('form', {'data-p2-form': 'task-date', 'data-id': id, class: 'cargo-date-editor line-form hand-popup task-sheet-date-pop', role: 'group', 'aria-label': '日期与提醒'},
    h('input', {type: 'date', name: 'date', value: t.date || '', 'aria-label': `安排 ${t.title} 的日期`}), h('button', {type: 'submit', class: 'text-button'}, '保存')) : null;
  const tools = ctx.toolbar && !checklist ? h('div', {class: 'task-sheet-tools', role: 'toolbar', 'aria-label': '文本样式'},
    STYLE_TOOLS.map(x => x ? h('button', {type: 'button', 'data-tf': x[0], 'aria-label': x[1]}, x[2]()) : h('span', {class: 'task-tf-sep', 'aria-hidden': 'true'}))) : null;
  const where = project && !list ? project.title : list ? list.title : '收件箱';
  return h('article', {class: `cargo-document task-sheet ${closed(t) ? 'is-closed' : ''}`, 'data-cargo-document': id, 'data-mode': checklist ? 'checklist' : 'text'}, W4,
    h('header', {class: 'task-sheet-top'}, W6,
      h('button', {type: 'button', class: 'task-sheet-check', 'data-tp': 'toggle', 'data-id': id, 'aria-label': `${closed(t) ? '重新打开' : '完成'} ${t.title}`, 'aria-pressed': String(closed(t))}, check), W6,
      h('span', {class: 'task-sheet-sep', 'aria-hidden': 'true'}), W6,
      h('button', {type: 'button', class: `task-sheet-date ${t.date ? 'has-date' : ''} ${overdue ? 'is-overdue' : ''}`, 'data-p2': 'task-date', 'data-id': id, 'aria-label': '日期与提醒' + (when ? '：' + when : ''), 'aria-expanded': String(d.ui.taskDate === t.id)},
        SG.cal(), h('span', null, when || '日期与提醒')), W6,
      h('span', {class: 'task-sheet-grow'}), W6,
      h('button', {type: 'button', class: 'task-sheet-flag', 'data-ts': 'priority', 'data-id': id, 'data-level': level, 'aria-haspopup': 'menu', 'aria-label': '优先级：' + prName}, SG.flag(level)), W6,
      h('button', {type: 'button', class: 'task-sheet-close', 'data-p2': 'task-close', 'aria-label': '折回任务详情'}, SG.close()), W4), W4,
    dateForm, W4,
    h('div', {class: 'task-sheet-body'}, W6,
      parent ? h('button', {type: 'button', class: 'task-parent', 'data-tp': 'open', 'data-id': parent.id}, '‹ ' + parent.title) : null, W6,
      h('div', {class: 'task-sheet-titlebar'}, h('h3', {class: 'task-sheet-title', contenteditable: 'true', role: 'textbox', 'aria-label': '任务名称', spellcheck: 'false', 'data-tp-title': id}, ctx.title ?? t.title), W8,
        h('button', {type: 'button', class: 'task-sheet-mode', 'data-tp': 'mode', 'data-id': id, 'aria-pressed': String(checklist), 'aria-label': checklist ? '切回文本' : '改成检查项'}, checklist ? SG.text() : SG.checklist())), W6,
      chips.length ? h('div', {class: 'task-chips'}, chips) : null, W6,
      body, W6,
      subs, W6,
      comments, W4), W4,
    tools, W4,
    h('footer', {class: 'task-sheet-bottom'}, W6,
      h('button', {type: 'button', class: 'task-sheet-list', 'data-ts': 'list', 'data-id': id, 'aria-haspopup': 'menu', 'aria-label': '所在清单：' + where}, list ? SG.list() : project ? SG.route() : SG.tray(), h('span', null, where)), W6,
      h('span', {class: 'task-sheet-grow'}), W6,
      checklist ? null : h('button', {type: 'button', 'data-ts': 'style', 'data-id': id, 'aria-pressed': String(!!ctx.toolbar), 'aria-label': '文本样式'}, SG.style()), W6,
      h('button', {type: 'button', 'data-ts': 'comment', 'data-id': id, 'aria-label': '评论' + (t.comments?.length ? ' ' + t.comments.length + ' 条' : '')}, SG.comment()), W6,
      h('button', {type: 'button', 'data-ts': 'more', 'data-id': id, 'aria-haspopup': 'menu', 'aria-label': '更多'}, SG.more()), W4), W2);
}
