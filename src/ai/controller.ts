// 指引页的对话：把供应商（claude.js；测试工具里是 fake-claude.js）接到原型的对话区。
// 原型 paper-guidance-r28.js 的“发送”与“对话列表”两处，在复制进插件时改成调这里（当时的同步脚本没有随仓库发布）（HOST.ai.send / HOST.ai.threadInto）。
// 这里负责：
//   - 一段对话一个会话；流式显示回答；工具调用收成一行小字；要你确认的事出卡片（改前改后、读受保护的位置、运行命令）
//   - @ 提到笔记、/ 调出命令与技能
//   - 顶部就地换模型、思考强度、权限（只改这一段对话）
//   - 对话列表：只存在这台设备上（Obsidian 的本机存储，不写进仓库），旧对话按设置自动归档；点一段接着聊（Claude Code 自己存着会话记录）
//   - 回退：回到某句话之前，撤销那之后 AI 改过的文件（开发包的文件留底；用命令改的文件不在其中）
//   - 存成笔记
// 第 4b 期：转 TypeScript；对话区（各条消息、卡片、回退卡、“正在回答”一行）、对话列表面板、@ 与 / 菜单、顶部按钮与开关都改成节点构建（draw/dom.ts），
// 不再拼 HTML 字符串。结构、类名、data-* / aria-* 属性及其先后与原来的模板一一对应；文字一律成为文本节点（esc(…) 去掉），
// 原来交给解析器顺带做的事照做（html-text.ts：CR 换成 LF、去掉 NUL；<pre> 紧跟的第一个换行被解析器吃掉；对照行的 &nbsp; 写成 U+00A0；
// 用户消息里的换行原来替换成 <br>，现在是“文字 + br 节点”）。回答的 Markdown 由 markdown.ts 直接建节点。
// 流式重画（refresh）改成逐条复用：每条消息记下建它时用到的全部输入（签名），没变就沿用上次的节点，变了才重建；子节点序列与全量重建一样。
// 顶部两个开关原来比较 innerHTML 字符串，现在比较由 (权限, 思考强度) 得出的两段文字。HostAI 的 thread（返回 HTML）与 fillThread 换成 threadInto（把对话填进给定元素）。
import {h, within, setNodes, insertNodes} from '../draw/dom.ts';
import type {Child} from '../draw/dom.ts';
import {answerNodes} from './markdown.ts';
import {plainText as T, plainAttr as A} from './html-text.ts';
import {lineDiff} from './diff.ts';
import type {DiffRow} from './diff.ts';
import {relPath, DEFAULT_LISTS} from './policy.ts';
import {HOST} from '../host.ts';
import type {AcpSession, AIProviderFactory, AskAnswer, AskRequest, PermissionMode, ResolvedProvider, SessionEvent, ToolInput} from './types.ts';
import type {Model, ModelAI} from '../data/types.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

// —— 类型 ——
/** 原型对话列表里的一句（d.ai.thread；没有接管时只显示这些） */
export interface ThreadMsg { role: string; text: string; model?: string }
/** 这里用到的 d.ai（原型的 AI 状态；ModelAI 留着索引签名，这几项由原型与 pages/ai.ts 写） */
interface ChatState { thread: ThreadMsg[]; model: string; agent: string; draft: string; attachedNote?: {path?: string} | null }
type ChatModel = Model & {ai: ModelAI & ChatState; settingsR27?: {ai?: {enabled?: boolean}}};
/** 工具调用收成的一行小字 */
interface ToolRow { id?: string; state: string; label: string; detail?: string }
interface UserItem { role: 'user'; text: string; mentions?: string[]; uuid?: string; after?: string | null }
interface AnswerItem { role: 'ai'; model: string; text: string; tools: ToolRow[]; meta: string; cont: boolean; streaming?: string; done?: string }
/** 要你确认的卡片；answer 有值后收成一行 doneText */
interface CardItem {
  role: 'card'; id: number; kind: 'write' | 'read' | 'shell' | 'other'; title: string;
  tool?: string; input?: ToolInput; reason?: string; answer?: string; doneText?: string; resolve?: (a: AskAnswer) => void;
  isNew?: boolean; diff?: {rows: DiffRow[]; added: number; removed: number}; path?: string; paths?: (string | null)[]; folders?: string[]; command?: string;
}
/** 回退卡：at 是那句用户消息的下标 */
interface RewindItem { role: 'rewind'; at: number; text: string; checking: boolean; files?: string[]; stats?: RewindResult | null; error?: string }
interface NoteItem { role: 'note'; text: string }
interface ErrorItem { role: 'error'; text: string; command?: string }
type ConvItem = UserItem | AnswerItem | CardItem | RewindItem | NoteItem | ErrorItem;
/** rewindFiles 的结果（测试工具的假 Claude 还给加删行数） */
interface RewindResult { canRewind?: boolean; filesChanged?: string[]; error?: string; insertions?: number; deletions?: number }
/** 一段对话 */
interface Conv {
  id: string; d: ChatModel; ref: ThreadMsg[]; items: ConvItem[]; title: string; created: number; updated: number;
  sessionId: string | null; resumeAt: string | null; model: string; label: string; providerId?: string | null;
  effort: string; mode: PermissionMode; mentions: Set<string>; busy: boolean; session: AcpSession | null; current: AnswerItem | null;
  toEnd?: boolean; lastAssistant?: string | null;
}
/** 存在本机的一段对话 */
interface SavedConv extends Omit<Conv, 'd' | 'ref' | 'mentions' | 'busy' | 'session' | 'current'> { mentions: string[] }
interface McpInfo { name: string; status: string }
/** 会话发来的事件：types.ts 的 SessionEvent，外加假 Claude 的 assistant-id 与旧供应商的 stderr */
type CtlEvent = SessionEvent | {type: 'assistant-id'; uuid: string} | {type: 'stderr'; text: string; code?: string; provider?: ResolvedProvider};
/** 编辑类工具的参数（代理传来的，按这几项看） */
interface EditInput { content?: string; replace_all?: boolean; old_string?: string; new_string?: string; edits?: {replace_all?: boolean; old_string?: string; new_string?: string}[] }
/** 一条消息的签名：建它时用到的全部输入（逐项 === 比较；数组逐项比较） */
type Sig = readonly unknown[];

