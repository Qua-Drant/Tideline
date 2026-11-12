// 潮线的主视图：一整张纸。
// 一次渲染分三步，都在同一帧里：①数据 → 各区域 DOM（没变的区域不动）②量版式、补随手记窗口和航迹 ③风景（按版式缓存）与手绘框。
// 索引改动、时钟走到下一分钟、窗口改尺寸，都只排一次渲染（requestAnimationFrame 合并）。
import {ItemView} from 'obsidian';
import {buildFrame} from './frame.js';
import {createToday} from './pages/today.js';
import {dayView} from './data/day.js';
import {todayActions} from './data/write.js';
import {completeTask, reopenTask} from './data/complete.js';
import {ink, circle, icon, esc, buttonFrame, popupFrame, pillFrame} from './draw/ink.js';
import {createR12Art} from './draw/proto/paper-r12-art.js';
import {createHandFont} from './draw/proto/paper-handfont-r28.js';
import {createMore} from './ui/more.js';
import {createFocusGuard} from './ui/focus-guard.js';
import {createEmptyStates} from './ui/empty-states.js';
import {HOST} from './host.js';
import {createLower, PAGES} from './pages/lower.js';
import {createSettingsPage} from './pages/settings.js';
import {createOnboarding} from './pages/onboarding.js';
import {createCapture} from './ui/capture.js';
import {createMapSearch} from './ui/map-search.js';
import {createEventMist} from './ui/event-mist.js';
import {createExampleMarks} from './ui/examples.js';
import {createTaskOverlays} from './ui/task-overlays.js';
import {createTaskPlus} from './ui/task-plus.js';
import {createPeople} from './ui/people.js';
import {createZoteroUi} from './ui/zotero-ui.js';
import {createTooltipPreference} from './ui/tooltip-preference.js';
import {createTodayReward} from './ui/today-reward.js';
import {FOLDERS} from './data/index.js';
import {changesSince} from './changes.js';
import './draw/proto/paper-transition-r37.js';
import {wrapAmbient} from './ui/ambient.js';
import './draw/proto/paper-help-r39.js'; // “?”说明：#help 显示时，每条说明绑到页面里的一个元素，手画箭头指过去（原型 R39） // 全站过场（原型 R37，见 docs/HANDOFF.md 关键决定 9）：装上 HOST.transition

export const VIEW_TYPE = 'tideline';

export class CompassView extends ItemView {
  constructor(leaf, plugin){ super(leaf); this.plugin = plugin; this.page = 'today'; this.ui = {detail: null, journalFollow: true}; this.perf = {renders: 0, last: null, samples: []}; }
  getViewType(){ return VIEW_TYPE; }
  getDisplayText(){ return '潮线'; }
  getIcon(){ return 'compass'; }

