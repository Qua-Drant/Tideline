// iCal（.ics）解析与展开（设计说明 21.4 “私密 · 日历订阅”、22.3 第 4 步）。不依赖 Obsidian，单独可测。
//   parseICS(text)            → {name, events: [VEVENT 的要点]}，只留时间轴用得上的字段
//   occurrences(events, from, to) → 本机时区下 [from, to] 这几天里的每一次发生：{uid, date, time, end, allDay, title, description}
// 支持：折行、转义；DTSTART/DTEND 的三种写法（UTC 的 Z、带 TZID、浮动）与全天（VALUE=DATE）；DURATION；
// RRULE 的 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY、INTERVAL、COUNT、UNTIL、BYDAY（含 1MO、-1FR 这种序数）、BYMONTHDAY、BYMONTH；
// EXDATE；RECURRENCE-ID（单次改期覆盖原来那一次）；STATUS:CANCELLED 不显示。
// 时区：TZID 用浏览器的 Intl 换算（含夏令时）；Outlook 常用的 Windows 时区名换成 IANA 名；认不出的时区当作本机时间。

const WIN_TZ = {'China Standard Time': 'Asia/Shanghai', 'Taipei Standard Time': 'Asia/Taipei', 'Tokyo Standard Time': 'Asia/Tokyo', 'Korea Standard Time': 'Asia/Seoul',
  'Singapore Standard Time': 'Asia/Singapore', 'UTC': 'UTC', 'GMT Standard Time': 'Europe/London', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest', 'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles', 'AUS Eastern Standard Time': 'Australia/Sydney', 'India Standard Time': 'Asia/Kolkata'};
const DAY = 86400000, WD = {SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6};
const pad = n => String(n).padStart(2, '0');

// —— 文本 → 属性行 ——
function lines(text){
  const raw = String(text).replace(/\r\n?/g, '\n').split('\n'), out = [];
  for (const l of raw) { if ((l[0] === ' ' || l[0] === '\t') && out.length) out[out.length - 1] += l.slice(1); else if (l) out.push(l); }
  return out.map(l => {
    let i = 0, q = false; for (; i < l.length; i++) { const c = l[i]; if (c === '"') q = !q; else if (c === ':' && !q) break; }
    const head = l.slice(0, i), value = l.slice(i + 1), [name, ...ps] = head.split(';'), params = {};
    for (const p of ps) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
    return {name: name.toUpperCase(), params, value};
  });
}
const unescape = s => s.replace(/\\([nN,;\\])/g, (_, c) => c === 'n' || c === 'N' ? '\n' : c);

// 时刻：{wall: 以 UTC 数字存的“墙上时间”毫秒数, tz: 'Z' | IANA 名 | null（浮动）, allDay}
function parseTime(prop){
  if (!prop) return null;
  const v = prop.value.trim(), m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v); if (!m) return null;
  const allDay = !m[4] || prop.params.VALUE === 'DATE';
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], allDay ? 0 : +m[4], allDay ? 0 : +m[5], allDay ? 0 : +(m[6] || 0));
  let tz = m[7] ? 'Z' : prop.params.TZID ? (WIN_TZ[prop.params.TZID] || prop.params.TZID) : null;
  if (tz && tz !== 'Z' && !validTz(tz)) tz = null;
  return {wall, tz: allDay ? null : tz, allDay};
}
const tzCache = new Map();
function validTz(tz){ if (!tzCache.has(tz)) { try { tzCache.set(tz, new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'})); } catch { tzCache.set(tz, null); } } return !!tzCache.get(tz); }
// 某一瞬间在 tz 里比 UTC 快多少毫秒
// 0.9.2：从本机缓存读回的日程没经过这次解析，时区格式器可能还没建，先补建（以前这里直接用缓存里的格式器，重开 Obsidian 后带时区的日程一展开就出错，日历整个不显示、“正在刷新”不收起）
function offset(ms, tz){ if (!tzCache.get(tz)) validTz(tz); const f = tzCache.get(tz), p = {}; for (const x of f.formatToParts(new Date(ms))) p[x.type] = +x.value; return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; }
// 墙上时间 → 真实瞬间（毫秒）
function instant(wall, tz){
  if (tz === 'Z') return wall;
  if (tz && !validTz(tz)) tz = null; // 这台电脑不认识的时区按本地时间
  if (!tz) { const d = new Date(wall); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getTime(); }
  let t = wall - offset(wall, tz); t = wall - offset(t, tz); return t;
}
function duration(v){ const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec((v || '').trim()); if (!m) return null; const ms = ((+m[2] || 0) * 7 * DAY) + (+m[3] || 0) * DAY + (+m[4] || 0) * 3600000 + (+m[5] || 0) * 60000 + (+m[6] || 0) * 1000; return m[1] === '-' ? -ms : ms; }
function parseRule(v){
  const r = {}; for (const part of v.split(';')) { const [k, x] = part.split('='); if (k && x !== undefined) r[k.toUpperCase()] = x; }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.FREQ)) return null;
  const until = r.UNTIL ? parseTime({value: r.UNTIL, params: /T/.test(r.UNTIL) ? {} : {VALUE: 'DATE'}}) : null;
  return {freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1), count: r.COUNT ? +r.COUNT : null, until,
    byday: r.BYDAY ? r.BYDAY.split(',').map(s => { const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(s.trim()); return m ? {n: m[1] ? +m[1] : 0, wd: WD[m[2]]} : null; }).filter(Boolean) : null,
    bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : null, bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number).filter(Boolean) : null};
}

