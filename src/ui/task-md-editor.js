// 任务详情的正文编辑器：在 Obsidian 里用它自带的 Markdown 编辑器（实时预览，写的时候就渲染，和普通笔记一样；
// [[ 补全、粗体快捷键、列表续行都是 Obsidian 的），浏览器样机里退回一个会自动长高的文本框。
//
// 编辑器只建一个，跟着当前打开的任务换内容。原型每次重画都会替换整张详情的 HTML，
// 所以编辑器的节点留在这里，重画后由 attach() 挪回详情里的占位（.task-md-host），光标和撤销记录都还在。
//
// 拿 Obsidian 编辑器的办法与 Kanban 等插件相同：借一个内嵌 Markdown 的实例，取它编辑模式的类。
// 这是 Obsidian 未公开的接口：取不到时（版本变化、样机里）就用文本框，功能少一些但不会坏。

let EditorClass; // undefined：还没试；null：取不到

function obsidianEditorClass(app){
  if (EditorClass !== undefined) return EditorClass;
  EditorClass = null;
  try {
    const make = app?.embedRegistry?.embedByExtension?.md; if (!make) return null;
    const md = make({app, containerEl: document.createElement('div'), state: {}}, null, '');
    md.load(); md.editable = true; md.showEditor();
    EditorClass = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor || null;
    md.unload();
  } catch (e) { console.warn('潮线：取不到 Obsidian 编辑器，任务正文改用文本框', e); EditorClass = null; }
  return EditorClass;
}

