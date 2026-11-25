# 架构

本文所有事实都对照过 HEAD e3fb7a5 的代码；行号会漂移，以函数名为准。标“未核实”的是只读代码推断、没有运行验证的。

## 1. 模块边界

```
main.ts ── Index(data/index.ts) ← obsidianSource(data/source-obsidian.ts) ← Obsidian metadataCache / vault
   │                                     obsidianWriter ─→ Obsidian fileManager / vault
   └─ CompassView(view.ts)
        ├─ frame.ts        固定的框：侧栏、顶部条、#sheet、#scenery、#help、#feedback
        ├─ pages/today.ts  今日页（直接读 data/day.ts 的 dayView）
        ├─ pages/lower.ts  其余七页：model.ts 建模型 d → 原型模块画 → persist.ts 写回
        │     ├─ pages/thought.ts、pages/ai.ts（指引，接 ai/controller.ts）
        │     └─ draw/proto/phase2.ts → paper-tasks / paper-projects / paper-review / paper-library-r25 / paper-brain-r31
        ├─ ui/*            插件补的交互（task-plus、people、goals、more、map-search……）
        └─ host.ts HOST    原型模块眼里的 document/window
```

- `src/draw/proto/` 是从纸本原型移植的模块：原型直接用 `document`/`window`，移植时改成 `HOST.…`（`host.ts` 文件头）。这些模块不 import 插件的数据层，只读 `HOST` 与传进来的模型 `d`。
- 依赖方向：`data/` 不依赖 `view`/`pages`；例外：`model.ts` 用 `HOST.weekStart` 等算周期日期，`index.ts` 用 `ai/policy.ts` 的 `defaultLists` 生成默认保护名单。`ai/` 的使用者：`main.ts`、`data/index.ts`、`pages/ai.ts`、`pages/onboarding.ts`、`pages/settings.ts`、`plugin-types.ts`。
- 生成文件：`src/draw/proto/asset-shapes.js`（`tools/make-asset-shapes.mjs`）、`src/data/examples.ts`（`tools/make-examples.mjs`）、`src/ai/entities.ts`（生成脚本在私有 `dev/compare/phase4b/`，不在公开仓库）。`src/draw/proto/vendor/marked.mjs` 是第三方代码。

## 2. 关键入口

**`src/main.ts`**
- `onload()`：读 `data.json`（只取 `clock`）；从本机存储 `tideline-local` 读每台设备的设置 `this.local`（含旧版 AI 设置迁移，`settings.ai` 改成指向 `local.ai` 的访问器）；建 `writer`、`Index`、日历；注册视图、ribbon、命令。
- `workspace.onLayoutReady`：`index.setExamples` → `syncZotero(false)` → `index.build()` → 日历 `load().then(tick)` + `registerInterval` 每 10 分钟 `tick`；`vault.on('create')` 提示清除示例；第一次 `metadataCache 'resolved'` 时 `offref` 自己并 `index.rebuild()`（`main.ts:84`）。
- `onunload()`：`index.dispose()`。视图的清理在 `CompassView.onClose`。
- `saveSettings()`：`saveData({clock})` + `localStore.save('tideline-local', this.local)`（`main.ts:90`）。

