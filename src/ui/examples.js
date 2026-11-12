// 示例笔记的画法（设计说明 22.5）：各页照常显示，但用淡墨画，并带一个小小的“例”字印记。原型没有这一状态的画面。
// 做法：每次画完（和手绘框同一时机），在露出来的页里找“指向某篇笔记”的元素（各页用的 data-* 属性见 ATTRS），
// 值是示例笔记路径的：最外层那个元素整体淡下去（里面的不再重复淡）；同一条目只加一枚“例”字印，
// 放在文字含这篇笔记标题、且文字最短的那个元素后面（就是名称本身，不会落到“完成”这类按钮上）。
// 今日页：今天的日记是示例时，习惯、自问、投入、随手记几块整块淡下去，印放在各块的小标题后；往年今日同理。
// 没装示例时什么都不做（只看一眼有没有残留的印）。
const ATTRS = ['data-detail', 'data-complete', 'data-star', 'data-goal', 'data-plan', 'data-guidance-prompt', 'data-id', 'data-project-route', 'data-brain-node', 'data-cargo-document'];
const SEL = ATTRS.map(a => `[${a}]`).join(',');
const DAY_GROUPS = ['habits', 'questions', 'investments', 'journal'];
const SEAL = '<i class="example-seal" aria-hidden="true" title="示例笔记">例</i>';

export function createExampleMarks({view, plugin}){
  const root = view.root;
  function clear(scope){ for (const e of scope.querySelectorAll('.is-example')) e.classList.remove('is-example'); for (const s of scope.querySelectorAll('.example-seal')) s.remove(); }
  function titleOf(path){ const ix = plugin.index; for (const t of ['tasks', 'projects', 'ideas', 'people', 'literature', 'books', 'goals', 'prompts']) { const x = ix[t]?.get(path); if (x) return x.title || x.name || ''; } return ''; }
  function apply(){
    const ex = plugin.index.examples;
    if (!ex?.size) { if (root.querySelector('.is-example, .example-seal')) clear(root); return; }
    const scopes = new Set([...root.querySelectorAll('#sheet > section.page:not([hidden])'), root.querySelector('#today:not([hidden])')].filter(Boolean));
    const want = new Set();
    for (const scope of scopes) {
      const best = new Map(); // 条目 → 放印的元素
      for (const el of scope.querySelectorAll(SEL)) {
        let id = null; for (const a of ATTRS) { const v = el.getAttribute(a); if (v == null) continue; const hit = v.split('|').find(x => ex.has(x)); if (hit) { id = hit; break; } }
        if (!id) { el.classList.remove('is-example'); continue; }
        if (!el.parentElement.closest('.is-example')) el.classList.add('is-example');
        const text = el.textContent.replace('例', '').trim(); if (text.length < 2) continue;
        const title = titleOf(id), named = !!title && text.includes(title), cur = best.get(id);
        // 先比“含不含标题”，再比文字长短
        if (!cur || (named && !cur.named) || (named === cur.named && text.length < cur.len)) best.set(id, {el, named, len: text.length});
      }
      for (const x of best.values()) want.add(x.el);
      // 今日页：这一天、往年今日的日记是示例时
      if (scope.id === 'today') {
        const day = ex.has(scope.dataset.dayNote), past = ex.has(scope.dataset.pastNote);
        for (const g of DAY_GROUPS) { const box = scope.querySelector(`[data-today-group="${g}"]`); if (!box) continue; box.classList.toggle('is-example', day); if (day) want.add(box.querySelector('.today-section-mark span')); }
        const pb = scope.querySelector('[data-today-group="past"]'); if (pb) { pb.classList.toggle('is-example', past); if (past) want.add(pb.querySelector('.today-section-mark span')); }
      }
    }
    want.delete(null);
    for (const s of root.querySelectorAll('.example-seal')) if (!want.has(s.parentElement)) s.remove();
    for (const el of want) if (!el.querySelector(':scope > .example-seal')) el.insertAdjacentHTML('beforeend', SEAL);
  }
  return {apply};
}
