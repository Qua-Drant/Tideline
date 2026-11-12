// 沙盒仓库的内容：取自纸本原型 data.js / phase2-data.js 的虚构数据（直接 import 原型的数据对象），改写成插件读取的笔记格式（见 docs/笔记格式.md）。
// make-sandbox.mjs 把它写成真的 Obsidian 仓库；harness 直接放进内存。两边一字不差，截图才能和原型对比。
// 原型数据自相矛盾的地方（同一天的习惯在今日页与复盘页不一样、目标的已投入与每日投入对不上等），以今日页为准，其余页会和原型有小差别。
import {data as P} from './sample-data.js';

const yaml = (v, ind = '') => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(x => typeof x !== 'object' || x === null)) return '[' + v.map(x => yaml(x)).join(', ') + ']';
    return '\n' + v.map(x => ind + '  - ' + Object.entries(x).map(([k, y], i) => (i ? ind + '    ' : '') + k + ': ' + yaml(y, ind + '    ')).join('\n')).join('\n');
  }
  if (typeof v === 'object') return '\n' + Object.entries(v).map(([k, y]) => ind + '  ' + k + ': ' + yaml(y, ind + '  ')).join('\n');
  return /^[\w\-/.:]+$/.test(v) && !/^\d/.test(v) && !/^(true|false|null|yes|no)$/i.test(v) ? v : JSON.stringify(v);
};
const note = (fm, body = '') => '---\n' + Object.entries(fm).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length) && v !== false && v !== '').map(([k, v]) => k + ': ' + yaml(v)).join('\n') + '\n---\n' + body;
const link = t => `[[${t}]]`;

export const TODAY = P.clock.date;
export const NOW = P.clock.time;

// 今日页的习惯历史（最近 7 天）以今日页为准
const HABITS = P.habits.map(h => [h.id, h.name, h.value, h.history]);
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
// 原型里“身体健康”这个项目名其实指的是“恢复跑步节律”（phase2-data.js 里的映射）
const projectTitle = id => P.projects.find(p => p.id === id)?.title;
const goalTitle = id => P.goals.find(g => g.id === id)?.title;
const personName = id => P.people.find(p => p.id === id)?.name;
const ideaTitle = id => P.ideas.find(i => i.id === id)?.title;
const litTitle = id => P.literature.find(l => l.id === id)?.title;
const listTitle = id => P.lists.find(l => l.id === id)?.title;
// 原型任务页 seedTaskMarkdown 里的三篇正文
const MARKDOWN = {
  'focus-method': '把三条关键假设写清楚，再核对符号和适用范围。\n\n## 让推理沿着一条线走\n\n先说明**我们比较的是什么**，再交代参考边界来自哪里。实现细节跟在假设后面，避免读者在两种定义之间来回猜。\n\n1. 写出输入、参照与输出各自的含义。\n2. 把适用条件放在方法之前。\n3. 让每一张对照图只回答一个问题。\n\n### 这一轮核对\n\n- [x] 分开屋檐与墙脚的参考定义\n- [ ] 统一图 3 与图 4 的符号\n- [ ] 补上不适用的两类情形\n\n> 先把假设写在纸上，再决定该补哪一张图。\n\n与 [[建筑轮廓对齐]] 对照，保留能够追溯到原始输入的判断。',
  'focus-results': '把对照结果连回同一套输入和参照。\n\n## 比较之前\n\n| 观察 | 先核对什么 |\n| --- | --- |\n| 轮廓整体偏移 | 配准与坐标约定 |\n| 局部边缘不一致 | 屋檐和墙脚的定义 |\n| 小目标断开 | 输入分辨率与覆盖范围 |\n\n- [ ] 保留原始轮廓，不覆盖上一轮结果\n- [ ] 给每张图留一句不带解释的观察\n\n回到 [[论文修改]]，只写证据能够支持的结论。',
  'inbox-01': '先留下一条简短的线索，再决定它属于哪一段工作。\n\n- [ ] 找到对应的输入\n- [ ] 写下需要核对的依据',
};
// 原型知识库（paper-library-r25.js）按条目序号生成的书目信息；这里写成笔记属性
const KW = {'lit-01': ['研究设计', '假设', '方法'], 'lit-02': ['配准', '建筑轮廓', '误差'], 'lit-03': ['边界误差', '评价', '分布'], 'lit-04': ['制图', '图表', '写作'], 'lit-05': ['样本', '覆盖偏差'], 'lit-06': ['定性研究', '可追溯'], 'lit-07': ['写作', '不确定性'], 'lit-08': ['遥感', '尺度'], 'lit-09': ['复现', '实验'], 'lit-10': ['空间样本', '外推'], 'lit-11': ['分割', '瓦片'], 'lit-12': ['边界模型'], 'book-01': ['研究方法', '问题'], 'book-02': ['写作', '读者'], 'book-03': ['统计', '不确定性'], 'book-04': ['专注', '时间'], 'book-05': ['城市', '观察']};
const AUTH = ['林岚 等', '周屿 等', '陈芮', '许衡 等', '苏禾', '叶舟 等', '沈砚', '韩溪 等', '顾川', '程鸥 等', '宋岩', '方澄'], TYPE = ['期刊论文', '会议论文', '预印本', '学位论文'],
  PROG = {inbox: 0, skimmed: 30, 'to-deep': 45, 'deep-done': 100, dropped: 10, want: 0, reading: 60, done: 100};
