// AI 回答的 Markdown 渲染（P2-3）。和任务正文（原型 paper-task-markdown.js）一样：
//   - 原始 HTML 一律转义成文字；
//   - 链接只保留 http(s):、mailto:、# 开头的，其它（javascript:、data:、file:、obsidian:、相对路径……）只留文字；
//   - 图片不自动加载：http(s) 图片换成可点的“[图片：说明]”链接，别的只留“[图片：说明]”文字。
// 第 4b 期：不再生成 HTML 字符串（原来是 marked.parse + 覆盖 Renderer 的 html / link / image，再整段 innerHTML）。
// 现在用 marked 的词法分析（marked.lexer 同一套选项：gfm、breaks）得到记号，逐个记号直接建节点，建出的 DOM 与原来的字符串交给浏览器解析后的结果一致：
//   - 每种记号照 marked 默认渲染器（v17）的写法：标签、属性及其先后、块与块之间的 "\n" 文本节点、任务列表的勾选框（checked、disabled、type）、
//     表格的 align、有序列表的 start、代码块的 language- 类名；
//   - 原来字符串里的转义与字符引用交给 html-text.ts 照解析器的规矩处理（例如 &copy; 解成 ©、CR 换成 LF、去掉 NUL）；
//   - 原来的字符串是“标签流”，解析器建树时有几处并不按字面嵌套：链接文字里又有链接（含 http 图片换成的链接）时，<a> 里的 <a> 会被拆开
//     （adoption agency），被拆开的 strong / em / code 在后面重建。这里用一个只认本模块会建出的那几种元素的小“树构建器”照做（Tree，见下）。
//   原来唯一做不到一致的情形：marked 在原始的 <code> / <pre> / <kbd> / <script> 标签之后给出“不转义”的文字（escaped: true），
//   这段文字里若有“<字母”“</”“<!”“<?”，原来会被浏览器当成标签解析（原始 HTML 并没有全部成为文字，是原来的漏洞：流式输出到一半的
//   “<code>x <img src=x onerror=…”就会建出真的 <img>）；现在一律是文字。流式时常见的是半截结束标签（“<kbd>Ctrl</kb”），原来会吞掉段落后的换行。
import {Lexer, marked} from '../draw/proto/vendor/marked.mjs';
import {frag, h} from '../draw/dom.ts';
import {htmlText, htmlAttr, plainText, plainAttr} from './html-text.ts';

/** marked 的记号里我们用到的几项（marked 是原样打包的第三方 JS，没有类型声明；记号按这个最小接口看） */
interface Token {
  type: string; text?: string; tokens?: Token[]; escaped?: boolean;
  depth?: number; lang?: string; ordered?: boolean; start?: number | ''; items?: {tokens: Token[]}[]; checked?: boolean;
  header?: Cell[]; rows?: Cell[][]; href?: string | null; title?: string | null;
}
interface Cell { tokens: Token[]; header: boolean; align: string | null }
type Attr = [name: string, value: string];

