// 全局类型声明。逐步转 TypeScript 期间，这个文件也让 `tsc --noEmit` 在还没有任何 .ts 源码时有输入可查。

/** 构建时由 tools/build.mjs 的 esbuild `define` 注入：赞赏码图片（data URL），按配色分。 */
declare const __TIDELINE_WECHAT_QR__: {paper?: string; night?: string} | undefined;