**`src/view.ts` `CompassView`**
- `onOpen()`：建 `.compass-root`，`HOST.attach(root)`，装 `HOST.paper`、`HOST.onTransitionEnd`；建框（`buildFrame`）、今日页、各 `ui/*`；输入法组字拦截（`compositionstart/input/compositionend`，捕获阶段，最先登记）；`registerDocEvent('keydown', …)`；`root.onWindowMigrated(...)`；`index.subscribe(() => this.schedule())`；`ResizeObserver`；`registerInterval` 每 15 秒看时刻。
- `schedule()`：在视图所在窗口 `root.win.requestAnimationFrame` 合并成一次 `render()`。
- `render(force)`：组字中或 `taskPlus.holdRender()` 时挡下（`renderHeld`，之后 `releaseRender` 补）；按签名 `[index.version, date, time, page, ui.detail, width, height, theme]` 判断是否跳过；今日页走 `today.render → today.fit → more.update → today.scenery → showScene → todayReward → frames()`；其他页走 `renderLower`。
- `renderLower()`：`lower.render(page, navigating, w, h)`（返回 `reused`：签名没变直接露出）→ `drawScenery(reused)` → 若 `frames()` 没刚放过 “还有 N 项” 再 `more.update()`。
- `drawScenery(reused)`：下方各页风景按页缓存（`scenes[page]`），`showScene` 按描述比较复用节点；节点属于别的 document（搬窗口后）时在当前 document 重建。
- `frames()`：先量完所有 `button.outline, .hand-panel, .hand-pill, .hand-popup, #capture, #map` 再统一写手绘框（避免逐个触发排版）；末尾有纸条/设置开着时补放一次 `more.update()` 并 `moreRuns++`。
- `go(page)`：`HOST.transition.before(old, new)` 量旧画面 → 同步 `render(true)`；出错时清掉风景、`transition.finish()`。
- `onClose()`：`lower.close()`（等写回）、`unsub`、断开 `ResizeObserver`、取消帧；是当前 `HOST` 时 `transition.finish()`、`HOST.detach()`。

**`src/host.ts` `HOST`**：`attach/detach`；`addEventListener`（`pointermove/up/cancel` 挂在视图窗口，其余挂根元素，都记在 `listeners`）；`migrate()`；`win`；`requestFrame/cancelFrame`（在视图窗口排帧，时间戳换算到主窗口 `performance.now()` 时间线）；`paper`、`transition`、`transitionApi` 及一组 `task*`/`cargo*`/`person*` 钩子（插件模块往原型里接）。

**`src/frame.ts` `buildFrame`**：只建一次的骨架；`nav/clock/compass/feedback`。`NAV`、`ANGLE` 定义八页及罗盘角度。

## 3. 数据流

读：
```
Obsidian 文件 → metadataCache(frontmatter) + vault.cachedRead(正文)
  → source-obsidian.ts obsidianSource → data/index.ts Index（各类 Map；version 每次 emit +1）
  → 今日页：data/day.ts dayView(index, date, time)
  → 其他页：pages/lower.ts model() → data/model.ts buildModel(index, clock, 旧 d)（原地 Object.assign 到同一个 d）→ 原型模块 / thought / ai
```
写：
```
今日页动作 → data/write.ts todayActions → writer.frontmatter / body
其他页：模块直接改 d → lower.touch()（dirty=true）→ 空闲时 flush → persist.commit(d)：与上次快照逐项比较，只写变了的属性/小节；
  新条目建笔记；删除只认 d.trash 里登记的 id（data/trash.ts）
writer（source-obsidian.ts obsidianWriter）→ processFrontMatter / vault.process / renameFile / trashFile
  → Obsidian metadataCache 'changed' → Index.update(path) → emit → view.schedule() → 重画（model() 按新索引重建 d）
```
完成任务（今日页与任务页同一条路）：`data/complete.ts` 改模型 → `lower.settle()` 写回（`view.toggleTask`）。

笔记格式见 `docs/笔记格式.md`；文件夹名写死在 `data/index.ts` 的 `FOLDERS`。

## 4. 设置与状态存放

| 内容 | 位置 | 代码 |
|---|---|---|
| 固定时钟 `clock`（沙盒用来对齐原型截图） | `data.json`（随仓库同步） | `main.ts` `saveSettings`、`clock()` |
| 设备偏好、AI 助手设置、装过的示例、是否起航过、上次所在页、日历订阅列表、Zotero 开关 | `app.saveLocalStorage('tideline-local')`（本机、按仓库） | `main.ts` `onload` 的 `this.local` |
| AI 对话列表 | 本机存储 `tideline-ai-conversations` | `main.ts` `clearAIConversations`、`ai/controller.ts` |
| 日历取回的日程 | IndexedDB（打不开时退回本机存储） | `data/calendar.ts` 文件头 |
| API 密钥 | Obsidian `secretStorage`，设置里只存引用名 | `main.ts` `aiApiKey` |
| 习惯、问题、清单、视图、AI 保护名单 | 仓库笔记 `潮线/配置.md` | `data/index.ts` `parseConfig` |
| 视图界面状态 | 内存：`view.ui`、模型 `d.ui`、`d.cache` | `view.ts`、`data/model.ts` |