const TOOL_LABEL: Record<string, string> = {Read: '读', Write: '写', Edit: '改', MultiEdit: '改', NotebookEdit: '改', Glob: '找文件', Grep: '搜索', LS: '列出', Bash: '运行', PowerShell: '运行',
  WebSearch: '搜索网页', WebFetch: '打开网页', Task: '分派子任务', Agent: '分派子任务', TodoWrite: '列待办', Skill: '用技能'};
const MODELS: Record<string, string> = {Sonnet: 'sonnet', Opus: 'opus', Haiku: 'haiku'};
const KIND_LABEL: Record<string, string> = {read: '读', edit: '改', delete: '删', move: '移动', search: '搜索', execute: '运行', fetch: '打开网页', think: '思考'};
const PERM: Record<string, string> = {read: '只读', confirm: '改前确认', auto: '自动接受改动'}, PERM_NEXT: Record<string, PermissionMode> = {read: 'confirm', confirm: 'auto', auto: 'read'};
const EFFORT: Record<string, string> = {low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高'}, EFFORT_NEXT: Record<string, string> = {low: 'medium', medium: 'high', high: 'xhigh', xhigh: 'max', max: 'low'};
const STORE = 'tideline-ai-conversations', KEEP = 100;
const uid = () => (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
const stamp = (t: number) => { const d = new Date(t), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
// <pre> 紧跟的第一个换行原来会被解析器吃掉
const preText = (s: string) => { const t = T(s); return t.startsWith('\n') ? t.slice(1) : t; };
// 签名逐项比较（数组再逐项）
// 从后往前找（Array.prototype.findLast 不在 tsconfig 的 ES2022 库里）
function findLast<T, S extends T>(list: readonly T[], test: (x: T) => x is S): S | undefined { for (let i = list.length - 1; i >= 0; i--) { const x = list[i]; if (test(x)) return x; } return undefined; }
const same = (a: Sig, b: Sig): boolean => a.length === b.length && a.every((x, i) => x === b[i] || (Array.isArray(x) && Array.isArray(b[i]) && same(x as Sig, b[i] as Sig)));

export function createAIController({view, plugin, provider}: {view: CompassView; plugin: CompassPlugin; provider: AIProviderFactory}){
  const root = view.root, $ = <E extends Element = HTMLElement>(s: string) => root.querySelector<E>(s);
  let conv: Conv | null = null, renderQueued = false, cardSeq = 0, panel = false, commandsCache: Promise<{name: string; description?: string; argumentHint?: string}[]> | {name: string; description?: string; argumentHint?: string}[] | null = null, mcpCache: McpInfo[] | null = null, saveTimer = 0;
  // 上次画对话区用到的签名与节点（只记当前这段对话；换了对话或走原型的简单列表时作废）
  let drawn: {conv: Conv; sigs: Sig[]; nodes: (Element | null)[]; busySig: Sig | null; busy: Element | null} | null = null;
  // 顶部两个开关上次写的文字（按开关所在的那个 .ai-switches 记；原型重画顶部后是新的一格，自然重写）
  const switches = new WeakMap<Element, string>();
  const settings = () => plugin.settings.ai;
  const lists = () => plugin.index.config.ai || DEFAULT_LISTS;
  const vaultRoot = () => plugin.vaultRoot();
  const rel = (p: string) => relPath(p, vaultRoot()) ?? String(p);
  // 模型菜单里的“供应商 · 模型” → 哪一家、哪个模型（“默认”就不改代理自己的默认）
  const pickOf = (label: string | null | undefined) => { const [name, model = ''] = String(label || '').split(' · '), list = HOST.aiProviders?.() || {}, ids = Object.keys(list);
    const id = ids.find(k => list[k][0] === name || (k === 'claude' && name === 'Claude Code')) || // 0.9.5 前这一家叫 Claude Code：旧对话的标签照样认
      (list[settings().provider] ? settings().provider : ids[0]) || 'claude';
    const live = (plugin.aiModels?.(id) || plugin.ai?.models?.[id])?.find(m => m.name === model);
    return {id, model: live ? live.value : MODELS[model] || (model && model !== '默认' ? model : (id === 'claude' ? settings().model : null))}; };
  const canRewind = () => provider.caps?.rewind !== false;

  // —— 本机存储的对话列表 ——
  const loadAll = (): SavedConv[] => { try { return (plugin.localStore.load(STORE) || []) as SavedConv[]; } catch { return []; } };
  // 存的是“那一段”对话（不是存的时候正好打开着的那段）：切到别的对话前也会先存
  function saveSoon(c = conv){ window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => saveNow(c), 400); }
  function saveNow(c = conv){
    if (!c) return;
    // 回退到一句不剩的对话：从列表里拿掉
    if (!c.items.some(x => x.role === 'user')) { const all = loadAll(); if (all.some(x => x.id === c.id)) try { plugin.localStore.save(STORE, all.filter(x => x.id !== c.id)); } catch { /* 本机存储写不进去：这次不存 */ } return; }
    c.updated = Date.now();
    const plain: SavedConv = {id: c.id, title: c.title, created: c.created, updated: c.updated, sessionId: c.sessionId, resumeAt: c.resumeAt || null, model: c.model, label: c.label, providerId: c.providerId || null, effort: c.effort, mode: c.mode, mentions: [...c.mentions],
      items: c.items.map((x): ConvItem => x.role === 'card' ? {role: 'card', id: x.id, kind: x.kind, title: x.title, answer: x.answer || 'deny', doneText: x.doneText || `没有回答：${x.title}`} : x.role === 'ai' ? {role: 'ai', model: x.model, text: x.text, tools: x.tools.map(t => ({...t, state: t.state === 'running' ? 'failed' : t.state})), meta: x.meta, cont: x.cont} : {...x})};
    const all = loadAll().filter(x => x.id !== c.id); all.unshift(plain);
    try { plugin.localStore.save(STORE, all.slice(0, KEEP)); } catch { /* 本机存储写不进去：这次不存 */ }
  }

  // —— 对话区 ——
  // 原型自己的对话列表（还没经这里发过话时）
  const simpleMsg = (m: ThreadMsg, d: ChatModel) => h('article', {class: 'native-message'}, h('span', null, T(m.role === 'user' ? '我' : (m.model || d.ai.agent))), h('p', null, T(m.text)));
  // 用户消息：换行原来替换成 <br>
  const lines = (text: string): Child[] => text.split('\n').flatMap((s, i) => i ? [h('br'), T(s)] : [T(s)]);
  function userEl(m: UserItem, i: number, rewindable: boolean){
    return h('article', {class: 'native-message ai-user'},
      h('span', null, '我', rewindable ? h('button', {class: 'ai-rewind', 'data-ai': 'rewind', 'data-at': i, 'aria-label': '回到这句话之前', title: '回到这句话之前，撤销那之后 AI 改过的文件'}, '回到这里') : null),
      h('p', null, lines(m.text)),
      m.mentions?.length ? h('small', {class: 'ai-mentions'}, T(m.mentions.join('　'))) : null);
  }
  function answerEl(m: AnswerItem){
    return h('article', {class: 'native-message ai-answer' + (m.cont ? ' cont' : '')},
      m.cont ? null : h('span', null, T(m.model)),
      m.tools.length ? h('ul', {class: 'ai-tools'}, m.tools.map(t => h('li', {class: A(`${t.state}`), title: A(t.detail)}, T(t.label)))) : null,
      h('div', {class: 'ai-md'}, answerNodes(m.text)),
      m.meta ? h('small', {class: 'ai-meta'}, T(m.meta)) : null);
  }
  const doneEl = (text: string | undefined) => h('div', {class: 'ai-card done'}, h('span', null, T(text)));
  function errorEl(m: ErrorItem){
    return h('div', {class: 'ai-error', role: 'alert'}, h('p', null, T(m.text)),
      m.command ? [h('code', null, T(m.command)), h('button', {class: 'text-button', 'data-ai': 'copy', 'data-text': A(m.command)}, '复制')] : null);
  }
  function cardEl(c: CardItem){
    if (c.answer) return doneEl(c.doneText);
    const b = (a: string, label: string, primary?: boolean) => h('button', {class: primary ? 'outline' : 'text-button', 'data-ai-card': c.id, 'data-answer': a}, label);
    let body: Child = null, buttons: Child = null;
    if (c.kind === 'write') {
      const df = c.diff;
      body = df ? [h('div', {class: 'ai-diff', role: 'table', 'aria-label': '改前改后'}, df.rows.map(([k, t]) => h('div', {class: 'ai-diff-row ' + (k === '+' ? 'add' : k === '-' ? 'del' : k === '…' ? 'gap' : '')}, h('i', null, k === '=' ? '' : k), h('span', null, t ? T(t) : ' ')))),
        h('small', null, df.added ? `加 ${df.added} 行` : '', df.added && df.removed ? '，' : '', df.removed ? `删 ${df.removed} 行` : '', c.isNew ? '（新建）' : '')] : null;
      buttons = [b('once', '写入', true), b('deny', '不写')];
    } else if (c.kind === 'read') {
      body = h('ul', {class: 'ai-paths'}, (c.paths || []).map(p => h('li', null, T(p || '整个仓库'))));
      buttons = [b('once', '允许这一次', true), c.folders?.length ? b('session', '这次对话都允许') : null, b('deny', '拒绝')];
    } else if (c.kind === 'shell') { body = h('pre', {class: 'ai-command'}, preText(c.command ?? '')); buttons = [b('once', '运行', true), b('deny', '不运行')]; }
    else { body = h('pre', {class: 'ai-command'}, preText(JSON.stringify(c.input, null, 1).slice(0, 600))); buttons = [b('once', '允许', true), b('deny', '拒绝')]; }
    return h('div', {class: 'ai-card', 'data-card': c.id},
      h('div', {class: 'ai-card-head'}, h('strong', null, T(c.title)), c.reason ? h('small', null, T(c.reason)) : null),
      body, h('div', {class: 'ai-card-actions'}, buttons));
  }
  function rewindEl(r: RewindItem, rels: string[]){
    const body: Child = r.checking ? h('small', null, '正在查这之后改过哪些文件…') : r.error ? h('small', null, T(r.error))
      : rels.length ? [h('ul', {class: 'ai-paths'}, rels.map(f => h('li', null, T(f)))), h('small', null, '这些文件会还原到这句话之前的样子', r.stats ? `（共加 ${r.stats.insertions || 0} 行、删 ${r.stats.deletions || 0} 行）` : '', '。用命令改动的文件不在其中。')]
      : h('small', null, '这之后 AI 没有改过文件，只回到对话的这个位置。');
    return h('div', {class: 'ai-card', 'data-rewind': r.at},
      h('div', {class: 'ai-card-head'}, h('strong', null, '回到“', T(r.text.slice(0, 24)), r.text.length > 24 ? '…' : '', '”之前'), h('small', null, '这句话和之后的对话都会去掉；这句话放回输入框')),
      body,
      h('div', {class: 'ai-card-actions'}, r.checking ? null : h('button', {class: 'outline', 'data-ai': 'rewind-go'}, '回退'), h('button', {class: 'text-button', 'data-ai': 'rewind-cancel'}, '取消')));
  }
  // 每条消息的签名（与上面各函数读的输入一一对应）和节点
  function itemSig(m: ConvItem, i: number, busy: boolean, rewindable: boolean): Sig {
    switch (m.role) {
      case 'user': return ['user', i, !busy && rewindable, m.text, m.mentions ? [...m.mentions] : null];
      case 'ai': return ['ai', m.cont, m.model, m.text, m.meta, m.tools.map(t => [t.state, t.detail, t.label])];
      case 'card': return m.answer ? ['done', m.doneText] : ['card', m.id, m.kind, m.title, m.reason, m.diff, m.isNew, m.paths ? [...m.paths] : null, !!m.folders?.length, m.command, m.kind === 'other' ? JSON.stringify(m.input, null, 1).slice(0, 600) : null];
      case 'rewind': return ['rewind', m.at, m.text, m.checking, m.error, (m.files || []).map(rel), m.stats ? [m.stats.insertions, m.stats.deletions] : null];
      case 'note': return ['note', m.text];
      case 'error': return ['error', m.text, m.command];
      default: return ['?'];
    }
  }
  function itemEl(m: ConvItem, sig: Sig, i: number): Element | null {
    switch (m.role) {
      case 'user': return userEl(m, i, sig[2] as boolean);
      case 'ai': return answerEl(m);
      case 'card': return cardEl(m);
      case 'rewind': return rewindEl(m, sig[5] as string[]);
      case 'note': return doneEl(m.text);
      case 'error': return errorEl(m);
      default: return null;
    }
  }
  function busyEl(pending: boolean){
    return h('div', {class: 'ai-busy'}, h('span', {class: 'ai-busy-label'}, pending ? '等待你的确认' : '正在回答'),
      pending ? null : h('span', {class: 'ai-dots', 'aria-hidden': 'true'}, h('i'), h('i'), h('i')),
      h('button', {class: 'text-button', 'data-ai': 'stop'}, '停下'));
  }
  /** 对话区的子节点。reuse：签名没变的消息沿用上次的节点 */
  function threadNodes(d: ChatModel, reuse: boolean): Node[] {
    if (!conv || conv.ref !== d.ai.thread) { drawn = null; return d.ai.thread.map(m => simpleMsg(m, d)); }
    const c = conv, prev = reuse && drawn?.conv === c ? drawn : null, rewindable = canRewind();
    const sigs: Sig[] = [], nodes: (Element | null)[] = [];
    c.items.forEach((m, i) => { const s = itemSig(m, i, c.busy, rewindable), old = prev?.sigs[i]; sigs.push(s); nodes.push(prev && old && same(old, s) ? prev.nodes[i] : itemEl(m, s, i)); });
    let busySig: Sig | null = null, busy: Element | null = null;
    if (c.busy) { busySig = [c.items.some(m => m.role === 'card' && !m.answer)]; busy = prev?.busySig && same(prev.busySig, busySig) ? prev.busy : busyEl(busySig[0] as boolean); }
    drawn = {conv: c, sigs, nodes, busySig, busy};
    return [...nodes, busy].filter((x): x is Element => x !== null);
  }
  /** 把对话区的子节点换成 nodes：只动变了的（沿用的节点不拿下来再放回去） */
  function sync(el: Element, nodes: Node[]){
    const keep = new Set(nodes);
    for (const x of [...el.childNodes]) if (!keep.has(x)) x.remove();
    let ref = el.firstChild;
    for (const n of nodes) { if (n === ref) { ref = ref.nextSibling; continue; } el.insertBefore(n, ref); }
  }
  // 画对话区。手绘框（view.frames）只画露在外面的元素：对话区不在版面上时（别的页）沿用的节点上会留着旧框，所以这时不沿用
  function draw(el: HTMLElement, d: ChatModel, reuse: boolean){
    sync(el, within(el.ownerDocument, () => threadNodes(d, reuse && el.getClientRects().length > 0)));
  }
  // 流式回答时只重画对话区，一帧一次；停在底部时跟着滚
  function refresh(){
    if (renderQueued) return; renderQueued = true;
    window.requestAnimationFrame(() => { renderQueued = false; const el = $('#native-content .native-thread'); if (!el || !conv) return;
      const atEnd = conv.toEnd || el.scrollHeight - el.clientHeight - el.scrollTop < 40; conv.toEnd = false; draw(el, conv.d, true); if (atEnd) el.scrollTop = el.scrollHeight; decorate(); view.frames(); });
  }

  // —— 顶部：对话列表、存成笔记；权限与思考强度（只改这一段对话）——
  function decorate(){
    const on = !!conv?.d?.settingsR27?.ai?.enabled || !!(view.lower?.data as ChatModel | null | undefined)?.settingsR27?.ai?.enabled; if (!on) return;
    const con = $('#connection'), priv = $('#privacy');
    const newBtn = con && !con.querySelector('[data-ai="list"]') ? con.querySelector('[data-guidance="new"]') : null;
    if (newBtn) insertNodes(newBtn, 'beforebegin', () => [
      h('button', {class: 'ai-head-btn text-button', 'data-ai': 'save', 'aria-label': '把这段对话存成笔记'}, '存成笔记'),
      h('i', {class: 'ai-head-sep', 'aria-hidden': 'true'}, '·'),
      h('button', {class: 'ai-head-btn text-button', 'data-ai': 'list', 'aria-label': '对话列表', 'aria-expanded': String(panel)}, '对话')]);
    if (priv) { const s = settings(), mode = conv?.mode || s.permission, effort = conv?.effort || s.effort, perm = `${PERM[mode]}`, think = `${EFFORT[effort]}`;
      // 原型那一格“默认权限”（点了去设置）换成两个就地切换的按钮；已经换过就只更新文字
      priv.querySelector('.native-permission:not(.ai-switch)')?.remove();
      let box = priv.querySelector('.ai-switches'); if (!box) { insertNodes(priv, 'beforeend', () => h('span', {class: 'ai-switches'})); box = priv.querySelector('.ai-switches')!; }
      // 原来比较 innerHTML 字符串；两个按钮的内容只由这两段文字决定，比较它们是同一回事
      const key = perm + '\n' + think;
      if (switches.get(box) !== key) { switches.set(box, key); setNodes(box, () => [
        h('button', {class: 'native-permission ai-switch', 'data-ai': 'perm', 'aria-label': `权限：${perm}，点一下换（只改这一段对话）`}, h('small', null, '权限'), h('span', null, perm)),
        h('button', {class: 'native-permission ai-switch', 'data-ai': 'effort', 'aria-label': `思考强度：${think}，点一下换（只改这一段对话）`}, h('small', null, '思考'), h('span', null, think))]); } }
    renderPanel();
  }
  function renderPanel(){
    $('.ai-list-panel')?.remove(); if (!panel) return;
    const all = loadAll(), days = Number(settings().archiveDays ?? 30), cut = days ? Date.now() - days * 864e5 : 0;
    const live = all.filter(c => !cut || c.updated >= cut), old = all.filter(c => cut && c.updated < cut);
    const row = (c: SavedConv) => h('button', {type: 'button', class: 'ai-list-row', 'data-ai': 'open', 'data-id': A(c.id), 'aria-current': conv?.id === c.id ? 'true' : null}, h('span', null, T(c.title || '（空）')), h('small', null, stamp(c.updated)));
    const mcp = (mcpCache || []).map(m => `${m.name.replace(/^claude\.ai /, '')} ${({connected: '已连接', failed: '连不上', 'needs-auth': '要登录', pending: '连接中', disabled: '关了'} as Record<string, string>)[m.status] || m.status}`);
    const win = $('.ai-window'); if (!win) return;
    // 原模板里换行加 6 格缩进的空白，照样成为文本节点（相邻的并成一个）
    const W = '\n      ';
    insertNodes(win, 'beforeend', () => h('div', {class: 'ai-list-panel hand-panel', role: 'dialog', 'aria-label': '对话列表'},
      h('div', {class: 'ai-list-head'}, h('strong', null, '对话'), h('small', null, '只存在这台设备上')), W,
      h('div', {class: 'ai-list-rows'}, live.length ? live.map(row) : h('p', {class: 'ai-list-empty'}, '还没有对话')), W,
      old.length ? h('details', {class: 'ai-list-archive'}, h('summary', null, `已归档 ${old.length}（${days} 天前）`), old.map(row)) : null, W,
      h('p', {class: 'ai-list-mcp'}, mcp.length ? T('外部工具（MCP）：' + mcp.join('，') + '。用之前都会先问你。') : '外部工具（MCP）：发第一句话后显示')));
    view.frames();
  }
  // 原型的指引模块会重画顶部（换模型、开关菜单时），重画后再补上
  // 疑似问题批 F2：原来只在视图停在指引页时补。设置里开关 AI（refreshAI）与握手结束（detect）时，顶部可能在别的页上被重画，
  // 回到指引页时页面原样复用、不再重画，按钮就一直缺着；现在不论停在哪一页都补（decorate 只在 AI 开着时插入，已有就不再插）
  const mo = new MutationObserver(() => { mo.disconnect(); decorate(); watch(); });
  const watch = () => { for (const s of ['#connection', '#privacy']) { const el = $(s); if (el) mo.observe(el, {childList: true}); } };
  watch();

  // —— 会话 ——
  function fresh(d: ChatModel): Conv { return {id: uid(), d, ref: d.ai.thread, items: [], title: '', created: Date.now(), updated: Date.now(), sessionId: null, resumeAt: null, model: d.ai.model || 'Claude', label: d.ai.model,
    effort: settings().effort, mode: settings().permission, mentions: new Set(), busy: false, session: null, current: null}; }
  function ensure(d: ChatModel): Conv & {session: AcpSession} {
    if (!conv || conv.ref !== d.ai.thread) { if (conv) { window.clearTimeout(saveTimer); saveNow(conv); } closeSession(); conv = fresh(d); }
    const c = conv;
    if (!c.session) {
      const pick = pickOf(c.label || d.ai.model); c.providerId = pick.id;
      c.session = provider.create({providerId: pick.id, cwd: vaultRoot(), model: pick.model ?? undefined, effort: c.effort, mode: c.mode, lists: lists(), apiKey: plugin.aiApiKey?.(pick.id),
        resume: c.sessionId || undefined, resumeAt: c.resumeAt || undefined, onEvent: e => onEvent(c, e), ask: q => askUser(c, q)});
      c.resumeAt = null; // 截断只做一次：之后那段会话记录本身就截好了
      for (const p of c.mentions) c.session.allowed.add(p);
    }
    return c as Conv & {session: AcpSession};
  }
  function closeSession(){ conv?.session?.close(); if (conv) conv.session = null; }
  // 回答按时间顺序分段：出现卡片时这一段结束，之后的话接在卡片下面（不再重复写模型名）
  function answer(c: Conv): AnswerItem { if (!c.current) { const last = findLast(c.items, (x): x is UserItem | AnswerItem => x.role === 'user' || x.role === 'ai'); c.current = {role: 'ai', model: c.model, text: '', tools: [], meta: '', cont: last?.role === 'ai'}; c.items.push(c.current); } return c.current; }
  function onEvent(c: Conv, e: CtlEvent){
    if (c !== conv) return;
    if (e.type === 'init') { c.model = e.agent ? e.agent + (e.model ? ' · ' + e.model : '') : d2label(e.model) || c.model; if (e.sessionId) c.sessionId = e.sessionId; if (e.mcp) mcpCache = e.mcp as McpInfo[];
      // 记下代理自己报的模型清单，模型菜单下次打开时用它
      void c.session?.models?.().then(ms => { if (!ms?.length) return; if (plugin.rememberModels) void plugin.rememberModels(c.providerId!, ms); else { plugin.ai.models ??= {}; plugin.ai.models[c.providerId!] = ms; } }); }
    else if (e.type === 'tool-input') { for (const it of c.items) if (it.role === 'ai') for (const t of it.tools) if (t.id === e.id) { t.label = toolLabel(e.name, e.input, e.title); t.detail = JSON.stringify(e.input).slice(0, 300); } }
    else if (e.type === 'assistant-id') c.lastAssistant = e.uuid;
    else if (e.type === 'delta') { const a = answer(c); a.streaming ??= ''; a.streaming += e.text; a.text = (a.done || '') + a.streaming; }
    else if (e.type === 'text') { const a = answer(c); a.done = (a.done ? a.done + '\n\n' : '') + e.text; a.streaming = ''; a.text = a.done; }
    else if (e.type === 'tool') { const a = answer(c); if (a.tools.some(t => t.id === e.id)) { refresh(); return; } a.tools.push({id: e.id, state: 'running', label: toolLabel(e.name, e.input, e.title), detail: JSON.stringify(e.input).slice(0, 300)}); }
    else if (e.type === 'tool-done') { for (const it of c.items) if (it.role === 'ai') for (const t of it.tools) if (t.id === e.id) t.state = e.error ? 'failed' : 'done'; }
    else if (e.type === 'result') { c.busy = false; const a = findLast(c.items, (x): x is AnswerItem => x.role === 'ai'); if (a) a.meta = e.ok ? `用时 ${(e.ms / 1000).toFixed(1)} 秒` : ''; if (!e.ok && e.error) error(c, e.error); c.current = null; saveSoon(c); }
    else if (e.type === 'error') { c.busy = false; error(c, e.message, e); }
    else if (e.type === 'stderr') { c.busy = false; error(c, e.text, e); }
    else if (e.type === 'closed') { c.busy = false; if (c.session) c.session = null; }
    refresh();
  }
  const d2label = (m: string | undefined) => m ? 'Claude · ' + (/opus/i.test(m) ? 'Opus' : /haiku/i.test(m) ? 'Haiku' : /sonnet/i.test(m) ? 'Sonnet' : m) : '';
  function error(c: Conv, text: string | undefined, e: {code?: string; provider?: ResolvedProvider} = {}){
    const t = String(text || ''), P: {name: string; command?: string; install: string; login: string} = e.provider || plugin.aiProviderInfo?.(c.providerId!) || {name: 'AI', install: '', login: ''};
    if (e.code === 'ENOENT' || /ENOENT|spawn|没有找到|找不到/i.test(t)) c.items.push({role: 'error', text: `没能启动 ${P.name} 的 ACP 代理程序（${P.command || '未填写命令'}）。${P.install ? '先在终端里安装，再到设置 → 指引里点“检查”：' : '请在设置 → 指引里填写启动命令。'}`, command: P.install || ''});
    else if (e.code === 'AUTH' || /not logged in|log ?in required|authenticat\w* required|unauthori[sz]ed|\b401\b|invalid api key/i.test(t)) c.items.push({role: 'error', text: `${P.name} 还没有登录。在终端里运行下面这条命令登录，然后再发一次：`, command: P.login || ''});
    else if ((c.items.at(-1) as {text?: string} | undefined)?.text !== t) c.items.push({role: 'error', text: '出错了：' + t.slice(0, 300)});
  }
  const toolLabel = (name: string, inp: ToolInput = {}, title = '') => { const what = inp.file_path ? rel(inp.file_path) : inp.path ? rel(inp.path) : inp.pattern || inp.command || (inp.query as string | undefined) || (inp.url as string | undefined) || (inp.skill as string | undefined) || (inp.description as string | undefined) || '';
    if (!TOOL_LABEL[name] && title) return String(title).slice(0, 90);
    return (TOOL_LABEL[name] || KIND_LABEL[name] || name) + (what ? ' ' + String(what).slice(0, 80) : ''); };

  // —— 要你确认的事 ——
  async function askUser(c: Conv, {tool, input, policy, reason, diff, title}: AskRequest): Promise<AskAnswer>{
    const id = ++cardSeq, p = policy, base = {role: 'card' as const, id, tool, input, reason}, I = input as EditInput;
    let cardData: CardItem;
    if (p.kind === 'write') {
      const path = rel(input.file_path || input.notebook_path || diff?.path || ''), before = diff ? (diff.oldText ?? null) : await plugin.readVaultFile(path);
      let after = before ?? '';
      if (diff) after = diff.newText ?? '';
      else if (tool === 'Write') after = I.content ?? '';
      else if (tool === 'Edit') after = I.replace_all ? (before ?? '').split(I.old_string as string).join(I.new_string) : (before ?? '').replace(I.old_string as string, I.new_string as string);
      else if (tool === 'MultiEdit') for (const e of I.edits || []) after = e.replace_all ? after.split(e.old_string as string).join(e.new_string) : after.replace(e.old_string as string, e.new_string as string);
      cardData = {...base, kind: 'write', title: (before === null ? '新建 ' : '改 ') + path, isNew: before === null, diff: lineDiff(before ?? '', after), path};
    } else if (p.kind === 'read') cardData = {...base, kind: 'read', title: '要读受保护的位置', paths: p.paths || [], folders: p.folders || []};
    else if (p.kind === 'shell') cardData = {...base, kind: 'shell', title: '运行命令', command: String(input.command || '')};
    else cardData = {...base, kind: 'other', title: title || TOOL_LABEL[tool] || tool};
    c.current = null; c.items.push(cardData); refresh();
    const ans = await new Promise<AskAnswer>(res => { cardData.resolve = res; });
    cardData.answer = ans;
    cardData.doneText = ans === 'deny' ? `没有同意：${cardData.title}` : cardData.kind === 'write' ? `已同意：${cardData.title}` : cardData.kind === 'shell' ? `已运行：${(cardData.command ?? '').slice(0, 60)}` : `已允许${ans === 'session' ? '（这次对话）' : ''}：${(cardData.paths || []).join('、') || cardData.title}`;
    refresh(); return ans;
  }

  // —— 发送（原型的 send 在清空草稿前调这里）——
  function send(text: string, model: Model){
    const d = model as ChatModel;
    let c = ensure(d); const mentions = resolveMentions(text);
    // 模型菜单里换了模型：同一家就地换；换了一家，就关掉旧会话、新开一段（旧代理记得的上下文带不过去）
    if (d.ai.model && d.ai.model !== c.label) {
      const pick = pickOf(d.ai.model);
      if (pick.id !== c.providerId) { closeSession(); c.sessionId = null; c.label = d.ai.model; c.items.push({role: 'note', text: `换到 ${d.ai.model.split(' · ')[0]}，从这里开始是新的一段会话`}); c = ensure(d); }
      else { c.label = d.ai.model; if (pick.model) void c.session.setModel?.(pick.model); }
    }
    for (const p of mentions) { c.mentions.add(p); c.session.allowed.add(p); }
    let prompt = text;
    if (mentions.length) prompt += '\n\n（我提到的笔记：' + mentions.join('、') + '。需要时直接读。）';
    const attached = d.ai.attachedNote?.path;
    if (attached && plugin.index.source.files().some(f => f.path === attached)) {
      prompt += `\n\n（我附带的笔记：${attached}。需要时直接读。）`;
      c.session.allowed.add(attached);
    }
    if (!d.ai.thread.length) d.ai.thread.push({role: 'user', text}); // 原型用 thread.length 判断有没有对话
    if (!c.title) c.title = text.split(/[\n。！？!?]/)[0].slice(0, 28);
    const after = c.lastAssistant || null, uuid = c.session.send(prompt);
    c.items = c.items.filter(x => x.role !== 'rewind');
    c.items.push({role: 'user', text, mentions, uuid, after}); c.busy = true; c.current = null;
    refresh(); saveSoon();
  }
  function resolveMentions(text: string): string[]{
    const names = [...String(text).matchAll(/@([^\s@，。、；：！？,;:!?]+)/g)].map(m => m[1]); if (!names.length) return [];
    const files = plugin.index.source.files().map(f => f.path);
    return names.map(n => files.find(p => p === n || p === n + '.md' || p.split('/').pop()!.replace(/\.md$/, '') === n)).filter((p): p is string => !!p);
  }

  // —— 打开以前的对话 ——
  function open(id: string | undefined){
    const saved = loadAll().find(c => c.id === id); if (!saved) return;
    const d = view.lower!.data as ChatModel; if (conv) { window.clearTimeout(saveTimer); saveNow(conv); } closeSession();
    d.ai.thread = [{role: 'user', text: saved.title}]; d.ui.aiView = 'chat'; if (saved.label) d.ai.model = saved.label;
    conv = {...fresh(d), ...saved, d, ref: d.ai.thread, mentions: new Set(saved.mentions || []), busy: false, session: null, current: null, lastAssistant: findLast(saved.items, (x): x is UserItem => x.role === 'user')?.after ?? null};
    conv.lastAssistant = null; // 接着聊时由会话记录接上，下一句的回退点等新回答来了再记
    panel = false; view.lower!.ai?.render?.(); refresh();
  }
  // —— 回退 ——
  async function rewindAsk(at: number){
    if (!conv || conv.busy) return; const u = conv.items[at]; if (!u || u.role !== 'user') return;
    conv.items = conv.items.filter(x => x.role !== 'rewind');
    const r: RewindItem = {role: 'rewind', at, text: u.text, checking: true}; conv.items.push(r); conv.toEnd = true; refresh();
    try { const c = ensure(conv.d), res = await c.session.rewindFiles(u.uuid, true) as RewindResult | null; r.files = res?.filesChanged || []; r.stats = res; if (res && res.canRewind === false && r.files.length) r.error = res.error || '这一句之前的文件留底找不到了，只能回到对话的这个位置'; }
    catch (e) { r.files = []; r.error = '查不到这之后改过的文件（' + String((e as Error | null)?.message || e).slice(0, 80) + '），只能回到对话的这个位置'; }
    r.checking = false; conv.toEnd = true; refresh();
  }
  async function rewindGo(){
    const r = conv?.items.find((x): x is RewindItem => x.role === 'rewind'); if (!conv || !r) return; const u = conv.items[r.at] as UserItem;
    let restored = 0; if (r.files?.length && !r.error) { try { const res = await conv.session!.rewindFiles(u.uuid) as RewindResult | null; if (res?.canRewind !== false) restored = r.files.length; } catch { /* 还原失败：照常回到对话的这个位置，不报还原了几个 */ } }
    closeSession();
    conv.items = conv.items.slice(0, r.at); conv.resumeAt = u.after || null; if (!u.after) conv.sessionId = null; conv.lastAssistant = u.after || null;
    if (!conv.items.length) conv.title = '';
    conv.items.push({role: 'note', text: `已回到“${u.text.slice(0, 24)}”之前${restored ? `，还原了 ${restored} 个文件` : ''}`});
    const input = $<HTMLTextAreaElement>('#handoff-input'); if (input) { input.value = u.text; conv.d.ai.draft = u.text; input.focus(); }
    refresh(); saveNow();
  }

  // —— 存成笔记 ——
  async function saveAsNote(){
    if (!conv || !conv.items.some(x => x.role === 'user')) { view.frame.feedback('还没有对话可以存'); return; }
    const folder = (settings().saveFolder || '收件箱/').replace(/\/?$/, '/'), name = `AI 对话 ${stamp(conv.created).replace(/[: ]/g, m => m === ':' ? '' : ' ')} ${conv.title.replace(/[\\/:*?"<>|#^[\]]/g, ' ').slice(0, 30)}`.trim();
    let body = `---\ntype: ai-对话\ncreated: ${stamp(conv.created)}\nmodel: "${conv.model}"\n---\n`;
    for (const x of conv.items) {
      if (x.role === 'user') body += `\n## 我\n\n${x.text}\n${x.mentions?.length ? '\n提到：' + x.mentions.map(p => `[[${p.replace(/\.md$/, '')}]]`).join('、') + '\n' : ''}`;
      else if (x.role === 'ai') body += `${x.cont ? '' : `\n## ${x.model}\n`}${x.tools.length ? '\n' + x.tools.map(t => `- ${t.label}${t.state === 'failed' ? '（没成）' : ''}`).join('\n') + '\n' : ''}${x.text ? '\n' + x.text + '\n' : ''}`;
      else if (x.role === 'card' && x.answer) body += `\n> ${x.doneText}\n`;
      else if (x.role === 'note') body += `\n> ${x.text}\n`;
    }
    let path = folder + name + '.md', n = 2; while (plugin.writer.exists?.(path)) path = folder + name + ` ${n++}.md`;
    await plugin.writer.create(path, body); view.frame.feedback('已存成笔记：' + path);
  }

  // —— @ 提到笔记、/ 命令与技能：输入时列出可选的 ——
  async function suggest(input: HTMLTextAreaElement){
    $('.ai-mention-menu')?.remove();
    const v = input.value.slice(0, input.selectionStart), at = /@([^\s@]*)$/.exec(v), slash = /^\/([^\s]*)$/.exec(v);
    let opts: {kind: string; value: string; label: string; hint: string}[] = [];
    if (at) { const q = at[1].toLowerCase(); opts = plugin.index.source.files().map(f => f.path).filter(p => p.endsWith('.md') && p.toLowerCase().includes(q)).slice(0, 8).map(p => ({kind: 'mention', value: p, label: p.split('/').pop()!.replace(/\.md$/, ''), hint: p.split('/').slice(0, -1).join('/')})); }
    else if (slash) {
      if (!commandsCache) { const d = view.lower!.data as ChatModel; const c = ensure(d); commandsCache = c.session.commands().then(cs => (commandsCache = cs || [])); }
      const cs = await commandsCache; if (input.value.slice(0, input.selectionStart) !== v) return;
      const q = slash[1].toLowerCase(); opts = (cs || []).filter(c => c.name.toLowerCase().includes(q)).slice(0, 8).map(c => ({kind: 'command', value: c.name, label: '/' + c.name, hint: (c.argumentHint ? c.argumentHint + ' · ' : '') + (c.description || '').slice(0, 40)}));
    }
    if (!opts.length) return;
    insertNodes($('#handoff-form')!, 'beforeend', () => h('div', {class: 'ai-mention-menu hand-panel', role: 'listbox'},
      opts.map((o, i) => { // data-mention / data-command：名字随种类变，建好后按原来的先后补写这两个属性
        const b = h('button', {type: 'button', role: 'option'}, T(o.label), h('small', null, T(o.hint))); b.setAttribute('data-' + o.kind, A(o.value)); if (!i) b.setAttribute('aria-selected', 'true'); return b; })));
  }
  function pick(b: HTMLElement){
    const input = $<HTMLTextAreaElement>('#handoff-input')!, pos = input.selectionStart, v = input.value;
    if (b.dataset.mention) { const start = v.slice(0, pos).lastIndexOf('@'), name = b.dataset.mention.split('/').pop()!.replace(/\.md$/, ''); input.value = v.slice(0, start) + '@' + name + ' ' + v.slice(pos); const c = start + name.length + 2; input.setSelectionRange(c, c); }
    else { const cmd = b.dataset.command ?? ''; input.value = '/' + cmd + ' ' + v.slice(pos); const c = cmd.length + 2; input.setSelectionRange(c, c); }
    input.focus(); $('.ai-mention-menu')?.remove(); const d = view.lower?.data as ChatModel | null | undefined; if (d) d.ai.draft = input.value;
  }
  view.registerDomEvent(root, 'input', e => { const t = e.target as HTMLTextAreaElement; if (t.id === 'handoff-input') void suggest(t); });
  view.registerDomEvent(root, 'keydown', e => {
    const menu = $('.ai-mention-menu'); if (!menu || (e.target as Element).id !== 'handoff-input') return;
    const opts = [...menu.querySelectorAll<HTMLElement>('[role=option]')], cur = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, i) => { if (i === n) o.setAttribute('aria-selected', 'true'); else o.removeAttribute('aria-selected'); }); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); pick(opts[Math.max(0, cur)]); }
    else if (e.key === 'Escape') { e.stopImmediatePropagation(); menu.remove(); }
  }, {capture: true});
  view.registerDomEvent(root, 'click', e => {
    const target = e.target as Element;
    if (panel && !target.closest('.ai-list-panel,[data-ai="list"]')) { panel = false; renderPanel(); }
    const b = target.closest<HTMLElement>('[data-mention],[data-command],[data-ai-card],[data-ai]'); if (!b) return;
    if (b.dataset.mention || b.dataset.command) { pick(b); return; }
    if (b.dataset.aiCard) { const c = conv?.items.find((x): x is CardItem => x.role === 'card' && String(x.id) === b.dataset.aiCard); c?.resolve?.(b.dataset.answer as AskAnswer); return; }
    const a = b.dataset.ai, d = view.lower?.data as ChatModel | null | undefined;
    if (a === 'stop') { void conv?.session?.interrupt(); for (const x of conv?.items || []) if (x.role === 'card' && !x.answer) x.resolve?.('deny'); }
    else if (a === 'copy') { void navigator.clipboard?.writeText(b.dataset.text || ''); view.frame.feedback('已复制'); }
    else if (a === 'list') { panel = !panel; b.setAttribute('aria-expanded', String(panel)); renderPanel(); }
    else if (a === 'open') open(b.dataset.id);
    else if (a === 'save') void saveAsNote();
    else if (a === 'rewind') void rewindAsk(Number(b.dataset.at));
    else if (a === 'rewind-go') void rewindGo();
    else if (a === 'rewind-cancel') { if (conv) conv.items = conv.items.filter(x => x.role !== 'rewind'); refresh(); }
    else if (a === 'perm' || a === 'effort') {
      if (d && (!conv || conv.ref !== d.ai.thread)) { closeSession(); conv = fresh(d); }
      // 原来这里 conv 一定有（没有时上一行刚建）；只有 view.lower 还没建时才会是 null，那时页面上也没有这两个按钮
      const c = conv!;
      if (a === 'perm') { c.mode = PERM_NEXT[c.mode] || 'confirm'; c.session?.setMode(c.mode); view.frame.feedback('这一段对话的权限：' + PERM[c.mode]); }
      else { c.effort = EFFORT_NEXT[c.effort] || 'high'; void c.session?.setEffort(c.effort); view.frame.feedback('这一段对话的思考强度：' + EFFORT[c.effort]); }
      decorate();
    }
  });
  return {send,
    /** 把对话填进 el（指引页建好的 .native-thread）：整段重建 */
    threadInto(el: HTMLElement, d: Model){ draw(el, d as ChatModel, false); },
    decorate, close(){ saveNow(); closeSession(); conv = null; drawn = null; mo.disconnect(); }, get busy(){ return !!conv?.busy; },
    // 疑似问题批 F2：close() 断开了观察器；设置里开关 AI（refreshAI → close）之后由 pages/ai.ts 调这里重新盯住顶部，进指引页时按钮立刻补上。
    // 对同一节点再 observe 只是替换原来的登记，反复开关不会多出回调；回调里先 disconnect 再 decorate，不会因自己插入按钮而循环
    watch(){ watch(); },
    // 疑似问题批 F3：握手（init 事件）报来的 MCP 服务，交给设置页显示；还没握手时是空的
    mcp(): readonly McpInfo[]{ return mcpCache || []; },
    clearList(){ try { plugin.localStore.save(STORE, []); } catch { /* 本机存储写不进去：照常刷新面板 */ } renderPanel(); }};
}
