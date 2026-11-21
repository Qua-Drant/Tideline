// 任务页表单里的下拉框与日期框换成手绘纸条（选项列表、日历）。
// 第 3c 期：转 TypeScript；触发按钮、选项与日历用 DOM 构建（draw/dom.ts），不再拼 HTML 字符串；元素建在表单所在的 document 里。
import {iconEl, inkEl} from '../draw/ink.ts';
import {h, svg, within, setNodes} from '../draw/dom.ts';
import {HOST} from '../host.ts';
import type {CompassView} from '../view.ts';

/** 把纸条放在触发元素旁边（task-overlays.ts 的 place） */
export type PlacePopup = (popup: HTMLElement | null, anchor: Element | null | undefined, point?: {x: number; y: number} | null, above?: boolean) => void;
type Field = HTMLSelectElement | HTMLInputElement;
interface Active { popup: HTMLElement; trigger: HTMLButtonElement; field: Field; month: string }

const chevron = () => svg('svg', {viewBox: '0 0 18 18', 'aria-hidden': 'true'}, inkEl([[4, 6], [9, 11], [14, 6]], 1.2));
const pad = (number: number) => String(number).padStart(2, '0');
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-') && new Date(value + 'T12:00:00Z').toJSON()?.slice(0, 10) === value;
const isSelect = (field: Field): field is HTMLSelectElement => field.matches('select');

// 选项列表：<option> 一行一个按钮，<optgroup> 一组
function options(field: HTMLSelectElement){
  const row = (option: HTMLOptionElement) => h('button', {type: 'button', role: 'option', 'data-task-option': option.index, 'aria-selected': String(option.selected), disabled: option.disabled},
    h('span', null, option.textContent), option.selected ? iconEl('check', 15) : null);
  return h('div', {class: 'task-option-items'}, [...field.children].map(child => child.matches('optgroup')
    ? h('div', {role: 'group', 'aria-label': (child as HTMLOptGroupElement).label}, h('span', {class: 'task-option-group'}, (child as HTMLOptGroupElement).label), [...child.children].map(o => row(o as HTMLOptionElement)))
    : row(child as HTMLOptionElement)));
}

