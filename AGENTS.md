# AGENTS.md — 潮线 Tideline

所有 AI Agent（Claude Code、Codex、Cursor……）的唯一规范入口。潮线是 Obsidian 桌面端插件：一张手绘航海纸，八页（思索、指引、今日、任务、项目、复盘、知识库、大脑），数据全部是仓库里的 Markdown 笔记。

开工前依次读：本文件 → [docs/HANDOFF.md](docs/HANDOFF.md)（现状、已知问题、高风险区）→ [docs/TASKS.md](docs/TASKS.md)（认领任务）→ 按需读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（模块边界与“不能删的逻辑”）。本机若有 `dev/AGENTS.local.md`（git 忽略），也必须读，它的本机规则优先。

## 目录

| 路径 | 负责 | 规则 |
|---|---|---|
| `src/main.ts` | 插件入口：注册视图、命令、设置页；建索引 | |
| `src/view.ts` `src/frame.ts` `src/host.ts` | 主视图（渲染调度）、固定的框、原型模块的 document/window 替身 `HOST` | |
| `src/data/` | 索引（`index.ts`）、Obsidian 读写（`source-obsidian.ts`）、模型（`model.ts`）、写回（`persist.ts`、`write.ts`）、日历、Zotero | `examples.ts` 由 `node tools/make-examples.mjs` 生成，不手改 |
| `src/pages/` | 今日、思索、指引、设置、首次起航；`lower.ts` 接下方五页 | |
| `src/ui/` | 插件补的交互（任务页 `task-plus.ts`、人物、目标、更多提示等） | |
| `src/ai/` | AI 助手：ACP 客户端 `acp.ts`、对话 `controller.ts`、权限 `policy.ts`、Markdown 渲染 | `entities.ts` 是生成的表，不手改 |
| `src/draw/` | 绘图：`ink.ts`（笔压线）、`dom.ts`（建节点）、`scene.ts`（风景描述） | |
| `src/draw/proto/` | 从纸本原型移植的页面模块。文件名里的 `rNN` 是原型的设计轮次，不是版本号 | `vendor/` 不准手改；`asset-shapes.js` 由 `node tools/make-asset-shapes.mjs` 从 `assets.js` 生成，构建前会 `--check` 校验 |
| `src/styles/` | 六个 CSS，按 `tools/build.mjs` 的 `STYLE_FILES` 顺序拼成 `dist/styles.css` | 见下方 CSS 规则 |
| `tools/` | 构建、沙盒、生成脚本、`version-bump.mjs` | |
| `docs/` | 文档、`笔记格式.md`、宣传素材 | |
| `dist/` `sandbox-vault/` `node_modules/` `dev/` | 构建产物 / 生成的沙盒仓库 / 依赖 / 私有测试工具 | 都被 git 忽略：不手改、不提交 |

## 验证命令（在仓库根）

```sh
npm ci                  # 新 worktree 先装依赖（不要用 npm install，除非任务就是改依赖）
npm run watch           # 改动后自动重建 dist/
npm run typecheck       # tsc --noEmit
npm run lint            # eslint .，必须 0 错误 0 警告
npm test                # 跑 dev/tools/test.mjs（8 个纯 Node 检查）
npm run build           # 先校验 asset-shapes.js，再构建 dist/main.js、styles.css、manifest.json
npm run check           # typecheck + lint + test + build，提交前必须全过
npm run sandbox         # 生成 sandbox-vault/（虚构数据）
node tools/build.mjs --deploy <沙盒仓库路径>   # 构建并装进该仓库 .obsidian/plugins/tideline/；路径不含 sandbox 会拒绝
```

**注意**：测试工具在 git 忽略的 `dev/` 里，公开仓库和新 worktree 都没有。没有 `dev/` 时 `npm test` 只打印“没有 dev/tools/test.mjs……跳过”并退出 0（`tools/test.mjs`）。**这不等于测试通过**，报告里必须写明“测试未运行”。

## Obsidian 红线