const SAFE_LINK = /^(https?:|mailto:|#)/i;
// marked 的 escape(…, false)：字符引用模样的 &…; 留着（交给浏览器解码），其余 & < > " ' 转义
const NO_ENCODE = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const escNoEncode = (s: string) => s.replace(NO_ENCODE, c => ESC[c]);

// —— 树构建器：把原来的“标签流”照 HTML 解析器（in body 等插入模式）的规矩建成树，只认本模块会建出的元素 ——
/** 活动格式元素表里的一项（null 是表格单元格放的标记） */
interface Entry { tag: string; attrs: Attr[]; el: Element }
interface Open { tag: string; el: Node }
// 本模块会建出的元素里，标准规定的“格式元素”只有这四种（del 不是）
const FORMATTING = new Set(['a', 'strong', 'em', 'code']);
// 插入前先“重建活动格式元素”的（行内的几种；块级元素不重建）
const RECONSTRUCT = new Set(['a', 'strong', 'em', 'code', 'del', 'br', 'input']);
const VOID = new Set(['br', 'hr', 'input']);
// 标准里的 special 类别（只列本模块会建出的），#root 是容器本身
const SPECIAL = new Set(['#root', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul']);
// “在作用域内”的边界（同上，只列会出现的）
const SCOPE = new Set(['#root', 'table', 'td', 'th']);
const sameAttrs = (a: Attr[], b: Attr[]) => a.length === b.length && a.every(([k, v]) => b.some(([k2, v2]) => k === k2 && v === v2));

class Tree {
  declare stack: Open[];
  declare fmt: (Entry | null)[];
  declare doc: Document;
  constructor(root: DocumentFragment){ this.stack = [{tag: '#root', el: root}]; this.fmt = []; this.doc = root.ownerDocument; }
  top(): Open { return this.stack[this.stack.length - 1]; }
  make(tag: string, attrs: Attr[]): Element {
    // 标签名都来自本模块的固定写法（h1–h6 由 depth 拼成）；h() 按名字建元素，属性按先后逐个写
    const el = h(tag as 'div'); for (const [k, v] of attrs) el.setAttribute(k, v);
    this.top().el.appendChild(el); return el;
  }
  /** 文字：并进前面紧挨着的文本节点（解析器也是这样）。table：表格里的空白（不重建格式元素） */
  text(s: string, table = false): void {
    if (!s) return;
    if (!table) this.reconstruct();
    const p = this.top().el, last = p.lastChild;
    if (last && last.nodeType === 3) (last as Text).appendData(s); else p.appendChild(this.doc.createTextNode(s));
  }
  open(tag: string, attrs: Attr[] = []): void {
    if (tag === 'a') { // 还开着一个 <a>：先按 adoption agency 关掉它
      const at = this.lastFmt('a');
      if (at >= 0) { const e = this.fmt[at]!; this.adopt('a'); this.fmt = this.fmt.filter(x => x !== e); this.stack = this.stack.filter(x => x.el !== e.el); }
    }
    if (RECONSTRUCT.has(tag)) this.reconstruct();
    const el = this.make(tag, attrs);
    if (!VOID.has(tag)) this.stack.push({tag, el});
    if (FORMATTING.has(tag)) this.pushFmt({tag, attrs, el});
    if (tag === 'td' || tag === 'th') this.fmt.push(null);
  }
  close(tag: string): void {
    if (FORMATTING.has(tag)) this.adopt(tag);
    else if (tag === 'del') this.otherEnd(tag);
    else {
      this.popUntil(tag);
      if (tag === 'td' || tag === 'th') { let i = this.fmt.length; while (i > 0 && this.fmt[i - 1] !== null) i--; this.fmt.length = Math.max(0, i - 1); }
    }
  }
  popUntil(tag: string): void {
    for (let i = this.stack.length - 1; i > 0; i--) if (this.stack[i].tag === tag) { this.stack.length = i; return; }
  }
  /** “其他结束标签”：往下找同名元素，碰到 special 元素就作罢 */
  otherEnd(tag: string): void {
    for (let i = this.stack.length - 1; i > 0; i--) {
      if (this.stack[i].tag === tag) { this.stack.length = i; return; }
      if (SPECIAL.has(this.stack[i].tag)) return;
    }
  }
  lastFmt(tag: string): number {
    for (let i = this.fmt.length - 1; i >= 0; i--) { const e = this.fmt[i]; if (e === null) return -1; if (e.tag === tag) return i; }
    return -1;
  }
  inStack(el: Element): boolean { return this.stack.some(x => x.el === el); }
  /** adoption agency。本模块建出的行内内容里格式元素之上不会有 special 元素（块级元素只在块与块之间开），所以“最远的块”总是不存在，走那一支 */
  adopt(subject: string): void {
    const cur = this.top();
    if (cur.tag === subject && !this.fmt.some(e => e !== null && e.el === cur.el)) { this.stack.pop(); return; }
    const at = this.lastFmt(subject);
    if (at < 0) { this.otherEnd(subject); return; }
    const e = this.fmt[at]!, si = this.stack.findIndex(x => x.el === e.el);
    if (si < 0) { this.fmt.splice(at, 1); return; }
    for (let i = this.stack.length - 1; i > si; i--) if (SCOPE.has(this.stack[i].tag)) return; // 不在作用域内：不理
    this.stack.length = si; this.fmt.splice(at, 1);
  }
  /** 放进活动格式元素表（“诺亚方舟”：标记之后同名同属性的已有 3 个时去掉最早的一个） */
  pushFmt(entry: Entry): void {
    const same: number[] = [];
    for (let i = this.fmt.length - 1; i >= 0; i--) { const e = this.fmt[i]; if (e === null) break; if (e.tag === entry.tag && sameAttrs(e.attrs, entry.attrs)) same.push(i); }
    if (same.length >= 3) this.fmt.splice(same[same.length - 1], 1);
    this.fmt.push(entry);
  }
  /** 重建活动格式元素：表里已不在栈上的，按原来的标签与属性再建一个接着用 */
  reconstruct(): void {
    const n = this.fmt.length; if (!n) return;
    const last = this.fmt[n - 1]; if (last === null || this.inStack(last.el)) return;
    let i = n - 1; while (i > 0) { const e = this.fmt[i - 1]; if (e === null || this.inStack(e.el)) break; i--; }
    for (; i < n; i++) {
      const e = this.fmt[i]!, el = this.make(e.tag, e.attrs);
      this.stack.push({tag: e.tag, el}); this.fmt[i] = {...e, el};
    }
  }
}

// —— 记号 → 标签流（照 marked 默认渲染器；html / link / image 照原来覆盖的写法）——
function textToken(t: Tree, k: Token): void {
  if (k.tokens) inline(t, k.tokens);
  else t.text(htmlText(k.escaped ? k.text ?? '' : escNoEncode(k.text ?? '')));
}
function checkbox(t: Tree, k: Token): void {
  t.open('input', [...(k.checked ? [['checked', ''] as Attr] : []), ['disabled', ''], ['type', 'checkbox']]); t.text(' ');
}
function inline(t: Tree, tokens: Token[]): void {
  for (const k of tokens) switch (k.type) {
    case 'escape': t.text(htmlText(escNoEncode(k.text ?? ''))); break;
    case 'html': t.text(plainText(k.text)); break; // 原始 HTML：成为文字
    case 'link': {
      const url = String(k.href ?? '').trim();
      if (!SAFE_LINK.test(url)) { inline(t, k.tokens ?? []); break; } // 不安全的链接只留文字
      t.open('a', [['href', plainAttr(url)], ...(k.title ? [['title', plainAttr(k.title)] as Attr] : []), ['rel', 'noopener noreferrer']]);
      inline(t, k.tokens ?? []); t.close('a'); break;
    }
    case 'image': {
      const url = String(k.href ?? '').trim(), label = plainText(`[图片：${k.text || k.title || url.split('/').pop() || '无说明'}]`);
      if (/^https?:/i.test(url)) { t.open('a', [['class', 'ai-image-link'], ['href', plainAttr(url)], ['rel', 'noopener noreferrer'], ['title', '点开看图（不会自动加载）']]); t.text(label); t.close('a'); }
      else t.text(label);
      break;
    }
    case 'checkbox': checkbox(t, k); break;
    case 'strong': case 'em': case 'del': t.open(k.type); inline(t, k.tokens ?? []); t.close(k.type); break;
    case 'codespan': t.open('code'); t.text(plainText(k.text)); t.close('code'); break;
    case 'br': t.open('br'); break;
    case 'text': textToken(t, k); break;
    default: throw new Error('Token with "' + k.type + '" type was not found.');
  }
}
function tableRow(t: Tree, cells: Cell[]): void {
  t.open('tr'); t.text('\n', true);
  for (const c of cells) { const tag = c.header ? 'th' : 'td'; t.open(tag, c.align ? [['align', c.align]] : []); inline(t, c.tokens); t.close(tag); t.text('\n', true); }
  t.close('tr'); t.text('\n', true);
}
function blocks(t: Tree, tokens: Token[]): void {
  for (const k of tokens) switch (k.type) {
    case 'space': case 'def': break;
    case 'hr': t.open('hr'); t.text('\n'); break;
    case 'heading': { const tag = 'h' + k.depth; t.open(tag); inline(t, k.tokens ?? []); t.close(tag); t.text('\n'); break; }
    case 'code': {
      const lang = (k.lang || '').match(/^\S*/)?.[0], body = (k.text ?? '').replace(/\n$/, '') + '\n';
      t.open('pre'); t.open('code', lang ? [['class', 'language-' + htmlAttr(escNoEncode(lang))]] : []);
      t.text(k.escaped ? htmlText(body) : plainText(body)); t.close('code'); t.close('pre'); t.text('\n'); break;
    }
    case 'table':
      t.open('table'); t.text('\n', true); t.open('thead'); t.text('\n', true); tableRow(t, k.header ?? []); t.close('thead'); t.text('\n', true);
      if (k.rows?.length) { t.open('tbody'); for (const r of k.rows) tableRow(t, r); t.close('tbody'); }
      t.close('table'); t.text('\n'); break;
    case 'blockquote': t.open('blockquote'); t.text('\n'); blocks(t, k.tokens ?? []); t.close('blockquote'); t.text('\n'); break;
    case 'list': {
      const tag = k.ordered ? 'ol' : 'ul';
      t.open(tag, k.ordered && k.start !== 1 ? [['start', String(k.start)]] : []); t.text('\n');
      for (const it of k.items ?? []) { t.open('li'); blocks(t, it.tokens); t.close('li'); t.text('\n'); }
      t.close(tag); t.text('\n'); break;
    }
    case 'checkbox': checkbox(t, k); break;
    case 'html': t.text(plainText(k.text)); break; // 原始 HTML（块级）：成为文字
    case 'paragraph': t.open('p'); inline(t, k.tokens ?? []); t.close('p'); t.text('\n'); break;
    case 'text': textToken(t, k); break;
    default: throw new Error('Token with "' + k.type + '" type was not found.');
  }
}

/** 回答的 Markdown → 节点（一个片段，放进 .ai-md）。选项与原来的 marked.parse 相同（gfm、breaks） */
export function answerNodes(text: string | null | undefined): DocumentFragment{
  // marked 是 JS：Lexer.lex 返回的记号按上面的 Token 看
  const tokens = Lexer.lex(String(text || ''), {...marked.defaults, async: false, gfm: true, breaks: true}) as Token[];
  const root = frag(), tree = new Tree(root);
  blocks(tree, tokens);
  return root;
}
