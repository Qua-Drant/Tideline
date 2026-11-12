// 某一天的快照：今日页要画的一切都从这里取（纯函数，输入索引与日期时刻，输出普通对象）。
// 规则沿用原型 paper.js 的 renderToday：重点按 focus 排、正在做的在前；其它任务是已到期未完成的；航迹是今天完成的；
// 往年今日取往年同一天日记里的“一句话”；投入用统一比例尺。
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const RANK = {highest: 0, high: 1, medium: 2, low: 3, lowest: 4};
const done = t => t.status === 'done' || t.status === 'cancelled';

export function dayView(index, date, time){
  const tasks = [...index.tasks.values()], day = index.days.get(date) || {habits: {}, scores: {}, effort: {}, journal: [], done: []};
  const focus = tasks.filter(t => t.focus && !done(t) && t.date === date).sort((a, b) => (a.status === 'in_progress' ? -1 : 0) - (b.status === 'in_progress' ? -1 : 0) || a.focus - b.focus);
  const other = tasks.filter(t => !(t.focus && t.date === date) && !done(t) && t.date && t.date <= date).sort((a, b) => a.date.localeCompare(b.date) || RANK[a.priority] - RANK[b.priority] || a.title.localeCompare(b.title, 'zh'));
  const trail = tasks.filter(t => t.status === 'done' && (t.completed || t.date) === date);
  const pool = tasks.filter(t => t.date === date || (t.date && t.date < date && (!done(t) || t.completed === date)));
  const todays = tasks.filter(t => t.date === date);
  const ex = index.examples || new Set(), real = list => ex.size ? list.filter(t => !ex.has(t.id)) : list, exampleDay = !!(day.path && ex.has(day.path));
  const habits = index.config.habits.map(h => ({id: h.id, name: h.name, value: h.id in day.habits ? !!day.habits[h.id] : null,
    history: Array.from({length: 7}, (_, i) => { const d = index.days.get(addDays(date, i - 7)); return d && h.id in d.habits ? (d.habits[h.id] ? 1 : 0) : null; })}));
  const questions = index.config.questions.map(q => ({id: q.id, title: q.title, value: Number(day.scores[q.id]) || null}));
  const investments = Object.entries(day.effort).map(([title, hours]) => ({id: title, title, hours: Number(hours) || 0}));
  const events = index.events.filter(e => e.date === date && !e.allDay && e.time).sort((a, b) => a.time.localeCompare(b.time));
  const md = date.slice(4), years = [...index.days.values()].filter(d => d.date.slice(4) === md && d.date < date).sort((a, b) => b.date.localeCompare(a.date));
  const quoted = years.find(y => y.highlight);
  const past = quoted ? {text: quoted.highlight, year: quoted.date.slice(0, 4), path: quoted.path, more: years.filter(y => y !== quoted && y.done.length).slice(0, 1).map(y => ({year: y.date.slice(0, 4), item: y.done[0]}))} : null;
  const first = focus[0], proj = first && [...index.projects.values()].find(p => p.title === first.project), cur = proj ? proj.milestones.findIndex(m => m.state === 'in_progress') : -1;
  return {date, time, focus, other, trail, nextUp: todays.filter(t => !done(t) && !t.focus).slice(0, 2), events, journal: day.journal, habits, questions, investments,
    scale: index.config.effortScaleHours, past, allDone: pool.every(done), // 0.3：今天没有任务也算收尾，画远岸
    noTasks: pool.length === 0,
    // 统计不算示例笔记（设计说明 22.5）：示例任务不计数；今天的日记是示例时，投入与习惯都记 0
    stats: {done: real(todays).filter(t => t.status === 'done').length, total: real(todays).length, hours: exampleDay ? 0 : investments.reduce((n, x) => n + x.hours, 0), habits: exampleDay ? 0 : habits.filter(h => h.value).length, habitTotal: habits.length,
      next: events.find(e => e.time > time) || null, milestone: cur >= 0 ? {title: proj.milestones[cur].title, n: cur + 1, of: proj.milestones.length} : null},
    dayPath: day.path || null};
}
