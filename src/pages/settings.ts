// 潮线自己的设置页（设计说明第 21 节；画面照原型 paper-settings-r30.js：同样的标记与类名，样式由 prototype.css 接管）。
// 原型的设置页全是示例状态（假的供应商、假的日历订阅、假的检查报告）；这里每一项都读写真实的东西：
//   设备：只存在这台设备上（plugin.local，Obsidian 的本机存储）——字号、配色、过场、打开时停在、习惯旁的最近 7 天
//   指引：AI 助手（本机）；三张保护名单写在 潮线/配置.md（所有设备一样）
//   笔记：习惯、每日问题、生命之轮领域三张清单，改了就写进 潮线/配置.md
//   日历（0.9.3 前叫“私密”）：日历订阅（地址与取回的日程只在这台设备上，见 data/calendar.js），日程笔记
//   数据：索引计数与重建、一致性检查（只读）、同步冲突副本、示例航程；关于：版本、重新起航
// 改了就生效，没有“保存”按钮；写进笔记的改动旁边淡入“已写入”。
// 第 3d 期：转 TypeScript；整页改成 DOM 构建（draw/dom.ts），不再拼 HTML 字符串、不再整段 outerHTML 替换。每个函数对应原来的一段模板，
// 结构、属性及其先后一一对应；用户写的文字（清单项、订阅名、文件夹……）直接成为文本节点或属性值。
// 重画仍是“整张设置纸换成新的一张”（refresh：replaceWithNodes），保留滚动位置、is-still、密钥框、手绘框的重画与输入框聚焦，和原来一样。
import {PRESETS, PROVIDERS} from '../ai/acp.ts';
import {providerName, modelsOf, defaultModelOf} from './ai.js';
import {SecretComponent} from 'obsidian';
import {inkEl, circleEl, iconEl} from '../draw/ink.ts';
import {h, svg, insertNodes, replaceWithNodes} from '../draw/dom.ts';
import type {Child} from '../draw/dom.ts';
import {FOLDERS} from '../data/index.ts';
import type {IndexConfig} from '../data/types.ts';
import {supportQr, supportUrl} from '../support.ts';
import type {CompassView} from '../view.ts';
import type CompassPlugin from '../main.ts';

/** 小图标外框：viewBox 0 0 w h 的 svg */
const SVG = (kids: Child, w = 20, ht = w) => svg('svg', {viewBox: `0 0 ${w} ${ht}`, 'aria-hidden': 'true'}, kids);
const PAGES = [['device', '设备'], ['guidance', '指引'], ['notes', '笔记'], ['secret', '日历'], ['data', '数据'], ['about', '关于']];
const AI_TABS = [['vendor', '供应商'], ['guard', '权限与保护'], ['context', '上下文'], ['chat', '对话']];
const CONFIG = FOLDERS.config;
type Option = [value: string | number, label: string];
/** 设置页自己的状态 */
interface SettingsState {
  page: string; aiTab: string; confirm: string | null; menu: string | null; rename: string | null; adding: string | null; written: number;
  report: {groups: [string, [string, string][]][]; total: number} | null; rebuilding: boolean; conflicts: string[] | null; open: string | null;
  checking?: string | null; advanced?: boolean; subError?: string; busy?: string | null; busyAt?: number;
}
/** pages/ai.js（还没转 TypeScript）给的模型清单的一项 */
interface ModelOption { value: string; name: string }
/** ai.ts 的 mcp() 给的一项 */
interface McpItem { name: string; status: string }
type ListKind = 'habits' | 'questions' | 'wheel';

