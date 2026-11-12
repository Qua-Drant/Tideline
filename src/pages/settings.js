// 潮线自己的设置页（设计说明第 21 节；画面照原型 paper-settings-r30.js：同样的标记与类名，样式由 prototype.css 接管）。
// 原型的设置页全是示例状态（假的供应商、假的日历订阅、假的检查报告）；这里每一项都读写真实的东西：
//   设备：只存在这台设备上（plugin.local，Obsidian 的本机存储）——字号、配色、过场、打开时停在、习惯旁的最近 7 天
//   指引：AI 助手（本机）；三张保护名单写在 潮线/配置.md（所有设备一样）
//   笔记：习惯、每日问题、生命之轮领域三张清单，改了就写进 潮线/配置.md
//   日历（0.9.3 前叫“私密”）：日历订阅（地址与取回的日程只在这台设备上，见 data/calendar.js），日程笔记
//   数据：索引计数与重建、一致性检查（只读）、同步冲突副本、示例航程；关于：版本、重新起航
// 改了就生效，没有“保存”按钮；写进笔记的改动旁边淡入“已写入”。
import {PRESETS, PROVIDERS} from '../ai/acp.js';
import {providerName, modelsOf, defaultModelOf} from './ai.js';
import {SecretComponent} from 'obsidian';
import {ink, circle, icon, esc} from '../draw/ink.js';
import {FOLDERS} from '../data/index.js';
import {supportQr, supportUrl} from '../support.js';

const SVG = (s, w = 20, h = w) => `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${s}</svg>`;
const PAGES = [['device', '设备'], ['guidance', '指引'], ['notes', '笔记'], ['secret', '日历'], ['data', '数据'], ['about', '关于']];
const AI_TABS = [['vendor', '供应商'], ['guard', '权限与保护'], ['context', '上下文'], ['chat', '对话']];
const CONFIG = FOLDERS.config;

