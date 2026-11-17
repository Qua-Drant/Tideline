// 原型模块眼里的“页面”：原型直接用 document / window，插件里换成插件根元素（复制原型模块时把其中的 document.… 改成了 HOST.…；当时的同步脚本没有随仓库发布，现在直接维护 src/draw/proto/ 里的文件）。
// 同一时刻只有一个潮线视图在用（打开命令会复用已有的那个），视图打开时 attach，关闭时 detach 并摘掉原型模块挂的事件。
import type {Clock, Model, ModelPerson, ModelProject, ModelTask} from './data/types.ts';
import type {dropTasks} from './data/trash.ts';
import type {Attrs, Child} from './draw/dom.ts';

/** 原型的按钮小工具（phase2.js 的 button）：data-p2=action、data-id=id，body 是按钮里的 HTML，label 是 aria-label，extra 原样拼进属性 */
export type ProtoButton = (action: string, id: string | null | undefined, body: string, label: string, extra?: string) => string;
/** 同一个按钮的节点版（draw/proto/p2-nodes.ts）：属性先后与字符串版相同（type、data-p2、data-id、aria-label，再是 attrs） */
export type ProtoButtonEl = (action: string, id: string | null | undefined, body: Child, label: string, attrs?: Attrs | null) => HTMLButtonElement;

/** 原型的过场模块读的 window.paper 替身（视图在 onOpen 里装上；都是读取时现算的访问器） */
export interface HostPaper {
  ready: boolean;
  data: {
    /** 页面的界面状态，外加当前页 */
    readonly ui: Partial<Model['ui']> & {page: string};
    /** 过场设置：full / brief / off */
    readonly settingsR27: {motion: string};
    readonly clock: Clock;
    /** 今日重点等（大脑节点接力用）：模型里的任务，模型还没建时用索引里的 */
    readonly tasks: readonly unknown[];
  };
}

/** 过场（paper-transition-r37.js 装上）：换页前一刻量旧画面、立刻收尾 */
export interface HostTransition {
  before(from: string, to: string): void;
  finish(): void;
}

/** 过场的检查接口（paper-transition-r37.js 装上；测试工具逐帧检查用） */
export interface HostTransitionApi {
  state(): {running: false} | {running: true; from: string; to: string; mode: string; first: boolean; elapsed: number; total: number; distance: number; direction: number};
  seek(ms: number): ReturnType<HostTransitionApi['state']>;
  holdNext(ms: number): ReturnType<HostTransitionApi['state']>;
  resume(): void;
  finish(): void;
  cost(): Record<string, number>;
  forget(): void;
}

/** 指引页的 AI 对话（src/ai/controller.js 的 createAIController；pages/ai.js 装上，关闭时摘掉） */
export interface HostAI {
  /** 发出一句（草稿已在 d.ai.draft 里取出） */
  send(text: string, d: Model): void;
  /** 对话列表的 HTML */
  thread(d: Model): string;
  decorate(): void;
  close(): void;
  readonly busy: boolean;
  clearList(): void;
}