export function parseICS(text){
  const props = lines(text); let name = '', cur = null, depth = 0; const events = [];
  if (!props.some(p => p.name === 'BEGIN' && /^VCALENDAR$/i.test(p.value))) throw new Error('不是 iCal 日历（没有 BEGIN:VCALENDAR）');
  for (const p of props) {
    if (p.name === 'BEGIN') { if (/^VEVENT$/i.test(p.value) && !cur) { cur = {props: {}, exdates: []}; depth = 0; } else if (cur) depth++; continue; }
    if (p.name === 'END') { if (cur && /^VEVENT$/i.test(p.value) && !depth) { events.push(cur); cur = null; } else if (cur) depth--; continue; }
    if (!cur) { if (p.name === 'X-WR-CALNAME') name = unescape(p.value); continue; }
    if (depth) continue; // VALARM 等子块
    if (p.name === 'EXDATE') { for (const v of p.value.split(',')) { const t = parseTime({value: v, params: p.params}); if (t) cur.exdates.push(t); } continue; }
    cur.props[p.name] ??= p;
  }
  const out = [];
  for (const e of events) {
    const P = e.props, start = parseTime(P.DTSTART); if (!start) continue;
    if ((P.STATUS?.value || '').toUpperCase() === 'CANCELLED' && !P['RECURRENCE-ID']) continue;
    const end = parseTime(P.DTEND), dur = P.DURATION ? duration(P.DURATION.value) : null;
    const length = end ? instant(end.wall, end.tz) - instant(start.wall, start.tz) : dur ?? (start.allDay ? DAY : 0);
    const rid = parseTime(P['RECURRENCE-ID']);
    out.push({uid: P.UID?.value || 'no-uid-' + out.length, title: unescape(P.SUMMARY?.value || '（无标题）').trim(), description: unescape(P.DESCRIPTION?.value || '').trim(),
      start, length, rule: P.RRULE ? parseRule(P.RRULE.value) : null, exdates: e.exdates, rid, cancelled: (P.STATUS?.value || '').toUpperCase() === 'CANCELLED'});
  }
  return {name, events: out};
}

