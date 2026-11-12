// 任务详情的整张纸（0.5，学滴答清单的布局，画法仍是 R39 的纸和墨）：
//   顶部：完成框 | 日期与提醒 ………… 优先级小旗
//   中间：标题（直接改）、右侧切换“文本 / 检查项”；所属项目、待沟通的人、标签；正文是即时渲染的 Markdown 编辑器
//         （打 / 弹出插入菜单）；有子任务、评论时接在下面
//   底部：所在清单（点开可搜索、切换清单或项目）………… 文本样式 A、评论、更多 ⋯
// 这里只拼 HTML；按钮的行为在 task-plus.js（data-tp / data-ts / data-tf），正文编辑器在 task-md-editor.js。
import {esc, ink, circle} from '../draw/ink.js';
import {PRIORITIES, REMINDERS} from './task-parse.js';

const svg = (body, w = 18, h = w) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;
const md = date => date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : '';
const closed = t => t.status === 'done' || t.status === 'cancelled';
const REMIND_LABEL = Object.fromEntries(REMINDERS);

// 手绘小图标（自己画的，不用滴答清单的图标）
export const SG = {
  box: svg(ink([[3,3.4],[15,3],[15.2,15],[3.2,15.2],[3,3.4]],1.3)),
  boxDone: svg(ink([[3,3.4],[15,3],[15.2,15],[3.2,15.2],[3,3.4]],1.3) + ink([[5.5,9],[8.2,12],[13,5.6]],1.6)),
  boxCancel: svg(ink([[3,3.4],[15,3],[15.2,15],[3.2,15.2],[3,3.4]],1.3) + ink([[6,6],[12,12]],1.2) + ink([[12,6],[6,12]],1.2)),
  cal: svg(ink([[2.5,4],[15.5,4],[15.5,15.5],[2.5,15.5],[2.5,4]],1.2) + ink([[2.5,7.5],[15.5,7.5]],1) + ink([[6,2],[6,5]],1.2) + ink([[12,2],[12,5]],1.2) + [6,9,12].map(x => circle(x, 11, .5, 1)).join('')),
  flag: level => svg(ink([[4,2],[4,16.5]],1.4) + (level > 0 ? ink([[4,3],[14,3.4],[11.5,6.5],[14.4,10],[4,10]],1.2) : ink([[4,3],[14,3.4],[11.5,6.5],[14.4,10],[4,10]],1.1)) + (level >= 2 ? ink([[5.5,5],[11.5,5.2]],1.6) + ink([[5.5,8],[11.6,8.2]],1.6) : level === 1 ? ink([[5.5,6.5],[10.5,6.6]],1.5) : '')),
  text: svg(ink([[3,4],[15,4]],1.2) + ink([[3,8],[15,8]],1.2) + ink([[3,12],[11,12]],1.2)),
  checklist: svg(ink([[2.5,4.5],[4.5,6.5],[7.5,2.5]],1.2) + ink([[10,4.5],[16,4.5]],1.2) + ink([[2.5,11.5],[4.5,13.5],[7.5,9.5]],1.2) + ink([[10,11.5],[16,11.5]],1.2)),
  tray: svg(ink([[2,10],[5,3],[13,3],[16,10],[16,15],[2,15],[2,10]],1.2) + ink([[2,10],[6,10],[7,12],[11,12],[12,10],[16,10]],1.1)),
  list: svg(ink([[2.5,3],[13.5,3],[15.5,5],[15.5,15],[2.5,15],[2.5,3]],1.2) + ink([[5.5,7],[12.5,7]],1) + ink([[5.5,10.5],[11,10.5]],1)),
  route: svg(ink([[3,15],[6,11],[6,6],[11,3],[15,3]],1.2) + circle(15,3,1.6,1.1)),
  style: svg(ink([[3,15],[9,2.5],[15,15]],1.3) + ink([[5.5,10],[12.5,10]],1.2) + ink([[2,17],[16,17]],1.1), 18, 18),
  comment: svg(ink([[2,3],[16,3],[16,12],[8,12],[5,15.5],[5,12],[2,12],[2,3]],1.2)),
  more: svg(circle(4,9,1,1.3) + circle(9,9,1,1.3) + circle(14,9,1,1.3)),
  close: svg(ink([[11,4],[6,9],[11,14]],1.3)),
  search: svg(circle(8,8,5,1.2) + ink([[11.6,11.6],[16,16]],1.3)),
  person: svg(circle(9,6,3,1.1) + ink([[3,16],[4.5,12],[9,10.5],[13.5,12],[15,16]],1.1)),
};
export const STYLE_TOOLS = [
  ['h', '标题', '<b class="task-tf-letter">H</b>'], ['b', '粗体', '<b class="task-tf-letter">B</b>'], ['i', '斜体', '<i class="task-tf-letter">I</i>'], ['s', '删除线', '<s class="task-tf-letter">S</s>'],
  ['mark', '高亮', svg(ink([[3,14],[6,11],[12,5],[14,7],[8,13],[5,16],[3,14]],1.1) + ink([[2,17],[16,17]],2.2), 18)],
  null,
  ['check', '检查项', svg(ink([[3,3.4],[15,3],[15.2,15],[3.2,15.2],[3,3.4]],1.1) + ink([[5.5,9],[8,11.5],[12.5,6]],1.3))],
  ['ul', '无序列表', svg(circle(3.5,5,.8,1.2) + ink([[7,5],[16,5]],1.1) + circle(3.5,9.5,.8,1.2) + ink([[7,9.5],[16,9.5]],1.1) + circle(3.5,14,.8,1.2) + ink([[7,14],[16,14]],1.1))],
  ['ol', '有序列表', svg('<text x="1" y="7" font-size="5" fill="currentColor">1</text><text x="1" y="12" font-size="5" fill="currentColor">2</text><text x="1" y="17" font-size="5" fill="currentColor">3</text>' + ink([[7,5],[16,5]],1.1) + ink([[7,10],[16,10]],1.1) + ink([[7,15],[16,15]],1.1))],
  null,
  ['quote', '引用', svg(ink([[3,3],[3,15]],1.6) + ink([[7,6],[15,6]],1.1) + ink([[7,11],[13,11]],1.1))],
  ['code', '代码', svg(ink([[6,4],[2,9],[6,14]],1.2) + ink([[12,4],[16,9],[12,14]],1.2))],
  ['link', '关联笔记 [[ ]]', svg(ink([[3,10],[7,6],[10,9]],1.2) + ink([[8,8],[11,5],[15,9]],1.2) + ink([[7,12],[11,8]],1.1))],
  ['hr', '分割线', svg(ink([[2,9],[16,9]],1.2) + ink([[2,5],[5,5]],1) + ink([[13,13],[16,13]],1))],
];
export const SLASH = [
  ['h1', '一级标题', '<b class="task-tf-letter">H1</b>'], ['h2', '二级标题', '<b class="task-tf-letter">H2</b>'], ['h3', '三级标题', '<b class="task-tf-letter">H3</b>'],
  ['ul', '无序列表', STYLE_TOOLS[7][2]], ['ol', '有序列表', STYLE_TOOLS[8][2]], ['check', '检查项', STYLE_TOOLS[6][2]], ['quote', '引用', STYLE_TOOLS[10][2]], ['hr', '水平分割线', STYLE_TOOLS[13][2]],
  null,
  ['child', '子任务', svg(ink([[4,3],[4,13],[14,13]],1.2) + ink([[11,10],[14,13],[11,16]],1.1))],
  ['tag', '标签', svg(ink([[2,2],[9,2],[16,9],[9,16],[2,9],[2,2]],1.1) + circle(6,6,1,1))],
  ['link', '关联笔记', STYLE_TOOLS[12][2]],
];

