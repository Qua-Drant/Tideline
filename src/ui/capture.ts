// 记一笔（设计说明“记录”；画面照原型 paper.js 的 renderCapture / captureValue）：顶部条右边的羽毛笔打开一条纸条，
// 选类别（任务、想法、随手记、成就、感恩、项目），写一句，回车记下。原型只记在内存里；这里每一类都写进对应的笔记：
//   任务 → 任务/标题.md：默认进收件箱、不安排日期；与任务页输入框同一套识别（明天下午3点、!高、#清单 / 项目 / 标签、@人、每周三）
//   想法 → 想法/第一行.md（萌芽；#标签）
//   随手记 → 今天日记的“## 随手记”（加此刻的时间）
//   成就、感恩 → 今天日记的“## 成就”“## 感恩”
//   项目 → 项目/标题.md（计划中）
// 记下后底部出现提示，可以撤销（新建的笔记进回收站；日记里加的那一行删掉）。
// 第 3c 期：DOM 构建（draw/dom.ts），不再拼 HTML 字符串；纸条的固定外壳（captureShell）从 frame.ts 搬回这里。
import {iconEl} from '../draw/ink.ts';
import {h, setNodes} from '../draw/dom.ts';
import {FOLDERS} from '../data/index.ts';
import {keepEol} from '../data/frontmatter.ts';
import {parseTask} from './task-parse.ts';
import {dayText} from './day-text.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

/** parseTask（task-parse.ts）的结果里本模块用到的几项 */
interface ParsedTask { title: string; date?: string | null; time?: string | null; repeat?: string | null; priority?: string | null; listId?: string | null; projectId?: string | null; peopleIds?: string[]; tags?: string[] }
type CaptureType = 'task' | 'idea' | 'note' | 'achievement' | 'gratitude' | 'project';
const TYPES: [type: CaptureType, icon: string, name: string][] = [['task', 'box', '任务'], ['idea', 'star', '想法'], ['note', 'note', '随手记'], ['achievement', 'flag', '成就'], ['gratitude', 'heart', '感恩'], ['project', 'route', '项目']];
const PLACEHOLDER: Record<CaptureType, string> = {task: '记一件任务，默认进收件箱（明天、#清单、@人、!高）', idea: '记一个想法（#标签）', note: '此刻想到了什么', achievement: '今天做成了什么', gratitude: '今天感谢什么', project: '新项目的名字'};
const TOKENS = /周[一二三四五六日天]|#[^\s#@]+|@[^\s#@]+/g;
const clean = (s: unknown) => String(s).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '未命名';

/** 纸条的固定外壳（框只建一次，frame.ts 调用） */
export function captureShell(){
  return h('div', {id: 'capture', class: 'capture paper-strip', hidden: true},
    h('div', {id: 'capture-types', class: 'capture-types'}),
    h('form', {id: 'capture-form'}, h('input', {id: 'capture-input', 'aria-label': '记一笔', autocomplete: 'off'}), h('div', {id: 'capture-tokens'})),
    h('button', {class: 'icon-button', 'data-action': 'capture-save', 'aria-label': '记下'}, '↵'));
}
// 类别按钮
const typeButtons = (current: CaptureType) => TYPES.map(([t, ic, name]) => h('button', {type: 'button', 'data-capture-type': t, 'aria-label': name, 'aria-pressed': String(t === current)}, iconEl(ic), h('span', {class: 'capture-type-name', 'aria-hidden': 'true'}, name)));

