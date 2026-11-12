// 索引的来源：Obsidian。属性用 metadataCache（Obsidian 已经解析好、缓存好），正文用 vault.cachedRead。
// 改动来自 metadataCache 的 changed（文件内容与属性都已重新解析之后才触发）和 vault 的 delete / rename。
import {TFile} from 'obsidian';

export function obsidianSource(app, plugin){
  const file = path => { const f = app.vault.getAbstractFileByPath(path); return f instanceof TFile ? f : null; };
  return {
    get configDir(){ return app.vault.configDir; },
    files: () => app.vault.getMarkdownFiles().map(f => ({path: f.path})),
    frontmatter: path => { const f = file(path); return f ? app.metadataCache.getFileCache(f)?.frontmatter || null : null; },
    read: async path => { const f = file(path); return f ? app.vault.cachedRead(f) : ''; },
    onChange(cb){
      const refs = [app.metadataCache.on('changed', f => cb(f.path, 'change')), app.vault.on('delete', f => cb(f.path, 'delete')),
        app.vault.on('rename', (f, old) => { cb(old, 'delete'); cb(f.path, 'change'); })];
      for (const r of refs) plugin.registerEvent(r);
      return () => { app.metadataCache.offref(refs[0]); app.vault.offref(refs[1]); app.vault.offref(refs[2]); };
    },
  };
}

// 写入：只通过 Obsidian 的接口改文件（processFrontMatter 改属性、vault.process 改正文），改完由 metadataCache 的 changed 回到索引。
export function obsidianWriter(app){
  const get = path => app.vault.getAbstractFileByPath(path);
  const folder = async path => { const dir = path.split('/').slice(0, -1).join('/'); if (dir && !get(dir)) await app.vault.createFolder(dir).catch(() => {}); };
  const ensure = async (path, init) => get(path) || (await folder(path), app.vault.create(path, init));
  return {
    exists: path => !!get(path),
    async create(path, text){ return ensure(path, text); },
    async rename(path, to){ const f = get(path); if (f && !get(to)) { await folder(to); await app.fileManager.renameFile(f, to); } },
    // 删除走 Obsidian 自己的“删除文件”（按用户设置进系统回收站或仓库的 .trash），可以找回
    async trash(path){ const f = get(path); if (f) await app.fileManager.trashFile(f); },
    async frontmatter(path, fn, init = '---\n---\n'){ const f = await ensure(path, init); await app.fileManager.processFrontMatter(f, fn); },
    async body(path, fn, init = ''){ const f = await ensure(path, init); await app.vault.process(f, fn); },
    open(path){ const f = get(path); if (f) app.workspace.getLeaf('tab').openFile(f); },
    openPDF(path){
      const note = get(path);
      if (!(note instanceof TFile)) return false;
      const cache = app.metadataCache.getFileCache(note);
      const links = [...(cache?.frontmatterLinks || []), ...(cache?.links || []), ...(cache?.embeds || [])];
      for (const link of links) {
        const target = app.metadataCache.getFirstLinkpathDest(link.link.split('#')[0], path);
        if (target?.extension.toLowerCase() !== 'pdf') continue;
        app.workspace.getLeaf('tab').openFile(target);
        return true;
      }
      return false;
    },
  };
}