// 保留表单的原字段和写回入口，用同一张手绘纸呈现选项和日历。
export function createTaskPickers(view: CompassView, place: PlacePopup){
  const root = view.root;
  let active: Active | null = null;
  function label(trigger: Element, text: string){ trigger.querySelector('span')!.textContent = text; }
  function prepare(){
    for (const field of root.querySelectorAll<Field>('#tasks form :is(select, input[type="date"])')) {
      if (field.nextElementSibling?.matches('.task-picker-trigger')) continue;
      const select = isSelect(field);
      const trigger = within(field.ownerDocument, () => h('button', {type: 'button', class: 'task-picker-trigger', 'aria-haspopup': select ? 'listbox' : 'dialog', 'aria-expanded': 'false', 'aria-label': field.getAttribute('aria-label') || '选择'},
        h('span'), select ? chevron() : iconEl('sunrise')));
      if (select) {
        field.hidden = true;
        label(trigger, field.selectedOptions[0]?.textContent || '选择');
      } else {
        field.type = 'text';
        field.placeholder = '年-月-日';
        field.maxLength = 10;
        trigger.setAttribute('aria-label', '打开日期选择');
        trigger.classList.add('task-date-trigger');
        const validate = () => field.setCustomValidity(!field.value || validDate(field.value) ? '' : '请输入有效日期，格式为年-月-日');
        field.addEventListener('input', validate);
        validate();
      }
      field.after(trigger);
    }
  }
  function close(focus = false){
    if (!active) return false;
    const {trigger, popup} = active;
    active = null;
    popup.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    if (focus) trigger.focus({preventScroll: true});
    return true;
  }
  function layout(){
    prepare();
    if (!active) return;
    if (!active.trigger.isConnected) { close(); return; }
    place(active.popup, active.trigger);
  }
  function calendar(){
    const {popup, month, field} = active!, [year, number] = month.split('-').map(Number);
    const monthStart = new Date(month + '-01T12:00:00Z');
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    const days = monthEnd.getUTCDate(), first = (monthStart.getUTCDay() + 6) % 7;
    const today = view.plugin.clock().date, repeats: Set<string> = HOST.taskRepeatDays?.(field as HTMLInputElement, month) || new Set();
    setNodes(popup, () => [
      h('div', {class: 'task-date-month'},
        h('button', {type: 'button', 'data-task-month': '-1', 'aria-label': '上个月', disabled: month === '0001-01'}, '‹'),
        h('span', null, `${year} 年 ${number} 月`),
        h('button', {type: 'button', 'data-task-month': '1', 'aria-label': '下个月', disabled: month === '9999-12'}, '›')),
      h('div', {class: 'task-date-grid'}, [...'一二三四五六日'].map(day => h('span', null, day)), Array.from({length: first}, () => h('span')), Array.from({length: days}, (_, i) => {
        const date = month + '-' + pad(i + 1);
        return h('button', {type: 'button', 'data-task-day': date, 'aria-label': date + (repeats.has(date) ? '，重复' : ''), 'aria-pressed': String(date === field.value), 'aria-current': date === today ? 'date' : null, class: repeats.has(date) ? 'is-repeat' : null}, i + 1);
      })),
      h('div', {class: 'task-date-shortcuts'}, h('button', {type: 'button', 'data-task-day': today}, '今天'), h('button', {type: 'button', 'data-task-day': ''}, '清除日期'))]);
  }
  function open(trigger: HTMLButtonElement){
    if (active?.trigger === trigger) { close(true); return; }
    close();
    const field = trigger.previousElementSibling as Field, select = isSelect(field);
    const popup = within(trigger.ownerDocument, () => h('div', {class: 'task-picker hand-popup ' + (select ? 'task-option-list' : 'task-date-calendar'), id: 'task-picker', role: select ? 'listbox' : 'dialog', 'aria-label': select ? trigger.getAttribute('aria-label') : '选择日期'}));
    active = {popup, trigger, field, month: (validDate(field.value) ? field.value : view.plugin.clock().date).slice(0, 7)};
    if (isSelect(field)) setNodes(popup, () => options(field)); else calendar();
    root.querySelector('#tasks')!.append(popup);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', popup.id);
    view.frames();
    (popup.querySelector<HTMLElement>('[aria-selected="true"], [data-task-day][aria-pressed="true"]') || popup.querySelector<HTMLElement>('button'))?.focus();
  }
  function click(event: MouseEvent){
    const target = event.target as Element, trigger = target.closest<HTMLButtonElement>('.task-picker-trigger');
    if (trigger) { open(trigger); return true; }
    if (!active) return false;
    if (!active.popup.contains(target)) { close(); return false; }
    const button = target.closest<HTMLElement>('button');
    if (!button) return true;
    const {field} = active;
    if (button.hasAttribute('data-task-option')) {
      (field as HTMLSelectElement).selectedIndex = Number(button.dataset.taskOption);
      label(active.trigger, (field as HTMLSelectElement).selectedOptions[0]?.textContent || '选择');
    } else if (button.hasAttribute('data-task-day')) {
      field.value = button.dataset.taskDay!;
      field.dispatchEvent(new Event('input', {bubbles: true}));
    } else if (button.hasAttribute('data-task-month')) {
      const date = new Date(active.month + '-01T12:00:00Z');
      date.setUTCMonth(date.getUTCMonth() + Number(button.dataset.taskMonth));
      active.month = date.toISOString().slice(0, 7);
      calendar(); view.frames();
      active.popup.querySelector<HTMLElement>(`[data-task-month="${button.dataset.taskMonth}"]`)!.focus({preventScroll: true});
      return true;
    }
    field.dispatchEvent(new Event('change', {bubbles: true}));
    close(true);
    return true;
  }
  function key(event: KeyboardEvent){
    const trigger = (event.target as Element).closest<HTMLButtonElement>('.task-picker-trigger');
    if (trigger && event.key === 'ArrowDown') { open(trigger); return true; }
    if (!active) return false;
    if (event.key === 'Escape') return close(true);
    if (!active.popup.contains(event.target as Node)) return false;
    if (event.key === 'Tab' && isSelect(active.field)) { close(true); return false; }
    const options = [...active.popup.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)')];
    if (!options.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
    const index = options.indexOf(active.popup.doc.activeElement as HTMLElement);
    const next = ({Home: 0, End: options.length - 1, ArrowDown: Math.min(index + 1, options.length - 1), ArrowUp: Math.max(index - 1, 0)} as Record<string, number>)[event.key];
    options[next]?.focus();
    return true;
  }
  return {layout, close, click, key};
}
