// 任务输入的智能识别（货单输入框用；规则见 docs/滴答清单交互.md 的 P2）。纯函数，不碰 DOM。
//   日期：今天 明天 后天 大后天 周X/星期X（今天起的下一个）下周X 下周 下个月 N天后 M月D日 M/D YYYY-MM-DD
//   时刻：上午/下午/晚上/中午 H点(半|M分) 或 HH:MM
//   优先级：!高 !中 !低 !最高，或 !!! / !!
//   #名称：同名清单 → 清单；同名项目 → 项目；否则是标签。~名称 / ^名称：清单。@名称：待沟通的人
//   重复：每天 每周 每月 每年 工作日 每周X(X…) 每N天 每N周
// 识别出来的片段从标题里去掉；去完是空的就保留原文。
const pad = n => String(n).padStart(2, '0');
const iso = t => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
const at = date => new Date(date + 'T12:00:00Z');
export const addDays = (date, n) => { const t = at(date); t.setUTCDate(t.getUTCDate() + n); return iso(t); };
export const addMonths = (date, n) => { const t = at(date), day = t.getUTCDate(); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() + n); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(day, last)); return iso(t); };
const WEEK = '一二三四五六日天';
const weekday = ch => { const i = WEEK.indexOf(ch); return i < 0 ? null : i >= 6 ? 0 : i + 1; }; // 0 = 周日
const dow = date => at(date).getUTCDay();
const NUM = {零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10};
const num = s => { if (/^\d+$/.test(s)) return Number(s); if (s === '十') return 10; if (s.startsWith('十')) return 10 + (NUM[s[1]] || 0); if (s.endsWith('十')) return (NUM[s[0]] || 0) * 10; if (s.includes('十')) return (NUM[s[0]] || 0) * 10 + (NUM[s[2]] || 0); return NUM[s] ?? NaN; };

export const PRIORITIES = [['highest', '最高', '!!!'], ['high', '高', '!!'], ['medium', '中', ''], ['low', '低', '']];
export const REMINDERS = [['', '不提醒'], ['0', '准时'], ['5m', '提前 5 分钟'], ['30m', '提前 30 分钟'], ['1h', '提前 1 小时'], ['1d', '提前 1 天']];
export const REPEATS = ['每天', '每周', '每月', '每年', '工作日'];

// 重复规则的下一个日期（从 date 之后算起）；认不出的规则返回 null
export function nextRepeat(date, rule){
  if (!date || !rule) return null;
  const r = String(rule).trim();
  let m;
  if (r === '每天') return addDays(date, 1);
  if (r === '每月') return addMonths(date, 1);
  if (r === '每年') return addMonths(date, 12);
  if (r === '工作日' || r === '每个工作日') { let n = addDays(date, 1); while ([0, 6].includes(dow(n))) n = addDays(n, 1); return n; }
  if ((m = /^每(\d+|[一二两三四五六七八九十]+)天$/.exec(r))) return addDays(date, num(m[1]) || 1);
  if ((m = /^每(\d+|[一二两三四五六七八九十]+)(周|个月|月)$/.exec(r))) return m[2] === '周' ? addDays(date, 7 * (num(m[1]) || 1)) : addMonths(date, num(m[1]) || 1);
  if ((m = /^每周([一二三四五六日天、,，\s]+)$/.exec(r))) {
    const days = [...m[1]].map(weekday).filter(x => x !== null);
    if (!days.length) return addDays(date, 7);
    for (let i = 1; i <= 7; i++) { const n = addDays(date, i); if (days.includes(dow(n))) return n; }
  }
  if (r === '每周') return addDays(date, 7);
  return null;
}
// 某月里哪些天落在重复规则上（日历预览用）：从起始日期往后最多推 62 次
export function repeatDays(date, rule, month){
  const out = new Set(); if (!date || !rule) return out;
  let n = date; for (let i = 0; i < 62 && n && n.slice(0, 7) <= month; i++) { if (n.slice(0, 7) === month) out.add(n); n = nextRepeat(n, rule); }
  return out;
}

