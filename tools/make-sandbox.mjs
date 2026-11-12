// 生成沙盒仓库 sandbox-vault/（虚构数据，可以随时删掉重建）。只写这个目录，不碰任何真实仓库。
//   node tools/make-sandbox.mjs           重建笔记（保留 .obsidian 里的插件文件）
//   node tools/make-sandbox.mjs --notes N  另外生成 N 篇填充笔记，用来测大仓库下的性能
//   node tools/make-sandbox.mjs --total N  生成合计 N 篇笔记
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fillSandbox, sandboxFiles} from './sandbox-spec.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = path.join(root, 'sandbox-vault');
const extraAt = process.argv.indexOf('--notes');
const totalAt = process.argv.indexOf('--total');
const files = new Map(Object.entries(sandboxFiles()));
const extra = totalAt > 0 ? Number(process.argv[totalAt + 1]) - files.size : extraAt > 0 ? Number(process.argv[extraAt + 1]) : 0;
if (!Number.isSafeInteger(extra) || extra < 0) throw new Error('笔记数量无效');
fillSandbox(files, extra);

for (const entry of fs.existsSync(vault) ? fs.readdirSync(vault) : []) if (entry !== '.obsidian') fs.rmSync(path.join(vault, entry), {recursive: true, force: true});
for (const [rel, text] of files) { const p = path.join(vault, rel); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, text); }
const obs = path.join(vault, '.obsidian');
fs.mkdirSync(path.join(obs, 'plugins'), {recursive: true});
fs.writeFileSync(path.join(obs, 'community-plugins.json'), JSON.stringify(['tideline']));
// 插件设置：把时钟固定在原型的那一刻，画面才能和原型截图比对
fs.mkdirSync(path.join(obs, 'plugins/tideline'), {recursive: true});
fs.writeFileSync(path.join(obs, 'plugins/tideline/data.json'), JSON.stringify({clock: {date: '2026-10-29', time: '13:29'}}, null, 2));
console.log('沙盒仓库：', vault, '笔记', files.size, '篇');