// 编辑器对外的统一接口（两种实现都提供）：
//   el                   要挂进详情的节点
//   get() / set(text)    取 / 换整段正文
//   focus() hasFocus()
//   line() → {n, text, ch}         光标所在行与列
//   replaceLine(n, text, ch)        换掉一整行并把光标放到 ch
//   replace(fromCh, toCh, text)     在当前行里换一段
//   wrap(before, after)             给选中的字包上标记（没选中就插一对并把光标放中间）
//   caret() → {left, top, bottom}   光标在屏幕上的位置（放“/”菜单）
export function createMdEditor(view, {onChange, onBlur}){
  const app = view.app;
  const Base = obsidianEditorClass(app);
  let currentId = null, suppress = false;
  const host = document.createElement('div');
  host.className = 'task-md-editor';
  // 重画时节点会被摘下又挂回：只有挂着的时候焦点真的离开了，才算“离开编辑器”（这时保存）
  let wanted = false;
  host.addEventListener('focusin', () => { wanted = true; });
  host.addEventListener('focusout', () => setTimeout(() => { if (host.isConnected && !host.contains(document.activeElement)) { wanted = false; onBlur?.(); } }, 0));
  const api = Base ? obsidianEditor() : plainEditor();
  api.el = host; api.kind = Base ? 'obsidian' : 'plain';

  function obsidianEditor(){
    class TaskEditor extends Base {
      updateBottomPadding(){}
      onUpdate(update, changed){ super.onUpdate(update, changed); if (changed && !suppress) onChange(this.editor.getValue()); }
    }
    const owner = {
      app, scroll: 0, editMode: null,
      showSearch(){}, toggleMode(){}, onMarkdownScroll(){}, getMode: () => 'source',
      get editor(){ return owner.editMode?.editor; },
      get file(){ return currentId ? app.vault.getAbstractFileByPath(currentId) : null; },
      get path(){ return currentId || ''; },
    };
    const ed = new TaskEditor(app, host, owner);
    owner.editMode = ed;
    ed.editor?.cm?.contentDOM?.setAttribute('aria-label', '任务正文');
    host.addEventListener('focusin', () => { try { app.workspace.activeEditor = owner; } catch {} });
    // 离开正文就把“当前编辑器”还给 Obsidian，别让命令落到藏起来的任务正文上
    host.addEventListener('focusout', () => setTimeout(() => { if (!host.contains(document.activeElement)) try { if (app.workspace.activeEditor === owner) app.workspace.activeEditor = null; } catch {} }, 0));
    const E = () => ed.editor;
    return {
      get: () => E().getValue(),
      set(text){ suppress = true; try { ed.set(text, false); } finally { suppress = false; } },
      focus(){ E().focus(); },
      hasFocus: () => host.contains(document.activeElement),
      line(){ const c = E().getCursor(); return {n: c.line, ch: c.ch, text: E().getLine(c.line)}; },
      replaceLine(n, text, ch){ E().replaceRange(text, {line: n, ch: 0}, {line: n, ch: E().getLine(n).length}); E().setCursor({line: n, ch: ch ?? text.length}); },
      replace(from, to, text){ const n = E().getCursor().line; E().replaceRange(text, {line: n, ch: from}, {line: n, ch: to}); E().setCursor({line: n, ch: from + text.length}); },
      wrap(before, after){ const s = E().getSelection(); E().replaceSelection(before + s + after); if (!s) { const c = E().getCursor(); E().setCursor({line: c.line, ch: c.ch - after.length}); } E().focus(); },
      insertBlock(text){ const c = E().getCursor(), line = E().getLine(c.line); const pre = line.trim() ? '\n' : ''; E().replaceRange(pre + text + '\n', {line: c.line, ch: line.length}); E().setCursor({line: c.line + (pre ? 2 : 1), ch: 0}); E().focus(); },
      remeasure(){ try { E().cm?.requestMeasure(); } catch {} },
      caret(){ const cm = E().cm, r = cm?.coordsAtPos(cm.state.selection.main.head); return r ? {left: r.left, top: r.top, bottom: r.bottom} : host.getBoundingClientRect(); },
      destroy(){ try { ed.unload?.(); } catch {} try { ed.destroy?.(); } catch {} },
    };
  }

  function plainEditor(){
    const ta = document.createElement('textarea');
    ta.className = 'task-md-plain'; ta.spellcheck = false; ta.rows = 3;
    ta.setAttribute('aria-label', '任务正文'); ta.placeholder = '写点什么，或打 / 插入标题、列表、检查项……';
    host.append(ta);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(72, ta.scrollHeight + 2) + 'px'; };
    ta.addEventListener('input', () => { grow(); if (!suppress) onChange(ta.value); });
    const pos = () => { const before = ta.value.slice(0, ta.selectionStart), lines = before.split('\n'); return {n: lines.length - 1, ch: lines[lines.length - 1].length}; };
    const offset = (n, ch) => ta.value.split('\n').slice(0, n).reduce((s, l) => s + l.length + 1, 0) + ch;
    const edit = (start, end, text, caret) => { ta.setRangeText(text, start, end, 'end'); if (caret != null) ta.setSelectionRange(caret, caret); grow(); onChange(ta.value); };
    return {
      get: () => ta.value,
      set(text){ suppress = true; ta.value = text; suppress = false; requestAnimationFrame(grow); },
      focus(){ ta.focus({preventScroll: true}); },
      hasFocus: () => document.activeElement === ta,
      line(){ const p = pos(); return {...p, text: ta.value.split('\n')[p.n]}; },
      replaceLine(n, text, ch){ const start = offset(n, 0), end = start + ta.value.split('\n')[n].length; edit(start, end, text, start + (ch ?? text.length)); },
      replace(from, to, text){ const p = pos(), start = offset(p.n, from); edit(start, offset(p.n, to), text, start + text.length); },
      wrap(before, after){ const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e); edit(s, e, before + sel + after, sel ? s + before.length + sel.length + after.length : s + before.length); ta.focus(); },
      insertBlock(text){ const p = pos(), line = ta.value.split('\n')[p.n], end = offset(p.n, line.length), pre = line.trim() ? '\n' : ''; edit(end, end, pre + text + '\n', end + pre.length + text.length + 1); ta.focus(); },
      caret(){ const r = ta.getBoundingClientRect(), lh = parseFloat(getComputedStyle(ta).lineHeight) || 22, p = pos(); const top = r.top + 6 + p.n * lh - ta.scrollTop; return {left: r.left + 12, top, bottom: top + lh}; },
      destroy(){},
    };
  }

  // 把编辑器放进这一次重画出来的占位里；换了任务就换内容，同一任务且正在编辑时不动（编辑器里的才是最新的）
  api.attach = (slot, t) => {
    const text = t.markdown ?? t.description ?? '';
    if (currentId !== t.id) { currentId = t.id; wanted = false; api.set(text); }
    else if (!wanted && api.get() !== text) api.set(text);
    if (host.parentElement !== slot) { slot.append(host); api.remeasure?.(); }
    const lost = !document.activeElement || document.activeElement === document.body;
    if (wanted && lost) api.focus();
  };
  api.taskId = () => currentId;
  api.editing = () => wanted;
  return api;
}
