// 数据层的类型：索引的来源与写入器、索引里各类笔记解析出来的样子、模型（页面读写的 d）、日历订阅与日程。
// 只有类型，不产生任何代码（其它模块一律用 import type 引入）。

// —— 属性块 ——

/**
 * 笔记的属性块（YAML frontmatter）。由使用者手写、Obsidian 解析，字段和类型都不可信；
 * 读取侧按 JS 的宽松写法逐项转换（String()/Number()/!!），写回侧原样交给 processFrontMatter。
 * 这里保留 any：改成 unknown 就得在每一处读取加收窄，等于改写读取逻辑（本期只做类型迁移）。
 */
export type Frontmatter = Record<string, any>;

// —— 来源与写入器 ——

/** 来源报告的一次改动：内容或属性变了（change），或文件没了（delete；改名 = 旧路径 delete + 新路径 change）。 */
export type ChangeKind = 'change' | 'delete';

/** 索引的数据来源。Obsidian 里是 source-obsidian.ts 的 obsidianSource，测试工具里是内存。 */
export interface IndexSource {
  /** 仓库的配置目录（通常是 .obsidian），用来生成 AI 默认的“不能改”名单；测试来源可以没有 */
  readonly configDir?: string;
  /** 仓库里所有 Markdown 文件 */
  files(): {path: string}[];
  /** 某篇笔记的属性块；没有这篇或没有属性块时 null */
  frontmatter(path: string): Frontmatter | null;
  /** 某篇笔记的全文；没有这篇时 '' */
  read(path: string): Promise<string>;
  /** 订阅改动，返回取消函数 */
  onChange(cb: (path: string, change: ChangeKind) => void): () => void;
}

/** 写入器：所有写回笔记的动作都经它。Obsidian 里是 source-obsidian.ts 的 obsidianWriter，测试工具里是内存。 */
export interface Writer {
  /** 这个路径上有没有文件或文件夹（测试写入器可以不提供） */
  exists?(path: string): boolean;
  /** 新建笔记（已经有就不动），返回 Obsidian 的文件对象或测试替身，调用方不用它 */
  create(path: string, text: string): Promise<unknown>;
  /** 改名（目标已存在时不动） */
  rename(path: string, to: string): Promise<void>;
  /** 移到回收站（按使用者在 Obsidian 里的设置） */
  trash(path: string): Promise<void>;
  /** 改属性块：fn 直接改传进来的对象；文件不存在时先用 init 建出来 */
  frontmatter(path: string, fn: (fm: Frontmatter) => void, init?: string): Promise<void>;
  /** 改全文：fn 收到原文、返回新文；文件不存在时先用 init 建出来 */
  body(path: string, fn: (text: string) => string, init?: string): Promise<void>;
  /** 在 Obsidian 的标签页里打开笔记 */
  open?(path: string): void;
  /** 打开文献笔记链接到的第一份 PDF；没有返回 false */
  openPDF?(path: string): boolean;
}

// —— 索引里的笔记（index.ts 解析出来的样子） ——

/** kindOf() 认出来的笔记种类 */
export type NoteKind = 'config' | 'calendar' | 'day' | 'quarter' | 'task' | 'project' | 'person' | 'goal' | 'idea' | 'literature' | 'book' | 'prompt';
/** 索引里按路径存的几张表 */
export type IndexTable = 'tasks' | 'projects' | 'people' | 'goals' | 'ideas' | 'literature' | 'books' | 'prompts';

/** 任务（任务/ 文件夹）。status：open / in_progress / done / cancelled 等，按笔记里写的原样保留 */
export interface IndexTask {
  path: string; id: string; title: string; status: string;
  /** scheduled 属性（YYYY-MM-DD） */
  date: string | null; completed: string | null;
  /** 今日重点的顺序，0 = 不是重点 */
  focus: number;
  /** 所属项目的名称（链接去掉 [[ ]]） */
  project: string | null; list: string | null; people: string[];
  /** highest / high / medium / low / lowest */
  priority: string;
  discuss: boolean; repeat: string | null;
  /** 正文（去掉属性块）与正文第一段 */
  markdown: string; description: string;
  // 0.4：货单的手动顺序、父任务、置顶、标签、时刻与提醒
  order: number | null; parent: string | null; pinned: boolean; tags: string[];
  /** HH:MM */
  time: string | null; remind: string | null; mode: 'checklist' | null; comments: string[];
}

