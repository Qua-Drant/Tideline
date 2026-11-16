// 生成 src/draw/proto/asset-shapes.js：把 assets.js 里风景要用的 SVG 素材写成描述数据（src/draw/scene.ts 的 Shape：{t, a, k}），
// 风景直接按描述建节点，运行时不再解析 SVG 字符串。assets.js 不动（还有页面模板按字符串用它）。
//   node tools/make-asset-shapes.mjs           重新生成
//   node tools/make-asset-shapes.mjs --check   只检查现有文件是否与素材一致（不写文件；不一致时退出码 1）。tools/build.mjs 构建前会跑它
// 素材的写法很规整（只有元素、双引号属性、自闭合标签，没有文字、注释与实体）；遇到别的写法就报错停下，不猜。
// 生成后把描述按同样的写法拼回字符串，与原素材逐字比较，不一致也报错。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assets} from '../src/draw/proto/assets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = ['lighthouse-off']; // 风景用到的素材（思索页的灯塔）

function read(src){
  let i = 0;
  const fail = what => { throw new Error(`素材写法超出预期（${what}，位置 ${i}）：${src.slice(i, i + 60)}`); };
  const list = () => {
    const out = [];
    while (i < src.length && src.startsWith('<', i) && !src.startsWith('</', i)) {
      const m = /^<([a-zA-Z][\w-]*)/.exec(src.slice(i)); if (!m) fail('标签');
      i += m[0].length; const a = {};
      for (;;) {
        const at = /^\s+([a-zA-Z_:][\w:.-]*)="([^"<&]*)"/.exec(src.slice(i));
        if (!at) break;
        if (at[1] in a) fail('重复的属性');
        a[at[1]] = at[2]; i += at[0].length;
      }
      if (src.startsWith('/>', i)) { i += 2; out.push({t: m[1], a, k: []}); continue; }
      if (!src.startsWith('>', i)) fail('属性');
      i++; const k = list();
      if (!src.startsWith(`</${m[1]}>`, i)) fail('结束标签');
      i += m[1].length + 3; out.push({t: m[1], a, k});
    }
    return out;
  };
  const out = list(); if (i !== src.length) fail('多余的内容');
  return out;
}
const write = list => list.map(s => `<${s.t}${Object.entries(s.a).map(([k, v]) => ` ${k}="${v}"`).join('')}${s.k.length ? `>${write(s.k)}</${s.t}>` : '/>'}`).join('');

const shapes = {};
for (const name of NAMES) {
  const src = assets[name]; if (typeof src !== 'string') throw new Error('assets.js 里没有 ' + name);
  const list = read(src); if (write(list) !== src) throw new Error(name + '：拼回去与原素材不一致');
  shapes[name] = list;
}
const file = path.join(root, 'src/draw/proto/asset-shapes.js');
const content = `// 由 tools/make-asset-shapes.mjs 从 assets.js 生成，不要手改：风景用到的 SVG 素材写成描述（src/draw/scene.ts 的 Shape）。\nexport const assetShapes=${JSON.stringify(shapes)};\n`;
if (process.argv.includes('--check')) {
  // 只比较、不写文件：与现有的 asset-shapes.js 逐字比较，不一致时以非零退出（tools/build.mjs 构建前调用）。
  // 换行符不算差异（Windows 上 git 检出时可能换成 \r\n）
  const rel = path.relative(root, file).split(path.sep).join('/');
  const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (now !== content) {
    console.error(`${rel} 与 assets.js 不一致（${now === null ? '文件不存在' : '素材或生成规则改过之后没有重新生成'}）。请运行 node tools/make-asset-shapes.mjs 重新生成后再构建。`);
    process.exit(1);
  }
  console.log(rel, '与 assets.js 一致');
} else {
  fs.writeFileSync(file, content);
  console.log('已生成', path.relative(root, file), Object.keys(shapes).join('、'), fs.statSync(file).size, '字节');
}
