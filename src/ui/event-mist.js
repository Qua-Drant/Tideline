// 今日页日程浮标的详情（原型 paper.js R8/R9：showEventMist / positionEventMist / dismissEventMist）。
// 鼠标移到浮标上、或键盘聚焦浮标时，这条日程的时刻、名称和说明在海平面上方留白处升起：稀疏的手绘雾线 + 磨砂纸色底，
// 向上移 12px、由淡到清晰。位置避开上方任务的文字、也不挡浮标本身。可以把鼠标移进详情继续读；
// 离开浮标与详情（220ms 后）、失去焦点或按 Esc 就散去。Esc 关掉后，鼠标离开再进来之前不会自己再出现。点浮标不改布局。
// 日程来自 潮线/日程.md 的 events（time、title、description）；接上日历订阅以后同样显示。
import {esc, ink} from '../draw/ink.js';

export function createEventMist({view}){
  const root = view.root, $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  let hover = null, mode = null, dismissed = null, leaveTimer = 0, exitTimer = 0;
  const panel = () => $('#event-mist');
  const button = () => $$('[data-event]').find(b => b.dataset.event === hover);
  // 上方（今日聚焦、其他任务）每一段文字的范围
  function textRects(){
    const list = [], above = $('#today .above'); if (!above) return list;
    const walk = document.createTreeWalker(above, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { const n = walk.currentNode; if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNode(n); for (const b of r.getClientRects()) if (b.width && b.height) list.push(b); }
    return list;
  }
  function position(){
    const el = panel(), b = button(); if (!el || el.hidden || !b) return;
    const page = $('#today').getBoundingClientRect(), hit = b.getBoundingClientRect(), anchor = b.querySelector('.event-icon').getBoundingClientRect(),
      sea = $('#timeline').getBoundingClientRect().top + 60, head = $('.page-head').getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight,
      minX = page.left + 10, maxX = page.right - w - 10, preferredX = anchor.left + anchor.width / 2 - w / 2, preferredY = hit.top - h - 16, rects = textRects();
    let chosen = null;
    for (const x0 of [preferredX, anchor.right + 18, anchor.left - w - 18, maxX, minX]) for (const offset of [0, -24, -48]) {
      const x = Math.max(minX, Math.min(x0, maxX)), y = Math.max(head.bottom + 14, Math.min(preferredY + offset, Math.min(sea - 14, hit.top - 16) - h));
      const collisions = rects.reduce((a, r) => a + Math.max(0, Math.min(x + w + 5, r.right) - Math.max(x - 5, r.left)) * Math.max(0, Math.min(y + h + 4, r.bottom) - Math.max(y - 4, r.top)), 0);
      const score = collisions * 1000 + Math.abs(x - preferredX) * .3 + Math.abs(y - preferredY);
      if (!chosen || score < chosen.score) chosen = {x, y, score};
    }
    Object.assign(el.style, {left: (chosen.x - page.left) + 'px', top: (chosen.y - page.top) + 'px'});
    const svg = el.querySelector('svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = ink([[2, h * .4], [5, h * .24], [13, h * .13]], .85, '#B6C5C9') + ink([[w - 14, h * .12], [w - 4, h * .26], [w - 7, h * .43]], .85, '#B6C5C9')
      + ink([[7, h - 12], [w * .21, h - 16], [w * .43, h - 11], [w * .7, h - 14], [w - 5, h - 9]], 1, '#B6C5C9') + ink([[w * .22, h - 4], [w * .46, h - 1], [w * .73, h - 4]], .8, '#C2CED0');
  }
  function show(id, how = 'pointer'){
    if (view.page !== 'today' || dismissed === id) return;
    clearTimeout(leaveTimer); clearTimeout(exitTimer);
    const el = panel(), event = view.today.events.find(e => e.id === id); if (!el || !event) return;
    if (hover === id && !el.hidden) { if (how === 'keyboard') mode = how; return; }
    hover = id; mode = how;
    for (const b of $$('[data-event]')) { if (b.dataset.event === id) b.setAttribute('aria-describedby', 'event-mist'); else b.removeAttribute('aria-describedby'); }
    el.dataset.visible = 'false';
    el.innerHTML = `<svg class="mist-lines" aria-hidden="true"></svg><time>${esc(event.time)}</time><div class="mist-object">${esc(event.title)}</div>${event.description ? `<p>${esc(event.description)}</p>` : ''}`;
    el.hidden = false; position(); el.getBoundingClientRect(); el.dataset.visible = 'true';
  }
  function dismiss(immediate = false){
    const el = panel(); if (!el) return;
    clearTimeout(leaveTimer); clearTimeout(exitTimer); hover = null; mode = null;
    for (const b of $$('[data-event]')) b.removeAttribute('aria-describedby');
    el.dataset.visible = 'false';
    if (immediate) el.hidden = true; else exitTimer = setTimeout(() => { if (!hover) el.hidden = true; }, 220);
  }
  function deferHide(){
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => { const b = button(), el = panel(), keyboard = mode === 'keyboard' && document.activeElement === b; if (!keyboard && !b?.matches(':hover') && !el?.matches(':hover')) dismiss(); }, 220);
  }

  view.registerDomEvent(root, 'pointerover', e => { const b = e.target.closest?.('[data-event]'); if (b) show(b.dataset.event); else if (e.target.closest?.('#event-mist')) clearTimeout(leaveTimer); });
  view.registerDomEvent(root, 'pointerout', e => {
    const b = e.target.closest?.('[data-event]'); if (b && !b.contains(e.relatedTarget)) { dismissed = null; deferHide(); return; }
    const m = e.target.closest?.('#event-mist'); if (m && !m.contains(e.relatedTarget)) deferHide();
  });
  view.registerDomEvent(root, 'focusin', e => { const b = e.target.closest?.('[data-event]'); if (b) show(b.dataset.event, b.matches(':focus-visible') ? 'keyboard' : 'pointer'); });
  view.registerDomEvent(root, 'focusout', e => { if (e.target.closest?.('[data-event]')) { dismissed = null; deferHide(); } });
  view.registerDomEvent(document, 'keydown', e => {
    if (!hover || !root.isConnected) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dismissed = hover; dismiss(); }
    else if (!e.target.matches?.('input,textarea,select') && (e.key === '/' || e.key === '?')) dismiss(true);
  }, {capture: true});
  return {show, dismiss, position, get open(){ return !!hover; }};
}