// 原型复盘页的往年今日（paper-review.js 的 pastYears）
const PAST = [[2025, ['把数据预处理流程整理成一页清单', '读完两篇建筑轮廓提取的论文', '和林老师讨论了方法的改进方向']], [2024, ['搭好了第一版实验环境', '画出初步的结果对照图', '参加了实验室组会']],
  [2023, ['整理暑期实习的测量记录', '读了关于地表模型生成的文献', '做了一次方法对比实验']], [2022, ['去江边做了一天实地调研', '学了摄影测量的基础知识', '交了课程实验报告初稿']]];
// 原型复盘页的季度数据（paper-review.js 的 quarter 默认值）
const QUARTER = {harvest: [['实验方法有了初稿', true], ['建立了更稳定的身体节律', true], ['推动了研究方向的系统梳理', true], ['与家人有了更多高质量相处', false]],
  metrics: [['task', '完成任务', '128', '', '+18%'], ['clock', '深度投入', '86.5', 'h', '+12%'], ['book', '阅读量', '12', '本', '+33%'], ['run', '运动次数', '36', '次', '+20%'], ['moon', '平均睡眠', '7.4', 'h', '+3%'], ['heart', '习惯达成率', '78', '%', '+6pp']],
  directions: [['flask', '深化研究方法', .7], ['book', '维持规律作息与运动', .6], ['home', '改善居住与工作环境', .4]],
  experiments: [['每日专注块 ≥ 3 小时', false, [3, 5, 4, 6, 5]], ['每周 3 次运动', true, [2, 3, 3, 4, 3]], ['尝试数字极简', false, [4, 3, 5, 4, 5]], ['为家人准备一次特别体验', false, [1, 3, 2, 4, 5]]],
  tasks: [48, 56, 61, 70, 72, 80, 85, 88, 98, 104, 110, 128], hours: [24, 28, 31, 39, 40, 44, 49, 54, 58, 63, 70, 86.5],
  time: [['研究与学习', 34], ['实验与项目', 24], ['生活事务', 16], ['运动健康', 11], ['阅读与思考', 9], ['其他', 6]]};
const GUIDE = [['method', '写作辅助', '论证、结构与表达', 'writing'], ['read-paper', '资料整理', '问题、证据与来源', 'note'], ['code-support', '代码支持', '排查、解释与修改', 'code'], ['week-review', '数据分析', '整理投入与观察', 'data'], ['clean', '内容清理', '核对、归并与精简', 'clean']];
const quarterOf = d => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
const filterOut = f => f.kind === 'project' ? {kind: 'project', project: link(projectTitle(f.id))} : f.kind === 'list' ? {kind: 'list', list: listTitle(f.id)} : f.kind === 'person' ? {kind: 'person', person: link(personName(f.id))} : {kind: f.kind};

