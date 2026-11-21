// 日历订阅（设计说明 21.4 “私密”、22.3 第 4 步）。订阅地址与取回来的日程只存在这台设备上（不进仓库、不同步），
// 每台设备要各自添加。取回的日历解析一次后缓存，换日或刷新后展开为规划板可选各周的日程。
//   plugin.local.calendars = [{id, name, url, every（小时）, last（上次联网）, okAt（上次取到）, ok, error, count, fails, retryAt, etag, modified, status, ms}]
//   取回的日程（解析后的 VEVENT 要点）存在本机的 IndexedDB（0.9.1；早先在 Obsidian 本机存储 'tideline-ical-<id>'，大日历会超过它 5MB 的上限而存不进去）
// 联网只发生在：添加订阅、立即刷新、到了刷新间隔（启动时和每 10 分钟看一次）。打开潮线只用缓存，不联网。
//   - 一次只取一个，相邻两次隔 1.5 秒；带上次的 ETag / Last-Modified，没变就回 304，不重新下载
//   - 每次最多等 60 秒（0.9.2：以前没有上限，服务器不回应时“正在刷新…”一直不结束，后面的刷新也全排在它后面）
//   - 429 / 503：到点检查按服务器的 Retry-After 等；没给就 15 分钟起步、每次翻倍（最多 6 小时）。其他失败 10 分钟起步。期间一直用上次取回的日程
//   - “立即刷新”是你点的：不受上面的退避限制，马上去取；同一个订阅正在取时，点了就等那一次的结果，不再排一次
// 用 Obsidian 的 requestUrl（不受跨域限制）。
import {requestUrl} from 'obsidian';
import type {App, RequestUrlResponse} from 'obsidian';
import {parseICS, occurrences} from './ical.ts';
import {HOST} from '../host.ts';
import {looseString} from './frontmatter.ts';
import type {CalendarFetchError, CalendarSub, Clock, FetchedCalendar, IcalEvent, IndexEvent, Occurrence} from './types.ts';

/** 日历要用到的插件部分（main.ts 的 CompassPlugin；测试工具里是替身） */
export interface CalendarHost {
  local: {calendars?: CalendarSub[]};
  localStore: {load(key: string): unknown; save(key: string, value: unknown): void};
  /** 用来按仓库区分缓存（替身可以没有） */
  app?: Pick<App, 'vault'> & {appId?: string};
  clock(): Clock;
  index: {setFeedEvents(list: IndexEvent[]): void};
  saveSettings(): Promise<void>;
  /** 测试工具可以把每次联网的上限改短（毫秒） */
  calendarTimeoutMs?: number;
}

