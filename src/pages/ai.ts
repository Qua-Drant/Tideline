// 指引页：桅杆上的类别旗、提示词库与预览、复制；AI 助手（模型菜单、对话、发送）。
// 画面与交互用原型的 paper-guidance-r28.js（同步进 src/draw/proto/，提示词改为读 潮线/指引/ 下的笔记；
// “发送”和对话列表改成调 src/ai/controller.ts，接本机的 Claude Code）。
// 第 4b 期：转 TypeScript。原来的 AI_HTML 字符串常量（第 3 期起已不再使用）删去；页面的固定外壳（aiShell）从 frame.ts 搬回这里，
// 照思索页（thoughtShell）的先例由 frame.ts 引用。给指引页的参数去掉了它不读的 icon、esc。
import {createGuidance} from '../draw/proto/paper-guidance-r28.ts';
import {createAIController} from '../ai/controller.ts';
import {HOST} from '../host.ts';
import {h, svg} from '../draw/dom.ts';
import {PRESETS, PROVIDERS} from '../ai/acp.ts';
import type {ModelOption, ProviderConf} from '../ai/types.ts';
import type {AISettings} from '../plugin-types.ts';
import type {Model, ModelAI} from '../data/types.ts';
import type {Part} from '../draw/scene.ts';
import type {createR12Art} from '../draw/proto/paper-r12-art.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

/** 原型读的 d.settingsR27.ai（由下面的 syncSettings 按插件设置写） */
interface GuidanceSync { enabled: boolean; provider: string; permission: string; send: string; cards: Record<string, {on: boolean}> }
/** 本页用到的 d：AI 状态里的模型与供应商名，外加原型读的设置 */
type AIModel = Model & {ai: ModelAI & {model: string; agent: string}; settingsR27?: {ai?: GuidanceSync}};
/** 下方各页的核心（pages/lower.js 的 core；还没转 TypeScript）里本页用到的几样 */
interface AICore { readonly data: Model; announce: (message: string, undo?: () => void) => void }
type R12Art = ReturnType<typeof createR12Art>;

/** 指引页的固定外壳（框只建一次，frame.ts 调用）。第 4b 期从 frame.ts 搬回；与原来的 AI_HTML 逐个元素对应 */
export function aiShell(){
  return h('section', {id: 'ai', class: 'page ai', 'aria-label': '指引', hidden: true},
    h('div', {class: 'mast-scene'}, h('div', {id: 'flags', class: 'flags'})),
    h('div', {class: 'ai-window'},
      h('div', {id: 'connection'}), h('div', {id: 'privacy'}),
      h('div', {class: 'native-workspace'},
        h('div', {class: 'native-library'},
          h('form', {class: 'line-form prompt-search', role: 'search'},
            h('span', {id: 'search-icon'}),
            h('input', {id: 'prompt-query', 'aria-label': '搜索提示词', placeholder: '搜索提示词…', autocomplete: 'off'})),
          h('div', {id: 'prompts'})),
        h('div', {id: 'native-content'})),
      h('form', {id: 'handoff-form', class: 'line-form handoff'},
        svg('svg', {id: 'handoff-outline', viewBox: '0 0 601 83', preserveAspectRatio: 'none', 'aria-hidden': 'true'}),
        h('textarea', {id: 'handoff-input', placeholder: '写下问题，或补充你的思路…（@ 提到笔记）', 'aria-label': '对话草稿', rows: 2}),
        h('button', {id: 'native-send', type: 'submit', 'aria-label': '发送对话草稿'})),
      h('div', {id: 'native-error', role: 'status', hidden: true})));
}

