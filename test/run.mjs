// npm test 的入口：8 个纯 Node 检查（不需要浏览器、不需要本地服务），逐个跑，任何一个失败就整体失败。
// 检查直接 import src/ 的 .ts（Node 的类型剥离，需要 Node 22.18+ / 24）。都以仓库根为工作目录：node test/run.mjs，或单跑 node test/check-xxx.mjs。
// 浏览器检查与真实 Obsidian 检查不在这里（私有工具，不随公开仓库发布）。
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECKS = [
  'check-escapes.mjs',      // 被吃掉反斜杠的正则（P2-2）
  'check-frontmatter.mjs',  // 属性块切分、CRLF（P1-1）
  'check-persist.mjs',      // 写回：配置快照、部分失败重试、跨午夜（P2-1）、显式删除（P2-10）
  'check-complete.mjs',     // 完成任务的变更，今日页与任务页一致（P1-2）
  'check-model.mjs',        // 笔记 → 数据
  'check-ical.mjs',         // iCal 解析与展开（fixtures/test.ics）
  'check-ai-policy.mjs',    // AI 权限逻辑
  'check-ai-markdown.mjs',  // AI 回答渲染（P2-3）
];
const failed = [];
for (const name of CHECKS) {
  console.log(`\n—— ${name}`);
  const r = spawnSync(process.execPath, [path.join(here, name)], {stdio: 'inherit', cwd: path.join(here, '..')});
  if (r.status !== 0) failed.push(name);
}
console.log(failed.length ? `\n✗ 失败：${failed.join('、')}` : `\n✓ ${CHECKS.length} 个检查全部通过`);
process.exitCode = failed.length ? 1 : 0;