function nextWeekday(today, wd, nextWeek){
  if (nextWeek) { const monday = addDays(today, -((dow(today) + 6) % 7) + 7); return addDays(monday, (wd + 6) % 7); }
  for (let i = 0; i < 7; i++) { const n = addDays(today, i); if (dow(n) === wd) return n; }
  return today;
}

const DATE_RULES = [
  [/(大后天)/, (m, today) => addDays(today, 3)],
  [/(今天|今日)/, (m, today) => today],
  [/(明天|明日)/, (m, today) => addDays(today, 1)],
  [/(后天)/, (m, today) => addDays(today, 2)],
  [/下(?:周|星期|礼拜)([一二三四五六日天])/, (m, today) => nextWeekday(today, weekday(m[1]), true)],
  [/(?:周|星期|礼拜)([一二三四五六日天])/, (m, today) => nextWeekday(today, weekday(m[1]), false)],
  [/(下周|下星期)/, (m, today) => addDays(today, 7)],
  [/(下个月|下月)/, (m, today) => addMonths(today, 1)],
  [/(\d+|[一二两三四五六七八九十]+)天后/, (m, today) => addDays(today, num(m[1]))],
  [/(\d{4})-(\d{1,2})-(\d{1,2})/, m => `${m[1]}-${pad(m[2])}-${pad(m[3])}`],
  [/(\d{1,2})月(\d{1,2})[日号]?/, (m, today) => { let y = Number(today.slice(0, 4)); const s = `${y}-${pad(m[1])}-${pad(m[2])}`; return s < today ? `${y + 1}-${pad(m[1])}-${pad(m[2])}` : s; }],
  [/(?<![\d:])(\d{1,2})\/(\d{1,2})(?![\d/])/, (m, today) => { let y = Number(today.slice(0, 4)); const s = `${y}-${pad(m[1])}-${pad(m[2])}`; return s < today ? `${y + 1}-${pad(m[1])}-${pad(m[2])}` : s; }],
];
const TIME_RULE = /(上午|早上|中午|下午|傍晚|晚上)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*(?:点|时)\s*(半|(\d{1,2})\s*分?)?|(?<![\d/])(\d{1,2}):(\d{2})(?!\d)/;
const REPEAT_RULE = /(每天|每周[一二三四五六日天、，,]+|每周|每月|每年|工作日|每(?:\d+|[一二两三四五六七八九十]+)(?:天|周|个月))/;
const PRIORITY_RULE = /(?:^|\s)(!!!|!!|！！！|！！|[!！](最高|高|中|低))(?=\s|$)/;

const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(at(s)) === s;

