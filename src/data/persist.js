// 下方五页（以及思索、指引）改了数据之后写回笔记。
// 原型的页面模块直接改内存里的 d（加任务、改日期、拖到别的清单……）。这里不去改原型的每一处写法，而是在每次操作之后
// 把 d 和上一次的快照逐条比一遍：哪条变了，就只把变了的属性写回那一篇笔记；新出现的建笔记；显式登记删除的（d.trash，见 trash.js）移到回收站（Obsidian 的“删除”）。
// 写完由 Obsidian 的改动通知回到索引，模型重建，画面重画。比一遍几百条只要零点几毫秒（JSON 字符串比较）。
import {FOLDERS} from './index.js';
import {splitFm, keepEol} from './frontmatter.js';

const link = t => t ? `[[${t}]]` : null;
const clean = s => String(s).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '未命名';
// 以下几个改正文的函数：属性块按 frontmatter.js 切出来原样保留；CRLF 的文件先转成 LF 处理、再按原样写回（keepEol）
const lf = s => String(s ?? '').replace(/\r\n/g, '\n');
// 正文里替换（或新增）一个二级标题下的内容
export const setSection = (text, title, content) => keepEol(text, s => {
  const {fm, body} = splitFm(s), m = new RegExp('^##\\s+' + title + '\\s*$', 'm').exec(body), c = lf(content);
  const block = c.trim() ? `## ${title}\n${c.trim()}\n` : '';
  if (!m) return block ? fm + body.replace(/\n*$/, '') + (body.trim() ? '\n\n' : '') + block : s;
  const rest = body.slice(m.index + m[0].length), end = rest.search(/^##\s/m), after = end < 0 ? '' : rest.slice(end);
  return fm + body.slice(0, m.index) + block + (after ? '\n' + after : '');
});
// 正文开头（第一个标题之前）的第一段
export const setLead = (text, para) => keepEol(text, s => {
  const {fm, body} = splitFm(s), i = body.search(/^#{1,6}\s/m), head = i < 0 ? body : body.slice(0, i), tail = i < 0 ? '' : body.slice(i);
  const parts = head.trim() ? head.trim().split(/\n\s*\n/) : []; if (para) parts[0] = lf(para); else parts.shift();
  return fm + (parts.length ? parts.join('\n\n') + '\n' : '') + (tail ? (parts.length ? '\n' : '') + tail : '');
});
export const setBody = (text, body) => keepEol(text, s => splitFm(s).fm + (body ? lf(body).replace(/\n*$/, '\n') : ''));

// 每类实体：存在哪个文件夹、属性怎么从 d 里的条目算出来、正文的哪些部分归它
function specs(d){
  const title = (arr, id, k = 'title') => arr.find(x => x.id === id)?.[k] || null;
  // 链接写文件名（和标题一样，除了 Zotero 导进来的文献：文件名是 citekey）
  const links = (arr, ids, k = 'title') => (ids || []).map(id => { const x = arr.find(y => y.id === id); return link(x?.source === 'zotero' && String(id).includes('/') ? String(id).split('/').pop().replace(/\.md$/, '') : title(arr, id, k)); }).filter(Boolean);
  return {
    // 0.8：目标（放在最前：新目标的笔记先建好，项目里的链接再指过去）（每周计划投入、状态、截止日期；正文不归插件管）
    goals: {folder: FOLDERS.goals, fm: g => ({planned: g.planned || 0, status: g.status && g.status !== 'active' ? g.status : null, due: g.due || null,
      resume: g.status === 'paused' ? g.resumeDate || null : null, completed: g.status === 'done' ? g.completed || null : null}), body: () => ({})},
    // 0.9：人物（放在任务、项目之前：新人物的笔记先建好，链接再指过去）。initial 头像字、cadence 每隔几天联系；正文只管 ## 记录
    people: {folder: FOLDERS.people, nameKey: 'name', fm: p => ({initial: p.initial, cadence: p.cadence || null}), body: p => ({log: {'记录': (p.history || []).map(h => `- ${h.date ? h.date + ' ' : ''}${h.text}`)}})},
    tasks: {folder: FOLDERS.tasks, fm: t => ({status: t.status, scheduled: t.date || null, project: t.projectId ? link(title(d.projects, t.projectId)) : null, list: t.listId || null,
      people: links(d.people, t.peopleIds, 'name'), priority: t.priority || 'medium', discuss: t.discuss || null, repeat: t.repeat || null, focus: t.focus || null, completed: t.status === 'done' ? t.completed || null : null,
      order: Number.isFinite(t.order) ? t.order : null, parent: t.parentId ? link(title(d.tasks, t.parentId)) : null, pinned: t.pinned ? true : null,
      tags: t.example ? [...new Set(['example', ...(t.tags || [])])] : (t.tags || []), time: t.time || null, remind: t.time && t.remind ? t.remind : null, mode: t.mode === 'checklist' ? 'checklist' : null, comments: t.comments || []}),
      body: t => ({all: t.markdown ?? t.description ?? ''})},
    projects: {folder: FOLDERS.projects, fm: p => ({status: p.status, due: p.due || null, resume: p.resume || null, completed: p.completed || null, goals: links(d.goals, p.goalIds), people: links(d.people, p.peopleIds, 'name'),
      ideas: links(d.ideas, p.ideaIds), literature: links(d.literature, p.literatureIds), milestones: (p.stations || []).map(s => ({title: s.title, state: s.state}))}),
      body: p => ({lead: p.description || ''})},
    ideas: {folder: FOLDERS.ideas, fm: i => ({stage: i.stage, review: i.review || null, tags: i.tags?.length ? [...new Set([i.tag, ...i.tags].filter(Boolean))] : i.tag ? [i.tag] : [], source: i.source ? link(i.source) : null, created: i.created || null}),
      body: i => ({all: i.body || ''})},
    literature: {folder: FOLDERS.literature, fm: x => libFm(d, 'literature', x, links), body: x => libBody(d, 'literature', x)},
    books: {folder: FOLDERS.books, fm: x => libFm(d, 'book', x, links), body: x => libBody(d, 'book', x)},
  };
}
function libFm(d, kind, x, links){ const m = d.libraryMeta?.[kind + '|' + x.id] || {};
  return {stage: x.stage, read: x.readDate || null, projects: links(d.projects, x.projectIds), favorite: m.fav || null, progress: m.progress ?? null, keywords: m.keywords || []}; }
function libBody(d, kind, x){ const m = d.libraryMeta?.[kind + '|' + x.id] || {}; return {lead: x.conclusion || '', sections: {'笔记': m.note || ''}}; }

const snap = v => JSON.stringify(v);

export function createPersist(writer){
  let last = null; // {kind: Map(id → {fm, body, title})}
  function capture(d){ const S = specs(d), out = {};
    for (const [kind, s] of Object.entries(S)) { out[kind] = new Map(); for (const x of d[kind] || []) { const fmObj = s.fm(x), bodyObj = s.body(x); out[kind].set(x.id, {title: x[s.nameKey || 'title'], fm: snap(fmObj), body: snap(bodyObj), fmObj, bodyObj}); } }
    out.config = snap(configOf(d)); out.configObj = configOf(d); out.quarter = snap(quarterOf(d)); out.quarterObj = quarterOf(d);
    return out; }
  const configOf = d => ({lists: d.lists.map(l => ({title: l.title, archived: !!l.archived})), views: d.savedViews.map(v => ({title: v.title, filter: filterOut(d, v.filter)})), ideaTags: [...(d.ideaTags || [])]});
  const quarterOf = d => ({wheel: Object.fromEntries((d.review?.wheel || []).filter(w => w.value != null).map(w => [w.id, w.value])),
    harvest: (d.review?.quarter?.harvest || []).map(([title, done]) => ({title, done})), experiments: (d.review?.quarter?.experiments || []).map(([title, done, trend]) => ({title, done, trend})), text: d.review?.quarterText || ''});
  return {
    // 模型刚从笔记建好时调用：以此为准
    reset(d){ last = capture(d); },
    // 每次操作之后调用：把变化写回笔记。返回写了几处
    // 删除只认 d.trash 里登记过的 id（P2-10，trash.js）
    // hold：刚删掉、撤销纸条还在的 id。它们先不进回收站，快照里也留着，纸条消失后下一次 commit 再删
    async commit(d, {hold} = {}){
      if (!last) { last = capture(d); return 0; }
      const previous = last, now = capture(d), S = specs(d), jobs = [], trash = d.trash ??= new Set(), trashed = new Set(), kept = new Set();
      for (const [kind, s] of Object.entries(S)) {
        const before = last[kind], after = now[kind];
        for (const x of d[kind] || []) {
          const id = x.id, a = after.get(id), b = before.get(id);
          if (!b) { // 新条目：建笔记，id 换成路径（界面状态里引用旧 id 的地方一并换掉）
            let path = id.includes('/') ? id : `${s.folder}/${clean(a.title)}.md`, n = 2;
            if (!id.includes('/')) while (writer.exists?.(path) || jobs.some(j => j.path === path)) path = `${s.folder}/${clean(a.title)} ${n++}.md`;
            renameRefs(d, id, path); x.id = path;
            jobs.push({path, run: () => writer.create(path, '---\n---\n').then(() => writer.frontmatter(path, fm => applyFm(fm, a.fmObj, {})).then(() => writeBody(writer, path, a.bodyObj, null)))});
            continue;
          }
          // Zotero 导进来的文献不改文件名（Zotero Integration 按 citekey 找回这篇笔记）
          if (a.title !== b.title && id.includes('/') && x.source !== 'zotero') { const to = `${s.folder}/${clean(a.title)}.md`; if (!writer.exists?.(to)) { jobs.push({path: id, run: () => writer.rename(id, to)}); renameRefs(d, id, to); x.id = to; } }
          const path = x.id;
          if (a.fm !== b.fm) jobs.push({path, run: () => writer.frontmatter(path, fm => applyFm(fm, a.fmObj, b.fmObj))});
          if (a.body !== b.body) jobs.push({path, run: () => writeBody(writer, path, a.bodyObj, b.bodyObj)});
        }
        // P2-10：只删显式登记过的（d.trash，见 trash.js），且不在撤销期（hold）里。只是从数组里消失、没登记的不删笔记，快照里也留着
        if (kind === 'tasks' || kind === 'goals' || kind === 'people') for (const id of before.keys()) {
          if (after.has(id)) continue;
          if (id.includes('/') && trash.has(id) && !hold?.has(id)) { trashed.add(id); jobs.push({path: id, run: () => writer.trash(id)}); }
          else kept.add(id);
        }
      }
      // 没删的消失条目（撤销期里的、没登记的）留在快照里：不当成新条目，也不丢掉它们的旧值
      const keepHeld = snapshot => { for (const id of kept) for (const k of ['tasks', 'goals', 'people']) if (previous[k].has(id) && !snapshot[k].has(id)) snapshot[k].set(id, previous[k].get(id)); return snapshot; };
      // 登记了但快照里没有的（还没写成笔记就撤销了的新条目），或已经回到模型里的，不再留在队列里
      const present = id => ['tasks', 'goals', 'people'].some(k => now[k].has(id));
      for (const id of [...trash]) if (!trashed.has(id) && !hold?.has(id) && (present(id) || !['tasks', 'goals', 'people'].some(k => previous[k].has(id)))) trash.delete(id);
      if (now.config !== previous.config) jobs.push({path: FOLDERS.config, run: () => writer.frontmatter(FOLDERS.config, fm => applyFm(fm, now.configObj, previous.configObj))});
      if (now.quarter !== last.quarter) { const q = `${FOLDERS.quarters}/${d.clock.date.slice(0, 4)}-Q${Math.floor((Number(d.clock.date.slice(5, 7)) - 1) / 3) + 1}.md`, {text, ...fmA} = now.quarterObj, {text: textB, ...fmB} = last.quarterObj;
        jobs.push({path: q, run: async () => { await writer.frontmatter(q, fm => applyFm(fm, fmA, fmB)); if (text !== textB) await writer.body(q, s => setLead(s, text)); }}); }
      if (!jobs.length) { last = keepHeld(now); return 0; }
      last = keepHeld(capture(d));
      const failed = [];
      for (const j of jobs) { try { await j.run(); } catch (e) { failed.push(j.path); console.error('[潮线] 写回失败', j.path, e); } }
      if (failed.length) { last = previous; throw new Error('写回失败：' + failed.join('、')); } // 删除失败的仍留在队列里，下次重试
      for (const id of trashed) trash.delete(id);
      return jobs.length;
    },
  };
}
// 只改变了的键：值为 null / 空数组就删掉这个属性
function applyFm(fm, want, had){
  for (const [k, v] of Object.entries(want)) { if (snap(v) === snap(had?.[k])) continue; if (v === null || v === undefined || (Array.isArray(v) && !v.length)) delete fm[k]; else fm[k] = v; }
}
async function writeBody(writer, path, want, had){
  if (want.all !== undefined && want.all !== had?.all) await writer.body(path, s => setBody(s, want.all));
  if (want.lead !== undefined && want.lead !== had?.lead) await writer.body(path, s => setLead(s, want.lead));
  for (const [t, v] of Object.entries(want.sections || {})) if (v !== had?.sections?.[t]) await writer.body(path, s => setSection(s, t, v));
  for (const [t, v] of Object.entries(want.log || {})) if (snap(v) !== snap(had?.log?.[t])) await writer.body(path, s => editLog(s, t, had?.log?.[t] || [], v));
}
// 0.9 人物的 ## 记录：只在列表末尾追加（或撤销时去掉刚加的那几行），这一节里使用者自己写的段落、空行原样留着
export const editLog = (text, title, before, after) => keepEol(text, s => editLogLF(s, title, before, after));
function editLogLF(text, title, before, after){
  const appended = after.length >= before.length && before.every((l, i) => l === after[i]), removed = before.length > after.length && after.every((l, i) => l === before[i]);
  if (!appended && !removed) return setSection(text, title, after.join('\n'));
  const {fm, body} = splitFm(text), m = new RegExp('^##\\s+' + title + '\\s*$', 'm').exec(body);
  if (appended) {
    const add = after.slice(before.length); if (!add.length) return text;
    if (!m) return fm + body.replace(/\n*$/, '') + (body.trim() ? '\n\n' : '') + `## ${title}\n${add.join('\n')}\n`;
    const start = m.index + m[0].length, rest = body.slice(start), end = rest.search(/^##\s/m), sec = end < 0 ? rest : rest.slice(0, end), tail = end < 0 ? '' : rest.slice(end);
    const kept = sec.replace(/\s*$/, '');
    return fm + body.slice(0, start) + (kept ? kept + '\n' : '\n') + add.join('\n') + '\n' + (tail ? '\n' + tail : '');
  }
  if (!m) return text;
  const start = m.index + m[0].length, rest = body.slice(start), end = rest.search(/^##\s/m), sec = end < 0 ? rest : rest.slice(0, end), tail = end < 0 ? '' : rest.slice(end);
  const lines = sec.split('\n'); for (const l of before.slice(after.length).reverse()) { const i = lines.lastIndexOf(l); if (i >= 0) lines.splice(i, 1); }
  return fm + body.slice(0, start) + lines.join('\n') + tail;
}
function renameRefs(d, from, to){
  for (const [k, v] of Object.entries(d.ui)) { if (v === from) d.ui[k] = to; else if (v && typeof v === 'object' && v.id === from) v.id = to; }
  for (const arr of [d.tasks, d.projects]) for (const x of arr || []) for (const key of ['projectId', 'parentId', 'peopleIds', 'goalIds', 'ideaIds', 'literatureIds']) {
    if (x[key] === from) x[key] = to; else if (Array.isArray(x[key])) x[key] = x[key].map(y => y === from ? to : y); }
  for (const v of d.savedViews || []) if (v.filter?.id === from) v.filter.id = to;
}
function filterOut(d, f){
  const t = (arr, k = 'title') => link(arr.find(x => x.id === f.id)?.[k]);
  return f.kind === 'project' ? {kind: 'project', project: t(d.projects)} : f.kind === 'person' ? {kind: 'person', person: t(d.people, 'name')} : f.kind === 'list' ? {kind: 'list', list: f.id} : {kind: f.kind};
}
