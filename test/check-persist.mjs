// 回归配置快照、部分失败后的重试和未知清单关联。全部在内存里，不读写仓库。
import assert from 'node:assert/strict';
import {sandboxFiles, TODAY, NOW} from '../tools/sandbox-spec.mjs';
import {memVault} from './mem-vault.mjs';
import {Index, FOLDERS} from '../src/data/index.ts';
import {buildModel} from '../src/data/model.ts';
import {createPersist} from '../src/data/persist.ts';

// 内存仓库（属性块切分认 LF 与 CRLF，见 mem-vault.mjs）
// 另加两篇“已完成但笔记里没写 completed”的任务与目标（P2-1）
const extra = {[`${FOLDERS.tasks}/没写完成日期.md`]: '---\nstatus: done\nscheduled: 2026-10-01\n---\n', [`${FOLDERS.goals}/没写达成日期.md`]: '---\nplanned: 1\nstatus: done\n---\n'};
const vault = memVault([...Object.entries(sandboxFiles()), ...Object.entries(extra)]), {files, source, writer} = vault;
const index = new Index(source); await index.build();
const d = buildModel(index, {date: TODAY, time: NOW}, null);
const persist = createPersist(writer); persist.reset(d);
// P2-1：快照建好后只是跨过午夜（时钟日期变了），不该给任何条目写上新的完成日期
d.clock.date = '2099-01-01';
assert.equal(await persist.commit(d), 0, '只改时钟日期就写了笔记');
assert.equal(vault.writes.length, 0, JSON.stringify(vault.writes));
assert.equal(source.frontmatter(`${FOLDERS.tasks}/没写完成日期.md`).completed, undefined);
d.clock.date = TODAY;
console.log('✓ 只改时钟日期、不改条目：commit 返回 0，没有写入');
d.lists.push({id: '新清单', title: '新清单', archived: false});
await persist.commit(d);
assert(source.frontmatter(FOLDERS.config).lists.some(l => l.title === '新清单'));
console.log('✓ 配置回调与修改前的快照比较，实际写出新清单');
d.tasks.push({id: 'task-retry', title: '部分失败验证', status: 'open', priority: 'medium', peopleIds: [], listId: '新清单'});
d.lists.push({id: '失败时的清单', title: '失败时的清单', archived: false});
vault.failNext(FOLDERS.tasks + '/');
const originalError = console.error; console.error = () => {};
try { await assert.rejects(persist.commit(d), /写回失败/); } finally { console.error = originalError; }
await persist.commit(d);
const taskPath = `${FOLDERS.tasks}/部分失败验证.md`;
assert.equal(source.frontmatter(taskPath).list, '新清单');
assert.equal([...files.keys()].filter(path => path.includes('部分失败验证')).length, 1);
assert(source.frontmatter(FOLDERS.config).lists.some(l => l.title === '失败时的清单'));
assert.equal(await persist.commit(d), 0);
console.log('✓ 部分写入失败后可重试，已建文件不重复，配置不丢失');
await writer.frontmatter(taskPath, fm => { fm.list = '暂时不在配置中的清单'; });
await index.build(); const reloaded = buildModel(index, {date: TODAY, time: NOW}, d);
assert.equal(reloaded.tasks.find(t => t.id === taskPath).listId, '暂时不在配置中的清单');
console.log('✓ 重载模型保留未知清单名，其他修改不会清空关联');

// P2-10：删除只认显式登记（d.trash）
{
  const {dropTasks, markDeleted, restoreDeleted} = await import('../src/data/trash.ts');
  await index.build(); const m = buildModel(index, {date: TODAY, time: NOW}, null); persist.reset(m);
  const [a, b, c, e] = m.tasks.filter(t => t.id.includes('/')).map(t => t.id);
  // 1. 只是从数组里消失、没登记：不删笔记；之后又出现也不当成新条目
  const lost = m.tasks.find(t => t.id === a); m.tasks = m.tasks.filter(t => t.id !== a); vault.writes.length = 0;
  assert.equal(await persist.commit(m), 0); assert(files.has(a)); assert.equal(vault.writes.length, 0);
  m.tasks.push(lost); assert.equal(await persist.commit(m), 0, '回来的条目被当成新条目写了一遍');
  console.log('✓ 没登记的消失不删笔记，回来后也不重写');
  // 2. 登记过的才删
  dropTasks(m, [b]); assert.equal(await persist.commit(m), 1); assert(!files.has(b)); assert(!m.trash.has(b));
  console.log('✓ dropTasks 登记后 commit 才进回收站，删完出队');
  // 3. 撤销期：登记了但在 hold 里先不删，hold 结束后删；跨一次模型重建（lower.model 的做法）队列仍在
  const hold = new Set([c]); m.tasks = m.tasks.filter(t => t.id !== c); markDeleted(m, [c]);
  assert.equal(await persist.commit(m, {hold}), 0); assert(files.has(c));
  await index.build(); Object.assign(m, buildModel(index, {date: TODAY, time: NOW}, m)); persist.reset(m); m.tasks = m.tasks.filter(t => !hold.has(t.id));
  assert(m.trash.has(c), '模型重建后删除队列丢了');
  hold.delete(c); assert.equal(await persist.commit(m, {hold}), 1); assert(!files.has(c));
  console.log('✓ 撤销期内不删，纸条消失后删；模型重建时沿用队列');
  // 4. 撤销删除：取消登记，放回去，不删
  const back = m.tasks.find(t => t.id === e); hold.add(e); m.tasks = m.tasks.filter(t => t.id !== e); markDeleted(m, [e]);
  await persist.commit(m, {hold}); restoreDeleted(m, [e]); hold.delete(e); m.tasks.push(back);
  assert.equal(await persist.commit(m, {hold}), 0); assert(files.has(e)); assert(!m.trash.has(e));
  console.log('✓ 撤销删除：取消登记，笔记不动');
  // 5. 还没写成笔记就撤销的新条目：登记了也不碰文件，出队
  m.tasks.push({id: 'task-tmp', title: '临时', status: 'open', priority: 'medium', peopleIds: []}); dropTasks(m, ['task-tmp']);
  assert.equal(await persist.commit(m), 0); assert(!m.trash.has('task-tmp'));
  console.log('✓ 没写成笔记的新条目撤销：不碰文件，出队');
}
