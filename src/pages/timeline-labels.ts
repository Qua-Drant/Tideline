export interface TimelineLabel {
  anchor: number;
  width: number;
}

// Pack measured labels rather than estimating title lengths. Buoys remain at their
// original times; only the captions move into lanes below the time ticks.
export function packTimelineLabels(items: TimelineLabel[], availableWidth: number) {
  const padding = Math.min(8, Math.max(0, availableWidth / 4));
  const maxWidth = Math.max(1, Math.min(360, availableWidth - padding * 2));
  const lanes: {left: number; right: number}[][] = [];
  const result = items.map((item, index) => {
    const width = Math.min(maxWidth, Math.max(1, item.width));
    const left = Math.max(padding, Math.min(item.anchor + 24, availableWidth - padding - width));
    return {index, left, width, lane: 0, right: left + width};
  });
  for (const label of [...result].sort((a, b) => a.left - b.left || a.index - b.index)) {
    let lane = lanes.findIndex(intervals => intervals.every(other => label.right + 16 <= other.left || label.left >= other.right + 16));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    label.lane = lane;
    lanes[lane].push(label);
  }
  return {labels: result, lanes: lanes.length};
}

export function layoutTimelineLabels(timeline: HTMLElement) {
  const copies = [...timeline.querySelectorAll<HTMLElement>('.event-copy')];
  if (!copies.length) { timeline.style.height = ''; return; }
  const bounds = timeline.getBoundingClientRect();
  if (bounds.width <= 0) return;
  // Remove the previous truncation before measuring; resizing must restore titles
  // when room becomes available, including when the webfont finishes loading.
  for (const [index, copy] of copies.entries()) {
    copy.classList.remove('is-clipped', 'is-terse', 'is-bare');
    copy.classList.add('is-measuring');
    const event = copy.parentElement!;
    // Number both ends before measuring so the badge is included in caption width.
    for (const [parent, className] of [[event, 'event-anchor-number'], [copy, 'event-caption-number']] as const) {
      let badge = parent.querySelector<HTMLElement>('.' + className);
      if (!badge) { badge = parent.ownerDocument.createElement('span'); badge.className = className; badge.setAttribute('aria-hidden', 'true'); parent.prepend(badge); }
      badge.textContent = String(index + 1);
    }
  }
  const measured = copies.map(copy => ({
    anchor: copy.parentElement!.querySelector('.event-icon')!.getBoundingClientRect().left + 14 - bounds.left,
    width: copy.getBoundingClientRect().width,
  }));
  const packed = packTimelineLabels(measured, bounds.width);
  const anchorBadges = packTimelineLabels(measured.map(item => ({anchor: item.anchor - 33, width: 18})), bounds.width);
  for (const label of anchorBadges.labels) {
    const event = copies[label.index].parentElement!;
    const badge = event.querySelector<HTMLElement>('.event-anchor-number')!;
    badge.style.left = `${label.left - (event.getBoundingClientRect().left - bounds.left)}px`;
    badge.style.top = `${-6 - label.lane * 24}px`;
  }
  // Reserve space above the waterline for stacked anchor badges too.
  timeline.style.marginTop = `${Math.max(22, (anchorBadges.lanes - 1) * 24 + 14)}px`;
  const rowHeight = Math.max(34, ...copies.map(copy => Math.ceil(copy.getBoundingClientRect().height) + 10));
  for (const label of packed.labels) {
    const copy = copies[label.index], event = copy.parentElement!;
    copy.classList.remove('is-measuring');
    const eventLeft = event.getBoundingClientRect().left - bounds.left;
    const top = 106 + label.lane * rowHeight;
    copy.style.left = `${label.left - eventLeft}px`;
    copy.style.top = `${top}px`;
    copy.style.width = `${label.width}px`;
    copy.style.maxWidth = `${label.width}px`;
    event.style.setProperty('--timeline-caption-top', `${top}px`);
    event.title = event.getAttribute('aria-label') || copy.textContent || '';
  }
  timeline.style.height = `${Math.max(156, 106 + packed.lanes * rowHeight + 18)}px`;
}