// d：原型的数据（清单、项目、人物）。返回识别结果与片段（tokens：[{text, kind, label}]）
export function parseTask(raw, d, today){
  let text = ' ' + String(raw || '') + ' ';
  const out = {tokens: []};
  const take = (re, fn) => { const m = re.exec(text); if (!m) return null; const r = fn(m); if (r === false) return null; text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length); return m; };
  // 重复先认（“每周三”里也有“周三”）
  take(REPEAT_RULE, m => { out.repeat = m[1].replace(/[，,\s]/g, '、').replace(/、+$/, ''); out.tokens.push({text: m[1], kind: 'repeat', label: out.repeat}); });
  for (const [re, fn] of DATE_RULES) {
    if (out.date) break;
    take(re, m => { const v = fn(m, today); if (!valid(v)) return false; out.date = v; out.tokens.push({text: m[0], kind: 'date', label: v}); });
  }
  take(TIME_RULE, m => {
    let h, min;
    if (m[5] !== undefined) { h = Number(m[5]); min = Number(m[6]); }
    else { h = num(m[2]); min = m[3] === '半' ? 30 : m[4] ? Number(m[4]) : 0; if (['下午', '傍晚', '晚上'].includes(m[1]) && h < 12) h += 12; if (m[1] === '中午' && h < 6) h += 12; }
    if (!(h >= 0 && h < 24 && min >= 0 && min < 60)) return false;
    out.time = pad(h) + ':' + pad(min); out.tokens.push({text: m[0].trim(), kind: 'time', label: out.time});
  });
  if (out.repeat && !out.date) out.date = today;
  if (out.time && !out.date) out.date = today;
  take(PRIORITY_RULE, m => { const word = m[2] || (m[1].length >= 3 ? '最高' : '高'); const p = PRIORITIES.find(x => x[1] === word); if (!p) return false; out.priority = p[0]; out.tokens.push({text: m[1], kind: 'priority', label: '优先级' + p[1]}); });
  // #、~、^、@：名称里不含空白和这几个符号
  // 认得出的片段换成空格；认不出的（例如 @ 不是任何人）原样留在标题里
  text = text.replace(/(^|\s)([#~^@])([^\s#~^@!！]+)/g, (whole, space, sign, name) => {
    const list = d?.lists?.find(l => !l.archived && l.title === name), project = d?.projects?.find(p => p.title === name && p.status !== 'archived'), person = d?.people?.find(p => p.name === name);
    const token = sign + name;
    if ((sign === '~' || sign === '^' || sign === '#') && list) { out.listId = list.id; out.tokens.push({text: token, kind: 'list', label: '清单 · ' + name}); }
    else if (sign === '#' && project) { out.projectId = project.id; out.tokens.push({text: token, kind: 'project', label: '项目 · ' + name}); }
    else if (sign === '#') { (out.tags ??= []).includes(name) || out.tags.push(name); out.tokens.push({text: token, kind: 'tag', label: '#' + name}); }
    else if (sign === '@' && person) { (out.peopleIds ??= []).push(person.id); out.tokens.push({text: token, kind: 'person', label: '@' + name}); }
    else return whole;
    return space + ' ';
  });
  const title = text.replace(/\s+/g, ' ').trim();
  out.title = title || String(raw || '').trim();
  return out;
}

// 输入框光标前正在打的那个 #、~、^、@、! 片段：给补全纸条用
export function activeToken(value, caret){
  const before = value.slice(0, caret), m = /(?:^|\s)([#~^@!！])([^\s#~^@!！]*)$/.exec(before);
  return m ? {sign: m[1], query: m[2], start: caret - m[2].length - 1, end: caret} : null;
}
export function suggestions(token, d){
  if (!token) return [];
  const q = token.query, hit = s => !q || s.includes(q);
  if (token.sign === '!' || token.sign === '！') return PRIORITIES.filter(p => hit(p[1])).map(p => ({insert: '!' + p[1], label: '优先级 · ' + p[1]}));
  if (token.sign === '@') { const name = q.replace(/[\/:*?"<>|#^[\]]/g, '').trim(), list = d.people.filter(p => hit(p.name)).slice(0, 8).map(p => ({insert: '@' + p.name, label: '@' + p.name}));
    return name && !d.people.some(p => p.name === name) ? [...list, {insert: '@' + name, label: '新建人物“' + name + '”', create: name}] : list; } // 0.9：没有这个人时可以直接新建
  const lists = d.lists.filter(l => !l.archived && hit(l.title)).map(l => ({insert: token.sign + l.title, label: '清单 · ' + l.title}));
  if (token.sign !== '#') return lists.slice(0, 8);
  const projects = d.projects.filter(p => ['active', 'planned', 'paused'].includes(p.status) && hit(p.title)).map(p => ({insert: '#' + p.title, label: '项目 · ' + p.title}));
  const tags = [...new Set(d.tasks.flatMap(t => t.tags || []))].filter(hit).map(t => ({insert: '#' + t, label: '标签 · ' + t}));
  const all = [...lists, ...projects, ...tags].slice(0, 8);
  if (q && !all.some(s => s.insert === '#' + q)) all.push({insert: '#' + q, label: '新标签 · ' + q});
  return all;
}