/** 项目的一个里程碑（state：open / in_progress / done） */
export interface Milestone { title: string; state: string }

/** 项目（项目/ 文件夹）。status：active / planned / paused / completed / archived */
export interface IndexProject {
  path: string; id: string; title: string; status: string;
  due: string | null; resume: string | null; completed: string | null;
  /** 关联的目标、人物、想法、文献：链接里的名称 */
  goals: string[]; people: string[]; ideas: string[]; literature: string[];
  milestones: Milestone[]; description: string;
}

/** 人物的一条记录（## 记录 下的列表项；没写日期时 date 为 ''） */
export interface PersonHistory { date: string; text: string }

/** 人物（人物/ 文件夹） */
export interface IndexPerson {
  path: string; id: string; name: string;
  /** 头像字 */
  initial: string;
  /** 每隔几天联系一次，0 = 不提醒 */
  cadence: number;
  history: PersonHistory[];
}

/** 目标（目标/ 文件夹） */
export interface IndexGoal {
  path: string; id: string; title: string;
  /** 每周计划投入（小时） */
  planned: number; resume: string | null; due: string | null;
  status: 'active' | 'paused' | 'done'; completed: string | null;
}

/** 想法（想法/ 文件夹）。stage：seed / growing / ready 等 */
export interface IndexIdea {
  path: string; id: string; title: string; stage: string; review: boolean; tags: string[];
  /** 来源：链接里的名称，或原样的文字 */
  source: string;
  /** 建立时刻（YYYY-MM-DD 或 YYYY-MM-DD HH:MM） */
  created: string; body: string;
}

/** 文献（文献/ 与 Zotero 导入文件夹）或书籍（书籍/）。stage 按笔记原样 */
export interface IndexLibraryItem {
  path: string; id: string; title: string; kind: 'literature' | 'book'; stage: string;
  projects: string[]; read: string | null; authors: string; year: number | null; type: string;
  added: string | null; started: string | null; keywords: string[]; favorite: boolean; progress: number;
  /** 正文第一段（结论）、## 摘要、## 要点（[小标题, 内容]）、## 摘录、## 笔记 */
  conclusion: string; abstract: string; points: [string, string][]; marks: string[]; note: string;
  // Zotero Integration 导入的文献才有
  zotero?: string; citekey?: string; source?: 'zotero';
}

/** 指引（潮线/指引/）：给 AI 的提示词 */
export interface IndexPrompt {
  path: string; id: string; title: string; subtitle: string; category: string;
  risk: number; scope: number[]; order: number; body: string;
}

/** 季度复盘（潮线/季度/YYYY-Qn.md）：属性块原样展开，另加正文开头的文字 */
export interface IndexQuarter extends Frontmatter {
  path: string; id: string; text: string;
}

/** 日记里的一条随手记 */
export interface JournalEntry { id: string; time: string; text: string }

/** 某一天的日记（日记/YYYY-MM-DD.md） */
export interface IndexDay {
  path: string; date: string;
  /** 习惯 id → 完成与否；每日问题 id → 分数；投入名称 → 小时（都按属性块原样） */
  habits: Record<string, unknown>; scores: Record<string, unknown>; effort: Record<string, unknown>;
  highlight: string; quote: string; journal: JournalEntry[];
  done: string[]; achievements: string[]; gratitude: string[];
}

/** 配置笔记（潮线/配置.md）里的习惯与每日问题 */
export interface HabitConfig { id: string; name: string }
export interface QuestionConfig { id: string; title: string }

/** 任务页保存的视图筛选（配置笔记里的写法：项目、人物写成链接） */
export interface ConfigViewFilter { kind: string; project?: string; person?: string; list?: string }

/** AI 的三张保护名单（见 ai/policy.ts） */
export interface PolicyLists { askRead: string[]; noWrite: string[]; autoWrite: string[] }

/** 配置笔记解析后的样子 */
export interface IndexConfig {
  habits: HabitConfig[]; questions: QuestionConfig[]; effortScaleHours: number;
  lists: {title: string; archived: boolean}[];
  views: {title: string; filter: ConfigViewFilter}[];
  ideaTags: string[]; areas: {id: string; title: string}[];
  ai: PolicyLists;
}

