// npm test：私有测试目录 dev/ 在就跑 dev/tools/test.mjs；公开仓库没有 dev/，打印一句说明后正常退出。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeline = spawnSync(process.execPath, [path.join(root, 'tools/test-timeline-labels.mjs')], {stdio: 'inherit', cwd: root});
if (timeline.status !== 0) process.exit(timeline.status ?? 1);
const runner = path.join(root, 'dev/tools/test.mjs');
if (!fs.existsSync(runner)) {
  console.log('没有 dev/tools/test.mjs：测试工具不随公开仓库发布，跳过。');
} else {
  const r = spawnSync(process.execPath, [runner], {stdio: 'inherit', cwd: root});
  process.exitCode = r.status ?? 1;
}
