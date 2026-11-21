// 今日以外的七页：思索、指引，以及下方五页（任务／货舱、项目／海图、复盘、知识库、大脑）。
// 画面与交互直接用原型的页面模块（src/draw/proto/，从原型复制并改成只作用于插件视图；当时的同步脚本没有随仓库发布，现在直接维护这些文件），
// 这里只做三件事：给它们一份由笔记建出来的数据（model.ts）；把原型 paper.js 的“核心”接口接到插件视图上；改动后写回笔记（persist.ts）。
// 第 4b 期：只改两处——指引页改成 pages/ai.ts（import 路径）；ink.ts 删去了 esc，不再取它、不再往 api 与 createR12Art 里传（没有模块读它）。
// 规范收尾批：由 lower.js 转成 TypeScript（逻辑不变）；计时器写成 window.setTimeout 等（与视图无关的写回排程，用主窗口的）。
import {createPhase2} from '../draw/proto/phase2.ts';
import {ink, circle, icon, star, inkV, circleV} from '../draw/ink.ts';
import {parts} from '../draw/scene.ts';
import {createR12Art} from '../draw/proto/paper-r12-art.ts';
import {maritimeArt} from '../draw/proto/paper-maritime-r14.ts';
import {createThought} from './thought.ts';
import {createAI} from './ai.ts';
import {buildModel} from '../data/model.ts';
import {createPersist} from '../data/persist.ts';
import {FOLDERS} from '../data/index.ts';
import {completeTask, reopenTask} from '../data/complete.ts';
import {dropTasks} from '../data/trash.ts';
import {HOST} from '../host.ts';
import type {CompassView} from '../view.ts';
import type {Model} from '../data/types.ts';
// 原型模块（paper-tasks.js 撤销“加任务”）经它拿掉任务并登记删除（P2-10，复制原型时的改写）
HOST.dropTasks = dropTasks;

const LOWER = ['tasks', 'projects', 'review', 'library', 'brain'];
export const PAGES = ['thought', 'ai', ...LOWER];