/** 日程：潮线/日程.md 里写的（noteEvents），或日历订阅展开出来的（feedEvents，多了 end、allDay、source） */
export interface IndexEvent {
  id: string;
  /** YYYY-MM-DD；日程笔记里日期写错时为 null */
  date: string | null;
  /** HH:MM；全天日程为 '' */
  time: string; title: string; description: string;
  end?: string; allDay?: boolean;
  /** 订阅的名称 */
  source?: string;
}

/** 索引的耗时与规模 */
export interface IndexStats { built: number; files: number; lastUpdate: number }

/** 索引对外的样子（页面、模型、日历只读这些） */
export interface IndexLike {
  config: IndexConfig;
  tasks: Map<string, IndexTask>; projects: Map<string, IndexProject>; people: Map<string, IndexPerson>; goals: Map<string, IndexGoal>;
  ideas: Map<string, IndexIdea>; literature: Map<string, IndexLibraryItem>; books: Map<string, IndexLibraryItem>; prompts: Map<string, IndexPrompt>;
  days: Map<string, IndexDay>; quarters: Map<string, IndexQuarter>;
  readonly events: IndexEvent[];
  examples: Set<string>;
  version: number;
}

// —— 今日页的快照（day.ts） ——

/** history：前 7 天，1 完成、0 没完成、null 没记 */
export interface DayHabit { id: string; name: string; value: boolean | null; history: (number | null)[] }
export interface DayQuestion { id: string; title: string; value: number | null }
export interface Investment { id: string; title: string; hours: number }
export interface DayPast { text: string; year: string; path: string; more: {year: string; item: string}[] }

/** dayView() 的结果 */
export interface DayView {
  date: string; time: string;
  focus: IndexTask[]; other: IndexTask[]; trail: IndexTask[]; nextUp: IndexTask[];
  events: IndexEvent[]; journal: JournalEntry[]; habits: DayHabit[]; questions: DayQuestion[]; investments: Investment[];
  scale: number; past: DayPast | null; allDone: boolean; noTasks: boolean;
  stats: {done: number; total: number; hours: number; habits: number; habitTotal: number; next: IndexEvent | null; milestone: {title: string; n: number; of: number} | null};
  dayPath: string | null;
}

// —— 模型（model.ts 建出来、页面读写、persist.ts 写回的 d） ——

/** 时刻：日期 YYYY-MM-DD、时间 HH:MM */
export interface Clock { date: string; time: string }

/** 示例笔记的标记：是示例时为 true，否则不写（undefined） */
type ExampleMark = true | undefined;

export interface ModelList { id: string; title: string; archived: boolean }

export interface ModelPerson { id: string; name: string; initial: string; cadence: number; history: PersonHistory[] }

/** 项目的一站（里程碑） */
export interface ModelStation { id: string; title: string; state: string }

export interface ModelProject {
  id: string; title: string; status: string; due?: string; resume?: string; completed?: string;
  goalIds: string[]; peopleIds: string[]; ideaIds: string[]; literatureIds: string[];
  stations: ModelStation[]; description: string; example: ExampleMark;
}

export interface ModelTask {
  id: string; title: string;
  /** 所属项目的名称（找得到项目时才有）与 id */
  project?: string; projectId: string | null; listId: string | null;
  peopleIds: string[]; priority: string; discuss?: boolean; repeat?: string;
  date: string | null; status: string; completed?: string; focus?: number;
  description: string; markdown: string; example: ExampleMark;
  order?: number;
  /** 建模型时的父任务名称，换成 parentId 后删掉 */
  parent?: string; parentId?: string | null;
  pinned?: boolean; tags: string[]; time?: string; remind?: string; mode?: 'checklist'; comments: string[];
}

export interface ModelGoal {
  id: string; title: string; planned: number; spent: number; status: string; due: string | null; completed: string | null;
  /** 暂停到哪天（原始日期）；resume 只给画面用（“11月9日”） */
  resumeDate: string | null; resume?: string;
  projectIds: string[]; byProject: {id: string; title: string; hours: number}[]; example: ExampleMark;
}

export interface ModelIdea {
  id: string; title: string; body: string; stage: string; review: boolean; tag: string | null; tags: string[];
  source?: string; created: string; example: ExampleMark; projectIds: string[];
}

export interface ModelLibraryItem {
  id: string; title: string; stage: string; conclusion: string; projectIds: string[]; readDate?: string; example: ExampleMark;
  source?: 'zotero'; zotero?: string; citekey?: string;
}