- `manifest.json` 的 `isDesktopOnly` 必须保持 `true`：`src/ai/acp.ts` 经 `window.require` 用 `child_process`/`fs`/`path`/`os` 并读 `process`；`src/main.ts` 的 `vaultRoot()` 用 `adapter.basePath`。
- Node 能力只能放在 AI/桌面专用路径（`src/ai/acp.ts` 一类），经 `window.require` 取；源码里不 `import` Node 模块（只允许 `import type`）。
- 资源清理一律交给 Obsidian：`registerEvent` / `registerDomEvent` / `registerInterval` / `register`。视图里挂在 document 上的监听用 `CompassView.registerDocEvent`（视图搬进弹出窗口时会跟过去）。原型模块经 `HOST.addEventListener` 登记，`HOST.detach()` 统一摘掉。
- 写文件只经 `src/data/source-obsidian.ts` 的 `obsidianWriter`：`app.fileManager.processFrontMatter`、`app.vault.process`、`fileManager.renameFile`、`fileManager.trashFile`、`vault.create`。读用 `metadataCache` + `vault.cachedRead`。不用 `vault.adapter` 写。（现存例外：`main.ts` 的 `readVaultFile` 给 AI 读文件用 `adapter.read`。）
- 不给 `innerHTML` / `outerHTML` / `insertAdjacentHTML` 赋值。DOM 用 `src/draw/dom.ts`（`h`、`svg`、`setNodes`）与 `src/draw/scene.ts` 建；用户输入只作文本节点或属性值。
- CSS：每条选择器带 `.compass-root` 前缀（唯一例外 `container.css:2` 的 Obsidian 视图容器），不加全局样式；不新增 `!important`（现存的各有原因，见 ARCHITECTURE）；固定的行内样式改成 CSS 类，行内只写算出来的值（位置、尺寸、自定义属性）。`STYLE_FILES` 顺序（fonts → reset → prototype → container → narrow → ai）有意义，不要调。
- 弹出窗口：元素所在的 document/window 用 `el.doc` / `el.win`（视图里 `this.root.doc` / `this.root.win`）；原型模块的动画帧用 `HOST.requestFrame` / `HOST.cancelFrame`；跨窗口判断类型用 `el.instanceOf(X)`，不用 `instanceof`；计时器写 `window.setTimeout` / `window.setInterval`。
- `data.json`（`saveData`）只存 `{clock}`（`main.ts` 的 `saveSettings`）。每台设备的设置、AI 对话列表走 `app.loadLocalStorage` / `saveLocalStorage`（键 `tideline-local`、`tideline-ai-conversations`）；日历缓存在 IndexedDB。新设置默认放本机存储，不进 `data.json`。
- 版本：`package.json` 与 `manifest.json` 的 `version` 必须相同，`versions.json` 登记 `版本 → minAppVersion`。只用 `npm version <x>`（由用户运行，钩子 `tools/version-bump.mjs` 自动同步并 `git add`）。发版时在 `src/changes.ts` 最前加一项（升级纸条读它）。

## TypeScript 约定

- 相对 import 带 `.ts` 后缀（素材 `.js`、`vendor/marked.mjs` 按原名）；只当类型用的写 `import type`（`verbatimModuleSyntax`）。
- 只用可擦除语法（`tsconfig.json` 的 `erasableSyntaxOnly`）：不用 `enum`、`namespace`、参数属性。类字段只声明类型时写 `declare`，在构造函数或 `onload`/`onOpen` 里赋值。
- 禁止 `@ts-ignore`、`@ts-expect-error`、`eslint-disable`。现在全仓库 0 处。`eslint.config.mjs` 只对 `src/settings.ts` 关了 `obsidianmd/settings-tab/prefer-setting-definitions` 一条，理由写在配置注释里；不要再加例外。
- 代码风格是刻意的紧凑写法（长单行、原型模块几乎不换行）。没有 Prettier，也不要加；不要格式化你没改的代码。

## 多 Agent 纪律

1. 开工先 `git status`、`git log -5 --oneline`，读 `docs/TASKS.md`，认领一张任务卡（先改 TASKS.md 并单独提交，见 TASKS.md 的流程）。
2. 一个任务一个分支 `agent/<工具>/<任务>`、一个 worktree。新 worktree 没有 `node_modules/` 和 `dev/`：先 `npm ci`；要用私有测试工具得回到主目录。
3. 只改任务卡“范围文件”里的文件。不顺手重构、不改无关注释、不格式化无关代码、不重命名 `rNN` 文件。
4. 高频冲突文件不碰，除非任务就是它：`package.json`、`package-lock.json`、`manifest.json`、`versions.json`，以及 `src/styles/prototype.css` 的大段改动。依赖升级单独成任务。
5. 提交前 `npm run check` 全过，并写明 `npm test` 是真的跑了还是被跳过。
6. 声称“行为不变”的改动，要在提交说明或任务卡里写清怎么证明不变（例如：`dist/main.js` 逐字节相同、哪些检查前后结果一致）。
7. 提交信息用英文、祈使句（`Fix …`、`Add …`），正文用 `-` 列要点；不加 `Co-Authored-By` 等署名行。
8. 不提交 `dist/`、`dev/`、`sandbox-vault/`、`node_modules/`；会进公开仓库的文件里不写本机路径、用户名、邮箱。
9. 动高风险区（HANDOFF.md 列出）之前，先读 ARCHITECTURE.md 的 ADR 一节，确认不会删掉其中的逻辑。
