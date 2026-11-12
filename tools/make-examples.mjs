// 生成示例航程（首次起航里“装一套示例航程”）：取沙盒仓库的笔记（原型的虚构数据），每篇加上 example 标签，写成 src/data/examples.js。
// 日期以 EXAMPLE_DATE 为准；安装时插件把所有日期整体平移到“今天”。配置笔记另外处理（只在仓库还没有配置笔记时写）。
//   node tools/make-examples.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sandboxFiles, TODAY} from './sandbox-spec.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = sandboxFiles(), out = {};
for (const [p, text] of Object.entries(files)) {
  // 往年的日记（往年今日）也平移，所以照样收进来；配置笔记单独存
  // 已经有 tags（想法笔记）就并进去，没有就加一行
  const tagged = /^tags: \[(.*)\]$/m.test(text) ? text.replace(/^tags: \[(.*)\]$/m, (_, t) => `tags: [example, ${t}]`) : text.replace(/^---\n/, '---\ntags: [example]\n');
  out[p] = p === '潮线/配置.md' ? text : tagged;
}
fs.writeFileSync(path.join(root, 'src/data/examples.js'), `// 由 tools/make-examples.mjs 生成，不要手改。示例航程的笔记（原型的虚构数据，带 example 标签）。\nexport const EXAMPLE_DATE = ${JSON.stringify(TODAY)};\nexport const EXAMPLES = ${JSON.stringify(out)};\n`);
console.log('示例笔记', Object.keys(out).length, '篇，', (fs.statSync(path.join(root, 'src/data/examples.js')).size / 1024).toFixed(0) + 'KB');
