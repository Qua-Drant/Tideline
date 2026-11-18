// 固定的框：侧栏、顶部条（日期、记录、罗盘）、纸（风景 + 各页）、反馈条。只建一次；之后只改当前页、日期时刻、指针角度。
// 结构和类名照原型 index.html，样式由 prototype.css 接管。
// 第 3 期：DOM 构建（draw/dom.ts），不再拼 HTML 字符串。每个函数对应原来的一段模板，结构一一对应。
// 第 4b 期：指引页的外壳 aiShell 搬回 pages/ai.ts（原来的 AI_HTML 常量一并删去），这里改为引用。
import {inkEl, circleEl, iconEl, quillIconEl, INK, TICK} from './draw/ink.ts';
import {h, svg, setNodes} from './draw/dom.ts';
import {captureShell} from './ui/capture.ts';
import {mapShell, searchShell} from './ui/map-search.ts';
import {thoughtShell} from './pages/thought.ts';
import {aiShell} from './pages/ai.ts';

/** 侧栏的一项：[页名, 显示名, 图标] */
export type NavItem = [id: string, name: string, icon: string];
export const NAV: NavItem[] = [['thought', '思索', 'star'], ['ai', '指引', 'flag'], ['today', '今日', 'sunrise'], ['tasks', '任务', 'box'], ['projects', '项目', 'route'], ['review', '复盘', 'book'], ['library', '知识库', 'lead'], ['brain', '大脑', 'nodes']];
/** 罗盘指针指向每一页的角度（度） */
export const ANGLE: Record<string, number> = {thought: 0, ai: 45, today: 90, tasks: 108, projects: 126, review: 144, library: 162, brain: 180};
const READY = new Set(['thought', 'ai', 'today', 'tasks', 'projects', 'review', 'library', 'brain']); // 已经做好的页；其余在侧栏里置灰

/** 手写字（原型 paper-handfont-r28.ts 的 createHandFont）：框只用它写“记录”两个字 */
export interface HandFont {
  /** 一行手写字（svg.hand-text） */
  textEl(str: string, options?: {size?: number; color?: string; weight?: number; gap?: number}): SVGSVGElement;
}

/** 反馈条上的另一个按钮（例如“清除示例”） */
export interface FeedbackAction { label: string; run: () => unknown }

/** buildFrame 返回的框：改当前页、日期时刻、罗盘，显示反馈条 */
export interface Frame {
  nav(page: string): void;
  clock(date: string, time: string): void;
  compass(page: string): void;
  /** 反馈条：一句话，可带“撤销”（undo）、前面的小图标（result 是 icon 的名字）、另一个按钮（action；有它时纸条多留一会儿） */
  feedback(message: string, undo?: (() => unknown) | null, result?: string | null, action?: FeedbackAction): void;
  /** 当前反馈条上“撤销”要做的事；点了或纸条收起后为 null */
  undo?: (() => unknown) | null;
  /** 当前反馈条上另一个按钮要做的事 */
  act?: (() => unknown) | null;
  feedbackTimer?: ReturnType<typeof setTimeout>;
}

const MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAY = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
// Date 相减得毫秒数（JS 的隐式转换；类型上按 number 看）
function isoWeek(date: string){ const d = new Date(date + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round((((d as unknown as number) - (y as unknown as number)) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); }

// —— 各页的固定外壳 ——
// 随手记、小地图、搜索三个外壳第 3c 期已搬回 ui/capture.ts、ui/map-search.ts；思索页的外壳第 3d 期搬回 pages/thought.ts；指引页的外壳第 4b 期搬回 pages/ai.ts。

// —— 框本身 ——
function moduleButton([id, name, ic]: NavItem){
  const ready = READY.has(id);
  return h('button', {class: 'module', 'data-page': ready ? id : null, disabled: !ready, 'aria-disabled': ready ? null : 'true', 'aria-label': name + (ready ? '' : '（还没做）')},
    iconEl(ic, 20, 'currentColor'), h('span', null, name));
}
function frameNodes(hand: HandFont){
  return [
    h('nav', {class: 'rail', 'aria-label': '潮线'},
      h('div', {id: 'modules'}, NAV.map(moduleButton)),
      h('button', {class: 'module settings', 'data-action': 'settings', 'aria-label': '设置', 'aria-pressed': 'false'},
        h('span', {id: 'settings-icon'}, iconEl('helm')), h('span', null, '设置'))),
    h('header', {class: 'page-head'},
      h('div', {class: 'date-block'}, h('span', {class: 'day mono'}), h('div', {class: 'date-copy'}, h('span', {id: 'date-label'}), h('time', {class: 'mono', id: 'clock'}))),
      h('div', {class: 'head-actions'},
        h('button', {class: 'quill-button hand-panel', id: 'capture-toggle', 'aria-label': '记录', title: '记录（记一笔）', 'aria-expanded': 'false'},
          h('span', {id: 'capture-quill', 'aria-hidden': 'true'}, quillIconEl()),
          h('b', {class: 'quill-label', 'aria-hidden': 'true'}, hand.textEl('记录', {size: 17}))),
        h('div', {class: 'compass', id: 'compass-toggle', role: 'img', 'aria-label': '罗盘'}, svg('svg', {id: 'compass-svg', viewBox: '0 0 64 64', 'aria-hidden': 'true'})))),
    mapShell(),
    captureShell(),
    h('main', {class: 'sheet', id: 'sheet'},
      h('div', {id: 'sky', class: 'sky', hidden: true}), svg('svg', {id: 'scenery', class: 'scenery', 'aria-hidden': 'true'}),
      h('section', {id: 'today', class: 'page today', 'aria-label': '今日', hidden: true}),
      thoughtShell(),
      aiShell(),
      h('section', {id: 'placeholder', class: 'page', hidden: true}, h('p', {class: 'compass-placeholder'})),
      h('div', {id: 'help', class: 'help', hidden: true})),
    searchShell(),
    h('div', {class: 'feedback', id: 'feedback', role: 'status', 'aria-live': 'polite'}),
  ];
}
// 罗盘：外圈、16 个刻度、指针（data-morph="compass-needle"）、圆心
function compassNodes(){
  const ticks = [];
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, inner = i % 4 === 0 ? 22 : 24;
    ticks.push(inkEl([[32 + Math.sin(a) * inner, 32 - Math.cos(a) * inner], [32 + Math.sin(a) * 27, 32 - Math.cos(a) * 27]], 1.2, i % 4 === 0 ? INK : TICK));
  }
  return [circleEl(32, 32, 27, 1.25), ticks,
    svg('g', {'data-morph': 'compass-needle'}, inkEl([[32, 13], [28, 35], [32, 32], [36, 35], [32, 13]], 1.4), inkEl([[32, 32], [32, 49]], 1.2)),
    circleEl(32, 32, 2, 1.4)];
}
// 反馈条：前面的小图标、一句话、“撤销”、另一个按钮
function feedbackNodes(message: string, undo: unknown, result: string | null | undefined, action: FeedbackAction | undefined){
  return [result ? h('span', {class: 'feedback-result', 'aria-hidden': 'true'}, iconEl(result)) : null,
    h('span', null, message),
    undo ? h('button', {'data-action': 'undo'}, '撤销') : null,
    action ? h('button', {'data-action': 'feedback-act'}, action.label) : null];
}

export function buildFrame(root: HTMLElement, hand: HandFont): Frame{
  setNodes(root, () => frameNodes(hand));
  const modules = new Map([...root.querySelectorAll<HTMLButtonElement>('#modules [data-page]')].map((button): [string | undefined, HTMLButtonElement] => [button.dataset.page, button]));
  // 下面这些元素都在上面刚建的结构里
  const compass = root.querySelector('#compass-svg')!;
  setNodes(compass, compassNodes);
  const needle = compass.querySelector('[data-morph="compass-needle"]')!;
  let current: HTMLButtonElement | undefined;
  const memo: Record<string, string> = {}, same = (k: string, v: unknown) => { const j = JSON.stringify(v); if (memo[k] === j) return true; memo[k] = j; return false; };
  return {
    nav(page){
      const next = modules.get(page);
      if (next === current) return;
      current?.removeAttribute('aria-current');
      next?.setAttribute('aria-current', 'page');
      current = next;
    },
    clock(date, time){ if (same('clock', [date, time])) return;
      root.querySelector('.date-block .day')!.textContent = String(Number(date.slice(8)));
      const d = new Date(date + 'T12:00:00Z');
      root.querySelector('#date-label')!.textContent = `${MONTH[d.getUTCMonth()]} · ${WEEKDAY[d.getUTCDay()]} · 第 ${isoWeek(date)} 周 · `;
      root.querySelector('#clock')!.textContent = time;
    },
    // 罗盘只指示当前所在的层（0.3 起不再点开小地图）
    compass(page){ if (same('compass', page)) return; needle.setAttribute('transform', `rotate(${ANGLE[page]} 32 32)`); root.querySelector('#compass-toggle')!.setAttribute('aria-label', '罗盘：' + (NAV.find(n => n[0] === page)?.[1] || '')); },
    // action：{label, run}，给一个别的按钮（例如“清除示例”）；有它时纸条多留一会儿
    feedback(message, undo, result, action){
      const el = root.querySelector('#feedback')!;
      setNodes(el, () => feedbackNodes(message, undo, result, action));
      clearTimeout(this.feedbackTimer); this.undo = undo; this.act = action?.run || null;
      this.feedbackTimer = setTimeout(() => { el.replaceChildren(); this.undo = null; this.act = null; }, action ? 15000 : 5000);
    },
  };
}
