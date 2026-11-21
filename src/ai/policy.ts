// AI 每次要用工具之前，插件按这里决定：直接放行（default，交给 Claude Code 的默认规则）、允许（allow）、先问你（ask）、拒绝（deny）。
// 纯函数，不碰界面和文件。
// 三张名单（潮线/配置.md 的 ai 属性）：askRead 读取前先问、noWrite 不能改、autoWrite 允许直接改（只在“自动接受改动”这一档生效）。
// 三档权限：read 只读、confirm 改前确认（默认）、auto 自动接受改动。不提供“全部放行”。
import type {PolicyLists} from '../data/types.ts';
import {looseString} from '../data/frontmatter.ts';
import type {PermissionMode, PolicyResult, ToolInput} from './types.ts';

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

const slash = (s: unknown): string => looseString(s || '').replace(/\\/g, '/');
const folder = (s: unknown): string => { const x = slash(s).replace(/^\.?\//, ''); return x; };

// 配置目录用仓库的 app.vault.configDir（来源的 configDir），不写死：使用者可以改它的名字。
// 不知道配置目录时（来源没给）就不列它——Obsidian 里来源总会给（source-obsidian.ts）；DEFAULT_LISTS 只是没有配置笔记时的兜底，同样不列
export function defaultLists(configDir?: string): PolicyLists{
  const dir = folder(configDir).replace(/\/+$/, '');
  return {askRead: ['日记/', '人物/'], noWrite: dir ? [dir + '/', '潮线/配置.md'] : ['潮线/配置.md'], autoWrite: []};
}
export const DEFAULT_LISTS = defaultLists();

// 仓库里的相对路径；在仓库外返回 null。Windows 上不分大小写
export function relPath(p: string | null | undefined, root: string): string | null{
  if (p === undefined || p === null || p === '') return '';
  const r = slash(root).replace(/\/+$/, ''), x = slash(p);
  const abs = /^([a-zA-Z]:\/|\/)/.test(x) ? x : r + '/' + x;
  const parts: string[] = []; for (const seg of abs.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.' && seg !== '') parts.push(seg); }
  const norm = (/^[a-zA-Z]:/.test(parts[0] || '') ? '' : '/') + parts.join('/'), rr = (/^[a-zA-Z]:/.test(r) ? '' : '') + r;
  const lower = (s: string) => s.toLowerCase();
  if (lower(norm) === lower(rr)) return '';
  if (lower(norm).startsWith(lower(rr) + '/')) return norm.slice(rr.length + 1);
  return null;
}
// 一个名单项（文件夹以 / 结尾，或单个文件）是否覆盖 p；scope=true 时，p 是“要搜索的范围”，范围包含了名单项也算
function hits(p: string, item: string, scope: boolean): boolean{
  const it = folder(item), a = p.toLowerCase(), b = it.toLowerCase();
  if (b.endsWith('/')) return a === b.slice(0, -1) || a.startsWith(b) || (scope && (a === '' || b.startsWith(a.replace(/\/?$/, '/'))));
  return a === b || (scope && (a === '' || b.startsWith(a.replace(/\/?$/, '/'))));
}
const anyHit = (p: string, list: string[], scope: boolean) => list.filter(item => hits(p, item, scope));

// 这次调用会碰到哪些路径；scope 表示是搜索范围（目录），不是单个文件
export function targets(tool: string, input: ToolInput): {path: string; scope: boolean}[]{
  const out: {path: string; scope: boolean}[] = [];
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

export function decide({tool, input = {}, root, lists = DEFAULT_LISTS, mode = 'confirm', allowed = new Set()}: {
  tool: string; input?: ToolInput; root: string; lists?: Partial<PolicyLists>; mode?: PermissionMode; allowed?: Set<string>;
}): PolicyResult{
  const L = {askRead: lists.askRead || [], noWrite: lists.noWrite || [], autoWrite: lists.autoWrite || []};
  const res = (decision: PolicyResult['decision'], reason: string, extra: Partial<PolicyResult> = {}): PolicyResult => ({decision, reason, ...extra});
  if (tool.startsWith('mcp__')) return res('ask', '使用外部工具（MCP）', {kind: 'other'});
  if (READ_TOOLS.has(tool)) {
    const ts = targets(tool, input), outside: string[] = [], guarded = new Set<string>();
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
    const blocked = ts.flatMap(r => anyHit(r as string, L.noWrite, false));
    if (blocked.length) return res('deny', `“${folder(blocked[0])}”在不能改的名单里`, {kind: 'write', paths: ts});
    if (mode === 'auto' && ts.length && ts.every(r => anyHit(r as string, L.autoWrite, false).length)) return res('allow', '允许直接改的文件夹', {kind: 'write', paths: ts});
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
