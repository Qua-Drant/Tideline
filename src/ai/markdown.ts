// AI 回答的 Markdown 渲染（P2-3）。和任务正文（原型 paper-task-markdown.js）一样：
//   - 原始 HTML 一律转义成文字；
//   - 链接只保留 http(s):、mailto:、# 开头的，其它（javascript:、data:、file:、obsidian:、相对路径……）只留文字；
//   - 图片不自动加载：http(s) 图片换成可点的“[图片：说明]”链接，别的只留“[图片：说明]”文字。
import {marked, Renderer} from '../draw/proto/vendor/marked.mjs';
import {esc} from '../draw/ink.ts';

/** marked 交给渲染函数的记号里我们用到的几项（marked 是原样打包的第三方代码，没有类型声明） */
interface HtmlToken { text: string }
interface LinkToken { href?: string | null; title?: string | null; tokens: unknown[] }
interface ImageToken { href?: string | null; title?: string | null; text?: string }
/** 渲染函数里的 this：marked 的 Renderer，带着当前的 parser */
interface RendererThis { parser: {parseInline(tokens: unknown[]): string} }

const SAFE_LINK =/^(https?:|mailto:|#)/i;
const renderer = new Renderer();
renderer.html = (token: HtmlToken) => esc(token.text);
renderer.link = function(this: RendererThis, {href, title, tokens}: LinkToken){
  const text = this.parser.parseInline(tokens), url = String(href ?? '').trim();
  if (!SAFE_LINK.test(url)) return text;
  return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''} rel="noopener noreferrer">${text}</a>`;
};
renderer.image = function({href, title, text}: ImageToken){
  const url = String(href ?? '').trim(), label = `[图片：${esc(text || title || url.split('/').pop() || '无说明')}]`;
  return /^https?:/i.test(url) ? `<a class="ai-image-link" href="${esc(url)}" rel="noopener noreferrer" title="点开看图（不会自动加载）">${label}</a>` : label;
};
export const renderAnswer = (text: unknown): string => marked.parse(String(text || ''), {async: false, gfm: true, breaks: true, renderer}) as string;
