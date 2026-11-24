// P1-2 回归：完成一件任务产生的变更（data/complete.js）——重复任务留完成记录、原任务顺延、检查项清空；父任务连带子任务；撤销恢复原状。
// 今日页（view.toggleTask）与任务页（task-plus finish）都调 completeTask 改模型，再由 persist.js 写回；这里按同样的顺序在内存仓库里跑两遍比对。纯内存。
import assert from 'node:assert/strict';
import {sandboxFiles, TODAY, NOW} from '../tools/sandbox-spec.mjs';
import {memVault, split} from './mem-vault.mjs';
import {Index, FOLDERS} from '../src/data/index.ts';
import {buildModel} from '../src/data/model.ts';
import {createPersist} from '../src/data/persist.ts';
import {completeTask, reopenTask} from '../src/data/complete.ts';
import {addDays} from '../src/ui/task-parse.ts';

let n = 0; const ok = msg => { n++; console.log('✓', msg); };
const REPEAT = `${FOLDERS.tasks}/每天浇花.md`, PARENT = `${FOLDERS.tasks}/搬家.md`, KID = `${FOLDERS.tasks}/打包书.md`;
const extra = {
  [REPEAT]: `---\nstatus: open\nscheduled: ${TODAY}\nrepeat: 每天\npriority: high\ntags:\n  - 家\n---\n浇阳台的花\n\n- [x] 接水\n- [ ] 浇完擦地\n`,
  [PARENT]: `---\nstatus: open\nscheduled: ${TODAY}\npriority: medium\n---\n`,
  [KID]: `---\nstatus: open\nparent: "[[搬家]]"\npriority: medium\n---\n`,
};
async function setup(){
  const vault = memVault([...Object.entries(sandboxFiles()), ...Object.entries(extra)]);
  const index = new Index(vault.source); await index.build();
  const d = buildModel(index, {date: TODAY, time: NOW}, null), persist = createPersist(vault.writer); persist.reset(d);
  return {...vault, index, d, persist};
}
const snapshotFiles = files => new Map([...files].map(([k, v]) => [k, v]));

// 1. 重复任务
const a = await setup(), original = snapshotFiles(a.files);
const t = a.d.tasks.find(x => x.id === REPEAT), r = completeTask(a.d, t);
assert.equal(r.next, addDays(TODAY, 1));
await a.persist.commit(a.d);
const [fmT, bodyT] = split(a.files.get(REPEAT));
assert.equal(fmT.status, 'open'); assert.equal(fmT.repeat, '每天'); assert.equal(String(fmT.scheduled), addDays(TODAY, 1)); assert.equal(fmT.completed, undefined);
assert(bodyT.includes('- [ ] 接水') && !bodyT.includes('[x]'), bodyT);
const recordPath = r.record.id; assert(recordPath.startsWith(FOLDERS.tasks + '/每天浇花') && recordPath !== REPEAT, recordPath);
const [fmR, bodyR] = split(a.files.get(recordPath));
assert.equal(fmR.status, 'done'); assert.equal(String(fmR.completed), TODAY); assert.equal(String(fmR.scheduled), TODAY); assert.equal(fmR.repeat, undefined);
assert.deepEqual(fmR.tags, ['家']); assert.equal(fmR.priority, 'high'); assert(bodyR.includes('- [x] 接水'));
ok('重复任务：留一份完成记录（今天完成、无 repeat、检查项原样），原任务顺延到明天、repeat 保留、检查项清空');

// 撤销：顺延与完成记录一并撤回，笔记回到原状
r.undo(); await a.persist.commit(a.d);
assert(!a.files.has(recordPath), '完成记录没进回收站');
assert.deepEqual(split(a.files.get(REPEAT))[0], split(original.get(REPEAT))[0]);
assert.equal(split(a.files.get(REPEAT))[1], split(original.get(REPEAT))[1]);
ok('撤销：完成记录进回收站，原任务的日期、正文恢复');

// 2. 今日页与任务页同一套：两个仓库各走一遍，结果逐文件相同
//   今日页：view.toggleTask → lower.model() 上 completeTask → lower.settle()（persist.commit）
//   任务页：task-plus finish → completeTask → touch()（persist.commit）
const today = await setup(), tasks = await setup();
completeTask(today.d, today.d.tasks.find(x => x.id === REPEAT)); await today.persist.commit(today.d);
completeTask(tasks.d, tasks.d.tasks.find(x => x.id === REPEAT)); await tasks.persist.commit(tasks.d);
assert.deepEqual([...today.files.keys()].sort(), [...tasks.files.keys()].sort());
for (const [k, v] of today.files) assert.equal(v, tasks.files.get(k), k);
ok('从今日页与任务页完成同一件 repeat: 每天 的任务，笔记逐字一致');

// 3. 父任务连带子任务；撤销恢复
const c = await setup(), parent = c.d.tasks.find(x => x.id === PARENT), kid = c.d.tasks.find(x => x.id === KID);
assert.equal(kid.parentId, PARENT);
const rc = completeTask(c.d, parent); await c.persist.commit(c.d);
assert.equal(split(c.files.get(PARENT))[0].status, 'done'); assert.equal(split(c.files.get(KID))[0].status, 'done'); assert.equal(String(split(c.files.get(KID))[0].completed), TODAY);
rc.undo(); await c.persist.commit(c.d);
assert.equal(split(c.files.get(PARENT))[0].status, 'open'); assert.equal(split(c.files.get(KID))[0].status, 'open'); assert.equal(split(c.files.get(KID))[0].completed, undefined);
ok('普通任务：未完成的子任务一并完成；撤销后都回到未完成');

// 4. 重新打开
const ro = reopenTask(c.d, parent); assert.equal(parent.status, 'open'); ro.undo();
completeTask(c.d, parent); await c.persist.commit(c.d); const re = reopenTask(c.d, parent); await c.persist.commit(c.d);
assert.equal(split(c.files.get(PARENT))[0].status, 'open'); assert.equal(split(c.files.get(PARENT))[0].completed, undefined);
re.undo(); await c.persist.commit(c.d); assert.equal(split(c.files.get(PARENT))[0].status, 'done');
ok('重新打开与撤销');
console.log(`check-complete：${n} 项通过`);
