// AI 助手的类型：权限判断（policy.ts）、供应商与 ACP 会话（acp.ts）、对照（diff.ts）。
// 只有类型，不产生任何代码。
import type {PolicyLists} from '../data/types.ts';

// —— 权限（policy.ts） ——

/** 三档权限：只读、改前确认（默认）、自动接受改动 */
export type PermissionMode = 'read' | 'confirm' | 'auto';

/** 工具调用的参数里 policy 看的几项（代理传来的其余字段原样留着） */
export interface ToolInput {
  file_path?: string; notebook_path?: string; path?: string; pattern?: string; command?: string; content?: string;
  [key: string]: unknown;
}

/** decide() 的结果 */
export interface PolicyResult {
  /** default：交给代理自己的默认规则；allow：允许；ask：先问使用者；deny：拒绝 */
  decision: 'default' | 'allow' | 'ask' | 'deny';
  reason: string;
  kind?: 'read' | 'write' | 'shell' | 'other';
  /** 涉及的路径（仓库内相对路径；仓库外的为 null，或原样的绝对路径） */
  paths?: (string | null)[];
  /** 触发“先问”的受保护文件夹；使用者选“这次对话都允许”时记进 allowed */
  folders?: string[];
}

// —— 供应商（acp.ts 的 PRESETS 与设置里每家一份） ——

/** 一家 ACP 代理的预设 */
export interface ProviderPreset {
  name: string; vendor: string; command: string; args: string[];
  /** 安装与登录命令（显示在设置的供应商卡上；空 = 不给） */
  install: string; login: string;
  /** API 密钥交给代理时用的环境变量名 */
  keyEnv: string;
  /** 是 Claude Code：给它传权限规则（它自己读写文件，不经插件） */
  claudeRules?: boolean;
  /** 开会话后切到的“每次改动都问客户端”的权限模式 */
  askMode?: string;
  /** 没有核实过的说明（显示在供应商卡上） */
  unverified?: {install?: string; keyEnv?: string};
}

/** 预设与设置合起来之后，真正用来启动的样子 */
export interface ResolvedProvider extends ProviderPreset { id: string }

/** 代理报的一个模型 */
export interface ModelOption { value: string; name: string }

/** 设置里每家一份（本机设置 local.ai.providers[id]） */
export interface ProviderConf {
  on: boolean;
  /** 启动命令与参数，留空用预设；args 在设置里是一行文字，旧数据可能是数组 */
  command: string; args: string | string[];
  /** API 密钥在 Obsidian 密钥库里的名字（不存密钥本身） */
  apiKeySecret: string;
  name: string;
  /** 代理报过的模型清单（记下来，重开后模型菜单还在）与默认模型 */
  models?: ModelOption[]; model?: string;
}

/** probe() 的结果：握手成功（带代理的名称、版本、可选的模型清单）或失败原因 */
export interface ProbeResult {
  ok: boolean; error?: string; path?: string | null;
  models?: ModelOption[] | null; name?: string; version?: string; protocol?: unknown; auth?: unknown[]; loadSession?: boolean;
}

// —— ACP 线上的数据（代理程序发来的 JSON，字段都不保证有） ——

/** JSON-RPC 的一条消息（请求、通知或回应） */
export interface RpcMessage {
  jsonrpc?: string; id?: number | string; method?: string; params?: Record<string, unknown>;
  result?: unknown; error?: {code?: number; message?: string};
}

/** 一个可选项（模型、权限模式、思考强度）；可以分组（组里再有 options） */
export interface AcpConfigValue { value?: string; id?: string; name?: string; options?: AcpConfigValue[] }
/** 会话的一项配置（configOptions 里的一项） */
export interface AcpConfigOption { id: string; category?: string; currentValue?: string; options?: AcpConfigValue[] }
/** 旧的不稳定接口：session/new 结果里的 models */
export interface AcpLegacyModels { currentModelId?: string; availableModels?: {modelId: string; name?: string}[] }

/** initialize 的回应 */
export interface AcpInitResult {
  protocolVersion?: unknown;
  agentInfo?: {name?: string; title?: string; version?: string};
  authMethods?: {id?: string; name?: string}[];
  agentCapabilities?: {loadSession?: boolean; sessionCapabilities?: {resume?: unknown}};
}
/** session/new、session/resume、session/load 的回应 */
export interface AcpSessionResult {
  sessionId: string;
  configOptions?: AcpConfigOption[];
  models?: AcpLegacyModels;
  modes?: unknown;
}
/** session/request_permission 的参数里代理给的选项 */
export interface AcpPermissionOption { optionId: string; kind: string; name?: string }

