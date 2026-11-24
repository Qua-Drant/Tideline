// 内存仓库：数据层测试（不开浏览器）用的假 source / writer。
// 属性块切分认 LF 与 CRLF；writer.frontmatter 像 Obsidian 的 processFrontMatter 一样只重写属性块，正文与换行风格原样保留。
import YAML from 'yaml';

const FM = /^---[ \t]*\r?\n(?:---|([\s\S]*?)\r?\n---)[ \t]*(?:\r?\n|$)/;
// → [属性对象, 正文]
export const split = text => { const m = FM.exec(text); return m ? [YAML.parse(m[1] || '') || {}, text.slice(m[0].length)] : [{}, text]; };
export const eolOf = text => text.includes('\r\n') ? '\r\n' : '\n';

export function memVault(entries){
  const files = new Map(entries);
  let failOnce = null; // 路径前缀：下一次 frontmatter 写到这里时抛错一次
  const source = {files: () => [...files.keys()].map(path => ({path})), frontmatter: path => split(files.get(path) || '')[0], read: async path => files.get(path) || '', onChange: () => () => {}};
  const writes = [];
  const writer = {
    exists: path => files.has(path),
    async create(path, text){ writes.push(['create', path]); if (!files.has(path)) files.set(path, text); },
    async frontmatter(path, fn, init = '---\n---\n'){
      if (failOnce && path.startsWith(failOnce)) { failOnce = null; throw new Error('预期的测试写入失败'); }
      writes.push(['frontmatter', path]);
      const text = files.get(path) ?? init, eol = eolOf(text), [fm, body] = split(text); fn(fm);
      const y = Object.keys(fm).length ? YAML.stringify(fm) : '';
      files.set(path, ('---\n' + y + '---\n').replace(/\n/g, eol) + body);
    },
    async body(path, fn, init = ''){ writes.push(['body', path]); files.set(path, fn(files.get(path) ?? init)); },
    async rename(path, to){ writes.push(['rename', path, to]); files.set(to, files.get(path)); files.delete(path); },
    async trash(path){ writes.push(['trash', path]); files.delete(path); },
  };
  return {files, source, writer, writes, failNext: prefix => { failOnce = prefix; }};
}
