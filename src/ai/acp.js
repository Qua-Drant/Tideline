// AI 供应商：ACP（Agent Client Protocol）客户端。0.3 起替代直接打包的 Claude Agent SDK（使用者 2026-11-08 决定）。
// 插件只做 ACP 的“客户端”：在本机启动一个 ACP 代理程序（stdin / stdout 上逐行 JSON-RPC），工作目录是仓库。
//   Claude Code → claude-agent-acp；Codex → codex-acp；Gemini CLI → gemini --experimental-acp；CodeBuddy → codebuddy --acp；
//   DeepSeek Harness → dsh --profile acp；也可以填任意 ACP 代理的命令。
// askMode：代理自己的“权限模式”里会把每次改动交给客户端问的那一档。有的代理默认自己放行（CodeBuddy 的 auto、Codex 的 agent），
//   那样 session/request_permission 不会发过来、潮线的保护名单就管不到，所以开会话后先切到这一档。
// 代理程序和它的登录都由使用者自己安装、自己保存，插件不打包任何一家的开发包，也不经手订阅凭据。
// 权限：代理要用工具时发 session/request_permission，这里先过 policy.js（三张保护名单 + 三档权限），需要时交给界面出卡片；
//   代理若请插件读写文件（fs/read_text_file、fs/write_text_file），同样先过 policy.js，写入经 Obsidian 的接口。
//   Claude Code 自己读写文件、读文件默认不问：所以给它传 Claude Code 的权限规则（读取前先问 → ask，不能改 → deny）。
// 只在电脑上用（插件本身 isDesktopOnly）。测试工具里换成 harness/fake-claude.js。
import {decide, relPath} from './policy.js';

// Node 模块在用到时才取（Obsidian 桌面版的渲染进程有 require；测试工具是纯浏览器，不会走到这里）
const nodeRequire = name => (globalThis.require || window.require)(name);
const cp = () => nodeRequire('child_process'), fs = () => nodeRequire('fs'), pathm = () => nodeRequire('path'), os = () => nodeRequire('os');
const win = () => process.platform === 'win32';

// 各家的预设：启动命令、安装与登录办法、API 密钥用的环境变量
export const PRESETS = {
  claude: {name: 'Claude Agent', vendor: 'Anthropic', command: 'claude-agent-acp', args: [], install: 'npm install -g @agentclientprotocol/claude-agent-acp', login: 'claude auth login', keyEnv: 'ANTHROPIC_API_KEY', claudeRules: true},
  codex: {name: 'Codex', vendor: 'OpenAI', command: 'codex-acp', args: [], install: 'npm install -g @agentclientprotocol/codex-acp', login: 'codex login', keyEnv: 'OPENAI_API_KEY', askMode: 'read-only'},
  gemini: {name: 'Gemini CLI', vendor: 'Google', command: 'gemini', args: ['--experimental-acp'], install: 'npm install -g @google/gemini-cli', login: 'gemini', keyEnv: 'GEMINI_API_KEY'},
  codebuddy: {name: 'CodeBuddy', vendor: '腾讯云', command: 'codebuddy', args: ['--acp'], install: 'npm install -g @tencent-ai/codebuddy-code', login: 'codebuddy', keyEnv: 'CODEBUDDY_API_KEY', askMode: 'default'},
  // DeepSeek Harness：官方 README 没写安装命令、也没写 API 密钥的环境变量名（docs/AI接入.md）。不给可复制的安装命令；
  // 密钥变量名按惯例填 DEEPSEEK_API_KEY，但标明未验证（unverified 里的话会显示在设置的供应商卡上）
  deepseek: {name: 'DeepSeek Harness', vendor: 'DeepSeek', command: 'dsh', args: ['--profile', 'acp'], install: '', login: '', keyEnv: 'DEEPSEEK_API_KEY',
    unverified: {install: '官方说明没有给出安装命令，请按 DeepSeek Harness 自己的说明安装（潮线没有验证过安装办法）', keyEnv: '这个变量名没有在官方文档里确认；不生效时改用它自己的凭据文件（$DSH_HOME/.credentials.yaml 或 .env）'}},
  custom: {name: '自定义', vendor: '', command: '', args: [], install: '', login: '', keyEnv: ''},
};
export const PROVIDERS = Object.keys(PRESETS);
// 设置里每家一份：{command, args}（留空用预设），API 密钥只存密钥库里的名字
export function resolveProvider(id, conf = {}){
  const p = PRESETS[id] || PRESETS.custom, c = conf[id] || {};
  const args = typeof c.args === 'string' ? splitArgs(c.args) : Array.isArray(c.args) ? c.args : p.args;
  return {...p, id, command: (c.command || '').trim() || p.command, args: c.args === undefined || c.args === '' ? p.args : args};
}
export function splitArgs(s){ const out = []; for (const m of String(s || '').matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]); return out; }

