// npm test：跑 test/run.mjs（8 个纯 Node 检查）。浏览器与真实 Obsidian 检查是私有工具，不在 npm test 里。
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, [path.join(root, 'test/run.mjs')], {stdio: 'inherit', cwd: root});
process.exitCode = r.status ?? 1;
