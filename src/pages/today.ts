// 今日页（设计说明第 8 节；画面以纸本原型最终版为准）。
// 和原型的区别只在“怎么更新”：原型每次操作都整页重写；这里每块区域记下自己上次的输入，没变就不动（DOM 与风景都是）。
// 风景按“尺寸 + 版式位置 + 时刻 + 随手记时刻 + 是否全部完成”缓存，切回这一页、或改了与风景无关的东西时直接复用。
// 第 3 期：页面上的结构用 DOM 构建（draw/dom.ts），每个函数对应原来的一段模板。文字直接成为文本节点，不再 esc()。
// 第 3b 期：风景（scenery）输出描述（draw/scene.ts），由视图比较过再建节点、写进 #scenery（view.ts 的 showScene）。
import {inkEl, circleEl, iconEl, buoyEl, smearProgressEl, inkV, smooth, INK, PAPER, SECONDARY, TICK} from '../draw/ink.ts';
import type {Point} from '../draw/ink.ts';
import {h, svg, setNodes} from '../draw/dom.ts';
import type {Child} from '../draw/dom.ts';
import {sh, parts} from '../draw/scene.ts';
import type {Part, Parts, Shape} from '../draw/scene.ts';
import {maritimeArt} from '../draw/proto/paper-maritime-r14.ts';
import type {createR12Art} from '../draw/proto/paper-r12-art.ts';
import {walkVisible} from '../ui/visible.ts';
import type {DayQuestion, DayView, IndexEvent, IndexTask} from '../data/types.ts';
import type {SheetBox, ViewUI} from '../view.ts';

/** 原型的画笔（paper-r12-art.ts 的 createR12Art） */
type R12Art = ReturnType<typeof createR12Art>;
/** 一段文字所在的、各层滚动区可见范围的交集（ui/visible.js 的 walkVisible 给出；没有滚动区时 null） */
interface Clip { top: number; bottom: number; left: number; right: number }

const minutes = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const ratio = (s: string) => Math.max(0, Math.min(1, (minutes(s) - 360) / 1080));
const smallCheck = (id: string, label: string, done = false) => h('button', {class: 'small-check', 'data-complete': id, 'aria-label': (done ? '重新打开' : '完成') + '：' + label}, iconEl(done ? 'check' : 'circle'));
const mark = (ic: string, label: string, extra = '') => h('div', {class: `today-section-mark ${extra}`}, iconEl(ic), h('span', null, label));
const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
// 0.3（使用者 2026-11-08）：航迹、往年今日、投入没有内容时，画一幅小小的手绘插图，不留大片空白。
// 线条用同一支笔（inkEl 按参数记下轮廓）；带 data-empty-motion 的部分在过场开启时轻轻晃动（container.css）。
const EMPTY: Record<'trail' | 'past' | 'investments', [text: string, w: number, h: number, draw: () => Child]> = {
  trail: ['完成的事会在这里连成航迹', 120, 48, () => [inkEl([[4, 40], [22, 36], [40, 39], [58, 34], [72, 36]], 1, TICK), inkEl([[10, 44], [30, 42], [48, 44]], .9, TICK),
    svg('g', {'data-empty-motion': 'bob'}, inkEl([[78, 30], [108, 30], [101, 37], [85, 37], [78, 30]], 1.2, SECONDARY), inkEl([[93, 30], [93, 7]], 1.1, SECONDARY), inkEl([[93, 9], [93, 27], [106, 25], [93, 9]], 1, SECONDARY))]],
  past: ['明年今天，会在这里遇见今天', 110, 50, () => [inkEl([[55, 12], [33, 7], [10, 10], [10, 43], [33, 40], [55, 45]], 1.15, SECONDARY), inkEl([[55, 12], [77, 7], [100, 10], [100, 43], [77, 40], [55, 45], [55, 12]], 1.15, SECONDARY),
    [18, 25, 32].map(y => [inkEl([[17, y], [46, y + 1.5]], .8, TICK), inkEl([[63, y + 1.5], [92, y]], .8, TICK)]), svg('g', {'data-empty-motion': 'sway'}, inkEl([[80, 8], [81, 24], [84, 20], [87, 24], [86, 8]], .9, SECONDARY))]],
  investments: ['写下投入的时间，这里会画出长度', 70, 52, () => [inkEl([[22, 5], [48, 5]], 1.2, SECONDARY), inkEl([[22, 47], [48, 47]], 1.2, SECONDARY), inkEl([[25, 6], [27, 18], [35, 26], [27, 34], [25, 46]], 1.1, SECONDARY), inkEl([[45, 6], [43, 18], [35, 26], [43, 34], [45, 46]], 1.1, SECONDARY),
    svg('g', {'data-empty-motion': 'sand'}, inkEl([[35, 27], [35, 38]], .8, TICK), inkEl([[29, 44], [35, 40], [41, 44]], .9, TICK))]],
};
const emptyArt = (k: keyof typeof EMPTY) => { const [text, w, ht, draw] = EMPTY[k]; return h('div', {class: 'today-empty', 'data-empty': k}, svg('svg', {viewBox: `0 0 ${w} ${ht}`, width: w, height: ht, 'aria-hidden': 'true'}, draw()), h('small', null, text)); };
// 往年今日的那句话：第一个“，”后面断行（原来是 esc(text).replace('，', '，<br>')）
const breakAfterComma = (text: string): Child => { const i = text.indexOf('，'); return i < 0 ? text : [text.slice(0, i + 1), h('br'), text.slice(i + 1)]; };

