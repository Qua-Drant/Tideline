// 指引页：桅杆上的类别旗、提示词库与预览、复制；AI 助手（模型菜单、对话、发送）。
// 画面与交互用原型的 paper-guidance-r28.js（同步进 src/draw/proto/，提示词改为读 潮线/指引/ 下的笔记；
// “发送”和对话列表改成调 src/ai/controller.js，接本机的 Claude Code，见 docs/AI接入.md）。
import {createGuidance} from '../draw/proto/paper-guidance-r28.js';
import {createAIController} from '../ai/controller.js';
import {HOST} from '../host.js';
import {icon, esc} from '../draw/ink.js';
import {PRESETS, PROVIDERS} from '../ai/acp.js';

export const AI_HTML = `<section id="ai" class="page ai" aria-label="指引" hidden><div class="mast-scene"><div id="flags" class="flags"></div></div><div class="ai-window"><div id="connection"></div><div id="privacy"></div><div class="native-workspace"><div class="native-library"><form class="line-form prompt-search" role="search"><span id="search-icon"></span><input id="prompt-query" aria-label="搜索提示词" placeholder="搜索提示词…" autocomplete="off"></form><div id="prompts"></div></div><div id="native-content"></div></div><form id="handoff-form" class="line-form handoff"><svg id="handoff-outline" viewBox="0 0 601 83" preserveAspectRatio="none" aria-hidden="true"></svg><textarea id="handoff-input" placeholder="写下问题，或补充你的思路…（@ 提到笔记）" aria-label="对话草稿" rows="2"></textarea><button id="native-send" type="submit" aria-label="发送对话草稿"></button></form><div id="native-error" role="status" hidden></div></div></section>`;

// 0.3：经 ACP 接入的各家（设置里开着的）。0.7：模型清单是代理自己报的（设置里点“检查”、打开这一家或开过一段对话后记下，
// 存在本机设置里）；还没读到时 Claude 用三个预设，其他家只有“默认”（= 不改代理自己的默认）。每家可以在设置里选默认模型。
const CLAUDE_PRESET = [{value: 'sonnet', name: 'Sonnet'}, {value: 'opus', name: 'Opus'}, {value: 'haiku', name: 'Haiku'}];
const DEFAULT_MODELS = {claude: CLAUDE_PRESET.map(m => m.name)};
export const CLAUDE_MODEL = {sonnet: 'Sonnet', opus: 'Opus', haiku: 'Haiku'};
export const AUTO = '默认';
// 这一家的模型（{value, name}）；没读到时 null（Claude 用预设）
export const modelsOf = (plugin, id) => plugin.aiModels?.(id) || plugin.ai?.models?.[id] || (id === 'claude' ? CLAUDE_PRESET : null);
// 设置里为这一家选的默认模型（value）；Claude 沿用旧的 ai.model
export const defaultModelOf = (plugin, id) => { const s = plugin.settings.ai || {}, conf = s.providers?.[id] || {}; return conf.model || (id === 'claude' ? s.model || '' : ''); };
const menuModels = (plugin, id) => { const ms = plugin.aiModels?.(id) || plugin.ai?.models?.[id]; return ms?.length ? [AUTO, ...ms.map(m => m.name)] : DEFAULT_MODELS[id] || [AUTO]; };
function defaultName(plugin, id, names){
  const want = defaultModelOf(plugin, id), ms = modelsOf(plugin, id) || [];
  const hit = want && (ms.find(m => m.value === want) || ms.find(m => String(m.value).toLowerCase().includes(String(want).toLowerCase())));
  return hit && names.includes(hit.name) ? hit.name : names[0];
}
export function aiProviders(plugin){
  const s = plugin.settings.ai || {}, P = s.providers || {}, out = {};
  for (const id of PROVIDERS) if (P[id]?.on) out[id] = [providerName(plugin, id), menuModels(plugin, id)];
  return out;
}
export const providerName = (plugin, id) => id === 'custom' ? (plugin.settings.ai?.providers?.custom?.name || '').trim() || PRESETS.custom.name : PRESETS[id]?.name || id;
// 插件设置 → 原型读的那份 d.settingsR27.ai
function syncSettings(d, plugin, reset = false){
  const s = plugin.settings.ai || {}, list = aiProviders(plugin), ids = Object.keys(list), on = !!s.enabled && ids.length > 0;
  const provider = list[s.provider] ? s.provider : ids[0] || 'claude';
  d.settingsR27 ??= {};
  d.settingsR27.ai = {enabled: on, provider, permission: s.permission || 'confirm', send: s.send || 'enter', cards: Object.fromEntries(ids.map(id => [id, {on: true}]))};
  if (!on) return;
  const [name, models] = list[provider], first = defaultName(plugin, provider, models);
  const all = ids.flatMap(id => list[id][1].map(m => list[id][0] + ' · ' + m));
  // 默认模型：设置改了（reset）就换成新的默认；平时保留你在模型菜单里为这段对话选的
  if (reset || !d.ai.model || !all.includes(d.ai.model)) d.ai.model = name + ' · ' + (models.includes(first) ? first : models[0]);
  d.ai.agent = ''; // 模型菜单里已经写了供应商
}

export function createAI({core, r12Art, view}){
  const d = core.data, plugin = view.plugin;
  HOST.aiProviders = () => { const p = aiProviders(plugin); return Object.keys(p).length ? p : {claude: [PRESETS.claude.name, DEFAULT_MODELS.claude]}; };
  syncSettings(d, plugin);
  const controller = createAIController({view, plugin, provider: plugin.aiProvider});
  HOST.ai = controller;
  const guidance = createGuidance({data: d, art: r12Art, icon, esc, announce: core.announce, currentNote: () => plugin.currentNote?.(),
    openSettings: () => plugin.openSettings ? plugin.openSettings() : core.announce('设置在 Obsidian 的“第三方插件 → 潮线”里'),
    update: () => { if (d.ui.page === 'ai') view.drawScenery(); }});
  const root = view.root;
  // 原型里这几处由 paper.js 挂事件：提示词搜索、发送
  root.querySelector('#prompt-query').addEventListener('input', e => { d.ui.query = e.target.value; guidance.render(); });
  root.querySelector('.prompt-search').addEventListener('submit', e => e.preventDefault());
  root.querySelector('#handoff-form').addEventListener('submit', e => { e.preventDefault(); guidance.send(); });
  // 给开着的各家做一次 ACP 握手（第一次打开指引页时，不发起对话）
  let detected = false;
  async function detect(){ if (detected || !plugin.settings.ai?.enabled || !plugin.detectAI) return; detected = true; await plugin.detectAI(); syncSettings(d, plugin); if (d.ui.page === 'ai') { guidance.render(); view.drawScenery(); } }
  return {
    render(){ syncSettings(d, plugin); guidance.render(); detect(); },
    refresh(){ detected = false; controller.close(); syncSettings(d, plugin, true); if (d.ui.page === 'ai') { guidance.render(); view.drawScenery(); } detect(); },
    scenery(box){ return r12Art.guidance(box); },
    close(){ controller.close(); if (HOST.ai === controller) HOST.ai = null; },
  };
}
