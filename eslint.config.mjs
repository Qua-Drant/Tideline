// ESLint：按 eslint-plugin-obsidianmd 文档“Plugins written in JavaScript”的基础写法。
// 源码都是 TypeScript，带类型的检查用 tsconfig.json；只剩两份素材数据还是 .js（src/draw/proto/assets.js 手工维护、asset-shapes.js 由 tools/make-asset-shapes.mjs 生成，
// 生成脚本用 Node 直接读 assets.js），它们只跑推荐规则（不加 parserOptions）。
import {defineConfig, globalIgnores} from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  globalIgnores(['node_modules', 'dist', 'dev', 'sandbox-vault', 'tools', 'docs', 'src/draw/proto/vendor']),
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}},
  },
  {
    // Obsidian 自带设置页里潮线的那一块（src/settings.ts）只放三样，照旧用 display() 画：改成 getSettingDefinitions() 的声明式写法后由 Obsidian 来画，
    // 界面与行为都会变（那几行进设置搜索、按钮与下拉框换成框架的画法，display() 不再被调用），超出“行为不变”的范围，所以只对这一个文件关掉这条建议
    files: ['src/settings.ts'],
    rules: {'obsidianmd/settings-tab/prefer-setting-definitions': 'off'},
  },
]);