## 5. AI（ACP）

- `src/ai/acp.ts`：ACP 客户端。在本机启动代理程序（`child_process.spawn`，stdin/stdout 逐行 JSON-RPC，工作目录 = 仓库根 `vaultRoot()`）。`PRESETS`：Claude Agent、Codex、Gemini CLI、CodeBuddy、DeepSeek Harness、自定义。`probe()` 握手不花用量；`createAcpSession()` 开会话；`askMode` 把代理切到“每次改动都问客户端”的档位，否则保护名单管不到。Node 模块全部经 `window.require` 现取（`nodeRequire`）。
- `src/ai/controller.ts`：指引页对话（流式、工具调用、确认卡片、@ 笔记、/ 命令），装到 `HOST.ai`（`send`、`threadInto`）。
- `src/ai/policy.ts`：纯函数，按三张名单（askRead / noWrite / autoWrite）与三档权限（read / confirm / auto）决定放行、询问或拒绝。
- `src/ai/markdown.ts` + `html-text.ts` + `entities.ts`：用 marked 的词法记号直接建节点；原始 HTML 转义成文字，链接只留 http(s)/mailto/#，图片不自动加载。
- 文件读写回调：`main.ts` 里 `files.read = readVaultFile`（`adapter.read`），`files.write` 走 `writer.body/create`。
- 页面：`pages/ai.ts` + `draw/proto/paper-guidance-r28.ts`；设置在 `pages/settings.ts`。

## 6. 绘制层

- `draw/ink.ts`：笔压线与小图形（`perfect-freehand`）。节点版 `inkEl/circleEl/iconEl/buttonFrameEl…`，描述版 `inkV/circleV`；只算图形，不读页面和数据。
- `draw/dom.ts`：`h(tag, attrs, ...children)`、`svg`、`setNodes`、`insertNodes`。只用 DOM 方法，不解析字符串；文字一律成为文本节点。
- `draw/scene.ts`：风景描述 `sh()`/`parts()`，`sameParts` 比较、`buildParts(list, doc)` 在指定 document 建节点（弹出窗口可重建）。
- 页面：今日页 `pages/today.ts`（每块区域记上次输入，没变不动）；下方五页由 `draw/proto/phase2.ts` 的 `createPhase2` 汇总，风景 `scenery(box)` 输出描述。过场 `draw/proto/paper-transition-r37.ts` 装 `HOST.transition`；“?” 说明 `draw/proto/paper-help-r39.ts`（视图 `onOpen` 里 `attachHelp`、`onClose` 里 `detachHelp`，见 ADR 16）。

## 7. 样式拼接

`tools/build.mjs` 的 `STYLE_FILES = ['fonts.css', 'reset.css', 'prototype.css', 'container.css', 'narrow.css', 'ai.css']`，按序拼接、前加许可证注释写成 `dist/styles.css`。顺序有意义：`reset.css` 先把 Obsidian 给按钮/输入框/标题的外观 `all:revert`；`prototype.css` 是原型样式；`container.css` 把按窗口排版改成按容器（`@container compass`、`cqw/cqh`）并覆盖原型；`narrow.css` 是窄视图的后置覆盖。所有选择器以 `.compass-root` 开头，唯一例外 `container.css:2` 的 `.workspace-leaf-content[data-type="tideline"] .view-content`（去掉 Obsidian 视图容器的内边距）。

## 8. ADR / 不能删的逻辑

每条：**是什么 / 为什么 / 删了会怎样 / 位置**。

1. **索引中途更新时推迟重建模型**（commit 44d60cc）
   是什么：`model()` 发现索引变新时，先用 `persist.pending(d)` 把模型与上次快照逐项比较；有未标记的改动就不重建，排 `syncSoon()` 稍后再试（最多 10 次 × 300ms），写回完成后再重建。同时 task-plus、people、goals 改成先 `touch()` 再 `render()`。
   为什么：页面代码常是“改模型 → render() → touch()”，键盘操作要到 keyup 才置 dirty；这之间若 render 里按索引重建，刚改的内容被旧笔记盖掉（评论、检查项模式、联系频率、人物记录）。
   删了会怎样：编辑偶发丢失，只在索引恰好更新时出现，很难复现。
   位置：`src/pages/lower.ts` `rebuild()`/`model()`/`syncSoon()`（约 :44–:73）；`src/data/persist.ts` `pending()`（:100）。

