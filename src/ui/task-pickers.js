import {esc, icon, ink} from '../draw/ink.js';
import {HOST} from '../host.js';

const chevron = `<svg viewBox="0 0 18 18" aria-hidden="true">${ink([[4, 6], [9, 11], [14, 6]], 1.2)}</svg>`;
const pad = number => String(number).padStart(2, '0');
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-') && new Date(value + 'T12:00:00Z').toJSON()?.slice(0, 10) === value;

// 保留表单的原字段和写回入口，用同一张手绘纸呈现选项和日历。
export function createTaskPickers(view, place){
  const root = view.root;
  let active = null;
  function label(trigger, text){ trigger.querySelector('span').textContent = text; }
  function prepare(){
    for (const field of root.querySelectorAll('#tasks form :is(select, input[type="date"])')) {
      if (field.nextElementSibling?.matches('.task-picker-trigger')) continue;
      const select = field.matches('select'), trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'task-picker-trigger';
      trigger.setAttribute('aria-haspopup', select ? 'listbox' : 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', field.getAttribute('aria-label') || '选择');
      trigger.innerHTML = `<span></span>${select ? chevron : icon('sunrise')}`;
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
  function options(field){
    const row = option => `<button type="button" role="option" data-task-option="${option.index}" aria-selected="${option.selected}" ${option.disabled ? 'disabled' : ''}><span>${esc(option.textContent)}</span>${option.selected ? icon('check', 15) : ''}</button>`;
    const rows = [...field.children].map(child => child.matches('optgroup')
      ? `<div role="group" aria-label="${esc(child.label)}"><span class="task-option-group">${esc(child.label)}</span>${[...child.children].map(row).join('')}</div>`
      : row(child)).join('');
    return `<div class="task-option-items">${rows}</div>`;
  }
  function calendar(){
    const {popup, month, field} = active, [year, number] = month.split('-').map(Number);
    const monthStart = new Date(month + '-01T12:00:00Z');
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    const days = monthEnd.getUTCDate(), first = (monthStart.getUTCDay() + 6) % 7;
    const today = view.plugin.clock().date, repeats = HOST.taskRepeatDays?.(field, month) || new Set();
    popup.innerHTML = `<div class="task-date-month"><button type="button" data-task-month="-1" aria-label="上个月" ${month === '0001-01' ? 'disabled' : ''}>‹</button><span>${year} 年 ${number} 月</span><button type="button" data-task-month="1" aria-label="下个月" ${month === '9999-12' ? 'disabled' : ''}>›</button></div>
      <div class="task-date-grid">${[...'一二三四五六日'].map(day => `<span>${day}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({length: days}, (_, i) => {
        const date = month + '-' + pad(i + 1);
        return `<button type="button" data-task-day="${date}" aria-label="${date}${repeats.has(date) ? '，重复' : ''}" aria-pressed="${date === field.value}" ${date === today ? 'aria-current="date"' : ''} ${repeats.has(date) ? 'class="is-repeat"' : ''}>${i + 1}</button>`;
      }).join('')}</div><div class="task-date-shortcuts"><button type="button" data-task-day="${today}">今天</button><button type="button" data-task-day="">清除日期</button></div>`;
  }
  function open(trigger){
    if (active?.trigger === trigger) { close(true); return; }
    close();
    const field = trigger.previousElementSibling, select = field.matches('select');
    const popup = document.createElement('div');
    popup.className = 'task-picker hand-popup ' + (select ? 'task-option-list' : 'task-date-calendar');
    popup.id = 'task-picker';
    popup.setAttribute('role', select ? 'listbox' : 'dialog');
    popup.setAttribute('aria-label', select ? trigger.getAttribute('aria-label') : '选择日期');
    active = {popup, trigger, field, month: (validDate(field.value) ? field.value : view.plugin.clock().date).slice(0, 7)};
    if (select) popup.innerHTML = options(field); else calendar();
    root.querySelector('#tasks').append(popup);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', popup.id);
    view.frames();
    (popup.querySelector('[aria-selected="true"], [data-task-day][aria-pressed="true"]') || popup.querySelector('button'))?.focus();
  }
  function click(event){
    const trigger = event.target.closest('.task-picker-trigger');
    if (trigger) { open(trigger); return true; }
    if (!active) return false;
    if (!active.popup.contains(event.target)) { close(); return false; }
    const button = event.target.closest('button');
    if (!button) return true;
    const {field} = active;
    if (button.hasAttribute('data-task-option')) {
      field.selectedIndex = Number(button.dataset.taskOption);
      label(active.trigger, field.selectedOptions[0]?.textContent || '选择');
    } else if (button.hasAttribute('data-task-day')) {
      field.value = button.dataset.taskDay;
      field.dispatchEvent(new Event('input', {bubbles: true}));
    } else if (button.hasAttribute('data-task-month')) {
      const date = new Date(active.month + '-01T12:00:00Z');
      date.setUTCMonth(date.getUTCMonth() + Number(button.dataset.taskMonth));
      active.month = date.toISOString().slice(0, 7);
      calendar(); view.frames();
      active.popup.querySelector(`[data-task-month="${button.dataset.taskMonth}"]`).focus({preventScroll: true});
      return true;
    }
    field.dispatchEvent(new Event('change', {bubbles: true}));
    close(true);
    return true;
  }
  function key(event){
    const trigger = event.target.closest('.task-picker-trigger');
    if (trigger && event.key === 'ArrowDown') { open(trigger); return true; }
    if (!active) return false;
    if (event.key === 'Escape') return close(true);
    if (!active.popup.contains(event.target)) return false;
    if (event.key === 'Tab' && active.field.matches('select')) { close(true); return false; }
    const options = [...active.popup.querySelectorAll('[role="option"]:not(:disabled)')];
    if (!options.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
    const index = options.indexOf(document.activeElement);
    const next = {Home: 0, End: options.length - 1, ArrowDown: Math.min(index + 1, options.length - 1), ArrowUp: Math.max(index - 1, 0)}[event.key];
    options[next]?.focus();
    return true;
  }
  return {layout, close, click, key};
}
