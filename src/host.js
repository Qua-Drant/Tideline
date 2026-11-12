// 原型模块眼里的“页面”：原型直接用 document / window，插件里换成插件根元素（tools/sync-proto.mjs 把复制件里的 document.… 改成 HOST.…）。
// 同一时刻只有一个潮线视图在用（打开命令会复用已有的那个），视图打开时 attach，关闭时 detach 并摘掉原型模块挂的事件。
const WINDOW_EVENTS = new Set(['pointermove', 'pointerup', 'pointercancel']); // 拖动时指针可能离开插件区域
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const HOST = {
  root: null,
  listeners: [],
  attach(root){ this.detach(); this.root = root; },
  detach(){ for (const [target, t, f, o] of this.listeners) target.removeEventListener(t, f, o); this.listeners = []; this.root = null; },
  querySelector(s){ return this.root?.querySelector(s) || null; },
  querySelectorAll(s){ return this.root ? this.root.querySelectorAll(s) : []; },
  addEventListener(t, f, o){ const target = WINDOW_EVENTS.has(t) ? window : this.root; if (!target) return; target.addEventListener(t, f, o); this.listeners.push([target, t, f, o]); },
  removeEventListener(t, f, o){ const target = WINDOW_EVENTS.has(t) ? window : this.root; target?.removeEventListener(t, f, o); this.listeners = this.listeners.filter(l => !(l[1] === t && l[2] === f)); },
  dispatchEvent(e){ return this.root?.dispatchEvent(e); },
  get body(){ return this.root; },
  byId(id){ return this.root?.querySelector('#' + CSS.escape(id)) || null; },
  // 原型的过场模块读 window.paper（是否就绪、过场设置、今天的日期、今日重点）：视图给一个小小的替身
  paper: null,
  transition: null, transitionApi: null, samples: new Map(), // 过场里曲线的取样（按 d 记）
  get innerWidth(){ return this.root?.clientWidth || 0; },
  get innerHeight(){ return this.root?.clientHeight || 0; },
  get bottom(){ return this.root ? this.root.getBoundingClientRect().bottom : 0; },
  // 原型里写死的日期改成按时钟算
  weekStart(date){ const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return iso(d); },
  weekEnd(date){ const d = new Date(HOST.weekStart(date) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return iso(d); },
  monthEnd(date){ const d = new Date(date + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1, 0); return iso(d); },
};