2. **弹出窗口兼容**（05be706）
   是什么：`CompassView.registerDocEvent` 把 document 监听挂在视图所在窗口，`onWindowMigrated` 时摘下重挂；`root.onWindowMigrated` 里调 `HOST.migrate()`（把 `pointermove/up/cancel` 搬到新窗口）和 `applyDevice()`（新窗口样式表上重设字号与主题）；`HOST.requestFrame` 在视图窗口排帧；过场用 `instanceOf` 与视图 document。
   为什么：原来全挂在主窗口：弹出窗口里快捷键、Esc、拖动收不到；主窗口最小化时动画帧停，过场卡住；`instanceof SVGElement` 认不出别的窗口的元素，思索页过场报错。
   删了会怎样：视图拖到弹出窗口后上述问题全部回来。
   位置：`src/view.ts` `registerDocEvent`（:253）、`onOpen` 里 `onWindowMigrated`（:238）；`src/host.ts` `migrate`（:153）、`requestFrame`（:156）；`src/draw/proto/paper-transition-r37.ts` 文件头。

3. **`@property --r34-cut` 注册为不继承**（e3fb7a5）
   是什么：`@property --r34-cut{syntax:'*';inherits:false}`。
   为什么：`ui/more.ts` 滚动时把收尾线位置写在滚动区上；可继承的自定义属性一改，整个货单（500 条时约 7800 个子孙）都要重算样式。
   删了会怎样：500 条任务时滚动帧间隔从约 27ms 退回约 86ms（Obsidian 实测）。
   位置：`src/styles/prototype.css:2282`；写入方 `src/ui/more.ts:67–69`。

4. **`renderLower` 的 `moreRuns` 去重**（e3fb7a5）
   是什么：`frames()` 末尾放过一次 `more.update()` 就 `moreRuns++`；`renderLower` 比较前后计数，相同才再放一次。
   为什么：两次之间 DOM 没变，第二遍量到的、写的都与第一遍相同，却要约 29ms。
   删了会怎样：只是变慢；但若改成“永远不放第二次”，没有纸条/设置时“还有 N 项”就不画了。
   位置：`src/view.ts` 字段 `moreRuns`（:150）、`renderLower`（:377–:380）、`frames`（:477）。

5. **任务货单按条更新 `keepRows`**（e3fb7a5；重合度条件 T-002）
   是什么：任务页仍整页新建，再把旧的 `.cargo-center > .cargo-left-pane > .cargo-manifest` 链留下，行按 `outerHTML` + `isEqualNode` 与新建结果逐字相同才沿用旧节点。整页重建（返回 false，DOM 不动）的条件：没有旧货单；链上元素不一一对应或属性名先后不同；链上元素有焦点、有横向滚动或（货单以外）纵向滚动、正在播动画；货单滚动位置这次要变；文档选区落在任务页上；能沿用的行太少（T-002：货单子节点按首个子元素的 `data-id` 计，新旧都有的个数 × 3 小于新旧子节点总数，即估计能沿用的行比要摘掉、要插入的行合计还少——切到小清单、切人物、清单切清单、从小清单回全部）。行沿用另要求焦点不在行内、行内没有动画。
   为什么：500 条时整页重建要新建约 7800 个元素再排版。
   删了会怎样：勾选、点开、改名、拖动慢 26–59%。放宽条件会出现焦点丢失、动画不重播、选区错位、滚动跳动。去掉重合度条件：切到小清单、切人物时反而比整页重建慢（每摘 / 插一个节点，浏览器都要过一遍文档里所有还没回收的 Range；风景与“还有 N 项”每次渲染按文字节点建 Range，500 条任务时每个节点约 0.1–0.15ms）。
   位置：`src/draw/proto/paper-tasks.ts` `render()` 调用处（:93）、`keepRows`（:106，重合度条件在 :116–:119）。

