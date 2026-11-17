// 管理任务页手绘纸条。浮动纸条贴近触发位置，详情的字段纸条留在正文栏。
// 第 3c 期：转 TypeScript（本文件没有写 HTML 的地方）。
import {createTaskPickers} from './task-pickers.ts';
import type {CompassView} from '../view.ts';
import type {UIState} from '../data/types.ts';

const POPUPS = {
  newList: '.cargo-new-list', taskMenu: '.task-destination', taskDate: '.cargo-date-editor',
  taskFields: '.cargo-fields', newView: '.cargo-view-form',
};
type PopupKey = keyof typeof POPUPS;
const inside = Object.values(POPUPS).join(',');
const editors: Record<string, PopupKey> = {'task-date': 'taskDate', 'task-fields': 'taskFields', 'task-new-view': 'newView'};
/** 任务页纸条用到的界面状态（模型 d.ui 上由原型模块与这里读写的几项） */
type OverlayUI = UIState & Partial<Record<PopupKey, unknown>> & {newListOrigin?: string; taskMenuOrigin?: string; taskMenuAt?: {x: number; y: number} | null};

export function createTaskOverlays(view: CompassView){
  const root = view.root;
  const state = (): OverlayUI | undefined => view.lower?.data?.ui;
  const listTrigger = (origin?: string) => root.querySelector(origin === 'nav' ? '[data-p2="task-nav-new-list"]' : '.cargo-new-crate');
  function menuTrigger(ui: OverlayUI){
    const scope = ui.taskMenuOrigin === 'detail' ? '.cargo-document' : '.cargo-row';
    return [...root.querySelectorAll<HTMLElement>(scope + ' [data-p2="task-menu"]')].find(el => el.dataset.id === ui.taskMenu);
  }
  function close(keep?: PopupKey){
    const ui = state();
    if (!ui) return;
    pickers.close();
    for (const [key, selector] of Object.entries(POPUPS) as [PopupKey, string][]) {
      if (key === keep || !ui[key]) continue;
      (ui as Record<PopupKey, unknown>)[key] = key === 'newList' || key === 'newView' ? false : null;
      root.querySelector(selector)?.remove();
    }
    if (keep !== 'taskMenu') ui.taskMenuAt = null;
  }
  function place(popup: HTMLElement | null, anchor: Element | null | undefined, point?: {x: number; y: number} | null, above = false){
    if (!popup || (!anchor && !point)) return;
    const bounds = root.getBoundingClientRect(), parent = (popup.offsetParent || root) as HTMLElement;
    const base = parent.getBoundingClientRect(), width = popup.offsetWidth, height = popup.offsetHeight;
    const box = anchor?.getBoundingClientRect();
    let x = point ? point.x : above ? box!.left + (box!.width - width) / 2 : box!.left;
    let y = point ? point.y : above ? box!.top - height - 8 : box!.bottom + 8;
    if (point && x + width > bounds.right - 12) x -= width;
    if (point && y + height > bounds.bottom - 12) y -= height;
    if (!point && !above && y + height > bounds.bottom - 12) y = box!.top - height - 8;
    x = Math.max(bounds.left + 12, Math.min(x, bounds.right - width - 12));
    y = Math.max(bounds.top + 12, Math.min(y, bounds.bottom - height - 12));
    popup.style.setProperty('--task-popup-x', (x - base.left + parent.scrollLeft - parent.clientLeft) + 'px');
    popup.style.setProperty('--task-popup-y', (y - base.top + parent.scrollTop - parent.clientTop) + 'px');
  }
  const pickers = createTaskPickers(view, place);
  function layout(){
    const ui = state();
    if (!ui || view.page !== 'tasks') return;
    if (ui.newList) place(root.querySelector<HTMLElement>('.cargo-new-list'), listTrigger(ui.newListOrigin), null, ui.newListOrigin !== 'nav');
    if (ui.taskMenu) place(root.querySelector<HTMLElement>('.task-destination'), menuTrigger(ui), ui.taskMenuAt);
    pickers.layout();
  }
  view.registerDomEvent(root, 'click', event => {
    const ui = state();
    if (!ui || view.page !== 'tasks') return;
    if (pickers.click(event)) return;
    const target = event.target as Element, button = target.closest<HTMLElement>('[data-p2]');
    const action = button?.dataset.p2;
    if (action === 'task-nav-new-list' || action === 'task-new-list') {
      const origin = action === 'task-nav-new-list' ? 'nav' : 'crate';
      close('newList');
      if (ui.newList && ui.newListOrigin !== origin) ui.newList = false;
      ui.newListOrigin = origin;
      return;
    }
    if (action === 'task-menu') {
      close('taskMenu');
      ui.taskMenuAt = null;
      ui.taskMenuOrigin = button!.closest('.cargo-document') ? 'detail' : 'row';
      return;
    }
    if (action && editors[action]) { close(editors[action]); return; }
    if (!target.closest(inside)) close();
  }, {capture: true});
  view.registerDomEvent(root, 'contextmenu', event => {
    const ui = state();
    if (!ui || view.page !== 'tasks' || !(event.target as Element).closest('.cargo-row')) return;
    close('taskMenu');
    ui.taskMenuAt = {x: event.clientX, y: event.clientY};
    ui.taskMenuOrigin = 'row';
  }, {capture: true});
  view.registerDomEvent(root, 'keydown', event => {
    const ui = state();
    if (!ui || view.page !== 'tasks') return;
    if (pickers.key(event)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (event.key !== 'Escape' || !(Object.keys(POPUPS) as PopupKey[]).some(key => ui[key])) return;
    const action = Object.keys(editors).find(action => ui[editors[action]]);
    const trigger = ui.newList ? listTrigger(ui.newListOrigin) : ui.taskMenu ? menuTrigger(ui) : root.querySelector(`[data-p2="${action}"]`);
    close(); event.preventDefault(); event.stopImmediatePropagation();
    (trigger as HTMLElement | null | undefined)?.focus({preventScroll: true});
  }, {capture: true});
  view.registerDomEvent(root, 'scroll', layout, {capture: true, passive: true});
  return {layout, close};
}
