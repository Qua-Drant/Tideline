// 今日页（设计说明第 8 节；画面以纸本原型最终版为准）。
// 和原型的区别只在“怎么更新”：原型每次操作都整页重写；这里每块区域记下自己上次的输入，没变就不动（DOM 与风景都是）。
// 风景按“尺寸 + 版式位置 + 时刻 + 随手记时刻 + 是否全部完成”缓存，切回这一页、或改了与风景无关的东西时直接复用。
import {ink, circle, icon, buoy, smearProgress, smooth, esc, INK, PAPER, SECONDARY, TICK} from '../draw/ink.js';
import {maritimeArt} from '../draw/proto/paper-maritime-r14.js';
import {walkVisible} from '../ui/visible.js';

const minutes = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const ratio = s => Math.max(0, Math.min(1, (minutes(s) - 360) / 1080));
const smallCheck = (id, label, done = false) => `<button class="small-check" data-complete="${esc(id)}" aria-label="${done ? '重新打开' : '完成'}：${esc(label)}">${icon(done ? 'check' : 'circle')}</button>`;
const mark = (ic, label, extra = '') => `<div class="today-section-mark ${extra}">${icon(ic)}<span>${label}</span></div>`;
const md = d => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
// 0.3（使用者 2026-11-08）：航迹、往年今日、投入没有内容时，画一幅小小的手绘插图，不留大片空白。
// 线条用同一支笔（ink 按参数缓存）；带 data-empty-motion 的部分在过场开启时轻轻晃动（container.css）。
const EMPTY = {
  trail: ['完成的事会在这里连成航迹', 120, 48, () => ink([[4, 40], [22, 36], [40, 39], [58, 34], [72, 36]], 1, TICK) + ink([[10, 44], [30, 42], [48, 44]], .9, TICK)
    + `<g data-empty-motion="bob">${ink([[78, 30], [108, 30], [101, 37], [85, 37], [78, 30]], 1.2, SECONDARY)}${ink([[93, 30], [93, 7]], 1.1, SECONDARY)}${ink([[93, 9], [93, 27], [106, 25], [93, 9]], 1, SECONDARY)}</g>`],
  past: ['明年今天，会在这里遇见今天', 110, 50, () => ink([[55, 12], [33, 7], [10, 10], [10, 43], [33, 40], [55, 45]], 1.15, SECONDARY) + ink([[55, 12], [77, 7], [100, 10], [100, 43], [77, 40], [55, 45], [55, 12]], 1.15, SECONDARY)
    + [18, 25, 32].map(y => ink([[17, y], [46, y + 1.5]], .8, TICK) + ink([[63, y + 1.5], [92, y]], .8, TICK)).join('') + `<g data-empty-motion="sway">${ink([[80, 8], [81, 24], [84, 20], [87, 24], [86, 8]], .9, SECONDARY)}</g>`],
  investments: ['写下投入的时间，这里会画出长度', 70, 52, () => ink([[22, 5], [48, 5]], 1.2, SECONDARY) + ink([[22, 47], [48, 47]], 1.2, SECONDARY) + ink([[25, 6], [27, 18], [35, 26], [27, 34], [25, 46]], 1.1, SECONDARY) + ink([[45, 6], [43, 18], [35, 26], [43, 34], [45, 46]], 1.1, SECONDARY)
    + `<g data-empty-motion="sand">${ink([[35, 27], [35, 38]], .8, TICK)}${ink([[29, 44], [35, 40], [41, 44]], .9, TICK)}</g>`],
};
const emptyArt = k => { const [text, w, h, draw] = EMPTY[k]; return `<div class="today-empty" data-empty="${k}"><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${draw()}</svg><small>${text}</small></div>`; };

const SKELETON = `<div class="above"><div class="focus-section" id="focus"></div><div class="other-tasks" id="other-tasks"></div></div>
<section class="timeline" id="timeline" aria-label="6 点到 24 点的日程与随手记"><div id="events"></div><div id="time-ticks" class="time-ticks"></div></section>
<div id="event-mist" class="event-mist" role="tooltip" hidden></div>
<div class="below"><div class="left-column">
 <div class="today-subsection" data-today-group="trail">${mark('route', '航迹')}<div class="trail" id="trail"></div></div>
 <div class="today-subsection" data-today-group="past">${mark('book', '往年今日')}<blockquote id="past"></blockquote></div></div>
<div class="middle-column">
 <div class="today-subsection" data-today-group="habits">${mark('check', '习惯')}<div id="habits" class="habits"></div></div>
 <div class="today-subsection" data-today-group="questions">${mark('compass', '自问')}<div id="questions" class="questions"></div></div></div>
<div class="right-column">
 <div class="today-subsection" data-today-group="investments">${mark('sunrise', '投入')}<div id="investments"></div></div>
 <div class="today-subsection" data-today-group="journal">${mark('note', '随手记')}<div class="journal" id="journal" role="region" aria-label="随手记" tabindex="0"></div>
 <form id="journal-form" class="line-form"><input id="journal-input" placeholder="想到了什么？" aria-label="记下此刻想到的事" autocomplete="off"></form></div></div></div>`;

