// 今日以外的七页：思索、指引，以及下方五页（任务／货舱、项目／海图、复盘、知识库、大脑）。
// 画面与交互直接用原型的页面模块（src/draw/proto/，由 tools/sync-proto.mjs 从原型复制并改成只作用于插件视图），
// 这里只做三件事：给它们一份由笔记建出来的数据（model.js）；把原型 paper.js 的“核心”接口接到插件视图上；改动后写回笔记（persist.js）。
import {createPhase2} from '../draw/proto/phase2.js';
import {assets, assetBoxes} from '../draw/proto/assets.js';
import {ink, circle, icon, star, esc, smooth} from '../draw/ink.js';
import {createR12Art} from '../draw/proto/paper-r12-art.js';
import {maritimeArt} from '../draw/proto/paper-maritime-r14.js';
import {createThought} from './thought.js';
import {createAI} from './ai.js';
import {buildModel} from '../data/model.js';
import {createPersist} from '../data/persist.js';
import {FOLDERS} from '../data/index.js';
import {completeTask, reopenTask} from '../data/complete.js';
import {dropTasks} from '../data/trash.js';
import {HOST} from '../host.js';
// 原型模块（paper-tasks.js 撤销“加任务”）经它拿掉任务并登记删除（P2-10，sync-proto 的改写表）
HOST.dropTasks = dropTasks;

export const LOWER = ['tasks', 'projects', 'review', 'library', 'brain'];
export const PAGES = ['thought', 'ai', ...LOWER];

