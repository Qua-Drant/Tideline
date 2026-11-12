// R39 的远岸先逐笔落墨，再让云、鸟与水纹缓缓动两轮。
const INK_MS = 1400, CYCLE_MS = 6000;
const MOTION = {
  cloud: [{transform: 'translateX(0)'}, {transform: 'translateX(5px)'}, {transform: 'translateX(0)'}],
  birds: [{transform: 'none'}, {transform: 'translate(-3px,-2px) scaleY(.88)'}, {transform: 'none'}],
  water: [{transform: 'translateX(0)', opacity: 1}, {transform: 'translateX(4px)', opacity: .68}, {transform: 'translateX(0)', opacity: 1}],
};
const svgNode = (name, attrs) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

export function createTodayReward(){
  let date = null, start = 0, scene = null, defs = null, strokes = [], animations = [];
  function leave(){
    for (const animation of animations) animation.cancel();
    for (const stroke of strokes) stroke.removeAttribute('mask');
    defs?.remove();
    scene = defs = null;
    strokes = []; animations = [];
  }
  function settle(){ start = -Infinity; leave(); }
  function show(svg, day, enabled){
    if (!day.allDone) { date = null; if (scene) leave(); return; }
    if (date !== day.date) { date = day.date; start = performance.now(); }
    if (!enabled) { settle(); return; }
    const elapsed = performance.now() - start;
    const target = svg.querySelector('[data-r14-completed]');
    if (!target || scene === target || elapsed >= INK_MS + 2 * CYCLE_MS) return;
    leave();
    scene = target;
    if (elapsed < INK_MS) {
      strokes = [...scene.querySelectorAll('[data-draw-path]')];
      defs = svgNode('defs', {});
      scene.prepend(defs);
      const marks = strokes.map((stroke, index) => {
        const {x, y, width, height} = stroke.getBBox();
        const id = 'compass-completion-ink-' + index;
        const mask = svgNode('mask', {id, maskUnits: 'userSpaceOnUse', x: x - 10, y: y - 10, width: width + 20, height: height + 20});
        const path = svgNode('path', {d: stroke.dataset.drawPath, fill: 'none', stroke: 'white', 'stroke-width': Number(stroke.dataset.drawWidth) * 3 + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
        mask.append(path); defs.append(mask);
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
    for (const node of scene.querySelectorAll('[data-reward-motion]')) {
      const animation = node.animate(MOTION[node.dataset.rewardMotion], {duration: CYCLE_MS, delay: INK_MS, iterations: 2, easing: 'ease-in-out'});
      animation.currentTime = elapsed;
      animations.push(animation);
    }
    animations.at(-1).onfinish = () => { if (scene === target) leave(); };
  }
  return {show, leave, settle};
}
