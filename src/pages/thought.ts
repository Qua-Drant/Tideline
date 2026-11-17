// 思索页（灯塔亮着：本周规划；熄灭：想法星空与想法流）。
// 原型里这一页的代码散在 paper.js 里（renderThought、renderIdeas、热力图、星空、标签、拖动排期、风景的 thought 分支），
// 这里逐个搬过来，只做两类改动：document → 插件根元素（HOST）；写死的日期（2026-08-03 起的热力图、第 40–52 周、2026-10-26 那一周）改成按时钟算。
// 数据是下方五页共用的那份 d（model.js），改动由 persist.js 写回笔记。
// 第 3d 期：转 TypeScript；页面结构改成 DOM 构建（draw/dom.ts），不再拼 HTML 字符串。每个函数对应原来的一段模板，结构、属性及其先后一一对应；
// 用户写的文字（想法、标签、任务名……）直接成为文本节点或属性值。页面的固定外壳（thoughtShell）从 frame.ts 搬回这里。
// 望远镜插图改用 asset-shapes.js 里的描述（tools/make-asset-shapes.mjs 生成）建节点，viewBox 直接取 assets.js 的 assetBoxes。
import {getStroke} from 'perfect-freehand';
import {HOST} from '../host.ts';
import {inkEl, circleEl, iconEl, starEl, randomFor, inkV, circleV, INK, TICK} from '../draw/ink.ts';
import type {Point} from '../draw/ink.ts';
import {h, svg, setNodes, insertNodes} from '../draw/dom.ts';
import type {Child} from '../draw/dom.ts';
import {sh, parts, partNodes} from '../draw/scene.ts';
import type {Part, Parts} from '../draw/scene.ts';
import {assetShapes} from '../draw/proto/asset-shapes.js';
import {assetBoxes} from '../draw/proto/assets.js';
import {Lexer} from '../draw/proto/vendor/marked.mjs';
import {createGoals} from '../ui/goals.ts';
import type {createR12Art} from '../draw/proto/paper-r12-art.ts';
import type {maritimeArt} from '../draw/proto/paper-maritime-r14.ts';
import type {Model, ModelIdea, UIState} from '../data/types.ts';
import type {CompassView} from '../view.ts';

/** 思索页用到的界面状态（d.ui 上的几项） */
interface ThoughtUI {
  week: number; ideaExpanded?: boolean; source?: string | null; menu?: string | null; drag?: string | null; goal?: string | null;
}
/** 思索页用到的画面缓存（d.cache 上的几项） */
interface ThoughtCache { ideaDraft?: string; tagSidebarScroll?: number; r12Sky?: unknown; skyFrame: {left: number; top: number; width: number; height: number} }
/** 下方各页的核心（pages/lower.js 的 core；还没转 TypeScript）里本页用到的几样 */
interface ThoughtCore { readonly data: Model; render(): void; announce: (msg: string | undefined, undo?: () => unknown) => void; newProject?(title: string, ideaId: string): void }
/** marked 的行内词元（只用到这几个字段） */
interface InlineToken { type: string; raw: string; text: string; href?: string; tokens?: InlineToken[] }
type R12Art = ReturnType<typeof createR12Art>;
type MaritimeArt = ReturnType<typeof maritimeArt>;

