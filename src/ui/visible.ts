// 只走“看得见”的文字：遇到滚动区里整个落在可见范围之外的子元素，整棵子树跳过。
// 风景的文字遮罩、“还有 N 项”的整行收尾都要逐行量文字；长清单（几百行）里绝大多数行在滚动区外，不必量。
// visit(textNode, clipRect) —— clipRect 是这段文字所在的、各层滚动区可见范围的交集。
// 第 3c 期：转 TypeScript；树遍历器建在 root 所在的 document 里。

/** 可见范围（视口坐标） */
export interface Clip { top: number; bottom: number; left: number; right: number }

export function walkVisible(root: Element, visit: (text: Text, clip: Clip | null) => void): void{
  const clips = new Map<Element, Clip | null>(); // 元素 → 它里面内容的可见范围
  const clipOf = (el: Element | null): Clip | null => {
    if (!el || el === root) return null;
    if (clips.has(el)) return clips.get(el)!;
    let c = clipOf(el.parentElement);
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
      const r = el.getBoundingClientRect(), mine = {top: r.top, bottom: r.bottom, left: r.left, right: r.right};
      c = c ? {top: Math.max(c.top, mine.top), bottom: Math.min(c.bottom, mine.bottom), left: Math.max(c.left, mine.left), right: Math.min(c.right, mine.right)} : mine;
    }
    clips.set(el, c); return c;
  };
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {acceptNode(n){
    if (n.nodeType === 3) return n.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    const el = n as Element & {hidden?: boolean};
    if (el.hidden || el.tagName === 'svg' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
    const c = clipOf(el.parentElement);
    if (c) { const r = el.getBoundingClientRect(); if (r.bottom < c.top || r.top > c.bottom || r.right < c.left || r.left > c.right) return NodeFilter.FILTER_REJECT; }
    return NodeFilter.FILTER_SKIP;
  }});
  while (walker.nextNode()) visit(walker.currentNode as Text, clipOf(walker.currentNode.parentElement));
}
