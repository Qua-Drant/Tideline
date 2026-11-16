// 笔记索引。页面只读这里，不直接扫仓库。
// 启动时把各类笔记各解析一次；之后某个文件改了，只重新解析那一个文件，再通知订阅者。
// 来源（source）由调用方给：Obsidian 里是 source-obsidian.ts，测试工具里是内存。来源要提供：
//   files() → [{path}]；frontmatter(path) → 对象或 null；read(path) → Promise<string>；onChange(cb(path, kind)) → 取消函数
//   （类型见 data/types.ts 的 IndexSource）
// 笔记格式见 docs/笔记格式.md。
import type {
  ChangeKind, Frontmatter, IndexConfig, IndexDay, IndexEvent, IndexGoal, IndexIdea, IndexLibraryItem, IndexLike, IndexPerson, IndexProject,
  IndexPrompt, IndexQuarter, IndexSource, IndexStats, IndexTable, IndexTask, NoteKind,
} from './types.ts';

export const FOLDERS = {journal: '日记', tasks: '任务', projects: '项目', people: '人物', goals: '目标', ideas: '想法', literature: '文献', books: '书籍',
  prompts: '潮线/指引', quarters: '潮线/季度', config: '潮线/配置.md', calendar: '潮线/日程.md'};
// 文件夹 → 索引里的哪张表、哪一类
const TABLES: [IndexTable, NoteKind][] = [['tasks', 'task'], ['projects', 'project'], ['people', 'person'], ['goals', 'goal'], ['ideas', 'idea'], ['literature', 'literature'], ['books', 'book'], ['prompts', 'prompt']];