export const EVERY = [1, 3, 6, 12, 24];
const DAY = 86400000, MIN = 60000, LIMIT = 60000;
const shift = (date: string, n: number) => { const [y, m, d] = date.split('-').map(Number), t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const httpUrl = (u: unknown) => String(u).trim().replace(/^webcals?:\/\//i, 'https://');
const hm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const header = (h: Record<string, string> | null | undefined, name: string) => { if (!h) return ''; const k = Object.keys(h).find(x => x.toLowerCase() === name); return k ? String(h[k]) : ''; };
// 等一个 Promise，最多 ms 毫秒；超时就抛出 message。原 Promise 先有结果就照它的结果（失败原因原样传下去）
const within = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let t = 0;
  const late = new Promise<never>((_, reject) => { t = window.setTimeout(() => reject(Object.assign(new Error(message), {timeout: true})), ms); });
  return Promise.race([promise, late]).finally(() => window.clearTimeout(t));
};
// Retry-After：秒数或 HTTP 日期 → 毫秒（拿不到给 0）
function retryAfter(v: string | null | undefined, now = Date.now()){
  if (!v) return 0; const n = Number(v); if (Number.isFinite(n)) return Math.max(0, n * 1000);
  const t = Date.parse(v); return Number.isFinite(t) ? Math.max(0, t - now) : 0;
}

// 取回并解析一个地址：成功给 {name, events, etag, modified, status}；没变给 {same: true}；失败抛出能直接给人看的原因（带 status、wait）
export async function fetchCalendar(url: string, {etag = '', modified = '', timeout = LIMIT}: {etag?: string; modified?: string; timeout?: number} = {}): Promise<FetchedCalendar>{
  const u = httpUrl(url);
  if (!/^https?:\/\//i.test(u)) throw new Error('这个地址不是以 http、https 或 webcal 开头的 iCal 链接');
  const headers: Record<string, string> = {Accept: 'text/calendar, */*'};
  if (etag) headers['If-None-Match'] = etag; if (modified) headers['If-Modified-Since'] = modified;
  let res: RequestUrlResponse;
  try { res = await within(requestUrl({url: u, method: 'GET', throw: false, headers}), timeout, `${Math.round(timeout / 1000)} 秒没有回应（服务器太慢或网络不通）`); }
  catch (e) { throw (e as CalendarFetchError)?.timeout ? e : new Error('连不上：' + looseString((e as Error)?.message || e)); }
  if (res.status === 304) return {same: true, status: 304};
  if (res.status === 429 || res.status === 503) throw Object.assign(new Error(res.status === 429 ? '日历服务器说请求太频繁（429）' : '日历服务器暂时不可用（503）'), {status: res.status, wait: retryAfter(header(res.headers, 'retry-after'))});
  if (res.status >= 400) throw Object.assign(new Error('HTTP ' + res.status), {status: res.status});
  const text = res.text || '';
  if (!/BEGIN:VCALENDAR/i.test(text)) throw Object.assign(new Error('取回来的不是 iCal 日历（可能要登录，或地址不对）'), {status: res.status});
  return {...parseICS(text), etag: header(res.headers, 'etag'), modified: header(res.headers, 'last-modified'), status: res.status};
}
// 只留还可能用得上的：没有重复且一个多月前就结束了的不要
function trim(events: IcalEvent[], today: string){
  const [y, m, d] = today.split('-').map(Number), cut = Date.UTC(y, m - 1, d) - 35 * DAY;
  return events.filter(e => e.rule || e.start.wall + Math.max(e.length, 0) >= cut);
}

// 本机缓存：IndexedDB（按仓库分开）；打不开或 4 秒没有回应时退回 Obsidian 本机存储
function createStore(plugin: CalendarHost){
  const legacy = plugin.localStore, vault = plugin.app?.appId || plugin.app?.vault?.getName?.() || 'vault';
  const key = (id: string) => vault + ':' + id, oldKey = (id: string) => 'tideline-ical-' + id;
  let db: Promise<IDBDatabase | null> | null = null;
  // indexedDB.open 同步抛错时，Promise 的执行函数里抛出就是以它失败（原来另写的 try/catch 再 reject 与此相同）；失败原因只用来判断“打不开”，不给人看
  const open = () => db ??= within(new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('tideline-calendars', 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('events')) r.result.createObjectStore('events'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error ?? new Error('IndexedDB 打不开'));
  }), 4000, 'IndexedDB 打不开').catch(() => null);
  const tx = async (mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) => { const d = await open(); if (!d) throw new Error('no idb');
    return within(new Promise<unknown>((resolve, reject) => { const t = d.transaction('events', mode), r = fn(t.objectStore('events')); t.oncomplete = () => resolve(r?.result); t.onerror = t.onabort = () => reject(t.error ?? new Error('IndexedDB 没有完成')); }), 4000, 'IndexedDB 没有回应'); };
  const old = (id: string) => { try { return legacy.load(oldKey(id)); } catch { return null; } };
  return {
    async get(id: string): Promise<IcalEvent[] | null>{
      try { const v = await tx('readonly', s => s.get(key(id))); if (Array.isArray(v)) return v as IcalEvent[]; } catch { /* IndexedDB 不可用：看旧的本机存储 */ }
      const o = old(id);
      if (Array.isArray(o)) { try { await tx('readwrite', s => s.put(o, key(id))); legacy.save(oldKey(id), null); } catch { /* 搬不动就留在原处 */ } return o as IcalEvent[]; } // 搬过来（搬不动就留在原处照常用）
      return null;
    },
    async set(id: string, events: IcalEvent[] | null){
      try { await tx('readwrite', s => events ? s.put(events, key(id)) : s.delete(key(id))); try { legacy.save(oldKey(id), null); } catch { /* 旧缓存清不掉不要紧 */ } return true; }
      catch { try { legacy.save(oldKey(id), events); return true; } catch { return false; } }
    },
  };
}

