// ESLint：按 eslint-plugin-obsidianmd 文档“Plugins written in JavaScript”的基础写法。
// 还没转的 .js 只跑推荐规则（不加 parserOptions）；转成 .ts 的文件另外打开带类型的检查（用 tsconfig.json）。
import {defineConfig, globalIgnores} from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  globalIgnores(['node_modules', 'dist', 'dev', 'sandbox-vault', 'tools', 'docs', 'src/draw/proto/vendor']),
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}},
  },
]);
