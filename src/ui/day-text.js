// 0.9.3（上线前评审 P2-1）：插件自己写的日期统一写成“10月26日”（设计说明 3.2）；不是今年时写“2025年10月26日”。
// 原型画的（如复盘周表的 10/26）不动。
export function dayText(date, today = ''){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || '')); if (!m) return String(date || '');
  const md = `${Number(m[2])}月${Number(m[3])}日`;
  return today && String(today).slice(0, 4) !== m[1] ? `${m[1]}年${md}` : md;
}
