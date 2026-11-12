// 思索页（灯塔亮着：本周规划；熄灭：想法星空与想法流）。
// 原型里这一页的代码散在 paper.js 里（renderThought、renderIdeas、热力图、星空、标签、拖动排期、风景的 thought 分支），
// 这里逐个搬过来，只做两类改动：document → 插件根元素（HOST）；写死的日期（2026-08-03 起的热力图、第 40–52 周、2026-10-26 那一周）改成按时钟算。
// 数据是下方五页共用的那份 d（model.js），改动由 persist.js 写回笔记。
import {getStroke} from 'perfect-freehand';
import {HOST} from '../host.js';
import {ink, circle, icon, star, esc, randomFor, smearProgress, INK, TICK} from '../draw/ink.js';
import {Lexer} from '../draw/proto/vendor/marked.mjs';
import {createGoals} from '../ui/goals.js';

function renderIdeaTokens(tokens){
  return tokens.map(token => {
    if (token.type !== 'link') {
      if (['em', 'strong', 'del'].includes(token.type)) {
        const at = token.raw.indexOf(token.text);
        if (at >= 0) return esc(token.raw.slice(0, at)) + renderIdeaTokens(token.tokens) + esc(token.raw.slice(at + token.text.length));
      }
      return esc(token.raw);
    }
    let {href, text: label} = token, tail = '';
    if (token.raw === label) {
      const punctuation = label.search(/[，。；！？、）】》」』：]/u);
      if (punctuation >= 0) {
        tail = label.slice(punctuation);
        label = label.slice(0, punctuation);
        href = href.slice(0, href.length - tail.length);
      }
    }
    if (!/^https?:\/\//i.test(href)) return esc(token.raw);
    try { new URL(href); } catch { return esc(token.raw); }
    return `<a class="idea-web-link external-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>${esc(tail)}`;
  }).join('');
}
const ideaLinks = text => /https?:\/\/|www\./i.test(text) ? renderIdeaTokens(Lexer.lexInline(text, {gfm: true})) : esc(text);

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'], MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const addDays = (date, n) => { const t = new Date(date + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export function isoWeek(date){ const d = new Date(date + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - y) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); }

export const THOUGHT_HTML = `<section id="thought" class="page thought" aria-label="思索" hidden>
<div class="sky-interactions" id="sky-interactions"><button class="sky-empty" id="sky-empty" aria-label="在天空记下想法" hidden></button><div id="weeks"></div><div id="stars"></div><button id="lighthouse-toggle" class="lighthouse-hit" aria-label="熄灭灯塔，查看想法" aria-pressed="true"></button></div>
<div id="planning" class="planning"><div class="goals" id="goals"></div><button class="fold week-fold" data-action="week-note" aria-label="展开本周周记"></button><div id="week-board" class="week-board"></div></div>
<div id="ideas" class="ideas" hidden><div class="ideas-layout"><aside class="ideas-index"><div id="idea-heatmap" class="idea-heatmap"></div><div id="idea-filters" class="idea-filters"></div></aside><div class="ideas-stream"><form id="idea-form" class="idea-composer"><textarea id="idea-input" aria-label="记下一条想法" placeholder="现在的想法是…" rows="1"></textarea><div class="composer-bottom"><div class="composer-tag-tools" data-expanded="false"><button class="composer-tag-toggle" id="idea-tag-toggle" type="button" aria-label="选择想法标签" aria-controls="idea-tag-drawer" aria-expanded="false"><span id="composer-mark" aria-hidden="true"></span></button><div class="composer-tag-runway"><div id="idea-tag-drawer" class="tag-inline-drawer" role="group" aria-label="想法标签选择" aria-hidden="true" inert><div id="tag-inline-options" class="tag-inline-options"></div></div><div id="chosen-tag-wrap" class="chosen-tag-wrap"><div id="composer-tags" class="composer-tags"></div></div></div></div><button class="text-button" type="submit">记下</button></div></form><div id="idea-list" class="idea-feed"></div></div></div></div>
</section>`;

export function createThought({core, r12Art, r14Marine, view}){
  const d = core.data, $ = s => HOST.querySelector(s), $$ = s => [...HOST.querySelectorAll(s)];
  const asset = core.asset, announce = core.announce;
  const minutes = () => { const [h, m] = d.clock.time.split(':').map(Number); return h * 60 + m; };
  // 周号节点：本周前 4 周到后 8 周（原型固定是第 40–52 周，本周 44）
  const weekNodes = () => { const s = HOST.weekStart(d.clock.date); return Array.from({length: 13}, (_, i) => { const start = addDays(s, (i - 4) * 7); return {start, week: isoWeek(start)}; }); };
  const currentWeek = () => (weekNodes().find(n => n.week === d.ui.week) || weekNodes()[4]);
  function weekDates(){ const base = currentWeek().start; return Array.from({length: 7}, (_, i) => { const x = addDays(base, i); return [x, Number(x.slice(8))]; }); }
  d.ui.week ??= isoWeek(d.clock.date);
  // 0.8：目标一排、目标详情纸、项目详情里的关联目标（src/ui/goals.js）
  const goals = createGoals({core, view, render: () => renderThought()});

  function renderThought(){
    const night = minutes() < 360 || minutes() >= 1140;
    $('#thought').classList.toggle('night', night); $('#planning').hidden = !d.ui.lamp; $('#ideas').hidden = d.ui.lamp;
    $('#lighthouse-toggle').setAttribute('aria-pressed', String(d.ui.lamp)); $('#lighthouse-toggle').setAttribute('aria-label', d.ui.lamp ? '熄灭灯塔，查看想法' : '点亮灯塔，查看规划'); $('#sky-empty').hidden = d.ui.lamp;
    renderGoalProgress();
    const revDay = date => d.review?.days?.find(r => r.date === date), proj = id => d.projects?.find(p => p.id === id);
    $('#week-board').innerHTML = [[null, null], ...weekDates()].map(([date, num]) => {
      const tasks = d.tasks.filter(t => date ? t.date === date : !t.date), done = tasks.filter(t => t.status === 'done').length, isToday = date === d.clock.date, future = date && date > d.clock.date, rv = date && revDay(date), wd = date ? WD[new Date(date + 'T12:00:00Z').getUTCDay()] : '';
      const hrs = isToday ? d.investments.reduce((n, x) => n + x.hours, 0) : rv ? rv.investments.reduce((n, x) => n + x.hours, 0) : 0, habits = isToday ? d.habits.map(h => h.value) : rv ? rv.habits : null;
      const head = date ? `<div class="day-number ${isToday ? 'now' : ''}">${num}<small>${wd}${isToday ? ' · 今天' : ''}</small></div>` : `<div class="unscheduled-icon" aria-hidden="true">${icon('box')}<small>未排期</small></div>`;
      const sum = `<p class="day-sum">${tasks.length ? `<span>${date ? (future ? '计划' : '完成 ' + done + ' /') : '待排'} <b class="mono">${date && !future ? tasks.length : tasks.length}</b> 件</span>` : ''}${hrs ? `<span class="mono">${hrs}h</span>` : ''}</p>`;
      const events = (d.planningEvents.get(date) || []).map(e => `<div class="day-event" role="listitem"><span class="mono">${esc(e.time || '全天')}</span>${esc(e.title)}</div>`).join('');
      const items = tasks.map(t => `<div class="plan-task ${t.status === 'done' ? 'done' : ''}" role="listitem" tabindex="0" draggable="true" data-plan="${esc(t.id)}" aria-label="${esc(t.title)}，${date || '未排期'}，可拖动"><i class="pt-mark" aria-hidden="true">${t.status === 'done' ? '✓' : ''}</i><span class="pt-title">${esc(t.title)}</span>${t.projectId && proj(t.projectId) ? `<small class="pt-project">${esc(proj(t.projectId).title)}</small>` : ''}</div>`).join('');
      const foot = habits ? `<div class="day-foot" aria-label="习惯">${habits.map(v => `<i class="${v === null ? 'is-null' : v ? 'is-on' : 'is-off'}"></i>`).join('')}</div>` : '';
      return `<div class="day-column ${isToday ? 'is-today' : ''} ${future ? 'is-future' : ''}" role="list" data-drop="${date || ''}" aria-label="${date || '未排期'}">${head}${sum}${events}${items}${!tasks.length && !events ? `<button type="button" class="day-empty-new" data-day-new="${date || ''}" aria-label="在${date ? num + '日' : '未排期'}记一件任务" title="在这天记一件任务"><span aria-hidden="true">+</span></button>` : ''}${foot}</div>`; }).join('');
    renderIdeas(); renderSkyControls();
  }
  function renderGoalProgress(){ goals.renderRow(); }
  const selectedIdea = () => d.ideas.find(x => x.id === d.ui.idea) || d.ideas[0];
  function renderIdeas(){
    renderHeatmap(); renderComposerTags(); $('#idea-form').dataset.empty = String(!(d.cache.ideaDraft || ''));
    const visible = d.ideas.filter(i => (!d.ui.ideaDate || i.created.slice(0, 10) === d.ui.ideaDate) && (!d.ui.ideaTag || tagsOf(i).includes(d.ui.ideaTag))).sort((a, b) => Number(b.review) - Number(a.review) || b.created.localeCompare(a.created));
    if (visible.length && !visible.some(i => i.id === d.ui.idea)) d.ui.idea = visible[0].id;
    const feed = $('#idea-list'), scroll = feed.scrollTop;
    feed.innerHTML = visible.map(i => { const expanded = i.id === d.ui.idea && d.ui.ideaExpanded !== false; return `<article class="idea-card ${expanded ? 'expanded' : ''}" data-idea-card="${esc(i.id)}"><div class="idea-card-meta"><time>${i.created.slice(0, 10)}</time>${ideaTagLinks(i)}<button class="idea-card-star" data-idea="${esc(i.id)}" aria-label="展开 ${esc(i.title)}">${ideaStar(i)}</button></div><button class="idea-card-title" data-idea="${esc(i.id)}" aria-expanded="${expanded}">${esc(i.title)}</button>${expanded ? `<div id="idea-detail" class="idea-detail"><button class="fold" data-action="idea-source" aria-label="展开想法的 Markdown"></button>${ideaBody(i)}</div>` : `<p class="idea-excerpt">${ideaLinks(i.body.split('\n\n')[0])}</p>`}</article>`; }).join('') || ideaEmptyScene();
    feed.classList.toggle('is-empty', visible.length === 0);
    feed.scrollTop = scroll;
  }
  function ideaBody(idea){ return `${idea.body.split('\n\n').map(p => `<p>${ideaLinks(p)}</p>`).join('')}${idea.source ? `<button class="source" data-action="idea-origin">${esc(idea.source)}</button>` : ''}<div class="actions"><button data-action="idea-stage" aria-label="更改想法的成熟度">${ideaStar(idea)}</button><button data-action="idea-link" aria-label="关联来源">${icon('route')}</button><button class="text-button" data-convert="task">转为任务</button><button class="text-button" data-convert="project">转为项目</button></div>${d.ui.menu === 'idea-stage' ? `<div class="temporary-menu">${['seed', 'growing', 'ready', 'adopted', 'parked'].map((s, i) => `<button data-stage="${s}">${['萌芽', '发展中', '成形', '已采用', '搁置'][i]}</button>`).join('')}</div>` : ''}${d.ui.source === 'idea' ? `<pre class="markdown-preview">${esc('---\nsource: ' + (idea.source || '') + '\n---\n\n' + idea.body)}</pre>` : ''}`; }
  // 热力图：最近 13 周（本周在最后一列）
  function renderHeatmap(){
    const start = addDays(HOST.weekStart(d.clock.date), -84), counts = {}; d.ideas.forEach(i => counts[i.created.slice(0, 10)] = (counts[i.created.slice(0, 10)] || 0) + 1);
    let cells = ''; for (let col = 0; col < 13; col++) for (let row = 0; row < 7; row++) { const date = addDays(start, col * 7 + row), count = counts[date] || 0, future = date > d.clock.date; cells += `<button class="heat-cell ${date === d.ui.ideaDate ? 'selected' : ''}" data-heat-date="${date}" data-count="${count}" ${future ? 'disabled' : ''} aria-pressed="${date === d.ui.ideaDate}" aria-label="${date}，${count} 条想法">${heatCell(future ? 0 : count, date)}</button>`; }
    const months = [0, 6, 12].map(c => MONTH[Number(addDays(start, c * 7).slice(5, 7)) - 1]);
    $('#idea-heatmap').innerHTML = `<div class="heat-months">${months.map(m => `<span>${m}</span>`).join('')}</div><div class="heat-grid">${cells}</div>`;
    renderIdeaTagFilters();
  }
  function heatCell(count, date){
    const rand = randomFor(date), level = Math.min(4, count); let s = ink([[4, 1.5], [16, 1.5], [18.5, 4], [18.5, 16], [16, 18.5], [4, 18.5], [1.5, 16], [1.5, 4], [4, 1.5]], .85, '#A8B3B7');
    for (let row = 0; row < level * 2; row++) { const yy = 16.3 - row * 1.65, x1 = 3 + rand(), x2 = level === 1 ? 10.5 + rand() * 2 : level === 2 ? 13.5 + rand() * 2 : 17; s += ink([[x1, yy], [x1 + (x2 - x1) * .42, yy - .45], [x2, yy - .1]], 2.15, INK, 'opacity=".72"'); }
    return `<svg viewBox="0 0 20 20" aria-hidden="true" data-coverage="${level}">${s}</svg>`;
  }
  function renderSkyControls(){
    sky(); const w = $('#sheet').clientWidth; $('#weeks').hidden = !d.ui.lamp; $('#stars').hidden = d.ui.lamp;
    $('#weeks').innerHTML = weekNodes().map(({week}, i) => { const x = 90 + i * (w - 370) / 12, y = 145 - Math.sin(i / 12 * Math.PI) * 49; return `<button class="week-node" data-week="${week}" style="left:${x}px;top:${y}px;--sky-node-ink:${r12Art.skyInk(x, y, w)}" ${d.ui.week === week ? 'aria-current="true"' : ''} aria-label="第 ${week} 周">${week}</button>`; }).join('');
    $('#stars').innerHTML = d.ideas.map((i, n) => { const [x, y] = starPosition(n, w), color = r12Art.skyInk(x, y, w), size = {seed: 1.8, growing: 2.8, ready: 3.8, adopted: 3.8, parked: 1.8}[i.stage] || 1.8; return `<button class="star-button" data-star="${esc(i.id)}" style="left:${x}px;top:${y}px" aria-label="${i.review ? '回顾' : '展开'}：${esc(i.title)}"><svg viewBox="0 0 32 32" aria-hidden="true"><g opacity="${i.stage === 'seed' ? .55 : 1}">${skyGlint(16, 16, size, color)}${i.review ? circle(16, 16, 7, .65, color) : ''}</g></svg></button>`; }).join('');
  }
  function ideaStar(i){ const size = {seed: 5, growing: 6.5, ready: 8, adopted: 8, parked: 5}[i.stage] || 5, opacity = {seed: .5, growing: .75, ready: 1, adopted: 1, parked: .35}[i.stage] || .5; return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><g opacity="${opacity}">${star(12, 12, size)}${i.review ? circle(12, 12, 10, 1) : ''}</g></svg>`; }
  function starPosition(n, w){ const halton = (v, base) => { let result = 0, f = 1; while (v) { f /= base; result += f * (v % base); v = Math.floor(v / base); } return result; }; return [(.055 + halton(n + 1, 2) * .73) * w, 40 + halton(n + 1, 3) * 149]; }
  const skyGlint = (x, y, r, color) => ink([[x - r, y], [x, y - .45], [x + r, y]], .6, color) + ink([[x, y - r * 1.45], [x - .2, y], [x, y + r * 1.45]], .65, color);
  function skyLink(p, q){ const key = 'r15-dash-' + p.map(Math.round).join('-') + '-' + q.map(Math.round).join('-'), x = (p[0] + q[0]) / 2, y = (p[1] + q[1]) / 2, w = $('#sheet').clientWidth, color = r12Art.skyInk(x, y, w); return `<defs><mask id="${key}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="240"><path d="M${p.join(',')}L${q.join(',')}" fill="none" stroke="white" stroke-width="3" stroke-dasharray="2.5 6.5"/></mask></defs><g data-star-link mask="url(#${key})">${ink([p, q], .62, color, 'opacity=".62"')}</g>`; }
  function lampGlow(cx, cy, on, night){
    const rand = randomFor('lamp-halo'), color = on ? (night ? '#D8B77D' : '#BE965F') : '#8D9291'; let s = '';
    if (on) for (const [size, opacity] of [[52, .045], [38, .09], [24, .16]]) { const p = getStroke([[cx, cy, .55]], {size, thinning: .15, smoothing: .8, simulatePressure: false}); s += `<path d="M${p.map(q => q.join(',')).join('L')}Z" fill="${color}" opacity="${opacity}"/>`; }
    for (let i = 0; i < 190; i++) { const a = rand() * Math.PI * 2, r = Math.pow(rand(), 1.8) * (on ? 32 : 13), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .86, opacity = (on ? (night ? .11 : .12) : .035) * (1 - r / 40); s += ink([[x - .4, y], [x + .5, y + .1]], 2 + rand() * 2.6, color, `opacity="${opacity.toFixed(3)}"`); }
    return s + ink([[cx - .2, cy], [cx + .2, cy]], on ? 6.2 : 2.8, color, `opacity="${on ? .88 : .3}"`);
  }
  function ideaEmptyScene(){
    const planets = circle(70, 38, 23, 1.4) + ink([[33, 54], [52, 46], [88, 28], [109, 16]], 1.1) + ink([[33, 54], [40, 58], [77, 43], [109, 16]], 1.1) + circle(161, 66, 11, 1.25) + star(18, 19, 4) + star(140, 12, 3.5) + star(195, 88, 3);
    return `<div class="idea-empty" data-idea-empty><svg class="idea-empty-planets" viewBox="0 0 240 115" aria-hidden="true">${planets}</svg><p class="idea-empty-quote">每一个微小的念头，都可能成为一颗星。</p><svg class="idea-empty-art" viewBox="${d.cache.assetBoxes?.['telescope-r10']}" preserveAspectRatio="xMaxYMax meet" role="img" aria-label="岸边的三脚架望远镜，镜筒指向天空">${asset('telescope-r10')}</svg></div>`;
  }
  // 标签
  const cleanTag = v => String(v || '').normalize('NFKC').trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ');
  const tagsOf = idea => [...new Set((idea.tags ?? (idea.tag ? [idea.tag] : [])).map(cleanTag).filter(Boolean))];
  function ideaTagNames(){ d.ideaTags ??= []; const all = [...new Set([...d.ideaTags, ...d.ideas.flatMap(tagsOf)].map(cleanTag).filter(Boolean))]; if (all.join('|') !== d.ideaTags.join('|')) d.ideaTags = all; return d.ideaTags; }
  const ideaTagLinks = idea => { const tags = tagsOf(idea); return tags.length ? `<span class="idea-card-tags">${tags.map(tag => `<button type="button" data-idea-tag-filter="${esc(tag)}" aria-label="筛选标签：${esc(tag)}">${esc(tag)}</button>`).join('')}</span>` : ''; };
  function renderIdeaTagFilters(){
    const previous = $('#idea-tag-list'); if (previous) d.cache.tagSidebarScroll = previous.scrollTop;
    $('#idea-filters').innerHTML = `<button type="button" class="idea-filter ${!d.ui.ideaDate && !d.ui.ideaTag ? 'active' : ''}" data-idea-all aria-pressed="${!d.ui.ideaDate && !d.ui.ideaTag}">${icon('nodes')}<span>全部</span></button><div id="idea-tag-list" class="idea-tag-scroll" role="region" aria-label="想法标签" tabindex="0">${ideaTagNames().map(tag => `<button type="button" class="idea-filter ${d.ui.ideaTag === tag ? 'active' : ''}" data-idea-tag-filter="${esc(tag)}" aria-pressed="${d.ui.ideaTag === tag}" title="${esc(tag)}">${icon('star', 16)}<span>${esc(tag)}</span></button>`).join('')}</div><form id="tag-inline-form" class="tag-inline-create"><span aria-hidden="true">${icon('plus', 16)}</span><span class="tag-input-line"><input id="tag-inline-name" aria-label="新建标签" placeholder="新建标签" autocomplete="off" value="${esc(d.ui.tagNewName || '')}"><svg viewBox="0 0 128 30" aria-hidden="true">${ink([[0, 28], [64, 27.7], [128, 28]], .95, TICK)}</svg></span></form>${d.ui.tagError ? `<p class="tag-inline-error" role="status">${esc(d.ui.tagError)}</p>` : ''}${d.ui.ideaDate ? `<button type="button" class="idea-date-filter" data-idea-all aria-label="清除日期筛选 ${d.ui.ideaDate}"><time>${d.ui.ideaDate}</time><span aria-hidden="true">×</span></button>` : ''}`;
    fitTagSidebar(); $('#idea-tag-list').scrollTop = d.cache.tagSidebarScroll || 0;
  }
  function fitTagSidebar(){
    if (d.ui.page !== 'thought' || d.ui.lamp) return; const list = $('#idea-tag-list'); if (!list) return;
    const filters = $('#idea-filters'), other = [...filters.children].filter(el => el !== list && el.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING), gap = parseFloat(getComputedStyle(filters).rowGap) || 0;
    const reserve = other.reduce((h, el) => h + el.getBoundingClientRect().height + gap, 0), available = Math.max(28, Math.floor(HOST.bottom - 20 - list.getBoundingClientRect().top - reserve)); list.style.maxHeight = available + 'px';
  }
  function renderComposerTags(){
    d.ui.draftTags ??= []; $('#composer-mark').innerHTML = icon('star', 19); const open = !!d.ui.tagPicker, tools = $('.composer-tag-tools'), toggle = $('#idea-tag-toggle');
    tools.dataset.expanded = String(open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', (open ? '收回想法标签' : '选择想法标签') + (d.ui.draftTags.length ? '：' + d.ui.draftTags.join('、') : ''));
    $('#composer-tags').innerHTML = d.ui.draftTags.map(tag => `<button type="button" data-remove-draft-tag="${esc(tag)}" aria-label="移除标签：${esc(tag)}">${esc(tag)}</button>`).join('');
    const options = $('#tag-inline-options'), scroll = options.scrollLeft; options.innerHTML = ideaTagNames().map(tag => `<button type="button" class="tag-inline-choice" data-draft-tag="${esc(tag)}" aria-pressed="${d.ui.draftTags.includes(tag)}">${esc(tag)}</button>`).join(''); options.scrollLeft = scroll;
    $('#idea-tag-drawer').inert = !open; $('#idea-tag-drawer').setAttribute('aria-hidden', String(!open)); $('#chosen-tag-wrap').inert = open; $('#chosen-tag-wrap').setAttribute('aria-hidden', String(open));
  }
  const closeTagPanels = () => { d.ui.tagPicker = false; renderComposerTags(); };
  function finishInlineTag(){
    const input = $('#tag-inline-name'), raw = input.value, tag = cleanTag(raw); d.ui.tagNewName = raw;
    if (!tag) { if (!raw.trim()) return; d.ui.tagError = '请输入标签名称'; renderIdeaTagFilters(); $('#tag-inline-name').focus({preventScroll: true}); return; }
    if (!ideaTagNames().includes(tag)) d.ideaTags.push(tag); d.ui.tagNewName = ''; d.ui.tagError = ''; renderIdeaTagFilters(); renderComposerTags(); $('#idea-tag-list').scrollTop = $('#idea-tag-list').scrollHeight; $('#tag-inline-name').focus({preventScroll: true});
  }
  const fitIdeaEntry = () => { const el = $('#idea-input'); el.style.height = '32px'; if (el.value.includes('\n')) el.style.height = Math.min(120, Math.max(32, el.scrollHeight)) + 'px'; };
  // 记下一条想法（原型 captureValue 的 idea 分支）
  function captureIdea(text, tags){
    const clean = text.trim(); if (!clean) return; const id = 'new-' + d.serial++;
    d.ui.ideaDate = d.clock.date; d.ui.ideaTag = null; d.ui.ideaExpanded = true;
    d.ideas.unshift({id, title: clean.split('\n')[0].slice(0, 48), body: clean, stage: 'seed', review: false, tag: tags[0] || '', tags: [...tags], created: d.clock.date}); d.ui.idea = id;
    update(); announce(clean);
  }
  const update = () => { renderThought(); view.drawScenery(); };
  // 0.7：“展开 Markdown”改为在 Obsidian 的新标签页里打开笔记
  const openNote = path => { const w = view.plugin?.writer; if (path && w && w.exists?.(path) !== false) w.open(path); else announce('这一项还没有对应的笔记'); };

  // 天空（1600×320 逐像素生成，上百毫秒）与灯塔着色只随“时刻 + 灯开关”变：两种灯的状态都记下，
  // 画完一种之后在空闲时把另一种也算好，点灯塔时就不用现算
  const skies = new Map(), lighthouses = new Map();
  // 同一时刻、同一灯态、同样宽度时天空已经铺好了：不再把那张大图重新设成背景（每次设都要重新解码，十几毫秒）
  let applied = '', appliedPhase = 'day';
  function sky(){ const k = d.clock.time + '|' + d.ui.lamp, el = HOST.querySelector('#sky'), w = HOST.querySelector('#sheet')?.clientWidth, a = k + '|' + w;
    if (a === applied && el?.firstElementChild === d.cache.r12Sky?.canvas) return appliedPhase;
    const phase = skyRaw(); applied = a; appliedPhase = phase; return phase; }
  function skyRaw(){ const k = d.clock.time + '|' + d.ui.lamp; if (skies.has(k)) d.cache.r12Sky = skies.get(k); const phase = r12Art.sky(); skies.set(k, d.cache.r12Sky); if (skies.size > 4) skies.delete(skies.keys().next().value); return phase; }
  let warm = '';
  // 生成天空是一整块几百毫秒的计算：等在思索页安静停 2 秒、没有过场在走时才做，免得卡住切页的动画；指针移到灯塔上（快要点了）就马上做
  let warmTimer = 0;
  let lastBox = null;
  function prewarm(box, soon = false){ lastBox = box; const k = d.clock.time + '|' + box.width; if (warm === k) return; clearTimeout(warmTimer);
    warmTimer = setTimeout(() => (window.requestIdleCallback || (f => setTimeout(f, 50)))(() => { if (HOST.root !== view.root || !view.root.isConnected || d.ui.page !== 'thought' || HOST.transitionApi?.state().running) return; warm = k; const keep = d.ui.lamp, toggle = $('#lighthouse-toggle'), style = toggle.getAttribute('style');
      d.ui.lamp = !keep; try { scenery(box, true); } finally { d.ui.lamp = keep; sky(); toggle.setAttribute('style', style); } }), soon ? 0 : 2000); }
  // 风景（原型 drawScenery 的 thought 分支）
  function scenery(box, warming = false){
    if (!warming) prewarm(box);
    const w = box.width, phase = sky(), night = phase === 'night'; let s = r12Art.thoughtCoast(w);
    const ratio = ((minutes() - 360 + 1440) % 1440) / 1080, sunX = w * (.2 + .42 * Math.max(0, Math.min(1, ratio))), sunY = 62 - 34 * Math.sin(Math.max(0, Math.min(1, ratio)) * Math.PI), starColor = r12Art.skyInk(sunX, sunY, w);
    s += `<g data-morph="sun">${circle(sunX, sunY, 13, 1.4, starColor)}${night ? ink([[sunX - 4, sunY - 11], [sunX + 3, sunY - 4], [sunX + 4, sunY + 4], [sunX - 1, sunY + 11]], 1.3, starColor) : ''}</g>`;
    const lx = w - 174, ly = 25, sc = .18, cx = lx + (879 - 780) * sc, cy = ly + (389 - 267) * sc;
    // 灯塔按天空逐像素着色（几十毫秒）：天空只随时刻、灯的开关变，所以按“宽度 + 时刻 + 灯”记下结果
    const lkey = [w, d.clock.time, d.ui.lamp].join('|'); if (!lighthouses.has(lkey)) { if (lighthouses.size > 4) lighthouses.delete(lighthouses.keys().next().value); lighthouses.set(lkey, r12Art.lighthouse(asset('lighthouse-off'), `translate(${lx - 780 * sc} ${ly - 267 * sc}) scale(${sc})`, w)); }
    s += lighthouses.get(lkey);
    if (d.ui.lamp) { const f = d.cache.skyFrame; s += `<defs><clipPath id="r14-beam-clip"><rect x="${f.left}" y="${f.top}" width="${f.width}" height="${f.height}"/></clipPath></defs><g clip-path="url(#r14-beam-clip)">${r14Marine.beam(cx, cy, w, night)}</g>`; }
    s += `<g data-morph="lamp-glow">${lampGlow(cx, cy, d.ui.lamp, night)}</g>`;
    Object.assign($('#lighthouse-toggle').style, {left: (cx - 24) + 'px', top: (cy - 24) + 'px', right: 'auto', width: '48px', height: '48px'});
    if (d.ui.lamp) s += ink(Array.from({length: 13}, (_, i) => [90 + i * (w - 370) / 12, 164 - Math.sin(i / 12 * Math.PI) * 49]), 1, night ? '#C0C8CB' : TICK);
    else { const groups = {}; d.ideas.forEach((idea, n) => (groups[idea.tag] ??= []).push({n, point: starPosition(n, w)})); let links = '';
      Object.values(groups).forEach(group => group.slice(0, 8).forEach((entry, i) => { if (!i) return; const near = group.slice(0, i).sort((a, b) => Math.hypot(...a.point.map((v, n) => v - entry.point[n])) - Math.hypot(...b.point.map((v, n) => v - entry.point[n])))[0]; if (near && Math.hypot(...near.point.map((v, n) => v - entry.point[n])) < w * .19) links += skyLink(near.point, entry.point); }));
      s += '<g data-star-links>' + links + '</g>'; }
    return s;
  }

  // 事件（原型 paper.js 里这一页的几处 addEventListener 与 handleAction 的思索分支）
  HOST.addEventListener('click', e => {
    if (d.ui.page !== 'thought') return; const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.id === 'idea-tag-toggle') { e.preventDefault(); e.stopPropagation(); d.ui.tagPicker = !d.ui.tagPicker; renderComposerTags(); return; }
    if (b.dataset.draftTag !== undefined) { e.preventDefault(); e.stopPropagation(); const tag = b.dataset.draftTag; d.ui.draftTags = d.ui.draftTags.includes(tag) ? d.ui.draftTags.filter(t => t !== tag) : [...d.ui.draftTags, tag]; renderComposerTags(); [...$('#tag-inline-options').querySelectorAll('button')].find(x => x.dataset.draftTag === tag)?.focus({preventScroll: true}); return; }
    if (b.dataset.removeDraftTag !== undefined) { e.preventDefault(); e.stopPropagation(); d.ui.draftTags = d.ui.draftTags.filter(t => t !== b.dataset.removeDraftTag); renderComposerTags(); $('#idea-tag-toggle').focus({preventScroll: true}); return; }
    if (b.dataset.heatDate) { e.preventDefault(); e.stopPropagation(); closeTagPanels(); d.ui.ideaDate = d.ui.ideaDate === b.dataset.heatDate ? null : b.dataset.heatDate; d.ui.ideaTag = null; d.ui.ideaExpanded = true; renderIdeas(); [...$('#idea-heatmap').querySelectorAll('button')].find(x => x.dataset.heatDate === b.dataset.heatDate)?.focus({preventScroll: true}); return; }
    if (b.hasAttribute('data-idea-all') || b.dataset.ideaTagFilter !== undefined) { e.preventDefault(); e.stopPropagation(); closeTagPanels(); const tag = b.hasAttribute('data-idea-all') ? null : b.dataset.ideaTagFilter; d.ui.ideaDate = null; d.ui.ideaTag = tag; d.ui.ideaExpanded = true; renderIdeas(); return; }
  }, true);
  HOST.addEventListener('click', e => {
    if (d.ui.page !== 'thought') return; const b = e.target.closest('button'); if (!b || b.disabled) return; const ds = b.dataset;
    if (b.id === 'lighthouse-toggle') { closeTagPanels(); d.ui.lamp = !d.ui.lamp; d.ui.menu = null; update(); $('#lighthouse-toggle').focus({preventScroll: true}); return; }
    if (b.id === 'sky-empty') { $('#idea-input').focus(); return; }
    if (ds.week) { d.ui.week = Number(ds.week); update(); return; }
    if (ds.idea || ds.star) { const id = ds.idea || ds.star; d.ui.idea = id; d.ui.ideaExpanded = true; if (ds.star) { const i = d.ideas.find(x => x.id === id); if (i) i.review = false; } update(); return; }
    if (ds.stage) { selectedIdea().stage = ds.stage; d.ui.menu = null; renderThought(); return; }
    if (ds.ideaSource) { selectedIdea().source = d.goals.find(g => g.id === ds.ideaSource)?.title; renderThought(); return; }
    if (ds.convert) { const i = selectedIdea(); if (ds.convert === 'task') d.tasks.push({id: 'new-' + d.serial++, title: i.title, description: i.body, markdown: i.body, date: null, status: 'open', peopleIds: [], listId: null, projectId: null, priority: 'medium'}); else core.newProject?.(i.title, i.id); i.stage = 'adopted'; renderThought(); announce(i.title); return; }
    switch (ds.action) {
      case 'new-idea': $('#idea-input').focus(); break;
      case 'idea-source': openNote(selectedIdea()?.id); break; // 0.7：在 Obsidian 的新标签页里打开这篇想法
      case 'idea-stage': d.ui.menu = d.ui.menu === 'idea-stage' ? null : 'idea-stage'; renderThought(); break;
      case 'idea-link': d.ui.menu = 'idea-link'; $('#idea-detail').insertAdjacentHTML('beforeend', `<div class="temporary-menu">${d.goals.map(g => `<button data-idea-source="${esc(g.id)}">${esc(g.title)}</button>`).join('')}</div>`); break;
      case 'idea-origin': announce(selectedIdea().source); break;
      case 'week-note': { const w = $('#week-board'); if ($('.week-note')) $('.week-note').remove(); else w.insertAdjacentHTML('afterbegin', `<article class="week-note"><button class="inline-close" data-action="week-note" aria-label="折回周记">×</button><p>${esc(d.weekly)}</p><button class="fold" data-action="week-markdown" aria-label="展开本周 Markdown"></button></article>`); break; }
      case 'week-markdown': openNote(view.plugin?.index?.days?.get(d.clock.date)?.path); break; // 周记取自今天的日记
    }
  });
  HOST.addEventListener('submit', e => {
    if (e.target.id === 'tag-inline-form') { e.preventDefault(); finishInlineTag(); return; }
    if (e.target.id === 'idea-form') { e.preventDefault(); const text = $('#idea-input').value.trim(); if (!text) { $('#idea-input').focus(); return; } const tags = [...d.ui.draftTags]; d.ui.draftTags = []; closeTagPanels(); captureIdea(text, tags);
      $('#idea-input').value = ''; $('#idea-input').focus(); d.cache.ideaDraft = ''; $('#idea-form').dataset.empty = 'true'; $('#idea-input').style.height = '32px'; }
  });
  HOST.addEventListener('input', e => {
    if (e.target.id === 'tag-inline-name') { d.ui.tagNewName = e.target.value; if (d.ui.tagError) { d.ui.tagError = ''; $('.tag-inline-error')?.remove(); fitTagSidebar(); } }
    if (e.target.id === 'idea-input') { d.cache.ideaDraft = e.target.value; $('#idea-form').dataset.empty = String(!e.target.value); fitIdeaEntry(); }
  });
  HOST.addEventListener('keydown', e => {
    if (e.target.id === 'idea-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#idea-form').requestSubmit(); return; }
    if (e.key === 'Escape' && d.ui.tagPicker) { e.preventDefault(); e.stopImmediatePropagation(); closeTagPanels(); $('#idea-tag-toggle').focus({preventScroll: true}); }
  }, true);
  HOST.addEventListener('scroll', e => { if (e.target.id === 'idea-tag-list') d.cache.tagSidebarScroll = e.target.scrollTop; }, true);
  HOST.addEventListener('pointerover', e => { if (e.target.closest?.('#lighthouse-toggle') && lastBox && d.ui.page === 'thought') prewarm(lastBox, true); });
  // 规划：把任务拖到某一天（或“未排期”）
  const dropColumn = target => target?.closest?.('#thought .day-column[data-drop]');
  function indicateDrop(col){
    const last = $('#thought .drop-target');
    if (last === col) return;
    last?.classList.remove('drop-target');
    col?.classList.add('drop-target');
  }
  HOST.addEventListener('dragstart', e => {
    const button = e.target.closest?.('#thought [data-plan]');
    if (!button) return;
    d.ui.drag = button.dataset.plan;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', d.ui.drag);
  });
  HOST.addEventListener('dragover', e => {
    if (!d.ui.drag || d.ui.page !== 'thought') return;
    const col = dropColumn(e.target);
    indicateDrop(col);
    if (col) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  });
  HOST.addEventListener('dragleave', e => {
    const col = dropColumn(e.target);
    if (col?.classList.contains('drop-target') && !col.contains(e.relatedTarget)) indicateDrop(null);
  });
  HOST.addEventListener('drop', e => {
    const col = dropColumn(e.target);
    if (!col || !d.ui.drag || d.ui.page !== 'thought') return;
    e.preventDefault();
    const task = d.tasks.find(x => x.id === d.ui.drag);
    d.ui.drag = null;
    indicateDrop(null);
    if (task) { task.date = col.dataset.drop || null; update(); }
  });
  HOST.addEventListener('dragend', () => { d.ui.drag = null; indicateDrop(null); });

  return {render: renderThought, scenery, fit: fitTagSidebar};
}
