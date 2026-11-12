// 0.9.3（上线前评审 P1-3）：按 Tab 时焦点不落到看不见的地方。
// 宽视图里被挤成 0 高的次要聚焦、被外层裁掉或盖住的按钮、“还有 N 项”以下滚不出来的行……
// 焦点落上去时先试着滚进可见范围；仍看不见就沿 Tab 的方向跳到下一个看得见的元素。只管键盘 Tab，不碰程序里的 focus()。
const TABBABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"],[contenteditable="plaintext-only"]';

// 焦点元素是否真的看得见：有大小，中心点在窗口里，并且那一点上最上层的就是它（或它里面的东西，或包着它的 label）
export function seen(el){
  if (!el?.isConnected || el.closest('[hidden],[inert]')) return false;
  const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
  const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
  const hit = document.elementFromPoint(x, y);
  return !!hit && (hit === el || el.contains(hit) || (hit.tagName === 'LABEL' && hit.contains(el)));
}

export function createFocusGuard(view){
  const root = view.root; let back = false, at = 0, busy = false;
  view.registerDomEvent(root, 'keydown', e => { if (e.key === 'Tab') { back = e.shiftKey; at = performance.now(); } }, {capture: true});
  view.registerDomEvent(root, 'focusin', e => {
    const el = e.target; if (busy || performance.now() - at > 400 || !(el instanceof Element) || seen(el)) return;
    el.scrollIntoView?.({block: 'nearest', inline: 'nearest'}); if (seen(el)) return;
    // 沿 Tab 方向找下一个看得见的（最多看 80 个，找不到就留在原处）
    const all = [...root.querySelectorAll(TABBABLE)], i = all.indexOf(el); if (i < 0) return;
    for (let k = 1; k <= 80; k++) {
      const c = all[back ? i - k : i + k]; if (!c) return;
      if (c.closest('[hidden],[inert]') || c.getClientRects().length === 0) continue;
      if (seen(c)) { busy = true; c.focus({preventScroll: true}); busy = false; return; }
    }
  });
}