// 找命令：写了路径就用它；否则 PATH（where / which），再看 npm 全局目录（Obsidian 拿到的 PATH 常常不含它）
export function findCommand(command){
  if (!command) return {path: null, error: '还没有填启动命令'};
  const looksPath = /[\\/]/.test(command);
  if (looksPath) return fs().existsSync(command) ? {path: command} : {path: null, error: `找不到“${command}”`};
  const cands = [];
  try { const out = cp().execFileSync(win() ? 'where.exe' : 'which', [command], {encoding: 'utf8', timeout: 5000, windowsHide: true}); cands.push(...out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)); } catch {}
  if (win()) { const npm = pathm().join(process.env.APPDATA || '', 'npm'); cands.push(...['.cmd', '.exe', '.bat', ''].map(x => pathm().join(npm, command + x))); }
  else cands.push(...['/opt/homebrew/bin', '/usr/local/bin', pathm().join(os().homedir(), '.local/bin'), pathm().join(os().homedir(), '.npm-global/bin')].map(d => pathm().join(d, command)));
  // Windows：where 会同时列出没有扩展名的 sh 脚本和 .cmd，取能直接运行的那个
  const ok = cands.filter(c => fs().existsSync(c) && (!win() || /\.(cmd|exe|bat)$/i.test(c)));
  return ok.length ? {path: ok[0]} : {path: null, error: `没有找到 ${command}`};
}