// 页面骨架（原 SKELETON）。原模板里块与块之间的换行缩进不再写出：它们在 flex / grid 容器或块级元素之间，不占位置（等价性校验逐个量过）
const subsection = (group: string, heading: HTMLDivElement, ...body: Child[]) => h('div', {class: 'today-subsection', 'data-today-group': group}, heading, body);
const skeleton = () => [
  h('div', {class: 'above'}, h('div', {class: 'focus-section', id: 'focus'}), h('div', {class: 'other-tasks', id: 'other-tasks'})),
  h('section', {class: 'timeline', id: 'timeline', 'aria-label': '6 点到 24 点的日程与随手记'}, h('div', {id: 'events'}), h('div', {id: 'time-ticks', class: 'time-ticks'})),
  h('div', {id: 'event-mist', class: 'event-mist', role: 'tooltip', hidden: true}),
  h('div', {class: 'below'},
    h('div', {class: 'left-column'},
      subsection('trail', mark('route', '航迹'), h('div', {class: 'trail', id: 'trail'})),
      subsection('past', mark('book', '往年今日'), h('blockquote', {id: 'past'}))),
    h('div', {class: 'middle-column'},
      subsection('habits', mark('check', '习惯'), h('div', {id: 'habits', class: 'habits'})),
      subsection('questions', mark('compass', '自问'), h('div', {id: 'questions', class: 'questions'}))),
    h('div', {class: 'right-column'},
      subsection('investments', mark('sunrise', '投入'), h('div', {id: 'investments'})),
      subsection('journal', mark('note', '随手记'), h('div', {class: 'journal', id: 'journal', role: 'region', 'aria-label': '随手记', tabindex: 0}),
        h('form', {id: 'journal-form', class: 'line-form'}, h('input', {id: 'journal-input', placeholder: '想到了什么？', 'aria-label': '记下此刻想到的事', autocomplete: 'off'}))))),
];

