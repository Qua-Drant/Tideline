// 查被吃掉反斜杠的写法（这台机器的 Bash heredoc 会吃掉反斜杠，0.9.3 审计发现过 /s+/g）：
// 正则字面量里在“记号开头”出现的 s+ / s* / d+ / d{ / w+ 等（前面不是反斜杠），以及 split 等的参数是单个 'n'（本该是换行）一类。
// 查 src/、tools/、test/（不含 src/draw/proto/vendor/；私有的 dev/ 不再查）。  node test/check-escapes.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'tools', 'test'];
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => { const p = path.join(d, e.name); if (e.isDirectory()) return p.includes(path.join('proto', 'vendor')) ? [] : walk(p); return /\.(js|mjs|ts)$/.test(p) ? [p] : []; }); // 逐步转 TypeScript：.ts（含 .d.ts）也查
const LIT = /(?<=[=(,:!&|?{};\[]\s*|return\s+)\/(?![*\/])((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^\/\\\n\[])+)\/([dgimsuy]*)/g;
const BAD = /(?:^|[(|^\[]|\?:)(?:[sdwSDW](?:[+*?]|\{\d)|[nt](?:[+*]|\{\d))/;
const STR = /(?:split|join|includes|indexOf|lastIndexOf|startsWith|endsWith|replace|replaceAll)\(\s*(['"])[nrt]\1/;
const hits = [];
for (const f of DIRS.flatMap(d => walk(path.join(root, d)))) fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
  for (const m of line.matchAll(LIT)) if (BAD.test(m[1].replace(/\\./g, '__'))) hits.push(`${path.relative(root, f)}:${i + 1}  /${m[1]}/${m[2]}`);
  const s = STR.exec(line); if (s) hits.push(`${path.relative(root, f)}:${i + 1}  ${s[0]}`);
});
// 自检：确认这条规则能认出原来那处错误
if (!BAD.test('s+') || BAD.test('__+')) throw new Error('check-escapes 自检失败');
if (hits.length) { console.log(hits.join('\n')); console.log(`✗ 疑似被吃掉反斜杠：${hits.length} 处`); process.exitCode = 1; }
else console.log('✓ src/、tools/、test/ 里没有疑似被吃掉反斜杠的正则或字符串');