export function createToday({root, art, ui}){
  const sec = root.querySelector('#today'), $ = s => sec.querySelector(s), $$ = s => [...sec.querySelectorAll(s)];
  sec.innerHTML = SKELETON;
  const last = {}; // 每块区域上次的输入
  const put = (key, input, el, html) => { const k = JSON.stringify(input); if (last[key] === k) return false; last[key] = k; el.innerHTML = html(); return true; };
  const detail = t => `<div class="detail-inline" data-detail-for="${esc(t.id)}"><div class="detail-heading"><button class="inline-close" data-action="close-detail" aria-label="折回详情">×</button><button class="fold" data-open="${esc(t.path)}" aria-label="打开 ${esc(t.title)} 这篇笔记"></button><h3>${esc(t.title)}</h3><button class="text-button detail-state-action" data-complete="${esc(t.id)}">${t.status === 'done' ? '重新打开' : '完成'}</button></div><div class="detail-body">${t.project ? `<div class="field">${icon('route')}<span>${esc(t.project)}</span></div>` : ''}${t.date ? `<div class="field">${icon('sunrise')}<span class="mono">${esc(t.date)}</span></div>` : ''}${t.description ? `<p>${esc(t.description)}</p>` : ''}</div></div>`;

  let events = [], drawnView, drawnDetail, drawnChooser;
  function render(v){
    const open = ui.detail;
    if (drawnView === v && drawnDetail === open && drawnChooser === ui.chooseFocus) return;
    events = v.events;
    const selected = open && (v.focus.find(t => t.id === open) || v.other.find(t => t.id === open) || v.trail.find(t => t.id === open));
    sec.classList.toggle('all-done', v.allDone);
    // 这一天的日记、往年今日那篇日记的路径（示例笔记的淡墨要用，见 ui/examples.js）
    sec.dataset.dayNote = v.dayPath || ''; sec.dataset.pastNote = v.past?.path || '';
    // 焦点
    put('focus', [v.focus, v.allDone, v.noTasks, open, v.stats, ui.chooseFocus, ui.chooseFocus ? v.other : null], $('#focus'), () => {
      if (v.allDone) return v.noTasks ? '<p class="all-done-message">今天没有排定的航程，<br>海面平静，随时可以起锚。</p>' : '<p class="all-done-message">今天的航程已落笔，<br>余下的交给海风。</p>';
      const first = v.focus[0], ex = selected;
      if (v.focus.includes(ex)) return mark('anchor', '今日聚焦', 'focus-section-mark') + detail(ex);
      if (!first) {
        const heading = mark('anchor', '今日聚焦', 'focus-section-mark');
        if (!ui.chooseFocus) return heading + `<button class="empty-outline" data-action="choose-focus" aria-label="挑选今日重点">${icon('plus')}</button>`;
        const choices = v.other.filter(t => t.date === v.date).map(t => `<button data-focus="${esc(t.id)}">${esc(t.title)}</button>`);
        return heading + `<div class="temporary-menu" role="group" aria-label="挑选今日重点">${choices.join('') || '<span>今天没有可选的任务</span>'}<button data-action="cancel-focus">收起</button></div>`;
      }
      const s = v.stats;
      return mark('anchor', '今日聚焦', 'focus-section-mark') + `<div class="focus-primary"><div><button class="focus-name" data-detail="${esc(first.id)}">${esc(first.title)}</button><div class="focus-project">${esc(first.project || '')}</div></div><button class="outline complete" data-complete="${esc(first.id)}" aria-label="完成：${esc(first.title)}">完成</button></div>`
        + `<div class="focus-rest">${v.focus.slice(1).map(t => `<div><div class="focus-secondary">${smallCheck(t.id, t.title)}<button data-detail="${esc(t.id)}">${esc(t.title)}</button></div></div>`).join('')}</div>`
        + (open ? '' : `<div class="today-stats">${s.milestone ? `<span class="ts-station">${icon('route', 16)}里程碑 <b>${esc(s.milestone.title)}</b><i class="mono">${s.milestone.n} / ${s.milestone.of}</i></span>` : ''}<span>完成 <b class="mono">${s.done} / ${s.total}</b></span><span>投入 <b class="mono">${s.hours}h</b></span><span>习惯 <b class="mono">${s.habits} / ${s.habitTotal}</b></span>${s.next ? `<span>下一项 <b class="mono">${s.next.time}</b> ${esc(s.next.title)}</span>` : ''}</div>`);
    });
    // 其他任务
    put('other', [v.other, v.allDone, open, v.date], $('#other-tasks'), () => {
      if (v.allDone) return '';
      const ex = selected, body = v.other.includes(ex) ? detail(ex)
        : v.other.map(t => `<div><div class="task-row">${smallCheck(t.id, t.title)}<button class="task-title" data-detail="${esc(t.id)}">${esc(t.title)}${t.project ? `<small class="task-project">${esc(t.project)}</small>` : ''}</button>${t.date < v.date ? `<time>${md(t.date)}</time>` : ''}</div></div>`).join('');
      return `<div class="other-tasks-mark">${art.symbol('checklist', 19)}<span>其他任务</span></div><div class="other-task-items">${body}</div>`;
    });
    // 时间轴
    put('events', v.events, $('#events'), () => v.events.map(e => `<button class="event" data-event="${esc(e.id)}" style="left:${ratio(e.time) * 100}%" aria-label="${e.time} ${esc(e.title)}"><span class="event-icon">${buoy()}</span><span class="event-copy"><time>${e.time}</time><span class="event-title">${esc(e.title)}</span></span></button>`).join(''));
    put('ticks', 1, $('#time-ticks'), () => [6, 12, 18, 24].map((n, i) => `<span style="left:${i / 3 * 100}%">${n}</span>`).join(''));
    // 航迹、往年今日
    put('trail', [v.trail, v.nextUp, open], $('#trail'), () => {
      const ex = selected; if (ex && ex.status === 'done') return detail(ex);
      if (!v.trail.length) return emptyArt('trail') + (!open && v.nextUp.length ? `<div class="trail-next"><small>接下来</small>${v.nextUp.map(t => `<span>${esc(t.title)}</span>`).join('')}</div>` : '');
      return v.trail.map(t => `<div><button class="trail-item" data-detail="${esc(t.id)}">${esc(t.title)}</button></div>`).join('')
        + (!open && v.nextUp.length ? `<div class="trail-next"><small>接下来</small>${v.nextUp.map(t => `<span>${esc(t.title)}</span>`).join('')}</div>` : '');
    });
    put('past', v.past, $('#past'), () => v.past ? `<span class="past-mark" aria-hidden="true">“</span><p class="past-text">${esc(v.past.text).replace('，', '，<br>')}</p><cite>${v.past.year}${v.past.more.length ? `<span class="past-more">${v.past.more.map(y => `<span><b>${y.year}</b> ${esc(y.item)}</span>`).join('')}</span>` : ''}</cite>` : emptyArt('past'));
    // 习惯、自问
    put('habits', v.habits, $('#habits'), () => v.habits.map(h => `<button class="habit" data-habit="${esc(h.id)}" aria-label="${esc(h.name)}，${h.value === true ? '完成' : h.value === false ? '未完成' : '未记录'}"><span class="habit-mark">${h.value === null ? '' : h.value ? icon('dot') : icon('circle')}</span><span>${esc(h.name)}</span><span class="habit-history" aria-hidden="true">${h.history.map(x => `<svg viewBox="0 0 10 10">${x === null ? '' : x ? `<circle cx="5" cy="5" r="3.5" fill="${INK}"/>` : circle(5, 5, 3.2, 1.15)}</svg>`).join('')}</span></button>`).join(''));
    put('questions', v.questions, $('#questions'), () => v.questions.map(q => dial(q)).join(''));
    // 投入、随手记
    put('investments', [v.investments, v.scale], $('#investments'), () => !v.investments.length ? emptyArt('investments') : v.investments.map(t => `<div class="investment"><div class="investment-label"><button data-investment="${esc(t.id)}">${esc(t.title)}</button><time>${t.hours}h</time></div><div class="investment-smear" aria-label="${esc(t.title)}，${t.hours}h，统一 ${v.scale}h 比例尺">${smearProgress(t.hours, v.scale, 310, 'effort-' + t.id)}</div></div>`).join(''));
    const journal = $('#journal'), atEnd = journal.scrollHeight - journal.clientHeight - journal.scrollTop < 3;
    if (put('journal', v.journal, journal, () => v.journal.map(n => `<div class="journal-line"><time>${n.time}</time><span>${esc(n.text)}</span></div>`).join(''))) ui.journalFollow = ui.journalFollow || atEnd || !last.journalSeen;
    last.journalSeen = true;
    drawnView = v; drawnDetail = open; drawnChooser = ui.chooseFocus;
  }

  // 拨盘（原型 renderQuestions）：刻度与数字是静态的，只有指针随分数变；整块按分数缓存
  const dialCache = new Map();
  function dial(q){
    const key = q.title + '|' + q.value; if (dialCache.has(key)) return dialCache.get(key);
    let scale = ink(Array.from({length: 41}, (_, i) => { const a = Math.PI + i / 40 * Math.PI; return [87 + Math.cos(a) * 48, 86 + Math.sin(a) * 48]; }), 1.05, SECONDARY);
    for (let i = 1; i <= 10; i++) { const a = Math.PI + (i - 1) / 9 * Math.PI, x = 87 + Math.cos(a) * 64, y = 86 + Math.sin(a) * 64; scale += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${i}</text>` + ink([[87 + Math.cos(a) * 42, 86 + Math.sin(a) * 42], [87 + Math.cos(a) * 49, 86 + Math.sin(a) * 49]], i === 1 || i === 10 ? 1.45 : 1.2, SECONDARY); }
    const a = Math.PI + ((q.value || 1) - 1) / 9 * Math.PI;
    const html = `<div class="question"><div class="question-title">${esc(q.title)}</div><svg class="dial" data-question="${esc(q.id)}" viewBox="0 0 174 100" role="slider" tabindex="0" aria-label="${esc(q.title)}" aria-valuemin="1" aria-valuemax="10" ${q.value ? 'aria-valuenow="' + q.value + '"' : ''} aria-valuetext="${q.value || '未记录'}">${scale}${q.value ? `<g class="needle">${ink([[87 - Math.cos(a) * 4, 86 - Math.sin(a) * 4], [87, 86], [87 + Math.cos(a) * 36, 86 + Math.sin(a) * 36]], 2, 'currentColor')}${circle(87, 86, 3.1, 1.4, 'currentColor')}</g>` : ''}</svg></div>`;
    dialCache.set(key, html); return html;
  }

  // 浮标旁的“时刻 名称”给下一个浮标让位（原型只有相隔很远的两个日程；接上日历订阅后会挨得很近）：
  // 放得下就照原样；放不下名称就截短加省略号；连名称的开头都放不下就只留时刻；时刻也放不下就只留浮标。完整内容悬停时在浮标详情里看。
  let labelKey = '';
  function labels(){
    const copies = $$('#events .event-copy'); if (!copies.length) { labelKey = ''; return; }
    const W = $('#events').getBoundingClientRect(), key = W.width + '|' + copies.map(c => c.textContent).join('|') + '|' + sec.classList.contains('all-done');
    if (key === labelKey) return; labelKey = key;
    for (const c of copies) { c.classList.remove('is-clipped', 'is-terse', 'is-bare'); c.style.maxWidth = ''; }
    const m = copies.map(c => { const r = c.getBoundingClientRect(), icon = c.parentElement.querySelector('.event-icon').getBoundingClientRect(); return {c, left: r.left, width: c.scrollWidth, icon: icon.left, time: c.querySelector('time').getBoundingClientRect().width + 10}; });
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
  function fit(box){
    const journal = $('#journal'), form = $('#journal-form'), wrap = $('.other-task-items');
    const top = journal.getBoundingClientRect().top, formH = form.getBoundingClientRect().height;
    const rows = wrap && !wrap.querySelector('.detail-inline') ? [...wrap.children] : [];
    if (wrap) { wrap.style.maxHeight = ''; wrap.style.flex = ''; }
    const wtop = wrap?.getBoundingClientRect().top, limit = wrap ? $('#other-tasks').getBoundingClientRect().bottom - wtop : 0;
    let fitH = 0; for (const r of rows) { const end = r.getBoundingClientRect().bottom - wtop; if (end <= limit + .1) fitH = end; else break; }
    const items = [...$$('#trail .trail-item')], tb = $('#trail').getBoundingClientRect(), ys = items.map(b => b.getBoundingClientRect().top - tb.top + $('#trail').scrollTop + 19);
    // 写
    // 纸不滚动时，随手记撑到纸底；窄视图里纸会滚动，随手记用样式里的固定高度
    journal.style.maxHeight = box.scroll ? '' : Math.max(52, Math.floor(box.bottom - 48 - top - formH)) + 'px';
    if (ui.journalFollow) { journal.scrollTop = journal.scrollHeight; ui.journalFollow = false; }
    if (fitH > 0) { wrap.style.maxHeight = fitH + 'px'; wrap.style.flex = '0 1 auto'; }
    trail(ys);
    labels();
    alignJournal(journal);
  }
  // 随手记停在最新一条时，窗口从整行开始（原型 R31）：框高不是行距的整数倍，就在底部补上余数那么多的内边距
  function alignJournal(el){
    const rows = [...el.children], cur = parseFloat(el.style.paddingBottom) || 0; let pad = 0;
    if (rows.length > 1) { const pitch = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top, o = rows[0].getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop, end0 = el.scrollHeight - cur - el.clientHeight;
      if (pitch >= 8 && end0 > 1) pad = Math.round(((pitch - ((end0 - o) % pitch + pitch) % pitch) % pitch) * 10) / 10;
      // 窗口比一行还矮（窄栏里一条折成两行）时，补到最后一行顶着窗口上沿为止，不能把它推出窗口
      pad = Math.min(pad, Math.max(0, Math.floor(el.clientHeight - cur - rows.at(-1).getBoundingClientRect().height))); }
    const atEnd = el.scrollHeight - el.clientHeight - el.scrollTop < 3;
    if (Math.abs(pad - cur) > .2) { el.style.paddingBottom = pad ? pad + 'px' : ''; if (atEnd) el.scrollTop = el.scrollHeight; }
  }
  function trail(ys){
    const t = $('#trail'); let svg = t.querySelector('.trail-sketch');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('trail-sketch'); svg.setAttribute('aria-hidden', 'true'); t.prepend(svg); }
    const key = ys.map(Math.round).join(','); if (svg.dataset.key === key) return; svg.dataset.key = key;
    const h = Math.max(t.clientHeight, t.scrollHeight, 1); svg.setAttribute('viewBox', `0 0 28 ${h}`); svg.style.height = h + 'px';
    let s = ys.length > 1 ? ink(ys.map((y, i) => [11 + Math.sin(i * .9) * 1.1, y]), 2.15, SECONDARY, 'data-route-stroke') : '';
    for (const y of ys) s += `<circle cx="11" cy="${y}" r="5" fill="${PAPER}"/>` + circle(11, y, 3.2, 1.5);
    svg.innerHTML = s;
  }

  // 风景（原型 drawScenery 的 today 分支）
  const sceneCache = new Map();
  const marine = maritimeArt({ink: art.L, curve: ink, circle, draw(points, size, color){
    const center = smooth(points).map(point => point.map(n => n.toFixed(2)).join(',')).join('L');
    return ink(points, size, color, `data-draw-path="M${center}" data-draw-width="${size}"`);
  }});
  function obstacles(base, completed){
    const out = [], m = 12, range = document.createRange();
    const add = (left, top, right, bottom) => {
      if (right > left && bottom > top) out.push(`<rect x="${(left - base.left - m).toFixed(1)}" y="${(top - base.top - m).toFixed(1)}" width="${(right - left + 2 * m).toFixed(1)}" height="${(bottom - top + 2 * m).toFixed(1)}" fill="black"/>`);
    };
    walkVisible(sec, (n, c) => { range.selectNode(n);
      for (const b of range.getClientRects()) { let {top, bottom, left, right} = b; if (c) { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); left = Math.max(left, c.left); right = Math.min(right, c.right); }
        add(left, top, right, bottom); } });
    // 完成态的日程文字在浮标按钮外，滚动区遍历可能把它当成被按钮截去的文字。
    if (completed) for (const label of $$('.event-copy')) {
      if (getComputedStyle(label).visibility === 'hidden') continue;
      const clip = label.getBoundingClientRect();
      for (const text of label.children) for (const rect of text.getClientRects()) add(rect.left, rect.top, Math.min(rect.right, clip.right), rect.bottom);
    }
    return out.join('');
  }
  // 下方各栏的范围：宽视图是三个栏容器；窄视图里栏容器不占位（display:contents），按小节的左边缘归成两栏
  function columns(){
    const cols = $$('.below > div').map(e => e.getBoundingClientRect());
    if (cols.some(c => c.width)) return cols;
    const by = new Map();
    for (const s of $$('.below .today-subsection')) { const r = s.getBoundingClientRect(), k = Math.round(r.left), c = by.get(k); if (!r.width) continue;
      by.set(k, c ? {left: Math.min(c.left, r.left), right: Math.max(c.right, r.right), bottom: Math.max(c.bottom, r.bottom)} : {left: r.left, right: r.right, bottom: r.bottom}); }
    return [...by.values()].sort((a, b) => a.left - b.left);
  }
  function scenery(v, box){
    const tb = $('#timeline').getBoundingClientRect(), w = box.width, y = Math.round(tb.top - box.top + 60), x = ratio(v.time) * w;
    const above = $('.above').getBoundingClientRect(), focus = $('#focus').getBoundingClientRect(), other = $('#other-tasks').getBoundingClientRect(), below = $('.below').getBoundingClientRect(), cols = columns();
    const side = other.left > focus.right - 1; // 聚焦与其他任务左右并排（窄视图 < 820 时上下排，不画竖线）
    const geo = [w, box.height, y, Math.round(focus.right), Math.round(other.left), Math.round(above.top - box.top), Math.round(above.bottom - box.top), Math.round(below.top - box.top), side, ...cols.map(c => Math.round(c.right) + ':' + Math.round(c.bottom))];
    const key = JSON.stringify([geo, v.time, v.journal.map(n => n.time), v.allDone, v.events.length]);
    const mask = obstacles(box, v.allDone); // 遮罩跟着文字走，便宜，不进缓存
    let body = sceneCache.get(key);
    if (!body) {
      const horizon = Array.from({length: 65}, (_, i) => { const t = i / 64; return [t * w, y + Math.sin(t * Math.PI * 2) * .6 + Math.sin(t * Math.PI * 8) * .16]; });
      let s = `<g data-morph="horizon">${ink(horizon, 1.5, '#A3B4BA')}${ink(horizon.filter(q => q[0] < x).concat([[x, y + Math.sin(x / w * Math.PI * 2) * .6]]), 1.7)}</g>`;
      for (const n of [0, 1 / 3, 2 / 3, 1]) s += ink([[n * w, y - 3], [n * w, y + 5]], 1.15, TICK);
      for (const n of v.journal) { const xx = ratio(n.time) * w; s += ink([[xx, y - 6], [xx, y + 4]], 1.25); }
      const ship = art.ship(x, y), shore = `<g mask="url(#compass-shore-clear)">${art.water(w, y, x, v.allDone)}</g>`;
      // 完成风景里有填色的远岸。先画远岸，再画水线、刻度与小船。
      s = v.allDone ? `${shore}<g mask="url(#compass-shore-clear)">${marine.completed(w, y)}</g>${s}${ship}` : s + ship + shore;
      if (v.allDone) s += `<g data-morph="water">${ink([[w * .82, y + 43], [w * .88, y + 42], [w * .97, y + 43]], 1.1, TICK)}${ink([[w * .78, y + 55], [w * .84, y + 56], [w * .91, y + 55]], 1.05, TICK)}${ink([[w * .89, y + 67], [w * .93, y + 66], [w * .99, y + 67]], 1, TICK)}</g>`;
      let d = ''; if (!v.allDone && side) { const xx = (focus.right + other.left) / 2 - box.left; d += art.L([[xx, above.top - box.top], [xx, above.bottom - box.top - 4]], .8, TICK); }
      for (let i = 1; i < cols.length; i++) { const xx = (cols[i - 1].right + cols[i].left) / 2 - box.left; d += art.L([[xx, below.top - box.top + 2], [xx, Math.min(box.height - 30, Math.max(cols[i - 1].bottom, cols[i].bottom) - box.top - 3)]], .75, TICK); }
      body = s + `<g data-r14-dividers>${d}</g>`;
      sceneCache.set(key, body); if (sceneCache.size > 8) sceneCache.delete(sceneCache.keys().next().value);
    }
    return `<defs><mask id="compass-shore-clear" maskUnits="userSpaceOnUse" x="-1" y="0" width="${w + 2}" height="${box.height}"><rect x="-1" width="${w + 2}" height="${box.height}" fill="white"/>${mask}</mask></defs>${body}`;
  }
  return {el: sec, render, fit, scenery, get events(){ return events; }, stats: () => ({scenes: sceneCache.size, dials: dialCache.size})};
}
