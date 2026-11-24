// 核对“笔记 → 数据”这一圈：沙盒笔记（由原型数据生成）→ 索引 → buildModel，再和原型的 data 逐项比（按标题对上，id 不比）。
// 已知、有意的差别列在 EXPECTED 里；其余任何不同都打印出来。  node test/check-model.mjs
import YAML from 'yaml';
import {data as P} from '../tools/sample-data.js';
import {sandboxFiles} from '../tools/sandbox-spec.mjs';
import {Index} from '../src/data/index.ts';
import {buildModel} from '../src/data/model.ts';

const files = new Map(Object.entries(sandboxFiles()));
const split = text => { const m = /^---\n([\s\S]*?)\n---\n?/.exec(text); return m ? [YAML.parse(m[1]) || {}, text.slice(m[0].length)] : [{}, text]; };
const index = new Index({files: () => [...files.keys()].map(path => ({path})), frontmatter: p => files.has(p) ? split(files.get(p))[0] : null, read: async p => files.get(p) ?? '', onChange: () => () => {}});
await index.build();
const d = buildModel(index, P.clock, null);

const out = []; let n = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (what, a, b) => { n++; if (!eq(a, b)) out.push(`${what}\n    笔记→ ${JSON.stringify(a)}\n    原型  ${JSON.stringify(b)}`); };
const T = (arr, key = 'title') => new Map(arr.map(x => [x[key], x]));
const titleOf = (arr, id, key = 'title') => arr.find(x => x.id === id)?.[key];
// 实体：按标题对上，比较字段（引用换成标题）
const same = (name, mine, theirs, fields, key = 'title') => {
  const A = T(mine, key), B = T(theirs, key);
  check(`${name}：条目`, [...A.keys()].sort(), [...B.keys()].sort());
  for (const [t, b] of B) { const a = A.get(t); if (!a) continue; for (const [f, fa, fb] of fields) check(`${name}「${t}」.${f}`, fa(a), fb(b)); }
};
const refs = (mineArr, protoArr, key = 'title') => [x => (x[mineArr] || []).map(id => titleOf(d[protoArr], id, key)).sort(), x => (x[mineArr] || []).map(id => titleOf(P[protoArr], id, key)).sort()];
const f = (name, g = x => x[name] ?? null) => [name, g, g];

same('任务', d.tasks, P.tasks, [f('status'), f('date'), f('priority'), f('focus', x => x.focus || null), f('discuss', x => !!x.discuss), f('repeat', x => x.repeat || null),
  ['project', x => x.projectId ? titleOf(d.projects, x.projectId) : null, x => x.projectId ? titleOf(P.projects, x.projectId) : null],
  ['list', x => x.listId ? titleOf(d.lists, x.listId) : null, x => x.listId ? titleOf(P.lists, x.listId) : null],
  ['people', ...refs('peopleIds', 'people', 'name')], f('description', x => x.description || (x.markdown ? '' : null))]);
same('项目', d.projects, P.projects, [f('status'), f('due'), f('resume'), f('completed'), f('description'), ['stations', x => x.stations.map(s => [s.title, s.state]), x => x.stations.map(s => [s.title, s.state])],
  ['goals', ...refs('goalIds', 'goals')], ['people', ...refs('peopleIds', 'people', 'name')], ['ideas', ...refs('ideaIds', 'ideas')], ['literature', ...refs('literatureIds', 'literature')]]);
same('清单', d.lists, P.lists, [f('archived')]);
same('人物', d.people, P.people, [f('initial'), f('history')], 'name');
same('目标', d.goals, P.goals, [f('planned'), f('resume'), ['projects', ...refs('projectIds', 'projects')]]);
same('想法', d.ideas, P.ideas, [f('body'), f('stage'), f('review'), f('tag'), f('source'), f('created')]);
for (const k of ['literature', 'books']) same(k === 'books' ? '书籍' : '文献', d[k], P[k], [f('stage'), f('conclusion'), f('readDate'), ['projects', ...refs('projectIds', 'projects')]]);
// 指引：原型最终版按五个类别展示（paper-guidance-r28.js 的 specs）
check('指引', d.prompts.map(p => [p.title, p.subtitle, p.category, p.body.slice(0, 12)]), [['写作辅助', '论证、结构与表达', 'writing', '逐段检查问题、假设、方法'], ['资料整理', '问题、证据与来源', 'note', '先读当前文献的摘要、方法'], ['代码支持', '排查、解释与修改', 'code', '先阅读相关代码与错误信息'], ['数据分析', '整理投入与观察', 'data', '读取本周的每日投入与日记'], ['内容清理', '核对、归并与精简', 'clean', '只列出可能重复的摘录及其']]);
check('想法标签', d.ideaTags, P.ideaTags);
check('保存的视图', d.savedViews.map(v => [v.title, v.filter.kind, v.filter.id ? (titleOf(d.projects, v.filter.id) || titleOf(d.people, v.filter.id, 'name') || v.filter.id) : null]),
  P.savedViews.map(v => [v.title, v.filter.kind, v.filter.id ? (titleOf(P.projects, v.filter.id) || titleOf(P.people, v.filter.id, 'name') || v.filter.id) : null]));
// 今日
for (const k of ['events', 'journal', 'habits', 'questions', 'investments']) check('今日 ' + k, d[k].map(({id, ...x}) => x), P[k].map(({id, ...x}) => x));
check('往年今日', d.past, P.past); check('本周一句话', d.weekly, P.weekly); check('投入比例尺', d.investmentScaleHours, P.investmentScaleHours);
// 复盘
check('复盘 本周日期', d.review.weekDates, P.review.weekDates);
check('复盘 生活之轮', d.review.wheel, P.review.wheel); check('复盘 季度一段话', d.review.quarterText, P.review.quarterText);
for (const [i, r] of P.review.days.entries()) { const m = d.review.days[i];
  for (const k of ['achievements', 'gratitude', 'quote', 'journal']) if (r[k] !== undefined) check(`复盘 ${r.date} ${k}`, m[k], r[k]);
  if (r.questions) check(`复盘 ${r.date} questions`, m.questions, r.questions);
  if (r.investments) check(`复盘 ${r.date} investments`, m.investments.map(x => [x.title, x.hours]), r.investments.map(x => [x.title, x.hours]));
  if (r.habits) check(`复盘 ${r.date} habits`, m.habits, r.habits); }
// 原型数据自己对不上的地方（以今日页为准），不算错
const EXPECTED = [/^任务「(核对实验对照结果|记下屋檐参考线的疑问)」.description/, /^复盘 2026-10-2[678] habits/, /^复盘 2026-10-(30|31)|^复盘 2026-11-01/, /^目标「.*」\.planned/];
const real = out.filter(x => !EXPECTED.some(re => re.test(x)));
console.log(`比了 ${n} 项，不同 ${out.length} 项（其中预期内 ${out.length - real.length} 项）`);
for (const x of real) console.log('✗ ' + x);
console.log('目标已投入（按本周每日投入算；原型是写死的）：', d.goals.map(g => `${g.title} ${g.spent}/${g.planned}`).join('，'), '｜原型：', P.goals.map(g => `${g.spent}/${g.planned}`).join('，'));
console.log('完成趋势（按任务完成日期算）：', d.review.trend.join(' '), '｜原型：', P.review.trend.join(' '));
process.exitCode = real.length ? 1 : 0;