/** 知识库的书目信息（按 'literature|id' / 'book|id' 存） */
export interface LibraryMeta {
  authors: string; year: number | null; type: string; added: string; keywords: string[];
  fav: boolean; progress: number; started: string; note: string; abstract: string; points: string[][]; marks: string[];
}

export interface ModelPrompt { id: string; title: string; subtitle: string; category: string; risk: number; scope: number[]; body: string }

/** 任务页保存的视图（模型里项目、人物换成 id） */
export interface SavedViewFilter { kind: string; id?: string | null }
export interface SavedView { id: string; title: string; filter: SavedViewFilter }

/** 复盘页某一天 */
export interface ReviewDay {
  date: string; habits: (boolean | null)[]; questions: (number | null)[]; investments: Investment[];
  journal: {time: string; text: string}[]; achievements: string[]; gratitude: string[]; quote: string;
}

/** 复盘页的季度部分（数组的写法沿用原型） */
export interface ReviewQuarter {
  /** [标题, 是否达成] */
  harvest: [string, boolean][];
  /** [图标, 标题, 数值, 单位, 变化] */
  metrics: [unknown, unknown, string, unknown, unknown][];
  /** [图标, 标题, 进度] */
  directions: [unknown, unknown, number][];
  /** [标题, 是否达成, 走势] */
  experiments: [unknown, boolean, number[]][];
  tasks: number[]; hours: number[];
  /** [名称, 占比] */
  time: [unknown, number][];
}

export interface ModelReview {
  weekDates: string[]; trend: number[]; days: ReviewDay[];
  wheel: {id: string; title: string; value: number | null}[]; quarterText: string;
  quarter: ReviewQuarter; pastYears: {year: number; items: string[]; sketch: string}[];
}

/**
 * 界面状态（不进笔记）。这里列出 defaultUI() 给的初值；页面模块（还是 JS）还会随手加别的键，所以留一个索引签名。
 * 值大多是“选中的 id 或 null”。
 */
export interface UIState {
  page: string; lamp: boolean; week: unknown; idea: string | null; ideaDate: string; ideaTag: string | null; draftTags: string[];
  tagPicker: boolean; tagNewName: string; tagError: string;
  eventHover: unknown; eventHoverMode: unknown; eventDismissed: unknown; prompt: string | null; query: string; detail: unknown;
  help: boolean; capture: boolean; captureType: string; map: boolean; settings: boolean;
  source: unknown; menu: unknown; paused: boolean; seek: number; drawn: Record<string, unknown>; copy: unknown; undo: unknown;
  taskFilter: SavedViewFilter; taskDetail: string | null; taskMenu: unknown; taskArchive: boolean; newList: boolean; newView: boolean;
  projectSelected: string | null; projectList: boolean; projectArchive: boolean;
  projectMenu: boolean; newProject: boolean; reviewPeriod: string; reviewDay: number; reviewWeek: number; reviewSource: boolean;
  wheelMenu: unknown; librarySelected: string | null; libraryFilter: unknown;
  libraryMenu: boolean; libraryHover: unknown; libraryKnot: unknown; brainSelected: string | null; brainType: string | null; brainQuery: string; brainList: boolean;
  [key: string]: unknown;
}

/** 模型里的 AI 状态（页面模块还会加对话、模型清单等，留索引签名） */
export interface ModelAI {
  connected: boolean; agent: string; attach: boolean; accept: boolean;
  [key: string]: unknown;
}

