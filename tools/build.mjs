// 构建：
//   node tools/build.mjs              插件 → dist/（main.js、styles.css、manifest.json）
//   node tools/build.mjs --watch      同上，改动后重建
//   node tools/build.mjs --deploy <仓库路径>   构建后拷进该仓库的 .obsidian/plugins/tideline/（只用于沙盒仓库）
// 有私有测试目录 dev/harness/ 时，同时构建测试工具包 dev/harness/build/harness.js：把 'obsidian' 换成 dev/harness/obsidian-shim.js，
// 在普通浏览器里挂插件视图，供截图比对与性能测量。公开仓库没有 dev/，跳过。
// 插件入口：src/main.ts 存在就用它，否则 src/main.js（逐步转 TypeScript 期间）。
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 构建前先核对风景素材的描述数据（src/draw/proto/asset-shapes.js）是否与 assets.js 一致：素材改了却忘了重新生成时，构建失败
const shapesCheck = spawnSync(process.execPath, [path.join(root, 'tools/make-asset-shapes.mjs'), '--check'], {cwd: root, stdio: 'inherit'});
if (shapesCheck.status !== 0) { console.error('构建中止：asset-shapes.js 需要重新生成（node tools/make-asset-shapes.mjs）'); process.exit(1); }
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const deployAt = process.argv.indexOf('--deploy');
const deployTo = deployAt > 0 ? process.argv[deployAt + 1] : null;
const harness = path.join(root, 'dev/harness');
const hasHarness = () => fs.existsSync(path.join(harness, 'entry.js'));
const pluginEntry = fs.existsSync(path.join(root, 'src/main.ts')) ? path.join(root, 'src/main.ts') : path.join(root, 'src/main.js');

const STYLE_FILES = ['fonts.css', 'reset.css', 'prototype.css', 'container.css', 'narrow.css', 'ai.css'];

function licenseBanner(files){
  const notices = files.map(([name, file]) => name + '\n' + fs.readFileSync(path.join(root, file), 'utf8').trim());
  return '/*!\n' + notices.join('\n\n').replace(/\*\//g, '* /') + '\n*/';
}
const projectLicense = ['Tideline', 'LICENSE'];
const scriptLicense = licenseBanner([projectLicense,
  ['perfect-freehand', 'licenses/perfect-freehand.txt'], ['marked', 'licenses/marked.txt'],
  ['Noto Sans SC (字形骨架)', 'licenses/Noto-Sans-CJK.txt']]);
const styleLicense = licenseBanner([projectLicense, ['IBM Plex Mono', 'licenses/IBM-Plex-Mono.txt']]);
function writeStyles(){
  const css = STYLE_FILES.map(f => {
    const p = path.join(root, 'src/styles', f);
    return fs.existsSync(p) ? `/* ===== ${f} ===== */\n` + fs.readFileSync(p, 'utf8') : '';
  }).join('\n');
  fs.writeFileSync(path.join(dist, 'styles.css'), styleLicense + '\n' + css);
  if (!hasHarness()) return; // 公开仓库不带测试工具包
  fs.mkdirSync(path.join(harness, 'build'), {recursive: true});
  fs.writeFileSync(path.join(harness, 'build/styles.css'), css);
}
function copyStatic(){
  fs.mkdirSync(dist, {recursive: true});
  fs.copyFileSync(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));
  writeStyles();
}
function deploy(){
  if(!deployTo) return;
  if(!fs.existsSync(path.join(deployTo, '.obsidian'))) throw new Error('不是 Obsidian 仓库：' + deployTo);
  if(!/sandbox/i.test(deployTo)) throw new Error('只部署到沙盒仓库（路径里要有 sandbox）：' + deployTo);
  const target = path.join(deployTo, '.obsidian/plugins/tideline');
  fs.mkdirSync(target, {recursive: true});
  for(const f of ['main.js', 'styles.css', 'manifest.json']) fs.copyFileSync(path.join(dist, f), path.join(target, f));
  console.log('已部署到', target);
}

// 赞赏码随插件打包，仍只需发布原来的三个文件。
const wechatQr = {};
for (const [theme, variant] of [['paper', 'light'], ['night', 'dark']]) {
  const file = path.join(root, 'docs/media', `wechat-sponsor-${variant}.jpg`);
  if (fs.existsSync(file)) wechatQr[theme] = 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
}
// tsconfig.json 只给 tsc / ESLint 做类型检查用。esbuild 会自动读它（strict 会让产物开头多一行 "use strict"），
// 这里给一份空配置，让打包结果不受它影响。
const common = {bundle: true, target: 'es2022', logLevel: 'warning', sourcemap: false, legalComments: 'none', tsconfigRaw: '{}',
  define: {__TIDELINE_WECHAT_QR__: JSON.stringify(wechatQr)}};
const pluginOpts = {...common, banner: {js: scriptLicense}, entryPoints: [pluginEntry], outfile: path.join(dist, 'main.js'), format: 'cjs', platform: 'node', // node：AI 助手要用 child_process 启动 claude（插件只在电脑上加载）
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'], minify: false};
// 0.9.4：去掉了 0.2 打包 Claude Agent SDK 时的三处兼容（import.meta.url 换成文件地址、全局 setTimeout / clearTimeout 换成 Node 计时器、
// 改写 events.setMaxListeners）。0.3 起不再打包 SDK，src/ 里没有代码用 import.meta、.unref() 或 setMaxListeners；计时器回到浏览器的。
const harnessOpts = {...common, entryPoints: [path.join(harness, 'entry.js')], outfile: path.join(harness, 'build/harness.js'), format: 'esm', platform: 'browser',
  alias: {obsidian: path.join(harness, 'obsidian-shim.js')}};

const after = {name: 'after', setup(b){ b.onEnd(r => { if(!r.errors.length){ copyStatic(); try{ deploy(); }catch(e){ console.error(e.message); } console.log(new Date().toLocaleTimeString(), '构建完成'); } }); }};

if(watch){
  const a = await esbuild.context({...pluginOpts, plugins: [after]});
  const b = hasHarness() ? await esbuild.context(harnessOpts) : null;
  await a.watch(); await b?.watch();
  console.log('监听中…');
}else{
  copyStatic();
  await esbuild.build(pluginOpts);
  if(hasHarness()) await esbuild.build(harnessOpts);
  copyStatic(); deploy();
  console.log('构建完成：', fs.statSync(path.join(dist, 'main.js')).size, 'bytes main.js,', fs.statSync(path.join(dist, 'styles.css')).size, 'bytes styles.css');
}