// 0.3：经 ACP 接入的各家（设置里开着的）。0.7：模型清单是代理自己报的（设置里点“检查”、打开这一家或开过一段对话后记下，
// 存在本机设置里）；还没读到时 Claude 用三个预设，其他家只有“默认”（= 不改代理自己的默认）。每家可以在设置里选默认模型。
const CLAUDE_PRESET: ModelOption[] = [{value: 'sonnet', name: 'Sonnet'}, {value: 'opus', name: 'Opus'}, {value: 'haiku', name: 'Haiku'}];
const DEFAULT_MODELS: Record<string, string[]> = {claude: CLAUDE_PRESET.map(m => m.name)};
const AUTO = '默认';
// 这一家的模型（{value, name}）；没读到时 null（Claude 用预设）
export const modelsOf = (plugin: CompassPlugin, id: string): ModelOption[] | null => plugin.aiModels?.(id) || plugin.ai?.models?.[id] || (id === 'claude' ? CLAUDE_PRESET : null);
// 设置里为这一家选的默认模型（value）；Claude 沿用旧的 ai.model
export const defaultModelOf = (plugin: CompassPlugin, id: string): string => { const s: Partial<AISettings> = plugin.settings.ai || {}, conf: Partial<ProviderConf> = s.providers?.[id] || {}; return conf.model || (id === 'claude' ? s.model || '' : ''); };
const menuModels = (plugin: CompassPlugin, id: string) => { const ms = plugin.aiModels?.(id) || plugin.ai?.models?.[id]; return ms?.length ? [AUTO, ...ms.map(m => m.name)] : DEFAULT_MODELS[id] || [AUTO]; };
function defaultName(plugin: CompassPlugin, id: string, names: string[]){
  const want = defaultModelOf(plugin, id), ms = modelsOf(plugin, id) || [];
  const hit = want && (ms.find(m => m.value === want) || ms.find(m => String(m.value).toLowerCase().includes(String(want).toLowerCase())));
  return hit && names.includes(hit.name) ? hit.name : names[0];
}
export function aiProviders(plugin: CompassPlugin){
  const s: Partial<AISettings> = plugin.settings.ai || {}, P: Partial<Record<string, ProviderConf>> = s.providers || {}, out: Record<string, [name: string, models: string[]]> = {};
  for (const id of PROVIDERS) if (P[id]?.on) out[id] = [providerName(plugin, id), menuModels(plugin, id)];
  return out;
}
export const providerName = (plugin: CompassPlugin, id: string): string => id === 'custom' ? (plugin.settings.ai?.providers?.custom?.name || '').trim() || PRESETS.custom.name : PRESETS[id]?.name || id;
// 插件设置 → 原型读的那份 d.settingsR27.ai
function syncSettings(d: AIModel, plugin: CompassPlugin, reset = false){
  const s: Partial<AISettings> = plugin.settings.ai || {}, list = aiProviders(plugin), ids = Object.keys(list), on = !!s.enabled && ids.length > 0;
  const provider = s.provider && list[s.provider] ? s.provider : ids[0] || 'claude';
  d.settingsR27 ??= {};
  d.settingsR27.ai = {enabled: on, provider, permission: s.permission || 'confirm', send: s.send || 'enter', cards: Object.fromEntries(ids.map(id => [id, {on: true}]))};
  if (!on) return;
  const [name, models] = list[provider], first = defaultName(plugin, provider, models);
  const all = ids.flatMap(id => list[id][1].map(m => list[id][0] + ' · ' + m));
  // 默认模型：设置改了（reset）就换成新的默认；平时保留你在模型菜单里为这段对话选的
  if (reset || !d.ai.model || !all.includes(d.ai.model)) d.ai.model = name + ' · ' + (models.includes(first) ? first : models[0]);
  d.ai.agent = ''; // 模型菜单里已经写了供应商
}

export function createAI({core, r12Art, view}: {core: AICore; r12Art: R12Art; view: CompassView}){
  const d = core.data as AIModel, plugin = view.plugin;
  HOST.aiProviders = () => { const p = aiProviders(plugin); return Object.keys(p).length ? p : {claude: [PRESETS.claude.name, DEFAULT_MODELS.claude]}; };
  syncSettings(d, plugin);
  const controller = createAIController({view, plugin, provider: plugin.aiProvider});
  HOST.ai = controller;
  const guidance = createGuidance({data: d, art: r12Art, announce: core.announce, currentNote: () => plugin.currentNote?.(),
    // 测试工具里的插件替身没有 openSettings / detectAI（真插件都有）：照原来先看有没有
    openSettings: () => 'openSettings' in plugin ? plugin.openSettings() : core.announce('设置在 Obsidian 的“第三方插件 → 潮线”里'),
    update: () => { if (d.ui.page === 'ai') view.drawScenery(); }});
  const root = view.root;
  // 原型里这几处由 paper.js 挂事件：提示词搜索、发送
  root.querySelector('#prompt-query')!.addEventListener('input', e => { d.ui.query = (e.target as HTMLInputElement).value; guidance.render(); });
  root.querySelector('.prompt-search')!.addEventListener('submit', e => e.preventDefault());
  root.querySelector('#handoff-form')!.addEventListener('submit', e => { e.preventDefault(); guidance.send(); });
  // 给开着的各家做一次 ACP 握手（第一次打开指引页时，不发起对话）
  let detected = false;
  async function detect(){ if (detected || !plugin.settings.ai?.enabled || !('detectAI' in plugin)) return; detected = true; await plugin.detectAI(); syncSettings(d, plugin); if (d.ui.page === 'ai') { guidance.render(); view.drawScenery(); } }
  return {
    render(){ syncSettings(d, plugin); guidance.render(); void detect(); },
    // 疑似问题批 F2：close() 断开了顶部的观察器，随即重新 watch，不然要等发出一句话或重开视图才补上“存成笔记 · 对话”和两个开关
    refresh(){ detected = false; controller.close(); controller.watch(); syncSettings(d, plugin, true); if (d.ui.page === 'ai') { guidance.render(); view.drawScenery(); } void detect(); },
    scenery(box: {left: number; top: number}): Part[]{ return r12Art.guidanceV(box); },
    /** 疑似问题批 F3：设置 › 指引 › 上下文 里列出的 MCP 服务（controller 握手时记下的） */
    mcp(){ return controller.mcp(); },
    close(){ controller.close(); if (HOST.ai === controller) HOST.ai = null; },
  };
}
