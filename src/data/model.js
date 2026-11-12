// 笔记索引 → 原型的数据形状（原型 data.js + phase2-data.js 的那个 d）。思索、指引与下方五页（任务、项目、复盘、知识库、大脑）都读写它。
// 每次索引有变化时重建实体；界面状态（d.ui）、缓存（d.cache）、会面准备这类不进笔记的东西沿用上一份。
// id 一律用笔记路径（清单用名称），页面里所有“打开/关联”都按 id 找。写回笔记见 persist.js。
import {dayView} from './day.js';
import {HOST} from '../host.js';

const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const md = d => d ? `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日` : '';
const quarterOf = d => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
const SKETCH = ['harbor', 'lake', 'village', 'ridge'];

export const defaultUI = date => ({page: 'today', lamp: true, week: null, idea: null, ideaDate: date, ideaTag: null, draftTags: [], tagPicker: false, tagNewName: '', tagError: '',
  eventHover: null, eventHoverMode: null, eventDismissed: null, prompt: null, query: '', detail: null, help: false, capture: false, captureType: 'task', map: false, settings: false,
  source: null, menu: null, paused: false, seek: 0, drawn: {}, copy: null, undo: null,
  taskFilter: {kind: 'all'}, taskDetail: null, taskMenu: null, taskArchive: false, newList: false, newView: false, projectSelected: null, projectList: false, projectArchive: false,
  projectMenu: false, newProject: false, reviewPeriod: 'day', reviewDay: 0, reviewWeek: 0, reviewSource: false, wheelMenu: null, librarySelected: null, libraryFilter: null,
  libraryMenu: false, libraryHover: null, libraryKnot: null, brainSelected: null, brainType: null, brainQuery: '', brainList: false});

