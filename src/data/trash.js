// 显式删除队列（P2-10）。persist.commit 只把这里登记过的 id 送进回收站；条目只是从 d.tasks / d.goals / d.people 里消失（模型重建出错、
// 别的代码误删）不会删笔记。队列放在模型上（d.trash，model.js 重建时沿用），原型模块经 HOST.dropTasks 也能登记。
// 撤销期（lower.hold）不变：登记了但还在 hold 里的先不删，纸条消失后下一次 commit 再删；撤销时 restoreDeleted 取消登记。
export function markDeleted(d, ids){ d.trash ??= new Set(); for (const id of ids) if (id) d.trash.add(id); }
export function restoreDeleted(d, ids){ for (const id of ids) d.trash?.delete(id); }
// 从模型里拿掉任务并登记删除（撤销“加任务”、撤销完成记录、撤销见面后的跟进任务……）。还没写成笔记的（id 不是路径）登记了也不会动文件
export function dropTasks(d, ids){
  const gone = new Set(ids);
  d.tasks = d.tasks.filter(x => !gone.has(x.id));
  markDeleted(d, ids);
}
