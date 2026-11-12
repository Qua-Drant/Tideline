// 潮线：Obsidian 插件入口。注册视图、侧边栏按钮和命令；建索引（启动时一次，之后增量）。
import {MarkdownView, Plugin} from 'obsidian';
import {CompassView, VIEW_TYPE} from './view.js';
import {Index} from './data/index.js';
import {obsidianSource, obsidianWriter} from './data/source-obsidian.js';
import {CompassSettingTab, DEFAULT_AI, DEFAULT_DEVICE} from './settings.js';
import {PRESETS, PROVIDERS, resolveProvider, probe, createAcpSession} from './ai/acp.js';
import {zoteroInfo} from './data/zotero.js';
import {createCalendars} from './data/calendar.js';

const pad = n => String(n).padStart(2, '0');

export default class CompassPlugin extends Plugin {
  async onload(){
    const t0 = performance.now();
    this.perf = {loadMs: null, indexMs: null};
    this.settings = Object.assign({clock: null}, await this.loadData());
    // AI：0.3 起经 ACP 接各家代理程序（见 src/ai/acp.js、docs/AI接入.md）。status：每家一次握手的结果
    this.ai = {status: {}, checked: false};
    this.aiProvider = {caps: {rewind: false},
      create: o => createAcpSession({...o, provider: resolveProvider(o.providerId, this.settings.ai.providers),
        files: {read: rel => this.readVaultFile(rel), write: (rel, text) => this.writer.exists?.(rel) ? this.writer.body(rel, () => text) : this.writer.create(rel, text)}})};
    // 只存在这台设备上的东西（AI 对话列表）：Obsidian 的本机存储，按仓库分开，不写进仓库、不同步
    this.localStore = {load: k => this.app.loadLocalStorage(k), save: (k, v) => this.app.saveLocalStorage(k, v)};
    // 只属于这台设备的设置（设备偏好、AI 助手、装过的示例、是否起航过、上次所在的页）：Obsidian 的本机存储，不进仓库、不同步。
    // 早先放在 data.json 里的 AI 设置搬过来一次
    const stored = this.localStore.load('tideline-local') || {};
    this.local = {device: Object.assign({}, DEFAULT_DEVICE, stored.device), ai: Object.assign({}, DEFAULT_AI, this.settings.ai, stored.ai), examples: stored.examples || [], onboarded: !!stored.onboarded, lastPage: stored.lastPage || 'today', calendars: stored.calendars || [], examplesAsked: !!stored.examplesAsked, version: stored.version || null, zotero: Object.assign({on: true, folder: ''}, stored.zotero)};
    // 0.3 起页面之间只保留纸面滑动：旧的“完整”过场按“滑动”处理
    if (this.local.device.motion !== 'off') this.local.device.motion = 'brief';
    // 0.2 的 Claude Agent SDK 设置搬到 ACP：API 密钥归到 Claude Code 名下；旧的 claude 程序路径不再用
    const A = this.local.ai; A.providers = Object.assign({}, ...PROVIDERS.map(id => ({[id]: {on: id === 'claude', command: '', args: '', apiKeySecret: '', name: ''}})), A.providers);
    for (const id of PROVIDERS) A.providers[id] = Object.assign({on: false, command: '', args: '', apiKeySecret: '', name: ''}, A.providers[id]);
    if (A.apiKeySecret && !A.providers.claude.apiKeySecret) A.providers.claude.apiKeySecret = A.apiKeySecret;
    delete A.apiKeySecret; delete A.exe; if (!PRESETS[A.provider]) A.provider = 'claude';
    delete this.settings.ai;
    Object.defineProperty(this.settings, 'ai', {get: () => this.local.ai, enumerable: false});
    this.addSettingTab(new CompassSettingTab(this.app, this));
    this.writer = obsidianWriter(this.app);
    this.index = new Index(obsidianSource(this.app, this));
    this.calendars = createCalendars(this);
    this.registerView(VIEW_TYPE, leaf => new CompassView(leaf, this));
    this.addRibbonIcon('waves', '打开潮线', () => this.activate());
    this.addCommand({id: 'open', name: '打开潮线', callback: () => this.activate()});
    // 布局就绪时建一次索引；第一次 metadataCache 'resolved'（所有文件的属性都已缓存）时再建一次，补上启动时还没缓存好的文件。之后只跟着改动增量更新。
    const workspace = this.app.workspace;
    this.registerEvent(workspace.on('active-leaf-change', leaf => {
      if (leaf?.view instanceof MarkdownView) this.noteLeaf = leaf;
    }));
    workspace.onLayoutReady(async () => {
      this.noteLeaf ??= workspace.getActiveViewOfType(MarkdownView)?.leaf;
      this.index.setExamples(this.local.examples);
      await this.syncZotero(false); // Zotero Integration 的导入文件夹也当文献读（其他插件此时都已载入）
      await this.index.build(); this.perf.indexMs = +this.index.stats.built.toFixed(1);
      // 日历订阅：先用缓存展开，再看要不要刷新；之后每 10 分钟看一次（到了间隔才联网）
      this.calendars.load().then(() => this.calendars.tick()); // 先用本机缓存展开，再看哪些到了刷新间隔（0.7.1：打开时不再一律联网）
      this.registerInterval(window.setInterval(() => this.calendars.tick(), 600000));
      // 新建笔记：装着示例航程时，第一篇自己的笔记出现后提示一次要不要清除示例（稍等一下再看，装示例时建的那些先记进清单）
      this.registerEvent(this.app.vault.on('create', f => { if (f?.extension !== 'md') return; setTimeout(() => { for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view.noteCreated?.(f.path); }, 1500); }));
      const ref = this.app.metadataCache.on('resolved', async () => { this.app.metadataCache.offref(ref); await this.index.rebuild(); this.perf.indexMs = +this.index.stats.built.toFixed(1); });
      this.registerEvent(ref);
    });
    this.perf.loadMs = +(performance.now() - t0).toFixed(1);
  }
  onunload(){ this.index?.dispose(); }
  async saveSettings(){ await this.saveData({clock: this.settings.clock}); this.localStore.save('tideline-local', this.local); }
  // AI：给开着的每一家做一次 ACP 握手（找命令、看名称与版本，不花用量）。
  //   只查一家（使用者点“检查”、打开这一家、改了命令）时再开一个空会话读模型清单；平时打开指引页只握手。
  async detectAI(force = false, only = null, {models = !!only} = {}){
    if (this.ai.checked && !force) return this.ai;
    const A = this.settings.ai, ids = only ? [only] : PROVIDERS.filter(id => A.providers[id]?.on);
    const results = await Promise.all(ids.map(async id => [id, await probe(resolveProvider(id, A.providers), {cwd: this.vaultRoot(), apiKey: this.aiApiKey(id), models}).catch(e => ({ok: false, error: String(e.message || e)}))]));
    for (const [id, r] of results) { this.ai.status[id] = r; if (r.models?.length) await this.rememberModels(id, r.models); }
    if (!only) this.ai.checked = true; return this.ai;
  }
  // 代理报过的模型清单记在本机设置里（重开 Obsidian 后模型菜单还在）；默认模型不在新清单里时改回“代理默认”
  async rememberModels(id, list){
    const conf = this.settings.ai.providers[id]; if (!conf || !list?.length) return;
    const plain = list.map(m => ({value: String(m.value), name: String(m.name)}));
    this.ai.models ??= {}; this.ai.models[id] = plain;
    if (JSON.stringify(conf.models) === JSON.stringify(plain)) return;
    conf.models = plain; if (conf.model && !plain.some(m => m.value === conf.model)) conf.model = '';
    await this.saveSettings();
  }
  aiModels(id){ return this.ai.models?.[id] || this.settings.ai.providers?.[id]?.models || null; }
  // Zotero 文献（0.7，见 data/zotero.js）
  zotero(){ return zoteroInfo(this.app, this.local.zotero?.folder || ''); }
  async syncZotero(rebuild = true){ const z = this.zotero(), on = this.local.zotero?.on !== false && (z.enabled || !!this.local.zotero?.folder);
    if (rebuild) await this.index.setZoteroFolders(on ? z.folders : []); else this.index.setZoteroFolders(on ? z.folders : []); return z; }
  async importZotero(id){ const z = await this.syncZotero(); const cmd = id || z.imports[0]?.id; if (!cmd) return false; try { return this.app.commands.executeCommandById(cmd) !== false; } catch { return false; } }
  aiProviderInfo(id){ return resolveProvider(id, this.settings.ai.providers); }
  aiApiKey(id = this.settings.ai.provider){ const key = this.settings.ai.providers?.[id]?.apiKeySecret; try { return key ? this.app.secretStorage?.getSecret(key) || '' : ''; } catch { return ''; } }
  currentNote(){
    const workspace = this.app.workspace;
    const active = workspace.getActiveViewOfType(MarkdownView);
    const leaf = this.noteLeaf;
    const file = active?.file ?? (leaf && workspace.getLeavesOfType('markdown').includes(leaf) ? leaf.view.file : null);
    return file?.extension === 'md' ? {path: file.path, title: file.basename} : null;
  }
  vaultRoot(){ return this.app.vault.adapter.basePath || this.app.vault.adapter.getBasePath?.() || ''; }
  async readVaultFile(rel){ try { return await this.app.vault.adapter.exists(rel) ? await this.app.vault.adapter.read(rel) : null; } catch { return null; } }
  clearAIConversations(){ try { this.localStore.save('tideline-ai-conversations', []); } catch {} this.refreshAI(); }
  applyDevice(){ for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view.applyDevice?.(); }
  async openCompassSettings(){ await this.activate(); this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view.openSettings?.(); }
  refreshAI(){ for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view.refreshAI?.(); }
  openSettings(){ this.openCompassSettings(); }
  // 时刻：设置里固定了就用固定的（沙盒仓库用它和原型对照），否则用本机时间
  clock(){
    if (this.settings.clock?.date) return {date: this.settings.clock.date, time: this.settings.clock.time || '12:00'};
    const d = new Date(); return {date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  }
  async activate(){
    const {workspace} = this.app, have = workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = have || workspace.getLeaf('tab');
    if (!have) await leaf.setViewState({type: VIEW_TYPE, active: true});
    workspace.revealLeaf(leaf);
  }
}