/** 页面读写的整份数据 d（原型 data.js + phase2-data.js 的形状） */
export interface Model {
  clock: Clock;
  ui: UIState;
  /** 画面缓存（天空、滚动位置、归档箱动画……），页面模块自己管。
   *  第 3c 期：原来注入的素材内容（assets）与 brush 没人读，删去；第 3d 期：思索页的望远镜直接从 assets.js 取 viewBox，assetBoxes 也不再注入 */
  cache: Record<string, unknown>;
  /** 新条目的流水号（还没写成笔记时的临时 id） */
  serial: number;
  /** 显式删除队列（trash.ts） */
  trash: Set<string>;
  meetingPreparations: unknown[];
  ai: ModelAI;
  lists: ModelList[]; people: ModelPerson[]; projects: ModelProject[]; tasks: ModelTask[];
  events: {id: string; time: string; title: string; description: string}[];
  /** 日期 → 那天的日程（按时间排） */
  planningEvents: Map<string | null, IndexEvent[]>;
  journal: {id: string; time: string; text: string}[];
  habits: DayHabit[]; questions: DayQuestion[]; investments: Investment[]; investmentScaleHours: number;
  past: {text: string; year: string}; weekly: string;
  goals: ModelGoal[]; ideaTags: string[]; ideas: ModelIdea[]; literature: ModelLibraryItem[]; books: ModelLibraryItem[];
  libraryMeta: Record<string, LibraryMeta>; libraryMetaVersion: number;
  prompts: ModelPrompt[]; savedViews: SavedView[]; review: ModelReview;
  /** 大脑页默认显示的节点：类别 → id */
  graphDefault: Record<string, string[]>;
  summary: {inbox: number; projects: number; doneWeek: number; literature: number};
}

/** persist.ts 管的几类条目（d 里的数组名） */
export type EntityKind = 'goals' | 'people' | 'tasks' | 'projects' | 'ideas' | 'literature' | 'books';

// —— 日历订阅（calendar.ts）与 iCal（ical.ts） ——

/** 一个日历订阅（存在本机设置 local.calendars 里） */
export interface CalendarSub {
  id: string; name: string; url: string;
  /** 刷新间隔（小时），见 EVERY */
  every: number;
  /** 上次联网、上次取到（ISO 时刻） */
  last: string | null; okAt?: string | null;
  ok: boolean | null; error: string; count: number; fails: number;
  /** 被限流或失败后，到这个时刻（毫秒）才再试 */
  retryAt: number;
  etag?: string; modified?: string;
  /** 上次的 HTTP 状态，或 'timeout' / 'error' */
  status?: number | string;
  /** 上次用时（毫秒） */
  ms?: number;
}

/** iCal 里的一个时刻：wall 是以 UTC 数字存的“墙上时间”毫秒数；tz：'Z' | IANA 时区名 | null（浮动） */
export interface IcalTime { wall: number; tz: string | null; allDay: boolean }

/** 重复规则（RRULE 的要点） */
export interface IcalRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; interval: number; count: number | null; until: IcalTime | null;
  /** n：第几个（0 = 每个；负数从月末数），wd：星期几（0 = 周日） */
  byday: {n: number; wd: number}[] | null;
  bymonthday: number[] | null; bymonth: number[] | null;
}

/** 解析后的一个 VEVENT（只留时间轴用得上的；也是本机缓存里存的样子） */
export interface IcalEvent {
  uid: string; title: string; description: string; start: IcalTime;
  /** 时长（毫秒） */
  length: number; rule: IcalRule | null; exdates: IcalTime[];
  /** RECURRENCE-ID：单次改期覆盖原来的那一次 */
  rid: IcalTime | null; cancelled: boolean;
}

/** occurrences() 的一次发生（本机时区） */
export interface Occurrence {
  uid: string; date: string; time: string; end: string; allDay: boolean; title: string; description: string;
  /** 全天日程跨多天时，第一天的日期 */
  first?: string;
}

/** fetchCalendar() 的结果：取到了（带解析结果），或服务器说没变（same） */
export type FetchedCalendar =
  | {same?: undefined; name: string; events: IcalEvent[]; etag: string; modified: string; status: number}
  | {same: true; status: 304; name?: undefined; events?: undefined; etag?: undefined; modified?: undefined};

/** fetchCalendar() 抛出的错误多带的几样：HTTP 状态、要等多久（毫秒）、是否超时 */
export interface CalendarFetchError extends Error { status?: number; wait?: number; timeout?: boolean }

// —— Zotero（zotero.ts） ——

/** zoteroInfo() 的结果 */
export interface ZoteroInfo {
  installed: boolean; enabled: boolean;
  /** 当作文献读的文件夹（设置里填了就只用它），与从 Zotero Integration 设置里找到的 */
  folders: string[]; found: string[];
  formats: string[];
  commands: {id: string; name: string}[]; imports: {id: string; name: string}[];
}

/** zoteroFields() 从导入笔记里取出的字段 */
export interface ZoteroFields {
  title: string; authors: string; year: number | null; type: string; keywords: string[];
  abstract: string; marks: string[]; citekey: string; zotero: string;
}