import {zoteroFields} from './zotero.ts';
import {defaultLists} from '../ai/policy.ts';
// Zotero Integration 的导入文件夹（0.7，见 data/zotero.ts）：里面的笔记也算文献
let ZOTERO: string[] = [];
const inZotero = (path: string) => ZOTERO.some(f => path.startsWith(f + '/'));
export const base = (p: string): string => p.split('/').pop()!.replace(/\.md$/, '');
export const linkName = (v: unknown): string | null => typeof v === 'string' ? v.replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].split('/').pop()! : null;
const links = (v: unknown): string[] => (Array.isArray(v) ? v as unknown[] : v ? [v] : []).map(linkName).filter(Boolean) as string[];
const date = (v: unknown): string | null => v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
const stamp = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : typeof v === 'string' ? v : '';
const list = (v: unknown): string[] => (Array.isArray(v) ? v as unknown[] : v === undefined || v === null || v === '' ? [] : [v]).map(String);
// 正文（去掉属性块，换行统一成 LF）；切分规则见 frontmatter.ts
import {bodyOf} from './frontmatter.ts';
export {bodyOf};
// 正文里某个二级标题下的列表项
export function section(text: string, title: string): string[]{
  const lines = bodyOf(text).split('\n'), out: string[] = []; let on = false;
  for (const l of lines) { if (/^##\s/.test(l)) { on = l.replace(/^##\s+/, '').trim() === title; continue; } if (on && /^\s*-\s+/.test(l)) out.push(l.replace(/^\s*-\s+/, '').trim()); }
  return out;
}
// 正文里某个二级标题下的整段文字（到下一个二级标题为止）
function sectionText(text: string, title: string): string{
  const m = new RegExp('^##\\s+' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm').exec(bodyOf(text)); if (!m) return '';
  const rest = bodyOf(text).slice(m.index + m[0].length), end = rest.search(/^##\s/m);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}
// 正文开头、第一个标题之前的部分
const lead = (text: string) => { const b = bodyOf(text).trim(), i = b.search(/^#{1,6}\s/m); return (i < 0 ? b : b.slice(0, i)).trim(); };
const firstPara = (text: string) => lead(text).split(/\n\s*\n/)[0] || '';

export function kindOf(path: string): NoteKind | null{
  if (path === FOLDERS.config) return 'config';
  if (path === FOLDERS.calendar) return 'calendar';
  if (!path.endsWith('.md')) return null;
  if (path.startsWith(FOLDERS.journal + '/') && /^\d{4}-\d{2}-\d{2}$/.test(base(path))) return 'day';
  if (path.startsWith(FOLDERS.quarters + '/') && /^\d{4}-Q[1-4]$/.test(base(path))) return 'quarter';
  for (const [folder, kind] of TABLES) if (path.startsWith(FOLDERS[folder] + '/')) return kind;
  if (inZotero(path)) return 'literature';
  return null;
}
const TABLE_OF: Partial<Record<string, IndexTable>> = Object.fromEntries(TABLES.map(([t, k]) => [k, t]));

export class Index implements IndexLike {
  // 字段都在构造函数里赋值；这里只声明类型（declare：不产生代码）
  declare source: IndexSource;
  declare config: IndexConfig;
  /** 日程笔记里写的、日历订阅展开出来的 */
  declare noteEvents: IndexEvent[];
  declare feedEvents: IndexEvent[];
  /** 示例航程装进来的笔记路径 */
  declare examples: Set<string>;
  declare tasks: Map<string, IndexTask>;
  declare projects: Map<string, IndexProject>;
  declare people: Map<string, IndexPerson>;
  declare goals: Map<string, IndexGoal>;
  declare ideas: Map<string, IndexIdea>;
  declare literature: Map<string, IndexLibraryItem>;
  declare books: Map<string, IndexLibraryItem>;
  declare prompts: Map<string, IndexPrompt>;
  /** 日期 → 日记；'YYYY-Qn' → 季度 */
  declare days: Map<string, IndexDay>;
  declare quarters: Map<string, IndexQuarter>;
  /** 每次变化加一，订阅者收到它 */
  declare version: number;
  declare subs: Set<(version: number) => void>;
  declare stats: IndexStats;
  /** Zotero Integration 的导入文件夹（setZoteroFolders 之后才有） */
  declare zoteroFolders?: string[];
  /** 取消改动监听（build 之后才有） */
  declare off?: () => void;
  constructor(source: IndexSource){ this.source = source; this.config = this.parseConfig({}); this.noteEvents = []; this.feedEvents = []; this.examples = new Set();
    for (const [t] of TABLES) this[t] = new Map(); this.days = new Map(); this.quarters = new Map();
    this.version = 0; this.subs = new Set(); this.stats = {built: 0, files: 0, lastUpdate: 0}; }
  // 日程 = 潮线/日程.md 里写的 + 日历订阅展开出来的（订阅只存在这台设备上，见 data/calendar.ts）
  get events(): IndexEvent[]{ return this.feedEvents.length ? [...this.noteEvents, ...this.feedEvents] : this.noteEvents; }
  setFeedEvents(list: IndexEvent[]){ this.feedEvents = list; this.emit(); }
  // 示例航程装进来的笔记路径（记在这台设备上）：照常显示，但不计入统计（设计说明 22.5）
  setExamples(paths: string[] | null | undefined){ this.examples = new Set(paths || []); this.emit(); }
  // Zotero Integration 导入到哪些文件夹；变了就整个重读。返回是否有变化
  async setZoteroFolders(folders: unknown[] | null | undefined): Promise<boolean>{ const next = [...new Set((folders || []).map(f => String(f).replace(/^\/+|\/+$/g, '')).filter(Boolean))].sort();
    if (JSON.stringify(next) === JSON.stringify(ZOTERO)) return false; ZOTERO = next; this.zoteroFolders = next; if (this.off) await this.rebuild(); return true; }
  subscribe(fn: (version: number) => void){ this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(){ this.version++; for (const fn of this.subs) fn(this.version); }
  async build(){
    await this.loadAll();
    this.off = this.source.onChange((path, change) => this.update(path, change));
    this.emit();
  }
  async loadAll(){ const t0 = performance.now(), files = this.source.files().filter(f => kindOf(f.path));
    for (const [t] of TABLES) this[t].clear(); this.days.clear(); this.quarters.clear();
    await Promise.all(files.map(f => this.load(f.path))); this.stats.built = performance.now() - t0; this.stats.files = files.length; }
  // 全部重新读一遍（不重复注册改动监听）
  async rebuild(){ await this.loadAll(); this.emit(); }
  async update(path: string, change: ChangeKind){
    const kind = kindOf(path); if (!kind) return;
    const t0 = performance.now();
    if (change === 'delete') this.drop(path); else await this.load(path);
    this.stats.lastUpdate = performance.now() - t0; this.emit();
  }
  drop(path: string){ const k = kindOf(path); if (TABLE_OF[k!]) this[TABLE_OF[k!]!].delete(path); else if (k === 'day') this.days.delete(base(path)); else if (k === 'quarter') this.quarters.delete(base(path)); }
  parseConfig(fm: Frontmatter): IndexConfig{
    const aiDefaults = defaultLists(this.source.configDir);
    // 下面的 l、v、a 是配置笔记里手写的条目（Frontmatter 的 any），逐项转成字符串、布尔
    return {habits: fm.habits || [], questions: fm.questions || [], effortScaleHours: Number(fm.effortScaleHours) || 2,
      lists: (fm.lists || []).map((l: Frontmatter | string) => typeof l === 'string' ? {title: l, archived: false} : {title: String(l.title), archived: !!l.archived}),
      views: (fm.views || []).map((v: Frontmatter) => ({title: String(v.title), filter: v.filter || {kind: 'all'}})),
      ideaTags: list(fm.ideaTags), areas: (fm.areas || []).map((a: Frontmatter) => ({id: String(a.id), title: String(a.title)})),
      // 缺省名单按当前仓库生成，配置笔记里的显式名单优先。
      ai: {askRead: fm.ai?.askRead ? list(fm.ai.askRead) : aiDefaults.askRead, noWrite: fm.ai?.noWrite ? list(fm.ai.noWrite) : aiDefaults.noWrite, autoWrite: list(fm.ai?.autoWrite)}};
  }
  async load(path: string){
    const kind = kindOf(path), fm: Frontmatter = this.source.frontmatter(path) || {};
    if (kind === 'config') { this.config = this.parseConfig(fm); return; }
    if (kind === 'calendar') { this.noteEvents = (fm.events || []).map((e: Frontmatter, i: number) => ({id: 'e' + i, date: date(e.date), time: String(e.time || ''), title: String(e.title || ''), description: e.description || ''})); return; }
    const title = base(path);
    if (kind === 'project') { const text = await this.source.read(path);
      this.projects.set(path, {path, id: path, title, status: fm.status || 'active', due: date(fm.due), resume: date(fm.resume), completed: date(fm.completed),
        goals: links(fm.goals), people: links(fm.people), ideas: links(fm.ideas), literature: links(fm.literature),
        milestones: (fm.milestones || []).map((m: Frontmatter) => ({title: String(m.title), state: m.state || 'open'})), description: firstPara(text)}); return; }
    if (kind === 'task') { const text = await this.source.read(path), body = bodyOf(text).trim();
      this.tasks.set(path, {path, id: path, title, status: fm.status || 'open', date: date(fm.scheduled), completed: date(fm.completed), focus: Number(fm.focus) || 0,
        project: linkName(fm.project), list: fm.list ? String(fm.list) : null, people: links(fm.people), priority: fm.priority || 'medium',
        discuss: !!fm.discuss, repeat: fm.repeat ? String(fm.repeat) : null, markdown: body, description: firstPara(text),
        // 0.4：货单的手动顺序、父任务、置顶、标签、时刻与提醒（都可以不写）
        order: Number.isFinite(Number(fm.order)) && fm.order !== null && fm.order !== '' ? Number(fm.order) : null, parent: linkName(fm.parent), pinned: !!fm.pinned,
        tags: list(fm.tags).filter(t => t !== 'example'), time: /^\d{1,2}:\d{2}$/.test(String(fm.time || '')) ? String(fm.time).padStart(5, '0') : null, remind: fm.remind != null && fm.remind !== '' ? String(fm.remind) : null, mode: fm.mode === 'checklist' ? 'checklist' : null,
        comments: list(fm.comments).map(String)}); return; }
    if (kind === 'person') { const text = await this.source.read(path);
      this.people.set(path, {path, id: path, name: title, initial: String(fm.initial || title.slice(0, 1)), cadence: Math.max(0, Math.round(Number(fm.cadence) || 0)), // 0.9：cadence 每隔几天联系一次（不写就不提醒）

        history: section(text, '记录').map(l => { const m = /^(\d{4}-\d{2}-\d{2})\s+(.*)$/.exec(l); return m ? {date: m[1], text: m[2]} : {date: '', text: l}; })}); return; }
    // 0.8：目标多了截止日期（due）与状态（status: paused / done，不写就是进行中；只写了 resume 的旧笔记也算暂停）
    if (kind === 'goal') { const status = fm.status === 'done' ? 'done' : fm.status === 'paused' || fm.resume ? 'paused' : 'active';
      this.goals.set(path, {path, id: path, title, planned: Number(fm.planned) || 0, resume: date(fm.resume), due: date(fm.due), status, completed: date(fm.completed)}); return; }
    if (kind === 'idea') { const text = await this.source.read(path);
      this.ideas.set(path, {path, id: path, title, stage: fm.stage || 'seed', review: !!fm.review, tags: list(fm.tags), source: linkName(fm.source) || (fm.source ? String(fm.source) : ''),
        created: stamp(fm.created) || '', body: bodyOf(text).trim()}); return; }
    if (kind === 'literature' || kind === 'book') { const text = await this.source.read(path);
      const item: IndexLibraryItem = {path, id: path, title, kind, stage: fm.stage || (kind === 'book' ? 'want' : 'inbox'),
        projects: links(fm.projects), read: date(fm.read), authors: fm.authors ? String(fm.authors) : '', year: fm.year ? Number(fm.year) : null, type: fm.type ? String(fm.type) : '',
        added: date(fm.added), started: date(fm.started), keywords: list(fm.keywords), favorite: !!fm.favorite, progress: Number(fm.progress) || 0,
        conclusion: firstPara(text), abstract: sectionText(text, '摘要'), points: section(text, '要点').map(l => { const i = l.indexOf('：'); return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : ['', l]; }),
        marks: section(text, '摘录'), note: sectionText(text, '笔记')};
      // Zotero Integration 导进来的：按它常见的模板字段补上作者、年份、类型、标签、摘要、标注和 zotero:// 链接
      if (kind === 'literature' && (inZotero(path) || fm.citekey || fm.citationKey)) {
        const z = zoteroFields(fm, text, bodyOf(text)); item.zotero = z.zotero || ''; item.citekey = z.citekey; item.source = 'zotero';
        if (z.title) item.title = z.title.slice(0, 200); // 文件名常是 citekey，显示用条目标题
        if (!fm.authors || typeof fm.authors !== 'string') item.authors = z.authors; if (!item.year) item.year = z.year; if (!item.type) item.type = z.type;
        if (!item.keywords.length) item.keywords = z.keywords; if (!item.abstract) item.abstract = z.abstract; if (!item.marks.length) item.marks = z.marks;
        if (!item.added) item.added = date(fm.dateAdded) || date(fm.importDate) || null;
        if (/^(abstract|annotations|highlights)/i.test(item.conclusion) || /^#/.test(item.conclusion) || /^>/.test(item.conclusion)) item.conclusion = '';
      }
      (kind === 'book' ? this.books : this.literature).set(path, item); return; }
    if (kind === 'prompt') { const text = await this.source.read(path);
      this.prompts.set(path, {path, id: path, title, subtitle: fm.subtitle ? String(fm.subtitle) : '', category: fm.category ? String(fm.category) : 'writing', risk: Number(fm.risk) || 0, scope: (fm.scope || [1, 0, 0, 0]).map(Number), order: Number(fm.order) || 0, body: bodyOf(text).trim()}); return; }
    if (kind === 'quarter') { const text = await this.source.read(path); this.quarters.set(title, {path, id: title, ...fm, text: lead(text)}); return; }
    if (kind === 'day') {
      const text = await this.source.read(path), d = title;
      const journal = section(text, '随手记').map((l, i) => { const m = /^(\d{1,2}:\d{2})\s+(.*)$/.exec(l); return {id: d + ':' + i, time: m ? m[1].padStart(5, '0') : '', text: m ? m[2] : l}; });
      this.days.set(d, {path, date: d, habits: fm.habits || {}, scores: fm.scores || {}, effort: fm.effort || {}, highlight: fm.highlight || '', quote: fm.quote || '', journal,
        done: section(text, '完成'), achievements: section(text, '成就'), gratitude: section(text, '感恩')});
    }
  }
  dispose(){ this.off?.(); this.subs.clear(); }
}
