// AI 每次要用工具之前，插件按这里决定：直接放行（default，交给 Claude Code 的默认规则）、允许（allow）、先问你（ask）、拒绝（deny）。
// 纯函数，不碰界面和文件。
// 三张名单（潮线/配置.md 的 ai 属性）：askRead 读取前先问、noWrite 不能改、autoWrite 允许直接改（只在“自动接受改动”这一档生效）。
// 三档权限：read 只读、confirm 改前确认（默认）、auto 自动接受改动。不提供“全部放行”。

export const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead']);
export const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
export const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

const slash = s => String(s || '').replace(/\\/g, '/');
const folder = s => { const x = slash(s).replace(/^\.?\//, ''); return x; };

export function defaultLists(configDir){
  const dir = folder(configDir).replace(/\/+$/, '') || '.obsidian';
  return {askRead: ['日记/', '人物/'], noWrite: [dir + '/', '潮线/配置.md'], autoWrite: []};
}
export const DEFAULT_LISTS = defaultLists();

// 仓库里的相对路径；在仓库外返回 null。Windows 上不分大小写
export function relPath(p, root){
  if (p === undefined || p === null || p === '') return '';
  const r = slash(root).replace(/\/+$/, ''), x = slash(p);
  const abs = /^([a-zA-Z]:\/|\/)/.test(x) ? x : r + '/' + x;
  const parts = []; for (const seg of abs.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.' && seg !== '') parts.push(seg); }
  const norm = (/^[a-zA-Z]:/.test(parts[0] || '') ? '' : '/') + parts.join('/'), rr = (/^[a-zA-Z]:/.test(r) ? '' : '') + r;
  const lower = s => s.toLowerCase();
  if (lower(norm) === lower(rr)) return '';
  if (lower(norm).startsWith(lower(rr) + '/')) return norm.slice(rr.length + 1);
  return null;
}
// 一个名单项（文件夹以 / 结尾，或单个文件）是否覆盖 p；scope=true 时，p 是“要搜索的范围”，范围包含了名单项也算
function hits(p, item, scope){
  const it = folder(item), a = p.toLowerCase(), b = it.toLowerCase();
  if (b.endsWith('/')) return a === b.slice(0, -1) || a.startsWith(b) || (scope && (a === '' || b.startsWith(a.replace(/\/?$/, '/'))));
  return a === b || (scope && (a === '' || b.startsWith(a.replace(/\/?$/, '/'))));
}
const anyHit = (p, list, scope) => list.filter(item => hits(p, item, scope));

// 这次调用会碰到哪些路径；scope 表示是搜索范围（目录），不是单个文件
export function targets(tool, input){
  const out = [];
  if (input.file_path) out.push({path: input.file_path, scope: false});
  if (input.notebook_path) out.push({path: input.notebook_path, scope: false});
  if (tool === 'Glob' || tool === 'Grep' || tool === 'LS') {
    const base = input.path ?? '';
    // Glob 的模式本身带了目录（如 日记/**/*.md）：范围就是那个目录
    const pat = slash(input.pattern || ''), lead = tool === 'Glob' ? pat.split('/').filter(s => s && !/[*?[{]/.test(s)) : [];
    const head = tool === 'Glob' && lead.length && !/[*?[{]/.test(pat.split('/')[0]) ? lead.slice(0, pat.split('/').findIndex(s => /[*?[{]/.test(s)) < 0 ? lead.length : pat.split('/').findIndex(s => /[*?[{]/.test(s))).join('/') : '';
    out.push({path: head ? slash(base).replace(/\/?$/, base ? '/' : '') + head : base, scope: true});
  }
  return out;
}

export function decide({tool, input = {}, root, lists = DEFAULT_LISTS, mode = 'confirm', allowed = new Set()}){
  const L = {askRead: lists.askRead || [], noWrite: lists.noWrite || [], autoWrite: lists.autoWrite || []};
  const res = (decision, reason, extra = {}) => ({decision, reason, ...extra});
  if (tool.startsWith('mcp__')) return res('ask', '使用外部工具（MCP）', {kind: 'other'});
  if (READ_TOOLS.has(tool)) {
    const ts = targets(tool, input), outside = [], guarded = new Set();
    // allowed 里可以是文件夹（“这次对话都允许”）或单篇笔记（你在对话里用 @ 提到的）
    for (const t of ts) { const r = relPath(t.path, root); if (r === null) { outside.push(slash(t.path)); continue; } if (!t.scope && allowed.has(r)) continue; for (const g of anyHit(r, L.askRead, t.scope)) if (!allowed.has(folder(g))) guarded.add(folder(g)); }
    if (outside.length) return res('ask', '要读仓库之外的位置', {kind: 'read', paths: outside});
    if (guarded.size) return res('ask', '读取前先问的文件夹', {kind: 'read', paths: ts.map(t => relPath(t.path, root)), folders: [...guarded]});
    return res('default', '', {kind: 'read'});
  }
  if (WRITE_TOOLS.has(tool)) {
    if (mode === 'read') return res('deny', '这一段对话是只读的', {kind: 'write'});
    const ts = targets(tool, input).map(t => relPath(t.path, root));
    if (ts.some(r => r === null)) return res('deny', '不能改仓库之外的文件', {kind: 'write'});
    const blocked = ts.flatMap(r => anyHit(r, L.noWrite, false));
    if (blocked.length) return res('deny', `“${folder(blocked[0])}”在不能改的名单里`, {kind: 'write', paths: ts});
    if (mode === 'auto' && ts.length && ts.every(r => anyHit(r, L.autoWrite, false).length)) return res('allow', '允许直接改的文件夹', {kind: 'write', paths: ts});
    return res('ask', '改文件前先确认', {kind: 'write', paths: ts});
  }
  if (SHELL_TOOLS.has(tool)) {
    if (mode === 'read') return res('deny', '这一段对话是只读的，不运行命令', {kind: 'shell'});
    const cmd = slash(input.command || ''), lower = cmd.toLowerCase();
    const named = [...L.askRead, ...L.noWrite].map(folder).filter(f => lower.includes(f.replace(/\/$/, '').toLowerCase()));
    return res('ask', named.length ? `命令里提到了受保护的位置：${named.join('、')}` : '运行命令前先确认', {kind: 'shell', folders: named});
  }
  return res('default', '', {kind: 'other'});
}
