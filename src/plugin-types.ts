// 插件层的类型：本机设置（设备、AI 助手、供应商）、data.json 里的设置、升级纸条的条目、视图对插件开放的方法。
// 只有类型，不产生任何代码。
// （不叫 src/types.ts：同一目录下的 types.d.ts 放着构建时注入的全局声明，同名的 .ts 会让 TypeScript 把那个 .d.ts 忽略掉。）
import type {View, WorkspaceLeaf} from 'obsidian';
import type {CalendarSub} from './data/types.ts';
import type {PermissionMode, ProviderConf} from './ai/types.ts';

/** 这台设备的偏好（设置 › 这台设备） */
export interface DeviceSettings {
  /** 字号倍数：.92 / 1 / 1.1 / 1.2 */
  font: string;
  /** obsidian 跟随 Obsidian / paper 纸 / night 夜航 */
  theme: string;
  /** brief 滑动 / off 关闭（0.3 起没有“完整”过场） */
  motion: string;
  /** 打开时去哪一页：last 上次所在的页，或某一页 */
  start: string;
  /** 习惯旁显示最近 7 天 */
  week: boolean;
  /** 悬停功能提示 */
  tooltips: boolean;
}

/** AI 助手的设置（只存在这台设备上） */
export interface AISettings {
  enabled: boolean;
  /** 当前用哪一家（PRESETS 的键） */
  provider: string;
  /** 每家一份；onload 时补齐所有 PROVIDERS（DEFAULT_AI 里是 null） */
  providers: Record<string, ProviderConf>;
  model: string; effort: string; permission: PermissionMode;
  /** enter 回车发送 / mod Ctrl+回车发送 */
  send: string;
  /** 默认值里有，src/ 里目前没有读它的地方 */
  notice: boolean;
  /** 多少天前的对话归档（0 = 不归档） */
  archiveDays: number;
  /** 把回答存成笔记时的文件夹 */
  saveFolder: string;
  /** 0.2 的旧字段：API 密钥名（搬到 providers.claude 后删掉）、claude 程序路径（不再用） */
  apiKeySecret?: string; exe?: unknown;
}

/** Zotero 的本机设置：是否读 Zotero Integration 的导入文件夹、手动指定的文件夹 */
export interface ZoteroLocal { on: boolean; folder: string }

/** 只属于这台设备的设置（Obsidian 本机存储 'tideline-local'，不进仓库、不同步） */
export interface LocalSettings {
  device: DeviceSettings;
  ai: AISettings;
  /** 装过的示例笔记路径 */
  examples: string[];
  /** 是否起航过、上次所在的页 */
  onboarded: boolean; lastPage: string;
  calendars: CalendarSub[];
  /** 问过要不要清除示例 */
  examplesAsked: boolean;
  /** 上次用的版本（升级纸条用） */
  version: string | null;
  zotero: ZoteroLocal;
}

/** 固定的时刻（沙盒仓库用它和原型对照）；time 不写就是 12:00 */
export interface FixedClock { date?: string; time?: string }

/** 插件的 settings：data.json 里只存 clock；ai 是指向 local.ai 的只读访问器（onload 里装上） */
export interface PluginSettings {
  clock: FixedClock | null;
  ai: AISettings;
}

/** 升级纸条的一项：[版本号, 这个版本的变化] */
export type ChangeEntry = [version: string, items: string[]];

/** 潮线视图（view.js，还是 JS）对插件开放的几个方法；视图可能还没准备好，所以都是可选的 */
export type CompassViewLike = View & {
  noteCreated?(path: string): void;
  applyDevice?(): void;
  openSettings?(page?: string): void;
  refreshAI?(): void;
};

/** 放着潮线视图的标签页 */
export type CompassLeaf = WorkspaceLeaf & {view: CompassViewLike};
