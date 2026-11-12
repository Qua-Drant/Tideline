// 指引页的对话：把供应商（claude.js；测试工具里是 fake-claude.js）接到原型的对话区。
// 原型 paper-guidance-r28.js 的“发送”与“对话列表”两处，经 sync-proto 改成调这里（HOST.ai.send / HOST.ai.thread）。
// 这里负责：
//   - 一段对话一个会话；流式显示回答；工具调用收成一行小字；要你确认的事出卡片（改前改后、读受保护的位置、运行命令）
//   - @ 提到笔记、/ 调出命令与技能
//   - 顶部就地换模型、思考强度、权限（只改这一段对话）
//   - 对话列表：只存在这台设备上（Obsidian 的本机存储，不写进仓库），旧对话按设置自动归档；点一段接着聊（Claude Code 自己存着会话记录）
//   - 回退：回到某句话之前，撤销那之后 AI 改过的文件（开发包的文件留底；用命令改的文件不在其中）
//   - 存成笔记
import {renderAnswer} from './markdown.js';
import {esc} from '../draw/ink.js';
import {lineDiff} from './diff.js';
import {relPath, DEFAULT_LISTS} from './policy.js';
import {HOST} from '../host.js';

const TOOL_LABEL = {Read: '读', Write: '写', Edit: '改', MultiEdit: '改', NotebookEdit: '改', Glob: '找文件', Grep: '搜索', LS: '列出', Bash: '运行', PowerShell: '运行',
  WebSearch: '搜索网页', WebFetch: '打开网页', Task: '分派子任务', Agent: '分派子任务', TodoWrite: '列待办', Skill: '用技能'};