// 一条重复规则在墙上时间里的候选（升序），超过 limitWall 就停
function* expand(ev, limitWall, lowWall){
  const r = ev.rule, s = new Date(ev.start.wall), h = s.getUTCHours(), mi = s.getUTCMinutes(), se = s.getUTCSeconds();
  // 每天重复、又没有次数限制的：直接跳到窗口前一点（否则多年前开始的规则会先数完 5000 轮）
  const k0 = r.freq === 'DAILY' && r.count === null && lowWall > ev.start.wall ? Math.max(0, Math.floor((lowWall - ev.start.wall) / (r.interval * DAY)) - 2) : 0;
  const at = (y, mo, d) => Date.UTC(y, mo, d, h, mi, se), dim = (y, mo) => new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const untilWall = r.until ? (r.until.tz === 'Z' && ev.start.tz !== 'Z' ? null : r.until.wall + (r.until.allDay ? DAY - 1 : 0)) : null;
  const untilInstant = r.until && untilWall === null ? r.until.wall : null;
  let n = 0;
  for (let k = k0; k < k0 + 5000; k++) {
    let cands = [];
    if (r.freq === 'DAILY') { const d = new Date(ev.start.wall + k * r.interval * DAY); cands = [d.getTime()]; }
    else if (r.freq === 'WEEKLY') { const base = ev.start.wall + k * r.interval * 7 * DAY, wd = (new Date(base).getUTCDay() + 6) % 7, monday = base - wd * DAY;
      cands = r.byday ? r.byday.map(b => monday + ((b.wd + 6) % 7) * DAY) : [base]; }
    else if (r.freq === 'MONTHLY') { const y = s.getUTCFullYear(), mo0 = s.getUTCMonth() + k * r.interval, Y = y + Math.floor(mo0 / 12), M = ((mo0 % 12) + 12) % 12, len = dim(Y, M);
      if (r.byday) { for (const b of r.byday) { const days = []; for (let d = 1; d <= len; d++) if (new Date(Date.UTC(Y, M, d)).getUTCDay() === b.wd) days.push(d); const pick = b.n ? [days[b.n > 0 ? b.n - 1 : days.length + b.n]] : days; for (const d of pick) if (d) cands.push(at(Y, M, d)); } }
      else { for (const md of r.bymonthday || [s.getUTCDate()]) { const d = md > 0 ? md : len + md + 1; if (d >= 1 && d <= len) cands.push(at(Y, M, d)); } } }
    else { const Y = s.getUTCFullYear() + k * r.interval;
      for (const M of r.bymonth ? r.bymonth.map(x => x - 1) : [s.getUTCMonth()]) {
        const len = dim(Y, M);
        if (r.byday) { for (const b of r.byday) { const days = []; for (let d = 1; d <= len; d++) if (new Date(Date.UTC(Y, M, d)).getUTCDay() === b.wd) days.push(d); const pick = b.n ? [days[b.n > 0 ? b.n - 1 : days.length + b.n]] : days; for (const d of pick) if (d) cands.push(at(Y, M, d)); } }
        else for (const md of r.bymonthday || [s.getUTCDate()]) { const d = md > 0 ? md : len + md + 1; if (d >= 1 && d <= len) cands.push(at(Y, M, d)); } } }
    cands = [...new Set(cands)].sort((a, b) => a - b);
    if (r.freq === 'DAILY' && r.bymonth) cands = cands.filter(c => r.bymonth.includes(new Date(c).getUTCMonth() + 1));
    if (r.freq === 'DAILY' && r.byday) cands = cands.filter(c => r.byday.some(b => b.wd === new Date(c).getUTCDay()));
    let past = false;
    for (const c of cands) {
      if (c < ev.start.wall) continue;
      if (untilWall !== null && c > untilWall) return;
      if (untilInstant !== null && instant(c, ev.start.tz) > untilInstant) return;
      if (r.count !== null && n >= r.count) return;
      n++; if (c > limitWall) { past = true; break; } yield c;
    }
    if (past) return;
  }
}

const local = ms => { const d = new Date(ms); return {date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`}; };
const wallDate = w => new Date(w).toISOString().slice(0, 10);

// from、to：'YYYY-MM-DD'（本机日期，含两端）
export function occurrences(events, from, to){
  const [fy, fm, fd] = from.split('-').map(Number), [ty, tm, td] = to.split('-').map(Number);
  const lo = new Date(fy, fm - 1, fd).getTime(), hi = new Date(ty, tm - 1, td + 1).getTime();
  const overrides = new Map(); // uid → 被单独改过的那几次（原定时刻）
  for (const e of events) if (e.rid) { const m = overrides.get(e.uid) || new Set(); m.add(instant(e.rid.wall, e.rid.tz ?? e.start.tz)); m.add(e.rid.wall); overrides.set(e.uid, m); }
  const out = [];
  const push = (e, wall) => {
    if (e.start.allDay) { const d = wallDate(wall); for (let t = wall; t < wall + Math.max(DAY, e.length); t += DAY) { const dd = wallDate(t); const [y, m, x] = dd.split('-').map(Number), ms = new Date(y, m - 1, x).getTime(); if (ms >= lo && ms < hi) out.push({uid: e.uid, date: dd, time: '', end: '', allDay: true, title: e.title, description: e.description, first: d}); } return; }
    const t = instant(wall, e.start.tz); if (t + Math.max(e.length, 0) < lo || t >= hi) return;
    const a = local(t), b = local(t + Math.max(e.length, 0));
    if (t >= lo) out.push({uid: e.uid, date: a.date, time: a.time, end: e.length > 0 ? b.time : '', allDay: false, title: e.title, description: e.description});
  };
  for (const e of events) {
    if (e.cancelled) continue;
    if (e.rid || !e.rule) { push(e, e.start.wall); continue; }
    const ex = new Set(e.exdates.flatMap(x => x.allDay ? [x.wall] : [x.wall, instant(x.wall, x.tz ?? e.start.tz)])), ov = overrides.get(e.uid);
    // 墙上时间与本机时间最多差一天多（时区差），两头各多留两天
    for (const w of expand(e, hi + 2 * DAY, lo - 2 * DAY)) {
      const t = instant(w, e.start.tz);
      if (ex.has(w) || ex.has(t) || (e.start.allDay && ex.has(Date.UTC(new Date(w).getUTCFullYear(), new Date(w).getUTCMonth(), new Date(w).getUTCDate())))) continue;
      if (ov && (ov.has(t) || ov.has(w))) continue;
      push(e, w);
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')));
}