export function createCapture({view, plugin}: {view: CompassView; plugin: CompassPlugin}){
  const root = view.root, $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  let open = false, type: CaptureType = 'task';
  function render(){
    setNodes($('#capture-types'), () => typeButtons(type));
    $('#capture').hidden = !open; $('#capture-toggle').setAttribute('aria-expanded', String(open));
    $<HTMLInputElement>('#capture-input').placeholder = PLACEHOLDER[type];
    view.frames();
  }
  function toggle(force?: boolean){
    open = force ?? !open;
    if (open) type = view.page === 'thought' && view.lower?.data?.ui?.lamp === false ? 'idea' : 'task';
    render(); if (open) $('#capture-input').focus();
  }
  const exists = (p: string) => plugin.writer.exists?.(p);
  const unique = (folder: string, title: string) => { let p = `${folder}/${clean(title)}.md`, n = 2; while (exists(p)) p = `${folder}/${clean(title)} ${n++}.md`; return p; };
  // 往今天日记的某个二级标题下追加一行；返回撤销
  async function appendDay(section: string, line: string){
    const path = `${FOLDERS.journal}/${plugin.clock().date}.md`;
    await plugin.writer.body(path, text => keepEol(text, s => {
      const lines = s.split('\n'), at = lines.findIndex(l => new RegExp('^##\\s+' + section + '\\s*$').test(l));
      if (at < 0) return s.replace(/\n*$/, '') + (s.trim() ? '\n\n' : '') + `## ${section}\n${line}\n`;
      let end = at + 1; while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
      let last = end; while (last > at + 1 && !lines[last - 1].trim()) last--;
      lines.splice(last, 0, line); return lines.join('\n');
    }), '---\n---\n');
    return () => plugin.writer.body(path, text => keepEol(text, s => {
      const lines = s.split('\n'), at = lines.findIndex(l => new RegExp('^##\\s+' + section + '\\s*$').test(l));
      if (at < 0) return s;
      let end = at + 1;
      while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
      const i = lines.lastIndexOf(line, end - 1);
      if (i <= at) return s;
      lines.splice(i, 1);
      return lines.join('\n');
    }));
  }
  async function save(raw: string){
    const text = raw.trim(); if (!text) return;
    const {date, time} = plugin.clock(), ix = plugin.index, tokens = text.match(TOKENS) || [];
    const words = text.replace(TOKENS, ' ').replace(/\s+/g, ' ').trim() || text;
    let undo: (() => unknown) | null = null, label = words;
    if (type === 'task') {
      // 与任务页输入框同一套识别（明天下午3点、!高、#清单 / 项目 / 标签、@人、每周三）；没写日期就不安排，留在收件箱
      const model = {lists: ix.config.lists.map(l => ({id: l.title, title: l.title, archived: l.archived})), projects: [...ix.projects.values()], people: [...ix.people.values()]};
      const r = parseTask(text, model, date) as unknown as ParsedTask, title = r.title.replace(/\s+/g, ' ').trim() || words;
      const project = r.projectId && ix.projects.get(r.projectId)?.title, people = (r.peopleIds || []).map(id => ix.people.get(id)?.name).filter(Boolean);
      const path = unique(FOLDERS.tasks, title);
      await plugin.writer.create(path, '---\n---\n');
      await plugin.writer.frontmatter(path, fm => { fm.status = 'open'; if (r.date) fm.scheduled = r.date; if (r.time) fm.time = r.time; if (r.repeat) fm.repeat = r.repeat; if (project) fm.project = `[[${project}]]`; if (r.listId) fm.list = r.listId; if (people.length) fm.people = people.map(n => `[[${n}]]`); if (r.tags?.length) fm.tags = r.tags; fm.priority = r.priority || 'medium'; });
      const where = r.listId ? '清单 ' + r.listId : project ? '项目 ' + project : '收件箱';
      undo = () => plugin.writer.trash(path); label = `任务：${title} → ${where}${r.date ? '（' + dayText(r.date, date) + (r.time ? ' ' + r.time : '') + '）' : ''}`;
    } else if (type === 'idea') {
      const first = words.split('\n')[0].slice(0, 48), tags = tokens.filter(t => t.startsWith('#')).map(t => t.slice(1)), path = unique(FOLDERS.ideas, first);
      await plugin.writer.create(path, '---\n---\n' + text.replace(TOKENS, m => m.startsWith('#') ? '' : m).trim() + '\n');
      await plugin.writer.frontmatter(path, fm => { fm.stage = 'seed'; fm.created = date; if (tags.length) fm.tags = tags; });
      undo = () => plugin.writer.trash(path); label = `想法：${first}`;
    } else if (type === 'note') { undo = await appendDay('随手记', `- ${time} ${text.replace(/\n+/g, ' ')}`); label = `随手记：${text}`; view.ui.journalFollow = true; }
    else if (type === 'achievement' || type === 'gratitude') { const sec = type === 'achievement' ? '成就' : '感恩'; undo = await appendDay(sec, `- ${text.replace(/\n+/g, ' ')}`); label = `${sec}：${text}`; }
    else { const path = unique(FOLDERS.projects, words); await plugin.writer.create(path, '---\n---\n'); await plugin.writer.frontmatter(path, fm => { fm.status = 'planned'; }); undo = () => plugin.writer.trash(path); label = `项目：${words}`; }
    const u = undo;
    view.frame.feedback(label, u ? async () => { await u(); } : null, 'check');
  }
  function tokens(){ const v = $<HTMLInputElement>('#capture-input').value; setNodes($('#capture-tokens'), () => (v.match(TOKENS) || []).map(t => h('span', null, t))); }
  async function submit(){ const input = $<HTMLInputElement>('#capture-input'), v = input.value; if (!v.trim()) { input.focus(); return; } input.value = ''; tokens(); open = false; render(); await save(v); }

  view.registerDomEvent(root, 'click', e => {
    const b = (e.target as Element).closest<HTMLElement>('button'); if (!b) return;
    if (b.id === 'capture-toggle') { e.stopPropagation(); toggle(); return; }
    if (b.dataset.captureType) { e.stopPropagation(); type = b.dataset.captureType as CaptureType; render(); $('#capture-input').focus(); return; }
    if (b.dataset.action === 'capture-save') { e.stopPropagation(); void submit(); }
  }, {capture: true});
  view.registerDomEvent(root, 'submit', e => { if ((e.target as Element).id === 'capture-form') { e.preventDefault(); e.stopImmediatePropagation(); void submit(); } }, {capture: true});
  view.registerDomEvent(root, 'input', e => { if ((e.target as Element).id === 'capture-input') tokens(); });
  view.registerDomEvent(root, 'keydown', e => { if (e.key === 'Escape' && open) { e.stopPropagation(); toggle(false); } });
  render();
  // 0.9.3：思索规划里点空着那天的虚线 +，打开“记录”（任务）并带上那天的日期，光标放在最前面
  function openWith(text?: string){ open = true; type = 'task'; render(); const i = $<HTMLInputElement>('#capture-input'); i.value = text || ''; i.focus(); i.setSelectionRange(0, 0); }
  return {toggle, openWith, get open(){ return open; }, save: (t: CaptureType, text: string) => { type = t; return save(text); }};
}