export function createSettingsPage({view, plugin}){
  const root = view.root, $ = s => root.querySelector(s);
  const S = {page: 'device', aiTab: 'vendor', confirm: null, menu: null, rename: null, adding: null, written: 0, report: null, rebuilding: false, conflicts: null, open: 'claude'};
  const dev = () => plugin.local.device, A = () => plugin.local.ai;
  const cfg = () => plugin.index.config;
  const where = t => `<i class="set-where" data-where="${t}">${t}</i>`;
  const seg = (path, options, cur) => `<span class="set-seg" role="radiogroup">${options.map(([v, l]) => `<button type="button" role="radio" data-set="${path}|${v}" aria-checked="${String(cur) === String(v)}">${l}</button>`).join('')}</span>`;
  const mark = (path, on, label) => `<button type="button" class="set-mark" role="switch" data-set="${path}|toggle" aria-checked="${!!on}" aria-label="${label}">${SVG(on ? `<circle cx="10" cy="10" r="5.2" fill="#1C2A35"/>` : circle(10, 10, 5.2, 1.3), 20)}<span>${on ? '开' : '关'}</span></button>`;
  const row = (label, body, tag = '') => `<div class="set-row"><span class="set-label">${label}${tag ? where(tag) : ''}</span><div class="set-body">${body}</div></div>`;
  const fold = (path, label) => `<button type="button" class="set-fold" data-settings-act="fold|${esc(path)}" aria-label="打开 ${esc(label)}">${SVG(ink([[3, 3], [15, 3], [15, 15], [10, 10], [15, 10]], 1.1), 18)}</button>`;
  const group = (id, ic, title, scope, body, extra = '') => `<section class="set-group" data-group="${id}"><header>${ic}<h3>${title}</h3><p>${scope}</p>${extra}${S.written && Date.now() - S.written < 2000 ? '<span class="set-written">已写入</span>' : ''}</header><div class="set-rows">${body}</div></section>`;
  const G = {device: SVG(ink([[3, 5], [17, 5], [17, 14], [3, 14], [3, 5]], 1.2) + ink([[1, 16.5], [19, 16.5]], 1.3)),
    helm: SVG(circle(10, 10, 6, 1.2) + circle(10, 10, 2, 1) + [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const t = i * Math.PI / 4; return ink([[10 + Math.cos(t) * 2, 10 + Math.sin(t) * 2], [10 + Math.cos(t) * 9, 10 + Math.sin(t) * 9]], 1); }).join('')),
    note: SVG(ink([[4, 2], [13, 2], [16, 5], [16, 18], [4, 18], [4, 2]], 1.2) + ink([[7, 8], [13, 8]], 1) + ink([[7, 12], [13, 12]], 1)),
    lock: SVG(ink([[4, 9], [16, 9], [16, 18], [4, 18], [4, 9]], 1.2) + ink([[6.5, 9], [6.5, 5.5], [10, 2.5], [13.5, 5.5], [13.5, 9]], 1.2)),
    data: SVG(ink([[3, 5], [10, 2.5], [17, 5], [10, 7.5], [3, 5]], 1.1) + ink([[3, 5], [3, 15], [10, 17.5], [17, 15], [17, 5]], 1.1) + ink([[3, 10], [10, 12.5], [17, 10]], 1)),
    heart: SVG(ink([[10, 16.5], [4.2, 11], [3, 7.6], [4.6, 4.6], [7.6, 4], [10, 6.4], [12.4, 4], [15.4, 4.6], [17, 7.6], [15.8, 11], [10, 16.5]], 1.3)),
    info: SVG(circle(10, 10, 8, 1.2) + ink([[10, 9], [10, 14.5]], 1.4) + circle(10, 6, .8, 1))};
  const refreshIcon = SVG(ink([[15, 6], [13, 4], [9, 3], [5, 5], [3, 9], [4, 13], [7, 16], [11, 17], [15, 15], [17, 11]], 1.1) + ink([[15, 2], [15, 6], [11, 6]], 1.1));
  const okIcon = SVG(circle(8, 8, 6, 1) + ink([[5, 8], [7.5, 10.5], [11.5, 5.5]], 1.1), 16), badIcon = SVG(circle(8, 8, 6, 1, '#B23A48') + ink([[8, 4.5], [8, 9]], 1.3, '#B23A48') + circle(8, 11.5, .6, 1, '#B23A48'), 16);

  // ——— 设备 ———
  function device(){ const D = dev();
    return row('字号', seg('device.font', [['.92', '小'], ['1', '标准'], ['1.1', '大'], ['1.2', '特大']], D.font) + '<small class="set-note">整个界面的文字一起放大或缩小，排版位置不变</small>')
      + row('配色', seg('device.theme', [['obsidian', '跟随 Obsidian'], ['paper', '纸'], ['night', '夜航']], D.theme))
      + row('过场', seg('device.motion', [['brief', '滑动'], ['off', '关闭']], D.motion) + '<small class="set-note">换页时纸面上下滑动。系统开了“减少动态效果”时固定为关闭</small>')
      + row('打开时停在', seg('device.start', [['last', '上次所在的页'], ['today', '今日']], D.start))
      + row('习惯旁的最近 7 天', mark('device.week', D.week, '习惯旁的最近 7 天'))
      + row('悬停功能提示', mark('device.tooltips', D.tooltips, '悬停功能提示'), '本机'); }
  // ——— 指引（AI 助手）———
  function enableRow(){ return row('启用 AI 助手', mark('ai.enabled', A().enabled, '启用 AI 助手') + '<small class="set-note">关掉后指引页只留桅顶和提示词库，不启动程序、不联网。开启后，对话里提到的、AI 读到的笔记内容会经由你选的 ACP 代理发给对应的服务商（Claude Agent → Anthropic，Codex → OpenAI，Gemini CLI → Google，CodeBuddy → 腾讯云，DeepSeek Harness → DeepSeek）。</small>', '本机'); }
  // 每家的默认模型：清单是代理自己报的（点“检查”时读）；“代理默认”= 不改它自己的默认
  function modelRow(id, checking){
    const ms = modelsOf(plugin, id), cur = defaultModelOf(plugin, id);
    if (!ms?.length) return `<span class="set-meta">${checking ? '正在读取模型清单…' : '还没读到模型清单'}</span><button type="button" class="set-mini hand-pill" data-settings-act="detect|${id}">${refreshIcon}<span>读取</span></button><small class="set-note">读取时会让代理开一个空会话，不发消息、不花用量</small>`;
    const opts = [['', '代理默认'], ...ms.map(m => [m.value, esc(m.name)])];
    return `<span class="set-seg set-models">${opts.map(([v, l]) => `<button type="button" role="radio" data-set="ai.providers.${id}.model|${esc(v)}" aria-checked="${String(cur) === String(v) || (!cur && !v)}">${l}</button>`).join('')}</span><small class="set-note">指引页的模型菜单里也可以为一段对话另选</small>`;
  }
  function guidance(tab){
    const a = A(); if (!a.enabled) return '';
    if (tab === 'vendor') {
      // 0.3：经 ACP（Agent Client Protocol）接入。每家一张卡：开关、启动命令与参数、安装与登录办法、API 密钥、握手检查
      const P = a.providers || {}, on = PROVIDERS.filter(id => P[id]?.on), name = id => providerName(plugin, id);
      let o = `<h4 class="set-sub">供应商</h4>` + row('接入方式', '<span class="set-meta">ACP 客户端：在这台电脑上启动各家的 ACP 代理程序，代理与登录都由你自己安装和保存</span>', '本机')
        + row('默认供应商', on.length ? seg('ai.provider', on.map(id => [id, name(id)]), on.includes(a.provider) ? a.provider : on[0]) : '<span class="set-meta">先在下面打开一家</span>', '本机')
        + row('默认思考强度', seg('ai.effort', [['low', '低'], ['medium', '中'], ['high', '高'], ['xhigh', '很高'], ['max', '最高']], a.effort) + '<small class="set-note">代理支持时生效</small>', '本机');
      o += '<ul class="set-cards">' + PROVIDERS.map(id => {
        const conf = P[id] || {}, info = plugin.aiProviderInfo(id), st = plugin.ai.status?.[id], open = S.open === id, checking = S.checking === id;
        const state = !conf.on ? '<span>关</span>' : checking ? '<span>检查中…</span>' : !st ? '<span>还没检查</span>' : !st.ok ? `<span class="is-bad">${esc(st.error || '没有回应')}</span>` : `<span>${esc(st.name || '')}</span><span class="mono">${esc(st.version || '')}</span>`;
        return `<li class="set-provider hand-panel ${open ? 'is-open' : ''}"><div class="sp-head"><button type="button" class="sp-name" data-settings-act="card|${id}" aria-expanded="${open}">${SVG(ink(open ? [[5, 8], [10, 13], [15, 8]] : [[8, 5], [13, 10], [8, 15]], 1.2), 16)}<b>${esc(name(id))}</b></button>${mark(`ai.providers.${id}.on`, conf.on, '启用 ' + name(id))}<span class="sp-state">${state}</span></div>`
          + (open ? '<div class="sp-body">'
            + (id === 'custom' ? row('名称', `<form class="set-inline" data-settings-form="pname|${id}"><input name="v" value="${esc(conf.name || '')}" placeholder="在模型菜单里显示的名字" aria-label="名称"></form>`, '本机') : '')
            + row('启动命令', `<form class="set-inline" data-settings-form="pcmd|${id}"><input name="v" class="mono" value="${esc(conf.command || '')}" placeholder="${esc(PRESETS[id].command || '命令或程序路径')}" aria-label="启动命令"></form><button type="button" class="set-mini hand-pill" data-settings-act="detect|${id}">${refreshIcon}<span>检查</span></button>${st?.path ? `<small class="set-note mono">${esc(st.path)}</small>` : ''}`, '本机')
            + row('参数', `<form class="set-inline" data-settings-form="pargs|${id}"><input name="v" class="mono" value="${esc(conf.args || '')}" placeholder="${esc(PRESETS[id].args.join(' ') || '没有')}" aria-label="参数"></form>`, '本机')
            + (conf.on ? row('默认模型', modelRow(id, checking), '本机') : '')
            + (info.install ? row('安装', `<span class="set-code">${esc(info.install)}</span><button type="button" class="set-mini hand-pill" data-settings-act="copy|${esc(info.install)}">复制</button>`, '终端')
              : info.unverified?.install ? row('安装', `<span class="set-meta" data-unverified="install">${esc(info.unverified.install)}</span>`, '未验证') : '')
            + (info.login ? row('登录', `<span class="set-code">${esc(info.login)}</span><button type="button" class="set-mini hand-pill" data-settings-act="copy|${esc(info.login)}">复制</button><small class="set-note">用它自己的登录，凭据不经过潮线</small>`, '各家程序自己保存') : '')
            + (info.keyEnv ? row('API 密钥（可选）', `<span class="set-secret" data-secret-slot="${id}"></span><small class="set-note">填了就按 API 用量计费（作为 ${esc(info.keyEnv)} 交给代理）；存在 Obsidian 的密钥库里，不同步</small>${info.unverified?.keyEnv ? `<small class="set-note is-warn" data-unverified="keyEnv">${esc(info.unverified.keyEnv)}</small>` : ''}`, '私密') : '')
            + row('数据去向', `<span class="set-meta">对话里提到的、代理读到的笔记内容会发给 ${esc(info.vendor || '这个代理对应的服务')}</span>`, '')
            + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
      return o;
    }
    const L = cfg().ai, chips = (list, key) => (list.length ? list.map((x, i) => `<span class="set-chip hand-pill mono">${esc(x)}<button type="button" class="set-chip-x" data-settings-act="unlist|${key}|${i}" aria-label="从名单里拿掉 ${esc(x)}">×</button></span>`).join('') : '<span class="set-meta">空</span>')
      + (S.adding === key ? `<form class="set-inline" data-settings-form="list|${key}"><input name="v" class="mono" placeholder="文件夹以 / 结尾，或一篇笔记的路径" aria-label="新增"></form>` : `<button type="button" class="set-add" data-settings-act="add|${key}" aria-label="新增">${icon('plus', 16)}</button>`);
    if (tab === 'guard') return row('默认权限', seg('ai.permission', [['read', '只读'], ['confirm', '改前确认'], ['auto', '自动接受改动']], a.permission) + (a.permission === 'auto' ? '<small class="set-note is-warn">只限“允许直接改的文件夹”；指引页桅顶会插一面警示小旗</small>' : '<small class="set-note">不提供“全部放行”；对话里还能就地换</small>'), '本机')
      + row('读取前先问我', chips(L.askRead, 'askRead'), '同步') + row('不能改的位置', chips(L.noWrite, 'noWrite'), '同步') + row('允许直接改的文件夹', chips(L.autoWrite, 'autoWrite'), '同步')
      // P2-4：如实写出各家由谁拦。潮线只能在代理发来许可请求（或请潮线代读代写文件）时按三档与名单决定；代理自己直接读写时拦不到
      + row('由谁来拦', '<ul class="set-note set-guard-who" data-guard-who>'
        + '<li><b>Claude Agent</b>：三档权限、“读取前先问”“不能改”由潮线交给它运行的 Claude Code 当规则执行，它自己读写文件时也会先问或拒绝；对照卡由潮线出。</li>'
        + '<li><b>Codex、CodeBuddy</b>：开对话时潮线把代理切到“改动先问”的模式，改动、运行命令经潮线的三档与名单决定；代理自己读文件通常不问，“读取前先问”不一定拦得到。</li>'
        + '<li><b>Gemini CLI、DeepSeek Harness、自定义</b>：只有代理主动请求许可、或请潮线代读代写文件时才拦得到；其余取决于代理自己的设置。</li>'
        + '</ul>', '')
      + row('改动可以回退', '<span class="set-meta">经 ACP 接入时，代理改过的文件不能由潮线还原；改前改后的对照卡仍会先问你</span>', '本机');
    if (tab === 'context') { const mcp = view.lower?.ai?.mcp?.() || [];
      return row('自动附带当前页的内容', mark('ai.attach', a.attach, '自动附带当前页的内容') + '<small class="set-note">日记正文不会自动附带</small>', '本机')
        + row('工作说明', `<span class="set-code">CLAUDE.md · AGENTS.md</span>${plugin.writer.exists?.('CLAUDE.md') ? fold('CLAUDE.md', '工作说明') : '<small class="set-note">仓库里还没有这两篇</small>'}`, '仓库本身')
        + row('技能与命令', '<span class="set-code">.claude/skills/ · .claude/commands/</span><small class="set-note">对话里输入 / 列出</small>', '同步')
        + row('MCP 服务', mcp.length ? mcp.map(m => `<span class="set-chip hand-pill">${esc(m.name.replace(/^claude\.ai /, ''))} · ${({connected: '已连接', failed: '连不上', 'needs-auth': '要登录', pending: '连接中', disabled: '关了'})[m.status] || esc(m.status)}</span>`).join('') + '<small class="set-note">用之前都会先问你</small>' : '<span class="set-meta">发出第一句话后显示</span>', '各家程序'); }
    return row('发送方式', seg('ai.send', [['enter', '回车发送'], ['mod', 'Ctrl + 回车发送']], a.send), '本机')
      + row('自动归档', seg('ai.archiveDays', [[7, '7 天'], [30, '30 天'], [90, '90 天'], [0, '不归档']], a.archiveDays), '本机')
      + row('清除对话列表', `<button type="button" class="set-mini hand-pill" data-settings-act="confirm|clear-chats">清除</button><small class="set-note">只清除这台设备上的列表；各家代理自己的会话记录不会删除</small>`, '本机')
      + row('存成笔记放在哪', S.rename === 'inbox' ? `<form class="set-inline" data-settings-form="inbox"><input name="v" class="mono" value="${esc(a.saveFolder)}" aria-label="文件夹"></form>` : `<span class="set-code">${esc(a.saveFolder)}</span><button type="button" class="set-mini hand-pill" data-settings-act="rename|inbox">改</button>`, '本机');
  }
  // ——— 笔记：三张清单 ———
  const LISTS = {habits: ['习惯', 'habits', 'name', 'habit_'], questions: ['每日问题', 'questions', 'title', 'question_'], wheel: ['生命之轮领域', 'areas', 'title', 'area_']};
  const items = kind => (cfg()[LISTS[kind][1]] || []).map(x => ({key: x.id, name: x[LISTS[kind][2]]}));
  function editList(kind, ic){ const [title] = LISTS[kind], L = items(kind);
    return `<div class="set-list hand-panel" data-list="${kind}"><header>${ic}<b>${title}</b><span class="mono">${L.length} 项</span><button type="button" class="set-add" data-settings-act="add|${kind}" aria-label="新增${title}">${icon('plus', 16)}</button></header><ol>${L.map((x, i) => `<li draggable="true" data-item="${kind}|${i}">${SVG(ink([[5, 7], [15, 7]], 1) + ink([[5, 10], [15, 10]], 1) + ink([[5, 13], [15, 13]], 1))}${S.rename === kind + '|' + i ? `<form class="set-inline" data-settings-form="rename|${kind}|${i}"><input name="v" value="${esc(x.name)}" aria-label="改名"></form>` : `<span class="set-name">${esc(x.name)}</span>`}<span class="set-key mono">${esc(x.key)}</span><button type="button" class="set-more" data-settings-act="menu|${kind}|${i}" aria-label="更多">⋯</button>${S.menu === kind + '|' + i ? `<span class="set-menu hand-popup"><button type="button" data-settings-act="rename|${kind}|${i}">改名</button><button type="button" data-settings-act="confirm|del|${kind}|${i}">删除</button></span>` : ''}</li>`).join('')}</ol>${S.adding === kind ? `<form class="set-inline set-add-form" data-settings-form="add|${kind}"><input name="v" placeholder="名称" aria-label="新增${title}"></form>` : ''}</div>`; }
  // Zotero 文献（0.7）：接 Zotero Integration 插件，读它导进来的文献笔记
  function zoteroRow(){
    const z = plugin.zotero?.(); if (!z) return '';
    const Z = plugin.local.zotero || {}, n = [...plugin.index.literature.values()].filter(x => x.source === 'zotero').length;
    const state = !z.installed && !Z.folder ? '<span class="set-meta">没有找到 Zotero Integration 插件。装上并启用后，它导进来的文献会出现在知识库里</span>'
      : !z.enabled && !Z.folder ? '<span class="set-meta">Zotero Integration 已安装，没有启用</span>'
      : `<span class="set-meta">${Z.on === false ? '没有接入' : z.folders.length ? `读取 ${z.folders.map(f => esc(f) + '/').join('、')} · ${n} 篇文献` : '没有找到导入文件夹，可以在下面填'}</span>`;
    return row('Zotero 文献', (z.installed || Z.folder ? mark('zotero.on', Z.on !== false, '接入 Zotero 文献') : '') + state
      + `<small class="set-note">文献笔记由 Zotero Integration 按它的模板导入（知识库页的“Zotero”按钮调它的导入命令）；潮线读作者、年份、标签、摘要和标注，在 Zotero 里打开 PDF</small>`)
      + (z.installed || Z.folder ? row('导入文件夹', `<form class="set-inline" data-settings-form="zfolder"><input name="v" class="mono" value="${esc(Z.folder || '')}" placeholder="${esc(z.found.join('、') || '跟随 Zotero Integration 的设置')}" aria-label="Zotero 导入文件夹"></form><small class="set-note">留空就用 Zotero Integration 设置里的</small>`) : '');
  }
  function notes(){
    const qIcon = SVG(circle(10, 10, 7.5, 1.1) + ink([[7.5, 7.5], [8.5, 5.6], [10, 5], [11.6, 5.6], [12.4, 7.5], [10, 10], [10, 11.8]], 1) + circle(10, 14.4, .6, 1)), wIcon = SVG(circle(10, 10, 7.5, 1.1) + circle(10, 10, 1.6, 1) + ink([[10, 2.5], [10, 17.5]], .9) + ink([[2.5, 10], [17.5, 10]], .9));
    return `<div class="set-lists">${editList('habits', icon('check', 18))}${editList('questions', qIcon)}${editList('wheel', wIcon)}</div><small class="set-note">属性名创建后不能改，否则旧日记里的记录会对不上；删除只是从清单里拿掉，旧日记里的记录都还在。拖动可以排序。</small>`
      + zoteroRow()
      + row('任务清单', cfg().lists.filter(l => !l.archived).map(l => `<button type="button" class="set-chip hand-pill" data-settings-act="go|tasks">${esc(l.title)}</button>`).join('') + '<small class="set-note">在任务页（货舱）管理</small>')
      + `<button type="button" class="set-line" data-settings-act="advanced" aria-expanded="${!!S.advanced}">${icon('settings', 18)}<b>高级</b><span>各类笔记放在哪个文件夹、日记里各个标题的名字</span>${SVG(ink(S.advanced ? [[5, 12], [10, 7], [15, 12]] : [[5, 8], [10, 13], [15, 8]], 1.2), 18)}</button>`
      + (S.advanced ? `<dl class="set-adv">${[['日记', FOLDERS.journal + '/'], ['任务', FOLDERS.tasks + '/'], ['项目', FOLDERS.projects + '/'], ['人物', FOLDERS.people + '/'], ['目标', FOLDERS.goals + '/'], ['想法', FOLDERS.ideas + '/'], ['文献', FOLDERS.literature + '/'], ['书籍', FOLDERS.books + '/'], ['随手记标题', '## 随手记'], ['配置笔记', CONFIG + ' ' + fold(CONFIG, '配置笔记')]].map(([t, v]) => `<div><dt>${t}</dt><dd class="mono">${v.includes('<') ? v : esc(v)}</dd></div>`).join('')}</dl><small class="set-note">文件夹名暂时不能改（以后放进设置）。</small>` : ''); }
  // ——— 私密 ———
  // 日历订阅（画面照原型 secret()：名称、隐藏的地址、上次刷新、状态、刷新间隔、立即刷新；原型没有删除，这里在状态后面加一个“移除”）
  const okMark = SVG(circle(8, 8, 6, 1) + ink([[5, 8], [7.5, 10.5], [11.5, 5.5]], 1.1), 16), badMark = SVG(circle(8, 8, 6, 1, '#B23A48') + ink([[8, 4.5], [8, 9]], 1.3, '#B23A48') + circle(8, 11.5, .6, 1, '#B23A48'), 16);
  const when = iso => { if (!iso) return '还没刷新'; const t = new Date(iso), n = new Date(), hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return t >= d0 ? '今天 ' + hm : t >= d0 - 86400000 ? '昨天 ' + hm : `${t.getMonth() + 1}月${t.getDate()}日 ${hm}`; };
  const secret = () => { const subs = plugin.calendars?.list() || [];
    return `<div class="set-subs-head"><b>日历订阅</b><button type="button" class="set-mini hand-pill" data-settings-act="add-sub">${icon('plus', 14)}<span>添加</span></button></div>`
      + `<p class="set-note set-sub-note">地址只保存在这台设备上，每台设备要各自添加。</p>`
      + (S.adding === 'sub' ? `<form class="set-inline set-sub-add" data-settings-form="sub"><input name="v" placeholder="名称" aria-label="订阅名称"><input name="url" placeholder="粘贴 iCal 地址" aria-label="iCal 地址"><button type="submit" class="set-mini hand-pill">添加</button></form>` : '')
      + (S.subError ? `<p class="set-note is-bad">${esc(S.subError)}</p>` : '')
      + `<ul class="set-subs">${subs.map(s => `<li data-sub="${esc(s.id)}">${SVG(ink([[3, 5], [17, 5], [17, 17], [3, 17], [3, 5]], 1) + ink([[3, 8], [17, 8]], .9), 20)}<b>${esc(s.name || '日历')}</b><span class="mono set-mask" title="地址已隐藏">••••••</span><span class="set-last">${S.busy === s.id ? '正在刷新…' : when(s.last)}</span>`
        + `<span class="set-sub-state"><span class="set-state ${s.ok === false ? 'is-bad' : ''}">${s.ok === false ? badMark : okMark}${s.ok === false ? '获取失败：' + esc(s.error || '') : s.ok ? `正常 · ${s.count || 0} 个日程` : '等待刷新'}${s.status ? `<small class="mono set-sub-diag" title="上次联网的结果">${esc(String(s.status === 'timeout' ? '超时' : s.status === 'error' ? '连不上' : 'HTTP ' + s.status))}${s.ms != null ? ' · ' + (s.ms / 1000).toFixed(1) + ' 秒' : ''}</small>` : ''}</span><button type="button" class="set-sub-del" data-settings-act="unsub|${esc(s.id)}" aria-label="移除 ${esc(s.name || '日历')}">移除</button></span>`
        + `<button type="button" class="set-every" data-settings-act="every|${esc(s.id)}" aria-label="刷新间隔，点一下换">每 ${s.every} 小时</button><button type="button" class="set-icon" data-settings-act="refresh-sub|${esc(s.id)}" aria-label="立即刷新 ${esc(s.name || '日历')}">${refreshIcon}</button></li>`).join('')}</ul>`
      + (subs.length ? '' : '<p class="set-note">还没有订阅。课程表、个人日程等能导出 iCal 链接的日历都可以加进来，日程会出现在今日页的时间轴上。</p>')
      + row('日程笔记', `<span class="set-code">${esc(FOLDERS.calendar)}</span>${fold(FOLDERS.calendar, '日程笔记')}<small class="set-note">也可以直接写在这篇笔记里，和订阅的日程一起显示</small>`); };
  // ——— 数据、关于 ———
  function dataGroup(){
    const ix = plugin.index, c = [['check', '任务', ix.tasks.size], ['route', '项目', ix.projects.size], ['star', '目标', ix.goals.size], ['star', '想法', ix.ideas.size]];
    const R = S.report, ex = plugin.local.examples || [];
    return row('索引', `<span class="set-counts">${c.map(([ic, l, n], i) => `<span>${icon(ic, 16)}${l}<b class="mono" data-count="${n}" style="${S.rebuilding ? `animation-delay:${i * .25}s` : ''}">${n}</b></span>`).join('')}</span><button type="button" class="set-mini hand-pill" data-settings-act="rebuild">${refreshIcon}<span>重建</span></button>`)
      + row('一致性检查', `<button type="button" class="set-mini hand-pill" data-settings-act="check">${icon('search', 14)}<span>${R ? '收起报告' : '检查'}</span></button>${R ? `<span class="set-meta">刚刚检查 · 发现 <b class="${R.total ? 'is-bad' : ''}">${R.total}</b> 处问题</span>` : ''}`)
      + (R ? `<div class="set-report"><p class="set-note">报告只读，不修改任何东西。</p>${R.groups.length ? R.groups.map(([t, list]) => `<h5>${esc(t)}<span class="mono">${list.length}</span></h5><ul>${list.map(([text, path]) => `<li><button type="button" data-settings-act="openfile|${esc(path)}">${esc(text)}</button></li>`).join('')}</ul>`).join('') : '<p class="set-meta">没有发现问题。</p>'}</div>` : '')
      + row('同步冲突副本', `<span class="set-meta">${S.conflicts ? `刚刚检查 · 发现 <b class="${S.conflicts.length ? 'is-bad' : ''}">${S.conflicts.length}</b> 个` : ''}</span><button type="button" class="set-mini hand-pill" data-settings-act="conflicts">${icon('search', 14)}<span>查找</span></button>`)
      + (S.conflicts?.length ? `<ul class="set-conflicts">${S.conflicts.map(x => `<li><button type="button" data-settings-act="openfile|${esc(x)}">${esc(x)}</button></li>`).join('')}</ul><small class="set-note">只能打开，不在这里删除</small>` : '')
      + row('示例航程', ex.length ? `<span class="set-meta">已安装 ${ex.length} 篇示例笔记</span><button type="button" class="set-mini hand-pill" data-settings-act="confirm|clear-examples">清除示例</button>` : '<span class="set-meta">没有安装（可以在首次起航里装）</span>'); }
  const support = () => {
    const url = supportUrl(plugin.manifest);
    const action = supportQr.paper || url
      ? `<button type="button" class="set-mini hand-pill set-support-btn" data-settings-act="support"${supportQr.paper ? ' aria-haspopup="dialog"' : ''}>${G.heart}<span>请近岸喝杯咖啡</span></button><small class="set-note">${supportQr.paper ? '用微信扫码赞赏' : '在浏览器中打开赞赏页'}</small>`
      : '<small class="set-note">赞赏入口筹备中</small>';
    return row('自愿赞赏', `<p class="set-support">如果潮线帮你把今天的推进接上了长远的方向，欢迎请近岸喝杯咖啡。你的支持会用来维护插件和打磨纸本界面。潮线的本地功能免费开放。</p><div class="set-support-act">${action}</div>`);
  };
  const about = () => row('版本', `<span class="set-meta mono">潮线 ${esc(plugin.manifest?.version || '')}</span>`)
    + row('重新起航', `<button type="button" class="set-mini hand-pill" data-settings-act="voyage">${refreshIcon}<span>重新起航</span></button><small class="set-note">再走一遍首次起航</small>`);
  function confirmBox(){
    if (!S.confirm) return ''; const [k, ...rest] = S.confirm.split('|');
    const ex = plugin.local.examples || [];
    const text = k === 'del' ? `从清单里拿掉“${esc(items(rest[0])[rest[1]]?.name || '')}”？只是从清单里拿掉，旧日记里的记录都还在。`
      : k === 'clear-chats' ? '清除这台设备上的对话列表？各家代理自己的会话记录不会删除。'
      : `清除 ${ex.length} 篇示例笔记？它们会进 Obsidian 的回收站：${esc(ex.slice(0, 4).join('、'))}${ex.length > 4 ? ' …' : ''}`;
    return `<div class="set-confirm hand-popup" role="alertdialog" aria-label="确认"><p>${text}</p><div><button type="button" class="set-mini hand-pill" data-settings-act="yes|${esc(S.confirm)}">确定</button><button type="button" class="set-mini hand-pill" data-settings-act="no">取消</button></div></div>`; }
  function backdrop(){ let s = ''; const cx = 1130, cy = 360, R = 150; s += circle(cx, cy, R, 1.4) + circle(cx, cy, R - 16, 1) + circle(cx, cy, 34, 1.3) + circle(cx, cy, 14, 1.1);
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4 + .2, c = Math.cos(t), n = Math.sin(t); s += ink([[cx + c * 14, cy + n * 14], [cx + c * (R + 40), cy + n * (R + 40)]], 1.2) + ink([[cx + c * (R + 40) - n * 6, cy + n * (R + 40) + c * 6], [cx + c * (R + 64), cy + n * (R + 64)], [cx + c * (R + 40) + n * 6, cy + n * (R + 40) - c * 6]], 1.1); }
    return `<svg class="set-backdrop" viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><g opacity=".14">${s}</g></svg>`; }
  const tabs = () => `<nav class="set-tabs" role="tablist" aria-label="设置分页">${PAGES.map(([id, label]) => `<button type="button" role="tab" data-settings-act="page|${id}" aria-selected="${S.page === id}">${label}</button>`).join('')}</nav>`;
  const aiTabs = () => `<nav class="set-aitabs" role="tablist" aria-label="指引的分页">${AI_TABS.map(([id, label]) => `<button type="button" role="tab" data-settings-act="aitab|${id}" aria-selected="${S.aiTab === id}">${label}</button>`).join('')}</nav>`;
  function pageBody(){ const p = S.page;
    if (p === 'guidance') return group('guidance', G.helm, '指引（AI 助手）', '按接入的步骤排列；每项后面写明存在哪里', enableRow() + (A().enabled ? aiTabs() + guidance(S.aiTab) : ''));
    if (p === 'notes') return group('notes', G.note, '写在笔记里', `存在 ${CONFIG}，所有设备同步`, notes(), fold(CONFIG, '配置笔记'));
    if (p === 'secret') return group('secret', G.lock, '日历', '只在这台设备上', secret());
    if (p === 'data') return group('data', G.data, '数据', '索引、检查与示例', dataGroup());
    if (p === 'about') return group('support', G.heart, '支持潮线', '免费开源，靠支持者走得更远', support()) + group('about', G.info, '关于', '版本与首次起航', about());
    return group('device', G.device, '这台设备', '存在本机，不同步', device()); }
  const html = () => `<div class="settings-view settings-r27 settings-r30" role="region" aria-label="设置">${backdrop()}<div class="set-column">${tabs()}<div class="set-page" data-page="${S.page}">${pageBody()}</div></div>${confirmBox()}</div>`;

  // ——— 显示 ———
  let resetScroll = false;
  function mountSecret(){ for (const slot of root.querySelectorAll('.settings-view [data-secret-slot]')) { const id = slot.dataset.secretSlot, conf = A().providers?.[id]; if (!conf) continue;
    if (!SecretComponent) { slot.textContent = '这个 Obsidian 版本不支持密钥库'; continue; }
    try { const c = new SecretComponent(plugin.app, slot); c.setValue(conf.apiKeySecret || ''); c.onChange(async v => { conf.apiKeySecret = v || ''; await plugin.saveSettings(); }); } catch { slot.textContent = '这个 Obsidian 版本不支持密钥库'; } } }
  function refresh(){ const v = $('.settings-view'); if (!v) return; const top = resetScroll ? 0 : (v.querySelector('.set-column')?.scrollTop || 0); resetScroll = false;
    v.outerHTML = html(); const n = $('.settings-view'); n.classList.add('is-still'); n.querySelector('.set-column').scrollTop = top; mountSecret(); view.frames();
    if (S.rename || S.adding) n.querySelector('.set-inline input')?.focus(); }
  function open(jump){ $('.settings-view')?.remove(); if (jump) S.page = jump; $('#sheet').insertAdjacentHTML('beforeend', html()); mountSecret(); view.frames(); root.querySelector('.module.settings')?.setAttribute('aria-pressed', 'true'); }
  function close(animated = true){ const v = $('.settings-view'); S.confirm = null; S.menu = null; root.querySelector('.module.settings')?.setAttribute('aria-pressed', 'false'); if (!v) return; if (!animated) { v.remove(); return; } v.classList.add('is-leaving'); setTimeout(() => v.remove(), 200); }
  const isOpen = () => !!$('.settings-view');
  function written(){ S.written = Date.now(); setTimeout(() => { if (Date.now() - S.written >= 1900) $('.set-written')?.remove(); }, 2000); }

  // ——— 写入 ———
  const writeConfig = fn => plugin.writer.frontmatter(CONFIG, fn).then(() => { written(); setTimeout(refresh, 250); });
  async function setPath(path, v){
    const parts = path.split('.'), scope = parts[0], key = parts.at(-1); let obj = scope === 'device' ? dev() : scope === 'zotero' ? (plugin.local.zotero ??= {on: true, folder: ''}) : A();
    for (const k of parts.slice(1, -1)) obj = obj[k] ??= {};
    const next = v === 'toggle' ? !obj[key] : key === 'archiveDays' ? Number(v) : v; obj[key] = next;
    await plugin.saveSettings();
    if (scope === 'device') view.applyDevice?.();
    else if (scope === 'zotero') { await plugin.syncZotero?.(); }
    else if (parts[1] === 'providers') { if (key === 'on' && next) { S.open = parts[2]; S.checking = parts[2]; refresh(); await plugin.detectAI(true, parts[2]); S.checking = null; } plugin.refreshAI(); }
    else { if (key === 'enabled' || key === 'model' || key === 'permission' || key === 'send' || key === 'provider') plugin.refreshAI(); }
  }
  function editLists(key, fn){ return writeConfig(fm => {
    const current = plugin.index.parseConfig(fm).ai[key];
    fm.ai ??= {};
    fm.ai[key] = fn([...current]);
  }); }
  function editConfigList(kind, fn){ const [, field, nameKey] = LISTS[kind]; return writeConfig(fm => { const cur = (cfg()[field] || []).map(x => ({id: x.id, [nameKey]: x[nameKey]})); fm[field] = fn(cur, nameKey); }); }
  // 一致性检查（只读）：链接指向不存在的笔记；日记里出现了清单里没有的习惯 / 问题
  function check(){
    const ix = plugin.index, names = new Set(plugin.index.source.files().map(f => f.path.split('/').pop().replace(/\.md$/, ''))), groups = [];
    const broken = [];
    for (const t of ix.tasks.values()) { if (t.project && !names.has(t.project)) broken.push([`${t.path} → [[${t.project}]]`, t.path]); for (const p of t.people) if (!names.has(p)) broken.push([`${t.path} → [[${p}]]`, t.path]); }
    for (const p of ix.projects.values()) for (const k of ['goals', 'people', 'ideas', 'literature']) for (const x of p[k]) if (!names.has(x)) broken.push([`${p.path} → [[${x}]]`, p.path]);
    if (broken.length) groups.push(['链接指向不存在的笔记', broken]);
    const habitIds = new Set(cfg().habits.map(h => h.id)), qIds = new Set(cfg().questions.map(q => q.id)), odd = [];
    for (const d of ix.days.values()) { const bad = [...Object.keys(d.habits).filter(k => !habitIds.has(k)), ...Object.keys(d.scores).filter(k => !qIds.has(k))]; if (bad.length) odd.push([`${d.path} · ${bad.join('、')}`, d.path]); }
    if (odd.length) groups.push(['日记里有清单里没有的习惯或问题', odd.slice(0, 50)]);
    S.report = {groups, total: groups.reduce((n, g) => n + g[1].length, 0)};
  }
  const findConflicts = () => { S.conflicts = plugin.index.source.files().map(f => f.path).filter(p => /conflict|冲突|Conflicted copy|\s\(\d+\)\.md$/i.test(p)); };

  async function click(e){
    const b = e.target.closest('[data-set],[data-settings-act]'); if (!b || !b.closest('.settings-view')) return false;
    if (b.dataset.set) { const i = b.dataset.set.lastIndexOf('|'); await setPath(b.dataset.set.slice(0, i), b.dataset.set.slice(i + 1)); refresh(); return true; }
    const [act, ...a] = b.dataset.settingsAct.split('|');
    if (act === 'page') { S.page = a[0]; S.aiTab = 'vendor'; S.menu = S.rename = S.adding = null; resetScroll = true; }
    else if (act === 'aitab') { S.aiTab = a[0]; resetScroll = true; }
    else if (act === 'card') S.open = S.open === a[0] ? null : a[0];
    else if (act === 'detect') { S.checking = a[0]; refresh(); await plugin.detectAI(true, a[0]); S.checking = null; plugin.refreshAI(); }
    else if (act === 'copy') { navigator.clipboard?.writeText(a.join('|')); view.frame.feedback('已复制：' + a.join('|')); return true; }
    else if (act === 'menu') S.menu = S.menu === a.join('|') ? null : a.join('|');
    else if (act === 'rename') { S.rename = a.join('|'); S.menu = null; }
    else if (act === 'add') S.adding = S.adding === a[0] ? null : a[0];
    else if (act === 'add-sub') { S.adding = S.adding === 'sub' ? null : 'sub'; S.subError = ''; }
    else if (act === 'every') { await plugin.calendars.setEvery(a[0]); }
    // 立即刷新（0.9.2）：你点的不受退避限制；“正在刷新”旁边按秒计时，结束（成功、失败或 60 秒超时）一定收起
    else if (act === 'refresh-sub') { const s = plugin.calendars.list().find(x => x.id === a[0]); if (s) { S.busy = s.id; S.busyAt = Date.now(); refresh();
      const tick = setInterval(() => { const el = $(`.settings-view [data-sub="${CSS.escape(s.id)}"] .set-last`); if (el && S.busy === s.id) el.textContent = `正在刷新…（${Math.round((Date.now() - S.busyAt) / 1000)} 秒）`; }, 1000);
      try { await plugin.calendars.refresh(s, {manual: true}); view.frame.feedback(s.ok ? `已刷新：${s.name || '日历'}（${s.count || 0} 个日程）` : `没有刷新成功：${s.error || ''}`); }
      catch (e) { view.frame.feedback('没有刷新成功：' + (e?.message || e)); }
      finally { clearInterval(tick); S.busy = null; } } }
    else if (act === 'unsub') { const s = plugin.calendars.list().find(x => x.id === a[0]); await plugin.calendars.remove(a[0]); view.frame.feedback(`已移除日历订阅：${s?.name || ''}`); }
    else if (act === 'unlist') { await editLists(a[0], l => l.filter((_, i) => i !== Number(a[1]))); return true; }
    else if (act === 'confirm') { S.confirm = a.join('|'); S.menu = null; }
    else if (act === 'no') S.confirm = null;
    else if (act === 'yes') { const [k, ...r] = a; S.confirm = null;
      if (k === 'del') { await editConfigList(r[0], l => l.filter((_, i) => i !== Number(r[1]))); return true; }
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
        dialog.addEventListener('keydown', e => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          e.stopPropagation();
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
  async function submit(f){
    const k = f.dataset.settingsForm; if (!k) return false; const [t, kind, i] = k.split('|'), v = f.elements.v.value.trim();
    if (t === 'sub') { const url = f.elements.url.value.trim(); if (!url) { f.elements.url.focus(); return true; }
      S.adding = null; S.subError = '';
      // 先当场取一次：失败就写出原因、不加进列表
      try { const cal = await plugin.calendars.fetch(url); const s = await plugin.calendars.add(v || cal.name || '', url, cal.events); view.frame.feedback(`已添加日历订阅：${s.name}（${cal.events.length} 个日程）`); }
      catch (e) { S.subError = '没有添加：' + (e?.message || e); S.adding = 'sub'; }
      refresh(); return true; }
    S.rename = null; S.adding = null;
    if (t === 'rename' && v) await editConfigList(kind, (l, nameKey) => { l[Number(i)][nameKey] = v; return l; });
    else if (t === 'add' && v) await editConfigList(kind, (l, nameKey) => { const base = LISTS[kind][3]; let n = l.length + 1; while (l.some(x => x.id === base + n)) n++; l.push({id: base + n, [nameKey]: v}); return l; });
    else if (t === 'list' && v) await editLists(kind, l => l.includes(v) ? l : [...l, v]);
    else if (t === 'pcmd' || t === 'pargs' || t === 'pname') { const conf = A().providers[kind]; conf[{pcmd: 'command', pargs: 'args', pname: 'name'}[t]] = v; await plugin.saveSettings();
      if (t !== 'pname') { S.checking = kind; refresh(); await plugin.detectAI(true, kind); S.checking = null; } plugin.refreshAI(); refresh(); }
    else if (t === 'zfolder') { (plugin.local.zotero ??= {on: true, folder: ''}).folder = v.replace(/\/+$/, ''); await plugin.saveSettings(); await plugin.syncZotero?.(); refresh(); }
    else if (t === 'inbox' && v) { A().saveFolder = v.replace(/\/?$/, '/'); await plugin.saveSettings(); refresh(); }
    else refresh();
    return true;
  }
  // 拖动一行的把手排序；顺序写进配置笔记
  let dragged = null;
  function dragstart(e){ const li = e.target.closest?.('.settings-view [data-item]'); if (!li) return false; dragged = li.dataset.item; e.dataTransfer.effectAllowed = 'move'; return true; }
  async function drop(e){ const li = e.target.closest?.('.settings-view [data-item]'); if (!li || !dragged) return false; e.preventDefault(); const [k1, i1] = dragged.split('|'), [k2, i2] = li.dataset.item.split('|'); dragged = null;
    if (k1 !== k2 || i1 === i2) return true; await editConfigList(k1, l => { const [it] = l.splice(Number(i1), 1); l.splice(Number(i2), 0, it); return l; }); return true; }
  view.registerDomEvent(root, 'click', e => { const b = e.target.closest('[data-set],[data-settings-act]'); if (b?.closest('.settings-view')) { e.stopPropagation(); click(e); } }, {capture: true});
  view.registerDomEvent(root, 'submit', e => { if (e.target.closest('.settings-view')) { e.preventDefault(); e.stopImmediatePropagation(); submit(e.target); } }, {capture: true});
  view.registerDomEvent(root, 'dragstart', e => dragstart(e), {capture: true});
  view.registerDomEvent(root, 'dragover', e => { if (dragged && e.target.closest?.('.settings-view [data-item]')) e.preventDefault(); });
  view.registerDomEvent(root, 'drop', e => { drop(e); }, {capture: true});
  // Esc 关上设置：焦点不一定在插件视图里（点完选项后常在别处），所以挂在整个窗口上，只在设置开着时管
  view.registerDomEvent(document, 'keydown', e => { if (e.key === 'Escape' && root.isConnected && isOpen() && !e.target.closest?.('input,textarea,.tideline-support-qr')) { e.preventDefault(); close(); } });
  return {open, close, refresh, isOpen, ask(k){ S.confirm = k; refresh(); }, toggle(){ if (isOpen()) close(); else open(); }};
}