/** 代理传来的工具参数：policy 看的几项之外，命令可能写在 cmd 或 argv 里 */
export interface AcpRawInput extends ToolInput { cmd?: string; argv?: unknown }

/** 工具调用里的一块内容（type 'diff' 时带改前改后） */
export interface AcpContentItem { type?: string; path?: string; oldText?: string | null; newText?: string }

/** 代理的一次工具调用（tool_call、tool_call_update，或 request_permission 里的 toolCall） */
export interface AcpToolCall {
  toolCallId?: string; title?: string; kind?: string; name?: string; status?: string;
  rawInput?: AcpRawInput;
  locations?: {path?: string}[];
  content?: AcpContentItem[];
  _meta?: {claudeCode?: {toolName?: string}};
}

/** asTool() 的结果：换成 policy 认得的工具名与参数 */
export interface NormalizedTool {
  tool: string; input: ToolInput;
  /** 代理给的改前改后（写文件时） */
  diff?: AcpContentItem;
  /** 认不出的工具 */
  other?: boolean;
}

/**
 * session/update 里的 update。按 sessionUpdate 分几种：agent_message_chunk 的 content 是一段文字 {type: 'text', text}；
 * tool_call / tool_call_update 的 content 是内容块数组（这时按 AcpToolCall 读）。
 */
export interface AcpSessionUpdate extends Omit<AcpToolCall, 'content'> {
  sessionUpdate?: string; messageId?: string;
  content?: {type?: string; text: string};
  availableCommands?: {name: string; description?: string; input?: {hint?: string}}[];
  configOptions?: AcpConfigOption[];
}

// —— 会话（createAcpSession） ——

/** 代理想用工具时要问使用者的那张卡片 */
export interface AskRequest {
  tool: string; input: ToolInput; policy: PolicyResult; reason: string;
  diff?: AcpContentItem;
  title?: string;
}
/** 使用者的回答：只这一次、这次对话都允许、拒绝 */
export type AskAnswer = 'once' | 'session' | 'deny';

/** 会话发给界面的事件 */
export type SessionEvent =
  | {type: 'init'; model: string; agent: string; sessionId: string | null; mcp: unknown[]}
  | {type: 'delta' | 'text'; text: string}
  | {type: 'tool' | 'tool-input'; id?: string; name: string; input: ToolInput; title?: string}
  | {type: 'tool-done'; id?: string; error: boolean}
  | {type: 'result'; ok: boolean; ms: number; error: string}
  | {type: 'error'; message: string; code?: string; provider?: ResolvedProvider}
  | {type: 'closed'};

/** 读写仓库文件（由 main.ts 传进来，经 Obsidian 的接口） */
export interface VaultFiles {
  read(rel: string): Promise<string | null>;
  write(rel: string, text: string): Promise<unknown>;
}

/** createAcpSession() 的参数 */
export interface AcpSessionOptions {
  provider: ResolvedProvider; cwd: string; model?: string; effort?: string; mode: PermissionMode;
  lists: Partial<PolicyLists>; apiKey?: string;
  /** 接着以前的哪个会话 */
  resume?: string | null;
  onEvent: (e: SessionEvent) => void;
  ask: (req: AskRequest) => Promise<AskAnswer>;
  files: VaultFiles;
}

/** 一段对话（controller.js 只认这些） */
export interface AcpSession {
  allowed: Set<string>;
  caps: {rewind: boolean};
  send(text: string, uuid?: string): string;
  setModel(m: string): Promise<void>;
  setEffort(e: string): Promise<void>;
  setMode(m: PermissionMode): void;
  models(): Promise<ModelOption[]>;
  commands(): Promise<{name: string; description: string; argumentHint: string}[]>;
  mcp(): Promise<unknown[]>;
  rewindFiles(): Promise<{canRewind: boolean; filesChanged: string[]; error: string}>;
  interrupt(): Promise<void>;
  close(): void;
}

/** 插件交给 controller 的 AI 供应商：按 providerId 开一段对话 */
export interface AIProviderFactory {
  caps: {rewind: boolean};
  create(o: Omit<AcpSessionOptions, 'provider' | 'files'> & {providerId: string}): AcpSession;
}
