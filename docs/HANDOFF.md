# 交接：现状快照

- 版本 0.9.7（`package.json`、`manifest.json` 一致；`versions.json` 登记 0.9.6、0.9.7 → minAppVersion 1.15.0）；git 标签 `v0.9.6`、`v0.9.7`。
- 快照基于 HEAD `e3fb7a5`（2026-11-22）。之后的变化看 `git log`，本文件随大批次更新。
- 只在 Windows 的桌面 Obsidian 上验证过；macOS / Linux 未实测（README）。

## 稳定功能（按 README 与代码核实）

- 八页：今日（`pages/today.ts`）、思索（`pages/thought.ts`，周规划 + 想法星空）、指引（`pages/ai.ts`，提示词库 + AI 对话）、任务（`draw/proto/paper-tasks.ts` + `ui/task-plus.ts`：优先级、日期与重复、子任务、检查项、拖放、批量、到点提醒）、项目（`paper-projects.ts`）、复盘（`paper-review.ts`：日/周/季）、知识库（`paper-library-r25.ts`，含 Zotero Integration 导入文件夹，`data/zotero.ts`）、大脑（`paper-brain-r31.ts`）。`frame.ts` 的 `READY` 里八页全部启用。
- 目标（`ui/goals.ts`）、人物与邮包/见面（`ui/people.ts`）。
- 日历 iCal 订阅（`data/calendar.ts`、`data/ical.ts`）：本机缓存，按间隔刷新，单次联网 60 秒上限。
- AI 助手（`src/ai/`，经 ACP 接本机代理：Claude Agent、Codex、Gemini CLI、CodeBuddy、DeepSeek Harness、自定义），三档权限 + 三张保护名单。
- 首次起航与示例航程（`pages/onboarding.ts`、`data/examples.ts`），升级纸条（`src/changes.ts`），潮线自己的设置页（`pages/settings.ts`），纸/夜航配色、字号、过场开关、弹出窗口。

## 最近四个质量批

| 提交 | 内容 | 结果 |
|---|---|---|
| `e082eb1` | CSS 清理 | 删 90 个无引用选择器、27 条被完全覆盖的声明、10 个无用自定义属性、8 个 @keyframes；styles.css 347,708 → 337,277 字节；main.js 不变，所有走法计算样式相同 |
| `e5a19a5` | `!important` 整理 | 声明 334 → 276（文字出现次数含注释 336 → 278）；两处 padding 覆盖并回 prototype.css。之后 `05be706` 把过场的行内 `!important` 搬成 3 条 CSS 规则，现为 279 条声明 |
| `05be706` | lint 与弹出窗口 | eslint 129 错 / 185 警 → 0 / 0；剩余 `.js` 转 `.ts`；键盘、拖动、动画帧、过场跟随视图所在窗口；固定行内样式与注入的 `<style>` 改成 CSS 类 |
| `e3fb7a5` | 性能 | 500 条任务（Obsidian 实测）：打开 517→370ms、勾选 412→277、点开一行 437→293、回到全部 431→319；勾选/点开/改名/拖动快 26–59%；滚动帧间隔 86.5→27.4ms（−68%） |

各批都以“画面与行为不变”为验收：构建前后对比、私有测试工具的逐步 DOM/计算样式比较、真实 Obsidian 走查。这些工具在私有 `dev/`，公开仓库里没有。

## 已知问题

1. **“?” 说明模块的生命周期挂在模块载入而不是视图上**（`src/draw/proto/paper-help-r39.ts`，代码阅读结论，未在 Obsidian 中复现）：
   - `:103` 模块载入时 `addEventListener('resize', …)` 挂在主窗口的全局上，永不移除；视图在弹出窗口里时收不到那个窗口的 resize。
   - `:102` `hook()` 只在载入时找一次 `#help` 并挂 `MutationObserver`。没找到时每帧 `HOST.requestFrame(hook)` 重试，直到第一个视图打开；视图关掉再开，新的 `#help` 没人观察（推断：重开后 “?” 说明不再按元素排布）。
   - `:99` 的 `setInterval`（400ms）只在 `#help` 变为隐藏时 `:100` 清掉。视图关闭时若说明正开着，没有路径清它，回调里 `HOST.root!.hasAttribute` 在 `HOST.detach()` 后为 null，会每 400ms 抛错。