export function createToday({root, art, ui}: {root: HTMLElement; art: R12Art; ui: ViewUI}){
  const sec = root.querySelector<HTMLElement>('#today')!, $ = <E extends Element = HTMLElement>(s: string) => sec.querySelector<E>(s), $$ = <E extends Element = HTMLElement>(s: string) => [...sec.querySelectorAll<E>(s)];
  setNodes(sec, skeleton);
  const last: Record<string, string> = {}; // 每块区域上次的输入
  let journalSeen = false;
  // 输入没变就不动；变了就按 build 整块重建（和原来整段重写 innerHTML 的时机一样）
  const put = (key: string, input: unknown, el: Element, build: () => Child) => { const k = JSON.stringify(input); if (last[key] === k) return false; last[key] = k; setNodes(el, build); return true; };
  const detail = (t: IndexTask) => h('div', {class: 'detail-inline', 'data-detail-for': t.id},
    h('div', {class: 'detail-heading'},
      h('button', {class: 'inline-close', 'data-action': 'close-detail', 'aria-label': '折回详情'}, '×'),
      h('button', {class: 'fold', 'data-open': t.path, 'aria-label': `打开 ${t.title} 这篇笔记`}),
      h('h3', null, t.title),
      h('button', {class: 'text-button detail-state-action', 'data-complete': t.id}, t.status === 'done' ? '重新打开' : '完成')),
    h('div', {class: 'detail-body'},
      t.project ? h('div', {class: 'field'}, iconEl('route'), h('span', null, t.project)) : null,
      t.date ? h('div', {class: 'field'}, iconEl('sunrise'), h('span', {class: 'mono'}, t.date)) : null,
      t.description ? h('p', null, t.description) : null));
  const trailNext = (v: DayView, open: string | null) => !open && v.nextUp.length ? h('div', {class: 'trail-next'}, h('small', null, '接下来'), v.nextUp.map(t => h('span', null, t.title))) : null;

  let events: IndexEvent[] = [], drawnView: DayView | undefined, drawnDetail: string | null | undefined, drawnChooser: boolean | undefined;
  function render(v: DayView){
    const open = ui.detail;
    if (drawnView === v && drawnDetail === open && drawnChooser === ui.chooseFocus) return;
    events = v.events;
    const selected = open ? (v.focus.find(t => t.id === open) || v.other.find(t => t.id === open) || v.trail.find(t => t.id === open)) : undefined;
    sec.classList.toggle('all-done', v.allDone);
    // 这一天的日记、往年今日那篇日记的路径（示例笔记的淡墨要用，见 ui/examples.js）
    sec.dataset.dayNote = v.dayPath || ''; sec.dataset.pastNote = v.past?.path || '';
    // 焦点
    put('focus', [v.focus, v.allDone, v.noTasks, open, v.stats, ui.chooseFocus, ui.chooseFocus ? v.other : null], $('#focus')!, () => {
      if (v.allDone) return v.noTasks ? h('p', {class: 'all-done-message'}, '今天没有排定的航程，', h('br'), '海面平静，随时可以起锚。') : h('p', {class: 'all-done-message'}, '今天的航程已落笔，', h('br'), '余下的交给海风。');
      const first = v.focus[0], ex = selected;
      if (ex && v.focus.includes(ex)) return [mark('anchor', '今日聚焦', 'focus-section-mark'), detail(ex)];
      if (!first) {
        const heading = mark('anchor', '今日聚焦', 'focus-section-mark');
        if (!ui.chooseFocus) return [heading, h('button', {class: 'empty-outline', 'data-action': 'choose-focus', 'aria-label': '挑选今日重点'}, iconEl('plus'))];
        const choices = v.other.filter(t => t.date === v.date).map(t => h('button', {'data-focus': t.id}, t.title));
        return [heading, h('div', {class: 'temporary-menu', role: 'group', 'aria-label': '挑选今日重点'}, choices.length ? choices : h('span', null, '今天没有可选的任务'), h('button', {'data-action': 'cancel-focus'}, '收起'))];
      }
      const s = v.stats;
      return [mark('anchor', '今日聚焦', 'focus-section-mark'),
        h('div', {class: 'focus-primary'},
          h('div', null, h('button', {class: 'focus-name', 'data-detail': first.id}, first.title), h('div', {class: 'focus-project'}, first.project || '')),
          h('button', {class: 'outline complete', 'data-complete': first.id, 'aria-label': '完成：' + first.title}, '完成')),
        h('div', {class: 'focus-rest'}, v.focus.slice(1).map(t => h('div', null, h('div', {class: 'focus-secondary'}, smallCheck(t.id, t.title), h('button', {'data-detail': t.id}, t.title))))),
        open ? null : h('div', {class: 'today-stats'},
          s.milestone ? h('span', {class: 'ts-station'}, iconEl('route', 16), '里程碑 ', h('b', null, s.milestone.title), h('i', {class: 'mono'}, `${s.milestone.n} / ${s.milestone.of}`)) : null,
          h('span', null, '完成 ', h('b', {class: 'mono'}, `${s.done} / ${s.total}`)),
          h('span', null, '投入 ', h('b', {class: 'mono'}, `${s.hours}h`)),
          h('span', null, '习惯 ', h('b', {class: 'mono'}, `${s.habits} / ${s.habitTotal}`)),
          s.next ? h('span', null, '下一项 ', h('b', {class: 'mono'}, s.next.time), ' ' + s.next.title) : null)];
    });
    // 其他任务
    put('other', [v.other, v.allDone, open, v.date], $('#other-tasks')!, () => {
      if (v.allDone) return null;
      const ex = selected, body = ex && v.other.includes(ex) ? detail(ex)
        : v.other.map(t => h('div', null, h('div', {class: 'task-row'}, smallCheck(t.id, t.title),
          h('button', {class: 'task-title', 'data-detail': t.id}, t.title, t.project ? h('small', {class: 'task-project'}, t.project) : null),
          t.date !== null && t.date < v.date ? h('time', null, md(t.date)) : null)));
      return [h('div', {class: 'other-tasks-mark'}, art.symbolEl('checklist', 19), h('span', null, '其他任务')), h('div', {class: 'other-task-items'}, body)];
    });
    // 时间轴
    put('events', v.events, $('#events')!, () => v.events.map(e => h('button', {class: 'event', 'data-event': e.id, style: `left:${ratio(e.time) * 100}%`, 'aria-label': `${e.time} ${e.title}`},
      h('span', {class: 'event-icon'}, buoyEl()), h('span', {class: 'event-copy'}, h('time', null, e.time), h('span', {class: 'event-title'}, e.title)))));
    put('ticks', 1, $('#time-ticks')!, () => [6, 12, 18, 24].map((n, i) => h('span', {style: `left:${i / 3 * 100}%`}, n)));
    // 航迹、往年今日
    put('trail', [v.trail, v.nextUp, open], $('#trail')!, () => {
      const ex = selected; if (ex && ex.status === 'done') return detail(ex);
      if (!v.trail.length) return [emptyArt('trail'), trailNext(v, open)];
      return [v.trail.map(t => h('div', null, h('button', {class: 'trail-item', 'data-detail': t.id}, t.title))), trailNext(v, open)];
    });
    put('past', v.past, $('#past')!, () => v.past ? [h('span', {class: 'past-mark', 'aria-hidden': 'true'}, '“'), h('p', {class: 'past-text'}, breakAfterComma(v.past.text)),
      h('cite', null, v.past.year, v.past.more.length ? h('span', {class: 'past-more'}, v.past.more.map(y => h('span', null, h('b', null, y.year), ' ' + y.item))) : null)] : emptyArt('past'));
    // 习惯、自问
    put('habits', v.habits, $('#habits')!, () => v.habits.map(hb => h('button', {class: 'habit', 'data-habit': hb.id, 'aria-label': `${hb.name}，${hb.value === true ? '完成' : hb.value === false ? '未完成' : '未记录'}`},
      h('span', {class: 'habit-mark'}, hb.value === null ? null : hb.value ? iconEl('dot') : iconEl('circle')),
      h('span', null, hb.name),
      h('span', {class: 'habit-history', 'aria-hidden': 'true'}, hb.history.map(x => svg('svg', {viewBox: '0 0 10 10'}, x === null ? null : x ? svg('circle', {cx: 5, cy: 5, r: 3.5, fill: INK}) : circleEl(5, 5, 3.2, 1.15)))))));
    put('questions', v.questions, $('#questions')!, () => v.questions.map(q => dial(q)));
    // 投入、随手记
    put('investments', [v.investments, v.scale], $('#investments')!, () => !v.investments.length ? emptyArt('investments') : v.investments.map(t => h('div', {class: 'investment'},
      h('div', {class: 'investment-label'}, h('button', {'data-investment': t.id}, t.title), h('time', null, `${t.hours}h`)),
      h('div', {class: 'investment-smear', 'aria-label': `${t.title}，${t.hours}h，统一 ${v.scale}h 比例尺`}, smearProgressEl(t.hours, v.scale, 310, 'effort-' + t.id)))));
    const journal = $('#journal')!, atEnd = journal.scrollHeight - journal.clientHeight - journal.scrollTop < 3;
    if (put('journal', v.journal, journal, () => v.journal.map(n => h('div', {class: 'journal-line'}, h('time', null, n.time), h('span', null, n.text))))) ui.journalFollow = ui.journalFollow || atEnd || !journalSeen;
    journalSeen = true;
    drawnView = v; drawnDetail = open; drawnChooser = ui.chooseFocus;
  }

  // 拨盘（原型 renderQuestions）：刻度与数字是静态的，只有指针随分数变；整块按分数缓存。
  // 原来缓存的是 HTML 字符串、每次重新解析出一份新节点；这里缓存建好的一份，每次克隆一份新的（同样每次都是新节点）
  const dialCache = new Map<string, HTMLDivElement>();
  function dial(q: DayQuestion){
    const key = q.title + '|' + q.value, hit = dialCache.get(key); if (hit) return hit.cloneNode(true);
    const scale: Child[] = [inkEl(Array.from({length: 41}, (_, i): Point => { const a = Math.PI + i / 40 * Math.PI; return [87 + Math.cos(a) * 48, 86 + Math.sin(a) * 48]; }), 1.05, SECONDARY)];
    for (let i = 1; i <= 10; i++) { const a = Math.PI + (i - 1) / 9 * Math.PI, x = 87 + Math.cos(a) * 64, y = 86 + Math.sin(a) * 64; scale.push(svg('text', {x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle'}, i), inkEl([[87 + Math.cos(a) * 42, 86 + Math.sin(a) * 42], [87 + Math.cos(a) * 49, 86 + Math.sin(a) * 49]], i === 1 || i === 10 ? 1.45 : 1.2, SECONDARY)); }
    const a = Math.PI + ((q.value || 1) - 1) / 9 * Math.PI;
    const el = h('div', {class: 'question'}, h('div', {class: 'question-title'}, q.title),
      svg('svg', {class: 'dial', 'data-question': q.id, viewBox: '0 0 174 100', role: 'slider', tabindex: 0, 'aria-label': q.title, 'aria-valuemin': 1, 'aria-valuemax': 10, 'aria-valuenow': q.value ? q.value : null, 'aria-valuetext': q.value || '未记录'},
        scale, q.value ? svg('g', {class: 'needle'}, inkEl([[87 - Math.cos(a) * 4, 86 - Math.sin(a) * 4], [87, 86], [87 + Math.cos(a) * 36, 86 + Math.sin(a) * 36]], 2, 'currentColor'), circleEl(87, 86, 3.1, 1.4, 'currentColor')) : null));
    dialCache.set(key, el); return el.cloneNode(true);
  }

  // 浮标旁的“时刻 名称”给下一个浮标让位（原型只有相隔很远的两个日程；接上日历订阅后会挨得很近）：
  // 放得下就照原样；放不下名称就截短加省略号；连名称的开头都放不下就只留时刻；时刻也放不下就只留浮标。完整内容悬停时在浮标详情里看。
  let labelKey = '';
  function labels(){
    const copies = $$('#events .event-copy'); if (!copies.length) { labelKey = ''; return; }
    const W = $('#events')!.getBoundingClientRect(), key = W.width + '|' + copies.map(c => c.textContent).join('|') + '|' + sec.classList.contains('all-done');
    if (key === labelKey) return; labelKey = key;
    for (const c of copies) { c.classList.remove('is-clipped', 'is-terse', 'is-bare'); c.style.maxWidth = ''; }
    const m = copies.map(c => { const r = c.getBoundingClientRect(), icon = c.parentElement!.querySelector('.event-icon')!.getBoundingClientRect(); return {c, left: r.left, width: c.scrollWidth, icon: icon.left, time: c.querySelector('time')!.getBoundingClientRect().width + 10}; });
    const order = [...m].sort((a, b) => a.icon - b.icon);
    order.forEach((x, i) => {
      const room = (order[i + 1] ? order[i + 1].icon - 12 : W.right + 8) - x.left;
      if (x.width <= room) return;
      if (room >= x.time + 36) { x.c.classList.add('is-clipped'); x.c.style.maxWidth = Math.floor(room) + 'px'; }
      else if (room >= x.time - 6) x.c.classList.add('is-terse');
      else x.c.classList.add('is-bare');
    });
  }
  // 版式测量之后的几件事（原型 fitJournalViewport / fitOtherTasks / drawTrail）：都在同一帧里先读后写
  function fit(box: SheetBox){
    const journal = $('#journal')!, form = $('#journal-form')!, wrap = $('.other-task-items');
    const top = journal.getBoundingClientRect().top, formH = form.getBoundingClientRect().height;
    const rows = wrap && !wrap.querySelector('.detail-inline') ? [...wrap.children] : [];
    if (wrap) { wrap.style.maxHeight = ''; wrap.style.flex = ''; }
    // wrap 为空时 wtop 不用（rows 也为空）
    const wtop = wrap ? wrap.getBoundingClientRect().top : 0, limit = wrap ? $('#other-tasks')!.getBoundingClientRect().bottom - wtop : 0;
    let fitH = 0; for (const r of rows) { const end = r.getBoundingClientRect().bottom - wtop; if (end <= limit + .1) fitH = end; else break; }
    const items = [...$$('#trail .trail-item')], tb = $('#trail')!.getBoundingClientRect(), ys = items.map(b => b.getBoundingClientRect().top - tb.top + $('#trail')!.scrollTop + 19);
    // 写
    // 纸不滚动时，随手记撑到纸底；窄视图里纸会滚动，随手记用样式里的固定高度
    journal.style.maxHeight = box.scroll ? '' : Math.max(52, Math.floor(box.bottom - 48 - top - formH)) + 'px';
    if (ui.journalFollow) { journal.scrollTop = journal.scrollHeight; ui.journalFollow = false; }
    if (fitH > 0) { wrap!.style.maxHeight = fitH + 'px'; wrap!.style.flex = '0 1 auto'; }
    trail(ys);
    labels();
    alignJournal(journal);
  }
  // 随手记停在最新一条时，窗口从整行开始（原型 R31）：框高不是行距的整数倍，就在底部补上余数那么多的内边距
  function alignJournal(el: HTMLElement){
    const rows = [...el.children], cur = parseFloat(el.style.paddingBottom) || 0; let pad = 0;
    if (rows.length > 1) { const pitch = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top, o = rows[0].getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop, end0 = el.scrollHeight - cur - el.clientHeight;
      if (pitch >= 8 && end0 > 1) pad = Math.round(((pitch - ((end0 - o) % pitch + pitch) % pitch) % pitch) * 10) / 10;
      // 窗口比一行还矮（窄栏里一条折成两行）时，补到最后一行顶着窗口上沿为止，不能把它推出窗口
      pad = Math.min(pad, Math.max(0, Math.floor(el.clientHeight - cur - rows.at(-1)!.getBoundingClientRect().height))); }
    const atEnd = el.scrollHeight - el.clientHeight - el.scrollTop < 3;
    if (Math.abs(pad - cur) > .2) { el.style.paddingBottom = pad ? pad + 'px' : ''; if (atEnd) el.scrollTop = el.scrollHeight; }
  }
  function trail(ys: number[]){
    const t = $('#trail')!; let sketch = t.querySelector<SVGSVGElement>('.trail-sketch');
    if (!sketch) { sketch = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sketch.classList.add('trail-sketch'); sketch.setAttribute('aria-hidden', 'true'); t.prepend(sketch); }
    const key = ys.map(Math.round).join(','); if (sketch.dataset.key === key) return; sketch.dataset.key = key;
    const ht = Math.max(t.clientHeight, t.scrollHeight, 1); sketch.setAttribute('viewBox', `0 0 28 ${ht}`); sketch.style.height = ht + 'px';
    setNodes(sketch, () => [ys.length > 1 ? inkEl(ys.map((y, i): Point => [11 + Math.sin(i * .9) * 1.1, y]), 2.15, SECONDARY, {'data-route-stroke': true}) : null,
      ys.map(y => [svg('circle', {cx: 11, cy: y, r: 5, fill: PAPER}), circleEl(11, y, 3.2, 1.5)])]);
  }

  // 风景（原型 drawScenery 的 today 分支）：描述（见文件开头）。缓存的是与遮罩无关的那部分描述（描述不可变，可以反复用）
  const sceneCache = new Map<string, Part[]>();
  // 完成态海景的笔：带 data-draw-path / data-draw-width（原来的 draw 只收三个参数，第四个参数 attrs 不用，这里照旧）
  const marine = maritimeArt({inkV: art.LV, curveV: inkV, drawV(points: Point[], size?: number, color?: string){
    const center = smooth(points).map(point => point.map(n => n.toFixed(2)).join(',')).join('L');
    return inkV(points, size, color, {'data-draw-path': `M${center}`, 'data-draw-width': String(size)});
  }});
  function obstacles(base: SheetBox, completed: boolean){
    const out: Shape[] = [], m = 12, range = document.createRange();
    const add = (left: number, top: number, right: number, bottom: number) => {
      if (right > left && bottom > top) out.push(sh('rect', {x: (left - base.left - m).toFixed(1), y: (top - base.top - m).toFixed(1), width: (right - left + 2 * m).toFixed(1), height: (bottom - top + 2 * m).toFixed(1), fill: 'black'}));
    };
    walkVisible(sec, (n: Node, c: Clip | null) => { range.selectNode(n);
      for (const b of range.getClientRects()) { let {top, bottom, left, right} = b; if (c) { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); left = Math.max(left, c.left); right = Math.min(right, c.right); }
        add(left, top, right, bottom); } });
    // 完成态的日程文字在浮标按钮外，滚动区遍历可能把它当成被按钮截去的文字。
    if (completed) for (const label of $$('.event-copy')) {
      if (getComputedStyle(label).visibility === 'hidden') continue;
      const clip = label.getBoundingClientRect();
      for (const text of label.children) for (const rect of text.getClientRects()) add(rect.left, rect.top, Math.min(rect.right, clip.right), rect.bottom);
    }
    return out;
  }
  // 下方各栏的范围：宽视图是三个栏容器；窄视图里栏容器不占位（display:contents），按小节的左边缘归成两栏
  function columns(): {left: number; right: number; bottom: number}[]{
    const cols = $$('.below > div').map(e => e.getBoundingClientRect());
    if (cols.some(c => c.width)) return cols;
    const by = new Map<number, {left: number; right: number; bottom: number}>();
    for (const s of $$('.below .today-subsection')) { const r = s.getBoundingClientRect(), k = Math.round(r.left), c = by.get(k); if (!r.width) continue;
      by.set(k, c ? {left: Math.min(c.left, r.left), right: Math.max(c.right, r.right), bottom: Math.max(c.bottom, r.bottom)} : {left: r.left, right: r.right, bottom: r.bottom}); }
    return [...by.values()].sort((a, b) => a.left - b.left);
  }
  function scenery(v: DayView, box: SheetBox): Part[]{
    const tb = $('#timeline')!.getBoundingClientRect(), w = box.width, y = Math.round(tb.top - box.top + 60), x = ratio(v.time) * w;
    const above = $('.above')!.getBoundingClientRect(), focus = $('#focus')!.getBoundingClientRect(), other = $('#other-tasks')!.getBoundingClientRect(), below = $('.below')!.getBoundingClientRect(), cols = columns();
    const side = other.left > focus.right - 1; // 聚焦与其他任务左右并排（窄视图 < 820 时上下排，不画竖线）
    const geo = [w, box.height, y, Math.round(focus.right), Math.round(other.left), Math.round(above.top - box.top), Math.round(above.bottom - box.top), Math.round(below.top - box.top), side, ...cols.map(c => Math.round(c.right) + ':' + Math.round(c.bottom))];
    const key = JSON.stringify([geo, v.time, v.journal.map(n => n.time), v.allDone, v.events.length]);
    const mask = obstacles(box, v.allDone); // 遮罩跟着文字走，便宜，不进缓存
    let body = sceneCache.get(key);
    if (!body) {
      const horizon = Array.from({length: 65}, (_, i): Point => { const t = i / 64; return [t * w, y + Math.sin(t * Math.PI * 2) * .6 + Math.sin(t * Math.PI * 8) * .16]; });
      const s: Parts[] = [sh('g', {'data-morph': 'horizon'}, inkV(horizon, 1.5, '#A3B4BA'), inkV(horizon.filter(q => q[0] < x).concat([[x, y + Math.sin(x / w * Math.PI * 2) * .6]]), 1.7))];
      for (const n of [0, 1 / 3, 2 / 3, 1]) s.push(inkV([[n * w, y - 3], [n * w, y + 5]], 1.15, TICK));
      for (const n of v.journal) { const xx = ratio(n.time) * w; s.push(inkV([[xx, y - 6], [xx, y + 4]], 1.25)); }
      const ship = art.shipV(x, y), shore = sh('g', {mask: 'url(#compass-shore-clear)'}, art.waterV(w, y, x, v.allDone));
      // 完成风景里有填色的远岸。先画远岸，再画水线、刻度与小船。
      const all: Parts[] = v.allDone ? [shore, sh('g', {mask: 'url(#compass-shore-clear)'}, marine.completedV(w, y)), s, ship] : [s, ship, shore];
      if (v.allDone) all.push(sh('g', {'data-morph': 'water'}, inkV([[w * .82, y + 43], [w * .88, y + 42], [w * .97, y + 43]], 1.1, TICK), inkV([[w * .78, y + 55], [w * .84, y + 56], [w * .91, y + 55]], 1.05, TICK), inkV([[w * .89, y + 67], [w * .93, y + 66], [w * .99, y + 67]], 1, TICK)));
      const d: Parts[] = []; if (!v.allDone && side) { const xx = (focus.right + other.left) / 2 - box.left; d.push(art.LV([[xx, above.top - box.top], [xx, above.bottom - box.top - 4]], .8, TICK)); }
      for (let i = 1; i < cols.length; i++) { const xx = (cols[i - 1].right + cols[i].left) / 2 - box.left; d.push(art.LV([[xx, below.top - box.top + 2], [xx, Math.min(box.height - 30, Math.max(cols[i - 1].bottom, cols[i].bottom) - box.top - 3)]], .75, TICK)); }
      body = parts(all, sh('g', {'data-r14-dividers': true}, d));
      sceneCache.set(key, body); if (sceneCache.size > 8) sceneCache.delete(sceneCache.keys().next().value as string);
    }
    return parts(sh('defs', null, sh('mask', {id: 'compass-shore-clear', maskUnits: 'userSpaceOnUse', x: '-1', y: '0', width: w + 2, height: box.height}, sh('rect', {x: '-1', width: w + 2, height: box.height, fill: 'white'}), mask)), body);
  }
  return {el: sec, render, fit, scenery, get events(){ return events; }, stats: () => ({scenes: sceneCache.size, dials: dialCache.size})};
}