export function createSettingsPage({view, plugin}: {view: CompassView; plugin: CompassPlugin}){
  const root = view.root, $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s);
  const S: SettingsState = {page: 'device', aiTab: 'vendor', confirm: null, menu: null, rename: null, adding: null, written: 0, report: null, rebuilding: false, conflicts: null, open: 'claude'};
  const dev = () => plugin.local.device, A = () => plugin.local.ai;
  const cfg = () => plugin.index.config;
  const where = (t: string) => h('i', {class: 'set-where', 'data-where': t}, t);
  const seg = (path: string, options: Option[], cur: unknown) => h('span', {class: 'set-seg', role: 'radiogroup'}, options.map(([v, l]) => h('button', {type: 'button', role: 'radio', 'data-set': `${path}|${v}`, 'aria-checked': String(String(cur) === String(v))}, l)));
  const mark = (path: string, on: unknown, label: string) => h('button', {type: 'button', class: 'set-mark', role: 'switch', 'data-set': `${path}|toggle`, 'aria-checked': String(!!on), 'aria-label': label},
    SVG(on ? svg('circle', {cx: '10', cy: '10', r: '5.2', fill: '#1C2A35'}) : circleEl(10, 10, 5.2, 1.3), 20), h('span', null, on ? '开' : '关'));
  const row = (label: string, body: Child, tag = '') => h('div', {class: 'set-row'}, h('span', {class: 'set-label'}, label, tag ? where(tag) : null), h('div', {class: 'set-body'}, body));
  const note = (text: string, cls = '') => h('small', {class: cls ? `set-note ${cls}` : 'set-note'}, text);
  const meta = (kids: Child) => h('span', {class: 'set-meta'}, kids);
  const fold = (path: string, label: string) => h('button', {type: 'button', class: 'set-fold', 'data-settings-act': `fold|${path}`, 'aria-label': `打开 ${label}`}, SVG(inkEl([[3, 3], [15, 3], [15, 15], [10, 10], [15, 10]], 1.1), 18));
  const group = (id: string, ic: Child, title: string, scope: string, body: Child, extra: Child = null) => h('section', {class: 'set-group', 'data-group': id},
    h('header', null, ic, h('h3', null, title), h('p', null, scope), extra, S.written && Date.now() - S.written < 2000 ? h('span', {class: 'set-written'}, '已写入') : null), h('div', {class: 'set-rows'}, body));
  // 每次画都要新的一份（同一个图标在一页里可能出现两次）
  const G = {device: () => SVG([inkEl([[3, 5], [17, 5], [17, 14], [3, 14], [3, 5]], 1.2), inkEl([[1, 16.5], [19, 16.5]], 1.3)]),
    helm: () => SVG([circleEl(10, 10, 6, 1.2), circleEl(10, 10, 2, 1), [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const t = i * Math.PI / 4; return inkEl([[10 + Math.cos(t) * 2, 10 + Math.sin(t) * 2], [10 + Math.cos(t) * 9, 10 + Math.sin(t) * 9]], 1); })]),
    note: () => SVG([inkEl([[4, 2], [13, 2], [16, 5], [16, 18], [4, 18], [4, 2]], 1.2), inkEl([[7, 8], [13, 8]], 1), inkEl([[7, 12], [13, 12]], 1)]),
    lock: () => SVG([inkEl([[4, 9], [16, 9], [16, 18], [4, 18], [4, 9]], 1.2), inkEl([[6.5, 9], [6.5, 5.5], [10, 2.5], [13.5, 5.5], [13.5, 9]], 1.2)]),
    data: () => SVG([inkEl([[3, 5], [10, 2.5], [17, 5], [10, 7.5], [3, 5]], 1.1), inkEl([[3, 5], [3, 15], [10, 17.5], [17, 15], [17, 5]], 1.1), inkEl([[3, 10], [10, 12.5], [17, 10]], 1)]),
    heart: () => SVG(inkEl([[10, 16.5], [4.2, 11], [3, 7.6], [4.6, 4.6], [7.6, 4], [10, 6.4], [12.4, 4], [15.4, 4.6], [17, 7.6], [15.8, 11], [10, 16.5]], 1.3)),
    info: () => SVG([circleEl(10, 10, 8, 1.2), inkEl([[10, 9], [10, 14.5]], 1.4), circleEl(10, 6, .8, 1)])};
  const refreshIcon = () => SVG([inkEl([[15, 6], [13, 4], [9, 3], [5, 5], [3, 9], [4, 13], [7, 16], [11, 17], [15, 15], [17, 11]], 1.1), inkEl([[15, 2], [15, 6], [11, 6]], 1.1)]);
  const mini = (act: string, kids: Child) => h('button', {type: 'button', class: 'set-mini hand-pill', 'data-settings-act': act}, kids);

  // ——— 设备 ———
  function device(){ const D = dev();
    return [row('字号', [seg('device.font', [['.92', '小'], ['1', '标准'], ['1.1', '大'], ['1.2', '特大']], D.font), note('整个界面的文字一起放大或缩小，排版位置不变')]),
      row('配色', seg('device.theme', [['obsidian', '跟随 Obsidian'], ['paper', '纸'], ['night', '夜航']], D.theme)),
      row('过场', [seg('device.motion', [['brief', '滑动'], ['off', '关闭']], D.motion), note('换页时纸面上下滑动。系统开了“减少动态效果”时固定为关闭')]),
      row('打开时停在', seg('device.start', [['last', '上次所在的页'], ['today', '今日']], D.start)),
      row('习惯旁的最近 7 天', mark('device.week', D.week, '习惯旁的最近 7 天')),
      row('悬停功能提示', mark('device.tooltips', D.tooltips, '悬停功能提示'), '本机')]; }
  // ——— 指引（AI 助手）———
  function enableRow(){ return row('启用 AI 助手', [mark('ai.enabled', A().enabled, '启用 AI 助手'), note('关掉后指引页只留桅顶和提示词库，不启动程序、不联网。开启后，对话里提到的、AI 读到的笔记内容会经由你选的 ACP 代理发给对应的服务商（Claude Agent → Anthropic，Codex → OpenAI，Gemini CLI → Google，CodeBuddy → 腾讯云，DeepSeek Harness → DeepSeek）。')], '本机'); }
  // 每家的默认模型：清单是代理自己报的（点“检查”时读）；“代理默认”= 不改它自己的默认
  function modelRow(id: string, checking: boolean): Child{
    const ms = modelsOf(plugin, id) as ModelOption[] | null | undefined, cur = defaultModelOf(plugin, id) as string | null | undefined; // pages/ai.js 是 JS：按这两种类型看
    if (!ms?.length) return [meta(checking ? '正在读取模型清单…' : '还没读到模型清单'), mini(`detect|${id}`, [refreshIcon(), h('span', null, '读取')]), note('读取时会让代理开一个空会话，不发消息、不花用量')];
    const opts: Option[] = [['', '代理默认'], ...ms.map((m): Option => [m.value, m.name])];
    return [h('span', {class: 'set-seg set-models'}, opts.map(([v, l]) => h('button', {type: 'button', role: 'radio', 'data-set': `ai.providers.${id}.model|${v}`, 'aria-checked': String(String(cur) === String(v) || (!cur && !v))}, l))), note('指引页的模型菜单里也可以为一段对话另选')];
  }
  function providerCard(id: string): Child{
    const a = A(), P = a.providers || {}, conf = P[id] || {} as Partial<typeof P[string]>, info = plugin.aiProviderInfo(id), st = plugin.ai.status?.[id], open = S.open === id, checking = S.checking === id, name = providerName(plugin, id) as string;
    const state: Child = !conf.on ? h('span', null, '关') : checking ? h('span', null, '检查中…') : !st ? h('span', null, '还没检查') : !st.ok ? h('span', {class: 'is-bad'}, st.error || '没有回应') : [h('span', null, st.name || ''), h('span', {class: 'mono'}, st.version || '')];
    const preset = PRESETS[id];
    const body: Child = open ? h('div', {class: 'sp-body'},
      id === 'custom' ? row('名称', h('form', {class: 'set-inline', 'data-settings-form': `pname|${id}`}, h('input', {name: 'v', value: conf.name || '', placeholder: '在模型菜单里显示的名字', 'aria-label': '名称'})), '本机') : null,
      row('启动命令', [h('form', {class: 'set-inline', 'data-settings-form': `pcmd|${id}`}, h('input', {name: 'v', class: 'mono', value: conf.command || '', placeholder: preset.command || '命令或程序路径', 'aria-label': '启动命令'})), mini(`detect|${id}`, [refreshIcon(), h('span', null, '检查')]), st?.path ? note(st.path, 'mono') : null], '本机'),
      row('参数', h('form', {class: 'set-inline', 'data-settings-form': `pargs|${id}`}, h('input', {name: 'v', class: 'mono', value: String(conf.args || ''), placeholder: preset.args.join(' ') || '没有', 'aria-label': '参数'})), '本机'),
      conf.on ? row('默认模型', modelRow(id, checking), '本机') : null,
      info.install ? row('安装', [h('span', {class: 'set-code'}, info.install), mini(`copy|${info.install}`, '复制')], '终端')
        : info.unverified?.install ? row('安装', h('span', {class: 'set-meta', 'data-unverified': 'install'}, info.unverified.install), '未验证') : null,
      info.login ? row('登录', [h('span', {class: 'set-code'}, info.login), mini(`copy|${info.login}`, '复制'), note('用它自己的登录，凭据不经过潮线')], '各家程序自己保存') : null,
      info.keyEnv ? row('API 密钥（可选）', [h('span', {class: 'set-secret', 'data-secret-slot': id}), note(`填了就按 API 用量计费（作为 ${info.keyEnv} 交给代理）；存在 Obsidian 的密钥库里，不同步`), info.unverified?.keyEnv ? h('small', {class: 'set-note is-warn', 'data-unverified': 'keyEnv'}, info.unverified.keyEnv) : null], '私密') : null,
      row('数据去向', meta(`对话里提到的、代理读到的笔记内容会发给 ${info.vendor || '这个代理对应的服务'}`), '')) : null;
    return h('li', {class: `set-provider hand-panel ${open ? 'is-open' : ''}`},
      h('div', {class: 'sp-head'}, h('button', {type: 'button', class: 'sp-name', 'data-settings-act': `card|${id}`, 'aria-expanded': String(open)}, SVG(inkEl(open ? [[5, 8], [10, 13], [15, 8]] : [[8, 5], [13, 10], [8, 15]], 1.2), 16), h('b', null, name)),
        mark(`ai.providers.${id}.on`, conf.on, '启用 ' + name), h('span', {class: 'sp-state'}, state)), body);
  }
  function guidance(tab: string): Child{
    const a = A(); if (!a.enabled) return null;
    if (tab === 'vendor') {
      // 0.3：经 ACP（Agent Client Protocol）接入。每家一张卡：开关、启动命令与参数、安装与登录办法、API 密钥、握手检查
      const P = a.providers || {}, on = PROVIDERS.filter(id => P[id]?.on), name = (id: string) => providerName(plugin, id) as string;
      return [h('h4', {class: 'set-sub'}, '供应商'), row('接入方式', meta('ACP 客户端：在这台电脑上启动各家的 ACP 代理程序，代理与登录都由你自己安装和保存'), '本机'),
        row('默认供应商', on.length ? seg('ai.provider', on.map((id): Option => [id, name(id)]), on.includes(a.provider) ? a.provider : on[0]) : meta('先在下面打开一家'), '本机'),
        row('默认思考强度', [seg('ai.effort', [['low', '低'], ['medium', '中'], ['high', '高'], ['xhigh', '很高'], ['max', '最高']], a.effort), note('代理支持时生效')], '本机'),
        h('ul', {class: 'set-cards'}, PROVIDERS.map(providerCard))];
    }
    const L = cfg().ai, chips = (list: string[], key: string) => [list.length ? list.map((x, i) => h('span', {class: 'set-chip hand-pill mono'}, x, h('button', {type: 'button', class: 'set-chip-x', 'data-settings-act': `unlist|${key}|${i}`, 'aria-label': `从名单里拿掉 ${x}`}, '×'))) : meta('空'),
      S.adding === key ? h('form', {class: 'set-inline', 'data-settings-form': `list|${key}`}, h('input', {name: 'v', class: 'mono', placeholder: '文件夹以 / 结尾，或一篇笔记的路径', 'aria-label': '新增'})) : h('button', {type: 'button', class: 'set-add', 'data-settings-act': `add|${key}`, 'aria-label': '新增'}, iconEl('plus', 16))];
    if (tab === 'guard') return [row('默认权限', [seg('ai.permission', [['read', '只读'], ['confirm', '改前确认'], ['auto', '自动接受改动']], a.permission), a.permission === 'auto' ? note('只限“允许直接改的文件夹”；指引页桅顶会插一面警示小旗', 'is-warn') : note('不提供“全部放行”；对话里还能就地换')], '本机'),
      row('读取前先问我', chips(L.askRead, 'askRead'), '同步'), row('不能改的位置', chips(L.noWrite, 'noWrite'), '同步'), row('允许直接改的文件夹', chips(L.autoWrite, 'autoWrite'), '同步'),
      // P2-4：如实写出各家由谁拦。潮线只能在代理发来许可请求（或请潮线代读代写文件）时按三档与名单决定；代理自己直接读写时拦不到
      row('由谁来拦', h('ul', {class: 'set-note set-guard-who', 'data-guard-who': true},
        h('li', null, h('b', null, 'Claude Agent'), '：三档权限、“读取前先问”“不能改”由潮线交给它运行的 Claude Code 当规则执行，它自己读写文件时也会先问或拒绝；对照卡由潮线出。'),
        h('li', null, h('b', null, 'Codex、CodeBuddy'), '：开对话时潮线把代理切到“改动先问”的模式，改动、运行命令经潮线的三档与名单决定；代理自己读文件通常不问，“读取前先问”不一定拦得到。'),
        h('li', null, h('b', null, 'Gemini CLI、DeepSeek Harness、自定义'), '：只有代理主动请求许可、或请潮线代读代写文件时才拦得到；其余取决于代理自己的设置。')), ''),
      row('改动可以回退', meta('经 ACP 接入时，代理改过的文件不能由潮线还原；改前改后的对照卡仍会先问你'), '本机')];
    if (tab === 'context') { const mcp = (view.lower?.ai as {mcp?(): McpItem[]} | null | undefined)?.mcp?.() || []; // 指引页（pages/ai.js）是 JS：mcp() 按 McpItem 看
      const STATUS: Record<string, string> = {connected: '已连接', failed: '连不上', 'needs-auth': '要登录', pending: '连接中', disabled: '关了'};
      return [row('自动附带当前页的内容', [mark('ai.attach', (a as typeof a & {attach?: boolean}).attach, '自动附带当前页的内容'), note('日记正文不会自动附带')], '本机'),
        row('工作说明', [h('span', {class: 'set-code'}, 'CLAUDE.md · AGENTS.md'), plugin.writer.exists?.('CLAUDE.md') ? fold('CLAUDE.md', '工作说明') : note('仓库里还没有这两篇')], '仓库本身'),
        row('技能与命令', [h('span', {class: 'set-code'}, '.claude/skills/ · .claude/commands/'), note('对话里输入 / 列出')], '同步'),
        row('MCP 服务', mcp.length ? [mcp.map(m => h('span', {class: 'set-chip hand-pill'}, `${m.name.replace(/^claude\.ai /, '')} · ${STATUS[m.status] || m.status}`)), note('用之前都会先问你')] : meta('发出第一句话后显示'), '各家程序')]; }
    return [row('发送方式', seg('ai.send', [['enter', '回车发送'], ['mod', 'Ctrl + 回车发送']], a.send), '本机'),
      row('自动归档', seg('ai.archiveDays', [[7, '7 天'], [30, '30 天'], [90, '90 天'], [0, '不归档']], a.archiveDays), '本机'),
      row('清除对话列表', [mini('confirm|clear-chats', '清除'), note('只清除这台设备上的列表；各家代理自己的会话记录不会删除')], '本机'),
      row('存成笔记放在哪', S.rename === 'inbox' ? h('form', {class: 'set-inline', 'data-settings-form': 'inbox'}, h('input', {name: 'v', class: 'mono', value: a.saveFolder, 'aria-label': '文件夹'})) : [h('span', {class: 'set-code'}, a.saveFolder), mini('rename|inbox', '改')], '本机')];
  }
  // ——— 笔记：三张清单 ———
  const LISTS: Record<ListKind, [title: string, field: 'habits' | 'questions' | 'areas', nameKey: string, prefix: string]> = {habits: ['习惯', 'habits', 'name', 'habit_'], questions: ['每日问题', 'questions', 'title', 'question_'], wheel: ['生命之轮领域', 'areas', 'title', 'area_']};
  type ListItem = {id: string} & Record<string, string>;
  const configList = (kind: ListKind) => ((cfg() as IndexConfig & Record<string, unknown>)[LISTS[kind][1]] || []) as ListItem[];
  const items = (kind: ListKind) => configList(kind).map(x => ({key: x.id, name: x[LISTS[kind][2]]}));
  function editList(kind: ListKind, ic: Child){ const [title] = LISTS[kind], L = items(kind);
    return h('div', {class: 'set-list hand-panel', 'data-list': kind},
      h('header', null, ic, h('b', null, title), h('span', {class: 'mono'}, `${L.length} 项`), h('button', {type: 'button', class: 'set-add', 'data-settings-act': `add|${kind}`, 'aria-label': `新增${title}`}, iconEl('plus', 16))),
      h('ol', null, L.map((x, i) => h('li', {draggable: 'true', 'data-item': `${kind}|${i}`}, SVG([inkEl([[5, 7], [15, 7]], 1), inkEl([[5, 10], [15, 10]], 1), inkEl([[5, 13], [15, 13]], 1)]),
        S.rename === kind + '|' + i ? h('form', {class: 'set-inline', 'data-settings-form': `rename|${kind}|${i}`}, h('input', {name: 'v', value: x.name, 'aria-label': '改名'})) : h('span', {class: 'set-name'}, x.name),
        h('span', {class: 'set-key mono'}, x.key), h('button', {type: 'button', class: 'set-more', 'data-settings-act': `menu|${kind}|${i}`, 'aria-label': '更多'}, '⋯'),
        S.menu === kind + '|' + i ? h('span', {class: 'set-menu hand-popup'}, h('button', {type: 'button', 'data-settings-act': `rename|${kind}|${i}`}, '改名'), h('button', {type: 'button', 'data-settings-act': `confirm|del|${kind}|${i}`}, '删除')) : null))),
      S.adding === kind ? h('form', {class: 'set-inline set-add-form', 'data-settings-form': `add|${kind}`}, h('input', {name: 'v', placeholder: '名称', 'aria-label': `新增${title}`})) : null); }
  // Zotero 文献（0.7）：接 Zotero Integration 插件，读它导进来的文献笔记
  function zoteroRow(): Child{
    const z = plugin.zotero?.(); if (!z) return null;
    const Z = plugin.local.zotero || {} as Partial<typeof plugin.local.zotero>, n = [...plugin.index.literature.values()].filter(x => x.source === 'zotero').length;
    const state = !z.installed && !Z.folder ? meta('没有找到 Zotero Integration 插件。装上并启用后，它导进来的文献会出现在知识库里')
      : !z.enabled && !Z.folder ? meta('Zotero Integration 已安装，没有启用')
      : meta(Z.on === false ? '没有接入' : z.folders.length ? `读取 ${z.folders.map(f => f + '/').join('、')} · ${n} 篇文献` : '没有找到导入文件夹，可以在下面填');
    return [row('Zotero 文献', [z.installed || Z.folder ? mark('zotero.on', Z.on !== false, '接入 Zotero 文献') : null, state,
      note('文献笔记由 Zotero Integration 按它的模板导入（知识库页的“Zotero”按钮调它的导入命令）；潮线读作者、年份、标签、摘要和标注，在 Zotero 里打开 PDF')]),
      z.installed || Z.folder ? row('导入文件夹', [h('form', {class: 'set-inline', 'data-settings-form': 'zfolder'}, h('input', {name: 'v', class: 'mono', value: Z.folder || '', placeholder: z.found.join('、') || '跟随 Zotero Integration 的设置', 'aria-label': 'Zotero 导入文件夹'})), note('留空就用 Zotero Integration 设置里的')]) : null];
  }
  function notes(): Child{
    const qIcon = SVG([circleEl(10, 10, 7.5, 1.1), inkEl([[7.5, 7.5], [8.5, 5.6], [10, 5], [11.6, 5.6], [12.4, 7.5], [10, 10], [10, 11.8]], 1), circleEl(10, 14.4, .6, 1)]), wIcon = SVG([circleEl(10, 10, 7.5, 1.1), circleEl(10, 10, 1.6, 1), inkEl([[10, 2.5], [10, 17.5]], .9), inkEl([[2.5, 10], [17.5, 10]], .9)]);
    // 高级：最后一项“配置笔记”的值是路径加一个打开的按钮（原来在模板里按“含不含 <”区分）
    const adv: [string, Child][] = [['日记', FOLDERS.journal + '/'], ['任务', FOLDERS.tasks + '/'], ['项目', FOLDERS.projects + '/'], ['人物', FOLDERS.people + '/'], ['目标', FOLDERS.goals + '/'], ['想法', FOLDERS.ideas + '/'], ['文献', FOLDERS.literature + '/'], ['书籍', FOLDERS.books + '/'], ['随手记标题', '## 随手记'], ['配置笔记', [CONFIG + ' ', fold(CONFIG, '配置笔记')]]];
    return [h('div', {class: 'set-lists'}, editList('habits', iconEl('check', 18)), editList('questions', qIcon), editList('wheel', wIcon)), note('属性名创建后不能改，否则旧日记里的记录会对不上；删除只是从清单里拿掉，旧日记里的记录都还在。拖动可以排序。'),
      zoteroRow(),
      row('任务清单', [cfg().lists.filter(l => !l.archived).map(l => h('button', {type: 'button', class: 'set-chip hand-pill', 'data-settings-act': 'go|tasks'}, l.title)), note('在任务页（货舱）管理')]),
      h('button', {type: 'button', class: 'set-line', 'data-settings-act': 'advanced', 'aria-expanded': String(!!S.advanced)}, iconEl('settings', 18), h('b', null, '高级'), h('span', null, '各类笔记放在哪个文件夹、日记里各个标题的名字'), SVG(inkEl(S.advanced ? [[5, 12], [10, 7], [15, 12]] : [[5, 8], [10, 13], [15, 8]], 1.2), 18)),
      S.advanced ? [h('dl', {class: 'set-adv'}, adv.map(([t, v]) => h('div', null, h('dt', null, t), h('dd', {class: 'mono'}, v)))), note('文件夹名暂时不能改（以后放进设置）。')] : null]; }
  // ——— 私密 ———
  // 日历订阅（画面照原型 secret()：名称、隐藏的地址、上次刷新、状态、刷新间隔、立即刷新；原型没有删除，这里在状态后面加一个“移除”）
  const okMark = () => SVG([circleEl(8, 8, 6, 1), inkEl([[5, 8], [7.5, 10.5], [11.5, 5.5]], 1.1)], 16), badMark = () => SVG([circleEl(8, 8, 6, 1, '#B23A48'), inkEl([[8, 4.5], [8, 9]], 1.3, '#B23A48'), circleEl(8, 11.5, .6, 1, '#B23A48')], 16);
  // Date 与毫秒数比较（JS 的隐式转换；类型上按 number 看）
  const when = (iso: string | null | undefined) => { if (!iso) return '还没刷新'; const t = new Date(iso), tn = t as unknown as number, n = new Date(), hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return tn >= d0 ? '今天 ' + hm : tn >= d0 - 86400000 ? '昨天 ' + hm : `${t.getMonth() + 1}月${t.getDate()}日 ${hm}`; };
  const secret = (): Child => { const subs = plugin.calendars?.list() || [];
    return [h('div', {class: 'set-subs-head'}, h('b', null, '日历订阅'), mini('add-sub', [iconEl('plus', 14), h('span', null, '添加')])),
      h('p', {class: 'set-note set-sub-note'}, '地址只保存在这台设备上，每台设备要各自添加。'),
      S.adding === 'sub' ? h('form', {class: 'set-inline set-sub-add', 'data-settings-form': 'sub'}, h('input', {name: 'v', placeholder: '名称', 'aria-label': '订阅名称'}), h('input', {name: 'url', placeholder: '粘贴 iCal 地址', 'aria-label': 'iCal 地址'}), h('button', {type: 'submit', class: 'set-mini hand-pill'}, '添加')) : null,
      S.subError ? h('p', {class: 'set-note is-bad'}, S.subError) : null,
      h('ul', {class: 'set-subs'}, subs.map(s => h('li', {'data-sub': s.id}, SVG([inkEl([[3, 5], [17, 5], [17, 17], [3, 17], [3, 5]], 1), inkEl([[3, 8], [17, 8]], .9)], 20), h('b', null, s.name || '日历'),
        h('span', {class: 'mono set-mask', title: '地址已隐藏'}, '••••••'), h('span', {class: 'set-last'}, S.busy === s.id ? '正在刷新…' : when(s.last)),
        h('span', {class: 'set-sub-state'}, h('span', {class: `set-state ${s.ok === false ? 'is-bad' : ''}`}, s.ok === false ? badMark() : okMark(), s.ok === false ? '获取失败：' + (s.error || '') : s.ok ? `正常 · ${s.count || 0} 个日程` : '等待刷新',
          s.status ? h('small', {class: 'mono set-sub-diag', title: '上次联网的结果'}, String(s.status === 'timeout' ? '超时' : s.status === 'error' ? '连不上' : 'HTTP ' + s.status), s.ms != null ? ' · ' + (s.ms / 1000).toFixed(1) + ' 秒' : '') : null),
          h('button', {type: 'button', class: 'set-sub-del', 'data-settings-act': `unsub|${s.id}`, 'aria-label': `移除 ${s.name || '日历'}`}, '移除')),
        h('button', {type: 'button', class: 'set-every', 'data-settings-act': `every|${s.id}`, 'aria-label': '刷新间隔，点一下换'}, `每 ${s.every} 小时`), h('button', {type: 'button', class: 'set-icon', 'data-settings-act': `refresh-sub|${s.id}`, 'aria-label': `立即刷新 ${s.name || '日历'}`}, refreshIcon())))),
      subs.length ? null : h('p', {class: 'set-note'}, '还没有订阅。课程表、个人日程等能导出 iCal 链接的日历都可以加进来，日程会出现在今日页的时间轴上。'),
      row('日程笔记', [h('span', {class: 'set-code'}, FOLDERS.calendar), fold(FOLDERS.calendar, '日程笔记'), note('也可以直接写在这篇笔记里，和订阅的日程一起显示')])]; };
  // ——— 数据、关于 ———
  function dataGroup(): Child{
    const ix = plugin.index, c: [string, string, number][] = [['check', '任务', ix.tasks.size], ['route', '项目', ix.projects.size], ['star', '目标', ix.goals.size], ['star', '想法', ix.ideas.size]];
    const R = S.report, ex = plugin.local.examples || [];
    return [row('索引', [h('span', {class: 'set-counts'}, c.map(([ic, l, n], i) => h('span', null, iconEl(ic, 16), l, h('b', {class: 'mono', 'data-count': n, style: S.rebuilding ? `animation-delay:${i * .25}s` : ''}, n)))), mini('rebuild', [refreshIcon(), h('span', null, '重建')])]),
      row('一致性检查', [mini('check', [iconEl('search', 14), h('span', null, R ? '收起报告' : '检查')]), R ? h('span', {class: 'set-meta'}, '刚刚检查 · 发现 ', h('b', {class: R.total ? 'is-bad' : ''}, R.total), ' 处问题') : null]),
      R ? h('div', {class: 'set-report'}, h('p', {class: 'set-note'}, '报告只读，不修改任何东西。'), R.groups.length ? R.groups.map(([t, list]) => [h('h5', null, t, h('span', {class: 'mono'}, list.length)), h('ul', null, list.map(([text, path]) => h('li', null, h('button', {type: 'button', 'data-settings-act': `openfile|${path}`}, text))))]) : h('p', {class: 'set-meta'}, '没有发现问题。')) : null,
      row('同步冲突副本', [h('span', {class: 'set-meta'}, S.conflicts ? ['刚刚检查 · 发现 ', h('b', {class: S.conflicts.length ? 'is-bad' : ''}, S.conflicts.length), ' 个'] : null), mini('conflicts', [iconEl('search', 14), h('span', null, '查找')])]),
      S.conflicts?.length ? [h('ul', {class: 'set-conflicts'}, S.conflicts.map(x => h('li', null, h('button', {type: 'button', 'data-settings-act': `openfile|${x}`}, x)))), note('只能打开，不在这里删除')] : null,
      row('示例航程', ex.length ? [meta(`已安装 ${ex.length} 篇示例笔记`), mini('confirm|clear-examples', '清除示例')] : meta('没有安装（可以在首次起航里装）'))]; }
  const support = () => {
    const url = supportUrl(plugin.manifest);
    const action: Child = supportQr.paper || url
      ? [h('button', {type: 'button', class: 'set-mini hand-pill set-support-btn', 'data-settings-act': 'support', 'aria-haspopup': supportQr.paper ? 'dialog' : null}, G.heart(), h('span', null, '请近岸喝杯咖啡')), note(supportQr.paper ? '用微信扫码赞赏' : '在浏览器中打开赞赏页')]
      : note('赞赏入口筹备中');
    return row('自愿赞赏', [h('p', {class: 'set-support'}, '如果潮线帮你把今天的推进接上了长远的方向，欢迎请近岸喝杯咖啡。你的支持会用来维护插件和打磨纸本界面。潮线的本地功能免费开放。'), h('div', {class: 'set-support-act'}, action)]);
  };
  const about = () => [row('版本', h('span', {class: 'set-meta mono'}, `潮线 ${plugin.manifest?.version || ''}`)),
    row('重新起航', [mini('voyage', [refreshIcon(), h('span', null, '重新起航')]), note('再走一遍首次起航')])];
  function confirmBox(): Child{
    if (!S.confirm) return null; const [k, ...rest] = S.confirm.split('|');
    const ex = plugin.local.examples || [];
    const text = k === 'del' ? `从清单里拿掉“${items(rest[0] as ListKind)[Number(rest[1])]?.name || ''}”？只是从清单里拿掉，旧日记里的记录都还在。`
      : k === 'clear-chats' ? '清除这台设备上的对话列表？各家代理自己的会话记录不会删除。'
      : `清除 ${ex.length} 篇示例笔记？它们会进 Obsidian 的回收站：${ex.slice(0, 4).join('、')}${ex.length > 4 ? ' …' : ''}`;
    return h('div', {class: 'set-confirm hand-popup', role: 'alertdialog', 'aria-label': '确认'}, h('p', null, text), h('div', null, mini(`yes|${S.confirm}`, '确定'), mini('no', '取消'))); }
  function backdrop(){ const s: Child[] = []; const cx = 1130, cy = 360, R = 150; s.push(circleEl(cx, cy, R, 1.4), circleEl(cx, cy, R - 16, 1), circleEl(cx, cy, 34, 1.3), circleEl(cx, cy, 14, 1.1));
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4 + .2, c = Math.cos(t), n = Math.sin(t); s.push(inkEl([[cx + c * 14, cy + n * 14], [cx + c * (R + 40), cy + n * (R + 40)]], 1.2), inkEl([[cx + c * (R + 40) - n * 6, cy + n * (R + 40) + c * 6], [cx + c * (R + 64), cy + n * (R + 64)], [cx + c * (R + 40) + n * 6, cy + n * (R + 40) - c * 6]], 1.1)); }
    return svg('svg', {class: 'set-backdrop', viewBox: '0 0 1440 900', preserveAspectRatio: 'xMaxYMid slice', 'aria-hidden': 'true'}, svg('g', {opacity: '.14'}, s)); }
  const tabs = () => h('nav', {class: 'set-tabs', role: 'tablist', 'aria-label': '设置分页'}, PAGES.map(([id, label]) => h('button', {type: 'button', role: 'tab', 'data-settings-act': `page|${id}`, 'aria-selected': String(S.page === id)}, label)));
  const aiTabs = () => h('nav', {class: 'set-aitabs', role: 'tablist', 'aria-label': '指引的分页'}, AI_TABS.map(([id, label]) => h('button', {type: 'button', role: 'tab', 'data-settings-act': `aitab|${id}`, 'aria-selected': String(S.aiTab === id)}, label)));
  function pageBody(): Child{ const p = S.page;
    if (p === 'guidance') return group('guidance', G.helm(), '指引（AI 助手）', '按接入的步骤排列；每项后面写明存在哪里', [enableRow(), A().enabled ? [aiTabs(), guidance(S.aiTab)] : null]);
    if (p === 'notes') return group('notes', G.note(), '写在笔记里', `存在 ${CONFIG}，所有设备同步`, notes(), fold(CONFIG, '配置笔记'));
    if (p === 'secret') return group('secret', G.lock(), '日历', '只在这台设备上', secret());
    if (p === 'data') return group('data', G.data(), '数据', '索引、检查与示例', dataGroup());
    if (p === 'about') return [group('support', G.heart(), '支持潮线', '免费开源，靠支持者走得更远', support()), group('about', G.info(), '关于', '版本与首次起航', about())];
    return group('device', G.device(), '这台设备', '存在本机，不同步', device()); }
  const view$ = () => h('div', {class: 'settings-view settings-r27 settings-r30', role: 'region', 'aria-label': '设置'}, backdrop(), h('div', {class: 'set-column'}, tabs(), h('div', {class: 'set-page', 'data-page': S.page}, pageBody())), confirmBox());

  // ——— 显示 ———
  let resetScroll = false;
  function mountSecret(){ for (const slot of root.querySelectorAll<HTMLElement>('.settings-view [data-secret-slot]')) { const id = slot.dataset.secretSlot!, conf = A().providers?.[id]; if (!conf) continue;
    if (!SecretComponent) { slot.textContent = '这个 Obsidian 版本不支持密钥库'; continue; }
    try { const c = new SecretComponent(plugin.app, slot); c.setValue(conf.apiKeySecret || ''); c.onChange(async v => { conf.apiKeySecret = v || ''; await plugin.saveSettings(); }); } catch { slot.textContent = '这个 Obsidian 版本不支持密钥库'; } } }
  // 整张设置纸换成新的一张（原来是 outerHTML 替换；节点、滚动位置、is-still 都与原来一样）
  function refresh(){ const v = $('.settings-view'); if (!v) return; const top = resetScroll ? 0 : (v.querySelector('.set-column')?.scrollTop || 0); resetScroll = false;
    replaceWithNodes(v, view$); const n = $('.settings-view')!; n.classList.add('is-still'); n.querySelector('.set-column')!.scrollTop = top; mountSecret(); view.frames();
    if (S.rename || S.adding) n.querySelector<HTMLInputElement>('.set-inline input')?.focus(); }
  function open(jump?: string){ $('.settings-view')?.remove(); if (jump) S.page = jump; insertNodes($('#sheet')!, 'beforeend', view$); mountSecret(); view.frames(); root.querySelector('.module.settings')?.setAttribute('aria-pressed', 'true'); }
  function close(animated = true){ const v = $('.settings-view'); S.confirm = null; S.menu = null; root.querySelector('.module.settings')?.setAttribute('aria-pressed', 'false'); if (!v) return; if (!animated) { v.remove(); return; } v.classList.add('is-leaving'); setTimeout(() => v.remove(), 200); }
  const isOpen = () => !!$('.settings-view');
  function written(){ S.written = Date.now(); setTimeout(() => { if (Date.now() - S.written >= 1900) $('.set-written')?.remove(); }, 2000); }

  // ——— 写入 ———
  const writeConfig = (fn: (fm: Record<string, unknown>) => void) => plugin.writer.frontmatter(CONFIG, fn).then(() => { written(); setTimeout(refresh, 250); });
  async function setPath(path: string, v: string){
    // 按点分的路径一层层往下走（设备 / Zotero / AI 设置都是普通对象）
    const parts = path.split('.'), scope = parts[0], key = parts.at(-1)!; let obj = (scope === 'device' ? dev() : scope === 'zotero' ? (plugin.local.zotero ??= {on: true, folder: ''}) : A()) as unknown as Record<string, unknown>;
    for (const k of parts.slice(1, -1)) obj = (obj[k] ??= {}) as Record<string, unknown>;
    const next = v === 'toggle' ? !obj[key] : key === 'archiveDays' ? Number(v) : v; obj[key] = next;
    await plugin.saveSettings();
    if (scope === 'device') view.applyDevice?.();
    else if (scope === 'zotero') { await plugin.syncZotero?.(); }
    else if (parts[1] === 'providers') { if (key === 'on' && next) { S.open = parts[2]; S.checking = parts[2]; refresh(); await plugin.detectAI(true, parts[2]); S.checking = null; } plugin.refreshAI(); }
    else { if (key === 'enabled' || key === 'model' || key === 'permission' || key === 'send' || key === 'provider') plugin.refreshAI(); }
  }
  function editLists(key: string, fn: (list: string[]) => string[]){ return writeConfig(fm => {
    const current = (plugin.index.parseConfig(fm).ai as unknown as Record<string, string[]>)[key];
    const ai = (fm.ai ??= {}) as Record<string, unknown>;
    ai[key] = fn([...current]);
  }); }
  function editConfigList(kind: ListKind, fn: (list: ListItem[], nameKey: string) => ListItem[]){ const [, field, nameKey] = LISTS[kind]; return writeConfig(fm => { const cur = configList(kind).map(x => ({id: x.id, [nameKey]: x[nameKey]})); fm[field] = fn(cur, nameKey); }); }
  // 一致性检查（只读）：链接指向不存在的笔记；日记里出现了清单里没有的习惯 / 问题
  function check(){
    const ix = plugin.index, names = new Set(plugin.index.source.files().map(f => f.path.split('/').pop()!.replace(/\.md$/, ''))), groups: [string, [string, string][]][] = [];
    const broken: [string, string][] = [];
    for (const t of ix.tasks.values()) { if (t.project && !names.has(t.project)) broken.push([`${t.path} → [[${t.project}]]`, t.path]); for (const p of t.people) if (!names.has(p)) broken.push([`${t.path} → [[${p}]]`, t.path]); }
    for (const p of ix.projects.values()) for (const k of ['goals', 'people', 'ideas', 'literature'] as const) for (const x of p[k]) if (!names.has(x)) broken.push([`${p.path} → [[${x}]]`, p.path]);
    if (broken.length) groups.push(['链接指向不存在的笔记', broken]);
    const habitIds = new Set(cfg().habits.map(x => x.id)), qIds = new Set(cfg().questions.map(q => q.id)), odd: [string, string][] = [];
    for (const d of ix.days.values()) { const bad = [...Object.keys(d.habits).filter(k => !habitIds.has(k)), ...Object.keys(d.scores).filter(k => !qIds.has(k))]; if (bad.length) odd.push([`${d.path} · ${bad.join('、')}`, d.path]); }
    if (odd.length) groups.push(['日记里有清单里没有的习惯或问题', odd.slice(0, 50)]);
    S.report = {groups, total: groups.reduce((n, g) => n + g[1].length, 0)};
  }
  const findConflicts = () => { S.conflicts = plugin.index.source.files().map(f => f.path).filter(p => /conflict|冲突|Conflicted copy|\s\(\d+\)\.md$/i.test(p)); };

  async function click(e: MouseEvent){
    const b = (e.target as Element).closest<HTMLElement>('[data-set],[data-settings-act]'); if (!b || !b.closest('.settings-view')) return false;
    if (b.dataset.set) { const i = b.dataset.set.lastIndexOf('|'); await setPath(b.dataset.set.slice(0, i), b.dataset.set.slice(i + 1)); refresh(); return true; }
    const [act, ...a] = b.dataset.settingsAct!.split('|');
    if (act === 'page') { S.page = a[0]; S.aiTab = 'vendor'; S.menu = S.rename = S.adding = null; resetScroll = true; }
    else if (act === 'aitab') { S.aiTab = a[0]; resetScroll = true; }
    else if (act === 'card') S.open = S.open === a[0] ? null : a[0];
    else if (act === 'detect') { S.checking = a[0]; refresh(); await plugin.detectAI(true, a[0]); S.checking = null; plugin.refreshAI(); }
    else if (act === 'copy') { void navigator.clipboard?.writeText(a.join('|')); view.frame.feedback('已复制：' + a.join('|')); return true; }
    else if (act === 'menu') S.menu = S.menu === a.join('|') ? null : a.join('|');
    else if (act === 'rename') { S.rename = a.join('|'); S.menu = null; }
    else if (act === 'add') S.adding = S.adding === a[0] ? null : a[0];
    else if (act === 'add-sub') { S.adding = S.adding === 'sub' ? null : 'sub'; S.subError = ''; }
    else if (act === 'every') { await plugin.calendars.setEvery(a[0]); }
    // 立即刷新（0.9.2）：你点的不受退避限制；“正在刷新”旁边按秒计时，结束（成功、失败或 60 秒超时）一定收起
    else if (act === 'refresh-sub') { const s = plugin.calendars.list().find(x => x.id === a[0]); if (s) { S.busy = s.id; S.busyAt = Date.now(); refresh();
      const tick = setInterval(() => { const el = $(`.settings-view [data-sub="${CSS.escape(s.id)}"] .set-last`); if (el && S.busy === s.id) el.textContent = `正在刷新…（${Math.round((Date.now() - S.busyAt!) / 1000)} 秒）`; }, 1000);
      try { await plugin.calendars.refresh(s, {manual: true}); view.frame.feedback(s.ok ? `已刷新：${s.name || '日历'}（${s.count || 0} 个日程）` : `没有刷新成功：${s.error || ''}`); }
      catch (err) { view.frame.feedback('没有刷新成功：' + ((err as Error)?.message || String(err))); }
      finally { clearInterval(tick); S.busy = null; } } }
    else if (act === 'unsub') { const s = plugin.calendars.list().find(x => x.id === a[0]); await plugin.calendars.remove(a[0]); view.frame.feedback(`已移除日历订阅：${s?.name || ''}`); }
    else if (act === 'unlist') { await editLists(a[0], l => l.filter((_, i) => i !== Number(a[1]))); return true; }
    else if (act === 'confirm') { S.confirm = a.join('|'); S.menu = null; }
    else if (act === 'no') S.confirm = null;
    else if (act === 'yes') { const [k, ...r] = a; S.confirm = null;
      if (k === 'del') { await editConfigList(r[0] as ListKind, l => l.filter((_, i) => i !== Number(r[1]))); return true; }
      if (k === 'clear-chats') { plugin.clearAIConversations(); view.frame.feedback('这台设备上的对话列表已清除'); }
      if (k === 'clear-examples') { const ex = plugin.local.examples || []; for (const p of ex) await plugin.writer.trash(p); plugin.local.examples = []; plugin.index.setExamples([]); await plugin.saveSettings(); view.frame.feedback(`已清除 ${ex.length} 篇示例笔记（在 Obsidian 的回收站里）`); } }
    else if (act === 'rebuild') { S.rebuilding = true; refresh(); await plugin.index.rebuild(); setTimeout(() => { S.rebuilding = false; refresh(); }, 1400); return true; }
    else if (act === 'check') { if (S.report) S.report = null; else check(); }
    else if (act === 'conflicts') findConflicts();
    else if (act === 'advanced') S.advanced = !S.advanced;
    else if (act === 'fold' || act === 'openfile') { plugin.writer.open(a.join('|')); return true; }
    else if (act === 'support') {
      if (supportQr.paper) {
        const dialog = root.createEl('dialog', {cls: 'tideline-support-qr', attr: {'aria-label': '微信扫码赞赏'}});
        dialog.createEl('h2', {text: '微信扫码赞赏'});
        dialog.createEl('p', {text: '用手机微信扫一扫，感谢你支持潮线。'});
        for (const [theme, src] of Object.entries(supportQr)) {
          dialog.createEl('img', {attr: {src, alt: '潮线微信赞赏码', 'data-qr-theme': theme}});
        }
        const actions = dialog.createEl('form', {attr: {method: 'dialog'}});
        actions.createEl('button', {text: '关闭', attr: {type: 'submit'}});
        dialog.addEventListener('close', () => {
          dialog.remove();
          if (b.isConnected) b.focus({preventScroll: true});
        }, {once: true});
        dialog.addEventListener('keydown', ev => {
          if (ev.key !== 'Escape') return;
          ev.preventDefault();
          ev.stopPropagation();
          dialog.close();
        });
        dialog.showModal();
      } else {
        const url = supportUrl(plugin.manifest);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }
      return true;
    }
    else if (act === 'voyage') { close(false); view.startVoyage?.(); return true; }
    else if (act === 'go') { close(false); view.go(a[0]); return true; }
    refresh(); return true;
  }
  async function submit(f: HTMLFormElement){
    const k = f.dataset.settingsForm; if (!k) return false; const field = (n: string) => f.elements.namedItem(n) as HTMLInputElement;
    const [t, kind, i] = k.split('|'), v = field('v').value.trim();
    if (t === 'sub') { const url = field('url').value.trim(); if (!url) { field('url').focus(); return true; }
      S.adding = null; S.subError = '';
      // 先当场取一次：失败就写出原因、不加进列表
      try { const cal = await plugin.calendars.fetch(url); const s = await plugin.calendars.add(v || cal.name || '', url, cal.events); view.frame.feedback(`已添加日历订阅：${s.name}（${cal.events!.length} 个日程）`); }
      catch (e) { S.subError = '没有添加：' + ((e as Error)?.message || String(e)); S.adding = 'sub'; }
      refresh(); return true; }
    S.rename = null; S.adding = null;
    if (t === 'rename' && v) await editConfigList(kind as ListKind, (l, nameKey) => { l[Number(i)][nameKey] = v; return l; });
    else if (t === 'add' && v) await editConfigList(kind as ListKind, (l, nameKey) => { const base = LISTS[kind as ListKind][3]; let n = l.length + 1; while (l.some(x => x.id === base + n)) n++; l.push({id: base + n, [nameKey]: v}); return l; });
    else if (t === 'list' && v) await editLists(kind, l => l.includes(v) ? l : [...l, v]);
    else if (t === 'pcmd' || t === 'pargs' || t === 'pname') { const conf = A().providers[kind]; conf[({pcmd: 'command', pargs: 'args', pname: 'name'} as const)[t]] = v; await plugin.saveSettings();
      if (t !== 'pname') { S.checking = kind; refresh(); await plugin.detectAI(true, kind); S.checking = null; } plugin.refreshAI(); refresh(); }
    else if (t === 'zfolder') { (plugin.local.zotero ??= {on: true, folder: ''}).folder = v.replace(/\/+$/, ''); await plugin.saveSettings(); await plugin.syncZotero?.(); refresh(); }
    else if (t === 'inbox' && v) { A().saveFolder = v.replace(/\/?$/, '/'); await plugin.saveSettings(); refresh(); }
    else refresh();
    return true;
  }
  // 拖动一行的把手排序；顺序写进配置笔记
  let dragged: string | null = null;
  function dragstart(e: DragEvent){ const li = (e.target as Element).closest?.<HTMLElement>('.settings-view [data-item]'); if (!li) return false; dragged = li.dataset.item!; e.dataTransfer!.effectAllowed = 'move'; return true; }
  async function drop(e: DragEvent){ const li = (e.target as Element).closest?.<HTMLElement>('.settings-view [data-item]'); if (!li || !dragged) return false; e.preventDefault(); const [k1, i1] = dragged.split('|'), [k2, i2] = li.dataset.item!.split('|'); dragged = null;
    if (k1 !== k2 || i1 === i2) return true; await editConfigList(k1 as ListKind, l => { const [it] = l.splice(Number(i1), 1); l.splice(Number(i2), 0, it); return l; }); return true; }
  view.registerDomEvent(root, 'click', e => { const b = (e.target as Element).closest('[data-set],[data-settings-act]'); if (b?.closest('.settings-view')) { e.stopPropagation(); void click(e); } }, {capture: true});
  view.registerDomEvent(root, 'submit', e => { if ((e.target as Element).closest('.settings-view')) { e.preventDefault(); e.stopImmediatePropagation(); void submit(e.target as HTMLFormElement); } }, {capture: true});
  view.registerDomEvent(root, 'dragstart', e => dragstart(e), {capture: true});
  view.registerDomEvent(root, 'dragover', e => { if (dragged && (e.target as Element).closest?.('.settings-view [data-item]')) e.preventDefault(); });
  view.registerDomEvent(root, 'drop', e => { void drop(e); }, {capture: true});
  // Esc 关上设置：焦点不一定在插件视图里（点完选项后常在别处），所以挂在整个窗口上，只在设置开着时管
  view.registerDomEvent(document, 'keydown', e => { if (e.key === 'Escape' && root.isConnected && isOpen() && !(e.target as Element).closest?.('input,textarea,.tideline-support-qr')) { e.preventDefault(); close(); } });
  return {open, close, refresh, isOpen, ask(k: string){ S.confirm = k; refresh(); }, toggle(){ if (isOpen()) close(); else open(); }};
}