export function createCalendars(plugin: CalendarHost){
  const store = createStore(plugin), cache = new Map<string, IcalEvent[]>(); // id → 解析后的日程（内存里一份，展开时用）
  const subs = () => plugin.local.calendars ??= [];
  const running = new Map<string, Promise<CalendarSub>>(); // id → 正在进行的那一次刷新
  const limit = () => plugin.calendarTimeoutMs || LIMIT; // 测试工具可以改短
  let lastDate: string | null = null, loaded: Promise<void> | null = null, queue: Promise<unknown> = Promise.resolve(), lastNet = 0;
  // 启动时把各订阅的缓存读进内存（读完才 publish，打开就有上次的日程）
  function load(){ for (const s of subs()) if (!s.okAt && s.ok && s.last) s.okAt = s.last; // 0.9 以前没有 okAt：上次成功就是上次取到
    return loaded ??= Promise.all(subs().map(async s => { const ev = await store.get(s.id); if (ev) cache.set(s.id, ev); })).then(() => publish()).catch(e => console.warn('潮线：载入日历缓存出错', e)); }
  // 思索可翻到前四周、后八周。全天日程也进入索引，由今日时间轴自行筛掉。
  function publish(){
    const {date} = plugin.clock();
    lastDate = date;
    const week: string = HOST.weekStart(date), from = shift(week, -28), to = shift(week, 62), list: IndexEvent[] = [];
    // 一个订阅展开出错不连累别的，也不让载入和刷新卡住（0.9.2）
    for (const s of subs()) { const ev = cache.get(s.id); if (!Array.isArray(ev)) continue; let occ: Occurrence[] = [];
      try { occ = occurrences(ev, from, to); } catch (e) { console.warn('潮线：展开日历订阅出错', s.name, e); continue; }
      for (const o of occ) list.push({id: `ical:${s.id}:${o.uid}:${o.date}T${o.time}`, date: o.date, time: o.time, end: o.end, allDay: o.allDay, title: o.title, description: o.description, source: s.name}); }
    plugin.index.setFeedEvents(list);
  }
  async function keep(s: CalendarSub, events: IcalEvent[]){ cache.set(s.id, events); await store.set(s.id, events); }
  // 一次只联网一个，相邻两次至少隔 1.5 秒（每一次都有 60 秒上限，不会把后面的卡住）
  const serial = <T>(fn: () => Promise<T>) => { const run = queue.then(async () => { const gap = 1500 - (Date.now() - lastNet); if (gap > 0) await new Promise(r => window.setTimeout(r, gap)); try { return await fn(); } finally { lastNet = Date.now(); } }); queue = run.catch(() => {}); return run; };
  // 刷新一个订阅。manual：你点的“立即刷新”——不受退避限制；到点检查时被限流、还没到可以再试的时刻就不联网
  function refresh(s: CalendarSub, {manual = false}: {manual?: boolean} = {}): Promise<CalendarSub>{
    if (running.has(s.id)) return running.get(s.id)!;
    const job = (async () => {
      await within(load(), 8000, '').catch(() => {});
      if (!manual && s.retryAt && Date.now() < s.retryAt) return s;
      return serial(() => attempt(s, manual));
    })().finally(() => running.delete(s.id));
    running.set(s.id, job); return job;
  }
  async function attempt(s: CalendarSub, manual: boolean){
    const has = cache.has(s.id), t0 = Date.now();
    try {
      let cal: FetchedCalendar;
      try { cal = await fetchCalendar(s.url, has ? {etag: s.etag, modified: s.modified, timeout: limit()} : {timeout: limit()}); }
      catch (e) { // 你点的：服务器只要等十几秒就照它说的等一下再试一次
        if (!manual || (e as CalendarFetchError)?.status !== 429 || !(e as CalendarFetchError).wait || (e as CalendarFetchError).wait! > 15000) throw e;
        await new Promise(r => window.setTimeout(r, (e as CalendarFetchError).wait)); cal = await fetchCalendar(s.url, has ? {etag: s.etag, modified: s.modified, timeout: limit()} : {timeout: limit()});
      }
      if (!cal.same) { const events = trim(cal.events, plugin.clock().date); await keep(s, events); Object.assign(s, {count: cal.events.length, etag: cal.etag || '', modified: cal.modified || ''}); if (!s.name) s.name = cal.name || new URL(httpUrl(s.url)).hostname; }
      Object.assign(s, {ok: true, error: '', last: new Date().toISOString(), okAt: new Date().toISOString(), fails: 0, retryAt: 0, status: cal.status || 200, ms: Date.now() - t0});
    } catch (e) {
      // e：fetchCalendar 抛出的（带 status、wait、timeout），或别的意外错误
      const fails = (s.fails || 0) + 1, limited = (e as CalendarFetchError)?.status === 429 || (e as CalendarFetchError)?.status === 503;
      const backoff = Math.min((limited ? 15 : 10) * MIN * 2 ** (fails - 1), 6 * 60 * MIN);
      Object.assign(s, {ok: false, fails, last: new Date().toISOString(), retryAt: Date.now() + Math.max((e as CalendarFetchError)?.wait || 0, backoff), status: (e as CalendarFetchError)?.status || ((e as CalendarFetchError)?.timeout ? 'timeout' : 'error'), ms: Date.now() - t0});
      s.error = ((e as CalendarFetchError)?.message || String(e)) + '；' + waitText(s);
    }
    await plugin.saveSettings(); publish(); return s;
  }
  function waitText(s: CalendarSub){ const n = cache.get(s.id)?.length; return `${hm(s.retryAt)} 自动再试${n ? `，先用上次取回的日程（${n} 个）` : ''}`; }
  async function add(name: string, url: string, events?: IcalEvent[] | null){
    const s: CalendarSub = {id: Math.random().toString(36).slice(2, 10), name: name.trim(), url: url.trim(), every: 6, last: null, okAt: null, ok: null, error: '', count: 0, fails: 0, retryAt: 0};
    subs().push(s);
    if (events) { await keep(s, trim(events, plugin.clock().date)); Object.assign(s, {ok: true, last: new Date().toISOString(), okAt: new Date().toISOString(), count: events.length}); await plugin.saveSettings(); publish(); return s; }
    return refresh(s, {manual: true});
  }
  async function remove(id: string){ plugin.local.calendars = subs().filter(s => s.id !== id); cache.delete(id); await store.set(id, null); await plugin.saveSettings(); publish(); }
  async function setEvery(id: string){ const s = subs().find(x => x.id === id); if (!s) return; s.every = EVERY[(EVERY.indexOf(s.every) + 1) % EVERY.length]; await plugin.saveSettings(); }
  // 该刷新的：还没取到过（没有缓存），或离上次取到已过了间隔；被限流的等到可以再试的时刻
  const due = (s: CalendarSub, now: number) => !(s.retryAt && now < s.retryAt) && (!cache.has(s.id) || !s.okAt || now - Date.parse(s.okAt) >= s.every * 3600000);
  // 启动时与每 10 分钟：只刷到了间隔的；换了日就重新展开
  async function tick(){
    await within(load(), 8000, '').catch(() => {});
    const now = Date.now(), list = subs().filter(s => due(s, now));
    for (const s of list) await refresh(s);
    if (plugin.clock().date !== lastDate) publish();
    return list.length;
  }
  // 接下来的几个日程（含全天）：起航页“测试刷新”成功后列两个
  function upcoming(events: IcalEvent[], n = 2){
    const {date, time} = plugin.clock();
    return occurrences(events, date, shift(date, 60)).filter(o => o.date > date || o.allDay || (o.end || o.time) >= time).slice(0, n);
  }
  return {list: subs, load, publish, refresh, add, remove, setEvery, tick, upcoming, fetch: (url: string) => fetchCalendar(url), cached: (id: string) => cache.get(id) || null, busy: (id: string) => running.has(id)};
}
