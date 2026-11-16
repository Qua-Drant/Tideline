// 固定的框：侧栏、顶部条（日期、记录、罗盘）、纸（风景 + 各页）、反馈条。只建一次；之后只改当前页、日期时刻、指针角度。
// 结构和类名照原型 index.html，样式由 prototype.css 接管。
// 第 3 期：DOM 构建（draw/dom.ts），不再拼 HTML 字符串。每个函数对应原来的一段模板，结构一一对应。
import {inkEl, circleEl, iconEl, quillIconEl, INK, TICK} from './draw/ink.ts';
import {h, svg, setNodes} from './draw/dom.ts';

/** 侧栏的一项：[页名, 显示名, 图标] */
export type NavItem = [id: string, name: string, icon: string];
export const NAV: NavItem[] = [['thought', '思索', 'star'], ['ai', '指引', 'flag'], ['today', '今日', 'sunrise'], ['tasks', '任务', 'box'], ['projects', '项目', 'route'], ['review', '复盘', 'book'], ['library', '知识库', 'lead'], ['brain', '大脑', 'nodes']];
/** 罗盘指针指向每一页的角度（度） */
export const ANGLE: Record<string, number> = {thought: 0, ai: 45, today: 90, tasks: 108, projects: 126, review: 144, library: 162, brain: 180};
export const READY = new Set(['thought', 'ai', 'today', 'tasks', 'projects', 'review', 'library', 'brain']); // 已经做好的页；其余在侧栏里置灰

/** 手写字（原型 paper-handfont-r28.js 的 createHandFont）：框只用它写“记录”两个字 */
export interface HandFont {
  text(str: string, options?: {size?: number; color?: string; weight?: number; gap?: number}): string;
  /** text 的节点版（同样的结构） */
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
// 与 pages/thought.js 的 THOUGHT_HTML、pages/ai.js 的 AI_HTML、ui/capture.js 的 CAPTURE_HTML、ui/map-search.js 的 MAP_HTML / SEARCH_HTML 逐个元素对应。
// 那几个模块还没改成 DOM 构建（本期只许改它们的导入），字符串常量留在原处、已不再使用；改它们的那一期把这几个函数搬回去、删掉常量。
// 原模板里元素之间的换行（只在 THOUGHT_HTML 里）不再写出：它们落在块级元素之间，不占位置（等价性校验逐个量过，见 dev/compare/phase3a）。
function mapShell(){ return h('div', {id: 'map', class: 'map paper-strip', hidden: true}); }
function captureShell(){
  return h('div', {id: 'capture', class: 'capture paper-strip', hidden: true},
    h('div', {id: 'capture-types', class: 'capture-types'}),
    h('form', {id: 'capture-form'}, h('input', {id: 'capture-input', 'aria-label': '记一笔', autocomplete: 'off'}), h('div', {id: 'capture-tokens'})),
    h('button', {class: 'icon-button', 'data-action': 'capture-save', 'aria-label': '记下'}, '↵'));
}
function searchShell(){
  return h('div', {id: 'search', class: 'global-search paper-strip hand-popup', hidden: true},
    h('form', {class: 'line-form', role: 'search'},
      h('input', {id: 'global-query', 'aria-label': '搜索任务、想法和提示词', autocomplete: 'off'}),
      h('button', {class: 'icon-button', 'data-action': 'close-search', type: 'button', 'aria-label': '关闭搜索'}, '×')),
    h('div', {id: 'search-results'}));
}
function thoughtShell(){
  return h('section', {id: 'thought', class: 'page thought', 'aria-label': '思索', hidden: true},
    h('div', {class: 'sky-interactions', id: 'sky-interactions'},
      h('button', {class: 'sky-empty', id: 'sky-empty', 'aria-label': '在天空记下想法', hidden: true}),
      h('div', {id: 'weeks'}), h('div', {id: 'stars'}),
      h('button', {id: 'lighthouse-toggle', class: 'lighthouse-hit', 'aria-label': '熄灭灯塔，查看想法', 'aria-pressed': 'true'})),
    h('div', {id: 'planning', class: 'planning'},
      h('div', {class: 'goals', id: 'goals'}),
      h('button', {class: 'fold week-fold', 'data-action': 'week-note', 'aria-label': '展开本周周记'}),
      h('div', {id: 'week-board', class: 'week-board'})),
    h('div', {id: 'ideas', class: 'ideas', hidden: true},
      h('div', {class: 'ideas-layout'},
        h('aside', {class: 'ideas-index'}, h('div', {id: 'idea-heatmap', class: 'idea-heatmap'}), h('div', {id: 'idea-filters', class: 'idea-filters'})),
        h('div', {class: 'ideas-stream'},
          h('form', {id: 'idea-form', class: 'idea-composer'},
            h('textarea', {id: 'idea-input', 'aria-label': '记下一条想法', placeholder: '现在的想法是…', rows: 1}),
            h('div', {class: 'composer-bottom'},
              h('div', {class: 'composer-tag-tools', 'data-expanded': 'false'},
                h('button', {class: 'composer-tag-toggle', id: 'idea-tag-toggle', type: 'button', 'aria-label': '选择想法标签', 'aria-controls': 'idea-tag-drawer', 'aria-expanded': 'false'},
                  h('span', {id: 'composer-mark', 'aria-hidden': 'true'})),
                h('div', {class: 'composer-tag-runway'},
                  h('div', {id: 'idea-tag-drawer', class: 'tag-inline-drawer', role: 'group', 'aria-label': '想法标签选择', 'aria-hidden': 'true', inert: true},
                    h('div', {id: 'tag-inline-options', class: 'tag-inline-options'})),
                  h('div', {id: 'chosen-tag-wrap', class: 'chosen-tag-wrap'}, h('div', {id: 'composer-tags', class: 'composer-tags'})))),
              h('button', {class: 'text-button', type: 'submit'}, '记下'))),
          h('div', {id: 'idea-list', class: 'idea-feed'})))));
}
function aiShell(){
  return h('section', {id: 'ai', class: 'page ai', 'aria-label': '指引', hidden: true},
    h('div', {class: 'mast-scene'}, h('div', {id: 'flags', class: 'flags'})),
    h('div', {class: 'ai-window'},
      h('div', {id: 'connection'}), h('div', {id: 'privacy'}),
      h('div', {class: 'native-workspace'},
        h('div', {class: 'native-library'},
          h('form', {class: 'line-form prompt-search', role: 'search'},
            h('span', {id: 'search-icon'}),
            h('input', {id: 'prompt-query', 'aria-label': '搜索提示词', placeholder: '搜索提示词…', autocomplete: 'off'})),
          h('div', {id: 'prompts'})),
        h('div', {id: 'native-content'})),
      h('form', {id: 'handoff-form', class: 'line-form handoff'},
        svg('svg', {id: 'handoff-outline', viewBox: '0 0 601 83', preserveAspectRatio: 'none', 'aria-hidden': 'true'}),
        h('textarea', {id: 'handoff-input', placeholder: '写下问题，或补充你的思路…（@ 提到笔记）', 'aria-label': '对话草稿', rows: 2}),
        h('button', {id: 'native-send', type: 'submit', 'aria-label': '发送对话草稿'})),
      h('div', {id: 'native-error', role: 'status', hidden: true})));
}

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
