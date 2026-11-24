// 权限判定的测试（不启动 claude，不花用量）。  node test/check-ai-policy.mjs
import {decide} from '../src/ai/policy.ts';
// 路径都是虚构的盘符（X: 是仓库所在盘，Y: 是仓库外的另一盘），只为测 Windows 写法的判定。
const root = 'X:\\Vault';
const cases = [
  // [说明, 工具, 输入, 权限档, 期望, 这次对话已允许的文件夹]
  ['读普通笔记', 'Read', {file_path: 'X:\\Vault\\想法\\a.md'}, 'confirm', 'default'],
  ['读日记要先问', 'Read', {file_path: 'X:\\Vault\\日记\\2026-10-29.md'}, 'confirm', 'ask'],
  ['读日记：大小写、斜杠不同也拦', 'Read', {file_path: 'x:/vault/日记/x.md'}, 'confirm', 'ask'],
  ['读日记：这次对话已允许', 'Read', {file_path: 'X:\\Vault\\日记\\x.md'}, 'confirm', 'default', ['日记/']],
  ['相对路径绕到日记', 'Read', {file_path: '想法/../日记/x.md'}, 'confirm', 'ask'],
  ['读仓库外', 'Read', {file_path: 'Y:\\home\\.ssh\\id_rsa'}, 'confirm', 'ask'],
  ['整库搜索会经过日记', 'Grep', {pattern: '方法'}, 'confirm', 'ask'],
  ['只在想法里搜索', 'Grep', {pattern: '方法', path: '想法'}, 'confirm', 'default'],
  ['在日记里搜索', 'Grep', {pattern: '方法', path: 'X:\\Vault\\日记'}, 'confirm', 'ask'],
  ['Glob 模式指向日记', 'Glob', {pattern: '日记/**/*.md'}, 'confirm', 'ask'],
  ['Glob 模式指向想法', 'Glob', {pattern: '想法/*.md'}, 'confirm', 'default'],
  ['Glob 整库', 'Glob', {pattern: '**/*.md'}, 'confirm', 'ask'],
  ['写想法要确认', 'Write', {file_path: 'X:\\Vault\\想法\\b.md', content: 'x'}, 'confirm', 'ask'],
  ['只读档不能写', 'Edit', {file_path: 'X:\\Vault\\想法\\b.md'}, 'read', 'deny'],
  ['不能改配置', 'Edit', {file_path: 'X:\\Vault\\潮线\\配置.md'}, 'auto', 'deny'],
  ['不能改 .obsidian', 'Write', {file_path: 'X:\\Vault\\.obsidian\\app.json'}, 'confirm', 'deny'],
  ['不能写仓库外', 'Write', {file_path: 'Y:\\temp\\x.md'}, 'confirm', 'deny'],
  ['自动档但不在允许名单：仍要确认', 'Write', {file_path: 'X:\\Vault\\想法\\b.md'}, 'auto', 'ask'],
  ['自动档、在允许名单', 'Write', {file_path: 'X:\\Vault\\收件箱\\b.md'}, 'auto', 'allow'],
  ['命令一律确认', 'Bash', {command: 'ls'}, 'auto', 'ask'],
  ['只读档不运行命令', 'Bash', {command: 'ls'}, 'read', 'deny'],
  ['外部工具要问', 'mcp__x__y', {}, 'confirm', 'ask'],
  ['网页搜索交给默认规则', 'WebSearch', {query: 'x'}, 'confirm', 'default'],
];
let bad = 0;
for (const [name, tool, input, mode, want, allowed = []] of cases) {
  const r = decide({tool, input, root, mode, lists: {askRead: ['日记/', '人物/'], noWrite: ['.obsidian/', '潮线/配置.md'], autoWrite: ['收件箱/']}, allowed: new Set(allowed)});
  const ok = r.decision === want; if (!ok) bad++;
  console.log(ok ? '✓' : '✗', name.padEnd(18), r.decision, r.reason ? '｜' + r.reason : '', ok ? '' : `（期望 ${want}）`);
}
const shell = decide({tool: 'Bash', input: {command: 'cat 日记/2026-10-29.md'}, root, mode: 'confirm'});
console.log(shell.folders?.includes('日记/') ? '✓' : '✗', '命令里提到日记，卡片上写明', shell.reason); if (!shell.folders?.includes('日记/')) bad++;
console.log(bad ? `失败 ${bad} 项` : '全部通过'); process.exitCode = bad ? 1 : 0;