/** 原型模块直接用的“页面”：document / window 的替身，加上插件各模块往原型里接的钩子 */
export interface Host {
  /** 当前挂着的插件根元素（.compass-root）；没有视图时 null */
  root: HTMLElement | null;
  /** 经 HOST.addEventListener 登记的监听器：[目标, 事件名, 函数, 选项]，detach 时一并摘掉 */
  listeners: [target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options: boolean | AddEventListenerOptions | undefined][];
  attach(root: HTMLElement): void;
  detach(): void;
  querySelector(s: string): Element | null;
  /** 没有根元素时返回空数组（不是 NodeList） */
  querySelectorAll(s: string): NodeListOf<Element> | never[];
  /** pointermove / pointerup / pointercancel 挂在 window 上（拖动时指针可能离开插件区域），其余挂在根元素上 */
  addEventListener(t: string, f: EventListenerOrEventListenerObject, o?: boolean | AddEventListenerOptions): void;
  removeEventListener(t: string, f: EventListenerOrEventListenerObject, o?: boolean | EventListenerOptions): void;
  dispatchEvent(e: Event): boolean | undefined;
  /** document.body 的替身：就是根元素 */
  readonly body: HTMLElement | null;
  byId(id: string): Element | null;
  /** 原型的过场模块读的 window.paper */
  paper: HostPaper | null;
  transition: HostTransition | null;
  transitionApi: HostTransitionApi | null;
  /** 过场里曲线的取样：path 的 d → 取样点（取不到时不记） */
  samples: Map<string, [number, number][]>;
  /** 过场播完、页面静下来时（视图在 onOpen 里装上） */
  onTransitionEnd?: (() => void) | null;
  readonly innerWidth: number;
  readonly innerHeight: number;
  /** 根元素下沿的屏幕坐标 */
  readonly bottom: number;
  /** 本周一 / 本周日 / 本月最后一天（YYYY-MM-DD；原型里写死的日期改成按时钟算） */
  weekStart(date: string): string;
  weekEnd(date: string): string;
  monthEnd(date: string): string;

  // —— 插件模块往原型里接的钩子（没装时原型走自己的写法）——
  /** 指引页（pages/ai.js） */
  ai?: HostAI | null;
  /** 开着的 AI 供应商：id → [名称, 模型菜单] */
  aiProviders?: () => Record<string, [name: string, models: string[]]>;
  /** 删除任务（pages/lower.js 装上 data/trash.ts 的 dropTasks） */
  dropTasks?: typeof dropTasks;
  /** 任务页（ui/task-plus.js） */
  taskShowDone?: (t: ModelTask, d: Model) => boolean;
  taskGroupOf?: (t: ModelTask, d?: Model) => string | null;
  taskOrder?: (found: ModelTask[], d: Model) => ModelTask[];
  taskDepth?: (t: ModelTask, d?: Model) => number;
  taskRowClass?: (t: ModelTask, d: Model) => string;
  /** 行尾的小记号（时刻、子任务、检查项、标签、评论），没有时 null（第 3e 期：节点版） */
  taskRowMarks?: (t: ModelTask, d: Model) => Node | null;
  taskCreated?: (task: ModelTask, d: Model) => void;
  taskNavProject?: (p: ModelProject, d?: Model) => boolean;
  taskProjectCount?: (p: ModelProject, d: Model) => number;
  projectTaskAdd?: (p: ModelProject, d?: Model) => string;
  /** 任务详情整张纸（task-plus.ts 的详情纸；第 3e 期：节点版） */
  taskDetail?: (t: ModelTask, d: Model) => HTMLElement;
  /** 日期选择器里标出重复日：field 是日期输入框，month 是 YYYY-MM，返回 YYYY-MM-DD 的集合 */
  taskRepeatDays?: (field: HTMLInputElement, month: string) => Set<string>;
  /** 项目详情里的关联目标（ui/goals.ts） */
  projectGoalChips?: (p: ModelProject, d: Model, B: ProtoButton) => string;
  /** 人物（ui/people.ts） */
  cargoPeople?: (d: Model, max: number) => ModelPerson[];
  /** 货舱顶上的邮包、新建人物、名单纸条（第 3e 期：节点版） */
  cargoMailbags?: (d: Model, B: ProtoButtonEl) => Child;
  /** 任务页右栏的人物纸 / 见面纸（第 3e 期：节点版） */
  personDetail?: (p: ModelPerson, d: Model) => HTMLElement;
  projectPeople?: (p: ModelProject, d: Model, B: ProtoButton) => string;
  /** 按名字新建人物（已有同名的就返回那个；名字不合法返回 null） */
  createPerson?: (raw: string) => ModelPerson | null;
  /** 给这几条任务挑一个人 */
  personPickFor?: (ids: string[]) => void;
}

const WINDOW_EVENTS = new Set(['pointermove', 'pointerup', 'pointercancel']); // 拖动时指针可能离开插件区域
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const HOST: Host = {
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
