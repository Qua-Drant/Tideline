// Zotero 文献（0.7）：接 Obsidian 社区插件 Zotero Integration（id obsidian-zotero-desktop-connector）。
// 潮线不直接连 Zotero：文献笔记由 Zotero Integration 按它自己的模板导进仓库，潮线把它的导入文件夹当作“文献”来读，
// 知识库页的“Zotero”按钮调它的导入命令（会弹出 Zotero 的选择框，要求 Zotero 开着、装了 Better BibTeX）。
// 它的模板字段名各人不同，这里按常见写法依次找：title、authors / author / creators、year / date、itemType、tags、citekey，
// 摘要、标注在 “Abstract / 摘要”、“Annotations / Highlights / 摘录” 这些标题下；zotero:// 链接用来在 Zotero 里打开 PDF。
export const ZOTERO_ID = 'obsidian-zotero-desktop-connector';

const trimSlash = s => String(s || '').replace(/\\/g, '/').replace(/^\.?\/+|\/+$/g, '');
// 输出路径模板里第一个 {{ 之前的文件夹部分：“文献/Zotero/{{citekey}}.md” → “文献/Zotero”
export function folderOfTemplate(t){
  const s = String(t || '').replace(/\\/g, '/'), cut = s.indexOf('{{'), head = cut < 0 ? s : s.slice(0, cut);
  const i = head.lastIndexOf('/'); return i < 0 ? '' : trimSlash(head.slice(0, i));
}

// 看 Zotero Integration 装没装、开没开、往哪个文件夹导、有哪些导入命令
export function zoteroInfo(app, override = ''){
  const plugins = app?.plugins, installed = !!plugins?.manifests?.[ZOTERO_ID], plugin = plugins?.plugins?.[ZOTERO_ID], enabled = !!plugin;
  const st = plugin?.settings || {}, formats = Array.isArray(st.exportFormats) ? st.exportFormats : [];
  const found = [...new Set([...formats.map(f => folderOfTemplate(f.outputPathTemplate)), trimSlash(st.noteImportFolder)].filter(Boolean))];
  const folders = override ? [trimSlash(override)] : found;
  const commands = Object.values(app?.commands?.commands || {}).filter(c => String(c.id).startsWith(ZOTERO_ID + ':'))
    .map(c => ({id: c.id, name: String(c.name || c.id).replace(/^Zotero Integration:\s*/, '')}));
  // 导入命令：每个导入格式一条（id 是 zdc-exp-格式名），另有通用的 “Import notes”；插入引文、参考文献、数据浏览器不算
  const imports = commands.filter(c => /:zdc-exp-|import|导入/i.test(c.id + ' ' + c.name) && !/insert|cite|citation|bibliograph|explorer|引用|参考文献/i.test(c.id + ' ' + c.name));
  return {installed, enabled, folders, found, formats: formats.map(f => f.name).filter(Boolean), commands, imports};
}

// —— 从 Zotero Integration 导出的笔记里取字段 ——
const HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
// 某个标题（任意级别、名字不分大小写，取第一个匹配的名字）下面到同级或更高级标题为止的文字
export function headingText(body, names){
  const lines = body.split('\n'), want = names.map(n => n.toLowerCase());
  for (let i = 0; i < lines.length; i++) {
    const m = HEAD.exec(lines[i]); if (!m || !want.includes(m[2].replace(/[*_`]/g, '').trim().toLowerCase())) continue;
    const level = m[1].length, out = [];
    for (let j = i + 1; j < lines.length; j++) { const n = HEAD.exec(lines[j]); if (n && n[1].length <= level) break; out.push(lines[j]); }
    return out.join('\n').trim();
  }
  return '';
}
const strip = s => s.replace(/!?\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1').replace(/!?\[\[([^\]]+)\]\]/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
// 标注：列表项、引用块、或一段一段的文字，各算一条
export function marksOf(block){
  const out = []; let cur = [];
  const push = () => { const s = strip(cur.join(' ')); if (s && !/^%%/.test(s)) out.push(s); cur = []; };
  for (const raw of block.split('\n')) {
    const l = raw.trim();
    if (!l || /^#{1,6}\s/.test(l)) { push(); continue; }
    if (/^[-*+]\s+/.test(l)) { push(); cur.push(l.replace(/^[-*+]\s+/, '')); continue; }
    if (/^>/.test(l)) { const t = l.replace(/^>+\s?/, ''); if (/^\[!/.test(t)) { push(); const rest = t.replace(/^\[![^\]]*\][+-]?\s*/, ''); if (rest) cur.push(rest); } else cur.push(t); continue; }
    cur.push(l);
  }
  push(); return out.slice(0, 200);
}
const names = v => (Array.isArray(v) ? v : v ? [v] : []).map(x => typeof x === 'object' && x ? (x.name || [x.lastName, x.firstName].filter(Boolean).join(' ')) : String(x)).map(s => s.replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
export function zoteroFields(fm, text, bodyText){
  const authors = names(fm.authors ?? fm.author ?? fm.creators ?? fm.authorString);
  const yearRaw = fm.year ?? fm.date ?? fm.datePublished ?? fm.issued ?? '';
  const year = yearRaw instanceof Date ? yearRaw.getFullYear() : Number((String(yearRaw).match(/\b(1[5-9]\d\d|20\d\d)\b/) || [])[1]) || null;
  const tags = (Array.isArray(fm.tags) ? fm.tags : fm.tags ? String(fm.tags).split(/[,\s]+/) : []).map(t => String(t).replace(/^#/, '')).filter(Boolean);
  const abstract = String(fm.abstract || fm.abstractNote || '') || strip(headingText(bodyText, ['Abstract', '摘要', 'Summary']));
  const marks = marksOf(headingText(bodyText, ['Annotations', 'Highlights', 'Notes', '摘录', '标注', '批注']));
  const link = String(fm.zotero || fm['zotero-link'] || fm.zoteroLink || fm.uri || fm.desktopURI || '');
  const zotero = /^zotero:\/\//.test(link) ? link : (text.match(/zotero:\/\/(?:open-pdf|select)\/[^\s)\]>"'|]+/) || [])[0] || '';
  return {title: fm.title ? String(fm.title) : '', authors: authors.join('、'), year, type: String(fm.itemType || fm.type || fm.category || ''), keywords: tags, abstract, marks, citekey: String(fm.citekey || fm.citationKey || ''), zotero};
}