export function buildModel(index, clock, prev){
  const {date, time} = clock, ix = index;
  // 链接按标题或文件名找（Zotero 的文献笔记文件名是 citekey，显示的是条目标题）
  const byTitle = (map, t) => { for (const x of map.values()) if (x.title === t || x.name === t) return x.id; for (const x of map.values()) if (x.path && x.path.split('/').pop().replace(/\.md$/, '') === t) return x.id; return null; };
  const ids = (map, titles) => titles.map(t => byTitle(map, t)).filter(Boolean);
  const v = dayView(ix, date, time);
  // 示例笔记：照常显示（页面上用淡墨和“例”字印记），不计入统计（设计说明 22.5）
  const EX = ix.examples || new Set(), ex = id => EX.has(id) || undefined;
  const d = {
    clock: {date, time},
    ui: prev?.ui || defaultUI(date),
    cache: prev?.cache || {assets: {}, assetBoxes: {}, brush: null},
    serial: prev?.serial || 1,
    trash: prev?.trash || new Set(), // 显式删除队列（P2-10，trash.js）：重建模型时沿用
    meetingPreparations: prev?.meetingPreparations || [],
    ai: prev?.ai || {connected: false, agent: '科研助手', attach: false, accept: false},
  };
  d.lists = ix.config.lists.map(l => ({id: l.title, title: l.title, archived: l.archived}));
  d.people = [...ix.people.values()].map(p => ({id: p.id, name: p.name, initial: p.initial, cadence: p.cadence || 0, history: p.history.map(h => ({...h}))}));
  d.projects = [...ix.projects.values()].map(p => ({id: p.id, title: p.title, status: p.status, due: p.due || undefined, resume: p.resume || undefined, completed: p.completed || undefined,
    goalIds: ids(ix.goals, p.goals), peopleIds: ids(ix.people, p.people), ideaIds: ids(ix.ideas, p.ideas), literatureIds: ids(ix.literature, p.literature),
    stations: p.milestones.map((m, i) => ({id: 's' + i, title: m.title, state: m.state})), description: p.description, example: ex(p.id)}));
  const projId = t => byTitle(ix.projects, t);
  d.tasks = [...ix.tasks.values()].map(t => {
    const projectId = t.project ? projId(t.project) : null;
    return {id: t.id, title: t.title, project: projectId ? t.project : undefined, projectId, listId: t.list || null,
      peopleIds: ids(ix.people, t.people), priority: t.priority, discuss: t.discuss || undefined, repeat: t.repeat || undefined, date: t.date, status: t.status,
      completed: t.completed || undefined, focus: t.focus || undefined, description: t.description, markdown: t.markdown, example: ex(t.id),
      order: t.order ?? undefined, parent: t.parent || undefined, pinned: t.pinned || undefined, tags: t.tags?.length ? [...t.tags] : [], time: t.time || undefined, remind: t.remind || undefined, mode: t.mode || undefined, comments: t.comments?.length ? [...t.comments] : []};
  });
  // 父任务按标题关联（和项目一样写成链接），找不到的父任务就当没有
  for (const t of d.tasks) { t.parentId = t.parent ? d.tasks.find(x => x.title === t.parent && x.id !== t.id)?.id || null : null; delete t.parent; }
  // 按笔记重建时沿用上一份里同 id 的对象（内容换成新的）：撤销纸条里记着的对象在写回、重建之后仍然有效
  const reuse = (before, fresh) => { if (!before?.length) return fresh; const old = new Map(before.map(x => [x.id, x])); return fresh.map(x => { const o = old.get(x.id); if (!o) return x; for (const k of Object.keys(o)) if (!(k in x)) delete o[k]; return Object.assign(o, x); }); };
  d.tasks = reuse(prev?.tasks, d.tasks); d.lists = reuse(prev?.lists, d.lists); d.projects = reuse(prev?.projects, d.projects);
  // 今日（思索页的周视图、复盘页的今天也用）
  d.events = v.events.map(e => ({id: e.id, time: e.time, title: e.title, description: e.description}));
  d.planningEvents = new Map();
  for (const event of ix.events) {
    if (!d.planningEvents.has(event.date)) d.planningEvents.set(event.date, []);
    d.planningEvents.get(event.date).push(event);
  }
  for (const events of d.planningEvents.values()) events.sort((a, b) => a.time.localeCompare(b.time));
  d.journal = v.journal.map(n => ({id: n.id, time: n.time, text: n.text}));
  d.habits = v.habits.map(h => ({id: h.id, name: h.name, value: h.value, history: h.history}));
  d.questions = v.questions.map(q => ({id: q.id, title: q.title, value: q.value}));
  d.investments = v.investments.map(x => ({...x}));
  d.investmentScaleHours = v.scale;
  d.past = v.past ? {text: v.past.text, year: v.past.year} : {text: '', year: ''};
  const today = ix.days.get(date);
  d.weekly = today?.quote || '';
  // 本周（周一到周日）
  const weekStart = HOST.weekStart(date), weekDates = Array.from({length: 7}, (_, i) => addDays(weekStart, i));
  const dayOf = x => { const r = ix.days.get(x) || {habits: {}, scores: {}, effort: {}, journal: [], achievements: [], gratitude: [], quote: ''};
    return {date: x, habits: ix.config.habits.map(h => h.id in r.habits ? !!r.habits[h.id] : null), questions: ix.config.questions.map(q => r.scores[q.id] != null ? Number(r.scores[q.id]) : null),
      investments: Object.entries(r.effort).map(([title, hours]) => ({id: title, title, hours: Number(hours) || 0})), journal: r.journal.map(n => ({time: n.time, text: n.text})),
      achievements: [...(r.achievements || [])], gratitude: [...(r.gratitude || [])], quote: r.quote || ''}; };
  // 目标：每周计划投入（笔记属性 planned），本周已投入 = 本周每日投入里、名称是该目标下某个项目的那些
  const weekEffort = {}; for (const x of weekDates) for (const [k, h] of Object.entries(EX.has(ix.days.get(x)?.path) ? {} : ix.days.get(x)?.effort || {})) weekEffort[k] = (weekEffort[k] || 0) + (Number(h) || 0);
  // 0.8：status / due / completed 写回笔记；resumeDate 是原始日期，resume 只给画面（暂停且有回来日期时才有）；byProject 是本周每个项目贡献的小时
  d.goals = [...ix.goals.values()].map(g => { const projectIds = d.projects.filter(p => p.goalIds.includes(g.id)).map(p => p.id);
    const byProject = projectIds.map(id => { const p = d.projects.find(x => x.id === id); return {id, title: p.title, hours: +(weekEffort[p.title] || 0).toFixed(2)}; });
    return {id: g.id, title: g.title, planned: g.planned, spent: +byProject.reduce((n, x) => n + x.hours, 0).toFixed(2), status: g.status || 'active', due: g.due || null, completed: g.completed || null,
      resumeDate: g.resume || null, resume: g.status === 'paused' && g.resume ? md(g.resume) : undefined, projectIds, byProject, example: ex(g.id)}; });
  d.ideaTags = ix.config.ideaTags.length ? [...ix.config.ideaTags] : [...new Set([...ix.ideas.values()].flatMap(i => i.tags))];
  d.ideas = [...ix.ideas.values()].map(i => ({id: i.id, title: i.title, body: i.body, stage: i.stage, review: i.review, tag: i.tags[0] || null, tags: [...i.tags], source: i.source || undefined, created: i.created || date, example: ex(i.id),
    projectIds: d.projects.filter(p => p.ideaIds.includes(i.id)).map(p => p.id)}));
  const lib = (map, kind) => [...map.values()].map(x => ({id: x.id, title: x.title, stage: x.stage, conclusion: x.conclusion, projectIds: ids(ix.projects, x.projects), readDate: x.read || undefined, example: ex(x.id), ...(x.source === 'zotero' ? {source: 'zotero', zotero: x.zotero || '', citekey: x.citekey || ''} : {})}));
  d.literature = lib(ix.literature, 'literature'); d.books = lib(ix.books, 'book');
  // 知识库的书目信息（原型由 paper-library-r25.js 的 meta() 生成，这里先放好，它就不再生成）
  d.libraryMeta = prev?.libraryMeta && prev.libraryMetaVersion === ix.version ? prev.libraryMeta : {};
  for (const [kind, map] of [['literature', ix.literature], ['book', ix.books]]) for (const x of map.values()) d.libraryMeta[kind + '|' + x.id] ??= {authors: x.authors, year: x.year, type: x.type, added: x.added || '',
    keywords: [...x.keywords], fav: x.favorite, progress: x.progress, started: x.started || '', note: x.note, abstract: x.abstract, points: x.points.map(p => [...p]), marks: [...x.marks]};
  d.libraryMetaVersion = ix.version;
  d.prompts = [...ix.prompts.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh')).map(p => ({id: p.id, title: p.title, subtitle: p.subtitle, category: p.category, risk: p.risk, scope: [...p.scope], body: p.body}));
  d.ui.prompt ??= d.prompts[0]?.id || null;
  d.savedViews = ix.config.views.map((x, i) => { const f = x.filter || {}, ref = (map, t) => byTitle(map, String(t || '').replace(/^\[\[|\]\]$/g, ''));
    return {id: 'v' + i, title: x.title, filter: f.kind === 'project' ? {kind: 'project', id: ref(ix.projects, f.project)} : f.kind === 'person' ? {kind: 'person', id: ref(ix.people, f.person)} : f.kind === 'list' ? {kind: 'list', id: f.list} : {kind: f.kind || 'all'}}; });
  // 复盘
  const quarter = ix.quarters.get(quarterOf(date)) || {};
  const done = t => t.status === 'done';
  const trend = Array.from({length: 12}, (_, i) => { const s = addDays(weekStart, (i - 11) * 7), e = addDays(s, 6); return d.tasks.filter(t => !t.example && done(t) && (t.completed || t.date) >= s && (t.completed || t.date) <= e).length; });
  const md5 = date.slice(4), pastYears = [...ix.days.values()].filter(x => x.date.slice(4) === md5 && x.date < date && x.done.length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
    .map((x, i) => ({year: Number(x.date.slice(0, 4)), items: [...x.done], sketch: SKETCH[i % SKETCH.length]}));
  d.review = {weekDates, trend, days: weekDates.map(dayOf),
    wheel: ix.config.areas.map(a => ({id: a.id, title: a.title, value: quarter.wheel?.[a.id] != null ? Number(quarter.wheel[a.id]) : null})), quarterText: quarter.text || '',
    quarter: {harvest: (quarter.harvest || []).map(h => [String(h.title), !!h.done]), metrics: (quarter.metrics || []).map(m => [m.icon, m.title, String(m.value), m.unit || '', m.change || '']),
      directions: (quarter.directions || []).map(x => [x.icon, x.title, Number(x.progress) || 0]), experiments: (quarter.experiments || []).map(x => [x.title, !!x.done, (x.trend || []).map(Number)]),
      tasks: (quarter.tasks || []).map(Number), hours: (quarter.hours || []).map(Number), time: (quarter.time || []).map(x => [x.title, Number(x.share) || 0])},
    pastYears};
  d.ui.reviewDay = prev ? d.ui.reviewDay : Math.max(0, weekDates.indexOf(date));
  // 大脑默认显示的节点：目标、活跃项目、它们关联的想法与文献、今日重点、人物、在读/读完的书
  const active = d.projects.filter(p => ['active', 'planned', 'paused'].includes(p.status));
  d.graphDefault = {goal: d.goals.map(g => g.id), idea: [...new Set(active.flatMap(p => p.ideaIds))].slice(0, 4), project: active.map(p => p.id),
    task: [...v.focus.map(t => t.id), ...d.tasks.filter(t => t.discuss && !done(t)).map(t => t.id)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4),
    literature: [...new Set(active.flatMap(p => p.literatureIds))].slice(0, 4), person: d.people.map(p => p.id), book: d.books.filter(b => b.stage !== 'want').map(b => b.id).slice(0, 2)};
  d.summary = {inbox: 0, projects: 0, doneWeek: 0, literature: 0};
  return d;
}