// —— 一条 ACP 连接：逐行 JSON-RPC ——
function connect({path, args, cwd, env, onNotify, onRequest, onExit, onStderr}){
  const shell = win() && /\.(cmd|bat)$/i.test(path);
  const quote = s => /[\s"&|<>^]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
  const child = shell ? cp().spawn(quote(path), args.map(quote), {cwd, env, shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']})
    : cp().spawn(path, args, {cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
  let buf = '', seq = 0, dead = null; const waiting = new Map();
  const write = m => { if (!dead) try { child.stdin.write(JSON.stringify(m) + '\n'); } catch {} };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => { buf += chunk; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; let m; try { m = JSON.parse(line); } catch { continue; } handle(m); } });
  child.stderr.setEncoding('utf8'); child.stderr.on('data', s => onStderr?.(s));
  const fail = error => { if (dead) return; dead = error; for (const w of waiting.values()) w.reject(error); waiting.clear(); onExit?.(error); };
  child.on('error', e => fail(e));
  child.on('exit', code => fail(Object.assign(new Error(`代理程序已退出（${code}）`), {code: 'EXIT'})));
  async function handle(m){
    if (m.method === undefined && m.id !== undefined) { const w = waiting.get(m.id); waiting.delete(m.id); if (!w) return; if (m.error) w.reject(Object.assign(new Error(m.error.message || '代理程序出错'), {rpc: m.error})); else w.resolve(m.result); return; }
    if (m.id === undefined) { onNotify?.(m.method, m.params || {}); return; }
    try { write({jsonrpc: '2.0', id: m.id, result: await onRequest(m.method, m.params || {}) ?? null}); }
    catch (e) { write({jsonrpc: '2.0', id: m.id, error: {code: e.code === 'NOT_FOUND' ? -32601 : -32603, message: String(e.message || e)}}); }
  }
  return {
    call(method, params, timeout = 0){ if (dead) return Promise.reject(dead); const id = ++seq; write({jsonrpc: '2.0', id, method, params});
      return new Promise((resolve, reject) => { waiting.set(id, {resolve, reject}); if (timeout) setTimeout(() => { if (waiting.delete(id)) reject(new Error('代理程序没有回应')); }, timeout); }); },
    notify(method, params){ write({jsonrpc: '2.0', method, params}); },
    close(){ dead ??= new Error('closed'); try { child.stdin.end(); } catch {} try { child.kill(); } catch {} },
    get alive(){ return !dead; },
  };
}
// 代理报的模型清单：新协议在 configOptions 里（category 'model'），旧的不稳定接口在 session/new 结果的 models.availableModels 里。
// 同名的（如同一模型的两个区域）在名字后面补上 id，模型菜单靠名字区分。
const flat = o => (o?.options || []).flatMap(x => x.options ? x.options : [x]);
export function modelList(configs, legacy){
  const o = (configs || []).find(o => o.category === 'model' || o.id === 'model');
  const raw = o ? flat(o).map(x => ({value: x.value ?? x.id, name: x.name || String(x.value ?? x.id)})) : (legacy?.availableModels || []).map(m => ({value: m.modelId, name: m.name || m.modelId}));
  const seen = new Map(); for (const m of raw) seen.set(m.name, (seen.get(m.name) || 0) + 1);
  return raw.filter(m => m.value != null && m.value !== '').map(m => seen.get(m.name) > 1 ? {...m, name: `${m.name} (${m.value})`} : m);
}
const CLIENT = {protocolVersion: 1, clientCapabilities: {fs: {readTextFile: true, writeTextFile: true}, terminal: false}, clientInfo: {name: 'tideline', title: '潮线', version: '0.3'}};

// 检查：只做握手（initialize），不开会话、不花用量
// models: true 时再开一个空会话读模型清单（使用者在设置里点“检查”或打开这一家时；不发提示，不花用量）
export async function probe(provider, {cwd, apiKey, models = false} = {}){
  const f = findCommand(provider.command); if (!f.path) return {ok: false, error: f.error, path: null};
  const env = {...process.env}; if (apiKey && provider.keyEnv) env[provider.keyEnv] = apiKey;
  let stderr = '';
  const c = connect({path: f.path, args: provider.args, cwd: cwd || os().homedir(), env, onRequest: async () => { throw Object.assign(new Error('not supported'), {code: 'NOT_FOUND'}); }, onStderr: s => { stderr += s; }});
  try { const r = await c.call('initialize', CLIENT, 20000);
    let list = null;
    if (models) { try { const s = await c.call('session/new', {cwd: cwd || os().homedir(), mcpServers: []}, 30000); list = modelList(s?.configOptions, s?.models); } catch {} }
    return {ok: true, models: list, path: f.path, name: r.agentInfo?.title || r.agentInfo?.name || provider.name, version: r.agentInfo?.version || '', protocol: r.protocolVersion, auth: (r.authMethods || []).map(a => a.name || a.id), loadSession: !!r.agentCapabilities?.loadSession}; }
  catch (e) { return {ok: false, path: f.path, error: String(e.message || e).slice(0, 200) + (stderr ? '：' + stderr.trim().split('\n').pop().slice(0, 160) : '')}; }
  finally { c.close(); }
}

// Claude Code 的权限规则：读取前先问 → ask；不能改 → deny（Claude Code 自己读写文件，不经插件）
const ruleGlob = item => { const x = String(item).replace(/\\/g, '/').replace(/^\.?\//, ''); return './' + (x.endsWith('/') ? x + '**' : x); };
function claudeRules(lists){
  const ask = (lists.askRead || []).flatMap(f => ['Read', 'Grep', 'Glob'].map(t => `${t}(${ruleGlob(f)})`));
  const deny = (lists.noWrite || []).flatMap(f => ['Edit', 'Write'].map(t => `${t}(${ruleGlob(f)})`));
  return {permissions: {ask, deny}};
}
// ACP 的工具调用 → policy.js 认得的工具名与参数
function asTool(tc){
  const raw = tc.rawInput || {}, name = tc._meta?.claudeCode?.toolName || tc.name || '', loc = tc.locations?.[0]?.path, diff = (tc.content || []).find(c => c.type === 'diff');
  const file = raw.file_path || raw.path || raw.notebook_path || diff?.path || loc;
  if (tc.kind === 'execute' || /^(Bash|PowerShell|shell|exec)/i.test(name)) return {tool: 'Bash', input: {command: raw.command ?? raw.cmd ?? (Array.isArray(raw.argv) ? raw.argv.join(' ') : tc.title || '')}};
  if (tc.kind === 'edit' || tc.kind === 'delete' || tc.kind === 'move' || /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(name)) return {tool: /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(name) ? name : 'Write', input: {...raw, file_path: file}, diff};
  if (tc.kind === 'search' || /^(Grep|Glob|LS)$/.test(name)) return {tool: /^(Grep|Glob|LS)$/.test(name) ? name : 'Grep', input: {...raw, path: raw.path ?? loc ?? ''}};
  if (tc.kind === 'read' || name === 'Read') return {tool: 'Read', input: {file_path: file}};
  if (/^mcp__/.test(name)) return {tool: name, input: raw};
  return {tool: name || tc.kind || 'other', input: raw, other: true};
}

// 一段对话（接口和以前的 claude.js 一样，controller.js 不用知道底下是哪家）
// onEvent({type: 'init'|'delta'|'text'|'tool'|'tool-done'|'result'|'error', …})；ask({tool, input, policy, reason, diff}) → 'once'|'session'|'deny'
export function createAcpSession({provider, cwd, model, effort, mode, lists, apiKey, resume, onEvent, ask, files}){
  const allowed = new Set(), P = provider; let perm = mode, sessionId = null, closed = false, ready, conn = null;
  let configs = [], commands = [], msgId = null, msgText = '', pendingPerm = new Set(), t0 = 0;
  const policy = (tool, input) => decide({tool, input, root: cwd, lists, mode: perm, allowed});
  const flush = () => { if (msgText) onEvent({type: 'text', text: msgText}); msgText = ''; msgId = null; };
  const option = cat => configs.find(o => o.category === cat || o.id === cat);
  const choose = (cat, want) => { const o = option(cat); if (!o || !want) return null; const vals = (o.options || []).flatMap(x => x.options ? x.options : [x]).map(x => x.value ?? x.id); return vals.find(v => v === want) || vals.find(v => String(v).toLowerCase().includes(String(want).toLowerCase())) || null; };
  const setConfig = async (cat, want) => { const v = choose(cat, want); if (!v || !sessionId) return; try { const r = await conn.call('session/set_config_option', {sessionId, configId: option(cat).id, value: v}); if (r?.configOptions) configs = r.configOptions; } catch {} };
  let legacy = null; // 旧接口的 models（没有 configOptions 里的模型项时用）
  const modelLabel = () => { const o = option('model'), cur = o ? o.currentValue : legacy?.currentModelId; return modelList(configs, legacy).find(m => m.value === cur)?.name || cur || ''; };
  const setModel = async want => { if (!want || !sessionId) return; if (option('model')) return setConfig('model', want);
    const all = modelList(null, legacy), hit = all.find(m => m.value === want) || all.find(m => String(m.value).toLowerCase().includes(String(want).toLowerCase()));
    if (hit) try { await conn.call('session/set_model', {sessionId, modelId: hit.value}); legacy.currentModelId = hit.value; } catch {} };

  async function permission({toolCall, options}){
    const tc = asTool(toolCall), p = policy(tc.tool, tc.input);
    const pick = kinds => (options.find(o => kinds.includes(o.kind)) || options.find(o => /allow/.test(o.kind) === kinds.some(k => /allow/.test(k))))?.optionId;
    const allow = always => ({outcome: {outcome: 'selected', optionId: pick(always ? ['allow_always', 'allow_once'] : ['allow_once'])}});
    const reject = () => ({outcome: {outcome: 'selected', optionId: pick(['reject_once', 'reject_always'])}});
    if (p.decision === 'deny') return reject();
    if (p.decision === 'allow') return allow(false);
    const token = {}; pendingPerm.add(token);
    try {
      const answer = await ask({tool: tc.tool, input: tc.input, policy: p.kind === 'other' || tc.other ? {...p, kind: 'other'} : p, reason: p.reason || toolCall.title || '', diff: tc.diff, title: toolCall.title});
      if (token.cancelled) return {outcome: {outcome: 'cancelled'}};
      if (answer === 'deny') return reject();
      if (answer === 'session') for (const f of p.folders || []) allowed.add(f);
      return allow(false);
    } finally { pendingPerm.delete(token); }
  }
  // 代理请插件读写文件：同样先过保护名单；写入经 Obsidian 的接口（files.read / files.write 由 controller 传进来）
  async function fsRead({path, line, limit}){
    const p = policy('Read', {file_path: path});
    if (p.decision === 'deny') throw new Error(p.reason);
    if (p.decision === 'ask') { const a = await ask({tool: 'Read', input: {file_path: path}, policy: p, reason: p.reason}); if (a === 'deny') throw new Error('用户没有同意读取'); if (a === 'session') for (const f of p.folders || []) allowed.add(f); }
    const rel = relPath(path, cwd); let text = rel !== null ? await files.read(rel) : null;
    if (text === null) { try { text = fs().readFileSync(path, 'utf8'); } catch { throw Object.assign(new Error('找不到文件：' + path), {code: 'ENOENT'}); } }
    if (line || limit) { const rows = text.split('\n'), s = Math.max(0, (line || 1) - 1); text = rows.slice(s, limit ? s + limit : undefined).join('\n'); }
    return {content: text};
  }
  async function fsWrite({path, content}){
    const p = policy('Write', {file_path: path});
    if (p.decision === 'deny') throw new Error(p.reason);
    const rel = relPath(path, cwd); if (rel === null) throw new Error('不能改仓库之外的文件');
    if (p.decision !== 'allow') { const before = await files.read(rel); const a = await ask({tool: 'Write', input: {file_path: path, content}, policy: p, reason: p.reason, diff: {path, oldText: before, newText: content}}); if (a === 'deny') throw new Error('用户没有同意写入'); }
    await files.write(rel, content); return null;
  }
  function update(u){
    const k = u.sessionUpdate;
    if (k === 'agent_message_chunk' && u.content?.type === 'text') { if (u.messageId && msgId && u.messageId !== msgId) flush(); msgId = u.messageId || msgId || 'm'; msgText += u.content.text; onEvent({type: 'delta', text: u.content.text}); }
    else if (k === 'tool_call') { flush(); const tc = asTool(u); onEvent({type: 'tool', id: u.toolCallId, name: tc.tool, input: tc.input, title: u.title}); if (u.status === 'completed' || u.status === 'failed') onEvent({type: 'tool-done', id: u.toolCallId, error: u.status === 'failed'}); }
    else if (k === 'tool_call_update') { if (u.rawInput && Object.keys(u.rawInput).length) { const tc = asTool(u); onEvent({type: 'tool-input', id: u.toolCallId, name: tc.tool, input: tc.input, title: u.title}); } if (u.status === 'completed' || u.status === 'failed') onEvent({type: 'tool-done', id: u.toolCallId, error: u.status === 'failed'}); }
    else if (k === 'available_commands_update') commands = (u.availableCommands || []).map(c => ({name: c.name, description: String(c.description || '').replace(/\s*\((user|project|plugin)\)\s*$/, ''), argumentHint: c.input?.hint || ''}));
    else if (k === 'config_option_update' && u.configOptions) configs = u.configOptions;
  }
  // 启动：握手 → 接着以前的会话（resume / load）或新开 → 按默认选模型与思考强度
  async function start(){
    const f = findCommand(P.command);
    if (!f.path) throw Object.assign(new Error(f.error), {code: 'ENOENT'});
    const env = {...process.env}; if (apiKey && P.keyEnv) env[P.keyEnv] = apiKey;
    let replaying = false, stderrTail = '';
    conn = connect({path: f.path, args: P.args, cwd, env,
      onNotify: (method, params) => { if (method === 'session/update' && !replaying && params.update) update(params.update); },
      onRequest: async (method, params) => {
        if (method === 'session/request_permission') return permission(params);
        if (method === 'fs/read_text_file') return fsRead(params);
        if (method === 'fs/write_text_file') return fsWrite(params);
        throw Object.assign(new Error('潮线不支持 ' + method), {code: 'NOT_FOUND'});
      },
      onExit: e => { if (!closed) onEvent({type: 'error', message: String(e.message || e) + (stderrTail.trim() ? '：' + stderrTail.trim().split('\n').pop().slice(0, 200) : ''), code: e.code}); onEvent({type: 'closed'}); },
      // 代理的 stderr 只是它自己的日志（如 Claude 的 [authStatus]），不当作出错；只留最后几行，代理意外退出时附在提示里
      onStderr: s => { stderrTail = (stderrTail + s).slice(-600); }});
    const init = await conn.call('initialize', CLIENT, 30000);
    const caps = init.agentCapabilities || {}, meta = P.claudeRules ? {claudeCode: {options: {settings: claudeRules(lists)}}} : undefined;
    let r = null;
    if (resume && caps.sessionCapabilities?.resume) { try { r = await conn.call('session/resume', {sessionId: resume, cwd, mcpServers: [], _meta: meta}); sessionId = resume; } catch { r = null; } }
    if (!sessionId && resume && caps.loadSession) { replaying = true; try { r = await conn.call('session/load', {sessionId: resume, cwd, mcpServers: [], _meta: meta}); sessionId = resume; } catch { r = null; } replaying = false; }
    if (!sessionId) { r = await conn.call('session/new', {cwd, mcpServers: [], _meta: meta}); sessionId = r.sessionId; }
    configs = r?.configOptions || []; legacy = r?.models || null;
    if (P.askMode) { if (option('mode')) await setConfig('mode', P.askMode); else if (r?.modes) try { await conn.call('session/set_mode', {sessionId, modeId: P.askMode}); } catch {} }
    await setModel(model); await setConfig('thought_level', effort);
    onEvent({type: 'init', model: modelLabel(), agent: init.agentInfo?.title || P.name, sessionId, mcp: []});
  }
  ready = start().catch(e => { const auth = e.rpc?.code === -32000 || /auth|log ?in|credential|401/i.test(e.message);
    onEvent({type: 'error', message: e.message, code: e.code || (auth ? 'AUTH' : ''), provider: P}); throw e; });
  ready.catch(() => {});
  return {
    allowed,
    caps: {rewind: false},
    send(text, uuid = crypto.randomUUID()){
      (async () => {
        try { await ready; } catch { onEvent({type: 'result', ok: false, ms: 0, error: ''}); return; }
        t0 = performance.now(); msgId = null; msgText = '';
        try { const r = await conn.call('session/prompt', {sessionId, prompt: [{type: 'text', text}]}); flush();
          onEvent({type: 'result', ok: r?.stopReason !== 'refusal', ms: performance.now() - t0, error: r?.stopReason === 'cancelled' ? '已停下' : r?.stopReason === 'refusal' ? '代理拒绝了这个请求' : r?.stopReason === 'max_tokens' ? '回答太长，被截断了' : ''}); }
        catch (e) { flush(); if (!closed) onEvent({type: 'result', ok: false, ms: performance.now() - t0, error: String(e.message || e)}); }
      })();
      return uuid;
    },
    setModel: m => ready.then(() => setModel(m)).catch(() => {}),
    setEffort: e => ready.then(() => setConfig('thought_level', e)).catch(() => {}),
    setMode(m){ perm = m; },
    models: () => ready.then(() => modelList(configs, legacy)).catch(() => []),
    commands: () => ready.then(() => commands).catch(() => []),
    mcp: async () => [],
    async rewindFiles(){ return {canRewind: false, filesChanged: [], error: '通过 ACP 接入时不能还原文件'}; },
    interrupt(){ for (const t of pendingPerm) t.cancelled = true; if (sessionId) conn?.notify('session/cancel', {sessionId}); return Promise.resolve(); },
    close(){ closed = true; for (const t of pendingPerm) t.cancelled = true; conn?.close(); },
  };
}
