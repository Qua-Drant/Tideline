// 界面把 HTML 字符串写进页面的唯一出口。各模块拼好的字符串（插值都已过 esc()）都经这几个函数写入，
// 以后换写入方式（例如 Obsidian 的 sanitizeHTMLToDom，或改成 DOM 构建）只改这一个文件。
// 现在的实现与直接写 innerHTML / insertAdjacentHTML / outerHTML 逐字等价：同样的解析（含父元素决定的上下文，
// 例如写进 <svg> 里按 SVG 解析）、同样的时机，不做任何过滤。
// 清空元素不经这里：用 el.replaceChildren()（DOM 标准方法，不解析 HTML）。

/** 等价于 el.innerHTML = html：换掉 el 的全部子节点 */
export function setHtml(el: Element, html: string): void {
  el.innerHTML = html;
}

/** 等价于 el.insertAdjacentHTML(position, html)：beforebegin / afterbegin / beforeend / afterend */
export function insertHtml(el: Element, position: InsertPosition, html: string): void {
  el.insertAdjacentHTML(position, html);
}

/** 等价于 el.outerHTML = html：用解析出来的节点换掉 el 自己（el 必须有父元素） */
export function replaceWithHtml(el: Element, html: string): void {
  el.outerHTML = html;
}
