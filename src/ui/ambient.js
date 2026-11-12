// 每页的手绘动态（0.3，使用者 2026-11-08）：风景里几处小东西轻轻动（灯光、海鸟、云、水、小船、提灯、邮包、罗经、羽毛笔、铅锤、深海生物、珊瑚）。
// 这些元素多半用 transform 属性定位；CSS 动画的 transform 会盖掉它。所以给每个元素外面套一层新的 <g data-ambient="…">，
// 只让外层动：外层的 fill-box 包含了里面元素自己的位移，转动和起伏的支点也就落在元素自己身上。
// 动画本身在 container.css（steps() 约 6 帧/秒；过场关闭或系统减少动态效果时停下）。
const KINDS = [
  ['[data-morph="lamp-glow"]', 'glow'], ['[data-seabird]', 'glide'], ['[data-guidance-clouds]', 'drift'], ['[data-guidance-water]', 'lap'],
  ['[data-r12-boat]', 'bob'], ['[data-r12-reflection]', 'shimmer'], ['[data-cargo-lantern]', 'swing'], ['[data-cargo-sack]', 'sway'],
  ['[data-chart-compass]', 'wobble'], ['[data-cabin-lantern]', 'swing'], ['[data-cabin-quill]', 'quill'], ['[data-cabin-curtain]', 'sway'],
  ['[data-morph="sounding-weight"]', 'plumb'], ['[data-library-life]', 'float'], ['[data-brain-coral]', 'tree'], ['[data-brain-halo]', 'glow'],
];
const SELECTOR = KINDS.map(k => k[0]).join(',');
const NS = 'http://www.w3.org/2000/svg';

export function wrapAmbient(svg){
  let n = 0;
  for (const el of svg.querySelectorAll(SELECTOR)) {
    if (el.parentNode?.dataset?.ambient) continue;
    const kind = KINDS.find(([s]) => el.matches(s))[1], g = document.createElementNS(NS, 'g');
    g.dataset.ambient = kind; g.style.setProperty('--ambient-delay', `${-(n++ * 1.37) % 5}s`);
    el.replaceWith(g); g.append(el);
  }
}
