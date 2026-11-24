// P1-1 回归：CRLF 与 LF 的笔记改正文后属性块完整保留；空属性块后正文里的 --- 分隔线不吞掉前面的内容。纯内存。
import assert from 'node:assert/strict';
import {sandboxFiles, TODAY, NOW} from '../tools/sandbox-spec.mjs';
import {memVault, split} from './mem-vault.mjs';
import {Index, FOLDERS} from '../src/data/index.ts';
import {buildModel} from '../src/data/model.ts';
import {createPersist} from '../src/data/persist.ts';
import {todayActions} from '../src/data/write.ts';
import {splitFm, bodyOf} from '../src/data/frontmatter.ts';

const crlf = s => s.replace(/\r?\n/g, '\r\n');
const onlyCrlf = s => !/(^|[^\r])\n/.test(s);
let n = 0; const ok = msg => { n++; console.log('✓', msg); };

// 切分函数本身
assert.deepEqual(splitFm('---\na: 1\n---\nbody'), {fm: '---\na: 1\n---\n', body: 'body'});
assert.deepEqual(splitFm('---\r\na: 1\r\n---\r\nbody'), {fm: '---\r\na: 1\r\n---\r\n', body: 'body'});
assert.deepEqual(splitFm('---\n---\n前\n\n---\n\n后'), {fm: '---\n---\n', body: '前\n\n---\n\n后'});
assert.deepEqual(splitFm('---\r\n---\r\n前\r\n---\r\n后'), {fm: '---\r\n---\r\n', body: '前\r\n---\r\n后'});
assert.deepEqual(splitFm('没有属性\n---\n'), {fm: '', body: '没有属性\n---\n'});
assert.deepEqual(splitFm('---\na: 1\n---'), {fm: '---\na: 1\n---', body: ''});
assert.equal(bodyOf('---\r\na: 1\r\n---\r\n第一行\r\n第二行'), '第一行\n第二行');
ok('splitFm / bodyOf 认 CRLF、空属性块与正文里的分隔线');

// 每类各取一篇，另做一份 CRLF 的副本
const base = sandboxFiles(), pick = folder => Object.keys(base).find(p => p.startsWith(folder + '/'));
const chosen = {tasks: pick(FOLDERS.tasks), projects: pick(FOLDERS.projects), ideas: pick(FOLDERS.ideas), literature: pick(FOLDERS.literature), people: pick(FOLDERS.people)};
const entries = Object.entries(base), copies = {};
for (const [kind, path] of Object.entries(chosen)) { const to = path.replace(/\.md$/, ' 换行.md'); copies[kind] = to; entries.push([to, crlf(base[path])]); }
// 空属性块 + 正文分隔线的日记（LF、CRLF 各一篇）
const D1 = '2026-01-02', D2 = '2026-01-03';
entries.push([`${FOLDERS.journal}/${D1}.md`, '---\n---\n## 随手记\n- 09:00 分隔线之前\n\n---\n\n## 完成\n- 一件事\n']);
entries.push([`${FOLDERS.journal}/${D2}.md`, crlf('---\n---\n## 随手记\n- 10:00 换行版\n\n---\n\n## 完成\n- 另一件\n')]);
// 今日页追加随手记用的 CRLF 日记
const todayPath = `${FOLDERS.journal}/${TODAY}.md`, todayIdx = entries.findIndex(([p]) => p === todayPath); entries[todayIdx][1] = crlf(entries[todayIdx][1]);

const vault = memVault(entries), {files, source, writer} = vault;
const index = new Index(source); await index.build();

// 读取侧
assert.deepEqual(index.days.get(D1).journal.map(j => j.text), ['分隔线之前']);
assert.deepEqual(index.days.get(D1).done, ['一件事']);
assert.deepEqual(index.days.get(D2).journal.map(j => j.text), ['换行版']);
ok('空属性块 + 正文分隔线：读得出分隔线之前的 ## 随手记（LF / CRLF）');
for (const kind of ['tasks', 'projects', 'ideas']) {
  const lf = index[kind].get(chosen[kind]), cr = index[kind].get(copies[kind]), key = kind === 'tasks' ? 'markdown' : kind === 'ideas' ? 'body' : 'description';
  assert(!String(cr[key]).includes('---'), `${kind} 的 CRLF 正文里混进了属性块`);
  assert.equal(cr[key], lf[key], `${kind} 的 CRLF 正文与 LF 不同`);
}
assert.deepEqual(index.people.get(copies.people).history, index.people.get(chosen.people).history);
assert.equal(index.literature.get(copies.literature).conclusion, index.literature.get(chosen.literature).conclusion);
ok('CRLF 笔记的正文、说明、## 记录与 LF 读出来一致，不把属性块当正文');

