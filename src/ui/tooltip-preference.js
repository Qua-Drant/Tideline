// 保留操作名称供辅助技术读取，按本机偏好控制浏览器原生 title 提示。
export function createTooltipPreference(view){
  const root = view.root;
  function hideTitle(el){
    const title = el.getAttribute('title');
    if (title === null) return;
    el.dataset.tidelineTitle = title;
    if (!el.hasAttribute('aria-label') && !el.textContent.trim() && el.matches('button,a,input,select,textarea')) el.setAttribute('aria-label', title);
    el.removeAttribute('title');
  }
  view.registerDomEvent(root, 'mouseover', event => {
    if (view.plugin.local?.device?.tooltips) return;
    let el = event.target.closest('[title]');
    while (el && root.contains(el)) { hideTitle(el); el = el.parentElement?.closest('[title]'); }
  });
  return {
    apply(){
      const enabled = !!view.plugin.local?.device?.tooltips;
      root.dataset.tooltips = enabled ? 'on' : 'off';
      if (enabled) for (const el of root.querySelectorAll('[data-tideline-title]')) { el.setAttribute('title', el.dataset.tidelineTitle); delete el.dataset.tidelineTitle; }
      else for (const el of root.querySelectorAll('[title]')) hideTitle(el);
    },
  };
}

