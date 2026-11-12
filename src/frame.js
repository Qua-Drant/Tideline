// 固定的框：侧栏、顶部条（日期、记录、罗盘）、纸（风景 + 各页）、反馈条。只建一次；之后只改当前页、日期时刻、指针角度。
// 结构和类名照原型 index.html，样式由 prototype.css 接管。
import {ink, circle, icon, quillIcon, esc, INK, TICK} from './draw/ink.js';
import {THOUGHT_HTML} from './pages/thought.js';
import {AI_HTML} from './pages/ai.js';
import {CAPTURE_HTML} from './ui/capture.js';
import {MAP_HTML, SEARCH_HTML} from './ui/map-search.js';

export const NAV = [['thought', '思索', 'star'], ['ai', '指引', 'flag'], ['today', '今日', 'sunrise'], ['tasks', '任务', 'box'], ['projects', '项目', 'route'], ['review', '复盘', 'book'], ['library', '知识库', 'lead'], ['brain', '大脑', 'nodes']];
export const ANGLE = {thought: 0, ai: 45, today: 90, tasks: 108, projects: 126, review: 144, library: 162, brain: 180};
export const READY = new Set(['thought', 'ai', 'today', 'tasks', 'projects', 'review', 'library', 'brain']); // 已经做好的页；其余在侧栏里置灰

const MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAY = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
function isoWeek(date){ const d = new Date(date + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - y) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); }

export function buildFrame(root, hand){
  root.innerHTML = `<nav class="rail" aria-label="潮线"><div id="modules">${NAV.map(([id, name, ic]) => `<button class="module" ${READY.has(id) ? `data-page="${id}"` : 'disabled aria-disabled="true"'} aria-label="${name}${READY.has(id) ? '' : '（还没做）'}">${icon(ic, 20, 'currentColor')}<span>${name}</span></button>`).join('')}</div><button class="module settings" data-action="settings" aria-label="设置" aria-pressed="false"><span id="settings-icon">${icon('helm')}</span><span>设置</span></button></nav>
<header class="page-head"><div class="date-block"><span class="day mono"></span><div class="date-copy"><span id="date-label"></span><time class="mono" id="clock"></time></div></div>
<div class="head-actions"><button class="quill-button hand-panel" id="capture-toggle" aria-label="记录" title="记录（记一笔）" aria-expanded="false"><span id="capture-quill" aria-hidden="true">${quillIcon()}</span><b class="quill-label" aria-hidden="true">${hand.text('记录', {size: 17})}</b></button>
<div class="compass" id="compass-toggle" role="img" aria-label="罗盘"><svg id="compass-svg" viewBox="0 0 64 64" aria-hidden="true"></svg></div></div></header>
${MAP_HTML}
${CAPTURE_HTML}
<main class="sheet" id="sheet"><div id="sky" class="sky" hidden></div><svg id="scenery" class="scenery" aria-hidden="true"></svg>
<section id="today" class="page today" aria-label="今日" hidden></section>
${THOUGHT_HTML}
${AI_HTML}
<section id="placeholder" class="page" hidden><p class="compass-placeholder"></p></section>
<div id="help" class="help" hidden></div></main>
${SEARCH_HTML}
<div class="feedback" id="feedback" role="status" aria-live="polite"></div>`;
  const modules = new Map([...root.querySelectorAll('#modules [data-page]')].map(button => [button.dataset.page, button]));
  const compass = root.querySelector('#compass-svg');
  let marks = circle(32, 32, 27, 1.25);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, inner = i % 4 === 0 ? 22 : 24;
    marks += ink([[32 + Math.sin(a) * inner, 32 - Math.cos(a) * inner], [32 + Math.sin(a) * 27, 32 - Math.cos(a) * 27]], 1.2, i % 4 === 0 ? INK : TICK);
  }
  compass.innerHTML = marks + `<g data-morph="compass-needle">${ink([[32, 13], [28, 35], [32, 32], [36, 35], [32, 13]], 1.4)}${ink([[32, 32], [32, 49]], 1.2)}</g>` + circle(32, 32, 2, 1.4);
  const needle = compass.querySelector('[data-morph="compass-needle"]');
  let current;
  const memo = {}, same = (k, v) => { const j = JSON.stringify(v); if (memo[k] === j) return true; memo[k] = j; return false; };
  return {
    nav(page){
      const next = modules.get(page);
      if (next === current) return;
      current?.removeAttribute('aria-current');
      next?.setAttribute('aria-current', 'page');
      current = next;
    },
    clock(date, time){ if (same('clock', [date, time])) return;
      root.querySelector('.date-block .day').textContent = String(Number(date.slice(8)));
      const d = new Date(date + 'T12:00:00Z');
      root.querySelector('#date-label').textContent = `${MONTH[d.getUTCMonth()]} · ${WEEKDAY[d.getUTCDay()]} · 第 ${isoWeek(date)} 周 · `;
      root.querySelector('#clock').textContent = time;
    },
    // 罗盘只指示当前所在的层（0.3 起不再点开小地图）
    compass(page){ if (same('compass', page)) return; needle.setAttribute('transform', `rotate(${ANGLE[page]} 32 32)`); root.querySelector('#compass-toggle').setAttribute('aria-label', '罗盘：' + (NAV.find(n => n[0] === page)?.[1] || '')); },
    // action：{label, run}，给一个别的按钮（例如“清除示例”）；有它时纸条多留一会儿
    feedback(message, undo, result, action){
      const el = root.querySelector('#feedback');
      el.innerHTML = `${result ? `<span class="feedback-result" aria-hidden="true">${icon(result)}</span>` : ''}<span>${esc(message)}</span>${undo ? '<button data-action="undo">撤销</button>' : ''}${action ? `<button data-action="feedback-act">${esc(action.label)}</button>` : ''}`;
      clearTimeout(this.feedbackTimer); this.undo = undo; this.act = action?.run || null;
      this.feedbackTimer = setTimeout(() => { el.replaceChildren(); this.undo = null; this.act = null; }, action ? 15000 : 5000);
    },
  };
}