export function createLower(view: CompassView){
  const plugin = view.plugin;
  const drawn: Record<string, string> = {}; // 每一页上次画的时候的“输入”
  let d: Model | null = null, p2: ReturnType<typeof createPhase2> | null = null, thought: ReturnType<typeof createThought> | null = null, ai: ReturnType<typeof createAI> | null = null,
    art: {r12: ReturnType<typeof createR12Art>; r14: ReturnType<typeof maritimeArt>} | null = null, version = -1, timer = 0, dirty = false;
  let revision = 0, writing: Promise<number> | null = null, closed = false, syncTimer = 0, syncTries = 0, deferred = false;
  const hold = new Set<string>(); // 刚删掉、还能撤销的任务：纸条消失前不进回收站
  const persist = createPersist(plugin.writer);
  // 原型的页面模块在创建时就记住了 d 这个对象：之后只能原地更新它，不能换一个
  // 按索引重建模型的时机（修“先 render 后 touch”丢修改的竞态）：
  //   页面代码常是“改模型 → render() → touch()”，原型模块的键盘操作要到 keyup 才由下面的 commit 钩子置 dirty。若在这之间的 render 里
  //   按索引重建，刚改、还没标记（dirty 仍是 false）的内容就被旧笔记盖掉。所以重建前多看一眼：
  //   模型与上次写回 / 重建时的快照逐项相同（persist.pending 为假）才当场重建——这时与原来完全一样，不多画一次；
  //   不同（有刚做、还没标记的修改）就不重建，排一次 syncSoon()：到下一个任务时，同步的“改 → render → touch”早已做完，dirty 已置上，
  //   等写回完成后再重建（本地优先，与原来一样）；若仍没人标记（键盘按下到松开之间），隔一会儿再看，最多等 3 秒，之后照原来的做法重建。
  //   写回完成、索引变化（外部改了笔记）、打字挡下的重画放开后的重画都会再走到这里（与原来一样），页面不会停在旧数据上。
  const stale = () => !!d && version !== plugin.index.version;
  function rebuild(){
    const clock = plugin.clock();
    const m = d!;
    Object.assign(m, buildModel(plugin.index, clock, m)); version = plugin.index.version; persist.reset(m); syncTries = 0;
    // 撤销期内删掉的任务：笔记还在（快照里也留着，纸条消失后照常进回收站），但不放回货单
    if (hold.size) { m.tasks = m.tasks.filter(t => !hold.has(t.id)); m.goals = m.goals.filter(g => !hold.has(g.id)); m.people = m.people.filter(x => !hold.has(x.id)); for (const p of m.projects) { p.goalIds = p.goalIds.filter(id => !hold.has(id)); p.peopleIds = p.peopleIds.filter(id => !hold.has(id)); } for (const t of m.tasks) if (t.peopleIds?.some(id => hold.has(id))) t.peopleIds = t.peopleIds.filter(id => !hold.has(id)); }
  }
  function model(): Model{
    const clock = plugin.clock();
    if (!d) { d = buildModel(plugin.index, clock, null); version = plugin.index.version; persist.reset(d); }
    // 有还没写回的改动时先不按笔记重建（否则内存里刚改的会被旧笔记盖掉）；写回之后再重建
    // deferred：这个任务里已经比较过、发现有未标记的修改——后面再读模型（core.data 一次重画要读很多回）就不再逐项比较（大仓库一次约 30ms）
    else if (stale() && !dirty && !deferred && !persist.pending(d, {hold})) rebuild();
    else if (stale() && !dirty) { deferred = true; syncSoon(); }
    Object.assign(d.clock, clock);
    return d;
  }
  // 稍后按索引重建（若那时没有未写回的改动、不在写回中、详情里没在打字），再重画当前页
  function syncSoon(wait = 0){
    if (syncTimer || closed) return;
    syncTimer = window.setTimeout(() => {
      syncTimer = 0; deferred = false;
      // 有未写回的改动：写回完成后（flush 的 finally）再来；打字时（holdRender）：挡下的重画放开时会再走到 model()
      if (closed || dirty || writing || !stale() || view.taskPlus?.holdRender?.()) return;
      if (persist.pending(d!, {hold}) && syncTries < 10) { syncTries++; syncSoon(300); return; }
      rebuild();
      if (view.page !== 'today') view.render(true);
    }, wait);
  }
  // 每次操作之后（点击、提交、拖放、改值、离开输入框……）稍等一下，把改动写回笔记；同一串操作合并成一次
  // 比较本身在大仓库（5000 篇）要 30ms 左右，放进空闲时间，不占动画帧
  const idle = (fn: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(fn, {timeout: 600}) : window.setTimeout(fn, 0));
  const scheduleWrite = () => {
    window.clearTimeout(timer);
    // 写回失败已在 flush 里提示（feedback），这里接住，不再往外抛
    timer = window.setTimeout(() => idle(() => { flush().catch(() => undefined); }), 150);
  };
  function flush(): Promise<number>{
    if (writing) return writing;
    if (!d || !dirty) return Promise.resolve(0);
    const started = revision;
    writing = persist.commit(d, {hold}).then(n => {
      if (started === revision) dirty = false;
      if (n) view.perf.writes = (view.perf.writes || 0) + n;
      return n;
    }).catch((error: Error) => {
      view.frame.feedback(error.message + '，下次操作时重试');
      throw error;
    }).finally(() => {
      writing = null;
      if (closed) return;
      if (dirty && started !== revision) scheduleWrite();
      if (!dirty && version !== plugin.index.version) view.render(true);
    });
    return writing;
  }
  const editablePages = '#thought, #tasks, #projects, #review, #library';
  const commit = (event: Event) => {
    // 导航、搜索、罗盘等外壳操作不会改原型模型。撤销按钮仍可能改它。
    if (closed || !(event.target as Element).closest?.(editablePages + ', #feedback [data-action="undo"]')) return;
    dirty = true; revision++; scheduleWrite();
  };
  // 先记下操作，再让原型的捕获监听器处理它。写入结束前保持内存模型，避免索引回声覆盖后续拖放。
  for (const type of ['click', 'submit', 'change', 'drop', 'focusout', 'pointerup', 'keyup'] as const) view.registerDomEvent(view.root, type, commit, {capture: true, passive: true});
  // “展开 … Markdown”（0.7）：不在页面底部展开源码，直接在 Obsidian 的新标签页里打开这篇笔记（项目、任务、文献与书籍、季度复盘；思索页的两处在 thought.ts）
  const quarterName = (date: string) => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
  const SOURCE: Record<string, (b: HTMLElement) => string | null | undefined | Promise<string>> = {'project-source': () => d!.ui.projectSelected, 'task-source': b => b.dataset.id || d!.ui.taskDetail, 'library-source': () => d!.ui.librarySelected?.id,
    'review-source': async () => { const q = quarterName(d!.clock.date), hit = plugin.index.quarters.get(q); if (hit) return hit.path; const path = `${FOLDERS.quarters}/${q}.md`; if (!plugin.writer.exists?.(path)) await plugin.writer.create(path, '---\n---\n'); return path; }};
  // 第一个 await 之前的部分（拦下点击）是同步执行的，与原来直接登记 async 监听器相同
  async function openSource(e: MouseEvent){
    const b = (e.target as Element).closest?.<HTMLElement>('[data-p2]'), get = b && SOURCE[b.dataset.p2!]; if (!get || !d) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const path = await get(b);
    if (path && plugin.writer.exists?.(path) !== false) plugin.writer.open(path); else view.frame.feedback('这一项还没有对应的笔记');
  }
  view.registerDomEvent(view.root, 'click', e => { void openSource(e); }, {capture: true});
  const core = {
    get data(){ return model(); },
    ink, circle, icon, star, inkV, circleV, // inkV / circleV：风景的描述版画笔（draw/scene.ts）
    render: () => view.render(true),
    navigate: (page: string) => view.go(page),
    drawScenery: () => view.drawScenery(),
    announce: (msg: string | undefined, undo?: (() => unknown) | null) => view.frame.feedback(msg!, undo),
    // 仓库里有 PDF 就在 Obsidian 里打开；Zotero 导进来的文献没有时，用笔记里的 zotero:// 链接在 Zotero 里打开
    openPDF: (path: string | undefined) => { if (plugin.writer.openPDF?.(path!)) return; const z = plugin.index.literature.get(path!)?.zotero; if (z) { window.open(z); view.frame.feedback('已在 Zotero 里打开'); return; } view.frame.feedback('这篇笔记没有链接到仓库中的 PDF'); },
    newProject: (title: string, ideaId: string) => p2?.newProject(title, ideaId),
    // 项目页里点里程碑下的任务：完成 / 重新打开（原型 paper.js 的 complete）
    complete(id: string){ if (view.taskPlus?.complete(id)) return; const m = d!, t = m.tasks.find(x => x.id === id); if (!t) return; const done = t.status !== 'done'; if (done) completeTask(m, t); else reopenTask(m, t);
      view.frame.feedback(t.title, null, done ? 'check' : 'circle'); view.render(true); },
  };
  return {
    get data(){ return d; },
    model,
    hold,
    // 插件自己改了模型（键盘、计时器、撤销纸条消失）之后调用：照常排一次写回
    touch(){ if (closed) return; dirty = true; revision++; scheduleWrite(); },
    // 改完模型马上写回、等写完（今日页完成任务用：它的画面读索引，要等笔记写好）
    async settle(){ if (closed) return; dirty = true; revision++; window.clearTimeout(timer);
      for (let i = 0; i < 3 && (writing || dirty); i++) { try { await (writing || flush()); } catch { return; } } },
    // nav：只有版式与模型仍有效时，才直接露出已经画好的页面。
    render(page: string, nav: boolean, width: number, height: number){
      const m = model(); p2 ??= createPhase2(core);
      // r14 只给思索页画灯塔光束（beamV）；原来那支带 data-draw-path 的笔只有完成态海景用，这里用不到，第 3b 期删去
      if (!art) { const r12 = createR12Art({data: m, ink, circle, icon});
        art = {r12, r14: maritimeArt({ink: r12.L, curve: ink, inkV: r12.LV, curveV: inkV})}; }
      thought ??= createThought({core, r12Art: art.r12, r14Marine: art.r14, view});
      ai ??= createAI({core, r12Art: art.r12, view}); // 规范收尾批：原来另传的 aiEnabled 没人读（createAI 不收它），删去
      m.ui.page = page;
      view.root.toggleAttribute('data-goal-paper', page === 'thought' && m.goals.some(g => g.id === m.ui.goal)); // 0.8：只有在规划里开着目标纸时，“还有 N 项”才让开
      for (const id of PAGES) { const el = view.root.querySelector<HTMLElement>('#' + id); if (el) el.hidden = id !== page; }
      view.root.querySelector<HTMLElement>('#sky')!.hidden = page !== 'thought';
      const R = view.root, layout = [plugin.index.version, m.clock.date, m.clock.time, width, height, R.dataset.theme, R.dataset.fontScale];
      const signature = () => {
        // 货舱行数最多。其它页面展开详情或换标签，不会改变货舱已经画好的内容。
        // 0.9.3（评审 P1-5）：值为空的键不算（离开任务页时会补上 taskMenuAt / taskSelection = null，原来让第二次进来整页重画）
        const ui = page === 'tasks'
          ? Object.entries(m.ui).filter(([key, v]) => v != null && /^(task|cargo|person)/.test(key) || ['newList', 'newView', 'preparedMeeting', 'paused'].includes(key))
          : m.ui;
        return JSON.stringify([...layout, ui, page === 'ai' ? (m.ai?.thread as unknown[] | undefined)?.length : null]);
      };
      if (nav && !dirty && drawn[page] === signature()) return true;
      p2.sync();
      if (page === 'thought') thought.render();
      if (page === 'ai') ai.render();
      if (LOWER.includes(page)) p2.render();
      drawn[page] = signature();
      return false;
    },
    // 当前页的风景：描述（draw/scene.ts）
    scenery(box: DOMRect | null){ return parts(d!.ui.page === 'thought' && thought ? thought.scenery(box!) : null, d!.ui.page === 'ai' && ai ? ai.scenery(box!) : null, p2 ? p2.scenery(box!) : null); },
    fit(){ thought?.fit(); },
    get ai(){ return ai; },
    // 搜索结果跳过去：交给原型的 openObject（项目、任务、人物、文献、书籍）；大脑页的输入同时筛选节点
    openObject(kind: string, id: string){ const m = model(); p2 ??= createPhase2(core); if (kind === 'task') m.ui.cargoInitialized = true; p2.openObject(kind, id); },
    brainSearch(q: string){ if (!p2) return; p2.brainSearch(q); if (d!.ui.page === 'brain') view.drawScenery(); },
    async close(){
      closed = true; window.clearTimeout(timer); window.clearTimeout(syncTimer); ai?.close();
      if (hold.size) { hold.clear(); dirty = true; } // 关掉视图时，还在撤销期的删除照常进回收站
      try { if (writing) await writing; if (dirty) await flush(); } catch { /* 写回失败已在 flush 里提示过（feedback）；关闭视图时不再重试 */ }
    },
    hide(){ view.root.removeAttribute('data-goal-paper'); for (const id of PAGES) { const el = view.root.querySelector<HTMLElement>('#' + id); if (el) el.hidden = true; } const sky = view.root.querySelector<HTMLElement>('#sky'); if (sky) sky.hidden = true; },
  };
}