6. **风景避让框共用一次测量 `rawObstacles`**（e3fb7a5）
   是什么：每个祖先只量一次（`getComputedStyle` + `getBoundingClientRect`，按 Map 记忆裁剪范围交集），一次测量给出未加边距的文字框与控件框；`scenery()` 用同一份结果分别按 16px（含控件）和 8px（只文字）加边距。
   为什么：原来每个文字矩形对每层祖先都量一遍，同一页还量两次，约 60ms。
   删了会怎样：变慢；若在测量中途写 DOM，记忆的结果就不再成立（结果逐位相同的前提是同一次调用里不写 DOM）。
   位置：`src/draw/proto/phase2.ts` `rawObstacles`（:85）、`textObstacles`（:92）、`scenery`（:96）。

7. **构建前校验 asset-shapes**
   是什么：`tools/build.mjs` 开头跑 `node tools/make-asset-shapes.mjs --check`，不一致就退出 1。
   为什么：风景按 `asset-shapes.js` 的描述建节点，页面模板仍按字符串用 `assets.js`；改了素材忘了重新生成，两边画面不一致。
   删了会怎样：不一致的素材悄悄进入发布包。
   位置：`tools/build.mjs:16–17`；生成器 `tools/make-asset-shapes.mjs`（生成后会把描述拼回字符串与原素材逐字比较）。

8. **`--deploy` 只认含 sandbox 的路径**
   是什么：目标不是 Obsidian 仓库（没有 `.obsidian`）或路径不含 `sandbox`（不区分大小写）就抛错。
   为什么：防止 Agent 把开发构建装进真实仓库，覆盖用户在用的插件。
   删了会怎样：一次误操作即可改坏真实仓库的插件。
   位置：`tools/build.mjs` `deploy()`（:55）。

9. **`src/settings.ts` 关掉 `prefer-setting-definitions`**
   是什么：只对这个文件关闭 `obsidianmd/settings-tab/prefer-setting-definitions`。
   为什么：Obsidian 自带设置页里潮线那块只放三样，照旧用 `display()` 画；改成 `getSettingDefinitions()` 后由 Obsidian 来画，那几行会进设置搜索、按钮与下拉换成框架画法、`display()` 不再被调用，超出“行为不变”的范围。
   删了会怎样：`npm run lint` 报错；照规则改则改变用户可见行为。
   位置：`eslint.config.mjs:15–18`。

10. **剩余的 `!important`**（e5a19a5 把 334 条声明降到 276；05be706 把过场写在行内的 `!important` 搬成 3 条 CSS 规则，现为 279 条声明，不计注释）
    原因分类（e5a19a5 提交说明 + 抽样核对）：
    - 盖过 Obsidian/主题给 svg、按钮、输入框、滚动条的样式：如 `container.css:108–109`（`scrollbar-width:none`、`::-webkit-scrollbar`），`prototype.css:777` `.cargo-nav button > svg` 尺寸。
    - 盖过 JS 写的行内样式：如 `prototype.css:2320` `#sheet > .r35-leaving{display:var(--r35-leave-display)!important}`（值由过场写进自定义属性）。
    - 减弱动态开关：`container.css:128`、`:167` 的 `animation:none!important`。
    - `[hidden]` 必须赢：`prototype.css:15` `.compass-root [hidden]{display:none!important}`；因此 `prototype.css:1878` `#ai.ai-off …{display:none!important}` 也得留着。
    - 后置覆盖原型自己的 `!important`：`narrow.css:99` brain 节点 svg 尺寸（`narrow.css:7` 注释说明）；`container.css:21`、`:26`、`:88`、`:247` 的 `background:var(--paper)!important`（让这些纸条用实底；具体对手规则未逐条核实）。
    - 去掉会输给自己的普通规则：`prototype.css:1854` `.ob-course` 的 `position`。
    删了会怎样：某些主题或状态下画面变化，且只在特定主题/尺寸/动态设置下出现。不要新增。

11. **`data.json` 只存 `clock`**
    是什么：`saveSettings()` 只 `saveData({clock})`；其余设置在本机存储；`onload` 把旧版存在 `data.json` 的 `ai` 迁走并换成访问器。
    为什么：`data.json` 在仓库里、随同步盘走；AI 命令路径、日历地址、设备偏好是每台设备不同的，同步会互相覆盖（也会把命令路径同步到别的电脑）。
    删了会怎样：多设备互相覆盖设置；旧数据迁移逻辑（`main.ts:50–61`）被破坏会丢用户 AI 设置。
    位置：`src/main.ts:39`、`:46–61`、`:90`。