2. **`src/pages/settings.ts:286` 的 `setInterval`**：在同一段 `try/finally` 的 `finally` 里 `clearInterval`（`:289`），刷新结束（成功、失败或 60 秒超时）一定清掉；视图中途关闭时最多多跑到超时，回调只是查不到元素。结论：没有泄漏，不需要改。
3. **Obsidian 里切到小清单慢约 11%**（185→205ms）：`keepRows` 的 `outerHTML` 比较约 12ms + 逐个摘行约 5ms，沿用的行少时抵不掉。测试工具里同一场景反而快 9–37%。已知未改（改了要重跑整套等价检查）。
4. **季度复盘页可能不随季度笔记更新**：未核实。相关代码：`data/index.ts` 的 `quarter` 分支、`data/model.ts`、`pages/lower.ts` 的页签名（含 `index.version`）。
5. **同等排序的项目启动后先后不定**：私有测试记录里观察到真实 Obsidian 每次读索引的先后不同。推断原因：`Index.loadAll` 用 `Promise.all` 并发 `load()`，需要 `await read` 的笔记写进 Map 的先后取决于读完的先后，排序键相同时保持插入顺序（未逐一核实各页的排序函数）。
6. **测试不在公开仓库**：`npm test` 没有 `dev/` 时跳过并退出 0。待用户决定是否把纯 Node 检查（`dev/tools/test.mjs` 的 8 项：escapes、frontmatter、persist、complete、model、ical、ai-policy、ai-markdown）移到公开的 `test/`。
7. 文档小错：`docs/笔记格式.md` 仍写 `src/data/index.js`（现为 `index.ts`）。README 说 AI 助手“默认关闭”，而 `src/settings.ts` 的 `DEFAULT_AI.enabled` 是 `true`（各家 `providers[id].on` 只有 claude 默认开）；实际是否默认可用取决于首次起航，未核实。

## 技术债

- 超大文件：`src/ui/task-plus.ts`（108 KB，1124 行）、`src/styles/prototype.css`（229 KB，2387 行）、`src/draw/proto/paper-review.ts`（52 KB，原型式长单行）、`src/view.ts`（40 KB）、`src/ai/controller.ts`（46 KB）。
- `rNN` 命名来自原型轮次，与功能无关（`paper-cargo-r16/r18/r23` 同时在用）。
- 没有公开测试、没有 CI（仓库无 `.github/`）。
- 原型模块大量依赖全局 `HOST` 单例：同一时刻只能有一个潮线视图（`host.ts` 文件头）。

## 高风险区

| 区域 | 为什么危险 | 改之前该跑什么 |
|---|---|---|
| 任务页按条更新：`paper-tasks.ts` `keepRows` | 沿用旧节点的条件稍松就出现焦点丢失、选区错位、动画不重播、滚动跳动；条件稍紧就失去性能收益 | `npm run check`；私有工具 `check-task-plus`、`check-task-ui`、`check-race`，`obsidian-run.mjs check --task-plus`；500 条任务下对比勾选/点开/滚动耗时 |
| 过场 `paper-transition-r37.ts` | 量旧画面 → 同步渲染 → 微任务里量新画面，依赖 `go()` 的时序、`data-r35-run`、`redrawAtRest`；弹出窗口与主窗口最小化时用视图窗口的帧和时间线 | 私有 `check-transition`（需原型静态服务）；弹出窗口走查；`motion=off` 与减弱动态 |
| 风景避让框 `phase2.ts` `rawObstacles` / `scenery` | 测量里写 DOM 会破坏记忆结果；边距 16/8 两套结果供遮罩与水流线；尺寸为 0 时要夹到 0（681ae38 修过 NaN/负值） | 各页截图对比（私有 `compare.mjs`、等价检查），窄视图与隐藏视图 |
| AI `ai/controller.ts`、`ai/acp.ts` | 起外部进程、环境变量传密钥、权限询问；`askMode` 错了保护名单形同虚设 | `check-ai-policy`、`check-ai-markdown`（`npm test` 内）、`check-ai-ui`；真机 `obsidian-run.mjs` 的 AI 走查 |
| 写回与索引竞态 `data/persist.ts`、`pages/lower.ts`、`data/write.ts` | 见 ARCHITECTURE ADR 1、15：顺序错一步就丢编辑或误删笔记 | `check-persist`、`check-complete`、`check-writes`、`check-race`；新增写回路径必须先 `touch()` 再 `render()` |