export function createLower(view){
  const plugin = view.plugin;
  const drawn = {}; // 每一页上次画的时候的“输入”
  let d = null, p2 = null, thought = null, ai = null, art = null, version = -1, timer = 0, dirty = false;
  let revision = 0, writing = null, closed = false;
  const hold = new Set(); // 刚删掉、还能撤销的任务：纸条消失前不进回收站
  const persist = createPersist(plugin.writer);
  // 原型的页面模块在创建时就记住了 d 这个对象：之后只能原地更新它，不能换一个
  function model(){
    const clock = plugin.clock();
    if (!d) { d = buildModel(plugin.index, clock, null); Object.assign(d.cache, {assets, assetBoxes}); version = plugin.index.version; persist.reset(d); }
    // 有还没写回的改动时先不按笔记重建（否则内存里刚改的会被旧笔记盖掉）；写回之后再重建
    else if (version !== plugin.index.version && !dirty) {
      Object.assign(d, buildModel(plugin.index, clock, d)); version = plugin.index.version; persist.reset(d);
      // 撤销期内删掉的任务：笔记还在（快照里也留着，纸条消失后照常进回收站），但不放回货单
      if (hold.size) { d.tasks = d.tasks.filter(t => !hold.has(t.id)); d.goals = d.goals.filter(g => !hold.has(g.id)); d.people = d.people.filter(x => !hold.has(x.id)); for (const p of d.projects) { p.goalIds = p.goalIds.filter(id => !hold.has(id)); p.peopleIds = p.peopleIds.filter(id => !hold.has(id)); } for (const t of d.tasks) if (t.peopleIds?.some(id => hold.has(id))) t.peopleIds = t.peopleIds.filter(id => !hold.has(id)); }
    }
    Object.assign(d.clock, clock);
    return d;
  }
  // 每次操作之后（点击、提交、拖放、改值、离开输入框……）稍等一下，把改动写回笔记；同一串操作合并成一次
  // 比较本身在大仓库（5000 篇）要 30ms 左右，放进空闲时间，不占动画帧
  const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, {timeout: 600}) : setTimeout(fn, 0));
  const scheduleWrite = () => {
    clearTimeout(timer);
    timer = setTimeout(() => idle(() => flush().catch(() => {})), 150);
  };
  function flush(){
    if (writing) return writing;
    if (!d || !dirty) return Promise.resolve(0);
    const started = revision;
    writing = persist.commit(d, {hold}).then(n => {
      if (started === revision) dirty = false;
      if (n) view.perf.writes = (view.perf.writes || 0) + n;
      return n;
    }).catch(error => {
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
  const commit = event => {
    // 导航、搜索、罗盘等外壳操作不会改原型模型。撤销按钮仍可能改它。
    if (closed || !event.target.closest?.(editablePages + ', #feedback [data-action="undo"]')) return;
    dirty = true; revision++; scheduleWrite();
  };
  // 先记下操作，再让原型的捕获监听器处理它。写入结束前保持内存模型，避免索引回声覆盖后续拖放。
  for (const type of ['click', 'submit', 'change', 'drop', 'focusout', 'pointerup', 'keyup']) view.registerDomEvent(view.root, type, commit, {capture: true, passive: true});
  // “展开 … Markdown”（0.7）：不在页面底部展开源码，直接在 Obsidian 的新标签页里打开这篇笔记（项目、任务、文献与书籍、季度复盘；思索页的两处在 thought.js）
  const quarterName = date => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
  const SOURCE = {'project-source': () => d.ui.projectSelected, 'task-source': b => b.dataset.id || d.ui.taskDetail, 'library-source': () => d.ui.librarySelected?.id,
    'review-source': async () => { const q = quarterName(d.clock.date), hit = plugin.index.quarters.get(q); if (hit) return hit.path; const path = `${FOLDERS.quarters}/${q}.md`; if (!plugin.writer.exists?.(path)) await plugin.writer.create(path, '---\n---\n'); return path; }};
  view.registerDomEvent(view.root, 'click', async e => {
    const b = e.target.closest?.('[data-p2]'), get = b && SOURCE[b.dataset.p2]; if (!get || !d) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const path = await get(b);
    if (path && plugin.writer.exists?.(path) !== false) plugin.writer.open(path); else view.frame.feedback('这一项还没有对应的笔记');
  }, {capture: true});
  const core = {
    get data(){ return model(); },
    ink, circle, icon, star, esc,
    asset: name => assets[name] || '',
    render: () => view.render(true),
    navigate: page => view.go(page),
    drawScenery: () => view.drawScenery(),
    announce: (msg, undo) => view.frame.feedback(msg, undo),
    // 仓库里有 PDF 就在 Obsidian 里打开；Zotero 导进来的文献没有时，用笔记里的 zotero:// 链接在 Zotero 里打开
    openPDF: path => { if (plugin.writer.openPDF?.(path)) return; const z = plugin.index.literature.get(path)?.zotero; if (z) { window.open(z); view.frame.feedback('已在 Zotero 里打开'); return; } view.frame.feedback('这篇笔记没有链接到仓库中的 PDF'); },
    newProject: (title, ideaId) => p2?.newProject(title, ideaId),
    // 项目页里点里程碑下的任务：完成 / 重新打开（原型 paper.js 的 complete）
    complete(id){ if (view.taskPlus?.complete(id)) return; const t = d.tasks.find(x => x.id === id); if (!t) return; const done = t.status !== 'done'; if (done) completeTask(d, t); else reopenTask(d, t);
      view.frame.feedback(t.title, null, done ? 'check' : 'circle'); view.render(true); },
  };
  return {
    get data(){ return d; },
    model,
    hold,
    // 插件自己改了模型（键盘、计时器、撤销纸条消失）之后调用：照常排一次写回
    touch(){ if (closed) return; dirty = true; revision++; scheduleWrite(); },
    // 改完模型马上写回、等写完（今日页完成任务用：它的画面读索引，要等笔记写好）
    async settle(){ if (closed) return; dirty = true; revision++; clearTimeout(timer);
      for (let i = 0; i < 3 && (writing || dirty); i++) { try { await (writing || flush()); } catch { return; } } },
    // nav：只有版式与模型仍有效时，才直接露出已经画好的页面。
    render(page, nav, width, height){
      model(); p2 ??= createPhase2(core);
      if (!art) { const r12 = createR12Art({data: d, ink, circle, icon, esc}), sketchMark = (pts, size = 1.3, color = '#1C2A35') => ink(pts, size, color, `data-draw-path="M${smooth(pts).map(q => q.map(n => n.toFixed(2)).join(',')).join('L')}" data-draw-width="${size}"`);
        art = {r12, r14: maritimeArt({ink: r12.L, curve: ink, circle, draw: sketchMark})}; }
      thought ??= createThought({core, r12Art: art.r12, r14Marine: art.r14, view});
      ai ??= createAI({core, r12Art: art.r12, view, aiEnabled: plugin.settings?.ai?.enabled});
      d.ui.page = page;
      view.root.toggleAttribute('data-goal-paper', page === 'thought' && d.goals.some(g => g.id === d.ui.goal)); // 0.8：只有在规划里开着目标纸时，“还有 N 项”才让开
      for (const id of PAGES) { const el = view.root.querySelector('#' + id); if (el) el.hidden = id !== page; }
      view.root.querySelector('#sky').hidden = page !== 'thought';
      const R = view.root, layout = [plugin.index.version, d.clock.date, d.clock.time, width, height, R.dataset.theme, R.dataset.fontScale];
      const signature = () => {
        // 货舱行数最多。其它页面展开详情或换标签，不会改变货舱已经画好的内容。
        // 0.9.3（评审 P1-5）：值为空的键不算（离开任务页时会补上 taskMenuAt / taskSelection = null，原来让第二次进来整页重画）
        const ui = page === 'tasks'
          ? Object.entries(d.ui).filter(([key, v]) => v != null && /^(task|cargo|person)/.test(key) || ['newList', 'newView', 'preparedMeeting', 'paused'].includes(key))
          : d.ui;
        return JSON.stringify([...layout, ui, page === 'ai' ? d.ai?.thread?.length : null]);
      };
      if (nav && !dirty && drawn[page] === signature()) return true;
      p2.sync();
      if (page === 'thought') thought.render();
      if (page === 'ai') ai.render();
      if (LOWER.includes(page)) p2.render();
      drawn[page] = signature();
      return false;
    },
    scenery(box){ return (d.ui.page === 'thought' && thought ? thought.scenery(box) : '') + (d.ui.page === 'ai' && ai ? ai.scenery(box) : '') + (p2 ? p2.scenery(box) : ''); },
    fit(){ thought?.fit(); },
    get ai(){ return ai; },
    // 搜索结果跳过去：交给原型的 openObject（项目、任务、人物、文献、书籍）；大脑页的输入同时筛选节点
    openObject(kind, id){ model(); p2 ??= createPhase2(core); if (kind === 'task') d.ui.cargoInitialized = true; p2.openObject(kind, id); },
    brainSearch(q){ if (!p2) return; p2.brainSearch(q); if (d.ui.page === 'brain') view.drawScenery(); },
    async close(){
      closed = true; clearTimeout(timer); ai?.close();
      if (hold.size) { hold.clear(); dirty = true; } // 关掉视图时，还在撤销期的删除照常进回收站
      try { if (writing) await writing; if (dirty) await flush(); } catch {}
    },
    hide(){ view.root.removeAttribute('data-goal-paper'); for (const id of PAGES) { const el = view.root.querySelector('#' + id); if (el) el.hidden = true; } const sky = view.root.querySelector('#sky'); if (sky) sky.hidden = true; },
  };
}