export function sandboxFiles(){
  const f = {};
  f['潮线/配置.md'] = note({habits: HABITS.map(([id, name]) => ({id, name})), questions: P.questions.map(q => ({id: q.id, title: q.title})), effortScaleHours: P.investmentScaleHours,
    lists: P.lists.map(l => ({title: l.title, archived: l.archived})), views: P.savedViews.map(v => ({title: v.title, filter: filterOut(v.filter)})), ideaTags: P.ideaTags,
    areas: P.review.wheel.map(w => ({id: w.id, title: w.title}))},
  '潮线的设置。习惯与每日问题的 id 写进每天的日记属性里，改名字不影响旧记录。\n');
  f['潮线/日程.md'] = note({events: P.events.map(e => ({date: TODAY, time: e.time, title: e.title, description: e.description}))}, '日历订阅接入之前，日程先写在这里。\n');
  // 项目
  for (const p of P.projects) f[`项目/${p.title}.md`] = note({status: p.status, due: p.due, resume: p.resume, completed: p.completed,
    goals: p.goalIds.map(id => link(goalTitle(id))), people: p.peopleIds.map(id => link(personName(id))), ideas: p.ideaIds.map(id => link(ideaTitle(id))), literature: p.literatureIds.map(id => link(litTitle(id))),
    milestones: p.stations.map(s => ({title: s.title, state: s.state}))}, p.description ? p.description + '\n' : '');
  // 任务
  for (const t of P.tasks) {
    const body = MARKDOWN[t.id] || t.description || '';
    f[`任务/${t.title}.md`] = note({status: t.status, scheduled: t.date || undefined, project: t.projectId ? link(projectTitle(t.projectId)) : undefined, list: t.listId ? listTitle(t.listId) : undefined,
      people: (t.peopleIds || []).map(id => link(personName(id))), priority: t.priority || 'medium', discuss: t.discuss, repeat: t.repeat, focus: t.focus, completed: t.status === 'done' ? (t.completed || t.date) : undefined}, body ? body + '\n' : '');
  }
  // 人物、目标
  for (const p of P.people) f[`人物/${p.name}.md`] = note({initial: p.initial}, '## 记录\n' + p.history.map(h => `- ${h.date} ${h.text}`).join('\n') + '\n');
  for (const g of P.goals) f[`目标/${g.title}.md`] = note({planned: g.planned, resume: g.resume ? '2026-11-09' : undefined});
  // 想法
  for (const i of P.ideas) f[`想法/${i.title}.md`] = note({stage: i.stage, review: i.review, tags: i.tag ? [i.tag] : [], source: i.source ? link(i.source) : undefined, created: i.created}, i.body + '\n');
  // 文献、书籍（书目信息按原型知识库的生成规则）
  for (const [kind, items, folder] of [['literature', P.literature, '文献'], ['book', P.books, '书籍']]) items.forEach((it, i) => {
    const book = kind === 'book', proj = it.projectIds[0] && projectTitle(it.projectIds[0]);
    f[`${folder}/${it.title}.md`] = note({stage: it.stage, authors: AUTH[(i * 5 + (book ? 3 : 0)) % AUTH.length], year: 2018 + (i * 3 + (book ? 1 : 0)) % 8, type: book ? '专著' : TYPE[i % 4],
      added: `2026-10-${String(Math.max(2, 28 - i * 2 - (book ? 5 : 0))).padStart(2, '0')}`, started: `2026-10-${String(Math.max(1, 20 - i)).padStart(2, '0')}`,
      keywords: KW[it.id] || [], favorite: ['lit-01', 'lit-03', 'book-02'].includes(it.id), progress: PROG[it.stage] ?? 0, read: it.readDate, projects: it.projectIds.map(id => link(projectTitle(id)))},
    `${it.conclusion}\n\n## 摘要\n本${book ? '书' : '文'}围绕「${it.title}」展开。${it.conclusion}作者用几组对照案例说明这一点，并给出一套可以直接套用的检查步骤。\n\n## 要点\n- 核心观点：${it.conclusion}\n- 适用范围：${proj ? `与「${proj}」相关的判断与写作。` : '当前研究中需要说明依据的部分。'}\n- 可借用的做法：读完后整理成一页检查清单，放进对应项目。\n\n## 摘录\n- “${it.conclusion}”\n- 第 3 节的对照表值得复用。\n`);
  });
  // 指引（提示词）
  // 原型最终版（paper-guidance-r28.js）按五个类别展示：标题、副标题、类别取它的 specs，正文取原型数据
  GUIDE.forEach(([id, title, subtitle, category], i) => { const p = P.prompts.find(x => x.id === id) || {risk: 2, scope: [1, 0, 1, 0], body: '先阅读相关代码与错误信息，解释问题的原因。给出最小修改建议和验证方法。保留已有改动，先展示差异，等待确认。'};
    f[`潮线/指引/${title}.md`] = note({subtitle, category, risk: p.risk, scope: p.scope, order: i + 1}, p.body + '\n'); });
  // 季度
  const Q = QUARTER;
  f[`潮线/季度/${quarterOf(TODAY)}.md`] = note({wheel: Object.fromEntries(P.review.wheel.filter(w => w.value !== null).map(w => [w.id, w.value])),
    harvest: Q.harvest.map(([title, done]) => ({title, done})), directions: Q.directions.map(([icon, title, progress]) => ({icon, title, progress})),
    experiments: Q.experiments.map(([title, done, trend]) => ({title, done, trend})), metrics: Q.metrics.map(([icon, title, value, unit, change]) => ({icon, title, value, unit, change})),
    tasks: Q.tasks, hours: Q.hours, time: Q.time.map(([title, share]) => ({title, share}))}, P.review.quarterText + '\n');
  // 日记：今天之前 7 天的习惯以今日页为准；本周的其它内容（自问、投入、随手记、成就、感恩、一句话）取复盘页的数据
  const week = new Map(P.review.days.map(r => [r.date, r]));
  for (let i = 1; i <= 7; i++) {
    const d = addDays(TODAY, -i), habits = {}, r = week.get(d);
    for (const [id, , , hist] of HABITS) { const v = hist[7 - i]; if (v !== null) habits[id] = !!v; }
    const scores = {}; if (r?.questions) P.questions.forEach((q, j) => { if (r.questions[j] != null) scores[q.id] = r.questions[j]; });
    const effort = r?.investments?.length ? Object.fromEntries(r.investments.map(x => [x.title, x.hours])) : undefined;
    let body = '';
    if (r?.journal?.length) body += '## 随手记\n' + r.journal.map(n => `- ${n.time} ${n.text}`).join('\n') + '\n';
    if (r?.achievements?.length) body += '\n## 成就\n' + r.achievements.map(x => '- ' + x).join('\n') + '\n';
    if (r?.gratitude?.length) body += '\n## 感恩\n' + r.gratitude.map(x => '- ' + x).join('\n') + '\n';
    f[`日记/${d}.md`] = note({habits, scores: Object.keys(scores).length ? scores : undefined, effort, quote: r?.quote || undefined}, body.replace(/^\n/, ''));
  }
  const habits = {}; for (const [id, , v] of HABITS) if (v !== null) habits[id] = v;
  const scores = {}; for (const q of P.questions) if (q.value !== null) scores[q.id] = q.value;
  const today = week.get(TODAY) || {};
  f[`日记/${TODAY}.md`] = note({habits, scores, effort: Object.fromEntries(P.investments.map(x => [x.title, x.hours])), quote: P.weekly},
    '## 随手记\n' + P.journal.map(n => `- ${n.time} ${n.text}`).join('\n') + '\n'
    + (today.achievements?.length ? '\n## 成就\n' + today.achievements.map(x => '- ' + x).join('\n') + '\n' : '')
    + (today.gratitude?.length ? '\n## 感恩\n' + today.gratitude.map(x => '- ' + x).join('\n') + '\n' : ''));
  // 往年今日
  for (const [year, items] of PAST) f[`日记/${year}${TODAY.slice(4)}.md`] = note({highlight: year === 2025 ? P.past.text : undefined}, '## 完成\n' + items.map(x => '- ' + x).join('\n') + '\n');
  return f;
}

// 浏览器和原生 Obsidian 用同一批虚构任务、日记、普通笔记测大仓库。
export function fillSandbox(files, extra){
  const total = files.size + extra;
  for (let i = 0; files.size < total; i++) {
    if (i % 5 === 0) {
      const scheduled = '2025-' + String(1 + i % 12).padStart(2, '0') + '-' + String(1 + i % 28).padStart(2, '0');
      files.set('任务/填充任务 ' + i + '.md', note({status: i % 3 ? 'done' : 'open', scheduled, priority: 'medium'}, '填充任务\n'));
    } else if (i % 5 === 1) {
      const day = new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      const name = '日记/' + day + '.md';
      if (!files.has(name)) files.set(name, note({habits: {water: true}}, '## 随手记\n- 08:00 填充 ' + i + '\n'));
    } else {
      files.set('笔记/填充 ' + i + '.md', '# 填充 ' + i + '\n\n' + '填充正文。'.repeat(40));
    }
  }
}