// 回答的 Markdown：原始 HTML 转义、链接白名单、图片不自动加载（ai/markdown.js）
const md = renderAnswer;
const MODELS = {Sonnet: 'sonnet', Opus: 'opus', Haiku: 'haiku'};
const KIND_LABEL = {read: '读', edit: '改', delete: '删', move: '移动', search: '搜索', execute: '运行', fetch: '打开网页', think: '思考'};
const PERM = {read: '只读', confirm: '改前确认', auto: '自动接受改动'}, PERM_NEXT = {read: 'confirm', confirm: 'auto', auto: 'read'};
const EFFORT = {low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高'}, EFFORT_NEXT = {low: 'medium', medium: 'high', high: 'xhigh', xhigh: 'max', max: 'low'};
const STORE = 'tideline-ai-conversations', KEEP = 100;
const uid = () => (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
const stamp = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function createAIController({view, plugin, provider}){
  const root = view.root, $ = s => root.querySelector(s);
  let conv = null, renderQueued = false, cardSeq = 0, panel = false, commandsCache = null, mcpCache = null, saveTimer = 0;
  const settings = () => plugin.settings.ai;
  const lists = () => plugin.index.config.ai || DEFAULT_LISTS;
  const vaultRoot = () => plugin.vaultRoot();
  const rel = p => relPath(p, vaultRoot()) ?? String(p);
  // 模型菜单里的“供应商 · 模型” → 哪一家、哪个模型（“默认”就不改代理自己的默认）
  const pickOf = label => { const [name, model = ''] = String(label || '').split(' · '), list = HOST.aiProviders?.() || {}, ids = Object.keys(list);
    const id = ids.find(k => list[k][0] === name || (k === 'claude' && name === 'Claude Code')) || // 0.9.5 前这一家叫 Claude Code：旧对话的标签照样认
      (list[settings().provider] ? settings().provider : ids[0]) || 'claude';
    const live = (plugin.aiModels?.(id) || plugin.ai?.models?.[id])?.find(m => m.name === model);
    return {id, model: live ? live.value : MODELS[model] || (model && model !== '默认' ? model : (id === 'claude' ? settings().model : null))}; };
  const canRewind = () => provider.caps?.rewind !== false;

  // —— 本机存储的对话列表 ——
  const loadAll = () => { try { return plugin.localStore.load(STORE) || []; } catch { return []; } };
  // 存的是“那一段”对话（不是存的时候正好打开着的那段）：切到别的对话前也会先存
  function saveSoon(c = conv){ clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(c), 400); }
  function saveNow(c = conv){
    if (!c) return;
    // 回退到一句不剩的对话：从列表里拿掉
    if (!c.items.some(x => x.role === 'user')) { const all = loadAll(); if (all.some(x => x.id === c.id)) try { plugin.localStore.save(STORE, all.filter(x => x.id !== c.id)); } catch {} return; }
    c.updated = Date.now();
    const plain = {id: c.id, title: c.title, created: c.created, updated: c.updated, sessionId: c.sessionId, resumeAt: c.resumeAt || null, model: c.model, label: c.label, providerId: c.providerId || null, effort: c.effort, mode: c.mode, mentions: [...c.mentions],
      items: c.items.map(x => x.role === 'card' ? {role: 'card', id: x.id, kind: x.kind, title: x.title, answer: x.answer || 'deny', doneText: x.doneText || `没有回答：${x.title}`} : x.role === 'ai' ? {role: 'ai', model: x.model, text: x.text, tools: x.tools.map(t => ({...t, state: t.state === 'running' ? 'failed' : t.state})), meta: x.meta, cont: x.cont} : {...x})};
    const all = loadAll().filter(x => x.id !== c.id); all.unshift(plain);
    try { plugin.localStore.save(STORE, all.slice(0, KEEP)); } catch {}
  }

  // —— 对话区 ——
  function thread(d){
    if (!conv || conv.ref !== d.ai.thread) return d.ai.thread.map(m => `<article class="native-message"><span>${esc(m.role === 'user' ? '我' : (m.model || d.ai.agent))}</span><p>${esc(m.text)}</p></article>`).join('');
    const pending = conv.busy && conv.items.some(m => m.role === 'card' && !m.answer);
    const dots = pending ? '' : '<span class="ai-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    return conv.items.map((m, i) => item(m, i)).join('') + (conv.busy ? `<div class="ai-busy"><span class="ai-busy-label">${pending ? '等待你的确认' : '正在回答'}</span>${dots}<button class="text-button" data-ai="stop">停下</button></div>` : '');
  }
  function item(m, i){
    if (m.role === 'user') return `<article class="native-message ai-user"><span>我${conv.busy || !canRewind() ? '' : `<button class="ai-rewind" data-ai="rewind" data-at="${i}" aria-label="回到这句话之前" title="回到这句话之前，撤销那之后 AI 改过的文件">回到这里</button>`}</span><p>${esc(m.text).replace(/\n/g, '<br>')}</p>${m.mentions?.length ? `<small class="ai-mentions">${m.mentions.map(p => esc(p)).join('　')}</small>` : ''}</article>`;
    if (m.role === 'ai') return `<article class="native-message ai-answer${m.cont ? ' cont' : ''}">${m.cont ? '' : `<span>${esc(m.model)}</span>`}${m.tools.length ? `<ul class="ai-tools">${m.tools.map(t => `<li class="${t.state}" title="${esc(t.detail)}">${esc(t.label)}</li>`).join('')}</ul>` : ''}<div class="ai-md">${md(m.text)}</div>${m.meta ? `<small class="ai-meta">${esc(m.meta)}</small>` : ''}</article>`;
    if (m.role === 'card') return card(m);
    if (m.role === 'rewind') return rewindCard(m);
    if (m.role === 'note') return `<div class="ai-card done"><span>${esc(m.text)}</span></div>`;
    if (m.role === 'error') return `<div class="ai-error" role="alert"><p>${esc(m.text)}</p>${m.command ? `<code>${esc(m.command)}</code><button class="text-button" data-ai="copy" data-text="${esc(m.command)}">复制</button>` : ''}</div>`;
    return '';
  }
  const btn = (attrs, label, primary) => `<button class="${primary ? 'outline' : 'text-button'}" ${attrs}>${label}</button>`;
  function card(c){
    if (c.answer) return `<div class="ai-card done"><span>${esc(c.doneText)}</span></div>`;
    const b = (a, label, primary) => btn(`data-ai-card="${c.id}" data-answer="${a}"`, label, primary);
    let body = '', buttons = '';
    if (c.kind === 'write') {
      body = c.diff ? `<div class="ai-diff" role="table" aria-label="改前改后">${c.diff.rows.map(([k, t]) => `<div class="ai-diff-row ${k === '+' ? 'add' : k === '-' ? 'del' : k === '…' ? 'gap' : ''}"><i>${k === '=' ? '' : k}</i><span>${esc(t) || '&nbsp;'}</span></div>`).join('')}</div><small>${c.diff.added ? `加 ${c.diff.added} 行` : ''}${c.diff.added && c.diff.removed ? '，' : ''}${c.diff.removed ? `删 ${c.diff.removed} 行` : ''}${c.isNew ? '（新建）' : ''}</small>` : '';
      buttons = b('once', '写入', true) + b('deny', '不写');
    } else if (c.kind === 'read') {
      body = `<ul class="ai-paths">${c.paths.map(p => `<li>${esc(p || '整个仓库')}</li>`).join('')}</ul>`;
      buttons = b('once', '允许这一次', true) + (c.folders?.length ? b('session', '这次对话都允许') : '') + b('deny', '拒绝');
    } else if (c.kind === 'shell') { body = `<pre class="ai-command">${esc(c.command)}</pre>`; buttons = b('once', '运行', true) + b('deny', '不运行'); }
    else { body = `<pre class="ai-command">${esc(JSON.stringify(c.input, null, 1).slice(0, 600))}</pre>`; buttons = b('once', '允许', true) + b('deny', '拒绝'); }
    return `<div class="ai-card" data-card="${c.id}"><div class="ai-card-head"><strong>${esc(c.title)}</strong>${c.reason ? `<small>${esc(c.reason)}</small>` : ''}</div>${body}<div class="ai-card-actions">${buttons}</div></div>`;
  }
  function rewindCard(r){
    const files = r.files || [];
    const body = r.checking ? '<small>正在查这之后改过哪些文件…</small>' : r.error ? `<small>${esc(r.error)}</small>`
      : files.length ? `<ul class="ai-paths">${files.map(f => `<li>${esc(rel(f))}</li>`).join('')}</ul><small>这些文件会还原到这句话之前的样子${r.stats ? `（共加 ${r.stats.insertions || 0} 行、删 ${r.stats.deletions || 0} 行）` : ''}。用命令改动的文件不在其中。</small>`
      : '<small>这之后 AI 没有改过文件，只回到对话的这个位置。</small>';
    return `<div class="ai-card" data-rewind="${r.at}"><div class="ai-card-head"><strong>回到“${esc(r.text.slice(0, 24))}${r.text.length > 24 ? '…' : ''}”之前</strong><small>这句话和之后的对话都会去掉；这句话放回输入框</small></div>${body}<div class="ai-card-actions">${r.checking ? '' : btn('data-ai="rewind-go"', '回退', true)}${btn('data-ai="rewind-cancel"', '取消')}</div></div>`;
  }
  // 流式回答时只重画对话区，一帧一次；停在底部时跟着滚
  function refresh(){
    if (renderQueued) return; renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; const el = $('#native-content .native-thread'); if (!el || !conv) return;
      const atEnd = conv.toEnd || el.scrollHeight - el.clientHeight - el.scrollTop < 40; conv.toEnd = false; el.innerHTML = thread(conv.d); if (atEnd) el.scrollTop = el.scrollHeight; decorate(); view.frames(); });
  }

  // —— 顶部：对话列表、存成笔记；权限与思考强度（只改这一段对话）——
  function decorate(){
    const on = !!conv?.d?.settingsR27?.ai?.enabled || !!view.lower?.data?.settingsR27?.ai?.enabled; if (!on) return;
    const con = $('#connection'), priv = $('#privacy');
    if (con && !con.querySelector('[data-ai="list"]')) con.querySelector('[data-guidance="new"]')?.insertAdjacentHTML('beforebegin',
      `<button class="ai-head-btn text-button" data-ai="save" aria-label="把这段对话存成笔记">存成笔记</button><i class="ai-head-sep" aria-hidden="true">·</i><button class="ai-head-btn text-button" data-ai="list" aria-label="对话列表" aria-expanded="${panel}">对话</button>`);
    if (priv) { const s = settings(), mode = conv?.mode || s.permission, effort = conv?.effort || s.effort, html = `<button class="native-permission ai-switch" data-ai="perm" aria-label="权限：${PERM[mode]}，点一下换（只改这一段对话）"><small>权限</small><span>${PERM[mode]}</span></button><button class="native-permission ai-switch" data-ai="effort" aria-label="思考强度：${EFFORT[effort]}，点一下换（只改这一段对话）"><small>思考</small><span>${EFFORT[effort]}</span></button>`;
      // 原型那一格“默认权限”（点了去设置）换成两个就地切换的按钮；已经换过就只更新文字
      priv.querySelector('.native-permission:not(.ai-switch)')?.remove();
      let box = priv.querySelector('.ai-switches'); if (!box) { priv.insertAdjacentHTML('beforeend', '<span class="ai-switches"></span>'); box = priv.querySelector('.ai-switches'); }
      if (box.innerHTML !== html) box.innerHTML = html; }
    renderPanel();
  }
  function renderPanel(){
    $('.ai-list-panel')?.remove(); if (!panel) return;
    const all = loadAll(), days = Number(settings().archiveDays ?? 30), cut = days ? Date.now() - days * 864e5 : 0;
    const live = all.filter(c => !cut || c.updated >= cut), old = all.filter(c => cut && c.updated < cut);
    const row = c => `<button type="button" class="ai-list-row" data-ai="open" data-id="${esc(c.id)}" ${conv?.id === c.id ? 'aria-current="true"' : ''}><span>${esc(c.title || '（空）')}</span><small>${stamp(c.updated)}</small></button>`;
    const mcp = (mcpCache || []).map(m => `${m.name.replace(/^claude\.ai /, '')} ${({connected: '已连接', failed: '连不上', 'needs-auth': '要登录', pending: '连接中', disabled: '关了'})[m.status] || m.status}`);
    const win = $('.ai-window'); if (!win) return;
    win.insertAdjacentHTML('beforeend', `<div class="ai-list-panel hand-panel" role="dialog" aria-label="对话列表"><div class="ai-list-head"><strong>对话</strong><small>只存在这台设备上</small></div>
      <div class="ai-list-rows">${live.map(row).join('') || '<p class="ai-list-empty">还没有对话</p>'}</div>
      ${old.length ? `<details class="ai-list-archive"><summary>已归档 ${old.length}（${days} 天前）</summary>${old.map(row).join('')}</details>` : ''}
      <p class="ai-list-mcp">${mcp.length ? '外部工具（MCP）：' + esc(mcp.join('，')) + '。用之前都会先问你。' : '外部工具（MCP）：发第一句话后显示'}</p></div>`);
    view.frames();
  }
  // 原型的指引模块会重画顶部（换模型、开关菜单时），重画后再补上
  const mo = new MutationObserver(() => { if (view.page === 'ai') { mo.disconnect(); decorate(); watch(); } });
  const watch = () => { for (const s of ['#connection', '#privacy']) { const el = $(s); if (el) mo.observe(el, {childList: true}); } };
  watch();

  // —— 会话 ——
  function fresh(d){ return {id: uid(), d, ref: d.ai.thread, items: [], title: '', created: Date.now(), updated: Date.now(), sessionId: null, resumeAt: null, model: d.ai.model || 'Claude', label: d.ai.model,
    effort: settings().effort, mode: settings().permission, mentions: new Set(), busy: false, session: null, current: null}; }
  function ensure(d){
    if (!conv || conv.ref !== d.ai.thread) { if (conv) { clearTimeout(saveTimer); saveNow(conv); } closeSession(); conv = fresh(d); }
    if (conv.session) return conv;
    const c = conv, pick = pickOf(c.label || d.ai.model); c.providerId = pick.id;
    c.session = provider.create({providerId: pick.id, cwd: vaultRoot(), model: pick.model, effort: c.effort, mode: c.mode, lists: lists(), apiKey: plugin.aiApiKey?.(pick.id),
      resume: c.sessionId || undefined, resumeAt: c.resumeAt || undefined, onEvent: e => onEvent(c, e), ask: q => askUser(c, q)});
    c.resumeAt = null; // 截断只做一次：之后那段会话记录本身就截好了
    for (const p of c.mentions) c.session.allowed.add(p);
    return c;
  }
  function closeSession(){ conv?.session?.close(); if (conv) conv.session = null; }
  // 回答按时间顺序分段：出现卡片时这一段结束，之后的话接在卡片下面（不再重复写模型名）
  function answer(c){ if (!c.current) { const last = c.items.findLast(x => x.role === 'user' || x.role === 'ai'); c.current = {role: 'ai', model: c.model, text: '', tools: [], meta: '', cont: last?.role === 'ai'}; c.items.push(c.current); } return c.current; }
  function onEvent(c, e){
    if (c !== conv) return;
    if (e.type === 'init') { c.model = e.agent ? e.agent + (e.model ? ' · ' + e.model : '') : d2label(e.model) || c.model; if (e.sessionId) c.sessionId = e.sessionId; if (e.mcp) mcpCache = e.mcp;
      // 记下代理自己报的模型清单，模型菜单下次打开时用它
      c.session?.models?.().then(ms => { if (!ms?.length) return; if (plugin.rememberModels) plugin.rememberModels(c.providerId, ms); else { plugin.ai.models ??= {}; plugin.ai.models[c.providerId] = ms; } }); }
    else if (e.type === 'tool-input') { for (const it of c.items) if (it.role === 'ai') for (const t of it.tools) if (t.id === e.id) { t.label = toolLabel(e.name, e.input, e.title); t.detail = JSON.stringify(e.input).slice(0, 300); } }
    else if (e.type === 'assistant-id') c.lastAssistant = e.uuid;
    else if (e.type === 'delta') { const a = answer(c); a.streaming ??= ''; a.streaming += e.text; a.text = (a.done || '') + a.streaming; }
    else if (e.type === 'text') { const a = answer(c); a.done = (a.done ? a.done + '\n\n' : '') + e.text; a.streaming = ''; a.text = a.done; }
    else if (e.type === 'tool') { const a = answer(c); if (a.tools.some(t => t.id === e.id)) { refresh(); return; } a.tools.push({id: e.id, state: 'running', label: toolLabel(e.name, e.input, e.title), detail: JSON.stringify(e.input).slice(0, 300)}); }
    else if (e.type === 'tool-done') { for (const it of c.items) if (it.role === 'ai') for (const t of it.tools) if (t.id === e.id) t.state = e.error ? 'failed' : 'done'; }
    else if (e.type === 'result') { c.busy = false; const a = c.items.findLast(x => x.role === 'ai'); if (a) a.meta = e.ok ? `用时 ${(e.ms / 1000).toFixed(1)} 秒` : ''; if (!e.ok && e.error) error(c, e.error); c.current = null; saveSoon(c); }
    else if (e.type === 'error' || e.type === 'stderr') { c.busy = false; error(c, e.message || e.text, e); }
    else if (e.type === 'closed') { c.busy = false; if (c.session) c.session = null; }
    refresh();
  }
  const d2label = m => m ? 'Claude · ' + (/opus/i.test(m) ? 'Opus' : /haiku/i.test(m) ? 'Haiku' : /sonnet/i.test(m) ? 'Sonnet' : m) : '';
  function error(c, text, e = {}){
    const t = String(text || ''), P = e.provider || plugin.aiProviderInfo?.(c.providerId) || {name: 'AI', install: '', login: ''};
    if (e.code === 'ENOENT' || /ENOENT|spawn|没有找到|找不到/i.test(t)) c.items.push({role: 'error', text: `没能启动 ${P.name} 的 ACP 代理程序（${P.command || '未填写命令'}）。${P.install ? '先在终端里安装，再到设置 → 指引里点“检查”：' : '请在设置 → 指引里填写启动命令。'}`, command: P.install || ''});
    else if (e.code === 'AUTH' || /not logged in|log ?in required|authenticat\w* required|unauthori[sz]ed|\b401\b|invalid api key/i.test(t)) c.items.push({role: 'error', text: `${P.name} 还没有登录。在终端里运行下面这条命令登录，然后再发一次：`, command: P.login || ''});
    else if (c.items.at(-1)?.text !== t) c.items.push({role: 'error', text: '出错了：' + t.slice(0, 300)});
  }
  const toolLabel = (name, inp = {}, title = '') => { const what = inp.file_path ? rel(inp.file_path) : inp.path ? rel(inp.path) : inp.pattern || inp.command || inp.query || inp.url || inp.skill || inp.description || '';
    if (!TOOL_LABEL[name] && title) return String(title).slice(0, 90);
    return (TOOL_LABEL[name] || KIND_LABEL[name] || name) + (what ? ' ' + String(what).slice(0, 80) : ''); };

  // —— 要你确认的事 ——
  async function askUser(c, {tool, input, policy, reason, diff, title}){
    const id = ++cardSeq, p = policy, base = {role: 'card', id, tool, input, reason};
    let cardData;
    if (p.kind === 'write') {
      const path = rel(input.file_path || input.notebook_path || diff?.path || ''), before = diff ? (diff.oldText ?? null) : await plugin.readVaultFile(path);
      let after = before ?? '';
      if (diff) after = diff.newText ?? '';
      else if (tool === 'Write') after = input.content ?? '';
      else if (tool === 'Edit') after = input.replace_all ? (before ?? '').split(input.old_string).join(input.new_string) : (before ?? '').replace(input.old_string, input.new_string);
      else if (tool === 'MultiEdit') for (const e of input.edits || []) after = e.replace_all ? after.split(e.old_string).join(e.new_string) : after.replace(e.old_string, e.new_string);
      cardData = {...base, kind: 'write', title: (before === null ? '新建 ' : '改 ') + path, isNew: before === null, diff: lineDiff(before ?? '', after), path};
    } else if (p.kind === 'read') cardData = {...base, kind: 'read', title: '要读受保护的位置', paths: p.paths || [], folders: p.folders || []};
    else if (p.kind === 'shell') cardData = {...base, kind: 'shell', title: '运行命令', command: String(input.command || '')};
    else cardData = {...base, kind: 'other', title: title || TOOL_LABEL[tool] || tool};
    c.current = null; c.items.push(cardData); refresh();
    const ans = await new Promise(res => { cardData.resolve = res; });
    cardData.answer = ans;
    cardData.doneText = ans === 'deny' ? `没有同意：${cardData.title}` : cardData.kind === 'write' ? `已同意：${cardData.title}` : cardData.kind === 'shell' ? `已运行：${cardData.command.slice(0, 60)}` : `已允许${ans === 'session' ? '（这次对话）' : ''}：${(cardData.paths || []).join('、') || cardData.title}`;
    refresh(); return ans;
  }

  // —— 发送（原型的 send 在清空草稿前调这里）——
  function send(text, d){
    let c = ensure(d); const mentions = resolveMentions(text);
    // 模型菜单里换了模型：同一家就地换；换了一家，就关掉旧会话、新开一段（旧代理记得的上下文带不过去）
    if (d.ai.model && d.ai.model !== c.label) {
      const pick = pickOf(d.ai.model);
      if (pick.id !== c.providerId) { closeSession(); c.sessionId = null; c.label = d.ai.model; c.items.push({role: 'note', text: `换到 ${d.ai.model.split(' · ')[0]}，从这里开始是新的一段会话`}); c = ensure(d); }
      else { c.label = d.ai.model; if (pick.model) c.session.setModel?.(pick.model); }
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
  function resolveMentions(text){
    const names = [...String(text).matchAll(/@([^\s@，。、；：！？,;:!?]+)/g)].map(m => m[1]); if (!names.length) return [];
    const files = plugin.index.source.files().map(f => f.path);
    return names.map(n => files.find(p => p === n || p === n + '.md' || p.split('/').pop().replace(/\.md$/, '') === n)).filter(Boolean);
  }

  // —— 打开以前的对话 ——
  function open(id){
    const saved = loadAll().find(c => c.id === id); if (!saved) return;
    const d = view.lower.data; if (conv) { clearTimeout(saveTimer); saveNow(conv); } closeSession();
    d.ai.thread = [{role: 'user', text: saved.title}]; d.ui.aiView = 'chat'; if (saved.label) d.ai.model = saved.label;
    conv = {...fresh(d), ...saved, d, ref: d.ai.thread, mentions: new Set(saved.mentions || []), busy: false, session: null, current: null, lastAssistant: saved.items.findLast?.(x => x.role === 'user')?.after ?? null};
    conv.lastAssistant = null; // 接着聊时由会话记录接上，下一句的回退点等新回答来了再记
    panel = false; view.lower.ai?.render?.(); refresh();
  }
  // —— 回退 ——
  async function rewindAsk(at){
    if (!conv || conv.busy) return; const u = conv.items[at]; if (!u || u.role !== 'user') return;
    conv.items = conv.items.filter(x => x.role !== 'rewind');
    const r = {role: 'rewind', at, text: u.text, checking: true}; conv.items.push(r); conv.toEnd = true; refresh();
    try { ensure(conv.d); const res = await conv.session.rewindFiles(u.uuid, true); r.files = res?.filesChanged || []; r.stats = res; if (res && res.canRewind === false && r.files.length) r.error = res.error || '这一句之前的文件留底找不到了，只能回到对话的这个位置'; }
    catch (e) { r.files = []; r.error = '查不到这之后改过的文件（' + String(e?.message || e).slice(0, 80) + '），只能回到对话的这个位置'; }
    r.checking = false; conv.toEnd = true; refresh();
  }
  async function rewindGo(){
    const r = conv?.items.find(x => x.role === 'rewind'); if (!r) return; const u = conv.items[r.at];
    let restored = 0; if (r.files?.length && !r.error) { try { const res = await conv.session.rewindFiles(u.uuid); if (res?.canRewind !== false) restored = r.files.length; } catch {} }
    closeSession();
    conv.items = conv.items.slice(0, r.at); conv.resumeAt = u.after || null; if (!u.after) conv.sessionId = null; conv.lastAssistant = u.after || null;
    if (!conv.items.length) conv.title = '';
    conv.items.push({role: 'note', text: `已回到“${u.text.slice(0, 24)}”之前${restored ? `，还原了 ${restored} 个文件` : ''}`});
    const input = $('#handoff-input'); if (input) { input.value = u.text; conv.d.ai.draft = u.text; input.focus(); }
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
  async function suggest(input){
    $('.ai-mention-menu')?.remove();
    const v = input.value.slice(0, input.selectionStart), at = /@([^\s@]*)$/.exec(v), slash = /^\/([^\s]*)$/.exec(v);
    let opts = [];
    if (at) { const q = at[1].toLowerCase(); opts = plugin.index.source.files().map(f => f.path).filter(p => p.endsWith('.md') && p.toLowerCase().includes(q)).slice(0, 8).map(p => ({kind: 'mention', value: p, label: p.split('/').pop().replace(/\.md$/, ''), hint: p.split('/').slice(0, -1).join('/')})); }
    else if (slash) {
      if (!commandsCache) { const d = view.lower.data; ensure(d); commandsCache = conv.session.commands().then(cs => (commandsCache = cs || [])); }
      const cs = await commandsCache; if (input.value.slice(0, input.selectionStart) !== v) return;
      const q = slash[1].toLowerCase(); opts = (cs || []).filter(c => c.name.toLowerCase().includes(q)).slice(0, 8).map(c => ({kind: 'command', value: c.name, label: '/' + c.name, hint: (c.argumentHint ? c.argumentHint + ' · ' : '') + (c.description || '').slice(0, 40)}));
    }
    if (!opts.length) return;
    $('#handoff-form').insertAdjacentHTML('beforeend', `<div class="ai-mention-menu hand-panel" role="listbox">${opts.map((o, i) => `<button type="button" role="option" data-${o.kind}="${esc(o.value)}" ${i ? '' : 'aria-selected="true"'}>${esc(o.label)}<small>${esc(o.hint)}</small></button>`).join('')}</div>`);
  }
  function pick(b){
    const input = $('#handoff-input'), pos = input.selectionStart, v = input.value;
    if (b.dataset.mention) { const start = v.slice(0, pos).lastIndexOf('@'), name = b.dataset.mention.split('/').pop().replace(/\.md$/, ''); input.value = v.slice(0, start) + '@' + name + ' ' + v.slice(pos); const c = start + name.length + 2; input.setSelectionRange(c, c); }
    else { input.value = '/' + b.dataset.command + ' ' + v.slice(pos); const c = b.dataset.command.length + 2; input.setSelectionRange(c, c); }
    input.focus(); $('.ai-mention-menu')?.remove(); const d = view.lower?.data; if (d) d.ai.draft = input.value;
  }
  view.registerDomEvent(root, 'input', e => { if (e.target.id === 'handoff-input') suggest(e.target); });
  view.registerDomEvent(root, 'keydown', e => {
    const menu = $('.ai-mention-menu'); if (!menu || e.target.id !== 'handoff-input') return;
    const opts = [...menu.querySelectorAll('[role=option]')], cur = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, i) => { if (i === n) o.setAttribute('aria-selected', 'true'); else o.removeAttribute('aria-selected'); }); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); pick(opts[Math.max(0, cur)]); }
    else if (e.key === 'Escape') { e.stopImmediatePropagation(); menu.remove(); }
  }, {capture: true});
  view.registerDomEvent(root, 'click', e => {
    if (panel && !e.target.closest('.ai-list-panel,[data-ai="list"]')) { panel = false; renderPanel(); }
    const b = e.target.closest('[data-mention],[data-command],[data-ai-card],[data-ai]'); if (!b) return;
    if (b.dataset.mention || b.dataset.command) { pick(b); return; }
    if (b.dataset.aiCard) { const c = conv?.items.find(x => x.role === 'card' && String(x.id) === b.dataset.aiCard); c?.resolve?.(b.dataset.answer); return; }
    const a = b.dataset.ai, d = view.lower?.data;
    if (a === 'stop') { conv?.session?.interrupt(); for (const x of conv?.items || []) if (x.role === 'card' && !x.answer) x.resolve?.('deny'); }
    else if (a === 'copy') { navigator.clipboard?.writeText(b.dataset.text || ''); view.frame.feedback('已复制'); }
    else if (a === 'list') { panel = !panel; b.setAttribute('aria-expanded', String(panel)); renderPanel(); }
    else if (a === 'open') open(b.dataset.id);
    else if (a === 'save') saveAsNote();
    else if (a === 'rewind') rewindAsk(Number(b.dataset.at));
    else if (a === 'rewind-go') rewindGo();
    else if (a === 'rewind-cancel') { if (conv) conv.items = conv.items.filter(x => x.role !== 'rewind'); refresh(); }
    else if (a === 'perm' || a === 'effort') {
      if (d && (!conv || conv.ref !== d.ai.thread)) { closeSession(); conv = fresh(d); }
      if (a === 'perm') { conv.mode = PERM_NEXT[conv.mode] || 'confirm'; conv.session?.setMode(conv.mode); view.frame.feedback('这一段对话的权限：' + PERM[conv.mode]); }
      else { conv.effort = EFFORT_NEXT[conv.effort] || 'high'; conv.session?.setEffort(conv.effort); view.frame.feedback('这一段对话的思考强度：' + EFFORT[conv.effort]); }
      decorate();
    }
  });
  return {send, thread, decorate, close(){ saveNow(); closeSession(); conv = null; mo.disconnect(); }, get busy(){ return !!conv?.busy; },
    clearList(){ try { plugin.localStore.save(STORE, []); } catch {} renderPanel(); }};
}
