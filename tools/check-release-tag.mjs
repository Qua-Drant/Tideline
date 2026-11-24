// 发版前核对：tag（去掉 v 前缀）== manifest.json.version == package.json.version，且 versions.json 登记了这个版本。
// .github/workflows/release.yml 用它；本机也可以跑：node tools/check-release-tag.mjs v0.9.7
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';
const version = tag.replace(/^v/, '');
const manifest = read('manifest.json'), pkg = read('package.json'), versions = read('versions.json');
const errors = [];
if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`tag “${tag}” 不是 x.y.z 或 vx.y.z`);
if (manifest.version !== version) errors.push(`manifest.json 的 version 是 ${manifest.version}，tag 是 ${version}`);
if (pkg.version !== version) errors.push(`package.json 的 version 是 ${pkg.version}，tag 是 ${version}`);
if (!Object.hasOwn(versions, version)) errors.push(`versions.json 没有登记 ${version}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✓ tag ${tag}：manifest.json、package.json、versions.json 一致（minAppVersion ${versions[version]}）`);
}
