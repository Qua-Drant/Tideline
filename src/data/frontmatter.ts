// 属性块（frontmatter）与正文的切分，读取侧（index.ts）和写回侧（persist.ts、write.ts、capture.js）共用。
// - 认 LF 与 CRLF 两种换行；
// - 空属性块 `---\n---\n` 直接结束，不会把正文里的 `---` 分隔线当成属性块的结尾；
// - 写回时用 keepEol：先把正文统一成 LF 处理，再按文件原来的换行风格写回，属性块原样保留。

/** 使用者手写的值（属性块、代理传来的参数）按 JS 的 String() 转成文字。值的类型不可信，所以参数是 unknown；
 *  对象照旧变成 "[object Object]"（与原来直接写 String(…) 完全相同，规范收尾批只是把它集中到这里） */
export const looseString = (v: unknown): string => String(v);

// 开头的 `---` 行，接着要么紧跟着结尾的 `---` 行（空属性块），要么是任意内容再接一行 `---`
const FM = /^---[ \t]*\r?\n(?:---|[\s\S]*?\r?\n---)[ \t]*(?:\r?\n|$)/;

// → {fm: 属性块原文（含结尾换行，没有就是 ''）, body: 正文原文}
export function splitFm(text: string | null | undefined): {fm: string; body: string}{
  const s = String(text ?? ''), m = FM.exec(s), fm = m ? m[0] : '';
  return {fm, body: s.slice(fm.length)};
}

// 只要正文（换行统一成 LF），读取侧用
export const bodyOf = (text: string | null | undefined): string => splitFm(text).body.replace(/\r\n/g, '\n');

// 文件用 CRLF 就先转成 LF 交给 fn，结果再转回 CRLF；fn 只需要处理 LF
export function keepEol(text: string | null | undefined, fn: (s: string) => string): string{
  const s = String(text ?? '');
  if (!s.includes('\r\n')) return fn(s);
  return fn(s.replace(/\r\n/g, '\n')).replace(/\r?\n/g, '\r\n');
}
