// iCal 解析与展开的测试（测试工具，不开浏览器）。  node test/check-ical.mjs
// 用 test/fixtures/test.ics；期望值按 Asia/Shanghai 写：没设 TZ 时下面自己设成它（CI 的 UTC 机器上也一样）。
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
process.env.TZ ||= 'Asia/Shanghai';
const {parseICS, occurrences} = await import('../src/data/ical.ts');
let ok = 0, bad = 0; const expect = (name, cond, extra = '') => { if (cond) { ok++; console.log('✓', name); } else { bad++; console.log('✗', name, extra); } };
const cal = parseICS(fs.readFileSync(fileURLToPath(new URL('fixtures/test.ics', import.meta.url)), 'utf8'));
expect(`日历名 X-WR-CALNAME（${cal.name}）`, cal.name === '课程日历');
const day = d => occurrences(cal.events, d, d), show = list => list.map(o => `${o.time || '全天'} ${o.title}`).join(' / ');
const d29 = day('2026-10-29');
expect(`10-29：${show(d29)}`, show(d29) === '07:00 晨读（2010 年起每天） / 09:30 组会（UTC 写法） / 16:00 智慧城市课程 / 21:00 一条很长的标题被折成 两行', show(d29));
const course = d29.find(o => o.title === '智慧城市课程');
expect('结束时刻、说明里的转义（\\, 与 \\n）', course.end === '17:40' && course.description === '第 9 周：城市感知, 课堂讨论\n带上笔记本', JSON.stringify(course));
expect('已取消的会不出现', !d29.some(o => o.title.includes('取消')));
expect('VALARM 里的 DESCRIPTION 不当成日程说明', !d29.find(o => o.title.startsWith('组会')).description);
expect('EXDATE：10-22 那次的课去掉', !day('2026-10-22').some(o => o.title.startsWith('智慧城市')));
const nov = occurrences(cal.events, '2026-11-05', '2026-11-06');
expect(`RECURRENCE-ID：11-05 的课改到 11-06 10:00（${show(nov.filter(o => o.title.startsWith('智慧')))}）`, !nov.some(o => o.date === '2026-11-05' && o.title.startsWith('智慧')) && nov.some(o => o.date === '2026-11-06' && o.time === '10:00' && o.title.includes('调课')));
expect('UNTIL：12-31 之后不再有课', !occurrences(cal.events, '2027-01-01', '2027-01-31').some(o => o.title.startsWith('智慧')));
const fri = occurrences(cal.events, '2026-09-01', '2027-03-31').filter(o => o.title.startsWith('月末')).map(o => o.date);
expect(`每月最后一个周五、COUNT=4、Windows 时区名（${fri.join(' ')}）`, fri.join(' ') === '2026-09-25 2026-10-30 2026-11-27 2026-12-25');
const all = day('2026-10-30').find(o => o.title === '学院运动会');
expect('全天日程：只在 10-30，没有时刻', all && all.allDay && all.time === '' && !day('2026-10-31').some(o => o.title === '学院运动会'));
const t0 = performance.now(); const far = day('2026-11-06'); const ms = performance.now() - t0;
expect(`2010 年起每天的规则，算 2026 年的一天也快（${ms.toFixed(1)}ms）`, far.some(o => o.title.startsWith('晨读')) && ms < 50);
let err = ''; try { parseICS('<html>not found</html>'); } catch (e) { err = e.message; }
expect(`不是日历时给出原因（${err}）`, /不是 iCal/.test(err));
// 夏令时：纽约 2026-03-08 开始夏令时，每天 09:00 的会换算成上海时间从 22:00 变成 21:00
const ny = parseICS('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:ny\nDTSTART;TZID=America/New_York:20260305T090000\nRRULE:FREQ=DAILY;COUNT=6\nSUMMARY:纽约晨会\nEND:VEVENT\nEND:VCALENDAR');
const nyt = occurrences(ny.events, '2026-03-05', '2026-03-11').map(o => o.date.slice(5) + ' ' + o.time);
expect(`夏令时换算（${nyt.join('，')}）`, nyt[0] === '03-05 22:00' && nyt.at(-1) === '03-10 21:00' && nyt.length === 6);
console.log(`通过 ${ok}，失败 ${bad}`); process.exitCode = bad ? 1 : 0;
