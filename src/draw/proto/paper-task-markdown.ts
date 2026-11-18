import type {Model} from '../../data/types.ts';
// 第 4a 期：转 TypeScript。原来这里还有 taskMarkdown(a,t)：用 marked 把任务正文渲染成 HTML 字符串（innerHTML 解析后再用 outerHTML 换掉链接与勾选框），
// 它唯一的调用方是 paper-inline-editor-r15 的 html()，而 html() 只在原型自己的任务详情里用；插件里任务详情总由 task-plus.ts 装的 HOST.taskDetail 画
// （正文用 task-md-editor 的 Obsidian 编辑器），第 3e 期删掉了那段死分支，taskMarkdown 从此没有调用方，本期删去。这里只剩给示例任务补正文。
export function seedTaskMarkdown(d: Model){if(d.cache.taskMarkdownSeeded)return;d.cache.taskMarkdownSeeded=true;const bodies: Record<string,string>={
 'focus-method':'把三条关键假设写清楚，再核对符号和适用范围。\n\n## 让推理沿着一条线走\n\n先说明**我们比较的是什么**，再交代参考边界来自哪里。实现细节跟在假设后面，避免读者在两种定义之间来回猜。\n\n1. 写出输入、参照与输出各自的含义。\n2. 把适用条件放在方法之前。\n3. 让每一张对照图只回答一个问题。\n\n### 这一轮核对\n\n- [x] 分开屋檐与墙脚的参考定义\n- [ ] 统一图 3 与图 4 的符号\n- [ ] 补上不适用的两类情形\n\n> 先把假设写在纸上，再决定该补哪一张图。\n\n与 [[建筑轮廓对齐]] 对照，保留能够追溯到原始输入的判断。',
 'focus-results':'把对照结果连回同一套输入和参照。\n\n## 比较之前\n\n| 观察 | 先核对什么 |\n| --- | --- |\n| 轮廓整体偏移 | 配准与坐标约定 |\n| 局部边缘不一致 | 屋檐和墙脚的定义 |\n| 小目标断开 | 输入分辨率与覆盖范围 |\n\n- [ ] 保留原始轮廓，不覆盖上一轮结果\n- [ ] 给每张图留一句不带解释的观察\n\n回到 [[论文修改]]，只写证据能够支持的结论。',
 'inbox-01':'先留下一条简短的线索，再决定它属于哪一段工作。\n\n- [ ] 找到对应的输入\n- [ ] 写下需要核对的依据'
 };for(const t of d.tasks)if(t.markdown===undefined&&bodies[t.id])t.markdown=bodies[t.id];
}
