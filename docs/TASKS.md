# 任务板

多个 Agent 并行时的认领表。规则以 [AGENTS.md](../AGENTS.md) 为准，这里只放流程和任务卡。

## 模块归属

同一时刻一个模块最好只有一个进行中的任务；要跨模块时在任务卡里写明，并先确认没有冲突的进行中任务。

| 模块 | 路径 | 备注 |
|---|---|---|
| data | `src/data/`、`src/changes.ts` | 写回与索引竞态，见 ARCHITECTURE ADR 1、15 |
| tasks 页 | `src/draw/proto/paper-tasks.ts`、`paper-cargo-*.ts`、`paper-inline-editor-r15.ts`、`paper-task-markdown.ts`、`src/ui/task-*.ts` | `keepRows` 是高风险区 |
| 其他页 | `src/view.ts`、`frame.ts`、`host.ts`、`src/pages/`（除 `ai.ts`）、`src/ui/`（除 `task-*`）、其余 `src/draw/` | `view.ts`、`host.ts` 牵动所有页 |
| AI | `src/ai/`、`src/pages/ai.ts`、`src/draw/proto/paper-guidance-r28.ts` | |
| styles | `src/styles/` | `prototype.css` 大段改动只由集成者做 |
| tools/构建 | `tools/`、`eslint.config.mjs`、`tsconfig.json`、`package.json`、`package-lock.json`、`manifest.json`、`versions.json`、`.gitattributes` | 高频冲突文件只由集成者改 |

## 状态流转

`待认领` → `进行中`（认领人填负责 Agent、分支、worktree）→ `待复核`（`npm run check` 全过，写清验证结果）→ `已合并`（集成者合并后改状态）。放弃时退回 `待认领` 并在备注写原因。

## 规则

- 一个任务一个分支 `agent/<工具>/<任务ID>`（例：`agent/codex/T-002`），一个 worktree（例：`git worktree add ../tideline-T-002 -b agent/codex/T-002`）。
- 认领时先在 main 上改本文件的任务卡（状态、负责 Agent、分支、worktree），**单独提交**，再开分支干活。
- 高频冲突文件（`package.json`、`package-lock.json`、`manifest.json`、`versions.json`、`prototype.css` 大段）只由集成者改；依赖升级单独成任务。
- `package-lock.json` 冲突时不手动合并：取一边（通常是 main 的），再 `npm install` 重新生成并提交。
- 新 worktree 没有 `node_modules/` 和 `dev/`：先 `npm ci`，之后 `npm test`（`test/` 的 8 项）照常跑；要跑私有浏览器/Obsidian 检查得回到主目录。
- PR 和 main 都跑 CI（`.github/workflows/ci.yml`），CI 红了不合并。
- 合并前 rebase 到最新 main，再跑一次 `npm run check`。
- 提交和推送由用户手动；Agent 只准备好改动和提交说明。

## 任务卡模板

```md
### T-000 标题
- 负责 Agent：
- 分支：agent/<工具>/T-000
- worktree：
- 范围文件：
- 禁碰文件：package.json、package-lock.json、manifest.json、versions.json，以及范围外的一切
- 验收命令：npm run check（另列要跑的私有检查）
- 状态：待认领
- 备注：
```

## 任务

### T-001 “?” 说明模块的监听与计时器跟随视图
- 负责 Agent：Claude Code
- 分支：main（按用户要求直接在主目录改）
- worktree：主目录
- 范围文件：`src/draw/proto/paper-help-r39.ts`；必要时 `src/view.ts`（只加调用，不改别处）
- 禁碰文件：高频冲突文件；`src/host.ts` 的现有接口语义
- 验收命令：`npm run check`；私有 `check-r39-ui`、`check-help-capture`；Obsidian 里关闭再打开视图后按 “?” 仍能排布说明；视图在弹出窗口时改窗口尺寸说明会重排；说明开着时关闭视图，控制台无报错
- 状态：已合并（2026-11-24；测试工具 12/12，真实 Obsidian 9/9：关闭再打开、说明开着时关闭、弹出窗口改尺寸重排都通过，弹出窗口回归 27/27）
- 备注：问题见 HANDOFF 已知问题 1。做法：`paper-help-r39.ts` 去掉模块载入时的 `hook()` 每帧重试与全局 `addEventListener('resize')`，改为导出 `attachHelp(root)` / `detachHelp()`；`view.ts` 只加两处调用（`onOpen` 里 `buildFrame` 之后 `attachHelp`，`onClose` 里 `HOST.detach()` 之前 `detachHelp`）。`resize` 挂在 `root.win`，经 `root.onWindowMigrated` 跟着视图搬窗口；`detachHelp` 断开两个 observer、清计时器、取消挂起的帧。`host.ts` 未改（`HOST.addEventListener` 只把 pointer 三种挂到窗口，`resize` 会挂到根元素上收不到，所以没用它）。`HOST` 是单例：新视图 `attachHelp` 先摘掉旧的。说明的排布、箭头、过场期间不排布等逻辑未动。验证：`npm run check` 全过；私有浏览器检查 16 项全过，`check-help-capture` 24/24；测试工具补测（关闭再打开、说明开着时关闭、iframe 模拟弹出窗口的 resize）改前 4 项失败、改后 12/12 通过。真实 Obsidian 未跑：跑前核对真实配置指纹，哈希相同但修改时间与登记值不同，按本机规则停下。`dist/styles.css` 不变，`dist/main.js` 变。

### T-002 切到小清单的 keepRows 开销
- 负责 Agent：
- 分支：
- worktree：
- 范围文件：`src/draw/proto/paper-tasks.ts`
- 禁碰文件：高频冲突文件；`src/styles/`
- 验收命令：`npm run check`；私有 `check-task-plus`、`check-task-ui`、`check-race` 全过；500 条任务下 Obsidian 测速：切清单不慢于整页重建，其余场景不退步
- 状态：待认领
- 备注：HANDOFF 已知问题 3。例如新旧行数相差很大时直接整页重建，跳过 `outerHTML` 比较。属于高风险区，必须说明怎么证明 DOM 与改前一致。

### T-003 公开的纯 Node 测试
- 负责 Agent：
- 分支：
- worktree：
- 范围文件：新增 `test/`、`.github/workflows/`、`tools/check-release-tag.mjs`；`tools/test.mjs`、`eslint.config.mjs`、`package.json`、`package-lock.json`（用户决定由本任务加 devDependency `yaml`）；文档同步
- 禁碰文件：`src/`
- 验收命令：没有 `dev/`、没有 `node_modules/` 的干净副本里 `npm ci && npm run check` 全过；`dist/main.js`、`styles.css` 与改前逐字节相同
- 状态：已完成（2026-11-24，待用户提交）
- 备注：8 项检查（escapes、frontmatter、persist、complete、model、ical、ai-policy、ai-markdown）与 `mem-vault.mjs` 移到 `test/`，入口 `test/run.mjs`；`tools/test.mjs` 不再“没有 dev/ 就跳过”。`test.ics` 夹具放 `test/fixtures/`（虚构课程日历）。`check-escapes` 现在扫 `src/`、`tools/`、`test/`（原来只扫 `src/`）。`check-ai-policy` 的路径样例换成虚构盘符 `X:`/`Y:`，判定不变。`check-ical` 期望值按 Asia/Shanghai，脚本在 TZ 未设时自己设（CI 的 UTC 机器上同样通过）。`yaml@2.6.1` 进根 devDependencies。新增 CI（`ci.yml`）与草稿发布（`release.yml` + `tools/check-release-tag.mjs`）。
