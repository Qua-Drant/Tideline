// 今日页的写入。每个动作只改一个文件里的一处；写完由索引从来源的改动通知里更新，页面再重画。
// writer 由视图给：Obsidian 里是 source-obsidian.js 的 obsidianWriter，测试工具里是内存。
import {FOLDERS} from './index.js';
import {keepEol} from './frontmatter.js';

const dayPath = date => `${FOLDERS.journal}/${date}.md`;

export function todayActions(writer, clock){
  return {
    // 完成 / 重新打开任务不在这里：和任务页共用 data/complete.js，经 view.toggleTask 走 persist.js 写回（P1-2）
    async chooseFocus(task){
      let before;
      await writer.frontmatter(task.path, fm => { before = fm.focus; fm.focus = 1; });
      return () => writer.frontmatter(task.path, fm => {
        if (fm.focus !== 1) return;
        if (before === undefined) delete fm.focus;
        else fm.focus = before;
      });
    },
    // 习惯三态：没记 → 完成 → 没完成 → 没记（和原型一样点一下换一态）
    async cycleHabit(id){
      await writer.frontmatter(dayPath(clock().date), fm => { fm.habits ??= {}; const v = fm.habits[id]; if (v === undefined || v === null) fm.habits[id] = true; else if (v === true) fm.habits[id] = false; else delete fm.habits[id]; });
    },
    async score(id, value){ await writer.frontmatter(dayPath(clock().date), fm => { fm.scores ??= {}; fm.scores[id] = value; }); },
    // 随手记：追加到当天日记“## 随手记”的最后一行（没有这一节就在文末加上）
    async addJournal(text){
      const {date, time} = clock(), line = `- ${time} ${text.replace(/\n+/g, ' ').trim()}`;
      await writer.body(dayPath(date), text => keepEol(text, s => {
        const lines = s.split('\n'), at = lines.findIndex(l => /^##\s+随手记\s*$/.test(l));
        if (at < 0) return s.replace(/\n*$/, '') + (s.trim() ? '\n\n' : '') + '## 随手记\n' + line + '\n';
        let end = at + 1; while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
        let last = end; while (last > at + 1 && !lines[last - 1].trim()) last--;
        lines.splice(last, 0, line); return lines.join('\n');
      }), '---\n---\n');
    },
  };
}