12. **`isDesktopOnly: true` 的依赖**
    是什么：`manifest.json` 声明只在桌面加载。
    为什么：`src/ai/acp.ts` 经 `window.require` 用 `child_process`、`fs`、`path`、`os` 并读 `process.env/platform`；`src/main.ts` `vaultRoot()` 用 `adapter.basePath`（移动端没有）；构建 `platform: 'node'`（`tools/build.mjs:72`）。
    删了会怎样：移动端加载后 AI 与依赖仓库绝对路径的功能直接报错。

13. **索引在第一次 `metadataCache 'resolved'` 后再全量重建**
    是什么：`onLayoutReady` 里 `index.build()` 一次；第一次 `resolved` 时 `offref` 自己并 `index.rebuild()`。
    为什么：布局就绪时还有文件的属性没缓存好（`getFileCache` 为空），那批笔记会按“没有属性”被索引。
    删了会怎样：大仓库冷启动时部分任务/项目缺属性，要等文件被改动才恢复。只重建一次是有意的：`rebuild()` 不重复注册改动监听。
    位置：`src/main.ts:84`；`src/data/index.ts` `build`（:100）、`rebuild`（:109）。

14. **输入法组字期间不重画、`holdRender`**
    是什么：`compositionstart` 到 `compositionend` 之间拦下 `input` 并挡住 `render()`，结束后补发 `input` 并补渲染；任务详情里打字时写回引起的重画由 `taskPlus.holdRender()` 推迟。
    为什么：原型的搜索框每打一下就重画并重设光标，会打断拼音组字，字母留在框里。
    删了会怎样：中文输入法在搜索框等处无法正常输入。
    位置：`src/view.ts` `onOpen`（:191–:202）、`render`（:328–:331）；`src/ui/task-plus.ts` `holdRender`。

15. **删除只认显式登记**
    是什么：`persist.commit` 只把 `d.trash` 里登记过的 id 移进回收站（`data/trash.ts`）；撤销期内的删除放在 `hold`，纸条消失后才真正删。
    为什么：模型重建或模块 bug 让某条目暂时不在 `d` 里时，不能据此删笔记。
    删了会怎样：可能误删用户笔记。
    位置：`src/data/persist.ts` `commit`（:114）；`src/data/trash.ts`；`src/pages/lower.ts` `hold`、`close()`。

16. **“?” 说明模块随视图挂上 / 摘下**（T-001）
    是什么：`paper-help-r39.ts` 不在模块载入时找 `#help`，而是导出 `attachHelp(root)` / `detachHelp()`。视图 `onOpen` 建好框（`buildFrame`）后 `attachHelp`：先 `detachHelp`，再观察这个视图的 `#help`、把 `resize` 挂在 `root.win` 上，并经 `root.onWindowMigrated` 在视图搬窗口时把 `resize` 搬过去。`onClose` 里（`HOST.root === this.root` 时，`HOST.detach()` 之前）`detachHelp`：断开 `#help` 与整页的两个 `MutationObserver`、清 400ms 计时器、取消挂起的 `HOST.requestFrame`（并复位 `queued`）、摘掉 `resize` 与搬窗口回调。`HOST` 是单例：新视图 `attachHelp` 会先摘掉旧视图的。
    为什么：原来只观察第一次打开的那个 `#help`（之后关掉再开，说明不再排布）；说明开着时关闭视图，计时器每 400ms 读 `HOST.root!` 抛错；`resize` 挂在主窗口全局，视图在弹出窗口里改尺寸不重排；载入时没有视图就每帧重试。
    删了会怎样：上述问题回来。`detachHelp` 里若不复位 `queued`，取消挂起的帧后 `settle()` 永远不再排帧，下一个视图的说明不排布。
    位置：`src/draw/proto/paper-help-r39.ts` 末尾 `attachHelp` / `detachHelp`；`src/view.ts` `onOpen`（`buildFrame` 下一行）、`onClose`。
