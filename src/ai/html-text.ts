// 第 4b 期：AI 回答与对话区改成直接建节点后，原来“拼 HTML 字符串 → 浏览器解析”时由解析器顺带做的几件文字上的事，这里照做，
// 让建出来的文本节点与属性值和原来解析出来的一字不差（规则照 WHATWG HTML 标准的解析器）：
//   - 输入预处理：CR LF、单独的 CR 都变成 LF；
//   - 文字里的 NUL（U+0000）被树构建器丢掉；属性值里的 NUL 换成 U+FFFD；
//   - 字符引用（&名字;、&#十进制;、&#x十六进制;）解码。只有 Markdown 的普通文字需要：marked 的转义（不编码模式）会留下形如“&名字;”的字符引用，
//     原来交给浏览器解码（例如 &copy; 显示成 ©、&rarr; 显示成 →）。其余文字原来都经 esc() 全部转义，解析后就是原文，只需前两条。
import {NAMED, LEGACY} from './entities.ts';

let named: Map<string, string> | null = null, legacy: Set<string> | null = null, maxLegacy = 0;
function tables(): [Map<string, string>, Set<string>]{
  if (!named || !legacy) {
    named = new Map(NAMED.split(' ').map(e => { const [k, v] = e.split(':'); return [k, String.fromCodePoint(...v.split('.').map(x => parseInt(x, 16)))]; }));
    legacy = new Set(LEGACY.split(' ')); for (const k of legacy) maxLegacy = Math.max(maxLegacy, k.length);
  }
  return [named, legacy];
}
// 0x80–0x9F 的数字引用按 windows-1252 换字（标准里的那张表）
const C1: Record<number, number> = {0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039,
  0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
  0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178};
const isDigit = (c: number) => c >= 48 && c <= 57;
const isHex = (c: number) => isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
const isAlnum = (c: number) => isDigit(c) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

/** 解码字符引用（照标准的“字符引用”状态）。attr：在属性值里（不带分号的旧名字后面紧跟 = 或字母数字时不解码） */
export function decodeRefs(s: string, attr = false): string{
  let at = s.indexOf('&'); if (at < 0) return s;
  const [N, L] = tables();
  let out = '', i = 0;
  while (at >= 0) {
    out += s.slice(i, at); i = at + 1;
    const c = s.charCodeAt(i);
    if (c === 35) { // #
      let k = i + 1; const hex = s.charCodeAt(k) === 120 || s.charCodeAt(k) === 88; if (hex) k++;
      const start = k; let v = 0;
      while (k < s.length && (hex ? isHex(s.charCodeAt(k)) : isDigit(s.charCodeAt(k)))) { v = Math.min(v * (hex ? 16 : 10) + parseInt(s[k], 16), 0x110000); k++; }
      if (k === start) out += '&'; // 没有数字：原样
      else {
        if (s.charCodeAt(k) === 59) k++;
        if (v === 0 || v > 0x10FFFF || (v >= 0xD800 && v <= 0xDFFF)) v = 0xFFFD;
        else if (C1[v]) v = C1[v];
        out += String.fromCodePoint(v); i = k;
      }
    } else {
      let k = i; while (k < s.length && isAlnum(s.charCodeAt(k))) k++;
      const run = s.slice(i, k), whole = s.charCodeAt(k) === 59 ? N.get(run) : undefined;
      if (whole !== undefined) { out += whole; i = k + 1; }
      else {
        let len = Math.min(run.length, maxLegacy); while (len > 0 && !L.has(run.slice(0, len))) len--;
        if (!len) out += '&'; // 不是字符引用：原样
        else {
          const next = s.charCodeAt(i + len), name = run.slice(0, len);
          if (attr && (next === 61 || isAlnum(next))) out += '&' + name; // 属性里的历史规矩：原样
          else out += N.get(name);
          i += len;
        }
      }
    }
    at = s.indexOf('&', i);
  }
  return out + s.slice(i);
}

/** 原来 esc() 后写进 HTML 文字、经解析器得到的文字：换行归一、去掉 NUL */
export function plainText(s: string | number | null | undefined): string{
  const t = s == null ? '' : String(s);
  return /[\r\0]/.test(t) ? t.replace(/\r\n?/g, '\n').replace(/\0/g, '') : t;
}
/** 原来 esc() 后写进属性值、经解析器得到的值：换行归一、NUL 换成 U+FFFD */
export function plainAttr(s: string | number | null | undefined): string{
  const t = s == null ? '' : String(s);
  return /[\r\0]/.test(t) ? t.replace(/\r\n?/g, '\n').replace(/\0/g, '�') : t;
}
/** 写进 HTML 文字的一段（可含字符引用）经解析器得到的文字 */
export const htmlText = (s: string): string => decodeRefs(s.replace(/\r\n?/g, '\n')).replace(/\0/g, '');
/** 写进属性值的一段（可含字符引用）经解析器得到的值 */
export const htmlAttr = (s: string): string => decodeRefs(s.replace(/\r\n?/g, '\n'), true).replace(/\0/g, '�');