  async onOpen(){
    const p = this.plugin;
    this.root = this.contentEl.createDiv({cls: 'compass-root'});
    HOST.attach(this.root);
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.registerDomEvent(this.motionPreference, 'change', event => {
      if (event.matches) this.stopMotion();
    });
    // 过场模块要读的几样：是否就绪、过场设置（完整 / 简洁 / 关闭）、今天的日期、今日重点（大脑节点接力用）
    const view = this;
    HOST.onTransitionEnd = () => {
      if (!this.root.isConnected) return;
      if (this.redrawAtRest) {
        this.redrawAtRest = false;
        this.render(true);
      } else {
        this.more.update();
        this.taskOverlays.layout();
      }
    };
    HOST.paper = {ready: true, data: {get ui(){ return {...(view.lower?.data?.ui || {}), page: view.page}; },get settingsR27(){ return {motion: view.plugin.local?.device?.motion || 'full'}; }, get clock(){ return view.plugin.clock(); },
      get tasks(){ return view.lower?.data?.tasks || [...view.plugin.index.tasks.values()]; }}};
    this.hand = createHandFont();
    this.art = createR12Art({data: {clock: p.clock(), ui: {}, cache: {}}, ink, circle, icon, esc});
    this.frame = buildFrame(this.root, this.hand);
    this.today = createToday({root: this.root, art: this.art, ui: this.ui});
    this.todayReward = createTodayReward();
    // 输入法组字（拼音、五笔……）期间：整页不重画，也不让各页的 input 监听器处理半成品（原型的搜索框每打一下就重画并重设光标，
    // 会把组字打断，拼音字母留在框里）。组字结束时补发一次 input，再补上被挡下的重画。最先登记，排在所有监听器之前。
    // CodeMirror（任务正文）自己处理组字，不拦它的事件，只挡重画。
    this.composing = false;
    const cm = e => !!e.target?.closest?.('.cm-editor');
    this.registerDomEvent(this.root, 'compositionstart', () => { this.composing = true; }, {capture: true});
    this.registerDomEvent(this.root, 'input', e => { if ((e.isComposing || this.composing) && !cm(e)) e.stopImmediatePropagation(); }, {capture: true});
    this.registerDomEvent(this.root, 'compositionend', e => {
      this.composing = false;
      const target = e.target;
      setTimeout(() => {
        if (!cm(e) && target?.isConnected) target.dispatchEvent(new Event('input', {bubbles: true}));
        this.releaseRender();
      }, 0);
    }, {capture: true});
    this.actions = todayActions(p.writer, () => p.clock());
    this.more = createMore(this.root);
    createFocusGuard(this); // 0.9.3：Tab 不落到看不见的地方
    this.settingsPage = createSettingsPage({view: this, plugin: p});
    this.capture = createCapture({view: this, plugin: p});
    this.mapSearch = createMapSearch({view: this, plugin: p});
    this.eventMist = createEventMist({view: this});
    this.exampleMarks = createExampleMarks({view: this, plugin: p});
    this.taskPlus = createTaskPlus(this); // 任务页学滴答清单的交互（在原型的监听器之前登记）
    this.peopleUi = createPeople(this); // 0.9 人物：邮包、人物纸、见面了、项目的相关人员
    this.taskOverlays = createTaskOverlays(this);
    this.zoteroUi = createZoteroUi({view: this, plugin: p});
    this.emptyStates = createEmptyStates({view: this, plugin: p}); // 0.9.3：空状态与没有结果时的一句说明
    this.tooltipPreference = createTooltipPreference(this);
    this.onboarding = createOnboarding({view: this, plugin: p, ink, circle, icon, esc, hand: this.hand});
    // 首次起航的点击、表单、按键先给它（原型也是在捕获阶段先交给它）
    this.registerDomEvent(this.root, 'click', e => { if (this.onboarding.click(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }, {capture: true});
    this.registerDomEvent(this.root, 'submit', e => { if (e.target.dataset?.obForm && this.onboarding.submit(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); } }, {capture: true});
    this.registerDomEvent(document, 'keydown', e => { if (this.root.isConnected && this.onboarding.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }, {capture: true});
    // ?：只在潮线是当前视图、焦点不在输入框里时
    this.registerDomEvent(document, 'keydown', e => { if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || !this.root.isConnected || e.target.closest?.('input,textarea,select,[contenteditable],.cm-editor')) return;
      if (this.app.workspace.getActiveViewOfType?.(CompassView) !== this && !this.root.contains(document.activeElement)) return; e.preventDefault(); this.toggleHelp(); });
    // 打开时停在：上次所在的页，或今日
    const D = p.local?.device, last = p.local?.lastPage;
    if (D?.start === 'last' && last && (last === 'today' || PAGES.includes(last))) this.page = last;
    this.registerDomEvent(this.root, 'scroll', () => this.more.paint(), {capture: true, passive: true});
    // 字体（数字用的 IBM Plex Mono）晚到时版式会变：到了再重放一次“还有 N 项”
    document.fonts?.ready.then(() => { if (this.root.isConnected) this.more.update(); });
    if (document.fonts) this.registerDomEvent(document.fonts, 'loadingdone', () => this.more.update());
    this.applyDevice(false);
    this.registerEvent(this.app.workspace.on('css-change', () => this.theme()));
    this.registerDomEvent(this.root, 'click', e => this.click(e));
    this.registerDomEvent(this.root, 'submit', e => this.submit(e));
    this.registerDomEvent(this.root, 'pointerdown', e => this.dialDown(e));
    this.registerDomEvent(this.root, 'keydown', e => this.dialKey(e));
    this.unsub = p.index.subscribe(() => this.schedule());
    this.resize = new ResizeObserver(() => this.schedule()); this.resize.observe(this.root);
    this.registerInterval(window.setInterval(() => { const t = p.clock().time; if (t !== this.lastTime) this.schedule(); }, 15000));
    this.render();
    if (p.local && !p.local.onboarded) setTimeout(() => this.startVoyage(), 400);
    else setTimeout(() => this.upgradeSlip(), 600);
  }
  refreshAI(){ this.lower?.ai?.refresh(); }
  async onClose(){
    this.todayReward?.leave(); this.taskPlus?.leave(); this.taskPlus?.destroy?.(); clearTimeout(this.holdTimer);
    await this.lower?.close(); this.unsub?.(); this.resize?.disconnect(); cancelAnimationFrame(this.raf);
    if (HOST.root === this.root) {
      HOST.transition?.finish();
      HOST.onTransitionEnd = null;
      HOST.paper = null;
      HOST.detach();
    }
    this.sceneNodes = null;
  }

  // 配色：跟随 Obsidian（明暗主题）或固定纸 / 夜航
  theme(){ const t = this.plugin.local?.device?.theme || 'obsidian'; this.root.dataset.theme = t === 'obsidian' ? (document.body.classList.contains('theme-dark') ? 'night' : 'paper') : t; }
  // 这台设备的偏好生效：配色、字号、习惯旁的最近 7 天
  applyDevice(rerender = true){
    const D = this.plugin.local?.device || {};
    this.theme(); fontScale(this.root, Number(D.font) || 1);
    this.root.classList.toggle('compass-no-week', D.week === false);
    this.root.dataset.motion = D.motion || 'full';
    if (this.root.dataset.motion === 'off') this.stopMotion();
    this.tooltipPreference.apply();
    if (rerender) this.render(true);
  }
  stopMotion(){
    HOST.transition?.finish();
    this.todayReward?.settle();
  }
  openSettings(jump){ this.onboarding?.close(); this.settingsPage.open(jump); }
  // 升级后的小纸条（设计说明 22.1）：上次用的版本之后有变化就列出来，点 × 关掉；第一次装（走首次起航）不弹
  upgradeSlip(){
    const L = this.plugin.local, now = this.plugin.manifest?.version; if (!L || !now) return;
    const from = L.version; L.version = now; if (from !== now) this.plugin.saveSettings();
    if (!from || from === now) return;
    const list = changesSince(from, now); if (!list.length) return;
    this.root.querySelector('.upgrade-slip')?.remove();
    // 0.9.3（评审 P1-1）：按版本分组，只展开最近一个版本，其余收在“更早的变化”；纸是实的（不透字）；是对话框，Esc 关，关后焦点回原处
    const group = ([v, items]) => `<h4 class="upgrade-ver mono">${esc(v)}</h4><ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const [first, ...rest] = list, more = rest.reduce((n, [, items]) => n + items.length, 0);
    this.upgradeReturn = document.activeElement;
    this.root.querySelector('#sheet').insertAdjacentHTML('beforeend', `<div class="ob-slip ob-finale hand-popup upgrade-slip" role="dialog" aria-labelledby="upgrade-title"><button class="inline-close" data-action="close-upgrade" aria-label="关掉">×</button><h3 class="upgrade-title" id="upgrade-title">这次的变化<small class="mono">${esc(from)} → ${esc(now)}</small></h3><div class="upgrade-body">${group(first)}${rest.length ? `<details class="upgrade-more"><summary>更早的变化（${more} 条）</summary>${rest.map(group).join('')}</details>` : ''}</div></div>`);
    const slip = this.root.querySelector('.upgrade-slip');
    slip.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeUpgrade(); } });
    slip.querySelector('.inline-close').focus({preventScroll: true});
    this.frames();
  }
  closeUpgrade(){ const slip = this.root.querySelector('.upgrade-slip'); if (!slip) return; slip.remove(); const back = this.upgradeReturn; this.upgradeReturn = null; if (back?.isConnected && back !== document.body) back.focus?.({preventScroll: true}); }
  // 装着示例航程时写下第一篇自己的笔记：提示一次要不要清除示例（设计说明 22.5）。只问一次（记在这台设备上）。
  noteCreated(path){
    const L = this.plugin.local, ex = L?.examples || [];
    if (!ex.length || L.examplesAsked || !path.endsWith('.md') || ex.includes(path)) return false;
    const folders = ['journal', 'tasks', 'projects', 'people', 'goals', 'ideas', 'literature', 'books'].map(k => FOLDERS[k] + '/');
    if (!folders.some(f => path.startsWith(f))) return false;
    L.examplesAsked = true; this.plugin.saveSettings();
    this.frame.feedback('写下了第一篇自己的笔记。示例航程还要留着吗？', null, null, {label: '清除示例', run: () => { this.openSettings('data'); this.settingsPage.ask('clear-examples'); }});
    return true;
  }
  startVoyage(){ this.settingsPage.close(false); this.go('today'); this.onboarding.open(); }
  schedule(){ if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); }

  // force：界面状态在别处改过（例如展开详情）；不给就按“数据版本 + 时刻 + 尺寸 + 当前页 + 展开的详情 + 配色”判断要不要重画
  // 被挡下的重画：组字结束或停手后补一次
  releaseRender(){ clearTimeout(this.holdTimer); this.holdTimer = 0; if (this.renderHeld) { this.renderHeld = false; this.render(true); } }
  render(force = false){
    if (!this.root?.isConnected) return;
    // 组字中不重画；在任务详情里打字时，写回引起的重画等停手 1.2 秒后再做（不打断光标，不搬动编辑器）
    if (this.composing) { this.renderHeld = true; return; }
    const hold = this.taskPlus?.holdRender?.() || 0;
    if (hold) { this.renderHeld = true; clearTimeout(this.holdTimer); this.holdTimer = setTimeout(() => this.releaseRender(), hold); return; }
    const width = this.root.clientWidth, height = this.root.clientHeight;
    if (!width) return;
    const t0 = performance.now(), p = this.plugin, {date, time} = p.clock();
    const sig = [p.index.version, date, time, this.page, this.ui.detail, width, height, this.root.dataset.theme].join('|');
    if (!force && sig === this.sig) { this.perf.skipped = (this.perf.skipped || 0) + 1; return; }
    if (this.root.hasAttribute('data-r35-run')) this.redrawAtRest = true;
    this.sig = sig;
    this.lastTime = time;
    this.frame.nav(this.page); this.frame.clock(date, time); this.frame.compass(this.page);
    this.today.el.hidden = this.page !== 'today';
    if (this.page !== 'today') return this.renderLower(t0, width, height);
    this.lower?.hide();
    const todayKey = [p.index.version, date, time].join('|');
    if (this.todayKey !== todayKey) {
      this.view = dayView(p.index, date, time);
      this.todayKey = todayKey;
    }
    const v = this.view;
    this.today.render(v);
    const t1 = performance.now();
    const box = this.sheetBox(), rootBox = this.root.getBoundingClientRect();
    this.today.fit({...box, bottom: box.scroll ? Infinity : rootBox.bottom});
    this.more.update();
    const t2 = performance.now();
    const svg = this.root.querySelector('#scenery'), w = box.width, h = Math.max(box.height, 1);
    const scene = this.today.scenery(v, box);
    if (svg.dataset.w !== String(w) || svg.dataset.h !== String(h)) { svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.style.width = w + 'px'; svg.style.height = h + 'px'; svg.dataset.w = w; svg.dataset.h = h; }
    this.showScene(svg, scene);
    this.todayReward.show(svg, v, p.local?.device?.motion !== 'off' && !this.motionPreference.matches);
    this.frames();
    if (this.eventMist?.open) this.eventMist.position(); // 尺寸、上方文字变了，详情重新找位置
    const t3 = performance.now();
    this.perf.renders++; this.perf.last = {dom: +(t1 - t0).toFixed(2), layout: +(t2 - t1).toFixed(2), scenery: +(t3 - t2).toFixed(2), total: +(t3 - t0).toFixed(2)};
    this.perf.samples.push(this.perf.last.total); if (this.perf.samples.length > 50) this.perf.samples.shift();
  }

  // 下方五页：原型模块画 DOM，风景每次重画（原型就是这样；以后按页加缓存）
  createLower(){ return createLower(this); }
  renderLower(t0, width, height){
    this.lower ??= createLower(this);
    const reused = this.lower.render(this.page, this.navigating, width, height);
    const t1 = performance.now();
    // 和原型一样：先画风景与手绘框，版式定下来之后再放“还有 N 项”
    this.drawScenery(reused);
    const t2 = performance.now();
    this.more.update();
    const t3 = performance.now();
    this.perf.renders++; this.perf.last = {dom: +(t1 - t0).toFixed(2), scenery: +(t2 - t1).toFixed(2), layout: +(t3 - t2).toFixed(2), total: +(t3 - t0).toFixed(2), page: this.page};
  }
  // reused：这一页原样露出来，风景也用上次画好的那张（每页记一张）
  drawScenery(reused = false){
    if (this.page === 'today') { this.sig = null; return this.render(); }
    if (!reused && this.root.hasAttribute('data-r35-run')) this.redrawAtRest = true;
    this.scenes ??= {};
    const svg = this.root.querySelector('#scenery');
    const cached = reused && this.scenes[this.page];
    const box = cached ? null : this.root.querySelector('#sheet').getBoundingClientRect();
    const w = cached ? cached.w : box.width, h = cached ? cached.h : Math.max(box.height, 1);
    if (svg.dataset.w !== String(w) || svg.dataset.h !== String(h)) { svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.style.width = w + 'px'; svg.style.height = h + 'px'; svg.dataset.w = w; svg.dataset.h = h; }
    const scene = cached ? cached.scene : this.lower.scenery(box);
    if (!cached) this.scenes[this.page] = {w, h, scene};
    this.showScene(svg, scene);
    if (!cached || this.plugin.index.examples?.size) this.frames();
  }
  // 每页保留最近一张风景的节点；露出来时只换这一组，同名的 SVG 定义始终只挂一份。
  showScene(svg, html){
    this.sceneNodes ??= {};
    let scene = this.sceneNodes[this.page];
    if (scene?.html === html) {
      if (svg.__compassScene !== scene) svg.replaceChildren(...scene.nodes);
    }
    else {
      svg.innerHTML = html;
      wrapAmbient(svg); // 每页的手绘动态：外面套一层再动，不盖掉元素自己的定位
      scene = this.sceneNodes[this.page] = {html, nodes: [...svg.childNodes]};
    }
    svg.__compassScene = scene;
  }
  // “?”说明：按 ? 开关（不在输入框里时），换页时收起
  toggleHelp(on = this.root.querySelector('#help').hidden){ const h = this.root.querySelector('#help'); h.hidden = !on; if (!on) h.replaceChildren(); }
  go(page){
    if (page !== 'today' && !PAGES.includes(page)) return;
    if (page !== this.page) { this.toggleHelp(false); this.mapSearch?.toggleMap(false); this.eventMist?.dismiss(true); }
    if (this.settingsPage?.isOpen()) this.settingsPage.close(false);
    // 过场：换页前一刻量下旧画面（新画面在下面同步渲染完后的微任务里量），再用 Web Animations 播放
    if (page !== this.page && this.root.isConnected) HOST.transition?.before(this.page, page);
    if (this.page === 'today' && page !== 'today') this.todayReward.leave();
    if (this.page === 'tasks' && page !== 'tasks') { this.taskOverlays.close(); this.taskPlus.leave(); }
    if (this.plugin.local && this.plugin.local.lastPage !== page) { this.plugin.local.lastPage = page; this.plugin.saveSettings?.(); }
    this.page = page; this.ui.detail = null; this.ui.chooseFocus = false; this.root.querySelector('#sheet').scrollTop = 0;
    this.navigating = true;
    try { this.render(true); }
    catch (error) {
      // 换页绘制中断时，收起过场并清掉上一页的底图。下一次仍可重新渲染。
      const scene = this.root.querySelector('#scenery');
      if (scene.__compassScene !== this.sceneNodes?.[page]) { scene.replaceChildren(); scene.__compassScene = null; }
      HOST.transition?.finish();
      this.sig = null;
      throw error;
    } finally { this.navigating = false; }
  }

  // 纸的范围（风景的坐标系）。窄视图里纸会上下滚动（narrow.css）：这时取整段内容——左上角是内容的起点（随滚动位置换算），
  // 宽是去掉右侧留白的内容宽，高是今日页的内容高（不用 scrollHeight：风景自己也撑高滚动范围，会只增不减）。
  sheetBox(){
    const sheet = this.root.querySelector('#sheet'), r = sheet.getBoundingClientRect(), cs = getComputedStyle(sheet);
    if (cs.overflowY !== 'auto') return {...r.toJSON(), scroll: false};
    const w = sheet.clientWidth - (parseFloat(cs.paddingRight) || 0), top = r.top - sheet.scrollTop, page = this.today.el, h = page.offsetTop + page.offsetHeight;
    return {x: r.left, y: top, left: r.left, top, width: w, height: h, right: r.left + w, bottom: top + h, scroll: true};
  }

  // 手绘框：按钮（.outline）与面板（.hand-panel / .hand-pill），尺寸没变就不重画
  // 先把所有要画的框量完，再一起写：边量边写会让每个元素都触发一次重新排版（几十上百个框时要几十毫秒）
  frames(){
    this.taskPlus?.layout();
    this.taskOverlays?.layout();
    this.zoteroUi?.layout();
    this.emptyStates?.layout();
    this.exampleMarks?.apply(); // 示例笔记的淡墨与“例”字印（先加印，手绘框量到的才是加印后的尺寸）
    const todo = [], SEL = 'button.outline, .hand-panel, .hand-pill, .hand-popup, #capture, #map';
    // 只看露在外面的：侧栏、顶部条、当前这一页、盖在纸上的几层（隐藏的页里几百个按钮不必一个个看）
    const scopes = [this.root.querySelector('.rail'), this.root.querySelector('.page-head'), this.root.querySelector('#feedback'), this.root.querySelector('#capture:not([hidden])'), this.root.querySelector('#map:not([hidden])'), this.root.querySelector('#search:not([hidden])'),
      ...this.root.querySelectorAll('#sheet > section.page:not([hidden]), #sheet > :not(section):not(#scenery):not(#sky), .compass-root > .tour-card')].filter(Boolean);
    for (const scope of scopes) for (const el of [...(scope.matches(SEL) ? [scope] : []), ...scope.querySelectorAll(SEL)]) {
      const w = el.offsetWidth, h = el.offsetHeight; if (!w && !h) continue;
      const btn = el.matches('button.outline') && !el.matches('.hand-panel'), cls = btn ? 'hand-button-frame' : 'hand-popup-frame', key = w + ',' + h, first = el.firstElementChild, svg = first?.classList.contains(cls) ? first : null;
      if (svg?.dataset.size === key) continue;
      todo.push({el, w, h, btn, cls, key});
    }
    for (const {el, w, h, btn, cls, key} of todo) {
      let svg = el.firstElementChild?.classList.contains(cls) ? el.firstElementChild : el.querySelector(':scope > .' + cls);
      if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add(cls); svg.setAttribute('aria-hidden', 'true'); el.prepend(svg); }
      svg.dataset.size = key; svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.innerHTML = btn ? buttonFrame(w, h) : el.classList.contains('hand-pill') ? pillFrame(w, h) : popupFrame(w, h);
    }
    // 设置、首次起航和纸条不经过页面渲染：它们画完框后重新找滚动区，好画手绘小三角
    if (this.root.querySelector('.settings-view, .onboarding, .hand-popup, #search:not([hidden])') || this.moreModal) { this.moreModal = !!this.root.querySelector('.settings-view, .onboarding'); this.more?.update(); }
  }

  // 今日页完成 / 重新打开任务（P1-2）：和任务页走同一个 data/complete.js、同一套写回（lower.js 的模型 + persist.js），
  // 重复任务一样留完成记录并顺延。返回撤销：把顺延、完成记录一并撤回
  async toggleTask(id){
    const lower = this.lower ??= createLower(this), m = lower.model(), t = m.tasks.find(x => x.id === id); if (!t) return null;
    const {undo} = t.status === 'done' ? reopenTask(m, t) : completeTask(m, t);
    await lower.settle();
    return async () => { undo(); await lower.settle(); };
  }
  task(id){ return [...this.view.focus, ...this.view.other, ...this.view.trail].find(t => t.id === id) || this.plugin.index.tasks.get(id); }
  async click(e){
    const b = e.target.closest('button,[data-open]'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.page && b.closest('.rail')) { this.go(d.page); return; }
    if (d.action === 'settings' && b.closest('.rail')) { this.settingsPage.toggle(); return; }
    if (d.action === 'close-upgrade') { this.closeUpgrade(); return; }
    if (d.action === 'feedback-act') { const a = this.frame.act; this.frame.act = null; this.root.querySelector('#feedback').replaceChildren(); await a?.(); return; }
    if (d.action === 'undo') { const u = this.frame.undo; this.frame.undo = null; this.root.querySelector('#feedback').replaceChildren(); await u?.(); return; }
    if (this.page !== 'today') return; // 下方五页的点击由原型模块自己处理
    if (d.action === 'choose-focus' || d.action === 'cancel-focus') {
      this.ui.chooseFocus = d.action === 'choose-focus';
      this.render(true);
      this.root.querySelector(this.ui.chooseFocus ? '#focus .temporary-menu button' : '#focus [data-action="choose-focus"]')?.focus();
      return;
    }
    if (d.focus) {
      const task = this.view.other.find(t => t.id === d.focus && t.date === this.view.date);
      if (!task) return;
      const undo = await this.actions.chooseFocus(task);
      this.ui.chooseFocus = false;
      this.frame.feedback(task.title, undo);
      return;
    }
    if (d.complete) { const t = this.task(d.complete); if (!t) return; const undo = await this.toggleTask(t.id); if (!undo) return; this.frame.feedback(t.title, undo, t.status === 'done' ? 'circle' : 'check'); if (this.ui.detail === t.id) this.ui.detail = null; return; }
    if (d.detail) { this.ui.detail = this.ui.detail === d.detail ? null : d.detail; this.render(); return; }
    if (d.action === 'close-detail') { this.ui.detail = null; this.render(); return; }
    if (d.open) { this.plugin.writer.open(d.open); return; }
    if (d.habit) { await this.actions.cycleHabit(d.habit); return; }
  }
  async submit(e){
    if (e.target.id !== 'journal-form') return; e.preventDefault();
    const input = e.target.querySelector('input'), text = input.value.trim(); if (!text) return;
    input.value = ''; this.ui.journalFollow = true; await this.actions.addJournal(text);
  }
  // 拨盘：拖动时指针跟手（品红），松手写入；方向键 ±1
  dialValue(svg, e){ const r = svg.getBoundingClientRect(), cx = r.left + r.width * 87 / 174, cy = r.top + r.height * 86 / 100, a = Math.atan2(e.clientY - cy, e.clientX - cx); const t = Math.max(0, Math.min(1, ((a < 0 ? a + 2 * Math.PI : a) - Math.PI) / Math.PI)); return Math.round(1 + t * 9); }
  dialDown(e){
    const svg = e.target.closest('.dial'); if (!svg) return; e.preventDefault(); svg.setPointerCapture?.(e.pointerId); svg.classList.add('is-dragging');
    let value = this.dialValue(svg, e); const move = ev => { value = this.dialValue(svg, ev); this.preview(svg, value); };
    const up = async () => { svg.removeEventListener('pointermove', move); svg.classList.remove('is-dragging'); await this.actions.score(svg.dataset.question, value); };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up, {once: true}); this.preview(svg, value);
  }
  preview(svg, value){ const a = Math.PI + (value - 1) / 9 * Math.PI; let g = svg.querySelector('.needle'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.classList.add('needle'); svg.append(g); }
    g.innerHTML = ink([[87 - Math.cos(a) * 4, 86 - Math.sin(a) * 4], [87, 86], [87 + Math.cos(a) * 36, 86 + Math.sin(a) * 36]], 2, 'currentColor') + circle(87, 86, 3.1, 1.4, 'currentColor'); svg.setAttribute('aria-valuenow', value); svg.setAttribute('aria-valuetext', value); }
  async dialKey(e){
    const svg = e.target.closest?.('.dial'); if (!svg || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault();
    const now = Number(svg.getAttribute('aria-valuenow')) || 0, value = Math.max(1, Math.min(10, (now || (e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? 2 : 0)) + (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1)));
    this.preview(svg, value); await this.actions.score(svg.dataset.question, value);
  }
}

// 字号：把潮线样式表里所有以 px 写的字号按比例改一遍（原型 paper.js 的 applyFontScale；排版位置不变）
const fontBase = new WeakMap(); let fontNow = 1;
function fontScale(root, f){
  root.dataset.fontScale = String(f); if (f === fontNow) return; fontNow = f;
  const walk = rules => { for (const r of rules) { if (r.cssRules?.length) walk(r.cssRules); if (!(r instanceof CSSStyleRule) || !r.selectorText.includes('.compass-root')) continue;
    if (!fontBase.has(r)) fontBase.set(r, r.style.fontSize); const m = /^([\d.]+)px$/.exec(fontBase.get(r) || ''); if (!m) continue;
    r.style.setProperty('font-size', (+m[1] * f).toFixed(2) + 'px', r.style.getPropertyPriority('font-size')); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
}
