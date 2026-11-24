// P2-3 回归：AI 回答的渲染只保留 http(s):、mailto:、# 链接，原始 HTML 转义，图片不自动加载。纯 Node，不开浏览器。
// 第 4b 期：渲染改成直接建节点（answerNodes），这里在一个只认 createElement / createTextNode / setAttribute / appendChild 的小假 DOM 里建，
// 断言的意思不变，只把“查字符串”改成“查节点”（元素、属性值、文字）。
import assert from 'node:assert/strict';

// —— 小假 DOM（只给 dom.ts 与 markdown.ts 用）——
class FNode { constructor(t, doc){ this.nodeType = t; this.childNodes = []; this.ownerDocument = doc; } get lastChild(){ return this.childNodes.at(-1) || null; }
  appendChild(c){ if (c.nodeType === 11) { for (const x of c.childNodes) this.childNodes.push(x); c.childNodes = []; } else this.childNodes.push(c); return c; } }
class FEl extends FNode { constructor(tag, doc){ super(1, doc); this.localName = tag; this.attrs = new Map(); } setAttribute(k, v){ this.attrs.set(k, String(v)); } getAttribute(k){ return this.attrs.get(k) ?? null; } }
class FText extends FNode { constructor(s, doc){ super(3, doc); this.data = s; } appendData(s){ this.data += s; } }
const doc = {createElement: t => new FEl(t, doc), createElementNS: (_, t) => new FEl(t, doc), createTextNode: s => new FText(s, doc), createDocumentFragment: () => new FNode(11, doc)};
globalThis.window = {document: doc};
const {answerNodes} = await import('../src/ai/markdown.ts');

const els = n => n.childNodes.flatMap(c => c.nodeType === 1 ? [c, ...els(c)] : []);
const text = n => n.childNodes.map(c => c.nodeType === 3 ? c.data : text(c)).join('');
const md = s => answerNodes(s);
const tags = (n, re) => els(n).filter(e => re.test(e.localName));
const hrefs = n => els(n).filter(e => e.getAttribute('href') !== null).map(e => e.getAttribute('href'));

let n = 0; const ok = msg => { n++; console.log('✓', msg); };
assert.deepEqual(hrefs(md('[网页](https://example.com/a?b=1&c=2) [信](mailto:a@b.c) [锚](#x)')), ['https://example.com/a?b=1&c=2', 'mailto:a@b.c', '#x']);
assert(tags(md('[网页](https://example.com)'), /^a$/).every(a => a.getAttribute('rel') === 'noopener noreferrer'));
ok('http(s)、mailto、# 链接保留，加 rel=noopener');
for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///C:/x', 'obsidian://open?vault=x', 'vbscript:x', '/relative', 'zotero://select/x']) {
  const out = md(`[点我](${bad})`);
  assert(!tags(out, /^a$/).length, bad + ' → ' + text(out)); assert(text(out).includes('点我'));
}
assert(!tags(md('<javascript:alert(1)>'), /^a$/).length);
assert(!hrefs(md('[x][r]\n\n[r]: javascript:alert(1)')).some(h => /^javascript/i.test(h)));
ok('javascript:、data:、file:、obsidian:、相对路径等链接只留文字（含引用式链接、尖括号自动链接）');
const img = md('![猫](https://example.com/cat.png) ![本地](file:///C:/a.png) ![](data:image/png;base64,AAAA)');
assert(!tags(img, /^img$/).length, text(img));
assert(hrefs(img).includes('https://example.com/cat.png') && text(img).includes('[图片：猫]') && text(img).includes('[图片：本地]'));
assert.equal(hrefs(img).length, 1);
ok('图片不生成 <img>：http(s) 图片变成可点的“[图片：说明]”，其它只留文字');
const raw = md('<img src=x onerror=alert(1)> <script>alert(1)</script> <a href="javascript:x">a</a>');
assert(!tags(raw, /^(img|script|a)$/).length, text(raw));
assert(text(raw).includes('<img src=x onerror=alert(1)>') && text(raw).includes('<script>'));
ok('原始 HTML 一律转义');
assert(tags(md('**粗** `code`\n\n- 一\n- 二'), /^strong$/).some(e => text(e) === '粗'));
ok('普通 Markdown 照常渲染');
console.log(`check-ai-markdown：${n} 项通过`);
