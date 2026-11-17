// R39 的远岸先逐笔落墨，再让云、鸟与水纹缓缓动两轮。
// 第 3c 期：转 TypeScript；遮罩元素用 dom.ts 的 svg 建在风景所在的 document 里（属性顺序与原来逐个 setAttribute 相同）。
import {svg as svgEl, within} from '../draw/dom.ts';
import type {DayView} from '../data/types.ts';

const INK_MS = 1400, CYCLE_MS = 6000;
const MOTION: Record<string, Keyframe[]> = {
  cloud: [{transform: 'translateX(0)'}, {transform: 'translateX(5px)'}, {transform: 'translateX(0)'}],
  birds: [{transform: 'none'}, {transform: 'translate(-3px,-2px) scaleY(.88)'}, {transform: 'none'}],
  water: [{transform: 'translateX(0)', opacity: 1}, {transform: 'translateX(4px)', opacity: .68}, {transform: 'translateX(0)', opacity: 1}],
};

export function createTodayReward(){
  let date: string | null = null, start = 0, scene: Element | null = null, defs: SVGDefsElement | null = null, strokes: SVGGraphicsElement[] = [], animations: Animation[] = [];
  function leave(){
    for (const animation of animations) animation.cancel();
    for (const stroke of strokes) stroke.removeAttribute('mask');
    defs?.remove();
    scene = defs = null;
    strokes = []; animations = [];
  }
  function settle(){ start = -Infinity; leave(); }
  function show(svg: SVGSVGElement, day: DayView, enabled: boolean){
    if (!day.allDone) { date = null; if (scene) leave(); return; }
    if (date !== day.date) { date = day.date; start = performance.now(); }
    if (!enabled) { settle(); return; }
    const elapsed = performance.now() - start;
    const target = svg.querySelector('[data-r14-completed]');
    if (!target || scene === target || elapsed >= INK_MS + 2 * CYCLE_MS) return;
    leave();
    scene = target;
    if (elapsed < INK_MS) {
      strokes = [...target.querySelectorAll<SVGGraphicsElement>('[data-draw-path]')];
      const doc = svg.ownerDocument, d = defs = within(doc, () => svgEl('defs'));
      target.prepend(d);
      const marks = strokes.map((stroke, index) => {
        const {x, y, width, height} = stroke.getBBox();
        const id = 'compass-completion-ink-' + index;
        const path = within(doc, () => svgEl('path', {d: stroke.dataset.drawPath, fill: 'none', stroke: 'white', 'stroke-width': Number(stroke.dataset.drawWidth) * 3 + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
        const mask = within(doc, () => svgEl('mask', {id, maskUnits: 'userSpaceOnUse', x: x - 10, y: y - 10, width: width + 20, height: height + 20}, path));
        d.append(mask);
        const length = path.getTotalLength();
        path.setAttribute('stroke-dasharray', `${length} ${length}`);
        stroke.setAttribute('mask', `url(#${id})`);
        return {path, length, weight: Math.sqrt(Math.max(1, length))};
      });
      const total = marks.reduce((sum, mark) => sum + mark.weight, 0);
      let delay = 0;
      for (const {path, length, weight} of marks) {
        const duration = INK_MS * weight / total;
        const animation = path.animate([{strokeDashoffset: String(length), opacity: 0}, {strokeDashoffset: String(length), opacity: 1, offset: .001}, {strokeDashoffset: '0', opacity: 1}], {duration, delay, fill: 'both'});
        animation.currentTime = elapsed;
        animations.push(animation);
        delay += duration;
      }
    }
    for (const node of target.querySelectorAll<SVGElement>('[data-reward-motion]')) {
      const animation = node.animate(MOTION[node.dataset.rewardMotion!], {duration: CYCLE_MS, delay: INK_MS, iterations: 2, easing: 'ease-in-out'});
      animation.currentTime = elapsed;
      animations.push(animation);
    }
    // 没有一个动画时这里会抛错（原来就是这样，见第 3c 期报告）
    animations.at(-1)!.onfinish = () => { if (scene === target) leave(); };
  }
  return {show, leave, settle};
}