// 想法正文里的网址：marked 只切出行内词元，网址成为链接，其余原样成为文字（原来是拼 HTML，这里直接给节点）
function renderIdeaTokens(tokens: InlineToken[]): Child[]{
  return tokens.map((token): Child => {
    if (token.type !== 'link') {
      if (['em', 'strong', 'del'].includes(token.type)) {
        const at = token.raw.indexOf(token.text);
        if (at >= 0) return [token.raw.slice(0, at), renderIdeaTokens(token.tokens || []), token.raw.slice(at + token.text.length)];
      }
      return token.raw;
    }
    let href = token.href || '', label = token.text, tail = '';
    if (token.raw === label) {
      const punctuation = label.search(/[，。；！？、）】》」』：]/u);
      if (punctuation >= 0) {
        tail = label.slice(punctuation);
        label = label.slice(0, punctuation);
        href = href.slice(0, href.length - tail.length);
      }
    }
    if (!/^https?:\/\//i.test(href)) return token.raw;
    try { new URL(href); } catch { return token.raw; }
    return [h('a', {class: 'idea-web-link external-link', href, target: '_blank', rel: 'noopener noreferrer'}, label), tail];
  });
}
// vendor/marked.mjs 是 JS：它给的词元按上面的 InlineToken 看
const ideaLinks = (text: string): Child => /https?:\/\/|www\./i.test(text) ? renderIdeaTokens(Lexer.lexInline(text, {gfm: true}) as InlineToken[]) : text;

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'], MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const addDays = (date: string, n: number) => { const t = new Date(date + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
// Date 相减得毫秒数（JS 的隐式转换；类型上按 number 看）
export function isoWeek(date: string){ const d = new Date(date + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round((((d as unknown as number) - (y as unknown as number)) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); }

/** 思索页的固定外壳（框只建一次，frame.ts 调用）。原模板（THOUGHT_HTML）里元素之间的换行不再写出：它们落在块级元素之间，不占位置 */
export function thoughtShell(){
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

export function createThought({core, r12Art, r14Marine, view}: {core: ThoughtCore; r12Art: R12Art; r14Marine: MaritimeArt; view: CompassView}){
  const d = core.data, ui = d.ui as UIState & ThoughtUI, cache = d.cache as Model['cache'] & ThoughtCache;
  const $ = <T extends Element = HTMLElement>(s: string) => HOST.querySelector(s) as T;
  const announce = core.announce;
  const minutes = () => { const [h, m] = d.clock.time.split(':').map(Number); return h * 60 + m; };
  // 周号节点：本周前 4 周到后 8 周（原型固定是第 40–52 周，本周 44）
  const weekNodes = () => { const s = HOST.weekStart(d.clock.date); return Array.from({length: 13}, (_, i) => { const start = addDays(s, (i - 4) * 7); return {start, week: isoWeek(start)}; }); };
  const currentWeek = () => (weekNodes().find(n => n.week === ui.week) || weekNodes()[4]);
  function weekDates(): [string, number][]{ const base = currentWeek().start; return Array.from({length: 7}, (_, i) => { const x = addDays(base, i); return [x, Number(x.slice(8))]; }); }
  ui.week ??= isoWeek(d.clock.date);
  // 0.8：目标一排、目标详情纸、项目详情里的关联目标（src/ui/goals.ts）
  const goals = createGoals({core, view, render: () => renderThought()});

  // 规划：一天一栏（第一栏是未排期）
  function dayColumn([date, num]: [string | null, number | null]){
    const revDay = (x: string) => d.review?.days?.find(r => r.date === x), proj = (id: string) => d.projects?.find(p => p.id === id);
    const tasks = d.tasks.filter(t => date ? t.date === date : !t.date), done = tasks.filter(t => t.status === 'done').length, isToday = date === d.clock.date, future = !!date && date > d.clock.date, rv = date && revDay(date), wd = date ? WD[new Date(date + 'T12:00:00Z').getUTCDay()] : '';
    const hrs = isToday ? d.investments.reduce((n, x) => n + x.hours, 0) : rv ? rv.investments.reduce((n, x) => n + x.hours, 0) : 0, habits = isToday ? d.habits.map(h => h.value) : rv ? rv.habits : null;
    const head = date ? h('div', {class: `day-number ${isToday ? 'now' : ''}`}, num, h('small', null, wd, isToday ? ' · 今天' : '')) : h('div', {class: 'unscheduled-icon', 'aria-hidden': 'true'}, iconEl('box'), h('small', null, '未排期'));
    const sum = h('p', {class: 'day-sum'}, tasks.length ? h('span', null, `${date ? (future ? '计划' : '完成 ' + done + ' /') : '待排'} `, h('b', {class: 'mono'}, tasks.length), ' 件') : null, hrs ? h('span', {class: 'mono'}, `${hrs}h`) : null);
    const events = (d.planningEvents.get(date) || []).map(e => h('div', {class: 'day-event', role: 'listitem'}, h('span', {class: 'mono'}, e.time || '全天'), e.title));
    const items = tasks.map(t => h('div', {class: `plan-task ${t.status === 'done' ? 'done' : ''}`, role: 'listitem', tabindex: '0', draggable: 'true', 'data-plan': t.id, 'aria-label': `${t.title}，${date || '未排期'}，可拖动`},
      h('i', {class: 'pt-mark', 'aria-hidden': 'true'}, t.status === 'done' ? '✓' : ''), h('span', {class: 'pt-title'}, t.title), t.projectId && proj(t.projectId) ? h('small', {class: 'pt-project'}, proj(t.projectId)!.title) : null));
    const foot = habits ? h('div', {class: 'day-foot', 'aria-label': '习惯'}, habits.map(v => h('i', {class: v === null ? 'is-null' : v ? 'is-on' : 'is-off'}))) : null;
    return h('div', {class: `day-column ${isToday ? 'is-today' : ''} ${future ? 'is-future' : ''}`, role: 'list', 'data-drop': date || '', 'aria-label': date || '未排期'}, head, sum, events, items,
      !tasks.length && !events.length ? h('button', {type: 'button', class: 'day-empty-new', 'data-day-new': date || '', 'aria-label': `在${date ? num + '日' : '未排期'}记一件任务`, title: '在这天记一件任务'}, h('span', {'aria-hidden': 'true'}, '+')) : null, foot);
  }
  function renderThought(){
    const night = minutes() < 360 || minutes() >= 1140;
    $('#thought').classList.toggle('night', night); $('#planning').hidden = !ui.lamp; $('#ideas').hidden = ui.lamp;
    $('#lighthouse-toggle').setAttribute('aria-pressed', String(ui.lamp)); $('#lighthouse-toggle').setAttribute('aria-label', ui.lamp ? '熄灭灯塔，查看想法' : '点亮灯塔，查看规划'); $('#sky-empty').hidden = ui.lamp;
    renderGoalProgress();
    setNodes($('#week-board'), () => ([[null, null], ...weekDates()] as [string | null, number | null][]).map(dayColumn));
    renderIdeas(); renderSkyControls();
  }
  function renderGoalProgress(){ goals.renderRow(); }
  const selectedIdea = () => d.ideas.find(x => x.id === ui.idea) || d.ideas[0];
  function ideaCard(i: ModelIdea){
    const expanded = i.id === ui.idea && ui.ideaExpanded !== false;
    return h('article', {class: `idea-card ${expanded ? 'expanded' : ''}`, 'data-idea-card': i.id},
      h('div', {class: 'idea-card-meta'}, h('time', null, i.created.slice(0, 10)), ideaTagLinks(i), h('button', {class: 'idea-card-star', 'data-idea': i.id, 'aria-label': `展开 ${i.title}`}, ideaStar(i))),
      h('button', {class: 'idea-card-title', 'data-idea': i.id, 'aria-expanded': String(expanded)}, i.title),
      expanded ? h('div', {id: 'idea-detail', class: 'idea-detail'}, h('button', {class: 'fold', 'data-action': 'idea-source', 'aria-label': '展开想法的 Markdown'}), ideaBody(i)) : h('p', {class: 'idea-excerpt'}, ideaLinks(i.body.split('\n\n')[0])));
  }
  function renderIdeas(){
    renderHeatmap(); renderComposerTags(); $('#idea-form').dataset.empty = String(!(cache.ideaDraft || ''));
    const visible = d.ideas.filter(i => (!ui.ideaDate || i.created.slice(0, 10) === ui.ideaDate) && (!ui.ideaTag || tagsOf(i).includes(ui.ideaTag))).sort((a, b) => Number(b.review) - Number(a.review) || b.created.localeCompare(a.created));
    if (visible.length && !visible.some(i => i.id === ui.idea)) ui.idea = visible[0].id;
    const feed = $('#idea-list'), scroll = feed.scrollTop;
    setNodes(feed, () => visible.length ? visible.map(ideaCard) : ideaEmptyScene());
    feed.classList.toggle('is-empty', visible.length === 0);
    feed.scrollTop = scroll;
  }
  function ideaBody(idea: ModelIdea): Child{
    return [idea.body.split('\n\n').map(p => h('p', null, ideaLinks(p))), idea.source ? h('button', {class: 'source', 'data-action': 'idea-origin'}, idea.source) : null,
      h('div', {class: 'actions'}, h('button', {'data-action': 'idea-stage', 'aria-label': '更改想法的成熟度'}, ideaStar(idea)), h('button', {'data-action': 'idea-link', 'aria-label': '关联来源'}, iconEl('route')),
        h('button', {class: 'text-button', 'data-convert': 'task'}, '转为任务'), h('button', {class: 'text-button', 'data-convert': 'project'}, '转为项目')),
      ui.menu === 'idea-stage' ? h('div', {class: 'temporary-menu'}, ['seed', 'growing', 'ready', 'adopted', 'parked'].map((s, i) => h('button', {'data-stage': s}, ['萌芽', '发展中', '成形', '已采用', '搁置'][i]))) : null,
      ui.source === 'idea' ? h('pre', {class: 'markdown-preview'}, '---\nsource: ' + (idea.source || '') + '\n---\n\n' + idea.body) : null];
  }
  // 热力图：最近 13 周（本周在最后一列）
  function renderHeatmap(){
    const start = addDays(HOST.weekStart(d.clock.date), -84), counts: Record<string, number> = {}; d.ideas.forEach(i => counts[i.created.slice(0, 10)] = (counts[i.created.slice(0, 10)] || 0) + 1);
    const cells: Child[] = []; for (let col = 0; col < 13; col++) for (let row = 0; row < 7; row++) { const date = addDays(start, col * 7 + row), count = counts[date] || 0, future = date > d.clock.date;
      cells.push(h('button', {class: `heat-cell ${date === ui.ideaDate ? 'selected' : ''}`, 'data-heat-date': date, 'data-count': count, disabled: future, 'aria-pressed': String(date === ui.ideaDate), 'aria-label': `${date}，${count} 条想法`}, heatCell(future ? 0 : count, date))); }
    const months = [0, 6, 12].map(c => MONTH[Number(addDays(start, c * 7).slice(5, 7)) - 1]);
    setNodes($('#idea-heatmap'), () => [h('div', {class: 'heat-months'}, months.map(m => h('span', null, m))), h('div', {class: 'heat-grid'}, cells)]);
    renderIdeaTagFilters();
  }
  function heatCell(count: number, date: string){
    const rand = randomFor(date), level = Math.min(4, count), s: Child[] = [inkEl([[4, 1.5], [16, 1.5], [18.5, 4], [18.5, 16], [16, 18.5], [4, 18.5], [1.5, 16], [1.5, 4], [4, 1.5]], .85, '#A8B3B7')];
    for (let row = 0; row < level * 2; row++) { const yy = 16.3 - row * 1.65, x1 = 3 + rand(), x2 = level === 1 ? 10.5 + rand() * 2 : level === 2 ? 13.5 + rand() * 2 : 17; s.push(inkEl([[x1, yy], [x1 + (x2 - x1) * .42, yy - .45], [x2, yy - .1]], 2.15, INK, {opacity: '.72'})); }
    return svg('svg', {viewBox: '0 0 20 20', 'aria-hidden': 'true', 'data-coverage': level}, s);
  }
  function renderSkyControls(){
    sky(); const w = $('#sheet').clientWidth; $('#weeks').hidden = !ui.lamp; $('#stars').hidden = ui.lamp;
    setNodes($('#weeks'), () => weekNodes().map(({week}, i) => { const x = 90 + i * (w - 370) / 12, y = 145 - Math.sin(i / 12 * Math.PI) * 49;
      return h('button', {class: 'week-node', 'data-week': week, style: `left:${x}px;top:${y}px;--sky-node-ink:${r12Art.skyInk(x, y, w)}`, 'aria-current': ui.week === week ? 'true' : null, 'aria-label': `第 ${week} 周`}, week); }));
    setNodes($('#stars'), () => d.ideas.map((i, n) => { const [x, y] = starPosition(n, w), color = r12Art.skyInk(x, y, w), size = ({seed: 1.8, growing: 2.8, ready: 3.8, adopted: 3.8, parked: 1.8} as Record<string, number>)[i.stage] || 1.8;
      return h('button', {class: 'star-button', 'data-star': i.id, style: `left:${x}px;top:${y}px`, 'aria-label': `${i.review ? '回顾' : '展开'}：${i.title}`},
        svg('svg', {viewBox: '0 0 32 32', 'aria-hidden': 'true'}, svg('g', {opacity: i.stage === 'seed' ? .55 : 1}, skyGlint(16, 16, size, color), i.review ? circleEl(16, 16, 7, .65, color) : null))); }));
  }
  function ideaStar(i: ModelIdea){ const size = ({seed: 5, growing: 6.5, ready: 8, adopted: 8, parked: 5} as Record<string, number>)[i.stage] || 5, opacity = ({seed: .5, growing: .75, ready: 1, adopted: 1, parked: .35} as Record<string, number>)[i.stage] || .5;
    return svg('svg', {viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true'}, svg('g', {opacity}, starEl(12, 12, size), i.review ? circleEl(12, 12, 10, 1) : null)); }
  function starPosition(n: number, w: number): Point{ const halton = (v: number, base: number) => { let result = 0, f = 1; while (v) { f /= base; result += f * (v % base); v = Math.floor(v / base); } return result; }; return [(.055 + halton(n + 1, 2) * .73) * w, 40 + halton(n + 1, 3) * 149]; }
  const skyGlint = (x: number, y: number, r: number, color: string) => [inkEl([[x - r, y], [x, y - .45], [x + r, y]], .6, color), inkEl([[x, y - r * 1.45], [x - .2, y], [x, y + r * 1.45]], .65, color)];
  // 风景里的两样（第 3b 期起输出描述，见 draw/scene.ts）：想法之间的虚线、灯塔的灯光
  function skyLinkV(p: Point, q: Point){ const key = 'r15-dash-' + p.map(Math.round).join('-') + '-' + q.map(Math.round).join('-'), x = (p[0] + q[0]) / 2, y = (p[1] + q[1]) / 2, w = $('#sheet').clientWidth, color = r12Art.skyInk(x, y, w);
    return parts(sh('defs', null, sh('mask', {id: key, maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: w, height: '240'}, sh('path', {d: `M${p.join(',')}L${q.join(',')}`, fill: 'none', stroke: 'white', 'stroke-width': '3', 'stroke-dasharray': '2.5 6.5'}))),
      sh('g', {'data-star-link': true, mask: `url(#${key})`}, inkV([p, q], .62, color, {opacity: '.62'}))); }
  function lampGlowV(cx: number, cy: number, on: boolean, night: boolean){
    const rand = randomFor('lamp-halo'), color = on ? (night ? '#D8B77D' : '#BE965F') : '#8D9291', s: Parts[] = [];
    if (on) for (const [size, opacity] of [[52, .045], [38, .09], [24, .16]]) { const p = getStroke([[cx, cy, .55]], {size, thinning: .15, smoothing: .8, simulatePressure: false}); s.push(sh('path', {d: `M${p.map(q => q.join(',')).join('L')}Z`, fill: color, opacity})); }
    for (let i = 0; i < 190; i++) { const a = rand() * Math.PI * 2, r = Math.pow(rand(), 1.8) * (on ? 32 : 13), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .86, opacity = (on ? (night ? .11 : .12) : .035) * (1 - r / 40); s.push(inkV([[x - .4, y], [x + .5, y + .1]], 2 + rand() * 2.6, color, {opacity: opacity.toFixed(3)})); }
    s.push(inkV([[cx - .2, cy], [cx + .2, cy]], on ? 6.2 : 2.8, color, {opacity: on ? .88 : .3}));
    return s;
  }
  function ideaEmptyScene(){
    const planets = [circleEl(70, 38, 23, 1.4), inkEl([[33, 54], [52, 46], [88, 28], [109, 16]], 1.1), inkEl([[33, 54], [40, 58], [77, 43], [109, 16]], 1.1), circleEl(161, 66, 11, 1.25), starEl(18, 19, 4), starEl(140, 12, 3.5), starEl(195, 88, 3)];
    return h('div', {class: 'idea-empty', 'data-idea-empty': true}, svg('svg', {class: 'idea-empty-planets', viewBox: '0 0 240 115', 'aria-hidden': 'true'}, planets), h('p', {class: 'idea-empty-quote'}, '每一个微小的念头，都可能成为一颗星。'),
      svg('svg', {class: 'idea-empty-art', viewBox: assetBoxes['telescope-r10'], preserveAspectRatio: 'xMaxYMax meet', role: 'img', 'aria-label': '岸边的三脚架望远镜，镜筒指向天空'}, partNodes(assetShapes['telescope-r10'] as readonly Part[])));
  }
  // 标签
  const cleanTag = (v: string | null | undefined) => String(v || '').normalize('NFKC').trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ');
  const tagsOf = (idea: ModelIdea) => [...new Set((idea.tags ?? (idea.tag ? [idea.tag] : [])).map(cleanTag).filter(Boolean))];
  function ideaTagNames(){ d.ideaTags ??= []; const all = [...new Set([...d.ideaTags, ...d.ideas.flatMap(tagsOf)].map(cleanTag).filter(Boolean))]; if (all.join('|') !== d.ideaTags.join('|')) d.ideaTags = all; return d.ideaTags; }
  const ideaTagLinks = (idea: ModelIdea) => { const tags = tagsOf(idea); return tags.length ? h('span', {class: 'idea-card-tags'}, tags.map(tag => h('button', {type: 'button', 'data-idea-tag-filter': tag, 'aria-label': `筛选标签：${tag}`}, tag))) : null; };
  function renderIdeaTagFilters(){
    const previous = HOST.querySelector('#idea-tag-list'); if (previous) cache.tagSidebarScroll = previous.scrollTop;
    const all = !ui.ideaDate && !ui.ideaTag;
    setNodes($('#idea-filters'), () => [
      h('button', {type: 'button', class: `idea-filter ${all ? 'active' : ''}`, 'data-idea-all': true, 'aria-pressed': String(all)}, iconEl('nodes'), h('span', null, '全部')),
      h('div', {id: 'idea-tag-list', class: 'idea-tag-scroll', role: 'region', 'aria-label': '想法标签', tabindex: '0'}, ideaTagNames().map(tag => h('button', {type: 'button', class: `idea-filter ${ui.ideaTag === tag ? 'active' : ''}`, 'data-idea-tag-filter': tag, 'aria-pressed': String(ui.ideaTag === tag), title: tag}, iconEl('star', 16), h('span', null, tag)))),
      h('form', {id: 'tag-inline-form', class: 'tag-inline-create'}, h('span', {'aria-hidden': 'true'}, iconEl('plus', 16)),
        h('span', {class: 'tag-input-line'}, h('input', {id: 'tag-inline-name', 'aria-label': '新建标签', placeholder: '新建标签', autocomplete: 'off', value: ui.tagNewName || ''}), svg('svg', {viewBox: '0 0 128 30', 'aria-hidden': 'true'}, inkEl([[0, 28], [64, 27.7], [128, 28]], .95, TICK)))),
      ui.tagError ? h('p', {class: 'tag-inline-error', role: 'status'}, ui.tagError) : null,
      ui.ideaDate ? h('button', {type: 'button', class: 'idea-date-filter', 'data-idea-all': true, 'aria-label': `清除日期筛选 ${ui.ideaDate}`}, h('time', null, ui.ideaDate), h('span', {'aria-hidden': 'true'}, '×')) : null]);
    fitTagSidebar(); $('#idea-tag-list').scrollTop = cache.tagSidebarScroll || 0;
  }
  function fitTagSidebar(){
    if (ui.page !== 'thought' || ui.lamp) return; const list = HOST.querySelector('#idea-tag-list') as HTMLElement | null; if (!list) return;
    const filters = $('#idea-filters'), other = [...filters.children].filter(el => el !== list && el.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING), gap = parseFloat(getComputedStyle(filters).rowGap) || 0;
    const reserve = other.reduce((hh, el) => hh + el.getBoundingClientRect().height + gap, 0), available = Math.max(28, Math.floor(HOST.bottom - 20 - list.getBoundingClientRect().top - reserve)); list.style.maxHeight = available + 'px';
  }
  function renderComposerTags(){
    ui.draftTags ??= []; setNodes($('#composer-mark'), () => iconEl('star', 19)); const open = !!ui.tagPicker, tools = $('.composer-tag-tools'), toggle = $('#idea-tag-toggle');
    tools.dataset.expanded = String(open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', (open ? '收回想法标签' : '选择想法标签') + (ui.draftTags.length ? '：' + ui.draftTags.join('、') : ''));
    setNodes($('#composer-tags'), () => ui.draftTags.map(tag => h('button', {type: 'button', 'data-remove-draft-tag': tag, 'aria-label': `移除标签：${tag}`}, tag)));
    const options = $('#tag-inline-options'), scroll = options.scrollLeft; setNodes(options, () => ideaTagNames().map(tag => h('button', {type: 'button', class: 'tag-inline-choice', 'data-draft-tag': tag, 'aria-pressed': String(ui.draftTags.includes(tag))}, tag))); options.scrollLeft = scroll;
    $('#idea-tag-drawer').inert = !open; $('#idea-tag-drawer').setAttribute('aria-hidden', String(!open)); $('#chosen-tag-wrap').inert = open; $('#chosen-tag-wrap').setAttribute('aria-hidden', String(open));
  }
  const closeTagPanels = () => { ui.tagPicker = false; renderComposerTags(); };
  function finishInlineTag(){
    const input = $<HTMLInputElement>('#tag-inline-name'), raw = input.value, tag = cleanTag(raw); ui.tagNewName = raw;
    if (!tag) { if (!raw.trim()) return; ui.tagError = '请输入标签名称'; renderIdeaTagFilters(); $('#tag-inline-name').focus({preventScroll: true}); return; }
    if (!ideaTagNames().includes(tag)) d.ideaTags.push(tag); ui.tagNewName = ''; ui.tagError = ''; renderIdeaTagFilters(); renderComposerTags(); $('#idea-tag-list').scrollTop = $('#idea-tag-list').scrollHeight; $('#tag-inline-name').focus({preventScroll: true});
  }
  const fitIdeaEntry = () => { const el = $<HTMLTextAreaElement>('#idea-input'); el.style.height = '32px'; if (el.value.includes('\n')) el.style.height = Math.min(120, Math.max(32, el.scrollHeight)) + 'px'; };
  // 记下一条想法（原型 captureValue 的 idea 分支）
  function captureIdea(text: string, tags: string[]){
    const clean = text.trim(); if (!clean) return; const id = 'new-' + d.serial++;
    ui.ideaDate = d.clock.date; ui.ideaTag = null; ui.ideaExpanded = true;
    d.ideas.unshift({id, title: clean.split('\n')[0].slice(0, 48), body: clean, stage: 'seed', review: false, tag: tags[0] || '', tags: [...tags], created: d.clock.date} as unknown as ModelIdea); ui.idea = id; // 新想法还没写成笔记：没有 example 等字段
    update(); announce(clean);
  }
  const update = () => { renderThought(); view.drawScenery(); };
  // 0.7：“展开 Markdown”改为在 Obsidian 的新标签页里打开笔记
  const openNote = (path: string | undefined) => { const w = view.plugin?.writer; if (path && w && w.exists?.(path) !== false) w.open(path); else announce('这一项还没有对应的笔记'); };

  // 天空（1600×320 逐像素生成，上百毫秒）与灯塔着色只随“时刻 + 灯开关”变：两种灯的状态都记下，
  // 画完一种之后在空闲时把另一种也算好，点灯塔时就不用现算
  const skies = new Map<string, unknown>(), lighthouses = new Map<string, Part[]>();
  // 同一时刻、同一灯态、同样宽度时天空已经铺好了：不再把那张大图重新设成背景（每次设都要重新解码，十几毫秒）
  let applied = '', appliedPhase = 'day';
  function sky(){ const k = d.clock.time + '|' + ui.lamp, el = HOST.querySelector('#sky'), w = HOST.querySelector('#sheet')?.clientWidth, a = k + '|' + w;
    if (a === applied && el?.firstElementChild === (cache.r12Sky as {canvas?: unknown} | undefined)?.canvas) return appliedPhase;
    const phase = skyRaw(); applied = a; appliedPhase = phase; return phase; }
  function skyRaw(){ const k = d.clock.time + '|' + ui.lamp; if (skies.has(k)) cache.r12Sky = skies.get(k); const phase = r12Art.sky(); skies.set(k, cache.r12Sky); if (skies.size > 4) skies.delete(skies.keys().next().value!); return phase; }
  let warm = '';
  // 生成天空是一整块几百毫秒的计算：等在思索页安静停 2 秒、没有过场在走时才做，免得卡住切页的动画；指针移到灯塔上（快要点了）就马上做
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  let lastBox: DOMRect | null = null;
  function prewarm(box: DOMRect, soon = false){ lastBox = box; const k = d.clock.time + '|' + box.width; if (warm === k) return; clearTimeout(warmTimer);
    warmTimer = setTimeout(() => (window.requestIdleCallback || ((f: () => void) => setTimeout(f, 50)))(() => { if (HOST.root !== view.root || !view.root.isConnected || ui.page !== 'thought' || HOST.transitionApi?.state().running) return; warm = k; const keep = ui.lamp, toggle = $('#lighthouse-toggle'), style = toggle.getAttribute('style');
      ui.lamp = !keep; try { scenery(box, true); } finally { ui.lamp = keep; sky(); toggle.setAttribute('style', style!); } }), soon ? 0 : 2000); }
  // 风景（原型 drawScenery 的 thought 分支）：描述（draw/scene.ts），由视图比较过再建节点
  function scenery(box: DOMRect, warming = false){
    if (!warming) prewarm(box);
    const w = box.width, phase = sky(), night = phase === 'night', s: Parts[] = [r12Art.thoughtCoastV(w)];
    const ratio = ((minutes() - 360 + 1440) % 1440) / 1080, sunX = w * (.2 + .42 * Math.max(0, Math.min(1, ratio))), sunY = 62 - 34 * Math.sin(Math.max(0, Math.min(1, ratio)) * Math.PI), starColor = r12Art.skyInk(sunX, sunY, w);
    s.push(sh('g', {'data-morph': 'sun'}, circleV(sunX, sunY, 13, 1.4, starColor), night ? inkV([[sunX - 4, sunY - 11], [sunX + 3, sunY - 4], [sunX + 4, sunY + 4], [sunX - 1, sunY + 11]], 1.3, starColor) : null));
    const lx = w - 174, ly = 25, sc = .18, cx = lx + (879 - 780) * sc, cy = ly + (389 - 267) * sc;
    // 灯塔按天空逐像素着色（几十毫秒）：天空只随时刻、灯的开关变，所以按“宽度 + 时刻 + 灯”记下结果（灯塔素材是 asset-shapes.js 里的描述）
    const lkey = [w, d.clock.time, ui.lamp].join('|'); if (!lighthouses.has(lkey)) { if (lighthouses.size > 4) lighthouses.delete(lighthouses.keys().next().value!); lighthouses.set(lkey, r12Art.lighthouseV(assetShapes['lighthouse-off'] as readonly Part[], `translate(${lx - 780 * sc} ${ly - 267 * sc}) scale(${sc})`, w)); }
    s.push(lighthouses.get(lkey));
    if (ui.lamp) { const f = cache.skyFrame; s.push(sh('defs', null, sh('clipPath', {id: 'r14-beam-clip'}, sh('rect', {x: f.left, y: f.top, width: f.width, height: f.height}))), sh('g', {'clip-path': 'url(#r14-beam-clip)'}, r14Marine.beamV(cx, cy, w, night))); }
    s.push(sh('g', {'data-morph': 'lamp-glow'}, lampGlowV(cx, cy, ui.lamp, night)));
    Object.assign($('#lighthouse-toggle').style, {left: (cx - 24) + 'px', top: (cy - 24) + 'px', right: 'auto', width: '48px', height: '48px'});
    if (ui.lamp) s.push(inkV(Array.from({length: 13}, (_, i): Point => [90 + i * (w - 370) / 12, 164 - Math.sin(i / 12 * Math.PI) * 49]), 1, night ? '#C0C8CB' : TICK));
    else { const groups: Record<string, {n: number; point: Point}[]> = {}; d.ideas.forEach((idea, n) => (groups[String(idea.tag)] ??= []).push({n, point: starPosition(n, w)})); const links: Part[][] = [];
      const dist = (a: Point, b: Point) => Math.hypot(...a.map((v, n) => v - b[n]));
      Object.values(groups).forEach(group => group.slice(0, 8).forEach((entry, i) => { if (!i) return; const near = group.slice(0, i).sort((a, b) => dist(a.point, entry.point) - dist(b.point, entry.point))[0]; if (near && dist(near.point, entry.point) < w * .19) links.push(skyLinkV(near.point, entry.point)); }));
      s.push(sh('g', {'data-star-links': true}, links)); }
    return parts(s);
  }

  // 事件（原型 paper.js 里这一页的几处 addEventListener 与 handleAction 的思索分支）
  HOST.addEventListener('click', e => {
    if (ui.page !== 'thought') return; const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b || b.disabled) return;
    if (b.id === 'idea-tag-toggle') { e.preventDefault(); e.stopPropagation(); ui.tagPicker = !ui.tagPicker; renderComposerTags(); return; }
    if (b.dataset.draftTag !== undefined) { e.preventDefault(); e.stopPropagation(); const tag = b.dataset.draftTag; ui.draftTags = ui.draftTags.includes(tag) ? ui.draftTags.filter(t => t !== tag) : [...ui.draftTags, tag]; renderComposerTags(); [...$('#tag-inline-options').querySelectorAll('button')].find(x => x.dataset.draftTag === tag)?.focus({preventScroll: true}); return; }
    if (b.dataset.removeDraftTag !== undefined) { e.preventDefault(); e.stopPropagation(); ui.draftTags = ui.draftTags.filter(t => t !== b.dataset.removeDraftTag); renderComposerTags(); $('#idea-tag-toggle').focus({preventScroll: true}); return; }
    if (b.dataset.heatDate) { e.preventDefault(); e.stopPropagation(); closeTagPanels(); ui.ideaDate = ui.ideaDate === b.dataset.heatDate ? null as unknown as string : b.dataset.heatDate; ui.ideaTag = null; ui.ideaExpanded = true; renderIdeas(); [...$('#idea-heatmap').querySelectorAll('button')].find(x => x.dataset.heatDate === b.dataset.heatDate)?.focus({preventScroll: true}); return; }
    if (b.hasAttribute('data-idea-all') || b.dataset.ideaTagFilter !== undefined) { e.preventDefault(); e.stopPropagation(); closeTagPanels(); const tag = b.hasAttribute('data-idea-all') ? null : b.dataset.ideaTagFilter!; ui.ideaDate = null as unknown as string; ui.ideaTag = tag; ui.ideaExpanded = true; renderIdeas(); return; }
  }, true);
  HOST.addEventListener('click', e => {
    if (ui.page !== 'thought') return; const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b || b.disabled) return; const ds = b.dataset;
    if (b.id === 'lighthouse-toggle') { closeTagPanels(); ui.lamp = !ui.lamp; ui.menu = null; update(); $('#lighthouse-toggle').focus({preventScroll: true}); return; }
    if (b.id === 'sky-empty') { $('#idea-input').focus(); return; }
    if (ds.week) { ui.week = Number(ds.week); update(); return; }
    if (ds.idea || ds.star) { const id = (ds.idea || ds.star)!; ui.idea = id; ui.ideaExpanded = true; if (ds.star) { const i = d.ideas.find(x => x.id === id); if (i) i.review = false; } update(); return; }
    if (ds.stage) { selectedIdea().stage = ds.stage; ui.menu = null; renderThought(); return; }
    if (ds.ideaSource) { selectedIdea().source = d.goals.find(g => g.id === ds.ideaSource)?.title; renderThought(); return; }
    if (ds.convert) { const i = selectedIdea(); if (ds.convert === 'task') d.tasks.push({id: 'new-' + d.serial++, title: i.title, description: i.body, markdown: i.body, date: null, status: 'open', peopleIds: [], listId: null, projectId: null, priority: 'medium'} as unknown as Model['tasks'][number]); else core.newProject?.(i.title, i.id); i.stage = 'adopted'; renderThought(); announce(i.title); return; } // 新任务还没写成笔记：只有这几项
    switch (ds.action) {
      case 'new-idea': $('#idea-input').focus(); break;
      case 'idea-source': openNote(selectedIdea()?.id); break; // 0.7：在 Obsidian 的新标签页里打开这篇想法
      case 'idea-stage': ui.menu = ui.menu === 'idea-stage' ? null : 'idea-stage'; renderThought(); break;
      case 'idea-link': ui.menu = 'idea-link'; insertNodes($('#idea-detail'), 'beforeend', () => h('div', {class: 'temporary-menu'}, d.goals.map(g => h('button', {'data-idea-source': g.id}, g.title)))); break;
      case 'idea-origin': announce(selectedIdea().source); break;
      case 'week-note': { const w = $('#week-board'); if (HOST.querySelector('.week-note')) HOST.querySelector('.week-note')!.remove(); else insertNodes(w, 'afterbegin', () => h('article', {class: 'week-note'}, h('button', {class: 'inline-close', 'data-action': 'week-note', 'aria-label': '折回周记'}, '×'), h('p', null, d.weekly), h('button', {class: 'fold', 'data-action': 'week-markdown', 'aria-label': '展开本周 Markdown'}))); break; }
      case 'week-markdown': openNote(view.plugin?.index?.days?.get(d.clock.date)?.path); break; // 周记取自今天的日记
    }
  });
  HOST.addEventListener('submit', e => {
    const f = e.target as HTMLFormElement;
    if (f.id === 'tag-inline-form') { e.preventDefault(); finishInlineTag(); return; }
    if (f.id === 'idea-form') { e.preventDefault(); const input = $<HTMLTextAreaElement>('#idea-input'), text = input.value.trim(); if (!text) { input.focus(); return; } const tags = [...ui.draftTags]; ui.draftTags = []; closeTagPanels(); captureIdea(text, tags);
      $<HTMLTextAreaElement>('#idea-input').value = ''; $('#idea-input').focus(); cache.ideaDraft = ''; $('#idea-form').dataset.empty = 'true'; $('#idea-input').style.height = '32px'; }
  });
  HOST.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'tag-inline-name') { ui.tagNewName = t.value; if (ui.tagError) { ui.tagError = ''; HOST.querySelector('.tag-inline-error')?.remove(); fitTagSidebar(); } }
    if (t.id === 'idea-input') { cache.ideaDraft = t.value; $('#idea-form').dataset.empty = String(!t.value); fitIdeaEntry(); }
  });
  HOST.addEventListener('keydown', ev => {
    const e = ev as KeyboardEvent, t = e.target as Element;
    if (t.id === 'idea-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $<HTMLFormElement>('#idea-form').requestSubmit(); return; }
    if (e.key === 'Escape' && ui.tagPicker) { e.preventDefault(); e.stopImmediatePropagation(); closeTagPanels(); $('#idea-tag-toggle').focus({preventScroll: true}); }
  }, true);
  HOST.addEventListener('scroll', e => { const t = e.target as Element; if (t.id === 'idea-tag-list') cache.tagSidebarScroll = t.scrollTop; }, true);
  HOST.addEventListener('pointerover', e => { if ((e.target as Element).closest?.('#lighthouse-toggle') && lastBox && ui.page === 'thought') prewarm(lastBox, true); });
  // 规划：把任务拖到某一天（或“未排期”）
  const dropColumn = (target: EventTarget | null) => (target as Element | null)?.closest?.<HTMLElement>('#thought .day-column[data-drop]');
  function indicateDrop(col: Element | null | undefined){
    const last = HOST.querySelector('#thought .drop-target');
    if (last === col) return;
    last?.classList.remove('drop-target');
    col?.classList.add('drop-target');
  }
  HOST.addEventListener('dragstart', ev => {
    const e = ev as DragEvent, button = (e.target as Element).closest?.<HTMLElement>('#thought [data-plan]');
    if (!button) return;
    ui.drag = button.dataset.plan;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', ui.drag!);
  });
  HOST.addEventListener('dragover', ev => {
    const e = ev as DragEvent;
    if (!ui.drag || ui.page !== 'thought') return;
    const col = dropColumn(e.target);
    indicateDrop(col);
    if (col) { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; }
  });
  HOST.addEventListener('dragleave', ev => {
    const e = ev as DragEvent, col = dropColumn(e.target);
    if (col?.classList.contains('drop-target') && !col.contains(e.relatedTarget as Node | null)) indicateDrop(null);
  });
  HOST.addEventListener('drop', e => {
    const col = dropColumn(e.target);
    if (!col || !ui.drag || ui.page !== 'thought') return;
    e.preventDefault();
    const task = d.tasks.find(x => x.id === ui.drag);
    ui.drag = null;
    indicateDrop(null);
    if (task) { task.date = col.dataset.drop || null; update(); }
  });
  HOST.addEventListener('dragend', () => { ui.drag = null; indicateDrop(null); });

  return {render: renderThought, scenery, fit: fitTagSidebar};
}
