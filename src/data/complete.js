// 完成一件任务会产生哪些变更（P1-2）。不碰 DOM：任务页（ui/task-plus.js）和今日页（view.js）都调它改内存模型，
// 再由 persist.js 写回笔记，所以从哪一页完成，落到笔记里的结果都一样。
//   - 重复任务（有 repeat 和日期）：留一份完成记录（新笔记），原任务顺延到下一次（跳过今天及以前），正文里的检查项清空；
//   - 其它任务：标成完成、写上今天的完成日期；还没完成的子任务一并完成。
// 返回 {next, record, family, undo}：undo() 把原任务、子任务的字段放回去，并去掉完成记录（已写成笔记的会进回收站）。
import {nextRepeat} from '../ui/task-parse.js';
import {dropTasks} from './trash.js';

export const closedTask = t => t.status === 'done' || t.status === 'cancelled';
const KEYS = ['status', 'completed', 'date', 'markdown', 'description'];
const pick = t => Object.fromEntries(KEYS.map(k => [k, t[k]]));

// 下一次（跳过今天及以前）；规则认不出时 null
export function nextOccurrence(date, rule, today){
  const first = date && rule ? nextRepeat(date, rule) : null; if (!first) return null;
  let n = first; for (let i = 0; i < 400 && n && n <= today; i++) n = nextRepeat(n, rule) || null;
  return n || first;
}

export function completeTask(d, t){
  const today = d.clock.date, next = nextOccurrence(t.date, t.repeat, today);
  const family = next ? [] : d.tasks.filter(x => x.parentId === t.id && !closedTask(x));
  const saved = [t, ...family].map(x => [x, pick(x)]);
  let record = null;
  if (next) {
    record = {...t, id: 'task-' + d.serial++, status: 'done', completed: today, repeat: undefined, pinned: undefined, order: undefined, parentId: null,
      peopleIds: [...(t.peopleIds || [])], tags: [...(t.tags || [])], comments: [...(t.comments || [])], focus: undefined};
    d.tasks.push(record);
    t.date = next;
    if (t.markdown) t.markdown = t.markdown.replace(/^(\s*[-*]\s+)\[[xX]\]/gm, '$1[ ]');
  } else {
    t.status = 'done'; t.completed = today;
    for (const k of family) { k.status = 'done'; k.completed = today; }
  }
  const current = x => d.tasks.find(y => y.id === x.id) || x;
  return {next, record, family, undo(){
    for (const [x, v] of saved) Object.assign(current(x), v);
    if (record) dropTasks(d, [record.id]);
  }};
}

// 重新打开（今日页、任务页、项目页里点已完成的任务）
export function reopenTask(d, t){
  const saved = pick(t);
  t.status = 'open'; t.completed = undefined;
  return {undo(){ Object.assign(d.tasks.find(y => y.id === t.id) || t, saved); }};
}