// 写回侧：两份都改正文 / 说明 / ## 笔记 / ## 记录
const d = buildModel(index, {date: TODAY, time: NOW}, null), persist = createPersist(writer); persist.reset(d);
const before = Object.fromEntries([...Object.values(chosen), ...Object.values(copies)].map(p => [p, split(files.get(p))[0]]));
for (const path of [chosen.tasks, copies.tasks]) d.tasks.find(t => t.id === path).markdown = '新的任务正文\n\n- [ ] 检查项';
for (const path of [chosen.projects, copies.projects]) d.projects.find(p => p.id === path).description = '新的项目说明';
for (const path of [chosen.ideas, copies.ideas]) d.ideas.find(i => i.id === path).body = '新的想法正文';
for (const path of [chosen.literature, copies.literature]) d.libraryMeta['literature|' + path].note = '新的阅读笔记';
for (const path of [chosen.people, copies.people]) d.people.find(p => p.id === path).history.push({date: TODAY, text: '测试记录'});
assert(await persist.commit(d) >= 10);
for (const kind of Object.keys(chosen)) for (const path of [chosen[kind], copies[kind]]) {
  const text = files.get(path), [fm, body] = split(text);
  assert.deepEqual(fm, before[path], `${path} 的属性块变了`);
  assert(text.startsWith('---'), `${path} 丢了属性块`);
  const want = {tasks: '新的任务正文', projects: '新的项目说明', ideas: '新的想法正文', literature: '## 笔记', people: `- ${TODAY} 测试记录`}[kind];
  assert(body.includes(want.replace(/\n/g, path === copies[kind] ? '\r\n' : '\n')), `${path} 正文没写进去：${JSON.stringify(body)}`);
  if (path === copies[kind]) assert(onlyCrlf(text), `${path} 混进了 LF 换行`);
}
assert(split(files.get(copies.literature))[1].includes('新的阅读笔记'));
ok('任务、项目、想法、文献、人物（LF / CRLF）改正文、说明、## 笔记、## 记录后属性块完整，CRLF 保持 CRLF');

// 写回之后重新读：CRLF 版的值与刚写的一致
await index.build();
assert.equal(index.tasks.get(copies.tasks).markdown, '新的任务正文\n\n- [ ] 检查项');
assert.equal(index.projects.get(copies.projects).description, '新的项目说明');
assert.equal(index.ideas.get(copies.ideas).body, '新的想法正文');
assert.equal(index.literature.get(copies.literature).note, '新的阅读笔记');
assert.equal(index.people.get(copies.people).history.at(-1).text, '测试记录');
ok('写回后重读 CRLF 笔记，值与写入的一致');

// 今日页随手记追加到 CRLF 日记
const fmToday = split(files.get(todayPath))[0];
await todayActions(writer, () => ({date: TODAY, time: '23:59'})).addJournal('深夜一条');
assert.deepEqual(split(files.get(todayPath))[0], fmToday);
assert(onlyCrlf(files.get(todayPath)));
await index.build(); assert.equal(index.days.get(TODAY).journal.at(-1).text, '深夜一条');
ok('今日页随手记追加到 CRLF 日记：属性块不变、换行不混');

// 空属性块的日记里改别的节，不吞分隔线之前的内容
const {setSection} = await import('../src/data/persist.ts');
const out = setSection(files.get(`${FOLDERS.journal}/${D1}.md`), '完成', '- 改过');
assert(out.startsWith('---\n---\n## 随手记\n- 09:00 分隔线之前\n\n---\n'), out);
ok('空属性块日记 setSection 保留分隔线之前的内容');
console.log(`check-frontmatter：${n} 项通过`);