// 检查项模式：正文里不是检查项的行算“描述”，检查项一行一条
export function splitChecklist(text){
  const desc = [], items = [];
  for (const line of String(text || '').split('\n')) {
    const m = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/.exec(line);
    if (m) items.push({done: m[1] !== ' ', text: m[2]}); else desc.push(line);
  }
  return {desc: desc.join('\n').trim(), items};
}
export const joinChecklist = (desc, items) => [desc.trim(), items.map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n')].filter(Boolean).join('\n\n');

export function whenText(t){
  return [t.date ? md(t.date) : '', t.time || '', t.repeat ? t.repeat : '', t.time && t.remind ? '提醒 ' + REMIND_LABEL[t.remind] : ''].filter(Boolean).join(' · ');
}

// ctx：{draft(kind, id), want: {child, comment}, kids, title (草稿), toolbar, people, project}
export function sheetHtml(t, d, ctx){
  const id = esc(t.id), checklist = t.mode === 'checklist', level = ({highest: 3, high: 2, medium: 1, low: 0})[t.priority] ?? 1;
  const prName = PRIORITIES.find(p => p[0] === t.priority)?.[1] || '中';
  const parent = t.parentId ? d.tasks.find(x => x.id === t.parentId) : null;
  const project = t.projectId ? d.projects.find(p => p.id === t.projectId) : null, list = t.listId ? d.lists.find(l => l.id === t.listId) : null;
  const when = whenText(t), overdue = t.date && t.date < d.clock.date && !closed(t);
  const people = (t.peopleIds || []).map(pid => d.people.find(p => p.id === pid)).filter(Boolean);
  const chips = [
    project ? `<button type="button" class="task-chip" data-p2="open-object" data-kind="project" data-id="${esc(project.id)}" aria-label="打开项目 ${esc(project.title)}">${SG.route}<span>${esc(project.title)}</span></button>` : '',
    ...people.map(p => `<span class="task-chip task-chip-person"><button type="button" data-p2="open-object" data-kind="person" data-id="${esc(p.id)}" aria-label="${esc(p.name)}的待沟通事项">${SG.person}<span>${esc(p.name)}</span></button><button type="button" data-tp="unperson" data-id="${id}" data-value="${esc(p.id)}" aria-label="不再和 ${esc(p.name)} 沟通这件事">×</button></span>`),
    ...(t.tags || []).map(tag => `<span class="task-chip task-chip-tag"><span>#${esc(tag)}</span><button type="button" data-tp="untag" data-id="${id}" data-value="${esc(tag)}" aria-label="去掉标签 ${esc(tag)}">×</button></span>`),
  ].filter(Boolean).join('');
  const check = closed(t) ? (t.status === 'cancelled' ? SG.boxCancel : SG.boxDone) : SG.box;
  const kids = ctx.kids;
  let body;
  if (checklist) {
    const {desc, items} = splitChecklist(t.markdown ?? t.description);
    body = `<div class="task-checklist" data-id="${id}">
      <textarea class="task-check-desc" data-tp-desc="${id}" rows="1" placeholder="描述" aria-label="描述">${esc(ctx.draft('desc', t.id) || desc)}</textarea>
      ${items.map((it, i) => `<div class="task-check-item ${it.done ? 'is-done' : ''}"><button type="button" class="task-check-box" data-tp="checkitem" data-id="${id}" data-value="${i}" aria-label="${it.done ? '取消勾选' : '勾选'} ${esc(it.text)}" aria-pressed="${it.done}">${it.done ? SG.boxDone : SG.box}</button><input class="task-check-text" data-tp-item="${i}" data-id="${id}" value="${esc(it.text)}" aria-label="检查项 ${i + 1}" autocomplete="off"></div>`).join('')}
      <div class="task-check-item is-new"><span class="task-check-box" aria-hidden="true">${SG.box}</span><input class="task-check-text" data-tp-input="check" data-id="${id}" value="${ctx.draft('check', t.id)}" placeholder="回车添加下一项" aria-label="添加检查项" autocomplete="off"></div>
    </div>`;
  } else body = `<div class="task-md-host" data-id="${id}"></div>`;
  const subs = kids.length || ctx.want.child === t.id ? `<section class="task-sheet-section task-sheet-subs" aria-label="子任务"><h4>子任务 <span class="mono">${kids.length ? kids.filter(closed).length + '/' + kids.length : ''}</span></h4>
      ${kids.map(k => `<div class="task-sub"><button type="button" class="task-check-box" data-tp="toggle" data-id="${esc(k.id)}" aria-label="${closed(k) ? '重新打开' : '完成'} ${esc(k.title)}">${closed(k) ? SG.boxDone : SG.box}</button><button type="button" class="task-sub-title ${closed(k) ? 'is-closed' : ''}" data-tp="open" data-id="${esc(k.id)}">${esc(k.title)}</button>${k.date ? `<span class="mono task-sub-date">${md(k.date)}</span>` : ''}</div>`).join('')}
      <div class="task-sub is-new"><span class="task-check-box" aria-hidden="true">${SG.box}</span><input class="task-plus-input" data-tp-input="child" data-id="${id}" value="${ctx.draft('child', t.id)}" placeholder="添加子任务，回车" aria-label="添加子任务" autocomplete="off"></div></section>` : '';
  const comments = t.comments?.length || ctx.want.comment === t.id ? `<section class="task-sheet-section task-sheet-comments" aria-label="评论"><h4>评论 <span class="mono">${t.comments?.length || ''}</span></h4>
      ${(t.comments || []).map((line, i) => { const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(.*)$/.exec(line); return `<p class="task-comment"><span class="mono">${esc(m ? m[1].slice(5) : '')}</span> <span>${esc(m ? m[2] : line)}</span> <button type="button" data-tp="uncomment" data-id="${id}" data-value="${i}" aria-label="删掉这条评论">×</button></p>`; }).join('')}
      <input class="task-plus-input" data-tp-input="comment" data-id="${id}" value="${ctx.draft('comment', t.id)}" placeholder="写一条评论，回车" aria-label="写评论" autocomplete="off"></section>` : '';
  const dateForm = d.ui.taskDate === t.id ? `<form data-p2-form="task-date" data-id="${id}" class="cargo-date-editor line-form hand-popup task-sheet-date-pop" role="group" aria-label="日期与提醒"><input type="date" name="date" value="${t.date || ''}" aria-label="安排 ${esc(t.title)} 的日期"><button type="submit" class="text-button">保存</button></form>` : '';
  const tools = ctx.toolbar && !checklist ? `<div class="task-sheet-tools" role="toolbar" aria-label="文本样式">${STYLE_TOOLS.map(x => x ? `<button type="button" data-tf="${x[0]}" aria-label="${x[1]}">${x[2]}</button>` : '<span class="task-tf-sep" aria-hidden="true"></span>').join('')}</div>` : '';
  const where = project && !list ? project.title : list ? list.title : '收件箱';
  return `<article class="cargo-document task-sheet ${closed(t) ? 'is-closed' : ''}" data-cargo-document="${id}" data-mode="${checklist ? 'checklist' : 'text'}">
    <header class="task-sheet-top">
      <button type="button" class="task-sheet-check" data-tp="toggle" data-id="${id}" aria-label="${closed(t) ? '重新打开' : '完成'} ${esc(t.title)}" aria-pressed="${closed(t)}">${check}</button>
      <span class="task-sheet-sep" aria-hidden="true"></span>
      <button type="button" class="task-sheet-date ${t.date ? 'has-date' : ''} ${overdue ? 'is-overdue' : ''}" data-p2="task-date" data-id="${id}" aria-label="日期与提醒${when ? '：' + esc(when) : ''}" aria-expanded="${d.ui.taskDate === t.id}">${SG.cal}<span>${esc(when || '日期与提醒')}</span></button>
      <span class="task-sheet-grow"></span>
      <button type="button" class="task-sheet-flag" data-ts="priority" data-id="${id}" data-level="${level}" aria-haspopup="menu" aria-label="优先级：${prName}">${SG.flag(level)}</button>
      <button type="button" class="task-sheet-close" data-p2="task-close" aria-label="折回任务详情">${SG.close}</button>
    </header>
    ${dateForm}
    <div class="task-sheet-body">
      ${parent ? `<button type="button" class="task-parent" data-tp="open" data-id="${esc(parent.id)}">‹ ${esc(parent.title)}</button>` : ''}
      <div class="task-sheet-titlebar"><h3 class="task-sheet-title" contenteditable="true" role="textbox" aria-label="任务名称" spellcheck="false" data-tp-title="${id}">${esc(ctx.title ?? t.title)}</h3>
        <button type="button" class="task-sheet-mode" data-tp="mode" data-id="${id}" aria-pressed="${checklist}" aria-label="${checklist ? '切回文本' : '改成检查项'}">${checklist ? SG.text : SG.checklist}</button></div>
      ${chips ? `<div class="task-chips">${chips}</div>` : ''}
      ${body}
      ${subs}
      ${comments}
    </div>
    ${tools}
    <footer class="task-sheet-bottom">
      <button type="button" class="task-sheet-list" data-ts="list" data-id="${id}" aria-haspopup="menu" aria-label="所在清单：${esc(where)}">${list ? SG.list : project ? SG.route : SG.tray}<span>${esc(where)}</span></button>
      <span class="task-sheet-grow"></span>
      ${checklist ? '' : `<button type="button" data-ts="style" data-id="${id}" aria-pressed="${!!ctx.toolbar}" aria-label="文本样式">${SG.style}</button>`}
      <button type="button" data-ts="comment" data-id="${id}" aria-label="评论${t.comments?.length ? ' ' + t.comments.length + ' 条' : ''}">${SG.comment}</button>
      <button type="button" data-ts="more" data-id="${id}" aria-haspopup="menu" aria-label="更多">${SG.more}</button>
    </footer>
  </article>`;
}
