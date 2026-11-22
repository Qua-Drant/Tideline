// 版本同步：把 package.json 的版本写进 manifest.json，并在 versions.json 登记 版本 → manifest 的 minAppVersion。
// 由 npm version 的 "version" 生命周期钩子调用（package.json scripts.version），不要单独改三个文件的版本号：
//   npm version 0.9.8        改 package.json → 本脚本同步两个 JSON → git add → npm 提交并打标签
// 也可以单独跑：node tools/version-bump.mjs（读 package.json 的版本）。两个 JSON 保持两格缩进、末尾换行，原来是 CRLF 的保持 CRLF。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, obj, old) => fs.writeFileSync(path.join(root, f), (JSON.stringify(obj, null, 2) + '\n').replace(/\n/g, old.includes('\r\n') ? '\r\n' : '\n'));
const version = process.env.npm_package_version || JSON.parse(read('package.json')).version;
if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error('版本号无效：' + version);
const manifestText = read('manifest.json'), versionsText = read('versions.json');
const manifest = JSON.parse(manifestText), versions = JSON.parse(versionsText);
manifest.version = version;
versions[version] = manifest.minAppVersion;
write('manifest.json', manifest, manifestText);
write('versions.json', versions, versionsText);
console.log(`manifest.json ${version}；versions.json ${version} → ${manifest.minAppVersion}`);
